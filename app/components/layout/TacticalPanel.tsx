"use client";
import { ReactNode } from "react";

interface TacticalPanelProps {
  children: ReactNode;
  title?: string;
  className?: string;
  goldBorder?: boolean;
  noPadding?: boolean;
}

export default function TacticalPanel({
  children,
  title,
  className = "",
  goldBorder = false,
  noPadding = false,
}: TacticalPanelProps) {
  const shadowClass = goldBorder ? "tactical-panel-gold" : "tactical-panel";
  const borderClass = goldBorder ? "border border-gold/60" : "border border-cyan/40";

  return (
    <div
      className={`${shadowClass} relative bg-panel ${borderClass} ${noPadding ? "" : "p-4"} ${className}`}
    >
      {/* Corner marks */}
      <span className="absolute top-0 left-0 text-cyan/60 text-xs leading-none select-none" style={{ transform: "translate(-1px,-1px)" }}>┌</span>
      <span className="absolute top-0 right-0 text-cyan/60 text-xs leading-none select-none" style={{ transform: "translate(1px,-1px)" }}>┐</span>
      <span className="absolute bottom-0 left-0 text-cyan/60 text-xs leading-none select-none" style={{ transform: "translate(-1px,1px)" }}>└</span>
      <span className="absolute bottom-0 right-0 text-cyan/60 text-xs leading-none select-none" style={{ transform: "translate(1px,1px)" }}>┘</span>

      {title && (
        <div className="panel-header mb-3">{title}</div>
      )}
      {children}
    </div>
  );
}
