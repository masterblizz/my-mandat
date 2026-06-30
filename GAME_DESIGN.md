# MY MANDAT — Dokumen Lengkap Gameplay

MY MANDAT ialah simulator strategi politik pilihan raya Malaysia. Pemain bertindak sebagai pemimpin parti yang mengurus kempen pilihan raya Parlimen Malaysia, memilih parti, memilih calon, mengurus sumber, membaca sentimen rakyat, menjalankan operasi kempen, dan cuba membentuk kerajaan melalui kemenangan majoriti atau rundingan gabungan.

Dokumen ini menerangkan gameplay semasa dan hala tuju design game supaya mekanik, UI, data, save system, dan flow pilihan raya kekal konsisten.

---

## 1. Identiti Game

| Item | Maklumat |
|---|---|
| Tajuk | MY MANDAT |
| Genre | Political strategy / election campaign simulator |
| Setting | Pilihan Raya Umum Malaysia, peringkat Parlimen Persekutuan |
| Gaya UI | Tactical War Room, cyber-election dashboard, dark HUD, cyan/gold accents |
| Perspektif pemain | Pemimpin parti / campaign director |
| Objektif utama | Menang cukup kerusi Parlimen untuk membentuk kerajaan |
| Majoriti mudah | 112 daripada 222 kerusi |
| Platform | Web app, Next.js |

---

## 2. Core Fantasy / Pengalaman Pemain

Pemain berada dalam bilik gerakan nasional pilihan raya. Setiap tindakan memberi kesan kepada sokongan pengundi, sumber kempen, momentum negeri, dan peluang menang kerusi.

Pengalaman utama yang game mahu beri:

1. Rasa seperti mengurus War Room PRU Malaysia.
2. Buat keputusan strategik berdasarkan negeri, kawasan Parlimen, demografi, isu, dan sumber terhad.
3. Pilih parti dan identiti kempen berdasarkan dataset yang dipilih.
4. Pilih calon bernama untuk kawasan Parlimen.
5. Gunakan AI Advisor untuk cadangan calon apabila kerusi terlalu banyak.
6. Jalankan operasi kempen seperti ceramah, digital campaign, door-to-door, youth outreach, rural engagement.
7. Ikuti berita langsung dan perubahan hari ke hari.
8. Lihat keputusan akhir, pencapaian, statistik, dan sejarah kempen.

---

## 3. Struktur Data dan Dataset

Game menyokong dua mode dataset:

### 3.1 Dummy / Fictional Dataset

Dataset ini digunakan untuk gameplay tanpa identiti politik sebenar.

Ciri:
- Parti fiksyen.
- Tokoh fiksyen.
- Sesuai untuk testing, balancing dan mod sandbox.
- Contoh parti:
  - Parti Mandat MY / MANDAT
  - Parti Lawan Rakyat / LAWAN
  - Gerakan Rakyat Baru / GRB
  - Borneo United Front / BUF
  - Parti Hijau Nusantara / HIJAU
  - Ikatan Desa Sejahtera / DESA
  - Parti Muda Digital / PMD

### 3.2 Real Malaysia Political Names Dataset

Dataset ini menggunakan nama parti politik Malaysia sebagai pilihan identiti parti.

Ciri:
- Parti real-name sebagai selectable units.
- Angka sokongan, stats dan simulasi tetap bersifat fictional / simulated.
- Pilihan party datang daripada dataset, bukan free text.
- Contoh parti real-name:
  - UMNO
  - PKR
  - DAP
  - AMANAH
  - BERSATU
  - PAS
  - GPS
  - GRS

### 3.3 Peraturan Party Identity

Party name tidak boleh free text.

Flow sebenar:
1. Pemain pilih dataset.
2. Pemain pilih party daripada dropdown dataset tersebut.
3. Game set automatik:
   - leader.party
   - leader.partyAbbr
   - leader.partyColor
4. Semua screen mesti guna party identity yang sama:
   - Setup confirmation
   - War Room
   - Campaign HQ
   - Polling
   - Results
   - Stats / history
   - Save slot metadata

Larangan:
- Jangan hardcode “Parti Mandat MY” untuk semua campaign.
- Jangan hardcode “MANDAT” di results atau status bar jika pemain pilih parti lain.
- Jangan benarkan dummy party bocor ke real dataset atau sebaliknya.

