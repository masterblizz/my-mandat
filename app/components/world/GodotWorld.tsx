"use client";

// The Sims-style 3D locations built in Godot (project: godot/world, web
// export: public/godot/world). One engine serves every location, chosen by
// ?scene= (office, warroom). It is same-origin, so the bridge is a plain
// window.postMessage of JSON strings:
//   page  -> scene  { type: "world-state", lang, player, playerName, playerColor, pa, night, badges, intro, ...extra }
//                   { type: "world-skip" }
//   scene -> page   { type: "world-ready" } · { type: "world-progress", value }
//                   { type: "world-intro", playing }
//                   { type: "world-room", room, action: "enter" | "open", id? }
//                   { type: "world-state-click", id }     (war room map)
//                   { type: "world-error", message }      (no WebGL2 → caller falls back)
// The scene only draws and reports; every game effect happens on the page.

import { useCallback, useEffect, useRef, useState } from "react";
import { t, type Lang } from "../../i18n/useLang";

export const GODOT_WORLD_URL = "/godot/world/index.html";

export type WorldScene = "office" | "warroom" | "studio" | "dewan" | "party" | "media";
export type OfficeInteraction = "desk" | "pa" | "meeting" | "tv" | "board" | "residents" | "files" | "pantry";
export type WarRoomInteraction = "console" | "screens" | "pa" | "analytics" | "briefing" | "exit";

export type GodotWorldState = {
  lang: Lang;
  player: "pa_male" | "pa_female";
  playerName: string;
  playerColor: string;
  pa: "pa_male" | "pa_female";
  night: boolean;
  badges: Record<string, number>;
  intro: boolean;
  // war room extras
  states?: { id: string; short: string; support: number; status: string; active: boolean }[];
  seats?: number;
  totalSeats?: number;
  majority?: number;
  day?: number;
  totalDays?: number;
  headline?: string;
  // election-night studio extras
  partyName?: string;
  tally?: { mandat: number; lawan: number; others: number };
  declared?: number;
  scopeLabel?: string;
  current?: { seat: string; state: string; winner: string; result: string };
  call?: string;
  // chamber (swearing-in) extras
  chamberName?: string;
  ownSeats?: number;
  governmentSeats?: number;
  ministers?: { name: string; post: string }[];
  // party headquarters extras
  partyAbbr?: string;
  candidates?: { id: string; name: string; role: string; influence: number; specialty: string; seats: number }[];
  selected?: string;
};

// Room names shown as a toast when the player walks in (both scenes).
const ROOM_NAMES: Record<string, [string, string]> = {
  yb: ["Bilik YB", "YB's Office"],
  mesyuarat: ["Bilik Mesyuarat", "Meeting Room"],
  media: ["Bilik Media", "Media Room"],
  koridor: ["Koridor", "Corridor"],
  gerakan: ["Bilik Gerakan", "Operations Room"],
  lobi: ["Lobi & Ruang Menunggu", "Lobby & Waiting Area"],
  kaunter: ["Kaunter Aduan", "Complaints Counter"],
  surau: ["Surau · Pantri", "Prayer Room · Pantry"],
  luar: ["Luar bangunan", "Outside"],
  analitik: ["Bilik Analitik", "Analytics Room"],
  taklimat: ["Bilik Taklimat", "Briefing Room"],
};
const PARTY_ROOM_NAMES: Record<string, [string, string]> = {
  calon: ["Bilik Calon", "Candidate Room"],
  dewan: ["Dewan Perhimpunan", "Assembly Hall"],
  manifesto: ["Bilik Manifesto", "Manifesto Room"],
  lobi: ["Lobi Parti", "Party Lobby"],
};
const MEDIA_ROOM_NAMES: Record<string, [string, string]> = {
  sidang: ["Bilik Sidang Media", "Press Briefing Room"],
  kawalan: ["Bilik Kawalan Siaran", "Broadcast Control"],
  sosial: ["Meja Media Sosial", "Social Media Desk"],
  lobi: ["Lobi Media", "Media Lobby"],
};
const DEWAN_ROOM_NAMES: Record<string, [string, string]> = {
  dewan: ["Dewan", "Chamber"],
  lobi: ["Lobi Parlimen", "Parliament Lobby"],
};
const WARROOM_ROOM_NAMES: Record<string, [string, string]> = {
  gerakan: ["Bilik Gerakan Utama", "Main Operations Floor"],
  lobi: ["Lobi Keselamatan", "Security Lobby"],
};

