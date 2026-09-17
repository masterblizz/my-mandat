"use client";

import { useState } from "react";
import { CAMPAIGN_TONES, getCampaignEvent, previewCampaignEvent, type CampaignEventId, type CampaignEventPreview, type CampaignToneId } from "../../data/campaignEvents";
import { getManifestoPackage } from "../../data/manifestoPackages";
import { useLang, t } from "../../i18n/useLang";
import { useGameStore } from "../../store/gameStore";

export default function CampaignEventModal({ eventId, onClose }: { eventId: CampaignEventId; onClose: () => void }) {
  const lang = useLang();
  const store = useGameStore();
  const event = getCampaignEvent(eventId);
  const [selectedTone, setSelectedTone] = useState<CampaignToneId | null>(null);
  const [resolvedPreview, setResolvedPreview] = useState<CampaignEventPreview | null>(null);
  const scope = store.settings.electionScope === "prn" ? store.states.filter(state => state.id === store.settings.prnStateId) : store.states;
  const title = event && store.settings.electionScope === "prn" && event.prnTitle ? event.prnTitle : event?.title;
  const manifesto = getManifestoPackage(store.journey.manifestoPackageId);
  const result = selectedTone ? store.journey.campaignEvents.find(item => item.term === store.careerProgress.term && item.eventId === eventId && item.toneId === selectedTone) : undefined;

  if (!event || !title) return null;
  const ratingLabel = result ? ({ breakthrough: t(lang, "Cemerlang", "Breakthrough"), solid: t(lang, "Kukuh", "Solid"), mixed: t(lang, "Bercampur", "Mixed"), backlash: t(lang, "Makan diri", "Backlash") }[result.rating]) : "";
  const ratingColor = result?.rating === "breakthrough" ? "var(--neon-green)" : result?.rating === "solid" ? "var(--cyan)" : result?.rating === "mixed" ? "var(--gold)" : "var(--neon-red)";

  function chooseTone(toneId: CampaignToneId) {
    const preview = previewCampaignEvent(eventId, toneId, scope, {
      charisma: store.leader.charisma,
      credibility: store.leader.credibility,
      strategy: store.leader.strategy,
      manifestoId: store.journey.manifestoPackageId,
      mediaSentiment: store.mediaSentiment,
      difficulty: store.settings.difficulty,
    });
    store.runCampaignEvent(eventId, toneId);
    setResolvedPreview(preview);
    setSelectedTone(toneId);
  }

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={result ? onClose : undefined}>
    <div className="w-full max-w-4xl overflow-y-auto border border-gold/45 bg-[#07101b]" style={{ maxHeight: "92vh", boxShadow: "0 0 45px rgb(var(--cyan-rgb)/0.12)" }} onClick={eventClick => eventClick.stopPropagation()}>
      <header className="flex items-start justify-between gap-4 border-b border-cyan/20 px-5 py-4">
        <div><div className="text-[10px] font-bold tracking-[0.25em] text-gold">{t(lang, "ACARA KEMPEN LANGSUNG", "LIVE CAMPAIGN EVENT")}</div><h2 className="mt-1 text-xl font-black uppercase tracking-wider text-white">{title[lang]}</h2><p className="mt-1 text-xs text-text-muted">{event.description[lang]}</p></div>
        {!result && <button className="text-2xl text-text-muted hover:text-white" onClick={onClose}>×</button>}
      </header>

      {!result ? <div className="p-5">
        <div className="mb-4 grid gap-2 sm:grid-cols-4">
          <div className="border border-cyan/15 p-2"><span className="text-[9px] text-text-muted">{t(lang, "AUDIENS", "AUDIENCE")}</span><div className="mt-1 text-xs text-cyan">{event.audience[lang]}</div></div>
          <div className="border border-cyan/15 p-2"><span className="text-[9px] text-text-muted">{t(lang, "KOS", "COST")}</span><div className="mt-1 text-xs text-white">RM{event.cost.toLocaleString()}</div></div>
          <div className="border border-cyan/15 p-2"><span className="text-[9px] text-text-muted">{t(lang, "SUMBER", "RESOURCES")}</span><div className="mt-1 text-xs text-white">{event.mediaCost} {t(lang, "media", "media")} · {event.manpowerCost} {t(lang, "petugas", "staff")}</div></div>
          <div className="border border-cyan/15 p-2"><span className="text-[9px] text-text-muted">{t(lang, "MANIFESTO", "MANIFESTO")}</span><div className="mt-1 text-xs" style={{ color: manifesto?.color ?? "var(--text-muted)" }}>{manifesto?.title[lang] ?? t(lang, "Belum dipilih", "Not selected")}</div></div>
        </div>
        <div className="mb-3 text-center text-[11px] font-bold tracking-[0.2em] text-gold">{t(lang, "PILIH NADA PERSEMBAHAN", "CHOOSE YOUR PERFORMANCE TONE")}</div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {CAMPAIGN_TONES.map(tone => {
            const fit = event.preferredTones.includes(tone.id) ? t(lang, "PADANAN KUAT", "STRONG FIT") : event.riskyTones.includes(tone.id) ? t(lang, "RISIKO TINGGI", "HIGH RISK") : t(lang, "PADANAN SEDERHANA", "PARTIAL FIT");
            const fitColor = event.preferredTones.includes(tone.id) ? "var(--neon-green)" : event.riskyTones.includes(tone.id) ? "var(--neon-red)" : "var(--gold)";
            return <button key={tone.id} onClick={() => chooseTone(tone.id)} className="p-4 text-left transition-transform hover:scale-[1.01]" style={{ border: `1px solid ${tone.color}66`, background: `${tone.color}0d` }}>
              <div className="flex items-start justify-between gap-2"><strong className="text-sm uppercase tracking-wider" style={{ color: tone.color }}>{tone.title[lang]}</strong><span className="text-[8px] font-bold tracking-wider" style={{ color: fitColor }}>{fit}</span></div>
              <p className="mt-2 min-h-[42px] text-[11px] leading-relaxed text-text-muted">{tone.description[lang]}</p>
              <p className="mt-2 text-[10px] text-cyan">↑ {tone.strength[lang]}</p><p className="mt-1 text-[10px] text-amber-300">↓ {tone.risk[lang]}</p>
            </button>;
          })}
        </div>
      </div> : <div className="p-6 text-center">
        <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full border-2 text-3xl font-black" style={{ borderColor: ratingColor, color: ratingColor, boxShadow: `0 0 28px ${ratingColor}44` }}>{result.impact >= 0 ? "+" : ""}{result.impact.toFixed(1)}</div>
        <div className="mt-4 text-xs font-bold tracking-[0.25em]" style={{ color: ratingColor }}>{ratingLabel.toUpperCase()}</div>
        <h3 className="mt-2 text-xl font-black text-white">{title[lang]}</h3>
        <p className="mt-2 text-sm text-text-muted">{t(lang, `Nada ${CAMPAIGN_TONES.find(tone => tone.id === selectedTone)?.title.ms} mengubah sokongan purata ${result.impact >= 0 ? "+" : ""}${result.impact.toFixed(2)} mata.`, `The ${CAMPAIGN_TONES.find(tone => tone.id === selectedTone)?.title.en.toLowerCase()} tone changed average support by ${result.impact >= 0 ? "+" : ""}${result.impact.toFixed(2)} points.`)}</p>
        {resolvedPreview && <div className="mx-auto mt-4 grid max-w-xl grid-cols-2 gap-3 text-left"><div className="border border-cyan/20 p-3"><div className="text-[9px] text-text-muted">{t(lang, "KESAN TERKUAT", "STRONGEST EFFECT")}</div><div className="mt-1 text-sm text-cyan">{resolvedPreview.strongest.stateName} · {resolvedPreview.strongest.impact >= 0 ? "+" : ""}{resolvedPreview.strongest.impact.toFixed(2)}</div></div><div className="border border-gold/20 p-3"><div className="text-[9px] text-text-muted">{t(lang, "KESAN TERLEMAH", "WEAKEST EFFECT")}</div><div className="mt-1 text-sm text-gold">{resolvedPreview.weakest.stateName} · {resolvedPreview.weakest.impact >= 0 ? "+" : ""}{resolvedPreview.weakest.impact.toFixed(2)}</div></div></div>}
        <button className="mt-6 border border-cyan/50 bg-cyan/10 px-8 py-3 text-xs font-bold tracking-widest text-cyan hover:bg-cyan/20" onClick={onClose}>{t(lang, "REKOD & TUTUP", "RECORD & CLOSE")}</button>
      </div>}
    </div>
  </div>;
}