---

## 4. Setup Flow

Setup campaign terdiri daripada beberapa langkah:

1. Data Mode
   - Pilih Dummy / Fictional Dataset atau Real Malaysia Political Names Dataset.

2. Avatar & Party
   - Pilih avatar pemimpin.
   - Pilih party daripada dataset.
   - Party name, abbreviation dan color diambil daripada data party.

3. Campaign Settings
   - Panjang kempen / mode kempen.
   - Starting fund.
   - Opposition strength.
   - Media bias.
   - Toggle simulation settings seperti realistic polls, randomness, permanent consequences.

4. Difficulty
   - Easy
   - Normal
   - Hard
   - Nightmare

5. Confirm
   - Papar ringkasan sebelum launch.
   - Data mode.
   - Leader name.
   - Selected party.
   - Party abbreviation.
   - Avatar.
   - Difficulty.

### 4.1 Launch Campaign

LAUNCH CAMPAIGN mesti bermaksud new campaign.

Peraturan:
- Launch campaign tidak boleh membuka save lama.
- Jika ada active loaded save, active slot mesti dibersihkan sebelum campaign baru bermula.
- Campaign baru bermula pada Day 1.
- Campaign baru akan create autosave slot baru.

---

## 5. Save / Load System

Game menggunakan sistem save slot maksimum 5 slot.

### 5.1 Slot Rules

| Rule | Behaviour |
|---|---|
| Maksimum slot | 5 |
| Empty slot | Mesti dipaparkan pada Load Game screen |
| Autosave | Rewrite active slot campaign semasa |
| Manual save | Pemain pilih slot mana mahu replace |
| Load game | Restore snapshot dan masuk semula ke campaign |
| Delete save | Delete slot tersebut dan clear active slot jika perlu |

### 5.2 Autosave Behaviour

Autosave tidak boleh create slot baru setiap tick.

Betul:
- Jika campaign dimuatkan dari slot 2, autosave rewrite slot 2.
- Jika campaign baru dilancarkan, game create active slot baru dahulu, kemudian autosave rewrite slot itu.

Salah:
- Autosave create slot baru setiap kali state berubah.
- Launch Campaign overwrite slot lama yang baru dimuatkan.

### 5.3 Manual Save

Manual save screen mesti membenarkan:
- Pilih slot 1–5.
- Save ke empty slot.
- Replace slot yang sudah ada.
- Papar metadata slot:
  - party abbreviation
  - party name
  - day / total days
  - funds
  - saved timestamp
  - difficulty / campaign info jika ada

---

## 6. Campaign Calendar / Election Flow

Game mengikut flow PRU Malaysia:

1. Pembubaran Parlimen
2. SPR umum tarikh PRU
3. Writ pilihan raya dikeluarkan
4. Hari Penamaan Calon
5. Tempoh Berkempen
6. Hari Tenang
7. Hari Mengundi
8. Malam Keputusan
9. Keputusan rasmi diumumkan
10. Pembentukan kerajaan

### 6.1 Campaign Duration

Current implementation menggunakan constant:
- CAMPAIGN_PERIOD_DAYS di app/data/electionFlow.ts

Nota penting:
- Jika design target ialah campaign 14 hari, semua UI dan engine mesti ikut constant yang sama.
- Jangan hardcode 27, 30, atau day text dalam screen berasingan.
- War Room, Results, Calendar, Store, Resource drain dan Live News mesti baca daripada satu source of truth.

### 6.2 Day Engine

NEXT DAY menjalankan election engine:

1. Process event harian.
2. Apply support delta.
3. Apply operation effect.
4. Apply daily noise.
5. Clamp vote share.
6. Update projected seats.
7. Drain resources.
8. Add alert / news update.
9. Move to next day.

---

## 7. War Room

War Room ialah screen utama gameplay.

Fungsi:
- Papar map Malaysia.
- Papar national support.
- Papar state projections.
- Papar resources.
- Papar live news / alerts.
- Papar campaign day.
- Button NEXT DAY.
- Navigate ke Campaign Ops, Polling, Messaging, Calendar, Menu.

### 7.1 Navigation Buttons

