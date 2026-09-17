"use client";

import { availableStories, type StoryChoice } from "../../data/careerStories";
import Image from "next/image";
import { getDatasetById } from "../../data/datasets";
import Link from "next/link";
import { useGameStore } from "../../store/gameStore";
import { ISSUE_DATA, POLICY_DATA, resumeRoute, type Issue } from "../../store/journey";
import { PARTY_MEMBERS } from "../../data/members";
import { useLang, t } from "../../i18n/useLang";

const button = "border border-cyan/30 px-3 py-2 text-sm text-cyan hover:bg-cyan/10 disabled:opacity-40 disabled:cursor-not-allowed text-left";
export default function JourneyPanel({ local = false }: { local?: boolean }) {
  const s = useGameStore();
  const lang = useLang();
  const j = s.journey;
  const campaign = j.chapter === "campaign";
  const term = ["government", "opposition", "rebuilding"].includes(j.chapter);
  const activeCampaign = campaign && s.day < s.totalDays;
  const character = PARTY_MEMBERS.find(m => Object.values(s.nominations).some(n => n?.type === "member" && n.memberId === m.id)) ?? PARTY_MEMBERS.find(m => m.homeState === s.leader.homeState) ?? PARTY_MEMBERS[0];
  const datasetCharacter = getDatasetById(s.dataset).politicians.find(p => p.party === s.leader.partyAbbr || p.party === s.leader.party);
  const characterName = s.dataset === "dummy" ? character?.name ?? s.leader.name : datasetCharacter?.name ?? s.leader.name;
  const storyPhase = campaign ? "campaign" : j.chapter === "government" ? "government" : "opposition";
  const stories = [...availableStories(storyPhase, j.storyChoices), ...(term ? availableStories("term", j.storyChoices) : [])].filter((story, index, all) => all.findIndex(item => item.id === story.id) === index);
  const story = stories[(campaign ? s.day - 1 : Math.floor((s.careerProgress.month - 1) / 3)) % Math.max(1, stories.length)];
  const storyAvailable = !!story && (activeCampaign || term);
  const available = activeCampaign ? j.decisions > 0 : term && s.careerProgress.month < 60 && j.termActions.length < 2;
  const chapter = campaign ? t(lang, "Kempen", "Campaign") : j.chapter === "government" ? t(lang, "Kerajaan", "Government") : j.chapter === "opposition" ? t(lang, "Pembangkang", "Opposition") : j.chapter === "rebuilding" ? t(lang, "Bina semula", "Rebuild") : t(lang, "Mandat", "Mandate");
  return <section aria-label={t(lang, "Taklimat kerjaya", "Career briefing")} className="mb-5 border border-cyan/30 bg-black/20 p-4 text-sm">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3"><Image src={`/avatars/leader-${String(s.leader.avatarIndex + 1).padStart(2, "0")}.png`} alt={s.leader.name} width={44} height={44} className="h-11 w-11 rounded border border-gold/40 object-cover" /><div><div className="text-xs tracking-widest text-gold">{s.leader.partyAbbr} · {t(lang, "PENGGAL", "TERM")} {s.careerProgress.term} · {chapter}</div>
        <h2 className="mt-1 text-lg font-bold text-white">{local ? t(lang, "Janji kepada kawasan anda", "Your constituency commitments") : campaign ? t(lang, "Taklimat hari ini", "Today’s briefing") : t(lang, "Rekod anda sedang dibina", "Your record is taking shape")}</h2><p className="mt-1 text-xs text-text-muted">{s.leader.name}</p></div>
      </div>
      <div className="flex flex-wrap gap-2">
        <Link className={button} href="/kawasan">{t(lang, "Kawasan", "Constituency")}</Link>
        <Link className={button} href={campaign ? "/warroom" : resumeRoute(s)}>{campaign ? t(lang, "Bilik gerakan", "War Room") : t(lang, "Urus penggal", "Manage term")}</Link>
        <Link className={button} href="/load-game">{t(lang, "Simpan / muat", "Save / load")}</Link>
      </div>
    </div>
    <p className="mt-2 text-text-muted">{campaign
      ? t(lang, `${j.decisions}/3 keputusan utama berbaki. Operasi jentera berterusan; lawan bertindak apabila hari dimajukan.`, `${j.decisions}/3 major decisions remaining. Staff operations continue; opponents respond when you advance the day.`)
      : t(lang, `Kepercayaan ${j.trust}/100 · Kestabilan ${Math.round(j.stability)}/100 · Jentera ${j.organisation}/100`, `Trust ${j.trust}/100 · Stability ${Math.round(j.stability)}/100 · Organisation ${j.organisation}/100`)}</p>
    {campaign && !j.onboarded && <div className="mt-3 border border-gold/40 bg-gold/5 p-3">
      <strong className="text-gold">{t(lang, "Langkah pertama: dengar masalah penduduk", "First step: hear your residents")}</strong>
      <p className="mt-1 text-text-muted">{ISSUE_DATA[j.scenario].detail[lang]} {t(lang, "Pilih janji di bawah, lawati komuniti, kemudian majukan hari di Bilik Gerakan. Projek dibina selepas anda membentuk kerajaan.", "Choose a commitment below, visit the community, then advance the day in the War Room. Build public projects after forming government.")}</p>
    </div>}
    {activeCampaign && <div className="mt-3 flex flex-wrap gap-2">
      {([ ["visit", "Lawatan komuniti · RM25,000 · sokongan +1.2", "Community visit · RM25,000 · support +1.2", 25000], ["fundraise", "Kutip dana · +RM90,000", "Fundraise · +RM90,000", 0], ["organise", "Latih jentera · RM40,000 · +40 petugas", "Train organisers · RM40,000 · +40 volunteers", 40000] ] as const).map(([action, ms, en, cost]) => <button key={action} className={button} disabled={!available || j.actionsToday.includes(action) || s.resources.funds < cost} onClick={() => s.journeyAction({ type: "campaign", action })}>{t(lang, ms, en)}</button>)}
      <button className={button} onClick={s.advanceDay}>{t(lang, "Tamat hari →", "End day →")}</button>
    </div>}
    {(j.chapter === "results" || (campaign && s.day >= s.totalDays)) && <Link className={`${button} mt-3 inline-block`} onClick={s.finishElection} href="/results">{t(lang, "Malam keputusan →", "Election night →")}</Link>}
    <div className="mt-4 grid gap-3 md:grid-cols-3">
      {(Object.keys(ISSUE_DATA) as Issue[]).map(id => {
        const issue = ISSUE_DATA[id], pledge = j.pledges.find(p => p.id === id);
        return <div className="border border-white/10 p-3" key={id}>
          <h3 className="font-bold text-white">{issue[lang]}</h3><p className="mt-1 text-xs text-text-muted">{issue.detail[lang]}</p>
          <div className="my-2 text-xs text-gold">RM{issue.cost.toLocaleString()} · {t(lang, "Bajet awam · 2 suku tahun", "Public budget · 2 quarters")}</div>
          {pledge ? <p className="text-cyan">{pledge.status === "delivered" ? t(lang, "✓ Siap — pengundi akan ingat", "✓ Delivered — voters will remember") : pledge.status === "funded" ? t(lang, `Dalam pembinaan · ${pledge.remaining} suku tahun`, `Under construction · ${pledge.remaining} quarters`) : t(lang, "Dijanjikan — menunggu peruntukan", "Promised — awaiting funding")}</p> : <button className={button} disabled={!activeCampaign || !available} onClick={() => s.journeyAction({ type: "pledge", issue: id })}>{t(lang, "Janji · 1 keputusan", "Commit · 1 decision")}</button>}
          {pledge?.status === "promised" && j.chapter === "government" && <button className={`${button} mt-2`} disabled={s.careerProgress.month >= 60 || j.publicBudget < issue.cost} onClick={() => s.journeyAction({ type: "fund", issue: id })}>{t(lang, "Biayai projek", "Fund project")}</button>}
        </div>;
      })}
    </div>
    {term && <div className="mt-4">
      <p className="mb-2 text-gold">{t(lang, `Bajet awam RM${j.publicBudget.toLocaleString()} · ${2 - j.termActions.length}/2 usaha suku tahun berbaki`, `Public budget RM${j.publicBudget.toLocaleString()} · ${Math.max(0, 2 - j.termActions.length)}/2 quarterly actions remaining`)}</p>
      <div className="flex flex-wrap gap-2">
        {j.chapter === "government" && POLICY_DATA.map(p => <button key={p.id} className={button} disabled={!available || j.policies.includes(p.id) || j.publicBudget < p.cost} onClick={() => s.journeyAction({ type: "policy", id: p.id })}>{p[lang]} · RM{p.cost.toLocaleString()} · {t(lang, "kepercayaan", "trust")} +{p.trust} / {t(lang, "kestabilan", "stability")} {p.stability > 0 ? "+" : ""}{p.stability}{j.policies.includes(p.id) ? " ✓" : ""}</button>)}
        {([ ["branches", "Bina cawangan · RM40,000", "Build branches · RM40,000"], ["scrutiny", "Semak dasar · kepercayaan +3", "Scrutinise policy · trust +3"], ["recruit", "Latih calon · RM40,000", "Train candidates · RM40,000"] ] as const).map(([action, ms, en]) => <button className={button} key={action} disabled={!available || j.termActions.includes(action) || (action !== "scrutiny" && s.resources.funds < 40000)} onClick={() => s.journeyAction({ type: "term", action })}>{t(lang, ms, en)}</button>)}
      </div>
    </div>}
    {storyAvailable && story && <div className="mt-4 border border-gold/30 p-3">
      <h3 className="font-bold text-gold">{story.title[lang]} · {characterName} · {t(lang, "Hubungan", "Relationship")} {j.relationships[characterName] ?? 50}/100</h3>
      <p className="my-2 text-text-muted">{story.description[lang]}</p>
      <div className="flex flex-wrap gap-2">{(["help", "compromise", "refuse"] as StoryChoice[]).map(choice => {
        const effects = story.choices[choice].effects;
        const cost = Math.max(0, -(effects.funds ?? 0));
        const effectText = [cost ? `RM${cost.toLocaleString()}` : null, effects.trust ? `${t(lang, "kepercayaan", "trust")} ${effects.trust > 0 ? "+" : ""}${effects.trust}` : null, effects.stability ? `${t(lang, "kestabilan", "stability")} ${effects.stability > 0 ? "+" : ""}${effects.stability}` : null, effects.organisation ? `${t(lang, "jentera", "organisation")} +${effects.organisation}` : null, effects.relationship ? `${t(lang, "hubungan", "relationship")} ${effects.relationship > 0 ? "+" : ""}${effects.relationship}` : null, effects.localSupport ? `${t(lang, "sokongan tempatan", "local support")} +${effects.localSupport}` : null].filter(Boolean).join(" · ");
        return <button key={choice} className={button} disabled={!available || s.resources.funds < cost} onClick={() => s.journeyAction({ type: "story", storyId: story.id, choice, character: characterName })}>{story.choices[choice][lang]} · {effectText}</button>;
      })}</div>
    </div>}
    {j.journal.length > 0 && <div className="mt-4 border-t border-white/10 pt-3" aria-live="polite"><h3 className="text-xs font-bold text-cyan">{t(lang, "SEBAB DAN KESAN", "CAUSE AND EFFECT")}</h3>{j.journal.slice(0, 3).map((entry, i) => <p className="mt-1 text-xs text-text-muted" key={`${entry.id}-${i}`}>{entry[lang]}</p>)}</div>}
  </section>;
}
