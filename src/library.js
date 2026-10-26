import { getCustomCover } from './personalCovers.js';
export const coverUrl = id => `https://cdn.akamai.steamstatic.com/steam/apps/${id}/library_600x900.jpg`;
export const demoGames = [
  [1245620, 'ELDEN RING', '艾尔登法环', '角色扮演', '#b5a66c'],
  [1091500, 'Cyberpunk 2077', '赛博朋克 2077', '角色扮演', '#d5ce34'],
  [1174180, 'Red Dead Redemption 2', '荒野大镖客：救赎 2', '开放世界', '#c4463d'],
  [1086940, "Baldur’s Gate 3", '博德之门 3', '角色扮演', '#bc9a6d'],
  [814380, 'Sekiro™: Shadows Die Twice', '只狼：影逝二度', '动作冒险', '#9f7c6e'],
  [1593500, 'God of War', '战神', '动作冒险', '#84a9bb'],
  [1145360, 'Hades', '哈迪斯', '独立游戏', '#b74a37'],
  [367520, 'Hollow Knight', '空洞骑士', '独立游戏', '#87a3b8'],
  [413150, 'Stardew Valley', '星露谷物语', '休闲模拟', '#89ac65'],
  [588650, 'Dead Cells', '死亡细胞', '独立游戏', '#b76e9a'],
  [504230, 'Celeste', '蔚蓝', '独立游戏', '#b38ea7'],
  [1868140, 'DAVE THE DIVER', '潜水员戴夫', '休闲模拟', '#41a6b5'],
  [620, 'Portal 2', '传送门 2', '解谜探索', '#a5c9d6'],
  [1426210, 'It Takes Two', '双人成行', '动作冒险', '#caa263'],
  [105600, 'Terraria', '泰拉瑞亚', '休闲模拟', '#88a270'],
  [753640, 'Outer Wilds', '星际拓荒', '解谜探索', '#ca9260'],
  [632470, 'Disco Elysium — The Final Cut', '极乐迪斯科', '角色扮演', '#b7836d'],
  [1151640, 'Horizon Zero Dawn™ Complete Edition', '地平线：零之曙光', '开放世界', '#8fafa6'],
  [524220, 'NieR:Automata™', '尼尔：机械纪元', '动作冒险', '#aaa899'],
  [292030, 'The Witcher 3: Wild Hunt', '巫师 3：狂猎', '开放世界', '#b1b5ae'],
  [782330, 'DOOM Eternal', '毁灭战士：永恒', '动作冒险', '#bd7353'],
  [381210, 'Dead by Daylight', '黎明杀机', '多人联机', '#9b9f9c'],
  [391540, 'Undertale', '传说之下', '独立游戏', '#bdbfca'],
  [1222670, 'The Sims™ 4', '模拟人生 4', '休闲模拟', '#71a5c4'],
].map(([appid, name, subtitle, genre, color]) => ({ appid, name, subtitle, genre, color, installed: false, demo: true }));

export function normalizeImport(input) {
  const rows = Array.isArray(input) ? input : input?.response?.games ?? input?.games;
  if (!Array.isArray(rows)) throw new Error('文件需包含游戏数组，或 Steam GetOwnedGames 导出的 JSON。');
  if (rows.length > 20000) throw new Error('一次最多导入 20,000 个游戏。');
  const seen = new Set();
  const result = rows.filter(g => g && /^\d{1,10}$/.test(String(g.appid)) && Number(g.appid) > 0 && Number(g.appid) <= 4294967295 && !seen.has(Number(g.appid)) && seen.add(Number(g.appid))).map(g => ({
    appid: Number(g.appid), name: String(g.name || `Steam 游戏 ${g.appid}`).slice(0, 180),
    playtime_forever: Math.max(0, Number(g.playtime_forever) || 0), installed: g.installed === true,
    genre: String(g.genre || 'Steam 游戏').slice(0, 60),
    subtitle: String(g.subtitle || '').slice(0, 180),
    released: Math.max(0,Number(g.released)||0), lastPlayed: Math.max(0,Number(g.lastPlayed)||0),
  }));
  if (!result.length) throw new Error('文件中没有有效的 Steam AppID。');
  return result;
}

