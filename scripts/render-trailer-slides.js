const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const outDir = path.join(root, 'public', 'trailers', 'mymandat');
const screenDir = path.join(outDir, 'screens');
const slideDir = path.join(outDir, 'slides');
fs.mkdirSync(slideDir, { recursive: true });

const slides = [
  { id: '00-intro', kicker: 'MALAYSIAN POLITICAL STRATEGY GAME', title: 'MY MANDAT', subtitle: 'Menang pilihan raya cuma permulaan.', route: '', bg: null },
  { id: '01-results', kicker: 'ELECTION NIGHT', title: 'Malam Keputusan', subtitle: 'Seat demi seat menentukan mandat rakyat.', bg: '01-results.png' },
  { id: '02-mandate', kicker: 'MANDATE STATUS', title: 'Sahkan Mandat', subtitle: 'Majoriti jelas, hung parliament, pembangkang atau rebuild.', bg: '02-mandate.png' },
  { id: '03-formation', kicker: 'POWER TRANSITION', title: 'Runding Kuasa', subtitle: 'Istana, koalisi dan confidence check sebelum kerajaan terbentuk.', bg: '03-formation.png' },
  { id: '04-cabinet', kicker: 'CABINET WAR ROOM', title: 'Bentuk Kabinet', subtitle: 'Setiap menteri ada score, portfolio dan kesan pemerintahan.', bg: '04-cabinet.png' },
  { id: '05-swearing', kicker: 'NEW GOVERNMENT', title: 'Angkat Sumpah', subtitle: 'War Room dikunci. Cabaran sebenar bermula.', bg: '05-swearing.png' },
  { id: '06-government', kicker: 'FIRST 100 DAYS', title: 'Memerintah Negara', subtitle: 'Dasar, krisis, approval, trust dan kestabilan koalisi.', bg: '06-government.png' },
  { id: '07-career', kicker: 'MULTI-TERM CAREER', title: 'Urus Penggal', subtitle: 'Masa bergerak bulanan menuju PRU seterusnya.', bg: '07-career.png' },
  { id: '08-sandbox', kicker: 'NATIONAL SANDBOX', title: 'Simulasi Malaysia', subtitle: 'Ekonomi, federalisme, parlimen, institusi dan legasi.', bg: '08-sandbox.png' },
  { id: '09-outro', kicker: 'BUILD POWER. GOVERN. SURVIVE.', title: 'MANDAT RAKYAT', subtitle: 'Dari kempen ke kabinet. Dari kerajaan ke legasi.', route: '', bg: null },
];

function fileUrl(file) {
  return 'file:///' + file.replace(/\\/g, '/').replace(/^([A-Za-z]):/, '$1:');
}

function htmlFor(slide, index) {
  const bgUrl = slide.bg ? fileUrl(path.join(screenDir, slide.bg)) : '';
  const progress = Math.round(((index + 1) / slides.length) * 100);
  const bgStyle = slide.bg
    ? `background-image: linear-gradient(90deg, rgba(2,8,16,.96) 0%, rgba(2,8,16,.62) 28%, rgba(2,8,16,.10) 58%, rgba(2,8,16,.30) 100%), url('${bgUrl}');`
    : `background-image: radial-gradient(circle at 22% 18%, rgba(0,212,255,.25), transparent 30%), radial-gradient(circle at 78% 78%, rgba(255,196,87,.20), transparent 34%), linear-gradient(135deg, #030812, #07111d 48%, #02050b);`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @font-face{font-family:SpaceMono;src:local('Consolas');}
    *{box-sizing:border-box} body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#030812;color:#fff;font-family:SpaceMono,Consolas,monospace;}
    .stage{position:relative;width:1920px;height:1080px;${bgStyle}background-size:cover;background-position:center;}
    .stage:before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(0deg, rgba(255,255,255,.035), rgba(255,255,255,.035) 1px, transparent 1px, transparent 6px);mix-blend-mode:screen;opacity:.36;}
    .stage:after{content:"";position:absolute;inset:28px;border:1px solid rgba(0,212,255,.35);box-shadow:0 0 36px rgba(0,212,255,.12) inset, 0 0 32px rgba(255,196,87,.08);}
    .brand{position:absolute;top:52px;left:72px;color:#00d4ff;font-weight:900;letter-spacing:.28em;font-size:24px;text-shadow:0 0 18px rgba(0,212,255,.45)}
    .tag{position:absolute;top:88px;left:72px;color:rgba(255,255,255,.55);letter-spacing:.22em;font-size:15px}
    .panel{position:absolute;left:72px;bottom:92px;width:920px;padding:38px 44px;border-left:5px solid #ffc457;background:linear-gradient(90deg, rgba(3,8,18,.88), rgba(3,8,18,.58), rgba(3,8,18,.05));box-shadow:0 0 45px rgba(0,0,0,.35)}
    .kicker{color:#ffc457;letter-spacing:.24em;font-size:20px;font-weight:900;text-transform:uppercase;margin-bottom:20px;}
    .title{font-size:${slide.title.length > 14 ? 74 : 92}px;line-height:.96;font-weight:1000;letter-spacing:.02em;text-transform:uppercase;text-shadow:0 0 28px rgba(0,212,255,.22)}
    .subtitle{margin-top:24px;color:rgba(255,255,255,.80);font-size:28px;line-height:1.35;max-width:820px;}
    .real{position:absolute;right:72px;top:55px;color:#ffc457;border:1px solid rgba(255,196,87,.5);padding:10px 16px;font-size:14px;letter-spacing:.18em;background:rgba(255,196,87,.08)}
    .route{position:absolute;right:72px;bottom:92px;color:rgba(255,255,255,.6);font-size:18px;letter-spacing:.18em;text-transform:uppercase;}
    .bar{position:absolute;left:72px;right:72px;bottom:56px;height:4px;background:rgba(255,255,255,.11)}
    .bar span{display:block;height:100%;width:${progress}%;background:linear-gradient(90deg,#00d4ff,#ffc457);box-shadow:0 0 16px rgba(255,196,87,.45)}
    .ticks{position:absolute;right:72px;bottom:120px;display:flex;gap:10px}.ticks i{width:38px;height:5px;background:rgba(255,255,255,.16)}.ticks i.on{background:#ffc457;box-shadow:0 0 14px rgba(255,196,87,.55)}
  </style></head><body><div class="stage"><div class="brand">MY MANDAT</div><div class="tag">POLITICAL CAREER SIMULATOR</div><div class="real">REAL GAME UI CAPTURE</div><div class="panel"><div class="kicker">${slide.kicker}</div><div class="title">${slide.title}</div><div class="subtitle">${slide.subtitle}</div></div><div class="route">${slide.bg ? '/'+slide.id.slice(3) : 'MYMANDAT.WEB'}</div><div class="ticks">${slides.map((_,i)=>`<i class="${i<=index?'on':''}"></i>`).join('')}</div><div class="bar"><span></span></div></div></body></html>`;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 });
  const manifest = [];
  for (let i = 0; i < slides.length; i++) {
    await page.setContent(htmlFor(slides[i], i), { waitUntil: 'load' });
    await page.waitForTimeout(250);
    const file = path.join(slideDir, `${String(i).padStart(2,'0')}-${slides[i].id}.png`);
    await page.screenshot({ path: file, fullPage: false });
    manifest.push({ ...slides[i], file: path.relative(root, file).replace(/\\/g, '/') });
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir, 'slides-manifest.json'), JSON.stringify(manifest, null, 2));
  console.log(JSON.stringify(manifest, null, 2));
})();
