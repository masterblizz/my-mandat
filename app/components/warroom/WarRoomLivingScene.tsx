"use client";
import { useState, type ReactNode } from "react";
import { LivingScene, SceneLayer, SceneParticles } from "../living-scene";
import type { SceneState } from "../living-scene";
import { computeThreatLevel, type OpponentAction } from "../../store/opponentAI";
import { usePendingNav } from "../../hooks/usePendingNav";
import { formatSignedPercent } from "../../utils/format";

interface WarRoomLivingSceneProps {
  lang: "en" | "ms";
  opponentLog: OpponentAction[];
  mediaSentiment: "positive" | "neutral" | "negative";
  nationalSupportDelta: number;
  nationalSupportMandat: number;
  resources: { funds: number; manpower: number };
  startingFund: number;
  daysLeft: number;
  mediaWallHeadline: string;
}

const LOW_MANPOWER_FLOOR = 120;

function formatRM(amount: number): string {
  if (amount >= 1_000_000) return `RM ${(amount / 1_000_000).toFixed(1)}M`;
  if (amount >= 1_000) return `RM ${(amount / 1_000).toFixed(0)}K`;
  return `RM ${amount}`;
}

function StationCard({
  color,
  labelMS,
  labelEN,
  lang,
  onClick,
  pending,
  ariaLabel,
  children,
}: {
  color: string;
  labelMS: string;
  labelEN: string;
  lang: "en" | "ms";
  onClick?: () => void;
  pending?: boolean;
  ariaLabel: string;
  children: ReactNode;
}) {
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      disabled={Tag === "button" ? pending : undefined}
      aria-label={ariaLabel}
      className="group relative flex flex-col gap-1.5 border p-3 text-left transition-all"
      style={{
        borderColor: `${color}44`,
        background: "rgba(3,8,15,0.42)",
        borderLeftWidth: "3px",
        borderLeftColor: color,
        cursor: onClick ? (pending ? "wait" : "pointer") : "default",
        opacity: pending ? 0.6 : 1,
      }}
      onMouseEnter={(e) => onClick && ((e.currentTarget as HTMLElement).style.background = "rgba(255,255,255,0.045)")}
      onMouseLeave={(e) => onClick && ((e.currentTarget as HTMLElement).style.background = "rgba(3,8,15,0.42)")}
    >
      <div className="text-[9px] font-bold tracking-[0.2em]" style={{ color: "var(--text-muted)" }}>
        {lang === "ms" ? labelMS : labelEN}
      </div>
      {children}
      {onClick && (
        <div
          className="absolute bottom-2 right-2 text-[9px] font-bold tracking-widest opacity-0 transition-opacity group-hover:opacity-100"
          style={{ color }}
        >
          {pending ? (lang === "ms" ? "MEMUAT..." : "LOADING...") : lang === "ms" ? "BUKA →" : "OPEN →"}
        </div>
      )}
    </Tag>
  );
}

/**
 * War Room's ambient "living" panel — every card below reads real store data
 * (opponent severity, media sentiment, support trend, resources) and each
 * card that has a natural deep-dive page is a real navigation shortcut, not
 * decoration. No randomized/decorative reactions: every value and color is a
 * direct function of a prop.
 */
