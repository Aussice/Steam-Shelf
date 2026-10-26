import * as THREE from 'three';
import { loadCoverImage } from './library.js';
import { drawSteamMark } from './steamLogo.js';
import { t, gameTitle } from './i18n.js';

export function canvasTexture(width, height, draw, color = true) {
  const canvas = document.createElement('canvas'); canvas.width = width; canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  if (color) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
export function titleLines(ctx, title, width, x, y, lineHeight, max = 4) {
  let line = ''; const lines = [];
  for (const word of String(title)) {
    if(word==='\n'){lines.push(line);line='';continue;}
    if (ctx.measureText(line + word).width > width && line) { lines.push(line); line = word.trimStart(); }
    else line += word;
  }
  if (line) lines.push(line);
  lines.slice(0, max).forEach((text, index) => ctx.fillText(index===max-1&&lines.length>max?text.slice(0,-1)+'…':text, x, y + index * lineHeight, width));
}
export function steamMark(ctx, x, y, radius, color = '#eff5fa') {
  drawSteamMark(ctx,x,y,radius,color);
}
export function paintFront(ctx, image, game, width = 600, height = 900) {
  ctx.fillStyle = '#17232c'; ctx.fillRect(0, 0, width, height);
  if (image.width / image.height < 1.1) ctx.drawImage(image, 0, 43, width, height - 43);
  else {
    ctx.save(); ctx.filter = 'blur(16px)'; ctx.globalAlpha = .3; ctx.drawImage(image, -30, 40, width + 60, height); ctx.restore();
    const h = width * image.height / image.width;
    ctx.drawImage(image, 0, 190, width, h);
    ctx.fillStyle = '#edf2f2'; ctx.font = 'bold 44px Arial'; titleLines(ctx, game.name, width - 64, 32, Math.min(190 + h + 85, 600), 55);
  }
  ctx.fillStyle = '#133d70'; ctx.fillRect(0, 0, width, 43); steamMark(ctx, 24, 21, 13);
  ctx.fillStyle = '#f4f7fa'; ctx.font = 'bold 21px Arial'; ctx.fillText('STEAM', 48, 29);
}
export function caseArtwork(game, alive, invalidate, anisotropy, onStatus) {
  let faceCtx, spineCtx;
  const drawSpine = image => {
    const c = spineCtx, palette=image?coverPalette(image):{background:game.color||'#3f5968',ink:'#f3efe5'};
    c.fillStyle = palette.background; c.fillRect(0, 0, 192, 1536);
    if (image) { c.globalAlpha = .24; c.drawImage(image, 0, 0, 192, 1536); c.globalAlpha = 1; }
    c.fillStyle = palette.background; c.globalAlpha=.77;c.fillRect(12,160,168,1170);c.globalAlpha=1;
    c.fillStyle = '#153b68'; c.fillRect(0, 0, 192, 152); steamMark(c, 96, 52, 30);
    c.fillStyle = '#eef4ff'; c.font = 'bold 26px Arial'; c.fillText('STEAM', 48, 119);
    c.save(); c.translate(87, 188); c.rotate(Math.PI / 2); c.fillStyle = palette.ink; c.font = 'bold 49px Arial'; c.fillText(String(gameTitle(game)).toUpperCase(), 0, 0, 1095); c.restore();
    c.fillStyle = palette.background; c.fillRect(0, 1350, 192, 186);
    c.fillStyle = '#f4f4eb'; c.fillRect(54, 1395, 84, 84); c.fillStyle = '#202932'; c.font = 'bold 38px Arial'; c.fillText('PC', 69, 1451);
  };
  const face = canvasTexture(600, 900, (c, w, h) => {
    faceCtx = c; const gradient = c.createLinearGradient(0, 0, w, h); gradient.addColorStop(0, game.color || '#3c5364'); gradient.addColorStop(1, '#151b25');
    c.fillStyle = gradient; c.fillRect(0, 0, w, h); c.fillStyle = '#f7f4e9'; c.font = 'bold 46px Arial'; titleLines(c, game.name, 500, 50, 340, 58);
    c.fillStyle = '#9baeb6'; c.font = '22px Arial'; c.fillText(t('正在加载封面…'), 50, 730);
  });
  const spine = canvasTexture(192, 1536, c => { spineCtx = c; drawSpine(); });
  for (const texture of [face, spine]) {
    texture.anisotropy = anisotropy;
    // Avoid blending adjacent low-resolution mip levels into a soft far image.
    texture.minFilter = THREE.LinearMipmapNearestFilter;
    texture.magFilter = THREE.LinearFilter;
  }
  loadCoverImage(game).then(image => {
    if (!alive()) return;
    paintFront(faceCtx, image, game); drawSpine(image); face.needsUpdate = spine.needsUpdate = true; onStatus?.('ready'); invalidate();
  }).catch(() => {
    if (!alive()) return;
    faceCtx.fillStyle = '#1b2c37'; faceCtx.fillRect(25, 680, 550, 90); faceCtx.fillStyle = '#a9bac0'; faceCtx.font = '22px Arial'; faceCtx.fillText(t('封面暂不可用 · 可点击重试'), 45, 731);
    face.needsUpdate = true; onStatus?.('failed'); invalidate();
  });
  return { face, spine };
}

function coverPalette(image) {
  try {
    const canvas=document.createElement('canvas');canvas.width=canvas.height=24;
    const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0,24,24);
    const pixels=ctx.getImageData(0,0,24,24).data, bins=new Map();
    for(let i=0;i<pixels.length;i+=4){const r=pixels[i],g=pixels[i+1],b=pixels[i+2],light=(r+g+b)/3;if(light<20||light>235)continue;const key=[r>>5,g>>5,b>>5].join(',');const v=bins.get(key)||{count:0,r:0,g:0,b:0};v.count++;v.r+=r;v.g+=g;v.b+=b;bins.set(key,v);}
    const best=[...bins.values()].sort((a,b)=>b.count-a.count)[0];if(!best)return {background:'#293d4b',ink:'#f3efe5'};
    const rgb=[best.r,best.g,best.b].map(v=>Math.round(v/best.count));
    return {background:`rgb(${rgb.join(',')})`,ink:rgb[0]*.299+rgb[1]*.587+rgb[2]*.114>150?'#171d23':'#f3efe5'};
  } catch {return {background:'#293d4b',ink:'#f3efe5'};}
}