War Room nav mesti sentiasa reliable untuk click:
- MENU UTAMA
- CAMPAIGN OPS
- POLLING
- MESSAGING
- CALENDAR

Button ini tidak boleh dilindungi overlay, music control, status bar, atau modal backdrop.

---

## 8. Map dan State System

Game menggunakan 14 state groups termasuk Wilayah Persekutuan.

### 8.1 Total Parliament Seats

Total Parlimen Malaysia mesti 222.

Breakdown semasa:

| State | Seats |
|---|---:|
| Johor | 26 |
| Kedah | 15 |
| Kelantan | 14 |
| Melaka | 6 |
| Negeri Sembilan | 8 |
| Pahang | 14 |
| Perak | 24 |
| Perlis | 3 |
| Penang | 13 |
| Sabah | 25 |
| Sarawak | 31 |
| Selangor | 22 |
| Terengganu | 8 |
| Wilayah Persekutuan | 13 |
| Total | 222 |

Wilayah Persekutuan termasuk:
- Kuala Lumpur seats
- Putrajaya
- Labuan

### 8.2 State Metrics

Setiap state mempunyai:
- mandatSupport / player party support
- lawanSupport
- othersSupport
- swingProbability
- population
- registeredVoters
- turnoutTarget
- groundStrength
- winProbability
- trend
- projectedSeats
- keyIssues
- demographics
- region
- status

### 8.3 Constituency System

Setiap state generate kawasan Parlimen berdasarkan senarai nama kawasan.

Setiap constituency mempunyai:
- id
- name
- code, contoh P.001
- player party support
- lawan support
- others support
- winner projection
- margin
- safety: safe / marginal / danger

---

## 9. Candidate Nomination System

Semua calon mesti datang daripada ahli parti.

Prinsip utama:
- Tiada calon lokal generic tanpa nama.
- “Local” bukan jenis calon berasingan.
- “Local” bermaksud calon itu berasal atau menetap di kawasan/negeri tersebut.

### 9.1 Jenis Relationship Calon

| Label | Maksud |
|---|---|
| ANAK KAWASAN | Calon berasal/menetap di kawasan Parlimen yang sama |
| ANAK NEGERI | Calon berasal/menetap di negeri yang sama |
| NASIONAL | Calon mempunyai pengaruh nasional |
| NEGERI | Calon mempunyai pengaruh peringkat negeri |
| DAERAH | Calon mempunyai pengaruh kawasan/daerah |

### 9.2 Candidate Data

Setiap ahli parti mempunyai:
- id
- name
- role
- homeState
- homeConstituency
- influenceScope: national / state / local
- influence
- charisma
- credibility
- experience: veteran / rising / new
- specialty: urban / rural / youth / economic / media / grassroots

### 9.3 Candidate Pool

Candidate pool semasa terdiri daripada:
1. Ahli parti utama.
2. Ahli parti peringkat negeri.
3. Ahli parti cabang/kawasan yang dijana untuk setiap kerusi Parlimen.

Ini memastikan semua 222 kerusi boleh diisi dengan calon bernama.

### 9.4 Candidate Assignment Rules

- Satu calon hanya boleh bertanding di satu kawasan pada satu masa.
- Jika calon yang sama dipilih di kawasan baru, pencalonan lama dikosongkan.
- UI menunjukkan “PINDAH → kawasan” jika calon sudah bertanding di kawasan lain.
- Pemain boleh clear calon selepas AI Advisor memberi cadangan.
- Pemain boleh set TIADA CALON / WALKOVER untuk kerusi tertentu.

### 9.5 Candidate Fit

Candidate fit dikira berdasarkan:
- Sama kawasan: bonus tertinggi.
- Sama negeri: bonus sederhana.
- Pengaruh nasional: bonus media/national awareness.
- Pengaruh negeri: sesuai untuk machinery negeri.
- Pengaruh daerah: sesuai untuk grassroots kawasan.
- Influence / charisma / credibility.
- Seat safety dan priority.

### 9.6 Candidate UI

Kad calon mesti tunjuk:
- Nama calon.
- Label fit: ANAK KAWASAN / ANAK NEGERI / NASIONAL / NEGERI / DAERAH.
- Role.
- ASAL/MENETAP: state + constituency.
- PENGARUH NASIONAL / NEGERI / DAERAH.
- Stats: INFL / CHAR / CRED.
- Specialty.
- Status: TERSEDIA / KERUSI INI / PINDAH.

