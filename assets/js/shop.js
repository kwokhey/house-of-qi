/* =====================================================================
   HOUSE OF QI · storefront
   Products, prices, shipping and homepage settings live in /data/catalog.json.
   Payment happens on Stripe Checkout via /api/checkout (Cloudflare Function).
   ===================================================================== */
let CFG={},CAT=[],BY={},TABS=[],INTENTS={},SHIP={};
async function loadCatalog(){
  let r=await fetch('/api/catalog',{cache:'no-cache'}).catch(()=>null);
  if(!r||!r.ok)r=await fetch('/data/catalog.json',{cache:'no-cache'});
  if(!r.ok)throw new Error('catalog');const d=await r.json();
  CFG=d;
  SHIP=Object.fromEntries(Object.entries(d.shipping).map(([k,s])=>[k,{...s,sub:s.note,eta:s.days?`${s.days[0]}–${s.days[1]} working days`:s.pickup?'By appointment':'DHL'}]));
  TABS=d.collections.map(c=>[c.id,c.name,c.zh,c.layout]);
  INTENTS=Object.fromEntries(Object.entries(d.intentions).map(([k,v])=>[k,[v.name,v.colour]]));
  CAT=d.products.map(p=>({...p,details:p.details||'',cat:p.collection,best:p.bestseller||0,sig:p.signature,nov:p.spotlight,desc:p.description||'',blurb:p.blurb||'',ints:p.intentions||[],grade:p.quality||'',meaning:p.meaning||'',zh:p.zh||'',stone:p.stone||'',
    groups:(p.groups||[]).map(g=>({...g,def:g.default,opts:g.opts.map(o=>[o.id,o.label,o.price||0,o.note,o.short])}))}));
  BY=Object.fromEntries(CAT.map(m=>[m.id,m]));
  /* one card per stone + type: the sheet lets the customer choose the exact piece (size, tone…) */
  FAM={};CAT.forEach(m=>{const k=[m.stone||m.name,(m.art&&m.art.type)||'',m.cat,String((m.art&&m.art.variant)||'').trim().replace(/\s+/g,' ')].join('|').toLowerCase(); /* same name + same description → one family; only bead size differs */m.fam=k;(FAM[k]=FAM[k]||[]).push(m)});
  Object.values(FAM).forEach(f=>{f.sort((a,b)=>(a.size||0)-(b.size||0)||a.price-b.price);const n={},k={};f.forEach(m=>{m.optLabel=m.details||m.grade||'Standard';n[m.optLabel]=(n[m.optLabel]||0)+1});
    f.forEach(m=>{if(n[m.optLabel]>1){k[m.optLabel]=(k[m.optLabel]||0)+1;m.optLabel+=` · No.${k[m.optLabel]}`}})})}
let FAM={},SZSEL='';
/* colour families + curated collections (set on the order page) */
const colSw=c=>c.hex.startsWith('#')?`background:${c.hex}`:`background:${c.hex}`;
const byIds=ids=>ids.map(id=>BY[id]).filter(Boolean);
function showFiltered(title,sub,items){$('#topbar').classList.add('searching');($('#home').classList.contains('is-search')||(window.__pre=$('#home').scrollTop)),$('#home').classList.add('is-search');$('#results').hidden=false;$('#home').scrollTop=0;
  const fams=famList(items);showResults(title,`${fams.length} design${fams.length===1?'':'s'}${sub?` · ${sub}`:''}`,fams)}
/** The card shown in lists for a family of pieces */
function famCard(m){const f=FAM[m.fam]||[m];if(f.length<2)return m;const live=f.filter(x=>!x.soldOut),pool=live.length?live:f;const rep=pool.find(x=>x.image)||pool[0];const min=pool.reduce((a,b)=>b.price<a.price?b:a);
  const mm=[...new Set(f.map(x=>x.size).filter(Boolean))].sort((a,b)=>a-b);
  return{...rep,price:min.price,was:min.was,sale:(f.find(x=>x.sale)||{}).sale||null,fromP:pool.some(x=>x.price!==min.price),multi:f.length,stock:undefined,soldOut:!live.length,
    details:`${f.length} options${mm.length>1?` · ${mm[0]}–${mm[mm.length-1]} mm`:mm.length?` · ${mm[0]} mm`:''}`,mms:mm.join(' '),
    desc:rep.blurb?rep.blurb:f.every(x=>x.stock===1)?`${f.length} one-of-a-kind pieces to choose from.`:`Choose from ${f.length} ${mm.length>1?'sizes and tones':'pieces'}.`}}
/* lists show every single piece (no grouping); the product page still offers the other sizes */
const famList=items=>items.slice();
/* Real photos: set "image" on a product in catalog.json (e.g. "assets/img/products/star-rose-12mm.jpg").
   Products without a photo use the drawn artwork from art.js. */
const img=(id,v='sq')=>(BY[id]&&BY[id].image)?'/'+BY[id].image.replace(/^\//,''):ART.get(id,v,BY[id]&&BY[id].art);
const maxQty=m=>typeof m.stock==='number'?Math.min(20,m.stock):20;
const inBag=id=>S.cart.filter(l=>l.id===id).reduce((t,l)=>t+l.qty,0);
const stockTag=m=>m.preorder?'':typeof m.stock!=='number'||m.stock<=0?'':m.stock===1?'One of a kind':m.stock<=3?`Only ${m.stock} left`:'';
const subLine=m=>{const t=[m.details,m.zh?`<span class="zh">${m.zh}</span>`:''].filter(Boolean).join(' · ');return t?`<span class="ri-zh">${t}</span>`:''};

/* =====================================================================
   STATE  (the bag is kept in this browser only)
   ===================================================================== */
const KEY='house-of-qi-bag-v1';
let S={cart:[],ship:'west'};
try{const v=JSON.parse(localStorage.getItem(KEY)||'null');if(v&&Array.isArray(v.cart))S={cart:v.cart,ship:v.ship||'west',code:typeof v.code==='string'?v.code:''}}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify({cart:S.cart,ship:S.ship,code:S.code||''}))}catch(e){}};
/* discount code: checked by the server for this exact bag + delivery; any change means it is checked again */
const bagSig=()=>JSON.stringify([S.ship,S.cart.map(l=>[l.id,l.qty,l.sel])]);
const promoOK=()=>!!(S.promo&&S.promo.sig===bagSig());
const R2=n=>Math.round(n*100+1e-9)/100;
const RM=n=>'RM'+n.toLocaleString('en-MY',{minimumFractionDigits:2,maximumFractionDigits:2});
const $=(s,el=document)=>el.querySelector(s);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const vib=n=>{try{navigator.vibrate&&navigator.vibrate(n)}catch(e){}};
const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const unit=(m,sel)=>R2(m.price+m.groups.reduce((t,g)=>{const v=sel[g.id];if(g.type==='many')return t+g.opts.filter(o=>v.includes(o[0])).reduce((a,o)=>a+o[2],0);const o=g.opts.find(o=>o[0]===v);return t+(o?o[2]:0)},0));
const hasFrom=m=>m.groups.some(g=>g.type==='one'&&g.opts.some(o=>o[2]>0));
function optText(m,sel){const out=[];for(const g of m.groups){const v=sel[g.id];if(g.type==='many'){g.opts.filter(o=>v.includes(o[0])).forEach(o=>out.push(o[1]));continue}const o=g.opts.find(o=>o[0]===v);if(o)out.push(o[4]||o[1])}return out}
const lineTotal=l=>R2(unit(BY[l.id],l.sel)*l.qty);
/* delivery: 1–3 pieces = base rate (up to 500 g); each further block of 3 pieces adds the option's extra */
const pieces=(lines=S.cart)=>lines.reduce((t,l)=>t+l.qty,0);
const shipFee=(s,n)=>!s||s.pickup||s.contact?0:R2(s.fee+(Math.max(1,Math.ceil((n||1)/(s.perItems||3)))-1)*(s.extra||0));
const wNote=(s,n=pieces())=>!s||s.pickup||s.contact?'':s.extra&&(n||1)>(s.perItems||3)?'estimated over 500 g':'up to 500 g';
const quoteShip=(k)=>!!(SHIP[k]&&SHIP[k].contact);
function totals(lines=S.cart,ship=S.ship){const sub=R2(lines.reduce((t,l)=>t+lineTotal(l),0));const s=SHIP[ship]||Object.values(SHIP)[0];let fee=shipFee(s,pieces(lines));
  const p=lines===S.cart&&ship===S.ship&&promoOK()?S.promo:null;if(p&&p.freeShip)fee=0;const disc=p?p.discount:0;
  const po=isPO(lines);if(po){const dep=R2(lines.reduce((t,l)=>t+R2(unit(BY[l.id],l.sel)/2)*l.qty,0));return{sub,fee:0,balFee:fee,disc:0,code:'',freeCode:false,po:true,dep,bal:R2(sub-dep+fee),total:dep,count:lines.reduce((t,l)=>t+l.qty,0)}}
  return{sub,fee,disc,code:p?p.code:'',freeCode:!!(p&&p.freeShip),total:R2(sub-disc+fee),count:lines.reduce((t,l)=>t+l.qty,0)}}
const isPO=(lines=S.cart)=>lines.some(l=>BY[l.id]&&BY[l.id].preorder);
function pruneCart(){S.cart=S.cart.filter(l=>{const m=BY[l.id];if(!m||(m.soldOut&&!m.reserved)||!l.sel)return false;for(const g of m.groups){const v=l.sel[g.id];if(g.type==='many'){if(!Array.isArray(v))return false}else if(!g.opts.some(o=>o[0]===v))return false}return true});if(!SHIP[S.ship])S.ship=Object.keys(SHIP)[0];save()}

const IC={
  plus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  minus:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M5 12h14"/></svg>',
  check:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
  trash:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M4 7h16M9 7V4.5h6V7M6.5 7l1 13h9l1-13"/></svg>',
  lock:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="10.5" width="14" height="10" rx="2"/><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5"/></svg>',
  wa:'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20l1.3-3.9A8 8 0 1 1 8 19z"/><path d="M9 9.5c.3 2.2 2.3 4.2 4.5 4.5l1-1.2 2 .8c-.2 1.3-1.2 2-2.4 1.8C10.8 15 8.9 13.1 8.4 9.8c-.2-1.2.5-2.2 1.8-2.4l.8 2z"/></svg>',
};

/* =====================================================================
   SHOP
   ===================================================================== */
