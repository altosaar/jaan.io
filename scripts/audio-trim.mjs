#!/usr/bin/env node
/**
 * audio-trim.mjs — cut snippets out of long audio files, for posts to embed.
 *
 *   npm run audio:trim -- ~/projects/petrograph/tmp-audio
 *   npm run audio:trim -- ~/projects/petrograph/sessions/2026-08-17 --out public/files/lifelogging
 *
 * Opens a page in the browser listing the audio files in that folder. Pick one,
 * drag across its waveform to keep a stretch, mark stretches inside it to cut,
 * type a name, press ⏎. It writes <out>/<name>.mp3 and <name>.peaks.json and
 * copies the one-line <audio class="snippet"> embed to the clipboard — the line
 * src/components/AudioTickerRuntime.astro turns into a player. The keys are
 * listed on the page itself (scripts/audio-trim.html).
 *
 * TWO WAYS TO CUT, and the page says which one an export used.
 *
 *   Lossless (the default, mp3 in): the output is the source's own mp3 frames,
 *   copied, not decoded — ffmpeg's concat demuxer with an inpoint/outpoint per
 *   kept stretch and `-c copy`. Nothing is re-encoded, so nothing is lost; the
 *   price is that every cut lands on a frame boundary (1152 samples, ~26 ms at
 *   44.1 kHz) and there is no fade, so a cut through the music bed can click.
 *
 *   Faded (the checkbox, or any source that is not an mp3): decodes, puts a
 *   short fade on every edge, and encodes once — at the source's bitrate for an
 *   mp3, 192k otherwise. One generation of loss from an mp3; none that matters
 *   from a WAV or FLAC master, which is why a lossless master is the better
 *   thing to cut from when one exists.
 *
 * A local authoring tool: it listens on 127.0.0.1 only, and nothing here is
 * part of the site build. Needs ffmpeg and ffprobe on the PATH.
 */
import { execFile, execFileSync, spawn } from "node:child_process";
import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
  mkdtempSync,
  mkdirSync,
  rmSync,
} from "node:fs";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import { basename, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { writePeaks } from "./audio-peaks.mjs";
import { TYPES, json, sendFile } from "./audio-serve.mjs";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const PUBLIC = join(ROOT, "public");
const WAVESURFER = join(ROOT, "node_modules/wavesurfer.js/dist");
const PAGE = join(ROOT, "scripts/audio-trim.html");
const AUDIO = new Set([".mp3", ".wav", ".flac", ".m4a", ".aif", ".aiff"]);
// Fade lengths for a faded export: the snippet's own start and end, and each
// join where a stretch was cut out of the middle. Long enough to kill a click,
// short enough not to swallow a consonant.
const EDGE_FADE = 0.05;
const JOIN_FADE = 0.015;

// ── arguments ────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  if (i === -1) return fallback;
  const [, value] = args.splice(i, 2);
  return value;
};
const out = resolve(flag("--out", join(PUBLIC, "files/lifelogging")));
const port = Number(flag("--port", 4455));
const source = args[0] && resolve(args[0]);
if (!source || !existsSync(source) || !statSync(source).isDirectory()) {
  console.error(
    "usage: npm run audio:trim -- <folder of audio> [--out public/files/<dir>] [--port 4455]",
  );
  process.exit(1);
}
if (!out.startsWith(PUBLIC + "/")) {
  console.error(`--out must be under public/ so the site serves it: ${out}`);
  process.exit(1);
}

// ── helpers ──────────────────────────────────────────────────────────────────
const probe = (file) =>
  JSON.parse(
    execFileSync(
      "ffprobe",
      [
        "-v",
        "error",
        "-show_entries",
        "format=duration:stream=codec_name,bit_rate",
        "-of",
        "json",
        file,
      ],
      { encoding: "utf8" },
    ),
  );

const run = (cmd, argv) =>
  new Promise((ok, fail) =>
    execFile(cmd, argv, { maxBuffer: 1 << 26 }, (err, _stdout, stderr) =>
      err ? fail(new Error(stderr.trim() || err.message)) : ok(),
    ),
  );

// Only a bare file name from the listing, never a path.
const sourceFile = (name) => {
  const file = join(source, basename(String(name)));
  if (!AUDIO.has(extname(file).toLowerCase()) || !existsSync(file))
    throw new Error(`no such file: ${name}`);
  return file;
};

