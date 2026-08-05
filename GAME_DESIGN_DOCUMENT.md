# MY MANDAT — GAME DESIGN DOCUMENT

**Disediakan oleh:** Game Director / Game Designer pass (AI-assisted audit)
**Tarikh:** 2026-08-03
**Kaedah:** Full codebase scan — setiap fakta dalam dokumen ini datang dari kod sebenar (`app/`, `docs/`, `package.json`, git log), bukan andaian generik. Item yang tidak boleh disahkan daripada kod ditanda `[PERLU INPUT SAYA]`.

> Nota versi: `GAME_DESIGN.md` dan `BUILD_PROGRESS.md` sedia ada dalam root project ini masih berguna sebagai log teknikal/sejarah, tetapi kedua-duanya tertinggal beberapa fasa di belakang kod semasa (contoh: tiada sebutan `/cabinet`, `/government`, `/career`, `/kawasan`, `/sandbox`). Dokumen ini (`GAME_DESIGN_DOCUMENT.md`) adalah rujukan **paling terkini** dan patut jadi sumber utama untuk sesi AI akan datang.

---

## 1. OVERVIEW & CONCEPT

| Item | Detail |
|---|---|
| Nama | **MY MANDAT** |
| Genre | Political campaign strategy simulator + post-election government management sim, dengan modul city-builder ringan (kawasan) |
| Platform semasa | Web browser (Next.js 14 app, client-heavy, `localStorage`-based saves — tiada backend/DB) |
| Platform sasaran lain | Belum ditentukan — layout guna fixed-width panel + `xl:` Tailwind breakpoints yang mengandaikan skrin desktop/laptop. Tiada bukti mobile-responsive design dalam kod. `[PERLU INPUT SAYA]` — adakah mobile/tablet jadi sasaran rasmi? |
| Engine/Stack | Next.js 14 + React 18 + TypeScript, Zustand (state), Framer Motion (animasi), Tailwind (styling), Recharts (chart), react-simple-maps + custom SVG (peta), Anthropic Claude API (AI advisor) |
| Bahasa | Bilingual penuh BM/EN (`useLang()` + `t(lang, ms, en)` di hampir setiap baris teks — bukan lapisan terjemahan tempelan) |

### Premis
Pemain memimpin sebuah parti politik Malaysia melalui satu pilihan raya penuh — sama ada **PRU** (Pilihan Raya Umum, peringkat Parlimen Persekutuan, 222 kerusi, majoriti 112) atau **PRN** (Pilihan Raya Negeri, peringkat DUN sesebuah negeri sahaja, majoriti berbeza ikut negeri). Selepas keputusan, permainan **tidak tamat** — ia menyambung terus ke pembentukan kerajaan/kabinet, memerintah 100 hari pertama, kerjaya politik berbilang penggal (sehingga 60 bulan setiap penggal), dan sandbox simulasi negara jangka panjang. Jika pemain kalah, cerita bercabang ke mod Pembangkang (comeback) atau Post-Mortem Parti (pembinaan semula) — kedua-duanya turut menyambung ke fasa kerjaya, bukan skrin "Game Over".