const priceHTML=m=>`${hasFrom(m)||m.fromP?'<span class="from">From</span>':''}${m.was?`<s class="was">${RM(m.was)}</s>`:''}<span class="price${m.was?' now':''}">${RM(m.price)}</span>${m.sale?`<span class="off">−${m.sale.percent}%</span>`:''}${m.preorder&&!m.preorderClosed?'<span class="po-mini">Pre-order</span>':''}`;
const intTag=m=>m.preorderClosed?'<span class="tag out">Pre-order closed</span>':m.preorder?'':m.soldOut?`<span class="tag out">${m.reserved?'Reserved':'Sold out'}</span>`:`<span class="tag${m.sale?' sale':''}">${m.sale?esc(m.sale.name):stockTag(m)||m.ints.filter(i=>INTENTS[i]).map(i=>INTENTS[i][0]).join(' · ')}</span>`;
const WIDE=matchMedia('(min-width:768px)');
const row=(m,v='sq')=>`<button class="ri" data-open="${m.id}"${m.soldOut?' data-out':''}${m.preorderClosed?' data-pc':''}><span class="ri-txt"><span class="ri-name">${m.name}</span>${subLine(m)}<span class="ri-desc">${m.blurb||m.desc}</span><span class="ri-foot"><span>${priceHTML(m)}</span>${intTag(m)}</span></span><span class="ri-img"><img src="${img(m.id,v)}" alt="${m.name}" decoding="async"><span class="ri-add">${IC.plus}</span></span></button>`;
const lead=(m,v='lead')=>`<button class="lead" data-open="${m.id}"${m.soldOut?' data-out':''}${m.preorderClosed?' data-pc':''}><span class="lead-img"><img src="${img(m.id,v)}" alt="${m.name}" decoding="async"></span><span class="lead-top"><span class="ri-name">${m.name}</span><span>${priceHTML(m)}</span></span>${subLine(m)}<span class="ri-desc">${m.blurb||m.desc}</span></button>`;
const gcard=(m,v='tall')=>`<button class="gc" data-open="${m.id}"${m.soldOut?' data-out':''}${m.preorderClosed?' data-pc':''}><span class="gc-img"><img src="${img(m.id,v)}" alt="${m.name}" decoding="async"><span class="ri-add">${IC.plus}</span></span><span class="ri-name">${m.short||m.name}</span>${subLine(m)}<span>${priceHTML(m)}</span></button>`;
const card=(m,label,v='tall')=>`<button class="pc" data-open="${m.id}"${m.soldOut?' data-out':''}${m.preorderClosed?' data-pc':''}><span class="pc-img"><img src="${img(m.id,v)}" alt="${m.name}" decoding="async">${label?`<span class="pc-rank">${label}</span>`:''}</span><span class="pc-name">${m.short||m.name}</span>${subLine(m)}<span>${priceHTML(m)}</span></button>`;
function renderHome(){
  const W=WIDE.matches,h=CFG.hero||{},feat=BY[h.product]||CAT[0],best=CAT.filter(m=>m.best).sort((a,b)=>a.best-b.best),nov=CAT.filter(m=>m.nov),of=c=>CAT.filter(m=>c==='preorder'?m.preorder:m.cat===c);
  const head=(name,zh,n,unit='pieces')=>`<div class="sec-head"><h3 class="disp">${name}</h3>${zh?`<span class="zh">${esc(zh)}</span>`:''}<span class="count">${n} ${n===1?unit.replace(/s$/,''):unit}</span></div>`;
  const [t1,t2]=(h.title||feat.name).split('|');
  const usedInts=Object.entries(INTENTS).filter(([k])=>CAT.some(m=>m.ints.includes(k)));
  const LIMIT=12,more=(id,n)=>n>LIMIT?`<button class="ghost show-all" data-act="showAll" data-sec="${id}">Show all ${n}</button>`:'',hid=i=>i>=LIMIT?' hidden data-more':'';
  const mmA=m=>m.mms?` data-mm="${m.mms}"`:m.size?` data-mm="${m.size}"`:'';
  // bead-size picker: only for bracelet sections with more than one size
  const sizes=(id,items)=>{const n={};items.forEach(m=>{if(m.size&&/bracelet/i.test(m.name))(n[m.size]=n[m.size]||new Set()).add(m.fam)});Object.keys(n).forEach(k=>n[k]=n[k].size);const ks=Object.keys(n).map(Number).sort((a,b)=>a-b);
    if(ks.length<2)return'';
    return`<div class="sizes" role="group" aria-label="Bead size"><span class="sizes-lab">Bead size</span><div class="sizes-row"><button class="chip-s on" data-act="size" data-sec="${id}" data-mm="" aria-pressed="true">All</button>${ks.map(k=>`<button class="chip-s" data-act="size" data-sec="${id}" data-mm="${k}" aria-pressed="false">${k} mm<small>${n[k]}</small></button>`).join('')}</div><p class="sizes-tip">Smaller beads (4–7 mm) sit delicately; 8–10 mm is the everyday size; 12 mm and up makes a statement.</p></div>`};
  // price picker: every shop section (bracelets, pendants, rings, earrings, décor…) with 6+ pieces in 2+ price bands
  const PB=[[0,100,'Under RM100'],[100,300,'RM100–299'],[300,600,'RM300–599'],[600,1000,'RM600–999'],[1000,0,'RM1,000+']];
  const prA=m=>` data-pr="${Math.round(Number(m.price)||0)}"`;
  const prices=(id,items)=>{if(items.length<6)return'';const n=PB.map(([lo,hi])=>items.filter(m=>m.price>=lo&&(!hi||m.price<hi)).length);if(n.filter(Boolean).length<2)return'';
    return`<div class="sizes prices" role="group" aria-label="Price"><span class="sizes-lab">Price</span><div class="sizes-row"><button class="chip-s chip-p on" data-act="price" data-sec="${id}" data-pr="" aria-pressed="true">All</button>${PB.map(([lo,hi,l],i)=>n[i]?`<button class="chip-s chip-p" data-act="price" data-sec="${id}" data-pr="${lo}-${hi}" aria-pressed="false">${l}<small>${n[i]}</small></button>`:'').join('')}</div></div>`};
  const intents=!usedInts.length?'':`<section class="sec gx" id="sec-intent"><div class="sec-head"><h3 class="disp">Shop by <em>intention</em></h3></div><div class="intents">${usedInts.map(([k,[n,c]])=>`<button class="chip-i" data-act="intent" data-k="${k}" style="--c:${c}"><i></i>${esc(n)}</button>`).join('')}</div></section>`;
  const spot=nov.length&&CFG.spotlight?`<section class="sec" id="sec-nov"><div class="gx">${head(esc(CFG.spotlight.title),'',nov.length)}${CFG.spotlight.note?`<p class="sec-note">${esc(CFG.spotlight.note)}</p>`:''}</div><div class="rail gx">${nov.map(m=>card(m,null,W?'lead':'tall')).join('')}<span class="rail-end"></span></div></section>`:'';
  const cols=(CFG.curated||[]).filter(c=>byIds(c.ids).length);
  const collSec=!cols.length?'':`<section class="sec disc" id="sec-colls"><div class="gx"><div class="sec-head"><h3 class="disp">Premium <em>Collectibles</em></h3><span class="count">${cols.length}</span></div></div>
    <div class="rail gx coll-rail">${cols.map(c=>{const n=byIds(c.ids).length;return`<button class="coll" data-act="coll" data-id="${c.id}"><span class="coll-img"><img src="${c.coverImg?'/'+c.coverImg:img(c.cover||c.ids[0],'tall')}" alt="" decoding="async" loading="lazy"></span><span class="coll-txt"><b>${esc(c.name)}</b>${c.zh?`<span class="zh">${esc(c.zh)}</span>`:''}${c.blurb?`<small>${esc(c.blurb)}</small>`:''}<em>${n} piece${n===1?'':'s'}</em></span></button>`}).join('')}<span class="rail-end"></span></div></section>`;
  const colours=(CFG.colours||[]);
  const colSec=colours.length<2?'':`<section class="sec disc gx" id="sec-colour"><div class="sec-head"><h3 class="disp">Shop by <em>colour</em></h3></div>
    <div class="swatches">${colours.map(c=>`<button class="sw" data-act="colour" data-k="${c.id}" aria-label="${esc(c.name)}, ${c.n} pieces"><i style="${colSw(c)}"></i><b>${esc(c.name)}</b><small>${c.n}</small></button>`).join('')}</div></section>`;
  const births=(CFG.birthstones||[]);
  const birthSec=!births.length?'':`<section class="sec disc gx" id="sec-birth"><div class="sec-head bs-head"><h3 class="disp">Shop by <em>birthstone</em></h3></div>
    <div class="bstones">${births.map((b,i)=>`<button class="bs" data-act="birth" data-i="${i}"><img src="/assets/img/birth/${b.img}.webp" alt="${esc(b.gem)}" width="80" height="80" loading="lazy" decoding="async"><b>${esc(b.m)}</b><small>${esc(b.gem)}</small></button>`).join('')}</div></section>`;
  const chak=(CFG.chakras||[]);
  const chakSec=!chak.length?'':`<section class="sec disc gx" id="sec-chakra"><div class="sec-head bs-head"><h3 class="disp">Shop by <em>chakra</em></h3></div>
    <p class="ck-lede">Seven energy centres run from the base of the spine to the crown of the head. Choose the one you want to balance.</p>
    <div class="chakras">${chak.map((c,i)=>`<button class="ck" data-act="chakra" data-i="${i}" style="--ck:${c.colour}"><img src="/assets/img/chakra/${c.k}.svg" alt="" width="76" height="76" loading="lazy"><span class="ck-t"><b>${esc(c.name)}</b><small>${esc(c.sk)}</small><em>${esc(c.theme)}</em></span></button>`).join('')}</div></section>`;
  SPY=[];
  const secs=TABS.map(([id,name,zh,layout])=>{
    const raw=layout==='bestsellers'?best:of(id);if(!raw.length)return'';SPY.push(id);const items=layout==='bestsellers'?raw:famList(raw);const few=items.length<=2;
    if(layout==='bestsellers')return`<section class="sec" id="sec-${id}"><div class="gx">${head(esc(name),zh,items.length)}</div><div class="rail gx">${items.map((m,i)=>card(m,'No.'+(i+1))).join('')}<span class="rail-end"></span></div></section>`;
    if(layout==='feature')return`<section class="sec gx sec-feature" id="sec-${id}">${head(esc(name),zh,raw.length)}${sizes(id,raw)}${prices(id,items)}${lead(items[0],W?'tall':'lead').replace('<button ',`<button${mmA(items[0])}${prA(items[0])} `)}<div class="list"${W?'':' style="border-top:1px solid var(--line)"'}>${items.slice(1).map((m,i)=>row(m,W?'tall':'sq').replace('<button ',`<button${hid(i+1)}${mmA(m)}${prA(m)} `)).join('')}</div><p class="sz-none" hidden>No pieces match right now.</p>${more(id,items.length)}</section>`;
    const seas=id!=='preorder'?'':`<p class="sec-note">${CFG.preSeason?`${CFG.preSeason.name?`<b>${esc(CFG.preSeason.name)}</b> · `:''}Open now${CFG.preSeason.ends?` until ${new Date(CFG.preSeason.ends).toLocaleDateString('en-MY',{day:'numeric',month:'long'})}`:''} · `:''}Pay a 50% deposit now and the rest when your piece is ready.</p>`;
    if(layout==='grid')return`<section class="sec gx${few?' few':''}" id="sec-${id}">${head(esc(name),zh,items.length)}${seas}${prices(id,items)}<div class="grid2">${items.map((m,i)=>gcard(m,W&&few?'lead':'tall').replace('<button ',`<button${hid(i)}${prA(m)} `)).join('')}</div><p class="sz-none" hidden>No pieces match right now.</p>${more(id,items.length)}</section>`;
    return`<section class="sec gx${few?' few':''}" id="sec-${id}">${head(esc(name),zh,items.length,id==='sets'?'sets':'pieces')}${prices(id,items)}<div class="list">${items.map((m,i)=>row(m,W?(few?'lead':'tall'):'sq').replace('<button ',`<button${hid(i)}${prA(m)} `)).join('')}</div><p class="sz-none" hidden>No pieces match right now.</p>${more(id,items.length)}</section>`}).filter(Boolean);
  secs.splice(1,0,intents+spot);
  $('#homeBody').innerHTML=`
  ${CFG.announce?`<div class="ann-bar">${CFG.announce.link?`<a href="${esc(CFG.announce.link)}">${esc(CFG.announce.text)}</a>`:`<span>${esc(CFG.announce.text)}</span>`}</div>`:''}
  <div class="strip gx"><span class="dia"></span><span>Jewellery with frequencies</span><span class="dia"></span><span>Delivery across Malaysia · Worldwide on request</span></div>
  ${banHTML()||`  <button class="feature" data-open="${feat.id}" aria-label="${esc(feat.name)}">
    <span class="feature-img"><img src="${img(feat.id,W?'banner':'wide')}" alt="" decoding="async"></span>
    <span class="feature-meta gx"><span class="eyebrow"><i></i>${esc(h.eyebrow||'Featured')}</span><h2 class="disp">${esc(t1)}${t2?`<br><em>${esc(t2)}</em>`:''}</h2>${h.text?`<p>${esc(h.text)}</p>`:''}
    <span class="feature-row"><span class="price">${hasFrom(feat)?'<small>From</small>':''}${feat.was?`<s class="was">${RM(feat.was)}</s>`:''}${RM(feat.price)}</span><span class="pill-add">Shop now</span></span></span>
  </button>`}
  ${collSec}${colSec}${birthSec}${chakSec}
  <nav class="tabs" aria-label="Collections"><div class="tabs-in gx" id="tabsIn">${cols.length?'<button class="tab" data-act="colls" data-cat="colls">Collectibles</button>':''}${TABS.filter(([id])=>SPY.includes(id)).map(([id,n])=>`<button class="tab" data-act="tab" data-cat="${id}">${esc(n)}</button>`).join('')}<span class="tab-ink" id="tabInk"></span></div></nav>
  ${secs.join('\n')}
  ${faqHTML()}
  <footer class="foot gx"><span class="mark" aria-hidden="true"></span><p class="co">by Soleil Trinity Infinite Resources Sdn.&nbsp;Bhd.<span>202201006345 (1452042-H)</span></p>
    <nav class="foot-links"><a href="/crystals">Crystal meanings</a><a href="/bracelets">Bracelets</a><a href="/policies">Shipping &amp; returns</a><a href="/policies#privacy">Privacy</a>${CFG.whatsapp?`<a href="https://wa.me/${encodeURIComponent(CFG.whatsapp)}" target="_blank" rel="noopener">WhatsApp us</a>`:''}</nav>
    <p class="foot-gem"><b>Please Note:</b> Due to the natural characteristics of gemstones, variations in colour, tone, clarity and patterns may occur. Actual product colours may also differ slightly from photographs due to lighting conditions, photography and individual screen settings. These natural variations contribute to the unique beauty and individuality of each piece.</p>
    <p>Prices in Malaysian Ringgit.</p><p>Crystal meanings describe traditional beliefs and are not medical advice.</p></footer>`;
  document.querySelectorAll('#dnav .tab[data-cat]').forEach(b=>b.hidden=b.dataset.cat==='colls'?!cols.length:!SPY.includes(b.dataset.cat));
  renderMega();initBan();
  setTab(SPY[0],false);
}

