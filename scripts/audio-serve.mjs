/**
 * audio-serve.mjs — what the two local audio tools (audio-trim.mjs and
 * audio-annotate.mjs) share for serving files to their pages.
 */
import { createReadStream, statSync } from "node:fs";

export const TYPES = {
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
  ".flac": "audio/flac",
  ".m4a": "audio/mp4",
  ".aif": "audio/aiff",
  ".aiff": "audio/aiff",
};

/** Stream a file, honouring Range — the browser cannot seek in audio without it. */
export function sendFile(req, res, file, type) {
  const size = statSync(file).size;
  const range = /bytes=(\d*)-(\d*)/.exec(req.headers.range ?? "");
  if (range) {
    const start = range[1] ? Number(range[1]) : 0;
    const end = range[2] ? Number(range[2]) : size - 1;
    res.writeHead(206, {
      "Content-Type": type,
      "Accept-Ranges": "bytes",
      "Content-Range": `bytes ${start}-${end}/${size}`,
      "Content-Length": end - start + 1,
    });
    createReadStream(file, { start, end }).pipe(res);
  } else {
    res.writeHead(200, { "Content-Type": type, "Accept-Ranges": "bytes", "Content-Length": size });
    createReadStream(file).pipe(res);
  }
}

export const json = (res, status, body) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(body));
};
