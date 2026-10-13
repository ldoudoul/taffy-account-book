/* Offline companion to core.py. Same integer-cent contract, parity tested. */
export const EXPENSE = ['餐饮','交通','购物','娱乐','学习','住房','医疗','其他'];
export const INCOME = ['生活费','工资','兼职','红包','其他'];
export const DEFAULTS = {currency:'CNY',animations:true,character:true,prompts:true};
export const emptyState = () => ({version:1,transactions:[],budgets:{},settings:{...DEFAULTS}});
const LIMIT=999999999999;
export function cents(value) {
  if(typeof value!=='string'||!/^\d{1,10}(?:\.\d{1,2})?$/.test(value.trim())) throw Error('请输入大于 0 的金额，最多两位小数');
  const [whole,part='']=value.trim().split('.'); const n=Number(whole)*100+Number(part.padEnd(2,'0'));
  if(n<=0||n>LIMIT) throw Error('金额必须大于 0 且不超过 99 亿'); return n;
}
function money(n){if(!Number.isSafeInteger(n)||n<=0||n>LIMIT)throw Error('备份中的金额必须是有效的整数分');return n;}
export function validDate(s){
  if(typeof s!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(s))return false;
  const [y,m,d]=s.split('-').map(Number); const dt=new Date(0);dt.setUTCFullYear(y,m-1,d);dt.setUTCHours(0,0,0,0);
  return y>=1&&dt.getUTCFullYear()===y&&dt.getUTCMonth()===m-1&&dt.getUTCDate()===d;
}
function month(s){if(typeof s!=='string'||!/^\d{4}-\d{2}$/.test(s)||!validDate(s+'-01'))throw Error('月份无效');return s;}
function transaction(t){
  if(!t||typeof t!=='object')throw Error('账单格式无效');
  if(!['expense','income'].includes(t.type))throw Error('请选择收入或支出');
  if(!(t.type==='expense'?EXPENSE:INCOME).includes(t.category))throw Error('分类与收支类型不匹配');
  if(!validDate(t.date))throw Error('请选择有效日期');
  if(typeof(t.note??'')!=='string'||(t.note??'').length>200)throw Error('备注最多 200 字');
  if(typeof t.id!=='string'||!/^[A-Za-z0-9_-]{1,80}$/.test(t.id))throw Error('账单唯一标识无效');
  return {id:t.id,type:t.type,amount:money(t.amount),category:t.category,date:t.date,note:(t.note||'').trim(),createdAt:String(t.createdAt??t.date).slice(0,40)};
}
export function validateState(s){
  if(!s||s.version!==1)throw Error('不支持的备份格式或版本');
  if(!Array.isArray(s.transactions)||s.transactions.length>50000)throw Error('账单列表格式无效或超过 50000 条');
  const ts=s.transactions.map(transaction);const ids=new Set(ts.map(t=>t.id));if(ids.size!==ts.length)throw Error('备份中存在重复账单标识');
  if(ts.reduce((a,t)=>a+t.amount,0)>9000000000000000)throw Error('累计金额超过安全计算范围');
  if(!s.budgets||typeof s.budgets!=='object'||Array.isArray(s.budgets)||Object.keys(s.budgets).length>12000)throw Error('预算格式无效');
  const budgets={};for(const [k,v]of Object.entries(s.budgets)){month(k);budgets[k]=money(v);}
  if(s.settings!==undefined&&(!s.settings||typeof s.settings!=='object'||Array.isArray(s.settings)))throw Error('设置格式无效');
  const settings={...DEFAULTS};for(const k of ['animations','character','prompts']){if(k in(s.settings||{})){if(typeof s.settings[k]!=='boolean')throw Error('设置开关格式无效');settings[k]=s.settings[k];}}
  const currency=s.settings?.currency||'CNY';if(!['CNY','USD','EUR','JPY'].includes(currency))throw Error('币种无效');settings.currency=currency;
  return {version:1,transactions:ts,budgets,settings};
}
export function mood(budget,expense){
  if(!budget)return 'neutral';
  return expense*5<budget?'happy':expense*5<budget*2?'relaxed':expense*5<budget*3?'worried':expense*5<budget*4?'low':'sad';
}
export function analyze(s,m,filters={}){
  month(m);const items=s.transactions.filter(t=>t.date.startsWith(m));
  const sum=(list,kind)=>list.filter(t=>t.type===kind).reduce((a,t)=>a+t.amount,0);
  const budget=s.budgets[m]??null,expense=sum(items,'expense'),income=sum(items,'income');
  const filtered=s.transactions.filter(t=>(!filters.start||t.date>=filters.start)&&(!filters.end||t.date<=filters.end)&&(!filters.type||t.type===filters.type)&&(!filters.category||t.category===filters.category)).sort((a,b)=>b.date.localeCompare(a.date)||b.createdAt.localeCompare(a.createdAt)||b.id.localeCompare(a.id));
  return {month:m,budget,expense,income,remaining:budget?budget-expense:null,progress:budget?Math.min(100,expense/budget*100):0,mood:mood(budget,expense),filtered,totals:{income:sum(filtered,'income'),expense:sum(filtered,'expense')}};
}
export function applyAction(raw,action,p){
  let s=validateState(raw);
  if(['add','edit'].includes(action)){
    const item=transaction(p);const i=s.transactions.findIndex(t=>t.id===item.id);
    if(action==='add'){if(i>=0)throw Error('这条账单已经保存，请勿重复提交');s.transactions.push(item);}
    else{if(i<0)throw Error('账单不存在，请刷新重试');s.transactions[i]=item;}
  }else if(action==='delete'){
    if(!s.transactions.some(t=>t.id===p.id))throw Error('账单不存在');s.transactions=s.transactions.filter(t=>t.id!==p.id);
  }else if(action==='budget'){month(p.month);s.budgets[p.month]=cents(p.value);}
  else if(action==='settings'){s.settings={...s.settings,...p};}
  else if(action==='import'){
    const incoming=validateState(p.data);
    if(p.mode==='replace')s=incoming;
    else if(p.mode==='merge'){const ids=new Set(s.transactions.map(t=>t.id));s.transactions.push(...incoming.transactions.filter(t=>!ids.has(t.id)));s.budgets={...incoming.budgets,...s.budgets};}
    else throw Error('请选择合并或覆盖导入');
  }else throw Error('未知操作');
  return validateState(s);
}
export function exportCSV(raw){
  const s=validateState(raw),quote=x=>'"'+String(x).replaceAll('"','""')+'"';
  return '\ufeff'+[['唯一标识','日期','收支类型','分类','金额','备注'],...s.transactions.slice().sort((a,b)=>b.date.localeCompare(a.date)||b.id.localeCompare(a.id)).map(t=>[t.id,t.date,t.type==='income'?'收入':'支出',t.category,(t.amount/100).toFixed(2),/^\s*[=+@-]/.test(t.note)?"'"+t.note:t.note])].map(row=>row.map(quote).join(',')).join('\r\n')+'\r\n';
}