/* desktop "Shop" menu: by colour, category, collection, intention, bead size */
function renderMega(){const m=$('#mega');if(!m)return;const cols=(CFG.curated||[]).filter(c=>byIds(c.ids).length);
  const sizes=[...new Set(CAT.filter(x=>x.cat==='bracelets'&&x.size).map(x=>x.size))].sort((a,b)=>a-b);
  const usedInts=Object.entries(INTENTS).filter(([k])=>CAT.some(x=>x.ints.includes(k)));
  const col=(h,body)=>body?`<div class="mg-col"><h4>${h}</h4>${body}</div>`:'';
  m.innerHTML=`<div class="mg-in">${col('By colour',(CFG.colours||[]).map(c=>`<button data-act="colour" data-k="${c.id}"><i style="${colSw(c)}"></i>${esc(c.name)}<small>${c.n}</small></button>`).join(''))}
    ${col('By birthstone',(CFG.birthstones||[]).map((b,i)=>`<button data-act="birth" data-i="${i}"><img class="mg-bs" src="/assets/img/birth/${b.img}.webp" alt="" loading="lazy">${esc(b.m)}<em class="mg-gem">${esc(b.gem)}</em></button>`).join(''))}
    ${col('By intention',usedInts.map(([k,[n,c]])=>`<button data-act="intent" data-k="${k}"><i class="dot" style="background:${c}"></i>${esc(n)}</button>`).join(''))}
    ${col('By category',TABS.filter(([id])=>SPY.includes(id)).map(([id,n])=>`<button data-act="tab" data-cat="${id}">${esc(n)}<small>${CAT.filter(x=>x.cat===id).length}</small></button>`).join(''))}
    ${col('Bracelets by bead size',sizes.length?`<div class="mg-sizes">${sizes.map(z=>`<button data-act="sizeGo" data-mm="${z}">${z} mm</button>`).join('')}</div>`:'')}</div>`}

/* ---------- home page banner (photo + headline) ---------- */
function banHTML(){const b=CFG.banner,I=(b&&(b.imgs||(b.img?[b.img]:[])))||[];if(!I.length)return'';const [t1,t2]=String(b.title||'Healing crystals|for wellness & balance').split('|');
  return`<section class="ban" id="ban" aria-label="${esc((t1+' '+(t2||'')).trim())}" aria-roledescription="carousel">
  ${I.map((u,i)=>`<img class="ban-img${i?'':' on'}" src="/${u.replace(/^\//,'')}" alt="" decoding="async"${i?' loading="lazy"':' fetchpriority="high"'}>`).join('')}
  <span class="ban-shade"></span>
  <div class="ban-in"><div class="ban-txt">
    <span class="ban-ln ban-eye"><i></i>Natural crystal jewellery</span>
    <h2 class="ban-ln ban-h">${esc(t1.trim())}${t2?`<em>${esc(t2.trim())}</em>`:''}</h2>
    ${b.text?`<p class="ban-ln">${esc(b.text)}</p>`:''}
    <span class="ban-ln"><button class="ban-btn" data-act="banGo">${esc(b.cta||'Shop our collection')}</button></span>
  </div></div>
  ${I.length>1?`<div class="ban-dots" role="tablist" aria-label="Banner photos">${I.map((u,i)=>`<button class="bd${i?'':' on'}" data-act="banSet" data-i="${i}" role="tab" aria-selected="${!i}" aria-label="Photo ${i+1} of ${I.length}"><i></i></button>`).join('')}</div>`:''}</section>`}
const BAN={i:0,t:null,seen:true,hover:false},BAN_MS=6000;
function banWide(im){const f=()=>im.classList.toggle('wide',im.naturalWidth/im.naturalHeight>1.35);if(im.complete&&im.naturalWidth)f();else im.addEventListener('load',f,{once:true})}
function banSet(n){const r=$('#ban');if(!r)return;const S=r.querySelectorAll('.ban-img'),k=S.length;if(k<2)return;n=(n%k+k)%k;
  if(n!==BAN.i){S[BAN.i].classList.remove('on');S[BAN.i].classList.add('off');const old=S[BAN.i];setTimeout(()=>old.classList.remove('off'),1800);
    S[n].classList.remove('off');S[n].classList.add('on');BAN.i=n;
    const nx=S[(n+1)%k];if(nx.loading==='lazy')nx.loading='eager'}
  r.querySelectorAll('.bd').forEach((d,i)=>{d.classList.toggle('on',i===n);d.setAttribute('aria-selected',i===n)});banTimer()}
function banTimer(){clearTimeout(BAN.t);const r=$('#ban');if(!r)return;const k=r.querySelectorAll('.ban-img').length;
  r.querySelectorAll('.bd').forEach(x=>x.classList.remove('run'));const d=r.querySelector('.bd.on');
  if(k<2||!BAN.seen||BAN.hover||document.hidden||matchMedia('(prefers-reduced-motion: reduce)').matches)return;
  if(d){void d.offsetWidth;d.classList.add('run')}
  BAN.t=setTimeout(()=>banSet(BAN.i+1),BAN_MS)}
function initBan(){const r=$('#ban');clearTimeout(BAN.t);if(!r)return;BAN.i=0;const S=r.querySelectorAll('.ban-img');S.forEach(banWide);
  const first=S[0],go=()=>requestAnimationFrame(()=>r.classList.add('in'));if(first.complete&&first.naturalWidth)go();else{first.addEventListener('load',go,{once:true});first.addEventListener('error',go,{once:true})}
  if(S[1])S[1].loading='eager';
  const tx=r.querySelector('.ban-txt');tx.addEventListener('pointerenter',e=>{if(e.pointerType==='mouse'){BAN.hover=true;banTimer()}});tx.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse'){BAN.hover=false;banTimer()}});
  let x0=null,y0=0;r.addEventListener('touchstart',e=>{x0=e.touches[0].clientX;y0=e.touches[0].clientY},{passive:true});
  r.addEventListener('touchend',e=>{if(x0==null)return;const dx=e.changedTouches[0].clientX-x0,dy=e.changedTouches[0].clientY-y0;x0=null;if(Math.abs(dx)>45&&Math.abs(dx)>Math.abs(dy)*1.3)banSet(BAN.i+(dx<0?1:-1))},{passive:true});
  if('IntersectionObserver' in window)new IntersectionObserver(es=>{BAN.seen=es[0].isIntersecting;banTimer()},{threshold:.3}).observe(r);
  if(!BAN.vis){BAN.vis=1;document.addEventListener('visibilitychange',banTimer)}
  banTimer()}

/* questions & answers (same answers search engines and AI assistants read) */
function faqHTML(){const Q=CFG.faqs||[];if(!Q.length)return'';
  return`<section class="faq gx" id="faq" aria-labelledby="faqH"><div class="faq-in"><span class="eyebrow">Good to know</span><h2 class="disp" id="faqH">Questions &amp; <em>Answers</em></h2>
  <div class="faq-list">${Q.map(([q,a])=>`<details class="faq-i"><summary>${esc(q)}<i aria-hidden="true"></i></summary><p>${esc(a)}</p></details>`).join('')}</div></div></section>`}
let spyLock=0;
let SPY=[];
function hdrH(){return $('#topbar').offsetHeight+($('.tabs')?.offsetHeight||0)}
function setTab(id,scrollStrip=true){document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('on',t.dataset.cat===id));
  const t=document.querySelector(`#tabsIn .tab[data-cat="${id}"]`),ink=$('#tabInk');if(!t||!ink)return;ink.style.width=t.offsetWidth+'px';ink.style.transform=`translateX(${t.offsetLeft}px)`;
  if(scrollStrip){const s=$('#tabsIn');s.scrollTo({left:Math.max(0,t.offsetLeft-s.clientWidth/2+t.offsetWidth/2),behavior:'smooth'})}}
function spy(){if(Date.now()<spyLock)return;const home=$('#home'),top=home.getBoundingClientRect().top+hdrH()+24;let cur=SPY[0];
  for(const id of SPY){const el=$('#sec-'+id);if(el&&el.getBoundingClientRect().top<=top)cur=id}
  if(home.scrollTop+home.clientHeight>=home.scrollHeight-4)cur=SPY[SPY.length-1];
  const on=document.querySelector('.tab.on');if(!on||on.dataset.cat!==cur)setTab(cur)}
$('#home').addEventListener('scroll',()=>requestAnimationFrame(spy),{passive:true});

function showResults(title,sub,items){const box=$('#results');box.innerHTML=`<div class="res-head"><h3 class="disp">${title}</h3><span>${sub}</span></div>`+(items.length?`<div class="list">${items.map(m=>row(m,WIDE.matches?'tall':'sq')).join('')}</div>`:`<p class="empty-q">Nothing matches yet.</p>`)}
function search(q){q=q.trim().toLowerCase();if(!q){$('#results').innerHTML='<p class="empty-q">Try “rose quartz”, “citrine” or “pendant”.</p>';return}
  const hits=CAT.filter(m=>(m.name+' '+m.zh+' '+m.details+' '+m.id+' '+m.desc+' '+m.stone+' '+m.cat+' '+m.ints.map(i=>INTENTS[i][0]).join(' ')).toLowerCase().includes(q));
  hits.length?showResults('Results',`${hits.length} for “${esc(q)}”`,hits):($('#results').innerHTML=`<p class="empty-q">No pieces match “${esc(q)}”.</p>`)}
$('#q').addEventListener('input',e=>{window.__fv=null;search(e.target.value)});
$('#q').addEventListener('keydown',e=>{if(e.key==='Enter')e.target.blur()});

/* =====================================================================
   PRODUCT SHEET
   ===================================================================== */
let DR=null;
function defaults(m){const s={};for(const g of m.groups)s[g.id]=g.type==='many'?[]:(g.def||g.opts[0][0]);return s}
/* rose quartz rings can be made to order (price may differ) */
const labNote=m=>/labradorite/i.test((m.stone||'')+' '+(m.name||''))&&/pendant/i.test(((m.art&&m.art.type)||'')+' '+(m.name||''));
const mto=m=>/rose quartz/i.test(m.stone||'')&&/ring/i.test((m.art&&m.art.type)||'');
/* ---------- product sheet: choose the exact piece, gift card with live preview ---------- */
const chakraOf=m=>(CFG.chakras||[]).map((c,i)=>({...c,i})).filter(c=>c.stones.some(x=>x.toLowerCase()===String(m.stone).toLowerCase()));
const isSample=m=>/\/samples\//.test(m.image||'');
function cardOptOf(m){for(const g of m.groups)if(g.type==='many')for(const o of g.opts)if(/card/i.test(o[1]))return[g.id,o[0]];return null}
const cardOn=()=>{const c=DR&&cardOptOf(DR.m);return!!(c&&DR.sel[c[0]]&&DR.sel[c[0]].includes(c[1]))};
const fv=s=>(($(s)||{}).value||'').trim();
function readCard(){return{to:fv('#gTo'),msg:fv('#gMsg'),from:fv('#gFrom'),note:fv('#note')}}
function composeNote(){const p=[];if(cardOn()){const c=readCard();if(c.to||c.msg||c.from)p.push(`Gift card · To: ${c.to||'—'} · “${c.msg||''}” · From: ${c.from||'—'}`)}
  const rs=fv('#ringSz');if(rs)p.unshift(`Ring size: ${rs}`);
  const n=fv('#note');if(n)p.push(`Request: ${n}`);return p.join(' | ').slice(0,300)}
function paintCard(){const c=readCard();$('#gcTo').textContent=c.to||'Dear you';$('#gcMsg').textContent=c.msg||'Your message, written by hand on our card.';
  $('#gcFrom').textContent=c.from?`with love, ${c.from}`:'';const n=$('#gCnt');if(n)n.textContent=`${c.msg.length}/160`}
