"use client";

import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import Header from "../components/layout/Header";
import StatusBar from "../components/layout/StatusBar";
import TacticalPanel from "../components/layout/TacticalPanel";
import { useGameStore } from "../store/gameStore";
import { computeThreatLevel } from "../store/opponentAI";
import { useLang, t } from "../i18n/useLang";
import { advisors } from "../data/advisors";
import { formatNumber } from "../utils/format";
import { generateConstituencies } from "../data/constituencies";

type ChatMessage = { role: "user" | "assistant"; content: string; source?: "ai" | "offline" };

const QUICK_PROMPT_KEYS = ["situation", "focusStates", "funds", "finalDays"] as const;

export default function AdvisorPage() {
  const lang = useLang();
  const { leader, day, totalDays, resources, states, mediaSentiment, settings, getTotalProjectedSeats, getNationalSupport, opponentLog } = useGameStore();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<"ai" | "offline" | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  const isPrn = settings.electionScope === "prn";
  const prnState = isPrn ? states.find((state) => state.id === settings.prnStateId) ?? states[0] : null;
  const seatTotal = isPrn ? (prnState?.dunSeats ?? 0) : 222;
  const majorityTarget = isPrn ? Math.floor(seatTotal / 2) + 1 : 112;
  const projectedSeats = isPrn ? (prnState?.projectedSeats ?? 0) : getTotalProjectedSeats();
  const nationalSupport = getNationalSupport();
  const support = useMemo(() => (
    isPrn && prnState
      ? { mandat: Math.round(prnState.mandatSupport), lawan: Math.round(prnState.lawanSupport), others: Math.round(prnState.othersSupport) }
      : nationalSupport
  ), [isPrn, prnState, nationalSupport]);
  const alpha = advisors[0];

  // In PRN mode, "weak states" is meaningless (there's only one state in play) —
  // surface that state's weakest DUN seats instead so the advisor stays focused
  // on the negeri the player actually set up for.
  const weakAreas = useMemo(() => {
    if (isPrn && prnState) {
      return generateConstituencies(prnState, "dun")
        .filter((c) => c.winner !== "mandat")
        .sort((a, b) => a.margin - b.margin)
        .map((c) => c.name)
        .slice(0, 6);
    }
    return states.filter((state) => state.mandatSupport < state.lawanSupport).map((state) => state.name).slice(0, 6);
  }, [isPrn, prnState, states]);

  const threatLevel = useMemo(() => computeThreatLevel(opponentLog), [opponentLog]);
  const recentOpponentActions = useMemo(
    () => opponentLog.slice(0, 3).map((a) => ({ type: a.type, narrativeEN: a.narrativeEN, narrativeMS: a.narrativeMS, day: a.day })),
    [opponentLog]
  );

  const gameState = useMemo(() => ({
    day,
    totalDays,
    funds: resources.funds,
    manpower: resources.manpower,
    projectedSeats,
    majorityTarget,
    totalSeats: seatTotal,
    support,
    mediaSentiment,
    leaderName: leader.name,
    party: leader.partyAbbr || leader.party,
    homeSeat: leader.homeConstituencyName,
    scope: isPrn ? `PRN (state election) — ${prnState?.name ?? settings.prnStateId}` : "PRU (general election)",
    weakStates: weakAreas,
    opponentThreatLevel: { label: threatLevel.label, labelMS: threatLevel.labelMS },
    recentOpponentActions,
  }), [day, totalDays, resources, projectedSeats, majorityTarget, seatTotal, support, mediaSentiment, leader, isPrn, prnState, settings.prnStateId, weakAreas, threatLevel, recentOpponentActions]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy]);

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || busy) return;
    const nextMessages: ChatMessage[] = [...messages, { role: "user", content: trimmed }];
    setMessages(nextMessages);
    setInput("");
    setBusy(true);
    try {
      const response = await fetch("/api/advisor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: nextMessages.map(({ role, content }) => ({ role, content })),
          gameState,
          lang,
        }),
      });
      const data = await response.json();
      const source: "ai" | "offline" = data.source === "ai" ? "ai" : "offline";
      setMode(source);
      setMessages((current) => [...current, {
        role: "assistant",
        source,
        content: data.reply || t(lang, "advisor_page.noResponseTryAgain"),
      }]);
    } catch {
      setMode("offline");
      setMessages((current) => [...current, {
        role: "assistant",
        source: "offline",
        content: t(lang, "advisor_page.connectionLostTryAgainShortly"),
      }]);
    } finally {
      setBusy(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    send(input);
  }

  const modeLabel = mode === "ai"
    ? t(lang, "advisor_page.aiOnline")
    : mode === "offline"
    ? t(lang, "advisor_page.simulationModeOffline")
    : t(lang, "advisor_page.ready");
  const modeColor = mode === "ai" ? "var(--neon-green)" : mode === "offline" ? "var(--warn-orange)" : "var(--cyan)";

  return (
    <div className="min-h-screen" style={{ background: "radial-gradient(circle at 15% 0%, rgb(var(--cyan-rgb)/0.10), transparent 32%), var(--bg)" }}>
      <Header />
      <main className="px-6 pb-[54px] pt-[56px]">
        <div className="mb-4 flex items-end justify-between gap-4">
          <div>
            <div className="mb-1 text-[12px] tracking-widest text-text-muted">◇ {t(lang, "advisor_page.warRoomStrategicAdvisor")}</div>
            <h1 className="text-2xl font-black tracking-widest text-white" style={{ fontFamily: "Space Mono, monospace" }}>
              {alpha.name} <span style={{ color: "var(--cyan)" }}>· {alpha.codename}</span>
            </h1>
            <div className="mt-1 text-[11px] tracking-wider" style={{ color: "var(--gold)" }}>{alpha.role} · {alpha.specialty}</div>
          </div>
          <div className="flex items-center gap-2">
            <div className="border px-3 py-2 text-[10px] font-black tracking-[0.2em]" style={{ borderColor: "rgb(var(--gold-rgb)/0.4)", color: "var(--gold)", background: "rgba(3,8,15,0.6)" }}>
              {isPrn ? `${t(lang, "advisor_page.stateFocus")} · ${prnState?.name?.toUpperCase() ?? settings.prnStateId.toUpperCase()}` : t(lang, "advisor_page.nationalFocusPru")}
            </div>
            <div className="border px-3 py-2 text-[10px] font-black tracking-[0.2em]" style={{ borderColor: `color-mix(in srgb, ${modeColor} 45%, transparent)`, color: modeColor, background: "rgba(3,8,15,0.6)" }}>
              <span className="mr-2 inline-block h-1.5 w-1.5 animate-pulse rounded-full align-middle" style={{ background: modeColor }} />
              {modeLabel}
            </div>
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <TacticalPanel title={t(lang, "advisor_page.strategyBriefing")} noPadding>
            <div ref={scrollRef} className="h-[calc(100vh-330px)] min-h-[380px] space-y-3 overflow-y-auto p-4">
              {messages.length === 0 && (
                <div className="border p-4 text-[12px] leading-relaxed text-text-muted" style={{ borderColor: "rgb(var(--cyan-rgb)/0.18)", background: "rgb(var(--cyan-rgb)/0.04)" }}>
                  <div className="mb-1 font-black tracking-widest" style={{ color: "var(--cyan)" }}>{alpha.codename} · {t(lang, "advisor_page.sessionOpen")}</div>
                  {isPrn
                    ? t(lang, "advisor_page.askMeAnythingAboutThePrn", { alphaQuote: alpha.quote, prnStateNameSettings: prnState?.name ?? settings.prnStateId })
                    : t(lang, "advisor_page.askMeAnythingAboutCampaignStrategy", { alphaQuote: alpha.quote })}
                </div>
              )}
              {messages.map((message, index) => (
                <div key={index} className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div
                    className="max-w-[78%] border px-3 py-2 text-[12px] leading-relaxed"
                    style={message.role === "user"
                      ? { borderColor: "rgb(var(--gold-rgb)/0.4)", background: "rgb(var(--gold-rgb)/0.08)", color: "var(--text)" }
                      : { borderColor: "rgb(var(--cyan-rgb)/0.3)", background: "rgba(3,8,15,0.72)", color: "var(--text)" }}
                  >
                    <div className="mb-1 text-[8px] font-black tracking-[0.2em]" style={{ color: message.role === "user" ? "var(--gold)" : "var(--cyan)" }}>
                      {message.role === "user" ? leader.name : `${alpha.codename}${message.source === "offline" ? t(lang, "advisor_page.sim") : ""}`}
                    </div>
                    <div className="whitespace-pre-wrap">{message.content}</div>
                  </div>
                </div>
              ))}
              {busy && (
                <div className="flex justify-start">
                  <div className="border px-3 py-2 text-[12px]" style={{ borderColor: "rgb(var(--cyan-rgb)/0.3)", background: "rgba(3,8,15,0.72)", color: "var(--cyan)" }}>
                    <span className="animate-pulse tracking-[0.3em]">{t(lang, "advisor_page.analysing")} ▮▮▮</span>
                  </div>
                </div>
              )}
            </div>
            <div className="border-t p-3" style={{ borderColor: "rgb(var(--cyan-rgb)/0.16)" }}>
              <div className="mb-2 flex flex-wrap gap-2">
                {QUICK_PROMPT_KEYS.map((promptKey, index) => (
                  <button
                    key={index}
                    onClick={() => send(t(lang, `advisor_page.quickPrompt_${promptKey}`))}
                    disabled={busy}
                    className="border px-2 py-1 text-[10px] font-bold tracking-wider disabled:opacity-40"
                    style={{ borderColor: "rgb(var(--cyan-rgb)/0.3)", color: "var(--cyan)", background: "rgb(var(--cyan-rgb)/0.05)" }}
                  >
                    {t(lang, `advisor_page.quickPrompt_${promptKey}`)}
                  </button>
                ))}
              </div>
              <form onSubmit={onSubmit} className="flex gap-2">
                <input
                  value={input}
                  onChange={(event) => setInput(event.target.value)}
                  placeholder={t(lang, "advisor_page.typeAnOrderOrStrategyQuestion")}
                  className="min-w-0 flex-1 border bg-transparent px-3 py-2 text-[12px] text-white outline-none"
                  style={{ borderColor: "rgb(var(--cyan-rgb)/0.3)", fontFamily: "Space Mono, monospace" }}
                  disabled={busy}
                />
                <button
                  type="submit"
                  disabled={busy || !input.trim()}
                  className="border px-4 py-2 text-[11px] font-black tracking-widest disabled:opacity-40"
                  style={{ borderColor: "rgb(var(--gold-rgb)/0.5)", color: "var(--gold)", background: "rgb(var(--gold-rgb)/0.08)" }}
                >
                  {t(lang, "advisor_page.send")}
                </button>
              </form>
            </div>
          </TacticalPanel>

          <div className="space-y-4">
            <TacticalPanel title={t(lang, "advisor_page.liveCampaignFeed")}>
              <div className="space-y-2 text-[11px] tracking-wider">
                {[
                  [t(lang, "advisor_page.scope"), isPrn ? `PRN · ${prnState?.name ?? settings.prnStateId}` : "PRU · NASIONAL", "var(--gold)"],
                  [t(lang, "advisor_page.day"), `${day}/${totalDays}`, "var(--cyan)"],
                  [t(lang, "advisor_page.funds"), `RM ${formatNumber(resources.funds)}`, "var(--gold)"],
                  [t(lang, "advisor_page.projectedSeats"), `${projectedSeats} / ${majorityTarget}`, projectedSeats >= majorityTarget ? "var(--neon-green)" : "var(--neon-red)"],
                  [t(lang, "advisor_page.support"), `${support.mandat}%`, "var(--cyan)"],
                  [t(lang, "advisor_page.media"), mediaSentiment.toUpperCase(), mediaSentiment === "positive" ? "var(--neon-green)" : mediaSentiment === "negative" ? "var(--neon-red)" : "var(--gold)"],
                  [t(lang, "advisor_page.lawanThreat"), t(lang, threatLevel.labelMS, threatLevel.label), threatLevel.color],
                ].map(([label, value, color], index) => (
                  <div key={index} className="flex items-center justify-between border-b pb-2" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
                    <span className="text-text-muted">{label as string}</span>
                    <span className="font-black" style={{ color: color as string }}>{value as string}</span>
                  </div>
                ))}
                <div className="pt-1 text-[10px] leading-relaxed text-text-muted">
                  {t(lang, "advisor_page.theAdvisorReadsThisDataOn")}
                </div>
              </div>
            </TacticalPanel>

            <TacticalPanel title={t(lang, "advisor_page.advisorRoster")}>
              <div className="space-y-2">
                {advisors.slice(0, 4).map((advisor) => (
                  <div key={advisor.id} className="flex items-center justify-between border p-2 text-[10px] tracking-wider" style={{ borderColor: advisor.id === alpha.id ? "rgb(var(--cyan-rgb)/0.4)" : "rgba(255,255,255,0.08)", background: advisor.id === alpha.id ? "rgb(var(--cyan-rgb)/0.06)" : "transparent" }}>
                    <div>
                      <div className="font-black text-white">{advisor.icon} {advisor.name}</div>
                      <div className="text-text-muted">{advisor.role}</div>
                    </div>
                    <span className="font-black" style={{ color: advisor.id === alpha.id ? "var(--neon-green)" : "var(--text-muted)" }}>
                      {advisor.id === alpha.id ? t(lang, "advisor_page.active") : advisor.codename}
                    </span>
                  </div>
                ))}
              </div>
            </TacticalPanel>
          </div>
        </div>
      </main>
      <StatusBar
        leftText={t(lang, "advisor_page.aiAdvisorAlpha1WarRoom")}
        rightText={mode === "ai" ? "MANDAT//AI · CLAUDE" : t(lang, "advisor_page.localSimulationMode")}
      />
    </div>
  );
}
