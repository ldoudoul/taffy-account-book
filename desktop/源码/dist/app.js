import {interactionMarkup,bindInteractions} from './interaction.js';
import {decorateCards} from './decorations.js';
import {EXPENSE,INCOME,emptyState,cents,validateState,applyAction,analyze,exportCSV} from './engine.js';

const $=selector=>document.querySelector(selector), main=$('#main'), modal=$('#modal');
const STORAGE='pocket-companion-ledger-v1';
const desktopMode=new URLSearchParams(location.search).get('desktop')==='1';
let desktopRevision=0,startupEnabled=false;
async function nativeRequest(request){const reply=await window.pywebview.api.request(request);if(!reply.ok)throw Error(reply.error||'桌面操作失败');return reply.result;}
const localDay=()=>{const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
const today=localDay(), currentMonth=today.slice(0,7);
let selectedMonth=currentMonth,route=['home','bills','settings'].includes(location.hash.slice(1))?location.hash.slice(1):'home';
let state=emptyState(),lastRaw=null,storageError='',recoveryRaw=null,pythonAvailable=false,busy=false,entryType='expense',editingId=null,pendingImport=null;
let filters=monthFilters(selectedMonth),toastTimer,characterObserver,lastMood=null,feedbackOnce=false;
let pythonCalculation=null,renderEpoch=0,previousRenderKey='',amountFrames=[];
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const ICONS={
  home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z"/>',
  receipt:'<path d="M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6"/>',
  settings:'<path d="M9 3h6l1 3 3 1 2 5-2 5-3 1-1 3H9l-1-3-3-1-2-5 2-5 3-1z"/><circle cx="12" cy="12" r="3"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',chevron:'<path d="m9 5 7 7-7 7"/>',left:'<path d="m15 5-7 7 7 7"/>',
  wallet:'<path d="M3 7h17v13H3zM3 7V4h14v3M15 11h6v5h-6z"/><circle cx="17" cy="13.5" r=".4"/>',
  up:'<path d="M12 19V5m-6 6 6-6 6 6"/>',down:'<path d="M12 5v14m-6-6 6 6 6-6"/>',
  close:'<path d="m6 6 12 12M6 18 18 6"/>',edit:'<path d="m14 4 6 6M3 21l2-7L16 3l5 5-11 11z"/>',
  food:'<path d="M4 3v7m3-7v7m3-7v7M4 7h6M7 10v11M17 21V3c-4 3-4 9 0 9"/>',
  bus:'<rect x="5" y="3" width="14" height="16" rx="3"/><path d="M5 10h14M8 19v2m8-2v2M8 14h1m6 0h1"/>',
  bag:'<path d="M5 7h14l2 14H3zM9 7V5a3 3 0 0 1 6 0v2"/>',
  game:'<path d="M7 7h10c3 0 5 11 3 12-2 1-4-4-6-4h-4c-2 0-4 5-6 4-2-1 0-12 3-12zM6 11h5m-2.5-2.5v5M16 10h.1M18 13h.1"/>',
  book:'<path d="M12 5C8 2 5 3 3 4v16c3-2 6-2 9 0 3-2 6-2 9 0V4c-2-1-5-2-9 1zM12 5v15"/>',
  heart:'<path d="M12 21S2 14 2 8a5 5 0 0 1 10-1 5 5 0 0 1 10 1c0 6-10 13-10 13z"/>',
  more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
  gift:'<path d="M4 10h16v11H4zM3 6h18v4H3zM12 6v15"/><path d="M12 6S3 6 6 3c3-3 6 3 6 3 0 0 3-6 6-3s-6 3-6 3z"/>',
  briefcase:'<rect x="3" y="7" width="18" height="14" rx="2"/><path d="M8 7V3h8v4M3 12h18M10 12v3h4v-3"/>',
  download:'<path d="M12 3v12m-5-5 5 5 5-5M4 16v5h16v-5"/>',upload:'<path d="M12 16V4m-5 5 5-5 5 5M4 16v5h16v-5"/>',
  shield:'<path d="m12 3 8 3v7c0 5-8 8-8 8s-8-3-8-8V6zM8 12l3 3 5-6"/>',spark:'<path d="m12 2 2.8 7.2L22 12l-7.2 2.8L12 22l-2.8-7.2L2 12l7.2-2.8z"/>',
};
const icon=(name,cls='')=>`<svg class="icon ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name]||ICONS.more}</svg>`;
const escape=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const symbol=()=>({CNY:'¥',USD:'$',EUR:'€',JPY:'¥'}[state.settings.currency]);
const number=n=>(n/100).toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2});
const money=n=>`${symbol()}${number(n)}`;
const monthLabel=m=>`${Number(m.slice(0,4))} 年 ${Number(m.slice(5))} 月`;
const MOODS={
  neutral:{label:'等待新计划',text:'先给这个月一个小计划，我们一起慢慢记录。'},
  happy:{label:'元气满满',text:'预算还很充裕呢！把小日常，过成喜欢的样子。'},
  relaxed:{label:'轻松愉快',text:'生活安排得刚刚好，今天也一起好好记录吧。'},
  worried:{label:'平静陪伴',text:'生活费正在有序使用，我们一起照顾接下来的日常。'},
  low:{label:'留意预算',text:'这个月剩余预算不多啦，我们一起留意一下。'},
  sad:{label:'温柔陪伴',text:'剩余预算不多啦，我们一起留意接下来的日常。'},
};
const CAT={餐饮:['food','#fcf0e7','#cda78a'],交通:['bus','#ebf1fb','#92a8cc'],购物:['bag','#f3ebfa','#b99ccc'],娱乐:['game','#fcecf2','#d899b1'],学习:['book','#edf4ee','#96b2a0'],住房:['home','#f4ede5','#b8a38d'],医疗:['heart','#fbeef0','#ce9aa3'],其他:['more','#f0edf6','#b0a2c5'],生活费:['wallet','#e9f6ef','#8bb49f'],工资:['briefcase','#e9f4f0','#7eab98'],兼职:['briefcase','#edf3fa','#8fa5bf'],红包:['gift','#fbeef2','#ca9bac']};