function keepSel(m,old){const s=defaults(m);for(const g of m.groups)if(old&&old[g.id]!==undefined){if(g.type==='many')s[g.id]=old[g.id].filter(o=>g.opts.some(x=>x[0]===o));else if(g.opts.some(x=>x[0]===old[g.id]))s[g.id]=old[g.id]}return s}
let DR_READY=false;
function openDetail(id,keep){let m=BY[id];if(!m)return;
  if(!keep&&typeof SZSEL!=='undefined'&&SZSEL){const hit=(FAM[m.fam]||[]).find(x=>String(x.size)===SZSEL);if(hit&&String(m.size)!==SZSEL)m=hit}
  const prev=keep&&DR?{sel:DR.sel,card:readCard(),y:$('#sheetScroll').scrollTop}:null;
  DR={m,sel:prev?keepSel(m,prev.sel):defaults(m),qty:1};DR_READY=false;
  const im=$('#shImg');if(prev){im.classList.add('swap');setTimeout(()=>{im.src=img(m.id,WIDE.matches?'portrait':'hero');im.onload=()=>im.classList.remove('swap');setTimeout(()=>im.classList.remove('swap'),400)},140)}
  else{im.src=img(m.id,WIDE.matches?'portrait':'hero');$('#sheetScroll').scrollTop=0;im.style.transform=''}
  im.alt=m.name;const hero=im.closest('.sheet-hero');if(hero)hero.classList.toggle('sample',isSample(m));
  galPaint(m);
  const fam=FAM[m.fam]||[m];
  const tags=[m.preorder&&!m.preorderClosed?'<span class="po">Pre-order</span>':'',m.soldOut?`<span class="out">${m.reserved?'Reserved':m.preorderClosed?'Pre-order closed':'Sold out'}</span>`:'',m.sig?'<span>Signature</span>':'',m.sale?`<span class="sale">${esc(m.sale.name)}</span>`:'',stockTag(m)?`<span>${stockTag(m)}</span>`:'',m.best?`<span>Bestseller · No.${m.best}</span>`:'',m.nov&&CFG.spotlight?`<span>${esc(CFG.spotlight.title)}</span>`:''].join('');
  const sub=[m.details,m.zh&&`<span class="zh">${m.zh}</span>`].filter(Boolean).join(' · ');
  const pick=fam.length<2?'':`<div class="og vp" role="radiogroup" aria-label="Choose your piece"><div class="og-h"><b>Choose your piece</b><em class="req">${fam.length} options</em></div>
    <div class="vp-row">${fam.map(x=>`<button class="vopt${x.id===m.id?' on':''}${x.soldOut?' out':''}" data-act="variant" data-id="${x.id}" role="radio" aria-checked="${x.id===m.id}"><span class="vimg"><img src="${img(x.id,'sq')}" alt="" loading="lazy"></span><span class="vl">${esc(x.optLabel)}</span><span class="vpz">${x.was?`<s>${RM(x.was)}</s> `:''}${RM(x.price)}</span>${x.soldOut?`<span class="v1">${x.preorderClosed?'Pre-order closed':'Sold out'}</span>`:x.stock===1?'<span class="v1">One of a kind</span>':x.stock<=3?`<span class="v1">${x.stock} left</span>`:''}</button>`).join('')}</div>
    <p class="vp-note">${fam.every(x=>x.image&&!isSample(x))?'Each photo shows the actual piece you will receive.':'Natural stones vary, so every piece is a little different.'}</p></div>`;
  const co=cardOptOf(m);
  const gift=!co?'':`<div class="og gcard" id="gCard" hidden><div class="og-h"><b>Your gift card</b><em>Handwritten by us</em></div>
    <div class="gc-prev" aria-hidden="true"><div class="gc-card"><span class="gc-mark"></span><div class="gc-to" id="gcTo">Dear you</div><div class="gc-msg" id="gcMsg"></div><div class="gc-from" id="gcFrom"></div><div class="gc-foot">House of Qi</div></div></div>
    <div class="gc-f"><label><span>To</span><input id="gTo" maxlength="30" placeholder="e.g. Diane" autocomplete="off"></label>
    <label class="gc-m"><span>Message</span><textarea id="gMsg" rows="3" maxlength="160" placeholder="e.g. Happy Birthday & Mother’s Day! We love you."></textarea><small id="gCnt">0/160</small></label>
    <label><span>From</span><input id="gFrom" maxlength="40" placeholder="e.g. Kyle & Jade" autocomplete="off"></label></div></div>`;
  $('#shBody').innerHTML=`${tags?`<div class="d-tags">${tags}</div>`:''}<h2 class="disp d-name">${m.name}</h2>${sub?`<div class="d-zh">${sub}</div>`:''}<p class="d-desc">${m.desc}</p>
  <div class="d-price">${hasFrom(m)?'<small style="letter-spacing:.14em;text-transform:uppercase">From</small>':''}${m.was?`<s class="was">${RM(m.was)}</s>`:''}<span class="price${m.was?' now':''}">${RM(m.price)}</span>${m.sale?`<span class="off">−${m.sale.percent}%</span>`:''}</div>${m.sale?`<p class="sale-note">${esc(m.sale.name)}${m.sale.ends?` · ends ${new Date(m.sale.ends).toLocaleDateString('en-MY',{day:'numeric',month:'short'})}`:''}</p>`:''}
  <button class="share-btn" data-act="share"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 15V3.5M7.5 8 12 3.5 16.5 8"/><path d="M5 12.5v6A2.5 2.5 0 0 0 7.5 21h9a2.5 2.5 0 0 0 2.5-2.5v-6"/></svg>Share this piece</button>
  ${pick}
  ${m.preorderClosed?`<div class="mto-note po-note"><b>Pre-order closed for now</b><p>This piece isn't open for pre-order this season.${CFG.whatsapp?` <a href="https://wa.me/${encodeURIComponent(CFG.whatsapp)}?text=${encodeURIComponent('Hi House of Qi, please let me know when '+m.name+' ('+m.id+') is open for pre-order')}" target="_blank" rel="noopener">WhatsApp us to be told when it opens</a>`:''}</p></div>`:m.preorder?`<div class="mto-note po-note"><b>Pre-order · pay 50% now</b><p>Pay a 50% deposit (<span id="poDep" class="po-dep">${RM(R2(m.price/2))}</span>) today. When your piece is ready${m.preorderNote?` (${esc(m.preorderNote)})`:''}, we'll email and WhatsApp you a link to pay the other 50% plus delivery, then ship it to you.</p></div>`:''}
  ${m.ringAdj&&!m.soldOut?`<label class="ring-sz"><span>Your ring size</span><input id="ringSz" maxlength="30" autocomplete="off" placeholder="e.g. US 7, HK 14, or 17 mm inside"><small>Adjustable ring · same price for every size. Not sure of your size? WhatsApp us and we'll help you measure.</small></label>`:''}
  ${labNote(m)?`<div class="mto-note"><b>Colour may vary</b><p>Labradorite changes colour with light and angle, so the flash and shade you see may differ slightly from the photos. Each stone is natural, so no two look exactly alike.</p></div>`:''}
  ${mto(m)?`<div class="mto-note"><b>Made to order available</b><p>This rose quartz ring can also be made to order in your size or a similar design. The price may differ depending on the stone and size.${CFG.whatsapp?` <a href="https://wa.me/${encodeURIComponent(CFG.whatsapp)}?text=${encodeURIComponent('Hi House of Qi, I would like a made-to-order rose quartz ring like '+m.id)}" target="_blank" rel="noopener">WhatsApp us for a quote</a>`:''}</p></div>`:''}
  ${m.meaning?`<div class="meaning"><span class="eyebrow">Meaning</span><p>${m.meaning}</p><div class="ints">${m.ints.filter(i=>INTENTS[i]).map(i=>`<span>${INTENTS[i][0]}</span>`).join('')}</div></div>`:''}${chakraOf(m).length?`<div class="ck-line">${chakraOf(m).map(c=>`<button data-act="chakra" data-i="${c.i}" style="--ck:${c.colour}"><img src="/assets/img/chakra/${c.k}.svg" alt="">${esc(c.name)} chakra</button>`).join('')}</div>`:''}
  <div class="specs"><div><span class="eyebrow">Stone</span><b>${m.stone}</b></div><div><span class="eyebrow">${m.specLabel||'Quality'}</span><b>${m.grade||'Natural'}</b></div>${m.dims?`<div><span class="eyebrow">Measurements</span><b>${esc(m.dims)}</b></div>`:''}</div>${CFG.whatsapp?`<a class="wa" href="https://wa.me/${encodeURIComponent(CFG.whatsapp)}?text=${encodeURIComponent('Hi House of Qi, I have a question about the '+m.name+' ('+m.id+')')}" target="_blank" rel="noopener">${IC.wa}Ask about this piece on WhatsApp</a>`:''}`+
  m.groups.map(g=>{if(g.type==='many')return`<div class="og" role="group" aria-label="${g.label}"><div class="og-h"><b>${g.label}</b><em>Optional</em></div>${g.opts.map(o=>`<button class="chk" data-act="chk" data-g="${g.id}" data-o="${o[0]}" role="checkbox" aria-checked="false"><span class="chk-l">${o[1]}</span><span class="chk-p">${o[2]?'+'+RM(o[2]):'Complimentary'}</span><span class="box">${IC.check}</span></button>`).join('')}</div>`;
    return`<div class="og" role="radiogroup" aria-label="${g.label}"><div class="og-h"><b>${g.label}</b><em class="req">Choose 1</em></div><div class="seg" style="--n:${g.opts.length}">${g.opts.map(o=>`<button class="opt" data-act="opt" data-g="${g.id}" data-o="${o[0]}" role="radio"><span>${o[1]}</span><small>${g.id==='size'?RM(m.price+o[2]):o[2]?'+'+RM(o[2]):(o[3]||'Included')}</small></button>`).join('')}</div></div>`}).join('')+
  gift+
  `<div class="og note"><div class="og-h"><b>Additional request</b><em>Optional</em></div><textarea id="note" rows="2" maxlength="140" placeholder="e.g. Please wrap two pieces separately"></textarea></div>
  <p class="d-gem-note"><b>Please Note:</b> Natural gemstones may vary in colour, clarity and patterns. Actual colours may differ slightly due to lighting, photography and screen settings, making each piece uniquely beautiful.</p>`;
  if(co){['#gTo','#gMsg','#gFrom'].forEach(s=>$(s).addEventListener('input',paintCard))}
  if(prev){$('#gTo')&&($('#gTo').value=prev.card.to,$('#gMsg').value=prev.card.msg,$('#gFrom').value=prev.card.from);$('#note').value=prev.card.note}
  if(co)paintCard();
  const ab=$('#addBtn');ab.classList.remove('added','press');ab.disabled=!!m.soldOut;ab.innerHTML=m.soldOut?(m.reserved?'Reserved · someone is checking out':m.preorderClosed?'Pre-order closed':'Sold out')+' <span class="p" id="addAmt" hidden></span>':(m.preorder?'Pre-order':'Add to bag')+' <span>·</span> <span class="p" id="addAmt">RM0.00</span>';
  updateDetail(false);DR_READY=true;
  const vr=$('.vp-row'),vo=$('.vopt.on');if(vr&&vo){const l=vo.offsetLeft-vr.offsetLeft-20;if(l>0&&vo.offsetLeft+vo.offsetWidth>vr.clientWidth+vr.scrollLeft)vr.scrollLeft=prev?Math.max(vr.scrollLeft,vo.offsetLeft+vo.offsetWidth-vr.clientWidth+20):l}
  if(prev)$('#sheetScroll').scrollTop=prev.y;
  else{$('#backdrop').classList.add('on');$('#sheet').classList.add('open')}}

/* extra photo angles: thumbnails over the photo, swipe or tap to change */
let GAL={i:0,L:[]},VID='';
/* product video: full-screen player */
function vidOpen(){if(!VID)return;let o=$('#vidOv');if(!o){document.body.insertAdjacentHTML('beforeend','<div class="vid-ov" id="vidOv" role="dialog" aria-modal="true" aria-label="Product video"><button type="button" class="vid-x" data-act="vidClose" aria-label="Close video">×</button><video id="vidEl" controls playsinline preload="auto"></video></div>');o=$('#vidOv');o.addEventListener('click',e=>{if(e.target===o)vidClose()})}
  const v=$('#vidEl');if(v.getAttribute('src')!==VID)v.src=VID;o.classList.add('on');document.body.classList.add('vid-open');v.currentTime=0;const p=v.play();if(p&&p.catch)p.catch(()=>{})}
function vidClose(){const o=$('#vidOv');if(!o)return;o.classList.remove('on');document.body.classList.remove('vid-open');const v=$('#vidEl');if(v)v.pause()}
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&$('#vidOv')&&$('#vidOv').classList.contains('on')){e.stopPropagation();vidClose()}},true);
function galPaint(m){const box=$('#shTh');if(!box)return;const L=[img(m.id,WIDE.matches?'portrait':'hero'),...(m.gallery||[]).map(u=>'/'+String(u).replace(/^\//,''))];GAL={i:0,L};
  const vt=m.video?`<button type="button" class="sh-t sh-v" data-act="vidOpen" aria-label="Play video"><img src="${L[0]}" alt="" loading="lazy"><i aria-hidden="true"></i></button>`:'';
  box.hidden=L.length<2&&!m.video;box.innerHTML=L.length<2&&!m.video?'':L.map((u,n)=>`<button type="button" class="sh-t${n?'':' on'}" data-act="galGo" data-i="${n}" aria-label="Photo ${n+1} of ${L.length}"><img src="${u}" alt="" loading="lazy"></button>`).join('')+vt;
  {const h=$('#shImg').closest('.sheet-hero');if(h){h.querySelectorAll('.sh-vbtn').forEach(x=>x.remove());if(m.video)h.insertAdjacentHTML('beforeend','<button type="button" class="sh-vbtn" data-act="vidOpen"><i aria-hidden="true"></i>Watch video</button>')}}
  VID=m.video?'/'+String(m.video).replace(/^\//,''):'';
  const hero=$('#shImg').closest('.sheet-hero');if(hero&&!hero.dataset.sw){hero.dataset.sw=1;let x0=null,y0=0;
    // tap the photo to zoom (a swipe isn't a tap, so swiping between angles still works)
    $('#shImg').addEventListener('click',()=>zoomOpen());
    hero.addEventListener('touchstart',e=>{x0=e.touches[0].clientX;y0=e.touches[0].clientY},{passive:true});
    hero.addEventListener('touchend',e=>{if(x0==null)return;const dx=e.changedTouches[0].clientX-x0,dy=e.changedTouches[0].clientY-y0;x0=null;if(GAL.L.length>1&&Math.abs(dx)>40&&Math.abs(dx)>Math.abs(dy)*1.3)galGo(GAL.i+(dx<0?1:-1))},{passive:true})}}
function galGo(n){const L=GAL.L;if(L.length<2)return;n=(n%L.length+L.length)%L.length;if(n===GAL.i)return;GAL.i=n;const im=$('#shImg');im.classList.add('swap');
  setTimeout(()=>{im.src=L[n];im.onload=()=>im.classList.remove('swap');setTimeout(()=>im.classList.remove('swap'),400)},120);
  $('#shTh').querySelectorAll('.sh-t').forEach((b,k)=>{b.classList.toggle('on',k===n);if(k===n)b.scrollIntoView({block:'nearest',inline:'nearest'})})}

/* ---------- zoom viewer: pinch / scroll / double-tap to zoom, drag to look around ---------- */
const ZV={k:1,x:0,y:0,on:false};
function zoomOpen(){if(!DR)return;let v=$('#zv');
  if(!v){v=document.createElement('div');v.id='zv';v.className='zv';v.setAttribute('role','dialog');v.setAttribute('aria-modal','true');v.setAttribute('aria-label','Zoomed photo');
    v.innerHTML=`<div class="zv-stage" id="zvStage"><img id="zvImg" alt="" draggable="false"></div>
    <button type="button" class="zv-x" data-act="zoomClose" aria-label="Close">✕</button>
    <button type="button" class="zv-nav p" data-act="zoomStep" data-d="-1" aria-label="Previous photo">‹</button><button type="button" class="zv-nav n" data-act="zoomStep" data-d="1" aria-label="Next photo">›</button>
    <div class="zv-bar"><button type="button" data-act="zoomBy" data-f="0.6" aria-label="Zoom out">−</button><span id="zvPct">100%</span><button type="button" data-act="zoomBy" data-f="1.6" aria-label="Zoom in">+</button></div>
    <p class="zv-hint" id="zvHint">Pinch, scroll or double-tap to zoom · drag to move</p>`;
    document.body.appendChild(v);zvBind()}
  ZV.on=true;v.classList.add('on');document.documentElement.classList.add('zv-lock');zvShow(GAL.i||0);setTimeout(()=>{const h=$('#zvHint');if(h)h.classList.add('fade')},2600)}
function zoomClose(){const v=$('#zv');if(!v)return;ZV.on=false;v.classList.remove('on');document.documentElement.classList.remove('zv-lock')}
function zvShow(n){const L=GAL.L.length?GAL.L:[$('#shImg').src];n=(n%L.length+L.length)%L.length;if(GAL.L.length>1&&n!==GAL.i)galGo(n);
  const im=$('#zvImg');im.src=L[n];im.alt=(DR&&DR.m.name)||'';ZV.k=1;ZV.x=ZV.y=0;zvApply();
  $('#zv').classList.toggle('multi',L.length>1)}
function zvApply(){const st=$('#zvStage'),im=$('#zvImg');if(!st||!im)return;const W=st.clientWidth,H=st.clientHeight,s=Math.min(W,H);
  const mx=Math.max(0,(s*ZV.k-W)/2),my=Math.max(0,(s*ZV.k-H)/2);ZV.x=Math.max(-mx,Math.min(mx,ZV.x));ZV.y=Math.max(-my,Math.min(my,ZV.y));
  im.style.transform=`translate(${ZV.x}px,${ZV.y}px) scale(${ZV.k})`;const p=$('#zvPct');if(p)p.textContent=Math.round(ZV.k*100)+'%';st.classList.toggle('zoomed',ZV.k>1.01)}
function zvZoom(k,px,py){const st=$('#zvStage');const r=st.getBoundingClientRect();px=px??r.left+r.width/2;py=py??r.top+r.height/2;
  k=Math.max(1,Math.min(5,k));const f=k/ZV.k,cx=px-(r.left+r.width/2),cy=py-(r.top+r.height/2);ZV.x=cx-(cx-ZV.x)*f;ZV.y=cy-(cy-ZV.y)*f;ZV.k=k;zvApply()}
function zvBind(){const st=$('#zvStage'),pts=new Map();let last=null,moved=false,tap=0;
  st.addEventListener('wheel',e=>{e.preventDefault();zvZoom(ZV.k*Math.exp(-e.deltaY*0.0018),e.clientX,e.clientY)},{passive:false});
  st.addEventListener('pointerdown',e=>{st.setPointerCapture(e.pointerId);pts.set(e.pointerId,[e.clientX,e.clientY]);last=null;moved=false});
  st.addEventListener('pointermove',e=>{if(!pts.has(e.pointerId))return;const p=pts.get(e.pointerId),c=[e.clientX,e.clientY];pts.set(e.pointerId,c);
    if(pts.size===1){const dx=c[0]-p[0],dy=c[1]-p[1];if(Math.abs(dx)+Math.abs(dy)>2)moved=true;if(ZV.k>1.01){ZV.x+=dx;ZV.y+=dy;zvApply()}}
    else if(pts.size===2){moved=true;const[a,b]=[...pts.values()],dist=Math.hypot(a[0]-b[0],a[1]-b[1]);if(last)zvZoom(ZV.k*dist/last,(a[0]+b[0])/2,(a[1]+b[1])/2);last=dist}});
  const up=e=>{const s=pts.get(e.pointerId);pts.delete(e.pointerId);last=null;
    if(!moved&&s&&e.type==='pointerup'){const now=Date.now();if(now-tap<300){zvZoom(ZV.k>1.5?1:2.5,e.clientX,e.clientY);tap=0}else tap=now}};
  st.addEventListener('pointerup',up);st.addEventListener('pointercancel',up);
  // swipe between photos when not zoomed in
  let sx=null;st.addEventListener('touchstart',e=>{sx=e.touches.length===1?e.touches[0].clientX:null},{passive:true});
  st.addEventListener('touchend',e=>{if(sx==null||ZV.k>1.01||GAL.L.length<2)return;const dx=e.changedTouches[0].clientX-sx;sx=null;if(Math.abs(dx)>50)zvShow(GAL.i+(dx<0?1:-1))},{passive:true});
  document.addEventListener('keydown',e=>{if(!ZV.on)return;if(e.key==='Escape'){e.stopPropagation();zoomClose()}else if(e.key==='ArrowRight')zvShow(GAL.i+1);else if(e.key==='ArrowLeft')zvShow(GAL.i-1);else if(e.key==='+'||e.key==='=')zvZoom(ZV.k*1.5);else if(e.key==='-')zvZoom(ZV.k/1.5)},true);
  window.addEventListener('resize',()=>{if(ZV.on)zvApply()})}

function closeDetail(){$('#sheet').classList.remove('open');$('#backdrop').classList.remove('on');const n=$('#note');if(n)n.blur()}
function updateDetail(tick=true){const{m,sel,qty}=DR;
  document.querySelectorAll('#shBody .opt').forEach(b=>{const on=sel[b.dataset.g]===b.dataset.o;b.classList.toggle('on',on);b.setAttribute('aria-checked',on)});
  document.querySelectorAll('#shBody .chk').forEach(b=>{const on=sel[b.dataset.g].includes(b.dataset.o);b.classList.toggle('on',on);b.setAttribute('aria-checked',on)});
  const q=$('#qOut');q.textContent=qty;if(tick){q.classList.remove('tick');void q.offsetWidth;q.classList.add('tick')}
  $('#qDec').disabled=qty<=1;const aa=$('#addAmt');if(aa)aa.textContent=RM(unit(m,sel)*qty);const pd=$('#poDep');if(pd)pd.textContent=RM(R2(unit(m,sel)/2)*qty);
  const gc=$('#gCard');if(gc){const on=cardOn();if(on&&gc.hidden){gc.hidden=false;if(DR_READY)setTimeout(()=>{gc.scrollIntoView({behavior:'smooth',block:'nearest'});const t=$('#gTo');if(t&&!t.value&&WIDE.matches)t.focus({preventScroll:true})},60)}else if(!on)gc.hidden=true}}
$('#sheetScroll').addEventListener('scroll',e=>{const y=e.target.scrollTop;if(!WIDE.matches&&y<420)$('#shImg').style.transform=`translateY(${y*.4}px)`},{passive:true});

function addLine(id,sel,qty,note){const key=id+'|'+JSON.stringify(sel)+'|'+note;const ex=S.cart.find(l=>l.key===key);if(ex)ex.qty+=qty;else S.cart.push({key,id,sel:JSON.parse(JSON.stringify(sel)),qty,note});save()}
function fly(src,from,to){const app=$('#app').getBoundingClientRect(),size=128;
  const sx=from.left+from.width/2-app.left-size/2,sy=from.top+from.height/2-app.top-size/2,tx=to.left+to.width/2-app.left-size/2,ty=to.top+to.height/2-app.top-size/2,dx=tx-sx,dy=ty-sy;
  const el=document.createElement('img');el.src=src;el.className='flyer';el.style.cssText=`left:${sx}px;top:${sy}px;width:${size}px;height:${size}px;border-radius:64px`;$('#app').appendChild(el);
  if(!el.animate){el.remove();return Promise.resolve()}
  return el.animate([{transform:'translate(0,0) scale(1)'},{transform:`translate(${dx*.35}px,${dy*.35-60}px) scale(.6)`,offset:.4},{transform:`translate(${dx}px,${dy}px) scale(.14)`,opacity:.9}],{duration:720,easing:'cubic-bezier(.5,0,.15,1)',fill:'forwards'}).finished.then(()=>el.remove(),()=>el.remove())}
async function addToBag(){if(!DR||DR.m.soldOut)return;const btn=$('#addBtn');if(btn.disabled)return;btn.disabled=true;
  const{m,sel,qty}=DR;if(inBag(m.id)+qty>maxQty(m)){btn.disabled=false;toast(m.stock===1?'This piece is already in your bag':`Only ${m.stock} available`);return}if($('#ringSz')&&!fv('#ringSz')){btn.disabled=false;toast('Please enter your ring size');$('#ringSz').focus();return}if(S.cart.length&&isPO()!==!!m.preorder){btn.disabled=false;toast(m.preorder?'Pre-orders are paid separately. Please check out your bag first.':'Your bag has a pre-order. Please check it out first.');return}const note=composeNote();addLine(m.id,sel,qty,note);vib(12);
  btn.classList.add('press');await wait(110);btn.classList.remove('press');btn.classList.add('added');btn.innerHTML=`${IC.check.replace('<svg','<svg width="17" height="17"')} Added`;
  const from=$('#shImg').getBoundingClientRect(),to=$('#bagBtn').getBoundingClientRect();
  const f=fly(img(m.id),{left:from.left,top:from.top+60,width:from.width,height:from.height-60},to);
  await wait(160);closeDetail();await f;updateBagUI(true)}

function updateBagUI(bump=false){const t=totals();const b=$('#badge');b.textContent=t.count;b.classList.toggle('on',t.count>0);
  if(bump&&t.count){b.classList.remove('bump');void b.offsetWidth;b.classList.add('bump')}
  $('#cbCount').textContent=`${t.count} item${t.count===1?'':'s'}`;$('#cbTotal').textContent=RM(t.sub);
  const ids=[...new Set(S.cart.map(l=>l.id))].slice(-3);$('#cbThumbs').innerHTML=ids.map(id=>`<img src="${img(id)}" alt="">`).join('');
  $('#cartbar').classList.toggle('show',t.count>0&&stack.length===1);$('#home').classList.toggle('has-bar',t.count>0)}

/* =====================================================================
   NAVIGATION
   ===================================================================== */
const stack=['home'];
const syncDim=()=>$('#dim').classList.toggle('on',stack.length>1);
function go(name){const prev=$('#'+stack[stack.length-1]),next=$('#'+name);stack.push(name);next.hidden=false;next.scrollTop=0;$('#cartbar').classList.remove('show');syncDim();
  requestAnimationFrame(()=>requestAnimationFrame(()=>{next.classList.add('in');prev.classList.add('under')}))}
function back(){if(stack.length<2)return;const cur=$('#'+stack.pop()),prev=$('#'+stack[stack.length-1]);cur.classList.remove('in');prev.classList.remove('under');syncDim();
  setTimeout(()=>{if(!cur.classList.contains('in'))cur.hidden=true},460);if(stack.length===1)setTimeout(()=>updateBagUI(),200)}
function toHome(){while(stack.length>1){const s=$('#'+stack.pop());s.classList.remove('in','under');s.hidden=true}$('#home').classList.remove('under');syncDim();updateBagUI()}

/* ---------- bag ---------- */
function renderBag(){const t=totals(),box=$('#bagBody');
  if(!S.cart.length){box.innerHTML=`<h1 class="disp page-h">Your bag</h1><div class="empty"><span>Your bag is empty. Find a stone that speaks to you.</span><button class="ghost" data-act="back">Continue shopping</button></div>`;$('#toCheckout').disabled=true;return}
  $('#toCheckout').disabled=false;
  box.innerHTML=`<h1 class="disp page-h">Your bag</h1><p class="page-sub">${t.count} piece${t.count===1?'':'s'}</p>
  <div class="ship-meter">Delivery: West Malaysia RM${SHIP.west?SHIP.west.fee:10} · East Malaysia RM${SHIP.east?SHIP.east.fee:20} · self pick-up · outside Malaysia on request. Choose at checkout.</div>
  <ul class="lines">${S.cart.map(l=>{const m=BY[l.id],o=optText(m,l.sel);return`<li class="line" data-key="${esc(l.key)}"><img src="${img(l.id,'tall')}" alt="${m.name}"><div class="li-main"><div class="li-top"><span class="li-name">${m.name}</span><span class="price">${RM(lineTotal(l))}</span></div>${o.length?`<div class="li-opts">${o.join(' · ')}</div>`:''}${l.note?`<div class="li-note">“${esc(l.note)}”</div>`:''}<div class="li-ctrl"><div class="stepper sm"><button data-act="lDec" aria-label="Fewer">${IC.minus}</button><output>${l.qty}</output><button data-act="lInc" aria-label="More">${IC.plus}</button></div><button class="li-remove" data-act="lRemove">${IC.trash}Remove</button></div></div></li>`}).join('')}</ul>
  <button class="more" data-act="back">${IC.plus} Continue shopping</button>
  <div class="totals"><div class="tr"><span>Subtotal</span><span class="num">${RM(t.sub)}</span></div><div class="tr"><span>Delivery</span><span class="num">At checkout</span></div><div class="tr total"><span>Before delivery</span><span class="num">${RM(t.sub-(t.disc||0))}</span></div>${t.po?`<div class="tr"><span>Pay now (50% deposit)</span><span class="num">${RM(t.dep)}</span></div>`:''}</div>`}
function lineOf(el){const li=el.closest('.line');return{li,l:S.cart.find(x=>x.key===li.dataset.key)}}
function removeLine(li,l){vib(8);const h=li.offsetHeight;const done=()=>{S.cart=S.cart.filter(x=>x!==l);save();renderBag();updateBagUI()};
  if(li.animate){li.animate([{height:h+'px',opacity:1,transform:'none'},{height:h+'px',opacity:0,transform:'translateX(-30px)',offset:.45},{height:'0px',opacity:0,paddingTop:'0px',paddingBottom:'0px',transform:'translateX(-30px)'}],{duration:380,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'}).finished.then(done,done)}else done()}


/* the plain-HTML copy of the page is for search engines and AI assistants; the shop takes over from here */
(()=>{const s=document.getElementById('ssr');if(s)s.remove()})();
/* affiliate link: ?ref=CODE credits the friend who shared it (kept for 30 days) */
const REF_KEY='hq-ref',REF_DAYS=30;
(()=>{const r=new URLSearchParams(location.search).get('ref');if(r&&/^[A-Za-z0-9-]{2,24}$/.test(r)){try{localStorage.setItem(REF_KEY,JSON.stringify({c:r.toUpperCase(),t:Date.now()}))}catch(e){}}})();
function getRef(){try{const r=JSON.parse(localStorage.getItem(REF_KEY)||'null');if(r&&r.c&&Date.now()-r.t<REF_DAYS*864e5)return r.c}catch(e){}return''}
/* at checkout, quietly apply the friend's code (their customer discount, if any) unless another code is in use */
async function applyRef(){const c=getRef();if(!c||S.code)return;
  try{const r=await fetch('/api/coupon',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code:c,ship:S.ship,items:S.cart.map(l=>({id:l.id,sel:l.sel,qty:l.qty}))})});const d=await r.json().catch(()=>({}));
    if(r.ok&&d.ok&&!S.code){S.code=d.code;S.promo={...d,sig:bagSig()};save();refreshCo()}else if(!r.ok){try{localStorage.removeItem(REF_KEY)}catch(e){}}}catch(e){}}
/* ---------- checkout ---------- */
function coSum(){const t=totals();return`<span class="eyebrow">Your order · ${t.count} piece${t.count===1?'':'s'}</span><ul>${S.cart.map(l=>{const m=BY[l.id];return`<li><img src="${img(l.id)}" alt=""><span class="n">${l.qty>1?l.qty+'× ':''}${esc(m.name)}<small>${optText(m,l.sel).slice(0,2).join(' · ')}</small></span><span class="num">${RM(lineTotal(l))}</span></li>`}).join('')}</ul>${totHTML()}`}
function totHTML(){const t=totals();if(t.po&&!isIntl())return`<div class="totals"><div class="tr"><span>Pre-order total</span><span class="num">${RM(t.sub)}</span></div><div class="tr total"><span>Deposit today (50%)</span><span class="num">${RM(t.dep)}</span></div><div class="tr po-bal"><span>Balance when ready${SHIP[S.ship].pickup?'':` <small>incl. ${SHIP[S.ship].label} ${RM(t.balFee)}</small>`}</span><span class="num">${RM(t.bal)}</span></div><p class="po-tip">We'll email and WhatsApp you a link to pay the balance when your piece is ready, then ship it.</p></div>`;if(isIntl())return`<div class="totals"><div class="tr"><span>Subtotal</span><span class="num">${RM(t.sub)}</span></div><div class="tr"><span>International delivery</span><span class="num">Quoted by us</span></div></div>`;return`<div class="totals"><div class="tr"><span>Subtotal</span><span class="num">${RM(t.sub)}</span></div>${t.disc?`<div class="tr disc"><span>Code ${esc(t.code)}</span><span class="num">−${RM(t.disc)}</span></div>`:''}<div class="tr"><span>${SHIP[S.ship].label}${t.freeCode?` <small>(${esc(t.code)})</small>`:''}</span><span class="num">${SHIP[S.ship].pickup?'No charge':RM(t.fee)}</span></div><div class="tr total"><span>Total</span><span class="num">${RM(t.total)}</span></div></div>`}
function codeHTML(){if((!CFG.codes&&!S.code)||isPO())return'';const on=promoOK();
  return`<div class="fs" id="codeFs"><div class="fs-h"><b>Discount or referral code</b></div>${on?`<div class="code-on"><span class="code-tag">${esc(S.promo.code)}</span><span class="code-txt">${esc(S.promo.label)}${S.promo.discount?` · you save ${RM(S.promo.discount)}`:''}</span><button class="link-btn" data-act="removeCode">Remove</button></div>`:
  `<div class="code-row"><input id="codeIn" placeholder="Enter code" value="${esc(S.code||'')}" autocapitalize="characters" autocomplete="off" spellcheck="false" aria-label="Discount code" maxlength="24"><button class="ghost code-btn" data-act="applyCode" id="codeBtn">Apply</button></div>`}<p class="code-msg" id="codeMsg" role="status" hidden></p></div>`}
function refreshCo(){if(!$('#coBody')||!$('#coSum'))return;$('#coSum').innerHTML=coSum();$('#coTot').innerHTML=totHTML();$('#placeAmt').textContent=RM(totals().total);
  document.querySelectorAll('[data-wn]').forEach(x=>{const s=SHIP[x.dataset.wn];x.textContent=[s.note,wNote(s)].filter(Boolean).join(' · ')});document.querySelectorAll('[data-fee]').forEach(x=>{const k=x.dataset.fee,f=k===S.ship?totals().fee:totals(S.cart,k).fee;x.textContent=feeTxt(k,f)});
  const ck=$('#checkout');if(ck)ck.classList.toggle('co-intl',isIntl());
  const fs=$('#codeFs');if(fs){const msg=$('#codeMsg');const keep=msg&&!msg.hidden?[msg.textContent,msg.className]:null;fs.outerHTML=codeHTML();bindCode();if(keep){const m=$('#codeMsg');m.textContent=keep[0];m.className=keep[1];m.hidden=false}}}
function bindCode(){const i=$('#codeIn');if(i)i.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();applyCode()}}}
let codeBusy=0;
async function applyCode(code){const inp=$('#codeIn');code=((code??(inp?inp.value:S.code))||'').trim().toUpperCase();const msg=()=>$('#codeMsg');
  if(!code){S.code='';S.promo=null;save();refreshCo();return}
  const my=++codeBusy;const b=$('#codeBtn');if(b){b.disabled=true;b.textContent='Checking…'}
  try{const r=await fetch('/api/coupon',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({code,ship:S.ship,items:S.cart.map(l=>({id:l.id,sel:l.sel,qty:l.qty}))})});const d=await r.json().catch(()=>({}));
    if(my!==codeBusy)return;
    if(r.ok&&d.ok){S.code=d.code;S.promo={...d,sig:bagSig()};save();vib(10);refreshCo();const m=msg();if(m){m.textContent=d.freeShip?'Free delivery applied.':d.discount?`Code applied. You save ${RM(d.discount)}.`:`${d.label}. Thank you!`;m.className='code-msg ok';m.hidden=false}}
    else{S.promo=null;S.code=code;save();refreshCo();const m=msg();if(m){m.textContent=d.error||'That code can’t be used right now.';m.className='code-msg bad';m.hidden=false}}
  }catch(e){if(my===codeBusy){const bb=$('#codeBtn');if(bb){bb.disabled=false;bb.textContent='Apply'}const m=msg();if(m){m.textContent='Couldn’t check the code. Please try again.';m.className='code-msg bad';m.hidden=false}}}}
