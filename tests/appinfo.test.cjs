const { test } = require('node:test');
const assert = require('node:assert/strict');
const { parseAppInfo } = require('../electron/appinfo.cjs');
const u32 = value => { const b = Buffer.alloc(4); b.writeUInt32LE(value); return b; };
const z = value => Buffer.from(`${value}\0`, 'utf8');
function fixture(version) {
  const strings = ['appinfo', 'common', 'name', 'type', 'name_localized', 'schinese', 'primary_genre'];
  const key = name => version >= 41 ? u32(strings.indexOf(name)) : z(name);
  const field = (name, value) => Buffer.concat([Buffer.from([1]), key(name), z(value)]);
  const object = (name, fields) => Buffer.concat([Buffer.from([0]), key(name), ...fields, Buffer.from([8])]);
  const data = Buffer.concat([object('appinfo', [object('common', [field('name', 'Portal 2'), field('type', 'Game'), field('primary_genre', '25'), object('name_localized', [field('schinese', '传送门 2')])])]), Buffer.from([8])]);
  const record = Buffer.concat([u32(620), u32((version >= 40 ? 60 : 40) + data.length), Buffer.alloc(version >= 40 ? 60 : 40), data]);
  const header = Buffer.concat([u32((0x075644 << 8) | version), u32(1)]);
  if (version < 41) return Buffer.concat([header, record, u32(0)]);
  const offset = Buffer.alloc(8); offset.writeBigUInt64LE(BigInt(16 + record.length + 4));
  return Buffer.concat([header, offset, record, u32(0), u32(strings.length), ...strings.map(z)]);
}
for (const version of [39, 40, 41]) test(`appinfo v${version}: resolves titles, types and Chinese names`, () => {
  const parsed = parseAppInfo(fixture(version));
  assert.equal(parsed.size, 1);
  assert.deepEqual(parsed.get(620), { appid: 620, name: 'Portal 2', subtitle: '传送门 2', type: 'game', genre: '解谜探索', released: 0 });
});
test('appinfo rejects corrupt lengths and string table offsets', () => {
  assert.throws(() => parseAppInfo(Buffer.alloc(8)));
  const broken = fixture(41); broken.writeBigUInt64LE(99999999n, 8);
  assert.throws(() => parseAppInfo(broken));
  assert.throws(() => parseAppInfo(fixture(40).subarray(0, 40)));
  const unknown = fixture(39); unknown.writeUInt32LE(0x07564430, 0);
  assert.throws(() => parseAppInfo(unknown));
});
