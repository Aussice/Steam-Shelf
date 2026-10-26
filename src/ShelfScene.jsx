import { t } from './i18n.js';
import { useLocale } from './useLocale.js';
import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { caseArtwork, canvasTexture, titleLines, steamMark } from './coverTextures';
import { arrangeGames, CASE, RACK } from './shelfLayout';
import { createRoomMaterials, applyWorldUV } from './roomMaterials';
import { addCollectionDecor, decorItemForObject } from './collectionDecor';

const EMPTY_PLACEMENTS = Object.freeze({});
const DEFAULT_LABELS = Object.freeze(['我的最爱', '正在游玩', '等待启封']);
const validView = view => view && [view.azimuth, view.polar, view.distanceRatio].every(Number.isFinite);
const clampView = view => ({
  azimuth: THREE.MathUtils.clamp(view.azimuth, -.66, .66),
  polar: THREE.MathUtils.clamp(view.polar, 1.03, 1.65),
  distanceRatio: THREE.MathUtils.clamp(view.distanceRatio, .42, 1.5),
});

const ShelfScene = forwardRef(function ShelfScene({
  games, selected, onSelect, theme, angle, reducedMotion, onHover, coverRevision = 0,
  placements = EMPTY_PLACEMENTS, shelfLabels = DEFAULT_LABELS, editMode = false,
  onSwap, initialView = null, onViewChange, onDecorSelect,
}, ref) {
  const locale = useLocale();
  const host = useRef(null);
  const engine = useRef(null);
  const callbacks = useRef({ onSelect, onHover, onSwap, onViewChange, onDecorSelect, editMode });
  const savedView = useRef(validView(initialView) ? clampView(initialView) : null);
  const lastAngle = useRef(angle);
  if (lastAngle.current !== angle) {
    lastAngle.current = angle;
    savedView.current = null;
  }
  callbacks.current = { onSelect, onHover, onSwap, onViewChange, onDecorSelect, editMode };
  const [error, setError] = useState(false);
  const placementKey = games.map(game => `${game.appid}:${placements?.[game.appid] ?? ''}`).join('|');
  const labelKey = shelfLabels.join('\u0000');

  useImperativeHandle(ref, () => ({
    reset() { engine.current?.reset(); },
    zoom(amount) { engine.current?.zoom(amount); },
    screenshot() {
      const current = engine.current;
      if (!current) return null;
      current.renderer.render(current.scene, current.camera);
      return current.renderer.domElement.toDataURL('image/png');
    },
  }), []);

  useEffect(() => {
    const container = host.current;
    if (!container) return undefined;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    } catch {
      setError(true);
      return undefined;
    }
    setError(false);

    let live = true;
    let frame = null;
    let viewTimer = null;
    let lastTime = performance.now();
    let dirty = true;
    let hoverId = null;
    let hoverDecorKey = null;
    let targetId = null;
    let down = null;
    let state;
    let animate;
    let suppressViewReport = true;
    const invalidate = () => {
      dirty = true;
      if (live && frame === null && animate && !document.hidden) frame = requestAnimationFrame(animate);
    };

    renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio || 1, 2), 2.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.03;
    container.appendChild(renderer.domElement);
    const canvas = renderer.domElement;
    canvas.style.touchAction = 'none';
    canvas.setAttribute('aria-label', t('可拖动、缩放的实体游戏书架。点击封面或盒脊选择游戏；编辑模式可拖动游戏盒交换位置。'));

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(theme === 'wood' ? '#171d21' : '#101a25');
    const environment = new RoomEnvironment();
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envTarget = pmrem.fromScene(environment, .06);
    scene.environment = envTarget.texture;
    scene.environmentIntensity = .38;
    environment.dispose();
    pmrem.dispose();

    const camera = new THREE.PerspectiveCamera(34, 1, .1, 120);
    const controls = new OrbitControls(camera, canvas);
    controls.enableDamping = !reducedMotion;
    controls.dampingFactor = .095;
    controls.enablePan = false;
    controls.minAzimuthAngle = -.66;
    controls.maxAzimuthAngle = .66;
    controls.minPolarAngle = 1.03;
    controls.maxPolarAngle = 1.65;
    controls.rotateSpeed = .55;
    controls.zoomSpeed = .8;

    const layout = arrangeGames(games, 3, placements);
    const width = layout.width;
    const half = width / 2;
    const bounds = layout.bounds;
    const wood = theme === 'wood';
    const rack = new THREE.Group();
    scene.add(rack);
    const anisotropy = renderer.capabilities.getMaxAnisotropy();
    const roomMaterials=createRoomMaterials({wood,anisotropy,invalidate,alive:()=>live});
    const {metal,backMat,wall:roomWallMat,floor:roomFloorMat}=roomMaterials;
    const dark = new THREE.MeshStandardMaterial({ color: '#11161c', metalness: .24, roughness: .57 });
    const boltMat = new THREE.MeshStandardMaterial({ color: '#8a9298', metalness: .9, roughness: .34 });
    const caseMat = new THREE.MeshPhysicalMaterial({ color: '#17222e', metalness: .04, roughness: .56, clearcoat: .08, clearcoatRoughness: .82 });
    const caseRim = new THREE.MeshPhysicalMaterial({ color: '#2b3947', metalness: .03, roughness: .53, clearcoat: .08, clearcoatRoughness: .8 });
    const seamMat = new THREE.MeshStandardMaterial({ color: '#080e15', metalness: .12, roughness: .59 });
    const warmGlow = new THREE.MeshStandardMaterial({ color: '#f4d2a3', emissive: '#ffb965', emissiveIntensity: 1.1, roughness: .72 });

    function box(parent, w, h, d, x, y, z, material = metal, radius = 0, shadow = true) {
      const geometry = radius ? new RoundedBoxGeometry(w, h, d, 2, radius) : new THREE.BoxGeometry(w, h, d);
      const mesh = new THREE.Mesh(geometry, material);
      if(material===metal||material===backMat)applyWorldUV(mesh,wood?1:2.5);
      mesh.position.set(x, y, z);
      mesh.castShadow = shadow;
      mesh.receiveShadow = true;
      parent.add(mesh);
      return mesh;
    }

    // A physical room gives the rack scale and lets its feet and cases cast readable shadows.
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(100, 70), roomWallMat);
    wall.position.set(0, .15, RACK.wallZ);
    wall.receiveShadow = true;
    scene.add(wall);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(100, 100), roomFloorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.set(0, bounds.bottom - .1, (RACK.backZ + RACK.frontZ) / 2);
    floor.receiveShadow = true;
    scene.add(floor);
    box(scene, width + 13, .16, .16, 0, bounds.bottom, RACK.wallZ + .08, dark, .025, false);

    scene.add(new THREE.HemisphereLight('#b7d5f1', '#40382f', .56));
    const key = new THREE.DirectionalLight('#ffe7c7', 2.7);
    key.position.set(-4, 9, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -half - 2, right: half + 2, top: 8, bottom: -8, near: 1, far: 32 });
    key.shadow.normalBias = .012;
    key.shadow.bias = -.00015;
    key.shadow.radius = 3;
    scene.add(key);
    const fill = new THREE.DirectionalLight('#a9ccff', .72);
    fill.position.set(7, 4, 5);
    scene.add(fill);
    const rim = new THREE.DirectionalLight('#d8eaff', .48);
    rim.position.set(-7, 6, -1);
    scene.add(rim);

    box(rack, width, bounds.height - .22, RACK.backThickness, 0, -.1, RACK.backZ + RACK.backThickness / 2, backMat);
    for (let y = bounds.bottom + .43; y < bounds.top - .23; y += .22) box(rack, width - .15, .018, .016, 0, y, RACK.innerBackZ + .008, dark, 0, false);
    for (const x of [-half - .07, half + .07]) {
      box(rack, .20, bounds.height, RACK.depth, x, -.08, 0, metal, .03);
      box(rack, .33, .15, RACK.depth + .12, x, bounds.bottom, 0, dark, .025);
      for (let y = bounds.bottom + .68; y < bounds.top - .13; y += .30) box(rack, .045, .12, .012, x, y, RACK.frontZ - .012, dark, .008, false);
    }
    box(rack, width + .25, .18, RACK.depth, 0, bounds.top, 0, metal, .025);

    // Cropped posts and shelf noses imply neighboring bays without reducing the main rack's occupancy.
    for (const side of [-1, 1]) {
      const x = side * (half + .72);
      box(scene, .13, bounds.height - .55, .24, x, -.15, RACK.backZ + .12, dark, .018);
      for (const y of layout.shelfYs) box(scene, .68, .09, .3, x + side * .26, y, RACK.backZ + .17, dark, .012);
    }

    const labelTextures = [];
    for (let row = 0; row < layout.rows; row++) {
      const y = layout.shelfYs[row];
      box(rack, width, RACK.shelfThickness, RACK.depth - .02, 0, y, 0, metal, .022);
      box(rack, width + .02, .29, RACK.frontLipDepth, 0, y - .035, RACK.frontLipZ, dark, .012);
      box(rack, width - .08, .035, .055, 0, y + .075, RACK.frontZ - .075, boltMat, .009);
      box(rack, width - .08, .075, .12, 0, y + .10, RACK.rearRailZ, dark);
      for (const x of [-half + .08, half - .08]) box(rack, .10, .25, RACK.depth - .2, x, y - .17, 0, dark, .02);

      const labelTexture = canvasTexture(4096,64,(ctx,w,h)=>{
        const gradient=ctx.createLinearGradient(0,0,0,h);gradient.addColorStop(0,'#24558d');gradient.addColorStop(1,'#153b6d');ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);
        ctx.fillStyle='#ffffff32';ctx.fillRect(0,0,w,2);
        for(let i=0;i<5;i++){steamMark(ctx,42+i*650,31,18);ctx.fillStyle='#e4eaf0';ctx.font='bold 30px Arial';ctx.fillText('STEAM',78+i*650,42);}
        ctx.fillStyle='#0c294d';ctx.fillRect(w-720,4,716,h-8);ctx.fillStyle='#e0d7bf';ctx.font='500 29px "Microsoft YaHei",sans-serif';ctx.fillText(t(String(shelfLabels[row]??`收藏 ${row+1}`)),w-675,42,630);
      });
      labelTexture.anisotropy = anisotropy;
      labelTextures.push(labelTexture);
      const labelMat = new THREE.MeshStandardMaterial({ map: labelTexture, roughness: .88, metalness: 0 });
      const label = new THREE.Mesh(new THREE.PlaneGeometry(width - .06, .255), labelMat);
      label.position.set(0, y - .025, RACK.labelZ);
      rack.add(label);

      const lightY = row === 0 ? bounds.top - .18 : layout.shelfYs[row - 1] - .18;
      box(rack, width - .72, .028, .07, 0, lightY, RACK.lightZ, warmGlow, .01, false);
      for(const x of [-width*.33,0,width*.33]) {
        const shelfLight=new THREE.PointLight('#ffbc73',3.1,4.4,2);shelfLight.position.set(x,lightY-.12,RACK.lightZ-.12);rack.add(shelfLight);
      }
      const bounce=canvasTexture(256,128,(ctx,w,h)=>{const gradient=ctx.createRadialGradient(w/2,0,1,w/2,0,w*.52);gradient.addColorStop(0,'#ffb65c60');gradient.addColorStop(.5,'#e49a3d19');gradient.addColorStop(1,'#e49a3d00');ctx.fillStyle=gradient;ctx.fillRect(0,0,w,h);});
      const bouncePlane=new THREE.Mesh(new THREE.PlaneGeometry(width-.5,1.35),new THREE.MeshBasicMaterial({map:bounce,transparent:true,depthWrite:false,opacity:.5}));bouncePlane.position.set(0,lightY-.5,RACK.innerBackZ+.006);rack.add(bouncePlane);

    }

    const screwGeometry = new THREE.CylinderGeometry(.034, .034, .017, 12);
    for (const x of [-half - .07, half + .07]) for (const y of [bounds.top - .26, ...layout.shelfYs]) {
      const screw = new THREE.Mesh(screwGeometry, boltMat);
      screw.rotation.x = Math.PI / 2;
      screw.position.set(x, y, RACK.frontZ + .006);
      rack.add(screw);
    }

    const filmNormal = canvasTexture(256, 256, (ctx, w, h) => {
      const data = ctx.createImageData(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const edge = Math.pow(Math.abs(x / w - .5) * 2, 6) + Math.pow(Math.abs(y / h - .5) * 2, 7);
        const wave = Math.sin(x * .115 + y * .035) * Math.sin(y * .075) * 4 + Math.sin(x * .19 - y * .07) * edge * 12;
        const k = (y * w + x) * 4;
        data.data[k] = 128 + wave;
        data.data[k + 1] = 128 + Math.cos(y * .18 + x * .08) * edge * 8;
        data.data[k + 2] = 254;
        data.data[k + 3] = 255;
      }
      ctx.putImageData(data, 0, 0);
    }, false);
    const shadowTexture = canvasTexture(128, 128, (ctx, w, h) => {
      const gradient = ctx.createRadialGradient(w / 2, h / 2, 8, w / 2, h / 2, w / 2);
      gradient.addColorStop(0, '#000000a8');
      gradient.addColorStop(.55, '#00000052');
      gradient.addColorStop(1, '#00000000');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);
    });
    const shadowMat = new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, depthWrite: false, opacity: .56 });
    const highlightMat = new THREE.MeshBasicMaterial({ color: '#74d2ff', transparent: true, opacity: .9, wireframe: true, depthTest: false });
    const books = [];
    const picks = [];
    const bookById = new Map();
    const gameById = new Map(layout.entries.map(entry => [entry.game.appid, entry.game]));
    const bodyGeometry = new RoundedBoxGeometry(CASE.width, CASE.height, CASE.depth, 3, .022);
    const frontGeometry = new THREE.PlaneGeometry(CASE.width - .085, CASE.height - .085);
    const spineGeometry = new THREE.PlaneGeometry(CASE.depth - .023, CASE.height - .055);

    for (const entry of layout.entries) {
      const { game, type } = entry;
      const group = new THREE.Group();
      group.position.set(entry.x, entry.y, entry.z);
      group.rotation.set(entry.rx ?? -.015, entry.ry, entry.rz);
      const body = new THREE.Mesh(bodyGeometry, caseMat);
      body.castShadow = true;
      body.receiveShadow = true;
      group.add(body);
      const artwork = caseArtwork(game, () => live, invalidate, anisotropy);
      const faceMat = new THREE.MeshPhysicalMaterial({
        map: artwork.face, roughness: .7, metalness: 0, clearcoat: .025, clearcoatRoughness: .94,
        clearcoatNormalMap: filmNormal, clearcoatNormalScale: new THREE.Vector2(.025, .025), envMapIntensity: .08,
      });
      const front = new THREE.Mesh(frontGeometry, faceMat);
      front.position.z = CASE.depth / 2 + .002;
      front.receiveShadow = true;
      group.add(front);
      const spine = new THREE.Mesh(spineGeometry, new THREE.MeshPhysicalMaterial({ map: artwork.spine, roughness: .7, clearcoat: .02, clearcoatRoughness: .95 }));
      spine.rotation.y = -Math.PI / 2;
      spine.position.x = -CASE.width / 2 - .001;
      spine.receiveShadow = true;
      group.add(spine);

      const backTexture = canvasTexture(300, 450, (ctx, w, h) => {
        ctx.fillStyle = '#1d2835';
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = '#e3e7e8';
        ctx.font = 'bold 26px Arial';
        titleLines(ctx, game.name, 258, 21, 44, 34, 4);
        ctx.fillStyle = game.color || '#4c6575';
        ctx.fillRect(20, 183, 260, 89);
        ctx.fillStyle = '#8f9aa7';
        for (let i = 0; i < 7; i++) ctx.fillRect(20, 294 + i * 12, i % 3 === 2 ? 180 : 260, 3);
        ctx.fillStyle = '#eeeede';
        ctx.fillRect(20, 396, 101, 32);
        ctx.fillStyle = '#15202b';
        for (let i = 0; i < 30; i++) ctx.fillRect(24 + i * 3, 399, i % 3 ? 1 : 2, 26);
        ctx.fillStyle = '#ccd3da';
        ctx.font = '13px Arial';
        ctx.fillText(`APP ${game.appid}`, 144, 419);
      });
      const back = new THREE.Mesh(frontGeometry, new THREE.MeshStandardMaterial({ map: backTexture, roughness: .72 }));
      back.position.z = -CASE.depth / 2 - .002;
      back.rotation.y = Math.PI;
      group.add(back);
      for (const y of [-CASE.height / 2 + .023, CASE.height / 2 - .023]) {
        box(group, CASE.width - .07, .018, CASE.depth - .026, 0, y, 0, caseRim, .006, false);
        box(group, CASE.width - .09, .007, .009, 0, y + .009, .006, seamMat, 0, false);
      }
      box(group, .011, CASE.height - .09, .009, CASE.width / 2 + .002, 0, .004, seamMat, 0, false);
      for (const y of [-.77, -.1, .77]) box(group, .028, .21, .065, -CASE.width / 2 + .006, y, -.023, caseRim, .009, false);
      for (const x of [-CASE.width / 2 + .026, CASE.width / 2 - .026]) box(group, .012, CASE.height - .04, .012, x, 0, CASE.depth / 2 + .005, caseRim, .004, false);

      const highlight = new THREE.Mesh(bodyGeometry, highlightMat);
      highlight.scale.set(1.035, 1.025, 1.16);
      highlight.renderOrder = 12;
      highlight.visible = false;
      group.add(highlight);
      group.traverse(node => {
        if (node.isMesh && node !== highlight) {
          node.userData.appid = game.appid;
          picks.push(node);
        }
      });
      rack.add(group);

      const contact = new THREE.Mesh(new THREE.PlaneGeometry((type === 'stack' ? CASE.height : CASE.width) + .2, type === 'stack' ? CASE.width + .1 : .62), shadowMat);
      contact.rotation.x = -Math.PI / 2;
      contact.position.set(entry.x, layout.shelfYs[entry.row] + RACK.shelfTopOffset + .003, entry.z);
      rack.add(contact);
      const book = {
        game, group, base: group.position.clone(), baseRotation: entry.ry, type, contact, highlight,
        active: false, pull: 0, phase: 'idle',
      };
      books.push(book);
      bookById.set(game.appid, book);
    }

    let decorBounds=null;
    const decor=addCollectionDecor({rack,layout,alive:()=>live,invalidate,onBoundsChange:bounds=>{decorBounds=bounds;if(state)fitHome(false);}});

    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    function hit(event) {
      const rect = canvas.getBoundingClientRect();
      pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
      raycaster.setFromCamera(pointer, camera);
      const hits=[
        ...raycaster.intersectObjects(picks,false).map(intersection=>({distance:intersection.distance,game:intersection.object.userData.appid,decor:null})),
        ...raycaster.intersectObject(decor.group,true).map(intersection=>({distance:intersection.distance,game:null,decor:decorItemForObject(intersection.object)})),
      ].filter(result=>result.game!==null||result.decor).sort((a,b)=>a.distance-b.distance||(a.game!==null?-1:1));
      return hits[0]??{game:null,decor:null};
    }
    const setHover = (id,decorItem=null) => {
      const decorKey=decorItem?`${decorItem.kind}:${decorItem.finish??''}`:null;
      if (id === hoverId&&decorKey===hoverDecorKey) return;
      hoverId = id;
      hoverDecorKey=decorKey;
      callbacks.current.onHover?.(gameById.get(id) || decorItem || null);
      invalidate();
    };
    const setTarget = id => {
      if (id === targetId) return;
      if (targetId !== null) bookById.get(targetId)?.highlight && (bookById.get(targetId).highlight.visible = false);
      targetId = id;
      if (targetId !== null) bookById.get(targetId)?.highlight && (bookById.get(targetId).highlight.visible = true);
      invalidate();
    };
    const pointerDown = event => {
      const result=hit(event);
      const source = result.game;
      const casePointer = callbacks.current.editMode && source !== null;
      down = { x: event.clientX, y: event.clientY, moved: false, pointerId: event.pointerId, source, decor:callbacks.current.editMode?null:result.decor, casePointer };
      if (casePointer) {
        event.preventDefault();
        event.stopImmediatePropagation();
        canvas.setPointerCapture?.(event.pointerId);
      }
    };
    const move = event => {
      if (down?.casePointer) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!down.moved && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5) {
          down.moved = true;
          controls.enabled = false;
          setHover(null);
        }
        if (down.moved) {
          const over = hit(event).game;
          setTarget(over !== down.source ? over : null);
          canvas.style.cursor = over !== null && over !== down.source ? 'copy' : 'grabbing';
        }
        return;
      }
      if (down && Math.hypot(event.clientX - down.x, event.clientY - down.y) > 5) down.moved = true;
      const result=hit(event);
      const id = result.game;
      const decorItem=!callbacks.current.editMode&&id===null?result.decor:null;
      setHover(id,decorItem);
      canvas.title=decorItem?t('点击 360° 查看{0}',t(decorItem.name??'摆件')):'';
      canvas.style.cursor = id !== null ? (callbacks.current.editMode ? 'grab' : 'pointer') : decorItem ? 'pointer' : 'grab';
    };
    const finishPointer = event => {
      if (!down) return;
      if (down.casePointer) {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (down.moved) {
          const over = hit(event).game;
          if (over !== null && over !== down.source) callbacks.current.onSwap?.(down.source, over);
        } else {
          const game = gameById.get(down.source);
          if (game) callbacks.current.onSelect?.(game);
        }
        canvas.releasePointerCapture?.(down.pointerId);
      } else if (!down.moved && Math.hypot(event.clientX - down.x, event.clientY - down.y) <= 5) {
        const result=hit(event);
        const game = gameById.get(result.game);
        if (game) callbacks.current.onSelect?.(game);
        else if(!callbacks.current.editMode&&result.decor)callbacks.current.onDecorSelect?.({...result.decor});
      }
      controls.enabled = true;
      down = null;
      setTarget(null);
      canvas.style.cursor = 'grab';
    };
    const cancelPointer = event => {
      if (down?.casePointer) event.stopImmediatePropagation();
      controls.enabled = true;
      down = null;
      setTarget(null);
      setHover(null);
      canvas.title='';
      canvas.style.cursor = 'grab';
    };
    canvas.addEventListener('pointerdown', pointerDown, true);
    canvas.addEventListener('pointermove', move, true);
    canvas.addEventListener('pointerup', finishPointer, true);
    canvas.addEventListener('pointercancel', cancelPointer, true);
    canvas.addEventListener('pointerleave', cancelPointer, true);

    let homeDistance = 20;
    const viewTarget = new THREE.Vector3(0, -.1, (RACK.backZ + RACK.frontZ) / 2);
    const spherical = new THREE.Spherical();
    const defaultView = () => {
      const direction = new THREE.Vector3(angle === 'front' ? 0 : .185, angle === 'front' ? .025 : .185, 1).normalize();
      spherical.setFromVector3(direction);
      return { azimuth: spherical.theta, polar: spherical.phi, distanceRatio: 1 };
    };
    const readView = () => {
      spherical.setFromVector3(camera.position.clone().sub(controls.target));
      return clampView({ azimuth: spherical.theta, polar: spherical.phi, distanceRatio: spherical.radius / Math.max(homeDistance, .001) });
    };
    const reportView = () => {
      if (suppressViewReport || !homeDistance) return;
      savedView.current = readView();
      clearTimeout(viewTimer);
      viewTimer = setTimeout(() => callbacks.current.onViewChange?.(savedView.current), 220);
    };
    const applyView = view => {
      const next = clampView(validView(view) ? view : defaultView());
      controls.target.copy(viewTarget);
      camera.position.copy(viewTarget).add(new THREE.Vector3().setFromSpherical(new THREE.Spherical(homeDistance * next.distanceRatio, next.polar, next.azimuth)));
      camera.lookAt(viewTarget);
      controls.update();
      savedView.current = next;
      invalidate();
    };
    function calculateHomeDistance() {
      controls.target.copy(viewTarget);
      const corners = [];
      for (const x of [-half - .28, half + .28]) for (const y of [bounds.bottom - .1, bounds.top + .42]) for (const z of [RACK.wallZ - .04, RACK.frontZ + .72]) corners.push(new THREE.Vector3(x, y, z));
      if(decorBounds&&!decorBounds.isEmpty())for(const x of [decorBounds.min.x,decorBounds.max.x])for(const y of [decorBounds.min.y,decorBounds.max.y])for(const z of [decorBounds.min.z,decorBounds.max.z])corners.push(new THREE.Vector3(x,y,z));
      const reference = defaultView();
      const direction = new THREE.Vector3().setFromSpherical(new THREE.Spherical(1, reference.polar, reference.azimuth));
      let near = 7;
      let far = 90;
      for (let i = 0; i < 22; i++) {
        const distance = (near + far) / 2;
        camera.position.copy(viewTarget).addScaledVector(direction, distance);
        camera.lookAt(viewTarget);
        camera.updateMatrixWorld();
        const overflow = corners.some(corner => {
          const point = corner.clone().project(camera);
          return Math.abs(point.x) > .985 || Math.abs(point.y) > .965;
        });
        if (overflow) near = distance;
        else far = distance;
      }
      homeDistance = far;
      controls.minDistance = Math.max(6.5, far * .42);
      controls.maxDistance = far * 1.5;
    }
    function fitHome(reset = true) {
      suppressViewReport = true;
      calculateHomeDistance();
      applyView(reset ? defaultView() : savedView.current);
      suppressViewReport = false;
      if (reset) reportView();
    }
    const controlsChanged = () => {
      invalidate();
      reportView();
    };
    controls.addEventListener('change', controlsChanged);
    controls.addEventListener('start', invalidate);

    let previousWidth = 0;
    let previousHeight = 0;
    const resize = new ResizeObserver(() => {
      const rect = container.getBoundingClientRect();
      if (!rect.width || !rect.height || (rect.width === previousWidth && rect.height === previousHeight)) return;
      previousWidth = rect.width;
      previousHeight = rect.height;
      renderer.setSize(rect.width, rect.height);
      camera.aspect = rect.width / rect.height;
      camera.updateProjectionMatrix();
      fitHome(false);
    });
    resize.observe(container);

    state = {
      renderer, scene, camera, books, selected,
      reset() { savedView.current = null; fitHome(true); },
      zoom(amount) {
        const direction = camera.position.clone().sub(controls.target);
        const distance = THREE.MathUtils.clamp(direction.length() * amount, controls.minDistance, controls.maxDistance);
        camera.position.copy(controls.target).add(direction.normalize().multiplyScalar(distance));
        controls.update();
        reportView();
        invalidate();
      },
      invalidate,
    };
    engine.current = state;

    animate = now => {
      frame = null;
      if (!live || document.hidden) return;
      const dt = Math.min(Math.max((now - lastTime) / 1000, 1 / 120), .05);
      lastTime = now;
      const cameraMoving = controls.update();
      let moving = false;
      for (const book of books) {
        const active = book.game.appid === state.selected;
        const hovered = book.game.appid === hoverId;
        if (active !== book.active) {
          book.active = active;
          book.phase = active ? 'pull1' : 'return1';
        }
        let targetPull = book.pull;
        let speed = 14;
        if (book.phase === 'pull1') {
          targetPull = .38;
          speed = 18;
          if (Math.abs(book.pull - targetPull) < .018) book.phase = 'pull2';
        } else if (book.phase === 'pull2') {
          targetPull = 1;
          speed = 10;
          if (Math.abs(book.pull - 1) < .002) book.phase = 'idle';
        } else if (book.phase === 'return1') {
          targetPull = .42;
          speed = 17;
          if (book.pull < .44) book.phase = 'return2';
        } else if (book.phase === 'return2') {
          targetPull = 0;
          speed = 11;
          if (book.pull < .002) { book.pull = 0; book.phase = 'idle'; }
        } else targetPull = active ? 1 : 0;

        const factor = reducedMotion ? 1 : 1 - Math.exp(-dt * speed);
        book.pull = THREE.MathUtils.lerp(book.pull, targetPull, factor);
        const selectedZ = book.type === 'stack' ? RACK.frontZ + .72 : RACK.frontZ + 1.08;
        const hoverLift = !active && hovered ? .17 : 0;
        const targetZ = THREE.MathUtils.lerp(book.base.z, selectedZ, book.pull) + hoverLift * (1 - book.pull);
        const reveal = THREE.MathUtils.smoothstep(book.pull, .28, .95);
        const targetRotation = book.type === 'stack' ? book.baseRotation : THREE.MathUtils.lerp(book.baseRotation, -.04, reveal);
        const targetY = book.base.y + book.pull * (book.type === 'stack' ? .08 : .045);
        const unsettled = book.phase !== 'idle' || Math.abs(book.group.position.z - targetZ) > .0005 || Math.abs(book.group.rotation.y - targetRotation) > .0005 || Math.abs(book.group.position.y - targetY) > .0005;
        if (unsettled) {
          book.group.position.z = THREE.MathUtils.lerp(book.group.position.z, targetZ, factor);
          book.group.position.y = THREE.MathUtils.lerp(book.group.position.y, targetY, factor);
          book.group.rotation.y = THREE.MathUtils.lerp(book.group.rotation.y, targetRotation, factor);
          moving = true;
        }
        book.contact.visible = book.pull < .16;
      }
      if (dirty || moving || cameraMoving) {
        renderer.render(scene, camera);
        dirty = false;
      }
      if ((moving || cameraMoving) && frame === null) frame = requestAnimationFrame(animate);
    };

    const visibility = () => { lastTime = performance.now(); invalidate(); };
    document.addEventListener('visibilitychange', visibility);
    suppressViewReport = true;
    calculateHomeDistance();
    applyView(savedView.current);
    suppressViewReport = false;
    invalidate();

    return () => {
      if (lastAngle.current === angle && validView(readView())) savedView.current = readView();
      live = false;
      if (frame !== null) cancelAnimationFrame(frame);
      clearTimeout(viewTimer);
      resize.disconnect();
      controls.dispose();
      document.removeEventListener('visibilitychange', visibility);
      canvas.removeEventListener('pointerdown', pointerDown, true);
      canvas.removeEventListener('pointermove', move, true);
      canvas.removeEventListener('pointerup', finishPointer, true);
      canvas.removeEventListener('pointercancel', cancelPointer, true);
      canvas.removeEventListener('pointerleave', cancelPointer, true);
      const geometries = new Set([bodyGeometry, frontGeometry, spineGeometry, screwGeometry]);
      const materials = new Set([metal, backMat, dark, boltMat, caseMat, caseRim, seamMat, roomWallMat, roomFloorMat, warmGlow, shadowMat, highlightMat]);
      const textures = new Set([filmNormal, shadowTexture, ...labelTextures,...roomMaterials.textures]);
      scene.traverse(node => {
        if (node.geometry) geometries.add(node.geometry);
        if (node.material) for (const material of Array.isArray(node.material) ? node.material : [node.material]) {
          materials.add(material);
          for (const value of Object.values(material)) if (value?.isTexture) textures.add(value);
        }
      });
      textures.forEach(texture => {texture.dispose();texture.source?.data?.close?.();});
      materials.forEach(material => material.dispose());
      geometries.forEach(geometry => geometry.dispose());
      envTarget.dispose();
      key.shadow.dispose();
      renderer.renderLists.dispose();
      renderer.dispose();
      if (canvas.parentNode === container) container.removeChild(canvas);
      if (engine.current === state) engine.current = null;
    };
  }, [games, theme, angle, reducedMotion, coverRevision, placementKey, labelKey, locale]);

  useEffect(() => {
    if (engine.current) {
      engine.current.selected = selected;
      engine.current.invalidate();
    }
  }, [selected]);

  return <div className="scene-canvas" ref={host}>{error && <div className="webgl-error"><strong>{t("当前设备无法启用 3D")}</strong><p>{t("请使用右上角的平面视图浏览，或在系统设置中启用硬件加速。")}</p></div>}</div>;
});

export default ShelfScene;