/* bag or delivery changed: check the saved code again */
function recheckCode(){if(S.code&&!promoOK())applyCode(S.code)}
const feeTxt=(k,f)=>quoteShip(k)?'Quote':SHIP[k].pickup?'No charge':RM(f);
const isIntl=()=>quoteShip(S.ship);
const noteHTML=()=>`<div class="intl-note"><b>Other countries</b><p>Online payment covers Malaysia and Singapore. For other countries, contact our customer service on WhatsApp before ordering: we will confirm availability, the delivery cost, delivery time and how to pay. Import duties, taxes and customs charges are paid by the customer.</p></div>`;
const wtHide=()=>{const s=SHIP[S.ship];return !s||s.pickup||s.contact};
const payText=()=>`Next, you’ll enter your ${SHIP[S.ship].pickup?'contact details':'delivery address'} and pay on Stripe’s secure page with a card, FPX online banking or the other methods shown there.`;
function renderCheckout(){
  $('#coBody').innerHTML=`<div class="cols"><div class="col-main"><h1 class="disp page-h">Checkout</h1>
  <div class="fs"><div class="fs-h"><b>Delivery</b></div>${Object.entries(SHIP).map(([k,s])=>{const fee=totals(S.cart,k).fee;return`<button class="radio${S.ship===k?' on':''}" data-act="ship" data-k="${k}" role="radio" aria-checked="${S.ship===k}"><span class="dot"></span><span><b>${esc(s.label)}</b><small data-wn="${k}">${esc([s.note,wNote(s)].filter(Boolean).join(' · '))}</small></span><span class="rp" data-fee="${k}">${feeTxt(k,fee)}</span></button>`}).join('')}
  ${noteHTML()}</div>
  ${codeHTML()}
  <p class="wt-note" id="wtNote"${wtHide()?' hidden':''}>Shipping fee covers parcels up to 500 g only. If your order is over 500 g, our team will contact you about any extra charges.</p>
  <div class="fs" id="payFs"><div class="fs-h"><b>Payment</b></div><div class="pay-box">${IC.lock}<div><b>Secure payment by Stripe</b><p id="payText">${payText()}</p><div class="pay-marks"><span class="pay-ic">VISA</span><span class="pay-ic">MASTERCARD</span><span class="pay-ic">FPX</span></div></div></div></div>
  <div class="co-mob" id="coTot">${totHTML()}</div>
  <p class="co-err" id="coErr" hidden></p></div>
  <aside class="col-side co-sum" id="coSum">${coSum()}</aside></div>`;
  $('#placeAmt').textContent=RM(totals().total);resetPlaceBtn();bindCode();recheckCode()}
