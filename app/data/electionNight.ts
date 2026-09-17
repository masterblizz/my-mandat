import type { StateData } from "./states";
import { computeSeatDetails } from "../utils/seatDetails";
import type { SeatScope } from "../utils/electionOutcome";

export type ElectionNightBulletinType = "opening" | "too-close" | "postal-swing" | "recount" | "late-rural" | "borneo-late" | "kingmaker" | "complete";

export type ElectionNightSeatUpdate = {
  kind: "seat";
  id: string;
  stateId: string;
  stateName: string;
  stateShortName: string;
  region: StateData["region"];
  seatName: string;
  seatCode: string;
  result: "WIN" | "LOSS" | "OTHERS";
  winnerLabel: string;
  majorityVotes: number;
  majorityPct: number;
  phase: "early" | "main" | "rural" | "borneo" | "special";
};

export type ElectionNightBulletin = {
  kind: "bulletin";
  id: string;
  bulletinType: ElectionNightBulletinType;
  title: { ms: string; en: string };
  detail: { ms: string; en: string };
  stateName?: string;
};

export type ElectionNightUpdate = ElectionNightSeatUpdate | ElectionNightBulletin;

function bulletin(type: ElectionNightBulletinType, titleMS: string, titleEN: string, detailMS: string, detailEN: string, stateName?: string): ElectionNightBulletin {
  return { kind: "bulletin", id: `bulletin-${type}`, bulletinType: type, title: { ms: titleMS, en: titleEN }, detail: { ms: detailMS, en: detailEN }, stateName };
}

function stableOrder(value: string) {
  let hash = 0;
  for (const character of value) hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  return hash;
}

export function buildElectionNightTimeline(states: StateData[], partyLabel: string, seatScope: SeatScope): ElectionNightUpdate[] {
  const seats: ElectionNightSeatUpdate[] = states.flatMap(state => computeSeatDetails(state, partyLabel, seatScope).map(detail => {
    const rural = detail.constituency.areaType === "rural" || state.demographics.rural >= 58;
    const phase: ElectionNightSeatUpdate["phase"] = seatScope === "parliament" && state.region === "borneo" ? "borneo" : rural ? "rural" : state.demographics.urban >= 70 ? "early" : "main";
    return {
      kind: "seat" as const,
      id: detail.constituency.id,
      stateId: state.id,
      stateName: state.name,
      stateShortName: state.shortName,
      region: state.region,
      seatName: detail.constituency.name,
      seatCode: detail.constituency.code,
      result: detail.result,
      winnerLabel: detail.winnerLabel,
      majorityVotes: detail.majorityVotes,
      majorityPct: detail.majorityPct,
      phase,
    };
  }));
  const specialCandidates = seats.filter(seat => seat.phase === "early" || seat.phase === "main");
  const closest = [...(specialCandidates.length >= 2 ? specialCandidates : seats)].sort((a, b) => a.majorityPct - b.majorityPct || stableOrder(a.id) - stableOrder(b.id));
  const recountSeat = closest[0];
  const postalSeat = closest.find(seat => seat.id !== recountSeat?.id) ?? recountSeat;
  const specialIds = new Set([recountSeat?.id, postalSeat?.id].filter(Boolean));
  const ordered = seats.filter(seat => !specialIds.has(seat.id)).sort((a, b) => {
    const rank = { early: 0, main: 1, rural: 2, borneo: 3, special: 4 };
    return rank[a.phase] - rank[b.phase] || stableOrder(a.id) - stableOrder(b.id);
  });
  const earlyEnd = Math.max(1, Math.floor(ordered.length * .18));
  const lateIndex = ordered.findIndex(seat => seat.phase === "rural" || seat.phase === "borneo");
  const mainEnd = lateIndex === -1 ? ordered.length : Math.max(earlyEnd, lateIndex);
  const early = ordered.slice(0, earlyEnd);
  const middle = ordered.slice(earlyEnd, mainEnd);
  const late = ordered.slice(mainEnd);
  const rural = late.filter(seat => seat.phase === "rural");
  const borneo = late.filter(seat => seat.phase === "borneo");
  const stateScores = states.map(state => {
    const stateSeats = seats.filter(seat => seat.stateId === state.id);
    const others = stateSeats.filter(seat => seat.result === "OTHERS").length;
    const close = stateSeats.filter(seat => seat.majorityPct <= 4).length;
    return { state, score: others * 6 + close * 2 + stateSeats.length / 10 };
  }).sort((a, b) => b.score - a.score);
  const kingmaker = stateScores[0]?.state;
  const scopeName = seatScope === "dun" ? states[0]?.name ?? "negeri" : "Malaysia";
  const timeline: ElectionNightUpdate[] = [
    bulletin("opening", "Pusat penjumlahan dibuka", "Counting centres open", `Peti undi pertama mula dikira di ${scopeName}.`, `The first ballot boxes are being counted across ${scopeName}.`),
    ...early,
  ];
  if (postalSeat) {
    timeline.push(bulletin("too-close", "Terlalu sengit untuk diumumkan", "Too close to call", `${postalSeat.seatName} dipisahkan kurang ${postalSeat.majorityPct.toFixed(1)} mata.`, `${postalSeat.seatName} is separated by less than ${postalSeat.majorityPct.toFixed(1)} points.`, postalSeat.stateName));
  }
  timeline.push(...middle.slice(0, Math.ceil(middle.length / 2)));
  if (postalSeat) {
    timeline.push(bulletin("postal-swing", "Undi pos mengubah momentum", "Postal votes shift momentum", `Undi pos terakhir menentukan ${postalSeat.seatName}.`, `The final postal ballots decide ${postalSeat.seatName}.`, postalSeat.stateName), { ...postalSeat, phase: "special" });
  }
  timeline.push(...middle.slice(Math.ceil(middle.length / 2)));
  if (recountSeat) {
    timeline.push(bulletin("recount", "Kiraan semula diarahkan", "Recount ordered", `${recountSeat.seatName} menjalani kiraan semula selepas majoriti awal terlalu tipis.`, `${recountSeat.seatName} goes to a recount after an exceptionally narrow first tally.`, recountSeat.stateName), { ...recountSeat, phase: "special" });
  }
  if (rural.length) timeline.push(bulletin("late-rural", "Peti luar bandar tiba lewat", "Late rural boxes arrive", `${rural.length} kawasan luar bandar memasuki kiraan akhir.`, `${rural.length} rural contests enter the late count.`), ...rural);
  if (kingmaker) timeline.push(bulletin("kingmaker", `${kingmaker.name} menjadi penentu`, `${kingmaker.name} emerges as kingmaker`, `Keputusan rapat dan kerusi blok kecil di ${kingmaker.name} boleh menentukan majoriti.`, `Close contests and smaller-bloc seats in ${kingmaker.name} could decide the majority.`, kingmaker.name));
  if (borneo.length) timeline.push(bulletin("borneo-late", "Keputusan Borneo mula tiba", "Borneo results begin arriving", `${borneo.length} kerusi Sabah dan Sarawak kini memasuki papan kiraan.`, `${borneo.length} Sabah and Sarawak seats now enter the board.`), ...borneo);
  timeline.push(bulletin("complete", "Kiraan rasmi lengkap", "Official count complete", `${seats.length} kerusi telah diumumkan.`, `All ${seats.length} seats have been declared.`));
  return timeline;
}

export function electionNightSeatUpdates(timeline: ElectionNightUpdate[]) {
  return timeline.filter((update): update is ElectionNightSeatUpdate => update.kind === "seat");
}
