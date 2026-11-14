import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {readFileSync} from 'node:fs';
import worker from '../worker/index.mjs';

const sql=readFileSync(new URL('../migrations/0001_init.sql',import.meta.url),'utf8');
function mockD1(){
 const sqlite=new DatabaseSync(':memory:');sqlite.exec(sql);
 return {prepare(query){let values=[];return {bind(...args){values=args;return this;},async first(){return sqlite.prepare(query).get(...values)||null;},async all(){return {results:sqlite.prepare(query).all(...values)};},async run(){sqlite.prepare(query).run(...values);return {success:true};}};}};
}
function mockR2(){const map=new Map();return {async put(key,value){map.set(key,value);},async get(key){const value=map.get(key);return value?{body:value}:null;},async delete(key){map.delete(key);},size:()=>map.size};}
function client(env){let cookie='';return async(path,method='GET',payload,origin)=>{
 const h=new Headers();if(cookie)h.set('cookie',cookie);if(payload!==undefined)h.set('content-type','application/json');if(origin)h.set('origin',origin);
 const r=await worker.fetch(new Request('https://mabrig-prove.example'+path,{method,headers:h,body:payload===undefined?undefined:JSON.stringify(payload)}),env);
 if(r.headers.get('set-cookie'))cookie=r.headers.get('set-cookie').split(';')[0];const data=await r.json();return {status:r.status,data,headers:r.headers};
};}
test('static-only mode is replaced with Worker health that explains D1 setup',async()=>{
 const noDb=client({PROVE_WRITE_MODE:'locked'});const h=await noDb('/api/health');assert.equal(h.status,503);assert.equal(h.data.database_ready,false);
 const emptyDb=client({DB:mockD1(),PROVE_WRITE_MODE:'locked'});assert.equal((await emptyDb('/api/health')).status,200);
 assert.equal((await emptyDb('/api/session','POST')).status,503,'writes fail closed until configured for pilot');
});
test('Cloudflare Worker buyer and seller flow, decision gate, isolation and revocation',async()=>{
 const env={DB:mockD1(),EVIDENCE:mockR2(),PROVE_WRITE_MODE:'pilot'};const buyer=client(env),seller=client(env),intruder=client(env);
 assert.equal((await buyer('/api/session','POST')).status,201);
 assert.equal((await intruder('/api/session','POST')).status,201);
 const b=await buyer('/api/cases','POST',{category:'phone',offer_text:'Urgent sale! Pay deposit first. Delivery only. iPhone 13',asking_price:160000});
 assert.equal(b.status,201,JSON.stringify(b.data));const cid=b.data.case.id;
 assert.equal((await intruder('/api/cases/'+cid)).status,404);
 const inv=await buyer('/api/cases/'+cid+'/invite','POST',{});assert.equal(inv.status,201);const token=inv.data.invite.token;
 const proof=await seller('/api/proof/'+token);assert.equal(proof.status,200);assert.equal(proof.data.proof.status,'PENDING');assert.equal(JSON.stringify(proof.data).includes('iPhone 13'),false);
 const ans=await seller('/api/proof/'+token+'/respond','POST',{consent:true,answers:['Device present','Yes','No changes','Redacted receipt']});assert.equal(ans.status,201);
 assert.equal((await seller('/api/proof/'+token+'/respond','POST',{consent:true,answers:['again']})).status,409);
 assert.equal((await buyer('/api/cases/'+cid+'/gate','POST',{key:'independent_inspection',state:'DONE',note:'Reviewed in person'})).status,200);
 assert.equal((await buyer('/api/cases/'+cid+'/decision','POST',{choice:'PAUSE',acknowledged:true,note:'Need more checks'})).status,200);
 const report=await buyer('/api/cases/'+cid+'/report');assert.equal(report.status,200);assert.equal(report.data.report.gate.completed,1);
 assert.equal((await intruder('/api/cases/'+cid+'/report')).status,404);
 assert.equal((await buyer('/api/cases/'+cid,'DELETE')).status,200);
 assert.equal((await seller('/api/proof/'+token)).status,404);
});
test('cross origin and upload storage controls fail closed',async()=>{
 const env={DB:mockD1(),PROVE_WRITE_MODE:'pilot'};const buyer=client(env);await buyer('/api/session','POST');
 assert.equal((await buyer('/api/cases','POST',{category:'phone',offer_text:'a normal phone advertised with accessories'},'https://attacker.invalid')).status,403);
 const created=await buyer('/api/cases','POST',{category:'phone',offer_text:'a normal phone advertised with accessories'});
 assert.equal(created.status,201);
 const file=await buyer('/api/cases/'+created.data.case.id+'/evidence','POST',{mime:'image/png',data:'A'.repeat(100)});assert.equal(file.status,503);
 assert.equal((await buyer('/api/admin/overview')).status,403);
});

