"use client";
import { useState } from "react";
import Header from "../components/layout/Header";
import StatusBar from "../components/layout/StatusBar";
import TacticalPanel from "../components/layout/TacticalPanel";
import StatBar from "../components/ui/StatBar";
import TrendLine from "../components/charts/TrendLine";
import { keyMessages, messagePerformanceHistory, channelEffectiveness, Message } from "../data/messages";
import { useGameStore, Operation } from "../store/gameStore";
import { generateConstituencies } from "../data/constituencies";
import { useLang, t, type Lang } from "../i18n/useLang";

// The messages dataset carries English-only detail text; Malay display
// copies live here, keyed by message id.
const MESSAGE_MS: Record<string, { description: string; target: string }> = {
  msg01: { description: "Tangani kos sara hidup melalui subsidi bersasar, reformasi gaji dan penstrukturan semula ekonomi untuk isi rumah B40 dan M40.", target: "Pengundi bandar & separa bandar, B40-M40" },
  msg02: { description: "Cipta 500,000 pekerjaan berkualiti melalui ekonomi hijau, transformasi digital dan pelaburan asing.", target: "Belia (18-35), Graduan" },
  msg03: { description: "Reformasi pendidikan daripada hafalan kepada kurikulum berasaskan kemahiran, guru berkualiti dan laluan TVET.", target: "Ibu bapa, Guru, Pelajar" },
  msg04: { description: "Perkukuh kesihatan awam dengan pelaburan RM 3B, kurangkan masa menunggu dan tambah klinik komuniti.", target: "Warga emas, Keluarga" },
  msg05: { description: "Sifar toleransi rasuah: SPRM bebas, perolehan telus dan pengisytiharan harta wajib untuk semua menteri.", target: "Profesional bandar, Masyarakat sivil" },
  msg06: { description: "Malaysia di mana semua komuniti maju — memelihara hak istimewa Melayu sambil memastikan keadilan untuk semua.", target: "Pelbagai kaum, Melayu luar bandar" },
};

const CHANNEL_ICON: Record<string, string> = {
  "TV": "📺", "SOCIAL MEDIA": "📱", "CERAMAH": "🎤", "PRINT": "📰", "RADIO": "📻", "DIGITAL": "💻",
};
const CHANNEL_MS: Record<string, string> = {
  "SOCIAL MEDIA": "MEDIA SOSIAL", "PRINT": "CETAK",
};
function channelLabel(lang: Lang, channel: string): string {
  const key = channel.toUpperCase();
  return `${CHANNEL_ICON[key] ?? "•"} ${lang === "ms" ? CHANNEL_MS[key] ?? key : key}`;
}

function opStatusColor(status: string): string {
  if (status === "active") return "var(--neon-green)";
  if (status === "ongoing") return "var(--cyan)";
  if (status === "planned") return "var(--gold)";
  return "var(--text-muted)";
}

