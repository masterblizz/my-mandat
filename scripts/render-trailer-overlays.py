from PIL import Image, ImageDraw, ImageFont, ImageFilter
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CAP = ROOT / 'public' / 'trailer-captures'
OUT = ROOT / 'public' / 'trailer-frames'
OUT.mkdir(parents=True, exist_ok=True)

font_candidates = [
    Path('C:/Windows/Fonts/arialbd.ttf'),
    Path('C:/Windows/Fonts/arial.ttf'),
    Path('C:/Windows/Fonts/segoeuib.ttf'),
]
font_path = next((p for p in font_candidates if p.exists()), None)
if not font_path:
    raise SystemExit('No Windows font found')

def font(size, bold=False):
    p = Path('C:/Windows/Fonts/arialbd.ttf') if bold and Path('C:/Windows/Fonts/arialbd.ttf').exists() else font_path
    return ImageFont.truetype(str(p), size)

scenes = [
    ('01-menu.png', 'MY MANDAT', 'SIMULASI PILIHAN RAYA MALAYSIA'),
    ('02-setup.png', 'BINA GERAKAN', 'PILIH IDEOLOGI. TETAPKAN STRATEGI KEMPEN.'),
    ('03-warroom.png', 'WAR ROOM ONLINE', 'BACA PETA. KUASAI NARATIF.'),
    ('04-campaign-nomination.png', 'HARI PENAMAAN CALON', '247 CALON. SATU JALAN KE PUTRAJAYA.'),
    ('05-polling.png', 'JEJAK PERUBAHAN UNDI', 'POLLING. MOMENTUM. TEKANAN NEGERI.'),
    ('06-calendar.png', '14 HARI BERKEMPEN', 'CERAMAH. MEDIA SOSIAL. STRATEGI AKHIR.'),
    ('07-results.png', 'MALAM KEPUTUSAN', 'KERUSI DEMI KERUSI. CUKUP MAJORITI?'),
    ('08-stats.png', 'MANDAT DI TANGAN ANDA', 'MENANGKAN PRU. BENTUK KERAJAAN.'),
]

W, H = 1920, 1080
for idx, (file, title, subtitle) in enumerate(scenes, start=1):
    img = Image.open(CAP / file).convert('RGB')
    img = img.resize((W, H), Image.Resampling.LANCZOS)
    base = img.convert('RGBA')

    # Tactical grade / vignette
    overlay = Image.new('RGBA', (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)
    d.rectangle((0, 0, W, H), fill=(0, 0, 0, 32))
    d.rectangle((0, 0, W, 115), fill=(0, 0, 0, 118))
    d.rectangle((0, H-145, W, H), fill=(0, 0, 0, 152))
    d.rectangle((60, 60, W-60, H-60), outline=(0, 212, 255, 80), width=2)
    d.rectangle((88, 88, W-88, H-88), outline=(255, 178, 44, 42), width=1)

    # soft vignette
    vignette = Image.new('L', (W, H), 0)
    vd = ImageDraw.Draw(vignette)
    vd.ellipse((-260, -170, W+260, H+220), fill=185)
    vignette = vignette.filter(ImageFilter.GaussianBlur(90))
    dark = Image.new('RGBA', (W, H), (0, 0, 0, 125))
    overlay = Image.composite(overlay, Image.alpha_composite(overlay, dark), Image.eval(vignette, lambda p: 255-p))

    base = Image.alpha_composite(base, overlay)
    d = ImageDraw.Draw(base)

    # Top HUD labels use only in-game wording.
    hud_font = font(25, True)
    d.text((72, 42), 'MY MANDAT // PILIHAN RAYA UMUM', font=hud_font, fill=(255, 211, 138, 255), stroke_width=2, stroke_fill=(0,0,0,190))
    right = 'SIMULASI STRATEGI POLITIK'
    rb = d.textbbox((0,0), right, font=font(22, True))
    d.text((W - (rb[2]-rb[0]) - 72, 44), right, font=font(22, True), fill=(0, 212, 255, 255), stroke_width=2, stroke_fill=(0,0,0,190))

    # Lower title plate
    title_font = font(68, True)
    sub_font = font(30, True)
    tb = d.textbbox((0,0), title, font=title_font)
    sb = d.textbbox((0,0), subtitle, font=sub_font)
    tx = (W - (tb[2]-tb[0])) // 2
    sx = (W - (sb[2]-sb[0])) // 2
    plate_w = max(tb[2]-tb[0], sb[2]-sb[0]) + 96
    px = (W - plate_w) // 2
    d.rounded_rectangle((px, 772, px+plate_w, 940), radius=8, fill=(0,0,0,145), outline=(0,212,255,90), width=1)
    d.text((tx, 792), title, font=title_font, fill=(255,255,255,255), stroke_width=2, stroke_fill=(0,76,104,230))
    d.text((sx, 884), subtitle, font=sub_font, fill=(158,234,255,255), stroke_width=2, stroke_fill=(0,0,0,210))

    # tiny progress blocks
    for p in range(len(scenes)):
        x = W//2 - 112 + p*32
        color = (255,178,44,220) if p < idx else (0,212,255,70)
        d.rectangle((x, 985, x+18, 989), fill=color)

    out = OUT / f'scene_{idx:02d}.png'
    base.convert('RGB').save(out, quality=95)
    print(out)
