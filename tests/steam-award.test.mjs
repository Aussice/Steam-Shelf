import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSteamAward } from '../src/steamAward.js';

test('Steam Award is grounded, centered, finite, and keeps the stepped reference silhouette', () => {
  const award = createSteamAward();
  const bounds = new THREE.Box3().setFromObject(award);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());

  assert.ok(Math.abs(bounds.min.y) < 1e-6, `expected y=0 grounding, got ${bounds.min.y}`);
  assert.ok(Math.abs(center.x) < 1e-6, `expected x centering, got ${center.x}`);
  assert.ok(Math.abs(center.z) < 0.035, `expected approximate z centering, got ${center.z}`);
  assert.ok(size.y > 1.96 && size.y < 2.02, `unexpected height ${size.y}`);
  assert.ok(size.x > 0.75 && size.x < 0.81, `unexpected width ${size.x}`);
  assert.ok(size.z > 0.45 && size.z < 0.54, `unexpected depth ${size.z}`);

  const meshes = [];
  award.traverse((node) => {
    if (!node.isMesh) return;
    meshes.push(node);
    const positions = node.geometry.attributes.position;
    for (let index = 0; index < positions.count; index += 1) {
      assert.ok(Number.isFinite(positions.getX(index)));
      assert.ok(Number.isFinite(positions.getY(index)));
      assert.ok(Number.isFinite(positions.getZ(index)));
    }
  });
  assert.ok(meshes.some((mesh) => mesh.name.startsWith('crown-recess-back-')));
  assert.equal(meshes.filter((mesh) => mesh.name === 'steam-approved-mark-shape').length,3);
  assert.ok(meshes.filter((mesh) => mesh.name.startsWith('crown-block-')).length >= 7);
  award.userData.dispose();
});

test('finish variants recolor the metal and requested height scales uniformly', () => {
  const gold = createSteamAward({ finish: 'gold' });
  const silver = createSteamAward({ finish: 'silver', height: 1.5 });
  const goldBody = gold.getObjectByName('steam-award-main-tower');
  const silverBody = silver.getObjectByName('steam-award-main-tower');

  assert.notEqual(goldBody.material.color.getHex(), silverBody.material.color.getHex());
  assert.equal(silver.userData.finish, 'silver');
  assert.ok(Math.abs(new THREE.Box3().setFromObject(silver).max.y - 1.5) < 0.02);
  gold.userData.dispose();
  silver.userData.dispose();
});