function monthFilters(m){const [y,mo]=m.split('-').map(Number);const last=new Date(y,mo,0).getDate();return {start:m+'-01',end:`${m}-${last}`,type:'',category:''};}
function load(){
  try{lastRaw=localStorage.getItem(STORAGE);if(lastRaw)state=validateState(JSON.parse(lastRaw));}
  catch(error){storageError='无法读取本机账本：'+error.message;recoveryRaw=lastRaw;}
}
if(!desktopMode)load();

async function engine(request){
  if(desktopMode)return nativeRequest({...request,revision:desktopRevision});
  if(pythonAvailable&&navigator.onLine){
    let response;
    try{response=await fetch('./api/engine',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(request),signal:AbortSignal.timeout(2500)});}
    catch(error){pythonAvailable=false;updateEngineStatus();}
    if(response){
      const data=await response.json();
      if(!response.ok)throw Error(data.error||'Python 校验失败');
      return data;
    }
  }
  if(request.operation==='action'){
    const next=applyAction(request.state,request.action,request.payload);
    return {state:next,analysis:analyze(next,request.month),filteredAnalysis:analyze(next,request.month,request.filters)};
  }
  if(request.operation==='validate')return {state:validateState(request.data)};
  if(request.operation==='analyze')return analyze(request.state,request.month,request.filters);
  if(request.operation==='csv')return {csv:exportCSV(request.state)};
  throw Error('未知操作');
}
async function checkPython(){
  if(desktopMode){pythonAvailable=true;updateEngineStatus();return;}
  try{const r=await fetch('./api/health',{signal:AbortSignal.timeout(1200)});const value=await r.json();pythonAvailable=r.ok&&value.engine==='python';}catch{pythonAvailable=false;}
  updateEngineStatus();
  if(pythonAvailable)refreshPythonCalculation();
}
function viewAnalysis(m,filter=null){
  if(pythonCalculation?.state===state&&pythonCalculation.month===m){
    if(filter===null)return pythonCalculation.summary;
    if(JSON.stringify(filter)===pythonCalculation.filterKey)return pythonCalculation.filtered;
  }
  return analyze(state,m,filter||{});
}
async function refreshPythonCalculation(){
  if(!pythonAvailable)return;
  const snapshot=state,m=selectedMonth,filter=route==='bills'?{...filters}:monthFilters(m),epoch=renderEpoch;
  try{
    const [summary,filtered]=await Promise.all([
      engine({operation:'analyze',state:snapshot,month:m}),
      engine({operation:'analyze',state:snapshot,month:m,filters:filter})
    ]);
    if(state!==snapshot||selectedMonth!==m||renderEpoch!==epoch)return;
    pythonCalculation={state:snapshot,month:m,summary,filtered,filterKey:JSON.stringify(filter)};
    render();
  }catch(error){toast('计算失败：'+error.message);}
}
function updateEngineStatus(){
  $('#engine-status').textContent=desktopMode?'Python · SQLite 本机账本':pythonAvailable&&navigator.onLine?'Python · 本机账本':navigator.onLine?'本机账本':'离线 · 本机账本';
}
function persist(next){
  if(recoveryRaw!==null)throw Error('原账本读取失败，请先导出原始数据或导入有效备份');
  const stored=localStorage.getItem(STORAGE);
  if(stored!==lastRaw)throw Error('另一个窗口更新了账本，请刷新后重试，避免覆盖');
  const raw=JSON.stringify(next);
  try{localStorage.setItem(STORAGE,raw);}catch{throw Error('本机存储失败，请检查浏览器存储空间；本次操作尚未保存');}
  state=next;lastRaw=raw;storageError='';
}
async function commit(action,payload){
  const original=lastRaw;
  const filter=route==='bills'?{...filters}:monthFilters(selectedMonth);
  const result=await engine({operation:'action',state,action,payload,month:selectedMonth,filters:filter});
  const next=result.state;
  if(lastRaw!==original)throw Error('账本在保存期间已更新，请重新提交');
  if(desktopMode){state=next;desktopRevision=result.revision;lastRaw=JSON.stringify(next);storageError='';}else persist(next);pythonCalculation={state:next,month:selectedMonth,summary:result.analysis,filtered:result.filteredAnalysis,filterKey:JSON.stringify(filter)};
  if(['add','edit','delete'].includes(action))feedbackOnce=true;
  applySettings();render();
}
function toast(message){clearTimeout(toastTimer);$('#toast').textContent=message;$('#toast').classList.add('visible');toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3800);}
function applySettings(){document.body.classList.toggle('reduce-motion',!state.settings.animations||reduced.matches);}
function monthControl(){return `<div class="month-control"><button data-action="prev-month" aria-label="上个月">${icon('left')}</button><input id="month-picker" type="month" value="${selectedMonth}" min="0001-01" max="9999-12" aria-label="查看月份"><button data-action="next-month" aria-label="下个月">${icon('chevron')}</button></div>`;}
function heading(title,sub){return `<div class="page-heading"><div><p class="eyebrow">LITTLE MOMENTS, WELL KEPT</p><h1>${title}</h1><p class="heading-sub">${sub}</p></div><div class="heading-controls">${monthControl()}<button class="primary-btn" data-action="add">${icon('plus')}记一笔</button></div></div>`;}
function cardMetric(label,n,name,style,caption){return `<article class="card metric"><span class="metric-icon ${style}">${icon(name)}</span><div><p class="metric-label">${label}</p><p class="metric-value">${symbol()}<span class="count" data-cents="${n}">${number(n)}</span></p><p class="metric-caption">${caption}</p></div></article>`;}
function companion(mood){const m=MOODS[mood];return `<div class="companion-card"><div class="companion-content"><p class="companion-tag">${icon('spark')}你的记账伙伴</p><p class="companion-name">taffy，陪你每一天</p>${state.settings.prompts?`<p class="speech">${m.text}</p>`:''}<span class="mood-pill"><span>✧</span>${m.label}</span></div><div class="companion-visual" data-mood="${mood}" role="img" aria-label="taffy上半身：${m.label}"><div class="character"></div><i class="tear"></i><i class="tear second"></i></div></div>`;}
function home(){
  const a=viewAnalysis(selectedMonth);const hasBudget=a.budget!==null,over=hasBudget&&a.remaining<0;
  const monthItems=state.transactions.filter(t=>t.date.startsWith(selectedMonth));
  const recent=viewAnalysis(selectedMonth,monthFilters(selectedMonth)).filtered.slice(0,5);
  return `${heading('今天也要好好记帐喵','嗨，今天也一起照顾小日常吧 <span class="dot">✧</span> 每一笔都算数')}
  <section class="card hero ${!state.settings.character?'no-character':''}"><div class="balance-area"><div class="balance-header"><p class="card-label">${icon('wallet')}${over?'本月超支':'本月剩余预算'}</p><button class="ghost-btn" data-action="budget">${hasBudget?'调整预算':'设置预算'}${icon('chevron')}</button></div>
  <div class="balance-figure ${over?'over':''}"><span class="currency">${hasBudget?symbol():''}</span><span class="count" ${hasBudget?`data-cents="${Math.abs(a.remaining)}"`:''}>${hasBudget?number(Math.abs(a.remaining)):'待设置'}</span></div>
  <p class="budget-note">${hasBudget?`本月生活费 <strong>${money(a.budget)}</strong> <span class="dot">·</span> 收入单独统计`:'给这个月一个小计划，开始轻松记账。'}</p>
  <div class="progress-heading"><span>生活费使用进度</span><b>${hasBudget?(a.expense/a.budget*100).toFixed(1)+'%':'尚未设置'}</b></div><div class="progress-track ${over?'overspend':''}"><div class="progress-fill" style="--progress:${a.progress}%"></div></div><p class="progress-footer"><span>${hasBudget?`已支出 ${money(a.expense)}`:'预算按月独立保存'}</span><span>${over?`超支 ${money(-a.remaining)}`:hasBudget?`剩余 ${(Math.max(0,a.remaining)/a.budget*100).toFixed(1)}%`:'设置预算不产生收入账单'}</span></p></div>${state.settings.character?companion(a.mood):''}</section>${state.settings.character?interactionMarkup():''}
  <section class="metrics">${cardMetric('本月生活费预算',a.budget||0,'wallet','','每个月，独立的小计划')}${cardMetric('本月收入',a.income,'up','green','收入不会自动增加预算')}${cardMetric('本月支出',a.expense,'down','pink',`${monthItems.filter(t=>t.type==='expense').length} 笔日常，认真记录`)}</section>
  <div class="dashboard-grid"><section class="card section-card"><div class="section-title"><h2>最近七天的小日常</h2><span class="chart-summary"><i></i>每日支出</span></div>${weeklyChart(monthItems)}</section><section class="card section-card"><div class="section-title"><h2>钱都花在哪里</h2><span>本月支出分布</span></div>${categoryChart(monthItems,a.expense)}</section></div>
  <section class="card recent-card"><div class="section-title"><h2>近期账单</h2><button class="ghost-btn" data-route="bills">查看全部${icon('chevron')}</button></div>${recent.length?recent.map(billRow).join(''):empty('还没有记下第一笔','从今天的一顿饭、一杯咖啡开始。',true)}</section>`;
}
function weeklyChart(items){
  const end=selectedMonth===currentMonth?new Date(today+'T12:00:00'):new Date(monthFilters(selectedMonth).end+'T12:00:00');
  const days=Array.from({length:7},(_,i)=>{const d=new Date(end);d.setDate(end.getDate()-6+i);const value=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;return {date:value,label:`${d.getMonth()+1}/${d.getDate()}`,amount:items.filter(t=>t.date===value&&t.type==='expense').reduce((s,t)=>s+t.amount,0)};});
  const max=Math.max(...days.map(d=>d.amount),1);
  return `<div class="bar-chart" role="img" aria-label="${days.map(d=>d.label+'支出'+money(d.amount)).join('；')}">${days.map(d=>`<div class="bar-col" title="${d.date}：${money(d.amount)}"><span class="bar-value">${d.amount?number(d.amount):''}</span><div class="bar" style="--height:${d.amount?Math.max(5,d.amount/max*83):3}%"></div></div>`).join('')}</div><div class="chart-dates">${days.map(d=>`<span>${d.label}</span>`).join('')}</div>${days.every(d=>!d.amount)?'<p class="chart-empty">记录之后，这里会慢慢长出你的生活轨迹。</p>':''}`;
}
function categoryChart(items,total){
  const colors=['#ab91d1','#e7b4c6','#b4d4c3','#dbcbaf','#b0c6e5','#d3b9d7','#bad6d8','#d2c9de'];
  const values=EXPENSE.map(category=>({category,amount:items.filter(t=>t.type==='expense'&&t.category===category).reduce((s,t)=>s+t.amount,0)})).filter(x=>x.amount>0).sort((a,b)=>b.amount-a.amount);
  let sum=0;const gradient=values.map((x,i)=>{const start=sum;sum+=x.amount/total*100;return `${colors[i]} ${start}% ${sum}%`;}).join(',')||'#f0eaf7 0% 100%';
  return `<div class="category-chart"><div class="donut" style="--donut:${gradient}" role="img" aria-label="本月支出分类统计"><div class="donut-center"><strong>${values.length}</strong>支出分类</div></div><div class="legend">${values.length?values.slice(0,4).map((x,i)=>`<div class="legend-row"><i style="--color:${colors[i]}"></i><span>${x.category}</span><span class="legend-amount">${(x.amount/total*100).toFixed(0)}%</span></div>`).join('')+(values.length>4?`<div class="legend-row"><span>另有 ${values.length-4} 个分类</span></div>`:''):'<div class="legend-row"><i style="--color:#d9cbea"></i><span>等待第一笔支出</span></div><div class="legend-row"><span>慢慢记，不着急。</span></div>'}</div></div>`;
}
function billRow(t){const [name,bg,color]=CAT[t.category];return `<button class="bill-row" data-action="detail" data-id="${escape(t.id)}" aria-label="${escape(t.category)}，${t.type==='income'?'收入':'支出'} ${money(t.amount)}，${t.date}"><span class="category-icon" style="--tile-bg:${bg};--tile-ink:${color}">${icon(name)}</span><div class="bill-copy"><strong>${escape(t.category)}</strong><span class="bill-type">${t.type==='income'?'收入':'支出'}</span><p>${escape(t.note||'无备注')}</p></div><div class="bill-amount ${t.type}"><strong>${t.type==='income'?'+':'−'} ${money(t.amount)}</strong><small>${t.date}</small></div><span class="row-chevron">${icon('chevron')}</span></button>`;}
function empty(title,description,add=false){return `<div class="empty-state"><div class="empty-symbol">✧</div><strong>${title}</strong><p>${description}</p>${add?`<button class="secondary-btn" data-action="add">${icon('plus')}记下第一笔</button>`:''}</div>`;}
function bills(){return `${heading('一笔记账，心里有数','翻翻你的日常记录 <span class="dot">✧</span> 数据只保存在本机')}<section class="card filters"><div class="filter-fields"><div class="field"><label for="filter-start">开始日期</label><input type="date" id="filter-start" value="${filters.start}"></div><div class="field"><label for="filter-end">结束日期</label><input type="date" id="filter-end" value="${filters.end}"></div><div class="field"><label for="filter-type">收支类型</label><select id="filter-type"><option value="">全部类型</option><option value="expense" ${filters.type==='expense'?'selected':''}>支出</option><option value="income" ${filters.type==='income'?'selected':''}>收入</option></select></div><div class="field"><label for="filter-category">账单分类</label><select id="filter-category"><option value="">全部分类</option>${[...new Set([...EXPENSE,...INCOME])].map(c=>`<option ${filters.category===c?'selected':''}>${c}</option>`).join('')}</select></div><button class="secondary-btn" data-action="clear-filter">清空筛选</button></div><p class="filter-error" id="filter-error"></p><div id="filter-summary"></div></section><section class="card bill-list-card" id="bill-results"></section>`;}
function updateBillResults(){
  const invalid=filters.start&&filters.end&&filters.start>filters.end;
  $('#filter-error').textContent=invalid?'开始日期不能晚于结束日期':'';
  const a=viewAnalysis(selectedMonth,filters);const results=invalid?[]:a.filtered;
  $('#filter-summary').innerHTML=`<div class="filter-summary"><span class="result-count">共 <b>${results.length}</b> 笔记录${filters.start||filters.end?' · 当前日期范围':' · 全部月份'}</span><span>收入 <b class="positive">+ ${money(invalid?0:a.totals.income)}</b></span><span>支出 <b>− ${money(invalid?0:a.totals.expense)}</b></span></div>`;
  if(!results.length){$('#bill-results').innerHTML=empty(invalid?'请调整日期范围':state.transactions.length?'没有符合条件的账单':'账本还是空白的',invalid?'正确的日期范围会显示对应账单。':state.transactions.length?'试试调整条件，或清空筛选。':'每个小日常，都值得被记下。',!state.transactions.length);return;}
  const groups=new Map();for(const t of results){if(!groups.has(t.date))groups.set(t.date,[]);groups.get(t.date).push(t);}
  $('#bill-results').innerHTML=Array.from(groups.entries()).map(([day,items])=>`<div class="day-heading"><b>${day===today?'今天 · ':''}${day}</b><span>${items.length} 笔 · 支出 ${money(items.filter(t=>t.type==='expense').reduce((a,t)=>a+t.amount,0))}</span></div>${items.map(billRow).join('')}`).join('');
}
function settingSwitch(key,label,description){return `<div class="setting-row"><div class="setting-copy"><strong>${label}</strong><p>${description}</p></div><button class="switch" role="switch" aria-label="${label}" aria-checked="${state.settings[key]}" data-setting="${key}"></button></div>`;}
function desktopStartupCard(){return `<section class="card settings-card"><h2>Windows 启动</h2><div class="setting-row"><div class="setting-copy"><strong>开机自动启动</strong><p>仅当前用户，默认关闭；开机启动在后台等待。</p></div><button class="switch" role="switch" aria-label="开机自动启动" aria-checked="${startupEnabled}" data-action="toggle-autostart"></button></div><div class="info-box">桌面账本使用 SQLite，关闭重开后保留。卸载保留账本，方便恢复；自启动项随卸载移除。再次点击桌面图标可显示已在后台运行的窗口。</div></section>`;}
async function refreshStartup(){if(!desktopMode)return;try{const status=await nativeRequest({operation:'autostart'});startupEnabled=status.enabled;document.querySelector('[data-action="toggle-autostart"]')?.setAttribute('aria-checked',String(startupEnabled));}catch(error){toast('无法读取自启动状态：'+error.message);}}
function settings(){const a=analyze(state,selectedMonth);return `${heading('让记账，更合你的心意。','你的习惯，你来决定 <span class="dot">✧</span> 默认无声音')}<div class="settings-grid"><section class="card settings-card"><h2>陪伴与界面</h2><p class="settings-description">保留你喜欢的部分，让日常记录更轻松。</p>${settingSwitch('character','显示记账伙伴','只展示参考人物上半身，不遮挡账单与金额。')}${settingSwitch('prompts','显示角色提示','温柔的小提醒，关闭后仍保留心情状态。')}${settingSwitch('sounds','互动音效','默认关闭；仅主动点击道具时播放轻量合成音效。')}${settingSwitch('animations','界面与人物动画','关闭即减少动画；同时尊重系统减少动态效果。')}<div class="setting-row"><div class="setting-copy"><strong>币种显示</strong><p>只修改显示符号，不进行汇率换算。</p></div><select id="currency" aria-label="币种显示">${[['CNY','人民币 CNY'],['USD','美元 USD'],['EUR','欧元 EUR'],['JPY','日元 JPY']].map(([v,l])=>`<option value="${v}" ${state.settings.currency===v?'selected':''}>${l}</option>`).join('')}</select></div></section>
  <section class="card settings-card"><h2>数据与备份</h2><p class="settings-description">账本属于你。记得为小日常留一份备份。</p><div class="backup-actions"><button class="secondary-btn" data-action="export-json">${icon('download')}完整 JSON 备份</button><button class="secondary-btn" data-action="export-csv">${icon('receipt')}导出 CSV 账单</button><button class="primary-btn" data-action="import">${icon('upload')}从 JSON 备份恢复</button></div><div class="info-box"><strong>手机和电脑的数据不会自动同步。</strong><br>${desktopMode?'桌面账本保存在当前Windows用户的SQLite数据库中，可通过备份转移。网页原账本不会自动迁入；请先从网页导出JSON，再在桌面版导入。':'每个浏览器 / 设备分别保存账本，可通过备份手动转移。清理网站数据、使用隐私模式或更换访问地址，可能导致原账本无法访问。'}请定期导出备份。</div><p class="offline-note">${icon('shield')}本地优先 · 无账号 · 不上传到云端</p></section>
  <section class="card settings-card"><h2>每月生活费</h2><p class="settings-description">${monthLabel(selectedMonth)} · 每个月独立设置，历史数据会保留。</p><div class="budget-settings"><div><p class="mini-label">当前查看月份的预算</p><strong>${a.budget?money(a.budget):'尚未设置'}</strong></div><button class="secondary-btn" data-action="budget">${a.budget?'调整预算':'设置预算'}</button></div><div class="info-box">剩余预算 = 当月生活费预算 − 当月支出。<br>收入单独统计，需要增加可用额度时，请主动调整预算。设置预算不会自动产生收入账单。</div></section>
  ${desktopMode?desktopStartupCard():''}<section class="card settings-card"><h2>在手机上使用</h2><p class="settings-description">响应式网页 / PWA，不需要手机安装 Windows 程序。</p><div class="install-guide"><p><b>iPhone / iPad：</b>在 Safari 打开部署后的 HTTPS 地址 → 分享 → 添加到主屏幕。</p><p><b>Android：</b>在支持的浏览器中打开 → 菜单 → 安装应用 / 添加到主屏幕。</p><p>首次联网打开并完成资源缓存后，可离线记账。当前本机地址仅供这台电脑预览；手机正式访问需要 HTTPS 部署。</p></div><div class="info-box" id="pwa-status">${window.isSecureContext?'当前页面具备安全上下文，正在检查离线缓存。':'当前地址不是安全上下文，离线安装需要 HTTPS。'}</div></section></div>`;}
