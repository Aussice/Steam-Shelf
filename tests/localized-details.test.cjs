const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');

test('Chinese and English store details use separate caches and concurrent requests',async()=>{
 const folder=await fs.mkdtemp(path.join(os.tmpdir(),'shelf-details-i18n-'));
 const previousRoot=process.env.LOCALAPPDATA,previousFetch=global.fetch;
 process.env.LOCALAPPDATA=folder;
 const {gameDetails}=require('../electron/details.cjs');
 const requests=[];
 global.fetch=async url=>{
  const language=new URL(url).searchParams.get('l');requests.push(language);
  return {ok:true,text:async()=>JSON.stringify({620:{success:true,data:{short_description:language==='english'?'English description':'中文简介',release_date:{date:language==='english'?'Apr 19, 2011':'2011 年 4 月 19 日'}}}})};
 };
 try {
  const [english,chinese,englishAgain]=await Promise.all([gameDetails(620,'en'),gameDetails(620,'zh'),gameDetails(620,'en')]);
  assert.equal(english.description,'English description');assert.equal(chinese.description,'中文简介');assert.deepEqual(englishAgain,english);
  assert.deepEqual(requests.sort(),['english','schinese']);
  assert.equal((await gameDetails(620,'en')).description,'English description');
  assert.equal((await gameDetails(620,'zh')).description,'中文简介');assert.equal(requests.length,2);
  assert.deepEqual((await fs.readdir(path.join(folder,'Steam Shelf','details'))).sort(),['620-english.json','620-schinese.json']);
 }finally {global.fetch=previousFetch;if(previousRoot===undefined)delete process.env.LOCALAPPDATA;else process.env.LOCALAPPDATA=previousRoot;await fs.rm(folder,{recursive:true,force:true});}
});
