const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const { execFile } = require('node:child_process');
const { parseAppInfo } = require('./appinfo.cjs');

// Valve KeyValues: quotes, escaped slashes/quotes, comments and nested objects.
function parseVdf(text) {
  const tokens = []; let i = 0;
  while (i < text.length) {
    if (/\s/.test(text[i])) { i++; continue; }
    if (text.slice(i, i + 2) === '//') { while (i < text.length && text[i] !== '\n') i++; continue; }
    if (text[i] === '{' || text[i] === '}') { tokens.push(text[i++]); continue; }
    if (text[i] === '"') {
      i++; let value = '';
      while (i < text.length && text[i] !== '"') {
        if (text[i] === '\\' && ['\\', '"'].includes(text[i + 1])) i++;
        value += text[i++];
      }
      if (text[i] !== '"') throw new Error('Steam 配置文件不完整');
      i++; tokens.push(value); continue;
    }
    const start = i; while (i < text.length && !/[\s{}]/.test(text[i])) i++;
    tokens.push(text.slice(start, i));
  }
  let p = 0;
  function object(nested = false) {
    const result = Object.create(null);
    while (p < tokens.length) {
      const key = tokens[p++];
      if (key === '}') { if (!nested) throw new Error('Steam 配置格式错误'); return result; }
      const value = tokens[p++];
      if (value === undefined || value === '}') throw new Error('Steam 配置缺少值');
      result[key] = value === '{' ? object(true) : value;
    }
    if (nested) throw new Error('Steam 配置缺少括号');
    return result;
  }
  return object();
}

const validAppId = value => /^\d{1,10}$/.test(String(value)) && Number(value) > 0 && Number(value) <= 4294967295;
function normalizeGames(data) {
  const rows = Array.isArray(data) ? data : data?.response?.games ?? data?.games;
  if (!Array.isArray(rows)) throw new Error('需要游戏数组或 Steam GetOwnedGames 的 JSON 数据');
  if (rows.length > 20000) throw new Error('一次最多导入 20,000 个游戏');
  const seen = new Set();
  return rows.filter(g => g && validAppId(g.appid) && !seen.has(Number(g.appid)) && seen.add(Number(g.appid))).map(g => ({
    appid: Number(g.appid), name: String(g.name || `Steam 游戏 ${g.appid}`).slice(0, 180),
    playtime_forever: Math.max(0, Number(g.playtime_forever) || 0),
    installed: g.installed === true, genre: String(g.genre || 'Steam 游戏').slice(0, 60),
    subtitle: String(g.subtitle || '').slice(0, 180),
    released: Math.max(0,Number(g.released)||0), lastPlayed: Math.max(0,Number(g.lastPlayed)||0),
  }));
}

