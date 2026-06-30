import os, math, wave, struct, random, subprocess
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont, ImageFilter, ImageEnhance

ROOT = Path(__file__).resolve().parent
OUTDIR = ROOT / "promo_frames_10s"
OUTDIR.mkdir(exist_ok=True)
for p in OUTDIR.glob("frame_*.png"):
    p.unlink()

W, H = 1080, 1920
FPS = 24
DUR = 10
N = FPS * DUR
BG1 = (2, 8, 14)
BG2 = (0, 23, 36)
CYAN = (0, 220, 255)
GOLD = (245, 178, 44)
GREEN = (35, 255, 145)
RED = (255, 68, 68)
MUTED = (132, 155, 170)
WHITE = (232, 245, 255)

# Fonts
FONT_DIRS = [Path("C:/Windows/Fonts"), Path("/usr/share/fonts/truetype/dejavu")]
def font_file(names):
    for d in FONT_DIRS:
        for n in names:
            p = d / n
            if p.exists(): return str(p)
    return None
BOLD = font_file(["arialbd.ttf", "Arialbd.ttf", "DejaVuSans-Bold.ttf"])
REG = font_file(["arial.ttf", "Arial.ttf", "DejaVuSans.ttf"])
MONO = font_file(["consolab.ttf", "consola.ttf", "DejaVuSansMono.ttf"])
def F(size, bold=False, mono=False):
    path = MONO if mono else (BOLD if bold else REG)
    return ImageFont.truetype(path, size) if path else ImageFont.load_default()

def ease(t):
    t = max(0, min(1, t)); return t*t*(3-2*t)
def lerp(a,b,t): return a+(b-a)*t

def draw_bg(draw, im, t):
    # vertical gradient
    pix = im.load()
    for y in range(H):
        k = y/(H-1)
        r = int(lerp(BG1[0], BG2[0], k)); g = int(lerp(BG1[1], BG2[1], k)); b = int(lerp(BG1[2], BG2[2], k))
        draw.line([(0,y),(W,y)], fill=(r,g,b))
    # vignette / grid
    for x in range(0, W, 72): draw.line([(x,0),(x,H)], fill=(0,120,150,22), width=1)
    for y in range(0, H, 72): draw.line([(0,y),(W,y)], fill=(0,120,150,18), width=1)
    for y in range(0,H,6):
        if y % 12 == 0: draw.line([(0,y),(W,y)], fill=(0,0,0,35), width=1)
    # moving radar arcs
    cx, cy = W//2, int(H*0.42)
    for r in [240, 390, 540, 720]:
        col = (*CYAN, 30 if r != 540 else 50)
        draw.ellipse((cx-r,cy-r,cx+r,cy+r), outline=col, width=2)
    ang = (t*65)%360
    draw.arc((cx-620,cy-620,cx+620,cy+620), ang, ang+50, fill=(*CYAN,120), width=5)

