import * as THREE from 'three';
import data from './steamLogoData.json' with { type:'json' };

let canvasPaths;
export function drawSteamMark(ctx,x,y,radius,color='#eff5fa') {
  canvasPaths ||= data.paths.map(path=>new Path2D(path));
  ctx.save();ctx.translate(x-radius,y-radius);ctx.scale(radius*2/89,radius*2/89);ctx.fillStyle=color;
  for(const path of canvasPaths)ctx.fill(path);
  ctx.restore();
}

export function createSteamRelief(material,diameter=.51,depth=.016) {
  const group=new THREE.Group();group.name='steam-official-mark-relief';
  for(const json of data.shapes){
    const shape=new THREE.Shape().fromJSON(json);
    const geometry=new THREE.ExtrudeGeometry(shape,{depth:depth*89/diameter,bevelEnabled:false,curveSegments:32});
    geometry.translate(-44.5,-44.5,0);geometry.scale(diameter/89,diameter/89,diameter/89);
    const mesh=new THREE.Mesh(geometry,material);mesh.scale.y=-1;mesh.name='steam-approved-mark-shape';mesh.castShadow=true;group.add(mesh);
  }
  return group;
}