async function steamRoots() {
  let registryPath;
  if (process.platform === 'win32') {
    registryPath = await new Promise(resolve => execFile('reg.exe', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'], { windowsHide: true }, (err, out) => resolve(err ? null : out.match(/SteamPath\s+REG_SZ\s+(.+)/i)?.[1]?.trim())));
  }
  const candidates = [registryPath, process.env.STEAM_PATH, 'C:\\Program Files (x86)\\Steam', 'C:\\Program Files\\Steam', path.join(os.homedir(), '.steam', 'steam'), path.join(os.homedir(), '.local', 'share', 'Steam'), path.join(os.homedir(), 'Library', 'Application Support', 'Steam')].filter(Boolean).map(p => path.resolve(p));
  return [...new Map(candidates.map(p => [process.platform === 'win32' ? p.toLowerCase() : p, p])).values()];
}

async function scanInstalled(root) {
  const roots = root ? [path.resolve(root)] : await steamRoots();
  const libraryMap = new Map(); const detected = [];
  const addLibrary = p => { const absolute = path.resolve(p); libraryMap.set(process.platform === 'win32' ? absolute.toLowerCase() : absolute, absolute); };
  for (const candidate of roots) {
    try {
      await fs.access(path.join(candidate, 'steamapps'));
      addLibrary(candidate); detected.push(candidate);
      try {
        const doc = parseVdf(await fs.readFile(path.join(candidate, 'steamapps', 'libraryfolders.vdf'), 'utf8'));
        for (const [key, value] of Object.entries(doc.libraryfolders || doc.LibraryFolders || {})) {
          if (/^\d+$/.test(key)) {
            const library = typeof value === 'string' ? value : value.path;
            if (library && path.isAbsolute(library)) addLibrary(library);
          }
        }
      } catch { /* A fresh installation may not have libraryfolders.vdf. */ }
    } catch { /* Check the remaining conventional locations. */ }
  }
  const libraries = [...libraryMap.values()];
  const games = []; const warnings = [];
  for (const library of libraries) {
    const folder = path.join(library, 'steamapps');
    let files;
    try { files = await fs.readdir(folder); } catch { warnings.push(`无法读取 ${folder}`); continue; }
    for (const file of files.filter(f => /^appmanifest_\d+\.acf$/.test(f))) {
      try {
        const state = parseVdf(await fs.readFile(path.join(folder, file), 'utf8')).AppState;
        if (state && validAppId(state.appid) && Number(state.appid) !== 228980 && (Number(state.StateFlags) & 4) === 4) {
          games.push({ appid: Number(state.appid), name: state.name, installed: true });
        }
      } catch { warnings.push(`已跳过无法读取的 ${file}`); }
    }
  }
  return { games: normalizeGames(games), roots: detected, libraries: [...libraries], warnings };
}

async function fetchOwnedGames({ steamid, key }) {
  if (!/^7656119\d{10}$/.test(String(steamid))) throw new Error('请输入 17 位 SteamID64');
  if (!/^[a-f\d]{32}$/i.test(String(key))) throw new Error('请输入有效的 32 位 Steam Web API Key');
  const url = new URL('https://api.steampowered.com/IPlayerService/GetOwnedGames/v1/');
  url.search = new URLSearchParams({ key, steamid, include_appinfo: 'true', include_played_free_games: 'true', format: 'json' });
  let response;
  try { response = await fetch(url, { signal: AbortSignal.timeout(20000) }); }
  catch { throw new Error('连接 Steam 超时，请检查网络后重试'); }
  if (!response.ok) throw new Error(`Steam 返回 ${response.status}，请检查 API Key 与网络`);
  const json = await response.json();
  if (!Array.isArray(json.response?.games)) throw new Error('未获取到游戏，请将 Steam「游戏详情」设为公开后重试');
  return normalizeGames(json);
}
const ci = (obj, key) => Object.entries(obj || {}).find(([name]) => name.toLowerCase() === key.toLowerCase())?.[1];
async function activeAccount(root) {
  if (process.platform === 'win32') {
    const active = await new Promise(resolve => execFile('reg.exe', ['query', 'HKCU\\Software\\Valve\\Steam\\ActiveProcess', '/v', 'ActiveUser'], { windowsHide: true }, (err, out) => resolve(err ? null : out.match(/ActiveUser\s+REG_DWORD\s+(0x[\da-f]+)/i)?.[1])));
    if (active && Number.parseInt(active, 16) > 0) return String(Number.parseInt(active, 16));
  }
  try {
    const users = ci(parseVdf(await fs.readFile(path.join(root, 'config', 'loginusers.vdf'), 'utf8')), 'users');
    const recent = Object.entries(users || {}).sort(([, a], [, b]) => Number(ci(b, 'MostRecent') || 0) - Number(ci(a, 'MostRecent') || 0) || Number(ci(b, 'timestamp') || 0) - Number(ci(a, 'timestamp') || 0))[0];
    return recent ? String(BigInt(recent[0]) - 76561197960265728n) : null;
  } catch { return null; }
}
function queryClientOwnership(root, candidates) {
  return new Promise((resolve, reject) => {
    let helper = path.join(__dirname, 'steam-client.cjs');
    if (helper.includes('app.asar')) helper = helper.replace('app.asar', 'app.asar.unpacked');
    const child = execFile(process.execPath, [helper], { windowsHide: true, timeout: 25000, maxBuffer: 1024 * 1024, env: { ...process.env, ELECTRON_RUN_AS_NODE: '1' } }, (err, out) => {
      const line = out.split(/\r?\n/).find(s => s.startsWith('SHELF_RESULT:'));
      let data; try { data = line ? JSON.parse(line.slice(13)) : null; } catch {}
      if (!data?.connected || !Array.isArray(data.owned)) reject(new Error(data?.error || (err?.killed ? 'Steam 读取超时，请稍后重试' : '请先打开并登录 Steam，或通过 API 导入完整游戏库')));
      else resolve(data.owned);
    });
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify({ root, candidates }));
  });
}
async function scanLibrary(root) {
  const installed = await scanInstalled(root), installedMap = new Map(installed.games.map(g => [g.appid, g]));
  const roots = await steamRoots();
  let metadata = new Map(), master;
  for (const candidate of roots) {
    try { const parsed = parseAppInfo(await fs.readFile(path.join(candidate, 'appcache', 'appinfo.vdf'))); if (parsed.size) { master = candidate; metadata = parsed; break; } } catch {}
  }
  if (!master) return { ...installed, source: '本机 Steam · 已安装', complete: false, note: '未找到完整库资料缓存，请打开 Steam 游戏库后重试。' };
  let owned;
  try { owned = new Set(await queryClientOwnership(master, [...new Set([...metadata.values()].filter(g => g.type === 'game').map(g => g.appid).concat(installed.games.filter(g => !metadata.has(g.appid)).map(g => g.appid)))])); }
  catch (e) {
    return { ...installed, games: normalizeGames(installed.games.filter(g => !metadata.has(g.appid) || metadata.get(g.appid).type === 'game').map(g => ({ ...g, ...metadata.get(g.appid), installed: true }))), source: '本机 Steam · 已安装', complete: false, note: e.message };
  }
  const account = await activeAccount(master); let playtimes = Object.create(null);
  if (account) {
    try {
      const doc = parseVdf(await fs.readFile(path.join(master, 'userdata', account, 'config', 'localconfig.vdf'), 'utf8'));
      const store = ci(doc, 'UserLocalConfigStore');
      playtimes = ci(ci(ci(ci(store, 'Software'), 'Valve'), 'Steam'), 'apps') || playtimes;
    } catch {}
  }
  const games = [...owned].map(appid => ({ ...metadata.get(appid), ...(!metadata.has(appid) ? installedMap.get(appid) : {}), appid, installed: installedMap.has(appid), playtime_forever: Number(ci(playtimes[appid], 'Playtime')) || 0, lastPlayed: Number(ci(playtimes[appid], 'LastPlayed')) || 0 }));
  games.sort((a, b) => Number(b.installed) - Number(a.installed) || b.playtime_forever - a.playtime_forever || a.name.localeCompare(b.name, 'zh-CN'));
  return { ...installed, games: normalizeGames(games), source: '本机 Steam · 含未安装', complete: true, installedCount: games.filter(g => g.installed).length, uninstalledCount: games.filter(g => !g.installed).length, note: '已通过 Steam 当前登录账号核对游戏归属；新购游戏请先在 Steam 中刷新游戏库。' };
}
let coverRoots;
async function localCover(appid, retry = false) {
  if (!validAppId(appid)) throw new Error('无效的游戏 ID');
  coverRoots ||= steamRoots();
  return require('./artwork.cjs').getArtwork(Number(appid), await coverRoots, retry === true);
}

module.exports = { parseVdf, normalizeGames, scanInstalled, scanLibrary, fetchOwnedGames, validAppId, localCover, activeAccount };
