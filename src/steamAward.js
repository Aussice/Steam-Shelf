import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { createSteamRelief } from './steamLogo.js';

const FINISHES = {
  gold: {
    body: 0xc89a39,
    edge: 0xf1c56b,
    shadow: 0x5a3612,
    recess: 0x6a431b,
    plaque: 0xa97927,
  },
  silver: {
    body: 0xb9bec0,
    edge: 0xe1e5e4,
    shadow: 0x3c4448,
    recess: 0x626b6f,
    plaque: 0x979d9f,
  },
  bronze: {
    body: 0x76503c,
    edge: 0xa8795d,
    shadow: 0x241914,
    recess: 0x36251e,
    plaque: 0x5e3e30,
  },
};

function brushedTexture(seed = 1) {
  const width = 64;
  const height = 128;
  const data = new Uint8Array(width * height * 4);
  let state = seed >>> 0;
  const random = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0xffffffff;
  };

  // Long vertical runs plus occasional sharp scratches read as brushed metal.
  const columns = Array.from({ length: width }, () => random() * 30 - 15);
  for (let y = 0; y < height; y += 1) {
    const scratch = random() > 0.955;
    for (let x = 0; x < width; x += 1) {
      const grain = (random() - 0.5) * 22;
      const streak = scratch && x > 4 && x < width - 5 ? 35 : 0;
      const value=THREE.MathUtils.clamp(132 + columns[x] + grain + streak, 0, 255);
      const offset=(y * width + x)*4;
      data[offset]=data[offset+1]=data[offset+2]=value;data[offset+3]=255;
    }
  }

  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.name = 'steam-award-brushed-roughness';
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(2.5, 6);
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function metalMaterial(name, color, roughnessMap, roughness = 0.29) {
  return new THREE.MeshStandardMaterial({
    name,
    color,
    metalness: 0.88,
    roughness,
    roughnessMap,
    bumpMap: roughnessMap,
    bumpScale: 0.004,
    envMapIntensity: 0.8,
  });
}

