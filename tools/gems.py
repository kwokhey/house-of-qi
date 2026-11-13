"""Draw realistic birthstone gems as SVG: round brilliant cut (top view) + moonstone cabochon."""
import math, random, colorsys, sys, os

def hx(c): return tuple(int(c[i:i+2],16)/255 for i in (1,3,5))
def tohex(r,g,b): return '#%02x%02x%02x'%tuple(max(0,min(255,round(v*255))) for v in (r,g,b))
def shade(base, t):
    """t in [-1,1]: negative darkens toward deep tone, positive lightens toward white"""
    r,g,b=hx(base); h,l,s=colorsys.rgb_to_hls(r,g,b)
    if t>=0: l2=l+(1-l)*t*0.85; s2=s*(1-0.35*t)
    else: l2=l*(1+t*0.82); s2=min(1,s*(1-0.15*t))
    return tohex(*colorsys.hls_to_rgb(h,max(0,min(1,l2)),max(0,min(1,s2))))

def P(r,a): return (100+r*math.cos(math.radians(a)), 100+r*math.sin(math.radians(a)))
def poly(pts,fill,op=1): return '<polygon points="%s" fill="%s"%s/>'%(' '.join('%.2f,%.2f'%p for p in pts),fill,'' if op==1 else ' fill-opacity="%.2f"'%op)

