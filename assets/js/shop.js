/* =====================================================================
   HOUSE OF QI · storefront
   Products, prices, shipping and homepage settings live in /data/catalog.json.
   Payment happens on Stripe Checkout via /api/checkout (Cloudflare Function).
   ===================================================================== */
let CFG={},CAT=[],BY={},TABS=[],INTENTS={},SHIP={},FREE_AT=300;
async function loadCatalog(){
  let r=await fetch('/api/catalog',{cache:'no-cache'}).catch(()=>null);
  if(!r||!r.ok)r=await fetch('/data/catalog.json',{cache:'no-cache'});
  if(!r.ok)throw new Error('catalog');const d=await r.json();
  CFG=d;FREE_AT=d.freeShippingFrom;
  SHIP=Object.fromEntries(Object.entries(d.shipping).map(([k,s])=>[k,{...s,sub:s.note,eta:s.days?`${s.days[0]}–${s.days[1]} working days`:'By appointment'}]));
  TABS=d.collections.map(c=>[c.id,c.name,c.zh,c.layout]);
  INTENTS=Object.fromEntries(Object.entries(d.intentions).map(([k,v])=>[k,[v.name,v.colour]]));
  CAT=d.products.map(p=>({...p,details:p.details||'',cat:p.collection,best:p.bestseller||0,sig:p.signature,nov:p.spotlight,desc:p.description||'',ints:p.intentions||[],grade:p.quality||'',meaning:p.meaning||'',zh:p.zh||'',stone:p.stone||'',
    groups:(p.groups||[]).map(g=>({...g,def:g.default,opts:g.opts.map(o=>[o.id,o.label,o.price||0,o.note,o.short])}))}));
  BY=Object.fromEntries(CAT.map(m=>[m.id,m]))}
/* Real photos: set "image" on a product in catalog.json (e.g. "assets/img/products/star-rose-12mm.jpg").
   Products without a photo use the drawn artwork from art.js. */
