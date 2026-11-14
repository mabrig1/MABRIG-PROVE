/* MABRIG PROVE: transparent offline rules. Not independent verification or fraud detection. */
const patternRules = [
  {code:'ADVANCE_PAYMENT',pattern:/\b(deposit|upfront|advance payment|pay before|reservation fee|pay first|transfer (first|before)|send money first)\b/i, title:'Payment requested before inspection',detail:'The provided offer refers to paying in advance. Confirm the actual payment terms and avoid irreversible transfers before an independent inspection.',priority:2},
  {code:'URGENCY_PRESSURE',pattern:/\b(urgent|today only|last chance|hurry|pay now|right now|within (an? )?(hour|minute)|first to pay)\b/i,title:'Time pressure in offer',detail:'Urgency language appears in the offer. Allow time to examine the product and payment arrangements.',priority:1},
  {code:'INSPECTION_UNAVAILABLE',pattern:/\b(no inspection|can't meet|cannot meet|won't meet|cannot inspect|no pickup|no pick.?up|delivery only)\b/i,title:'Physical inspection may be restricted',detail:'The offer appears to limit in-person inspection. Request a verifiable demonstration or use a trusted independent inspector.',priority:2},
  {code:'OFF_PLATFORM',pattern:/\b(telegram only|private chat only|outside the platform|outside the app|dm only)\b/i,title:'Off-platform communication requested',detail:'Moving conversations away from a marketplace may reduce the protection or documentation available to the buyer.',priority:1},
  {code:'NON_RETURNABLE',pattern:/\b(no refunds|no return|no returns|sold as is|as-is sale)\b/i,title:'Limited return options mentioned',detail:'The text indicates returns may be restricted. Confirm terms in writing before paying.',priority:1}
];

const categoryPrompts = {
  phone:[
    'Please show the phone switching on, opening Settings and displaying its model and storage without exposing private accounts.',
    'Can the device be inspected in person, or by a trusted independent technician, before final payment?',
    'Please describe known repairs, screen or battery replacements, faults and network-lock status.',
    'Can you show a dated purchase receipt with names, addresses, IMEI and transaction details redacted?'
  ],
  laptop:[
    'Please demonstrate the laptop booting, Wi-Fi, keyboard, screen, ports and battery status.',
    'Can an independent technician inspect the device and confirm that it is not subject to a management lock?',
    'Please describe known repairs, defects, charger condition and battery health.',
    'Can you show any ownership or purchase evidence with personal identifiers redacted?'
  ],
  other:[
    'Please provide a recent demonstration of the actual item, not only catalogue photos.',
    'Can the item be independently inspected before final payment?',
    'Please describe defects, modifications and any restrictions on return.',
    'Can you provide non-sensitive purchase or ownership evidence with personal details redacted?'
  ]
};

