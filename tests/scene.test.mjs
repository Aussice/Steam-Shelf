import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Euler, Vector3 } from 'three';
import { arrangeGames, CASE, RACK } from '../src/shelfLayout.js';
const games = count => Array.from({length:count}, (_, i) => ({ appid: 600 + i, name: `Game ${i}` }));
const corners = (entry, topOnly = false, coverOnly = false) => {
  const euler = new Euler(entry.rx, entry.ry, entry.rz);
  const result = [];
  const ys = topOnly ? [CASE.height / 2] : [-CASE.height / 2, CASE.height / 2];
  const zs = coverOnly ? [CASE.depth / 2] : [-CASE.depth / 2, CASE.depth / 2];
  for (const x of [-CASE.width / 2, CASE.width / 2]) for (const y of ys) for (const z of zs) {
    result.push(new Vector3(x, y, z).applyEuler(euler).add(new Vector3(entry.x, entry.y, entry.z)));
  }
  return result;
};
for (const size of [1, 24, 72]) test(`${size} games: cases represent distinct real library entries`, () => {
  const input = games(size), layout = arrangeGames(input);
  assert.equal(layout.entries.length, size);
  assert.equal(new Set(layout.entries.map(e => e.game.appid)).size, size);
  assert.ok(layout.entries.every(e => input.includes(e.game)));
  if (size >= 24) {
    assert.ok(layout.entries.some(e => e.type === 'front'));
    assert.ok(layout.entries.some(e => e.type === 'spine'));
    assert.ok(layout.entries.every(e => e.type === 'front'||e.type==='spine'));
  }
});
test('side-standing games present their printed spine toward the viewer', () => {
  const entries = arrangeGames(games(72)).entries;
  for (const entry of entries.filter(e => e.type === 'spine')) {
    // The printed face is on the left wall of the case, with local normal -X.
    const normal = new Vector3(-1, 0, 0).applyEuler(new Euler(entry.rx, entry.ry, entry.rz));
    assert.ok(normal.z > .98, `Game ${entry.game.appid} has an invisible spine`);
  }
});
test('front-facing covers own separate non-overlapping positions with no hidden rear cases', () => {
  for(const size of [5,24,72,90]){
    const layout=arrangeGames(games(size));
    assert.equal(layout.entries.filter(e=>e.type==='rear').length,0);
    for(let row=0;row<layout.rows;row++){
      const fronts=layout.entries.filter(e=>e.row===row&&e.type==='front').sort((a,b)=>a.x-b.x);
      const intervals=fronts.map(entry=>{
        const coverXs = corners(entry, false, true).map(corner => corner.x);
        return [Math.min(...coverXs),Math.max(...coverXs)];
      });
      for(let i=1;i<intervals.length;i++)assert.ok(intervals[i][0]>intervals[i-1][1],`Overlapping front covers at size ${size}, row ${row}`);
    }
  }
});

test('the shallow rack contains every resting case and supports it on the shelf plane', () => {
  assert.ok(RACK.depth >= 1.8 && RACK.depth <= 1.95);
  assert.equal(RACK.frontZ - RACK.backZ, RACK.depth);
  assert.equal(RACK.innerBackZ, RACK.backZ + RACK.backThickness);

  for (const size of [1, 24, 72, 90]) {
    const layout = arrangeGames(games(size));
    for (const entry of layout.entries) {
      const points = corners(entry);
      const shelfTop = layout.shelfYs[entry.row] + RACK.shelfTopOffset;
      assert.ok(Math.abs(Math.min(...points.map(point => point.y)) - shelfTop) < 1e-9, `Game ${entry.game.appid} is not standing on its shelf`);
      assert.ok(Math.min(...points.map(point => point.z)) >= RACK.innerBackZ - 1e-9, `Game ${entry.game.appid} penetrates the rear panel`);
      assert.ok(Math.max(...points.map(point => point.z)) <= RACK.frontZ + 1e-9, `Game ${entry.game.appid} projects past the rack front`);
    }
  }
});

test('front-facing cases mix rear-supported leans with near-front upright displays', () => {
  const layout = arrangeGames(games(72));
  const fronts = layout.entries.filter(entry => entry.type === 'front');
  const leaning = fronts.filter(entry => entry.leaning);
  const upright = fronts.filter(entry => !entry.leaning);
  assert.ok(leaning.length > 0 && upright.length > 0, 'Expected both front display poses');
  assert.ok(leaning.length / fronts.length >= .3 && leaning.length / fronts.length <= .5, 'Expected roughly 40% leaning covers');

  for (const entry of leaning) {
    assert.ok(Math.abs(entry.rx) >= .25, `Game ${entry.game.appid} is marked leaning without a visible lean`);
    const top = corners(entry, true);
    assert.ok(Math.abs(Math.min(...top.map(point => point.z)) - RACK.innerBackZ) < 1e-9, `Game ${entry.game.appid} does not touch the rear panel at the top`);
  }
  for (const entry of upright) {
    assert.ok(Math.abs(entry.rx) >= .035 && Math.abs(entry.rx) <= .09, `Game ${entry.game.appid} is not almost upright`);
    assert.ok(entry.z > (RACK.innerBackZ + RACK.frontZ) / 2, `Game ${entry.game.appid} is not displayed near the front`);
    const top = corners(entry, true);
    assert.ok(Math.min(...top.map(point => point.z)) > RACK.innerBackZ + .5, `Game ${entry.game.appid} incorrectly touches the rear panel`);
  }
});
