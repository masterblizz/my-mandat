"use client";

import Image from "next/image";
import Link from "next/link";
import dynamic from "next/dynamic";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useLang, t } from "../../../i18n/useLang";
import { MALAYSIA_HOME_CONSTITUENCIES, type OnlineCharacter, type OnlineWorld } from "../../../lib/onlineWorlds";
import { restoreOnlineSession, useOnlineSessionStore } from "../../../store/onlineSessionStore";

const OnlineWorldCity = dynamic(() => import("../../components/OnlineWorldCity"), { ssr: false, loading: () => <div className="mt-4 min-h-[250px] border border-cyan-900 p-4 text-xs text-cyan">LOADING WORLD CITY…</div> });

type ActivityType = "community_outreach" | "town_hall" | "volunteer_drive";
type WorldEvent = { id: string; public_summary: string; reputation_delta: number };
type WorldParty = { id: string; name: string; abbreviation: string; colour: string; treasury: number };
type PartyMembership = { party_id: string; role: "founder" | "officer" | "member" } | null;
type WorldNomination = { id: string; party_id: string; constituency_id: string; character_id: string; status: string; created_at: string; party: { name: string; abbreviation: string; colour: string } | null; character: { name: string; avatar_ref: string; home_constituency_id: string } | null };
type WorldCoalition = { id: string; name: string; status: string; world_coalition_parties: { party_id: string; party: { name: string; abbreviation: string; colour: string } | null }[] };
type PoliticalOffice = { id: string; office_key: string; status: string; term_number: number; holder: { name: string; avatar_ref: string } | null };

const ACTIVITY_OPTIONS: { id: ActivityType; ms: string; en: string; detailMS: string; detailEN: string }[] = [
  { id: "community_outreach", ms: "Libat urus komuniti", en: "Community outreach", detailMS: "+5 reputasi · +3 kepercayaan sivik", detailEN: "+5 reputation · +3 civic trust" },
  { id: "town_hall", ms: "Dewan rakyat", en: "Town hall", detailMS: "+7 reputasi · +4 kepercayaan sivik", detailEN: "+7 reputation · +4 civic trust" },
  { id: "volunteer_drive", ms: "Gerakan sukarelawan", en: "Volunteer drive", detailMS: "+4 reputasi · +6 kepercayaan sivik", detailEN: "+4 reputation · +6 civic trust" },
];

