const { chromium } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const root = process.cwd();
const outDir = path.join(root, 'public', 'trailers', 'mymandat-v2');
const sourceScreenDir = path.join(root, 'public', 'trailers', 'mymandat', 'screens');
const slideDir = path.join(outDir, 'slides');
fs.mkdirSync(slideDir, { recursive: true });

const slides = [
  { id: '00-hook', kicker: 'BUKAN SEKADAR PILIHAN RAYA', title: 'MENANG PRU', subtitle: '...cuma permulaan kuasa.', bg: null, punch: true },
  { id: '01-results', kicker: 'MALAM KEPUTUSAN', title: 'MANDAT RAKYAT', subtitle: '222 kerusi. Satu peluang bentuk kerajaan.', bg: '01-results.png' },
  { id: '02-mandate', kicker: 'STATUS MANDAT', title: 'SAHKAN KUASA', subtitle: 'Majoriti jelas, parlimen tergantung, atau pembangkang.', bg: '02-mandate.png' },
  { id: '03-formation', kicker: 'ISTANA · KOALISI · CONFIDENCE', title: 'RUNDING KUASA', subtitle: 'Cukupkan majoriti sebelum kerajaan diperkenan.', bg: '03-formation.png' },
  { id: '04-cabinet', kicker: 'WAR ROOM KABINET', title: 'PILIH MENTERI', subtitle: 'Setiap portfolio mengubah ekonomi, trust dan risiko.', bg: '04-cabinet.png' },
  { id: '05-swearing', kicker: 'ANGKAT SUMPAH', title: 'KERAJAAN RASMI', subtitle: 'War Room dikunci. Musim memerintah bermula.', bg: '05-swearing.png' },
  { id: '06-government', kicker: '100 HARI PERTAMA', title: 'URUS KRISIS', subtitle: 'Dasar, approval, koalisi dan tekanan media.', bg: '06-government.png' },
  { id: '07-career', kicker: 'BULAN DEMI BULAN', title: 'BINA LEGASI', subtitle: 'PRN, PRK, faction parti dan PRU seterusnya.', bg: '07-career.png' },
  { id: '08-sandbox', kicker: 'SIMULASI NEGARA', title: 'MALAYSIA BERUBAH', subtitle: 'Ekonomi, federalisme, parlimen dan institusi.', bg: '08-sandbox.png' },
  { id: '09-outro', kicker: 'MY MANDAT', title: 'KUASA BUKAN TAMAT DI PETI UNDI', subtitle: 'Kempen. Menang. Bentuk kerajaan. Bertahan.', bg: null, punch: true },
];

function fileUrl(file) {
  return 'file:///' + file.replace(/\\/g, '/').replace(/^([A-Za-z]):/, '$1:');
}

