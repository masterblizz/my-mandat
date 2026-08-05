"use client";
import { useEffect, useRef, useState } from "react";
import { useLang, t } from "../../i18n/useLang";

export interface ShareResultData {
  scopeLabel: string;
  partyDisplay: string;
  leaderName: string;
  verdictLabel: string;
  verdictColor: string;
  partyColor: string;
  mandatSeats: number;
  lawanSeats: number;
  othersSeats: number;
  totalSeats: number;
  majorityTarget: number;
  nationalSupport: number;
  day: number;
  totalDays: number;
  achievedCount: number;
  totalAchievements: number;
}

interface ShareResultModalProps {
  data: ShareResultData;
  onClose: () => void;
}

// Fixed dark "tactical HUD" palette regardless of the viewer's own light/
// dark toggle — a share card is a screenshot other people see out of
// context, so it should always render the game's one branded look rather
// than whatever theme the exporting player happens to have on.
const PALETTE = {
  bg0: "#080c14",
  bg1: "#0d1117",
  panel: "#111827",
  cyan: "#00d4ff",
  gold: "#f0a500",
  others: "#4a5568",
  text: "#ffffff",
  muted: "#8899aa",
  line: "rgba(0,212,255,0.25)",
};

const CARD_W = 1200;
const CARD_H = 630;

function drawResultCard(canvas: HTMLCanvasElement, data: ShareResultData, lang: ReturnType<typeof useLang>) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = CARD_W;
  canvas.height = CARD_H;

  // Background
  const bgGrad = ctx.createLinearGradient(0, 0, CARD_W, CARD_H);
  bgGrad.addColorStop(0, PALETTE.bg1);
  bgGrad.addColorStop(1, PALETTE.bg0);
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, CARD_W, CARD_H);

  // Corner frame marks, matching the app's "tactical panel" corner-mark motif
  ctx.strokeStyle = PALETTE.line;
  ctx.lineWidth = 2;
  const m = 28;
  const cl = 34;
  [[m, m, 1, 1], [CARD_W - m, m, -1, 1], [m, CARD_H - m, 1, -1], [CARD_W - m, CARD_H - m, -1, -1]].forEach(([x, y, dx, dy]) => {
    ctx.beginPath();
    ctx.moveTo(x, y + cl * dy);
    ctx.lineTo(x, y);
    ctx.lineTo(x + cl * dx, y);
    ctx.stroke();
  });

  // Header
  ctx.fillStyle = PALETTE.cyan;
  ctx.font = "700 15px 'Space Mono', monospace";
  ctx.textBaseline = "alphabetic";
  ctx.fillText("MANDAT//AI · SIMULATOR PILIHAN RAYA", m + 24, 58);
  ctx.textAlign = "right";
  ctx.fillStyle = PALETTE.muted;
  ctx.font = "600 14px 'Space Mono', monospace";
  ctx.fillText(data.scopeLabel.toUpperCase(), CARD_W - m - 24, 58);
  ctx.textAlign = "left";

  // Verdict
  ctx.fillStyle = data.verdictColor;
  ctx.font = "800 46px 'Space Mono', monospace";
  ctx.fillText(data.verdictLabel.toUpperCase(), m + 24, 138);

  ctx.fillStyle = PALETTE.text;
  ctx.font = "600 22px 'Space Mono', monospace";
  ctx.fillText(`${data.partyDisplay} · ${data.leaderName}`, m + 24, 176);

  // Seat bar
  const barX = m + 24;
  const barY = 216;
  const barW = CARD_W - (m + 24) * 2;
  const barH = 46;
  const total = Math.max(1, data.totalSeats);
  const mW = (data.mandatSeats / total) * barW;
  const oW = (data.othersSeats / total) * barW;
  const lW = (data.lawanSeats / total) * barW;
  ctx.fillStyle = data.partyColor;
  ctx.fillRect(barX, barY, mW, barH);
  ctx.fillStyle = PALETTE.others;
  ctx.fillRect(barX + mW, barY, oW, barH);
  ctx.fillStyle = "#ff8800";
  ctx.fillRect(barX + mW + oW, barY, lW, barH);
  ctx.strokeStyle = PALETTE.line;
  ctx.lineWidth = 1;
  ctx.strokeRect(barX, barY, barW, barH);
  // majority-target tick
  const targetX = barX + (data.majorityTarget / total) * barW;
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 2;
  ctx.setLineDash([4, 3]);
  ctx.beginPath();
  ctx.moveTo(targetX, barY - 6);
  ctx.lineTo(targetX, barY + barH + 6);
  ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = "600 14px 'Space Mono', monospace";
  ctx.fillStyle = PALETTE.text;
  ctx.fillText(`${t(lang, "KERUSI", "SEATS")} ${data.mandatSeats}/${data.totalSeats}`, barX, barY + barH + 30);
  ctx.textAlign = "right";
  ctx.fillStyle = PALETTE.muted;
  ctx.fillText(t(lang, `SASARAN MAJORITI ${data.majorityTarget}`, `MAJORITY TARGET ${data.majorityTarget}`), barX + barW, barY + barH + 30);
  ctx.textAlign = "left";

  // Stat tiles
  const tiles = [
    { label: t(lang, "SOKONGAN KEBANGSAAN", "NATIONAL SUPPORT"), value: `${data.nationalSupport}%` },
    { label: t(lang, "HARI KEMPEN", "CAMPAIGN DAYS"), value: `${data.day}/${data.totalDays}` },
    { label: t(lang, "PENCAPAIAN", "ACHIEVEMENTS"), value: `${data.achievedCount}/${data.totalAchievements}` },
  ];
  const tileY = 330;
  const tileH = 108;
  const gap = 20;
  const tileW = (barW - gap * (tiles.length - 1)) / tiles.length;
  tiles.forEach((tile, i) => {
    const x = barX + i * (tileW + gap);
    ctx.fillStyle = PALETTE.panel;
    ctx.fillRect(x, tileY, tileW, tileH);
    ctx.strokeStyle = PALETTE.line;
    ctx.lineWidth = 1;
    ctx.strokeRect(x, tileY, tileW, tileH);
    ctx.fillStyle = PALETTE.muted;
    ctx.font = "700 12px 'Space Mono', monospace";
    ctx.fillText(tile.label, x + 18, tileY + 32);
    ctx.fillStyle = PALETTE.gold;
    ctx.font = "800 34px 'Space Mono', monospace";
    ctx.fillText(tile.value, x + 18, tileY + 78);
  });

  // Footer
  ctx.fillStyle = PALETTE.muted;
  ctx.font = "600 13px 'Space Mono', monospace";
  ctx.fillText(t(lang, "Dijana oleh MY MANDAT — simulator kempen pilihan raya Malaysia", "Generated by MY MANDAT — a Malaysian election campaign simulator"), barX, CARD_H - 44);
}