const img=(id,v='sq')=>(BY[id]&&BY[id].image)?'/'+BY[id].image.replace(/^\//,''):ART.get(id,v,BY[id]&&BY[id].art);
const maxQty=m=>typeof m.stock==='number'?Math.min(20,m.stock):20;
const inBag=id=>S.cart.filter(l=>l.id===id).reduce((t,l)=>t+l.qty,0);
const stockTag=m=>typeof m.stock!=='number'?'':m.stock===1?'One of a kind':m.stock<=3?`Only ${m.stock} left`:'';
const subLine=m=>{const t=[m.details,m.zh?`<span class="zh">${m.zh}</span>`:''].filter(Boolean).join(' · ');return t?`<span class="ri-zh">${t}</span>`:''};

/* =====================================================================
   STATE  (the bag is kept in this browser only)
   ===================================================================== */
const KEY='house-of-qi-bag-v1';
let S={cart:[],ship:'std'};
try{const v=JSON.parse(localStorage.getItem(KEY)||'null');if(v&&Array.isArray(v.cart))S={cart:v.cart,ship:v.ship||'std'}}catch(e){}
const save=()=>{try{localStorage.setItem(KEY,JSON.stringify(S))}catch(e){}};
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
function totals(lines=S.cart,ship=S.ship){const sub=R2(lines.reduce((t,l)=>t+lineTotal(l),0));const s=SHIP[ship]||SHIP.std;const fee=s.freeOver&&sub>=FREE_AT?0:s.fee;return{sub,fee,total:R2(sub+fee),count:lines.reduce((t,l)=>t+l.qty,0)}}
function pruneCart(){S.cart=S.cart.filter(l=>{const m=BY[l.id];if(!m||m.soldOut||!l.sel)return false;for(const g of m.groups){const v=l.sel[g.id];if(g.type==='many'){if(!Array.isArray(v))return false}else if(!g.opts.some(o=>o[0]===v))return false}return true});if(!SHIP[S.ship])S.ship=Object.keys(SHIP)[0];save()}

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
const priceHTML=m=>`${hasFrom(m)?'<span class="from">From</span>':''}<span class="price">${RM(m.price)}</span>`;
const intTag=m=>m.soldOut?'<span class="tag out">Sold out</span>':`<span class="tag">${stockTag(m)||m.ints.filter(i=>INTENTS[i]).map(i=>INTENTS[i][0]).join(' · ')}</span>`;
const WIDE=matchMedia('(min-width:768px)');
const row=(m,v='sq')=>`<button class="ri" data-open="${m.id}"><span class="ri-txt"><span class="ri-name">${m.name}</span>${subLine(m)}<span class="ri-desc">${m.desc}</span><span class="ri-foot"><span>${priceHTML(m)}</span>${intTag(m)}</span></span><span class="ri-img"><img src="${img(m.id,v)}" alt="${m.name}" decoding="async"><span class="ri-add">${IC.plus}</span></span></button>`;
const lead=(m,v='lead')=>`<button class="lead" data-open="${m.id}"><span class="lead-img"><img src="${img(m.id,v)}" alt="${m.name}" decoding="async"></span><span class="lead-top"><span class="ri-name">${m.name}</span><span>${priceHTML(m)}</span></span>${subLine(m)}<span class="ri-desc">${m.desc}</span></button>`;
const gcard=(m,v='tall')=>`<button class="gc" data-open="${m.id}"><span class="gc-img"><img src="${img(m.id,v)}" alt="${m.name}" decoding="async"><span class="ri-add">${IC.plus}</span></span><span class="ri-name">${m.short||m.name}</span>${subLine(m)}<span>${priceHTML(m)}</span></button>`;
const card=(m,label,v='tall')=>`<button class="pc" data-open="${m.id}"><span class="pc-img"><img src="${img(m.id,v)}" alt="${m.name}" decoding="async">${label?`<span class="pc-rank">${label}</span>`:''}</span><span class="pc-name">${m.short||m.name}</span>${subLine(m)}<span>${priceHTML(m)}</span></button>`;
function renderHome(){
  const W=WIDE.matches,h=CFG.hero||{},feat=BY[h.product]||CAT[0],best=CAT.filter(m=>m.best).sort((a,b)=>a.best-b.best),nov=CAT.filter(m=>m.nov),of=c=>CAT.filter(m=>m.cat===c);
  const head=(name,zh,n,unit='pieces')=>`<div class="sec-head"><h3 class="disp">${name}</h3>${zh?`<span class="zh">${esc(zh)}</span>`:''}<span class="count">${n} ${unit}</span></div>`;
  const [t1,t2]=(h.title||feat.name).split('|');
  const usedInts=Object.entries(INTENTS).filter(([k])=>CAT.some(m=>m.ints.includes(k)));
  const LIMIT=12,more=(id,n)=>n>LIMIT?`<button class="ghost show-all" data-act="showAll" data-sec="${id}">Show all ${n}</button>`:'',hid=i=>i>=LIMIT?' hidden data-more':'';
  const mmA=m=>m.size?` data-mm="${m.size}"`:'';
  // bead-size picker: only for bracelet sections with more than one size
  const sizes=(id,items)=>{const n={};items.forEach(m=>{if(m.size&&/bracelet/i.test(m.name))n[m.size]=(n[m.size]||0)+1});const ks=Object.keys(n).map(Number).sort((a,b)=>a-b);
    if(ks.length<2)return'';
    return`<div class="sizes" role="group" aria-label="Bead size"><span class="sizes-lab">Bead size</span><div class="sizes-row"><button class="chip-s on" data-act="size" data-sec="${id}" data-mm="" aria-pressed="true">All</button>${ks.map(k=>`<button class="chip-s" data-act="size" data-sec="${id}" data-mm="${k}" aria-pressed="false">${k} mm<small>${n[k]}</small></button>`).join('')}</div><p class="sizes-tip">Smaller beads (4–7 mm) sit delicately; 8–10 mm is the everyday size; 12 mm and up makes a statement.</p></div>`};
  const intents=!usedInts.length?'':`<section class="sec gx" id="sec-intent"><div class="sec-head"><h3 class="disp">Shop by <em>intention</em></h3></div><div class="intents">${usedInts.map(([k,[n,c]])=>`<button class="chip-i" data-act="intent" data-k="${k}" style="--c:${c}"><i></i>${esc(n)}</button>`).join('')}</div></section>`;
  const spot=nov.length&&CFG.spotlight?`<section class="sec" id="sec-nov"><div class="gx">${head(esc(CFG.spotlight.title),'',nov.length)}${CFG.spotlight.note?`<p class="sec-note">${esc(CFG.spotlight.note)}</p>`:''}</div><div class="rail gx">${nov.map(m=>card(m,null,W?'lead':'tall')).join('')}<span class="rail-end"></span></div></section>`:'';
  SPY=[];
  const secs=TABS.map(([id,name,zh,layout])=>{
    const items=layout==='bestsellers'?best:of(id);if(!items.length)return'';SPY.push(id);const few=items.length<=2;
    if(layout==='bestsellers')return`<section class="sec" id="sec-${id}"><div class="gx">${head(esc(name),zh,items.length)}</div><div class="rail gx">${items.map((m,i)=>card(m,'No.'+(i+1))).join('')}<span class="rail-end"></span></div></section>`;
    if(layout==='feature')return`<section class="sec gx sec-feature" id="sec-${id}">${head(esc(name),zh,items.length)}${sizes(id,items)}${lead(items[0],W?'tall':'lead').replace('<button ',`<button${mmA(items[0])} `)}<div class="list"${W?'':' style="border-top:1px solid var(--line)"'}>${items.slice(1).map((m,i)=>row(m,W?'tall':'sq').replace('<button ',`<button${hid(i+1)}${mmA(m)} `)).join('')}</div><p class="sz-none" hidden>No pieces in this size right now.</p>${more(id,items.length)}</section>`;
    if(layout==='grid')return`<section class="sec gx${few?' few':''}" id="sec-${id}">${head(esc(name),zh,items.length)}<div class="grid2">${items.map((m,i)=>gcard(m,W&&few?'lead':'tall').replace('<button ',`<button${hid(i)} `)).join('')}</div>${more(id,items.length)}</section>`;
    return`<section class="sec gx${few?' few':''}" id="sec-${id}">${head(esc(name),zh,items.length,id==='sets'?'sets':'pieces')}<div class="list">${items.map((m,i)=>row(m,W?(few?'lead':'tall'):'sq').replace('<button ',`<button${hid(i)} `)).join('')}</div>${more(id,items.length)}</section>`}).filter(Boolean);
  secs.splice(1,0,intents+spot);
  $('#homeBody').innerHTML=`
  <div class="strip gx"><span class="dia"></span><span>Jewellery with frequencies</span><span class="dia"></span><span>Free shipping over RM${FREE_AT}</span></div>
  <button class="feature" data-open="${feat.id}" aria-label="${esc(feat.name)}">
    <span class="feature-img"><img src="${img(feat.id,W?'banner':'wide')}" alt="" decoding="async"></span>
    <span class="feature-meta gx"><span class="eyebrow"><i></i>${esc(h.eyebrow||'Featured')}</span><h2 class="disp">${esc(t1)}${t2?`<br><em>${esc(t2)}</em>`:''}</h2>${h.text?`<p>${esc(h.text)}</p>`:''}
    <span class="feature-row"><span class="price">${hasFrom(feat)?'<small>From</small>':''}${RM(feat.price)}</span><span class="pill-add">Shop now</span></span></span>
  </button>
  <nav class="tabs" aria-label="Collections"><div class="tabs-in gx" id="tabsIn">${TABS.filter(([id])=>SPY.includes(id)).map(([id,n])=>`<button class="tab" data-act="tab" data-cat="${id}">${esc(n)}</button>`).join('')}<span class="tab-ink" id="tabInk"></span></div></nav>
  ${secs.join('\n')}
  <footer class="foot gx"><span class="mark" aria-hidden="true"></span><p class="co">by Soleil Trinity Infinite Resources Sdn.&nbsp;Bhd.<span>202201006345 (1452042-H)</span></p>
    <nav class="foot-links"><a href="/policies.html">Shipping &amp; returns</a><a href="/policies.html#privacy">Privacy</a>${CFG.whatsapp?`<a href="https://wa.me/${encodeURIComponent(CFG.whatsapp)}" target="_blank" rel="noopener">WhatsApp us</a>`:''}</nav>
    <p>Prices in Malaysian Ringgit. Natural stones vary slightly in colour and pattern.</p><p>Crystal meanings describe traditional beliefs and are not medical advice.</p></footer>`;
  document.querySelectorAll('#dnav .tab').forEach(b=>b.hidden=!SPY.includes(b.dataset.cat));
  setTab(SPY[0],false);
}
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
$('#q').addEventListener('input',e=>search(e.target.value));
$('#q').addEventListener('keydown',e=>{if(e.key==='Enter')e.target.blur()});

/* =====================================================================
   PRODUCT SHEET
   ===================================================================== */
let DR=null;
function defaults(m){const s={};for(const g of m.groups)s[g.id]=g.type==='many'?[]:(g.def||g.opts[0][0]);return s}
function openDetail(id){const m=BY[id];if(!m)return;DR={m,sel:defaults(m),qty:1};
  $('#shImg').src=img(id,WIDE.matches?'portrait':'hero');$('#shImg').alt=m.name;$('#sheetScroll').scrollTop=0;$('#shImg').style.transform='';
  const tags=[m.soldOut?'<span class="out">Sold out</span>':'',m.sig?'<span>Signature</span>':'',stockTag(m)?`<span>${stockTag(m)}</span>`:'',m.best?`<span>Bestseller · No.${m.best}</span>`:'',m.nov&&CFG.spotlight?`<span>${esc(CFG.spotlight.title)}</span>`:''].join('');
  $('#shBody').innerHTML=`${tags?`<div class="d-tags">${tags}</div>`:''}<h2 class="disp d-name">${m.name}</h2>${[m.details,m.zh].some(Boolean)?`<div class="d-zh">${[m.details,m.zh&&`<span class="zh">${m.zh}</span>`].filter(Boolean).join(" · ")}</div>`:""}<p class="d-desc">${m.desc}</p><div class="d-price">${hasFrom(m)?'<small style="letter-spacing:.14em;text-transform:uppercase">From</small>':''}<span class="price">${RM(m.price)}</span></div>
  ${m.meaning?`<div class="meaning"><span class="eyebrow">Meaning</span><p>${m.meaning}</p><div class="ints">${m.ints.filter(i=>INTENTS[i]).map(i=>`<span>${INTENTS[i][0]}</span>`).join('')}</div></div>`:''}
  <div class="specs"><div><span class="eyebrow">Stone</span><b>${m.stone}</b></div><div><span class="eyebrow">${m.specLabel||"Quality"}</span><b>${m.grade||"Natural"}</b></div><div><span class="eyebrow">Ships</span><b>1–2 days</b></div></div>${CFG.whatsapp?`<a class="wa" href="https://wa.me/${encodeURIComponent(CFG.whatsapp)}?text=${encodeURIComponent('Hi House of Qi, I have a question about the '+m.name)}" target="_blank" rel="noopener">${IC.wa}Ask about this piece on WhatsApp</a>`:''}`+
  m.groups.map(g=>{if(g.type==='many')return`<div class="og" role="group" aria-label="${g.label}"><div class="og-h"><b>${g.label}</b><em>Optional</em></div>${g.opts.map(o=>`<button class="chk" data-act="chk" data-g="${g.id}" data-o="${o[0]}" role="checkbox" aria-checked="false"><span class="chk-l">${o[1]}</span><span class="chk-p">${o[2]?'+'+RM(o[2]):'Complimentary'}</span><span class="box">${IC.check}</span></button>`).join('')}</div>`;
    return`<div class="og" role="radiogroup" aria-label="${g.label}"><div class="og-h"><b>${g.label}</b><em class="req">Choose 1</em></div><div class="seg" style="--n:${g.opts.length}">${g.opts.map(o=>`<button class="opt" data-act="opt" data-g="${g.id}" data-o="${o[0]}" role="radio"><span>${o[1]}</span><small>${o[2]?'+'+RM(o[2]):(o[3]||'Included')}</small></button>`).join('')}</div></div>`}).join('')+
  `<div class="og note"><div class="og-h"><b>Gift message or request</b><em>Optional</em></div><textarea id="note" rows="2" maxlength="140" placeholder="e.g. Happy birthday, with love"></textarea></div>`;
  const ab=$('#addBtn');ab.classList.remove('added','press');ab.disabled=!!m.soldOut;ab.innerHTML=m.soldOut?'Sold out <span class="p" id="addAmt" hidden></span>':'Add to bag <span>·</span> <span class="p" id="addAmt">RM0.00</span>';
  updateDetail(false);$('#backdrop').classList.add('on');$('#sheet').classList.add('open')}
function closeDetail(){$('#sheet').classList.remove('open');$('#backdrop').classList.remove('on');const n=$('#note');if(n)n.blur()}
function updateDetail(tick=true){const{m,sel,qty}=DR;
  document.querySelectorAll('#shBody .opt').forEach(b=>{const on=sel[b.dataset.g]===b.dataset.o;b.classList.toggle('on',on);b.setAttribute('aria-checked',on)});
  document.querySelectorAll('#shBody .chk').forEach(b=>{const on=sel[b.dataset.g].includes(b.dataset.o);b.classList.toggle('on',on);b.setAttribute('aria-checked',on)});
  const q=$('#qOut');q.textContent=qty;if(tick){q.classList.remove('tick');void q.offsetWidth;q.classList.add('tick')}
  $('#qDec').disabled=qty<=1;$('#addAmt').textContent=RM(unit(m,sel)*qty)}
$('#sheetScroll').addEventListener('scroll',e=>{const y=e.target.scrollTop;if(!WIDE.matches&&y<420)$('#shImg').style.transform=`translateY(${y*.4}px)`},{passive:true});

function addLine(id,sel,qty,note){const key=id+'|'+JSON.stringify(sel)+'|'+note;const ex=S.cart.find(l=>l.key===key);if(ex)ex.qty+=qty;else S.cart.push({key,id,sel:JSON.parse(JSON.stringify(sel)),qty,note});save()}
function fly(src,from,to){const app=$('#app').getBoundingClientRect(),size=128;
  const sx=from.left+from.width/2-app.left-size/2,sy=from.top+from.height/2-app.top-size/2,tx=to.left+to.width/2-app.left-size/2,ty=to.top+to.height/2-app.top-size/2,dx=tx-sx,dy=ty-sy;
  const el=document.createElement('img');el.src=src;el.className='flyer';el.style.cssText=`left:${sx}px;top:${sy}px;width:${size}px;height:${size}px;border-radius:64px`;$('#app').appendChild(el);
  if(!el.animate){el.remove();return Promise.resolve()}
  return el.animate([{transform:'translate(0,0) scale(1)'},{transform:`translate(${dx*.35}px,${dy*.35-60}px) scale(.6)`,offset:.4},{transform:`translate(${dx}px,${dy}px) scale(.14)`,opacity:.9}],{duration:720,easing:'cubic-bezier(.5,0,.15,1)',fill:'forwards'}).finished.then(()=>el.remove(),()=>el.remove())}
async function addToBag(){if(!DR||DR.m.soldOut)return;const btn=$('#addBtn');if(btn.disabled)return;btn.disabled=true;
  const{m,sel,qty}=DR;if(inBag(m.id)+qty>maxQty(m)){btn.disabled=false;toast(m.stock===1?'This piece is already in your bag':`Only ${m.stock} available`);return}const note=($('#note')?.value||'').trim();addLine(m.id,sel,qty,note);vib(12);
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
  $('#toCheckout').disabled=false;const left=R2(FREE_AT-t.sub);
  box.innerHTML=`<h1 class="disp page-h">Your bag</h1><p class="page-sub">${t.count} piece${t.count===1?'':'s'}</p>
  <div class="ship-meter">${left>0?`Add <b>${RM(left)}</b> more for free standard shipping.`:`<b>Free standard shipping</b> unlocked.`}<div class="meter"><i style="width:${Math.min(100,t.sub/FREE_AT*100)}%"></i></div></div>
  <ul class="lines">${S.cart.map(l=>{const m=BY[l.id],o=optText(m,l.sel);return`<li class="line" data-key="${esc(l.key)}"><img src="${img(l.id,'tall')}" alt="${m.name}"><div class="li-main"><div class="li-top"><span class="li-name">${m.name}</span><span class="price">${RM(lineTotal(l))}</span></div>${o.length?`<div class="li-opts">${o.join(' · ')}</div>`:''}${l.note?`<div class="li-note">“${esc(l.note)}”</div>`:''}<div class="li-ctrl"><div class="stepper sm"><button data-act="lDec" aria-label="Fewer">${IC.minus}</button><output>${l.qty}</output><button data-act="lInc" aria-label="More">${IC.plus}</button></div><button class="li-remove" data-act="lRemove">${IC.trash}Remove</button></div></div></li>`}).join('')}</ul>
  <button class="more" data-act="back">${IC.plus} Continue shopping</button>
  <div class="totals"><div class="tr"><span>Subtotal</span><span class="num">${RM(t.sub)}</span></div><div class="tr"><span>Standard shipping</span><span class="num">${t.fee?RM(t.fee):'Free'}</span></div><div class="tr total"><span>Estimated total</span><span class="num">${RM(t.total)}</span></div></div>`}
function lineOf(el){const li=el.closest('.line');return{li,l:S.cart.find(x=>x.key===li.dataset.key)}}
function removeLine(li,l){vib(8);const h=li.offsetHeight;const done=()=>{S.cart=S.cart.filter(x=>x!==l);save();renderBag();updateBagUI()};
  if(li.animate){li.animate([{height:h+'px',opacity:1,transform:'none'},{height:h+'px',opacity:0,transform:'translateX(-30px)',offset:.45},{height:'0px',opacity:0,paddingTop:'0px',paddingBottom:'0px',transform:'translateX(-30px)'}],{duration:380,easing:'cubic-bezier(.4,0,.2,1)',fill:'forwards'}).finished.then(done,done)}else done()}


/* ---------- checkout ---------- */
function coSum(){const t=totals();return`<span class="eyebrow">Your order · ${t.count} piece${t.count===1?'':'s'}</span><ul>${S.cart.map(l=>{const m=BY[l.id];return`<li><img src="${img(l.id)}" alt=""><span class="n">${l.qty>1?l.qty+'× ':''}${esc(m.name)}<small>${optText(m,l.sel).slice(0,2).join(' · ')}</small></span><span class="num">${RM(lineTotal(l))}</span></li>`}).join('')}</ul>${totHTML()}`}
function totHTML(){const t=totals();return`<div class="totals"><div class="tr"><span>Subtotal</span><span class="num">${RM(t.sub)}</span></div><div class="tr"><span>${SHIP[S.ship].label}</span><span class="num">${t.fee?RM(t.fee):'Free'}</span></div><div class="tr total"><span>Total</span><span class="num">${RM(t.total)}</span></div></div>`}
const payText=()=>`Next, you’ll enter your ${SHIP[S.ship].pickup?'contact details':'delivery address'} and pay on Stripe’s secure page with a card, FPX online banking or the other methods shown there.`;
function renderCheckout(){
  $('#coBody').innerHTML=`<div class="cols"><div class="col-main"><h1 class="disp page-h">Checkout</h1>
  <div class="fs"><div class="fs-h"><b>Delivery</b></div>${Object.entries(SHIP).map(([k,s])=>{const fee=totals(S.cart,k).fee;return`<button class="radio${S.ship===k?' on':''}" data-act="ship" data-k="${k}" role="radio" aria-checked="${S.ship===k}"><span class="dot"></span><span><b>${esc(s.label)}</b><small>${esc(s.note||'')}</small></span><span class="rp${fee?'':' free'}" data-fee="${k}">${fee?RM(fee):'Free'}</span></button>`}).join('')}</div>
  <div class="fs"><div class="fs-h"><b>Payment</b></div><div class="pay-box">${IC.lock}<div><b>Secure payment by Stripe</b><p id="payText">${payText()}</p><div class="pay-marks"><span class="pay-ic">VISA</span><span class="pay-ic">MASTERCARD</span><span class="pay-ic">FPX</span></div></div></div></div>
  <div class="co-mob" id="coTot">${totHTML()}</div>
  <p class="co-err" id="coErr" hidden></p></div>
  <aside class="col-side co-sum" id="coSum">${coSum()}</aside></div>`;
  $('#placeAmt').textContent=RM(totals().total);resetPlaceBtn()}
function setShip(k){if(!SHIP[k])return;S.ship=k;save();vib(6);document.querySelectorAll('[data-act=ship]').forEach(b=>{const on=b.dataset.k===k;b.classList.toggle('on',on);b.setAttribute('aria-checked',on)});
  $('#coSum').innerHTML=coSum();$('#coTot').innerHTML=totHTML();$('#payText').textContent=payText();$('#placeAmt').textContent=RM(totals().total)}

/* =====================================================================
   PAYMENT → STRIPE → THANK YOU
   ===================================================================== */
let placing=false;
function resetPlaceBtn(){placing=false;const pb=$('#placeBtn');pb.classList.remove('sending','press')}
async function startCheckout(){if(placing||!S.cart.length)return;placing=true;const pb=$('#placeBtn'),err=$('#coErr');err.hidden=true;vib(15);
  pb.classList.add('press');await wait(120);pb.classList.remove('press');pb.classList.add('sending');
  try{
    const r=await fetch('/api/checkout',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ship:S.ship,items:S.cart.map(l=>({id:l.id,sel:l.sel,qty:l.qty,note:l.note||''}))})});
    const d=await r.json().catch(()=>({}));
    if(!r.ok||!d.url)throw new Error(d.error||'We couldn’t open the payment page. Please try again.');
    location.href=d.url;
  }catch(e){resetPlaceBtn();err.textContent=e.message||'We couldn’t open the payment page. Please check your connection and try again.';err.hidden=false;err.scrollIntoView({behavior:'smooth',block:'center'})}}
