"use client";

// Procedural city soundscape — traffic rumble, an LRT rumble layer, a
// quiet ambient wash, and occasional horn honks. No external audio
// files: everything here is synthesised at runtime with the Web Audio
// API (filtered noise buffers + short oscillator envelopes), so there's
// nothing to source, license, or fail to load. Volume is driven every
// frame by how close the camera currently is (louder zoomed in, at
// street level; fades toward silence at the wide establishing view) and
// by the same live trafficLevel / LRT-presence state the visuals use —
// a "peak hour" moment is audibly busier, not just visually.
//
// Browser autoplay policy means an AudioContext can only start/resume
// after a real user gesture, so `setEnabled(true)` is expected to be
// called from a click handler (see the 🔊 toggle in City3DMapGL).

function makeNoiseBuffer(ctx: AudioContext, seconds: number, brown: boolean): AudioBuffer {
  const rate = ctx.sampleRate;
  const buf = ctx.createBuffer(1, Math.max(1, Math.floor(rate * seconds)), rate);
  const data = buf.getChannelData(0);
  let last = 0;
  for (let i = 0; i < data.length; i++) {
    const white = Math.random() * 2 - 1;
    if (brown) {
      // integrated white noise, renormalised — a much lower, rounder
      // rumble than flat white noise, good for rail/engine hum beds.
      last = (last + white * 0.02) / 1.02;
      data[i] = last * 3.2;
    } else {
      data[i] = white;
    }
  }
  return buf;
}

export type CitySoundState = {
  /** 0 at the widest establishing view, 1 at street level. */
  closeness: number;
  /** 0..1 live traffic density (see trafficProfile / the traffic toggle). */
  trafficLevel: number;
  /** Does this grid size actually have an LRT line running? */
  hasLrt: boolean;
};

export class CitySound {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private trafficGain: GainNode | null = null;
  private lrtGain: GainNode | null = null;
  private enabled = false;
  private hornTimer: number | null = null;
  private closeness = 0;
  private trafficLevel = 0;

  setEnabled(on: boolean) {
    if (on === this.enabled) return;
    this.enabled = on;
    if (on) this.start();
    else this.stop();
  }

  private start() {
    if (this.ctx) { void this.ctx.resume(); this.scheduleHorn(); return; }
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    // Some browsers still hand back a "suspended" context even when the
    // constructor call is inside a user-gesture chain — resume explicitly
    // rather than relying on that.
    void ctx.resume();

    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    this.master = master;

    // Traffic bed: broadband road/engine noise, lowpassed into a distant
    // rumble rather than hiss.
    const trafficSrc = ctx.createBufferSource();
    trafficSrc.buffer = makeNoiseBuffer(ctx, 4, false);
    trafficSrc.loop = true;
    const trafficFilter = ctx.createBiquadFilter();
    trafficFilter.type = "lowpass";
    trafficFilter.frequency.value = 700;
    trafficFilter.Q.value = 0.5;
    const trafficGain = ctx.createGain();
    trafficGain.gain.value = 0;
    trafficSrc.connect(trafficFilter).connect(trafficGain).connect(master);
    trafficSrc.start();
    this.trafficGain = trafficGain;

    // A slow LFO on the traffic filter's cutoff gives the bed a "cars
    // passing by" texture instead of a static drone.
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.11;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 160;
    lfo.connect(lfoGain).connect(trafficFilter.frequency);
    lfo.start();

    // LRT bed: a lower, rounder rumble (brown noise) representing rail
    // + viaduct resonance, plus a soft rhythmic "clack" layer.
    const lrtSrc = ctx.createBufferSource();
    lrtSrc.buffer = makeNoiseBuffer(ctx, 6, true);
    lrtSrc.loop = true;
    const lrtFilter = ctx.createBiquadFilter();
    lrtFilter.type = "lowpass";
    lrtFilter.frequency.value = 240;
    const lrtGain = ctx.createGain();
    lrtGain.gain.value = 0;
    lrtSrc.connect(lrtFilter).connect(lrtGain).connect(master);
    lrtSrc.start();
    this.lrtGain = lrtGain;

    // Ambient city wash: very quiet, always-on baseline once enabled —
    // an empty-feeling silence between traffic swells would read as
    // broken audio, not as a calm city.
    const ambSrc = ctx.createBufferSource();
    ambSrc.buffer = makeNoiseBuffer(ctx, 8, true);
    ambSrc.loop = true;
    const ambFilter = ctx.createBiquadFilter();
    ambFilter.type = "lowpass";
    ambFilter.frequency.value = 500;
    const ambGain = ctx.createGain();
    ambGain.gain.value = 0.04;
    ambSrc.connect(ambFilter).connect(ambGain).connect(master);
    ambSrc.start();

    master.gain.setTargetAtTime(1, ctx.currentTime, 0.6);
    this.scheduleHorn();
  }

  private stop() {
    if (this.hornTimer !== null) { window.clearTimeout(this.hornTimer); this.hornTimer = null; }
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    master.gain.setTargetAtTime(0, ctx.currentTime, 0.35);
    window.setTimeout(() => { void ctx.suspend(); }, 650);
  }

  private honk() {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const t = ctx.currentTime;
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(360 + Math.random() * 60, t);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.05, t + 0.03);
    g.gain.linearRampToValueAtTime(0, t + 0.3);
    osc.connect(g).connect(master);
    osc.start(t);
    osc.stop(t + 0.32);
  }

  private scheduleHorn() {
    if (this.hornTimer !== null) window.clearTimeout(this.hornTimer);
    const delay = 7000 + Math.random() * 15000;
    this.hornTimer = window.setTimeout(() => {
      if (this.enabled && this.closeness > 0.45 && this.trafficLevel > 0.4) this.honk();
      this.scheduleHorn();
    }, delay);
  }

  /** Called every frame (see CitySoundController). Cheap: just a couple of setTargetAtTime calls. */
  update(state: CitySoundState) {
    this.closeness = state.closeness;
    this.trafficLevel = state.trafficLevel;
    const ctx = this.ctx;
    if (!ctx || !this.enabled || !this.trafficGain || !this.lrtGain) return;
    const t = ctx.currentTime;
    const trafficVol = state.closeness * (0.1 + state.trafficLevel * 0.32);
    this.trafficGain.gain.setTargetAtTime(trafficVol, t, 0.4);
    const lrtVol = state.hasLrt ? state.closeness * 0.24 : 0;
    this.lrtGain.gain.setTargetAtTime(lrtVol, t, 0.4);
  }

  dispose() {
    this.stop();
    if (this.ctx) { void this.ctx.close(); this.ctx = null; }
    this.master = null;
    this.trafficGain = null;
    this.lrtGain = null;
  }
}
