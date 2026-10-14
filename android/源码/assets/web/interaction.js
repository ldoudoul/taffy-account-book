/* Small, local-only interactions. No network/audio assets or ledger mutations. */
const paths = {
 caliper:'M5 5v12h18V8M5 12h24M12 9v13M19 9v8M9 5h16M9 3v4M13 3v4M17 3v4M21 3v4',
 abacus:'M5 5h22v22H5zM5 12h22M10 6v20M16 6v20M22 6v20M8 9h4M14 9h4M20 9h4M8 17h4M14 20h4M20 17h4',
 wallet:'M4 10h24v16H4zM4 10V6h20v4M21 15h8v6h-8zM24 18h1',
 book:'M7 4h19v24H7zM11 4v24M15 10h7M15 15h7M15 20h4',
 paw:'M10 20c-5 7 0 10 6 6 6 4 11 1 6-6l-6-5zM8 8a2 3 0 1 0 0 6 2 3 0 1 0 0-6M14 4a2 3 0 1 0 0 6 2 3 0 1 0 0-6M21 5a2 3 0 1 0 0 6 2 3 0 1 0 0-6M27 10a2 3 0 1 0 0 6 2 3 0 1 0 0-6',
 coin:'M27 16a11 11 0 1 0-22 0 11 11 0 1 0 22 0M20 11h-6a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-6M16 8v17',
 calculator:'M7 3h18v26H7zM11 7h10v6H11zM11 18h1M16 18h1M21 18h1M11 23h1M16 23h1M21 23h1'
};
const props=[['caliper','游标卡尺','量量你的支出喵～','有尺，不慌喵'],['abacus','算盘','算盘一响，黄金万两喵','噼里啪啦，账算清喵'],['wallet','钱包','钱包空空，快记账喵','再花就瘪啦喵'],['book','小账本','来，记一笔喵','今天的花销写这里喵'],['paw','猫爪','戳一下，记一笔喵','喵爪记账，一爪一个准'],['coin','金币','掉金币啦，快捡喵！','攒起来喵～'],['calculator','计算器','按按按，算清楚喵','按按按，算清楚喵']];
const svg=id=>`<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[id]}"/></svg>`;
export function interactionMarkup(){return `<section class="prop-desk" aria-label="taffy 的互动小物"><div class="prop-heading"><span>taffy 的小物桌</span><small>点一点，陪你算清每一笔</small></div><div class="prop-items">${props.map(([id,name])=>`<button type="button" class="prop-item" data-prop="${id}" aria-label="与${name}互动">${svg(id)}<span>${name}</span></button>`).join('')}</div><div class="prop-reply" role="status" aria-live="polite">今天也在这里陪你喵。</div><button class="prop-entry" type="button" data-action="add">打开小账本 <span>＋</span></button></section>`;}
let context, timer, active=[], sequence=0;
function stop(){clearTimeout(timer);for(const node of active){try{node.stop();}catch{}}active=[];}
async function sound(kind,token){
 const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
 context??=new Audio();await context.resume();if(token!==sequence||document.hidden)return;
 const now=context.currentTime;
 const tone=(freq,start,length,type='sine',end=freq)=>{const o=context.createOscillator(),g=context.createGain();o.type=type;o.frequency.setValueAtTime(freq,now+start);o.frequency.exponentialRampToValueAtTime(end,now+start+length);g.gain.setValueAtTime(.0001,now+start);g.gain.exponentialRampToValueAtTime(.045,now+start+.008);g.gain.exponentialRampToValueAtTime(.0001,now+start+length);o.connect(g);g.connect(context.destination);o.start(now+start);o.stop(now+start+length+.02);o.onended=()=>{o.disconnect();g.disconnect();};active.push(o);};
 if(kind==='paw'){tone(680,0,.32,'triangle',430);tone(470,.12,.24,'sine',300);}
 else if(kind==='coin'||kind==='wallet'){[1450,1940,2420].forEach((f,i)=>tone(f,i*.085,.24));}
 else if(kind==='abacus'){[0,.07,.14,.23,.30].forEach((t,i)=>tone(780+i%2*220,t,.035,'triangle'));}
 else if(kind==='calculator'){tone(960,0,.06,'sine');tone(720,.09,.055);}
 else {const length=kind==='book'?.26:.38,buffer=context.createBuffer(1,context.sampleRate*length,context.sampleRate),data=buffer.getChannelData(0);for(let i=0;i<data.length;i++)data[i]=(Math.random()*2-1)*.05*Math.sin(Math.PI*i/data.length);const n=context.createBufferSource(),filter=context.createBiquadFilter();filter.type='bandpass';filter.frequency.value=kind==='book'?1600:3400;n.buffer=buffer;n.connect(filter);filter.connect(context.destination);n.start();n.onended=()=>{n.disconnect();filter.disconnect();};active.push(n);}
}
export function bindInteractions(root,settings){
 stop();sequence++;document.querySelectorAll("[data-gesture]").forEach(el=>delete el.dataset.gesture);
 const desk=root.querySelector('.prop-desk');if(!desk)return;
 if(!settings.prompts)desk.querySelector('.prop-reply').hidden=true;
 let taps=0;
 desk.querySelectorAll('[data-prop]').forEach(button=>button.addEventListener('click',()=>{
   stop();const token=++sequence,item=props.find(p=>p[0]===button.dataset.prop),reply=desk.querySelector('.prop-reply');
   desk.querySelectorAll('.is-playing').forEach(el=>el.classList.remove('is-playing'));
   button.classList.add('is-playing');const visual=root.querySelector('.companion-visual');if(visual)visual.dataset.gesture=item[0]==='wallet'?'concern':item[0]==='coin'?'money':'smile';reply.textContent=item[2+taps++%2];
   if(settings.sounds&&!document.hidden)sound(item[0],token).catch(()=>{reply.textContent='当前设备暂时无法播放音效，互动仍可使用。';});
   timer=setTimeout(()=>{button.classList.remove('is-playing');if(visual)delete visual.dataset.gesture;},1100);
 }));
}
document.addEventListener('visibilitychange',()=>{if(document.hidden){sequence++;stop();document.querySelectorAll('[data-gesture]').forEach(el=>delete el.dataset.gesture);document.querySelectorAll('.is-playing').forEach(el=>el.classList.remove('is-playing'));context?.suspend();}});