function setShip(k){if(!SHIP[k])return;S.ship=k;save();vib(6);document.querySelectorAll('[data-act=ship]').forEach(b=>{const on=b.dataset.k===k;b.classList.toggle('on',on);b.setAttribute('aria-checked',on)});
  $('#payText').textContent=payText();{const w=$('#wtNote');if(w)w.hidden=wtHide()}const n=document.querySelector('.intl-note');if(n)n.outerHTML=noteHTML();refreshCo();recheckCode()}

/* =====================================================================
   PAYMENT → STRIPE → THANK YOU
   ===================================================================== */
let placing=false;
function resetPlaceBtn(){placing=false;const pb=$('#placeBtn');pb.classList.remove('sending','press')}
function intlEnquiry(){const t=totals();const lines=S.cart.map(l=>{const m=BY[l.id];return m?`• ${l.qty}× ${m.name}${m.details?` (${m.details})`:''} [${m.id}] ${RM(lineTotal(l))}`:''}).filter(Boolean).join('\n');
  const msg=`Hi House of Qi, I'm outside Malaysia and Singapore and would like to order:\n${lines}\nSubtotal: ${RM(t.sub)}\n\nCountry: \nCould you quote the delivery and how to pay? Thank you!`;
  if(CFG.whatsapp)window.open(`https://wa.me/${encodeURIComponent(CFG.whatsapp)}?text=${encodeURIComponent(msg)}`,'_blank','noopener');else toast('Please contact us through Instagram or Facebook.')}