export function readSaved(key, fallback) {
  try { const v = localStorage.getItem(`steam-shelf:${key}`); return v ? JSON.parse(v) : fallback; } catch { return fallback; }
}
export function save(key, value) {
  try { localStorage.setItem(`steam-shelf:${key}`, JSON.stringify(value)); return true; } catch { return false; }
}
export function gameCover(game) { return game.demo ? `./covers/${game.appid}.jpg` : coverUrl(game.appid); }
const coverCache = new Map(), imageCache = new Map(), failedImages = new Set(), forceNext = new Set();
export const localPreview = typeof window !== 'undefined' && !window.steamShelf && ['127.0.0.1', 'localhost'].includes(location.hostname);
export const libraryClient = (typeof window !== 'undefined' && window.steamShelf) || (localPreview ? {
  async scan() { const response = await fetch('/__shelf/library'); if (!response.ok) throw new Error('本地 Steam 预览连接不可用'); return response.json(); },
} : null);
export function clearCoverCache(appid) {
  if (appid) { coverCache.delete(appid); imageCache.delete(appid); forceNext.add(appid); } else { coverCache.clear(); imageCache.clear(); for (const id of failedImages) forceNext.add(id); }
}
export async function resolveCover(game, retry = false) {
  try { const custom=await getCustomCover(game.appid);if(custom)return custom; } catch {}
  if (game.demo) return gameCover(game);
  if (!libraryClient) return coverUrl(game.appid);
  if (!retry && coverCache.has(game.appid)) return coverCache.get(game.appid);
  const request = window.steamShelf ? window.steamShelf.cover(game.appid, retry) : fetch('/__shelf/cover/' + game.appid + (retry ? '?retry=1' : '')).then(response => response.ok ? response.json() : {}).then(result => result.cover);
  const promise = request.then(data => { if (!data) coverCache.delete(game.appid); return data || null; }).catch(() => { coverCache.delete(game.appid); return null; });
  if (coverCache.size > 144) coverCache.delete(coverCache.keys().next().value);
  coverCache.set(game.appid, promise); return promise;
}
function decodeImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image(); image.crossOrigin = 'anonymous';
    const timer = setTimeout(() => { image.onload = image.onerror = null; image.src = ''; reject(new Error('封面连接超时')); }, 15000);
    image.onload = () => { clearTimeout(timer); image.onload = image.onerror = null; if (image.naturalWidth >= 32 && image.naturalHeight >= 32) resolve(image); else reject(new Error('封面尺寸无效')); };
    image.onerror = () => { clearTimeout(timer); image.onload = image.onerror = null; reject(new Error('封面暂不可用')); };
    image.src = src;
  });
}
export async function loadCoverImage(game, {retry = false} = {}) {
  retry = forceNext.delete(game.appid) || retry;
  if (!retry && imageCache.has(game.appid)) return imageCache.get(game.appid);
  if (retry) { coverCache.delete(game.appid); imageCache.delete(game.appid); }
  const promise = (async () => {
    const primary = await resolveCover(game, retry);
    const sources = [...new Set([primary, ...(!libraryClient || game.demo ? [coverUrl(game.appid), 'https://shared.akamai.steamstatic.com/store_item_assets/steam/apps/' + game.appid + '/library_600x900.jpg'] : [])].filter(Boolean))];
    for (const source of sources) { try { const image = await decodeImage(source); failedImages.delete(game.appid); return image; } catch {} }
    throw new Error('封面暂不可用，请重试');
  })().catch(error => { failedImages.add(game.appid); imageCache.delete(game.appid); coverCache.delete(game.appid); throw error; });
  if (imageCache.size > 144) imageCache.delete(imageCache.keys().next().value);
  imageCache.set(game.appid, promise); return promise;
}

export async function loadGameDetails(appid, locale = 'zh') {
  if (window.steamShelf?.details) return window.steamShelf.details(appid, locale);
  if (localPreview) { const response=await fetch('/__shelf/details/'+appid+'?lang='+encodeURIComponent(locale));const data=await response.json();if(!response.ok)throw new Error(data.error||'暂时无法获取商店简介');return data; }
  throw new Error('商店简介需要本机应用连接。');
}
