const path=require('node:path');
const fs=require('node:fs/promises');
const files=Object.freeze({gamepad:'gamepad.glb'});
async function readModelAsset(name) {
  if(typeof name!=='string'||!Object.hasOwn(files,name))throw new Error('无效的摆件模型');
  const data=await fs.readFile(path.join(__dirname,'../dist/models',files[name]));
  if(data.length>12*1024*1024||data.length<20||data.readUInt32LE(0)!==0x46546c67)throw new Error('摆件模型文件无效');
  return data.toString('base64');
}
module.exports={readModelAsset};
