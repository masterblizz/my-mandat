"use client";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import ReactionFace, { type CrowdReaction } from "./ReactionFace";
import { rollCrowdRandom } from "../../store/campaignMath";

const CROWD_SIZE = 28;
const CROWD_COLUMNS = 7;

function rollReaction(positiveRatio: number): CrowdReaction {
  const roll = rollCrowdRandom();
  const negativeRatio = Math.max(0, (1 - positiveRatio) * 0.4);
  if (roll < positiveRatio) return "positive";
  if (roll < positiveRatio + negativeRatio) return "negative";
  return "neutral";
}

interface CrowdSceneProps {
  /** 0–1 "how well the crowd takes it" — cosmetic preview, see campaignMath.ts. */
  positiveRatio: number;
  /** Bump this to re-roll every face and replay the reveal stagger. */
  triggerKey: number;
}

export default function CrowdScene({ positiveRatio, triggerKey }: CrowdSceneProps) {
  const [reactions, setReactions] = useState<CrowdReaction[]>(() => Array(CROWD_SIZE).fill("neutral"));

  useEffect(() => {
    if (triggerKey === 0) return;
    setReactions(Array.from({ length: CROWD_SIZE }, () => rollReaction(positiveRatio)));
  }, [positiveRatio, triggerKey]);

  return (
    <div
      className="grid gap-2 place-items-center"
      style={{ gridTemplateColumns: `repeat(${CROWD_COLUMNS}, minmax(0, 1fr))` }}
    >
      {reactions.map((reaction, index) => (
        // Keyed on triggerKey so each reveal remounts fresh nodes and the
        // initial -> animate stagger actually replays on every re-trigger.
        <motion.div
          key={`${triggerKey}-${index}`}
          initial={{ opacity: 0.4, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: (index % CROWD_COLUMNS) * 0.02 + Math.floor(index / CROWD_COLUMNS) * 0.03, duration: 0.3 }}
        >
          <ReactionFace reaction={reaction} />
        </motion.div>
      ))}
    </div>
  );
}
