import type { LiveNewsItem, LiveNewsTone } from "./liveNews";

export type PoliticalActionType =
  | "nomination"
  | "candidate_fallout"
  | "ceramah"
  | "social"
  | "manifesto"
  | "scandal"
  | "debate"
  | "cabinet";

export interface PoliticalReaction extends LiveNewsItem {
  actionType: PoliticalActionType;
  opponentAttack: string;
  opponentAttackEN: string;
  socialReaction: string;
  socialReactionEN: string;
  advisorWarning: string;
  advisorWarningEN: string;
  effects: string[];
}

function clockTime(offsetMinutes = 0) {
  const now = new Date(Date.now() + offsetMinutes * 60_000);
  return now.toTimeString().slice(0, 5);
}

function stateLabel(stateId: string) {
  return stateId
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

function toneFromRisk(risk: "positive" | "warning" | "negative" | "breaking"): LiveNewsTone {
  return risk;
}

export function buildNominationReaction(input: {
  day: number;
  constituencyId: string;
  constituencyName?: string;
  stateId?: string;
  candidateName?: string;
  candidateRole?: string;
  influenceScope?: "national" | "state" | "local";
  partyAbbr: string;
}): PoliticalReaction {
  const scope = input.influenceScope ?? "local";
  const seat = input.constituencyName ?? stateLabel(input.constituencyId.replace(/^.*-/, ""));
  const state = input.stateId ? stateLabel(input.stateId) : "National";
  const candidate = input.candidateName ?? "party candidate";
  const isNational = scope === "national";
  const isState = scope === "state";
  const tone = isNational ? toneFromRisk("warning") : toneFromRisk("positive");
  const effects = isNational
    ? ["Grassroots enthusiasm -2", "Media attention +3", "Urban visibility +1"]
    : isState
      ? ["State machinery +2", "Local trust +1", "Media attention +1"]
      : ["Grassroots enthusiasm +3", "Local trust +2", "National visibility -1"];

  return {
    id: `reaction-nom-${input.constituencyId}-${Date.now()}`,
    day: input.day,
    time: clockTime(),
    outlet: isNational ? "Kerusi Panas" : "Jentera Report",
    headline: isNational
      ? `Aktivis tempatan persoal keputusan ${input.partyAbbr} letak tokoh nasional di ${seat}`
      : `${candidate} disebut sebagai calon akar umbi untuk ${seat}`,
    headlineEN: isNational
      ? `Local activists question ${input.partyAbbr}'s decision to field national figure in ${seat}`
      : `${candidate} framed as grassroots candidate for ${seat}`,
    summary: isNational
      ? `${candidate} membawa liputan nasional, tetapi jentera tempatan mahu bukti komitmen kawasan.`
      : `Pilihan calon tempatan menguatkan naratif dekat dengan pengundi dan jentera kawasan.` ,
    summaryEN: isNational
      ? `${candidate} brings national coverage, but local machinery wants proof of constituency commitment.`
      : `The local candidate choice strengthens the close-to-voters and grassroots machinery narrative.`,
    tone,
    state,
    impact: effects.join(" · "),
    actionType: "nomination",
    opponentAttack: isNational ? "Lawan: calon payung terjun, bukan suara kawasan." : "Lawan: calon lokal tiada pengalaman nasional.",
    opponentAttackEN: isNational ? "Opponent: parachute candidate, not a local voice." : "Opponent: local candidate lacks national experience.",
    socialReaction: isNational ? "Netizen bandingkan rekod nasional dengan isu tempatan." : "Penyokong tempatan mula naikkan poster calon kawasan.",
    socialReactionEN: isNational ? "Netizens compare national record against local issues." : "Local supporters begin pushing constituency candidate posters.",
    advisorWarning: isNational ? "Hantar operasi akar umbi untuk neutralisasi outsider penalty." : "Gunakan calon ini untuk door-to-door dan ceramah kecil.",
    advisorWarningEN: isNational ? "Deploy grassroots operations to neutralise outsider penalty." : "Use this candidate for door-to-door and small rallies.",
    effects,
  };
}

export function buildCandidateFalloutReaction(input: {
  day: number;
  constituencyName: string;
  stateId: string;
  snubbedName: string;
  snubbedRole: string;
  selectedName: string;
  influence: number;
  credibility: number;
  scenario: "independent" | "opposition" | "sabotage";
  partyAbbr: string;
}): PoliticalReaction {
  const state = stateLabel(input.stateId);
  const highInfluence = input.influence >= 75 || input.credibility >= 78;
  const effects = input.scenario === "opposition"
    ? ["Lawan vote share +2", "Party unity -3", "Media crisis +2"]
    : input.scenario === "independent"
      ? ["Independent spoiler risk +3", "Grassroots split +2", "Seat margin pressure +2"]
      : ["Silent machinery sabotage +2", "Volunteer morale -2", "Local operation efficiency -1"];
  const headlineCore = input.scenario === "opposition"
    ? `${input.snubbedName} dikaitkan dengan parti lawan selepas tidak dipilih di ${input.constituencyName}`
    : input.scenario === "independent"
      ? `${input.snubbedName} pertimbang tiket bebas selepas diketepikan di ${input.constituencyName}`
      : `Jentera ${input.snubbedName} dilapor dingin selepas pemilihan calon ${input.constituencyName}`;
  const headlineCoreEN = input.scenario === "opposition"
    ? `${input.snubbedName} linked to opposition after being dropped in ${input.constituencyName}`
    : input.scenario === "independent"
      ? `${input.snubbedName} weighs independent ticket after being sidelined in ${input.constituencyName}`
      : `${input.snubbedName}'s machinery reportedly cools after ${input.constituencyName} selection`;

  return {
    id: `reaction-fallout-${input.stateId}-${input.constituencyName}-${Date.now()}`,
    day: input.day,
    time: clockTime(),
    outlet: input.scenario === "sabotage" ? "Jentera Report" : "Kerusi Panas",
    headline: headlineCore,
    headlineEN: headlineCoreEN,
    summary: highInfluence
      ? `${input.snubbedName} mempunyai rekod dan pengaruh tempatan. Keputusan memilih ${input.selectedName} mencetuskan risiko pecah undi dan sabotaj jentera.`
      : `${input.snubbedName} tidak dipilih, tetapi masih ada rangkaian penyokong kecil yang boleh mengganggu kempen kawasan.`,
    summaryEN: highInfluence
      ? `${input.snubbedName} has local record and influence. Choosing ${input.selectedName} creates vote-splitting and machinery sabotage risk.`
      : `${input.snubbedName} was not selected, but still has a small supporter network that can disrupt the local campaign.`,
    tone: input.scenario === "opposition" ? "negative" : "warning",
    state,
    impact: effects.join(" · "),
    actionType: "candidate_fallout",
    opponentAttack: input.scenario === "opposition"
      ? "Lawan: parti sendiri pun tidak sepakat memilih calon."
      : "Lawan: pemilihan calon MANDAT mencetuskan protes akar umbi.",
    opponentAttackEN: input.scenario === "opposition"
      ? "Opponent: even the party itself is divided over candidate selection."
      : "Opponent: MANDAT candidate selection triggers grassroots protest.",
    socialReaction: `Penyokong ${input.snubbedName} mula persoal proses pemilihan calon di ${input.constituencyName}.`,
    socialReactionEN: `${input.snubbedName}'s supporters begin questioning the candidate selection process in ${input.constituencyName}.`,
    advisorWarning: input.scenario === "opposition"
      ? "Segera runding dengan kem lawan dalaman; tawarkan peranan kempen atau portfolio negeri."
      : "Hantar mediator parti dan beri peranan rasmi supaya jentera tidak berpecah.",
    advisorWarningEN: input.scenario === "opposition"
      ? "Negotiate immediately with the internal rival camp; offer campaign role or state portfolio."
      : "Send party mediator and give an official role so the machinery does not split.",
    effects,
  };
}

export function buildCampaignActionReaction(input: {
  day: number;
  stateId: string;
  gameType: "ceramah" | "social";
  tactic: "safe" | "balanced" | "aggressive";
  gain: number;
  partyAbbr: string;
}): PoliticalReaction {
  const state = stateLabel(input.stateId);
  const aggressive = input.tactic === "aggressive";
  const social = input.gameType === "social";
  const tone: LiveNewsTone = aggressive ? "warning" : input.gain >= 1.5 ? "positive" : "neutral";
  const effects = social
    ? [`Youth sentiment +${Math.max(1, Math.round(input.gain))}`, aggressive ? "Backlash risk +2" : "Digital momentum +1", "Media attention +2"]
    : [`Grassroots enthusiasm +${Math.max(1, Math.round(input.gain))}`, aggressive ? "Fatigue risk +1" : "Local machinery +1", "Ceramah visibility +2"];

  return {
    id: `reaction-${input.gameType}-${input.stateId}-${Date.now()}`,
    day: input.day,
    time: clockTime(),
    outlet: social ? "TrendWatch MY" : "Arena Politik",
    headline: social
      ? `${input.partyAbbr} lancar kempen digital ${input.tactic} di ${state}`
      : `Ceramah ${input.tactic} ${input.partyAbbr} gegarkan jentera ${state}`,
    headlineEN: social
      ? `${input.partyAbbr} launches ${input.tactic} digital campaign in ${state}`
      : `${input.partyAbbr}'s ${input.tactic} rally energises ${state} machinery`,
    summary: social
      ? `Mesej mikro-targeting mula tersebar; respon pengundi muda menjadi ukuran utama.`
      : `Kehadiran dan disiplin jentera tempatan menjadi isyarat momentum kawasan.` ,
    summaryEN: social
      ? `Micro-targeted messaging begins spreading; young voter response becomes the key measure.`
      : `Turnout and local machinery discipline become signals of constituency momentum.`,
    tone,
    state,
    impact: effects.join(" · "),
    actionType: social ? "social" : "ceramah",
    opponentAttack: social ? "Lawan dakwa kempen terlalu bergantung kepada propaganda digital." : "Lawan dakwa ceramah besar tidak semestinya jadi undi.",
    opponentAttackEN: social ? "Opponent claims the campaign relies too heavily on digital propaganda." : "Opponent claims large rallies do not necessarily translate into votes.",
    socialReaction: social ? "Hashtag naik, tetapi komen sinis juga meningkat." : "Klip ceramah tersebar di kumpulan WhatsApp tempatan.",
    socialReactionEN: social ? "Hashtag rises, but cynical comments also increase." : "Rally clips spread through local WhatsApp groups.",
    advisorWarning: aggressive ? "Pantau backlash dan sediakan rapid response." : "Momentum positif — susuli dengan operasi lapangan.",
    advisorWarningEN: aggressive ? "Monitor backlash and prepare rapid response." : "Positive momentum — follow up with ground operations.",
    effects,
  };
}

export function buildCabinetReaction(input: {
  day: number;
  ministerName: string;
  ministryTitle: string;
  score: number;
  partyAbbr: string;
}): PoliticalReaction {
  const strong = input.score >= 78;
  const tone: LiveNewsTone = strong ? "positive" : input.score >= 62 ? "neutral" : "warning";
  const effects = strong
    ? ["Public confidence +2", "Cabinet credibility +2", "Opposition attack risk -1"]
    : input.score >= 62
      ? ["Cabinet stability +1", "Public confidence neutral", "Portfolio scrutiny +1"]
      : ["Portfolio scrutiny +3", "Public confidence -1", "Opposition attack risk +2"];

  return {
    id: `reaction-cabinet-${input.ministryTitle}-${Date.now()}`,
    day: input.day,
    time: clockTime(),
    outlet: "Putrajaya Watch",
    headline: `${input.partyAbbr} namakan ${input.ministerName} untuk portfolio ${input.ministryTitle}`,
    headlineEN: `${input.partyAbbr} names ${input.ministerName} to ${input.ministryTitle} portfolio`,
    summary: strong
      ? `Pelantikan dilihat sepadan dengan keperluan kementerian dan memberi isyarat kompetensi.`
      : `Penganalisis menilai sama ada pelantikan ini cukup kuat untuk mengurus portfolio penting.`,
    summaryEN: strong
      ? `The appointment is seen as fitting the ministry's needs and signalling competence.`
      : `Analysts question whether the appointment is strong enough to manage a key portfolio.`,
    tone,
    state: "Putrajaya",
    impact: effects.join(" · "),
    actionType: "cabinet",
    opponentAttack: strong ? "Lawan sukar menyerang rekod kompetensi pelantikan ini." : "Lawan persoal kelayakan dan keseimbangan kabinet.",
    opponentAttackEN: strong ? "Opponent struggles to attack the appointment's competence record." : "Opponent questions qualifications and cabinet balance.",
    socialReaction: strong ? "Penyokong puji kabinet teknokratik dan stabil." : "Netizen mula bandingkan kelayakan dengan tokoh lain.",
    socialReactionEN: strong ? "Supporters praise a technocratic and stable cabinet." : "Netizens compare the appointment against alternative figures.",
    advisorWarning: strong ? "Gunakan pelantikan ini sebagai naratif kestabilan kerajaan." : "Sediakan talking points untuk pertahan portfolio ini.",
    advisorWarningEN: strong ? "Use this appointment as a government stability narrative." : "Prepare talking points to defend this portfolio.",
    effects,
  };
}
