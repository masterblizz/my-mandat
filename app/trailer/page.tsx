"use client";
import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import MalaysiaMap from "../components/map/MalaysiaMap";
import { states as initialStates } from "../data/states";

const F: React.CSSProperties = { fontFamily: "Space Mono, monospace" };

// ─────────────────────────────────────────────
// WEB AUDIO ENGINE
// ─────────────────────────────────────────────
function useAudio() {
  const ctx = useRef<AudioContext | null>(null);
  const master = useRef<GainNode | null>(null);
  const droneOsc = useRef<OscillatorNode | null>(null);
  const kickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const init = useCallback(() => {
    if (ctx.current) return;
    const ac = new AudioContext();
    const mg = ac.createGain();
    mg.gain.value = 0.55;
    mg.connect(ac.destination);
    ctx.current = ac;
    master.current = mg;
  }, []);

  const note = useCallback((
    freq: number, type: OscillatorType, gainVal: number,
    dur: number, delay = 0, endFreq?: number
  ) => {
    const ac = ctx.current; const mg = master.current;
    if (!ac || !mg) return;
    const t = ac.currentTime + delay;
    const osc = ac.createOscillator();
    const g = ac.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, t + dur);
    g.gain.setValueAtTime(gainVal, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(mg);
    osc.start(t); osc.stop(t + dur);
  }, []);

  const noise = useCallback((dur: number, filterF: number, gainVal: number, delay = 0) => {
    const ac = ctx.current; const mg = master.current;
    if (!ac || !mg) return;
    const t = ac.currentTime + delay;
    const size = Math.floor(ac.sampleRate * dur);
    const buf = ac.createBuffer(1, size, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < size; i++) d[i] = Math.random() * 2 - 1;
    const src = ac.createBufferSource();
    src.buffer = buf;
    const flt = ac.createBiquadFilter();
    flt.type = "lowpass";
    flt.frequency.value = filterF;
    const g = ac.createGain();
    g.gain.setValueAtTime(gainVal, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(flt); flt.connect(g); g.connect(mg);
    src.start(t);
  }, []);

  // Scene transition: deep boom + snap
  const impact = useCallback(() => {
    note(65, "sine", 0.9, 0.5, 0, 28);
    note(130, "sine", 0.4, 0.25, 0, 50);
    noise(0.07, 3000, 0.4);
  }, [note, noise]);

  // Upward whoosh
  const whoosh = useCallback(() => {
    const ac = ctx.current; const mg = master.current;
    if (!ac || !mg) return;
    const t = ac.currentTime;
    const size = Math.floor(ac.sampleRate * 0.45);
    const buf = ac.createBuffer(1, size, ac.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < size; i++) d[i] = (Math.random() * 2 - 1) * (i / size);
    const src = ac.createBufferSource(); src.buffer = buf;
    const flt = ac.createBiquadFilter();
    flt.type = "bandpass";
    flt.frequency.setValueAtTime(400, t);
    flt.frequency.exponentialRampToValueAtTime(5000, t + 0.45);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.45);
    src.connect(flt); flt.connect(g); g.connect(mg);
    src.start(t);
  }, []);

  // Alarm / breaking-news blip
  const alarm = useCallback(() => {
    [0, 0.12, 0.24].forEach(d => note(880, "square", 0.25, 0.1, d));
  }, [note]);

  // Clicking/typing
  const click = useCallback(() => {
    noise(0.015, 4000, 0.2);
    note(200, "square", 0.05, 0.015);
  }, [note, noise]);

  // Rise — climactic sweep
  const rise = useCallback(() => {
    note(100, "sawtooth", 0.35, 1.8, 0, 450);
    note(150, "triangle", 0.2, 1.8, 0, 680);
    noise(1.8, 1200, 0.15, 0);
  }, [note, noise]);

  // Victory chord (C major spread)
  const glory = useCallback(() => {
    const chord = [130.8, 196, 261.6, 329.6, 392, 523.3];
    chord.forEach((f, i) => note(f, "sine", 0.35, 2.5, i * 0.06));
    note(65.4, "triangle", 0.55, 3.0, 0);
  }, [note]);

  // Start ambient drone + kick pulse
  const startAmbient = useCallback(() => {
    const ac = ctx.current; const mg = master.current;
    if (!ac || !mg) return;

    // Sustained low drone
    const drone = ac.createOscillator();
    const droneG = ac.createGain();
    drone.type = "triangle";
    drone.frequency.value = 55;
    droneG.gain.setValueAtTime(0, ac.currentTime);
    droneG.gain.linearRampToValueAtTime(0.12, ac.currentTime + 1.5);
    droneG.gain.setValueAtTime(0.12, ac.currentTime + 17);
    droneG.gain.linearRampToValueAtTime(0, ac.currentTime + 20.5);
    drone.connect(droneG); droneG.connect(mg);
    drone.start(); droneOsc.current = drone;

    // Sub bass pulse (120 BPM = 0.5s per beat)
    let beat = 0;
    kickRef.current = setInterval(() => {
      beat++;
      if (beat > 40) { clearInterval(kickRef.current!); return; }
      const t2 = ac.currentTime;
      const k = ac.createOscillator();
      const kg = ac.createGain();
      k.type = "sine";
      k.frequency.setValueAtTime(90, t2);
      k.frequency.exponentialRampToValueAtTime(30, t2 + 0.18);
      kg.gain.setValueAtTime(0.28, t2);
      kg.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.22);
      k.connect(kg); kg.connect(mg);
      k.start(t2); k.stop(t2 + 0.25);
    }, 500);
  }, []);

  const stop = useCallback(() => {
    if (kickRef.current) clearInterval(kickRef.current);
    droneOsc.current?.stop();
    ctx.current?.close();
    ctx.current = null; master.current = null;
  }, []);

  return { init, impact, whoosh, alarm, click, rise, glory, startAmbient, stop };
}

