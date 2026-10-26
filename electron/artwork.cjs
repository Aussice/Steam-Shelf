const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { parseAppInfo } = require('./appinfo.cjs');
const cacheFolder = path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), '.cache'), 'Steam Shelf', 'artwork');
let metadata, metadataTime = 0, readingMetadata;
const inFlight = new Map(), failures = new Map();
let active = 0; const waiting = [];
async function slot(fn) {
  if (active >= 5) await new Promise(resolve => waiting.push(resolve));
  active++;
  try { return await fn(); } finally { active--; waiting.shift()?.(); }
}
function imageMime(data) {
  if (data.length < 100) return null;
  if (data[0] === 0xff && data[1] === 0xd8) return 'image/jpeg';
  if (data.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return 'image/png';
  if (data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return null;
}
function publicArtwork(common) {
  const capsule = common.library_assets_full?.library_capsule;
  const paths = [];
  for (const map of [capsule?.image2x, capsule?.image]) for (const language of ['schinese', 'english', 'tchinese']) {
    const value = map?.[language];
    if (typeof value === 'string' && /^[a-z\d_./-]+\.(jpg|jpeg|png|webp)$/i.test(value) && !value.split('/').includes('..')) paths.push(value);
  }
  return [...new Set(paths)];
}
async function artworkMetadata(roots) {
  if (metadata && Date.now() - metadataTime < 60000) return metadata;
  if (readingMetadata) return readingMetadata;
  readingMetadata = (async () => {
    const next = new Map();
    for (const root of roots) {
      try {
        parseAppInfo(await fs.readFile(path.join(root, 'appcache', 'appinfo.vdf')), { onCommon: (appid, common) => next.set(appid, { portraits: publicArtwork(common), headers: Object.values(common.header_image || {}).filter(value => typeof value === 'string' && /^[a-z\d_./-]+\.(jpg|jpeg|png|webp)$/i.test(value) && !value.split('/').includes('..')) }) });
        if (next.size) break;
      } catch {}
    }
    metadata = next; metadataTime = Date.now(); return next;
  })().finally(() => { readingMetadata = null; });
  return readingMetadata;
}
function artworkUrls(appid, paths) {
  const shared = `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}/`;
  const legacy = `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/`;
  return [...new Set([
    ...paths.map(file => shared + file),
    shared + 'library_600x900.jpg', legacy + 'library_600x900.jpg',
    shared + 'library_capsule.jpg', legacy + 'library_capsule.jpg',
  ])];
}
async function readImage(file) {
  try {
    const stat = await fs.stat(file); if (stat.size > 8 * 1024 * 1024) return null;
    const data = await fs.readFile(file), mime = imageMime(data);
    return mime ? `data:${mime};base64,${data.toString('base64')}` : null;
  } catch { return null; }
}
async function fetchImage(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(5000), redirect: 'error' });
    if (!response.ok || Number(response.headers.get('content-length')) > 8 * 1024 * 1024) { await response.body?.cancel(); return null; }
    const data = Buffer.from(await response.arrayBuffer());
    return data.length <= 8 * 1024 * 1024 && imageMime(data) ? data : null;
  } catch { return null; }
}
async function getArtwork(appid, roots, retry = false) {
  const key = String(appid);
  if (inFlight.has(key)) return inFlight.get(key);
  if (!retry && Date.now() - (failures.get(key) || 0) < 20000) return null;
  const request = (async () => {
    const assets = (await artworkMetadata(roots)).get(Number(appid));
    const paths = assets?.portraits || [];
    const localNames = [...new Set([...paths.map(file => path.basename(file)), 'library_600x900_2x.jpg', 'library_capsule_2x.jpg', 'library_600x900_schinese.jpg', 'library_600x900.jpg', 'library_capsule.jpg'])];
    const disk = path.join(cacheFolder, `${appid}.cover`);
    let cached = await readImage(disk);
    if (cached && !retry) return cached;
    for (const root of roots) for (const name of localNames) {
      const image = await readImage(path.join(root, 'appcache', 'librarycache', key, name)) || await readImage(path.join(root, 'appcache', 'librarycache', `${appid}_${name}`));
      if (image) { cached ||= image; if (!retry) return image; }
    }
    return slot(async () => {
      const urls = artworkUrls(appid, paths).slice(0, 8);
      for (let i = 0; i < urls.length; i += 2) {
        const results = await Promise.all(urls.slice(i, i + 2).map(fetchImage));
        const data = results.find(Boolean);
        if (data) {
          try { await fs.mkdir(cacheFolder, { recursive: true }); await fs.writeFile(disk, data); } catch {}
          failures.delete(key); return `data:${imageMime(data)};base64,${data.toString('base64')}`;
        }
      }
      if (cached) return cached;
      // A few games publish no portrait art; a real store header is the final fallback.
      const headerUrls = [...(assets?.headers || []).slice(0,2).map(file => `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}/${file}`), `https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/${appid}/header.jpg`, `https://cdn.akamai.steamstatic.com/steam/apps/${appid}/header.jpg`];
      const headers = await Promise.all(headerUrls.map(fetchImage));
      const header = headers.find(Boolean);
      if (header) { try { await fs.mkdir(cacheFolder, { recursive: true }); await fs.writeFile(disk, header); } catch {} return `data:${imageMime(header)};base64,${header.toString('base64')}`; }
      failures.set(key, Date.now()); return null;
    });
  })().finally(() => inFlight.delete(key));
  inFlight.set(key, request); return request;
}
module.exports = { getArtwork, publicArtwork, artworkUrls, imageMime };
