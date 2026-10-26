// Steam's public app metadata cache, versions 39–41. Only metadata is returned;
// record access tokens and hashes are skipped, never exposed to the renderer.
function parseAppInfo(buffer, options = {}) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 16) throw new Error('Steam 游戏资料缓存不完整');
  const magic = buffer.readUInt32LE(0), version = magic & 255;
  if (magic >>> 8 !== 0x075644 || version < 39 || version > 41) throw new Error('暂不支持此 Steam 游戏资料缓存版本');
  let strings = null, p = 8, limit = buffer.length, fields = 0;
  const requireBytes = n => { if (p + n > limit) throw new Error('Steam 游戏资料缓存已截断'); };
  function u32() { requireBytes(4); const value = buffer.readUInt32LE(p); p += 4; return value; }
  function zstring() { const end = buffer.indexOf(0, p); if (end < 0 || end >= limit) throw new Error('Steam 缓存字符串不完整'); const value = buffer.toString('utf8', p, end); p = end + 1; return value; }
  if (version >= 41) {
    const offset = Number(buffer.readBigUInt64LE(8));
    if (!Number.isSafeInteger(offset) || offset < 16 || offset + 4 > buffer.length) throw new Error('Steam 缓存字符串表无效');
    p = offset; const count = u32();
    if (count > 2000000) throw new Error('Steam 缓存字符串表过大');
    strings = Array.from({ length: count }, zstring); p = 16;
  }
  function key() { if (!strings) return zstring(); const index = u32(); if (index >= strings.length) throw new Error('Steam 缓存字符串索引无效'); return strings[index]; }
  function object(depth = 0) {
    if (depth > 64) throw new Error('Steam 缓存嵌套过深');
    const result = Object.create(null);
    while (p < limit) {
      requireBytes(1); const type = buffer[p++];
      if (type === 8 || type === 11) return result;
      if (++fields > 3000000) throw new Error('Steam 缓存条目过多');
      const name = key(); let value;
      switch (type) {
        case 0: value = object(depth + 1); break;
        case 1: value = zstring(); break;
        case 2: requireBytes(4); value = buffer.readInt32LE(p); p += 4; break;
        case 3: requireBytes(4); value = buffer.readFloatLE(p); p += 4; break;
        case 4: case 6: value = u32(); break;
        case 5: { requireBytes(2); const length = buffer.readUInt16LE(p); p += 2; requireBytes(length * 2); value = buffer.toString('utf16le', p, p + length * 2).replace(/\0$/, ''); p += length * 2; break; }
        case 7: case 10: requireBytes(8); p += 8; value = null; break;
        default: throw new Error(`Steam 缓存字段类型不受支持: ${type}`);
      }
      result[name] = value;
    }
    throw new Error('Steam 缓存对象不完整');
  }
  const result = new Map();
  while (p + 4 <= buffer.length) {
    limit = buffer.length;
    const appid = u32(); if (!appid) break;
    const size = u32(), start = p, end = start + size;
    if (size < 40 || end > buffer.length) throw new Error('Steam 游戏资料记录长度无效');
    p += version >= 40 ? 60 : 40; limit = end;
    if (p >= end) throw new Error('Steam 游戏资料记录为空');
    const data = object(); const app = data.appinfo || data;
    const common = app.common;
    if (common && options.onCommon) options.onCommon(appid, common);
    if (common?.name) {
      const localized = common.name_localized?.schinese || common.name_localized?.tchinese;
      result.set(appid, { appid, name: common.name, subtitle: localized && localized !== common.name ? localized : '', type: String(common.type || '').toLowerCase(), genre: genreFor(common), released: Number(common.steam_release_date) || 0 });
    }
    p = end;
  }
  return result;
}
function genreFor(common) {
  const primary = Number(common.primary_genre ?? Object.values(common.genres || {})[0]);
  return ({ 1: '动作冒险', 2: '策略战术', 3: '角色扮演', 4: '休闲模拟', 9: '竞速运动', 18: '竞速运动', 23: '独立游戏', 25: '解谜探索', 28: '休闲模拟', 29: '多人联机', 37: '休闲模拟' })[primary] || 'Steam 游戏';
}
module.exports = { parseAppInfo };
