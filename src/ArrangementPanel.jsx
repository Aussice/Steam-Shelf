import { t, gameTitle } from './i18n.js';
import { useState, useEffect } from 'react';
export default function ArrangementPanel({game,personal,onPlacement,onLabel,onMove,onDone,onReset}) {
  const [labels,setLabels]=useState(personal.labels);
  useEffect(()=>{setLabels(personal.labels);},[personal.labels]);
  useEffect(()=>{const timer=setTimeout(()=>{labels.forEach((label,i)=>{if(label!==personal.labels[i])onLabel(i,label);});},450);return()=>clearTimeout(timer);},[labels,personal.labels]);
  return <aside className="arrangement-panel" aria-label={t("布置书架面板")}>
    <div className="arrangement-heading"><strong>{t("布置我的书架")}</strong><span>{t("自动保存")}</span></div>
    <p>{t("拖动游戏盒，放到另一款游戏上即可交换位置。单击游戏可调整展示方式。")}</p>
    <div className="shelf-label-fields">{labels.map((label,i)=><label key={i}>{t("第 {0} 层",i+1)}<input aria-label={t("第 {0} 层标签",i+1)} value={t(label)} maxLength={20} onChange={e=>setLabels(previous=>previous.map((text,index)=>index===i?e.target.value:text))} onBlur={()=>{if(label!==personal.labels[i])onLabel(i,label);}}/></label>)}</div>
    {game?<div className="arrangement-game"><strong>{t(gameTitle(game))}</strong><label>{t("展示方式")}<select aria-label={t("游戏展示方式")} value={personal.placements[game.appid]||'auto'} onChange={e=>onPlacement(game.appid,e.target.value)}><option value="auto">{t("自然陈列")}</option><option value="front">{t("封面朝前")}</option><option value="spine">{t("盒脊朝前")}</option><option value="stack">{t("横放")}</option></select></label><div className="arrangement-move"><button onClick={()=>onMove(game.appid,-1)}>{t("往前一个位置")}</button><button onClick={()=>onMove(game.appid,1)}>{t("往后一个位置")}</button></div></div>:<div className="arrangement-invitation">{t("点选书架上的游戏，给它安排一个位置。")}</div>}
    <button className="arrangement-done" onClick={onDone}>{t("完成布置")}</button>
    <button className="arrangement-reset" onClick={onReset}>{t("恢复自然陈列")}</button>
  </aside>;
}