window.addEventListener('pageshow',e=>{if(e.persisted)resetPlaceBtn()});

const titleLines=(ls,d0=0)=>ls.map((l,i)=>`<span class="tl"><span style="--d:${(d0+i*.09).toFixed(2)}s">${esc(l)}</span></span>`).join('');
const COMPANY=`<p class="co done-co">by Soleil Trinity Infinite Resources Sdn.&nbsp;Bhd.<span>202201006345 (1452042-H)</span></p>`;
const fmtT=ts=>ts?new Date(ts).toLocaleString('en-MY',{day:'numeric',month:'short',hour:'numeric',minute:'2-digit'}).replace(',', ''):'';
function doneHTML(o){const pieces=o.items.reduce((t,i)=>t+i.qty,0);const idx={confirmed:0,packed:1,shipped:2,ready:2}[o.status]||0;const tm=[o.times?.confirmed,o.times?.packed,o.times?.shipped];
  const st=[['Order confirmed',o.paid?'Payment received':'Waiting for your bank to confirm'],['Cleansed & packed','Smudged, charged and gift wrapped'],o.pickup?['Ready for pick-up','We will WhatsApp you a time']:['Shipped','Tracking number sent to you']];
  return`<div class="done-in gx">
  <div class="d-top rise" style="--d:.05s"><span class="chip"><i></i><span>${o.paid?'Order confirmed':'Payment processing'}</span></span><span class="eta">${o.pickup?'Pick-up<b>We will WhatsApp you</b>':'Dispatch<b>Within 1–2 working days</b>'}</span></div>
  <div class="seal"><svg viewBox="0 0 88 88"><circle class="sk-c" cx="44" cy="44" r="40" transform="rotate(-90 44 44)"/><circle class="sk-c2" cx="44" cy="44" r="34" transform="rotate(-90 44 44)"/><path class="sk-k" d="M30 45l9.5 9.5L59 34"/><path class="sk-d" d="M44 0l2.4 2.4L44 4.8 41.6 2.4z"/></svg></div>
  <h1 class="disp d-title">${titleLines(o.paid?['Thank you','for your order']:['Almost','there'],.55)}</h1>
  <div class="d-meta rise" style="--d:.95s"><span class="ordno">${esc(o.orderNo||'')}</span><span class="sep"></span><span class="meta2">${pieces} piece${pieces===1?'':'s'} · ${RM(o.total)}</span></div>
  <p class="d-msg rise" style="--d:1.05s">${o.paid?`A receipt is on its way to ${o.email?esc(o.email):'your email'}. We are cleansing and packing your crystals by hand, and will let you know when ${o.pickup?'they are ready':'they ship'}.`:'Your bank is still confirming the payment. We will email you as soon as it clears.'}</p>
  <ol class="trk rise" style="--d:1.2s"><span class="trk-rail"><span class="trk-fill" style="height:${o.paid?idx*50:0}%"></span></span>${st.map((s,i)=>{const done=o.paid&&(i<idx||(idx===2&&i===2)),now=o.paid&&i===idx&&idx<2;return`<li class="st${done?' done':''}${now?' now':''}"><span class="st-dot"></span><span><b>${s[0]}</b><small>${s[1]}</small></span><time>${done||now?fmtT(tm[i]):''}</time></li>`}).join('')}</ol>
  <div class="sum rise" style="--d:1.4s"><div class="sum-h"><span class="eyebrow">Order summary</span><span class="eyebrow">${esc(o.delivery||'')}</span></div><ul>${o.items.map(i=>`<li><span><span class="q">${i.qty}×</span>${esc(i.name)}</span><span class="num">${RM(i.amount)}</span></li>`).join('')}</ul>
    <div class="tr"><span>Delivery</span><span class="num">${o.shipping?RM(o.shipping):'Free'}</span></div><div class="tot"><span>Total paid</span><span class="num">${RM(o.total)}</span></div></div>
  ${COMPANY.replace('done-co','done-co2')}
  <div class="d-actions rise" style="--d:1.55s">${o.paid&&o.trackUrl?`<p class="track-note">Save this link to follow your order any time.</p><a class="cta track-cta" href="${esc(o.trackUrl)}">Track this order</a>`:''}<button class="ghost" data-act="closeDone">Continue shopping</button></div></div>`}
