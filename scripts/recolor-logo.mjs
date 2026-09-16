#!/usr/bin/env node
/**
 * recolor-logo.mjs — put the Willy Auto logo on a dark blue background.
 *
 *   node scripts/recolor-logo.mjs <input.png> [output.png] [#hex]
 *   node scripts/recolor-logo.mjs willy-logo.png
 *
 * Flood-fills inward from the edges of the image, replacing the light
 * background with the brand navy while leaving the emblem untouched.
 * Pure Node — no npm install needed. PNG in, PNG out.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { deflateSync, inflateSync } from 'node:zlib';

const NAVY = '#071026';      // brand dark navy
const TOLERANCE = 46;        // how far a pixel may drift and still count as background

/* ---------------- CRC32 ---------------- */
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

/* ---------------- decode ---------------- */
function readChunks(buf) {
  const sig = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) {
    if (buf[i] !== sig[i]) throw new Error('Not a PNG file. Export your logo as .png and try again.');
  }
  const chunks = [];
  let p = 8;
  while (p < buf.length) {
    const len = buf.readUInt32BE(p);
    const type = buf.toString('ascii', p + 4, p + 8);
    chunks.push({ type, data: buf.subarray(p + 8, p + 8 + len) });
    p += 12 + len;
  }
  return chunks;
}

function paeth(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
  return pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
}

function unfilter(raw, width, height, bpp) {
  const stride = width * bpp;
  const out = Buffer.alloc(stride * height);
  let pos = 0;
  for (let y = 0; y < height; y++) {
    const filter = raw[pos++];
    const line = raw.subarray(pos, pos + stride);
    pos += stride;
    const cur = out.subarray(y * stride, (y + 1) * stride);
    const prev = y > 0 ? out.subarray((y - 1) * stride, y * stride) : null;
    for (let x = 0; x < stride; x++) {
      const a = x >= bpp ? cur[x - bpp] : 0;
      const b = prev ? prev[x] : 0;
      const c = prev && x >= bpp ? prev[x - bpp] : 0;
      let v = line[x];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) v += paeth(a, b, c);
      else if (filter !== 0) throw new Error('Unsupported PNG filter ' + filter);
      cur[x] = v & 0xff;
    }
  }
  return out;
}

/** Returns { width, height, rgba } with rgba as 4 bytes per pixel. */
function decodePng(buf) {
  const chunks = readChunks(buf);
  const ihdr = chunks.find((c) => c.type === 'IHDR');
  if (!ihdr) throw new Error('PNG is missing its header chunk.');

  const width = ihdr.data.readUInt32BE(0);
  const height = ihdr.data.readUInt32BE(4);
  const depth = ihdr.data[8];
  const colorType = ihdr.data[9];
  const interlace = ihdr.data[12];

  if (depth !== 8) throw new Error(`Only 8-bit PNGs are supported (this one is ${depth}-bit). Re-export at 8 bits per channel.`);
  if (interlace !== 0) throw new Error('Interlaced PNGs are not supported. Re-export without interlacing.');

  const idat = Buffer.concat(chunks.filter((c) => c.type === 'IDAT').map((c) => c.data));
  const channels = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colorType];
  if (!channels) throw new Error('Unsupported PNG colour type ' + colorType);

  const pixels = unfilter(inflateSync(idat), width, height, channels);
  const rgba = Buffer.alloc(width * height * 4);

  const plte = chunks.find((c) => c.type === 'PLTE');
  const trns = chunks.find((c) => c.type === 'tRNS');

  for (let i = 0, n = width * height; i < n; i++) {
    const s = i * channels, d = i * 4;
    if (colorType === 6) {
      rgba[d] = pixels[s]; rgba[d + 1] = pixels[s + 1]; rgba[d + 2] = pixels[s + 2]; rgba[d + 3] = pixels[s + 3];
    } else if (colorType === 2) {
      rgba[d] = pixels[s]; rgba[d + 1] = pixels[s + 1]; rgba[d + 2] = pixels[s + 2]; rgba[d + 3] = 255;
    } else if (colorType === 3) {
      if (!plte) throw new Error('Indexed PNG has no palette.');
      const idx = pixels[s];
      rgba[d] = plte.data[idx * 3]; rgba[d + 1] = plte.data[idx * 3 + 1]; rgba[d + 2] = plte.data[idx * 3 + 2];
      rgba[d + 3] = trns && idx < trns.data.length ? trns.data[idx] : 255;
    } else if (colorType === 0) {
      rgba[d] = rgba[d + 1] = rgba[d + 2] = pixels[s]; rgba[d + 3] = 255;
    } else {
      rgba[d] = rgba[d + 1] = rgba[d + 2] = pixels[s]; rgba[d + 3] = pixels[s + 1];
    }
  }
  return { width, height, rgba };
}