### Unique Selling Point (USP)
1. **Lifecycle penuh, bukan setakat "menang/kalah".** Kebanyakan election sim (The Political Machine, Democracy series) berhenti di skrin keputusan. MY MANDAT menyambung ke pembentukan kabinet → 100 hari pertama → kerjaya berbilang penggal → sandbox dasar negara — satu kesinambungan storyline yang jarang wujud dalam genre ini.
2. **Ketepatan civics Malaysia yang dalam.** Bukan sekadar "election game bertema Malaysia" — kod membezakan dengan tepat: PRU vs PRN, kiraan kerusi Parlimen (222) vs DUN per negeri (contoh Sarawak 82 DUN, WP 0 DUN kerana tiada dewan negeri), negeri Raja (guna Menteri Besar + Istana) vs negeri Yang di-Pertua Negeri (guna Ketua Menteri + Governor's Office), isu MA63/Borneo kingmaker, dan togol dataset parti fiksyen vs nama parti sebenar Malaysia (dengan disclaimer angka adalah simulasi).
3. **Opponent AI bernarasi, bukan hanya RNG.** `opponentAI.ts` menjana lapan jenis tindakan lawan (pressure, scandal, counter-narrative, manifesto attack, candidate poaching, coalition formation, viral social, media blitz) yang bertindak balas kepada corak main pemain sendiri (contoh: abai Borneo 8 hari → lawan "reclaim" naratif Borneo).
4. **AI Advisor sebenar** (`/api/advisor`, model Claude) yang dibekalkan snapshot state kempen sebenar setiap giliran — bukan chatbot generik — dengan fallback rule-based bila tiada API key.
5. **Sistem pembangunan kawasan pasca-menang** (`/kawasan`) — bandar CSS-3D yang tumbuh secara visual (bangunan bertambah tinggi/banyak) apabila projek infrastruktur diluluskan, dengan wajah kawasan (pantai/jelapang padi/berbukit/perindustrian) diterbitkan daripada nama kawasan sebenar.

### Target Audience
- Peminat politik Malaysia dan penonton wacana PRU/PRN.
- Peminat strategy/management sim yang sudah biasa dengan Democracy series, The Political Machine, Football Manager-style deep sim (banyak nombor, banyak bacaan, tempoh sesi panjang).
- Tahap "hardcore": sederhana-tinggi. UI padat dengan data (support %, seat projection, faction loyalty, dsb.), memerlukan pemain selesa membaca jadual dan meter berbilang.
`[PERLU INPUT SAYA]` — demografik umur/pasaran rasmi (Malaysia sahaja / rantau SEA / diaspora?), dan sama ada sasaran memang solo/niche atau memang mahu ditingkat jadi produk komersial meluas.

---

## 2. CORE GAMEPLAY LOOP

### Loop utama (peringkat kempen)
```
Setup (dataset → avatar/party → campaign settings → difficulty → confirm)
   → War Room (peta negara, sentimen, resource, NEXT DAY)
   → Nomination (pilih calon ahli parti utk kerusi) + Mini-Games (ceramah/social) + Operations (deploy jentera)
   → NEXT DAY (electionEngine.processDay — event, opponent AI, drain resource)
   → ulang sehingga Hari 30
   → Results (keputusan seat-demi-seat)
```
### Loop pasca-keputusan (meta-game)
```
Results → Mandate (semak status: majority / hung / opposition / collapse)
   ├─ majority/hung (menang cukup) → Formation (runding koalisi) → Cabinet/EXCO → Swearing-in → Government (100 hari: dasar + krisis)
   │      → Career (kerjaya berbilang penggal, 60 bulan/penggal) → Sandbox (simulasi dasar negara jangka panjang)
   ├─ opposition (kalah tapi kuat) → Opposition (bina comeback) → Career
   └─ collapse (kalah teruk) → Postmortem (bina semula parti) → Career
(bonus) Menang kerusi sendiri → Elected (sijil kemenangan peribadi) → Kawasan (bangunkan kawasan 3D)
```
Pemain **tidak pernah** sampai ke skrin "Game Over" — setiap cawangan (menang besar, hung parliament, jadi pembangkang, kalah teruk) menyambung ke fasa kerjaya yang sama, hanya dengan naratif berbeza.

### Session length
- Satu pusingan kempen (Hari 1–30, klik NEXT DAY berulang) — dianggarkan beberapa minit setiap sesi bermain aktif; QA log automatik merekodkan 29 klik NEXT DAY untuk satu playthrough penuh.
- Satu playthrough penuh (setup → hasil → mandat → kabinet → swearing-in → government → career → sandbox) telah disahkan boleh selesai dalam satu sesi (`docs/QA_REPORT.md`, Phase B).
`[PERLU INPUT SAYA]` — sasaran designed session length rasmi (contoh: "15 min quick play" vs "60 min deep run") belum ditetapkan secara eksplisit dalam kod.

### Progression system
Tiada sistem level/XP klasik. Kemajuan dirasai melalui **berbilang meter selari**:
- Support % (MANDAT/LAWAN/OTHERS) dan projected seats per negeri
- Cabinet/EXCO grade (F → A+, dikira daripada `scoreAssignment`)
- Governing Index: Approval, Trust, Coalition Stability, Fiscal Space (fasa Government)
- Legacy Score, Faction Control, Party Machinery, Next-GE Readiness (fasa Career)
- National Stability Index (fasa Sandbox, 5 sub-metrik: Economy/Federal-State/Parliament/Institution/International)
- Comeback Index (Opposition) / Survival Score (Postmortem)
- Zone stats (Infra/Welfare/Economy/Sentiment) di `/kawasan`

### Win/Lose condition
Bukan binari. `computeElectionOutcome()` mengira 4 status mandat berdasarkan ambang kerusi:
| Status | Ambang (PRU) | Storyline |
|---|---|---|
| `majority` | ≥112/222 | Formation → Cabinet terus |
| `hung` | ≥89 tapi <112 | Formation (rundingan koalisi wajib) |
| `opposition` | ≥40 tapi <89 | Mod Pembangkang (comeback) |
| `collapse` | <40 | Post-Mortem (bina semula parti) |

Ambang PRN dikira relatif (`hungThreshold = 40% jumlah kerusi negeri`, `oppositionThreshold = 18%`) supaya adil merentasi negeri kecil (Perlis, 18 DUN) dan besar (Sarawak, 82 DUN).

Permainan direka **open-ended**: fasa Career membenarkan berbilang penggal (60 bulan setiap penggal) dan "MULA KITARAN PRU BARU" tanpa had.

---

## 3. GAME SYSTEMS

### 3.1 Sistem Funds / Economy
- Modal permulaan: **RM 2,300,000** funds, 632 manpower, 312 vehicles, 680 materials, 540 media buy (`gameStore.ts` default `resources`).
- Perbelanjaan: Operations (deploy jentera — `fundsCost`/`manpowerCost` per operation), Mini-games ceramah (RM75k) / social (RM45k) + kos media buy, Nomination decision (RM25k–55k ikut jenis calon).
- Drain harian: `electionEngine.processDay` tolak `fundsCost/totalDays` dan `manpowerCost/(totalDays*10)` daripada operasi aktif setiap hari.
- Fasa Government: setiap dasar 100-hari ada `cost` (RM60k–760k) yang ditolak daripada "fiscal space", bukan funds kempen terus.
- Fasa Sandbox: enam "national policy lever" (RM120k–760k) menukar Economy/Federal/Parliament/Institution/International index, dengan `fiscalStress` menghukum overspend.

### 3.2 Sistem Sentiment / Reputation
- Per-negeri: `mandatSupport`/`lawanSupport`/`othersSupport` (peratus, clamp 8–82), `winProbability`, `trend`, `swingProbability`, status `winning/losing/contested`.
- Kebangsaan: `mediaSentiment` (positive/neutral/negative, dikira daripada weighted seat delta), `nationalSupportDelta`.
- **Political Reactions** (`politicalReactions.ts`): setiap tindakan pemain (nomination, mini-game, cabinet appointment, candidate fallout) menjana satu "berita" bilingual lengkap dengan headline, opponent attack line, social media reaction, advisor warning, dan senarai kesan bernombor (contoh "Grassroots enthusiasm +3", "Media crisis +2"). Disimpan (maks 30) dalam `localStorage` (`mymandat-political-reactions`).
- **Opponent AI** (`opponentAI.ts`) — lawan (LAWAN) bertindak balas secara dinamik: menyasarkan negeri yang diabaikan pemain, memancing (poach) calon di negeri marginal, melancarkan counter-narrative jika pemain terlalu digital-heavy/ceramah-heavy/abai Borneo, skandal, manifesto attack, viral social flood, pembentukan koalisi kecil, media blitz lewat kempen. Magnitud dikawal oleh `oppositionStrength` (setting) × faktor kesukaran (`easy 0.45× … nightmare 1.55×`).
- Fasa Government/Career: Approval, Trust, Coalition Stability metrik berasingan yang dipengaruhi dasar dipilih + respons krisis.

### 3.3 Sistem Zone & Development (`/kawasan`)
- Dikunci sehingga pemain **menang kerusi sendiri** (`hasWonElection`, di-set di `/elected`).
- Setiap kawasan Parlimen/DUN menjana 9 zon (Pusat Bandar, Kampung Utama, Taman Perumahan, Pusat Niaga, Zon Sekolah, Kawasan Industri, Pinggir Sungai, Pasar & Penjaja, Klinik/Dewan) — jenis zon disesuaikan mengikut ciri kawasan sebenar (nama mengandungi "pantai/teluk" → kampung nelayan; negeri padi Kedah/Perlis/Kelantan → kampung sawah; nama perindustrian → zon industri berat).
- 3 stat setiap zon: **Infra, Welfare, Economy** (+ `sentiment` = purata ketiga-tiga).
- **12 projek pembangunan** boleh dibina per zon, contoh:

| Projek | Kos (RM) | Sasaran | Boost | Prasyarat |
|---|---:|---|---:|---|
| Naik Taraf Jalan & Lampu | 180,000 | Infra | +12 | – |
| Klinik Komuniti Bergerak | 220,000 | Welfare | +14 | – |
| Internet Kawasan & WiFi | 260,000 | Economy | +13 | – |
| Tebatan Banjir Mikro | 300,000 | Infra | +16 | – |
| Geran Pasar & Penjaja | 150,000 | Economy | +10 | – |
| Baik Pulih Sekolah/Dewan | 200,000 | Welfare | +11 | – |
| Taman Rekreasi Rakyat | 170,000 | Welfare | +9 | Infra ≥ 55 |
| Bas Komuniti & Hentian | 240,000 | Infra | +13 | Projek "Jalan" siap |
| Pusat Beli-Belah | 400,000 | Economy | +18 | Projek "Pasar" siap + Economy ≥ 60 |
| Kompleks Sukan Rakyat | 350,000 | Welfare | +15 | Projek "Sekolah" siap |
| Naik Taraf Masjid & Surau | 160,000 | Welfare | +9 | – |
| Menara Pejabat SME | 450,000 | Economy | +20 | Projek "Internet" siap |

- Bandar dipaparkan sebagai dunia CSS-3D sebenar (bukan Three.js) — bangunan tumbuh tinggi mengikut zone stat (contoh skyscraper tinggi = `150 + economy×1.2`), 13 jenis bangunan (tower/skyscraper/shop/house/factory/school/clinic/masjid/mall/stadium/terminal/sawah/pond), kamera boleh drag-rotate + zoom.

### 3.4 Sistem Election / Campaign
- **Setup wizard** — 6 langkah: `00 DATA MODE` (dummy vs real-Malaysia dataset) → `01 AVATAR & PARTY` → `02 NOMINATION` (kawasan tanding sendiri) → `03 CAMPAIGN SETTINGS` → `04 DIFFICULTY` (easy/normal/hard/nightmare) → `05 CONFIRM`.
- **Mod PRU vs PRN**: `settings.electionScope` — PRU guna semua 222 kerusi Parlimen 14 negeri; PRN skop kepada satu negeri sahaja (`prnStateId`) dan guna kerusi DUN negeri itu. Berita langsung, event, dan opponent AI ditapis ikut skop (`newsMatchesElectionScope`, `pickEvent`).
- **Election flow rasmi** (`electionFlow.ts`) — 30 hari jumlah: Hari 0 Pembubaran, Hari 0-3 SPR umum tarikh, Hari 3-5 Writ, Hari 7-14 (Nomination Day = Hari 15 sebenarnya per konstant `NOMINATION_DAY=15`), Hari 16-29 Tempoh Berkempen (`CAMPAIGN_PERIOD_DAYS=14`), Hari 30 Hari Mengundi/Malam Keputusan.
- **Candidate Nomination**: 25 ahli parti bernama (`members.ts`), setiap satu ada `influenceScope` (national/state/local), `specialty` (urban/rural/youth/economic/media/grassroots), `experience` (veteran/rising/new). AI Advisor boleh isi automatik (state-level atau seluruh negara) tanpa menimpa pilihan sedia ada pemain.
- **Mini-Games**: Ceramah & Social Media, setiap satu ada 3 tactic (Safe/Balanced/Aggressive) dengan formula gain tunggal (`campaignMath.ts`): `base + demographic bonus − risk penalty` (contoh Ceramah Aggressive = 2.3 base, ada risk penalty 0.45 tapi bonus rural demografik). Topik dipilih rawak daripada key issues negeri + pool generik (10 topik ceramah, 10 topik social).
- **Operations**: 5 jenis (door-to-door, ceramah, youth, digital, rural), setiap satu ada manpowerCost/fundsCost/supportGain, boleh disasarkan ke berbilang negeri.
- **Day Engine** (`electionEngine.ts`): setiap NEXT DAY — pilih event (probability-based, ±1 hari), kira delta support per negeri (operation boost + event impact + noise seeded + opponent AI debuff), kemas kini projected seats & status, drain resource, cipta alert.

### 3.5 Sistem lain yang wujud dalam kod
- **Save/Load**: 5 slot maksimum (`saveGame.ts`), autosave menulis semula slot aktif (tidak cipta slot baru setiap tick), migrasi automatik daripada format save lama (`legacy` single-save).
- **History Store**: rekod kempen selesai (menang/kalah, kerusi, negeri menang, hari dimainkan) — persisted via Zustand `persist` middleware, dengan fingerprint guard supaya refresh tidak duplicate rekod.
- **Theme system**: dark/light mode penuh via CSS vars, togol di Settings → DISPLAY.
- **i18n**: `useLang()` + `t(lang, ms, en)` di hampir semua UI string; togol di Settings → LANGUAGE.
- **Audio**: ambient music toggle + volume, sync antara floating control dan Settings → AUDIO.
- **AI Advisor chat** (`/advisor`, `/api/advisor`): chat sebenar dengan persona "DR. RAZMAN, ALPHA-1", dibekalkan snapshot state kempen (hari, dana, projected seats, majority target, negeri lemah). Fallback rule-based (`offlineAdvice`) bila tiada `ANTHROPIC_API_KEY` atau API gagal.
- **Notification/Alert feed**: senarai alert (maks 12) di War Room, event modal (`EventModal`) untuk event random yang perlu di-"ACKNOWLEDGE".
- **Live News feed**: 28 item berita berskrip mengikut hari (`liveNews.ts`), digabung dengan Political Reactions janaan-pemain dalam satu strim.
- **QA automation**: `scripts/qa-full-game.js` — playwright script yang cold-load semua 23 route + drive satu playthrough penuh (setup→career/sandbox), rekod ke `docs/QA_REPORT.md` dan screenshot.

---

## 4. CONTENT INVENTORY

### 4.1 Senarai Negeri (14, termasuk Wilayah Persekutuan)
| Negeri | Kerusi Parlimen | Kerusi DUN | Head of Government |
|---|---:|---:|---|
| Johor | 26 | 56 | Menteri Besar (Raja) |
| Kedah | 15 | 36 | Menteri Besar (Raja) |
| Kelantan | 14 | 45 | Menteri Besar (Raja) |
| Melaka | 6 | 28 | Ketua Menteri |
| Negeri Sembilan | 8 | 36 | Menteri Besar (Raja) |
| Pahang | 14 | 42 | Menteri Besar (Raja) |
| Perak | 24 | 59 | Menteri Besar (Raja) |
| Perlis | 3 | 18 | Menteri Besar (Raja) |
| Penang | 13 | 40 | Ketua Menteri |
| Sabah | 25 | 73 | Ketua Menteri |
| Sarawak | 31 | 82 | Ketua Menteri (Premier) |
| Selangor | 22 | 56 | Menteri Besar (Raja) |
| Terengganu | 8 | 32 | Menteri Besar (Raja) |
| Wilayah Persekutuan | 13 | 0 (tiada DUN) | — |
| **Jumlah** | **222** | — | Majoriti PRU = 112 |

### 4.2 Party Members / Candidate Pool (25 ahli, `members.ts`)
5 "national heavyweight" (contoh Timbalan Presiden, Naib Presiden I/II, Setiausaha Agung, Pengarah Strategi) · 12 "state-level operator" (Ketua Negeri per negeri, Ketua Pemuda, Ketua Wanita, dsb.) · 8 "local/district figure" (Ketua Cawangan, Aktivis Hak Wanita, dsb.). Setiap ahli ada portrait unik (`candidate-portraits/v1|v2|v3/`).

### 4.3 Cabinet / EXCO Posts (`cabinet.ts`)
- **Persekutuan**: 1 PM + 2 DPM + 12 Menteri (Kewangan, Dalam Negeri, Luar Negeri, Pertahanan, Pendidikan, Kesihatan, Perdagangan, Komunikasi, Belia & Sukan, Wanita & Keluarga, Pengangkutan, Pembangunan Luar Bandar) + 12 Timbalan Menteri sepadan.
- **Negeri (EXCO)**: 10 portfolio (Kewangan & Ekonomi Negeri, Kerajaan Tempatan & Perumahan, Pelaburan & Perindustrian, Pertanian & Luar Bandar, Kesihatan & Alam Sekitar, Pendidikan & Pembangunan Insan, Tanah & Perancangan Bandar, Belia/Sukan/Wanita, Pelancongan & Warisan, Hal Ehwal Agama & Adat) — sengaja tiada Pertahanan/Dalam Negeri/Luar Negeri (hal-ehwal persekutuan).
- Skor pelantikan: `specialty match (30) + experience (5-25) + influence/5 + credibility/6.7 + charisma/10`, gred A+ (≥90) hingga F (<50).

### 4.4 Dataset Parti (2 mod, `datasets.ts`)
- **Dummy/Fictional** — 11 parti fiksyen (MANDAT, LAWAN, GRB, BUF, HIJAU, DESA, PMD, GPT, PPK, SSM, GPP, PEKERJA).
- **Real Malaysia** — 8 parti sebenar (UMNO, PKR, DAP, AMANAH, BERSATU, PAS, GPS, GRS) dengan pemimpin sebenar dipetik sebagai nama calon (angka support/seat adalah simulasi fiksyen, bukan tinjauan sebenar — dinyatakan jelas dalam `dataNote`).

### 4.5 Events & News
- 15 event berskrip berat (`events.ts`) — contoh "Corruption Scandal — Lawan MP" (+3.2% nasional), "Flood Crisis — East Coast" (−0.5% nasional, −1.5% 3 negeri).
- 28 item live-news berskrip mengikut hari (Hari 1–14, `liveNews.ts`) — meliputi isu kos hidup, SPR, nomination day, TV debate, Borneo kingmaker, fatigue jentera.
- Political Reactions dijana prosedur (nomination, ceramah/social, cabinet, candidate fallout) — tidak berskrip, bergantung tindakan pemain.

### 4.6 Fasa Post-Election Content
- **Government**: 5 dasar 100-hari persekutuan + 5 versi negeri (Kos Hidup, Kerja Belia, Anti-Rasuah, Infrastruktur Luar Bandar, Perjanjian Persekutuan-Negeri) · 4 krisis persekutuan + 4 versi negeri (harga naik, banjir, tuntutan koalisi, isu integriti menteri/EXCO), setiap satu 2 pilihan respons.
- **Career**: 5 "career action" (Hadapi PRN Tengah Penggal, Gerakkan Jentera PRK, Urus Pemilihan Parti, Siapkan Mode Kerajaan/Pembangkang, Bina Naratif PRU Seterusnya) · 4 faction dalaman parti (Reformis, Warlord Kawasan, Sayap Pemuda, Blok Borneo).
- **Sandbox**: 6 "national policy lever" (Subsidi Bersasar, Pakej MA63/Borneo, Reformasi SPRM, Piagam Kebebasan Media, Koridor Pelaburan Serantau, Reformasi Parlimen) · 4 senario alternatif hasil (Stable Reformist / Fragile Coalition / Economic Pressure / Competitive Sandbox).
- **Formation**: 3 rakan koalisi persekutuan (Blok Borneo, Pakatan Tengah, Parti Negeri) + 3 versi negeri (Blok Bebas DUN, Parti Tempatan, Wakil Rakyat Luar Bandar).

### 4.7 Aset Visual
- Peta Malaysia SVG sebenar (`public/malaysia.svg`, 14 state path, simplemaps-based) + custom `StateDunMap` untuk paparan DUN.
- Avatar pemimpin: 5 avatar (`/avatars/leader-01..05.png`) + `mymandat-avatar.png`.
- Candidate portraits: set v1/v2/v3, satu potret unik per profil (dipetakan khusus untuk 25 ahli parti di Cabinet screen).
- Kawasan 3D: 13 jenis bangunan CSS-extruded, palet warna tersendiri per jenis (tower cyan-glass, skyscraper indigo, factory grey, masjid dome, dsb.), efek window-lit, contact-shadow 3-lapis.
- Font: Space Mono (monospace) merentasi seluruh UI — estetika "tactical HUD".

---

## 5. UI/UX FLOW

### Peta Skrin (23 route + 1 API route)
```
/ (intro video sekali per sesi) → /menu
/menu ── Start Game ──→ /setup (6 langkah) ──→ /warroom
/menu ── Load Game ───→ /load-game (5 slot) ──→ /warroom
/menu ── Settings ────→ /settings (7 tab: GAMEPLAY, AUDIO, DISPLAY, CONTROLS, NOTIFICATIONS, LANGUAGE, ABOUT)
/menu ── Credits (modal)

/warroom  ←→  /state/[id]  (klik negeri di peta/jadual)
   ├─→ /campaign  (7 tab: NOMINATION, MINI-GAMES, OPERATIONS, VOLUNTEERS, RESOURCES, SCHEDULE, MESSAGING)
   ├─→ /polling
   ├─→ /messaging
   ├─→ /calendar
   ├─→ /advisor   (AI chat, boleh diakses bila-bila)
   └─→ /results   (bila Hari 30 tercapai)

/results
   ├─→ /elected  (jika menang kerusi sendiri) ─→ /kawasan  (dev city, unlocked)
   │        └─→ /mandate
   └─→ /mandate  (jika tidak menang kerusi sendiri, terus)

/mandate  (4 cawangan ikut status mandat)
   ├─ majority/hung ─→ /formation ─→ (cukup majoriti?) ─┬─→ /cabinet ─→ /swearing-in ─→ /government
   │                                                      └─→ /opposition
   ├─ opposition ─────────────────────────────────────────→ /opposition
   └─ collapse ────────────────────────────────────────────→ /postmortem

/government ─→ /career ─→ /sandbox        (loop kerjaya, boleh "MULA KITARAN PRU BARU")
/opposition ─→ /career
/postmortem ─→ /career
/government ── "BANGUNKAN KAWASAN" ──→ /kawasan  (laluan kedua ke sistem dev, selain /elected)
```
Route sokongan: `/trailer` (video pengenalan berasingan drpd intro root), `/stats` (dashboard sejarah kempen).

### Navigation flow (onboarding → end-game)
1. Root `/` — video intro sekali sahaja setiap sesi browser (`sessionStorage` flag), skip terus ke `/menu` jika sudah ditonton.
2. `/menu` — pilih Start/Continue/Load/Settings/Credits.
3. `/setup` — wizard 6 langkah, hantar player ke `/warroom` dengan `phase: "playing"`.
4. `/warroom` — hab utama fasa kempen; War Room nav (MENU/CAMPAIGN/POLLING/MESSAGING/CALENDAR) mesti sentiasa boleh diklik (peraturan explicit di `AGENTS.md`).
5. Selepas Hari 30 → `/results` → cawangan mandat (lihat peta skrin) → akhirnya `/career`/`/sandbox`, yang mana pemain boleh berulang (kitaran PRU baru) — tiada skrin akhir tunggal.

---

## 6. TECHNICAL STACK

### Framework & library
| Kategori | Pilihan | Versi |
|---|---|---|
| Framework | Next.js (App Router) | 14.2.35 |
| UI library | React | ^18 |
| Bahasa | TypeScript | ^5 |
| Styling | Tailwind CSS | ^3.4.1 |
| State management | Zustand | ^5.0.14 |
| Animasi | Framer Motion | ^12.41.0 |
| Chart | Recharts | ^3.9.0 |
| Peta | react-simple-maps + custom SVG (`public/malaysia.svg`) | ^3.0.0 |
| AI | `@anthropic-ai/sdk` (server-side route sahaja) | ^0.111.0 |
| Testing/QA | Playwright | ^1.61.1 |
| Image processing | sharp (build-time) | ^0.35.2 |

### Struktur folder utama
```
app/
  data/        — semua "database" statik (states, constituencies, members, cabinet, events, liveNews, datasets, electionFlow, campaignTopics, politicalReactions, advisors)
  store/       — Zustand stores (gameStore, uiStore, historyStore) + logic engine (electionEngine, opponentAI, campaignMath, saveGame)
  components/  — layout (Header/StatusBar/TacticalPanel/AmbientMusic), charts, map, campaign scene, living-scene, ui primitives
  utils/       — electionOutcome, governmentTerms, seatDetails, format
  api/advisor/ — satu-satunya server route (Claude chat)
  [23 route folders] — satu page.tsx per skrin
```
### State management — dua lapisan
1. **`gameStore.ts`** (runtime, tidak persisted terus) — source of truth semasa bermain: phase, leader, resources, states, operations, nominations, settings, hasWonElection, dsb.
2. **`saveGame.ts`** — snapshot manual daripada `gameStore` ke `localStorage` (5 slot bernombor + legacy migration). **Nota penting**: `SavedGameSnapshot` type **tidak** merangkumi state fasa Career/Government/Sandbox/Kawasan (semua fasa itu guna `useState` tempatan dalam page masing-masing) — lihat Seksyen 8.
3. **`historyStore.ts`** — persisted terus (Zustand `persist` + `localStorage`) untuk rekod sejarah kempen selesai.
4. **`uiStore.ts`** — theme/language/music, persisted manual via `localStorage` individual keys.

### Batasan teknikal yang diperhatikan
- **Tiada backend/database** — semua data (save, history, political reactions) di `localStorage` peranti tempatan sahaja. Tiada akaun pengguna, tiada cloud sync, tiada leaderboard yang mungkin (perlu backend).
- **Fasa Career/Government/Sandbox/Kawasan tidak disimpan** dalam save snapshot — refresh/reload akan reset progress "100 hari pertama", "penggal kerjaya", dan "sandbox run" walaupun kempen PRU/PRN itu sendiri boleh disimpan.
- **Model ID API Claude** dalam `app/api/advisor/route.ts` (`const MODEL = "claude-opus-4-8"`) bukan ID model semasa yang dikenali — patut disemak semula terhadap senarai model rasmi terkini supaya panggilan API tidak silently fallback ke `offlineAdvice` disebabkan model tidak sah.
- Layout guna banyak `xl:grid-cols-[Npx_minmax(0,1fr)_Npx]` fixed-width — tiada bukti responsive mobile/tablet.
- Peta bergantung kepada `fetch()` + `DOMParser` client-side untuk SVG — tiada SSR untuk komponen peta.

---

## 7. CURRENT STRENGTHS

1. **Kedalaman sistem yang jarang ada dalam election sim** — dari nomination calon bernama, opponent AI reaktif, sistem reaksi politik prosedur, hingga kerjaya politik berbilang penggal — semuanya sudah *wired* ke state sebenar (bukan UI kosong), mengikut disiplin `AGENTS.md` ("Implement real state/store/gameplay effects, not UI-only descriptions").
2. **Ketepatan civics Malaysia** — pembezaan PRU/PRN, negeri Raja vs Governor, DUN vs Parlimen, MA63/Borneo — konsisten merentasi hampir setiap skrin melalui satu fungsi tunggal (`getGovernmentTerms`), bukan hardcode bertaburan.
3. **Bilingual sepenuhnya** dari hari pertama reka bentuk, bukan tampalan lewat.
4. **QA automation sedia ada** — skrip Playwright yang cold-load semua 23 route + drive satu playthrough penuh end-to-end, dengan laporan/screenshot automatik. Ini jarang wujud dalam projek solo pada tahap ini.
5. **Estetika visual konsisten dan padu** — "tactical war room HUD" (Space Mono, cyan/gold, corner marks, scanline) dikekalkan merentasi 23 skrin dan kedua-dua tema (dark/light) tanpa hardcoded hex bocor (`feedback_theme` sudah dikuatkuasakan).
6. **Sistem kawasan 3D** — visual payoff yang kukuh untuk pencapaian pemain (menang kerusi sendiri), dengan wajah bandar yang benar-benar disesuaikan mengikut nama kawasan sebenar (bukan template generik).

---

## 8. CURRENT GAPS / WEAKNESSES

### Isu struktur/sistem (disahkan daripada kod)
1. **Progress fasa akhir tidak disimpan.** Career (penggal/bulan/faction), Government (dasar aktif/krisis), Sandbox (lever aktif), dan Kawasan (zon/projek) semuanya `useState` tempatan — hilang bila navigate keluar+masuk semula atau refresh, dan tiada dalam `SavedGameSnapshot`. Ini bermakna "kerjaya berbilang penggal" — ciri USP utama — sebenarnya tidak berterusan merentasi sesi.
2. **Model API advisor berpotensi salah/lapuk** (`claude-opus-4-8`) — jika ID tidak sah, setiap panggilan akan gagal senyap ke mod offline rule-based, menjadikan ciri "AI Advisor sebenar" sentiasa terasa seperti chatbot templat sahaja kepada pemain.
3. **Tiada backend** bermakna tiada leaderboard, tiada akaun, tiada cross-device play — menyekat sebarang mekanik sosial/kompetitif.
4. **Tiada bukti mobile-responsive** — risiko kehilangan pemain yang cuba main di telefon/tablet.
5. **Coalition negotiation (`/formation`) agak cetek** — hanya togol on/off 3 rakan koalisi, tiada pusingan rundingan berbilang atau trade-off portfolio spesifik.

### Isu retention/monetization (gap kandungan, bukan pepijat)
6. Tiada daily-login/streak, tiada scenario harian/mingguan, tiada leaderboard, tiada elemen kongsi hasil (share result) — tiada satu pun "retention hook" klasik wujud dalam kod semasa.
7. Tiada sebarang kod monetisasi (tiada IAP, tiada ads, tiada payment gateway, tiada account tier) — projek ini 100% greenfield dari segi model perniagaan.
8. AI Advisor chat memanggil API Claude sebenar (kos sebenar setiap mesej) tanpa sebarang had penggunaan/metering yang kelihatan dalam kod — risiko kos operasi tanpa kawalan jika dilancarkan secara umum.

`[PERLU INPUT SAYA]` — isu UX/visual spesifik yang disebut dalam perbualan lalu (contoh "platform macam terapung", "istilah kabinet salah") tidak dapat disahkan dalam sesi ini kerana tiada rujukan sejarah perbualan berkaitan tersedia; senarai di atas adalah gap yang diperhatikan terus daripada kod semasa sahaja.

---

## 9. MONETIZATION & COMMERCIAL POTENTIAL

### Model monetisasi dicadangkan
Memandangkan ini projek solo, web-only, tiada backend, dan bertema niche (politik Malaysia) — jangan cuba model yang perlukan infra besar (F2P bermata-wang, ads network) sebelum backend wujud. Cadangan ikut kesediaan teknikal semasa:

1. **Premium one-time purchase** (paling sesuai serta-merta) — jual sebagai "buy full campaign" di itch.io/Steam. Sesuai kerana permainan dah "complete" dari segi loop (kempen → kerajaan → kerjaya), tiada perlu backend, dan padan dengan audience deep-sim yang biasa bayar sekali (Democracy 4, Political Machine guna model sama).
2. **Freemium bertingkat** — PRU (kempen nasional) percuma sebagai "demo penuh"; PRN (mod negeri), custom party creator, Nightmare difficulty, atau advisor persona tambahan sebagai unlock berbayar.
3. **AI Advisor sebagai gate semula jadi** — kerana setiap mesej memang kos token sebenar (Anthropic API), had "X mesej advisor percuma setiap kempen" → unlock tanpa had via pembelian sekali/langganan adalah paywall yang jujur dari segi kos, bukan paywall gimik.
4. **Cosmetic IAP** (selepas backend wujud) — avatar tambahan, palet warna parti custom, set portret calon tambahan, "skin" bangunan kawasan.
5. **Sponsorship jenama/politik** — **tidak disyorkan** tanpa arahan jelas pemilik produk; mengaitkan jenama sebenar/pihak politik dengan simulator politik membawa risiko reputasi. `[PERLU INPUT SAYA]` jika mahu diteroka lebih lanjut.

### Retention hooks yang perlu ditambah
- **Daily/weekly seeded scenario** — guna semula `electionEngine` + seed tetap untuk cabaran "hari ini" (gaya Wordle) — effort rendah kerana engine sedia ada.
- **Leaderboard** (Legacy Score terpantas, majoriti terbesar, kesukaran Nightmare cleared) — perlukan backend ringkas (contoh Supabase/Firebase) sahaja, bukan infra penuh.
- **Achievement/badge system** — sudah ada asas (`achievements` array di Results) — tinggal jadikan ia persistent profile merentasi kempen, bukan per-run sahaja.
- **Notification** untuk momen berkaitan GE sebenar Malaysia (jika ada) — `[PERLU INPUT SAYA]` sama ada mahu tie-in dengan kalendar politik sebenar.

### Potensi viral/sharing
- **Belum ada** butang "share result" — tiada export imej/kad keputusan (peta kerusi + verdict) untuk dikongsi ke media sosial. Ini quick-win besar kerana semua data (seat bar, verdict, achievements) sudah ada di `/results`; tinggal render ke imej/link boleh kongsi.
- Tiada mekanisme "bandingkan kawasan dengan kawan" — akan perlukan backend untuk simpan+banding data merentasi pemain.

### Positioning pasaran
| Competitor | Kekuatan mereka | Beza MY MANDAT |
|---|---|---|
| Democracy 4 | Simulasi dasar sangat dalam, grafik graf policy web | Lebih generik (mana-mana negara); MY MANDAT lebih naratif, khusus Malaysia, dan ada lifecycle kerajaan penuh |
| The Political Machine | Arcade, ringan, US-centric | MY MANDAT jauh lebih dalam (candidate roster bernama, cabinet formation, coalition math sebenar) |
| NationStates | Web, long-form, komuniti besar | MY MANDAT single-player campaign-focused, bukan forum-based nation roleplay |
| Reigns-style choice games | Sangat ringan, sesi pendek | MY MANDAT jauh lebih berat/sistemik |

**Niche kosong**: hampir tiada "Malaysian GE simulator" sedia ada di pasaran arus perdana — first-mover advantage kuat dalam niche SEA/Malaysia jika dipasarkan betul (media sosial politik Malaysia, komuniti "PRU content" di X/TikTok/Reddit r/Malaysia).

---

## 10. ROADMAP CADANGAN

### 🟢 Quick Win (Low effort)
| Cadangan | Masalah diselesaikan | Impak dijangka |
|---|---|---|
| Tambah "Share Result" (eksport imej/kad keputusan) | Tiada elemen viral/sharing langsung | Tinggi — virality/organic marketing, effort rendah kerana data sudah ada di `/results` |
| Sahkan/betulkan model ID di `api/advisor/route.ts` | AI Advisor senyap fallback ke offline mode | Tinggi — USP "AI Advisor sebenar" jadi boleh dipercayai |
| Masukkan state Career/Government/Sandbox/Kawasan ke `SavedGameSnapshot` | Progress fasa akhir hilang bila reload | Tinggi — retention & kepercayaan pemain terhadap sistem save |
| Daily/weekly seeded scenario ringkas | Tiada sebab kembali harian | Sederhana-tinggi — retention, effort rendah (guna semula engine sedia ada) |

### 🟡 Medium Effort
| Cadangan | Masalah diselesaikan | Impak dijangka |
|---|---|---|
| Backend ringkas (Supabase/Firebase) untuk leaderboard + achievement persistent | Tiada elemen kompetitif/sosial | Tinggi untuk retention & word-of-mouth; effort sederhana (tiada perlu full account system dulu) |
| Perdalam `/formation` (rundingan koalisi berbilang pusingan, trade-off portfolio) | Coalition nego terasa cetek (togol sahaja) | Sederhana — memperkukuh salah satu momen naratif paling penting (hung parliament) |
| Mobile-responsive pass untuk skrin utama (warroom/campaign/results) | Kehilangan pemain mobile/tablet | Sederhana-tinggi bergantung sasaran pasaran akhir |
| Metering/usage cap untuk AI Advisor + UI yang jelas menunjukkan kuota | Kos API tanpa kawalan jika dilancar meluas | Tinggi dari segi kawalan kos operasi sebelum monetisasi |

### 🔴 Long-term / Big Bet
| Cadangan | Masalah diselesaikan | Impak dijangka |
|---|---|---|
| Akaun pengguna + cloud save penuh | Tiada cross-device, tiada asas untuk tier berbayar/leaderboard sebenar | Tinggi — prasyarat kepada hampir semua monetisasi & retention lanjutan; effort tinggi |
| Mod "Compare with Friends" / async multiplayer | Tiada elemen sosial-kompetitif | Tinggi untuk virality, tapi perlukan akaun+backend siap dahulu |
| Mod senario sejarah sebenar (replay GE14/GE15) menggunakan dataset nama sebenar sedia ada | Kandungan replay-value jangka panjang | Berpotensi tinggi tapi **sensitif dari segi politik/undang-undang** — `[PERLU INPUT SAYA]` wajib sebelum diteruskan |
| Packaging Steam/mobile app rasmi untuk pasaran komersial meluas | Sekarang web-only, sukar discovery/monetize | Tinggi jika sasaran memang komersial meluas; effort tinggi (perlu QA/porting besar) |

---

*Dokumen ini dijana daripada scan penuh `app/`, `docs/QA_REPORT.md`, `package.json`, dan git log semasa (commit terkini: `0818ae3` — "gate /kawasan development behind winning your own seat"). Kemas kini dokumen ini apabila sistem baru ditambah supaya ia kekal jadi rujukan tunggal yang tepat.*
