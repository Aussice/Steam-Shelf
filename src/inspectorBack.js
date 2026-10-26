import {t,gameTitle} from './i18n.js';
import { titleLines } from './coverTextures';
export function drawInformationBack(ctx,game,details,cover) {
  ctx.fillStyle='#13232e';ctx.fillRect(0,0,600,900);
  ctx.fillStyle='#bbd1c2';ctx.font='bold 17px Arial';ctx.fillText('STEAM · MY PERSONAL COLLECTION',34,44);
  ctx.fillStyle='#f0f2e9';ctx.font='bold 37px sans-serif';titleLines(ctx,gameTitle(game),530,34,105,46,3);
  if(cover)ctx.drawImage(cover,34,245,160,240);
  ctx.fillStyle='#92aea8';ctx.font='22px sans-serif';
  titleLines(ctx,t(game.genre),330,220,278,30,2);
  ctx.font='19px sans-serif';titleLines(ctx,details?.releaseDate|| (game.released?t('{0} 年发行',new Date(game.released*1000).getFullYear()):t('发行日期待补充')),330,220,362,28,2);
  titleLines(ctx,details?.developers?.join(' / ')||t('Steam 收藏'),330,220,419,27,2);
  ctx.fillStyle='#c4d1d4';ctx.font='23px sans-serif';titleLines(ctx,details?.description||t('把喜欢的游戏收藏在这里，随时开始下一场冒险。'),530,34,546,34,6);
  ctx.fillStyle='#73919b';ctx.fillRect(34,779,532,1);ctx.font='18px sans-serif';ctx.fillText(t('{0} · 游玩 {1} 小时',t(game.installed?'已安装':'未安装'),((game.playtime_forever||0)/60).toFixed(1)),34,818);
  ctx.font='15px Arial';ctx.fillText(`APP ${game.appid}  /  STEAM SHELF`,34,856);
}