/* ---------------- encode ---------------- */
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

function encodePng(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0;                                  // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------------- recolor ---------------- */
function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

function recolor({ width, height, rgba }, target) {
  const [tr, tg, tb] = target;
  const at = (x, y) => (y * width + x) * 4;

  // The background is whatever colour sits in the corners.
  const corners = [[0, 0], [width - 1, 0], [0, height - 1], [width - 1, height - 1]];
  const tally = new Map();
  for (const [x, y] of corners) {
    const i = at(x, y);
    const key = `${rgba[i]},${rgba[i + 1]},${rgba[i + 2]},${rgba[i + 3]}`;
    tally.set(key, (tally.get(key) || 0) + 1);
  }
  const [bg] = [...tally.entries()].sort((a, b) => b[1] - a[1])[0];
  const [br, bgc, bb, ba] = bg.split(',').map(Number);

  const near = (i) => {
    if (rgba[i + 3] < 24) return true;                          // already transparent
    return Math.abs(rgba[i] - br) <= TOLERANCE &&
           Math.abs(rgba[i + 1] - bgc) <= TOLERANCE &&
           Math.abs(rgba[i + 2] - bb) <= TOLERANCE;
  };

  // Flood fill inwards from every edge pixel so the emblem itself is never touched.
  const seen = new Uint8Array(width * height);
  const stack = [];
  for (let x = 0; x < width; x++) { stack.push(x, 0, x, height - 1); }
  for (let y = 0; y < height; y++) { stack.push(0, y, width - 1, y); }

  let filled = 0;
  while (stack.length) {
    const y = stack.pop(), x = stack.pop();
    if (x < 0 || y < 0 || x >= width || y >= height) continue;
    const p = y * width + x;
    if (seen[p]) continue;
    const i = p * 4;
    if (!near(i)) continue;
    seen[p] = 1;
    rgba[i] = tr; rgba[i + 1] = tg; rgba[i + 2] = tb; rgba[i + 3] = 255;
    filled++;
    stack.push(x + 1, y, x - 1, y, x, y + 1, x, y - 1);
  }

  return { filled, background: [br, bgc, bb, ba] };
}

/* ---------------- run ---------------- */
const [input, output = 'assets/img/logo.png', hex = NAVY] = process.argv.slice(2);

if (!input) {
  console.error(`
  Put the logo on a dark blue background.

    node scripts/recolor-logo.mjs <input.png> [output.png] [#hex]

  Example:
    node scripts/recolor-logo.mjs willy-logo.png assets/img/logo.png
`);
  process.exit(1);
}

try {
  const image = decodePng(readFileSync(input));
  const { filled, background } = recolor(image, hexToRgb(hex));
  writeFileSync(output, encodePng(image.width, image.height, image.rgba));
  const pct = ((filled / (image.width * image.height)) * 100).toFixed(1);
  console.log(`✓ ${output} — ${image.width}×${image.height}`);
  console.log(`  background rgb(${background.slice(0, 3).join(', ')}) → ${hex}  (${pct}% of the image)`);
  if (filled === 0) {
    console.log('  Nothing changed: the corners are already that colour, or the background is not flat.');
  }
} catch (err) {
  console.error('✗ ' + err.message);
  process.exit(1);
}
