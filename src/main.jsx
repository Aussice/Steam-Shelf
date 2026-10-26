import { t, gameTitle, dateLocale, setLocale, errorText } from './i18n.js';
import { useLocale } from './useLocale.js';
import React, { useState, useMemo, useRef, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { Library, Heart, Download, Search, Plus, Box, Grid2X2, RotateCcw, Maximize, Minimize, Camera, Shuffle, ChevronRight, ChevronLeft, ArrowUpRight, X, FolderOpen, FileJson, Link, Check, LoaderCircle, SlidersHorizontal, Move, Mouse, VolumeX, Info, ExternalLink, Gamepad2, PanelLeftClose, Sun, Moon } from 'lucide-react';
import ShelfScene from './ShelfScene';
import GameInspector from './GameInspector';
import DecorInspector from './DecorInspector';
import LibraryDropdown from './LibraryDropdown';
import { STATUS, DEFAULT_LABELS, normalizePersonal, orderGames, swapOrder } from './collectionState';
import { exportCustomCovers, importCustomCovers } from './personalCovers';
import { shelfSound } from './shelfAudio';
import ArrangementPanel from './ArrangementPanel';
import { demoGames, normalizeImport, readSaved, save, gameCover, resolveCover, libraryClient, loadCoverImage, clearCoverCache } from './library';
import './style.css';

const native = window.steamShelf;
const genres = ['角色扮演', '动作冒险', '独立游戏', '开放世界', '休闲模拟', '解谜探索', '策略战术', '竞速运动', '多人联机', 'Steam 游戏'];
const PAGE_SIZE = 72;
const IconButton = ({ label, children, className = '', ...rest }) => <button className={`icon-button ${className}`} title={t(label)} aria-label={t(label)} {...rest}>{t(children)}</button>;
function Cover({ game, revision = 0, ...props }) {
  const [failed, setFailed] = useState(false), [src, setSrc] = useState(null);
  useEffect(() => { let live = true; setFailed(false); setSrc(null); loadCoverImage(game).then(image => { if (live) setSrc(image.src); }).catch(() => { if(live)setFailed(true); }); return () => { live = false; }; }, [game.appid, game.demo, revision]);
  return failed || !src ? <div className="cover-fallback" style={{ background: game.color || '#37536b' }}>{gameTitle(game)}{failed && <small>{t("封面暂不可用")}</small>}</div> : <img src={src} alt={t('{0} 封面', gameTitle(game))} {...props} />;
}

function App() {
  const locale = useLocale();
  const [collection, setCollection] = useState(() => {
    const saved = readSaved('collection', null);
    try { return saved?.games?.length ? { games: normalizeImport(saved.games), source: String(saved.source || '导入的收藏') } : { games: demoGames, source: '演示收藏' }; }
    catch { return { games: demoGames, source: '演示收藏' }; }
  });
  const [favorites, setFavorites] = useState(() => new Set(readSaved('favorites', [1245620, 1145360, 367520, 413150])));
  const [nav, setNav] = useState('all'), [genre, setGenre] = useState(''), [query, setQuery] = useState(''), [sort, setSort] = useState('shelf');
  const [theme, setTheme] = useState(() => { const saved=readSaved('theme',null); return readSaved('themePreferenceVersion',0)>=1 && ['wood','metal'].includes(saved) ? saved : 'wood'; });
  const [view, setView] = useState('3d'), [angle, setAngle] = useState('perspective'), [selected, setSelected] = useState(null), [hovered, setHovered] = useState(null);
  const [page, setPage] = useState(0), [modal, setModal] = useState(false), [help, setHelp] = useState(false), [toast, setToast] = useState(null), [busy, setBusy] = useState(false), [full, setFull] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(() => matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [collapsed, setCollapsed] = useState(() => matchMedia('(max-width: 760px)').matches);
  const [inspecting, setInspecting] = useState(false), [selectedDecor,setSelectedDecor] = useState(null), [coverRevision, setCoverRevision] = useState(0);
  const [personal,setPersonal]=useState(()=>normalizePersonal(readSaved('personal',{}))),[editMode,setEditMode]=useState(false),[statusFilter,setStatusFilter]=useState('all'),[arrangementRevision,setArrangementRevision]=useState(0);
  const shelf = useRef(null), stage = useRef(null), file = useRef(null), toastTimer = useRef(null), modalElement = useRef(null), opener = useRef(null), searchRef = useRef(null);
  const games = collection.games, demo = collection.source === '演示收藏';
  const notify = message => { setToast(errorText(message)); clearTimeout(toastTimer.current); toastTimer.current = setTimeout(() => setToast(null), 4500); };
  useEffect(() => () => clearTimeout(toastTimer.current), []);
  useEffect(() => {
    const saved = readSaved('collection', null);
    if (!libraryClient || (saved?.games?.length && !String(saved.source).startsWith('本机 Steam'))) return;
    let live = true;
    setBusy(true);
    libraryClient.scan().then(result => { if (live && result.games.length) { const next={games:result.games,source:result.source||'本机 Steam'};setCollection(next);save('collection',next);if (!result.complete && result.note) notify(result.note); } }).catch(() => {}).finally(() => { if (live) setBusy(false); });
    return () => { live = false; };
  }, []);
  useEffect(() => { save('theme', theme); save('themePreferenceVersion',1); }, [theme]);
  useEffect(() => { save('favorites', [...favorites]); }, [favorites]);
  useEffect(() => { save('personal',personal); }, [personal]);
  useEffect(() => {
    function keys(e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && !document.querySelector('[role=dialog]')) { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === 'Escape') { setModal(false); setHelp(false); setSelected(null); setInspecting(false); setSelectedDecor(null); setEditMode(false); }
    }
    const fullscreen = () => setFull(Boolean(document.fullscreenElement));
    window.addEventListener('keydown', keys); document.addEventListener('fullscreenchange', fullscreen);
    return () => { window.removeEventListener('keydown', keys); document.removeEventListener('fullscreenchange', fullscreen); };
  }, []);
  useEffect(() => {
    if (!(modal || help)) return;
    opener.current = document.activeElement;
    const dialog = modalElement.current;
    const nodes = () => [...dialog.querySelectorAll('button:not(:disabled), input, select, a[href]')];
    nodes()[0]?.focus();
    const trap = e => {
      if (e.key !== 'Tab') return;
      const all = nodes();
      if (e.shiftKey && document.activeElement === all[0]) { e.preventDefault(); all.at(-1)?.focus(); }
      else if (!e.shiftKey && document.activeElement === all.at(-1)) { e.preventDefault(); all[0]?.focus(); }
    };
    dialog.addEventListener('keydown', trap);
    return () => { dialog.removeEventListener('keydown', trap); opener.current?.focus?.(); };
  }, [modal, help]);
  const filtered = useMemo(() => {
    let list = games.filter(g => (nav !== 'favorites' || favorites.has(g.appid)) && (nav !== 'installed' || g.installed) && (nav !== 'uninstalled' || !g.installed) && (statusFilter==='all'||(personal.statuses[g.appid]||'unmarked')===statusFilter) && (!genre || g.genre === genre) && (!query || `${g.name} ${g.subtitle || ''} ${g.appid}`.toLocaleLowerCase().includes(query.toLocaleLowerCase())));
    if(sort==='shelf')list=orderGames(list,personal.order);
    if (sort === 'name') list = [...list].sort((a, b) => gameTitle(a).localeCompare(gameTitle(b), dateLocale()));
    if (sort === 'time') list = [...list].sort((a, b) => (b.playtime_forever || 0) - (a.playtime_forever || 0));
    if (sort === 'id') list = [...list].sort((a, b) => b.appid - a.appid);
    return list;
  }, [games, nav, favorites, genre, query, sort, personal.order, personal.statuses, statusFilter, locale]);
  useEffect(() => { setPage(0); }, [query, nav, genre, sort,statusFilter]);
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, pages - 1);
  const visible = useMemo(() => filtered.slice(currentPage * PAGE_SIZE, currentPage * PAGE_SIZE + PAGE_SIZE), [filtered, currentPage]);
  const current = games.find(g => g.appid === selected);
  function chooseNav(value) { setSelectedDecor(null); setStatusFilter('all'); setNav(value); setGenre(''); setSelected(null); }
  function toggleFavorite(id) { setFavorites(previous => { const next = new Set(previous); if (next.has(id)) next.delete(id); else next.add(id); return next; }); }
  function chooseGame(game) { setSelectedDecor(null); if(selected!==game.appid)shelfSound('pull',personal.sound);setSelected(game.appid); }
  function putBack() { shelfSound('return',personal.sound);setSelected(null);setInspecting(false); }
  function changeStatus(id,value) { setPersonal(p=>({...p,statuses:{...p.statuses,[id]:value}})); }
  function swapGames(source,target) { setPersonal(p=>({...p,order:swapOrder(games,p.order,source,target)}));shelfSound('return',personal.sound); }
  function moveGame(id,direction) { const ordered=orderGames(games,personal.order),i=ordered.findIndex(g=>g.appid===id);if(ordered[i+direction])swapGames(id,ordered[i+direction].appid); }
  function toggleEdit() { setEditMode(!editMode);if(!editMode){setView('3d');setSort('shelf');notify('拖动游戏交换位置，或选择游戏调整展示方式；更改会自动保存。');} }
  function loadGames(next, source) {
    if (!next.length) throw new Error('没有找到可导入的游戏。');
    const newCollection = { games: next, source };
    setCollection(newCollection); setSelected(null); setNav('all'); setGenre(''); setQuery(''); setPage(0); setStatusFilter('all'); setModal(false);
    if (!save('collection', newCollection)) notify('已导入，本地存储空间不足；请导出备份以保留收藏。');
    else notify(`已将 ${next.length} 款游戏摆上书架`);
  }
  async function scan(choose = false) {
    if (!libraryClient) { notify('请在 Windows 应用中连接 Steam。'); return; }
    setBusy(true);
    try {
      const result = await (choose && native ? native.chooseFolder(locale) : libraryClient.scan());
      if (!result) return;
      if (!result.games.length) {
        notify(result.roots?.length ? '目录中没有已完成安装的游戏，可选择其他 SteamLibrary 文件夹。' : '未找到 Steam 安装目录，请手动选择文件夹。'); return;
      }
      loadGames(result.games, result.source || '本机 Steam');
      if (!result.complete && result.note) notify(result.note);
      if (result.warnings?.length) notify(`已导入 ${result.games.length} 款游戏，${result.warnings.length} 个文件未能读取。`);
    } catch (e) { notify(e.message); } finally { setBusy(false); }
  }
  async function importFile(fileObject) {
    if (!fileObject) return;
    try {
      if (fileObject.size > 100 * 1024 * 1024) throw new Error('请导入小于 100 MB 的收藏备份。');
      const json = JSON.parse(await fileObject.text());
      const next = normalizeImport(json);
      if(json.personal) { await importCustomCovers(json.covers,next.map(g=>g.appid));setPersonal(normalizePersonal(json.personal));setArrangementRevision(v=>v+1);clearCoverCache();setCoverRevision(v=>v+1); }
      loadGames(next, '导入的收藏');
      if (Array.isArray(json.favorites)) setFavorites(new Set(json.favorites.filter(Number.isSafeInteger)));
      if(['wood','metal'].includes(json.theme))setTheme(json.theme);
    } catch (e) { notify(e instanceof SyntaxError ? '文件不是有效的 JSON，请检查导出的游戏清单。' : e.message); }
    if (file.current) file.current.value = '';
  }
  function download(data, name) { const a = document.createElement('a'); a.href = data; a.download = name; a.click(); }
  async function exportLibrary() {
    let covers;try{covers=await exportCustomCovers(games.map(g=>g.appid));}catch(error){notify(error.message);return;}
    const blob = new Blob([JSON.stringify({ schema: 2, source: collection.source, games, favorites: [...favorites], theme, personal, covers }, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); download(url, 'steam-shelf-collection.json'); setTimeout(() => URL.revokeObjectURL(url), 5000); notify('收藏清单已导出');
  }
  function screenshot() {
    const png = shelf.current?.screenshot();
    if (png) { download(png, 'my-steam-shelf.png'); notify('书架图片已保存'); }
    else notify('请先切换到 3D 视图再拍照。');
  }
  async function launch(game) {
    if (game.demo) { notify('这是演示游戏；连接自己的 Steam 游戏库后即可启动。'); return; }
    try {
      if (native) await native.launch(game.appid);
      else { const a = document.createElement('a'); a.href = `steam://rungameid/${game.appid}`; a.click(); }
      notify('已将启动请求交给 Steam，请在 Steam 中确认。');
    } catch { notify('无法启动 Steam，请确认已安装并登录 Steam 客户端。'); }
  }
  function openStore(game) {
    if (native) native.store(game.appid).catch(() => notify('商店暂时无法打开。'));
    else window.open(`https://store.steampowered.com/app/${game.appid}/`, '_blank', 'noopener,noreferrer');
  }
  function random() {
    if (!filtered.length) return;
    const options = filtered.filter(g => g.appid !== selected);
    const game = (options.length ? options : filtered)[Math.floor(Math.random() * (options.length || filtered.length))];
    setSelected(game.appid); setPage(Math.floor(filtered.findIndex(g => g.appid === game.appid) / PAGE_SIZE));
  }
  async function fullscreen() {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await stage.current.requestFullscreen(); }
    catch { notify('当前预览不支持全屏，可使用右上角折叠侧栏扩大画面。'); }
  }
  async function inspect() {
    if (document.fullscreenElement) await document.exitFullscreen();
    setInspecting(true);
  }
  async function inspectDecor(item) {
    if (document.fullscreenElement) await document.exitFullscreen();
    setSelected(null);setHovered(null);setInspecting(false);setEditMode(false);setSelectedDecor(item);
  }
  const decorOptions = [{kind:'gamepad',name:'PS5 DualSense 手柄'},...['gold','silver','bronze'].map((finish,index)=>({kind:'award',finish,name:['金色','银色','铜色'][index]+' Steam 奖杯'}))];
  function turnPage(next) { if(selected)shelfSound('return',personal.sound);setSelected(null);setHovered(null);setPage(next); }
  const pagination=filtered.length>0&&pages>1?<nav className="shelf-pagination" aria-label={t("书架翻页")}><button aria-label={t("上一架")} disabled={currentPage===0} onClick={()=>turnPage(currentPage-1)}><ChevronLeft size={20}/><span>{t("上一架")}</span></button><div className="shelf-page-count"><strong>{t("第 {0} / {1} 架",currentPage+1,pages)}</strong><span>{t("{0}–{1} · 共 {2} 款",currentPage*PAGE_SIZE+1,Math.min((currentPage+1)*PAGE_SIZE,filtered.length),filtered.length)}</span></div><button aria-label={t("下一架")} disabled={currentPage>=pages-1} onClick={()=>turnPage(currentPage+1)}><span>{t("下一架")}</span><ChevronRight size={20}/></button></nav>:null;
  const title = query ? '搜索结果' : (statusFilter!=='all' && STATUS[statusFilter]) || genre || (nav === 'favorites' ? '我的收藏' : nav === 'installed' ? '已安装' : nav === 'uninstalled' ? '未安装' : '全部游戏');
  const installedCount = games.filter(game => game.installed).length;
  return <div className={`app ${collapsed ? 'sidebar-collapsed' : ''}`}>
    <header className="topbar">
      <div className="app-identity"><IconButton label={t("折叠或展开侧栏")} aria-expanded={!collapsed} onClick={() => setCollapsed(!collapsed)}><PanelLeftClose size={19} /></IconButton><a className="brand" href="#" onClick={e => { e.preventDefault(); chooseNav('all'); }} aria-label={t("Steam Shelf 首页")}><img className="brand-icon" src="./icon.svg" alt="" /><span>Steam Shelf</span></a></div>
      <nav className="client-nav" aria-label={t("主导航")}><button className="active" onClick={() => chooseNav('all')}>{t("游戏库")}</button><button onClick={() => setHelp(true)}>{t("帮助")}</button></nav>
      <div className="topbar-actions"><div className="language-switch" role="group" aria-label={t("界面语言")}><button lang="zh-CN" aria-pressed={locale==='zh'} onClick={()=>setLocale('zh')}>中文</button><button lang="en" aria-pressed={locale==='en'} onClick={()=>setLocale('en')}>EN</button></div><span className={`source-badge ${demo ? '' : 'connected'}`}><span />{t(demo ? '演示模式' : '本机游戏库')}</span><button className="connect-button" onClick={() => setModal(true)}><Link size={15} />{t(demo ? '连接 Steam' : '管理游戏库')}</button></div>
    </header>
    <div className="app-body">
      <aside className="sidebar" aria-label={t("游戏库侧栏")}>
        <div className="nav-label">{t("游戏收藏")}</div>
        <nav aria-label={t("收藏导航")}>
          <button aria-current={nav === 'all' && !genre ? 'page' : undefined} className={nav === 'all' && !genre ? 'nav-item active' : 'nav-item'} onClick={() => chooseNav('all')}><Library size={17} /><span>{t("全部游戏")}</span><small>{t(games.length)}</small></button>
          <button aria-current={nav === 'favorites' ? 'page' : undefined} className={nav === 'favorites' ? 'nav-item active' : 'nav-item'} onClick={() => chooseNav('favorites')}><Heart size={17} /><span>{t("我的收藏")}</span><small>{t(games.filter(g => favorites.has(g.appid)).length)}</small></button>
          <button aria-current={nav === 'installed' ? 'page' : undefined} className={nav === 'installed' ? 'nav-item active' : 'nav-item'} onClick={() => chooseNav('installed')}><Download size={17} /><span>{t("已安装")}</span><small>{t(installedCount)}</small></button>
          <button aria-current={nav === 'uninstalled' ? 'page' : undefined} className={nav === 'uninstalled' ? 'nav-item active' : 'nav-item'} onClick={() => chooseNav('uninstalled')}><Box size={17} /><span>{t("未安装")}</span><small>{t(games.length-installedCount)}</small></button>
        </nav>
        <div className="nav-label collection-label">{t("游戏分类")}</div>
        <nav aria-label={t("游戏类型")} className="genre-nav">{genres.filter(type => games.some(g => g.genre === type)).map(type => <button key={type} className={`genre-item ${genre === type ? 'active' : ''}`} onClick={() => { setGenre(type); setNav('all'); setSelected(null); }}><FolderOpen size={15} /><span>{t(type)}</span><small>{t(games.filter(g => g.genre === type).length)}</small></button>)}</nav>
        <div className="sidebar-bottom"><div className="local-note"><span className="status-dot" /><div>{t(demo ? '演示收藏' : collection.source)}<small>{t(demo ? '连接 Steam 以读取你的游戏' : '包含已安装与未安装游戏')}</small></div></div><button onClick={exportLibrary}><FileJson size={15} />{t("导出收藏清单")}<ArrowUpRight size={13} /></button></div>
      </aside>
      <main className="workspace">
        <div className="heading-row"><div className="library-title"><h1>{t(title)}<span>{t(filtered.length)}<small>{locale==='zh'?'款':' games'}</small></span></h1><p>{t(query ? `与「${query}」匹配的游戏` : demo ? '演示收藏 · 导入你的 Steam 游戏库开始使用' : `已安装 ${installedCount} 款 · 未安装 ${games.length-installedCount} 款`)}</p></div><div className="heading-actions"><button className="random-button" onClick={random} disabled={!filtered.length}><Shuffle size={15} />{t("今天玩什么")}</button><button className={`edit-shelf-button ${editMode?'active':''}`} aria-pressed={editMode} onClick={toggleEdit}><SlidersHorizontal size={15} />{t(editMode?'完成布置':'布置书架')}</button></div></div>
        <div className="library-toolbar">
          <label className="search-field"><Search size={16} /><input ref={searchRef} placeholder={t("搜索游戏名称或 AppID")} value={query} onChange={e => setQuery(e.target.value)} aria-label={t("搜索游戏")} />{query ? <IconButton label={t("清空搜索")} onClick={() => setQuery('')}><X size={14} /></IconButton> : <kbd>Ctrl K</kbd>}</label>
          <div className="toolbar-end"><LibraryDropdown className="status-dropdown" label={t("收藏状态筛选")} value={statusFilter} onChange={setStatusFilter} options={[{value:'all',label:'全部状态'},...Object.entries(STATUS).map(([value,label])=>({value,label}))]}/><LibraryDropdown className="sort-dropdown" label={t("游戏排序")} value={sort} onChange={setSort} icon={SlidersHorizontal} options={[{value:'shelf',label:'书架顺序'},{value:'name',label:'名称 A–Z'},{value:'time',label:'游玩时长'},{value:'id',label:'AppID 从新到旧'}]}/><button className="retry-covers" title={t("重试缺失封面")} onClick={() => { clearCoverCache(); setCoverRevision(v=>v+1); notify('正在重新读取缺失封面'); }}><RotateCcw size={14} /><span>{t("重试封面")}</span></button><div className="view-switch" aria-label={t("显示方式")}><button className={view === '3d' ? 'active' : ''} onClick={() => setView('3d')} aria-label={t("3D 书架")} aria-pressed={view === '3d'}><Box size={15} />{t("3D 书架")}</button><button className={view === 'grid' ? 'active' : ''} onClick={() => setView('grid')} aria-label={t("平面视图")} title={t("平面视图")} aria-pressed={view === 'grid'}><Grid2X2 size={15} /></button></div></div>
        </div>
        <section className={`stage ${theme === 'wood' ? 'wood-stage' : ''} ${view === 'grid' ? 'grid-stage' : ''}`} ref={stage} aria-label={t("游戏收藏展示区")} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); importFile(e.dataTransfer.files[0]); }}>
          <div className="stage-top"><span className="stage-label">{t(view === '3d' ? '书架陈列' : '平面视图')}<small>{t("{0} 款游戏",visible.length)}</small></span><div className="stage-top-actions">{view === '3d' && <details className="decor-menu" onKeyDown={event=>{if(event.key==='Escape')event.currentTarget.open=false;}}><summary aria-label={t("查看手柄和奖杯")}><Gamepad2 size={15}/>{t("摆件")}<ChevronRight size={12}/></summary><div className="decor-menu-items" aria-label={t("选择摆件查看")}>{decorOptions.map(item=><button key={item.kind+(item.finish||'')} onClick={event=>{event.currentTarget.closest('details').open=false;inspectDecor(item);}}>{t(item.name)}<span>360°</span></button>)}</div></details>}{view === '3d' && <button className="angle-switch" onClick={() => setAngle(angle === 'front' ? 'perspective' : 'front')}>{t(angle === 'front' ? '正面视角' : '透视视角')}<ChevronRight size={12} /></button>}<IconButton label={t("全屏展示")} onClick={fullscreen}>{full ? <Minimize size={17} /> : <Maximize size={17} />}</IconButton></div></div>
          {filtered.length ? view === '3d' ? <><ShelfScene key={arrangementRevision} ref={shelf} games={visible} selected={selected} onSelect={chooseGame} onDecorSelect={inspectDecor} onHover={setHovered} coverRevision={coverRevision} placements={personal.placements} shelfLabels={personal.labels} editMode={editMode} onSwap={swapGames} initialView={personal.camera} onViewChange={camera=>setPersonal(p=>({...p,camera}))} theme={theme} angle={angle} reducedMotion={reducedMotion} /><div className="sr-only">{visible.map(game => <button key={game.appid} onClick={() => chooseGame(game)}>{t("查看 ")}{gameTitle(game)}</button>)}</div></> : <div className="game-grid">{visible.map(game => <button key={game.appid} className={`game-card ${selected === game.appid ? 'selected' : ''}`} onClick={() => chooseGame(game)}><div className="grid-cover"><Cover game={game} revision={coverRevision} />{personal.statuses[game.appid]&&personal.statuses[game.appid]!=='unmarked'&&<span className="game-status-chip">{t(STATUS[personal.statuses[game.appid]])}</span>}{favorites.has(game.appid) && <Heart className="grid-heart" size={15} fill="currentColor" />}</div><strong>{t(gameTitle(game))}</strong><small>{t(game.genre)}</small></button>)}</div> : <div className="empty-state"><Library size={42} strokeWidth={1} /><h2>{t(query ? '未找到匹配的游戏' : nav === 'favorites' ? '暂无收藏游戏' : nav === 'installed' ? '暂无已安装游戏' : '游戏库为空')}</h2><p>{t(query ? '换个名称或 AppID 试试。' : nav === 'favorites' ? '选中游戏，点击爱心即可加入收藏。' : '连接 Steam 或导入游戏清单，开始你的收藏。')}</p><button className="primary" onClick={() => query ? setQuery('') : nav === 'favorites' ? chooseNav('all') : setModal(true)}>{t(query ? '清空搜索' : nav === 'favorites' ? '浏览全部游戏' : '连接游戏库')}</button></div>}
          {hovered && !current && view === '3d' && <div className="hover-label">{t(gameTitle(hovered))}<span>{t(hovered.kind ? '点击 360° 查看' : '点击抽出游戏盒')}</span></div>}
          {current && !editMode && <aside className="picked-card" aria-live="polite"><span>{t(current.genre)} · {t(current.installed ? '已安装' : '未安装')}</span><h2>{t(gameTitle(current))}</h2><p>{t("游玩 {0} 小时 · APP {1}",((current.playtime_forever || 0) / 60).toFixed(1),current.appid)}</p><label className="picked-status"><span>{t("收藏状态")}</span><select aria-label={t("收藏状态")} value={personal.statuses[current.appid]||'unmarked'} onChange={e=>changeStatus(current.appid,e.target.value)}>{Object.entries(STATUS).map(([value,label])=><option key={value} value={value}>{t(label)}</option>)}</select></label><div><button onClick={putBack}>{t("放回")}</button><button className="inspect-button" onClick={inspect}>{t("360° 查看")}<RotateCcw size={14}/></button></div><div className="picked-extras"><IconButton label={t(favorites.has(current.appid) ? '取消收藏' : '收藏游戏')} className={favorites.has(current.appid) ? 'is-favorite' : ''} onClick={() => toggleFavorite(current.appid)}><Heart size={16} fill={favorites.has(current.appid) ? 'currentColor' : 'none'} /></IconButton><button onClick={() => openStore(current)}>{t("商店")}<ExternalLink size={12}/></button><button onClick={() => launch(current)}><Gamepad2 size={14}/>{t(current.installed ? '开始游戏' : '通过 Steam 启动')}</button></div></aside>}
          {editMode&&<ArrangementPanel game={current} personal={personal} onPlacement={(id,mode)=>setPersonal(p=>{const placements={...p.placements};if(mode==='auto')delete placements[id];else placements[id]=mode;return {...p,placements};})} onLabel={(i,value)=>setPersonal(p=>({...p,labels:p.labels.map((label,index)=>index===i?value:label)}))} onMove={moveGame} onDone={()=>setEditMode(false)} onReset={()=>{setPersonal(p=>({...p,order:[],placements:{}}));setSelected(null);notify('已恢复自然陈列，标签和收藏状态保留。');}}/>}
          <div className="stage-bottom"><div className="scene-themes" aria-label={t("书架材质")}><button className={theme === 'metal' ? 'active' : ''} onClick={() => setTheme('metal')}><i className="metal-swatch" />{t("黑色金属")}</button><button className={theme === 'wood' ? 'active' : ''} onClick={() => setTheme('wood')}><i className="wood-swatch" />{t("温润胡桃")}</button></div>{view === '3d' && <div className="scene-hint"><Move size={13} /><span>{t("拖动旋转")}</span><i /><Mouse size={13} /><span>{t("滚轮缩放")}</span></div>}<div className="scene-tools"><button className="sound-toggle" aria-label={t(personal.sound?'关闭抽盒音效':'开启抽盒音效')} aria-pressed={personal.sound} onClick={()=>{setPersonal(p=>({...p,sound:!p.sound}));shelfSound('return',!personal.sound);}}>{t(personal.sound?'音效 开':'音效 关')}</button><IconButton label={t("拉近书架")} onClick={() => shelf.current?.zoom(.82)} disabled={view !== '3d'}><Plus size={17} /></IconButton><IconButton label={t("拉远书架")} onClick={() => shelf.current?.zoom(1.22)} disabled={view !== '3d'}><span style={{fontSize:22}}>−</span></IconButton><IconButton label={t("重置视角")} onClick={() => shelf.current?.reset()} disabled={view !== '3d'}><RotateCcw size={16} /></IconButton><IconButton label={t("保存书架图片")} onClick={screenshot} disabled={view !== '3d'}><Camera size={16} /></IconButton></div></div>
          {t(full && pagination)}
        </section>
        {t(!full && pagination)}
      </main>
    </div>
    <footer className="app-statusbar"><span><span className="status-dot" />{t(demo ? '正在浏览演示收藏' : '收藏保存在本机')}</span><span>{t("{0} 款游戏",games.length)}<em />{t("{0} 款收藏",games.filter(g => favorites.has(g.appid)).length)}</span></footer>
    <input ref={file} type="file" accept=".json,application/json" className="sr-only" aria-label={t("导入游戏 JSON 文件")} onChange={e => importFile(e.target.files[0])} />
    {inspecting && current && <GameInspector game={current} collectionStatus={personal.statuses[current.appid]||'unmarked'} onStatusChange={changeStatus} onCoverChange={()=>setCoverRevision(v=>v+1)} onClose={putBack} />}
    {selectedDecor && <DecorInspector item={selectedDecor} reducedMotion={reducedMotion} onClose={()=>setSelectedDecor(null)} />}
    {(modal || help) && <div className="modal-backdrop" onClick={e => { if (e.target === e.currentTarget) { setModal(false); setHelp(false); } }}><div ref={modalElement} className={`modal ${help ? 'help-modal' : ''}`} role="dialog" aria-modal="true" aria-labelledby="dialog-title"><IconButton label={t("关闭对话框")} className="modal-close" onClick={() => { setModal(false); setHelp(false); }}><X size={20} /></IconButton>{modal ? <><div className="modal-icon"><Library size={26} /></div><div className="eyebrow">{t("游戏库管理")}</div><h2 id="dialog-title">{t("连接你的游戏库")}</h2><p className="modal-description">{t("读取 Steam 游戏库，或导入已导出的收藏清单。")}</p><div className="import-options"><button onClick={() => scan(false)} disabled={busy}><FolderOpen size={23} /><div><strong>{t(libraryClient ? '读取我的 Steam 游戏库' : '本机 Steam 扫描')}</strong><span>{t(libraryClient ? '读取当前账号游戏，包含未安装游戏 · 无需 API Key' : '在 Windows 应用中使用 · 预览支持 JSON 导入')}</span></div>{busy ? <LoaderCircle className="spinning" size={18} /> : <ChevronRight size={18} />}</button>{native && <button className="manual-folder" onClick={() => scan(true)} disabled={busy}>{t("手动选择 Steam / SteamLibrary 文件夹")}<ArrowUpRight size={13} /></button>}<button onClick={() => file.current.click()}><FileJson size={23} /><div><strong>{t("导入游戏清单")}</strong><span>{t("支持本应用备份和 Steam API 的 JSON 文件")}</span></div><ChevronRight size={18} /></button></div><SteamForm native={native} onImported={loadGames} notify={notify} /><div className="privacy-note"><span className="status-dot" />{t("收藏保存在本机；API Key 仅用于向 Steam 请求，不会保存。")}</div><button className="demo-link" onClick={() => { setCollection({ games: demoGames, source: '演示收藏' }); setSelected(null); setNav('all'); setGenre(''); setQuery(''); setPage(0); setStatusFilter('all'); setModal(false); }}>{t("浏览演示书架")}<ArrowUpRight size={12} /></button></> : <><div className="eyebrow">{t("关于")}</div><h2 id="dialog-title">Steam Shelf</h2><p className="modal-description">{t("一个独立的 Steam 游戏书架应用。")}</p><div className="help-content"><p><strong>{t("逛逛书架")}</strong>{t("拖动旋转，滚轮缩放；点击游戏盒抽出，选择「放回」或「360° 查看」；查看时可自由旋转，旁边持续显示基本信息。点击手柄或奖杯可独立 360° 查看，也可使用书架右上方的「摆件」菜单。平面视图支持键盘浏览。")}</p><p><strong>{t("连接收藏")}</strong>{t("打开并登录 Steam 后，应用会通过本机客户端核对游戏归属，读取已安装与未安装游戏。若刚购买的游戏尚未缓存，先打开 Steam 游戏库刷新；也可使用 API 或 JSON 导入。")}</p><p><strong>{t("清单格式")}</strong><code>{t('[{ "appid": 620, "name": "Portal 2" }]')}</code>{t("也支持带有 response.games 的 API 返回结果。")}</p><p><strong>{t("隐私与封面")}</strong>{t("收藏和偏好存储在本机；封面从 Steam CDN 获取，演示封面已随应用打包。API Key 不落盘。")}</p><label className="motion-option"><input type="checkbox" checked={reducedMotion} onChange={e => setReducedMotion(e.target.checked)} />{t("减少抽取和视角动画")}</label><p className="legal-note">{t("PS5 DualSense 手柄：Taohid Animation · CC BY 4.0。使用完整现成模型，调整陈列大小和角度。来源：sketchfab.com/taohidanimation；完整授权见应用随附 credits.txt。")}</p><p className="legal-note">{t("个人使用原型，非 Valve 官方产品。Steam 及游戏封面权利归各权利人所有。")}</p></div></>}</div></div>}
    {toast && <div className="toast" role="status"><Info size={16} /><span>{t(toast)}</span><button onClick={() => setToast(null)} aria-label={t("关闭提示")}><X size={14} /></button></div>}
  </div>;
}
function SteamForm({ native, onImported, notify }) {
  const [expanded, setExpanded] = useState(false), [id, setId] = useState(''), [key, setKey] = useState(''), [loading, setLoading] = useState(false);
  async function submit(e) {
    e.preventDefault();
    if (!native) { notify('Steam API 连接需要 Windows 应用，以保护 API Key 并避免浏览器跨域限制。'); return; }
    setLoading(true);
    try { const result = await native.ownedGames({ steamid: id.trim(), key: key.trim() }); setKey(''); onImported(result.games, 'Steam 完整收藏'); }
    catch (e) { notify(e.message); } finally { setLoading(false); }
  }
  return <div className="steam-form"><button className="api-expand" onClick={() => setExpanded(!expanded)} aria-expanded={expanded}><Link size={15} /><span>{t("通过 Steam API 导入完整收藏")}</span><Plus size={15} /></button>{expanded && <form onSubmit={submit}><p>{t("需要 SteamID64 和 Web API Key，并将 Steam「游戏详情」设为公开。")}</p><label>SteamID64<input required value={id} onChange={e => setId(e.target.value)} placeholder={t("7656119…（17 位数字）")} pattern="7656119[0-9]{10}" autoComplete="off" /></label><label>Steam Web API Key<input required type="password" value={key} onChange={e => setKey(e.target.value)} placeholder={t("仅本次使用，不会保存")} pattern="[a-fA-F0-9]{32}" autoComplete="off" /></label><button className="primary" type="submit" disabled={loading}>{loading ? <LoaderCircle size={16} className="spinning" /> : <Download size={16} />}{t(loading ? '正在读取收藏…' : '导入我的游戏')}</button><small>{t("Key 仅发送至 api.steampowered.com。")}</small></form>}</div>;
}
// Preserve the React root during development refreshes of this entry module.
const root = import.meta.hot?.data.root || createRoot(document.getElementById('root'));
if (import.meta.hot) import.meta.hot.data.root = root;
root.render(<App />);
