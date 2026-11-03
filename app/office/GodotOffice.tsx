"use client";

// The Sims-style 3D service centre built in Godot (project: godot/office,
// web export: public/godot/office). It is same-origin, so the bridge is a
// plain window.postMessage of JSON strings:
//   page  -> scene  { type: "office-state", lang, player, playerName, playerColor, pa, night, badges, intro }
//                   { type: "office-skip" }
//   scene -> page   { type: "office-ready" } · { type: "office-progress", value }
//                   { type: "office-intro", playing }
//                   { type: "office-room", room, action: "enter" | "open", id? }
//                   { type: "office-error", message }   (no WebGL2 → caller falls back)
// The scene only draws and reports; every game effect happens on the page.

import { useCallback, useEffect, useRef, useState } from "react";
import { t, type Lang } from "../i18n/useLang";

export const GODOT_OFFICE_URL = "/godot/office/index.html";

export type OfficeInteraction = "desk" | "pa" | "meeting" | "tv" | "board" | "residents" | "files" | "pantry";
export type OfficeRoom = "yb" | "mesyuarat" | "media" | "koridor" | "gerakan" | "lobi" | "kaunter" | "surau" | "luar";

export type GodotOfficeState = {
  lang: Lang;
  player: "pa_male" | "pa_female";
  playerName: string;
  playerColor: string;
  pa: "pa_male" | "pa_female";
  night: boolean;
  badges: Partial<Record<OfficeInteraction, number>>;
  intro: boolean;
};

const ROOM_NAMES: Record<OfficeRoom, [string, string]> = {
  yb: ["Bilik YB", "YB's Office"],
  mesyuarat: ["Bilik Mesyuarat", "Meeting Room"],
  media: ["Bilik Media", "Media Room"],
  koridor: ["Koridor", "Corridor"],
  gerakan: ["Bilik Gerakan", "Operations Room"],
  lobi: ["Lobi & Ruang Menunggu", "Lobby & Waiting Area"],
  kaunter: ["Kaunter Aduan", "Complaints Counter"],
  surau: ["Surau · Pantri", "Prayer Room · Pantry"],
  luar: ["Luar pejabat", "Outside"],
};

export default function GodotOffice({ state, onOpen, onError }: {
  state: GodotOfficeState;
  onOpen: (id: OfficeInteraction) => void;
  onError: (message: string) => void;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [introPlaying, setIntroPlaying] = useState(false);
  const [room, setRoom] = useState<OfficeRoom | null>(null);
  const lang = state.lang;
  const onOpenRef = useRef(onOpen);
  const onErrorRef = useRef(onError);
  onOpenRef.current = onOpen;
  onErrorRef.current = onError;

  const post = useCallback((msg: object) => {
    frameRef.current?.contentWindow?.postMessage(JSON.stringify(msg), window.location.origin);
  }, []);

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== window.location.origin || e.source !== frameRef.current?.contentWindow || typeof e.data !== "string") return;
      let msg: { type?: string; [key: string]: unknown };
      try { msg = JSON.parse(e.data); } catch { return; }
      if (msg.type === "office-ready") setReady(true);
      else if (msg.type === "office-progress" && typeof msg.value === "number") setProgress(msg.value);
      else if (msg.type === "office-intro") setIntroPlaying(msg.playing === true);
      else if (msg.type === "office-error") onErrorRef.current(String(msg.message ?? "error"));
      else if (msg.type === "office-room" && typeof msg.room === "string") {
        if (msg.action === "enter" && msg.room in ROOM_NAMES) setRoom(msg.room as OfficeRoom);
        if (msg.action === "open" && typeof msg.id === "string") onOpenRef.current(msg.id as OfficeInteraction);
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  // The scene keeps no game state; resend whenever the page's view changes.
  useEffect(() => {
    if (ready) post({ type: "office-state", ...state });
  }, [ready, state, post]);

  // Let the room name fade after a moment.
  useEffect(() => {
    if (!room) return;
    const timer = window.setTimeout(() => setRoom(null), 2600);
    return () => window.clearTimeout(timer);
  }, [room]);

  return (
    <div className="relative h-full w-full" style={{ background: "#020814" }}>
      <iframe
        ref={frameRef}
        src={GODOT_OFFICE_URL}
        title={t(lang, "Pusat Khidmat 3D", "3D service centre")}
        className="absolute inset-0 h-full w-full border-0"
        allow="fullscreen"
      />
      {!ready && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 flex flex-col items-center gap-2" style={{ fontFamily: "'Space Mono', monospace" }}>
          <span className="text-[9px] font-black tracking-[.22em] text-cyan">{t(lang, "MEMUATKAN PEJABAT 3D…", "LOADING 3D OFFICE…")} {Math.round(progress * 100)}%</span>
          <span className="block h-1 w-[min(280px,70vw)] border" style={{ borderColor: "rgb(var(--cyan-rgb) / .45)" }}>
            <span className="block h-full bg-gold transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
          </span>
        </div>
      )}
      {introPlaying && (
        <button type="button" onClick={() => post({ type: "office-skip" })}
          className="office-intro-skip absolute left-1/2 top-[124px] z-40 -translate-x-1/2 border px-4 py-2 text-[10px] font-black tracking-widest text-gold shadow-xl"
          style={{ borderColor: "rgb(var(--gold-rgb) / .6)", background: "rgb(2 8 20 / .9)", fontFamily: "'Space Mono', monospace" }}>
          {t(lang, "LANGKAU ▸▸", "SKIP ▸▸")}
        </button>
      )}
      {room && !introPlaying && (
        <div role="status" className="pointer-events-none absolute left-1/2 top-24 z-10 -translate-x-1/2 border px-4 py-2 text-[11px] font-black tracking-[.2em] text-white"
          style={{ borderColor: "rgb(var(--cyan-rgb) / .45)", background: "rgb(2 8 20 / .82)", fontFamily: "'Space Mono', monospace" }}>
          {ROOM_NAMES[room][lang === "en" ? 1 : 0].toUpperCase()}
        </div>
      )}
      <div className="office-3d-hint pointer-events-none absolute bottom-14 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap text-[9px] font-bold tracking-widest text-text-muted" style={{ fontFamily: "'Space Mono', monospace" }}>
        {t(lang, "KLIK LANTAI UNTUK BERJALAN · KLIK TANDA EMAS UNTUK BERTINDAK · SERET UNTUK GERAK · KLIK KANAN / DUA JARI UNTUK PUSING", "CLICK THE FLOOR TO WALK · CLICK A GOLD MARKER TO ACT · DRAG TO PAN · RIGHT-DRAG / TWO FINGERS TO ROTATE")}
      </div>
    </div>
  );
}