async function startCheckout(){if(isIntl()){vib(10);intlEnquiry();return}if(placing||!S.cart.length)return;placing=true;const pb=$('#placeBtn'),err=$('#coErr');err.hidden=true;vib(15);
  pb.classList.add('press');await wait(120);pb.classList.remove('press');pb.classList.add('sending');
  try{
    const r=await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prev:(()=>{try{return localStorage.getItem('hq-pending')||undefined}catch(e){}})(),ship:S.ship,coupon:promoOK()?S.promo.code:undefined,ref:getRef()||undefined,items:S.cart.map(l=>({id:l.id,sel:l.sel,qty:l.qty,note:l.note||''}))})});
    const d=await r.json().catch(()=>({}));
    if(d.coupon===false){S.promo=null;refreshCo()}
    if(!r.ok||!d.url)throw new Error(d.error||'We couldn’t open the payment page. Please try again.');
    try{if(d.order)localStorage.setItem('hq-pending',d.order)}catch(e){}
    location.href=d.url;
  }catch(e){resetPlaceBtn();err.textContent=e.message||'We couldn’t open the payment page. Please check your connection and try again.';err.hidden=false;err.scrollIntoView({behavior:'smooth',block:'center'})}}
window.addEventListener('pageshow',e=>{if(e.persisted)resetPlaceBtn()});

const titleLines=(ls,d0=0)=>ls.map((l,i)=>`<span class="tl"><span style="--d:${(d0+i*.09).toFixed(2)}s">${esc(l)}</span></span>`).join('');
const COMPANY=`<p class="co done-co">by Soleil Trinity Infinite Resources Sdn.&nbsp;Bhd.<span>202201006345 (1452042-H)</span></p>`;
const fmtT=ts=>ts?new Date(ts).toLocaleString('en-MY',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}).replace(',', ''):'';
function doneHTML(o){const pieces=o.items.reduce((t,i)=>t+i.qty,0);const idx={confirmed:0,packed:1,shipped:2,ready:2}[o.status]||0;const tm=[o.times?.confirmed,o.times?.packed,o.times?.shipped];
  const st=[['Order confirmed',o.paid?'Payment received':'Waiting for your bank to confirm'],['Cleansed & packed','Smudged, charged and gift wrapped'],o.pickup?['Ready for pick-up','We will WhatsApp you a time']:['Shipped','Tracking number sent to you']];
  return`<div class="done-in gx">
  <div class="d-top rise" style="--d:.05s"><span class="chip"><i></i><span>${o.paid?'Order confirmed':'Payment processing'}</span></span>${o.pickup?'<span class="eta">Pick-up<b>We will WhatsApp you</b></span>':''}</div>
  <div class="seal"><svg viewBox="0 0 88 88"><circle class="sk-c" cx="44" cy="44" r="40" transform="rotate(-90 44 44)"/><circle class="sk-c2" cx="44" cy="44" r="34" transform="rotate(-90 44 44)"/><path class="sk-k" d="M30 45l9.5 9.5L59 34"/><path class="sk-d" d="M44 0l2.4 2.4L44 4.8 41.6 2.4z"/></svg></div>
  <h1 class="disp d-title">${titleLines(o.paid?['Thank you','for your order']:['Almost','there'],.55)}</h1>
  <div class="d-meta rise" style="--d:.95s"><span class="ordno">${esc(o.orderNo||'')}</span><span class="sep"></span><span class="meta2">${pieces} piece${pieces===1?'':'s'} · ${RM(o.total)}</span></div>
  <p class="d-msg rise" style="--d:1.05s">${o.paid&&o.preorder?`Your 50% deposit is paid and your pre-order is confirmed. A receipt is on its way to ${o.email?esc(o.email):'your email'}. When your piece is ready we'll send you a link to pay the balance of ${RM(o.balance)}, then ship it to you.`:o.paid?`A receipt is on its way to ${o.email?esc(o.email):'your email'}. We are cleansing and packing your crystals by hand, and will let you know when ${o.pickup?'they are ready':'they ship'}.`:'Your bank is still confirming the payment. We will email you as soon as it clears.'}</p>
  <ol class="trk rise" style="--d:1.2s"><span class="trk-rail"><span class="trk-fill" style="height:${o.paid?idx*50:0}%"></span></span>${st.map((s,i)=>{const done=o.paid&&(i<idx||(idx===2&&i===2)),now=o.paid&&i===idx&&idx<2;return`<li class="st${done?' done':''}${now?' now':''}"><span class="st-dot"></span><span><b>${s[0]}</b><small>${s[1]}</small></span><time>${done||now?fmtT(tm[i]):''}</time></li>`}).join('')}</ol>
  <div class="sum rise" style="--d:1.4s"><div class="sum-h"><span class="eyebrow">Order summary</span><span class="eyebrow">${esc(o.delivery||'')}</span></div><ul>${o.items.map(i=>`<li><span><span class="q">${i.qty}×</span>${esc(i.name)}</span><span class="num">${RM(i.amount)}</span></li>`).join('')}</ul>
    ${o.discount?`<div class="tr"><span>Discount${o.coupon?` (${esc(o.coupon)})`:''}</span><span class="num">−${RM(o.discount)}</span></div>`:''}<div class="tr"><span>Delivery</span><span class="num">${o.shipping?RM(o.shipping):'No charge'}</span></div><div class="tot"><span>Total paid</span><span class="num">${RM(o.total)}</span></div></div>
  ${COMPANY.replace('done-co','done-co2')}
  <div class="d-actions rise" style="--d:1.55s">${o.paid&&o.trackUrl?`<p class="track-note">Save this link to follow your order any time.</p><a class="cta track-cta" href="${esc(o.trackUrl)}">Track this order</a>`:''}<button class="ghost" data-act="closeDone">Continue shopping</button></div></div>`}
async function showConfirmation(id){const d=$('#done');d.hidden=false;d.classList.remove('play');
  d.innerHTML=`<div class="done-scroll"><div class="done-in gx"><div class="loading"><span class="spin"></span>Confirming your order…</div></div></div>`;
  let o=null;for(let k=0;k<3&&!o;k++){try{const r=await fetch('/api/order?session_id='+encodeURIComponent(id));const j=await r.json();if(r.ok)o=j;else if(r.status===404)break}catch(e){}if(!o)await wait(1200)}
  if(!o){d.innerHTML=`<div class="done-scroll"><div class="done-in gx"><h1 class="disp d-title" style="font-size:44px">We couldn’t load your order</h1><p class="d-msg">If you completed the payment, your receipt from Stripe is in your email. Contact us if anything looks wrong.</p><div class="d-actions"><button class="ghost" data-act="closeDone">Continue shopping</button></div></div></div>`;return}
  if(o.paid){S.cart=[];S.code='';S.promo=null;save();updateBagUI()}
  d.innerHTML=`<div class="done-scroll">${doneHTML(o)}</div>`;void d.offsetWidth;d.classList.add('play')}

/* =====================================================================
   ACTIONS
   ===================================================================== */
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('on'),2200)}
function openSearch(){window.__fv=null;$('#topbar').classList.add('searching');($('#home').classList.contains('is-search')||(window.__pre=$('#home').scrollTop)),$('#home').classList.add('is-search');$('#results').hidden=false;$('#home').scrollTop=0;search($('#q').value);setTimeout(()=>$('#q').focus(),60)}
function closeSearch(){window.__fv=null;$('#topbar').classList.remove('searching');$('#home').classList.remove('is-search');$('#results').hidden=true;$('#q').value='';$('#q').blur();requestAnimationFrame(()=>{setTab(document.querySelector('.tab.on')?.dataset.cat||TABS[0][0],false);/* back to where they were before searching */if(window.__pre!=null){const y=window.__pre;window.__pre=null;spyLock=Date.now()+600;$('#home').scrollTop=y;requestAnimationFrame(()=>{$('#home').scrollTop=y})}})}
const ACT={
  top(){$('#home').scrollTo({top:0,behavior:'smooth'})},
  search:openSearch,searchClose:closeSearch,
  mega(el){const m=$('#mega'),open=m.hidden;m.hidden=!open;el.setAttribute('aria-expanded',open);el.classList.toggle('open',open)},
  colour(el){closeMega();const c=(CFG.colours||[]).find(x=>x.id===el.dataset.k);if(!c)return;$('#q').value=c.name;showFiltered(`<em>${esc(c.name)}</em> beads`,'',CAT.filter(m=>m.colour===c.id))},
  colls(){closeMega();const ids=[...new Set((CFG.curated||[]).flatMap(c=>c.ids))];showFiltered('Premium <em>Collectibles</em>','',byIds(ids))},
  coll(el){closeMega();const c=(CFG.curated||[]).find(x=>String(x.id)===el.dataset.id);if(!c)return;$('#q').value=c.name;showFiltered(esc(c.name)+(c.zh?` <span class="zh">${esc(c.zh)}</span>`:''),c.blurb?esc(c.blurb):'',byIds(c.ids))},
  birth(el){closeMega();const b=(CFG.birthstones||[])[+el.dataset.i];if(!b)return;const want=new Set(b.stones.map(x=>x.toLowerCase()));$('#q').value=`${b.m} · ${b.gem}`;
    const items=CAT.filter(m=>want.has(String(m.stone).toLowerCase()));
    showFiltered(`<i class="bs-res"><img src="/assets/img/birth/${b.img}.webp" alt="">${esc(b.m)} <em>${esc(b.gem)}</em></i>`,esc(b.note),items);
    if(!items.length&&CFG.whatsapp)$('#results').insertAdjacentHTML('beforeend',`<p class="empty-q"><a class="wa" href="https://wa.me/${encodeURIComponent(CFG.whatsapp)}?text=${encodeURIComponent('Hi House of Qi, do you have any '+b.m+' birthstone ('+b.gem+') pieces?')}" target="_blank" rel="noopener">${IC.wa}Ask us about ${esc(b.gem)} on WhatsApp</a></p>`)},
  chakra(el){closeMega();if($("#sheet").classList.contains("open"))closeDetail();const c=(CFG.chakras||[])[+el.dataset.i];if(!c)return;const want=new Set(c.stones.map(x=>x.toLowerCase()));$('#q').value=`${c.name} chakra`;
    const items=CAT.filter(m=>want.has(String(m.stone).toLowerCase()));
    showFiltered(`<i class="bs-res"><img src="/assets/img/chakra/${c.k}.svg" alt="">${esc(c.name)} <em>chakra</em></i>`,`${esc(c.sk)} · ${esc(c.where)}`,items);
    const r=$('#results');const head=r.querySelector('.res-head');const box=`<div class="ck-about" style="--ck:${c.colour}"><b>${esc(c.theme)}</b><p>${esc(c.about)}</p><small>Stones: ${c.stones.map(esc).join(' · ')}</small></div>`;
    if(head)head.insertAdjacentHTML('afterend',box);else r.insertAdjacentHTML('afterbegin',box)},
  banSet(el){banSet(+el.dataset.i)},
  galGo(el){galGo(+el.dataset.i)},
  vidOpen(){vidOpen()},vidClose(){vidClose()},
  zoomOpen(){zoomOpen()},zoomClose(){zoomClose()},zoomStep(el){zvShow(GAL.i+(+el.dataset.d))},zoomBy(el){zvZoom(ZV.k*(+el.dataset.f))},
  banGo(){const t=$('#sec-colls')||$('#sec-colour')||$('#homeBody .sec');if(t)t.scrollIntoView({behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'auto':'smooth',block:'start'})},
  sizeGo(el){closeMega();const b=document.querySelector(`#sec-bracelets .chip-s[data-mm="${el.dataset.mm}"]`);if(!b)return;if($('#home').classList.contains('is-search')){window.__pre=null;closeSearch()}ACT.size(b);const sec=$('#sec-bracelets');setTimeout(()=>$('#home').scrollTo({top:sec.offsetTop-hdrH()+2,behavior:'smooth'}),30)},
  intent(el){closeMega();const k=el.dataset.k;$('#topbar').classList.add('searching');($('#home').classList.contains('is-search')||(window.__pre=$('#home').scrollTop)),$('#home').classList.add('is-search');$('#results').hidden=false;$('#home').scrollTop=0;$('#q').value=INTENTS[k][0];
    const items=CAT.filter(m=>m.ints.includes(k));showResults(`For <em>${esc(INTENTS[k][0].toLowerCase())}</em>`,`${items.length} piece${items.length===1?'':'s'}`,items)},
  tab(el){closeMega();if($('#home').classList.contains('is-search')){window.__pre=null;closeSearch()}const id=el.dataset.cat,sec=$('#sec-'+id);if(!sec)return;setTab(id);spyLock=Date.now()+800;$('#home').scrollTo({top:sec.offsetTop-hdrH()+2,behavior:'smooth'})},
  bag(){if($('#sheet').classList.contains('open'))closeDetail();renderBag();go('bag')},
  back,close:closeDetail,dimClose(){if(stack[stack.length-1]==='bag')back()},
  opt(el){DR.sel[el.dataset.g]=el.dataset.o;vib(6);updateDetail(false)},
  chk(el){const a=DR.sel[el.dataset.g],o=el.dataset.o;DR.sel[el.dataset.g]=a.includes(o)?a.filter(x=>x!==o):[...a,o];vib(6);updateDetail(false)},
  qInc(){const cap=maxQty(DR.m)-inBag(DR.m.id);if(DR.qty<cap){DR.qty++;updateDetail()}else toast(DR.m.stock===1?'This piece is one of a kind':`Only ${DR.m.stock} available`)},qDec(){if(DR.qty>1){DR.qty--;updateDetail()}},
  async share(){if(!DR)return;const m=DR.m;const url=`${location.origin}/p/${encodeURIComponent(m.id)}`;
    const text=`${m.name}${m.details?` · ${m.details}`:''} · ${RM(m.price)} | House of Qi`;
    try{if(navigator.share){await navigator.share({title:m.name,text,url});return}}catch(e){if(e&&e.name==='AbortError')return}
    try{await navigator.clipboard.writeText(`${text}\n${url}`);toast('Link copied. Paste it anywhere to share.')}catch(e){prompt('Copy this link',url)}},
  add:addToBag,
  variant(el){if(DR&&el.dataset.id!==DR.m.id){vib(6);openDetail(el.dataset.id,true)}},
  lInc(el){const{l}=lineOf(el);if(inBag(l.id)<maxQty(BY[l.id])){l.qty++;save();renderBag();updateBagUI(true)}else toast(BY[l.id].stock===1?'This piece is one of a kind':`Only ${BY[l.id].stock} available`)},
  lDec(el){const{li,l}=lineOf(el);if(l.qty>1){l.qty--;save();renderBag();updateBagUI()}else removeLine(li,l)},
  lRemove(el){const{li,l}=lineOf(el);removeLine(li,l)},
  toCheckout(){if(!S.cart.length)return;renderCheckout();go('checkout');applyRef()},
  size(el){const sec=$('#sec-'+el.dataset.sec),mm=el.dataset.mm;
    sec.querySelectorAll('.chip-s:not(.chip-p)').forEach(b=>{const on=b===el;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)});
    SZSEL=mm;sec.dataset.mm=mm;ACT.filt(sec)},
  price(el){const sec=$('#sec-'+el.dataset.sec);
    sec.querySelectorAll('.chip-p').forEach(b=>{const on=b===el;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)});
    sec.dataset.pr=el.dataset.pr;ACT.filt(sec)},
  /* bead size + price together */
  filt(sec){const mm=sec.dataset.mm||'',pr=sec.dataset.pr||'',[lo,hi]=pr?pr.split('-').map(Number):[0,0],f=!!(mm||pr);
    const all=sec.querySelector('.show-all');let shown=0;
    sec.querySelectorAll('[data-open]').forEach(x=>{const okM=!mm||(' '+(x.dataset.mm||'')+' ').includes(' '+mm+' ');const p=Number(x.dataset.pr);const okP=!pr||x.dataset.pr==null||(p>=lo&&(!hi||p<hi));
      if(f){x.hidden=!(okM&&okP)}else{x.hidden=x.hasAttribute('data-more')&&!!all}
      if(!x.hidden)shown++});
    if(all)all.hidden=f;
    const z=sec.querySelector('.sz-none');if(z)z.hidden=shown>0;
    const c=sec.querySelector('.sec-head .count');if(c){c.dataset.n=c.dataset.n||c.textContent;c.textContent=f?`${shown} piece${shown===1?'':'s'}${mm?` · ${mm} mm`:''}${pr?` · ${(sec.querySelector('.chip-p.on')||{}).firstChild?.textContent||''}`:''}`:c.dataset.n}},
  showAll(el){const sec=$('#sec-'+el.dataset.sec);sec.querySelectorAll('[data-more]').forEach(x=>{x.hidden=false;x.removeAttribute('data-more')});el.remove()},
  ship(el){setShip(el.dataset.k)},
  place:startCheckout,
  applyCode(){applyCode()},
  removeCode(){S.code='';S.promo=null;save();refreshCo();const m=$('#codeMsg');if(m)m.hidden=true;setTimeout(()=>$('#codeIn')?.focus(),30)},
  closeDone(){const d=$('#done');const end=()=>{d.hidden=true;d.innerHTML=''};if(d.animate)d.animate([{opacity:1},{opacity:0}],{duration:300}).finished.then(end,end);else end();toHome();$('#home').scrollTop=0},
};
/* remember which filtered page is showing, so a refresh can bring it back */
['colour','colls','coll','birth','chakra','intent'].forEach(k=>{const f=ACT[k];ACT[k]=(el,e)=>{const r=f(el,e);window.__fv=[k,Object.assign({},el&&el.dataset||{})];return r}});
document.addEventListener('click',e=>{const o=e.target.closest('[data-open]');if(o&&!o.closest('[hidden]')){openDetail(o.dataset.open);return}
  const a=e.target.closest('[data-act]');if(a&&ACT[a.dataset.act]&&!a.disabled)ACT[a.dataset.act](a,e)});
