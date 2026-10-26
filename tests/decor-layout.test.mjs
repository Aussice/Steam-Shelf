import {test} from 'node:test';
import assert from 'node:assert/strict';
import {arrangeGames,RACK} from '../src/shelfLayout.js';
import {decorPositions} from '../src/collectionDecor.js';

test('a narrow filtered shelf separates the DualSense and awards and keeps props within the shallow shelf',()=>{
  for(const count of [1,2,3,4,5,6,24,72]){
    const layout=arrangeGames(Array.from({length:count},(_,i)=>({appid:600+i})));
    const {controller,awards,scale,insideController,insideAwards,row}=decorPositions(layout);
    const controllerLeft=controller.x-.93*scale,controllerRight=controller.x+.93*scale;
    const awardLeft=awards.x-1.18*scale,awardRight=awards.x+1.15*scale;
    assert.ok(controllerLeft>=-layout.width/2&&awardRight<=layout.width/2);
    if(controller.y===awards.y)assert.ok(controllerRight<awardLeft,`Decor overlaps for ${count} games`);
    if(insideController)assert.equal(controller.y,layout.shelfYs[row]+RACK.shelfTopOffset);
    assert.ok(controller.z-.69*scale>=RACK.innerBackZ&&controller.z+.69*scale<=RACK.frontZ);
    if(insideAwards)assert.equal(awards.y,layout.shelfYs[row]+RACK.shelfTopOffset);
  }
});
