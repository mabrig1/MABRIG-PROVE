import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {buildAssessment, buildReport, redactText, buildGate, gateTemplate} from './engine.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const publicRoot = path.join(root,'public');
const dataDir = path.resolve(process.env.DATA_DIR || path.join(root,'data'));
const evidenceDir=path.join(dataDir,'evidence');
fs.mkdirSync(evidenceDir,{recursive:true,mode:0o700});
const db=new DatabaseSync(path.join(dataDir,'prove.sqlite'));
db.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS sessions(id TEXT PRIMARY KEY, token_hash TEXT NOT NULL UNIQUE, expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS cases(id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,category TEXT NOT NULL,offer_text TEXT NOT NULL,offer_url TEXT,asking_price INTEGER,status TEXT NOT NULL DEFAULT 'ANALYSIS_READY',assessment_json TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_case_owner ON cases(session_id,created_at);
CREATE TABLE IF NOT EXISTS invites(id TEXT PRIMARY KEY,case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,token_hash TEXT NOT NULL UNIQUE,challenge_code TEXT NOT NULL,questions_json TEXT NOT NULL,expires_at INTEGER NOT NULL,revoked_at INTEGER,declined_at INTEGER,created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS responses(id TEXT PRIMARY KEY,invite_id TEXT NOT NULL UNIQUE REFERENCES invites(id) ON DELETE CASCADE,answers_json TEXT NOT NULL,consented_at INTEGER NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS evidence(id TEXT PRIMARY KEY,case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,role TEXT NOT NULL,object_name TEXT NOT NULL,sha256 TEXT NOT NULL,mime TEXT NOT NULL,bytes INTEGER NOT NULL,created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS abuse_reports(id TEXT PRIMARY KEY,invite_id TEXT REFERENCES invites(id) ON DELETE SET NULL,case_id TEXT REFERENCES cases(id) ON DELETE SET NULL,role TEXT NOT NULL,reason TEXT NOT NULL,created_at INTEGER NOT NULL,status TEXT NOT NULL DEFAULT 'OPEN');
CREATE TABLE IF NOT EXISTS audit_events(id TEXT PRIMARY KEY,action TEXT NOT NULL,resource_id TEXT,created_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS buyer_checks(case_id TEXT NOT NULL REFERENCES cases(id) ON DELETE CASCADE,check_key TEXT NOT NULL,state TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',updated_at INTEGER NOT NULL,PRIMARY KEY(case_id,check_key));
CREATE TABLE IF NOT EXISTS buyer_decisions(case_id TEXT PRIMARY KEY REFERENCES cases(id) ON DELETE CASCADE,choice TEXT NOT NULL,note TEXT NOT NULL DEFAULT '',updated_at INTEGER NOT NULL);
`);
const DAY=86400000, SESSION_TTL=30*DAY, CASE_TTL=30*DAY, INVITE_TTL=72*3600000;
const now=()=>Date.now();
const random=(n=24)=>crypto.randomBytes(n).toString('base64url');
const hash=(value)=>crypto.createHash('sha256').update(value).digest('hex');
const id=(p)=>`${p}_${crypto.randomUUID()}`;
const audit=(action,resource)=>db.prepare('INSERT INTO audit_events VALUES(?,?,?,?)').run(id('evt'),action,resource||null,now());
const stmt=(sql,...args)=>db.prepare(sql).get(...args);
const all=(sql,...args)=>db.prepare(sql).all(...args);
const execute=(sql,...args)=>db.prepare(sql).run(...args);
const parse=(value)=>JSON.parse(value);
const cookies=(req)=>Object.fromEntries((req.headers.cookie||'').split(';').filter(Boolean).map(s=>{const i=s.indexOf('=');return [s.slice(0,i).trim(),s.slice(i+1).trim()] }));
const securityHeaders={
 'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; connect-src 'self'; base-uri 'none'; object-src 'none'; frame-ancestors 'none'; form-action 'self'",
 'Referrer-Policy':'no-referrer','X-Content-Type-Options':'nosniff','X-Frame-Options':'DENY','Permissions-Policy':'geolocation=(), microphone=()','Cache-Control':'no-store'
};
function reply(res,status,body,headers={}) {res.writeHead(status,{...securityHeaders,'Content-Type':'application/json; charset=utf-8',...headers}); res.end(JSON.stringify(body));}
function fail(res,status,message){reply(res,status,{error:message});}
function getSession(req){const token=cookies(req).prove_session;if(!token||token.length>128)return null;return stmt('SELECT id FROM sessions WHERE token_hash=? AND expires_at>?',hash(token),now());}
function getCase(req,caseId){const s=getSession(req);if(!s)return null;return stmt('SELECT * FROM cases WHERE id=? AND session_id=? AND expires_at>?',caseId,s.id,now());}
function getInvite(token){if(!/^[A-Za-z0-9_-]{30,90}$/.test(token))return null;return stmt('SELECT * FROM invites WHERE token_hash=?',hash(token));}
function inviteStatus(inv){return inv.revoked_at?'REVOKED':inv.expires_at<=now()?'EXPIRED':inv.declined_at?'DECLINED':stmt('SELECT id FROM responses WHERE invite_id=?',inv.id)?'RESPONDED':'PENDING';}
function cleanCase(c){return {id:c.id,category:c.category,offer_text:c.offer_text,offer_url:c.offer_url,asking_price:c.asking_price,status:c.status,created_at:c.created_at,expires_at:c.expires_at,assessment:parse(c.assessment_json)};}
function gateFor(c){const checks=all('SELECT check_key,state,note,updated_at FROM buyer_checks WHERE case_id=?',c.id);const decision=stmt('SELECT choice,note,updated_at FROM buyer_decisions WHERE case_id=?',c.id);return buildGate(c.category,checks,decision);}
function fullCase(c){const invite=stmt('SELECT * FROM invites WHERE case_id=? ORDER BY created_at DESC LIMIT 1',c.id); const response=invite?stmt('SELECT * FROM responses WHERE invite_id=?',invite.id):null;
 return {...cleanCase(c),gate:gateFor(c),invite:invite?{id:invite.id,challenge_code:invite.challenge_code,questions:parse(invite.questions_json),status:inviteStatus(invite),expires_at:invite.expires_at,created_at:invite.created_at}:null,response:response?{answers:parse(response.answers_json),created_at:response.created_at}:null,evidence:all('SELECT id,role,mime,bytes,created_at FROM evidence WHERE case_id=?',c.id)};}
function isSameOrigin(req){const orig=req.headers.origin; if(!orig)return true; try {const u=new URL(orig);return u.host===req.headers.host && (u.protocol==='http:'||u.protocol==='https:');}catch{return false;}}
async function bodyJSON(req,max=140000){if(!req.headers['content-type']?.startsWith('application/json'))throw Object.assign(new Error('Please submit JSON data.'),{status:415});let total=0,parts=[];for await(const chunk of req){total+=chunk.length;if(total>max)throw Object.assign(new Error('Request is too large.'),{status:413});parts.push(chunk);}try{return JSON.parse(Buffer.concat(parts).toString('utf8'));}catch{throw Object.assign(new Error('Invalid JSON.'),{status:400});}}
const string=(value,max)=>typeof value==='string'?value.trim().slice(0,max):'';
const privacyNotice='Submitting evidence is voluntary. Other-party answers will be shown to the case creator. Do not upload identity documents, bank details, account numbers or private correspondence. Data is stored locally in this preview and cases expire after 30 days.';
function mimeFor(bytes){if(bytes.subarray(0,3).equals(Buffer.from([0xff,0xd8,0xff])))return 'image/jpeg';if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))return 'image/png';if(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')return 'image/webp';return null;}
function removeMedia(caseId){for(const f of all('SELECT object_name FROM evidence WHERE case_id=?',caseId))try{fs.unlinkSync(path.join(evidenceDir,f.object_name));}catch{}}
function purge(){for(const c of all('SELECT id FROM cases WHERE expires_at<? OR session_id IN (SELECT id FROM sessions WHERE expires_at<?)',now(),now()))removeMedia(c.id);execute('DELETE FROM cases WHERE expires_at<?',now());execute('DELETE FROM sessions WHERE expires_at<?',now());execute('DELETE FROM audit_events WHERE created_at<?',now()-30*DAY);}
purge();const cleanupTimer=setInterval(purge,6*3600000);cleanupTimer.unref();
const buckets=new Map();
function limited(req){const ip=(req.socket.remoteAddress||'unknown');const key=ip;const t=now();if(buckets.size>2000){for(const [k,v] of buckets)if(t-v.start>120000)buckets.delete(k)}let b=buckets.get(key);if(!b||t-b.start>60000){b={start:t,count:0};buckets.set(key,b)}return ++b.count>100;}
const adminConfigured=Boolean(process.env.ADMIN_PASSWORD?.length>=16 && process.env.ADMIN_SESSION_SECRET?.length>=32);
function hmac(v){return crypto.createHmac('sha256',process.env.ADMIN_SESSION_SECRET||'disabled').update(v).digest('base64url')}
function adminAllowed(req){if(!adminConfigured)return false;const v=cookies(req).prove_admin||'';const [expiry,sig]=v.split('.');if(!expiry||!sig||Number(expiry)<=now())return false;const expected=hmac(expiry);return sig.length===expected.length&&crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(expected));}
const mimeMap={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.ico':'image/x-icon','.webmanifest':'application/manifest+json'};
function serveStatic(req,res,url){let requested = url.pathname;const noFile= !path.extname(requested);if(noFile)requested='/index.html';const file=path.resolve(publicRoot,'.'+decodeURIComponent(requested));if(!(file===publicRoot||file.startsWith(publicRoot+path.sep))||!fs.existsSync(file)||!fs.statSync(file).isFile())return fail(res,404,'Page not found');res.writeHead(200,{...securityHeaders,'Cache-Control':noFile?'no-cache':'public, max-age=3600','Content-Type':mimeMap[path.extname(file)]||'application/octet-stream'});fs.createReadStream(file).pipe(res);}
async function handler(req,res){
 if(limited(req))return fail(res,429,'Too many requests. Try again shortly.');
 if(!['GET','HEAD','OPTIONS'].includes(req.method)&&(req.headers['sec-fetch-site']==='cross-site'||!isSameOrigin(req)))return fail(res,403,'Cross-origin request rejected.');
 let url;try{url=new URL(req.url,'http://localhost')}catch{return fail(res,400,'Invalid URL')}
 const p=url.pathname,m=req.method;
 if(m==='GET'&&!p.startsWith('/api/'))return serveStatic(req,res,url);
 if(m==='GET'&&p==='/api/health')return reply(res,200,{ok:true,app:'MABRIG PROVE',version:'0.2.0',mode:'local-mvp',admin_configured:adminConfigured});
 if(m==='GET'&&p==='/api/session')return reply(res,200,{active:!!getSession(req)});
 if(m==='POST'&&p==='/api/session'){
   const existing=getSession(req);if(existing)return reply(res,200,{active:true});
   const token=random(),sid=id('session');execute('INSERT INTO sessions VALUES(?,?,?)',sid,hash(token),now()+SESSION_TTL);
   const secure=process.env.NODE_ENV==='production'?'; Secure':'';
   return reply(res,201,{active:true},{'Set-Cookie':`prove_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${SESSION_TTL/1000}${secure}`});
 }
 if(m==='DELETE'&&p==='/api/session'){
   const s=getSession(req);if(s){for(const c of all('SELECT id FROM cases WHERE session_id=?',s.id))removeMedia(c.id);execute('DELETE FROM sessions WHERE id=?',s.id);audit('SESSION_DELETED',s.id)}
   return reply(res,200,{deleted:true},{'Set-Cookie':'prove_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'});
 }
 if(m==='GET'&&p==='/api/cases'){
   const s=getSession(req);if(!s)return fail(res,401,'Start a private guest session first.');
   return reply(res,200,{cases:all('SELECT * FROM cases WHERE session_id=? AND expires_at>? ORDER BY created_at DESC LIMIT 80',s.id,now()).map(c=>({...cleanCase(c),offer_text:c.offer_text.slice(0,190)}))});
 }
 if(m==='POST'&&p==='/api/cases'){
   const s=getSession(req);if(!s)return fail(res,401,'Start a private guest session first.');
   const b=await bodyJSON(req);const cat=string(b.category,16);const raw=string(b.offer_text,5000);const offerText=b.redact===false?raw:redactText(raw);const offerUrl=string(b.offer_url,600);
   if(!['phone','laptop','other'].includes(cat))return fail(res,400,'Choose a valid item category.');
   if(offerText.length<15)return fail(res,400,'Enter at least 15 characters describing the offer.');
   if(offerUrl){try{const u=new URL(offerUrl);if(!['https:','http:'].includes(u.protocol)||u.username||u.password)return fail(res,400,'Use a normal http(s) link without credentials.');}catch{return fail(res,400,'Enter a valid http(s) URL.')}}
   const price=(b.asking_price===''||b.asking_price==null)?null:Number(b.asking_price);
   if(price!==null&&(!Number.isSafeInteger(price)||price<0||price>10000000000))return fail(res,400,'Enter a valid asking price in naira.');
   const caseId=id('case'),created=now();const c={id:caseId,category:cat,offer_text:offerText,offer_url:offerUrl||null,asking_price:price,created_at:created};const assessment=buildAssessment(c);
   execute('INSERT INTO cases VALUES(?,?,?,?,?,?,?,?,?,?)',caseId,s.id,cat,offerText,offerUrl||null,price,'ANALYSIS_READY',JSON.stringify(assessment),created,created+CASE_TTL);
   audit('CASE_CREATED',caseId);return reply(res,201,{case:fullCase(stmt('SELECT * FROM cases WHERE id=?',caseId))});
 }
 const cm=p.match(/^\/api\/cases\/([^/]+)(?:\/(.*))?$/);
 if(cm){const c=getCase(req,cm[1]);if(!c)return fail(res,404,'Case not found in this session.');const sub=cm[2]||'';
   if(m==='GET'&&!sub)return reply(res,200,{case:fullCase(c)});
   if(m==='DELETE'&&!sub){removeMedia(c.id);execute('DELETE FROM cases WHERE id=?',c.id);audit('CASE_DELETED',c.id);return reply(res,200,{deleted:true});}
   if(m==='GET'&&sub==='gate')return reply(res,200,{gate:gateFor(c)});
   if(m==='POST'&&sub==='gate'){
     const b=await bodyJSON(req);
     if(typeof b.key!=='string'||!gateTemplate(c.category).some(x=>x.key===b.key))return fail(res,400,'Choose a recognized checklist step.');
     if(!['NOT_DONE','PLANNED','DONE','UNAVAILABLE'].includes(b.state))return fail(res,400,'Choose a valid step status.');
     if(typeof b.note!=='string'||b.note.length>500)return fail(res,400,'The private note must be at most 500 characters.');
     const note=redactText(string(b.note,500));
     execute('INSERT INTO buyer_checks(case_id,check_key,state,note,updated_at) VALUES(?,?,?,?,?) ON CONFLICT(case_id,check_key) DO UPDATE SET state=excluded.state,note=excluded.note,updated_at=excluded.updated_at',c.id,b.key,b.state,note,now());
     audit('BUYER_CHECK_UPDATED',c.id);
     return reply(res,200,{gate:gateFor(c)});
   }
   if(m==='POST'&&sub==='decision'){
     const b=await bodyJSON(req);
     if(!['PAUSE','WALK_AWAY','PROCEED_WITH_PRECAUTIONS'].includes(b.choice))return fail(res,400,'Choose a supported buyer decision.');
     if(b.acknowledged!==true)return fail(res,400,'Please acknowledge that no claims were independently verified by PROVE.');
     if(typeof b.note!=='string'||b.note.length>500)return fail(res,400,'The private decision note must be at most 500 characters.');
     execute('INSERT INTO buyer_decisions(case_id,choice,note,updated_at) VALUES(?,?,?,?) ON CONFLICT(case_id) DO UPDATE SET choice=excluded.choice,note=excluded.note,updated_at=excluded.updated_at',c.id,b.choice,redactText(string(b.note,500)),now());
     audit('BUYER_DECISION_RECORDED',c.id);
     return reply(res,200,{gate:gateFor(c),message:'Your decision is private, self-recorded and is not approval or certification from MABRIG PROVE.'});
   }
   if(m==='POST'&&sub==='evidence'){
     const b=await bodyJSON(req,3300000);const raw=typeof b.data==='string'?b.data:'';if(raw.length>3000000||raw.length<50||!/^[A-Za-z0-9+/]+={0,2}$/.test(raw))return fail(res,400,'Expected a small base64-encoded image.');
     const bytes=Buffer.from(raw,'base64');if(bytes.length>2*1024*1024)return fail(res,413,'Image must be at most 2MB.');const mime=mimeFor(bytes);if(!mime||mime!==b.mime)return fail(res,415,'Only authentic JPEG, PNG or WebP images are accepted.');
     if(stmt('SELECT COUNT(*) as n FROM evidence WHERE case_id=?',c.id).n>=2)return fail(res,400,'Maximum two images per case.');
     const assetId=id('asset'),objectName=random(32);fs.writeFileSync(path.join(evidenceDir,objectName),bytes,{mode:0o600,flag:'wx'});
     execute('INSERT INTO evidence VALUES(?,?,?,?,?,?,?,?)',assetId,c.id,'buyer',objectName,hash(bytes),mime,bytes.length,now());audit('EVIDENCE_ADDED',c.id);
     return reply(res,201,{evidence:{id:assetId,mime,bytes:bytes.length},notice:'Image retained as private supporting evidence. Automatic image reading is not enabled in this build.'});
   }
   const em=sub.match(/^evidence\/([^/]+)$/);
   if(m==='GET'&&em){const e=stmt('SELECT * FROM evidence WHERE case_id=? AND id=?',c.id,em[1]);if(!e)return fail(res,404,'Evidence not found');const bytes=fs.readFileSync(path.join(evidenceDir,e.object_name));res.writeHead(200,{...securityHeaders,'Content-Type':e.mime,'Content-Length':bytes.length,'Content-Disposition':'attachment; filename="supporting-evidence"'});return res.end(bytes);}
   if(m==='POST'&&sub==='invite'){
     const old=stmt('SELECT * FROM invites WHERE case_id=? AND revoked_at IS NULL AND expires_at>? ORDER BY created_at DESC LIMIT 1',c.id,now());
     if(old && !old.declined_at && !stmt('SELECT id FROM responses WHERE invite_id=?',old.id)) execute('UPDATE invites SET revoked_at=? WHERE id=?',now(),old.id);
     const b=await bodyJSON(req);const defaults=parse(c.assessment_json).questions;
     const prompts=Array.isArray(b.questions)?b.questions.map(v=>string(v,250)).filter(Boolean).slice(0,6):defaults;
     if(!prompts.length||prompts.some(q=>/\b(NIN|BVN|password|bank statement|passport photo|government ID)\b/i.test(q)))return fail(res,400,'Request up to six non-sensitive proof questions.');
     const token=random(30),inviteId=id('invite'),code=String(crypto.randomInt(100000,999999));
     execute('INSERT INTO invites VALUES(?,?,?,?,?,?,?,?,?)',inviteId,c.id,hash(token),code,JSON.stringify(prompts),now()+INVITE_TTL,null,null,now());
     execute("UPDATE cases SET status='CHALLENGE_SENT' WHERE id=?",c.id);audit('INVITE_CREATED',c.id);
     return reply(res,201,{invite:{token,challenge_code:code,questions:prompts,expires_at:now()+INVITE_TTL}});
   }
   if(m==='POST'&&sub==='invite/revoke'){
     execute('UPDATE invites SET revoked_at=? WHERE case_id=? AND revoked_at IS NULL',now(),c.id);audit('INVITE_REVOKED',c.id);return reply(res,200,{revoked:true});
   }
   if(m==='GET'&&sub==='report'){
     const invite=stmt('SELECT * FROM invites WHERE case_id=? ORDER BY created_at DESC LIMIT 1',c.id);const response=invite?stmt('SELECT * FROM responses WHERE invite_id=?',invite.id):null;
     return reply(res,200,{report:{...buildReport(c,parse(c.assessment_json),invite?{questions:parse(invite.questions_json)}:null,response?{answers:parse(response.answers_json)}:null),gate:gateFor(c)}});
   }
   if(m==='POST'&&sub==='abuse-report'){
     const b=await bodyJSON(req);const reason=string(b.reason,500);if(reason.length<8)return fail(res,400,'Provide a short description (at least 8 characters).');
     execute('INSERT INTO abuse_reports VALUES(?,?,?,?,?,?,?)',id('report'),null,c.id,'buyer',reason,now(),'OPEN');audit('ABUSE_REPORTED',c.id);return reply(res,201,{submitted:true});
   }
 }
 const pm=p.match(/^\/api\/proof\/([^/]+)(?:\/(.*))?$/);
 if(pm){const inv=getInvite(pm[1]);if(!inv)return fail(res,404,'Proof request is unavailable.');const status=inviteStatus(inv),sub=pm[2]||'';
   if(m==='GET'&&!sub)return reply(res,200,{proof:{challenge_code:inv.challenge_code,questions:parse(inv.questions_json),expires_at:inv.expires_at,status,privacy_notice:privacyNotice}});
   if(m==='POST'&&sub==='respond'){
     if(status!=='PENDING')return fail(res,409,`This request is ${status.toLowerCase()}.`);
     const b=await bodyJSON(req);if(b.consent!==true)return fail(res,400,'The seller must voluntarily consent before submitting.');
     const questions=parse(inv.questions_json);const answers=Array.isArray(b.answers)?b.answers.map(v=>redactText(string(v,1500))).slice(0,questions.length):[];
     if(answers.length!==questions.length||!answers.some(Boolean))return fail(res,400,'Please answer at least one question.');
     const rid=id('response');execute('INSERT INTO responses VALUES(?,?,?,?,?)',rid,inv.id,JSON.stringify(answers),now(),now());execute("UPDATE cases SET status='REPORT_READY' WHERE id=?",inv.case_id);audit('SELLER_RESPONDED',inv.id);
     return reply(res,201,{submitted:true,message:'Response received. This does not establish ownership or transaction safety.'});
   }
   if(m==='POST'&&sub==='decline'){
     if(status!=='PENDING')return fail(res,409,`This request is ${status.toLowerCase()}.`);
     execute('UPDATE invites SET declined_at=? WHERE id=?',now(),inv.id);execute("UPDATE cases SET status='SELLER_DECLINED' WHERE id=?",inv.case_id);audit('SELLER_DECLINED',inv.id);
     return reply(res,200,{declined:true,message:'Declining is your choice. No negative judgment is made.'});
   }
   if(m==='POST'&&sub==='report'){
     const b=await bodyJSON(req);const reason=string(b.reason,500);if(reason.length<8)return fail(res,400,'Please describe the concern.');
     execute('INSERT INTO abuse_reports VALUES(?,?,?,?,?,?,?)',id('report'),inv.id,null,'seller',reason,now(),'OPEN');audit('ABUSE_REPORTED',inv.id);
     return reply(res,201,{submitted:true});
   }
 }
 if(m==='POST'&&p==='/api/admin/login'){
   if(!adminConfigured)return fail(res,503,'Admin access is disabled until owner credentials and MFA controls are configured.');
   const b=await bodyJSON(req);const candidate=Buffer.from(string(b.password,200));const expected=Buffer.from(process.env.ADMIN_PASSWORD);
   if(candidate.length!==expected.length||!crypto.timingSafeEqual(candidate,expected))return fail(res,401,'Incorrect admin credentials.');
   const exp=String(now()+2*3600000),token=`${exp}.${hmac(exp)}`;
   return reply(res,200,{authenticated:true,notice:'Local preview admin only. MFA is required before any public release.'},{'Set-Cookie':`prove_admin=${token}; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=7200${process.env.NODE_ENV==='production'?'; Secure':''}`});
 }
 if(p.startsWith('/api/admin/')){
   if(!adminAllowed(req))return fail(res,403,'Administrator authentication required.');
   if(m==='GET'&&p==='/api/admin/overview')return reply(res,200,{counts:{cases:stmt('SELECT COUNT(*) n FROM cases').n,invites:stmt('SELECT COUNT(*) n FROM invites').n,responses:stmt('SELECT COUNT(*) n FROM responses').n,abuse:stmt("SELECT COUNT(*) n FROM abuse_reports WHERE status='OPEN'").n},warnings:['Local preview only; production requires MFA, dedicated identity provider and external security review.']});
   if(m==='GET'&&p==='/api/admin/reports')return reply(res,200,{reports:all('SELECT id,role,reason,created_at,status FROM abuse_reports ORDER BY created_at DESC LIMIT 50')});
   const rm=p.match(/^\/api\/admin\/reports\/([^/]+)\/resolve$/);
   if(m==='POST'&&rm){execute("UPDATE abuse_reports SET status='RESOLVED' WHERE id=?",rm[1]);audit('ABUSE_RESOLVED',rm[1]);return reply(res,200,{resolved:true});}
   if(m==='POST'&&p==='/api/admin/logout')return reply(res,200,{authenticated:false},{'Set-Cookie':'prove_admin=; HttpOnly; SameSite=Strict; Path=/api/admin; Max-Age=0'});
 }
 return fail(res,404,'Endpoint not found.');
}
const server=http.createServer((req,res)=>{Promise.resolve().then(()=>handler(req,res)).catch(e=>{if(!res.headersSent)fail(res,e.status||500,e.status?e.message:'An internal error occurred.');else res.end();if(!e.status)console.error('Internal application error:',e.stack);});});
const port=Number(process.env.PORT||4173),host=process.env.HOST||'127.0.0.1';server.listen(port,host,()=>console.log(`MABRIG PROVE running at http://${host}:${server.address().port}`));
