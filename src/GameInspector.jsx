import { t, gameTitle, dateLocale, errorText } from './i18n.js';
import { useLocale } from './useLocale.js';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ArrowLeft, RotateCcw, RefreshCw, Rotate3D, Move } from 'lucide-react';
import { caseArtwork, canvasTexture, titleLines } from './coverTextures';
import { CASE } from './shelfLayout';
import { clearCoverCache } from './library';
import { loadGameDetails } from './library';
import { STATUS } from './collectionState';
import { prepareCover, saveCustomCover, removeCustomCover, getCustomCover } from './personalCovers';
import { drawInformationBack } from './inspectorBack';

export default function GameInspector({ game, onClose, collectionStatus='unmarked', onStatusChange, onCoverChange }) {
  const locale = useLocale();
  const host = useRef(null), engine = useRef(null), dialog = useRef(null);
  const [revision, setRevision] = useState(0), [status, setStatus] = useState('loading'), [automatic, setAutomatic] = useState(false), [side, setSide] = useState('front');
  const [details,setDetails]=useState(null),[detailsError,setDetailsError]=useState(''),[detailsLoading,setDetailsLoading]=useState(true),[custom,setCustom]=useState(false),[coverBusy,setCoverBusy]=useState(false),[coverError,setCoverError]=useState('');
  const fileInput=useRef(null),detailsRef=useRef(null);
  detailsRef.current=details;
  useEffect(()=>{let live=true;setDetails(null);setDetailsLoading(true);loadGameDetails(game.appid, locale).then(value=>{if(live){setDetails(value);setDetailsError('');}}).catch(error=>{if(live)setDetailsError(error.message);}).finally(()=>{if(live)setDetailsLoading(false);});getCustomCover(game.appid).then(value=>{if(live)setCustom(!!value);}).catch(()=>{});return()=>{live=false;};},[game.appid,locale]);
  useEffect(()=>{engine.current?.updateBack(details);},[details]);
  useEffect(() => {
    const previous = document.activeElement; dialog.current.querySelector('button')?.focus();
    const keys = event => {
      if (event.key === 'Escape') onClose();
      if (event.key !== 'Tab') return;
      const buttons = [...dialog.current.querySelectorAll('button:not(:disabled),select,input:not([hidden])')];
      if (event.shiftKey && document.activeElement === buttons[0]) { event.preventDefault(); buttons.at(-1).focus(); }
      else if (!event.shiftKey && document.activeElement === buttons.at(-1)) { event.preventDefault(); buttons[0].focus(); }
    };
    const node = dialog.current; node.addEventListener('keydown', keys);
    return () => { node.removeEventListener('keydown', keys); previous?.focus?.(); };
  }, []);
  useEffect(() => {
    const container = host.current; if (!container) return;
    let live = true, frame = null, animate, dirty = true;
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(Math.max(devicePixelRatio, 2), 2.5)); renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.08;
    const canvas = renderer.domElement; canvas.style.touchAction = 'none'; canvas.setAttribute('aria-label', t('拖动可从任意方向 360 度查看游戏盒')); container.appendChild(canvas);
    const scene = new THREE.Scene(), camera = new THREE.PerspectiveCamera(34, 1, .1, 40);
    const environment = new RoomEnvironment(), pmrem = new THREE.PMREMGenerator(renderer), env = pmrem.fromScene(environment, .08);
    scene.environment = env.texture; scene.environmentIntensity = .35; environment.dispose(); pmrem.dispose();
    scene.add(new THREE.HemisphereLight('#e1edff', '#77736b', 1.1));
    const light = new THREE.DirectionalLight('#fff6e9', 2.3); light.position.set(-3, 5, 7); scene.add(light);
    const fill = new THREE.DirectionalLight('#b5d4ff', 1); fill.position.set(4, 2, -4); scene.add(fill);
    const controls = new OrbitControls(camera, canvas); controls.enableDamping = true; controls.dampingFactor = .1; controls.enablePan = false;
    controls.minPolarAngle = .1; controls.maxPolarAngle = Math.PI - .1; controls.minDistance = 2; controls.maxDistance = 9; controls.autoRotateSpeed = 1.1;
    const invalidate = () => { dirty = true; if (live && frame === null && animate) frame = requestAnimationFrame(animate); };
    controls.addEventListener('change', invalidate); controls.addEventListener('start', () => { setSide(null); invalidate(); });
    const box = new THREE.Group(); scene.add(box);
    const bodyMaterial = new THREE.MeshPhysicalMaterial({ color: '#1c2935', roughness: .46, clearcoat: .18, clearcoatRoughness: .7, metalness: .02 });
    box.add(new THREE.Mesh(new RoundedBoxGeometry(CASE.width, CASE.height, CASE.depth, 4, .025), bodyMaterial));
    setStatus('loading'); setSide('front');
    const artwork = caseArtwork(game, () => live, invalidate, renderer.capabilities.getMaxAnisotropy(), value => { if (live) { setStatus(value);engine.current?.updateBack(detailsRef.current); } });
    const front = new THREE.Mesh(new THREE.PlaneGeometry(CASE.width - .08, CASE.height - .08), new THREE.MeshStandardMaterial({ map: artwork.face, roughness: .98, metalness: 0, envMapIntensity: .08 }));
    front.position.z = CASE.depth / 2 + .003; box.add(front);
    const spine = new THREE.Mesh(new THREE.PlaneGeometry(CASE.depth - .02, CASE.height - .05), new THREE.MeshStandardMaterial({ map: artwork.spine, roughness: .98, metalness: 0 }));
    spine.rotation.y = -Math.PI / 2; spine.position.x = -CASE.width / 2 - .002; box.add(spine);
    const backTexture = canvasTexture(600,900,ctx=>drawInformationBack(ctx,game,detailsRef.current,artwork.face.image));
    function updateBack(info) { drawInformationBack(backTexture.image.getContext('2d'),game,info,artwork.face.image);backTexture.needsUpdate=true;invalidate(); }
    const back = new THREE.Mesh(new THREE.PlaneGeometry(CASE.width - .08, CASE.height - .08), new THREE.MeshStandardMaterial({ map: backTexture, roughness: .98 }));
    back.position.z = -CASE.depth / 2 - .003; back.rotation.y = Math.PI; box.add(back);
    for (const y of [-CASE.height / 2 + .027, CASE.height / 2 - .027]) {
      const seam = new THREE.Mesh(new THREE.BoxGeometry(CASE.width - .06, .012, .012), new THREE.MeshStandardMaterial({color:'#080e13',roughness:1})); seam.position.set(0,y,0); box.add(seam);
    }
    function view(which = 'front') {
      const distance = camera.aspect < .8 ? 5.8 : 4.7;
      camera.position.copy(({front:new THREE.Vector3(.28,.12,1),back:new THREE.Vector3(-.28,.12,-1),spine:new THREE.Vector3(-1,.12,.1)})[which].normalize().multiplyScalar(distance));
      controls.target.set(0,0,0); controls.update(); invalidate();
    }
    let sized=false;
    const resize = new ResizeObserver(() => {
      const r=container.getBoundingClientRect();if(!r.width||!r.height)return;
      const offset=camera.position.clone().sub(controls.target),previousBase=camera.aspect<.8?5.8:4.7;
      renderer.setSize(r.width,r.height);camera.aspect=r.width/r.height;camera.updateProjectionMatrix();
      if(!sized){view();sized=true;}else{camera.position.copy(controls.target).add(offset.multiplyScalar((camera.aspect<.8?5.8:4.7)/previousBase));controls.update();invalidate();}
    });resize.observe(container);
    engine.current = { view, controls, invalidate, updateBack };
    animate = () => { frame = null; if (!live) return; const moved = controls.update(); if (dirty || moved || controls.autoRotate) { renderer.render(scene,camera); dirty=false; } if ((moved || controls.autoRotate) && frame === null) frame=requestAnimationFrame(animate); };
    view(); invalidate();
    return () => {
      live=false; if(frame!==null)cancelAnimationFrame(frame);resize.disconnect();controls.dispose();
      const geometries=new Set(),materials=new Set(),textures=new Set();scene.traverse(n=>{if(n.geometry)geometries.add(n.geometry);if(n.material){materials.add(n.material);if(n.material.map)textures.add(n.material.map);}});
      geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());env.dispose();renderer.dispose();container.removeChild(canvas);engine.current=null;
    };
  }, [game.appid, revision, locale]);
  useEffect(() => { if (engine.current) { engine.current.controls.autoRotate=automatic;if(automatic)setSide(null); engine.current.invalidate(); } }, [automatic, revision, locale]);
  function retry() { clearCoverCache(game.appid); setRevision(v=>v+1); }
  async function customizeCover(file) { if(!file)return;setCoverBusy(true);setCoverError('');try{const data=await prepareCover(file);await saveCustomCover(game.appid,data);clearCoverCache(game.appid);setRevision(v=>v+1);setCustom(true);onCoverChange?.();}catch(error){setCoverError(error.message);}finally{setCoverBusy(false);if(fileInput.current)fileInput.current.value='';} }
  async function restoreCover() { setCoverBusy(true);try{await removeCustomCover(game.appid);clearCoverCache(game.appid);setRevision(v=>v+1);setCustom(false);setCoverError('');onCoverChange?.();}catch(error){setCoverError(error.message);}finally{setCoverBusy(false);} }
  return <div className="inspector-overlay" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="inspector-title">
    <div className="inspector-top"><span><Rotate3D size={18}/>{t("360° 查看")}</span><button onClick={onClose}><ArrowLeft size={16}/>{t("放回书架")}</button></div>
    <div className="inspector-canvas" ref={host}/>
    <div className="inspector-directions"><button aria-pressed={side==='front'} onClick={()=>{engine.current?.view('front');setSide('front');}}>{t("正面")}</button><button aria-pressed={side==='spine'} onClick={()=>{engine.current?.view('spine');setSide('spine');}}>{t("盒脊")}</button><button aria-pressed={side==='back'} onClick={()=>{engine.current?.view('back');setSide('back');}}>{t("背面")}</button><button aria-pressed={automatic} onClick={()=>setAutomatic(!automatic)}><RotateCcw size={14}/>{t(automatic?'停止旋转':'自动旋转')}</button></div>
    <aside className="inspector-info">
      <div className="eyebrow">{t("游戏详情")}</div><h2 id="inspector-title">{t(gameTitle(game))}</h2>{locale==='zh'&&game.subtitle&&<p className="inspector-english">{t(game.name)}</p>}
      <p className="inspector-summary">{t(game.genre)} · {t(game.installed?'已安装':'未安装')}</p>
      <p className="details-description">{t(details?.description || (detailsLoading?'正在获取游戏简介…':errorText(detailsError)||t('暂无游戏简介')))}</p>
      <dl><div><dt>{t("发行日期")}</dt><dd>{t(details?.releaseDate||(game.released?t('{0} 年',new Date(game.released*1000).getFullYear()):'暂无资料'))}</dd></div>{details?.developers?.length>0&&<div><dt>{t("开发者")}</dt><dd>{t(details.developers.join(' / '))}</dd></div>}<div><dt>{t("最近游玩")}</dt><dd>{t(game.lastPlayed?new Date(game.lastPlayed*1000).toLocaleDateString(dateLocale()):'暂无记录')}</dd></div><div><dt>{t("游玩时长")}</dt><dd>{t("{0} 小时",((game.playtime_forever||0)/60).toFixed(1))}</dd></div><div><dt>Steam AppID</dt><dd>{t(game.appid)}</dd></div></dl>
      <label className="inspector-status">{t("我的收藏状态")}<select aria-label={t("收藏状态")} value={collectionStatus} onChange={e=>onStatusChange?.(game.appid,e.target.value)}>{Object.entries(STATUS).map(([id,label])=><option key={id} value={id}>{t(label)}</option>)}</select></label>
      <div className="cover-custom-actions"><button disabled={coverBusy} onClick={()=>fileInput.current.click()}>{t(coverBusy?'正在保存…':custom?'更换自定义封面':'选择自定义封面')}</button>{custom&&<button disabled={coverBusy} onClick={restoreCover}>{t("恢复官方封面")}</button>}</div>
      <input ref={fileInput} type="file" hidden accept="image/jpeg,image/png,image/webp" onChange={e=>customizeCover(e.target.files[0])}/>
      {coverError&&<p className="cover-error" role="status">{errorText(coverError)}</p>}
      <div className="inspector-gesture"><Move size={14}/>{t("拖动旋转 · 滚轮缩放")}</div><button className="retry-artwork" onClick={retry}><RefreshCw size={13}/>{t(status==='loading'?'正在获取封面…':'重新加载封面')}</button>
    </aside>
  </div>;
}
