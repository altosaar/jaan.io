#!/usr/bin/env node
/**
 * audio-peaks.mjs — precompute the waveform for an mp3 a post plays.
 *
 *   npm run audio:peaks -- public/files/lifelogging/<name>.mp3
 *   npm run audio:peaks -- <private>.mp3 public/files/lifelogging/<name>.peaks.json
 *
 * The second form is for audio that is shown but not published: only the
 * peaks reach public/, the mp3 stays where it is.
 *
 * Writes <name>.peaks.json beside the mp3: `{ duration, peaks: [[…], […]] }`,
 * one array per channel, which src/components/AudioTickerRuntime.astro hands
 * to wavesurfer.js as its `peaks` and `duration` options.
 *
 * WHY PRECOMPUTE. Given only a URL, wavesurfer fetches the whole file and
 * decodes it in the page before it can draw a single bar — the mp3 is paid for
 * on load, by everyone, whether or not they press play. Given peaks and a
 * duration it draws from those and leaves the file to the <audio> element,
 * which fetches it when someone does. A 10 KB JSON file for a 577 KB mp3.
 *
 * THE NUMBERS are wavesurfer's own `exportPeaks()`, reproduced: each bucket
 * keeps the sample with the largest magnitude, sign and all. So the drawing is
 * the one the library would have made from decoding the file itself.
 *
 * Also imported by scripts/audio-trim.mjs, which runs it on every snippet it
 * exports.
 *
 * Needs ffmpeg and ffprobe on the PATH. It is an authoring step, run by hand
 * when an mp3 is added, so neither is a build dependency.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";

// Buckets per channel. The waveform is ~300 bars across the 850px column, so
// this is several times what is drawn — and wavesurfer resamples down anyway.
const MAX_LENGTH = 1000;
// Three decimals: finer than a pixel at any height the player is drawn at.
const PRECISION = 1000;
const RATE = 44100;

/**
 * Write <file>.peaks.json beside an mp3, or to `out`. Returns what it wrote.
 * Anything else already in that file — the markers scripts/audio-annotate.mjs
 * saves there — is kept; only `duration` and `peaks` are replaced.
 */
export function writePeaks(file, out = file.replace(/\.mp3$/, ".peaks.json")) {
  const probe = JSON.parse(
    execFileSync(
      "ffprobe",
      ["-v", "error", "-show_entries", "format=duration:stream=channels", "-of", "json", file],
      {
        encoding: "utf8",
      },
    ),
  );
  const duration = Number(probe.format.duration);
  const channels = Math.min(2, probe.streams[0].channels);

  // Decode to interleaved 32-bit float PCM on stdout.
  const pcm = execFileSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-i",
      file,
      "-f",
      "f32le",
      "-acodec",
      "pcm_f32le",
      "-ac",
      String(channels),
      "-ar",
      String(RATE),
      "-",
    ],
    { maxBuffer: 1 << 30 },
  );
  const samples = new Float32Array(pcm.buffer, pcm.byteOffset, pcm.byteLength / 4);
  const frames = samples.length / channels;

  const peaks = [];
  for (let c = 0; c < channels; c++) {
    const data = [];
    const size = frames / MAX_LENGTH;
    for (let j = 0; j < MAX_LENGTH; j++) {
      let max = 0;
      for (let i = Math.floor(j * size); i < Math.min(frames, Math.ceil((j + 1) * size)); i++) {
        const n = samples[i * channels + c];
        if (Math.abs(n) > Math.abs(max)) max = n;
      }
      data.push(Math.round(max * PRECISION) / PRECISION);
    }
    peaks.push(data);
  }

  const kept = existsSync(out) ? JSON.parse(readFileSync(out, "utf8")) : {};
  writeFileSync(out, JSON.stringify({ ...kept, duration, peaks }) + "\n");
  return { out, channels, duration };
}

// Run as a script (`npm run audio:peaks -- <file>`), not when imported.
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [file, out] = process.argv.slice(2);
  if (!file?.endsWith(".mp3")) {
    console.error("usage: npm run audio:peaks -- <path/to/file.mp3> [out.peaks.json]");
    process.exit(1);
  }
  const written = writePeaks(file, out);
  const { channels, duration } = written;
  console.log(
    `${written.out}: ${channels} channel(s) × ${MAX_LENGTH} peaks, ${duration.toFixed(2)}s`,
  );
}