// ─────────────────────────────────────────────
// SCENE WRAPPER
// ─────────────────────────────────────────────
function Sc({
  show, children, dur = 0.25, style,
}: {
  show: boolean; children: React.ReactNode; dur?: number; style?: React.CSSProperties;
}) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", overflow: "hidden", ...style }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: dur }}
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// Animated counter
function Counter({ target, dur = 1.5 }: { target: number; dur?: number }) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const start = Date.now();
    const iv = setInterval(() => {
      const p = Math.min((Date.now() - start) / (dur * 1000), 1);
      setVal(Math.round(p * target));
      if (p >= 1) clearInterval(iv);
    }, 30);
    return () => clearInterval(iv);
  }, [target, dur]);
  return <>{val}</>;
}

// Stat bar
function StatBar({ label, pct, color, delay = 0 }: { label: string; pct: number; color: string; delay?: number }) {
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.2em" }}>{label}</span>
        <span style={{ fontSize: 11, fontWeight: 700, color }}>{pct}%</span>
      </div>
      <div style={{ height: 5, background: "var(--panel)", borderRadius: 1, overflow: "hidden" }}>
        <motion.div style={{ height: "100%", background: color, borderRadius: 1 }}
          initial={{ width: "0%" }} animate={{ width: `${pct}%` }}
          transition={{ duration: 1.2, delay, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

// HUD panel
function Panel({ title, children, color = "var(--cyan)", style }: {
  title?: string; children: React.ReactNode; color?: string; style?: React.CSSProperties;
}) {
  return (
    <div style={{ border: `1px solid ${color}28`, background: `${color}06`, padding: "12px 14px", ...style }}>
      {title && <div style={{ fontSize: 10, color, letterSpacing: "0.3em", marginBottom: 10, borderBottom: `1px solid ${color}18`, paddingBottom: 6 }}>{title}</div>}
      {children}
    </div>
  );
}

// Flash overlay (scene-change effect)
function Flash({ show }: { show: boolean }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          style={{ position: "absolute", inset: 0, background: "var(--cyan)", zIndex: 99, pointerEvents: "none" }}
          initial={{ opacity: 0.7 }}
          animate={{ opacity: 0 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
        />
      )}
    </AnimatePresence>
  );
}

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────
export default function TrailerPage() {
  const [time, setTime] = useState(-1);
  const [running, setRunning] = useState(false);
  const [flash, setFlash] = useState(false);
  const [bootLines, setBootLines] = useState<string[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval>>();
  const bootRef = useRef<ReturnType<typeof setInterval>>();
  const audio = useAudio();

  const BOOT_TEXT = [
    "> SYSTEM BOOT — MY MANDAT v2.0 ...",
    "> LOADING ELECTORAL DATABASE: 222 SEATS",
    "> INITIALIZING 14 STATE MODULES...",
    "> CAMPAIGN MACHINE: ONLINE",
    "> PARLIAMENT DISSOLVED — DAY ZERO",
  ];

  const done = time >= 20.0;
  const s = (start: number, end: number) => time >= start && time < end;
  const a = (t: number) => time >= t;

  const triggerFlash = useCallback(() => {
    setFlash(true);
    setTimeout(() => setFlash(false), 280);
  }, []);

  // Schedule audio cues at specific timestamps
  const lastCue = useRef(-1);
  useEffect(() => {
    const cues: [number, () => void][] = [
      [0.0, () => { audio.alarm(); audio.startAmbient(); }],
      [2.0, () => { audio.impact(); audio.whoosh(); }],
      [4.5, () => { audio.impact(); triggerFlash(); }],
      [7.0, () => { audio.whoosh(); }],
      [9.0, () => { audio.alarm(); audio.impact(); triggerFlash(); }],
      [11.0, () => { audio.whoosh(); }],
      [13.5, () => { audio.rise(); triggerFlash(); }],
      [15.5, () => { audio.impact(); }],
      [16.5, () => { audio.glory(); }],
      [19.0, () => { audio.whoosh(); }],
    ];
    cues.forEach(([t, fn]) => {
      if (time >= t && lastCue.current < t) { fn(); lastCue.current = t; }
    });
  }, [time, audio, triggerFlash]);

  function play() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (bootRef.current) clearInterval(bootRef.current);
    audio.stop();
    audio.init();
    lastCue.current = -1;
    setBootLines([]);
    setTime(0);
    setRunning(true);

    // Boot text typewriter
    let bi = 0;
    bootRef.current = setInterval(() => {
      if (bi < BOOT_TEXT.length) { setBootLines(p => [...p, BOOT_TEXT[bi]]); bi++; }
      else clearInterval(bootRef.current);
    }, 360);

    timerRef.current = setInterval(() => {
      setTime(t => {
        const n = +(t + 0.1).toFixed(1);
        if (n >= 20.5) { clearInterval(timerRef.current); setRunning(false); return 20.5; }
        return n;
      });
    }, 100);
  }

  useEffect(() => () => {
    clearInterval(timerRef.current); clearInterval(bootRef.current); audio.stop();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Colored states for trailer map
  const trailerStates = initialStates.map((st, i) => ({
    ...st,
    mandatSupport: i % 3 === 0 ? 55 + i : i % 3 === 1 ? 38 : 48,
  }));

  if (time < 0) {
    return (
      <div style={{ minHeight: "100svh", background: "#000", display: "flex", alignItems: "center", justifyContent: "center", ...F }}>
        <div style={{ textAlign: "center", maxWidth: 380, padding: "0 24px" }}>
          <div style={{ fontSize: 11, color: "var(--cyan)", letterSpacing: "0.45em", marginBottom: 14 }}>{"// GAME TRAILER · TIKTOK EDITION"}</div>
          <div style={{ fontSize: 58, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 6 }}>
            <span style={{ color: "var(--text-primary)" }}>MY </span>
            <span style={{ color: "var(--gold)", textShadow: "0 0 28px rgb(var(--gold-rgb) / 0.7)" }}>MANDAT</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.25em", marginBottom: 32 }}>20-SECOND PROMOTIONAL TRAILER</div>

          <div style={{ border: "1px solid rgb(var(--cyan-rgb) / 0.15)", background: "rgb(var(--cyan-rgb) / 0.04)", padding: "16px 20px", marginBottom: 28, textAlign: "left" }}>
            <div style={{ fontSize: 11, color: "var(--cyan)", letterSpacing: "0.3em", marginBottom: 10 }}>RECORDING GUIDE</div>
            {["1. Resize browser to portrait (narrow + tall, ~390px wide)", "2. Enable audio — click PLAY TRAILER", "3. Screen-record the preview box", "4. Trim, add captions in CapCut", "5. Upload to TikTok / Reels / Shorts"].map(t => (
              <div key={t} style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.08em", lineHeight: 2 }}>{t}</div>
            ))}
          </div>

          <button onClick={play} style={{ background: "var(--gold)", color: "#000", border: "none", padding: "14px 44px", fontSize: 16, fontWeight: 700, letterSpacing: "0.25em", cursor: "pointer", boxShadow: "0 0 32px rgb(var(--gold-rgb) / 0.5)", ...F }}>
            {running ? "PLAYING" : "PLAY TRAILER"}
          </button>
          <div style={{ fontSize: 10, color: "rgb(var(--text-muted-rgb,136 153 170) / 0.2)", marginTop: 14, letterSpacing: "0.15em" }}>SOUND INCLUDED · USE HEADPHONES</div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: "100svh", background: "#000", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 14, padding: "12px 0", ...F }}>

      {/* ── TRAILER CONTAINER 9:16 ── */}
      <div style={{ width: "min(390px, 100vw)", aspectRatio: "9/16", maxHeight: "92svh", background: "#000408", position: "relative", overflow: "hidden", outline: "1px solid rgb(var(--cyan-rgb) / 0.1)" }}>

        {/* Scanlines */}
        <div style={{ position: "absolute", inset: 0, zIndex: 90, pointerEvents: "none", backgroundImage: "repeating-linear-gradient(0deg, transparent, transparent 2px, rgb(var(--cyan-rgb) / 0.01) 2px, rgb(var(--cyan-rgb) / 0.01) 4px)" }} />

        {/* Corner brackets */}
        {([{ top: 10, left: 10, d: 0 }, { top: 10, right: 10, d: 90 }, { bottom: 10, left: 10, d: 270 }, { bottom: 10, right: 10, d: 180 }] as Array<{ top?: number; bottom?: number; left?: number; right?: number; d: number }>).map((pos, i) => {
          const { d, ...p } = pos;
          return <div key={i} style={{ position: "absolute", ...p, width: 20, height: 20, borderTop: "2px solid rgb(var(--cyan-rgb) / 0.35)", borderLeft: "2px solid rgb(var(--cyan-rgb) / 0.35)", transform: `rotate(${d}deg)`, zIndex: 91, pointerEvents: "none" }} />;
        })}

        {/* Flash overlay */}
        <Flash show={flash} />

        {/* ══════════════════════════════════
            SCENE 1 · 0.0–2.0s · BOOT
        ══════════════════════════════════ */}
        <Sc show={s(0, 2.0)} dur={0.1}>
          <div style={{ width: "100%", padding: "0 28px" }}>
            <div style={{ fontSize: 11, color: "var(--cyan)", letterSpacing: "0.35em", marginBottom: 14 }}>{"// SYSTEM BOOT"}</div>
            {bootLines.map((line, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.15 }}
                style={{ fontSize: 12, color: i === bootLines.length - 1 ? "var(--neon-green)" : "var(--text-muted)", letterSpacing: "0.1em", lineHeight: 2 }}>
                {line}
              </motion.div>
            ))}
            {bootLines.length < BOOT_TEXT.length && <span style={{ display: "inline-block", width: 8, height: 12, background: "var(--cyan)", marginLeft: 4, animation: "none", opacity: Math.floor(time * 4) % 2 === 0 ? 1 : 0 }} />}
            {bootLines.length === BOOT_TEXT.length && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                style={{ fontSize: 11, color: "var(--gold)", letterSpacing: "0.3em", marginTop: 10 }}>
                ALL SYSTEMS GO
              </motion.div>
            )}
          </div>
        </Sc>

        {/* ══════════════════════════════════
            SCENE 2 · 2.0–4.5s · TITLE REVEAL
        ══════════════════════════════════ */}
        <Sc show={s(2.0, 4.5)}>
          <div style={{ textAlign: "center", padding: "0 24px" }}>
            <motion.div style={{ fontSize: 10, color: "rgb(var(--cyan-rgb) / 0.5)", letterSpacing: "0.5em", marginBottom: 20 }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.5 }}>
              MALAYSIA · CAMPAIGN COMMAND
            </motion.div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 10 }}>
              <motion.span style={{ fontSize: 96, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "0.06em", lineHeight: 1 }}
                initial={{ opacity: 0, x: -50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.45 }}>MY</motion.span>
              <motion.span style={{ fontSize: 96, fontWeight: 700, color: "var(--gold)", letterSpacing: "0.06em", lineHeight: 1, textShadow: "0 0 60px rgb(var(--gold-rgb) / 1), 0 0 120px rgb(var(--gold-rgb) / 0.5)" }}
                initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} transition={{ duration: 0.45, delay: 0.08 }}>MANDAT</motion.span>
            </div>
            <motion.div style={{ width: "100%", height: 1, background: "linear-gradient(to right,transparent,var(--cyan),transparent)", marginTop: 20 }}
              initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.8, delay: 0.3 }} />
            <motion.div style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", letterSpacing: "0.32em", marginTop: 12 }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
              CAMPAIGN COMMAND SIMULATOR
            </motion.div>
          </div>
        </Sc>

        {/* ══════════════════════════════════
            SCENE 3 · 4.5–7.0s · WAR ROOM (ACTUAL GAMEPLAY)
        ══════════════════════════════════ */}
        <Sc show={s(4.5, 7.0)}>
          <div style={{ width: "100%", padding: "0 18px" }}>
            <div style={{ fontSize: 10, color: "var(--cyan)", letterSpacing: "0.4em", marginBottom: 10, textAlign: "center" }}>
              {"// WAR ROOM · DAY 08 / 14"}
            </div>

            {/* Mini map */}
            <motion.div style={{ position: "relative", marginBottom: 10 }}
              initial={{ opacity: 0, scale: 0.92 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }}>
              <div style={{ position: "absolute", inset: "10%", background: "radial-gradient(circle,rgb(var(--cyan-rgb) / 0.14) 0%,transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
              <MalaysiaMap states={trailerStates} compact showLabels />
            </motion.div>

            {/* Stats row */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6, marginBottom: 10 }}>
              {[
                { label: "PROJECTED", val: "89", color: "var(--gold)", sub: "/ 112 SEATS" },
                { label: "SUPPORT", val: "48%", color: "var(--cyan)", sub: "NATIONAL" },
                { label: "RESOURCES", val: "RM2.4M", color: "var(--neon-green)", sub: "REMAINING" },
              ].map((item, i) => (
                <motion.div key={item.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.12 }}
                  style={{ border: "1px solid rgba(255,255,255,0.07)", background: "rgba(255,255,255,0.02)", padding: "8px", textAlign: "center" }}>
                  <div style={{ fontSize: 17, fontWeight: 700, color: item.color }}>{item.val}</div>
                  <div style={{ fontSize: 8, color: "var(--text-muted)", marginTop: 2, letterSpacing: "0.1em" }}>{item.sub}</div>
                </motion.div>
              ))}
            </div>

            {/* NEXT DAY button — animated press */}
            <motion.button
              style={{ width: "100%", padding: "12px", background: "linear-gradient(135deg,rgb(var(--cyan-rgb) / 0.09),rgb(var(--gold-rgb) / 0.09))", border: "1px solid var(--gold)", color: "var(--gold)", fontSize: 13, fontWeight: 700, letterSpacing: "0.25em", cursor: "default", ...F }}
              animate={{ scale: [1, 0.97, 1], boxShadow: ["0 0 0px rgb(var(--gold-rgb) / 0)", "0 0 24px rgb(var(--gold-rgb) / 0.6)", "0 0 0px rgb(var(--gold-rgb) / 0)"] }}
              transition={{ delay: 1.2, duration: 0.4 }}>
              NEXT DAY  {">>"}
            </motion.button>
          </div>
        </Sc>

        {/* ══════════════════════════════════
            SCENE 4 · 7.0–9.0s · DEPLOY OPERATIONS
        ══════════════════════════════════ */}
        <Sc show={s(7.0, 9.0)}>
          <div style={{ width: "100%", padding: "0 18px" }}>
            <div style={{ fontSize: 10, color: "var(--gold)", letterSpacing: "0.4em", marginBottom: 12, textAlign: "center" }}>
              {"// CAMPAIGN HEADQUARTERS"}
            </div>
            {[
              { name: "MEGA RALLY", loc: "SELANGOR", cost: "RM 80K", effect: "+6% SUPPORT", color: "var(--cyan)", deployed: true },
              { name: "MEDIA BLITZ", loc: "KUALA LUMPUR", cost: "RM 120K", effect: "+8% SENTIMENT", color: "var(--gold)", deployed: false },
              { name: "GRASSROOTS", loc: "JOHOR", cost: "RM 45K", effect: "+4% GROUND", color: "var(--neon-green)", deployed: false },
            ].map((op, i) => (
              <motion.div key={op.name}
                initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.18 }}
                style={{ border: `1px solid ${op.deployed ? op.color : "rgba(255,255,255,0.06)"}`, background: op.deployed ? `${op.color}08` : "transparent", padding: "10px 12px", marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: op.deployed ? op.color : "#fff", letterSpacing: "0.12em" }}>{op.name}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{op.loc} · {op.cost}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: op.color, letterSpacing: "0.12em", marginBottom: 4 }}>{op.effect}</div>
                  <div style={{ fontSize: 10, fontWeight: 700, padding: "3px 10px", border: `1px solid ${op.color}`, color: op.deployed ? "#000" : op.color, background: op.deployed ? op.color : "transparent" }}>
                    {op.deployed ? "ACTIVE" : "DEPLOY"}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </Sc>

        {/* ══════════════════════════════════
            SCENE 5 · 9.0–11.0s · CRISIS EVENT
        ══════════════════════════════════ */}
        <Sc show={s(9.0, 11.0)}>
          <div style={{ width: "100%", padding: "0 18px" }}>
            {/* Dimmed background hint */}
            <motion.div
              style={{ border: "1px solid rgb(255 68 68 / 0.38)", background: "rgb(255 68 68 / 0.06)", padding: "18px 16px" }}
              initial={{ opacity: 0, scale: 0.92, y: -10 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: "spring", stiffness: 200 }}>
              <div style={{ fontSize: 12, color: "var(--neon-red)", letterSpacing: "0.4em", marginBottom: 12, textAlign: "center" }}>
                !! CRISIS EVENT !!
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "0.1em", marginBottom: 6, textAlign: "center", lineHeight: 1.3 }}>
                VIRAL SOCIAL MEDIA SCANDAL
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.08em", lineHeight: 1.8, marginBottom: 16, textAlign: "center" }}>
                Opposition leaks damaging footage of your party meeting. National support drops -4%. Media sentiment turns hostile.
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { label: "DENY & DEFLECT", color: "var(--warn-orange)" },
                  { label: "ISSUE PUBLIC APOLOGY", color: "var(--cyan)" },
                  { label: "LAUNCH COUNTER-ATTACK", color: "var(--neon-red)" },
                ].map((btn, i) => (
                  <motion.div key={btn.label} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 + i * 0.15 }}
                    style={{ padding: "9px 14px", border: `1px solid ${btn.color}50`, color: btn.color, fontSize: 11, fontWeight: 700, letterSpacing: "0.2em", textAlign: "center", background: `${btn.color}08` }}>
                    {btn.label}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </div>
        </Sc>

        {/* ══════════════════════════════════
            SCENE 6 · 11.0–13.5s · POLLING SURGE
        ══════════════════════════════════ */}
        <Sc show={s(11.0, 13.5)}>
          <div style={{ width: "100%", padding: "0 18px" }}>
            <div style={{ fontSize: 10, color: "var(--cyan)", letterSpacing: "0.4em", marginBottom: 14, textAlign: "center" }}>
              {"// POLLING & ANALYTICS"}
            </div>
            <Panel title="STATE BREAKDOWN" style={{ marginBottom: 10 }}>
              <StatBar label="SELANGOR" pct={62} color="var(--cyan)" />
              <StatBar label="KUALA LUMPUR" pct={71} color="var(--cyan)" delay={0.1} />
              <StatBar label="JOHOR" pct={44} color="var(--gold)" delay={0.2} />
              <StatBar label="SABAH" pct={38} color="var(--neon-red)" delay={0.3} />
              <StatBar label="SARAWAK" pct={53} color="var(--cyan)" delay={0.4} />
            </Panel>
            <Panel color="var(--gold)">
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.2em", marginBottom: 4 }}>COALITION SEATS</div>
                  <motion.div style={{ fontSize: 43, fontWeight: 700, color: "var(--gold)", textShadow: "0 0 20px rgb(var(--gold-rgb) / 0.6)" }}>
                    <Counter target={112} dur={2} />
                  </motion.div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.1em", marginBottom: 4 }}>TARGET</div>
                  <div style={{ fontSize: 17, fontWeight: 700, color: "var(--neon-green)" }}>112 / 222</div>
                  <div style={{ fontSize: 11, color: "var(--neon-green)", letterSpacing: "0.2em", marginTop: 4 }}>MAJORITY</div>
                </div>
              </div>
            </Panel>
          </div>
        </Sc>

        {/* ══════════════════════════════════
            SCENE 7 · 13.5–15.5s · STAKES
        ══════════════════════════════════ */}
        <Sc show={s(13.5, 15.5)}>
          <div style={{ textAlign: "center" }}>
            <motion.div style={{ fontSize: 12, color: "rgb(var(--gold-rgb) / 0.5)", letterSpacing: "0.45em", marginBottom: 20 }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}>YOUR MISSION</motion.div>
            <motion.div style={{ fontSize: 132, fontWeight: 700, lineHeight: 1, color: "var(--gold)", textShadow: "0 0 80px rgb(var(--gold-rgb) / 0.9),0 0 160px rgb(var(--gold-rgb) / 0.4)" }}
              initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.45, type: "spring", stiffness: 130 }}>112</motion.div>
            <motion.div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "0.14em", marginTop: 10 }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
              SEATS TO FORM GOVERNMENT
            </motion.div>
            <motion.div style={{ width: "50%", height: 1, background: "linear-gradient(to right,transparent,var(--gold),transparent)", margin: "18px auto" }}
              initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.45, duration: 0.5 }} />
            <motion.div style={{ fontSize: 48, fontWeight: 700, color: "var(--neon-red)", textShadow: "0 0 24px rgb(255 68 68 / 0.7)" }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>14 DAYS</motion.div>
            <motion.div style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.3em", marginTop: 6 }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>UNTIL ELECTION DAY</motion.div>
          </div>
        </Sc>

        {/* ══════════════════════════════════
            SCENE 8 · 15.5–17.5s · STRATEGY WORDS
        ══════════════════════════════════ */}
        <Sc show={s(15.5, 17.5)}>
          <div style={{ textAlign: "center", padding: "0 28px" }}>
            {[
              { text: "RALLY THE BASE.", color: "var(--cyan)", delay: 0 },
              { text: "DOMINATE THE NARRATIVE.", color: "var(--gold)", delay: 0.4 },
              { text: "WIN THE GROUND.", color: "var(--neon-green)", delay: 0.8 },
            ].map(item => (
              <motion.div key={item.text}
                style={{ fontSize: 29, fontWeight: 700, letterSpacing: "0.07em", color: item.color, textShadow: `0 0 24px ${item.color}99`, marginBottom: 22 }}
                initial={{ opacity: 0, x: -28 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: item.delay, duration: 0.35 }}>
                {item.text}
              </motion.div>
            ))}
            <motion.div style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.3em" }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}>
              — EVERY CHOICE SHAPES THE NATION —
            </motion.div>
          </div>
        </Sc>

        {/* ══════════════════════════════════
            SCENE 9 · 17.5–19.5s · HERO LOGO
        ══════════════════════════════════ */}
        <Sc show={s(17.5, 19.5)}>
          <div style={{ textAlign: "center", width: "100%", padding: "0 24px", position: "relative" }}>
            <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 50% 45%,rgb(var(--gold-rgb) / 0.08) 0%,transparent 70%)", pointerEvents: "none" }} />
            <motion.div style={{ fontSize: 11, color: "rgb(var(--cyan-rgb) / 0.5)", letterSpacing: "0.5em", marginBottom: 20 }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}>MALAYSIA · 2025</motion.div>
            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "center", gap: 10, marginBottom: 10 }}>
              <motion.span style={{ fontSize: 84, fontWeight: 700, color: "var(--text-primary)", letterSpacing: "0.06em" }}
                initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15, duration: 0.5 }}>MY</motion.span>
              <motion.span style={{ fontSize: 84, fontWeight: 700, color: "var(--gold)", letterSpacing: "0.06em", textShadow: "0 0 60px rgb(var(--gold-rgb) / 1),0 0 120px rgb(var(--gold-rgb) / 0.5)" }}
                initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25, duration: 0.5 }}>MANDAT</motion.span>
            </div>
            <motion.div style={{ fontSize: 11, color: "rgba(255,255,255,0.28)", letterSpacing: "0.32em", marginBottom: 28 }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>CAMPAIGN COMMAND SIMULATOR</motion.div>
            <motion.div style={{ display: "flex", flexDirection: "column", gap: 7, alignItems: "center" }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
              {["REAL MALAYSIAN POLITICS · 14 STATES", "LIVE POLLING & ANALYTICS", "DEPLOY FIELD OPERATIVES", "CRISIS EVENTS & RANDOM ENCOUNTERS", "4 DIFFICULTY LEVELS"].map(f => (
                <div key={f} style={{ fontSize: 10, color: "var(--text-muted)", letterSpacing: "0.12em", padding: "5px 16px", border: "1px solid rgb(var(--cyan-rgb) / 0.1)", background: "rgb(var(--cyan-rgb) / 0.03)" }}>{f}</div>
              ))}
            </motion.div>
          </div>
        </Sc>

        {/* ══════════════════════════════════
            SCENE 10 · 19.5+ · CTA
        ══════════════════════════════════ */}
        <Sc show={a(19.5)} dur={0.4}>
          <div style={{ textAlign: "center" }}>
            <motion.div style={{ fontSize: 12, color: "var(--cyan)", letterSpacing: "0.45em", marginBottom: 14 }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}>AVAILABLE NOW · FREE</motion.div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center", alignItems: "baseline", marginBottom: 6 }}>
              <motion.span style={{ fontSize: 70, fontWeight: 700, color: "var(--text-primary)" }}
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}>MY</motion.span>
              <motion.span style={{ fontSize: 70, fontWeight: 700, color: "var(--gold)", textShadow: "0 0 40px rgb(var(--gold-rgb) / 0.9)" }}
                initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.15 }}>MANDAT</motion.span>
            </div>
            <motion.div style={{ fontSize: 22, fontWeight: 700, color: "#000", letterSpacing: "0.25em", background: "var(--gold)", padding: "14px 36px", display: "inline-block", boxShadow: "0 0 40px rgb(var(--gold-rgb) / 0.55)", marginTop: 24 }}
              initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
              PLAY NOW
            </motion.div>
            <motion.div style={{ fontSize: 11, color: "var(--text-muted)", letterSpacing: "0.2em", marginTop: 18 }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.65 }}>
              FREE · BROWSER · NO DOWNLOAD
            </motion.div>
          </div>
        </Sc>

        {/* Replay */}
        <AnimatePresence>
          {done && (
            <motion.div style={{ position: "absolute", bottom: 26, left: 0, right: 0, display: "flex", justifyContent: "center", zIndex: 95 }}
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
              <button onClick={play} style={{ background: "rgb(var(--gold-rgb) / 0.1)", color: "var(--gold)", border: "1px solid rgb(var(--gold-rgb) / 0.5)", padding: "10px 28px", fontSize: 12, letterSpacing: "0.22em", cursor: "pointer", ...F }}>
                REPLAY
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Progress bar */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 2, background: "rgb(var(--cyan-rgb) / 0.1)", zIndex: 95 }}>
          <div style={{ height: "100%", background: "linear-gradient(to right,var(--cyan),var(--gold))", width: `${Math.min((time / 20) * 100, 100)}%`, transition: "width 0.1s linear" }} />
        </div>
      </div>

      <div style={{ fontSize: 10, color: "rgb(var(--text-muted-rgb,136 153 170) / 0.27)", letterSpacing: "0.2em" }}>
        RECORD THE BOX ABOVE · ADD MUSIC IN CAPCUT
      </div>
    </div>
  );
}
