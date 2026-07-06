export interface ElectionFlowStep {
  id: string;
  period: string;
  periodEN: string;
  title: string;
  titleEN: string;
  description: string;
  descriptionEN: string;
  gameplay: string[];
  gameplayEN: string[];
  tone: "purple" | "mint" | "gold" | "neutral" | "red" | "green" | "blue";
}

export const CAMPAIGN_PERIOD_DAYS = 14;
export const TOTAL_ELECTION_DAYS = 30;
export const NOMINATION_DAY = 15;
export const CAMPAIGN_START_DAY = 16;
export const CAMPAIGN_END_DAY = 29;
export const POLLING_DAY = 30;

export const electionFlowSteps: ElectionFlowStep[] = [
  {
    id: "dissolution",
    period: "Hari 0",
    periodEN: "Day 0",
    title: "Pembubaran Parlimen",
    titleEN: "Parliament Dissolution",
    description: "Perdana Menteri nasihat Yang di-Pertuan Agong membubarkan Parlimen.",
    descriptionEN: "The Prime Minister advises the Yang di-Pertuan Agong to dissolve Parliament.",
    gameplay: ["Briefing pembukaan", "Pilih parti dan avatar", "Tetapkan strategi awal"],
    gameplayEN: ["Opening briefing", "Choose party & avatar", "Set initial strategy"],
    tone: "purple",
  },
  {
    id: "spr-date",
    period: "Hari 0–3",
    periodEN: "Day 0–3",
    title: "SPR Umum Tarikh PRU",
    titleEN: "EC Announces Election Date",
    description: "Suruhanjaya Pilihanraya tetapkan tarikh Hari Mengundi dan Penamaan Calon.",
    descriptionEN: "The Election Commission sets the polling date and nomination day.",
    gameplay: ["Kalendar PRU dibuka", "Sasaran negeri dikenal pasti", "Risiko awal dipaparkan"],
    gameplayEN: ["Election calendar opens", "Target states identified", "Early risks displayed"],
    tone: "mint",
  },
  {
    id: "writ",
    period: "Hari 3–5",
    periodEN: "Day 3–5",
    title: "Writ Pilihanraya Dikeluarkan",
    titleEN: "Election Writ Issued",
    description: "Writ dikeluarkan secara rasmi untuk setiap kawasan Parlimen dan DUN.",
    descriptionEN: "Writs are officially issued for every parliamentary and state constituency.",
    gameplay: ["Peta kerusi diaktifkan", "Jentera negeri tersedia", "Senarai kawasan kritikal muncul"],
    gameplayEN: ["Seat map activated", "State machinery available", "Critical seats list revealed"],
    tone: "mint",
  },
  {
    id: "nomination",
    period: "Hari 7–14",
    periodEN: "Day 7–14",
    title: "Hari Penamaan Calon",
    titleEN: "Nomination Day",
    description: "Calon-calon daftarkan diri; kertas penamaan diserahkan kepada Pegawai Pengurus.",
    descriptionEN: "Candidates register; nomination papers submitted to the Returning Officer.",
    gameplay: ["Pilih / sahkan calon", "Semak kekuatan calon", "Bonus kredibiliti atau penalti imej"],
    gameplayEN: ["Select / confirm candidates", "Check candidate strength", "Credibility bonus or image penalty"],
    tone: "gold",
  },
  {
    id: "campaign",
    period: "14 hari",
    periodEN: "14 days",
    title: "Tempoh Berkempen",
    titleEN: "Campaign Period",
    description: "Kempen hanya bermula selepas Hari Penamaan Calon dan berjalan sehingga 1 hari sebelum Hari Mengundi.",
    descriptionEN: "Campaigning starts only after Nomination Day and runs until 1 day before Polling Day.",
    gameplay: ["Mini-game ceramah", "Kempen media sosial", "Deploy operasi negeri", "Urus dana dan manpower"],
    gameplayEN: ["Rally mini-game", "Social media campaign", "Deploy state operations", "Manage funds & manpower"],
    tone: "blue",
  },
  {
    id: "cooling",
    period: "Hari Tenang",
    periodEN: "Cooling-off Day",
    title: "1 Hari Sebelum Mengundi",
    titleEN: "1 Day Before Polling",
    description: "Semua kempen dihenti; tiada bahan kempen dibenarkan.",
    descriptionEN: "All campaigning stops; no campaign materials are permitted.",
    gameplay: ["Strategi terakhir", "War room forecast", "Tiada operasi baharu", "Pilih mesej penutup"],
    gameplayEN: ["Final strategy", "War room forecast", "No new operations", "Choose closing message"],
    tone: "neutral",
  },
  {
    id: "polling",
    period: "Hari Mengundi",
    periodEN: "Polling Day",
    title: "7:30 pagi – 5:30 petang",
    titleEN: "7:30 am – 5:30 pm",
    description: "Pengundi cast undi di pusat mengundi seluruh negara.",
    descriptionEN: "Voters cast their ballots at polling centres across the nation.",
    gameplay: ["Turnout monitor", "Mobilisasi GOTV", "Amaran kawasan turnout rendah"],
    gameplayEN: ["Turnout monitor", "GOTV mobilisation", "Low turnout area alerts"],
    tone: "red",
  },
  {
    id: "counting",
    period: "Malam Hari Mengundi",
    periodEN: "Election Night",
    title: "Malam Keputusan",
    titleEN: "Results Night",
    description: "Suspens pengiraan undi seat demi seat; keputusan awal diumumkan satu per satu.",
    descriptionEN: "Seat-by-seat vote count suspense; early results announced one by one.",
    gameplay: ["Kiraan seat demi seat", "Swing seat reveal", "Majority tracker 112", "Borneo kingmaker watch"],
    gameplayEN: ["Seat-by-seat count", "Swing seat reveal", "Majority tracker 112", "Borneo kingmaker watch"],
    tone: "gold",
  },
  {
    id: "official-results",
    period: "Malam / Subuh",
    periodEN: "Night / Dawn",
    title: "Keputusan Rasmi Diumumkan",
    titleEN: "Official Results Announced",
    description: "SPR umumkan jumlah kerusi dimenangi setiap parti; pemenang diketahui.",
    descriptionEN: "The EC announces total seats won per party; the winner is known.",
    gameplay: ["Ringkasan keputusan", "Achievement", "Mandat / hung parliament verdict"],
    gameplayEN: ["Results summary", "Achievement unlocked", "Mandate / hung parliament verdict"],
    tone: "green",
  },
  {
    id: "government",
    period: "Hari +1 hingga +14",
    periodEN: "Day +1 to +14",
    title: "Pembentukan Kerajaan",
    titleEN: "Government Formation",
    description: "PM dilantik; kabinet dibentuk dalam tempoh 2 minggu selepas mengundi.",
    descriptionEN: "PM appointed; cabinet formed within 2 weeks after polling.",
    gameplay: ["Rundingan gabungan", "Agihan kabinet", "Ending pembentukan kerajaan"],
    gameplayEN: ["Coalition negotiations", "Cabinet allocation", "Government formation ending"],
    tone: "blue",
  },
];