export default function ShareResultModal({ data, onClose }: ShareResultModalProps) {
  const lang = useLang();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  useEffect(() => {
    if (canvasRef.current) drawResultCard(canvasRef.current, data, lang);
    // Redraw only when the underlying result data or language actually
    // changes — canvasRef itself is stable across renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, lang]);

  function handleDownload() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "mymandat-keputusan.png";
      a.click();
      URL.revokeObjectURL(url);
      setStatus(t(lang, "IMEJ DIMUAT TURUN", "IMAGE DOWNLOADED"));
    }, "image/png");
  }

  async function handleCopy() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!navigator.clipboard || !("ClipboardItem" in window)) {
      setStatus(t(lang, "PENYALINAN TIDAK DISOKONG — MUAT TURUN SAHAJA", "COPY NOT SUPPORTED — DOWNLOAD ONLY"));
      return;
    }
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
        setStatus(t(lang, "IMEJ DISALIN — TAMPAL DI MANA-MANA", "IMAGE COPIED — PASTE ANYWHERE"));
      } catch {
        setStatus(t(lang, "GAGAL MENYALIN", "COPY FAILED"));
      }
    }, "image/png");
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: "rgba(0,0,0,0.8)" }}
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl p-0"
        style={{ background: "var(--panel)", border: "1px solid rgb(var(--gold-rgb)/0.4)", maxHeight: "92vh", overflowY: "auto" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-3" style={{ borderBottom: "1px solid rgb(var(--cyan-rgb) / 0.2)" }}>
          <span className="text-[14px] font-bold tracking-widest uppercase" style={{ color: "var(--gold)" }}>
            {t(lang, "KONGSI KEPUTUSAN", "SHARE RESULT")}
          </span>
          <button onClick={onClose} className="text-[22px] leading-none" style={{ color: "var(--text-muted)", cursor: "pointer" }} aria-label={t(lang, "Tutup", "Close")}>
            ×
          </button>
        </div>

        <div className="px-5 py-5 flex flex-col items-center gap-4">
          <canvas ref={canvasRef} className="w-full h-auto" style={{ border: "1px solid rgb(var(--cyan-rgb) / 0.25)" }} />
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={handleDownload}
              className="px-5 py-2.5 text-[12px] font-bold tracking-widest uppercase"
              style={{ background: "var(--gold)", color: "#000" }}
            >
              {t(lang, "MUAT TURUN IMEJ", "DOWNLOAD IMAGE")}
            </button>
            <button
              onClick={handleCopy}
              className="px-5 py-2.5 text-[12px] font-bold tracking-widest uppercase"
              style={{ background: "transparent", border: "1px solid rgb(var(--cyan-rgb) / 0.5)", color: "var(--cyan)" }}
            >
              {t(lang, "SALIN IMEJ", "COPY IMAGE")}
            </button>
          </div>
          {status && (
            <div className="text-[11px] tracking-wider" style={{ color: "var(--text-muted)" }}>{status}</div>
          )}
        </div>
      </div>
    </div>
  );
}
