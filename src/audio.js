// audio.js — everything you hear, synthesised at runtime.
//
// No audio files: the whole soundtrack is oscillators and filtered noise, so
// the game ships as nothing but text and still has a shofar in it.
//
// The scale is Ahava Rabbah (Phrygian dominant) — the augmented second between
// the second and third degrees is the interval that makes it sound like this
// and not like a generic minor key.

const AHAVA = [0, 1, 4, 5, 7, 8, 10];
const ROOT = 73.4162;                      // D2

const clamp01 = v => (v < 0 ? 0 : v > 1 ? 1 : v);

function noiseBuffer(ctx, seconds = 2, color = 'white') {
  const n = Math.floor(ctx.sampleRate * seconds);
  const buf = ctx.createBuffer(1, n, ctx.sampleRate);
  const d = buf.getChannelData(0);
  if (color === 'brown') {
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      last = (last + 0.02 * w) / 1.02;
      d[i] = last * 3.5;
    }
  } else if (color === 'pink') {
    let b0 = 0, b1 = 0, b2 = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      b0 = 0.99765 * b0 + w * 0.0990460;
      b1 = 0.96300 * b1 + w * 0.2965164;
      b2 = 0.57000 * b2 + w * 1.0526913;
      d[i] = (b0 + b1 + b2 + w * 0.1848) * 0.22;
    }
  } else {
    for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
  }
  return buf;
}

function impulse(ctx, decay = 2.4) {
  const n = Math.floor(ctx.sampleRate * decay);
  const buf = ctx.createBuffer(2, n, ctx.sampleRate);
  for (let c = 0; c < 2; c++) {
    const d = buf.getChannelData(c);
    for (let i = 0; i < n; i++) {
      const t = i / n;
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.6);
    }
  }
  return buf;
}

export class Audio {
  constructor() {
    this.ctx = null;
    this.ready = false;
    this.muted = false;
    this._pending = [];
    this._lastCue = new Map();
  }

