"use client";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useGameStore } from "../../store/gameStore";
import { useLang, t } from "../../i18n/useLang";
import {
  calculateCampaignGain,
  gainToPositiveRatio,
  type MiniGameTactic,
  type MiniGameType,
} from "../../store/campaignMath";
import { generateCampaignTopics, type CampaignTopic } from "../../data/campaignTopics";
import CrowdScene from "./CrowdScene";

interface CeramahSceneModalProps {
  stateId: string;
  gameType: MiniGameType;
  tactic: MiniGameTactic;
  onClose: () => void;
}

type ScenePhase = "topic" | "reacting" | "done";

const SETTLE_DELAY_MS = 1300;

export default function CeramahSceneModal({ stateId, gameType, tactic, onClose }: CeramahSceneModalProps) {
  const lang = useLang();
  const { states, runCampaignMiniGame } = useGameStore();
  const [phase, setPhase] = useState<ScenePhase>("topic");
  const [selectedTopic, setSelectedTopic] = useState<CampaignTopic | null>(null);
  const [triggerKey, setTriggerKey] = useState(0);

  const targetState = states.find((s) => s.id === stateId) ?? states[0];

  // Fresh topic set per mount (i.e. per mini-game session) so replays don't
  // show the same fixed list — mixes state-specific issues with a random pool.
  const topics = useMemo(
    () => (targetState ? generateCampaignTopics(targetState, gameType) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  // Read-only preview of the exact number `runCampaignMiniGame` will apply —
  // calculateCampaignGain() is the single source of truth for both.
  const projectedGain = useMemo(
    () => (targetState ? calculateCampaignGain(targetState, gameType, tactic) : 0),
    [targetState, gameType, tactic]
  );
  const positiveRatio = useMemo(() => gainToPositiveRatio(projectedGain), [projectedGain]);

  // Commits the real store mutation only after the crowd animation settles,
  // and only if the modal is still mounted when the timer fires.
  useEffect(() => {
    if (phase !== "reacting") return;
    const timeoutId = window.setTimeout(() => {
      runCampaignMiniGame(stateId, gameType, tactic);
      setPhase("done");
    }, SETTLE_DELAY_MS);
    return () => window.clearTimeout(timeoutId);
  }, [phase, stateId, gameType, tactic, runCampaignMiniGame]);

  function handleTopicSelect(topic: CampaignTopic) {
    setSelectedTopic(topic);
    setTriggerKey((key) => key + 1);
    setPhase("reacting");
  }

  const title = gameType === "ceramah"
    ? t(lang, "components_campaign_CeramahSceneModal.liveCeramahSession")
    : t(lang, "components_campaign_CeramahSceneModal.liveDigitalPush");

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.8)" }}
      onClick={phase === "done" ? onClose : undefined}
    >
      <div
        className="w-full max-w-2xl p-0"
        style={{ background: "var(--panel)", border: "1px solid rgb(var(--gold-rgb)/0.4)", maxHeight: "90vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid rgb(var(--cyan-rgb) / 0.2)" }}>
          <span className="text-[14px] font-bold tracking-widest uppercase" style={{ color: "var(--gold)" }}>
            {title} · {targetState?.name.toUpperCase() ?? ""}
          </span>
          {phase === "done" && (
            <button onClick={onClose} className="text-[22px] leading-none" style={{ color: "var(--text-muted)", cursor: "pointer" }}>
              ×
            </button>
          )}
        </div>

        <div className="px-5 py-5 flex flex-col items-center gap-4">
          <motion.svg
            width="64"
            height="80"
            viewBox="0 0 64 80"
            aria-hidden="true"
            animate={phase === "reacting" ? { rotate: [-2, 2, -2] } : { rotate: 0 }}
            transition={{ duration: 0.6, repeat: phase === "reacting" ? Infinity : 0 }}
          >
            <circle cx="32" cy="16" r="12" fill="none" stroke="var(--gold)" strokeWidth="2" />
            <path d="M 20 74 L 22 40 Q 32 32 42 40 L 44 74" fill="none" stroke="var(--gold)" strokeWidth="2" />
            <path d="M 42 40 L 56 24" fill="none" stroke="var(--gold)" strokeWidth="2" strokeLinecap="round" />
          </motion.svg>

          <CrowdScene positiveRatio={positiveRatio} triggerKey={triggerKey} />

          <div className="w-full mt-1">
            {phase === "topic" && (
              <>
                <div className="mb-2 text-center text-[11px] tracking-widest" style={{ color: "var(--text-muted)" }}>
                  {t(lang, "components_campaign_CeramahSceneModal.chooseSpeechTopic")}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {topics.map((topicOption) => (
                    <button
                      key={topicOption.id}
                      onClick={() => handleTopicSelect(topicOption)}
                      className="px-3 py-3 text-center text-[12px] font-bold tracking-wide"
                      style={{ border: "1px solid rgb(var(--cyan-rgb)/0.3)", color: "#fff", background: "rgb(var(--cyan-rgb)/0.06)", cursor: "pointer" }}
                    >
                      {t(lang, topicOption.labelMS, topicOption.labelEN)}
                    </button>
                  ))}
                </div>
              </>
            )}

            {phase !== "topic" && selectedTopic && (
              <div className="text-center">
                <div className="text-[13px] leading-relaxed" style={{ color: "var(--text-muted)" }}>
                  {t(lang, selectedTopic.blurbMS, selectedTopic.blurbEN)}
                </div>
                {phase === "done" && (
                  <div className="mt-3 text-[12px] font-bold" style={{ color: "var(--neon-green)" }}>
                    {t(lang, "components_campaign_CeramahSceneModal.campaignImpactRecorded")}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
