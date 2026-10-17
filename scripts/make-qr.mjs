/**
 * Generates the WhatsApp contact QR at images/qr-whatsapp.svg.
 *
 * Run with `npm run qr`. The asset is committed and shipped, so the build and
 * the production site never depend on this script or on either package.
 *
 * Two rules shape what is encoded:
 *
 *  1. The payload is the bare chat link, not a link with a prefilled message.
 *     A ?text= parameter takes the code from 25x25 modules to roughly 45x45,
 *     and a denser symbol is meaningfully harder to scan from a printed page or
 *     a phone held at arm's length. Reliability beats a stock opening line.
 *
 *  2. The SVG is only written if an independent decoder - jsQR, which shares no
 *     code with the encoder - reads the payload back out of the rasterised
 *     symbol and it matches exactly. A QR that decodes to the wrong number is
 *     worse than no QR: it sends enquiries to whoever owns that number.
 */
import { writeFileSync } from 'node:fs';
import path from 'node:path';
import QRCode from 'qrcode';
import jsQR from 'jsqr';

const TARGET = 'https://wa.me/251906373154';
const DARK = '#0b1f33';
const LIGHT = '#ffffff';
const QUIET = 4; // modules, per the QR specification
const SCALE = 8; // px per module in the verification raster

const qr = QRCode.create(TARGET, { errorCorrectionLevel: 'Q' });
const size = qr.modules.size;
const data = qr.modules.data;

const extent = size + QUIET * 2;

/* ---- encode ---- */
function darkAt(row, col) {
  return data[row * size + col] === 1;
}

let d = '';
for (let row = 0; row < size; row += 1) {
  for (let col = 0; col < size; col += 1) {
    if (!darkAt(row, col)) continue;
    d += `M${col + QUIET} ${row + QUIET}h1v1h-1z`;
  }
}

const svg = [
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${extent} ${extent}"`,
  ` width="${extent * 8}" height="${extent * 8}" shape-rendering="crispEdges">`,
  `<rect width="${extent}" height="${extent}" fill="${LIGHT}"/>`,
  `<path fill="${DARK}" d="${d}"/>`,
  '</svg>',
  '',
].join('');

/* ---- verify: rasterise, then decode with jsQR ---- */
const px = extent * SCALE;
const rgba = new Uint8ClampedArray(px * px * 4).fill(255);

for (let row = 0; row < size; row += 1) {
  for (let col = 0; col < size; col += 1) {
    if (!darkAt(row, col)) continue;
    const x0 = (col + QUIET) * SCALE;
    const y0 = (row + QUIET) * SCALE;
    for (let y = y0; y < y0 + SCALE; y += 1) {
      for (let x = x0; x < x0 + SCALE; x += 1) {
        const i = (y * px + x) * 4;
        rgba[i] = 0x0b;
        rgba[i + 1] = 0x1f;
        rgba[i + 2] = 0x33;
      }
    }
  }
}

const decoded = jsQR(rgba, px, px);
if (!decoded || decoded.data !== TARGET) {
  console.error(`VERIFY FAILED: expected ${TARGET}, decoded ${decoded ? decoded.data : 'nothing'}`);
  process.exit(1);
}

const out = path.join('images', 'qr-whatsapp.svg');
writeFileSync(out, svg, 'utf8');

console.log(`payload   ${TARGET}`);
console.log(
  `symbol    ${size}x${size} modules (version ${(size - 17) / 4}), ECC level Q, ${extent}x${extent} with quiet zone`
);
console.log(`verified  jsQR decoded the raster back to the exact payload`);
console.log(`written   ${out} (${Buffer.byteLength(svg)} bytes)`);