// Godot only reads hex colours; party colours may be CSS variables or rgb().
function resolveColor(value: string): string {
  if (typeof window === "undefined" || value.startsWith("#")) return value;
  let css = value;
  const v = value.match(/^var\((--[\w-]+)\)$/);
  if (v) css = getComputedStyle(document.documentElement).getPropertyValue(v[1]).trim() || value;
  if (css.startsWith("#")) return css;
  const probe = document.createElement("span");
  probe.style.color = css;
  document.body.appendChild(probe);
  const rgb = getComputedStyle(probe).color.match(/\d+/g);
  probe.remove();
  if (!rgb || rgb.length < 3) return value;
  return "#" + rgb.slice(0, 3).map((n) => Number(n).toString(16).padStart(2, "0")).join("");
}

export default function GodotWorld({ scene, state, onOpen, onError, onStateClick, onReady, onPick }: {
  scene: WorldScene;
  onPick?: (id: string) => void;
  onReady?: () => void;
  state: GodotWorldState;
  onOpen: (id: string) => void;
  onError: (message: string) => void;
  onStateClick?: (id: string) => void;
}) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [ready, setReady] = useState(false);
  const [progress, setProgress] = useState(0);
  const [introPlaying, setIntroPlaying] = useState(false);
  const [room, setRoom] = useState<string | null>(null);
  const onStateClickRef = useRef(onStateClick);
  const onReadyRef = useRef(onReady);
  const onPickRef = useRef(onPick);
  onPickRef.current = onPick;
  onReadyRef.current = onReady;
  onStateClickRef.current = onStateClick;
  const roomName = (id: string) => (scene === "warroom" ? WARROOM_ROOM_NAMES[id] : scene === "dewan" ? DEWAN_ROOM_NAMES[id] : scene === "party" ? PARTY_ROOM_NAMES[id] : scene === "media" ? MEDIA_ROOM_NAMES[id] : undefined) ?? ROOM_NAMES[id];
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
      if (msg.type === "world-ready") { setReady(true); onReadyRef.current?.(); }
      else if (msg.type === "world-progress" && typeof msg.value === "number") setProgress(msg.value);
      else if (msg.type === "world-intro") setIntroPlaying(msg.playing === true);
      else if (msg.type === "world-error") onErrorRef.current(String(msg.message ?? "error"));
      else if (msg.type === "world-room" && typeof msg.room === "string") {
        if (msg.action === "enter" && roomName(msg.room)) setRoom(msg.room);
        if (msg.action === "open" && typeof msg.id === "string") onOpenRef.current(msg.id);
      }
      else if (msg.type === "world-state-click" && typeof msg.id === "string") onStateClickRef.current?.(msg.id);
      else if (msg.type === "world-pick" && typeof msg.id === "string") onPickRef.current?.(msg.id);
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [scene]); // eslint-disable-line react-hooks/exhaustive-deps

  // The scene keeps no game state; resend whenever the page's view changes.
  useEffect(() => {
    if (ready) post({ type: "world-state", ...state, playerColor: resolveColor(state.playerColor) });
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
        src={`${GODOT_WORLD_URL}?scene=${scene}`}
        title={scene === "warroom" ? t(lang, "Pusat Operasi 3D", "3D operations centre") : scene === "studio" ? t(lang, "Studio Malam Keputusan 3D", "3D election night studio") : scene === "dewan" ? t(lang, "Dewan 3D", "3D chamber") : scene === "party" ? t(lang, "Ibu Pejabat Parti 3D", "3D party headquarters") : scene === "media" ? t(lang, "Pusat Media 3D", "3D media centre") : t(lang, "Pusat Khidmat 3D", "3D service centre")}
        className="absolute inset-0 h-full w-full border-0"
        allow="fullscreen"
      />
      {!ready && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 flex flex-col items-center gap-2" style={{ fontFamily: "'Space Mono', monospace" }}>
          <span className="text-[9px] font-black tracking-[.22em] text-cyan">{scene === "warroom" ? t(lang, "MEMUATKAN PUSAT OPERASI 3D…", "LOADING 3D OPERATIONS CENTRE…") : scene === "studio" ? t(lang, "MEMUATKAN STUDIO 3D…", "LOADING 3D STUDIO…") : scene === "dewan" ? t(lang, "MEMUATKAN DEWAN 3D…", "LOADING 3D CHAMBER…") : scene === "party" ? t(lang, "MEMUATKAN IBU PEJABAT 3D…", "LOADING 3D HEADQUARTERS…") : scene === "media" ? t(lang, "MEMUATKAN PUSAT MEDIA 3D…", "LOADING 3D MEDIA CENTRE…") : t(lang, "MEMUATKAN PEJABAT 3D…", "LOADING 3D OFFICE…")} {Math.round(progress * 100)}%</span>
          <span className="block h-1 w-[min(280px,70vw)] border" style={{ borderColor: "rgb(var(--cyan-rgb) / .45)" }}>
            <span className="block h-full bg-gold transition-[width]" style={{ width: `${Math.round(progress * 100)}%` }} />
          </span>
        </div>
      )}
      {introPlaying && (
        <button type="button" onClick={() => post({ type: "world-skip" })}
          className="world-intro-skip absolute left-1/2 top-[124px] z-40 -translate-x-1/2 border px-4 py-2 text-[10px] font-black tracking-widest text-gold shadow-xl"
          style={{ borderColor: "rgb(var(--gold-rgb) / .6)", background: "rgb(2 8 20 / .9)", fontFamily: "'Space Mono', monospace" }}>
          {t(lang, "LANGKAU ▸▸", "SKIP ▸▸")}
        </button>
      )}
      {room && !introPlaying && (
        <div role="status" className="pointer-events-none absolute left-1/2 top-24 z-10 -translate-x-1/2 border px-4 py-2 text-[11px] font-black tracking-[.2em] text-white"
          style={{ borderColor: "rgb(var(--cyan-rgb) / .45)", background: "rgb(2 8 20 / .82)", fontFamily: "'Space Mono', monospace" }}>
          {(roomName(room) ?? [room, room])[lang === "en" ? 1 : 0].toUpperCase()}
        </div>
      )}
      {scene !== "studio" && <div className="world-3d-hint pointer-events-none absolute bottom-14 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap text-[9px] font-bold tracking-widest text-text-muted" style={{ fontFamily: "'Space Mono', monospace" }}>
        {scene === "dewan"
          ? t(lang, "KLIK TANDA EMAS IKRAR JAWATAN UNTUK ANGKAT SUMPAH · SERET UNTUK GERAK", "CLICK THE GOLD OATH MARKER TO BE SWORN IN · DRAG TO PAN")
          : scene === "party"
          ? t(lang, "KLIK KAD DI PAPAN CALON UNTUK MENILAI CALON · KLIK TANDA EMAS UNTUK BERTINDAK · SERET UNTUK GERAK", "CLICK A CARD ON THE CANDIDATE BOARD TO REVIEW · CLICK A GOLD MARKER TO ACT · DRAG TO PAN")
          : scene === "warroom"
          ? t(lang, "KLIK NEGERI DI MEJA PETA UNTUK BUKA MEDAN · KLIK TANDA EMAS UNTUK BERTINDAK · SERET UNTUK GERAK", "CLICK A STATE ON THE MAP TABLE TO OPEN IT · CLICK A GOLD MARKER TO ACT · DRAG TO PAN")
          : t(lang, "KLIK LANTAI UNTUK BERJALAN · KLIK TANDA EMAS UNTUK BERTINDAK · SERET UNTUK GERAK · KLIK KANAN / DUA JARI UNTUK PUSING", "CLICK THE FLOOR TO WALK · CLICK A GOLD MARKER TO ACT · DRAG TO PAN · RIGHT-DRAG / TWO FINGERS TO ROTATE")}
      </div>}
    </div>
  );
}