function htmlFor(slide, index) {
  const bgUrl = slide.bg ? fileUrl(path.join(sourceScreenDir, slide.bg)) : '';
  const bgStyle = slide.bg
    ? `background-image: linear-gradient(90deg, rgba(0,4,12,.70) 0%, rgba(0,4,12,.40) 30%, rgba(0,4,12,.16) 70%, rgba(0,4,12,.20) 100%), url('${bgUrl}');`
    : `background-image: radial-gradient(circle at 18% 28%, rgba(0,212,255,.30), transparent 28%), radial-gradient(circle at 80% 72%, rgba(255,196,87,.24), transparent 34%), linear-gradient(130deg, #02050b, #081523 48%, #010205);`;
  const shotMarkup = slide.bg ? `<div class="shot" style="background-image:url('${bgUrl}')"></div>` : '';
  const progress = Math.round(((index + 1) / slides.length) * 100);
  const titleSize = slide.title.length > 20 ? 70 : slide.title.length > 14 ? 82 : 98;
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    *{box-sizing:border-box} body{margin:0;width:1920px;height:1080px;overflow:hidden;background:#02050b;color:white;font-family:Consolas,'Courier New',monospace;}
    .stage{position:relative;width:1920px;height:1080px;${bgStyle}background-size:cover;background-position:center;}
    .stage:before{content:"";position:absolute;inset:0;background:repeating-linear-gradient(0deg, rgba(255,255,255,.030), rgba(255,255,255,.030) 1px, transparent 1px, transparent 5px);opacity:.45;mix-blend-mode:screen;}
    .stage:after{content:"";position:absolute;inset:26px;border:1px solid rgba(0,212,255,.34);box-shadow:0 0 40px rgba(0,212,255,.12) inset,0 0 65px rgba(255,196,87,.10) inset;}
    .corner{position:absolute;width:90px;height:90px;border-color:#ffc457}.tl{top:42px;left:42px;border-top:4px solid;border-left:4px solid}.br{right:42px;bottom:42px;border-right:4px solid;border-bottom:4px solid}
    .brand{position:absolute;top:54px;left:76px;font-size:24px;font-weight:900;letter-spacing:.32em;color:#00d4ff;text-shadow:0 0 22px rgba(0,212,255,.75)}
    .live{position:absolute;top:54px;right:76px;padding:10px 18px;border:1px solid rgba(255,196,87,.58);color:#ffc457;background:rgba(255,196,87,.10);font-size:14px;font-weight:900;letter-spacing:.20em}
    .panel{position:absolute;left:76px;bottom:92px;width:${slide.punch ? 1180 : 980}px;padding:42px 48px;border-left:6px solid #ffc457;background:linear-gradient(90deg, rgba(2,7,16,.92), rgba(2,7,16,.66), rgba(2,7,16,.08));box-shadow:0 0 55px rgba(0,0,0,.45)}
    .shot{position:absolute;right:76px;top:170px;width:860px;height:484px;background-size:cover;background-position:center;border:1px solid rgba(0,212,255,.44);box-shadow:0 0 42px rgba(0,212,255,.18),0 24px 80px rgba(0,0,0,.55);transform:perspective(1000px) rotateY(-4deg);}
    .shot:after{content:"REAL UI";position:absolute;top:14px;right:16px;color:#ffc457;font-size:13px;font-weight:900;letter-spacing:.18em;background:rgba(0,0,0,.6);padding:6px 10px;border:1px solid rgba(255,196,87,.35)}
    .kicker{font-size:22px;font-weight:900;letter-spacing:.25em;color:#ffc457;text-transform:uppercase;margin-bottom:16px;text-shadow:0 0 18px rgba(255,196,87,.35)}
    .title{font-size:${titleSize}px;font-weight:1000;line-height:.92;letter-spacing:.01em;text-transform:uppercase;text-shadow:0 0 32px rgba(0,212,255,.28),0 0 4px rgba(0,0,0,.9)}
    .subtitle{margin-top:24px;max-width:950px;font-size:30px;line-height:1.28;color:rgba(255,255,255,.84);text-shadow:0 0 3px black}
    .count{position:absolute;right:76px;bottom:112px;font-size:58px;font-weight:1000;color:rgba(255,255,255,.13);letter-spacing:-.05em}
    .route{position:absolute;right:76px;bottom:84px;font-size:15px;font-weight:900;letter-spacing:.22em;color:rgba(255,255,255,.46)}
    .bar{position:absolute;left:76px;right:76px;bottom:54px;height:5px;background:rgba(255,255,255,.12)} .bar span{display:block;width:${progress}%;height:100%;background:linear-gradient(90deg,#00d4ff,#ffc457);box-shadow:0 0 20px rgba(255,196,87,.55)}
    .flash{position:absolute;inset:0;background:linear-gradient(120deg,transparent,rgba(255,196,87,.10),transparent);transform:skewX(-18deg) translateX(${index % 2 ? '36%' : '-20%'});opacity:.55;}
  </style></head><body><div class="stage"><div class="corner tl"></div><div class="corner br"></div><div class="flash"></div>${shotMarkup}<div class="brand">MY MANDAT</div><div class="live">REAL GAME UI</div><div class="panel"><div class="kicker">${slide.kicker}</div><div class="title">${slide.title}</div><div class="subtitle">${slide.subtitle}</div></div><div class="count">${String(index+1).padStart(2,'0')}</div><div class="route">${slide.bg ? '/'+slide.id.slice(3).toUpperCase() : 'TRAILER'}</div><div class="bar"><span></span></div></div></body></html>`;
}

(async()=>{
  const browser=await chromium.launch({headless:true});
  const page=await browser.newPage({viewport:{width:1920,height:1080}, deviceScaleFactor:1});
  for (let i=0;i<slides.length;i++) {
    await page.setContent(htmlFor(slides[i], i), {waitUntil:'load'});
    await page.waitForTimeout(250);
    await page.screenshot({path:path.join(slideDir, `${String(i).padStart(2,'0')}-${slides[i].id}.png`), fullPage:false});
  }
  await browser.close();
  fs.writeFileSync(path.join(outDir,'slides.json'), JSON.stringify(slides,null,2));
  console.log(`rendered ${slides.length} slides to ${slideDir}`);
})();