def brilliant(base, seed=1, diamond=False, R=84):
    rnd=random.Random(seed); out=[]
    light=-125
    T=[P(R*0.55,k*45+22.5) for k in range(8)]
    S=[P(R*0.80,k*45) for k in range(8)]
    G=lambda a: P(R,a)
    facets=[]
    for k in range(8):
        a=k*45+22.5
        facets.append(('kite',[S[k],T[k],S[(k+1)%8],G(a)],a))
        facets.append(('star',[T[(k-1)%8],T[k],S[k]],k*45))
        facets.append(('ug',[S[k],G(k*45),G(k*45-22.5)],k*45-11.25))
        facets.append(('ug',[S[k],G(k*45),G(k*45+22.5)],k*45+11.25))
    hi=set(rnd.sample(range(len(facets)),3)); lo=set(rnd.sample(range(len(facets)),4))
    out.append('<circle cx="100" cy="100" r="%.1f" fill="%s"/>'%(R+1.2,shade(base,-0.8)))
    for i,(kind,pts,a) in enumerate(facets):
        d=math.cos(math.radians(a-light))
        alt=(0.16 if (i//2)%2 else -0.16)
        base_t={'kite':0.05,'star':0.25,'ug':-0.15}[kind]
        t=base_t+0.42*d+alt+rnd.uniform(-0.12,0.12)
        if i in hi: t=0.82
        if i in lo: t=-0.85
        if diamond: t=max(-1,min(1,t*1.8))
        out.append(poly(pts,shade(base,max(-0.95,min(0.92,t)))))
    # table with pavilion arrow pattern seen through it
    tr=R*0.55
    out.append(poly(T,shade(base,0.12 if not diamond else 0.35)))
    for k in range(8):
        a=k*45
        tip=P(tr*1.02,a); l=P(tr*0.36,a-22.5); r=P(tr*0.36,a+22.5)
        d=math.cos(math.radians(a-light-180))
        out.append(poly([P(0,0),l,tip],shade(base,-0.55+0.25*d if not diamond else -0.9),0.9))
        out.append(poly([P(0,0),tip,r],shade(base,-0.25+0.3*d if not diamond else -0.35),0.9))
        mid=P(tr*0.98,a+22.5)
        out.append(poly([r,mid,P(tr*1.02,a+45)],shade(base,0.35+0.2*d if not diamond else 0.7),0.75))
    out.append('<circle cx="100" cy="100" r="%.1f" fill="%s" fill-opacity=".55"/>'%(tr*0.16,shade(base,-0.7 if not diamond else -0.95)))
    edges=''.join('<polygon points="%s"/>'%' '.join('%.2f,%.2f'%p for p in pts) for _,pts,_ in facets)+'<polygon points="%s"/>'%' '.join('%.2f,%.2f'%p for p in T)
    out.append('<g fill="none" stroke="#fff" stroke-opacity="%.2f" stroke-width="0.5" stroke-linejoin="round">%s</g>'%(0.45 if diamond else 0.22,edges))
    return out

def gem_svg(name, base, seed, diamond=False):
    body=brilliant(base,seed,diamond)
    sid=name; glow=shade(base,0.55)
    defs=f'''<defs>
<radialGradient id="g{sid}" cx="36%" cy="30%" r="80%"><stop offset="0" stop-color="#fff" stop-opacity=".42"/><stop offset=".3" stop-color="#fff" stop-opacity=".06"/><stop offset=".7" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".38"/></radialGradient>
<radialGradient id="r{sid}" cx="60%" cy="66%" r="38%"><stop offset="0" stop-color="{glow}" stop-opacity=".55"/><stop offset="1" stop-color="{glow}" stop-opacity="0"/></radialGradient>
<radialGradient id="s{sid}" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#2E221C" stop-opacity=".32"/><stop offset="1" stop-color="#2E221C" stop-opacity="0"/></radialGradient>
<clipPath id="c{sid}"><circle cx="100" cy="100" r="85"/></clipPath>
</defs>'''
    sparkle=lambda x,y,s,o: f'<path d="M{x} {y-s}L{x+s*0.18} {y-s*0.18}L{x+s} {y}L{x+s*0.18} {y+s*0.18}L{x} {y+s}L{x-s*0.18} {y+s*0.18}L{x-s} {y}L{x-s*0.18} {y-s*0.18}Z" fill="#fff" fill-opacity="{o}"/>'
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 212" role="img" aria-label="{name}">{defs}
<ellipse cx="100" cy="196" rx="70" ry="10" fill="url(#s{sid})"/>
<g clip-path="url(#c{sid})">{''.join(body)}<circle cx="100" cy="100" r="85" fill="url(#r{sid})" style="mix-blend-mode:screen"/><circle cx="100" cy="100" r="85" fill="url(#g{sid})"/></g>
<circle cx="100" cy="100" r="84.6" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width="1"/>
{sparkle(66,62,11,.95)}{sparkle(134,118,6,.75)}
</svg>'''

def moonstone_svg():
    return '''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 212" role="img" aria-label="Moonstone"><defs>
<radialGradient id="mb" cx="45%" cy="40%" r="62%"><stop offset="0" stop-color="#FBFCFF"/><stop offset=".45" stop-color="#E4E9F1"/><stop offset=".8" stop-color="#B9C3D2"/><stop offset="1" stop-color="#8E9AAE"/></radialGradient>
<radialGradient id="mg" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#7FB2FF" stop-opacity=".95"/><stop offset=".55" stop-color="#5B8FF0" stop-opacity=".45"/><stop offset="1" stop-color="#5B8FF0" stop-opacity="0"/></radialGradient>
<radialGradient id="mh" cx="35%" cy="28%" r="30%"><stop offset="0" stop-color="#fff" stop-opacity=".95"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
<radialGradient id="ms" cx="50%" cy="50%" r="50%"><stop offset="0" stop-color="#2E221C" stop-opacity=".3"/><stop offset="1" stop-color="#2E221C" stop-opacity="0"/></radialGradient>
<filter id="mf" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6"/></filter>
<clipPath id="mc"><circle cx="100" cy="100" r="85"/></clipPath></defs>
<ellipse cx="100" cy="196" rx="70" ry="10" fill="url(#ms)"/>
<g clip-path="url(#mc)"><circle cx="100" cy="100" r="85" fill="url(#mb)"/>
<ellipse cx="112" cy="104" rx="58" ry="34" transform="rotate(-24 112 104)" fill="url(#mg)" filter="url(#mf)"/>
<ellipse cx="86" cy="128" rx="40" ry="14" transform="rotate(-18 86 128)" fill="#9CC4FF" fill-opacity=".35" filter="url(#mf)"/>
<path d="M30 70 Q100 40 170 78" stroke="#fff" stroke-opacity=".35" stroke-width="10" fill="none" filter="url(#mf)"/>
<circle cx="100" cy="100" r="85" fill="url(#mh)"/>
<circle cx="100" cy="100" r="84" fill="none" stroke="#6B7891" stroke-opacity=".35" stroke-width="3"/></g>
<ellipse cx="72" cy="58" rx="20" ry="10" transform="rotate(-28 72 58)" fill="#fff" fill-opacity=".85"/>
</svg>'''

GEMS=[('jan','Garnet','#6E0F1C',3),('feb','Amethyst','#7A3EA6',5),('mar','Aquamarine','#5BB8D2',7),('apr','Diamond','#C9CDD3',11),
      ('may','Emerald','#0B7A48',13),('jun','Moonstone',None,0),('jul','Ruby','#B80C2C',17),('aug','Peridot','#8CB52A',19),
      ('sep','Sapphire','#1D3DA6',23),('oct','Tourmaline','#E2559A',29),('nov','Citrine','#E39B17',31),('dec','Tanzanite','#5A4BC8',37)]
out=sys.argv[1]; os.makedirs(out,exist_ok=True)
for k,name,base,seed in GEMS:
    svg=moonstone_svg() if base is None else gem_svg(k,base,seed,diamond=(name=='Diamond'))
    open(os.path.join(out,k+'.svg'),'w').write(svg)
print('ok')