---

## 10. AI Advisor Candidate Selection

AI Advisor membantu pemain memilih calon secara kelompok kerana 222 kerusi terlalu banyak untuk dipilih satu per satu.

### 10.1 Advisor Buttons

Dalam Campaign Ops → NOMINATION:

1. PILIH NEGERI INI
   - Isi calon untuk negeri yang sedang dipilih sahaja.

2. PILIH SELURUH NEGARA
   - Isi calon untuk semua kerusi Parlimen seluruh negara.

### 10.2 Advisor Rules

AI Advisor:
- Hanya memilih daripada ahli parti bernama.
- Mengutamakan calon yang fit dengan kawasan/negeri.
- Mengisi kerusi kosong sahaja.
- Tidak overwrite kerusi yang sudah ada pilihan player.
- Masih membenarkan player edit selepas itu.
- Boleh isi semua 222 kerusi jika national advisor dijalankan pada campaign kosong.

### 10.3 Verified National Fill Behaviour

Expected result selepas klik PILIH SELURUH NEGARA:
- Semua state count penuh.
- Total 222/222 nominated.
- Tiada visible PENDING pada state yang sedang dipaparkan.
- Player boleh CLEAR mana-mana kerusi dan count turun semula.

---

## 11. Campaign Ops Tabs

Campaign HQ mempunyai tab:

1. NOMINATION
2. MINI-GAMES
3. OPERATIONS
4. VOLUNTEERS
5. RESOURCES
6. SCHEDULE
7. MESSAGING

---

## 12. Nomination Tab

Fungsi:
- Pilih state.
- Pilih constituency.
- Lihat status kerusi.
- Lihat current nomination.
- Pilih calon ahli parti.
- Gunakan AI Advisor.
- Clear calon.
- Set TIADA CALON / WALKOVER.

Nomination progress dipaparkan sebagai:
- state count, contoh JHR 26/26
- constituency badge, contoh PENDING, RASHID, YUSOF

---

## 13. Mini-Games Tab

Mini-games memberi kesan langsung kepada state support dan resources.

### 13.1 Ceramah

Kesan:
- Lebih kuat di kawasan rural.
- Guna funds dan manpower.
- Boleh tingkatkan support dan win probability.

### 13.2 Social Media

Kesan:
- Lebih kuat di state youth-heavy / urban.
- Guna media buy.
- Guna manpower lebih rendah berbanding ceramah.

### 13.3 Tactics

| Tactic | Risk | Expected Gain |
|---|---|---|
| Safe | Low | Modest gain |
| Balanced | Medium | Good gain |
| Aggressive | High | High gain tetapi risiko backlash/media warning |

Mini-game mesti update:
- support
- lawan support
- others support
- win probability
- projected seats
- trend
- funds
- manpower
- mediaBuy
- alerts

---

## 14. Operations System

Operations ialah strategi kempen yang boleh dijalankan di satu atau banyak state.

Operation types:
- Door-to-door
- Ceramah
- Youth outreach
- Digital campaign
- Rural engagement

Setiap operation mempunyai:
- name
- type
- location
- stateIds
- status: active / ongoing / planned / completed
- manpowerCost
- fundsCost
- supportGain

Operations yang active atau ongoing memberi kesan dalam day engine.

---

## 15. Resources System

Starting resources semasa:

| Resource | Starting Value | Fungsi |
|---|---:|---|
| Funds | RM 2,300,000 | Kos operasi, campaign, logistics |
| Manpower | 632 | Volunteer / ground team |
| Vehicles | 312 | Mobilisasi jentera |
| Materials | 680 | Bahan kempen |
| Media Buy | 540 | Digital dan media slot |

Resources boleh turun kerana:
- Operations.
- Mini-games.
- Daily drain.
- Events.

Resources boleh naik melalui:
- Positive events.
- Future fundraising mechanics.

---

## 16. Polling Screen

Polling screen memaparkan:
- National support.
- Party support breakdown.
- Demographics.
- Swing voters.
- Issues.
- Forecast.