def glow_text(base, xy, text, font, fill, anchor="mm", stroke=0):
    layer = Image.new("RGBA", base.size, (0,0,0,0)); d = ImageDraw.Draw(layer)
    for sw, alpha in [(16,45),(7,90)]:
        d.text(xy, text, font=font, fill=(*fill,alpha), anchor=anchor, stroke_width=stroke+sw, stroke_fill=(*fill,alpha//2))
    base.alpha_composite(layer.filter(ImageFilter.GaussianBlur(8)))
    d = ImageDraw.Draw(base)
    d.text(xy, text, font=font, fill=(*fill,255), anchor=anchor, stroke_width=stroke, stroke_fill=(0,0,0,180))

def text_center(draw, y, txt, size=40, color=WHITE, bold=False, spacing=0, mono=False):
    font = F(size,bold,mono); draw.text((W//2,y), txt, font=font, fill=color, anchor="mm")

def rect_panel(draw, box, outline=CYAN, fill=(255,255,255,10), w=2):
    # PIL ImageDraw in RGBA mode can replace pixels instead of compositing; pre-blend
    # translucent panel fills against the dark background so cards stay readable.
    if isinstance(fill, tuple) and len(fill) == 4:
        a = fill[3] / 255
        fill = tuple(int(BG2[j] * (1 - a) + fill[j] * a) for j in range(3)) + (255,)
    draw.rounded_rectangle(box, radius=18, fill=fill, outline=(*outline,180), width=w)

def paste_avatar(base, path, center, size, ring=CYAN, alpha=255):
    av = Image.open(path).convert("RGBA").resize((size,size), Image.Resampling.LANCZOS)
    mask = Image.new("L", (size,size), 0); md = ImageDraw.Draw(mask); md.ellipse((0,0,size-1,size-1), fill=alpha)
    # ring glow
    ring_layer = Image.new("RGBA", base.size, (0,0,0,0)); rd = ImageDraw.Draw(ring_layer)
    x,y=center; r=size//2
    for off,a in [(16,35),(6,105),(0,220)]:
        rd.ellipse((x-r-off,y-r-off,x+r+off,y+r+off), outline=(*ring,a), width=max(2, off//3+2))
    base.alpha_composite(ring_layer.filter(ImageFilter.GaussianBlur(3)))
    base.paste(av, (x-r,y-r), mask)

def draw_map(draw, ox, oy, scale=1.0):
    # stylized Malaysia tactical silhouette dots/polygons
    pts = [(120,80),(210,45),(320,70),(410,125),(500,100),(610,150),(675,245),(600,330),(470,300),(350,350),(230,300),(150,230)]
    pts = [(ox+int(x*scale), oy+int(y*scale)) for x,y in pts]
    draw.polygon(pts, fill=(0,160,190,35), outline=(*CYAN,160))
    borneo = [(ox+int((560+x)*scale), oy+int((430+y)*scale)) for x,y in [(0,60),(110,10),(260,40),(320,130),(250,230),(90,210),(-20,160)]]
    draw.polygon(borneo, fill=(245,178,44,35), outline=(*GOLD,150))
    for i in range(42):
        x = ox+random.randint(80,850); y=oy+random.randint(60,690)
        col = CYAN if i%3 else GOLD
        draw.ellipse((x-4,y-4,x+4,y+4), fill=(*col,150))

def scene_hook(im, draw, tt, t):
    glow_text(im, (W//2, 525), "MY", F(150, True), WHITE)
    glow_text(im, (W//2, 675), "MANDAT", F(142, True), GOLD)
    text_center(draw, 810, "MALAYSIAN POLITICAL CAMPAIGN SIMULATOR", 30, MUTED, True)
    text_center(draw, 1010, "PARLIAMENT DISSOLVED", 54, RED, True)
    text_center(draw, 1090, "27 DAYS. 222 SEATS. 1 MANDATE.", 36, WHITE, True)
    rect_panel(draw, (130,1285,950,1425), GOLD, (245,178,44,18), 3)
    text_center(draw, 1356, "CAN YOU WIN 112?", 56, GOLD, True)

def scene_leaders(im, draw, tt, t):
    text_center(draw, 190, "CHOOSE YOUR LEADER", 54, GOLD, True)
    text_center(draw, 250, "Build charisma, credibility and influence", 30, MUTED)
    paths = sorted((ROOT/"public"/"avatars").glob("leader-*.png"))[:5]
    pos = [(270,540),(810,540),(270,1050),(810,1050),(540,1370)]
    for i,(p,c) in enumerate(zip(paths,pos)):
        delay=i*0.08; a=ease((tt-delay)/0.55)
        if a>0.02:
            paste_avatar(im,p,c,max(8, int(250*a)), GOLD if i==3 else CYAN, int(255*a))
    for label,y in [("FORM YOUR WAR ROOM",1620),("EVERY AVATAR. EVERY CAMPAIGN. YOUR STRATEGY.",1690)]:
        text_center(draw, y, label, 38 if y==1620 else 26, WHITE if y==1620 else MUTED, y==1620)

def scene_map(im, draw, tt, t):
    text_center(draw, 170, "COMMAND MALAYSIA", 58, CYAN, True)
    draw_map(draw, 70, 320, 1.08)
    cards=[("PROJECTED", "89", "/112 SEATS", GOLD), ("SUPPORT", "48%", "NATIONAL", CYAN), ("FUNDS", "RM2.4M", "REMAINING", GREEN)]
    for i,(lab,val,sub,col) in enumerate(cards):
        x=95+i*315; rect_panel(draw,(x,1175,x+260,1360),col,(255,255,255,12),2)
        draw.text((x+130,1240),val,font=F(48,True),fill=col,anchor="mm")
        draw.text((x+130,1302),sub,font=F(22,False,True),fill=MUTED,anchor="mm")
        draw.text((x+130,1202),lab,font=F(20,True,True),fill=WHITE,anchor="mm")
    text_center(draw, 1540, "TARGET: 112 SEATS TO GOVERN", 42, GOLD, True)
    text_center(draw, 1600, "Live polling • state strategy • coalition math", 28, MUTED)

def scene_ops(im, draw, tt, t):
    text_center(draw, 180, "DEPLOY. RESPOND. SURVIVE.", 48, GOLD, True)
    ops=[("MEGA RALLY", "SELANGOR", "+6% SUPPORT", CYAN), ("MEDIA BLITZ", "KUALA LUMPUR", "+8% SENTIMENT", GOLD), ("GRASSROOTS", "JOHOR", "+4% GROUND", GREEN)]
    y=420
    for i,(name,loc,effect,col) in enumerate(ops):
        a=ease((tt-i*0.12)/0.5); x=int(90+(1-a)*-180)
        rect_panel(draw,(x,y+i*210,x+900,y+i*210+150),col,(255,255,255,13),3)
        draw.text((x+45,y+i*210+48),name,font=F(40,True),fill=WHITE,anchor="lm")
        draw.text((x+45,y+i*210+98),f"{loc} · {effect}",font=F(28,False,True),fill=col,anchor="lm")
        draw.text((x+790,y+i*210+75),"ACTIVE" if i==0 else "DEPLOY",font=F(24,True,True),fill=col,anchor="mm")
    # crisis card
    pulse = 0.55+0.45*math.sin(t*9)
    rect_panel(draw,(110,1190,970,1540),RED,(255,68,68,int(18+18*pulse)),4)
    text_center(draw, 1268, "CRISIS EVENT", 36, RED, True)
    text_center(draw, 1348, "VIRAL SOCIAL MEDIA SCANDAL", 42, WHITE, True)
    text_center(draw, 1430, "Deny, apologise, or counter-attack?", 30, MUTED)
    text_center(draw, 1665, "YOUR CHOICES CHANGE THE NATION", 34, GOLD, True)

def scene_cta(im, draw, tt, t):
    glow_text(im, (W//2, 510), "MY", F(138, True), WHITE)
    glow_text(im, (W//2, 650), "MANDAT", F(128, True), GOLD)
    text_center(draw, 805, "CAMPAIGN COMMAND SIMULATOR", 32, MUTED, True)
    feats=["14 STATES · 222 SEATS", "AI WAR ROOM", "POLLING & ANALYTICS", "CRISIS EVENTS", "COALITION-BUILDING"]
    for i,feat in enumerate(feats):
        rect_panel(draw,(190,970+i*92,890,1038+i*92),CYAN if i%2==0 else GOLD,(255,255,255,8),2)
        text_center(draw,1004+i*92,feat,27,WHITE,True,mono=True)
    rect_panel(draw,(190,1540,890,1668),GOLD,(245,178,44,230),0)
    draw.text((W//2,1605),"PLAY NOW",font=F(58,True),fill=(0,0,0),anchor="mm")
    text_center(draw, 1735, "FREE · BROWSER · NO DOWNLOAD", 30, GREEN, True)

scenes=[(0,1.8,scene_hook),(1.8,3.8,scene_leaders),(3.8,5.9,scene_map),(5.9,8.0,scene_ops),(8.0,10.0,scene_cta)]
random.seed(7)
for i in range(N):
    t=i/FPS
    im=Image.new("RGBA",(W,H),(0,0,0,255)); draw=ImageDraw.Draw(im,"RGBA")
    draw_bg(draw, im, t)
    # corners and frame
    draw.rounded_rectangle((42,42,W-42,H-42), radius=28, outline=(*CYAN,95), width=2)
    for x,y,sx,sy in [(62,62,1,1),(W-62,62,-1,1),(62,H-62,1,-1),(W-62,H-62,-1,-1)]:
        draw.line((x,y,x+sx*90,y), fill=(*CYAN,160), width=5); draw.line((x,y,x,y+sy*90), fill=(*CYAN,160), width=5)
    for start,end,fn in scenes:
        if start <= t < end:
            fn(im, draw, (t-start)/(end-start), t)
            break
    # bottom progress
    draw.rectangle((42,H-70,W-42,H-62), fill=(0,120,150,45))
    draw.rectangle((42,H-70,42+int((W-84)*(t/DUR)),H-62), fill=(*GOLD,230))
    im.convert("RGB").save(OUTDIR / f"frame_{i:04d}.png", quality=92)

# Audio: simple cinematic pulse, 44.1kHz mono WAV
sr=44100; samples=int(sr*DUR); wav_path=ROOT/"promo_10s_audio.wav"
with wave.open(str(wav_path),'w') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(sr)
    for n in range(samples):
        t=n/sr
        # bass pulse every half second + rising synth
        beat=(t*2)%1
        env=math.exp(-beat*8)
        bass=math.sin(2*math.pi*(58+20*math.exp(-beat*10))*t)*0.48*env
        rise=math.sin(2*math.pi*(180+35*t)*t)*0.08*(t/DUR)
        tick=0.22*math.sin(2*math.pi*1200*t)*math.exp(-((beat)/0.035)**2) if beat<0.08 else 0
        val=max(-1,min(1,bass+rise+tick))
        w.writeframes(struct.pack('<h', int(val*32767)))

out=ROOT/"my_mandat_10s_promo.mp4"
cmd=["ffmpeg","-y","-framerate",str(FPS),"-i",str(OUTDIR/"frame_%04d.png"),"-i",str(wav_path),"-c:v","libx264","-pix_fmt","yuv420p","-r",str(FPS),"-c:a","aac","-b:a","128k","-shortest","-movflags","+faststart",str(out)]
subprocess.run(cmd, check=True)
print(out)
