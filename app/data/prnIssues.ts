import type { MiniGameType } from "../store/campaignMath";

export interface PrnCampaignIssue {
  id: string;
  title: { ms: string; en: string };
  summary: { ms: string; en: string };
  voterBloc: { ms: string; en: string };
  channel: MiniGameType;
  bonus: number;
}

const issue = (
  id: string,
  titleMS: string,
  titleEN: string,
  summaryMS: string,
  summaryEN: string,
  blocMS: string,
  blocEN: string,
  channel: MiniGameType,
  bonus = .55,
): PrnCampaignIssue => ({ id, title: { ms: titleMS, en: titleEN }, summary: { ms: summaryMS, en: summaryEN }, voterBloc: { ms: blocMS, en: blocEN }, channel, bonus });

export const PRN_ISSUES: Record<string, PrnCampaignIssue[]> = {
  johor: [
    issue("johor-cross-border", "Ekonomi rentas sempadan", "Cross-border economy", "Gaji, ringgit dan pekerjaan berkait Singapura menentukan sentimen bandar selatan.", "Wages, the ringgit and Singapore-linked jobs shape sentiment in the southern cities.", "Pekerja bandar", "Urban workers", "social", .6),
    issue("johor-cost", "Kos hidup dan perumahan", "Living costs and housing", "Keluarga muda terhimpit oleh sewa, harga rumah dan perjalanan harian.", "Young families face pressure from rent, home prices and daily commuting.", "Keluarga muda", "Young families", "ceramah"),
    issue("johor-rural", "Jurang bandar-luar bandar", "Urban-rural divide", "Daerah luar bandar mahu jalan, klinik dan peluang yang setara dengan koridor pembangunan.", "Rural districts want roads, clinics and opportunities comparable to the growth corridor.", "Pengundi luar bandar", "Rural voters", "ceramah"),
  ],
  kedah: [
    issue("kedah-padi", "Pendapatan pesawah", "Paddy farmers’ income", "Kos input dan harga padi menjadi ujian utama kepada janji ekonomi negeri.", "Input costs and paddy prices are the main test of the state’s economic promises.", "Pesawah", "Paddy farmers", "ceramah", .65),
    issue("kedah-flood", "Banjir dan pengairan", "Floods and irrigation", "Saliran, sungai dan jadual air menjejaskan kampung serta hasil sawah.", "Drainage, rivers and water schedules affect villages and harvests.", "Komuniti desa", "Rural communities", "ceramah"),
    issue("kedah-youth", "Penghijrahan belia", "Youth migration", "Belia mahu pekerjaan mahir supaya tidak perlu berpindah ke negeri lain.", "Young voters want skilled jobs so they do not have to leave the state.", "Belia", "Youth voters", "social"),
  ],
  kelantan: [
    issue("kelantan-water", "Bekalan air bersih", "Clean water supply", "Gangguan air dan mutu paip menjadikan penyampaian asas isu paling dekat dengan rakyat.", "Disruptions and pipe quality make basic service delivery the most immediate concern.", "Isi rumah", "Households", "ceramah", .65),
    issue("kelantan-migration", "Kerja dan penghijrahan belia", "Jobs and youth migration", "Peluang kerja tempatan menentukan sama ada generasi muda kekal atau berhijrah.", "Local jobs determine whether younger generations stay or move away.", "Belia", "Youth voters", "social", .6),
    issue("kelantan-values", "Nilai dan tadbir urus", "Values and governance", "Pengundi menilai keupayaan menyatukan nilai tempatan dengan perkhidmatan cekap.", "Voters judge whether local values can be paired with effective services.", "Pengundi teras", "Core voters", "ceramah"),
  ],
  melaka: [
    issue("melaka-tourism", "Pelancongan dan warisan", "Tourism and heritage", "Perniagaan mahu pertumbuhan pelancongan tanpa mengorbankan kawasan warisan.", "Businesses want tourism growth without sacrificing heritage districts.", "Peniaga tempatan", "Local businesses", "social"),
    issue("melaka-traffic", "Kesesakan dan banjir kilat", "Traffic and flash floods", "Perjalanan bandar dan saliran menjadi ukuran harian prestasi kerajaan negeri.", "Urban mobility and drainage are daily measures of state performance.", "Pengundi bandar", "Urban voters", "ceramah"),
    issue("melaka-wages", "Gaji sektor pembuatan", "Manufacturing wages", "Pekerja mahu pelaburan industri diterjemahkan kepada gaji dan kemahiran lebih baik.", "Workers want industrial investment to translate into better wages and skills.", "Pekerja industri", "Industrial workers", "ceramah"),
  ],
  ns: [
    issue("ns-transport", "Pengangkutan dan perjalanan", "Transport and commuting", "Hubungan Seremban-Lembah Klang dan pengangkutan tempatan mempengaruhi keluarga bekerja.", "Seremban-Klang Valley links and local transport affect working households.", "Pengguna komuter", "Commuters", "social"),
    issue("ns-industry", "Pekerjaan industri", "Industrial jobs", "Pengundi mahu pelaburan baharu membawa latihan dan gaji kepada penduduk tempatan.", "Voters want new investment to deliver training and wages for local residents.", "Pekerja muda", "Young workers", "ceramah"),
    issue("ns-housing", "Perumahan mampu milik", "Affordable housing", "Pertumbuhan bandar baharu meningkatkan tekanan harga rumah dan kemudahan awam.", "Growth in new townships raises pressure on home prices and public amenities.", "Keluarga muda", "Young families", "social"),
  ],
  pahang: [
    issue("pahang-flood", "Banjir dan tebatan", "Flood protection", "Kawasan sungai mahu projek tebatan yang siap dan amaran bencana yang boleh dipercayai.", "River communities want completed mitigation projects and reliable disaster warnings.", "Komuniti sungai", "River communities", "ceramah", .65),
    issue("pahang-forest", "Hutan dan guna tanah", "Forests and land use", "Pembalakan, alam sekitar dan mata pencarian tempatan mencetuskan pertikaian besar.", "Logging, conservation and local livelihoods create a major political fault line.", "Komuniti pedalaman", "Interior communities", "social"),
    issue("pahang-roads", "Jalan dan capaian luar bandar", "Rural roads and access", "Jalan rosak serta jarak ke klinik dan sekolah menekan pengundi luar bandar.", "Poor roads and distance from clinics and schools weigh on rural voters.", "Pengundi luar bandar", "Rural voters", "ceramah"),
  ],
  perak: [
    issue("perak-jobs", "Pekerjaan dan bandar lama", "Jobs and ageing towns", "Bandar perlombongan lama mahu industri baharu dan pekerjaan untuk mengekalkan belia.", "Former mining towns want new industries and jobs that keep young people local.", "Belia dan pekerja", "Youth and workers", "social"),
    issue("perak-ageing", "Kesihatan warga emas", "Ageing and healthcare", "Penduduk menua meningkatkan keperluan klinik, penjagaan dan pengangkutan awam.", "An ageing population raises demand for clinics, care and public transport.", "Warga emas", "Older voters", "ceramah"),
    issue("perak-mining", "Perlombongan dan alam sekitar", "Mining and environment", "Peluang ekonomi perlu diimbangi dengan air bersih dan pemulihan tanah.", "Economic opportunity must be balanced against clean water and land restoration.", "Komuniti setempat", "Local communities", "ceramah"),
  ],
  perlis: [
    issue("perlis-border", "Perdagangan sempadan", "Border trade", "Peniaga kecil bergantung pada aliran sempadan yang cekap dan peraturan konsisten.", "Small traders depend on efficient crossings and consistent rules.", "Peniaga kecil", "Small traders", "social"),
    issue("perlis-padi", "Padi dan pengairan", "Paddy and irrigation", "Bekalan air serta kos input menentukan pendapatan keluarga pesawah.", "Water supply and input costs determine farming household incomes.", "Pesawah", "Paddy farmers", "ceramah", .65),
    issue("perlis-youth", "Peluang belia", "Youth opportunity", "Negeri kecil ini perlu menawarkan latihan, kerja dan ruang niaga kepada belia.", "The small state needs training, jobs and business space for young people.", "Belia", "Youth voters", "social"),
  ],
  penang: [
    issue("penang-housing", "Perumahan dan sewa", "Housing and rent", "Harga rumah serta sewa menekan pekerja muda di pulau dan tanah besar.", "Home prices and rent pressure young workers on the island and mainland.", "Keluarga muda", "Young families", "social", .6),
    issue("penang-mobility", "Kesesakan dan pengangkutan", "Congestion and transport", "Pengundi mahu perjalanan harian lebih cepat dan rangkaian awam yang boleh dipercayai.", "Voters want faster daily journeys and reliable public transport.", "Pengguna komuter", "Commuters", "social"),
    issue("penang-development", "Pembangunan dan alam sekitar", "Development and environment", "Projek besar dinilai melalui kesan pantai, banjir dan manfaat kepada penduduk.", "Major projects are judged by coastal impact, flooding and benefits for residents.", "Pengundi bandar", "Urban voters", "ceramah"),
  ],
  sabah: [
    issue("sabah-ma63", "MA63 dan kuasa negeri", "MA63 and state powers", "Pengundi mahu hasil, kuasa pentadbiran dan janji persekutuan diterjemah kepada tindakan.", "Voters want revenue, administrative powers and federal promises turned into action.", "Pengundi seluruh negeri", "Statewide voters", "ceramah", .65),
    issue("sabah-utilities", "Air, elektrik dan jalan", "Water, power and roads", "Gangguan utiliti serta jalan luar bandar menjadi ukuran nyata pembangunan.", "Utility disruptions and rural roads are tangible measures of development.", "Komuniti luar bandar", "Rural communities", "ceramah", .65),
    issue("sabah-youth", "Kerja belia dan kos hidup", "Youth jobs and living costs", "Belia bandar mahu gaji, internet dan peluang tanpa perlu berhijrah.", "Urban youth want wages, connectivity and opportunity without having to leave.", "Belia", "Youth voters", "social"),
  ],
  sarawak: [
    issue("sarawak-autonomy", "Autonomi dan hasil negeri", "Autonomy and state revenue", "Pengundi menilai sejauh mana kuasa dan hasil negeri kembali kepada rakyat.", "Voters judge how far state powers and revenue return benefits to residents.", "Pengundi seluruh negeri", "Statewide voters", "ceramah", .65),
    issue("sarawak-rural", "Capaian luar bandar", "Rural connectivity", "Jalan, internet, klinik dan sekolah masih menentukan persaingan di kerusi pedalaman.", "Roads, internet, clinics and schools still define contests in interior seats.", "Komuniti pedalaman", "Interior communities", "ceramah", .65),
    issue("sarawak-land", "Tanah adat dan pembangunan", "Native land and development", "Hak tanah serta rundingan komuniti menjadi syarat kepada projek baharu.", "Land rights and community consent shape support for new projects.", "Komuniti asal", "Native communities", "social"),
  ],
  selangor: [
    issue("selangor-water", "Air dan banjir", "Water and flooding", "Gangguan air, sungai dan banjir kilat menguji keupayaan pentadbiran negeri.", "Water disruptions, rivers and flash floods test the state administration.", "Isi rumah bandar", "Urban households", "ceramah", .6),
    issue("selangor-housing", "Perumahan mampu milik", "Affordable housing", "Harga rumah dan sewa menekan keluarga muda di kawasan pertumbuhan pesat.", "Home prices and rent pressure young families in fast-growing areas.", "Keluarga muda", "Young families", "social", .65),
    issue("selangor-traffic", "Trafik dan pengangkutan awam", "Traffic and public transport", "Masa perjalanan harian menjadi isu utama pengundi pinggir bandar.", "Daily travel time is a defining issue for suburban voters.", "Pengguna komuter", "Commuters", "social"),
  ],
  terengganu: [
    issue("terengganu-royalty", "Royalti minyak", "Oil royalties", "Pengundi mahu hasil petroleum diterjemah kepada perkhidmatan dan peluang tempatan.", "Voters want petroleum revenue translated into services and local opportunity.", "Pengundi seluruh negeri", "Statewide voters", "ceramah", .65),
    issue("terengganu-youth", "Kerja dan latihan belia", "Youth jobs and training", "Belia mahu pekerjaan selain sektor tradisional dan kontrak jangka pendek.", "Young voters want jobs beyond traditional sectors and short-term contracts.", "Belia", "Youth voters", "social", .6),
    issue("terengganu-coast", "Nelayan dan hakisan pantai", "Fisheries and coastal erosion", "Pendapatan nelayan, cuaca dan perlindungan pantai menyentuh komuniti pesisir.", "Fishing incomes, weather and coastal protection affect shoreline communities.", "Komuniti pesisir", "Coastal communities", "ceramah"),
  ],
};

export function getPrnIssues(stateId: string): PrnCampaignIssue[] {
  return PRN_ISSUES[stateId] ?? [];
}

export function findPrnIssue(stateId: string, issueId?: string): PrnCampaignIssue | undefined {
  return issueId ? getPrnIssues(stateId).find(item => item.id === issueId) : undefined;
}

export function prnIssueActionKey(term: number, stateId: string, issueId: string) {
  return `${term}:${stateId}:${issueId}`;
}

export function prnIssueBonus(issue: PrnCampaignIssue, gameType: MiniGameType, previousUses = 0): number {
  const channelFit = issue.channel === gameType ? 1 : .5;
  const novelty = previousUses === 0 ? 1 : previousUses === 1 ? .5 : .15;
  return Math.round(issue.bonus * channelFit * novelty * 100) / 100;
}
