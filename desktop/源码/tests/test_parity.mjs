import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import {emptyState,cents,applyAction,analyze,mood,validateState} from '../dist/engine.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const python=process.env.POCKET_TEST_PYTHON||'python';
function py(request){const p=spawnSync(python,['-X','utf8','-c','import sys,json,core; print(json.dumps(core.api(json.load(sys.stdin)),ensure_ascii=True))'],{cwd:root,input:JSON.stringify(request),encoding:'utf8'});assert.equal(p.status,0,p.stderr);return JSON.parse(p.stdout);}
let s=emptyState();
const act=(action,payload)=>{const js=applyAction(s,action,payload);const pythonState=py({operation:'action',state:s,action,payload}).state;assert.deepEqual(js,pythonState);s=js;};
act('budget',{month:'2026-10',value:'100.00'});
assert.equal(cents('0.10')+cents('0.20'),30);
for(const amount of [1,1999,2000,3999,4000,5999,6000,7999,8000,9999,10000,10001]){
  const t={id:'boundary',amount,type:'expense',date:'2026-10-12',category:'餐饮',note:'边界验证',createdAt:'2026-10-12T10:00:00'};
  act(s.transactions.length?'edit':'add',t);
  assert.deepEqual(analyze(s,'2026-10'),py({operation:'analyze',state:s,month:'2026-10'}));
}
act('edit',{...s.transactions[0],date:'2026-09-30'});
for(const m of ['2026-09','2026-10'])assert.deepEqual(analyze(s,m),py({operation:'analyze',state:s,month:m}));
act('add',{id:'income',amount:800000,type:'income',date:'2026-10-12',category:'生活费',note:'收入不增加预算',createdAt:'2026-10-12T12:00:00'});
const filters={type:'expense',category:'餐饮',start:'2026-09-01',end:'2026-09-30'};
assert.deepEqual(analyze(s,'2026-10',filters),py({operation:'analyze',state:s,month:'2026-10',filters}));
act('delete',{id:'boundary'});act('settings',{animations:false});
const imported=structuredClone(s);imported.budgets['2026-10']=900000;
act('import',{data:imported,mode:'merge'});act('import',{data:imported,mode:'replace'});
assert.equal(mood(null,100),'neutral');
for(const [value,expected] of [[0,'happy'],[1999,'happy'],[2000,'relaxed'],[4000,'worried'],[6000,'low'],[8000,'sad'],[10001,'sad']])assert.equal(mood(10000,value),expected);
for(const bad of ['0','-1','1.001','NaN','1e2'])assert.throws(()=>cents(bad));
assert.throws(()=>validateState({...s,transactions:[{...s.transactions[0],date:'2026-02-30'}]}));
console.log('PASS: Python/browser parity, mood boundaries, month edits, filters, import and input validation');
