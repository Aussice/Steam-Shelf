const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const path=require('node:path');
const {readModelAsset}=require('../electron/model-assets.cjs');

for(const name of ['gamepad'])test(`${name}: packaged model is a self-contained GLB with valid embedded images`,async()=>{
  const bytes=await fs.readFile(path.join(__dirname,'../public/models',name+'.glb'));
  assert.equal(bytes.readUInt32LE(0),0x46546c67);
  assert.equal(bytes.readUInt32LE(4),2);
  assert.equal(bytes.readUInt32LE(8),bytes.length);
  assert.equal(bytes.readUInt32LE(16),0x4e4f534a);
  const jsonLength=bytes.readUInt32LE(12),doc=JSON.parse(bytes.subarray(20,20+jsonLength).toString());
  const binHeader=20+jsonLength,binLength=bytes.readUInt32LE(binHeader);
  assert.equal(bytes.readUInt32LE(binHeader+4),0x004e4942);
  assert.equal(binHeader+8+binLength,bytes.length);
  assert.equal(doc.buffers.length,1);assert.equal(doc.buffers[0].uri,undefined);
  assert.ok(doc.buffers[0].byteLength<=binLength);
  for(const view of doc.bufferViews){assert.equal(view.buffer,0);assert.ok((view.byteOffset||0)+view.byteLength<=doc.buffers[0].byteLength);}
  for(const image of doc.images||[]){assert.equal(image.uri,undefined);assert.ok(doc.bufferViews[image.bufferView]);assert.match(image.mimeType,/^image\/(png|jpeg)$/);}
  assert.ok(doc.meshes.length>0);assert.ok(!doc.extensionsRequired?.some(name=>/draco|meshopt|basisu/i.test(name)));
  assert.equal(doc.asset.extras.title,'PS5 Controller');
  assert.match(doc.asset.extras.author,/Taohid Animation/);
  assert.match(doc.asset.extras.license,/CC-BY-4.0/);
});

test('native model reader rejects paths and names outside the bundled model allowlist',async()=>{
  for(const value of ['../package.json','constructor','__proto__','gamepad.glb','teddy',null,{}])await assert.rejects(readModelAsset(value),/无效/);
});
