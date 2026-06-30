export type LiveNewsTone = "positive" | "negative" | "neutral" | "warning" | "breaking";

export interface LiveNewsItem {
  id: string;
  day: number;
  time: string;
  outlet: string;
  headline: string;
  headlineEN: string;
  summary: string;
  summaryEN: string;
  tone: LiveNewsTone;
  state?: string;
  impact: string;
}

export const liveNewsByDay: LiveNewsItem[] = [
  {
    id: "d01-brief",
    day: 1, time: "08:15", outlet: "Mandat Live Desk",
    headline: "Parlimen dibubarkan, jentera parti mula bergerak",
    headlineEN: "Parliament dissolved, party machinery begins mobilising",
    summary: "War room mengesahkan semua negeri menerima arahan awal untuk mengaktifkan bilik gerakan.",
    summaryEN: "War room confirms all states received initial orders to activate operations rooms.",
    tone: "breaking", impact: "Campaign morale +",
  },
  {
    id: "d01-cost",
    day: 1, time: "12:40", outlet: "Suara Rakyat",
    headline: "Isu kos sara hidup jadi topik pertama kempen",
    headlineEN: "Cost of living issue becomes first campaign topic",
    summary: "Pengundi bandar mahu tawaran konkrit untuk harga barang dan perumahan mampu milik.",
    summaryEN: "Urban voters want concrete pledges on goods prices and affordable housing.",
    tone: "warning", state: "Selangor / WP", impact: "Urban swing voters alert",
  },
  {
    id: "d02-spr",
    day: 2, time: "09:05", outlet: "PRU Monitor",
    headline: "SPR dijangka umum jadual penuh PRU dalam masa terdekat",
    headlineEN: "EC expected to announce full election schedule shortly",
    summary: "Parti-parti mula menyemak senarai calon dan pusat penamaan calon.",
    summaryEN: "Parties begin reviewing candidate lists and nomination centres.",
    tone: "neutral", impact: "Nomination prep unlocked",
  },
  {
    id: "d02-youth",
    day: 2, time: "18:20", outlet: "KampusKini",
    headline: "Pengundi muda tuntut manifesto digital dan pekerjaan",
    headlineEN: "Young voters demand digital manifesto and jobs",
    summary: "Topik gaji permulaan, ekonomi gig dan internet luar bandar menjadi perhatian.",
    summaryEN: "Starting salaries, gig economy, and rural internet become hot topics.",
    tone: "positive", state: "Klang Valley", impact: "Youth outreach recommended",
  },
  {
    id: "d03-writ",
    day: 3, time: "10:00", outlet: "Mandat Live Desk",
    headline: "Writ pilihanraya dikeluarkan, peta kerusi kini aktif",
    headlineEN: "Election writ issued, seat map now active",
    summary: "Setiap kawasan Parlimen masuk mod pertandingan penuh dengan status swing dikemaskini.",
    summaryEN: "Every parliamentary seat enters full contest mode with swing status updated.",
    tone: "breaking", impact: "Seat targeting active",
  },
  {
    id: "d03-johor",
    day: 3, time: "21:10", outlet: "Selatan Daily",
    headline: "Johor muncul medan pertempuran awal",
    headlineEN: "Johor emerges as early battleground",
    summary: "Kerusi pinggir bandar dan pengundi muda dilihat boleh mengubah blok selatan.",
    summaryEN: "Peri-urban seats and young voters seen as potential tipping point in the south.",
    tone: "warning", state: "Johor", impact: "Johor priority +",
  },
  {
    id: "d04-nomination",
    day: 4, time: "09:30", outlet: "PRU Monitor",
    headline: "Nama calon mula bocor, beberapa kawasan panas jadi tumpuan",
    headlineEN: "Candidate names begin leaking, hot seats draw focus",
    summary: "Spekulasi calon heavyweight meningkatkan perhatian media kepada kerusi marginal.",
    summaryEN: "Heavyweight candidate speculation raises media attention to marginal seats.",
    tone: "neutral", impact: "Candidate credibility check",
  },
  {
    id: "d04-social",
    day: 4, time: "22:00", outlet: "TrendWatch MY",
    headline: "Hashtag kempen parti naik trending selepas video pendek viral",
    headlineEN: "Party campaign hashtag trends after short video goes viral",
    summary: "Kempen media sosial memberi momentum awal tetapi risiko backlash meningkat.",
    summaryEN: "Social media campaign builds early momentum but backlash risk rises.",
    tone: "positive", impact: "Social media mini-game bonus",
  },
  {
    id: "d05-ceramah",
    day: 5, time: "20:45", outlet: "Arena Politik",
    headline: "Ceramah mega pertama tarik ribuan penyokong",
    headlineEN: "First mega rally draws thousands of supporters",
    summary: "Jumlah kehadiran tinggi memberi tekanan kepada lawan di kawasan sekitar.",
    summaryEN: "High turnout puts pressure on rivals in surrounding constituencies.",
    tone: "positive", state: "Pahang", impact: "Ceramah mini-game +",
  },
  {
    id: "d05-oppo",
    day: 5, time: "23:10", outlet: "Bilik Berita Lawan",
    headline: "Pihak lawan jawab dengan serangan isu ekonomi",
    headlineEN: "Opposition fires back with economic issue attacks",
    summary: "Naratif kos sara hidup kembali panas di media malam.",
    summaryEN: "Cost of living narrative heats up again in late-night media.",
    tone: "negative", impact: "Rapid response needed",
  },
  {
    id: "d06-east",
    day: 6, time: "11:25", outlet: "Pantai Timur Watch",
    headline: "Pantai Timur tuntut komitmen banjir dan infrastruktur",
    headlineEN: "East Coast demands flood and infrastructure commitments",
    summary: "Pengundi luar bandar mahu jaminan projek yang jelas, bukan slogan umum.",
    summaryEN: "Rural voters want clear project guarantees, not generic slogans.",
    tone: "warning", state: "Kelantan / Terengganu / Pahang", impact: "Rural operation recommended",
  },
  {
    id: "d06-poll",
    day: 6, time: "17:30", outlet: "Data Polling Unit",
    headline: "Poll harian tunjuk swing kecil di kerusi campuran",
    headlineEN: "Daily poll shows small swing in mixed seats",
    summary: "Perubahan sokongan belum besar, tetapi trend positif muncul di tiga negeri.",
    summaryEN: "Support shift is modest, but positive trend emerging in three states.",
    tone: "positive", impact: "Polling momentum +",
  },
  {
    id: "d07-nomination-day",
    day: 7, time: "09:00", outlet: "Mandat Live Desk",
    headline: "Hari Penamaan Calon bermula",
    headlineEN: "Nomination Day begins",
    summary: "Calon disahkan; reputasi, lokaliti dan kekuatan jentera mula mempengaruhi peta kerusi.",
    summaryEN: "Candidates confirmed; reputation, locality and machinery strength begin shaping the seat map.",
    tone: "breaking", impact: "Candidate phase active",
  },
  {
    id: "d07-independent",
    day: 7, time: "15:45", outlet: "Kerusi Panas",
    headline: "Calon bebas muncul di beberapa kawasan marginal",
    headlineEN: "Independent candidates emerge in several marginal seats",
    summary: "Pecahan undi berpotensi mengganggu kiraan majoriti di seat nipis.",
    summaryEN: "Vote splitting could disrupt majority counts in razor-thin seats.",
    tone: "warning", impact: "Three-corner fight risk",
  },
  {
    id: "d08-digital",
    day: 8, time: "13:10", outlet: "TrendWatch MY",
    headline: "Kempen media sosial masuk fasa serangan mikro-targeting",
    headlineEN: "Social media campaign enters micro-targeting attack phase",
    summary: "Segmen belia, wanita bekerja dan pengundi atas pagar menerima mesej berbeza.",
    summaryEN: "Youth, working women and fence-sitter segments receive differentiated messages.",
    tone: "positive", impact: "Digital campaign bonus",
  },
  {
    id: "d08-sabah",
    day: 8, time: "19:35", outlet: "Borneo Wire",
    headline: "Sabah minta komitmen MA63 yang lebih jelas",
    headlineEN: "Sabah requests clearer MA63 commitments",
    summary: "Pemimpin tempatan menuntut autonomi dan pembangunan luar bandar dimasukkan dalam janji kempen.",
    summaryEN: "Local leaders demand autonomy and rural development be included in campaign pledges.",
    tone: "warning", state: "Sabah", impact: "Borneo watch active",
  },
  {
    id: "d09-sarawak",
    day: 9, time: "10:50", outlet: "Borneo Wire",
    headline: "Sarawak menjadi kunci majoriti 112",
    headlineEN: "Sarawak holds the key to the 112 majority",
    summary: "Pemerhati melihat blok Borneo boleh menentukan kerajaan jika Semenanjung berpecah.",
    summaryEN: "Observers see Borneo bloc as government-decider if Peninsula results are split.",
    tone: "breaking", state: "Sarawak", impact: "Kingmaker scenario +",
  },
  {
    id: "d09-media",
    day: 9, time: "22:15", outlet: "Malam Ini Politik",
    headline: "Debat TV ubah naratif nasional",
    headlineEN: "TV debate shifts national narrative",
    summary: "Prestasi pemimpin dalam debat mempengaruhi persepsi kredibiliti dan strategi ekonomi.",
    summaryEN: "Leaders' debate performance shapes credibility perception and economic strategy.",
    tone: "neutral", impact: "Credibility check",
  },
  {
    id: "d10-ground",
    day: 10, time: "16:20", outlet: "Jentera Report",
    headline: "Door-to-door lebih berkesan di kerusi separa bandar",
    headlineEN: "Door-to-door more effective in semi-urban seats",
    summary: "Laporan lapangan menunjukkan pengundi atas pagar respon baik kepada mesej lokal.",
    summaryEN: "Ground reports show fence-sitters respond well to local-issue messaging.",
    tone: "positive", impact: "Ground strength +",
  },
  {
    id: "d10-attack",
    day: 10, time: "23:00", outlet: "Crisis Desk",
    headline: "Serangan personal mula meningkat menjelang minggu akhir",
    headlineEN: "Personal attacks escalate heading into the final week",
    summary: "War room perlu pilih antara counter-attack atau kekal pada mesej polisi.",
    summaryEN: "War room must choose between counter-attack or staying on policy message.",
    tone: "negative", impact: "Narrative risk +",
  },
  {
    id: "d11-polling",
    day: 11, time: "12:00", outlet: "Data Polling Unit",
    headline: "Kerusi marginal tinggal terlalu rapat untuk diramal",
    headlineEN: "Marginal seats remain too close to call",
    summary: "Sebahagian seat bawah margin 3% boleh berubah melalui satu operasi kempen yang tepat.",
    summaryEN: "Seats within a 3% margin could flip with one well-targeted campaign operation.",
    tone: "warning", impact: "Swing seat focus",
  },
  {
    id: "d11-volunteer",
    day: 11, time: "18:55", outlet: "Jentera Report",
    headline: "Sukarelawan tambahan tiba di negeri sasaran",
    headlineEN: "Additional volunteers arrive in target states",
    summary: "Pasukan lapangan mempercepat aktiviti canvassing di Johor, Perak dan Selangor.",
    summaryEN: "Ground teams accelerate canvassing activity in Johor, Perak and Selangor.",
    tone: "positive", impact: "Manpower efficiency +",
  },
  {
    id: "d12-final-rally",
    day: 12, time: "21:30", outlet: "Arena Politik",
    headline: "Rally penutup negeri-negeri utama masuk fasa maksimum",
    headlineEN: "Closing rallies in key states enter maximum phase",
    summary: "Ceramah besar malam ini boleh memberi boost terakhir kepada momentum kempen.",
    summaryEN: "Tonight's mega rally could deliver the final boost to campaign momentum.",
    tone: "positive", impact: "Final rally bonus",
  },
  {
    id: "d12-fatigue",
    day: 12, time: "23:40", outlet: "Campaign Health Desk",
    headline: "Keletihan jentera mula ketara selepas 12 hari kempen",
    headlineEN: "Machinery fatigue becomes apparent after 12 days of campaigning",
    summary: "Pengurusan manpower penting supaya operasi GOTV tidak lemah pada hari akhir.",
    summaryEN: "Manpower management critical to prevent GOTV operations from weakening on final day.",
    tone: "warning", impact: "Resource fatigue risk",
  },
  {
    id: "d13-last-message",
    day: 13, time: "14:10", outlet: "Mandat Live Desk",
    headline: "Mesej akhir kepada pengundi atas pagar disiapkan",
    headlineEN: "Final message to fence-sitters prepared",
    summary: "War room memilih antara ekonomi, kestabilan atau reformasi sebagai naratif penutup.",
    summaryEN: "War room chooses between economy, stability or reform as the closing narrative.",
    tone: "neutral", impact: "Choose closing message",
  },
  {
    id: "d13-silence",
    day: 13, time: "23:55", outlet: "PRU Monitor",
    headline: "Hari Tenang hampir bermula",
    headlineEN: "Cooling-off Day is almost here",
    summary: "Semua operasi kempen mesti dihentikan; hanya analisis dalaman dan persediaan mengundi diteruskan.",
    summaryEN: "All campaign operations must stop; only internal analysis and polling preparations continue.",
    tone: "warning", impact: "Campaign lock soon",
  },
  {
    id: "d14-cooling",
    day: 14, time: "08:00", outlet: "Mandat Live Desk",
    headline: "Hari Tenang: strategi terakhir dikunci",
    headlineEN: "Cooling-off Day: final strategy locked in",
    summary: "Tiada kempen terbuka. War room memantau forecast akhir dan turnout readiness.",
    summaryEN: "No open campaigning. War room monitors final forecast and turnout readiness.",
    tone: "breaking", impact: "Final forecast active",
  },
  {
    id: "d14-countdown",
    day: 14, time: "21:00", outlet: "Malam Keputusan Preview",
    headline: "Negara menunggu keputusan seat demi seat",
    headlineEN: "Nation awaits seat-by-seat results",
    summary: "Kerusi marginal, Borneo dan majoriti 112 menjadi fokus utama malam pengiraan undi.",
    summaryEN: "Marginal seats, Borneo and the 112 majority threshold are the main focus on results night.",
    tone: "breaking", impact: "Results suspense ready",
  },
];

export function getLiveNewsForDay(day: number): LiveNewsItem[] {
  return liveNewsByDay.filter((item) => item.day === day);
}

export function getLatestLiveNews(day: number, limit = 6): LiveNewsItem[] {
  return liveNewsByDay
    .filter((item) => item.day <= day)
    .sort((a, b) => b.day - a.day || b.time.localeCompare(a.time))
    .slice(0, limit);
}
