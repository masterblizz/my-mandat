"use client";
import { useState } from "react";
import Header from "../components/layout/Header";
import StatusBar from "../components/layout/StatusBar";
import TacticalPanel from "../components/layout/TacticalPanel";
import StatBar from "../components/ui/StatBar";
import TrendLine from "../components/charts/TrendLine";
import { keyMessages, messagePerformanceHistory, channelEffectiveness, Message } from "../data/messages";
import { useGameStore, Operation } from "../store/gameStore";
import { useLang, t } from "../i18n/useLang";

function opStatusColor(status: string): string {
  if (status === "active") return "var(--neon-green)";
  if (status === "ongoing") return "var(--cyan)";
  if (status === "planned") return "var(--gold)";
  return "var(--text-muted)";
}

function opStatusLabel(status: string): string {
  if (status === "active") return "ACTIVE";
  if (status === "ongoing") return "RUNNING";
  if (status === "planned") return "SCHEDULED";
  return "COMPLETED";
}

function EffectivenessColor(eff: number): string {
  if (eff >= 60) return "var(--neon-green)";
  if (eff >= 40) return "var(--gold)";
  return "var(--warn-orange)";
}

export default function MessagingPage() {
  const lang = useLang();
  const [selectedMsg, setSelectedMsg] = useState<Message | null>(keyMessages[0]);
  const [deployedAll, setDeployedAll] = useState(false);
  const { operations, states, day, totalDays } = useGameStore();

  const sortedChannels = [...channelEffectiveness].sort((a, b) => b.effectiveness - a.effectiveness);

  const activeCampaigns = operations.filter((op) => op.status !== "completed");

  const topSwingStates = [...states]
    .sort((a, b) => b.swingProbability - a.swingProbability)
    .slice(0, 3);

  const recommendations = [
    topSwingStates[0]
      ? `Focus ceramah in ${topSwingStates[0].name} — swing probability ${topSwingStates[0].swingProbability}%`
      : "Increase ceramah frequency in contested states",
    `${totalDays - day} days remain — accelerate digital outreach in Klang Valley`,
    states.find((s) => s.mandatSupport < 45)
      ? `Boost messaging in ${states.filter((s) => s.mandatSupport < 45)[0]?.name} — support below 45%`
      : "Maintain momentum — all states holding above threshold",
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", fontFamily: "'Space Mono', monospace" }}>
      <Header />
      <StatusBar leftText="» MESSAGING CENTER · NARRATIVE COMMAND" rightText="SELECT MESSAGE · DEPLOY CAMPAIGN" />

      <main className="pt-[56px] pb-[52px] px-6 min-h-screen">

        {/* Title Bar */}
        <div className="mb-4 py-3" style={{ borderBottom: "1px solid rgb(var(--gold-rgb) / 0.3)" }}>
          <h1 className="text-[19px] font-bold tracking-widest uppercase" style={{ color: "var(--gold)" }}>
            {t(lang, "PUSAT PESANAN", "MESSAGING CENTER")}
            <span className="text-[14px] font-normal ml-3" style={{ color: "var(--text-muted)" }}>— {t(lang, "BENTUK NARATIF", "SHAPE THE NARRATIVE")}</span>
          </h1>
        </div>

        <div className="flex gap-4">

          {/* LEFT COLUMN: Key Messages */}
          <div style={{ flex: "0 0 28%" }} className="flex flex-col gap-4">
            <TacticalPanel title="KEY MESSAGES" noPadding={true}>
              <div style={{ maxHeight: "420px", overflowY: "auto" }}>
                {keyMessages.map((msg) => {
                  const isSelected = selectedMsg?.id === msg.id;
                  const effColor = EffectivenessColor(msg.effectiveness);
                  return (
                    <div
                      key={msg.id}
                      onClick={() => setSelectedMsg(isSelected ? null : msg)}
                      className="p-3 cursor-pointer transition-all"
                      style={{
                        borderBottom: "1px solid rgb(var(--cyan-rgb) / 0.08)",
                        borderLeft: isSelected ? `3px solid var(--gold)` : "3px solid transparent",
                        background: isSelected ? "rgb(var(--gold-rgb) / 0.05)" : "transparent",
                      }}
                    >
                      <div className="text-[13px] font-bold tracking-wider uppercase" style={{ color: isSelected ? "var(--gold)" : "#ffffff" }}>
                        {lang === "ms" ? msg.titleBM : msg.titleEN}
                      </div>
                      <StatBar
                        label="EFF"
                        value={msg.effectiveness}
                        max={100}
                        color={effColor}
                        animate={true}
                        size="sm"
                      />
                    </div>
                  );
                })}
              </div>
              <div className="p-3" style={{ borderTop: "1px solid rgb(var(--cyan-rgb) / 0.12)" }}>
                <button
                  className="w-full py-2 text-[12px] tracking-widest uppercase transition-colors"
                  style={{
                    border: "1px dashed rgb(var(--cyan-rgb) / 0.3)",
                    color: "var(--text-muted)",
                    background: "none",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLElement).style.color = "var(--cyan)";
                    (e.currentTarget as HTMLElement).style.borderColor = "rgb(var(--cyan-rgb) / 0.7)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLElement).style.color = "var(--text-muted)";
                    (e.currentTarget as HTMLElement).style.borderColor = "rgb(var(--cyan-rgb) / 0.3)";
                  }}
                  onClick={() => setSelectedMsg(null)}
                >
                  {t(lang, "+ MESEJ BARU", "+ CREATE NEW MESSAGE")}
                </button>
              </div>
            </TacticalPanel>

            {/* Selected Message Expanded */}
            {selectedMsg && (
              <TacticalPanel goldBorder={true}>
                <div className="text-[11px] tracking-widest mb-1" style={{ color: "var(--gold)" }}>{t(lang, "MESEJ DIPILIH", "SELECTED MESSAGE")}</div>
                <div className="text-[14px] font-bold tracking-wider mb-1" style={{ color: "var(--gold)" }}>
                  {lang === "ms" ? selectedMsg.titleBM : selectedMsg.titleEN}
                </div>
                <div className="text-[12px] mb-3" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
                  {selectedMsg.description}
                </div>
                <div className="text-[11px] mb-1.5" style={{ color: "var(--text-muted)" }}>
                  <span style={{ color: "var(--cyan)" }}>TARGET:</span> {selectedMsg.targetDemographic}
                </div>
                <div className="flex flex-wrap gap-1 mt-2">
                  {selectedMsg.channels.map((ch) => (
                    <span
                      key={ch}
                      className="text-[11px] px-2 py-0.5 tracking-wider uppercase"
                      style={{
                        border: "1px solid rgb(var(--cyan-rgb) / 0.4)",
                        color: "var(--cyan)",
                        background: "rgb(var(--cyan-rgb) / 0.08)",
                      }}
                    >
                      {ch}
                    </span>
                  ))}
                </div>
              </TacticalPanel>
            )}
          </div>

          {/* CENTER COLUMN: Performance + Active Campaigns */}
          <div style={{ flex: "1" }} className="flex flex-col gap-4">
            <TacticalPanel title="MESSAGE PERFORMANCE — 6 WEEKS">
              <TrendLine
                data={messagePerformanceHistory}
                lines={[
                  { key: "ekonomi",    color: "var(--cyan)", label: "EKONOMI" },
                  { key: "peluang",    color: "var(--gold)", label: "PELUANG" },
                  { key: "pendidikan", color: "var(--neon-green)", label: "PENDIDIKAN" },
                ]}
                xKey="week"
                height={200}
                showGrid={true}
                showLegend={true}
              />
            </TacticalPanel>

            <TacticalPanel title={`ACTIVE CAMPAIGNS — DAY ${day}/${totalDays}`}>
              <div className="flex flex-col gap-2">
                {activeCampaigns.length === 0 && (
                  <div className="text-[12px] text-center py-4" style={{ color: "var(--text-muted)" }}>
                    NO ACTIVE CAMPAIGNS · DEPLOY FROM CAMPAIGN HQ
                  </div>
                )}
                {activeCampaigns.map((op) => {
                  const color = opStatusColor(op.status);
                  const label = opStatusLabel(op.status);
                  return (
                    <div
                      key={op.id}
                      className="flex items-center justify-between py-2 px-3"
                      style={{
                        background: "rgb(var(--cyan-rgb) / 0.03)",
                        border: "1px solid rgb(var(--cyan-rgb) / 0.12)",
                      }}
                    >
                      <div>
                        <div className="text-[13px] font-bold text-white tracking-wider uppercase">{op.name}</div>
                        <div className="text-[11px] mt-0.5" style={{ color: "var(--text-muted)" }}>
                          {op.location.toUpperCase()}{op.stateIds.length > 1 ? ` · ${op.stateIds.length} STATES` : ""}
                        </div>
                      </div>
                      <span
                        className="text-[11px] px-2 py-1 tracking-widest font-bold"
                        style={{
                          color,
                          border: `1px solid ${color}44`,
                          background: `${color}11`,
                        }}
                      >
                        {label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </TacticalPanel>
          </div>

          {/* RIGHT COLUMN: Channel Effectiveness + Strategy */}
          <div style={{ flex: "0 0 26%" }} className="flex flex-col gap-4">
            <TacticalPanel title="CHANNEL EFFECTIVENESS">
              <div className="flex flex-col gap-3">
                {sortedChannels.map((ch) => {
                  const color = ch.effectiveness >= 70 ? "var(--neon-green)" : ch.effectiveness >= 50 ? "var(--gold)" : "var(--warn-orange)";
                  const reach = ch.reach >= 1000000
                    ? `${(ch.reach / 1000000).toFixed(1)}M REACH`
                    : `${(ch.reach / 1000).toFixed(0)}K REACH`;
                  return (
                    <div key={ch.channel}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 text-[13px]">
                          <span>{ch.icon}</span>
                          <span className="tracking-wider uppercase text-white">{ch.channel}</span>
                        </div>
                        <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>{reach}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-2" style={{ background: "var(--bar-empty)" }}>
                          <div
                            className="h-2 transition-all duration-[1500ms] ease-out"
                            style={{ width: `${ch.effectiveness}%`, background: color }}
                          />
                        </div>
                        <span className="text-[12px] font-bold shrink-0" style={{ color, minWidth: "28px", textAlign: "right" }}>
                          {ch.effectiveness}%
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </TacticalPanel>

            <TacticalPanel title="RECOMMENDED STRATEGY">
              <ul className="flex flex-col gap-3">
                {recommendations.map((rec, i) => (
                  <li key={i} className="flex items-start gap-2 text-[12px]" style={{ color: "var(--text-muted)", lineHeight: 1.6 }}>
                    <span className="shrink-0 mt-0.5 font-bold" style={{ color: "var(--gold)" }}>•</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-4 pt-3" style={{ borderTop: "1px solid rgb(var(--cyan-rgb) / 0.15)" }}>
                <button
                  className="w-full py-2 text-[13px] tracking-widest uppercase font-bold transition-opacity hover:opacity-80"
                  style={{ background: deployedAll ? "var(--neon-green)" : "var(--gold)", color: "#000", cursor: "pointer" }}
                  onClick={() => {
                    useGameStore.setState((s) => ({
                      operations: s.operations.map((op: Operation) =>
                        op.status === "planned" ? { ...op, status: "active" as Operation["status"] } : op
                      ),
                    }));
                    setDeployedAll(true);
                    setTimeout(() => setDeployedAll(false), 2000);
                  }}
                >
                  {deployedAll ? t(lang, "✓ DILANCARKAN", "✓ DEPLOYED") : t(lang, "LANCAR SEMUA KEMPEN", "DEPLOY ALL CAMPAIGNS")}
                </button>
              </div>
            </TacticalPanel>
          </div>
        </div>
      </main>
    </div>
  );
}