export function getCampaignDay(electionDay: number) {
  if (electionDay < CAMPAIGN_START_DAY || electionDay > CAMPAIGN_END_DAY) return null;
  return electionDay - CAMPAIGN_START_DAY + 1;
}

export function getElectionFlowStatus(day: number, totalDays = TOTAL_ELECTION_DAYS) {
  const safeDay = Math.min(Math.max(day, 1), totalDays);
  const daysToPoll = Math.max(0, POLLING_DAY - safeDay + 1);
  const campaignDay = getCampaignDay(safeDay);

  if (safeDay < NOMINATION_DAY) {
    return {
      current: electionFlowSteps.find((step) => step.id === "dissolution")!,
      next: electionFlowSteps.find((step) => step.id === "nomination")!,
      progress: Math.round((safeDay / TOTAL_ELECTION_DAYS) * 100),
      daysLeft: daysToPoll,
      campaignDay,
      label: `Hari ${safeDay}/${TOTAL_ELECTION_DAYS} — Parlimen dibubar`,
      labelEN: `Day ${safeDay}/${TOTAL_ELECTION_DAYS} — Parliament dissolved`,
    };
  }

  if (safeDay === NOMINATION_DAY) {
    return {
      current: electionFlowSteps.find((step) => step.id === "nomination")!,
      next: electionFlowSteps.find((step) => step.id === "campaign")!,
      progress: Math.round((safeDay / TOTAL_ELECTION_DAYS) * 100),
      daysLeft: daysToPoll,
      campaignDay,
      label: `Hari ${safeDay}/${TOTAL_ELECTION_DAYS} — Hari Penamaan Calon`,
      labelEN: `Day ${safeDay}/${TOTAL_ELECTION_DAYS} — Nomination Day`,
    };
  }

  if (campaignDay !== null) {
    return {
      current: electionFlowSteps.find((step) => step.id === "campaign")!,
      next: safeDay === CAMPAIGN_END_DAY ? electionFlowSteps.find((step) => step.id === "polling")! : electionFlowSteps.find((step) => step.id === "cooling")!,
      progress: Math.round((campaignDay / CAMPAIGN_PERIOD_DAYS) * 100),
      daysLeft: daysToPoll,
      campaignDay,
      label: campaignDay === CAMPAIGN_PERIOD_DAYS
        ? `Hari Kempen ${campaignDay}/${CAMPAIGN_PERIOD_DAYS} — hari terakhir sebelum mengundi`
        : `Hari Kempen ${campaignDay}/${CAMPAIGN_PERIOD_DAYS}`,
      labelEN: campaignDay === CAMPAIGN_PERIOD_DAYS
        ? `Campaign Day ${campaignDay}/${CAMPAIGN_PERIOD_DAYS} — final day before polling`
        : `Campaign Day ${campaignDay}/${CAMPAIGN_PERIOD_DAYS}`,
    };
  }

  return {
    current: electionFlowSteps.find((step) => step.id === "polling")!,
    next: electionFlowSteps.find((step) => step.id === "counting")!,
    progress: 100,
    daysLeft: 0,
    campaignDay,
    label: `Hari ${safeDay}/${TOTAL_ELECTION_DAYS} — Hari Mengundi`,
    labelEN: `Day ${safeDay}/${TOTAL_ELECTION_DAYS} — Polling Day`,
  };
}

export const getCampaignFlowStatus = getElectionFlowStatus;
