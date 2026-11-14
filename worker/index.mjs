/**
 * MABRIG PROVE Cloudflare Worker API.
 * Explicit D1 / R2 bindings replace Node SQLite and local filesystem in Cloudflare.
 * No provider keys, payment handling, seller verification claims or external URL fetching.
 */
import {buildAssessment, buildReport, buildGate, gateTemplate, redactText} from '../server/engine.mjs';

const DAY=86400000, SESSION_TTL=30*DAY, CASE_TTL=30*DAY, INVITE_TTL=72*3600000;
const NOW=()=>Date.now();
const enc=new TextEncoder();
const rand=(n=24)=>{const b=new Uint8Array(n);crypto.getRandomValues(b);return btoa(String.fromCharCode(...b)).replace(/\+/g,'-').replace(/\//g,'_').replace(/=/g,'');};
const ID=p=>`${p}_${crypto.randomUUID()}`;
const HASH=async v=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',typeof v==='string'?enc.encode(v):v))).map(x=>x.toString(16).padStart(2,'0')).join('');
const STR=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
const PARSE=s=>JSON.parse(s);
const cookies=r=>Object.fromEntries((r.headers.get('cookie')||'').split(';').filter(Boolean).map(s=>{const i=s.indexOf('=');return [s.slice(0,i).trim(),s.slice(i+1).trim()];}));
const headers={'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'",'Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Permissions-Policy':'geolocation=(), microphone=()','Cache-Control':'no-store'};
const json=(status,body,extra={})=>new Response(JSON.stringify(body),{status,headers:{...headers,'Content-Type':'application/json; charset=utf-8',...extra}});
const fail=(status,message)=>json(status,{error:message});
const get=(db,sql,...a)=>db.prepare(sql).bind(...a).first();
const all=async(db,sql,...a)=>(await db.prepare(sql).bind(...a).all()).results||[];
const run=(db,sql,...a)=>db.prepare(sql).bind(...a).run();
const audit=(db,action,resource)=>run(db,'INSERT INTO audit_events VALUES(?,?,?,?)',ID('evt'),action,resource||null,NOW());
const NOTICE='Submitting evidence is voluntary. Other-party answers will be shown to the case creator. Do not upload identity documents, bank details, account numbers or private correspondence. Cases expire after 30 days.';
const FATAL_MISSING_DB='Database is not configured. Bind D1 as DB and apply the migration before enabling MABRIG PROVE.';
const FATAL_MISSING_SCHEMA='Database tables are missing. Run the Cloudflare D1 migration before enabling MABRIG PROVE.';
async function session(request,db){const t=cookies(request).prove_session;if(!t||t.length>128)return null;return get(db,'SELECT id FROM sessions WHERE token_hash=? AND expires_at>?',await HASH(t),NOW());}
async function ownedCase(request,db,id){const s=await session(request,db);if(!s)return null;return get(db,'SELECT * FROM cases WHERE id=? AND session_id=? AND expires_at>?',id,s.id,NOW());}
async function status(db,invite){if(invite.revoked_at)return 'REVOKED';if(invite.expires_at<=NOW())return 'EXPIRED';if(invite.declined_at)return 'DECLINED';return await get(db,'SELECT id FROM responses WHERE invite_id=?',invite.id)?'RESPONDED':'PENDING';}
const clean=c=>({id:c.id,category:c.category,offer_text:c.offer_text,offer_url:c.offer_url,asking_price:c.asking_price,status:c.status,created_at:c.created_at,expires_at:c.expires_at,assessment:PARSE(c.assessment_json)});
async function gate(db,c){return buildGate(c.category,await all(db,'SELECT check_key,state,note,updated_at FROM buyer_checks WHERE case_id=?',c.id),await get(db,'SELECT choice,note,updated_at FROM buyer_decisions WHERE case_id=?',c.id));}
async function full(db,c){const i=await get(db,'SELECT * FROM invites WHERE case_id=? ORDER BY created_at DESC LIMIT 1',c.id),r=i?await get(db,'SELECT * FROM responses WHERE invite_id=?',i.id):null;return {...clean(c),gate:await gate(db,c),invite:i?{id:i.id,challenge_code:i.challenge_code,questions:PARSE(i.questions_json),status:await status(db,i),expires_at:i.expires_at,created_at:i.created_at}:null,response:r?{answers:PARSE(r.answers_json),created_at:r.created_at}:null,evidence:await all(db,'SELECT id,role,mime,bytes,created_at FROM evidence WHERE case_id=?',c.id)};}
async function body(request,max=140000){if(!request.headers.get('content-type')?.startsWith('application/json'))throw Object.assign(new Error('Please submit JSON data.'),{status:415});const declared=Number(request.headers.get('content-length')||0);if(declared>max)throw Object.assign(new Error('Request is too large.'),{status:413});const text=await request.text();if(enc.encode(text).length>max)throw Object.assign(new Error('Request is too large.'),{status:413});try{return JSON.parse(text);}catch{throw Object.assign(new Error('Invalid JSON.'),{status:400});}}
const checkOrigin=req=>{const orig=req.headers.get('Origin');if(req.headers.get('sec-fetch-site')==='cross-site')return false;if(!orig)return true;try{return new URL(orig).origin===new URL(req.url).origin;}catch{return false;}};
const canWrite=env=>env.PROVE_WRITE_MODE==='pilot';
async function removeMedia(db,store,caseId){const entries=await all(db,'SELECT object_name FROM evidence WHERE case_id=?',caseId);if(entries.length&&(!store||typeof store.delete!=='function'))throw Object.assign(new Error('Evidence storage not configured; cannot safely delete evidence.'),{status:503});for(const e of entries)await store.delete(e.object_name);}
async function deleteSession(db,store,s){for(const c of await all(db,'SELECT id FROM cases WHERE session_id=?',s.id))await removeMedia(db,store,c.id);await run(db,'DELETE FROM sessions WHERE id=?',s.id);await audit(db,'SESSION_DELETED',s.id);}
async function rateLimit(request,db){ // pilot guard: bounded per-hour write requests, keyed on salted IP hash
 if(!request.method||['GET','HEAD','OPTIONS'].includes(request.method))return false;
 const ip=request.headers.get('CF-Connecting-IP')||'unknown';const key=await HASH(`prove-rate:${ip}:${Math.floor(NOW()/3600000)}`);
 await run(db,'INSERT INTO rate_limits(key,hits,expires_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET hits=hits+1',key,1,NOW()+2*3600000);
 const n=await get(db,'SELECT hits FROM rate_limits WHERE key=?',key);return Number(n?.hits||0)>80;
}
async function mime(bytes){if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'image/jpeg';if([137,80,78,71,13,10,26,10].every((x,i)=>bytes[i]===x))return 'image/png';if([82,73,70,70].every((x,i)=>bytes[i]===x)&&[87,69,66,80].every((x,i)=>bytes[i+8]===x))return 'image/webp';return null;}
function decoded(b64){const bin=atob(b64);return Uint8Array.from(bin,c=>c.charCodeAt(0));}
async function api(request,env){
 const p=new URL(request.url).pathname,m=request.method,db=env.DB;
 if(m==='GET'&&p==='/api/health'){
   let dbReady=false; if(db&&typeof db.prepare==='function')try{await get(db,'SELECT id FROM sessions LIMIT 1');dbReady=true;}catch{}
   return json(dbReady?200:503,{ok:dbReady,app:'MABRIG PROVE',version:'0.3.0',mode:'cloudflare-worker',database_ready:dbReady,write_mode:canWrite(env)?'pilot':'locked',evidence_storage_ready:!!env.EVIDENCE,notice:dbReady?'Cloudflare Worker API available. Independent seller verification is not implemented.':!db?FATAL_MISSING_DB:FATAL_MISSING_SCHEMA});
 }
 if(!db||typeof db.prepare!=='function')return fail(503,FATAL_MISSING_DB);
 try{await get(db,'SELECT id FROM sessions LIMIT 1');}catch{return fail(503,FATAL_MISSING_SCHEMA);}
 if(!['GET','HEAD','OPTIONS'].includes(m)&&!checkOrigin(request))return fail(403,'Cross-origin request rejected.');
 if(!['GET','HEAD','OPTIONS'].includes(m)&&!canWrite(env))return fail(503,'Public writes disabled. Set PROVE_WRITE_MODE=pilot only after security review and configuring D1 and rate limits.');
 if(await rateLimit(request,db))return fail(429,'Too many requests. Try again later.');
 if(m==='GET'&&p==='/api/session')return json(200,{active:!!await session(request,db)});
 if(m==='POST'&&p==='/api/session'){
   if(await session(request,db))return json(200,{active:true});
   const token=rand(),sid=ID('session');await run(db,'INSERT INTO sessions VALUES(?,?,?)',sid,await HASH(token),NOW()+SESSION_TTL);
   return json(201,{active:true},{'Set-Cookie':`prove_session=${token}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL/1000}`});
 }
 if(m==='DELETE'&&p==='/api/session'){
   const s=await session(request,db);if(s)await deleteSession(db,env.EVIDENCE,s);
   return json(200,{deleted:true},{'Set-Cookie':'prove_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0'});
 }
 if(m==='GET'&&p==='/api/cases'){
   const s=await session(request,db);if(!s)return fail(401,'Start a private guest session first.');
   const cases=await all(db,'SELECT * FROM cases WHERE session_id=? AND expires_at>? ORDER BY created_at DESC LIMIT 80',s.id,NOW());return json(200,{cases:cases.map(c=>({...clean(c),offer_text:c.offer_text.slice(0,190)}))});
 }
 if(m==='POST'&&p==='/api/cases'){
   const s=await session(request,db);if(!s)return fail(401,'Start a private guest session first.');
   const b=await body(request),cat=STR(b.category,16),raw=STR(b.offer_text,5000),offerText=b.redact===false?raw:redactText(raw),offerUrl=STR(b.offer_url,600);
   if(!['phone','laptop','other'].includes(cat))return fail(400,'Choose a valid item category.');
   if(offerText.length<15)return fail(400,'Enter at least 15 characters describing the offer.');
   if(offerUrl){try{const u=new URL(offerUrl);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)return fail(400,'Use a normal http(s) link without credentials.');}catch{return fail(400,'Enter a valid http(s) URL.');}}
   const price=b.asking_price===''||b.asking_price==null?null:Number(b.asking_price);
   if(price!==null&&(!Number.isSafeInteger(price)||price<0||price>10000000000))return fail(400,'Enter a valid asking price in naira.');
   const cid=ID('case'),created=NOW(),assessment=buildAssessment({category:cat,offer_text:offerText,offer_url:offerUrl||null,asking_price:price,created_at:created});
   await run(db,'INSERT INTO cases VALUES(?,?,?,?,?,?,?,?,?,?)',cid,s.id,cat,offerText,offerUrl||null,price,'ANALYSIS_READY',JSON.stringify(assessment),created,created+CASE_TTL);
   await audit(db,'CASE_CREATED',cid);return json(201,{case:await full(db,await get(db,'SELECT * FROM cases WHERE id=?',cid))});
 }
 const cm=p.match(/^\/api\/cases\/([^/]+)(?:\/(.*))?$/);
 if(cm){const c=await ownedCase(request,db,cm[1]);if(!c)return fail(404,'Case not found in this session.');const sub=cm[2]||'';
   if(m==='GET'&&!sub)return json(200,{case:await full(db,c)});
   if(m==='DELETE'&&!sub){await removeMedia(db,env.EVIDENCE,c.id);await run(db,'DELETE FROM cases WHERE id=?',c.id);await audit(db,'CASE_DELETED',c.id);return json(200,{deleted:true});}
   if(m==='GET'&&sub==='gate')return json(200,{gate:await gate(db,c)});
   if(m==='POST'&&sub==='gate'){
     const b=await body(request);if(typeof b.key!=='string'||!gateTemplate(c.category).some(x=>x.key===b.key))return fail(400,'Choose a recognized checklist step.');
     if(!['NOT_DONE','PLANNED','DONE','UNAVAILABLE'].includes(b.state))return fail(400,'Choose a valid step status.');
     if(typeof b.note!=='string'||b.note.length>500)return fail(400,'The private note must be at most 500 characters.');
     await run(db,'INSERT INTO buyer_checks(case_id,check_key,state,note,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(case_id,check_key) DO UPDATE SET state=excluded.state,note=excluded.note,updated_at=excluded.updated_at',c.id,b.key,b.state,redactText(STR(b.note,500)),NOW());await audit(db,'BUYER_CHECK_UPDATED',c.id);return json(200,{gate:await gate(db,c)});
   }
   if(m==='POST'&&sub==='decision'){
     const b=await body(request);if(!['PAUSE','WALK_AWAY','PROCEED_WITH_PRECAUTIONS'].includes(b.choice))return fail(400,'Choose a supported buyer decision.');
     if(b.acknowledged!==true)return fail(400,'Please acknowledge that no claims were independently verified by PROVE.');
     if(typeof b.note!=='string'||b.note.length>500)return fail(400,'The private decision note must be at most 500 characters.');
     await run(db,'INSERT INTO buyer_decisions(case_id,choice,note,updated_at) VALUES(?,?,?,?) ON CONFLICT(case_id) DO UPDATE SET choice=excluded.choice,note=excluded.note,updated_at=excluded.updated_at',c.id,b.choice,redactText(STR(b.note,500)),NOW());await audit(db,'BUYER_DECISION_RECORDED',c.id);return json(200,{gate:await gate(db,c),message:'Your decision is private, self-recorded and is not approval or certification from MABRIG PROVE.'});
   }
   if(m==='POST'&&sub==='evidence'){
     if(!env.EVIDENCE)return fail(503,'Evidence storage is disabled. Connect private R2 bucket binding EVIDENCE.');
     const b=await body(request,3300000),raw=typeof b.data==='string'?b.data:'';
     if(raw.length>3000000||raw.length<50||!/^[A-Za-z0-9+/]+={0,2}$/.test(raw))return fail(400,'Expected a small base64-encoded image.');
     let bytes;try{bytes=decoded(raw)}catch{return fail(400,'Invalid encoded image.');}
     if(bytes.length>2*1024*1024)return fail(413,'Image must be at most 2MB.');const mimeType=await mime(bytes);
     if(!mimeType||mimeType!==b.mime)return fail(415,'Only authentic JPEG, PNG or WebP images are accepted.');
     if((await get(db,'SELECT COUNT(*) AS n FROM evidence WHERE case_id=?',c.id)).n>=2)return fail(400,'Maximum two images per case.');
     const assetId=ID('asset'),objectName=rand(32);
     await env.EVIDENCE.put(objectName,bytes,{httpMetadata:{contentType:mimeType}});
     try{await run(db,'INSERT INTO evidence VALUES(?,?,?,?,?,?,?,?)',assetId,c.id,'buyer',objectName,await HASH(bytes),mimeType,bytes.length,NOW());}catch(e){await env.EVIDENCE.delete(objectName);throw e;}
     await audit(db,'EVIDENCE_ADDED',c.id);return json(201,{evidence:{id:assetId,mime:mimeType,bytes:bytes.length},notice:'Image retained as private supporting evidence. Automatic image reading is not enabled in this build.'});
   }
   const em=sub.match(/^evidence\/([^/]+)$/);
   if(m==='GET'&&em){const e=await get(db,'SELECT * FROM evidence WHERE case_id=? AND id=?',c.id,em[1]);if(!e)return fail(404,'Evidence not found');if(!env.EVIDENCE)return fail(503,'Evidence store not configured.');const obj=await env.EVIDENCE.get(e.object_name);if(!obj)return fail(404,'Evidence no longer available');return new Response(obj.body,{headers:{...headers,'Content-Type':e.mime,'Content-Disposition':'attachment; filename="supporting-evidence"'}});}
   if(m==='POST'&&sub==='invite'){
     const b=await body(request),defaults=PARSE(c.assessment_json).questions;
     const prompts=Array.isArray(b.questions)?b.questions.map(v=>STR(v,250)).filter(Boolean).slice(0,6):defaults;
     if(!prompts.length||prompts.some(q=>/\b(NIN|BVN|password|bank statement|passport photo|government ID)\b/i.test(q)))return fail(400,'Request up to six non-sensitive proof questions.');
     const token=rand(30),inviteId=ID('invite'),code=String(100000+Math.floor(Math.random()*900000));
     await run(db,'UPDATE invites SET revoked_at=? WHERE case_id=? AND revoked_at IS NULL AND expires_at>? AND declined_at IS NULL AND id NOT IN (SELECT invite_id FROM responses)',NOW(),c.id,NOW());
     await run(db,'INSERT INTO invites VALUES(?,?,?,?,?,?,?,?,?)',inviteId,c.id,await HASH(token),code,JSON.stringify(prompts),NOW()+INVITE_TTL,null,null,NOW());
     await run(db,"UPDATE cases SET status='CHALLENGE_SENT' WHERE id=?",c.id);await audit(db,'INVITE_CREATED',c.id);
     return json(201,{invite:{token,challenge_code:code,questions:prompts,expires_at:NOW()+INVITE_TTL}});
   }
   if(m==='POST'&&sub==='invite/revoke'){await run(db,'UPDATE invites SET revoked_at=? WHERE case_id=? AND revoked_at IS NULL',NOW(),c.id);await audit(db,'INVITE_REVOKED',c.id);return json(200,{revoked:true});}
   if(m==='GET'&&sub==='report'){
     const i=await get(db,'SELECT * FROM invites WHERE case_id=? ORDER BY created_at DESC LIMIT 1',c.id),r=i?await get(db,'SELECT * FROM responses WHERE invite_id=?',i.id):null;
     return json(200,{report:{...buildReport(c,PARSE(c.assessment_json),i?{questions:PARSE(i.questions_json)}:null,r?{answers:PARSE(r.answers_json)}:null),gate:await gate(db,c)}});
   }
   if(m==='POST'&&sub==='abuse-report'){
     const b=await body(request),reason=STR(b.reason,500);if(reason.length<8)return fail(400,'Provide a short description (at least 8 characters).');
     await run(db,'INSERT INTO abuse_reports VALUES(?,?,?,?,?,?,?)',ID('report'),null,c.id,'buyer',reason,NOW(),'OPEN');await audit(db,'ABUSE_REPORTED',c.id);return json(201,{submitted:true});
   }
 }
 const pm=p.match(/^\/api\/proof\/([^/]+)(?:\/(.*))?$/);
 if(pm){if(!/^[A-Za-z0-9_-]{30,90}$/.test(pm[1]))return fail(404,'Proof request is unavailable.');const i=await get(db,'SELECT * FROM invites WHERE token_hash=?',await HASH(pm[1]));if(!i)return fail(404,'Proof request is unavailable.');const st=await status(db,i),sub=pm[2]||'';
   if(m==='GET'&&!sub)return json(200,{proof:{challenge_code:i.challenge_code,questions:PARSE(i.questions_json),expires_at:i.expires_at,status:st,privacy_notice:NOTICE}});
   if(m==='POST'&&sub==='respond'){
     if(st!=='PENDING')return fail(409,`This request is ${st.toLowerCase()}.`);
     const b=await body(request);if(b.consent!==true)return fail(400,'The seller must voluntarily consent before submitting.');
     const qs=PARSE(i.questions_json),answers=Array.isArray(b.answers)?b.answers.map(v=>redactText(STR(v,1500))).slice(0,qs.length):[];
     if(answers.length!==qs.length||!answers.some(Boolean))return fail(400,'Please answer at least one question.');
     try{await run(db,'INSERT INTO responses VALUES(?,?,?,?,?)',ID('response'),i.id,JSON.stringify(answers),NOW(),NOW());}catch{return fail(409,'A response has already been submitted.');}
     await run(db,"UPDATE cases SET status='REPORT_READY' WHERE id=?",i.case_id);await audit(db,'SELLER_RESPONDED',i.id);
     return json(201,{submitted:true,message:'Response received. This does not establish ownership or transaction safety.'});
   }
   if(m==='POST'&&sub==='decline'){if(st!=='PENDING')return fail(409,`This request is ${st.toLowerCase()}.`);await run(db,'UPDATE invites SET declined_at=? WHERE id=?',NOW(),i.id);await run(db,"UPDATE cases SET status='SELLER_DECLINED' WHERE id=?",i.case_id);await audit(db,'SELLER_DECLINED',i.id);return json(200,{declined:true,message:'Declining is your choice. No negative judgment is made.'});}
   if(m==='POST'&&sub==='report'){const b=await body(request),reason=STR(b.reason,500);if(reason.length<8)return fail(400,'Please describe the concern.');await run(db,'INSERT INTO abuse_reports VALUES(?,?,?,?,?,?,?)',ID('report'),i.id,null,'seller',reason,NOW(),'OPEN');await audit(db,'ABUSE_REPORTED',i.id);return json(201,{submitted:true});}
 }
 // No password-only administrative endpoints in the Cloudflare release.
 if(p.startsWith('/api/admin'))return fail(403,'Founder administration requires a dedicated MFA-protected identity provider.');
 return fail(404,'Endpoint not found.');
}
async function retentionCleanup(env){
 if(!env.DB)return;
 const db=env.DB,time=NOW();
 const dead=await all(db,'SELECT id FROM cases WHERE expires_at<? OR session_id IN (SELECT id FROM sessions WHERE expires_at<?)',time,time);
 for(const c of dead){
   await removeMedia(db,env.EVIDENCE,c.id);
   await run(db,'DELETE FROM cases WHERE id=?',c.id);
 }
 await run(db,'DELETE FROM sessions WHERE expires_at<?',time);
 await run(db,'DELETE FROM audit_events WHERE created_at<?',time-30*DAY);
 await run(db,'DELETE FROM rate_limits WHERE expires_at<?',time);
}
export default {
 async scheduled(event,env){try{await retentionCleanup(env);}catch(e){console.error('Retention cleanup failed:',e?.message||'unknown');throw e;}},
 async fetch(request,env){try{
    const pathname=new URL(request.url).pathname;
    if(pathname.startsWith('/api/'))return await api(request,env);
    if(!env.ASSETS)return fail(503,'Static asset binding is not available.');
    const asset=await env.ASSETS.fetch(request);
    const h=new Headers(asset.headers);h.set('X-Content-Type-Options','nosniff');h.set('Referrer-Policy','no-referrer');
    return new Response(asset.body,{status:asset.status,statusText:asset.statusText,headers:h});
  }catch(e){if(e?.status)return fail(e.status,e.message);console.error('MABRIG PROVE Worker request failed',e?.message||'unknown');return fail(500,'The service encountered an unexpected error.');}
 }
};

