const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { parseVdf, normalizeGames, scanInstalled, validAppId } = require('../electron/steam.cjs');

test('Valve KeyValues handles nesting, comments, Windows paths and escaped titles', () => {
  const doc = parseVdf('// comment\n"libraryfolders" { "0" { "path" "D:\\\\SteamLibrary" "apps" { "620" "1" } } "1" "E:\\\\Games" }');
  assert.equal(doc.libraryfolders['0'].path, 'D:\\SteamLibrary');
  assert.equal(doc.libraryfolders['0'].apps['620'], '1');
  assert.equal(doc.libraryfolders['1'], 'E:\\Games');
  assert.equal(parseVdf('"name" "The \\"Game\\""').name, 'The "Game"');
  assert.throws(() => parseVdf('"AppState" { "name" "broken"'));
  assert.throws(() => parseVdf('"name" "broken'));
});
test('untrusted imports are bounded, deduplicated and normalized', () => {
  assert.equal(normalizeGames([{ appid: 620 }, { appid: '0620' }]).length, 1);
  assert.deepEqual(normalizeGames({ response: { games: [{ appid: 620, name: 'Portal 2' }, { appid: '620' }, { appid: '123 & calc' }, { appid: -1 }, { appid: 570, playtime_forever: -10, installed: 'yes' }] } }).map(g => [g.appid, g.playtime_forever, g.installed]), [[620, 0, false], [570, 0, false]]);
  assert.throws(() => normalizeGames({}));
  assert.equal(validAppId('620;calc'), false);
  assert.equal(validAppId('4294967296'), false);
});
test('scans multiple libraries and excludes unfinished installations', async () => {
  const temp = await fs.mkdtemp(path.join(os.tmpdir(), 'steam-shelf-test-'));
  try {
    const extra = path.join(temp, 'OtherLibrary');
    await fs.mkdir(path.join(temp, 'steamapps'), { recursive: true });
    await fs.mkdir(path.join(extra, 'steamapps'), { recursive: true });
    await fs.writeFile(path.join(temp, 'steamapps/libraryfolders.vdf'), `"libraryfolders" { "0" { "path" "${temp.replaceAll('\\', '\\\\')}" } "1" { "path" "${extra.replaceAll('\\', '\\\\')}" } }`);
    await fs.writeFile(path.join(temp, 'steamapps/appmanifest_620.acf'), '"AppState" { "appid" "620" "name" "Portal 2" "StateFlags" "4" }');
    await fs.writeFile(path.join(extra, 'steamapps/appmanifest_570.acf'), '"AppState" { "appid" "570" "name" "Dota 2" "StateFlags" "4" }');
    await fs.writeFile(path.join(extra, 'steamapps/appmanifest_730.acf'), '"AppState" { "appid" "730" "name" "CS2" "StateFlags" "1026" }');
    await fs.writeFile(path.join(extra, 'steamapps/appmanifest_999.acf'), '"broken" {');
    const result = await scanInstalled(temp);
    assert.deepEqual(result.games.map(g => g.appid).sort((a,b) => a-b), [570, 620]);
    assert.equal(result.libraries.length, 2);
    assert.equal(result.warnings.length, 1);
  } finally { await fs.rm(temp, { recursive: true, force: true }); }
});
