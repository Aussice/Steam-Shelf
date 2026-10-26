import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { createSteamAward } from './steamAward.js';
import { CASE, RACK } from './shelfLayout.js';

const FILES={gamepad:'gamepad.glb'};
const binaries=new Map();
async function modelBinary(name) {
  if(!binaries.has(name))binaries.set(name,(async()=>{
    if(window.steamShelf?.model){const base64=await window.steamShelf.model(name);return Uint8Array.from(atob(base64),c=>c.charCodeAt(0)).buffer;}
    const response=await fetch('./models/'+FILES[name]);if(!response.ok)throw new Error('Local model unavailable');return response.arrayBuffer();
  })().catch(error=>{binaries.delete(name);throw error;}));
  return binaries.get(name);
}
export function disposeDecorObject(root) {
  const geometry=new Set(),materials=new Set(),textures=new Set();
  root.traverse(node=>{if(node.geometry)geometry.add(node.geometry);for(const m of node.material?(Array.isArray(node.material)?node.material:[node.material]):[]){materials.add(m);for(const value of Object.values(m))if(value?.isTexture)textures.add(value);}});
  geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>{t.dispose();t.source?.data?.close?.();});
}

export async function loadDecorModel(name) {
  if(!Object.hasOwn(FILES,name))throw new Error('Unknown local display model');
  const loader=new GLTFLoader();
  const gltf=await loader.parseAsync((await modelBinary(name)).slice(0),'');
  return gltf.scene;
}

export function decorItemForObject(object) {
  for(let node=object;node;node=node.parent) {
    const item=node.userData?.decorItem;
    if(item&&(item.kind==='gamepad'||item.kind==='award'))return item;
  }
  return null;
}
function fitModel(source,{width,height,depth,rx=0,ry=0,rz=0}) {
  const pose=new THREE.Group();pose.add(source);pose.rotation.set(rx,ry,rz);pose.updateMatrixWorld(true);
  const bounds=new THREE.Box3().setFromObject(pose,true),size=bounds.getSize(new THREE.Vector3());
  const scale=Math.min(width/size.x,height/size.y,depth/size.z);pose.scale.setScalar(scale);pose.updateMatrixWorld(true);
  bounds.setFromObject(pose,true);const center=bounds.getCenter(new THREE.Vector3());pose.position.set(-center.x,-bounds.min.y,-center.z);
  pose.traverse(node=>{if(node.isMesh){node.castShadow=true;node.receiveShadow=true;for(const m of Array.isArray(node.material)?node.material:[node.material]){m.envMapIntensity=.45;if(m.map)m.map.anisotropy=8;}}});
  const root=new THREE.Group();root.add(pose);return root;
}
function freeEdges(layout,row) {
  const entries=layout.entries.filter(e=>e.row===row);
  const radius=e=>e.type==='stack'?CASE.height/2:e.type==='spine'?CASE.depth/2:CASE.width/2;
  return {left:Math.min(...entries.map(e=>e.x-radius(e)))+layout.width/2,right:layout.width/2-Math.max(...entries.map(e=>e.x+radius(e)))};
}

export function decorPositions(layout) {
  const row=Math.min(1,layout.rows-1),half=layout.width/2,edge=freeEdges(layout,row),shelfY=layout.shelfYs[row]+RACK.shelfTopOffset;
  const scale=Math.min(1,layout.width/5.5);
  const insideController=edge.left>2.25*scale,insideAwards=edge.right>2.45*scale;
  return {
    row,scale,insideController,insideAwards,
    controller:new THREE.Vector3(insideController?-half+1.25*scale:-Math.min(half-1.0*scale,layout.width*.28),insideController?shelfY:layout.bounds.top+.09,-.10),
    awards:new THREE.Vector3(insideAwards?half-1.4*scale:Math.min(half-1.2*scale,layout.width*.24),insideAwards?shelfY:layout.bounds.top+.09,.24),
  };
}

export function addCollectionDecor({rack,layout,alive,invalidate,onBoundsChange}) {
  const group=new THREE.Group();group.name='collection-display-props';rack.add(group);
  const positions=decorPositions(layout);
  const scale=positions.scale,awardScale=scale*.75;
  for(const [finish,height,x,z,ry] of [['silver',1.85,-.78,-.08,-.06],['gold',2.08,0,.12,.035],['bronze',1.74,.78,0,-.08]]) {
    const finishName={gold:'金色',silver:'银色',bronze:'铜色'}[finish];
    const award=createSteamAward({finish,height:height*awardScale});
    award.userData.decorItem={kind:'award',finish,name:`${finishName} Steam 奖杯`};
    award.position.copy(positions.awards).add(new THREE.Vector3(x*awardScale,0,z*awardScale));award.rotation.y=ry;group.add(award);
  }
  onBoundsChange?.(new THREE.Box3().setFromObject(group));
  const ready=loadDecorModel('gamepad').then(source=>{
    if(!alive()){disposeDecorObject(source);return false;}
    if(!source)return;
    // The authored button face points +Z. Lay it face-up (+Y), with a small
    // in-plane turn; fitModel grounds its back shell on the shelf surface.
    const object=fitModel(source,{width:.93*scale,height:.41*scale,depth:.69*scale,rx:-Math.PI/2,rz:-.10});
    object.userData.decorItem={kind:'gamepad',name:'PS5 DualSense 手柄'};
    object.position.copy(positions.controller);object.name='ready-made-ps5-dualsense';group.add(object);
    if(alive()){onBoundsChange?.(new THREE.Box3().setFromObject(group));invalidate();}
    return true;
  }).catch(error=>{console.warn('[collectionDecor] Local display model failed to load.',error);return false;});
  return {group,ready};
}
