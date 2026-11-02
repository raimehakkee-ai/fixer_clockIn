import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.resolve(
  process.env.DIST_DIR ?? path.join(scriptDirectory, '..', '..', 'admin', 'dist'),
);
const PORT = Number(process.env.PORT ?? 8080);
const API_TARGET = process.env.API_TARGET ?? 'http://127.0.0.1:4000';

const CSP = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "connect-src 'self'",
  "font-src 'self' data:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'geolocation=(), camera=(), microphone=()',
  'Content-Security-Policy': CSP,
};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
};

const HOP_BY_HOP = new Set([
  'host',
  'connection',
  'content-length',
  'transfer-encoding',
  'keep-alive',
  'upgrade',
]);

async function proxy(req, res) {
  const headers = {};

  for (const [key, value] of Object.entries(req.headers)) {
    if (HOP_BY_HOP.has(key.toLowerCase())) continue;
    if (typeof value === 'string') headers[key] = value;
  }

  headers['x-forwarded-for'] = req.socket.remoteAddress ?? '';
  headers['x-forwarded-proto'] = 'http';

  const hasBody = !['GET', 'HEAD'].includes(req.method ?? 'GET');

  const upstream = await fetch(`${API_TARGET}${req.url}`, {
    method: req.method,
    headers,
    body: hasBody ? req : undefined,
    duplex: 'half',
  });

  const responseHeaders = {};
  upstream.headers.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (
      lower === 'content-encoding' ||
      lower === 'content-length' ||
      lower === 'transfer-encoding'
    ) {
      return;
    }
    responseHeaders[key] = value;
  });

  const buffer = Buffer.from(await upstream.arrayBuffer());
  res.writeHead(upstream.status, responseHeaders);
  res.end(buffer);
}

async function resolveFile(pathname) {
  let filePath = path.normalize(path.join(DIST_DIR, pathname));

  if (filePath !== DIST_DIR && !filePath.startsWith(`${DIST_DIR}${path.sep}`)) {
    return null;
  }

  let info = await stat(filePath).catch(() => null);

  if (info?.isDirectory()) {
    const indexFile = path.join(filePath, 'index.html');
    const indexInfo = await stat(indexFile).catch(() => null);
    if (indexInfo?.isFile()) {
      return { filePath: indexFile, info: indexInfo };
    }
  }

  if (!info) {
    const indexFile = path.join(DIST_DIR, 'index.html');
    const indexInfo = await stat(indexFile).catch(() => null);
    if (indexInfo?.isFile()) {
      return { filePath: indexFile, info: indexInfo };
    }
  }

  return info?.isFile() ? { filePath, info } : null;
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url ?? '/', 'http://localhost');

    if (url.pathname.startsWith('/api/')) {
      await proxy(req, res);
      return;
    }

    const resolved = await resolveFile(decodeURIComponent(url.pathname));

    if (!resolved) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const extension = path.extname(resolved.filePath).toLowerCase();
    const isAsset = url.pathname.startsWith('/assets/');

    res.writeHead(200, {
      ...SECURITY_HEADERS,
      'Content-Type': MIME_TYPES[extension] ?? 'application/octet-stream',
      'Content-Length': resolved.info.size,
      'Cache-Control': isAsset
        ? 'public, max-age=31536000, immutable'
        : 'no-cache',
    });

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    createReadStream(resolved.filePath).pipe(res);
  } catch (error) {
    console.error('[serve-static]', error);
    if (!res.headersSent) {
      res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    }
    res.end('Internal server error');
  }
});

server.listen(PORT, () => {
  console.log(
    `Web Admin (produksi lokal) di http://localhost:${PORT} — API ${API_TARGET}`,
  );
  console.log(`Direktori statis: ${DIST_DIR}`);
});
