import * as THREE from 'three';

const MATERIAL_ROOT = './materials';

const SOURCES = {
  metal: 'shelf-blue-metal',
  wood: 'shelf-smoked-walnut',
  wall: 'wall-painted-plaster',
  floor: 'floor-worn-concrete',
};

const FILE_SUFFIX = {
  color: 'color.jpg',
  normal: 'normal-gl.jpg',
  roughness: 'roughness.jpg',
};

function isAlive(alive) {
  if (typeof alive === 'function') return alive();
  if (alive && typeof alive === 'object' && 'current' in alive) return Boolean(alive.current);
  return alive !== false;
}

function setMaps(material, set) {
  material.map = set.color;
  material.normalMap = set.normal;
  material.roughnessMap = set.roughness;
  material.needsUpdate = true;
}

/**
 * Build the four room/rack materials immediately, then hydrate them with local
 * Poly Haven maps. `ready` resolves true after maps are installed, or false if
 * the owning scene has gone away or an asset could not be decoded.
 */
export function createRoomMaterials({ wood = false, anisotropy = 1, invalidate, alive } = {}) {
  const metal = new THREE.MeshStandardMaterial({
    color: wood ? '#664831' : '#a3adb4',
    metalness: wood ? 0.03 : 0.48,
    roughness: wood ? 0.72 : 0.6,
    normalScale: new THREE.Vector2(wood ? 0.2 : 0.24, wood ? 0.2 : 0.24),
    envMapIntensity: wood ? 0.34 : 0.52,
  });
  const backMat = new THREE.MeshStandardMaterial({
    color: wood ? '#4a3325' : '#7e8991',
    metalness: wood ? 0.02 : 0.26,
    roughness: wood ? 0.82 : 0.74,
    normalScale: new THREE.Vector2(0.16, 0.16),
    envMapIntensity: 0.34,
  });
  const wall = new THREE.MeshStandardMaterial({
    color: wood ? '#4a443b' : '#3b4854',
    metalness: 0,
    roughness: 0.96,
    normalScale: new THREE.Vector2(0.28, 0.28),
    envMapIntensity: 0.16,
  });
  const floor = new THREE.MeshStandardMaterial({
    color: wood ? '#4f463d' : '#4b5761',
    metalness: 0.01,
    roughness: 0.93,
    normalScale: new THREE.Vector2(0.38, 0.38),
    envMapIntensity: 0.22,
  });

  const textures = [];
  let failed=false;
  const loader = new THREE.TextureLoader();
  const safeAnisotropy = Math.max(1, Math.min(8, Number(anisotropy) || 1));

  const loadTexture = async (source, kind, repeat) => {
    const texture = await loader.loadAsync(`${MATERIAL_ROOT}/${source}-${FILE_SUFFIX[kind]}`);
    if(failed||!isAlive(alive)){texture.dispose();return texture;}
    texture.name = `${source}-${kind}`;
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(repeat[0], repeat[1]);
    texture.anisotropy = safeAnisotropy;
    texture.colorSpace = kind === 'color' ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.needsUpdate = true;
    textures.push(texture);
    return texture;
  };

  const loadSet = async (source, repeat) => {
    const [color, normal, roughness] = await Promise.all([
      loadTexture(source, 'color', repeat),
      loadTexture(source, 'normal', repeat),
      loadTexture(source, 'roughness', repeat),
    ]);
    return { color, normal, roughness };
  };

  const ready = Promise.all([
    loadSet(wood ? SOURCES.wood : SOURCES.metal, [1, 1]),
    // The source scans are 2 m square and the scene planes are 100 x 70 / 100 x 100.
    loadSet(SOURCES.wall, [50, 35]),
    // Concrete Floor Worn 001 is a 3 m square scan.
    loadSet(SOURCES.floor, [100 / 3, 100 / 3]),
  ]).then(([shelfSet, wallSet, floorSet]) => {
    if (!isAlive(alive)) {
      textures.splice(0).forEach((texture) => texture.dispose());
      return false;
    }
    setMaps(metal, shelfSet);
    setMaps(backMat, shelfSet);
    setMaps(wall, wallSet);
    setMaps(floor, floorSet);
    if (typeof invalidate === 'function') invalidate();
    return true;
  }).catch((error) => {
    failed=true;
    textures.splice(0).forEach((texture) => texture.dispose());
    console.warn('[roomMaterials] Local PBR textures could not be loaded.', error);
    return false;
  });

  return { metal, backMat, wall, floor, textures, ready };
}

/**
 * Reprojects a box-like mesh in local/world-sized units so long shelf boards do
 * not stretch one copy of a texture across their entire length. The geometry is
 * mutated in place; clone shared geometry before calling this helper.
 */
export function applyWorldUV(target, worldUnitsPerTile = 2) {
  const tile = Math.max(0.001, Number(worldUnitsPerTile) || 2);

  const project = (geometry) => {
    const position = geometry?.getAttribute?.('position');
    const normal = geometry?.getAttribute?.('normal');
    if (!position || !normal) return;

    const uv = new Float32Array(position.count * 2);
    for (let index = 0; index < position.count; index += 1) {
      const x = position.getX(index);
      const y = position.getY(index);
      const z = position.getZ(index);
      const nx = normal.getX(index);
      const ny = normal.getY(index);
      const nz = normal.getZ(index);
      const ax = Math.abs(nx);
      const ay = Math.abs(ny);
      const az = Math.abs(nz);

      if (ax >= ay && ax >= az) {
        uv[index * 2] = (nx < 0 ? -z : z) / tile;
        uv[index * 2 + 1] = y / tile;
      } else if (ay >= az) {
        uv[index * 2] = x / tile;
        uv[index * 2 + 1] = (ny < 0 ? -z : z) / tile;
      } else {
        uv[index * 2] = (nz < 0 ? -x : x) / tile;
        uv[index * 2 + 1] = y / tile;
      }
    }
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geometry.getAttribute('uv').needsUpdate = true;
  };

  if (target?.isBufferGeometry) {
    project(target);
  } else if (target?.traverse) {
    target.traverse((object) => {
      if (object.isMesh) project(object.geometry);
    });
  } else if (target?.geometry) {
    project(target.geometry);
  }
  return target;
}