async function showConfirmation(id){const d=$('#done');d.hidden=false;d.classList.remove('play');
  d.innerHTML=`<div class="done-scroll"><div class="done-in gx"><div class="loading"><span class="spin"></span>Confirming your order…</div></div></div>`;
  let o=null;for(let k=0;k<3&&!o;k++){try{const r=await fetch('/api/order?session_id='+encodeURIComponent(id));const j=await r.json();if(r.ok)o=j;else if(r.status===404)break}catch(e){}if(!o)await wait(1200)}
  if(!o){d.innerHTML=`<div class="done-scroll"><div class="done-in gx"><h1 class="disp d-title" style="font-size:44px">We couldn’t load your order</h1><p class="d-msg">If you completed the payment, your receipt from Stripe is in your email. Contact us if anything looks wrong.</p><div class="d-actions"><button class="ghost" data-act="closeDone">Continue shopping</button></div></div></div>`;return}
  if(o.paid){S.cart=[];save();updateBagUI()}
  d.innerHTML=`<div class="done-scroll">${doneHTML(o)}</div>`;void d.offsetWidth;d.classList.add('play')}

/* =====================================================================
   ACTIONS
   ===================================================================== */
function toast(m){const t=$('#toast');t.textContent=m;t.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>t.classList.remove('on'),2200)}
function openSearch(){$('#topbar').classList.add('searching');$('#home').classList.add('is-search');$('#results').hidden=false;$('#home').scrollTop=0;search($('#q').value);setTimeout(()=>$('#q').focus(),60)}
function closeSearch(){$('#topbar').classList.remove('searching');$('#home').classList.remove('is-search');$('#results').hidden=true;$('#q').value='';$('#q').blur();requestAnimationFrame(()=>setTab(document.querySelector('.tab.on')?.dataset.cat||TABS[0][0],false))}
const ACT={
  top(){$('#home').scrollTo({top:0,behavior:'smooth'})},
  search:openSearch,searchClose:closeSearch,
  intent(el){const k=el.dataset.k;$('#topbar').classList.add('searching');$('#home').classList.add('is-search');$('#results').hidden=false;$('#home').scrollTop=0;$('#q').value=INTENTS[k][0];
    const items=CAT.filter(m=>m.ints.includes(k));showResults(`For <em>${esc(INTENTS[k][0].toLowerCase())}</em>`,`${items.length} piece${items.length===1?'':'s'}`,items)},
  tab(el){const id=el.dataset.cat,sec=$('#sec-'+id);if(!sec)return;setTab(id);spyLock=Date.now()+800;$('#home').scrollTo({top:sec.offsetTop-hdrH()+2,behavior:'smooth'})},
  bag(){if($('#sheet').classList.contains('open'))closeDetail();renderBag();go('bag')},
  back,close:closeDetail,dimClose(){if(stack[stack.length-1]==='bag')back()},
  opt(el){DR.sel[el.dataset.g]=el.dataset.o;vib(6);updateDetail(false)},
  chk(el){const a=DR.sel[el.dataset.g],o=el.dataset.o;DR.sel[el.dataset.g]=a.includes(o)?a.filter(x=>x!==o):[...a,o];vib(6);updateDetail(false)},
  qInc(){const cap=maxQty(DR.m)-inBag(DR.m.id);if(DR.qty<cap){DR.qty++;updateDetail()}else toast(DR.m.stock===1?'This piece is one of a kind':`Only ${DR.m.stock} available`)},qDec(){if(DR.qty>1){DR.qty--;updateDetail()}},
  add:addToBag,
  lInc(el){const{l}=lineOf(el);if(inBag(l.id)<maxQty(BY[l.id])){l.qty++;save();renderBag();updateBagUI(true)}else toast(BY[l.id].stock===1?'This piece is one of a kind':`Only ${BY[l.id].stock} available`)},
  lDec(el){const{li,l}=lineOf(el);if(l.qty>1){l.qty--;save();renderBag();updateBagUI()}else removeLine(li,l)},
  lRemove(el){const{li,l}=lineOf(el);removeLine(li,l)},
  toCheckout(){if(!S.cart.length)return;renderCheckout();go('checkout')},
  size(el){const sec=$('#sec-'+el.dataset.sec),mm=el.dataset.mm;
    sec.querySelectorAll('.chip-s').forEach(b=>{const on=b===el;b.classList.toggle('on',on);b.setAttribute('aria-pressed',on)});
    const all=sec.querySelector('.show-all');let shown=0;
    sec.querySelectorAll('[data-open]').forEach(x=>{const ok=!mm||x.dataset.mm===mm;
      if(mm){x.hidden=!ok}else{x.hidden=x.hasAttribute('data-more')&&!!all}
      if(!x.hidden)shown++});
    if(all)all.hidden=!!mm;
    sec.querySelector('.sz-none').hidden=shown>0;
    const c=sec.querySelector('.sec-head .count');if(c){c.dataset.n=c.dataset.n||c.textContent;c.textContent=mm?`${shown} in ${mm} mm`:c.dataset.n}},
  showAll(el){const sec=$('#sec-'+el.dataset.sec);sec.querySelectorAll('[data-more]').forEach(x=>{x.hidden=false;x.removeAttribute('data-more')});el.remove()},
  ship(el){setShip(el.dataset.k)},
  place:startCheckout,
  closeDone(){const d=$('#done');const end=()=>{d.hidden=true;d.innerHTML=''};if(d.animate)d.animate([{opacity:1},{opacity:0}],{duration:300}).finished.then(end,end);else end();toHome();$('#home').scrollTop=0},
};
document.addEventListener('click',e=>{const o=e.target.closest('[data-open]');if(o&&!o.closest('[hidden]')){openDetail(o.dataset.open);return}
  const a=e.target.closest('[data-act]');if(a&&ACT[a.dataset.act]&&!a.disabled)ACT[a.dataset.act](a,e)});
