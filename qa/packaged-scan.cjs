const path = require('node:path');
const packageRoot=path.resolve(__dirname,`../release/${require('../package.json').version}/win-unpacked/resources/app.asar`);
const steam = require(path.join(packageRoot,'electron/steam.cjs'));
(async () => {
  const result = await steam.scanLibrary();
  const version=require(path.join(packageRoot,'package.json')).version;
  const modelReader=require(path.join(packageRoot,'electron/model-assets.cjs'));
  const models=await Promise.all(['gamepad'].map(async name=>{
    const bytes=Buffer.from(await modelReader.readModelAsset(name),'base64');
    return {name,loaded:bytes.readUInt32LE(0)===0x46546c67&&bytes.readUInt32LE(8)===bytes.length,bytes:bytes.length};
  }));
  const fs=require('node:fs/promises');
  const materialFiles=await fs.readdir(path.join(packageRoot,'dist/materials'));
  const materials=materialFiles.filter(name=>name.endsWith('.jpg')).length;
  const details=await require(path.join(packageRoot,'electron/details.cjs')).gameDetails(620);
  const covers = await Promise.all([4108000, 1116580].map(async appid => {
    const cover = await steam.localCover(appid);
    return { appid, loaded: !!cover, bytes: cover?.length || 0 };
  }));
  console.log(JSON.stringify({ version, total: result.games.length, installed: result.installedCount, uninstalled: result.uninstalledCount, complete: result.complete, withReleaseDate:result.games.filter(game=>game.released>0).length, withLastPlayed:result.games.filter(game=>game.lastPlayed>0).length, storeDescription:!!details.description, covers,models,materials }));
  if (!result.complete || covers.some(cover => !cover.loaded)||models.some(model=>!model.loaded)||materials!==12) process.exitCode = 1;
})().catch(error => { console.error(error.message); process.exitCode = 1; });
