#!/usr/bin/env node
/**
 * audio-annotate.mjs — put timestamped notes on a post's waveforms.
 *
 *   npm run audio:annotate
 *   npm run audio:annotate -- --dir public/files/lifelogging --source ~/projects/petrograph
 *
 * Opens a page listing every <name>.peaks.json in --dir (the waveforms posts
 * embed). Pick one, double-click the waveform to drop a marker, write its
 * note, choose which marker the post shows first, ⌘S. The keys are listed on
 * the page (scripts/audio-annotate.html).
 *
 * THE NOTES ARE SAVED INTO THE PEAKS FILE, as
 *
 *   "markers": [{ "t": 252.4, "text": "…" }, …],   sorted by time
 *   "selected": 0                                   the one shown by default
 *
 * beside `duration` and `peaks`, which are left alone. The post's player
 * (src/components/AudioTickerRuntime.astro) already fetches that file, so a
 * waveform picks its notes up with no change to the post; and
 * scripts/audio-peaks.mjs keeps them when it rewrites the peaks.
 *
 * It needs only the peaks, so it annotates a recording that is not published
 * (drawn from its peaks alone) as readily as one that is. To listen while
 * annotating, the page looks for <name>.mp3 beside the peaks, then anywhere
 * under --source (a few levels down, so petrograph's sessions/<date>/ folders
 * are found); without one it is view-only and markers go where you click.
 *
 * A local authoring tool: it listens on 127.0.0.1 only, and nothing here is
 * part of the site build.
 */
import { spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { basename, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { json, sendFile } from "./audio-serve.mjs";

const ROOT = resolve(fileURLToPath(import.meta.url), "../..");
const WAVESURFER = join(ROOT, "node_modules/wavesurfer.js/dist");
const PAGE = join(ROOT, "scripts/audio-annotate.html");

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf(name);
  return i === -1 ? fallback : args[i + 1];
};
const dir = resolve(flag("--dir", join(ROOT, "public/files/lifelogging")));
const sources = [dir, ...(flag("--source") ? [resolve(flag("--source"))] : [])];
const port = Number(flag("--port", 4456));
if (!existsSync(dir)) {
  console.error(`no such folder: ${dir}`);
  process.exit(1);
}

const stems = () =>
  readdirSync(dir)
    .filter((f) => f.endsWith(".peaks.json"))
    .map((f) => f.slice(0, -".peaks.json".length))
    .sort();

// Only a stem from the listing, never a path.
const peaksFile = (stem) => {
  const file = join(dir, `${basename(String(stem))}.peaks.json`);
  if (!existsSync(file)) throw new Error(`no such waveform: ${stem}`);
  return file;
};

/** <stem>.mp3 beside the peaks, or anywhere a few levels under --source. */
function findAudio(stem, root, depth = 3) {
  const direct = join(root, `${stem}.mp3`);
  if (existsSync(direct)) return direct;
  if (depth === 0) return null;
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith(".") || entry.name === "node_modules")
      continue;
    const found = findAudio(stem, join(root, entry.name), depth - 1);
    if (found) return found;
  }
  return null;
}
const audioFor = (stem) =>
  sources.map((s) => findAudio(stem, s, s === dir ? 0 : 3)).find(Boolean) ?? null;

function save({ stem, markers, selected }) {
  const file = peaksFile(stem);
  const clean = (Array.isArray(markers) ? markers : [])
    .map((m) => ({ t: Math.round(Number(m.t) * 100) / 100, text: String(m.text ?? "").trim() }))
    .filter((m) => Number.isFinite(m.t) && m.t >= 0)
    .sort((a, b) => a.t - b.t);
  const data = JSON.parse(readFileSync(file, "utf8"));
  data.markers = clean;
  // `selected` arrives as the chosen marker's time, so it survives the sort.
  const i = clean.findIndex((m) => Math.abs(m.t - Number(selected)) < 0.005);
  data.selected = i === -1 ? 0 : i;
  if (!clean.length) {
    delete data.markers;
    delete data.selected;
  }
  writeFileSync(file, JSON.stringify(data) + "\n");
  return { path: relative(ROOT, file), markers: clean.length };
}

createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
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
    if (path === "/api/list") {
      return json(res, 200, {
        dir: relative(ROOT, dir),
        items: stems().map((stem) => {
          const data = JSON.parse(readFileSync(peaksFile(stem), "utf8"));
          return {
            stem,
            duration: data.duration,
            markers: data.markers?.length ?? 0,
            audio: Boolean(audioFor(stem)),
            mtime: statSync(peaksFile(stem)).mtimeMs,
          };
        }),
      });
    }
    if (path.startsWith("/peaks/")) {
      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(readFileSync(peaksFile(path.slice("/peaks/".length))));
    }
    if (path.startsWith("/audio/")) {
      const file = audioFor(basename(path));
      if (!file) return json(res, 404, { error: "no audio" });
      return sendFile(req, res, file, "audio/mpeg");
    }
    if (path === "/api/save" && req.method === "POST") {
      let body = "";
      for await (const chunk of req) body += chunk;
      return json(res, 200, save(JSON.parse(body)));
    }
    json(res, 404, { error: "not found" });
  } catch (err) {
    json(res, 400, { error: err.message });
  }
}).listen(port, "127.0.0.1", () => {
  const address = `http://localhost:${port}/`;
  console.log(`audio-annotate: ${relative(ROOT, dir)}/\n        ${address}  (ctrl-c to stop)`);
  if (!process.env.NO_OPEN) spawn("open", [address], { stdio: "ignore", detached: true }).unref();
});