export function suggestRedactions(text) {
  const found=[];
  if(/\b(?:\+?234|0)[789]\d{9}\b/.test(text)) found.push('possible Nigerian phone number');
  if(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text)) found.push('email address');
  if(/\b\d{10}\b/.test(text)) found.push('10-digit number (may be a bank account)');
  return found;
}
export function redactText(text) {
  return text.replace(/\b(?:\+?234|0)[789]\d{9}\b/g,'[PHONE REDACTED]')
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi,'[EMAIL REDACTED]')
    .replace(/\b\d{10}\b/g,'[NUMBER REDACTED]');
}
export function buildAssessment(record) {
  const text = [record.offer_text, record.offer_url].filter(Boolean).join('\n');
  const signals = patternRules.filter(rule=>rule.pattern.test(text)).map(({code,title,detail,priority})=>({code,title,detail,priority,source:'Submitted offer text'}));
  const weight=signals.reduce((s,r)=>s+r.priority,0);
  const attention = weight>=3?'URGENT_CAUTION':signals.length?'IMPORTANT_GAPS':'INSUFFICIENT_INFORMATION';
  const normalized=record.offer_text.replace(/\s+/g,' ').trim();
  const claims = (normalized.match(/[^.!?\n]+[.!?]?/g)||[]).map(v=>v.trim()).filter(v=>v.length>=8).slice(0,5).map((excerpt,i)=>({id:i+1,excerpt:excerpt.slice(0,180),evidence_status:'Seller/advert claim — not independently established'}));
  if(!claims.length) claims.push({id:1,excerpt:'The supplied material was not sufficient to extract a specific claim.',evidence_status:'Insufficient information'});
  const questions=categoryPrompts[record.category]??categoryPrompts.other;
  const next_steps=[
    'Do not rely on the advert alone to establish ownership, working condition or delivery.',
    'Request current, item-specific evidence without asking for an ID, bank statement or selfie.',
    'Arrange an independent in-person inspection or a protected transaction channel where available.'
  ];
  if(signals.some(x=>x.code==='ADVANCE_PAYMENT')) next_steps.unshift('Avoid sending an advance transfer until you have independently checked the item and payment method.');
  return {engine:'Transparent rules v0.2 (no external search or AI model)', attention, signals,claims,questions,next_steps, unknowns:['Whether the seller controls or legally owns the item','Whether the item condition matches the advertisement','Whether payment and delivery will be fulfilled'],limits:'This is an assessment of buyer-submitted information, not proof of ownership or a prediction of fraud. No external sites or databases were checked.'};
}
export function buildReport(caseRecord,assessment,request,response) {
  const submitted=(response?.answers||[]).filter(v=>String(v||'').trim().length>0).length;
  const questions=(request?.questions||[]).length;
  return {
    case_id:caseRecord.id,
    title:`${caseRecord.category[0].toUpperCase()+caseRecord.category.slice(1)} offer review`,
    attention:assessment.attention,
    created_at:caseRecord.created_at,
    findings:assessment.signals,
    seller_provided:response?`${submitted} of ${questions} requested answers supplied voluntarily. No answers have been independently corroborated.`:'No seller response submitted.',
    unknowns:assessment.unknowns,
    next_steps:assessment.next_steps,
    limitations:assessment.limits,
    summary:'Not independently verified. Review the evidence and arrange independent inspection before sending money.'
  };
}


/* Buyer-side decision gates: self-attested steps, never verification badges. */
const commonGate = [
  {key:'independent_inspection',label:'Arrange an independent inspection',detail:'See the exact item in person or use an independent inspector you choose. A seller video alone is not inspection.',critical:true},
  {key:'ownership_context',label:'Examine ownership context',detail:'Request redacted purchase history and check relevant serial or lock status without collecting identity documents.',critical:true},
  {key:'payment_protection',label:'Confirm a safer payment path',detail:'Avoid irrevocable advance transfers. Understand dispute options, recipient and payment timing.',critical:true},
  {key:'written_terms',label:'Document the agreed terms',detail:'Record item condition, price, delivery or collection terms, and a realistic dispute plan.',critical:false},
];
export function gateTemplate(category){
  const device = category==='phone'
    ? {key:'function_test',label:'Check the actual phone condition',detail:'Test calls, charging, screen, cameras, network access and activation lock without sharing IMEI or account credentials.',critical:true}
    : category==='laptop'
    ? {key:'function_test',label:'Test laptop condition and restrictions',detail:'Test boot, Wi-Fi, battery, keyboard, ports, charger and management locks before payment.',critical:true}
    : {key:'function_test',label:'Check the actual item condition',detail:'Confirm actual condition and functionality rather than relying only on catalogue photos.',critical:true};
  return [commonGate[0],commonGate[1],device,commonGate[2],commonGate[3]];
}
export function buildGate(category,entries=[],decision=null){
  const current=new Map(entries.map(e=>[e.check_key,e]));
  const items=gateTemplate(category).map(step=>({
    ...step,status:current.get(step.key)?.state||'NOT_DONE',
    note:current.get(step.key)?.note||'',updated_at:current.get(step.key)?.updated_at||null
  }));
  const completed=items.filter(x=>x.status==='DONE').length;
  const critical_pending=items.filter(x=>x.critical&&x.status!=='DONE').map(({key,label,status})=>({key,label,status}));
  return {items,completed,total:items.length,critical_pending,decision:decision?{
    choice:decision.choice,note:decision.note,created_at:decision.updated_at
  }:null,disclaimer:'These steps are marked by the buyer. PROVE has not independently checked any claimed inspection or proof. Completing a checklist is not a safety certificate.'};
}