document.addEventListener('keydown',e=>{if(e.key==='Escape'){if($('#sheet').classList.contains('open'))closeDetail();else if(stack.length>1)back()}});
WIDE.addEventListener('change',()=>{if(!CAT.length)return;const h=$('#home'),y=h.scrollTop;renderHome();h.scrollTop=y;spy()});
window.addEventListener('resize',()=>{if(TABS.length)setTab(document.querySelector('.tab.on')?.dataset.cat||TABS[0][0],false)});

/* boot */
(async()=>{
  try{await loadCatalog()}catch(e){$('#homeBody').innerHTML='<p class="empty-q gx">The shop is unavailable right now. Please refresh in a moment.</p>';return}
  $('#dnav').innerHTML=TABS.map(([id,n])=>`<button class="tab dtab" data-act="tab" data-cat="${id}">${esc(n)}</button>`).join('');
  pruneCart();renderHome();updateBagUI();
  const q=new URLSearchParams(location.search),clean=()=>{try{history.replaceState(null,'',location.pathname)}catch(e){}};
  if(q.get('session_id')){const id=q.get('session_id');clean();showConfirmation(id)}
  else if(q.get('checkout')==='cancelled'){clean();if(S.cart.length){renderBag();go('bag')}toast('Payment cancelled. Your bag is saved.')}
  document.fonts&&document.fonts.ready.then(()=>{if(![...document.fonts].some(x=>/Cormorant/.test(x.family)&&x.status==='loaded'))document.documentElement.classList.add('nofont');setTab(document.querySelector('.tab.on')?.dataset.cat||TABS[0][0],false)});
})();
