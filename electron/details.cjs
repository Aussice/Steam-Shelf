const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const folder=path.join(process.env.LOCALAPPDATA || path.join(os.homedir(),'.cache'),'Steam Shelf','details');
const inFlight=new Map();
function plainText(value,max=1800) {
  return String(value||'').replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'').replace(/<br\s*\/?\s*>|<\/p>/gi,'\n').replace(/<[^>]*>/g,' ').replace(/&(?:amp|quot|apos|lt|gt|nbsp);/g,s=>({'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>','&nbsp;':' '})[s]).replace(/&#(x[\da-f]+|\d+);/gi,(_,n)=>{const point=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return point>0&&point<=0x10ffff?String.fromCodePoint(point):'';}).replace(/[ \t]+/g,' ').trim().slice(0,max);
}
function normalizeDetails(data,appid) {
  return {appid:Number(appid),description:plainText(data.short_description || data.about_the_game),releaseDate:plainText(data.release_date?.date,80),comingSoon:data.release_date?.coming_soon===true,developers:(data.developers||[]).slice(0,5).map(v=>plainText(v,100)),publishers:(data.publishers||[]).slice(0,5).map(v=>plainText(v,100)),genres:(data.genres||[]).slice(0,8).map(v=>plainText(v.description,60)),fetchedAt:Date.now()};
}
async function gameDetails(appid, locale = 'zh') {
  if(!/^\d{1,10}$/.test(String(appid))||Number(appid)<1||Number(appid)>4294967295)throw new Error('无效的游戏 ID');
  const id=Number(appid), language=locale==='en'?'english':'schinese', cacheKey=`${id}-${language}`, file=path.join(folder,cacheKey+'.json');
  if(inFlight.has(cacheKey))return inFlight.get(cacheKey);
  const promise=(async()=>{
    let cached;try{cached=JSON.parse(await fs.readFile(file,'utf8'));if(cached.appid===id&&Date.now()-cached.fetchedAt<7*86400000)return cached;}catch{}
    try{
      const response=await fetch(`https://store.steampowered.com/api/appdetails?appids=${id}&l=${language}`,{signal:AbortSignal.timeout(10000),redirect:'error'});
      if(!response.ok)throw new Error();
      const text=await response.text();if(text.length>2000000)throw new Error();
      const entry=JSON.parse(text)[id];if(!entry?.success||!entry.data)throw new Error();
      const result=normalizeDetails(entry.data,id);await fs.mkdir(folder,{recursive:true});await fs.writeFile(file,JSON.stringify(result));return result;
    }catch{if(cached?.appid===id)return cached;throw new Error('暂时无法获取商店简介，基本信息仍可查看。');}
  })().finally(()=>inFlight.delete(cacheKey));inFlight.set(cacheKey,promise);return promise;
}
module.exports={gameDetails,normalizeDetails,plainText};