const slug = (name) =>
  String(name)
    .toLowerCase()
    .replace(/\.mp3$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

// ── export ───────────────────────────────────────────────────────────────────
async function exportSnippet({ file: name, segments, name: outName, fade, overwrite }) {
  const file = sourceFile(name);
  const stem = slug(outName);
  if (!stem) throw new Error("give the snippet a name");
  if (!Array.isArray(segments) || !segments.length) throw new Error("nothing to export");
  const spans = segments
    .map(([s, e]) => [Math.max(0, Number(s)), Number(e)])
    .filter(([s, e]) => Number.isFinite(s) && Number.isFinite(e) && e > s)
    .sort((a, b) => a[0] - b[0]);
  if (!spans.length) throw new Error("nothing to export");

  const target = join(out, `${stem}.mp3`);
  if (existsSync(target) && !overwrite) return { exists: true, path: relative(ROOT, target) };

  const info = probe(file);
  const isMp3 = info.streams[0]?.codec_name === "mp3";
  const lossless = isMp3 && !fade;
  const tmp = mkdtempSync(join(tmpdir(), "audio-trim-"));
  const staged = join(tmp, "out.mp3");
  try {
    if (lossless) {
      // One inpoint/outpoint pair per kept stretch, all from the same file.
      const quoted = file.replaceAll("'", "'\\''");
      const list = spans
        .map(([s, e]) => `file '${quoted}'\ninpoint ${s}\noutpoint ${e}\n`)
        .join("");
      writeFileSync(join(tmp, "list.txt"), list);
      await run("ffmpeg", [
        "-v",
        "error",
        "-f",
        "concat",
        "-safe",
        "0",
        "-i",
        join(tmp, "list.txt"),
        "-map",
        "0:a",
        "-map_metadata",
        "-1",
        "-c",
        "copy",
        staged,
      ]);
    } else {
      // Trim each stretch, fade its edges, join them, encode once.
      const last = spans.length - 1;
      const chains = spans.map(([s, e], i) => {
        const len = e - s;
        const fin = Math.min(i === 0 ? EDGE_FADE : JOIN_FADE, len / 2);
        const fout = Math.min(i === last ? EDGE_FADE : JOIN_FADE, len / 2);
        return (
          `[0:a]atrim=${s}:${e},asetpts=PTS-STARTPTS,` +
          `afade=t=in:d=${fin},afade=t=out:st=${len - fout}:d=${fout}[a${i}]`
        );
      });
      const graph = `${chains.join(";")};${spans.map((_, i) => `[a${i}]`).join("")}concat=n=${spans.length}:v=0:a=1[out]`;
      const bitrate =
        isMp3 && Number(info.streams[0].bit_rate) ? Number(info.streams[0].bit_rate) : 192000;
      await run("ffmpeg", [
        "-v",
        "error",
        "-i",
        file,
        "-filter_complex",
        graph,
        "-map",
        "[out]",
        "-map_metadata",
        "-1",
        "-c:a",
        "libmp3lame",
        "-b:a",
        `${Math.round(bitrate / 1000)}k`,
        staged,
      ]);
    }
    mkdirSync(out, { recursive: true });
    writeFileSync(target, readFileSync(staged));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }

  const { duration } = writePeaks(target);
  const url = "/" + relative(PUBLIC, target).split("/").join("/");
  return {
    path: relative(ROOT, target),
    url,
    duration,
    lossless,
    embed: `<audio class="snippet" src="${url}" controls preload="none"></audio>`,
  };
}

// ── server ───────────────────────────────────────────────────────────────────

createServer(async (req, res) => {
  const url = new URL(req.url, "http://localhost");
  const path = decodeURIComponent(url.pathname);
  try {
    if (path === "/") {
      res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
      return res.end(readFileSync(PAGE));
    }
    if (path.startsWith("/vendor/")) {
      const file = join(WAVESURFER, path.slice("/vendor/".length));
      if (!file.startsWith(WAVESURFER + "/") || !file.endsWith(".esm.js") || !existsSync(file)) {
        return json(res, 404, { error: "not found" });
      }
      res.writeHead(200, { "Content-Type": "text/javascript" });
      return res.end(readFileSync(file));
    }
    if (path === "/api/files") {
      const files = readdirSync(source)
        .filter((f) => AUDIO.has(extname(f).toLowerCase()) && !f.startsWith("."))
        .map((f) => ({
          name: f,
          mtime: statSync(join(source, f)).mtimeMs,
          size: statSync(join(source, f)).size,
        }))
        .sort((a, b) => b.mtime - a.mtime);
      return json(res, 200, { source, out: relative(ROOT, out), files });
    }
    if (path.startsWith("/audio/")) {
      const file = sourceFile(path.slice("/audio/".length));
      return sendFile(req, res, file, TYPES[extname(file).toLowerCase()]);
    }
    if (path.startsWith("/out/")) {
      const file = join(out, basename(path));
      if (!file.endsWith(".mp3") || !existsSync(file))
        return json(res, 404, { error: "not found" });
      return sendFile(req, res, file, "audio/mpeg");
    }
    if (path === "/api/export" && req.method === "POST") {
      let body = "";
      for await (const chunk of req) body += chunk;
      return json(res, 200, await exportSnippet(JSON.parse(body)));
    }
    json(res, 404, { error: "not found" });
  } catch (err) {
    json(res, 400, { error: err.message });
  }
}).listen(port, "127.0.0.1", () => {
  const address = `http://localhost:${port}/`;
  console.log(
    `audio-trim: ${source}\n        → ${relative(ROOT, out)}/\n        ${address}  (ctrl-c to stop)`,
  );
  if (!process.env.NO_OPEN) spawn("open", [address], { stdio: "ignore", detached: true }).unref();
});
