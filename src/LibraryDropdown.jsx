import { t } from './i18n.js';
import {useEffect,useId,useLayoutEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Check,ChevronDown} from 'lucide-react';
import {dropdownPosition} from './dropdownPosition.js';

export default function LibraryDropdown({label,value,options,onChange,icon:Icon,className=''}) {
  const [open,setOpen]=useState(false),[active,setActive]=useState(0),[position,setPosition]=useState(null);
  const trigger=useRef(null),panel=useRef(null),buttons=useRef([]);
  const id=useId();
  const selected=Math.max(0,options.findIndex(option=>option.value===value));
  const current=options[selected];
  function show(){setActive(selected);setOpen(true);}
  function close(restore=false){setOpen(false);if(restore)trigger.current?.focus();}
  function choose(option){onChange(option.value);close(true);}

  useLayoutEffect(()=>{
    if(!open)return undefined;
    const measure=()=>setPosition(dropdownPosition(trigger.current.getBoundingClientRect(),window.innerWidth,window.innerHeight,options.length));
    measure();window.addEventListener('resize',measure);window.addEventListener('scroll',measure,true);
    return()=>{window.removeEventListener('resize',measure);window.removeEventListener('scroll',measure,true);};
  },[open,options.length]);
  useLayoutEffect(()=>{if(open&&position)buttons.current[active]?.focus({preventScroll:true});},[open,active,position]);
  useEffect(()=>{
    if(!open)return undefined;
    const outside=event=>{if(!trigger.current?.contains(event.target)&&!panel.current?.contains(event.target))close();};
    document.addEventListener('pointerdown',outside,true);
    return()=>document.removeEventListener('pointerdown',outside,true);
  },[open]);

  function keys(event) {
    if(event.key==='Escape'&&open){event.preventDefault();event.stopPropagation();close(true);return;}
    if(event.key==='Tab'&&open){close(true);return;}
    if(!['ArrowDown','ArrowUp','Home','End'].includes(event.key))return;
    event.preventDefault();
    if(!open){show();return;}
    if(event.key==='Home')setActive(0);
    else if(event.key==='End')setActive(options.length-1);
    else setActive(previous=>(previous+(event.key==='ArrowDown'?1:-1)+options.length)%options.length);
  }

  return <div className={`library-dropdown ${className}`}>
    <button ref={trigger} type="button" className="library-dropdown-trigger" aria-label={t(`${t(label)}: ${t(current.label)}`)} aria-haspopup="listbox" aria-expanded={open} aria-controls={open?id:undefined} onKeyDown={keys} onClick={()=>open?close():show()}>
      {Icon&&<Icon size={14}/>}<span>{t(current.label)}</span><ChevronDown className={open?'expanded':''} size={13}/>
    </button>
    {t(open&&position&&createPortal(<div ref={panel} id={id} role="listbox" aria-label={t(label)} className="library-dropdown-panel" style={position} onKeyDown={keys}>
      {options.map((option,index)=><button key={option.value} ref={node=>{buttons.current[index]=node;}} type="button" role="option" aria-selected={option.value===value} tabIndex={index===active?0:-1} className={option.value===value?'selected':''} onClick={()=>choose(option)}><span>{t(option.label)}</span>{option.value===value?<Check size={15}/>:<i/>}</button>)}
    </div>,document.body))}
  </div>;
}
