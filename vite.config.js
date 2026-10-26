import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { scanLibrary, localCover } = require('./electron/steam.cjs');
// The desktop app uses IPC. This read-only bridge makes its local preview show
// the same library and cached artwork; it is never included in the built app.
function localSteamPreview() {
  let cached, cachedAt = 0;
  const middleware = async (req, res, next) => {
    if (!req.url?.startsWith('/__shelf/')) return next();
    const host = req.headers.host || '';
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host) || req.method !== 'GET' || (req.headers.origin && req.headers.origin !== `http://${host}`) || req.headers['sec-fetch-site'] === 'cross-site') { res.writeHead(403); res.end(); return; }
    res.setHeader('Cache-Control', 'no-store'); res.setHeader('Content-Type', 'application/json; charset=utf-8');
    try {
      if (req.url === '/__shelf/library') {
        if (!cached || Date.now() - cachedAt > 5000) { cached = scanLibrary(); cachedAt = Date.now(); }
        res.end(JSON.stringify(await cached));
      } else {
        const detail = req.url.match(/^\/__shelf\/details\/(\d{1,10})(?:\?lang=(zh|en))?$/);
        if(detail) { res.end(JSON.stringify(await require('./electron/details.cjs').gameDetails(Number(detail[1]),detail[2]))); return; }
        const match = req.url.match(/^\/__shelf\/cover\/(\d{1,10})(\?retry=1)?$/);
        if (!match) { res.writeHead(404); res.end('{}'); return; }
        res.end(JSON.stringify({ cover: await localCover(Number(match[1]), !!match[2]) }));
      }
    } catch (e) { res.writeHead(503); res.end(JSON.stringify({ error: e.message })); }
  };
  return { name: 'local-steam-preview', configureServer(server) { server.middlewares.use(middleware); }, configurePreviewServer(server) { server.middlewares.use(middleware); } };
}
export default defineConfig({ plugins: [react(), localSteamPreview()], base: './', build: { chunkSizeWarningLimit: 1000 } });
