"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useGameStore } from "../../store/gameStore";
import { setActiveSaveSlot } from "../../store/saveGame";
import { useLang, t } from "../../i18n/useLang";
import { getDatasetById } from "../../data/datasets";
import { states } from "../../data/states";
import { generateConstituencies } from "../../data/constituencies";
import { getScenarioPack, SCENARIO_PACKS, type ScenarioPackId } from "../../data/scenarioPacks";
import { usePremiumStatus } from "../../hooks/usePremiumStatus";

export default function ScenarioStart() {
  const lang = useLang();
  const router = useRouter();
  const { hasUltimate, isLoading } = usePremiumStatus();
  const [packId, setPackId] = useState<ScenarioPackId>("reform-wave-1998");
  const [name, setName] = useState("");
  const [partyId, setPartyId] = useState(getDatasetById("dummy").parties[0].id);
  const parties = getDatasetById("dummy").parties;
  const pack = getScenarioPack(packId)!;
  if (isLoading || !hasUltimate) return null;

  function start() {
    if (!hasUltimate) return;
    const party = parties.find(item => item.id === partyId)!;
    const home = states.find(state => state.id === pack.stateId) ?? states[0];
    const seat = generateConstituencies(home, pack.scope === "prn" ? "dun" : "parliament")[0];
    const store = useGameStore.getState();
    store.resetGame();
    setActiveSaveSlot(null);
    store.setDataset("dummy");
    store.setLeader({ name: name.trim() || party.leader, party: party.name, partyAbbr: party.abbreviation, partyColor: party.color, homeState: home.id, homeConstituencyId: seat.id, homeConstituencyName: seat.name });
    store.setNomination(seat.id, { type: "leader" });
    store.applyScenarioPack(pack.id);
    if (pack.scope === "prn" && pack.prnCandidateId) useGameStore.getState().journeyAction({ type: "prn-candidate", id: pack.prnCandidateId });
    store.startCampaign();
    router.push("/kawasan");
  }

  return <section className="my-5 w-full max-w-[1100px] border border-gold/40 bg-gold/5 p-4">
    <div className="flex flex-wrap items-end justify-between gap-3"><div><div className="text-[9px] font-black tracking-[0.28em] text-gold">{t(lang, "ARKIB SENARIO", "SCENARIO ARCHIVE")}</div><h2 className="mt-1 text-lg font-bold text-white">{t(lang, "Pilih titik perubahan Malaysia", "Choose a Malaysian turning point")}</h2><p className="mt-1 max-w-3xl text-xs leading-relaxed text-text-muted">{t(lang, "Tiga senario berasaskan suasana sejarah dan tiga masa depan alternatif. Semua parti, angka sokongan dan keputusan ialah fiksyen permainan.", "Three scenarios inspired by historical climates and three alternate futures. All parties, support figures and outcomes are fictional gameplay.")}</p></div><div className="text-[10px] font-bold tracking-widest text-cyan">6 {t(lang, "SENARIO", "SCENARIOS")} · PRU/PRN</div></div>

    <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{SCENARIO_PACKS.map(option => {
      const active = option.id === packId;
      return <button key={option.id} type="button" onClick={() => setPackId(option.id)} className="relative p-4 text-left transition-transform hover:-translate-y-0.5" style={{ border: `1px solid ${active ? option.color : "rgb(var(--cyan-rgb)/0.18)"}`, background: active ? `${option.color}12` : "rgba(0,0,0,.18)", boxShadow: active ? `0 0 20px ${option.color}18` : "none" }}>
        <div className="flex items-start justify-between gap-3"><div><span className="text-[9px] font-black tracking-[0.2em]" style={{ color: option.color }}>{option.kind === "historical" ? t(lang, "INSPIRASI SEJARAH", "HISTORICAL-INSPIRED") : t(lang, "MASA DEPAN HIPOTESIS", "HYPOTHETICAL FUTURE")}</span><div className="mt-1 text-xl font-black text-white">{option.year}</div></div><span className="border px-2 py-1 text-[9px] font-black" style={{ borderColor: `${option.color}66`, color: option.color }}>{option.scope.toUpperCase()} · {option.difficulty.toUpperCase()}</span></div>
        <h3 className="mt-3 text-sm font-black" style={{ color: option.color }}>{option.title[lang]}</h3><p className="mt-1 text-[11px] text-white">{option.subtitle[lang]}</p><p className="mt-2 text-[10px] leading-relaxed text-text-muted">{option.premise[lang]}</p>
        <div className="mt-3 flex flex-wrap gap-2 text-[9px] font-bold text-text-muted"><span>{states.find(state => state.id === option.stateId)?.name}</span><span>RM{(option.funds / 1_000_000).toFixed(2)}m</span><span>{t(lang, "Lawan", "Opposition")} {option.oppositionStrength}</span></div>
      </button>;
    })}</div>

    <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
      <div className="border p-4" style={{ borderColor: `${pack.color}55`, background: `${pack.color}08` }}><div className="flex flex-wrap items-start justify-between gap-3"><div><div className="text-[9px] font-black tracking-[0.22em]" style={{ color: pack.color }}>{pack.year} · {pack.scope.toUpperCase()} · {states.find(state => state.id === pack.stateId)?.name}</div><h3 className="mt-1 text-lg font-black text-white">{pack.title[lang]}</h3></div><div className="text-right text-[10px] text-text-muted"><div>{t(lang, "Kepercayaan", "Trust")} {pack.trust}</div><div>{t(lang, "Jentera", "Organisation")} {pack.organisation}</div></div></div>
        <p className="mt-3 text-xs leading-relaxed text-text-muted">{pack.disclaimer?.[lang] ?? t(lang, "Senario masa depan alternatif dengan angka rekaan.", "Alternate-future scenario with fictional figures.")}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">{pack.objectives.map((objective, index) => <div key={objective.id} className="border border-white/10 p-3"><div className="text-[9px] font-black text-gold">0{index + 1}</div><div className="mt-1 text-[11px] font-bold text-white">{objective.title[lang]}</div></div>)}</div>
      </div>
      <div className="space-y-3 border border-cyan/20 p-4"><label className="block text-xs text-text-muted">{t(lang, "Nama pemimpin", "Leader name")}<input aria-label={t(lang, "Nama pemimpin senario", "Scenario leader name")} value={name} onChange={event => setName(event.target.value)} maxLength={60} placeholder={parties.find(item => item.id === partyId)?.leader} className="mt-1 w-full border border-cyan/30 bg-[var(--bg)] p-2 text-white" /></label><label className="block text-xs text-text-muted">{t(lang, "Parti rekaan", "Fictional party")}<select value={partyId} onChange={event => setPartyId(event.target.value)} className="mt-1 w-full border border-cyan/30 bg-[var(--bg)] p-2 text-white">{parties.map(party => <option key={party.id} value={party.id}>{party.name}</option>)}</select></label>
        {/* Sticky so the start button clears the setup page's fixed step footer on laptop-height screens. */}
        <div className="sticky bottom-[118px] z-[71]"><button onClick={start} className="w-full border px-5 py-3 font-bold" style={{ borderColor: pack.color, background: `${pack.color}12`, color: pack.color }}>{t(lang, "Mulakan senario →", "Start scenario →")}</button></div>
      </div>
    </div>
  </section>;
}
