import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Euler, Vector3 } from 'three';
import { arrangeGames, CASE, RACK } from '../src/shelfLayout.js';

const games = count => Array.from({ length: count }, (_, index) => ({ appid: 2000 + index, name: `Custom ${index}` }));

test('placement overrides preserve every unique game and requested orientation', () => {
  const input = games(18);
  input.push(input[3], { ...input[7] });
  const modes = ['front', 'spine', 'stack'];
  const placements = Object.fromEntries(input.slice(0, 18).map((game, index) => [game.appid, modes[index % modes.length]]));
  const layout = arrangeGames(input, 3, placements);

  assert.equal(layout.entries.length, 18);
  assert.equal(new Set(layout.entries.map(entry => entry.game.appid)).size, 18);
  for (const entry of layout.entries) {
    assert.equal(entry.type, placements[entry.game.appid]);
    assert.equal(typeof entry.leaning, 'boolean');
    if (entry.type !== 'front') assert.equal(entry.leaning, false);
  }
});

test('custom spines face the viewer and real stack cases lie in separated layers', () => {
  const input = games(9);
  const placements = Object.fromEntries(input.map((game, index) => [game.appid, index < 4 ? 'spine' : 'stack']));
  const entries = arrangeGames(input, 3, placements).entries;

  for (const entry of entries.filter(({ type }) => type === 'spine')) {
    const normal = new Vector3(-1, 0, 0).applyEuler(new Euler(entry.rx, entry.ry, entry.rz));
    assert.ok(normal.z > .98);
  }
  for (const entry of entries.filter(({ type }) => type === 'stack')) {
    assert.equal(entry.rx, -Math.PI / 2);
    assert.ok(entry.stackSize >= 1 && entry.stackSize <= 3);
  }
  const groups = Map.groupBy(entries.filter(({ type }) => type === 'stack'), entry => `${entry.row}:${Math.round(entry.x * 10)}`);
  for (const group of groups.values()) {
    const ys = group.map(entry => entry.y).sort((a, b) => a - b);
    for (let index = 1; index < ys.length; index++) assert.ok(ys[index] - ys[index - 1] >= CASE.depth);
  }
});

test('wide customized collections expand the rack instead of clipping cases', () => {
  const input = games(90);
  const placements = Object.fromEntries(input.map(game => [game.appid, 'front']));
  const layout = arrangeGames(input, 3, placements);
  assert.equal(layout.entries.length, 90);

  const half = layout.width / 2;
  for (const entry of layout.entries) {
    assert.ok(entry.x - CASE.width / 2 > -half);
    assert.ok(entry.x + CASE.width / 2 < half);
  }
  const leaning = layout.entries.filter(entry => entry.leaning);
  assert.ok(leaning.length / layout.entries.length >= .3 && leaning.length / layout.entries.length <= .5);
  assert.ok(layout.entries.some(entry => !entry.leaning));
});

test('front, spine, and stack overrides all fit the same shallow depth envelope', () => {
  const input = games(36);
  const modes = ['front', 'spine', 'stack'];
  const placements = Object.fromEntries(input.map((game, index) => [game.appid, modes[index % modes.length]]));
  const layout = arrangeGames(input, 3, placements);
  for (const entry of layout.entries) {
    const euler = new Euler(entry.rx, entry.ry, entry.rz);
    const points = [];
    for (const x of [-CASE.width / 2, CASE.width / 2]) for (const y of [-CASE.height / 2, CASE.height / 2]) for (const z of [-CASE.depth / 2, CASE.depth / 2]) {
      points.push(new Vector3(x, y, z).applyEuler(euler).add(new Vector3(entry.x, entry.y, entry.z)));
    }
    assert.ok(Math.min(...points.map(point => point.z)) >= RACK.innerBackZ - 1e-9);
    assert.ok(Math.max(...points.map(point => point.z)) <= RACK.frontZ + 1e-9);
    const layerOffset = entry.type === 'stack' ? entry.stackIndex * (CASE.depth + .035) : 0;
    assert.ok(Math.abs(Math.min(...points.map(point => point.y)) - (layout.shelfYs[entry.row] + RACK.shelfTopOffset + layerOffset)) < 1e-9);
  }
});