export default function WarRoomLivingScene({
  lang,
  opponentLog,
  mediaSentiment,
  nationalSupportDelta,
  nationalSupportMandat,
  resources,
  startingFund,
  daysLeft,
  mediaWallHeadline,
}: WarRoomLivingSceneProps) {
  const { isPending, navigate } = usePendingNav();
  const [advisorExpanded, setAdvisorExpanded] = useState(false);
  const threat = computeThreatLevel(opponentLog, 3);

  // Reuses the exact same HIGH/CRITICAL vs ELEVATED vs MINIMAL/LOW bands the
  // Opposition Intel panel already shows elsewhere on this page — the scene
  // mood and the intel readout can never say two different things.
  let sceneState: SceneState = "idle";
  if (threat.label === "CRITICAL" || threat.label === "HIGH") sceneState = "crisis";
  else if (threat.label === "ELEVATED") sceneState = "warning";
  else if (daysLeft <= 3) sceneState = "briefing";

  const advisorColor = sceneState === "crisis" ? "var(--neon-red)" : sceneState === "warning" ? "var(--warn-orange)" : "var(--cyan)";
  const advisorStatus =
    sceneState === "crisis" ? { ms: "SIAGA", en: "ALERT" } : sceneState === "warning" ? { ms: "AWAS", en: "CAUTION" } : { ms: "SEDIA", en: "READY" };
  const latestAction = opponentLog[0];
  const noActivityText = lang === "ms" ? "Tiada aktiviti lawan setakat ini." : "No enemy activity yet.";

  const trendColor = nationalSupportDelta > 0.15 ? "var(--neon-green)" : nationalSupportDelta < -0.15 ? "var(--neon-red)" : "var(--gold)";

  const mediaColor =
    mediaSentiment === "positive" ? "var(--neon-green)" : mediaSentiment === "negative" ? "var(--neon-red)" : "var(--gold)";
  const mediaStatus =
    mediaSentiment === "positive"
      ? { ms: "MESRA", en: "FRIENDLY" }
      : mediaSentiment === "negative"
        ? { ms: "OSTIL", en: "HOSTILE" }
        : { ms: "NEUTRAL", en: "NEUTRAL" };

  const fundsRatio = Math.max(0, Math.min(1, resources.funds / startingFund));
  const fundsLow = resources.funds < startingFund * 0.15;
  const manpowerLow = resources.manpower < LOW_MANPOWER_FLOOR;
  const opsColor = fundsLow || manpowerLow ? "var(--warn-orange)" : "var(--cyan)";

  return (
    <LivingScene state={sceneState} lang={lang} className="p-3">
      <SceneLayer depth={0} className="pointer-events-none">
        <div
          className="absolute inset-0"
          style={{
            background:
              "repeating-linear-gradient(90deg, transparent, transparent 38px, rgb(var(--cyan-rgb) / 0.04) 39px, transparent 40px)," +
              "repeating-linear-gradient(0deg, transparent, transparent 38px, rgb(var(--cyan-rgb) / 0.04) 39px, transparent 40px)",
          }}
        />
        <SceneParticles count={16} color="var(--cyan)" />
      </SceneLayer>

      <div className="relative z-[1] mt-5 grid gap-3 md:grid-cols-4">
        {/* ADVISOR — expandable opponent-intel preview, not a navigation link */}
        <StationCard
          color={advisorColor}
          labelMS="PENASIHAT STRATEGIK"
          labelEN="STRATEGIC ADVISOR"
          lang={lang}
          ariaLabel={lang === "ms" ? "Lihat taklimat penasihat" : "View advisor briefing"}
          onClick={() => setAdvisorExpanded((v) => !v)}
        >
          <div className="text-[13px] font-black tracking-widest" style={{ color: advisorColor }}>
            {lang === "ms" ? advisorStatus.ms : advisorStatus.en}
          </div>
          <div className="text-[10px] leading-snug" style={{ color: "var(--text-muted)" }}>
            {latestAction ? (lang === "ms" ? latestAction.narrativeMS : latestAction.narrativeEN) : noActivityText}
          </div>
          {advisorExpanded && opponentLog.length > 1 && (
            <div className="mt-1 max-h-[110px] space-y-1.5 overflow-y-auto border-t pt-1.5" style={{ borderColor: "rgb(var(--cyan-rgb) / 0.12)" }}>
              {opponentLog.slice(1, 4).map((action) => (
                <div key={action.id} className="text-[9px] leading-snug" style={{ color: "var(--text-muted)" }}>
                  <span className="font-bold" style={{ color: "var(--gold)" }}>D{action.day}</span>{" "}
                  {lang === "ms" ? action.narrativeMS : action.narrativeEN}
                </div>
              ))}
            </div>
          )}
        </StationCard>

        {/* DATA ANALYST — real national support number, links to Polling */}
        <StationCard
          color={trendColor}
          labelMS="ANALIS DATA"
          labelEN="DATA ANALYST"
          lang={lang}
          ariaLabel={lang === "ms" ? "Buka Tinjauan Pendapat" : "Open Polling & Analytics"}
          onClick={() => navigate("/polling")}
          pending={isPending}
        >
          <div className="text-xl font-black" style={{ color: trendColor }}>
            {nationalSupportMandat.toFixed(1)}%
          </div>
          <div className="text-[10px] font-bold" style={{ color: trendColor }}>
            {formatSignedPercent(nationalSupportDelta, 1)} {lang === "ms" ? "hari ini" : "today"}
          </div>
        </StationCard>

        {/* MEDIA WALL — real sentiment + latest headline, links to Messaging */}
        <StationCard
          color={mediaColor}
          labelMS="DINDING MEDIA"
          labelEN="MEDIA WALL"
          lang={lang}
          ariaLabel={lang === "ms" ? "Buka Pusat Media" : "Open Messaging Center"}
          onClick={() => navigate("/messaging")}
          pending={isPending}
        >
          <div className="text-[13px] font-black tracking-widest" style={{ color: mediaColor }}>
            {lang === "ms" ? mediaStatus.ms : mediaStatus.en}
          </div>
          <div className="line-clamp-2 text-[10px] leading-snug" style={{ color: "var(--text-muted)" }}>
            {mediaWallHeadline}
          </div>
        </StationCard>

        {/* OPS BOARD — real funds/manpower, links to Campaign Ops */}
        <StationCard
          color={opsColor}
          labelMS="PAPAN OPERASI"
          labelEN="OPS BOARD"
          lang={lang}
          ariaLabel={lang === "ms" ? "Buka Operasi Kempen" : "Open Campaign Operations"}
          onClick={() => navigate("/campaign")}
          pending={isPending}
        >
          <div className="text-[13px] font-black" style={{ color: opsColor }}>
            {formatRM(resources.funds)} · {Math.round(resources.manpower)} {lang === "ms" ? "orang" : "crew"}
          </div>
          <div className="h-1.5 w-full" style={{ background: "var(--bar-empty)" }}>
            <div className="h-1.5" style={{ width: `${fundsRatio * 100}%`, background: opsColor }} />
          </div>
        </StationCard>
      </div>
    </LivingScene>
  );
}
