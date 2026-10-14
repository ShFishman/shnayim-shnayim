// Timing, easing, tweening and small math helpers shared by every act.

export const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;
export const invLerp = (a, b, v) => (b === a ? 0 : (v - a) / (b - a));
export const smoothstep = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };
export const smootherstep = (t) => { t = clamp(t); return t * t * t * (t * (t * 6 - 15) + 10); };

export const ease = {
  linear: t => t,
  inQuad: t => t * t,
  outQuad: t => t * (2 - t),
  inOutQuad: t => (t < .5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
  inCubic: t => t * t * t,
  outCubic: t => (--t) * t * t + 1,
  inOutCubic: t => (t < .5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1),
  inQuart: t => t * t * t * t,
  outQuart: t => 1 - (--t) * t * t * t,
  inOutQuart: t => (t < .5 ? 8 * t * t * t * t : 1 - 8 * (--t) * t * t * t),
  outExpo: t => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t)),
  inExpo: t => (t <= 0 ? 0 : Math.pow(2, 10 * t - 10)),
  inOutExpo: t => (t <= 0 ? 0 : t >= 1 ? 1 : t < .5 ? Math.pow(2, 20 * t - 10) / 2 : (2 - Math.pow(2, -20 * t + 10)) / 2),
  outBack: t => 1 + 2.70158 * Math.pow(t - 1, 3) + 1.70158 * Math.pow(t - 1, 2),
  outElastic: t => (t === 0 || t === 1) ? t : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * (2 * Math.PI / 3)) + 1,
  breath: t => Math.sin(t * Math.PI),
};

// ── deterministic RNG so every playthrough builds the same garden ──
export function makeRng(seed = 1337) {
  let s = seed >>> 0;
  const r = () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
  r.range = (a, b) => a + (b - a) * r();
  r.int = (a, b) => Math.floor(a + (b - a + 1) * r());
  r.pick = arr => arr[Math.floor(r() * arr.length)];
  r.sign = () => (r() < .5 ? -1 : 1);
  return r;
}

// ── the clock everything hangs off ──
class Scheduler {
  constructor() {
    this.tweens = [];
    this.timers = [];
    this.tickers = [];
    this.time = 0;
    this.scale = 1;
    this._skip = false;
  }

  update(dt) {
    this.time += dt;
    const mul = this._skip ? 8 : 1;
    const d = dt * this.scale * mul;

    for (let i = this.tweens.length - 1; i >= 0; i--) {
      const tw = this.tweens[i];
      if (tw.delay > 0) { tw.delay -= d; continue; }
      tw.el += d;
      const t = tw.dur <= 0 ? 1 : clamp(tw.el / tw.dur);
      tw.onUpdate(tw.easing(t), t);
      if (t >= 1) { this.tweens.splice(i, 1); tw.resolve(); }
    }
    for (let i = this.timers.length - 1; i >= 0; i--) {
      const tm = this.timers[i];
      tm.left -= d;
      if (tm.left <= 0) { this.timers.splice(i, 1); tm.resolve(); }
    }
    for (let i = this.tickers.length - 1; i >= 0; i--) this.tickers[i](d, this.time);
  }

  /** Tween a normalized 0→1 value over `dur` seconds. Returns a promise. */
  to(dur, onUpdate, easing = ease.inOutCubic, delay = 0) {
    return new Promise(resolve => {
      this.tweens.push({ dur, el: 0, delay, onUpdate, easing, resolve });
    });
  }

  /** Tween object properties: tween(obj,{x:1},2) */
  tween(obj, props, dur, easing = ease.inOutCubic, delay = 0) {
    const from = {};
    for (const k in props) from[k] = obj[k] ?? 0;
    return this.to(dur, (e) => {
      for (const k in props) obj[k] = lerp(from[k], props[k], e);
    }, easing, delay);
  }

  wait(sec) {
    if (sec <= 0) return Promise.resolve();
    return new Promise(resolve => this.timers.push({ left: sec, resolve }));
  }

  every(fn) { this.tickers.push(fn); return () => this.remove(fn); }
  remove(fn) { const i = this.tickers.indexOf(fn); if (i >= 0) this.tickers.splice(i, 1); }

  /** Drop every pending tween/timer (used when jumping chapters). */
  clear() {
    this.tweens.forEach(t => { try { t.onUpdate(1, 1); } catch {} t.resolve(); });
    this.timers.forEach(t => t.resolve());
    this.tweens.length = 0; this.timers.length = 0;
  }
  set fastForward(v) { this._skip = !!v; }
  get fastForward() { return this._skip; }
}

export const clock = new Scheduler();
export const wait = s => clock.wait(s);
export const tween = (o, p, d, e, dl) => clock.tween(o, p, d, e, dl);
export const to = (d, f, e, dl) => clock.to(d, f, e, dl);

/** Resolves on the next user click/tap/space anywhere. */
export function nextInput(target = window) {
  return new Promise(resolve => {
    const go = (e) => {
      if (e.type === 'keydown' && !(e.code === 'Space' || e.code === 'Enter')) return;
      cleanup(); resolve();
    };
    const cleanup = () => {
      target.removeEventListener('pointerdown', go);
      window.removeEventListener('keydown', go);
    };
    target.addEventListener('pointerdown', go);
    window.addEventListener('keydown', go);
  });
}

/** A promise that can be settled from outside. */
export function deferred() {
  let resolve, reject;
  const promise = new Promise((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

/** Race a promise against a timeout, resolving either way. */
export const timeout = (p, sec) => Promise.race([p, wait(sec)]);

export const dpr = () => Math.min(window.devicePixelRatio || 1, 2);
export const isMobile = () => matchMedia('(max-width: 820px), (pointer: coarse)').matches;
export const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
