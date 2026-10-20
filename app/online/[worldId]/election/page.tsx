"use client";

// PRU for one regional world: stand in a seat, campaign against the other
// players in it, and see who formed the government last cycle.

import Image from "next/image";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLang, t, type Lang } from "../../../i18n/useLang";
import type { OnlineCharacter } from "../../../lib/onlineWorlds";
import { findRegion, regionSeats, type RegionSeat } from "../../../lib/onlineRegions";
import { restoreOnlineSession, useOnlineSessionStore } from "../../../store/onlineSessionStore";

type Phase = "nomination" | "campaign" | "polling" | "complete";
type Election = { id: string; cycle_number: number; status: Phase; nomination_opens_at: string; campaign_opens_at: string; polling_opens_at: string; results_at: string };
type PartyRef = { name: string; abbreviation: string; colour: string } | null;
type CharacterRef = { name: string; avatar_ref: string } | null;
type Candidacy = { id: string; constituency_id: string; character_id: string; party_id: string | null; campaign_score: number; created_at: string; character: CharacterRef; party: PartyRef };
type FeedItem = { id: string; candidacy_id: string; action_type: "walkabout" | "rally" | "attack"; target_candidacy_id: string | null; campaign_day: number; self_delta: number; target_delta: number; backfired: boolean; created_at: string };
type Result = { constituency_id: string; candidacy_id: string; character_id: string; votes: number; vote_share: number; is_winner: boolean; unopposed: boolean; character: CharacterRef; party: PartyRef };
type Summary = { seat_total: number; seats_contested: number; majority_needed: number; government: { bloc: string; seats: number; majority: boolean; head_character_id: string | null } | null; opposition: { bloc: string; seats: number; head_character_id: string | null } | null; blocs: { bloc: string; seats: number; votes: number }[] };
type Office = { office_key: string; term_number: number; holder_character_id: string | null; holder: CharacterRef };
type ElectionState = {
  serverTime: string; regionId: string | null; election: Election; candidacies: Candidacy[];
  myCandidacy: { id: string; constituency_id: string; character_id: string; party_id: string | null; campaign_score: number } | null;
  actionsToday: number; feed: FeedItem[]; lastElection: { id: string; cycle_number: number; summary: Summary | null } | null; lastResults: Result[]; offices: Office[];
};

const ACTIONS = [
  { id: "walkabout", ms: "Turun padang", en: "Walkabout", detailMs: "+4 pasti", detailEn: "+4, guaranteed" },
  { id: "rally", ms: "Ceramah umum", en: "Public rally", detailMs: "+2 hingga +8", detailEn: "+2 to +8" },
  { id: "attack", ms: "Serang lawan", en: "Attack a rival", detailMs: "Lawan −3, anda +1 · 30% memakan diri (−2)", detailEn: "Rival −3, you +1 · 30% backfires (−2)" },
] as const;

function formatLeft(ms: number, lang: Lang) {
  if (ms <= 0) return t(lang, "sebentar lagi", "any moment");
  const h = Math.floor(ms / 3_600_000); const m = Math.floor((ms % 3_600_000) / 60_000);
  if (h >= 24) return t(lang, `${Math.floor(h / 24)} hari ${h % 24} jam`, `${Math.floor(h / 24)}d ${h % 24}h`);
  return t(lang, `${h} jam ${m} minit`, `${h}h ${m}m`);
}

