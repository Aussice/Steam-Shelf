// Read-only connection to the running Steam client using Valve's versioned
// ISteamClient / ISteamApps interfaces. Kept in a child process so a changed
// native interface can never bring down the shelf application.
const fs = require('node:fs');
const path = require('node:path');
function ownedApps(root, candidates) {
  if (process.platform !== 'win32' || process.arch !== 'x64') throw new Error('当前平台不支持 Steam 本机接口');
  const koffi = require('koffi');
  const dll = path.join(root, 'steamclient64.dll');
  if (!fs.existsSync(dll)) throw new Error('Steam 客户端组件未找到');
  process.env.PATH = `${root}${path.delimiter}${process.env.PATH || ''}`;
  const library = koffi.load(dll);
  const create = library.func('void *CreateInterface(const char *version, void *result)');
  const client = create('SteamClient020', null);
  if (!client) throw new Error('Steam 客户端接口暂不可用');
  const prototypes = new Map();
  function method(instance, index, signature, ...args) {
    const table = koffi.decode(instance, 'void *');
    const address = koffi.decode(table, index * 8, 'void *');
    if (!address) throw new Error('Steam 接口方法不可用');
    if (!prototypes.has(signature)) prototypes.set(signature, koffi.proto(signature));
    return koffi.call(address, prototypes.get(signature), instance, ...args);
  }
  const pipe = method(client, 0, 'int CreatePipe(void *self)');
  if (!pipe) throw new Error('请先打开 Steam 客户端');
  let user;
  try {
    user = method(client, 2, 'int ConnectUser(void *self, int pipe)', pipe);
    if (!user) throw new Error('请先在 Steam 中登录账号');
    const apps = method(client, 15, 'void *GetApps(void *self, int user, int pipe, const char *version)', user, pipe, 'STEAMAPPS_INTERFACE_VERSION008');
    if (!apps) throw new Error('Steam 游戏库接口暂不可用');
    const owned = [];
    for (const appid of candidates) {
      if (method(apps, 6, 'bool SubscribedApp(void *self, uint32_t appid)', appid)) owned.push(appid);
    }
    return { owned, connected: true };
  } finally {
    if (user) method(client, 4, 'void ReleaseUser(void *self, int pipe, int user)', pipe, user);
    method(client, 1, 'bool ReleasePipe(void *self, int pipe)', pipe);
  }
}
if (require.main === module) {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', s => { input += s; if (input.length > 300000) process.exit(1); });
  process.stdin.on('end', () => {
    try {
      const request = JSON.parse(input);
      if (!Array.isArray(request.candidates) || request.candidates.length > 20000 || request.candidates.some(id => !Number.isInteger(id) || id < 1 || id > 4294967295)) throw new Error('无效的游戏清单');
      process.stdout.write(`SHELF_RESULT:${JSON.stringify(ownedApps(request.root, request.candidates))}\n`, () => process.exit(0));
    } catch (e) { process.stdout.write(`SHELF_RESULT:${JSON.stringify({ error: e.message })}\n`, () => process.exit(1)); }
  });
}
module.exports = { ownedApps };