export default function WorldOverviewPage() {
  const { worldId } = useParams<{ worldId: string }>();
  const lang = useLang(); const router = useRouter();
  const [world, setWorld] = useState<OnlineWorld | null>(null);
  const [character, setCharacter] = useState<OnlineCharacter | null>(null);
  const [turn, setTurn] = useState<{ turn_number: number } | null>(null);
  const [acted, setActed] = useState(false); const [activityType, setActivityType] = useState<ActivityType>("community_outreach");
  const [reputation, setReputation] = useState(0); const [events, setEvents] = useState<WorldEvent[]>([]); const [error, setError] = useState("");
  const [parties, setParties] = useState<WorldParty[]>([]); const [partyMembership, setPartyMembership] = useState<PartyMembership>(null);
  const [nominations, setNominations] = useState<WorldNomination[]>([]); const [partyName, setPartyName] = useState(""); const [partyAbbreviation, setPartyAbbreviation] = useState(""); const [partyColour, setPartyColour] = useState("#00d4ff");
  const [nominationSeat, setNominationSeat] = useState(""); const [politicalBusy, setPoliticalBusy] = useState(false);
  const [coalitions, setCoalitions] = useState<WorldCoalition[]>([]); const [coalitionName, setCoalitionName] = useState("");
  const [offices, setOffices] = useState<PoliticalOffice[]>([]);

  useEffect(() => { restoreOnlineSession(); }, []);
  useEffect(() => {
    fetch(`/api/online/worlds/${worldId}/characters`).then(async response => {
      const data = await response.json(); if (!response.ok) throw new Error(data.error);
      const selected = data.characters.find((item: OnlineCharacter) => item.id === useOnlineSessionStore.getState().characterId);
      if (!selected) { router.replace(`/online/${worldId}/characters`); return null; }
      setWorld(data.world); setCharacter(selected);
      return fetch(`/api/online/worlds/${worldId}/community`);
    }).then(async response => {
      if (!response) return; const data = await response.json(); if (!response.ok) throw new Error(data.error);
      setTurn(data.turn); setReputation(data.reputation ?? 0); setEvents(data.events ?? []);
      setActed(data.activities.some((activity: { character_id: string }) => activity.character_id === useOnlineSessionStore.getState().characterId));
    }).catch(reason => setError(reason.message ?? "Unable to load world."));
  }, [worldId, router]);

  const loadPoliticalData = useCallback(async () => {
    const [partyResponse, nominationResponse, coalitionResponse, governmentResponse] = await Promise.all([
      fetch(`/api/online/worlds/${worldId}/parties`), fetch(`/api/online/worlds/${worldId}/nominations`), fetch(`/api/online/worlds/${worldId}/coalitions`), fetch(`/api/online/worlds/${worldId}/government`),
    ]);
    const partyData = await partyResponse.json(); const nominationData = await nominationResponse.json(); const coalitionData = await coalitionResponse.json(); const governmentData = await governmentResponse.json();
    if (!partyResponse.ok) throw new Error(partyData.error ?? "Unable to load parties.");
    if (!nominationResponse.ok) throw new Error(nominationData.error ?? "Unable to load nominations.");
    if (!coalitionResponse.ok) throw new Error(coalitionData.error ?? "Unable to load coalitions.");
    if (!governmentResponse.ok) throw new Error(governmentData.error ?? "Unable to load government records.");
    setParties(partyData.parties ?? []); setPartyMembership(partyData.membership ?? null); setNominations(nominationData.nominations ?? []); setCoalitions(coalitionData.coalitions ?? []); setOffices(governmentData.offices ?? []);
  }, [worldId]);
  useEffect(() => { loadPoliticalData().catch(reason => setError(reason.message ?? "Unable to load political data.")); }, [loadPoliticalData]);

  async function submitActivity() {
    if (!character) return;
    const response = await fetch(`/api/online/worlds/${worldId}/community`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ characterId: character.id, constituencyId: character.home_constituency_id, activityType }) });
    const data = await response.json(); if (!response.ok) { setError(data.error); return; } setActed(true);
  }
  async function createParty(event: React.FormEvent) {
    event.preventDefault(); setPoliticalBusy(true); setError("");
    try {
      const response = await fetch(`/api/online/worlds/${worldId}/parties`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: partyName, abbreviation: partyAbbreviation, colour: partyColour }) });
      const data = await response.json(); if (!response.ok) throw new Error(data.error); setPartyName(""); setPartyAbbreviation(""); await loadPoliticalData();
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to create party."); } finally { setPoliticalBusy(false); }
  }
  async function joinParty(partyId: string) {
    setPoliticalBusy(true); setError("");
    try { const response = await fetch(`/api/online/worlds/${worldId}/parties/join`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ partyId }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); await loadPoliticalData(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to join party."); } finally { setPoliticalBusy(false); }
  }
  async function submitNomination(event: React.FormEvent) {
    event.preventDefault(); if (!character || !partyMembership) return; setPoliticalBusy(true); setError("");
    try { const response = await fetch(`/api/online/worlds/${worldId}/nominations`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ partyId: partyMembership.party_id, characterId: character.id, constituencyId: nominationSeat }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setNominationSeat(""); await loadPoliticalData(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to record nomination."); } finally { setPoliticalBusy(false); }
  }
  async function createCoalition(event: React.FormEvent) {
    event.preventDefault(); setPoliticalBusy(true); setError("");
    try { const response = await fetch(`/api/online/worlds/${worldId}/coalitions`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: coalitionName }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setCoalitionName(""); await loadPoliticalData(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to form coalition."); } finally { setPoliticalBusy(false); }
  }
  async function joinCoalition(coalitionId: string) {
    setPoliticalBusy(true); setError("");
    try { const response = await fetch(`/api/online/worlds/${worldId}/coalitions/join`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ coalitionId }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); await loadPoliticalData(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to join coalition."); } finally { setPoliticalBusy(false); }
  }
  if (error) return <main className="min-h-screen p-8 text-white">{error}</main>;
  if (!world || !character) return <main className="min-h-screen p-8 text-white">{t(lang, "Mengesahkan watak…", "Validating character…")}</main>;
  const home = MALAYSIA_HOME_CONSTITUENCIES.find((seat) => seat.id === character.home_constituency_id);
  const ownParty = partyMembership ? parties.find((party) => party.id === partyMembership.party_id) ?? null : null;
  const mayNominate = partyMembership?.role === "founder" || partyMembership?.role === "officer";
  return <main className="min-h-screen p-5 text-white" style={{ background: "var(--bg)" }}><div className="mx-auto max-w-4xl">
    <p className="text-[10px] tracking-[.28em] text-cyan-300">{world.name.toUpperCase()}{" · "}WORLD OVERVIEW</p>
    <section className="mt-4 flex gap-4 border border-cyan-900 bg-slate-950/60 p-5"><Image src={`/avatars/${character.avatar_ref}`} alt="" width={90} height={120}/><div><h1 className="text-3xl font-black">{character.name}</h1><p className="mt-2 text-sm">{t(lang, "Kawasan asal", "Home seat")}: {home?.code} · {home?.name}</p><p className="mt-2 text-cyan-200">{t(lang, "Reputasi dunia", "World reputation")}: {reputation}</p></div></section>
    <OnlineWorldCity worldName={world.name} characterName={character.name} partyCount={parties.length} lang={lang} />
    <section className="mt-4 border border-gold/40 p-4"><p className="text-[10px] tracking-[.2em] text-gold">{t(lang, "AKTIVITI KOMUNITI", "COMMUNITY ACTIVITY")}</p><h2 className="mt-1 font-bold">{turn ? t(lang, `Giliran dunia ${turn.turn_number}`, `World turn ${turn.turn_number}`) : t(lang, "Tiada giliran aktif", "No active turn")}</h2><div className="mt-3 grid gap-2">{ACTIVITY_OPTIONS.map(option => <label key={option.id} className="border border-slate-700 p-2 text-sm"><input type="radio" disabled={acted} checked={activityType === option.id} onChange={() => setActivityType(option.id)} className="mr-2"/><strong>{lang === "ms" ? option.ms : option.en}</strong><span className="ml-2 text-xs text-text-muted">{lang === "ms" ? option.detailMS : option.detailEN}</span></label>)}</div><button disabled={!turn || acted} onClick={submitActivity} className="mt-3 border border-gold px-3 py-2 text-xs font-bold text-gold disabled:opacity-40">{acted ? t(lang, "AKTIVITI DIREKOD", "ACTIVITY RECORDED") : t(lang, "HANTAR TINDAKAN", "SUBMIT ACTION")}</button></section>
    <section className="mt-4 border border-cyan-900 p-4"><p className="text-[10px] tracking-[.2em] text-cyan-300">{t(lang, "LAPORAN DUNIA", "WORLD REPORTS")}</p>{events.length ? events.map(event => <p className="mt-2 text-sm text-text-muted" key={event.id}>{event.public_summary} <span className="text-cyan-200">+{event.reputation_delta}</span></p>) : <p className="mt-2 text-sm text-text-muted">{t(lang, "Belum ada laporan diselesaikan.", "No resolved reports yet.")}</p>}</section>
    <section className="mt-4 border border-cyan-900 p-4">
      <p className="text-[10px] tracking-[.2em] text-cyan-300">{t(lang, "PARTI DUNIA", "WORLD PARTIES")}</p>
      <p className="mt-1 text-sm text-text-muted">{t(lang, "Keahlian parti dimiliki oleh akaun dalam dunia ini, bukan oleh watak individu.", "Party membership belongs to an account within this world, not to an individual character.")}</p>
      {ownParty ? <div className="mt-3 border-l-4 p-3" style={{ borderColor: ownParty.colour, background: "rgb(var(--bg-rgb) / .5)" }}><b>{ownParty.abbreviation} · {ownParty.name}</b><p className="mt-1 text-xs text-text-muted">{t(lang, "Peranan anda", "Your role")}: {partyMembership?.role} · {t(lang, "Perbendaharaan", "Treasury")}: {ownParty.treasury}</p></div> : <form onSubmit={createParty} className="mt-3 grid gap-2 border border-gold/30 p-3 sm:grid-cols-[1fr_90px_110px_auto]"><input value={partyName} onChange={event => setPartyName(event.target.value)} required maxLength={60} placeholder={t(lang, "Nama parti", "Party name")} className="border border-slate-700 bg-black p-2 text-sm"/><input value={partyAbbreviation} onChange={event => setPartyAbbreviation(event.target.value.toUpperCase())} required maxLength={8} placeholder={t(lang, "Singkatan", "Abbreviation")} className="border border-slate-700 bg-black p-2 text-sm"/><input value={partyColour} onChange={event => setPartyColour(event.target.value)} required pattern="#[0-9A-Fa-f]{6}" aria-label={t(lang, "Warna parti heks", "Party hex colour")} className="border border-slate-700 bg-black p-2 text-sm"/><button disabled={politicalBusy} className="border border-gold px-3 py-2 text-xs font-bold text-gold">{t(lang, "TUBUH PARTI", "FORM PARTY")}</button></form>}
      <div className="mt-3 grid gap-2 sm:grid-cols-2">{parties.length ? parties.map(party => <article key={party.id} className="border p-3" style={{ borderColor: party.colour }}><div className="flex items-center justify-between gap-2"><b>{party.abbreviation} · {party.name}</b>{!partyMembership && <button disabled={politicalBusy} onClick={() => joinParty(party.id)} className="border px-2 py-1 text-[10px] font-bold" style={{ borderColor: party.colour, color: party.colour }}>{t(lang, "SERTAI", "JOIN")}</button>}</div><p className="mt-1 text-xs text-text-muted">{t(lang, "Perbendaharaan", "Treasury")}: {party.treasury}</p></article>) : <p className="text-sm text-text-muted">{t(lang, "Belum ada parti ditubuhkan.", "No parties have been formed yet.")}</p>}</div>
    </section>
    <section className="mt-4 border border-gold/40 p-4">
      <p className="text-[10px] tracking-[.2em] text-gold">{t(lang, "PENCALONAN", "NOMINATIONS")}</p>
      <p className="mt-1 text-sm text-text-muted">{t(lang, "Ini ialah rekod pencalonan parti. Keputusan rasmi dan pengiraan pilihan raya belum dibuka dalam dunia ini.", "This is a party nomination ledger. Official results and election counting are not open in this world yet.")}</p>
      {mayNominate && <form onSubmit={submitNomination} className="mt-3 flex flex-col gap-2 sm:flex-row"><select value={nominationSeat} onChange={event => setNominationSeat(event.target.value)} required className="min-w-0 flex-1 border border-slate-700 bg-black p-2 text-sm"><option value="">{t(lang, "Pilih kerusi Parlimen", "Choose a parliamentary seat")}</option>{MALAYSIA_HOME_CONSTITUENCIES.map(seat => <option key={seat.id} value={seat.id}>{seat.code} · {seat.name}</option>)}</select><button disabled={politicalBusy || !nominationSeat} className="border border-gold px-3 py-2 text-xs font-bold text-gold">{t(lang, "NAMA CALON AKTIF", "NOMINATE ACTIVE CHARACTER")}</button></form>}
      {partyMembership && !mayNominate && <p className="mt-3 text-xs text-text-muted">{t(lang, "Hanya pengasas atau pegawai parti boleh mencalonkan watak.", "Only party founders or officers can nominate characters.")}</p>}
      <div className="mt-3 space-y-2">{nominations.length ? nominations.map(nomination => { const seat = MALAYSIA_HOME_CONSTITUENCIES.find(item => item.id === nomination.constituency_id); return <article key={nomination.id} className="border border-slate-800 p-3 text-sm"><b style={{ color: nomination.party?.colour }}>{nomination.party?.abbreviation ?? t(lang, "PARTI", "PARTY")}</b><span className="text-text-muted"> · {nomination.character?.name ?? t(lang, "Watak", "Character")} → {seat ? `${seat.code} · ${seat.name}` : nomination.constituency_id}</span><span className="ml-2 text-[10px] uppercase text-gold">{nomination.status}</span></article>; }) : <p className="text-sm text-text-muted">{t(lang, "Belum ada pencalonan direkodkan.", "No nominations have been recorded.")}</p>}</div>
    </section>
    <section className="mt-4 border border-cyan-900 p-4">
      <p className="text-[10px] tracking-[.2em] text-cyan-300">{t(lang, "GABUNGAN", "COALITIONS")}</p>
      <p className="mt-1 text-sm text-text-muted">{t(lang, "Gabungan ialah pakatan parti yang direkodkan secara terbuka. Ia tidak melantik kerajaan atau memberi jawatan secara automatik.", "A coalition is a publicly recorded party alliance. It does not appoint a government or grant office automatically.")}</p>
      {mayNominate && <form onSubmit={createCoalition} className="mt-3 flex flex-col gap-2 sm:flex-row"><input value={coalitionName} onChange={event => setCoalitionName(event.target.value)} required minLength={3} maxLength={60} placeholder={t(lang, "Nama gabungan", "Coalition name")} className="min-w-0 flex-1 border border-slate-700 bg-black p-2 text-sm"/><button disabled={politicalBusy} className="border border-cyan px-3 py-2 text-xs font-bold text-cyan">{t(lang, "CADANG GABUNGAN", "PROPOSE COALITION")}</button></form>}
      <div className="mt-3 space-y-2">{coalitions.length ? coalitions.map(coalition => { const partyIds = coalition.world_coalition_parties.map(item => item.party_id); const mayJoin = mayNominate && ownParty && !partyIds.includes(ownParty.id); return <article key={coalition.id} className="border border-slate-800 p-3"><div className="flex flex-wrap items-center justify-between gap-2"><div><b>{coalition.name}</b><span className="ml-2 text-[10px] uppercase text-gold">{coalition.status}</span></div>{mayJoin && <button disabled={politicalBusy} onClick={() => joinCoalition(coalition.id)} className="border border-cyan px-2 py-1 text-[10px] font-bold text-cyan">{t(lang, "SERTAI DENGAN PARTI SAYA", "JOIN WITH MY PARTY")}</button>}</div><p className="mt-1 text-xs text-text-muted">{coalition.world_coalition_parties.map(item => item.party?.abbreviation ?? t(lang, "PARTI", "PARTY")).join(" · ")}</p></article>; }) : <p className="text-sm text-text-muted">{t(lang, "Belum ada gabungan dicadangkan.", "No coalitions have been proposed.")}</p>}</div>
    </section>
    <section className="mt-4 border border-gold/40 p-4">
      <p className="text-[10px] tracking-[.2em] text-gold">{t(lang, "PARLIMEN & KERAJAAN", "PARLIAMENT & GOVERNMENT")}</p>
      {offices.length ? <div className="mt-3 space-y-2">{offices.map(office => <article key={office.id} className="border border-slate-800 p-3 text-sm"><b>{office.office_key.replace(/_/g, " ")}</b><span className="ml-2 text-[10px] uppercase text-gold">{office.status}</span><p className="mt-1 text-text-muted">{office.holder?.name ?? t(lang, "Kosong", "Vacant")} · {t(lang, "Penggal", "Term")} {office.term_number}</p></article>)}</div> : <p className="mt-2 text-sm text-text-muted">{t(lang, "Tiada kerajaan atau jawatan rasmi lagi. Hanya penyelesaian pilihan raya server boleh mewujudkan rekod ini.", "There is no official government or office yet. Only server-side election resolution can create these records.")}</p>}
    </section>
    <Link className="mt-5 inline-block border border-cyan-500 px-4 py-2 text-xs font-bold text-cyan-200" href={`/online/${worldId}/characters`}>{t(lang, "TUKAR WATAK", "SWITCH CHARACTER")}</Link>
  </div></main>;
}
