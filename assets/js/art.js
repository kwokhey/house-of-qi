/* Drawn product artwork, used until real photos are added in data/catalog.json */
/* =====================================================================
   PRODUCT ART (drawn stand-ins until real photos arrive)
   ===================================================================== */
const ART = (() => {
  const f = n => Math.round(n * 10) / 10;
  const PI2 = Math.PI * 2;
  function rng(seed){let a=seed>>>0;return()=>{a|=0;a=a+0x6D2B79F5|0;let t=Math.imul(a^a>>>15,1|a);t=t+Math.imul(t^t>>>7,61|t)^t;return((t^t>>>14)>>>0)/4294967296}}
  function hash(s){let h=2166136261;for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619)}return h>>>0}
  function smooth(p){const n=p.length;let d='';for(let i=0;i<n;i++){const p0=p[(i-1+n)%n],p1=p[i],p2=p[(i+1)%n],p3=p[(i+2)%n];if(!i)d+=`M${f(p1[0])} ${f(p1[1])}`;d+=`C${f(p1[0]+(p2[0]-p0[0])/6)} ${f(p1[1]+(p2[1]-p0[1])/6)} ${f(p2[0]-(p3[0]-p1[0])/6)} ${f(p2[1]-(p3[1]-p1[1])/6)} ${f(p2[0])} ${f(p2[1])}`}return d+'Z'}
  function open(p){let d=`M${f(p[0][0])} ${f(p[0][1])}`;for(let i=1;i<p.length-1;i++){d+=`Q${f(p[i][0])} ${f(p[i][1])} ${f((p[i][0]+p[i+1][0])/2)} ${f((p[i][1]+p[i+1][1])/2)}`}const l=p[p.length-1];return d+`L${f(l[0])} ${f(l[1])}`}
  function blob(r,cx,cy,R,irr=.15,n=10,sx=1,sy=1){const pts=[],o=r()*6.28;for(let i=0;i<n;i++){const a=o+i/n*PI2,rr=R*(1+(r()-.5)*2*irr);pts.push([cx+Math.cos(a)*rr*sx,cy+Math.sin(a)*rr*sy])}return smooth(pts)}
  function inC(r,R){const a=r()*PI2,d=Math.sqrt(r())*R;return[Math.cos(a)*d,Math.sin(a)*d]}
  function G(c,stops,o={},key){if(key&&c.gm[key])return c.gm[key];const id=c.p+'g'+(c.n++);const st=stops.map(([of,col,op=1])=>`<stop offset="${of}" stop-color="${col}" stop-opacity="${op}"/>`).join('');
    c.defs.push(o.lin?`<linearGradient id="${id}" x1="${o.x1??0}" y1="${o.y1??0}" x2="${o.x2??1}" y2="${o.y2??1}">${st}</linearGradient>`:`<radialGradient id="${id}" cx="${o.cx??.4}" cy="${o.cy??.36}" r="${o.r??.72}"${o.fx!=null?` fx="${o.fx}" fy="${o.fy}"`:''}>${st}</radialGradient>`);
    const u=`url(#${id})`;if(key)c.gm[key]=u;return u}
  const B=(c,b)=>`filter="url(#${c.p}${b})"`;
  const sh=(c,cx,cy,rx,ry,op=.3,b='b9',dx=8,dy=12,col='#4a2414')=>`<ellipse cx="${f(cx+dx)}" cy="${f(cy+dy)}" rx="${f(rx)}" ry="${f(ry)}" fill="${col}" opacity="${op}" ${B(c,b)}/>`;
  function clip(c,inner){const id=c.p+'c'+(c.n++);c.defs.push(`<clipPath id="${id}">${inner}</clipPath>`);return`clip-path="url(#${id})"`}
  const GOLD=c=>G(c,[[0,'#FFF3D2'],[.35,'#E2BD78'],[.7,'#A87A3C'],[1,'#6E4A1F']],{cx:.36,cy:.3,r:.8},'gold');
  const GOLDL=c=>G(c,[[0,'#F6DFA6'],[.3,'#C9995A'],[.55,'#FCEBC2'],[.8,'#A2763A'],[1,'#E4C285']],{lin:1,x1:0,y1:0,x2:1,y2:1},'goldl');

  /* ---------- beads & stones ---------- */
  const STONE={
    rose:{c:['#FFF2F4','#F3C3CF','#C98798'],trans:1,star:1,cloud:1},
    amethyst:{c:['#F1DDFA','#A974CF','#4E2273'],trans:1,cloud:1},
    citrine:{c:['#FFF1C4','#F0B54A','#A8620F'],trans:1},
    rutile:{c:['#FFFFFF','#EDE9E2','#A9A399'],trans:1,rutile:1},
    clear:{c:['#FFFFFF','#EEEBE6','#B2ACA4'],trans:1,cloud:1},
    aqua:{c:['#F2FBFD','#AFDCE8','#5E9AAF'],trans:1,cloud:1},
    tiger:{c:['#E9B357','#8E5A1C','#3A220A'],tiger:1},
    moon:{c:['#FFFFFF','#EEF0F2','#B9C0C8'],trans:1,moon:1},
  };
  const TOURM=[['#FFE3EC','#F28AAE','#A63A63'],['#EAF8DA','#98C977','#3E7A2C'],['#FFF4CF','#F2C766','#A87A1C'],['#E4F1FF','#8DB6E6','#3C5F98'],['#FBE1F1','#D07AB7','#7D2E6B'],['#F2F7E0','#C1D88B','#6B8A36']];
  function stoneFill(c,P,k){return G(c,[[0,P.c[0]],[.5,P.c[1]],[1,P.c[2]]],P.trans?{cx:.6,cy:.64,r:.66}:{cx:.38,cy:.34,r:.75},k)}
  function fx(c,x,y,R,P,cp){let s='';const r=c.r;
    if(P.cloud)for(let i=0;i<2;i++){const[a,b]=inC(r,R*.5);s+=`<ellipse cx="${f(x+a)}" cy="${f(y+b)}" rx="${f(R*(.25+r()*.25))}" ry="${f(R*(.12+r()*.12))}" transform="rotate(${f(r()*180)} ${f(x+a)} ${f(y+b)})" fill="#fff" opacity="${f(.25+r()*.25)}" ${B(c,'b1')}/>`}
    if(P.rutile)for(let i=0;i<4;i++){const a=r()*Math.PI,d=(r()-.5)*R*1.2,cx=x+Math.cos(a+1.57)*d,cy=y+Math.sin(a+1.57)*d,L=R*(.8+r()*.9);s+=`<path d="M${f(cx-Math.cos(a)*L)} ${f(cy-Math.sin(a)*L)}L${f(cx+Math.cos(a)*L)} ${f(cy+Math.sin(a)*L)}" stroke="${P.needle||(r()<.5?'#D6A040':'#F0C565')}" stroke-width="${f(.7+r()*.9)}" opacity=".95"/>`}
    if(P.tiger){const a=(r()-.5)*1.2;let g=`<g transform="rotate(${f(a*57)} ${f(x)} ${f(y)})">`;for(let k=-3;k<=3;k++){const yy=y+k*R*.3+(r()-.5)*R*.1;g+=`<path d="M${f(x-R*1.2)} ${f(yy)}Q${f(x)} ${f(yy+(r()-.5)*R*.5)} ${f(x+R*1.2)} ${f(yy)}" stroke="${['#2A1606','#B07624','#E8AE4C','#5C3410'][(k+7)%4]}" stroke-width="${f(R*.22)}" fill="none" opacity=".7" ${B(c,'b1')}/>`}
      g+=`<path d="M${f(x-R*1.2)} ${f(y-R*.15)}L${f(x+R*1.2)} ${f(y-R*.05)}" stroke="#FFE2A0" stroke-width="${f(R*.2)}" opacity=".55" ${B(c,'b2')}/></g>`;s+=g}
    if(P.spark&&!P.metal)for(let i=0;i<Math.max(4,R*.9);i++){const[a,b]=inC(r,R*.85);s+=`<circle cx="${f(x+a)}" cy="${f(y+b)}" r="${f(.3+r()*.7)}" fill="#fff" opacity="${f(.35+r()*.5)}"/>`}
    if(P.moon)s+=`<ellipse cx="${f(x-R*.05)}" cy="${f(y-R*.1)}" rx="${f(R*.62)}" ry="${f(R*.42)}" fill="#8EC3F2" opacity=".55" ${B(c,'b4')}/><ellipse cx="${f(x-R*.12)}" cy="${f(y-R*.2)}" rx="${f(R*.35)}" ry="${f(R*.18)}" fill="#D9EEFF" opacity=".7" ${B(c,'b2')}/>`;
    return s?`<g ${cp}>${s}</g>`:''}
  function spec(c,x,y,R,P,cp){const hx=x-R*.36,hy=y-R*.4;let s='';
    if(P.star){let g='';for(let k=0;k<3;k++){const a=k*Math.PI/3+.25;g+=`<path d="M${f(hx-Math.cos(a)*R*1.3)} ${f(hy-Math.sin(a)*R*1.3)}L${f(hx+Math.cos(a)*R*1.3)} ${f(hy+Math.sin(a)*R*1.3)}" stroke="#fff" stroke-width="${f(Math.max(.8,R*.055))}" opacity=".6"/>`}s+=`<g ${cp} ${B(c,'b1')}>${g}</g>`}
    s+=`<ellipse cx="${f(hx)}" cy="${f(hy)}" rx="${f(R*.3)}" ry="${f(R*.16)}" transform="rotate(-38 ${f(hx)} ${f(hy)})" fill="#fff" opacity="${P.trans?.8:.55}" ${B(c,'b1')}/><circle cx="${f(hx+R*.05)}" cy="${f(hy+R*.03)}" r="${f(R*.07)}" fill="#fff"/>`;
    s+=`<path d="M${f(x+R*.55)} ${f(y+R*.55)}A${f(R*.78)} ${f(R*.78)} 0 0 0 ${f(x+R*.75)} ${f(y-R*.1)}" stroke="#fff" stroke-opacity=".35" stroke-width="${f(R*.06)}" fill="none" stroke-linecap="round"/>`;
    return s}
  function bead(c,x,y,R,P,k){const cp=clip(c,`<circle cx="${f(x)}" cy="${f(y)}" r="${f(R)}"/>`);
    let s=`<ellipse cx="${f(x+R*.3)}" cy="${f(y+R*.45)}" rx="${f(R*1.02)}" ry="${f(R*.92)}" fill="#3a1c10" opacity="${P.trans?.22:.34}" ${B(c,'b2')}/>`;
    if(P.trans)s+=`<ellipse cx="${f(x+R*.6)}" cy="${f(y+R*.85)}" rx="${f(R*.7)}" ry="${f(R*.45)}" fill="${P.c[1]}" opacity=".55" ${B(c,'b2')}/>`;
    s+=`<circle cx="${f(x)}" cy="${f(y)}" r="${f(R)}" fill="${stoneFill(c,P,k)}"/>`+fx(c,x,y,R,P,cp);
    s+=`<circle cx="${f(x)}" cy="${f(y)}" r="${f(R)}" fill="${G(c,[[.6,'#000',0],[1,'#2a1006',P.trans?.22:.35]],{cx:.6,cy:.64,r:.62},'edge')}"/>`;
    return s+spec(c,x,y,R,P,cp)}
  function goldBead(c,x,y,R){let s=`<ellipse cx="${f(x+R*.3)}" cy="${f(y+R*.45)}" rx="${f(R)}" ry="${f(R*.9)}" fill="#3a1c10" opacity=".35" ${B(c,'b2')}/><circle cx="${f(x)}" cy="${f(y)}" r="${f(R)}" fill="${GOLD(c)}"/>`;
    for(let k=1;k<4;k++)s+=`<circle cx="${f(x)}" cy="${f(y)}" r="${f(R*k/4)}" fill="none" stroke="#6E4A1F" stroke-opacity=".35" stroke-width=".8"/>`;
    return s+`<ellipse cx="${f(x-R*.35)}" cy="${f(y-R*.38)}" rx="${f(R*.3)}" ry="${f(R*.16)}" transform="rotate(-38 ${f(x-R*.35)} ${f(y-R*.38)})" fill="#fff" opacity=".9" ${B(c,'b1')}/>`}
  function bracelet(c,cx,cy,n,R,pf,{gold=-1,tilt=.9}={}){const Rr=n*R*2.02/PI2;const it=[];const o=c.r()*.3;
    for(let i=0;i<n;i++){const a=-Math.PI/2+o+i/n*PI2;it.push({x:cx+Math.cos(a)*Rr,y:cy+Math.sin(a)*Rr*tilt,i})}
    let s=`<ellipse cx="${cx}" cy="${cy}" rx="${f(Rr)}" ry="${f(Rr*tilt)}" fill="none" stroke="#C9B9AC" stroke-width="1.6" opacity=".7"/>`;
    it.sort((a,b)=>a.y-b.y);for(const b of it){if(b.i===gold)s+=goldBead(c,b.x,b.y,R*.78);else{const P=pf(b.i);s+=bead(c,b.x,b.y,R,P,P.k||'bd')}}
    return s}
  function tumbled(c,x,y,R,P,{sx=1.18,rot=0}={}){const r=c.r,d=blob(r,0,0,R,.16,9,sx,1);const cp=clip(c,`<path d="${d}" transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})"/>`);
    let s=`<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})"><path d="${d}" fill="#3a1c10" opacity=".3" transform="translate(${f(R*.25)} ${f(R*.4)})" ${B(c,'b4')}/><path d="${d}" fill="${stoneFill(c,P,P.k)}"/></g>`;
    let e='';if(P.spark)for(let i=0;i<40;i++){const[a,b]=inC(r,R*.95);e+=`<circle cx="${f(x+a*sx)}" cy="${f(y+b)}" r="${f(.4+r()*.9)}" fill="#fff" opacity="${f(.3+r()*.6)}"/>`}
    if(P.metal)for(let i=0;i<5;i++){const[a,b]=inC(r,R*.7);e+=`<path d="${blob(r,x+a,y+b,R*(.2+r()*.2),.3,5)}" fill="${r()<.5?'#FFF0B8':'#5E4A22'}" opacity=".35"/>`}
    s+=`<g ${cp}>${fx(c,x,y,R,P,'')}${e}<ellipse cx="${f(x+R*.2)}" cy="${f(y+R*.3)}" rx="${f(R*1.3)}" ry="${f(R)}" fill="${G(c,[[.5,'#000',0],[1,'#2a1006',.3]],{cx:.4,cy:.36,r:.6},'tedge')}"/></g>`;
    return s+spec(c,x,y,R*.9,{...P,star:0},'')}

  /* ---------- jewellery ---------- */
  function chain(c,pts){const d=open(pts);let s=`<path d="${d}" stroke="#3a1c10" stroke-opacity=".25" stroke-width="5" fill="none" transform="translate(3 5)" ${B(c,'b2')}/>`;
    s+=`<path d="${d}" stroke="${GOLDL(c)}" stroke-width="3.4" fill="none" stroke-dasharray="6 1.6" stroke-linecap="round"/><path d="${d}" stroke="#FFF3D2" stroke-width="1" fill="none" stroke-dasharray="2 5.6" opacity=".9"/>`;return s}
  function pendant(c,x,y,shape,P,{W=46,H=78}={}){const path=shape==='marquise'?(w,h)=>`M0 ${-h}Q${w*1.25} 0 0 ${h}Q${-w*1.25} 0 0 ${-h}Z`:(w,h)=>`M0 ${-h}A${w} ${h} 0 1 1 0 ${h}A${w} ${h} 0 1 1 0 ${-h}Z`;
    const cp=clip(c,`<path d="${path(W,H)}" transform="translate(${x} ${y})"/>`);
    let s=chain(c,[[x-150,-60],[x-120,y-150],[x-40,y-H-40],[x,y-H-22]])+chain(c,[[x,y-H-22],[x+40,y-H-40],[x+120,y-150],[x+150,-60]]);
    s+=`<g transform="translate(${x} ${y})"><path d="${path(W+7,H+7)}" fill="#3a1c10" opacity=".35" transform="translate(6 10)" ${B(c,'b4')}/><circle cx="0" cy="${-H-20}" r="7" fill="none" stroke="${GOLD(c)}" stroke-width="3"/><rect x="-6" y="${-H-16}" width="12" height="20" rx="5" fill="${GOLD(c)}"/><path d="${path(W+7,H+7)}" fill="${GOLDL(c)}"/><path d="${path(W+3,H+3)}" fill="none" stroke="#6E4A1F" stroke-opacity=".5"/><path d="${path(W,H)}" fill="${stoneFill(c,P,P.k+'p')}"/></g>`;
    s+=fx(c,x,y,W*1.1,P,cp);
    s+=`<path d="${path(W,H)}" transform="translate(${x} ${y})" fill="${G(c,[[.55,'#000',0],[1,'#2a1006',.25]],{cx:.6,cy:.64,r:.6})}"/>`;
    return s+spec(c,x+W*.15,y-H*.12,W*.95,P,cp)}

  /* ---------- décor ---------- */
  function sphere(c,cx,cy,R,P){const cp=clip(c,`<circle cx="${cx}" cy="${cy}" r="${R}"/>`);let s='';
    s+=`<ellipse cx="${cx+14}" cy="${cy+R+16}" rx="${f(R*1.1)}" ry="22" fill="#3a1c10" opacity=".28" ${B(c,'b9')}/><ellipse cx="${cx+8}" cy="${cy+R+26}" rx="${f(R*.45)}" ry="12" fill="#FFF8EC" opacity=".9" ${B(c,'b9')}/>`;
    s+=`<ellipse cx="${cx}" cy="${cy+R-8}" rx="${f(R*.55)}" ry="16" fill="none" stroke="${GOLDL(c)}" stroke-width="10"/>`;
    s+=`<circle cx="${cx}" cy="${cy}" r="${R}" fill="${G(c,[[0,P.c[0]],[.6,P.c[1]],[1,P.c[2]]],{cx:.5,cy:.55,r:.6})}"/>`;
    s+=`<g ${cp}><ellipse cx="${cx}" cy="${f(cy-R*.55)}" rx="${f(R*1.1)}" ry="${f(R*.55)}" fill="${P.floor}" opacity=".45" ${B(c,'b18')}/><ellipse cx="${cx}" cy="${f(cy-R*.05)}" rx="${f(R*.95)}" ry="${f(R*.1)}" fill="#fff" opacity=".5" ${B(c,'b9')}/>`;
    const r=c.r;for(let i=0;i<5;i++){const[a,b]=inC(r,R*.6);s+=`<path d="M${f(cx+a-30)} ${f(cy+b)}q30 ${f((r()-.5)*40)} 60 ${f((r()-.5)*20)}" stroke="#fff" stroke-width="${f(3+r()*8)}" opacity="${f(.2+r()*.3)}" fill="none" stroke-linecap="round" ${B(c,'b2')}/>`}
    s+=`<ellipse cx="${cx}" cy="${f(cy+R*.55)}" rx="${f(R*.6)}" ry="${f(R*.25)}" fill="#fff" opacity=".55" ${B(c,'b9')}/></g>`;
    s+=`<circle cx="${cx}" cy="${cy}" r="${R-6}" fill="none" stroke="#5a4636" stroke-opacity=".3" stroke-width="14" ${B(c,'b4')}/>`;
    s+=`<path d="M${cx-R*.62} ${cy-R*.46}A${R*.82} ${R*.82} 0 0 1 ${cx-R*.1} ${cy-R*.8}" stroke="#fff" stroke-width="10" stroke-linecap="round" fill="none" opacity=".75" ${B(c,'b2')}/><ellipse cx="${f(cx-R*.42)}" cy="${f(cy-R*.5)}" rx="14" ry="8" transform="rotate(-40 ${f(cx-R*.42)} ${f(cy-R*.5)})" fill="#fff"/>`;
    return s}
  function point(c,x,y,ang,L,w,P,dim=0){const r=c.r,ax=(r()-.5)*w*.4,A=[ax,-L];const t=-L*.74;
    const fl=[[-w,0],[-w*.25,0],[-w*.25,t-w*.25],A,[-w,t]],fc=[[-w*.25,0],[w*.35,0],[w*.35,t-w*.2],A,[-w*.25,t-w*.25]],fr=[[w*.35,0],[w,0],[w,t],A,[w*.35,t-w*.2]];
    const pp=a=>a.map(p=>f(p[0])+','+f(p[1])).join(' ');
    const g=(k,s)=>G(c,s,{lin:1,x1:0,y1:1,x2:0,y2:0},k);
    let s=`<g transform="translate(${f(x)} ${f(y)}) rotate(${f(ang)})"><polygon points="${pp(fl)}" fill="${g('pl',[[0,P.d],[1,P.l]])}"/><polygon points="${pp(fc)}" fill="${g('pc',[[0,P.d],[.7,P.m],[1,P.m2]])}"/><polygon points="${pp(fr)}" fill="${g('pr',[[0,P.dd],[1,P.d]])}"/>`;
    s+=`<polyline points="${pp([[-w*.25,0],[-w*.25,t-w*.25],A])}" stroke="#fff" stroke-opacity=".5" stroke-width="1.1" fill="none"/><polyline points="${pp([[w*.35,0],[w*.35,t-w*.2],A])}" stroke="#fff" stroke-opacity=".22" stroke-width="1" fill="none"/>`;
    s+=`<path d="M${f(-w*.8)} ${f(t*.6)}L${f(-w*.5)} ${f(t*.2)}" stroke="#fff" stroke-opacity=".35" stroke-width="2.5" ${B(c,'b1')}/>`;
    if(dim)s+=`<polygon points="${pp([[-w,0],[w,0],[w,t],A,[-w,t]])}" fill="#2a1430" opacity="${dim}"/>`;
    return s+'</g>'}
  function cube(c,x,y,s,rot){const h=s*.5;const g=(k,a,b)=>G(c,[[0,a],[.5,b],[1,a]],{lin:1,x1:0,y1:0,x2:1,y2:1},k);
    const top=`M0 ${-s}L${s} ${-s+h}L0 ${-s+2*h}L${-s} ${-s+h}Z`,lf=`M${-s} ${-s+h}L0 ${-s+2*h}L0 ${2*h}L${-s} ${h}Z`,rt=`M${s} ${-s+h}L0 ${-s+2*h}L0 ${2*h}L${s} ${h}Z`;
    let o=`<g transform="translate(${f(x)} ${f(y)}) rotate(${f(rot)})"><path d="${top}" fill="${g('cut','#FFF0C0','#CBA75A')}"/><path d="${lf}" fill="${g('cul','#C29A4C','#8A6A2C')}"/><path d="${rt}" fill="${g('cur','#6E5426','#A88A48')}"/>`;
    for(let k=1;k<5;k++)o+=`<path d="M${f(-s+k*s/5)} ${f(-s+h-k*h/5)}L${f(k*s/5)} ${f(-s+2*h-k*h/5)}" stroke="#7a5e24" stroke-opacity=".3" stroke-width=".8"/>`;
    return o+`<path d="${top}" fill="none" stroke="#FFF6D8" stroke-opacity=".7" stroke-width="1"/></g>`}
  function box(c,cx,cy,w,h,inner){const r=c.r;let s=sh(c,cx,cy,w*.55,h*.55,.3,'b9',10,16)+`<rect x="${cx-w/2}" y="${cy-h/2}" width="${w}" height="${h}" rx="4" fill="${G(c,[[0,'#F7E8DE'],[1,'#E2C9B8']],{lin:1})}"/><rect x="${cx-w/2+3}" y="${cy-h/2+3}" width="${w-6}" height="${h-6}" rx="3" fill="none" stroke="${GOLDL(c)}" stroke-width="1.5"/>`;
    s+=`<rect x="${cx-w/2+14}" y="${cy-h/2+14}" width="${w-28}" height="${h-28}" fill="${G(c,[[0,'#FFFBF6'],[1,'#EFE2D6']],{})}"/>`;
    for(let i=0;i<14;i++){const x=cx-w/2+20+r()*(w-40),y=cy-h/2+20+r()*(h-40);s+=`<path d="M${f(x)} ${f(y)}l${f((r()-.5)*40)} ${f((r()-.5)*30)}" stroke="#C8B4A4" stroke-opacity=".5" stroke-width="1" ${B(c,'b1')}/>`}
    return s+inner}
  function card(c,x,y,rot){return`<g transform="translate(${x} ${y}) rotate(${rot})">`+sh(c,0,0,46,32,.25,'b4',3,5)+`<rect x="-46" y="-32" width="92" height="64" fill="#FFFDF9"/><rect x="-40" y="-26" width="80" height="52" fill="none" stroke="${GOLDL(c)}" stroke-width="1.2"/><path d="M-18 6h36M-12 13h24" stroke="#B48A52" stroke-width="1.4"/><path d="M0 -14l3 6 6 1-4.5 4 1 6-5.5-3-5.5 3 1-6-4.5-4 6-1z" fill="${GOLDL(c)}"/></g>`}
  function heart(c,x,y,S,P,rot=0){const d=`M0 ${S*.35}C${-S*1.1} ${-S*.3} ${-S*.55} ${-S*1.05} 0 ${-S*.45}C${S*.55} ${-S*1.05} ${S*1.1} ${-S*.3} 0 ${S*.35}Z`;const cp=clip(c,`<path d="${d}" transform="translate(${x} ${y}) rotate(${rot})"/>`);
    return`<g transform="translate(${x} ${y}) rotate(${rot})"><path d="${d}" fill="#3a1c10" opacity=".3" transform="translate(5 9)" ${B(c,'b4')}/><path d="${d}" fill="${stoneFill(c,P,'hrt')}"/></g>`+fx(c,x,y-S*.2,S*.7,P,cp)+spec(c,x-S*.1,y-S*.2,S*.55,{...P,star:0},'')}

  /* ---------- surfaces ---------- */
  function silk(c,r,W,H,base,lt,dk){let s=`<rect width="${W}" height="${H}" fill="${G(c,[[0,lt],[1,base]],{lin:1,x1:0,y1:0,x2:1,y2:1})}"/>`;
    let g=`<g transform="rotate(-28 ${W/2} ${H/2})">`;for(let i=0;i<7;i++){const y=-160+i*(H+320)/7+r()*40,d=`M-200 ${f(y)}C${f(W*.25)} ${f(y-90+r()*180)} ${f(W*.7)} ${f(y+90-r()*180)} ${W+200} ${f(y+(r()-.5)*80)}`;g+=`<path d="${d}" stroke="${i%2?lt:dk}" stroke-opacity="${i%2?.75:.32}" stroke-width="${f(24+r()*56)}" fill="none" ${B(c,'b18')}/><path d="${d}" stroke="${i%2?'#fff':dk}" stroke-opacity="${i%2?.35:.18}" stroke-width="${f(4+r()*6)}" fill="none" transform="translate(0 ${f(18+r()*10)})" ${B(c,'b4')}/>`}
    return s+g+'</g>'}
  function linen(c,r,W,H,base){const id=c.p+'ln';c.defs.push(`<pattern id="${id}" width="5" height="5" patternUnits="userSpaceOnUse"><rect width="5" height="5" fill="${base}"/><path d="M0 1.2H5M0 3.7H5" stroke="#fff" stroke-opacity=".25" stroke-width=".7"/><path d="M1.3 0V5M3.8 0V5" stroke="#5a3a28" stroke-opacity=".07" stroke-width=".7"/></pattern>`);
    let s=`<rect width="${W}" height="${H}" fill="url(#${id})"/>`;for(let i=0;i<4;i++){const y=r()*H;s+=`<path d="M-20 ${f(y)}Q${f(W/2)} ${f(y+(r()-.5)*80)} ${W+20} ${f(y+(r()-.5)*40)}" stroke="${i%2?'#fff':'#5a3a28'}" stroke-opacity="${i%2?.3:.08}" stroke-width="12" fill="none" ${B(c,'b9')}/>`}return s}
  function marble(c,r,W,H,a,b,v){let s=`<rect width="${W}" height="${H}" fill="${G(c,[[0,a],[1,b]],{cx:.3,cy:.25,r:1})}"/>`;
    for(let i=0;i<6;i++){let x=r()*W,y=-20,an=1.2+r()*.6;const pts=[[x,y]];while(y<H+30){an+=(r()-.5)*.5;x+=Math.cos(an)*22;y+=Math.abs(Math.sin(an))*22+4;pts.push([x,y])}const d=open(pts);s+=`<path d="${d}" stroke="${v}" stroke-opacity=".12" stroke-width="8" fill="none" ${B(c,'b4')}/><path d="${d}" stroke="${v}" stroke-opacity="${f(.2+r()*.2)}" stroke-width="${f(.6+r()*1.2)}" fill="none"/>`}return s}
  function velvet(c,r,W,H){return`<rect width="${W}" height="${H}" fill="${G(c,[[0,'#5A4034'],[.6,'#33231C'],[1,'#1E1410']],{cx:.4,cy:.35,r:.9})}"/>`}
  function studio(c,r,W,H,oy,wall,floor){const hz=oy+305;return`<rect width="${W}" height="${H}" fill="${G(c,[[0,wall[0]],[1,wall[1]]],{lin:1,x1:0,y1:0,x2:0,y2:1})}"/><rect y="${hz}" width="${W}" height="${H-hz}" fill="${G(c,[[0,floor[0]],[1,floor[1]]],{lin:1,x1:0,y1:0,x2:0,y2:1})}"/><rect y="${hz-14}" width="${W}" height="28" fill="${floor[0]}" opacity=".7" ${B(c,'b9')}/><ellipse cx="${W*.3}" cy="${H*.2}" rx="${W*.4}" ry="${H*.25}" fill="#fff" opacity=".25" ${B(c,'b18')}/>`}
  const SURF={
    blushSilk:(c,r,W,H)=>silk(c,r,W,H,'#E7C9BA','#FBEDE4','#C99F8C'),
    champSilk:(c,r,W,H)=>silk(c,r,W,H,'#E6D2B6','#FBF2E2','#BFA27C'),
    linen:(c,r,W,H)=>linen(c,r,W,H,'#E8D6C8'),
    travertine:(c,r,W,H)=>marble(c,r,W,H,'#F7EEE6','#E6D7C9','#A88C72'),
    velvet:(c,r,W,H)=>velvet(c,r,W,H),
    studioBlush:(c,r,W,H,oy)=>studio(c,r,W,H,oy,['#F3E3D8','#E7CEC0'],['#E2C6B6','#CDAA97']),
    studioCream:(c,r,W,H,oy)=>studio(c,r,W,H,oy,['#F6EDE4','#E8DACB'],['#E3D2C2','#CDB59F']),
    studioTaupe:(c,r,W,H,oy)=>studio(c,r,W,H,oy,['#E6DAD0','#CDBBAE'],['#C7B2A3','#A88E7D']),
  };
  const S=(k,o={})=>({...STONE[k],k,...o});

  /* ---------- products (drawn in a 400×400 scene) ---------- */
  const D={
    'star-rose-bracelet':['blushSilk',c=>bracelet(c,200,206,18,23,()=>S('rose'),{gold:9})],
    'amethyst-bracelet':['travertine',c=>bracelet(c,196,210,22,18.5,()=>S('amethyst'))+tumbled(c,350,70,22,S('amethyst'),{rot:30})],
    'citrine-bracelet':['linen',c=>bracelet(c,196,206,24,17,()=>S('citrine'),{gold:12})],
    'rutile-bracelet':['velvet',c=>bracelet(c,200,206,20,20,()=>S('rutile'),{gold:10})],
    'tourmaline-bracelet':['champSilk',c=>{const r=c.r;const pal=Array.from({length:26},()=>TOURM[Math.floor(r()*TOURM.length)]);return bracelet(c,200,206,26,16,i=>({c:pal[i],trans:1,cloud:1,k:'t'+TOURM.indexOf(pal[i])}))}],
    'tiger-eye-bracelet':['travertine',c=>bracelet(c,200,206,22,18,()=>S('tiger'),{gold:11})],
    'aquamarine-bracelet':['linen',c=>bracelet(c,200,206,24,17,()=>S('aqua'))],
    'clear-quartz-bracelet':['velvet',c=>bracelet(c,200,206,19,21.5,()=>S('clear'),{gold:0})],
    'star-rose-pendant':['blushSilk',c=>pendant(c,200,240,'marquise',S('rose'),{W:44,H:84})],
    'moonstone-pendant':['velvet',c=>pendant(c,200,250,'oval',S('moon'),{W:52,H:66})],
    'quartz-sphere':['studioBlush',c=>sphere(c,200,196,122,{c:['#FFFFFF','#F1EBE6','#C4B6AC'],floor:'#C9A896'})],
    'amethyst-cluster':['studioCream',c=>{const r=c.r;let s=sh(c,200,322,170,40,.35,'b9',8,10)+`<path d="${blob(r,200,318,150,.08,12,1,.32)}" fill="${G(c,[[0,'#9A8D86'],[1,'#4E4440']],{})}"/>`;
      const P={l:'#E8CFF5',m:'#A56ACB',m2:'#D7B4EE',d:'#5B2A80',dd:'#38184F'};const pts=[];
      for(let i=0;i<17;i++){const bx=200+(r()-.5)*250,k=Math.abs(bx-200)/125;pts.push({bx,by:300+r()*26,ang:(bx-200)/125*40+(r()-.5)*18,L:(70+r()*120)*(1-k*.45),w:13+r()*15})}
      pts.sort((a,b)=>a.by-b.by);pts.forEach((p,i)=>s+=point(c,p.bx,p.by,p.ang,p.L,p.w,P,i<6?.25:0));
      return s+`<path d="M52 318Q200 372 348 318Q330 352 200 360Q70 352 52 318Z" fill="${G(c,[[0,'#7A6C66'],[1,'#3C3330']],{lin:1,x1:0,y1:0,x2:0,y2:1})}"/>`+(()=>{let k='';for(let i=0;i<60;i++){const x=70+r()*260,y=322+r()*28;k+=`<circle cx="${f(x)}" cy="${f(y)}" r="${f(.8+r()*1.6)}" fill="${r()<.5?'#C9A8E0':'#2a2220'}" opacity=".6"/>`}return k})()}],
    'pyrite-cluster':['studioTaupe',c=>{const r=c.r;let s=sh(c,200,312,150,36,.4,'b9',8,10)+`<path d="${blob(r,200,300,140,.1,12,1,.42)}" fill="${G(c,[[0,'#8D8578'],[1,'#3F3A33']],{})}"/>`;
      const cs=[];for(let i=0;i<11;i++){const[a,b]=inC(r,1);cs.push({x:200+a*110,y:268+b*34-(1-Math.abs(a))*30,s:26+r()*26,rot:(r()-.5)*24})}cs.sort((a,b)=>a.y-b.y);cs.forEach(q=>s+=cube(c,q.x,q.y,q.s,q.rot));return s}],
    'selenite-plate':['linen',c=>{const r=c.r;let s=`<g transform="rotate(-8 200 206)">`+sh(c,200,206,160,80,.3,'b9',8,14)+`<rect x="40" y="128" width="320" height="156" rx="10" fill="${G(c,[[0,'#FFFFFF'],[.5,'#F2EEE8'],[1,'#DAD3CA']],{lin:1,x1:0,y1:0,x2:0,y2:1})}"/>`;
      for(let i=0;i<60;i++){const y=132+r()*148;s+=`<path d="M44 ${f(y)}L356 ${f(y+(r()-.5)*4)}" stroke="${r()<.6?'#fff':'#C9C0B4'}" stroke-opacity="${f(.25+r()*.4)}" stroke-width="${f(.5+r()*1.4)}"/>`}
      s+=`<rect x="40" y="170" width="320" height="34" fill="#fff" opacity=".55" ${B(c,'b4')}/><rect x="40" y="128" width="320" height="156" rx="10" fill="none" stroke="#fff" stroke-opacity=".8" stroke-width="2"/></g>`;
      return s+tumbled(c,170,210,22,S('amethyst'),{rot:20})+tumbled(c,232,196,19,S('rose',{star:0}),{rot:-30})}],
    'prosperity-set':['travertine',c=>box(c,200,206,300,236,tumbled(c,128,170,30,S('citrine'),{rot:20})+tumbled(c,206,236,30,{c:['#F5E7B8','#B79A55','#5E4A22'],metal:1,k:'pyr'},{rot:-15})+tumbled(c,276,168,29,{c:['#D8F0C8','#5E9E5A','#1F4D25'],spark:1,k:'avt'},{rot:40})+card(c,268,268,-6))],
    __generic:['champSilk',c=>tumbled(c,150,190,44,S('rose',{star:0}),{rot:20})+tumbled(c,250,170,38,S('amethyst'),{rot:-30})+tumbled(c,215,262,40,S('clear'),{rot:10})],
    'self-love-set':['blushSilk',c=>box(c,200,206,300,236,heart(c,150,200,62,S('rose'),-12)+tumbled(c,260,160,27,S('rose',{star:0}),{rot:10})+tumbled(c,262,236,25,S('amethyst'),{rot:-20})+card(c,136,282,5))],
  };


  /* ---------- any stone from the inventory: colour by name ---------- */
  const SP=(c,o={})=>({c,trans:1,...o});
  const STONEMAP=[
    [/tourmalinated/,SP(['#FFFFFF','#EDEBE6','#A9A399'],{rutile:1,needle:'#1c1c1c'})],
    [/multi.*rutil/,SP(['#FFFFFF','#EDE6DF','#A89E92'],{rutile:1})],
    [/rutil/,SP(['#FFFFFF','#EDE9E2','#A9A399'],{rutile:1})],
    [/larimar/,SP(['#F4FBFF','#9FD3EA','#4C8FB5'],{trans:0,cloud:1})],
    [/mica.*purple|purple.*mica|lepidolite/,SP(['#EFDDF5','#A685BE','#5B3C74'],{trans:0,spark:1})],
    [/mica/,SP(['#FFF0C8','#C9A04E','#6E5320'],{trans:0,spark:1})],
    [/amber/,SP(['#FFE6A6','#E09A2D','#8A4A0C'])],
    [/libyan/,SP(['#FFFBE6','#F1E3A2','#BFA75C'],{cloud:1})],
    [/rhodochrosite/,SP(['#FFE1E4','#E57B8C','#9C3348'],{trans:0,cloud:1})],
    [/variscite/,SP(['#EAF7E6','#8FC9A0','#3E7D55'],{trans:0})],
    [/boulder opal/,SP(['#C8F0FF','#4F86B8','#3A2A1E'],{trans:0,moon:1})],
    [/opal/,SP(['#EAF7FF','#A8D6EE','#5E99BD'],{cloud:1})],
    [/green garnet|tsavorite/,SP(['#E8F8DA','#6FB24A','#2D5E1C'])],
    [/chrysocolla/,SP(['#D8F6F2','#38A6A0','#14545A'],{trans:0,cloud:1})],
    [/sunstone/,SP(['#FFE2C6','#E5814A','#8A3A16'],{spark:1})],
    [/diopside/,SP(['#CFE8C8','#2F6B36','#0E2A12'])],
    [/tektite/,SP(['#5A5A52','#26261F','#0B0B08'],{trans:0})],
    [/petersite/,SP(['#C9D6E6','#34507A','#121C2E'],{trans:0,tiger:1})],
    [/seraphinite/,SP(['#CFE4D2','#3E6B4E','#16301F'],{trans:0,cloud:1})],
    [/eudialyte/,SP(['#F6C8D0','#B8354F','#3A1A20'],{trans:0})],
    [/emerald/,SP(['#D9F7E3','#2FA067','#0D4D2C'],{cloud:1})],
    [/moonstone/,SP(['#FFFFFF','#EEF0F2','#B9C0C8'],{moon:1})],
    [/strawberry/,SP(['#FFE9EC','#F1A0B0','#B4566C'],{cloud:1,spark:1})],
    [/selenite/,SP(['#FFFFFF','#EEEDEA','#BDBAB4'],{trans:0,cloud:1})],
    [/golden healer/,SP(['#FFFBEA','#F1E3B5','#B79F62'],{cloud:1})],
    [/clear quartz|crystal quartz/,SP(['#FFFFFF','#EEEBE6','#B2ACA4'],{cloud:1})],
    [/onyx/,SP(['#DCEBFA','#6E93C4','#2D4A75'],{trans:0})],
    [/tiger/,SP(['#E9B357','#8E5A1C','#3A220A'],{trans:0,tiger:1})],
    [/lavender amethyst/,SP(['#F7EEFC','#CDB3E6','#8466A6'],{cloud:1})],
    [/amethyst/,SP(['#F1DDFA','#A974CF','#4E2273'],{cloud:1})],
    [/blue lace/,SP(['#F3FAFF','#BBD9EE','#7EA6C7'],{trans:0,cloud:1})],
    [/unakite/,SP(['#F2D6CB','#7FA26B','#3E5A35'],{trans:0,cloud:1})],
    [/apatite/,SP(['#D8FAF7','#3CC2C6','#0E6D78'])],
    [/fluorite/,SP(['#EDE5FA','#9B86D4','#2F7F6E'],{cloud:1})],
    [/black tourmaline|schorl|obsidian/,SP(['#4A4A4A','#1D1D1D','#050505'],{trans:0})],
    [/jade/,SP(['#E3F5DD','#6FA86A','#2E5A2F'],{trans:0,cloud:1})],
    [/moss agate/,SP(['#F2F6EE','#9DB89A','#3F6B3E'],{cloud:1})],
    [/calcite|citrine/,SP(['#FFF8D2','#F4D36A','#B88F1E'])],
    [/mookaite/,SP(['#F9D9B8','#C5643E','#6E2A1A'],{trans:0,cloud:1})],
    [/rhodonite/,SP(['#FADBDE','#D9748A','#4A2A2E'],{trans:0,cloud:1})],
    [/aventurine/,SP(['#D8F0C8','#5E9E5A','#1F4D25'],{trans:0,spark:1})],
    [/angelite|celestite/,SP(['#F0F6FF','#B9CBEA','#7E94BF'],{trans:0,cloud:1})],
    [/rose quartz/,SP(['#FFF2F4','#F3C3CF','#C98798'],{cloud:1})],
    [/serpentine/,SP(['#EEF4D4','#9DB25D','#4F5E25'],{trans:0})],
    [/morganite/,SP(['#FFF0EB','#F3C0B0','#C08672'],{cloud:1})],
    [/malachite/,SP(['#7FD3A0','#1E8A52','#0B3D23'],{trans:0,tiger:1})],
    [/phosphosiderite/,SP(['#F8E4F6','#C690C7','#7C4A82'],{trans:0,cloud:1})],
    [/lapis/,SP(['#9FB7F2','#2E4FB5','#132260'],{trans:0,spark:1})],
    [/hessonite|orange garnet/,SP(['#FFE0B8','#E68A2E','#8C3E0C'])],
    [/almandine|red garnet|garnet/,SP(['#F5B8BE','#9C1F33','#4A0814'])],
    [/golden labradorite/,SP(['#FFF6D6','#EED78A','#B39A4C'])],
    [/labradorite/,SP(['#C9D0D6','#5E6B74','#262D33'],{trans:0,moon:1})],
    [/peridot/,SP(['#F2FAD2','#A9C94A','#5C7A12'])],
    [/ocean jasper/,SP(['#EFF2DE','#9DB77E','#4F6B3E'],{trans:0,cloud:1})],
    [/thulite/,SP(['#FFE2EA','#E58BA6','#9E4664'],{trans:0,cloud:1})],
    [/auralite/,SP(['#F1E4F6','#9F6FAE','#4F2A57'],{rutile:1})],
    [/aquamarine/,SP(['#F2FBFD','#AFDCE8','#5E9AAF'],{cloud:1})],
  ];
  const SURFS=['blushSilk','linen','travertine','champSilk','blushSilk','travertine'];
  function specDef(spec){
    const key=`${spec.stone||''} ${spec.variant||''}`.toLowerCase();
    const hit=STONEMAP.find(([re])=>re.test(key));
    const isTour=/tourmaline/.test(key)&&!/black|tourmalinated/.test(key);
    const P=hit?{...hit[1]}:SP(['#FFFFFF','#EEEBE6','#B2ACA4'],{cloud:1});
    const lum=h=>(h.match(/[0-9A-F]{2}/gi)||[]).reduce((t,x)=>t+parseInt(x,16),0);
    const surf=lum(P.c[0])>740&&lum(P.c[1])>660&&!P.moon?'velvet':lum(P.c[1])<200?'linen':SURFS[hash(key)%SURFS.length];
    if(/pendant|necklace/i.test(spec.type||'')) return[surf,c=>pendant(c,200,246,'oval',{...P,k:'sp'},{W:46,H:64})];
    const mm=Math.max(4,Math.min(16,+spec.size||8)),R=Math.max(7.5,Math.min(25,mm*1.6)),n=Math.max(12,Math.round(PI2*116/(2.02*R)));
    return[surf,c=>{const r=c.r;const pal=isTour?Array.from({length:n},()=>TOURM[Math.floor(r()*TOURM.length)]):null;
      return bracelet(c,200,206,n,R,i=>pal?{c:pal[i],trans:1,cloud:1,k:'t'+TOURM.indexOf(pal[i])}:{...P,k:'sp'},{gold:mm>=8?Math.floor(n/2):-1})}];
  }

  const cache={};
  function build(id,W,H,spec){const def=spec?specDef(spec):(D[id]||D.__generic);const p='q'+(hash(id+W+'x'+H)%1e7).toString(36)+'_';const c={r:rng(hash(id)),p,defs:[],n:0,gm:{}};
    const ox=(W-400)/2,oy=(H-400)/2;const body=def[1](c);const bg=SURF[def[0]](c,rng(hash(id+'bg')),W,H,oy);
    const base=['b18:18','b9:9','b4:4','b2:1.8','b1:.8'].map(s=>{const[k,v]=s.split(':');return`<filter id="${p}${k}" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${v}"/></filter>`}).join('')+`<filter id="${p}gr" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".85" numOctaves="2" seed="4" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 .25  0 0 0 0 .17  0 0 0 0 .12  .5 0 0 0 -.2"/></filter>`;
    const light=`<rect width="${W}" height="${H}" fill="${G(c,[[0,'#FFF6EA',.3],[.55,'#fff',0]],{cx:.15,cy:.08,r:.95})}"/><rect width="${W}" height="${H}" fill="${G(c,[[.55,'#000',0],[1,'#2a140a',.2]],{cx:.5,cy:.48,r:.78})}"/>`;
    const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" preserveAspectRatio="xMidYMid slice"><defs>${base}${c.defs.join('')}</defs>${bg}<g transform="translate(${ox} ${oy})">${body}</g>${light}<rect width="${W}" height="${H}" fill="#000" filter="url(#${p}gr)"/></svg>`;
    return'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svg)}
  const V={sq:[400,400],wide:[446,410],hero:[440,406],lead:[520,330],tall:[400,460],portrait:[400,560],banner:[640,520]};
  return{get(id,v='sq',spec){if(D[id])spec=null;const k=id+v+(spec?JSON.stringify(spec):'');return cache[k]||(cache[k]=build(id,...V[v],spec))}};
})();
