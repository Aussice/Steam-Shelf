import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {parse} from '@babel/parser';
import {EN} from '../src/translations.js';
import {LANGUAGE_KEY,readLocale,setLocale,getLocale,subscribeLocale,t,gameTitle,dateLocale,errorText} from '../src/i18n.js';

test('language selection survives restart and tolerates unavailable storage',()=>{
 assert.equal(readLocale({getItem:()=> 'en'},'zh-CN'),'en');
 assert.equal(readLocale({getItem:()=> 'zh'},'en-US'),'zh');
 assert.equal(readLocale({getItem:()=> 'invalid'},'en-US'),'en');
 assert.equal(readLocale({getItem(){throw Error();}},'zh-CN'),'zh');
 const descriptor=Object.getOwnPropertyDescriptor(globalThis,'localStorage');
 const written=[];
 Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{setItem:(...entry)=>written.push(entry)}});
 let updates=0;const off=subscribeLocale(()=>updates++);
 try {setLocale('zh');setLocale('en');assert.equal(getLocale(),'en');assert.deepEqual(written.at(-1),[LANGUAGE_KEY,'en']);const previous=updates;setLocale('en');assert.equal(updates,previous);off();setLocale('zh');assert.equal(updates,previous);}
 finally {off();if(descriptor)Object.defineProperty(globalThis,'localStorage',descriptor);else delete globalThis.localStorage;}
});

test('count messages, source names and nested status templates translate without changing identifiers',()=>{
 setLocale('en');
 assert.equal(t('已安装 73 款 · 未安装 1113 款'),'73 installed · 1113 not installed');
 assert.equal(t('第 {0} / {1} 架',2,16),'Shelf 2 / 16');
 assert.equal(t('{0}–{1} · 共 {2} 款',73,144,1113),'73–144 of 1113');
 assert.equal(t('金色饰面 · Steam 收藏陈列'),'Gold finish · Steam collection display');
 assert.equal(t('本机 Steam · 含未安装'),'Local Steam · All owned games');
 assert.equal(t('与「Portal {0}」匹配的游戏'),'Games matching “Portal {0}”');
 assert.equal(errorText("Error invoking remote method 'steam:scan': Error: 请先打开 Steam 客户端"),'Open the Steam client first');
 assert.equal(t('我的自定义书架'),'我的自定义书架');
 assert.equal(gameTitle({name:'Portal 2',subtitle:'传送门 2'}),'Portal 2');
 assert.equal(dateLocale(),'en-US');
 setLocale('zh');assert.equal(t('第 {0} / {1} 架',2,16),'第 2 / 16 架');
 assert.equal(gameTitle({name:'Portal 2',subtitle:'传送门 2'}),'传送门 2');
 assert.equal(dateLocale(),'zh-CN');
});

test('static translated UI and canvas strings have English dictionary entries',()=>{
 const missing=[];
 for(const name of ['main.jsx','GameInspector.jsx','DecorInspector.jsx','ArrangementPanel.jsx','LibraryDropdown.jsx','ShelfScene.jsx','coverTextures.js','inspectorBack.js']){
  const source=readFileSync(new URL('../src/'+name,import.meta.url),'utf8');
  const ast=parse(source,{sourceType:'module',plugins:['jsx']});
  function visit(node){if(!node||typeof node!=='object')return;
   if(node.type==='CallExpression'&&node.callee.name==='t'&&node.arguments[0]?.type==='StringLiteral'){
    const key=node.arguments[0].value;if(/\p{Script=Han}/u.test(key)&&!Object.hasOwn(EN,key))missing.push(`${name}: ${key}`);
   }
   for(const [key,value] of Object.entries(node)){if(['loc','start','end'].includes(key))continue;if(Array.isArray(value))value.forEach(visit);else if(typeof value==='object')visit(value);}
  }visit(ast);
 }
 assert.deepEqual(missing,[]);
});
