"use client";
import { useEffect, useState } from "react";
import { formatNumber } from "../../utils/format";

interface StatBarProps {
  label: string;
  value: number;
  max?: number;
  color?: string;
  showValue?: boolean;
  animate?: boolean;
  size?: "sm" | "md";
}

export default function StatBar({
  label,
  value,
  max = 100,
  color = "var(--cyan)",
  showValue = true,
  animate = true,
  size = "md",
}: StatBarProps) {
  const [width, setWidth] = useState(0);
  const pct = Math.min((value / max) * 100, 100);

  useEffect(() => {
    if (animate) {
      const timer = setTimeout(() => setWidth(pct), 100);
      return () => clearTimeout(timer);
    } else {
      setWidth(pct);
    }
  }, [pct, animate]);

  const barHeight = size === "sm" ? "h-1.5" : "h-2";
  const textSize = size === "sm" ? "text-[12px]" : "text-[13px]";

  return (
    <div className="flex items-center gap-2 w-full">
      <span
        className={`${textSize} text-text-muted uppercase tracking-wider shrink-0`}
        style={{ minWidth: size === "sm" ? "80px" : "100px" }}
      >
        {label}
      </span>
      <div className={`flex-1 ${barHeight} bg-bar-empty relative overflow-hidden`}>
        <div
          className={`absolute left-0 top-0 ${barHeight} transition-all duration-[1500ms] ease-out`}
          style={{ width: `${width}%`, background: color }}
        />
      </div>
      {showValue && (
        <span
          className={`${textSize} font-bold shrink-0`}
          style={{ color, minWidth: "28px", textAlign: "right" }}
        >
          {formatNumber(value)}
        </span>
      )}
    </div>
  );
}
