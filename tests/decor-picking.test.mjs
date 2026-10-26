import {test} from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import {createSteamAward} from '../src/steamAward.js';
import {decorItemForObject,disposeDecorObject} from '../src/collectionDecor.js';

test('nested award relief and GLB-style controller meshes resolve to their own display item',()=>{
  const award=createSteamAward({finish:'gold',height:2});
  const awardItem={kind:'award',finish:'gold',name:'金色 Steam 奖杯'};
  award.userData.decorItem=awardItem;
  const relief=award.getObjectByName('steam-approved-mark-shape');
  assert.ok(relief);
  assert.equal(decorItemForObject(relief),awardItem);
  const controller=new THREE.Group(),scene=new THREE.Group(),part=new THREE.Group();
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial());
  const controllerItem={kind:'gamepad',name:'PS5 DualSense 手柄'};
  controller.userData.decorItem=controllerItem;controller.add(scene);scene.add(part);part.add(mesh);
  assert.equal(decorItemForObject(mesh),controllerItem);
  const game=new THREE.Mesh();game.userData.appid=620;
  assert.equal(decorItemForObject(game),null);
  const unrelated=new THREE.Group();unrelated.userData.decorItem={kind:'unrecognized'};
  assert.equal(decorItemForObject(unrelated),null);
  assert.equal(decorItemForObject(null),null);
  disposeDecorObject(award);disposeDecorObject(controller);
});

test('closing a prop inspector disposes shared geometry, material, texture and bitmap exactly once',()=>{
  const counts={geometry:0,material:0,texture:0,bitmap:0};
  const geometry=new THREE.BoxGeometry();
  const texture=new THREE.Texture({close:()=>counts.bitmap++});
  const material=new THREE.MeshStandardMaterial({map:texture,roughnessMap:texture});
  geometry.addEventListener('dispose',()=>counts.geometry++);
  material.addEventListener('dispose',()=>counts.material++);
  texture.addEventListener('dispose',()=>counts.texture++);
  const root=new THREE.Group();
  root.add(new THREE.Mesh(geometry,material),new THREE.Mesh(geometry,material));
  disposeDecorObject(root);
  assert.deepEqual(counts,{geometry:1,material:1,texture:1,bitmap:1});
});