Polling mesti guna selected party name dan selected party color.

---

## 17. Messaging Screen

Messaging screen digunakan untuk kempen narrative.

Design intent:
- Pilih mesej kempen.
- Deploy ke target demographic/state.
- Mesej memberi kesan kepada media sentiment, youth support, rural support atau issue ownership.

---

## 18. Calendar Screen

Calendar screen menunjukkan:
- Event campaign.
- Ceramah / operation schedule.
- PRU flow.
- Hari Tenang.
- Hari Mengundi.
- Malam Keputusan.

---

## 19. Results Screen

Results screen memaparkan keputusan akhir.

### 19.1 Outcome Types

| Outcome | Condition |
|---|---|
| Strong Mandate | Player party menang sangat besar |
| Majority Win | Player party capai 112+ seats |
| Hung Parliament | Tiada majoriti jelas, perlu rundingan gabungan |
| Defeat | Player gagal membentuk kerajaan |

### 19.2 Results Data

Results mesti guna:
- leader.party
- leader.partyAbbr
- leader.partyColor
- final seat count
- national support
- funds remaining
- operations summary
- states won
- achievements

Jangan hardcode MANDAT jika selected party lain.

---

## 20. Stats / History Screen

Stats screen mesti memaparkan sejarah campaign sebenar, bukan fake sample.

History record patut simpan:
- leader name
- party
- difficulty
- outcome
- seats
- national support
- states won
- days played
- top state
- worst state
- timestamp

Duplicate guard diperlukan supaya refresh results page tidak create rekod berulang.

---

## 21. Main Menu

Main menu mempunyai fungsi:
- Start Game / New Campaign
- Continue Run
- Load Game
- Settings
- Credits

### 21.1 Credits

Credits mesti membuka modal dan boleh ditutup.

### 21.2 Continue Run

Continue Run sepatutnya sambung active campaign jika ada.

### 21.3 Load Game

Load Game buka screen 5 slot save.

---

## 22. Intro / Boot Sequence

Game boleh menggunakan intro boot sequence sebelum masuk War Room.

Rules:
- Intro hanya sampai SYSTEM READY / Game Ready.
- Selepas itu masuk War Room.
- Digunakan untuk Start Game, Continue Run, dan Load Game jika diperlukan.
- Perlu ada skip/click/keyboard control.

---

## 23. Audio / Music

Game mempunyai ambient music system.

Rules:
- Music tidak autoplay tanpa user gesture.
- MUSIC ON/OFF sentiasa jelas.
- Settings mesti ada music toggle dan volume.
- State audio mesti sync antara global button dan Settings.

---

## 24. UI / UX Rules

### 24.1 Pointer Reliability

Semua button mesti boleh diklik dengan normal user/browser click.

Known risky overlays:
- StatusBar
- AmbientMusic floating control
- Modal backdrop
- HUD decorative layer
- Fixed nav bars

Rules:
- Decorative overlay mesti pointer-events-none.
- Button penting mesti berada di atas overlay.
- Setup bottom nav tidak boleh tertutup music control.
- War Room nav mesti visible dan reliable.

### 24.2 Visual Style

Core visual style:
- Dark tactical dashboard.
- Cyan and gold highlight.
- Space Mono style typography.
- Compact panels.
- No clipped text.
- No cropped button border.
- Avatar visible on major screens.
- No unwanted “Peta PRU” visible wording.

---

## 25. Gameplay Balancing Principles

### 25.1 State Strategy

Pemain perlu pilih antara:
- Defend safe seats.
- Attack marginal seats.
- Invest in danger seats.
- Build Borneo kingmaker strategy.
- Focus urban youth vote.
- Focus rural machinery.

### 25.2 Candidate Strategy

Tradeoff calon:
- National figure memberi media visibility tetapi mungkin kurang local roots.
- State figure kuat dengan jentera negeri.
- District figure kuat di kawasan sendiri.
- Anak kawasan memberi akar umbi kuat.
- Parachute candidate boleh membantu tetapi patut ada risiko future penalty.

### 25.3 Resource Strategy

Pemain tidak boleh buat semua benda tanpa kos.

