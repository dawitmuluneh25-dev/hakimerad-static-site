#!/usr/bin/env node
/**
 * Zero-dependency static file server for local verification.
 *
 *   npm run serve            # serves the repository at http://localhost:4173
 *   npm run serve -- dist    # serves the production build instead
 *
 * It sends the same security headers the production .htaccess sets, so local
 * behaviour matches the deployed behaviour closely enough to catch mistakes.
 */

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const args = process.argv.slice(2);
const target = args.find(a => !a.startsWith('-')) || '.';
const portArg = args.find(a => a.startsWith('--port='));
const PORT = portArg ? Number(portArg.split('=')[1]) : Number(process.env.PORT || 4173);

const SERVE_ROOT = path.resolve(ROOT, target);

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2',
  '.woff': 'font/woff',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.pdf': 'application/pdf',
};

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Permissions-Policy': 'geolocation=(), microphone=(), camera=(), payment=()',
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...SECURITY_HEADERS, ...headers });
  res.end(body);
}

async function resolveTarget(urlPath) {
  let rel = decodeURIComponent(urlPath.split('?')[0]);
  if (rel.endsWith('/')) rel += 'index.html';
  const full = path.join(SERVE_ROOT, rel);

  // Never serve outside the root.
  if (!full.startsWith(SERVE_ROOT)) return null;

  try {
    const s = await stat(full);
    if (s.isDirectory()) return path.join(full, 'index.html');
    return full;
  } catch {
    return null;
  }
}

const server = createServer(async (req, res) => {
  const file = await resolveTarget(req.url || '/');

  if (!file) {
    const notFound = path.join(SERVE_ROOT, '404.html');
    try {
      const body = await readFile(notFound);
      send(res, 404, body, { 'Content-Type': MIME['.html'] });
    } catch {
      send(res, 404, 'Not found', { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    return;
  }

  try {
    const body = await readFile(file);
    const type = MIME[path.extname(file).toLowerCase()] || 'application/octet-stream';
    send(res, 200, body, {
      'Content-Type': type,
      // Fonts are content-addressed by name and versioned by filename.
      'Cache-Control': /\.(woff2|png|jpg|jpeg|svg|ico|webp)$/.test(file)
        ? 'public, max-age=604800'
        : 'no-cache',
    });
  } catch {
    send(res, 500, 'Server error', { 'Content-Type': 'text/plain; charset=utf-8' });
  }
});

server.listen(PORT, () => {
  console.log(`Serving ${path.relative(ROOT, SERVE_ROOT) || '.'} at http://localhost:${PORT}/`);
});