  async start() {
    if (this.ready) return;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    const ctx = this.ctx = new AC();
    if (ctx.state === 'suspended') { try { await ctx.resume(); } catch {} }

    this.master = ctx.createGain();
    this.master.gain.value = 0.85;

    this.comp = ctx.createDynamicsCompressor();
    this.comp.threshold.value = -16;
    this.comp.knee.value = 24;
    this.comp.ratio.value = 7;
    this.comp.attack.value = 0.004;
    this.comp.release.value = 0.22;

    this.rev = ctx.createConvolver();
    this.rev.buffer = impulse(ctx, 2.6);
    this.revGain = ctx.createGain();
    this.revGain.gain.value = 0.26;

    this.bus = ctx.createGain();
    this.bus.connect(this.comp);
    this.bus.connect(this.revGain);
    this.revGain.connect(this.rev);
    this.rev.connect(this.comp);
    this.comp.connect(this.master);
    this.master.connect(ctx.destination);

    this.noiseW = noiseBuffer(ctx, 2, 'white');
    this.noiseP = noiseBuffer(ctx, 2, 'pink');
    this.noiseB = noiseBuffer(ctx, 3, 'brown');

    this._buildRain();
    this._buildBed();

    this.ready = true;
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) this.ctx.suspend?.();
      else if (!this.muted) this.ctx.resume?.();
    });

    for (const fn of this._pending) { try { fn(); } catch {} }
    this._pending.length = 0;
  }

  _defer(fn) { if (this.ready) { try { fn(); } catch {} } else if (this._pending.length < 40) this._pending.push(fn); }

  setMuted(on) {
    this.muted = !!on;
    if (!this.ready) return;
    this.master.gain.setTargetAtTime(on ? 0 : 0.85, this.ctx.currentTime, 0.08);
    if (on) this.ctx.suspend?.(); else this.ctx.resume?.();
  }

  /* ───────── continuous rain bed ───────── */
  _buildRain() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseP;
    src.loop = true;

    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass'; hp.frequency.value = 420;

    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 2400;

    const g = ctx.createGain();
    g.gain.value = 0;

    src.connect(hp); hp.connect(lp); lp.connect(g); g.connect(this.bus);
    src.start();

    this.rain = { g, lp, hp };

    // a low hiss layer that comes in with the heavy rain
    const src2 = ctx.createBufferSource();
    src2.buffer = this.noiseB;
    src2.loop = true;
    const lp2 = ctx.createBiquadFilter();
    lp2.type = 'lowpass'; lp2.frequency.value = 220;
    const g2 = ctx.createGain(); g2.gain.value = 0;
    src2.connect(lp2); lp2.connect(g2); g2.connect(this.bus);
    src2.start();
    this.rumble = { g: g2 };
  }

  setRain(level) {
    this._defer(() => {
      const t = this.ctx.currentTime;
      const v = clamp01(level);
      this.rain.g.gain.setTargetAtTime(v * 0.30, t, 0.9);
      this.rain.lp.frequency.setTargetAtTime(1600 + v * 5200, t, 1.2);
      this.rumble.g.gain.setTargetAtTime(v * v * 0.26, t, 1.4);
    });
  }

  /* ───────── music bed ───────── */
  _buildBed() {
    const ctx = this.ctx;
    this.bed = ctx.createGain();
    this.bed.gain.value = 0;
    this.bed.connect(this.bus);

    // two drones a fifth apart, slightly detuned so they beat
    this.drones = [];
    for (const [mult, det, gain] of [[1, 0, 0.12], [1.5, 4, 0.07], [2, -5, 0.05]]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = ROOT * mult;
      o.detune.value = det;
      const f = ctx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 420; f.Q.value = 3;
      const g = ctx.createGain(); g.gain.value = gain;
      o.connect(f); f.connect(g); g.connect(this.bed);
      o.start();
      this.drones.push({ o, f, g });
    }
    this.bedLevel = 0;
  }

  setMusic(level, tension = 0) {
    this._defer(() => {
      const t = this.ctx.currentTime;
      this.bedLevel = clamp01(level);
      this.bed.gain.setTargetAtTime(this.bedLevel * 0.5, t, 1.2);
      for (const d of this.drones) {
        d.f.frequency.setTargetAtTime(300 + tension * 900, t, 1.6);
      }
    });
  }

  /** A sparse melodic ping, so the bed is not static. */
  ping(degree = 0, oct = 2) {
    this._defer(() => {
      const ctx = this.ctx, t = ctx.currentTime;
      const semi = AHAVA[((degree % 7) + 7) % 7] + 12 * oct;
      const f = ROOT * Math.pow(2, semi / 12);
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.10, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
      o.connect(g); g.connect(this.bus);
      o.start(t); o.stop(t + 1.9);
    });
  }

  /* ───────── one-shots ───────── */

  _gate(name, ms) {
    const now = performance.now();
    const last = this._lastCue.get(name) || 0;
    if (now - last < ms) return false;
    this._lastCue.set(name, now);
    return true;
  }

  /**
   * The shofar. A ram's horn has no valves and barely any bore shaping, so it
   * is mostly one buzzing partial that cracks up to the next one. Modelled as
   * a sawtooth through a tight bandpass, with a pitch scoop at the front and a
   * break upward partway through.
   */
  shofar() {
    if (!this._gate('shofar', 260)) return;
    this._defer(() => {
      const ctx = this.ctx, t = ctx.currentTime;
      const base = 196;                      // ~G3

      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(base * 0.72, t);
      o.frequency.exponentialRampToValueAtTime(base, t + 0.09);
      o.frequency.setValueAtTime(base, t + 0.42);
      o.frequency.exponentialRampToValueAtTime(base * 1.5, t + 0.52);  // the crack
      o.frequency.exponentialRampToValueAtTime(base * 1.48, t + 1.15);

      // lip buzz
      const vib = ctx.createOscillator();
      vib.frequency.value = 5.4;
      const vibG = ctx.createGain(); vibG.gain.value = 3.4;
      vib.connect(vibG); vibG.connect(o.detune);
      vib.start(t); vib.stop(t + 1.4);

      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.setValueAtTime(520, t);
      bp.frequency.linearRampToValueAtTime(1150, t + 0.5);
      bp.Q.value = 2.4;

      const hp = ctx.createBiquadFilter();
      hp.type = 'highpass'; hp.frequency.value = 150;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(0.34, t + 0.05);
      g.gain.setValueAtTime(0.34, t + 0.95);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 1.35);

      // breath noise around the attack
      const nz = ctx.createBufferSource();
      nz.buffer = this.noiseW;
      const nf = ctx.createBiquadFilter();
      nf.type = 'bandpass'; nf.frequency.value = 1400; nf.Q.value = 0.8;
      const ng = ctx.createGain();
      ng.gain.setValueAtTime(0.10, t);
      ng.gain.exponentialRampToValueAtTime(0.0005, t + 0.35);
      nz.connect(nf); nf.connect(ng); ng.connect(this.bus);
      nz.start(t); nz.stop(t + 0.4);

      o.connect(bp); bp.connect(hp); hp.connect(g); g.connect(this.bus);
      o.start(t); o.stop(t + 1.4);
    });
  }

  thunder(distance = 0.5) {
    if (!this._gate('thunder', 900)) return;
    this._defer(() => {
      const ctx = this.ctx, t = ctx.currentTime;
      const near = 1 - clamp01(distance);

      const src = ctx.createBufferSource();
      src.buffer = this.noiseB;
      src.playbackRate.value = 0.7 + Math.random() * 0.4;

      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(260 + near * 900, t);
      lp.frequency.exponentialRampToValueAtTime(70, t + 2.4 + near);

      const g = ctx.createGain();
      const peak = 0.22 + near * 0.5;
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(peak, t + (near > 0.6 ? 0.01 : 0.18));
      g.gain.exponentialRampToValueAtTime(0.0001, t + 2.6 + near * 1.6);

      src.connect(lp); lp.connect(g); g.connect(this.bus);
      src.start(t); src.stop(t + 4.4);
    });
  }

  /** Silly per-species vocalisation. Not realistic; meant to read as a honk. */
  honk(key = '', big = false) {
    if (!this._gate('honk' + key, 140)) return;
    this._defer(() => {
      const ctx = this.ctx, t = ctx.currentTime;
      // derive a stable pitch per species name
      let h = 0;
      for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
      const base = big ? 90 + (h % 40) : 190 + (h % 260);
      const type = ['square', 'sawtooth', 'triangle'][h % 3];

      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(base, t);
      o.frequency.linearRampToValueAtTime(base * (1 + ((h >> 3) % 7) * 0.06), t + 0.12);
      o.frequency.linearRampToValueAtTime(base * 0.86, t + 0.3);

      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = base * 2.4;
      f.Q.value = 1.4;

      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(big ? 0.20 : 0.13, t + 0.03);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.42);

      o.connect(f); f.connect(g); g.connect(this.bus);
      o.start(t); o.stop(t + 0.46);
    });
  }

  chime(up = true) {
    this._defer(() => {
      const ctx = this.ctx, t = ctx.currentTime;
      const notes = up ? [0, 4, 7] : [7, 4, 0];
      notes.forEach((semi, i) => {
        const o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = 440 * Math.pow(2, (semi + (up ? 0 : -5)) / 12);
        const g = ctx.createGain();
        const st = t + i * 0.08;
        g.gain.setValueAtTime(0, st);
        g.gain.linearRampToValueAtTime(0.16, st + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, st + 0.7);
        o.connect(g); g.connect(this.bus);
        o.start(st); o.stop(st + 0.75);
      });
    });
  }

  buzz() {
    this._defer(() => {
      const ctx = this.ctx, t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = 'square';
      o.frequency.setValueAtTime(150, t);
      o.frequency.linearRampToValueAtTime(96, t + 0.22);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.14, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      o.connect(g); g.connect(this.bus);
      o.start(t); o.stop(t + 0.32);
    });
  }

  blip() {
    this._defer(() => {
      const ctx = this.ctx, t = ctx.currentTime;
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.setValueAtTime(680, t);
      o.frequency.linearRampToValueAtTime(880, t + 0.06);
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.09, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
      o.connect(g); g.connect(this.bus);
      o.start(t); o.stop(t + 0.16);
    });
  }

  /** Wing beats, for the dove at the end. */
  wings(beats = 9) {
    this._defer(() => {
      const ctx = this.ctx, t = ctx.currentTime;
      for (let i = 0; i < beats; i++) {
        const st = t + i * 0.17 + Math.random() * 0.02;
        const nz = ctx.createBufferSource();
        nz.buffer = this.noiseP;
        const f = ctx.createBiquadFilter();
        f.type = 'bandpass'; f.frequency.value = 330 + i * 14; f.Q.value = 1.1;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, st);
        g.gain.linearRampToValueAtTime(0.14 * (1 - i / (beats * 1.4)), st + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0001, st + 0.14);
        const p = ctx.createStereoPanner?.();
        nz.connect(f); f.connect(g);
        if (p) { p.pan.value = -0.6 + (i / beats) * 1.2; g.connect(p); p.connect(this.bus); }
        else g.connect(this.bus);
        nz.start(st); nz.stop(st + 0.16);
      }
    });
  }

  dispose() {
    try { this.ctx?.close(); } catch {}
    this.ctx = null; this.ready = false;
  }
}

export default Audio;