function closeMega(){const m=$('#mega');if(m&&!m.hidden){m.hidden=true;const b=$('.mg-btn');if(b){b.setAttribute('aria-expanded','false');b.classList.remove('open')}}}
document.addEventListener('click',e=>{if(!e.target.closest('#mega')&&!e.target.closest('.mg-btn'))closeMega()},true);
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMega()});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if($('#sheet').classList.contains('open'))closeDetail();else if(stack.length>1)back()}});
WIDE.addEventListener('change',()=>{if(!CAT.length)return;const h=$('#home'),y=h.scrollTop;renderHome();h.scrollTop=y;spy()});
window.addEventListener('resize',()=>{if(TABS.length)setTab(document.querySelector('.tab.on')?.dataset.cat||TABS[0][0],false)});


/* keep the customer's place when they refresh: same section, scroll, search, filters, open piece or bag */
const VIEWK='hq-view';
function saveView(){try{const f=[...document.querySelectorAll('#homeBody section[id^="sec-"]')].filter(x=>x.dataset.mm||x.dataset.pr).map(x=>[x.id,x.dataset.mm||'',x.dataset.pr||'']);
  const srch=$('#home').classList.contains('is-search');
  sessionStorage.setItem(VIEWK,JSON.stringify({y:$('#home').scrollTop,q:srch?$('#q').value:'',fv:srch?window.__fv||null:null,pre:srch?window.__pre:null,p:DR&&$('#sheet').classList.contains('open')?DR.m.id:'',v:stack[stack.length-1],f,at:Date.now()}))}catch(e){}}
addEventListener('pagehide',saveView);addEventListener('beforeunload',saveView);document.addEventListener('visibilitychange',()=>{if(document.hidden)saveView()});
function restoreView(){let nav='';try{nav=(performance.getEntriesByType('navigation')[0]||{}).type||''}catch(e){}if(nav!=='reload'&&nav!=='back_forward')return; /* only when refreshing (or coming back), not on a fresh visit */
  let s=null;try{s=JSON.parse(sessionStorage.getItem(VIEWK)||'null')}catch(e){}if(!s||Date.now()-s.at>3600e3)return;
  (s.f||[]).forEach(([id,mm,pr])=>{const sec=$('#'+id);if(!sec)return;if(mm){const b=sec.querySelector(`.chip-s:not(.chip-p)[data-mm="${mm}"]`);if(b)ACT.size(b)}if(pr){const b=sec.querySelector(`.chip-p[data-pr="${pr}"]`);if(b)ACT.price(b)}});
  const to=()=>{$('#home').scrollTop=s.y||0};
  if(s.fv&&ACT[s.fv[0]]){ACT[s.fv[0]]({dataset:s.fv[1]||{}});window.__pre=s.pre}
  else if(s.q){$('#q').value=s.q;openSearch();window.__pre=s.pre;setTimeout(()=>$('#q').blur(),80)}
  if(s.y){spyLock=Date.now()+1500;requestAnimationFrame(to);setTimeout(to,400);setTimeout(to,1200)}
  if(s.p&&BY[s.p])setTimeout(()=>openDetail(s.p),300);
  if((s.v==='bag'||s.v==='checkout')&&S.cart.length){renderBag();go('bag')}}

/* boot */
(async()=>{
  try{await loadCatalog()}catch(e){$('#homeBody').innerHTML='<p class="empty-q gx">The shop is unavailable right now. Please refresh in a moment.</p>';return}
  $('#dnav').innerHTML=`<button class="tab dtab mg-btn" data-act="mega" aria-expanded="false" aria-controls="mega">Shop<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="m7 10 5 5 5-5"/></svg></button><button class="tab dtab" data-act="colls" data-cat="colls" hidden>Collectibles</button>`+TABS.map(([id,n])=>`<button class="tab dtab" data-act="tab" data-cat="${id}">${esc(n)}</button>`).join('');
  $('#topbar').insertAdjacentHTML('beforeend','<div class="mega" id="mega" hidden></div>');
  pruneCart();renderHome();updateBagUI();
  { const q=new URLSearchParams(location.search).get('p');const want=window.OPEN_P||q;
    if(want&&BY[want]){setTimeout(()=>openDetail(want),250);try{history.replaceState(null,'','/')}catch(e){}}
    else if(!/[?&](session_id|checkout)=/.test(location.search))restoreView(); }
  if(CFG.whatsapp){const w=$('#wafab');w.href=`https://wa.me/${encodeURIComponent(CFG.whatsapp)}?text=${encodeURIComponent('Hi House of Qi, I have a question about your crystals.')}`;w.hidden=false;
    w.addEventListener('click',()=>{if(DR&&$('#sheet').classList.contains('open'))w.href=`https://wa.me/${encodeURIComponent(CFG.whatsapp)}?text=${encodeURIComponent('Hi House of Qi, I have a question about the '+DR.m.name+' ('+DR.m.id+')')}`})}
  const q=new URLSearchParams(location.search),clean=()=>{try{history.replaceState(null,'',location.pathname)}catch(e){}};
  if(q.get('session_id')){const id=q.get('session_id');try{localStorage.removeItem('hq-pending')}catch(e){}clean();showConfirmation(id)}
  else if(q.get('balance')==='paid'){clean();toast('Thank you! Your balance is paid. We will ship your piece soon.')}
  else if(q.get('checkout')==='cancelled'){const o=q.get('o');if(o){fetch('/api/release',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({o})}).catch(()=>{});try{localStorage.removeItem('hq-pending')}catch(e){}}clean();if(S.cart.length){renderBag();go('bag')}toast('Payment cancelled. Your bag is saved.')}
  document.fonts&&document.fonts.ready.then(()=>{if(![...document.fonts].some(x=>/Cormorant/.test(x.family)&&x.status==='loaded'))document.documentElement.classList.add('nofont');setTab(document.querySelector('.tab.on')?.dataset.cat||TABS[0][0],false)});
})();
