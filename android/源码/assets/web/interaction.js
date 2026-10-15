/* Small, local-only interactions. No network/audio assets or ledger mutations. */
const paths = {
 caliper:'M5 5v12h18V8M5 12h24M12 9v13M19 9v8M9 5h16M9 3v4M13 3v4M17 3v4M21 3v4',
 abacus:'M5 5h22v22H5zM5 12h22M10 6v20M16 6v20M22 6v20M8 9h4M14 9h4M20 9h4M8 17h4M14 20h4M20 17h4',
 book:'M7 4h19v24H7zM11 4v24M15 10h7M15 15h7M15 20h4',
 paw:'M10 20c-5 7 0 10 6 6 6 4 11 1 6-6l-6-5zM8 8a2 3 0 1 0 0 6 2 3 0 1 0 0-6M14 4a2 3 0 1 0 0 6 2 3 0 1 0 0-6M21 5a2 3 0 1 0 0 6 2 3 0 1 0 0-6M27 10a2 3 0 1 0 0 6 2 3 0 1 0 0-6',
 coin:'M27 16a11 11 0 1 0-22 0 11 11 0 1 0 22 0M20 11h-6a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-6M16 8v17',
 calculator:'M7 3h18v26H7zM11 7h10v6H11zM11 18h1M16 18h1M21 18h1M11 23h1M16 23h1M21 23h1'
};
const props=[['caliper','游标卡尺','量量你的支出喵～','有尺，不慌喵'],['abacus','算盘','算盘一响，黄金万两喵','噼里啪啦，账算清喵'],['book','小账本','来，记一笔喵','今天的花销写这里喵'],['paw','猫爪','戳一下，记一笔喵','喵爪记账，一爪一个准'],['coin','金币','掉金币啦，快捡喵！','攒起来喵～'],['calculator','计算器','按按按，算清楚喵','按按按，算清楚喵']];
const svg=id=>`<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[id]}"/></svg>`;
export function interactionMarkup(){return `<section class="prop-desk" aria-label="taffy 的互动小物"><div class="prop-heading"><span>taffy 的小物桌</span><small>先选状态，再点击塔菲</small></div><div class="prop-items">${props.map(([id,name])=>`<button type="button" class="prop-item" data-prop="${id}" aria-label="选择${name}状态" aria-pressed="false">${svg(id)}<span>${name}</span></button>`).join('')}</div><div class="prop-reply" role="status" aria-live="polite">选择一个小物状态，再点粉色人物与我互动喵。</div><button class="prop-entry" type="button" data-action="add">打开小账本 <span>＋</span></button></section>`;}
let context, timer, active=[], sequence=0;
function stop(){clearTimeout(timer);for(const node of active){try{node.stop();}catch{}}active=[];}
async function sound(kind,token){
 const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
 context??=new Audio();await context.resume();if(token!==sequence||document.hidden)return;
 const now=context.currentTime;
 const tone=(freq,start,length,type='sine',end=freq)=>{const o=context.createOscillator(),g=context.createGain();o.type=type;o.frequency.setValueAtTime(freq,now+start);o.frequency.exponentialRampToValueAtTime(end,now+start+length);g.gain.setValueAtTime(.0001,now+start);g.gain.exponentialRampToValueAtTime(.045,now+start+.008);g.gain.exponentialRampToValueAtTime(.0001,now+start+length);o.connect(g);g.connect(context.destination);o.start(now+start);o.stop(now+start+length+.02);o.onended=()=>{o.disconnect();g.disconnect();};active.push(o);};
 if(kind==='paw'){tone(680,0,.32,'triangle',430);tone(470,.12,.24,'sine',300);}
 else if(kind==='coin'){[1450,1940,2420].forEach((f,i)=>tone(f,i*.085,.24));}
 else if(kind==='abacus'){[0,.07,.14,.23,.30].forEach((t,i)=>tone(780+i%2*220,t,.035,'triangle'));}
 else if(kind==='calculator'){tone(960,0,.06,'sine');tone(720,.09,.055);}
 else {const length=kind==='book'?.26:.38,buffer=context.createBuffer(1,context.sampleRate*length,context.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.05*Math.sin(Math.PI*i/data.length);const n=context.createBufferSource(),filter=context.createBiquadFilter();filter.type='bandpass';filter.frequency.value=kind==='book'?1600:3400;n.buffer=buffer;n.connect(filter);filter.connect(context.destination);n.start();n.onended=()=>{n.disconnect();filter.disconnect();};active.push(n);}
}

let selected='book', dispose=()=>{};
const expressions={happy:'money',relaxed:'smile',neutral:'smile',worried:'concern',low:'concern',sad:'sad'};
// Source rectangles exclude adjacent cells and align each waist exactly to bottom=0.
const portraits={
 money:['taffy-expressions.png',271,11,468,505],
 smile:['taffy-expressions.png',282,524,457,490],
 concern:['taffy-expressions.png',810,524,459,490],
 sad:['taffy-expressions.png',801,9,468,507],
 coin:['taffy-actions.png',54,8,488,503],
 paw:['taffy-actions.png',551,8,488,503],
 abacus:['taffy-actions.png',1048,8,488,503],
 book:['taffy-actions.png',40,516,489,499],
 caliper:['taffy-actions.png',550,516,489,499],
 calculator:['taffy-actions.png',1045,516,487,499]
};
const duration=2200;
let ready;
function preload(){
 return ready??=Promise.all(['taffy-expressions.png','taffy-actions.png'].map(name=>{
  const image=new Image();image.src=new URL('./assets/'+name,import.meta.url).href;
  return image.decode();
 })).then(()=>true).catch(()=>{ready=null;return false;});
}
function artMarkup(id){
 const [file,x,y,w,h]=portraits[id];
 const style=`--portrait-ratio:${w}/${h};background-image:url('./assets/${file}');background-size:${1536/w*100}% ${1024/h*100}%;background-position:${x/(1536-w)*100}% ${y/(1024-h)*100}%`;
 const fx=props.some(p=>p[0]===id)?`<span class="action-fx fx-${id}" aria-hidden="true"><i></i><i></i><i></i></span>`:'';
 return `<div class="taffy-pose" data-pose="${id}"><div class="pose-motion"><div class="portrait" style="${style}">${fx}</div></div></div>`;
}
export function bindInteractions(root,settings){
 dispose();stop();sequence++;
 const desk=root.querySelector('.prop-desk'),visual=root.querySelector('.companion-visual');
 if(!desk||!visual)return;
 const base=expressions[visual.dataset.mood]||'smile',reply=desk.querySelector('.prop-reply');
 reply.hidden=!settings.prompts;
 visual.innerHTML=`<div class="taffy-stage">${Object.keys(portraits).map(artMarkup).join('')}</div>`;
 const layers=Array.from(visual.querySelectorAll('[data-pose]'));
 const pose=id=>layers.find(el=>el.dataset.pose===id);
 const show=id=>layers.forEach(el=>el.style.opacity=el.dataset.pose===id?'1':'0');
 show(base);visual.setAttribute('role','button');visual.tabIndex=0;
 const media=matchMedia('(prefers-reduced-motion: reduce)');
 let animations=[],taps=0,alive=true,resetTimer;
 const reduced=()=>!settings.animations||media.matches;
 const halt=freeze=>{for(const a of animations){if(freeze){try{a.commitStyles();}catch{}}a.cancel();}animations=[];};
 const resetMotion=()=>{halt(false);visual.querySelectorAll('.pose-motion,.action-fx i').forEach(el=>el.style.removeProperty('transform'));};
 const restore=()=>{clearTimeout(resetTimer);stop();sequence++;resetMotion();show(base);visual.removeAttribute('data-playing');visual.removeAttribute('aria-busy');};
 const select=id=>{
  selected=props.some(p=>p[0]===id)?id:'book';
  desk.querySelectorAll('[data-prop]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.prop===selected)));
  const name=props.find(p=>p[0]===selected)[1];
  visual.setAttribute('aria-label',`点击塔菲：${name}互动`);visual.title=`点击塔菲，触发${name}互动`;
  reply.textContent=`已选择${name}，点一下塔菲喵。`;
 };
 desk.querySelectorAll('[data-prop]').forEach(button=>button.addEventListener('click',()=>select(button.dataset.prop)));
 preload();
 const play=async()=>{
  if(document.hidden||!alive)return;
  clearTimeout(resetTimer);stop();const token=++sequence;
  halt(true);visual.setAttribute('aria-busy','true');
  if(!await preload()){if(token===sequence){visual.removeAttribute('aria-busy');reply.textContent='人物素材载入失败，请重新打开应用后再试。';}return;}
  if(token!==sequence||!alive||document.hidden)return;
  const item=props.find(p=>p[0]===selected),kind=item[0],layer=pose(kind),motion=layer.querySelector('.pose-motion');
  visual.removeAttribute('aria-busy');visual.dataset.playing=kind;show(kind);reply.textContent=item[2+taps++%2];
  if(!reduced()){
   const from=getComputedStyle(motion).transform;
   // Pure horizontal skew around the waist: every bottom-edge point keeps its Y coordinate.
   const angle={paw:1.8,coin:.65,abacus:.8,book:.6,caliper:.75,calculator:.65}[kind];
   animations.push(motion.animate([
    {transform:from==='none'?'skewX(0deg)':from},
    {transform:`skewX(${-angle}deg)`,offset:.23},
    {transform:`skewX(${angle}deg)`,offset:.40},
    {transform:`skewX(${-angle*.7}deg)`,offset:.56},
    {transform:`skewX(${angle*.5}deg)`,offset:.73},
    {transform:'skewX(0deg)'}
   ],{duration,easing:'ease-in-out',fill:'both'}));
   layer.querySelectorAll('.action-fx i').forEach((el,i)=>{
    const frames=kind==='coin'?[{opacity:.1,transform:'scale(.7)'},{opacity:1,transform:'scale(1.15)'},{opacity:.1,transform:'scale(.7)'}]:
     kind==='book'?[{opacity:0,transform:'rotateY(0deg)'},{opacity:.7,transform:'rotateY(-90deg)'},{opacity:0,transform:'rotateY(-160deg)'}]:
     kind==='caliper'?[{opacity:.1,transform:'translateX(-7px)'},{opacity:.8,transform:'translateX(7px)'},{opacity:.1,transform:'translateX(-7px)'}]:
     [{opacity:.1},{opacity:.8},{opacity:.1}];
    animations.push(el.animate(frames,{duration:kind==='book'?1000:650,delay:300+i*100,iterations:kind==='book'?1:2,easing:'ease-in-out'}));
   });
  }
  if(settings.sounds)sound(kind,token).catch(()=>{});
  timer=setTimeout(()=>{
   if(!alive||token!==sequence)return;
   show(base);visual.removeAttribute('data-playing');
   resetTimer=setTimeout(()=>{if(alive&&token===sequence)resetMotion();},400);
  },duration);
 };
 visual.addEventListener('click',play);
 const onKey=e=>{if(e.key==='Enter'||e.key===' '){e.preventDefault();play();}};
 visual.addEventListener('keydown',onKey);
 const visibility=()=>{if(document.hidden){restore();context?.suspend();}};
 document.addEventListener('visibilitychange',visibility);
 const observer=new IntersectionObserver(entries=>{if(!entries[0].isIntersecting)restore();});observer.observe(visual);
 media.addEventListener('change',restore);
 dispose=()=>{alive=false;restore();observer.disconnect();media.removeEventListener('change',restore);document.removeEventListener('visibilitychange',visibility);visual.removeEventListener('click',play);visual.removeEventListener('keydown',onKey);};
 select(selected);
}