function roundedBox(name, size, position, material, radius = 0.008, segments = 2) {
  const geometry = new RoundedBoxGeometry(size.x, size.y, size.z, segments, radius);
  geometry.name = `${name}-geometry`;
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.copy(position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function plaqueTextTexture(finish) {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = 768;
  canvas.height = 160;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '600 58px Georgia, serif';
  ctx.letterSpacing = '9px';
  ctx.fillStyle = finish === 'silver' ? 'rgba(40,46,48,.72)' : 'rgba(48,27,10,.7)';
  ctx.fillText('STEAM AWARDS', canvas.width / 2 + 2, canvas.height / 2 + 3);
  ctx.fillStyle = finish === 'silver' ? 'rgba(255,255,255,.38)' : 'rgba(255,223,148,.34)';
  ctx.fillText('STEAM AWARDS', canvas.width / 2, canvas.height / 2);
  const texture = new THREE.CanvasTexture(canvas);
  texture.name = 'steam-awards-engraving-texture';
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function addCrown(group, materials) {
  const cell = 0.18;
  const columns = 4;
  const heights = [3, 4, 3, 2];
  const recesses = new Set(['0,2', '1,1', '2,2']);
  const crownBottom = 1.28;
  const frontZ = 0.19;

  for (let column = 0; column < columns; column += 1) {
    for (let row = 0; row < heights[column]; row += 1) {
      const key = `${column},${row}`;
      const x = (column - (columns - 1) / 2) * cell;
      const y = crownBottom + row * cell + cell / 2;
      if (recesses.has(key)) {
        // The back wall and four lips make this a genuine inset cell rather than a dark decal.
        group.add(roundedBox(
          `crown-recess-back-${column}-${row}`,
          new THREE.Vector3(cell - 0.016, cell - 0.016, 0.07),
          new THREE.Vector3(x, y, -0.095),
          materials.recess,
          0.004,
          1,
        ));
        const lip = 0.014;
        group.add(roundedBox(
          `crown-recess-left-${column}-${row}`,
          new THREE.Vector3(lip, cell, 0.25),
          new THREE.Vector3(x - cell / 2 + lip / 2, y, 0.03),
          materials.edge,
          0.003,
          1,
        ));
        group.add(roundedBox(
          `crown-recess-right-${column}-${row}`,
          new THREE.Vector3(lip, cell, 0.25),
          new THREE.Vector3(x + cell / 2 - lip / 2, y, 0.03),
          materials.edge,
          0.003,
          1,
        ));
        group.add(roundedBox(
          `crown-recess-top-${column}-${row}`,
          new THREE.Vector3(cell - lip * 2, lip, 0.25),
          new THREE.Vector3(x, y + cell / 2 - lip / 2, 0.03),
          materials.edge,
          0.003,
          1,
        ));
        group.add(roundedBox(
          `crown-recess-bottom-${column}-${row}`,
          new THREE.Vector3(cell - lip * 2, lip, 0.25),
          new THREE.Vector3(x, y - cell / 2 + lip / 2, 0.03),
          materials.edge,
          0.003,
          1,
        ));
      } else {
        group.add(roundedBox(
          `crown-block-${column}-${row}`,
          new THREE.Vector3(cell - 0.008, cell - 0.008, 0.38),
          new THREE.Vector3(x, y, 0),
          materials.body,
          0.006,
          2,
        ));
      }
    }
  }

}

/**
 * Builds a freestanding Steam Awards tower inspired by the physical award.
 * The object is centered on X/Z, rests at Y=0, and is nominally 0.78 x 2 x 0.48.
 */
export function createSteamAward({ finish = 'gold', height = 2, name } = {}) {
  const finishName = Object.hasOwn(FINISHES, finish) ? finish : 'gold';
  const palette = FINISHES[finishName];
  const roughnessMap = brushedTexture(finishName === 'gold' ? 417 : finishName === 'silver' ? 823 : 1201);
  const materials = {
    body: metalMaterial('steam-award-body-metal', palette.body, roughnessMap, 0.66),
    edge: metalMaterial('steam-award-highlight-metal', palette.edge, roughnessMap, 0.54),
    recess: metalMaterial('steam-award-recess-metal', palette.recess, roughnessMap, 0.9),
    shadow: metalMaterial('steam-award-logo-shadow', palette.shadow, roughnessMap, 0.92),
    plaque: metalMaterial('steam-award-plaque-metal', palette.plaque, roughnessMap, 0.72),
  };

  const award = new THREE.Group();
  award.name = name || `steam-award-${finishName}`;
  award.userData.kind = 'steam-award';
  award.userData.finish = finishName;
  award.userData.nominalSize = { width: 0.78, height: 2, depth: 0.48 };

  const plinth = roundedBox(
    'steam-award-plinth',
    new THREE.Vector3(0.78, 0.24, 0.48),
    new THREE.Vector3(0, 0.12, 0),
    materials.plaque,
    0.018,
    3,
  );
  award.add(plinth);
  award.add(roundedBox(
    'steam-award-plinth-inset',
    new THREE.Vector3(0.70, 0.15, 0.018),
    new THREE.Vector3(0, 0.115, 0.245),
    materials.recess,
    0.009,
    2,
  ));
  award.add(roundedBox(
    'steam-award-plinth-face',
    new THREE.Vector3(0.67, 0.12, 0.014),
    new THREE.Vector3(0, 0.115, 0.257),
    materials.plaque,
    0.006,
    2,
  ));

  const engraving = plaqueTextTexture(finishName);
  if (engraving) {
    const textMaterial = new THREE.MeshStandardMaterial({
      name: 'steam-awards-engraving-material',
      map: engraving,
      transparent: true,
      depthWrite: false,
      metalness: 0.15,
      roughness: 0.62,
      polygonOffset: true,
      polygonOffsetFactor: -2,
    });
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.105), textMaterial);
    label.geometry.name = 'steam-awards-engraving-plane-geometry';
    label.name = 'steam-awards-engraving';
    label.position.set(0, 0.115, 0.266);
    award.add(label);
  }

  award.add(roundedBox(
    'steam-award-main-tower',
    new THREE.Vector3(0.72, 1.06, 0.40),
    new THREE.Vector3(0, 0.77, 0),
    materials.body,
    0.014,
    3,
  ));
  addCrown(award, materials);

  const medallion = new THREE.Mesh(
    new THREE.CylinderGeometry(0.275, 0.275, 0.042, 64, 1, false),
    materials.plaque,
  );
  medallion.geometry.name = 'steam-award-medallion-geometry';
  medallion.name = 'steam-award-medallion';
  medallion.rotation.x = Math.PI / 2;
  medallion.position.set(0, 0.72, 0.22);
  medallion.castShadow = true;
  medallion.receiveShadow = true;
  award.add(medallion);

  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.255, 0.012, 8, 64), materials.edge);
  rim.geometry.name = 'steam-award-medallion-rim-geometry';
  rim.name = 'steam-award-medallion-rim';
  rim.position.set(0, 0.72, 0.247);
  award.add(rim);

  const linkage = createSteamRelief(materials.edge,.51,.016);
  linkage.position.set(0,0.72,0.258);
  award.add(linkage);

  const scale = Number.isFinite(height) && height > 0 ? height / 2 : 1;
  award.scale.setScalar(scale);
  award.updateMatrixWorld(true);
  award.userData.dispose = () => {
    const geometries = new Set();
    const ownedMaterials = new Set();
    const textures = new Set();
    award.traverse((node) => {
      if (node.geometry) geometries.add(node.geometry);
      const nodeMaterials = node.material ? (Array.isArray(node.material) ? node.material : [node.material]) : [];
      nodeMaterials.forEach((material) => {
        ownedMaterials.add(material);
        Object.values(material).forEach((value) => {
          if (value?.isTexture) textures.add(value);
        });
      });
    });
    geometries.forEach((geometry) => geometry.dispose());
    ownedMaterials.forEach((material) => material.dispose());
    textures.forEach((texture) => texture.dispose());
  };

  return award;
}