Tradeoff:
- Ceramah: manpower/funds tinggi, kuat rural.
- Social media: media buy tinggi, kuat youth/urban.
- Door-to-door: manpower tinggi, stabil.
- Digital: media buy/funds, broader reach.
- Rural engagement: lambat tetapi solid di negeri rural.

---

## 26. Current Implemented Gameplay Summary

Implemented:
- Setup dataset selection.
- Party selection based on dataset, not free text.
- Avatar selection.
- Save/load with 5 slots.
- Autosave rewrite active slot.
- Manual save replace selected slot.
- Load Game screen shows empty slots.
- War Room navigation.
- Campaign Ops tabs.
- Nomination by named party members.
- AI Advisor state/national candidate assignment.
- AI Advisor can fill all 222 seats using main + branch party members.
- Player can edit AI-selected nominations.
- Candidate influence scope: national/state/local.
- Candidate origin labels: Anak Kawasan / Anak Negeri.
- Mini-games for ceramah/social media with tactics.
- Operation management.
- Resources display and mutation.
- Results screen uses selected party identity.
- Stats/history store for real campaign records.
- Credits modal.
- Ambient music toggle/settings.

Partially implemented / future polish:
- Candidate nomination effects should be tied deeper to constituency-level support.
- Coalition negotiation after hung parliament can be expanded.
- Messaging strategy can mutate voter blocs more deeply.
- Calendar can become more interactive.
- Final Malam Keputusan can add seat-by-seat reveal animation.
- 14-day campaign target should be enforced globally if design decision is final.

---

## 27. Important Development Rules

1. Use Zustand gameStore as source of truth for campaign state.
2. Do not implement UI-only gameplay buttons; gameplay actions must mutate store/engine state.
3. Keep selected party identity consistent everywhere.
4. Keep total seats at 222.
5. Keep all save/load behaviour slot-based, max 5 slots.
6. All candidates must be named party members.
7. Local candidate means origin/residence, not unnamed generic candidate.
8. AI Advisor recommendations must remain editable by player.
9. Build and typecheck after gameplay changes.
10. Browser-verify with real clicks for important controls.

---

## 28. Key Files

| File | Purpose |
|---|---|
| app/store/gameStore.ts | Main campaign state and gameplay actions |
| app/store/electionEngine.ts | NEXT DAY simulation engine |
| app/store/saveGame.ts | Save slot persistence and active slot logic |
| app/store/historyStore.ts | Campaign result history |
| app/data/states.ts | State data and seat counts |
| app/data/constituencies.ts | Parliamentary constituency generation |
| app/data/datasets.ts | Dummy and real-name party datasets |
| app/data/members.ts | Main party member roster and influence metadata |
| app/data/electionFlow.ts | PRU flow and campaign period constant |
| app/campaign/page.tsx | Campaign Ops, nomination, AI Advisor, mini-games |
| app/warroom/page.tsx | Main War Room |
| app/setup/page.tsx | Campaign setup flow |
| app/load-game/page.tsx | Save/load slot UI |
| app/results/page.tsx | Final election results |
| app/stats/page.tsx | Historical campaign stats |
| app/menu/page.tsx | Main menu and credits |

---

## 29. QA Checklist for Gameplay

Before saying a gameplay feature is done:

1. Run `npx tsc --noEmit --pretty false`.
2. Run `npm run build`.
3. Start dev server.
4. Browser-click the changed UI.
5. Confirm visible state changes.
6. Check console errors.
7. Confirm no old hardcoded party names appear.
8. Confirm save/load works if state persistence changed.
9. Confirm candidate AI Advisor still fills all expected seats.
10. Confirm player can edit AI Advisor recommendations.

---

## 30. Design Direction

MY MANDAT should feel like a Malaysian PRU tactical command centre:

- Map-first national overview.
- Candidate machinery and party operations matter.
- State and constituency geography matter.
- Sabah/Sarawak and regional dynamics matter.
- Campaign narrative and media environment matter.
- Resource management matters.
- Player choice should be editable and reversible where practical.
- The game should avoid fake-looking placeholder data on final player-facing screens.

The long-term target is a fully playable Malaysian election simulator where the player can start a party campaign, select candidates, run a full campaign, react to live news, manage resources, contest all 222 seats, experience Malam Keputusan, and either form government, negotiate coalition, or lose the election.
