import {test} from 'node:test';
import assert from 'node:assert/strict';
import {dropdownPosition} from '../src/dropdownPosition.js';

test('library menu aligns with its trigger and opens above it near the bottom edge',()=>{
  const normal=dropdownPosition({right:900,top:150,bottom:186},1200,800,4);
  assert.equal(normal.left+normal.width,900);assert.equal(normal.top,192);
  const nearBottom=dropdownPosition({right:900,top:720,bottom:756},1200,800,4);
  assert.ok(nearBottom.top+nearBottom.maxHeight<720);
});

test('library menus stay visible in narrow windows and short available heights',()=>{
  for(const [width,height,rect,count] of [
    [360,640,{right:90,top:185,bottom:221},6],
    [960,680,{right:958,top:200,bottom:236},4],
    [360,180,{right:340,top:90,bottom:126},6],
  ]){
    const menu=dropdownPosition(rect,width,height,count);
    assert.ok(menu.left>=8&&menu.top>=8);
    assert.ok(menu.left+menu.width<=width-8);
    assert.ok(menu.top+menu.maxHeight<=height-8);
  }
});
