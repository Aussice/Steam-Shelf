import {test} from 'node:test';
import assert from 'node:assert/strict';
import {normalizePersonal,orderGames,swapOrder} from '../src/collectionState.js';
const games=[1,2,3,4].map(appid=>({appid}));
test('sound starts enabled, migrates the previous default, and preserves a new explicit preference',()=>{
 assert.equal(normalizePersonal().sound,true);
 assert.equal(normalizePersonal({sound:false}).sound,true);
 const muted=normalizePersonal({sound:false,soundPreferenceVersion:1});
 assert.equal(muted.sound,false);assert.equal(normalizePersonal(muted).sound,false);
 assert.equal(normalizePersonal({sound:true,soundPreferenceVersion:1}).sound,true);
});
test('personal shelf backup rejects invalid identities, modes, and non-finite camera values',()=>{
 const result=normalizePersonal({order:[1,'1',2,-1,'bad'],placements:{1:'front',2:'bad'},statuses:{1:'completed',2:'invented'},camera:{azimuth:Infinity,polar:1,distanceRatio:1},labels:['x'.repeat(40)]});
 assert.deepEqual(result.order,[1,2]);assert.deepEqual(result.placements,{'1':'front'});assert.deepEqual(result.statuses,{'1':'completed'});assert.equal(result.camera,null);assert.equal(result.labels[0].length,20);assert.doesNotThrow(()=>normalizePersonal(null));
});
test('drag swapping survives filtering and preserves every library entry once',()=>{
 const order=swapOrder(games,[],1,4);assert.deepEqual(order,[4,2,3,1]);assert.deepEqual(orderGames([games[0],games[3]],order).map(g=>g.appid),[4,1]);assert.deepEqual(swapOrder(games,order,1,999),order);assert.equal(new Set(order).size,4);
});
