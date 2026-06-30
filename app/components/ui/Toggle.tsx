"use client";

interface ToggleProps {
  value: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}

export default function Toggle({ value, onChange, label }: ToggleProps) {
  return (
    <div className="flex items-center gap-3">
      <button
        onClick={() => onChange(!value)}
        className="relative w-10 h-5 rounded-full transition-all duration-200 focus:outline-none"
        style={{ background: value ? "var(--neon-green)" : "var(--toggle-off)" }}
      >
        <span
          className="absolute top-0.5 w-4 h-4 rounded-full bg-white transition-all duration-200 shadow"
          style={{ left: value ? "22px" : "2px" }}
        />
      </button>
      {label && (
        <span className="text-xs text-text-muted uppercase tracking-wider">{label}</span>
      )}
    </div>
  );
}
