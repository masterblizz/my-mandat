"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "../../store/gameStore";
import { setActiveSaveSlot } from "../../store/saveGame";
import { ISSUE_DATA, type Issue } from "../../store/journey";
import { useLang, t } from "../../i18n/useLang";
import { getDatasetById } from "../../data/datasets";
import { states } from "../../data/states";
import { generateConstituencies } from "../../data/constituencies";

export default function ScenarioStart() {
  const lang = useLang(), router = useRouter();
  const [issue, setIssue] = useState<Issue>("flood");
  const [name, setName] = useState("");
  const [stateId, setStateId] = useState("selangor");
  const [partyId, setPartyId] = useState(getDatasetById("dummy").parties[0].id);
  const parties = getDatasetById("dummy").parties;
  function start() {
    const party = parties.find(p => p.id === partyId)!;
    const home = states.find(s => s.id === stateId)!;
    const seat = generateConstituencies(home)[0];
    const store = useGameStore.getState();
    store.resetGame();
    setActiveSaveSlot(null);
    store.setLeader({ name: name.trim() || party.leader, party: party.name, partyAbbr: party.abbreviation, partyColor: party.color, homeState: stateId, homeConstituencyId: seat.id, homeConstituencyName: seat.name });
    store.setNomination(seat.id, { type: "leader" });
    store.updateSettings({ electionScope: "pru", difficulty: "easy", oppositionStrength: 40 });
    useGameStore.setState(s => ({ operations: [], journey: { ...s.journey, scenario: issue } }));
    store.startCampaign();
    router.push("/kawasan");
  }
  return <section className="my-5 w-full max-w-5xl border border-gold/40 bg-gold/5 p-4">
    <h2 className="text-lg font-bold text-gold">{t(lang, "Kempen pertama anda", "Your first campaign")}</h2>
    <p className="my-2 text-sm text-text-muted">{t(lang, "Senario rekaan berpandu · PRU · Mudah · 30 hari. Pilih pemimpin dan isu; keputusan anda dibawa ke penggal dan pilihan raya seterusnya. Tetapan terperinci tersedia di bawah.", "Guided fictional scenario · PRU · Easy · 30 days. Choose your leader and issue; decisions carry into your term and next election. Detailed setup remains below.")}</p>
    <div className="grid gap-3 sm:grid-cols-3">
      <label className="text-xs text-text-muted">{t(lang, "Nama pemimpin", "Leader name")}<input aria-label={t(lang, "Nama pemimpin berpandu", "Guided leader name")} value={name} onChange={e => setName(e.target.value)} maxLength={60} placeholder={parties.find(p => p.id === partyId)?.leader} className="mt-1 w-full border border-cyan/30 bg-[var(--bg)] p-2 text-white" /></label>
      <label className="text-xs text-text-muted">{t(lang, "Parti rekaan", "Fictional party")}<select value={partyId} onChange={e => setPartyId(e.target.value)} className="mt-1 w-full border border-cyan/30 bg-[var(--bg)] p-2 text-white">{parties.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
      <label className="text-xs text-text-muted">{t(lang, "Negeri asal", "Home state")}<select value={stateId} onChange={e => setStateId(e.target.value)} className="mt-1 w-full border border-cyan/30 bg-[var(--bg)] p-2 text-white">{states.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
    </div>
    <div className="my-3 grid gap-2 sm:grid-cols-3">{(Object.keys(ISSUE_DATA) as Issue[]).map(id => <button key={id} aria-pressed={issue === id} onClick={() => setIssue(id)} className={`border p-3 text-left text-sm ${issue === id ? "border-gold text-gold" : "border-cyan/20 text-text-muted"}`}><strong>{ISSUE_DATA[id][lang]}</strong><p className="mt-1 text-xs">{ISSUE_DATA[id].detail[lang]}</p></button>)}</div>
    <button onClick={start} className="border border-gold bg-gold/10 px-5 py-3 font-bold text-gold">{t(lang, "Mulakan kempen berpandu →", "Start guided campaign →")}</button>
  </section>;
}
