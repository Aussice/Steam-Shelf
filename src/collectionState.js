export const STATUS = { unmarked: '未标记', backlog: '待玩', playing: '在玩', completed: '已通关', loved: '特别喜欢' };
export const DEFAULT_LABELS = ['我的最爱', '正在游玩', '等待启封'];
const idOK = id => /^\d{1,10}$/.test(String(id)) && Number(id) > 0 && Number(id) <= 4294967295;
export function normalizePersonal(value = {}) {
  if(!value||typeof value!=='object'||Array.isArray(value))value={};
  const order = [...new Set((Array.isArray(value.order) ? value.order : []).filter(idOK).map(Number))].slice(0, 20000);
  const placements = {}, statuses = {};
  for (const [id, mode] of Object.entries(value.placements || {})) if (idOK(id) && ['front','spine','stack'].includes(mode)) placements[id] = mode;
  for (const [id, status] of Object.entries(value.statuses || {})) if (idOK(id) && Object.hasOwn(STATUS, status) && status !== 'unmarked') statuses[id] = status;
  const labels = DEFAULT_LABELS.map((label,i) => String(value.labels?.[i] ?? label).trim().slice(0, 20));
  const camera = value.camera;
  const validCamera = camera && [camera.azimuth,camera.polar,camera.distanceRatio].every(Number.isFinite);
  return { order, placements, statuses, labels, sound: value.soundPreferenceVersion===1 ? value.sound!==false : true, soundPreferenceVersion:1,
    camera: validCamera ? { azimuth: Math.max(-.66,Math.min(.66,camera.azimuth)), polar: Math.max(1.03,Math.min(1.65,camera.polar)), distanceRatio: Math.max(.42,Math.min(1.5,camera.distanceRatio)) } : null };
}
export function orderGames(games, order = []) {
  const ranks = new Map(order.map((id,i) => [Number(id),i]));
  return games.map((game,i)=>({game,rank:ranks.get(game.appid) ?? order.length+i})).sort((a,b)=>a.rank-b.rank).map(item=>item.game);
}
export function swapOrder(games, order, source, target) {
  const ids = orderGames(games,order).map(game=>game.appid);
  const a = ids.indexOf(Number(source)), b = ids.indexOf(Number(target));
  if(a<0 || b<0 || a===b) return ids;
  [ids[a],ids[b]]=[ids[b],ids[a]];
  return ids;
}