function render(){
  renderEpoch++;
  const key=route+selectedMonth,oldAmounts=previousRenderKey===key?Array.from(document.querySelectorAll('.count[data-cents]')).map(el=>Number(el.dataset.cents)):[];
  const previous=lastMood;lastMood=viewAnalysis(selectedMonth).mood;
  main.innerHTML=(storageError?`<div class="app-error" role="alert">${escape(storageError)} <button class="link-btn" data-action="recover">处理原始数据</button></div>`:'')+(route==='home'?home():route==='bills'?bills():settings());
  document.querySelectorAll('[data-route]').forEach(button=>button.classList.toggle('active',button.dataset.route===route));
  $('#breadcrumb').textContent={home:'首页',bills:'账单',settings:'设置'}[route];
  if(route==='bills')updateBillResults();
  decorateCards(main);
  hydrateIcons();observeCharacter();bindInteractions(main,state.settings);
  if(previous&&previous!==lastMood)$('.companion-visual')?.classList.add('mood-changing');
  if(feedbackOnce){const visual=$('.companion-visual');visual?.classList.remove('mood-changing');visual?.classList.add('feedback');feedbackOnce=false;}
  if(route==='settings'){updatePWAStatus();refreshStartup();}
  animateAmounts(oldAmounts);previousRenderKey=key;
}
function animateAmounts(previous){
  amountFrames.forEach(cancelAnimationFrame);amountFrames=[];
  if(!state.settings.animations||reduced.matches||document.hidden)return;
  document.querySelectorAll('.count[data-cents]').forEach((el,i)=>{
    const value=Number(el.dataset.cents),from=previous[i];
    if(from===undefined||from===value)return;
    el.setAttribute('aria-label',number(value));const started=performance.now();
    const frame=time=>{const t=Math.min(1,(time-started)/190);el.textContent=number(Math.round(from+(value-from)*(1-(1-t)**3)));if(t<1&&el.isConnected)amountFrames.push(requestAnimationFrame(frame));else el.textContent=number(value);};
    amountFrames.push(requestAnimationFrame(frame));
  });
}
function hydrateIcons(){document.querySelectorAll('[data-icon]').forEach(el=>el.innerHTML=icon(el.dataset.icon));}
function observeCharacter(){characterObserver?.disconnect();const el=$('.companion-visual');if(!el)return;characterObserver=new IntersectionObserver(entries=>{el.classList.toggle('character-paused',!entries[0].isIntersecting);},{threshold:.1});characterObserver.observe(el);}
function openDialog(content,focus){
  if(busy)return;$('#modal-content').innerHTML=content;if(!modal.open)modal.showModal();
  requestAnimationFrame(()=>{const el=focus?$(focus):$('#modal-content button,#modal-content input');el?.focus({preventScroll:true});});
}
const modalHead=title=>`<div class="modal-heading"><h2>${title}</h2><button class="close-btn" data-action="close" aria-label="关闭弹窗">${icon('close')}</button></div>`;
function budgetDialog(first=false){
  const value=state.budgets[selectedMonth];
  if(first){openDialog(`<form id="budget-form" class="onboard"><div class="onboard-mark">✳</div><p class="eyebrow">HELLO, YOUR LITTLE COMPANION</p><h2>这个月准备多少生活费？</h2><p>给日常一个小计划。<br>和taffy一起，把生活记得刚刚好。</p><div class="field"><label for="budget-month">预算月份</label><input type="month" id="budget-month" name="month" value="${selectedMonth}" required></div><div class="amount-field"><label for="budget-amount">本月生活费预算</label><div class="amount-input-wrap"><span>${symbol()}</span><input name="value" id="budget-amount" inputmode="decimal" autocomplete="off" placeholder="0.00" aria-label="本月生活费预算" required maxlength="13"></div></div><p class="form-error" id="form-error" role="alert"></p><button class="primary-btn" type="submit">开始我的小账本${icon('chevron')}</button><p class="onboard-foot">预算不会生成收入账单 · 数据只保存在这台设备</p><button class="ghost-btn" type="button" data-action="close" style="margin-top:12px">稍后设置</button></form>`,'#budget-amount');}
  else{openDialog(`${modalHead(value?'调整本月预算':'设置本月预算')}<form id="budget-form"><div class="field"><label for="budget-month">预算月份</label><input type="month" id="budget-month" name="month" value="${selectedMonth}" required></div><div class="amount-field" style="margin-top:18px"><label for="budget-amount">本月生活费预算</label><div class="amount-input-wrap"><span>${symbol()}</span><input id="budget-amount" name="value" inputmode="decimal" autocomplete="off" value="${value?(value/100).toFixed(2):''}" placeholder="0.00" required maxlength="13"></div></div><p class="settings-description">每个月独立保存。调整预算不会增加收入账单。</p><p class="form-error" id="form-error" role="alert"></p><div class="modal-footer"><button class="secondary-btn" type="button" data-action="close">取消</button><button class="primary-btn" type="submit">保存预算</button></div></form>`,'#budget-amount');}
}
function entryDialog(item=null){
  editingId=item?.id||null;entryType=item?.type||'expense';
  openDialog(`${modalHead(item?'修改这笔账单':'记下今天的小日常')}<form id="entry-form"><div class="entry-tabs ${entryType}" role="group" aria-label="收支类型"><button type="button" data-entry-type="expense" class="${entryType==='expense'?'selected':''}" aria-pressed="${entryType==='expense'}">支出</button><button type="button" data-entry-type="income" class="${entryType==='income'?'selected':''}" aria-pressed="${entryType==='income'}">收入</button></div><div class="amount-field"><label for="entry-amount">${item?'账单金额':'金额'}</label><div class="amount-input-wrap"><span>${symbol()}</span><input id="entry-amount" name="amount" inputmode="decimal" autocomplete="off" placeholder="0.00" value="${item?(item.amount/100).toFixed(2):''}" required maxlength="13"></div></div><div class="entry-grid"><div class="field"><label for="entry-category">分类</label><select name="category" id="entry-category">${categoryOptions(entryType,item?.category)}</select></div><div class="field"><label for="entry-date">日期</label><input id="entry-date" name="date" type="date" value="${item?.date||today}" required></div><div class="field full"><label for="entry-note">备注 <span style="color:#c4b7cd">· 选填，最多 200 字</span></label><textarea name="note" id="entry-note" maxlength="200" placeholder="这笔钱，花在了怎样的小日常？">${escape(item?.note||'')}</textarea></div></div><p class="form-error" id="form-error" role="alert"></p><div class="modal-footer"><button class="secondary-btn" type="button" data-action="close">取消</button><button class="primary-btn" type="submit">${item?'保存修改':'保存这笔账'}</button></div></form>`,'#entry-amount');
}
function categoryOptions(type,selected){return (type==='expense'?EXPENSE:INCOME).map(c=>`<option ${c===selected?'selected':''}>${c}</option>`).join('');}
function detailDialog(id){const t=state.transactions.find(t=>t.id===id);if(!t){toast('这条账单已更新，请重新打开');return;}openDialog(`${modalHead('这一笔的小日常')}<p class="detail-amount ${t.type==='income'?'positive':''}">${t.type==='income'?'+':'−'} ${money(t.amount)}</p><dl class="detail-grid"><dt>收支类型</dt><dd>${t.type==='income'?'收入':'支出'}</dd><dt>分类</dt><dd>${escape(t.category)}</dd><dt>日期</dt><dd>${t.date}</dd><dt>备注</dt><dd>${escape(t.note||'无备注')}</dd></dl><div class="modal-footer"><button class="danger-btn" data-action="delete-confirm" data-id="${id}">删除账单</button><button class="primary-btn" data-action="edit" data-id="${id}">${icon('edit')}修改账单</button></div>`);}
function deleteDialog(id){const t=state.transactions.find(t=>t.id===id);if(!t)return;openDialog(`${modalHead('确认删除这笔账单？')}<p class="confirm-text"><strong>${t.date} · ${escape(t.category)} · ${money(t.amount)}</strong><br>删除后，将重新计算对应月份的支出、余额和人物心情。此操作无法在应用内撤销。</p><p class="form-error" id="form-error" role="alert"></p><div class="modal-footer"><button class="secondary-btn" data-action="detail" data-id="${id}">保留账单</button><button class="danger-btn" data-action="delete" data-id="${id}">确认删除</button></div>`);}
function importDialog(data){
  pendingImport=data;const duplicates=data.transactions.filter(t=>state.transactions.some(x=>x.id===t.id)).length;
  openDialog(`${modalHead('恢复你的生活账本')}<p class="confirm-text">文件已校验。请选择导入方式。</p><div class="import-preview"><strong>${data.transactions.length}</strong> 笔账单 · <strong>${Object.keys(data.budgets).length}</strong> 个月预算<br>其中 ${duplicates} 笔标识与本机账单重复。</div><form id="import-form"><div class="import-options"><label class="import-option"><input type="radio" name="mode" value="merge" checked><span>合并到当前账本<small>按唯一标识去重；重复账单、本机已有预算和设置保留。</small></span></label><label class="import-option"><input type="radio" name="mode" value="replace"><span>覆盖当前账本<small>用备份中的账单、预算和设置替换当前数据。</small></span></label></div><p class="download-warning">覆盖前先生成并下载当前 JSON 备份，再显示最终确认。建议确认文件已保存在下载目录。</p><p class="form-error" id="form-error" role="alert"></p><div class="modal-footer"><button class="secondary-btn" type="button" data-action="close">取消</button><button class="primary-btn" type="submit">继续导入</button></div></form>`);
}
async function replaceConfirm(){if(!await downloadJSON(state,'覆盖前备份'))return;openDialog(`${modalHead('确认覆盖当前数据？')}<p class="confirm-text">当前账本的备份已生成并请求下载。请确认下载目录里已有 <strong>“记账喵-覆盖前备份”</strong> 文件，再覆盖当前 ${state.transactions.length} 笔账单。</p><label class="import-option"><input type="checkbox" id="backup-confirm"><span>我已确认备份文件保存成功</span></label><p class="form-error" id="form-error" role="alert"></p><div class="modal-footer"><button class="secondary-btn" data-action="import-back">返回</button><button class="danger-btn" data-action="replace-import">确认覆盖并导入</button></div>`);}
function download(content,name,type){const url=URL.createObjectURL(new Blob([content],{type}));const a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
async function downloadJSON(data,label='完整备份'){if(desktopMode){const result=await nativeRequest({operation:'export',kind:'json',label});if(!result.saved){toast('备份保存已取消，未覆盖数据');return false;}toast('备份已保存：'+result.path);return true;}download(JSON.stringify(data,null,2),`记账喵-${label}-${localDay()}-${Date.now()}.json`,'application/json');return true;}
async function safeTask(task,button){if(busy)return;busy=true;const text=button?.innerHTML;if(button){button.disabled=true;button.textContent='正在保存…';}modal.querySelectorAll('button,input,select,textarea').forEach(el=>{if(el!==button)el.disabled=true;});try{await task();}catch(error){const target=$('#form-error');if(target)target.textContent=error.message;else toast(error.message);}finally{busy=false;if(button?.isConnected){button.disabled=false;button.innerHTML=text;}modal.querySelectorAll('button,input,select,textarea').forEach(el=>el.disabled=false);}}

document.addEventListener('click',event=>{
  const button=event.target.closest('button');if(!button||button.disabled)return;
  if(button.dataset.route){if(busy)return;route=button.dataset.route;location.hash=route;if(route==='bills')filters=monthFilters(selectedMonth);main.classList.remove('page-in');render();void main.offsetWidth;main.classList.add('page-in');window.scrollTo({top:0,behavior:'instant'});return;}
  if(button.dataset.entryType){entryType=button.dataset.entryType;$('.entry-tabs').className='entry-tabs '+entryType;document.querySelectorAll('[data-entry-type]').forEach(b=>{b.classList.toggle('selected',b.dataset.entryType===entryType);b.setAttribute('aria-pressed',b.dataset.entryType===entryType);});$('#entry-category').innerHTML=categoryOptions(entryType);return;}
  if(button.dataset.setting){safeTask(async()=>{await commit('settings',{[button.dataset.setting]:!state.settings[button.dataset.setting]});toast('偏好已保存');},button);return;}
  const action=button.dataset.action,id=button.dataset.id;
  switch(action){
    case 'add':entryDialog();break;
    case 'close':if(!busy)modal.close();break;
    case 'budget':budgetDialog();break;
    case 'detail':detailDialog(id);break;
    case 'edit':entryDialog(state.transactions.find(t=>t.id===id));break;
    case 'delete-confirm':deleteDialog(id);break;
    case 'delete':safeTask(async()=>{await commit('delete',{id});modal.close();toast('账单已删除，对应月份已重新计算');},button);break;
    case 'prev-month':shiftMonth(-1);break;
    case 'next-month':shiftMonth(1);break;
    case 'clear-filter':filters={start:'',end:'',type:'',category:''};render();break;
    case 'export-json':safeTask(async()=>{if(await downloadJSON(state)&&!desktopMode)toast('完整备份已生成，请留意下载目录');},button);break;
    case 'export-csv':safeTask(async()=>{if(desktopMode){const result=await nativeRequest({operation:'export',kind:'csv'});toast(result.saved?'CSV已保存：'+result.path:'已取消保存');return;}const data=await engine({operation:'csv',state});download(data.csv,`记账喵-全部账单-${localDay()}.csv`,'text/csv;charset=utf-8');toast('CSV 账单已生成');},button);break;
    case 'import':if(desktopMode){safeTask(async()=>{const result=await nativeRequest({operation:'import_file'});if(!result.cancelled)importDialog(result.state);},button);}else $('#import-file').click();break;
    case 'toggle-autostart':safeTask(async()=>{const result=await nativeRequest({operation:'autostart',enabled:!startupEnabled});startupEnabled=result.enabled;render();toast(startupEnabled?'系统自启动已开启':'系统自启动已关闭');},button);break;
    case 'import-back':importDialog(pendingImport);break;
    case 'replace-import':if(!$('#backup-confirm').checked){$('#form-error').textContent='请先确认当前备份已保存';break;}safeTask(async()=>{await commit('import',{mode:'replace',data:pendingImport});modal.close();pendingImport=null;toast('备份已恢复，统计已重新计算');},button);break;
    case 'recover':openDialog(`${modalHead('保护原始账本')}<p class="confirm-text">原始账本未被覆盖。请先导出原始内容，再选择有效 JSON 备份恢复。</p><div class="modal-footer"><button class="secondary-btn" data-action="export-raw">导出原始数据</button><button class="primary-btn" data-action="import">选择有效备份</button></div>`);break;
    case 'export-raw':download(recoveryRaw||'','记账喵-原始数据-'+Date.now()+'.json','application/json');toast('原始内容已请求下载');break;
  }
});
function changeMonth(m){if(!m)return;try{analyze(state,m);}catch{toast('请选择有效月份');return;}selectedMonth=m;filters=monthFilters(m);render();refreshPythonCalculation();if(!state.budgets[m])toast(monthLabel(m)+' 尚未设置生活费，可以点击“设置预算”');}
function shiftMonth(delta){const [y,m]=selectedMonth.split('-').map(Number);let year=y,mo=m+delta;if(mo===0){year--;mo=12;}if(mo===13){year++;mo=1;}if(year<1||year>9999)return;changeMonth(`${String(year).padStart(4,'0')}-${String(mo).padStart(2,'0')}`);}
document.addEventListener('change',event=>{
  const target=event.target;
  if(target.id==='month-picker')changeMonth(target.value);
  if(target.id.startsWith('filter-')&&target.id!=='filter-error'&&target.id!=='filter-summary'){filters[target.id.replace('filter-','')]=target.value;updateBillResults();}
  if(target.id==='currency')safeTask(async()=>{await commit('settings',{currency:target.value});toast('币种显示已更新，不进行汇率换算');});
  if(target.id==='budget-month'){const amount=state.budgets[target.value];$('#budget-amount').value=amount?(amount/100).toFixed(2):'';}
});
document.addEventListener('submit',event=>{
  const form=event.target;if(!['entry-form','budget-form','import-form'].includes(form.id))return;event.preventDefault();
  const data=new FormData(form),button=form.querySelector('[type=submit]');
  if(form.id==='entry-form')safeTask(async()=>{
    const amount=cents(data.get('amount'));const original=editingId?state.transactions.find(t=>t.id===editingId):null;
    const payload={id:editingId||crypto.randomUUID(),type:entryType,amount,category:data.get('category'),date:data.get('date'),note:data.get('note'),createdAt:original?.createdAt||new Date().toISOString()};
    await commit(editingId?'edit':'add',payload);modal.close();toast(payload.date.slice(0,7)!==selectedMonth?'已保存到 '+monthLabel(payload.date.slice(0,7))+'，该月统计已更新':'记好啦！余额和taffy的心情已更新');
  },button);
  if(form.id==='budget-form')safeTask(async()=>{const m=data.get('month');await commit('budget',{month:m,value:data.get('value')});selectedMonth=m;filters=monthFilters(m);render();modal.close();toast('生活费预算已保存，不会生成收入账单');},button);
  if(form.id==='import-form'){
    if(data.get('mode')==='replace'){safeTask(replaceConfirm,button);return;}
    safeTask(async()=>{await commit('import',{mode:'merge',data:pendingImport});modal.close();pendingImport=null;toast('合并完成，重复标识已跳过；已有预算和设置保留');},button);
  }
});
$('#import-file').addEventListener('change',async event=>{
  const file=event.target.files[0];event.target.value='';if(!file)return;
  try{if(file.size>16*1024*1024)throw Error('备份文件不能超过 16 MB');const text=await file.text();let parsed;try{parsed=JSON.parse(text);}catch{throw Error('文件不是有效 JSON');}const {state:data}=await engine({operation:'validate',data:parsed});
    if(recoveryRaw!==null){
      openDialog(`${modalHead('恢复有效备份')}<p class="confirm-text">有效备份包含 ${data.transactions.length} 笔账单。请先导出并保留当前原始数据，然后确认恢复。</p><button class="secondary-btn" data-action="export-raw">导出原始数据</button><form id="recovery-form" style="margin-top:18px"><label class="import-option"><input type="checkbox" id="raw-saved" required><span>我已保存原始数据，确认用备份恢复</span></label><div class="modal-footer"><button class="secondary-btn" type="button" data-action="close">取消</button><button class="primary-btn" type="submit">确认恢复</button></div><p class="form-error" id="form-error" role="alert"></p></form>`);
      $('#recovery-form').addEventListener('submit',ev=>{ev.preventDefault();safeTask(async()=>{const raw=JSON.stringify(data);localStorage.setItem(STORAGE,raw);state=data;lastRaw=raw;recoveryRaw=null;storageError='';applySettings();render();modal.close();toast('已恢复有效备份');},ev.target.querySelector('[type=submit]'));});
    }else importDialog(data);
  }catch(error){toast('无法导入：'+error.message);}
});
modal.addEventListener('cancel',event=>{if(busy)event.preventDefault();});
modal.addEventListener('click',event=>{if(event.target===modal&&!busy){const r=modal.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)modal.close();}});
window.addEventListener('hashchange',()=>{const next=location.hash.slice(1);if(['home','bills','settings'].includes(next)&&next!==route){route=next;render();}});
window.addEventListener('storage',event=>{if(event.key===STORAGE){try{if(!event.newValue)throw Error('另一窗口清除了账本');const data=validateState(JSON.parse(event.newValue));lastRaw=event.newValue;state=data;applySettings();render();toast('账本已与这台设备的另一个窗口更新');}catch{toast('另一窗口的数据变更无法读取，请刷新检查');}}});
document.addEventListener('visibilitychange',()=>{document.body.classList.toggle('backgrounded',document.hidden);if(!document.hidden&&localDay().slice(0,7)!==currentMonth)toast('月份已变化，请切换月份设置新的生活费预算。');});
reduced.addEventListener('change',applySettings);
window.addEventListener('online',()=>{checkPython();});window.addEventListener('offline',updateEngineStatus);
async function updatePWAStatus(){const el=$('#pwa-status');if(desktopMode){if(el)el.textContent='桌面版无需网络即可运行；手机网页需单独部署到HTTPS，两端账本独立。';return;}if(!el)return;if(!('serviceWorker'in navigator)||!window.isSecureContext){el.textContent='当前环境不支持离线缓存；手机使用需部署到 HTTPS。';return;}const registrations=await navigator.serviceWorker.getRegistrations();el.textContent=registrations.some(r=>r.active)?'离线资源已就绪。首次联网加载后，可以断网记账。':'离线资源尚未就绪，请保持联网完成首次加载。';}
async function initializeDesktop(){
 try{const initial=await nativeRequest({operation:'get_state'});state=validateState(initial.state);desktopRevision=initial.revision;startupEnabled=initial.startup.enabled;lastRaw=JSON.stringify(state);pythonAvailable=true;applySettings();render();updateEngineStatus();document.body.dataset.desktopReady='true';if(!state.transactions.length&&!Object.keys(state.budgets).length)budgetDialog(true);}
 catch(error){main.innerHTML=`<div class="app-error" role="alert">无法打开本机账本：${escape(error.message)}。请关闭重试，原数据未被替换。</div>`;}
}
if(desktopMode){main.innerHTML='<div class="empty-state">正在打开本机账本…</div>';if(window.pywebview?.api)initializeDesktop();else window.addEventListener('pywebviewready',initializeDesktop,{once:true});}
else{applySettings();render();checkPython();if(!lastRaw&&!storageError)budgetDialog(true);}
if(!desktopMode&&'serviceWorker'in navigator&&window.isSecureContext){navigator.serviceWorker.register('./sw.js').then(()=>{navigator.serviceWorker.ready.then(updatePWAStatus);}).catch(()=>{const el=$('#pwa-status');if(el)el.textContent='离线资源缓存失败，请联网刷新后重试。';});}
