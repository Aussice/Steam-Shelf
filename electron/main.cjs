const { app, BrowserWindow, ipcMain, dialog, shell, Menu } = require('electron');
const path = require('node:path');
const { fileURLToPath } = require('node:url');
const { scanInstalled, scanLibrary, fetchOwnedGames, validAppId, localCover } = require('./steam.cjs');
let window;
function trusted(event) {
  if (!window || event.sender !== window.webContents || event.senderFrame !== window.webContents.mainFrame) throw new Error('不允许的请求来源');
  const url = event.senderFrame.url;
  if (!url.startsWith('file:') || path.resolve(fileURLToPath(url)) !== path.resolve(__dirname, '../dist/index.html')) throw new Error('不允许的页面');
}
function handle(name, fn) { ipcMain.handle(name, async (event, ...args) => { trusted(event); return fn(...args); }); }
handle('steam:scan', () => scanLibrary());
handle('steam:cover', (appid, retry) => localCover(appid, retry === true));
handle('steam:details', (appid, locale) => require('./details.cjs').gameDetails(appid, locale));
handle('steam:model', name => require('./model-assets.cjs').readModelAsset(name));
handle('steam:choose-folder', async locale => {
  const result = await dialog.showOpenDialog(window, { title: locale === 'en' ? 'Choose Steam or SteamLibrary folder' : '选择 Steam 安装目录或 SteamLibrary 文件夹', properties: ['openDirectory'] });
  return result.canceled ? null : scanLibrary(result.filePaths[0]);
});
handle('steam:owned', async input => {
  if (!input || typeof input.key !== 'string' || typeof input.steamid !== 'string') throw new Error('无效的 Steam 参数');
  const [games, local] = await Promise.all([fetchOwnedGames(input), scanInstalled()]);
  const installed = new Set(local.games.map(g => g.appid));
  return { games: games.map(g => ({ ...g, installed: installed.has(g.appid) })), roots: local.roots };
});
handle('steam:launch', async appid => {
  if (!validAppId(appid)) throw new Error('无效的游戏 ID');
  await shell.openExternal(`steam://rungameid/${Number(appid)}`);
  return true;
});
handle('steam:store', async appid => {
  if (!validAppId(appid)) throw new Error('无效的游戏 ID');
  await shell.openExternal(`https://store.steampowered.com/app/${Number(appid)}/`);
});
function createWindow() {
  Menu.setApplicationMenu(null);
  window = new BrowserWindow({ width: 1530, height: 1010, minWidth: 960, minHeight: 680, backgroundColor: '#171a21', title: 'Steam Shelf', icon:path.join(__dirname,'../dist/icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true } });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.webContents.on('will-attach-webview', event => event.preventDefault());
  window.loadFile(path.join(__dirname, '../dist/index.html'));
}
app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (!BrowserWindow.getAllWindows().length) createWindow(); });