function opStatusLabel(lang: Lang, status: string): string {
  if (status === "active") return t(lang, "messaging_page.active");
  if (status === "ongoing") return t(lang, "messaging_page.running");
  if (status === "planned") return t(lang, "messaging_page.scheduled");
  return t(lang, "messaging_page.completed");
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
  const { operations, states, day, totalDays, journey, settings } = useGameStore();

  const sortedChannels = [...channelEffectiveness].sort((a, b) => b.effectiveness - a.effectiveness);

  const activeCampaigns = operations.filter((op) => op.status !== "completed");

  // PRN: the battlefield is the selected negeri's DUN seats, so targets are
  // its closest and weakest N.xxx seats rather than other states.
  const prnState = settings.electionScope === "prn" ? states.find((s) => s.id === settings.prnStateId) : undefined;
  const prnSeats = prnState ? generateConstituencies(prnState, "dun") : [];
  const swingSeat = [...prnSeats].sort((a, b) => Math.abs(a.mandat - a.lawan) - Math.abs(b.mandat - b.lawan))[0];
  const weakSeat = [...prnSeats].sort((a, b) => a.mandat - b.mandat).find((seat) => seat.mandat < 45);

  const topSwingStates = [...states]
    .sort((a, b) => b.swingProbability - a.swingProbability)
    .slice(0, 3);

  const weakState = states.find((s) => s.mandatSupport < 45);
  const recommendations = prnState ? [
    swingSeat
      ? `🎤 ${t(lang, "Fokus ceramah", "Focus ceramah")} · ${swingSeat.code} ${swingSeat.name} (±${Math.abs(swingSeat.mandat - swingSeat.lawan).toFixed(1)}%)`
      : `🎤 ${t(lang, `Lebih ceramah di DUN sengit ${prnState.name}`, `More ceramah in ${prnState.name}'s close DUN seats`)}`,
    `📱 ${t(lang, "Gandakan digital", "Boost digital")} · ${prnState.name} · ⏳ ${totalDays - day} ${t(lang, "hari", "days")}`,
    weakSeat
      ? `⚠ ${t(lang, "Kuatkan mesej", "Boost messaging")} · ${weakSeat.code} ${weakSeat.name} < 45%`
      : `✓ ${t(lang, `Semua DUN ${prnState.name} ≥ 45%`, `All ${prnState.name} DUN seats ≥ 45%`)}`,
  ] : [
    topSwingStates[0]
      ? `🎤 ${t(lang, "Fokus ceramah", "Focus ceramah")} · ${topSwingStates[0].name} (${topSwingStates[0].swingProbability}%)`
      : `🎤 ${t(lang, "Lebih ceramah di kawasan sengit", "More ceramah in contested areas")}`,
    `📱 ${t(lang, "Gandakan digital", "Boost digital")} · ⏳ ${totalDays - day} ${t(lang, "hari", "days")}`,
    weakState
      ? `⚠ ${t(lang, "Kuatkan mesej", "Boost messaging")} · ${weakState.name} < 45%`
      : `✓ ${t(lang, "Semua negeri ≥ 45%", "All states ≥ 45%")}`,
  ];

  return (
    <div className="min-h-screen" style={{ background: "var(--bg)", fontFamily: "'Space Mono', monospace" }}>
      <Header />
      <StatusBar leftText={`📣 ${t(lang, "messaging_page.messagingCenter")}`} rightText={`📅 ${day}/${totalDays}`} />

      <main className="pt-[56px] pb-[52px] px-6 min-h-screen">

        {/* Title Bar */}
        <div className="mb-3 py-2" style={{ borderBottom: "1px solid rgb(var(--gold-rgb) / 0.3)" }}>
          <h1 className="text-[19px] font-bold tracking-widest uppercase" style={{ color: "var(--gold)" }}>
            📣 {t(lang, "messaging_page.messagingCenter")}
          </h1>
        </div>

        <div className="flex gap-4">

          {/* LEFT COLUMN: Key Messages */}
          <div style={{ flex: "0 0 28%" }} className="flex flex-col gap-4">
            <TacticalPanel title={t(lang, "messaging_page.keyMessages")} noPadding={true}>
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
                      <div className="text-[13px] font-bold tracking-wider uppercase" style={{ color: isSelected ? "var(--gold)" : "var(--text-primary)" }}>
                        {lang === "ms" ? msg.titleBM : msg.titleEN}
                      </div>
                      <StatBar
                        label={t(lang, "messaging_page.eff")}
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
                  className="min-h-[40px] w-full py-2 text-[12px] tracking-widest uppercase transition-colors"
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
                  {t(lang, "messaging_page.createNewMessage")}
                </button>
              </div>
            </TacticalPanel>

            {/* Selected Message Expanded */}
            {selectedMsg && (
              <TacticalPanel goldBorder={true}>
                <div className="text-[14px] font-bold tracking-wider mb-1" style={{ color: "var(--gold)" }}>
                  {lang === "ms" ? selectedMsg.titleBM : selectedMsg.titleEN}
                </div>
                <div className="text-[11px] mb-1.5" style={{ color: "var(--text-muted)" }}>
                  🎯 {lang === "ms" ? MESSAGE_MS[selectedMsg.id]?.target ?? selectedMsg.targetDemographic : selectedMsg.targetDemographic}
                </div>
                <details className="mb-1 text-[12px]" style={{ color: "var(--text-muted)" }}>
                  <summary className="cursor-pointer select-none text-[11px] font-bold tracking-widest" style={{ color: "var(--cyan)" }}>ⓘ {t(lang, "BUTIRAN", "DETAILS")}</summary>
                  <div className="mt-1" style={{ lineHeight: 1.6 }}>
                    {lang === "ms" ? MESSAGE_MS[selectedMsg.id]?.description ?? selectedMsg.description : selectedMsg.description}
                  </div>
                </details>
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
                      {channelLabel(lang, ch)}
                    </span>
                  ))}
                </div>
              </TacticalPanel>
            )}
          </div>

          {/* CENTER COLUMN: Performance + Active Campaigns */}
          <div style={{ flex: "1" }} className="flex flex-col gap-4">
            <TacticalPanel title={t(lang, "messaging_page.messagePerformance6Weeks")}>
              <TrendLine
                data={messagePerformanceHistory}
                lines={[
                  { key: "ekonomi",    color: "var(--cyan)", label: t(lang, "EKONOMI", "ECONOMY") },
                  { key: "peluang",    color: "var(--gold)", label: t(lang, "PELUANG", "JOBS") },
                  { key: "pendidikan", color: "var(--neon-green)", label: t(lang, "PENDIDIKAN", "EDUCATION") },
                ]}
                xKey="week"
                height={200}
                showGrid={true}
                showLegend={true}
              />
            </TacticalPanel>

            <TacticalPanel title={t(lang, "messaging_page.activeCampaignsDay", { day: day, totalDays: totalDays })}>
              <div className="flex flex-col gap-2">
                {activeCampaigns.length === 0 && (
                  <div className="text-[12px] text-center py-4" style={{ color: "var(--text-muted)" }}>
                    {t(lang, "messaging_page.noActiveCampaignsDeployFromCampaign")}
                  </div>
                )}
                {activeCampaigns.map((op) => {
                  const color = opStatusColor(op.status);
                  const label = opStatusLabel(lang, op.status);
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
                          {op.location.toUpperCase()}{op.stateIds.length > 1 ? t(lang, "messaging_page.states", { opStateIdsLength: op.stateIds.length }) : ""}
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
            <TacticalPanel title={t(lang, "messaging_page.channelEffectiveness")}>
              <div className="flex flex-col gap-3">
                {sortedChannels.map((ch) => {
                  const color = ch.effectiveness >= 70 ? "var(--neon-green)" : ch.effectiveness >= 50 ? "var(--gold)" : "var(--warn-orange)";
                  const reach = ch.reach >= 1000000
                    ? t(lang, "messaging_page.mReach", { chReachToFixed: (ch.reach / 1000000).toFixed(1) })
                    : t(lang, "messaging_page.kReach", { chReachToFixed: (ch.reach / 1000).toFixed(0) });
                  return (
                    <div key={ch.channel}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2 text-[13px]">
                          <span>{ch.icon}</span>
                          <span className="tracking-wider uppercase text-white">{lang === "ms" ? CHANNEL_MS[ch.channel] ?? ch.channel : ch.channel}</span>
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

            <TacticalPanel title={t(lang, "messaging_page.recommendedStrategy")}>
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
                  className="min-h-[40px] w-full py-2 text-[13px] tracking-widest uppercase font-bold transition-opacity hover:opacity-80 disabled:opacity-40"
                  style={{ background: deployedAll ? "var(--neon-green)" : "var(--gold)", color: "#000", cursor: "pointer" }}
                  disabled={journey.chapter !== "campaign" || day >= totalDays || journey.decisions < 1 || !operations.some(op => op.status === "planned")}
                  onClick={() => {
                    useGameStore.setState((s) => s.journey.chapter !== "campaign" || s.day >= s.totalDays || s.journey.decisions < 1 || !s.operations.some(op => op.status === "planned") ? {} : ({
                      journey: { ...s.journey, decisions: s.journey.decisions - 1 },
                      operations: s.operations.map((op: Operation) =>
                        op.status === "planned" ? { ...op, status: "active" as Operation["status"] } : op
                      ),
                    }));
                    setDeployedAll(true);
                    setTimeout(() => setDeployedAll(false), 2000);
                  }}
                >
                  {deployedAll ? t(lang, "messaging_page.deployed") : t(lang, "messaging_page.deployAllCampaigns")}
                </button>
              </div>
            </TacticalPanel>
          </div>
        </div>
      </main>
    </div>
  );
}