export default function ElectionPage() {
  const { worldId } = useParams<{ worldId: string }>();
  const lang = useLang();
  const [state, setState] = useState<ElectionState | null>(null);
  const [characters, setCharacters] = useState<OnlineCharacter[]>([]);
  const [worldName, setWorldName] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [clockOffset, setClockOffset] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [standSeat, setStandSeat] = useState("");
  const [standCharacter, setStandCharacter] = useState("");
  const [target, setTarget] = useState("");

  const load = useCallback(async () => {
    const response = await fetch(`/api/online/worlds/${worldId}/election`);
    const data = await response.json();
    if (!response.ok) throw new Error(data.error);
    setClockOffset(new Date(data.serverTime).getTime() - Date.now());
    setState(data);
  }, [worldId]);

  useEffect(() => { restoreOnlineSession(); }, []);
  useEffect(() => {
    load().catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load the election."));
    fetch(`/api/online/worlds/${worldId}/characters`).then(async (response) => {
      const data = await response.json(); if (!response.ok) return;
      setWorldName(data.world?.name ?? "");
      const active = (data.characters as OnlineCharacter[]).filter((character) => character.lifecycle_status === "active");
      setCharacters(active);
      const preferred = useOnlineSessionStore.getState().characterId;
      setStandCharacter(active.find((character) => character.id === preferred)?.id ?? active[0]?.id ?? "");
    });
  }, [worldId, load]);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 30_000); return () => window.clearInterval(timer); }, []);

  // Refresh when the next phase is due so the page moves on by itself.
  const election = state?.election;
  const nextAt = election ? new Date(election.status === "nomination" ? election.campaign_opens_at : election.status === "campaign" ? election.polling_opens_at : election.results_at).getTime() : 0;
  const leftMs = nextAt - (now + clockOffset);
  useEffect(() => {
    if (!nextAt) return;
    const wait = Math.max(5_000, nextAt - (Date.now() + clockOffset) + 3_000);
    if (wait > 2_000_000_000) return;
    const timer = window.setTimeout(() => { load().catch(() => {}); }, wait);
    return () => window.clearTimeout(timer);
  }, [nextAt, clockOffset, load]);

  const seats: RegionSeat[] = useMemo(() => regionSeats(state?.regionId), [state?.regionId]);
  const region = findRegion(state?.regionId);
  const bySeat = useMemo(() => {
    const map = new Map<string, Candidacy[]>();
    for (const candidacy of state?.candidacies ?? []) map.set(candidacy.constituency_id, [...(map.get(candidacy.constituency_id) ?? []), candidacy]);
    map.forEach((list) => list.sort((a, b) => b.campaign_score - a.campaign_score));
    return map;
  }, [state?.candidacies]);
  const candidacyById = useMemo(() => new Map((state?.candidacies ?? []).map((candidacy) => [candidacy.id, candidacy])), [state?.candidacies]);
  useEffect(() => { if (!standSeat && seats[0]) setStandSeat(seats[0].id); }, [seats, standSeat]);

  async function post(body: Record<string, unknown>, success: (data: Record<string, unknown>) => string) {
    setBusy(true); setError(""); setNotice("");
    try {
      const response = await fetch(`/api/online/worlds/${worldId}/election`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      setNotice(success(data));
      await load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Something went wrong."); } finally { setBusy(false); }
  }

  if (error && !state) return <main className="min-h-screen p-8 text-white" style={{ background: "var(--bg)" }}><p>{error}</p><Link href={`/online/${worldId}/hub`} className="mt-4 inline-block text-cyan-300">← {t(lang, "Kembali", "Back")}</Link></main>;
  if (!state || !election) return <main className="grid min-h-screen place-items-center text-xs tracking-[.2em] text-cyan" style={{ background: "var(--bg)" }}>{t(lang, "MEMUATKAN PRU…", "LOADING ELECTION…")}</main>;

  const mine = state.myCandidacy;
  const mySeat = mine ? seats.find((seat) => seat.id === mine.constituency_id) : null;
  const rivals = mine ? (bySeat.get(mine.constituency_id) ?? []).filter((candidacy) => candidacy.id !== mine.id) : [];
  const campaignDay = Math.min(5, Math.max(1, Math.floor((now + clockOffset - new Date(election.campaign_opens_at).getTime()) / 86_400_000) + 1));
  const contested = seats.filter((seat) => (bySeat.get(seat.id)?.length ?? 0) >= 2).length;
  const summary = state.lastElection?.summary ?? null;
  const head = state.offices.find((office) => office.office_key === "head_of_government");
  const opposition = state.offices.find((office) => office.office_key === "opposition_leader");
  const seatName = (id: string) => { const seat = seats.find((item) => item.id === id); return seat ? `${seat.code} ${seat.name}` : id; };
  const phases: { id: Phase; ms: string; en: string }[] = [
    { id: "nomination", ms: "Penamaan", en: "Nomination" },
    { id: "campaign", ms: "Kempen", en: "Campaign" },
    { id: "polling", ms: "Mengundi", en: "Polling" },
  ];
  const phaseIndex = phases.findIndex((phase) => phase.id === election.status);

  return <main className="min-h-screen pb-24 text-white" style={{ background: "radial-gradient(circle at top, rgb(var(--gold-rgb)/.08), transparent 40%), var(--bg)" }}>
    <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-cyan-900/70 bg-[#050b13]/95 px-3 py-2 backdrop-blur">
      <Link href={`/online/${worldId}/hub`} className="border border-cyan-800 px-2 py-1 text-[10px] font-bold text-cyan-200" aria-label={t(lang, "Kembali ke bandar", "Back to the city")}>←</Link>
      <div className="min-w-0 flex-1"><p className="truncate text-[9px] font-bold tracking-[.24em] text-gold">{t(lang, `PRU ${election.cycle_number}`, `ELECTION ${election.cycle_number}`)}</p><h1 className="truncate text-sm font-black tracking-[.08em]">{worldName || region?.nameMs}</h1></div>
      <Link href={`/online/${worldId}/play`} className="border border-gold px-2 py-1 text-[10px] font-bold text-gold">{t(lang, "PEJABAT", "OFFICE")}</Link>
    </header>

    <div className="mx-auto max-w-3xl px-4">
      {/* Phase strip */}
      <section className="mt-4 border border-gold/40 bg-black/30 p-3">
        <div className="grid grid-cols-3 gap-1">{phases.map((phase, index) => <div key={phase.id} className="border px-2 py-1.5 text-center text-[10px] font-black tracking-[.14em]" style={{ borderColor: index === phaseIndex ? "var(--gold)" : "rgb(var(--cyan-rgb)/.2)", background: index === phaseIndex ? "rgb(var(--gold-rgb)/.15)" : "transparent", color: index < phaseIndex ? "var(--text-muted)" : index === phaseIndex ? "var(--gold)" : "var(--text-primary)" }}>
          {t(lang, phase.ms, phase.en).toUpperCase()}{phase.id === "campaign" && election.status === "campaign" ? ` ${campaignDay}/5` : ""}
        </div>)}</div>
        <p className="mt-2 text-xs text-text-muted">
          {election.status === "nomination" && t(lang, `Penamaan ditutup dalam ${formatLeft(leftMs, lang)}. Pilih satu kerusi untuk bertanding.`, `Nomination closes in ${formatLeft(leftMs, lang)}. Pick one seat to contest.`)}
          {election.status === "campaign" && t(lang, `Hari mengundi bermula dalam ${formatLeft(leftMs, lang)}. Setiap calon ada 2 aksi kempen sehari.`, `Polling starts in ${formatLeft(leftMs, lang)}. Each candidate gets 2 campaign actions a day.`)}
          {election.status === "polling" && t(lang, `Hari mengundi. Keputusan diumumkan dalam ${formatLeft(leftMs, lang)}.`, `Polling day. Results in ${formatLeft(leftMs, lang)}.`)}
        </p>
        <p className="mt-1 text-[11px] text-cyan-200">{t(lang, `${state.candidacies.length} calon · ${contested}/${seats.length} kerusi dipertandingkan`, `${state.candidacies.length} candidates · ${contested}/${seats.length} seats contested`)}</p>
      </section>

      {error && <p className="mt-3 border border-red-500/50 bg-red-950/40 p-2 text-xs text-red-100">{error}</p>}
      {notice && <p className="mt-3 border border-emerald-500/50 bg-emerald-950/40 p-2 text-xs text-emerald-100">{notice}</p>}

      {/* My candidacy */}
      <section className="mt-4 border border-cyan-800 bg-slate-950/60 p-4">
        <p className="text-[10px] font-bold tracking-[.2em] text-cyan-300">{t(lang, "PENCALONAN ANDA", "YOUR CANDIDACY")}</p>
        {!mine && election.status === "nomination" && (characters.length ? <form className="mt-3 grid gap-2" onSubmit={(event) => { event.preventDefault(); post({ action: "stand", characterId: standCharacter, constituencyId: standSeat }, () => t(lang, "Pencalonan diterima. Bersedia untuk berkempen!", "Nomination accepted. Get ready to campaign!")); }}>
          <label className="text-xs">{t(lang, "Watak", "Character")}<select value={standCharacter} onChange={(event) => setStandCharacter(event.target.value)} className="mt-1 w-full border border-slate-600 bg-black p-2 text-sm">{characters.map((character) => <option key={character.id} value={character.id}>{character.name}</option>)}</select></label>
          <label className="text-xs">{t(lang, "Kerusi", "Seat")}<select value={standSeat} onChange={(event) => setStandSeat(event.target.value)} className="mt-1 w-full border border-slate-600 bg-black p-2 text-sm">{seats.map((seat) => <option key={seat.id} value={seat.id}>{seat.code} · {seat.name} — {t(lang, `${bySeat.get(seat.id)?.length ?? 0} calon`, `${bySeat.get(seat.id)?.length ?? 0} candidates`)}</option>)}</select></label>
          <p className="text-[11px] text-text-muted">{t(lang, "Ahli parti bertanding atas tiket parti (satu calon separti bagi setiap kerusi). Tanpa parti, anda bertanding sebagai calon bebas. Satu pencalonan bagi setiap akaun.", "Party members stand for their party (one candidate per party per seat). Without a party you stand as an independent. One candidacy per account.")}</p>
          <button disabled={busy || !standSeat || !standCharacter} className="border border-gold px-3 py-2 text-xs font-black tracking-[.14em] text-gold disabled:opacity-40">{t(lang, "BERTANDING", "STAND FOR ELECTION")}</button>
        </form> : <p className="mt-2 text-sm text-text-muted">{t(lang, "Cipta watak dahulu untuk bertanding.", "Create a character first to stand.")} <Link className="text-cyan-300 underline" href={`/online/${worldId}/characters`}>{t(lang, "Watak", "Characters")}</Link></p>)}
        {!mine && election.status !== "nomination" && <p className="mt-2 text-sm text-text-muted">{t(lang, "Anda tidak bertanding dalam PRU ini. Penamaan dibuka semula selepas keputusan diumumkan.", "You are not standing in this election. Nomination reopens after the results.")}</p>}
        {mine && <div className="mt-2">
          <p className="text-lg font-black">{mySeat ? `${mySeat.code} ${mySeat.name}` : mine.constituency_id}</p>
          <p className="text-xs text-text-muted">{t(lang, "Indeks kempen", "Campaign index")}: <b className="text-gold">{mine.campaign_score}</b> · {rivals.length ? t(lang, `${rivals.length} lawan`, `${rivals.length} rival${rivals.length > 1 ? "s" : ""}`) : t(lang, "tiada lawan setakat ini", "no rivals yet")}</p>
          {election.status === "nomination" && <button disabled={busy} onClick={() => post({ action: "withdraw", candidacyId: mine.id }, () => t(lang, "Anda telah menarik diri.", "You have withdrawn."))} className="mt-3 border border-red-500/60 px-3 py-1.5 text-[11px] font-bold text-red-200">{t(lang, "TARIK DIRI", "WITHDRAW")}</button>}
          {election.status === "campaign" && <div className="mt-3">
            <p className="text-[11px] font-bold text-cyan-200">{t(lang, `Aksi hari ini: ${state.actionsToday}/2`, `Actions today: ${state.actionsToday}/2`)}</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-3">{ACTIONS.map((action) => {
              const isAttack = action.id === "attack";
              const disabled = busy || state.actionsToday >= 2 || (isAttack && !rivals.length);
              return <div key={action.id} className="border border-slate-700 p-2">
                <p className="text-sm font-black">{t(lang, action.ms, action.en)}</p>
                <p className="text-[10px] text-text-muted">{t(lang, action.detailMs, action.detailEn)}</p>
                {isAttack && rivals.length > 0 && <select value={target} onChange={(event) => setTarget(event.target.value)} className="mt-1 w-full border border-slate-700 bg-black p-1 text-xs"><option value="">{t(lang, "Pilih lawan", "Choose a rival")}</option>{rivals.map((rival) => <option key={rival.id} value={rival.id}>{rival.character?.name} {rival.party ? `(${rival.party.abbreviation})` : t(lang, "(Bebas)", "(Ind.)")}</option>)}</select>}
                <button disabled={disabled || (isAttack && !target)} onClick={() => post({ action: "campaign", candidacyId: mine.id, type: action.id, targetId: isAttack ? target : undefined }, (data) => {
                  const result = data.action as { self_delta: number; backfired: boolean };
                  return result.backfired ? t(lang, `Serangan memakan diri! ${result.self_delta}`, `The attack backfired! ${result.self_delta}`) : t(lang, `Berjaya: ${result.self_delta >= 0 ? "+" : ""}${result.self_delta} indeks kempen.`, `Done: ${result.self_delta >= 0 ? "+" : ""}${result.self_delta} campaign index.`);
                })} className="mt-2 w-full border border-gold px-2 py-1.5 text-[11px] font-black text-gold disabled:opacity-35">{t(lang, "LAKSANA", "GO")}</button>
              </div>;
            })}</div>
          </div>}
          {election.status === "polling" && <p className="mt-3 text-xs text-gold">{t(lang, "Tempoh bertenang. Tiada kempen pada hari mengundi.", "Cooling-off: no campaigning on polling day.")}</p>}
        </div>}
      </section>

      {/* Seats board */}
      <section className="mt-4 border border-cyan-900 p-4">
        <p className="text-[10px] font-bold tracking-[.2em] text-cyan-300">{t(lang, `KERUSI ${region?.nameMs.toUpperCase() ?? ""}`, `${region?.nameEn.toUpperCase() ?? ""} SEATS`)}</p>
        <div className="mt-2 space-y-2">{[...seats].sort((a, b) => (b.id === mine?.constituency_id ? 1 : 0) - (a.id === mine?.constituency_id ? 1 : 0)).map((seat) => {
          const list = bySeat.get(seat.id) ?? [];
          const top = Math.max(10, ...list.map((candidacy) => candidacy.campaign_score + 10));
          return <article key={seat.id} className="border p-2" style={{ borderColor: seat.id === mine?.constituency_id ? "var(--gold)" : "rgb(var(--cyan-rgb)/.15)" }}>
            <div className="flex items-baseline justify-between gap-2"><b className="text-sm">{seat.code} {seat.name}</b><span className="text-[10px] text-text-muted">{list.length >= 2 ? t(lang, `${list.length} calon · bertanding`, `${list.length} candidates · contested`) : list.length === 1 ? t(lang, "1 calon", "1 candidate") : t(lang, "tiada calon", "no candidates")}</span></div>
            {list.map((candidacy) => <div key={candidacy.id} className="mt-1 flex items-center gap-2 text-xs">
              {candidacy.character && <Image src={`/avatars/${candidacy.character.avatar_ref}`} alt="" width={18} height={18} className="h-[18px] w-[18px] rounded-full object-cover" />}
              <span className="w-28 truncate font-bold">{candidacy.character?.name}</span>
              <span className="w-12 text-[10px]" style={{ color: candidacy.party?.colour ?? "var(--text-muted)" }}>{candidacy.party?.abbreviation ?? t(lang, "BEBAS", "IND")}</span>
              <span className="h-1.5 flex-1 overflow-hidden bg-slate-800"><span className="block h-full" style={{ width: `${Math.max(4, ((candidacy.campaign_score + 10) / top) * 100)}%`, background: candidacy.party?.colour ?? "#94a3b8" }} /></span>
              <span className="w-6 text-right tabular-nums text-text-muted">{candidacy.campaign_score}</span>
            </div>)}
          </article>;
        })}</div>
      </section>

      {/* Campaign feed */}
      {state.feed.length > 0 && <section className="mt-4 border border-cyan-900 p-4">
        <p className="text-[10px] font-bold tracking-[.2em] text-cyan-300">{t(lang, "BERITA KEMPEN", "CAMPAIGN NEWS")}</p>
        <ul className="mt-2 space-y-1 text-xs text-text-muted">{state.feed.map((item) => {
          const actor = candidacyById.get(item.candidacy_id); const victim = item.target_candidacy_id ? candidacyById.get(item.target_candidacy_id) : null;
          const who = actor?.character?.name ?? "?"; const where = actor ? seatName(actor.constituency_id) : "";
          const text = item.action_type === "walkabout" ? t(lang, `${who} turun padang di ${where} (+${item.self_delta})`, `${who} went on a walkabout in ${where} (+${item.self_delta})`)
            : item.action_type === "rally" ? t(lang, `${who} berceramah di ${where} (+${item.self_delta})`, `${who} held a rally in ${where} (+${item.self_delta})`)
            : item.backfired ? t(lang, `${who} menyerang ${victim?.character?.name ?? "lawan"} — memakan diri (${item.self_delta})`, `${who} attacked ${victim?.character?.name ?? "a rival"} — it backfired (${item.self_delta})`)
            : t(lang, `${who} menyerang ${victim?.character?.name ?? "lawan"} (${item.target_delta})`, `${who} attacked ${victim?.character?.name ?? "a rival"} (${item.target_delta})`);
          return <li key={item.id}>• {text}</li>;
        })}</ul>
      </section>}

      {/* Last result + government */}
      <section className="mt-4 border border-gold/40 p-4">
        <p className="text-[10px] font-bold tracking-[.2em] text-gold">{state.lastElection ? t(lang, `KEPUTUSAN PRU ${state.lastElection.cycle_number}`, `ELECTION ${state.lastElection.cycle_number} RESULT`) : t(lang, "KERAJAAN", "GOVERNMENT")}</p>
        {!summary && <p className="mt-2 text-sm text-text-muted">{t(lang, "Belum ada PRU yang selesai. Kerajaan pertama dibentuk selepas PRU ini.", "No election has finished yet. The first government forms after this one.")}</p>}
        {summary && <>
          {summary.government ? <p className="mt-2 text-sm">{t(lang, `Kerajaan: ${summary.government.bloc} (${summary.government.seats}/${summary.seat_total} kerusi${summary.government.majority ? ", majoriti" : ", minoriti"})`, `Government: ${summary.government.bloc} (${summary.government.seats}/${summary.seat_total} seats${summary.government.majority ? ", majority" : ", minority"})`)}</p> : <p className="mt-2 text-sm text-text-muted">{t(lang, "Tiada kerusi dimenangi, tiada kerajaan dibentuk.", "No seats were won, so no government formed.")}</p>}
          {head?.holder && <p className="mt-1 text-sm"><span className="text-gold">{t(lang, region?.headMs ?? "Ketua Kerajaan", region?.headEn ?? "Head of government")}:</span> <b>{head.holder.name}</b></p>}
          {opposition?.holder && <p className="text-sm"><span className="text-cyan-300">{t(lang, "Ketua Pembangkang", "Opposition leader")}:</span> <b>{opposition.holder.name}</b></p>}
          <div className="mt-3 flex flex-wrap gap-2">{summary.blocs.filter((bloc) => bloc.seats > 0).map((bloc) => <span key={bloc.bloc} className="border border-slate-700 px-2 py-1 text-[11px]">{bloc.bloc === "BEBAS" ? t(lang, "Bebas", "Independent") : bloc.bloc} · {bloc.seats}</span>)}</div>
          <div className="mt-3 space-y-1 text-xs">{state.lastResults.filter((result) => result.is_winner).map((result) => <p key={result.candidacy_id}><span className="text-text-muted">{seatName(result.constituency_id)}:</span> <b>{result.character?.name}</b> <span style={{ color: result.party?.colour }}>{result.party?.abbreviation ?? t(lang, "BEBAS", "IND")}</span> <span className="text-text-muted">· {result.unopposed ? t(lang, "tanpa bertanding", "unopposed") : `${result.votes.toLocaleString()} ${t(lang, "undi", "votes")} (${result.vote_share}%)`}</span></p>)}</div>
        </>}
      </section>
    </div>
  </main>;
}
