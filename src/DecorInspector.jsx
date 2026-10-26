import { t } from './i18n.js';
import { useLocale } from './useLocale.js';
import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ArrowLeft, Move, RefreshCw, Rotate3D, RotateCcw } from 'lucide-react';
import { createSteamAward } from './steamAward.js';
import { disposeDecorObject, loadDecorModel } from './collectionDecor.js';

const FINISH_NAMES={gold:'金色',silver:'银色',bronze:'铜色'};

export default function DecorInspector({item,onClose,reducedMotion=false}) {
  const locale=useLocale();
  const host=useRef(null),dialog=useRef(null),engine=useRef(null),onCloseRef=useRef(onClose),automaticRef=useRef(!reducedMotion);
  const [automatic,setAutomatic]=useState(()=>!reducedMotion);
  const [status,setStatus]=useState('loading');
  const [error,setError]=useState('');
  const [revision,setRevision]=useState(0);
  const finish=Object.hasOwn(FINISH_NAMES,item?.finish)?item.finish:'gold';
  const itemKey=`${item?.kind??'unknown'}:${finish}`;
  const isAward=item?.kind==='award';
  const title=t(item?.name)||(isAward?t('{0} Steam 奖杯',t(FINISH_NAMES[finish])):t('PS5 DualSense 手柄'));
  onCloseRef.current=onClose;
  automaticRef.current=automatic;

  useEffect(()=>{
    const previous=document.activeElement;
    const node=dialog.current;
    const focusable=()=>[...node.querySelectorAll('button:not(:disabled),a[href],[tabindex]:not([tabindex="-1"])')].filter(element=>element.getClientRects().length>0);
    focusable()[0]?.focus();
    const keys=event=>{
      if(event.key==='Escape'){event.preventDefault();onCloseRef.current?.();return;}
      if(event.key!=='Tab')return;
      const elements=focusable();if(!elements.length)return;
      const first=elements[0],last=elements.at(-1);
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    };
    node.addEventListener('keydown',keys);
    return()=>{
      node.removeEventListener('keydown',keys);
      const target=previous?.getClientRects?.().length?previous:previous?.closest?.('details')?.querySelector('summary');
      target?.focus?.();
    };
  },[]);

  useEffect(()=>{if(reducedMotion)setAutomatic(false);},[reducedMotion,itemKey]);

  useEffect(()=>{
    const container=host.current;if(!container)return undefined;
    let renderer;
    try{renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});}
    catch{setStatus('error');setError('当前设备无法启用 3D 查看。');return undefined;}
    let live=true,frame=null,animate,content=null,homeDistance=4,sized=false;
    setStatus('loading');setError('');
    renderer.setPixelRatio(Math.min(Math.max(window.devicePixelRatio||1,2),2.5));
    renderer.outputColorSpace=THREE.SRGBColorSpace;
    renderer.toneMapping=THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure=1.06;
    const canvas=renderer.domElement;
    canvas.style.touchAction='none';
    canvas.setAttribute('aria-label',t('拖动可从任意方向 360 度查看{0}',title));
    container.appendChild(canvas);

    const scene=new THREE.Scene();
    const camera=new THREE.PerspectiveCamera(34,1,.01,100);
    const environment=new RoomEnvironment();
    const pmrem=new THREE.PMREMGenerator(renderer);
    const env=pmrem.fromScene(environment,.08);
    scene.environment=env.texture;scene.environmentIntensity=.48;
    environment.dispose();pmrem.dispose();
    scene.add(new THREE.HemisphereLight('#e2eeff','#55514b',1.25));
    const key=new THREE.DirectionalLight('#fff5e6',2.7);key.position.set(-3,6,7);scene.add(key);
    const fill=new THREE.DirectionalLight('#a9cfff',1.15);fill.position.set(5,2,-4);scene.add(fill);
    const rim=new THREE.DirectionalLight('#dce9ff',.7);rim.position.set(-4,1,-5);scene.add(rim);

    const controls=new OrbitControls(camera,canvas);
    controls.enableDamping=!reducedMotion;controls.dampingFactor=.09;controls.enablePan=false;
    controls.minPolarAngle=.01;controls.maxPolarAngle=Math.PI-.01;controls.rotateSpeed=.65;controls.zoomSpeed=.8;
    controls.autoRotate=automaticRef.current&&!reducedMotion;controls.autoRotateSpeed=1.1;
    let dirty=true;
    const invalidate=()=>{dirty=true;if(live&&frame===null&&animate&&!document.hidden)frame=requestAnimationFrame(animate);};
    controls.addEventListener('change',invalidate);

    const direction=()=>new THREE.Vector3(isAward ? 1.05 : 1.25,isAward ? .42 : 1.0,isAward ? 2 : 1.55).normalize();
    function measureAndFit() {
      if(!content)return;
      content.updateMatrixWorld(true);
      const bounds=new THREE.Box3().setFromObject(content,true);
      const size=bounds.getSize(new THREE.Vector3());
      const vertical=THREE.MathUtils.degToRad(camera.fov);
      const horizontal=2*Math.atan(Math.tan(vertical/2)*Math.max(camera.aspect,.01));
      homeDistance=(Math.max(size.y/(2*Math.tan(vertical/2)),size.x/(2*Math.tan(horizontal/2)))+size.z/2)*1.32;
      const longest=Math.max(size.x,size.y,size.z,.01);
      controls.minDistance=Math.max(longest*.62,homeDistance*.38);
      controls.maxDistance=Math.max(longest*8,homeDistance*3.5);
      camera.near=Math.max(.005,homeDistance/200);camera.far=Math.max(40,homeDistance*30);camera.updateProjectionMatrix();
    }
    function resetView() {
      if(!content)return;
      controls.target.set(0,0,0);camera.position.copy(direction().multiplyScalar(homeDistance));
      camera.lookAt(controls.target);controls.update();invalidate();
    }
    function attach(object) {
      content=object;scene.add(content);content.updateMatrixWorld(true);
      const center=new THREE.Box3().setFromObject(content,true).getCenter(new THREE.Vector3());
      content.position.sub(center);content.updateMatrixWorld(true);
      measureAndFit();resetView();setStatus('ready');
    }

    const resize=new ResizeObserver(()=>{
      const rect=container.getBoundingClientRect();if(!rect.width||!rect.height)return;
      const offset=camera.position.clone().sub(controls.target),previousDistance=homeDistance;
      renderer.setSize(rect.width,rect.height);camera.aspect=rect.width/rect.height;camera.updateProjectionMatrix();
      if(content){measureAndFit();if(!sized)resetView();else{camera.position.copy(controls.target).add(offset.multiplyScalar(homeDistance/Math.max(previousDistance,.001)));controls.update();invalidate();}}
      sized=true;
    });
    resize.observe(container);
    engine.current={controls,reset:resetView,invalidate};

    (async()=>{
      try{
        let object;
        if(item?.kind==='gamepad'){
          const source=await loadDecorModel('gamepad');
          if(!live){disposeDecorObject(source);return;}
          object=new THREE.Group();object.name='dualsense-inspector-pose';object.rotation.x=-Math.PI/2;object.add(source);
        }else if(isAward)object=createSteamAward({finish,height:2,name:`steam-award-${finish}-inspector`});
        else throw new Error('Unknown display item');
        if(!live){disposeDecorObject(object);return;}
        attach(object);
      }catch(loadError){if(live){setStatus('error');setError('无法载入这个 3D 摆件。');console.warn('[DecorInspector] Display item failed to load.',loadError);}}
    })();

    animate=()=>{
      frame=null;if(!live||document.hidden)return;
      const moved=controls.update();
      if(dirty||moved||controls.autoRotate){renderer.render(scene,camera);dirty=false;}
      if((moved||controls.autoRotate)&&frame===null)frame=requestAnimationFrame(animate);
    };
    const visibility=()=>{if(!document.hidden)invalidate();};
    document.addEventListener('visibilitychange',visibility);
    invalidate();
    return()=>{
      live=false;if(frame!==null)cancelAnimationFrame(frame);resize.disconnect();controls.dispose();document.removeEventListener('visibilitychange',visibility);
      if(content)disposeDecorObject(content);
      env.dispose();renderer.renderLists.dispose();renderer.dispose();if(canvas.parentNode===container)container.removeChild(canvas);if(engine.current?.controls===controls)engine.current=null;
    };
  },[itemKey,revision,reducedMotion,locale]);

  useEffect(()=>{
    const current=engine.current;if(!current)return;
    current.controls.autoRotate=automatic&&!reducedMotion;current.invalidate();
  },[automatic,reducedMotion,status]);

  return <div className="inspector-overlay decor-inspector" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="decor-inspector-title">
    <div className="inspector-top"><span><Rotate3D size={18}/>{t("360° 查看摆件")}</span><button onClick={onClose}><ArrowLeft size={16}/>{t("返回书架")}</button></div>
    <div className="inspector-canvas">
      <div ref={host} style={{position:'absolute',inset:0}}/>
      {status==='loading'&&<div role="status" className="decor-loading">{t("正在载入 3D 摆件…")}</div>}
      {status==='error'&&<div role="alert" className="decor-loading decor-error"><span>{t(error)}<button onClick={()=>setRevision(value=>value+1)}><RefreshCw size={14}/>{t("重试")}</button></span></div>}
    </div>
    <div className="inspector-directions">
      <button disabled={status!=='ready'} onClick={()=>engine.current?.reset()}><Rotate3D size={14}/>{t("重置视角")}</button>
      <button disabled={reducedMotion||status!=='ready'} title={t(reducedMotion?'减少动态效果已开启':undefined)} aria-pressed={automatic&&!reducedMotion} onClick={()=>setAutomatic(value=>!value)}><RotateCcw size={14}/>{t(automatic&&!reducedMotion?'停止旋转':'自动旋转')}</button>
    </div>
    <aside className="inspector-info">
      <div className="eyebrow">{t("实体藏品")}</div><h2 id="decor-inspector-title">{t(title)}</h2>
      <p className="inspector-summary">{t(isAward?`${FINISH_NAMES[finish]}饰面 · Steam 收藏陈列`:'按键朝上陈列 · 完整现成模型')}</p>
      <p className="details-description">{t(isAward?'按实体奖杯参考重建的收藏室装饰，使用金属材质与 Steam 标志浮雕。':'书架上的同一款 DualSense 模型，可查看按键、摇杆、扳机与背壳细节。')}</p>
      <dl>{isAward?<><div><dt>{t("饰面")}</dt><dd>{t(FINISH_NAMES[finish])}</dd></div><div><dt>{t("标志轮廓")}</dt><dd>{t("Valve 官方 Steam SVG")}</dd></div></>:<><div><dt>{t("模型")}</dt><dd>PS5 DualSense</dd></div><div><dt>{t("展示方式")}</dt><dd>{t("完整 GLB 模型")}</dd></div></>}</dl>
      <p className="legal-note">{t(isAward?'Steam 标志轮廓来源于 Valve 官方 SVG。奖杯仅作收藏室陈列，不代表已获得任何 Steam 成就或官方奖项。':'模型作者：Taohid Animation · Creative Commons Attribution 4.0。PlayStation 与 DualSense 名称归 Sony 所有。')}</p>
      <div className="inspector-gesture"><Move size={14}/>{t("拖动旋转 · 滚轮缩放")}</div>
    </aside>
  </div>;
}
