// A minimal 8-bit greyscale PNG writer.
//
// Two of the seven index marks are rasters — the glucose heatmap and the New
// York parcel map — and both are far too dense to draw as SVG rectangles: at
// the resolution needed to look like the real thing they came to hundreds of
// kilobytes apiece. As a PNG carried in a data URI they are a couple of kB.
//
// Greyscale, because the PNG is used as an SVG <mask>: white is fully painted,
// black is fully transparent, and the thing being masked is a plain
// currentColor rectangle. So the raster stays theme-aware in exactly the same
// way the vector marks are, rather than baking in a colour.
//
// Hand-rolled rather than reached for from sharp: this is the only image work
// in the project, it runs in a one-off script, and 40 lines of zlib and CRC is
// cheaper than a native dependency in a sub-project that otherwise has none.
import { deflateSync } from "node:zlib";

const CRC_TABLE = Int32Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c;
});

const crc32 = (buf) => {
  let c = -1;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
};

function chunk(type, data) {
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, "ascii");
  data.copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}

/**
 * Encode a width × height grid of 0–255 grey values as a PNG.
 *
 * @param {Uint8Array} grey row-major, length width * height
 */
export function greyPNG(grey, width, height) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 0; // colour type: greyscale
  // 10–12: deflate, adaptive filtering, no interlace — all zero.

  // One filter byte per scanline. Filter 0 (none) throughout: these are small
  // images of smooth data, and deflate handles them well enough that choosing
  // per-row filters would not repay the code.
  const raw = Buffer.alloc((width + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width + 1)] = 0;
    Buffer.from(grey.subarray(y * width, (y + 1) * width)).copy(raw, y * (width + 1) + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}
