"use client";

import { availableStories, type StoryChoice } from "../../data/careerStories";
import Image from "next/image";
import { getDatasetById } from "../../data/datasets";
import Link from "next/link";
import { useGameStore } from "../../store/gameStore";
import { ISSUE_DATA, POLICY_DATA, campaignActionYield, resumeRoute, scrutinyTrust, type Issue } from "../../store/journey";
import { CAMPAIGN_EVENTS, campaignEventUnlockDay, isCampaignEventUnlocked } from "../../data/campaignEvents";
import { PARTY_MEMBERS } from "../../data/members";
import { useLang, t } from "../../i18n/useLang";
import { getPrnIssues, prnIssueActionKey } from "../../data/prnIssues";
import { getManifestoPackage, MANIFESTO_PACKAGES, manifestoStateImpact } from "../../data/manifestoPackages";
import { getScenarioPack, scenarioObjectiveProgress } from "../../data/scenarioPacks";

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
  const prnIssues = campaign && s.settings.electionScope === "prn" ? getPrnIssues(s.settings.prnStateId) : [];
  const selectedManifesto = getManifestoPackage(j.manifestoPackageId);
  const manifestoStates = s.settings.electionScope === "prn" ? s.states.filter(state => state.id === s.settings.prnStateId) : s.states;
  const manifestoRanked = selectedManifesto ? manifestoStates.map(state => ({ state, impact: manifestoStateImpact(selectedManifesto.id, state) })).sort((a, b) => b.impact - a.impact) : [];
  const openEvents = activeCampaign ? CAMPAIGN_EVENTS.filter(event => isCampaignEventUnlocked(event, s.day, s.totalDays) && !j.campaignEvents.some(result => result.term === s.careerProgress.term && result.eventId === event.id)) : [];
  const nextEvent = activeCampaign ? CAMPAIGN_EVENTS.filter(event => !isCampaignEventUnlocked(event, s.day, s.totalDays)).sort((a, b) => campaignEventUnlockDay(a, s.totalDays) - campaignEventUnlockDay(b, s.totalDays))[0] : undefined;
  const eventTitle = (event: typeof CAMPAIGN_EVENTS[number]) => (s.settings.electionScope === "prn" && event.prnTitle ? event.prnTitle : event.title)[lang];
  const visitYield = campaignActionYield(j, "visit"), fundYield = campaignActionYield(j, "fundraise"), organiseYield = campaignActionYield(j, "organise");
  const fatigueTag = (factor: number) => factor < 1 ? ` · ${t(lang, "berulang", "repeat")} ${Math.round(factor * 100)}%` : "";
  const scenarioPack = j.scenarioPackTerm === s.careerProgress.term ? getScenarioPack(j.scenarioPackId) : undefined;
  const characterStages = ["member", "organiser", "candidate", "representative", "partyLeader", "nationalLeader", "legacy"] as const;
  const characterStageIndex = Math.max(0, characterStages.indexOf(j.characterStage));
  const characterStageLabel = t(lang,
    ({ member: "Ahli biasa", organiser: "Penggerak cawangan", candidate: "Calon akar umbi", representative: "Wakil rakyat", partyLeader: "Pemimpin parti", nationalLeader: "Pemimpin negara", legacy: "Legasi" } as const)[j.characterStage],
    ({ member: "Party member", organiser: "Branch organiser", candidate: "Grassroots candidate", representative: "Elected representative", partyLeader: "Party leader", nationalLeader: "National leader", legacy: "Legacy" } as const)[j.characterStage],
  );
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
    <div className="mt-3 border-t border-cyan/15 pt-3"><div className="flex items-center justify-between gap-3 text-[10px] font-black tracking-widest"><span style={{ color: "var(--gold)" }}>{t(lang, "PERJALANAN KARAKTER", "CHARACTER JOURNEY")}</span><span className="text-cyan">{characterStageLabel}</span></div><div className="mt-2 grid grid-cols-7 gap-1" aria-label={t(lang, "Kemajuan perjalanan karakter", "Character journey progress")}>{characterStages.map((stage, index) => <span key={stage} className="h-1.5" style={{ background: index <= characterStageIndex ? "var(--gold)" : "rgb(var(--cyan-rgb) / .15)", boxShadow: index === characterStageIndex ? "0 0 8px rgb(var(--gold-rgb) / .72)" : "none" }} />)}</div></div>
    {campaign && !j.onboarded && <div className="mt-3 border border-gold/40 bg-gold/5 p-3">
      <strong className="text-gold">{t(lang, "Langkah pertama: dengar masalah penduduk", "First step: hear your residents")}</strong>
      <p className="mt-1 text-text-muted">{ISSUE_DATA[j.scenario].detail[lang]} {t(lang, "Pilih janji di bawah, lawati komuniti, kemudian majukan hari di Bilik Gerakan. Projek dibina selepas anda membentuk kerajaan.", "Choose a commitment below, visit the community, then advance the day in the War Room. Build public projects after forming government.")}</p>
    </div>}
    {scenarioPack && <div className="mt-3 border p-3" style={{ borderColor: `${scenarioPack.color}66`, background: `${scenarioPack.color}08` }}>
      <div className="flex flex-wrap items-start justify-between gap-2"><div><div className="text-[9px] font-black tracking-[0.2em]" style={{ color: scenarioPack.color }}>{scenarioPack.year} · {scenarioPack.scope.toUpperCase()} · {scenarioPack.kind === "historical" ? t(lang, "INSPIRASI SEJARAH", "HISTORICAL-INSPIRED") : t(lang, "MASA DEPAN HIPOTESIS", "HYPOTHETICAL FUTURE")}</div><strong className="mt-1 block text-white">{scenarioPack.title[lang]}</strong><p className="mt-1 text-xs text-text-muted">{scenarioPack.subtitle[lang]}</p></div><span className="text-[9px] font-bold text-text-muted">{scenarioPack.difficulty.toUpperCase()}</span></div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">{scenarioPack.objectives.map(objective => { const progress = scenarioObjectiveProgress(s, objective.criterion); return <div key={objective.id} className="border p-2.5" style={{ borderColor: progress.complete ? "rgb(var(--neon-green-rgb,21 128 61) / .45)" : "rgba(255,255,255,.1)" }}><div className="flex items-start justify-between gap-2"><span className="text-[10px] font-bold text-white">{objective.title[lang]}</span><span className="text-[10px] font-black" style={{ color: progress.complete ? "var(--neon-green)" : "var(--gold)" }}>{progress.complete ? "✓" : `${progress.value}/${progress.target}`}</span></div><div className="mt-2 h-1 bg-white/10"><div className="h-1" style={{ width: `${Math.min(100, progress.value / Math.max(1, progress.target) * 100)}%`, background: progress.complete ? "var(--neon-green)" : scenarioPack.color }} /></div></div>; })}</div>
    </div>}
    {activeCampaign && !selectedManifesto && <div className="mt-3 border border-gold/35 bg-gold/5 p-3">
      <strong className="text-gold">{t(lang, "Pilih pakej manifesto", "Choose a manifesto package")}</strong>
      <p className="mt-1 text-xs text-text-muted">{t(lang, "Pilihan ini kekal untuk pilihan raya semasa, menggunakan satu keputusan, dan mengubah sokongan mengikut profil pengundi setiap negeri.", "This choice lasts for the current election, uses one decision, and shifts support according to each state’s voter profile.")}</p>
      <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {MANIFESTO_PACKAGES.map(pkg => {
          const impacts = manifestoStates.map(state => ({ state, impact: manifestoStateImpact(pkg.id, state) })).sort((a, b) => b.impact - a.impact);
          const strongest = impacts[0], weakest = impacts[impacts.length - 1];
          const average = impacts.reduce((sum, item) => sum + item.impact, 0) / Math.max(1, impacts.length);
          const signed = (value: number) => `${value >= 0 ? "+" : ""}${value.toFixed(2)}`;
          return <article key={pkg.id} className="flex flex-col border bg-black/20 p-3" style={{ borderColor: `${pkg.color}55` }}>
            <div className="flex items-start justify-between gap-2"><div><h3 className="font-bold text-white">{pkg.title[lang]}</h3><p className="text-xs" style={{ color: pkg.color }}>{pkg.slogan[lang]}</p></div><span className="text-[9px] font-bold tracking-wider text-text-muted">{pkg.preferredChannel === "ceramah" ? t(lang, "CERAMAH", "RALLY") : t(lang, "SOSIAL", "SOCIAL")}</span></div>
            <p className="mt-2 text-xs leading-relaxed text-text-muted">{pkg.summary[lang]}</p>
            <p className="mt-2 text-[10px] text-cyan">↑ {pkg.strengths[lang]}</p>
            <p className="mt-1 text-[10px] text-amber-300">↓ {pkg.risks[lang]}</p>
            <div className="mt-2 text-[10px] text-text-muted">{s.settings.electionScope === "prn" ? `${strongest?.state.name ?? "—"} ${strongest ? signed(strongest.impact) : "—"}` : `${t(lang, "Purata", "Average")} ${signed(average)} · ${strongest?.state.name} ${strongest ? signed(strongest.impact) : "—"} · ${weakest?.state.name} ${weakest ? signed(weakest.impact) : "—"}`}</div>
            <button className={`${button} mt-3 w-full`} disabled={!available || s.resources.funds < pkg.cost} onClick={() => s.journeyAction({ type: "manifesto", id: pkg.id })}>{t(lang, "Lancarkan", "Launch")} · RM{pkg.cost.toLocaleString()} · {t(lang, "jentera", "organisation")} {pkg.organisationDelta >= 0 ? "+" : ""}{pkg.organisationDelta}</button>
          </article>;
        })}
      </div>
    </div>}
    {activeCampaign && selectedManifesto && <div className="mt-3 border bg-black/25 p-3" style={{ borderColor: `${selectedManifesto.color}88` }}>
      <div className="flex flex-wrap items-start justify-between gap-2"><div><strong className="text-white">{t(lang, "Manifesto aktif", "Active manifesto")} · {selectedManifesto.title[lang]}</strong><p className="mt-1 text-xs" style={{ color: selectedManifesto.color }}>{selectedManifesto.slogan[lang]}</p></div><Link className={button} href="/campaign">{selectedManifesto.preferredChannel === "ceramah" ? t(lang, "Bawa ke ceramah →", "Take it to a rally →") : t(lang, "Bawa ke media sosial →", "Take it to social media →")}</Link></div>
      <p className="mt-2 text-xs text-text-muted">{selectedManifesto.summary[lang]}</p>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[10px]"><span className="text-cyan">↑ {selectedManifesto.strengths[lang]}</span><span className="text-amber-300">↓ {selectedManifesto.risks[lang]}</span><span className="text-text-muted">{t(lang, "Terkuat", "Strongest")}: {manifestoRanked[0]?.state.name} {manifestoRanked[0] ? `${manifestoRanked[0].impact >= 0 ? "+" : ""}${manifestoRanked[0].impact.toFixed(2)}` : "—"}</span><span className="text-text-muted">{t(lang, "Risiko", "Risk")}: {manifestoRanked[manifestoRanked.length - 1]?.state.name} {manifestoRanked.length ? `${manifestoRanked[manifestoRanked.length - 1].impact >= 0 ? "+" : ""}${manifestoRanked[manifestoRanked.length - 1].impact.toFixed(2)}` : "—"}</span></div>
    </div>}
    {activeCampaign && prnIssues.length > 0 && <div className="mt-3 border border-cyan/25 bg-cyan/5 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <strong className="text-cyan">{t(lang, `Isu penentu PRN · ${s.states.find(state => state.id === s.settings.prnStateId)?.name ?? s.settings.prnStateId}`, `PRN deciding issues · ${s.states.find(state => state.id === s.settings.prnStateId)?.name ?? s.settings.prnStateId}`)}</strong>
          <p className="mt-1 text-xs text-text-muted">{t(lang, "Pilih isu ini dalam mini-game. Saluran yang sepadan memberi bonus lebih besar; pengulangan memberi pulangan berkurang.", "Choose these issues in a mini-game. The matching channel gives a larger bonus; repeated coverage has diminishing returns.")}</p>
        </div>
        <Link className={button} href="/campaign">{t(lang, "Bawa isu ke kempen →", "Take an issue to campaign →")}</Link>
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        {prnIssues.map(issue => {
          const uses = j.prnIssueActions[prnIssueActionKey(s.careerProgress.term, s.settings.prnStateId, issue.id)] ?? 0;
          return <div key={issue.id} className="border border-white/10 p-2.5">
            <div className="flex items-start justify-between gap-2"><b className="text-white">{issue.title[lang]}</b><span className="text-[9px] font-bold tracking-wider text-gold">{issue.channel === "ceramah" ? t(lang, "CERAMAH", "RALLY") : t(lang, "SOSIAL", "SOCIAL")}</span></div>
            <p className="mt-1 text-xs leading-relaxed text-text-muted">{issue.summary[lang]}</p>
            <div className="mt-2 text-[10px] text-cyan">{issue.voterBloc[lang]} · {uses ? t(lang, `diketengahkan ${uses}×`, `covered ${uses}×`) : t(lang, "belum diketengahkan", "not covered yet")}</div>
          </div>;
        })}
      </div>
    </div>}
    {openEvents.length > 0 && <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border border-gold/60 bg-gold/10 p-3">
      <div><strong className="text-gold">⚡ {t(lang, "Acara besar dibuka", "Major event live")} · {openEvents.map(eventTitle).join(" · ")}</strong><p className="mt-1 text-xs text-text-muted">{t(lang, "Sekali sahaja setiap pilihan raya. Nada yang sepadan dengan audiens boleh mengubah beberapa negeri sekaligus — atau memakan diri.", "Once per election. A tone that fits the audience can swing several states at once — or backfire.")}</p></div>
      <Link className={`${button} border-gold/60 text-gold`} href="/campaign?tab=MINI-GAMES">{t(lang, "Ambil pentas →", "Take the stage →")}</Link>
    </div>}
    {openEvents.length === 0 && nextEvent && <p className="mt-3 text-xs text-text-muted">⏳ {t(lang, `Acara besar seterusnya: ${eventTitle(nextEvent)} pada hari ${campaignEventUnlockDay(nextEvent, s.totalDays)}.`, `Next major event: ${eventTitle(nextEvent)} on day ${campaignEventUnlockDay(nextEvent, s.totalDays)}.`)}</p>}
    {activeCampaign && <div className="mt-3 flex flex-wrap gap-2">
      {([ ["visit", `Lawatan komuniti · RM25,000 · sokongan +${visitYield.support}${fatigueTag(visitYield.factor)}`, `Community visit · RM25,000 · support +${visitYield.support}${fatigueTag(visitYield.factor)}`, 25000], ["fundraise", `Kutip dana · +RM${fundYield.funds.toLocaleString()}${fatigueTag(fundYield.factor)}`, `Fundraise · +RM${fundYield.funds.toLocaleString()}${fatigueTag(fundYield.factor)}`, 0], ["organise", `Latih jentera · RM40,000 · +${organiseYield.volunteers} petugas${fatigueTag(organiseYield.factor)}`, `Train organisers · RM40,000 · +${organiseYield.volunteers} volunteers${fatigueTag(organiseYield.factor)}`, 40000] ] as const).map(([action, ms, en, cost]) => <button key={action} className={button} disabled={!available || j.actionsToday.includes(action) || s.resources.funds < cost} onClick={() => s.journeyAction({ type: "campaign", action })}>{t(lang, ms, en)}</button>)}
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
        {([ ["branches", "Bina cawangan · RM40,000", "Build branches · RM40,000"], ["scrutiny", `Semak dasar · kepercayaan +${scrutinyTrust(j)}`, `Scrutinise policy · trust +${scrutinyTrust(j)}`], ["recruit", "Latih calon · RM40,000", "Train candidates · RM40,000"] ] as const).map(([action, ms, en]) => <button className={button} key={action} disabled={!available || j.termActions.includes(action) || (action !== "scrutiny" && s.resources.funds < 40000)} onClick={() => s.journeyAction({ type: "term", action })}>{t(lang, ms, en)}</button>)}
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
