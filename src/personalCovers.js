let opening;
function database() {
  opening ||= new Promise((resolve,reject)=>{
    const request=indexedDB.open('steam-shelf-personal',1);
    request.onupgradeneeded=()=>request.result.createObjectStore('covers');
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(new Error('无法打开封面存储，请检查磁盘空间。'));
  }).catch(error=>{opening=null;throw error;});
  return opening;
}
async function transaction(mode, action) {
  const db=await database();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('covers',mode), request=action(tx.objectStore('covers'));
    let result;
    request.onsuccess=()=>{result=request.result;};
    tx.oncomplete=()=>resolve(result);
    tx.onerror=tx.onabort=()=>reject(new Error('封面保存失败，请检查可用存储空间。'));
  });
}
export const getCustomCover = id => transaction('readonly',store=>store.get(Number(id)));
export const removeCustomCover = id => transaction('readwrite',store=>store.delete(Number(id)));
export function validCustomCover(value) { return typeof value==='string' && value.length<5*1024*1024 && /^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/=\r\n]+$/.test(value); }
export async function saveCustomCover(id,data) {
  if(!validCustomCover(data))throw new Error('封面图片无效或过大。');
  await transaction('readwrite',store=>store.put(data,Number(id)));
}
export async function exportCustomCovers(ids) {
  const values=await Promise.all(ids.map(async id=>[id,await getCustomCover(id)]));
  return Object.fromEntries(values.filter(([,data])=>validCustomCover(data)));
}
export async function importCustomCovers(values,ids) {
  if(!values || typeof values!=='object')return;
  const allowed=new Set(ids.map(String));
  const entries=Object.entries(values).filter(([id,data])=>allowed.has(id)&&validCustomCover(data));
  for(const [,data] of entries){const image=await decode(data);if(image.width*image.height>60000000)throw new Error('备份中的封面尺寸过大。');}
  const db=await database();
  await new Promise((resolve,reject)=>{const tx=db.transaction('covers','readwrite'),store=tx.objectStore('covers'),incoming=new Set(entries.map(([id])=>id));for(const id of allowed)if(!incoming.has(id))store.delete(Number(id));for(const [id,data] of entries)store.put(data,Number(id));tx.oncomplete=resolve;tx.onerror=tx.onabort=()=>reject(new Error('封面备份恢复失败。'));});
}
function decode(src) { return new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=()=>reject(new Error('图片无法解码。'));image.src=src;}); }
export async function prepareCover(file) {
  if(!file || !['image/jpeg','image/png','image/webp'].includes(file.type))throw new Error('请选择 JPG、PNG 或 WebP 图片。');
  if(file.size>12*1024*1024)throw new Error('请选择小于12 MB的图片。');
  const url=URL.createObjectURL(file);
  try {
    const image=await decode(url);
    if(image.width<100||image.height<100||image.width*image.height>60000000)throw new Error('请选择尺寸至少100像素、总像素不超过6000万的图片。');
    const ratio=Math.min(1,1200/image.width,1800/image.height), canvas=document.createElement('canvas');
    canvas.width=Math.round(image.width*ratio);canvas.height=Math.round(image.height*ratio);
    canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
    return canvas.toDataURL('image/jpeg',.92);
  } finally {URL.revokeObjectURL(url);}
}
