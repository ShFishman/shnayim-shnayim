// The creatures Adam names. Low-poly and flat-shaded on purpose: stylised
// enough to read instantly in silhouette, cheap enough to run in pairs.
// Every species here comes two by two, which is the whole point of the scene.

import * as THREE from 'three';
import { makeRng, clamp, lerp, ease, clock } from './utils.js';

const SPECIES = {
  shor: {   // ox
    type: 'quad', color: 0x6d5b45, dark: 0x3b3024,
    body: [1.15, .70, .62], legLen: .62, legR: .085, neck: .30, neckAng: .55,
    head: [.34, .30, .46], horns: 'ox', tail: 'tuft', hump: .12, scale: 1.0,
  },
  aryeh: {  // lion
    type: 'quad', color: 0xc08b45, dark: 0x6b4a1e,
    body: [1.10, .56, .50], legLen: .58, legR: .082, neck: .22, neckAng: .30,
    head: [.30, .28, .34], mane: true, tail: 'tuft', scale: 1.0,
  },
  tzvi: {   // gazelle
    type: 'quad', color: 0xc49a67, dark: 0x6e4f2e,
    body: [.86, .42, .38], legLen: .74, legR: .048, neck: .50, neckAng: .95,
    head: [.20, .17, .30], antlers: true, tail: 'short', scale: .95,
  },
  nesher: { // eagle
    type: 'bird', color: 0x6a5641, dark: 0x2e2419, head: 0xe8e2d2,
    body: [.62, .34, .30], wingspan: 2.3, beak: 0xe8b23c, raptor: true, scale: 1.0,
  },
  shual: {  // fox
    type: 'quad', color: 0xd2703a, dark: 0x6d3418,
    body: [.78, .36, .34], legLen: .40, legR: .048, neck: .16, neckAng: .35,
    head: [.22, .18, .34], ears: 'tall', tail: 'bushy', scale: .9,
  },
  pil: {    // elephant
    type: 'quad', color: 0x8a8a90, dark: 0x4a4a52,
    body: [1.55, 1.10, .95], legLen: .86, legR: .17, neck: .12, neckAng: .2,
    head: [.46, .44, .46], trunk: true, ears: 'wide', tail: 'short', scale: 1.15,
  },
  zeev: {   // wolf
    type: 'quad', color: 0x7b7f88, dark: 0x3a3e46,
    body: [.98, .46, .42], legLen: .56, legR: .058, neck: .20, neckAng: .45,
    head: [.26, .22, .40], ears: 'tall', tail: 'bushy', scale: .95,
  },
  sus: {    // horse
    type: 'quad', color: 0x8b5a33, dark: 0x4a2d18,
    body: [1.22, .62, .50], legLen: .86, legR: .068, neck: .52, neckAng: .78,
    head: [.22, .20, .46], mane: 'crest', tail: 'long', scale: 1.05,
  },
  orev: {   // raven
    type: 'bird', color: 0x1d1d26, dark: 0x0a0a10, head: 0x1d1d26,
    body: [.42, .22, .20], wingspan: 1.05, beak: 0x15151c, scale: .85,
  },
  yonah: {  // dove
    type: 'bird', color: 0xeceef6, dark: 0xb9bed2, head: 0xf6f8ff,
    body: [.34, .20, .18], wingspan: .82, beak: 0xd9a05a, scale: .8,
  },

  /* ── added for the Ark. The brief was "funny in silhouette", so these lean
     on one exaggerated feature each: the neck, the belly, the ears. ── */

  gerafa: { // giraffe — absurd neck, deliberately
    type: 'quad', color: 0xe0b45a, dark: 0x8a6126,
    body: [1.05, .62, .52], legLen: 1.30, legR: .062, neck: 2.05, neckAng: 1.42,
    head: [.21, .19, .38], antlers: true, tail: 'long', scale: 1.05,
  },
  hipo: {   // hippopotamus — all belly, no clearance
    type: 'quad', color: 0x9b7a93, dark: 0x53404f,
    body: [1.52, .95, .92], legLen: .32, legR: .17, neck: .10, neckAng: .15,
    head: [.54, .44, .54], ears: 'tall', tail: 'short', scale: 1.0,
  },
  kof: {    // monkey
    type: 'quad', color: 0x8a6440, dark: 0x4a3420,
    body: [.54, .34, .30], legLen: .36, legR: .042, neck: .16, neckAng: .55,
    head: [.21, .20, .23], ears: 'wide', tail: 'long', scale: .82,
  },
  gamal: {  // camel — the hump is the joke
    type: 'quad', color: 0xc99a5e, dark: 0x6f5126,
    body: [1.24, .66, .56], legLen: .98, legR: .062, neck: .66, neckAng: 1.02,
    head: [.22, .21, .38], hump: .38, tail: 'tuft', scale: 1.0,
  },
  hazir: {  // pig
    type: 'quad', color: 0xe3a3a8, dark: 0x8d5a60,
    body: [.82, .48, .46], legLen: .24, legR: .058, neck: .10, neckAng: .20,
    head: [.27, .23, .35], ears: 'wide', tail: 'short', scale: .88,
  },
  pingvin: { // penguin — anachronistic on purpose
    type: 'bird', color: 0x23262e, dark: 0x101218, head: 0x20232a,
    body: [.42, .38, .30], wingspan: .46, beak: 0xe8a93c, scale: .9,
  },
  tarnegol: { // rooster
    type: 'bird', color: 0xb8402f, dark: 0x6a2018, head: 0xd4503c,
    body: [.36, .26, .22], wingspan: .62, beak: 0xe8b23c, scale: .8,
  },
  arnav: {  // rabbit
    type: 'quad', color: 0xcfc3b0, dark: 0x7d7265,
    body: [.36, .26, .24], legLen: .20, legR: .036, neck: .10, neckAng: .40,
    head: [.18, .16, .21], ears: 'tall', tail: 'bushy', scale: .74,
  },
  dov: {    // bear
    type: 'quad', color: 0x5b4030, dark: 0x2e2018,
    body: [1.06, .64, .62], legLen: .46, legR: .115, neck: .18, neckAng: .30,
    head: [.33, .30, .35], ears: 'tall', tail: 'short', scale: 1.0,
  },
  hadkeren: { // unicorn — the one that misses the boat
    type: 'quad', color: 0xf4f1fb, dark: 0xc3b8de,
    body: [1.20, .60, .48], legLen: .88, legR: .062, neck: .54, neckAng: .80,
    head: [.22, .20, .44], mane: 'crest', antlers: true, tail: 'long', scale: 1.02,
  },
};

const norm = s => String(s || '').toLowerCase().replace(/['’`\-\s]/g, '');

export function speciesKey(translit) {
  const n = norm(translit);
  if (SPECIES[n]) return n;
  const alias = { shual: 'shual', shu_al: 'shual', zeev: 'zeev', ze_ev: 'zeev' };
  return alias[n] || Object.keys(SPECIES).find(k => n.startsWith(k.slice(0, 4))) || 'shual';
}

/* ═══════════════ builders ═══════════════ */

function mat(color, { emissive = 0x000000, rough = .78 } = {}) {
  return new THREE.MeshStandardMaterial({
    color, emissive, emissiveIntensity: .25, roughness: rough, metalness: .02, flatShading: true,
  });
}

function box(w, h, d, m) { return new THREE.Mesh(new THREE.BoxGeometry(w, h, d, 1, 1, 1), m); }
function sph(r, m, seg = 8) { return new THREE.Mesh(new THREE.SphereGeometry(r, seg, Math.max(5, seg - 2)), m); }
function cone(r, h, m, seg = 6) { return new THREE.Mesh(new THREE.ConeGeometry(r, h, seg), m); }
function cyl(r0, r1, h, m, seg = 6) { return new THREE.Mesh(new THREE.CylinderGeometry(r0, r1, h, seg), m); }

function buildQuadruped(S, seed) {
  const rng = makeRng(seed);
  const g = new THREE.Group();
  const M = mat(S.color), D = mat(S.dark);
  const [bl, bh, bw] = S.body;
  const hipY = S.legLen + bh * .5;

  const body = sph(1, M, 10);
  body.scale.set(bl * .5, bh * .5, bw * .5);
  body.position.y = hipY;
  g.add(body);

  if (S.hump) {
    const h = sph(bh * .42, M, 8);
    h.position.set(bl * .18, hipY + bh * .42, 0);
    h.scale.set(1.3, .8, 1);
    g.add(h);
  }

  // neck + head
  const neck = new THREE.Group();
  neck.position.set(bl * .42, hipY + bh * .16, 0);
  neck.rotation.z = -S.neckAng;
  const nm = cyl(bw * .24, bw * .3, S.neck, M, 7);
  nm.position.y = S.neck * .5;
  neck.add(nm);
  g.add(neck);

  const headG = new THREE.Group();
  headG.position.y = S.neck;
  headG.rotation.z = S.neckAng;   // level the head again
  neck.add(headG);
  const [hw, hh, hd] = S.head;
  const head = sph(1, M, 8);
  head.scale.set(hd * .5, hh * .5, hw * .5);
  head.position.x = hd * .22;
  headG.add(head);

  // eyes — tiny, dark, catch the light
  const eyeM = new THREE.MeshStandardMaterial({ color: 0x120c08, emissive: 0x332211, emissiveIntensity: .6, roughness: .3 });
  for (const s of [-1, 1]) {
    const e = sph(hh * .095, eyeM, 6);
    e.position.set(hd * .36, hh * .16, s * hw * .33);
    headG.add(e);
  }

  if (S.horns === 'ox') {
    for (const s of [-1, 1]) {
      const horn = cyl(.035, .012, hh * 1.25, D, 5);
      horn.position.set(hd * .05, hh * .45, s * hw * .42);
      horn.rotation.z = s * .1;
      horn.rotation.x = -s * 1.05;
      headG.add(horn);
    }
  }
  if (S.antlers) {
    for (const s of [-1, 1]) {
      const a = new THREE.Group();
      const main = cyl(.022, .009, .52, D, 4);
      main.position.y = .26;
      a.add(main);
      for (let i = 0; i < 2; i++) {
        const t = cyl(.014, .006, .2, D, 4);
        t.position.set(0, .22 + i * .18, 0);
        t.rotation.z = (i % 2 ? .9 : -.7) * s;
        a.add(t);
      }
      a.position.set(0, hh * .4, s * hw * .28);
      a.rotation.x = -s * .35;
      headG.add(a);
    }
  }
  if (S.ears === 'tall') {
    for (const s of [-1, 1]) {
      const e = cone(hh * .22, hh * .62, D, 4);
      e.position.set(-hd * .02, hh * .48, s * hw * .34);
      e.rotation.x = -s * .22;
      headG.add(e);
    }
  }
  if (S.ears === 'wide') {
    for (const s of [-1, 1]) {
      const e = sph(1, D, 7);
      e.scale.set(.06, hh * .95, hw * .95);
      e.position.set(-hd * .12, hh * .18, s * hw * .55);
      e.rotation.x = s * .25;
      headG.add(e);
    }
  }
  if (S.trunk) {
    const trunk = new THREE.Group();
    let py = 0;
    for (let i = 0; i < 6; i++) {
      const r = lerp(.1, .035, i / 5);
      const seg = cyl(r, r * .85, .17, M, 6);
      seg.position.y = -.085;
      const j = new THREE.Group();
      j.position.y = py;
      j.rotation.z = -.28 - i * .09;
      j.add(seg);
      (i === 0 ? trunk : trunk.children[0]).add(j);
      py = -.17;
    }
    trunk.position.set(hd * .46, -hh * .1, 0);
    headG.add(trunk);
  }
  if (S.mane === true) {
    const m = sph(1, D, 9);
    m.scale.set(hd * .62, hh * .95, hw * .98);
    m.position.set(-hd * .06, 0, 0);
    headG.add(m);
  }
  if (S.mane === 'crest') {
    const crest = box(.04, S.neck * .9, .14, D);
    crest.position.set(-bw * .16, S.neck * .5, 0);
    neck.add(crest);
  }

  // legs — stored so they can swing
  const legs = [];
  const legPos = [
    [bl * .32, bw * .30], [bl * .32, -bw * .30],
    [-bl * .32, bw * .30], [-bl * .32, -bw * .30],
  ];
  legPos.forEach(([x, z], i) => {
    const hip = new THREE.Group();
    hip.position.set(x, hipY - bh * .22, z);
    const upper = cyl(S.legR, S.legR * .85, S.legLen * .55, M, 5);
    upper.position.y = -S.legLen * .275;
    hip.add(upper);
    const knee = new THREE.Group();
    knee.position.y = -S.legLen * .55;
    const lower = cyl(S.legR * .8, S.legR * .62, S.legLen * .45, M, 5);
    lower.position.y = -S.legLen * .225;
    knee.add(lower);
    const hoof = cyl(S.legR * .72, S.legR * .8, S.legR * .7, D, 5);
    hoof.position.y = -S.legLen * .45;
    knee.add(hoof);
    hip.add(knee);
    g.add(hip);
    legs.push({ hip, knee, phase: (i < 2 ? 0 : Math.PI) + (i % 2 ? Math.PI : 0) });
  });

  // tail
  const tail = new THREE.Group();
  tail.position.set(-bl * .48, hipY + bh * .1, 0);
  if (S.tail === 'tuft' || S.tail === 'long') {
    const t = cyl(.022, .014, S.tail === 'long' ? .62 : .46, M, 4);
    t.position.y = -(S.tail === 'long' ? .31 : .23);
    tail.add(t);
    const tip = sph(.055, D, 6);
    tip.position.y = -(S.tail === 'long' ? .62 : .46);
    tip.scale.set(.7, 1.6, .7);
    tail.add(tip);
  } else if (S.tail === 'bushy') {
    const t = sph(1, M, 7);
    t.scale.set(.1, .3, .1);
    t.position.y = -.26;
    tail.add(t);
    const fluff = sph(.13, M, 7);
    fluff.scale.set(.8, 2.0, .8);
    fluff.position.y = -.34;
    tail.add(fluff);
  } else {
    const t = sph(.06, M, 6);
    t.position.y = -.1;
    tail.add(t);
  }
  tail.rotation.z = -.4;
  g.add(tail);

  g.userData = { legs, tail, head: headG, neck, body, type: 'quad', materials: [M, D, eyeM] };
  return g;
}

function buildBird(S, seed) {
  const rng = makeRng(seed);
  const g = new THREE.Group();
  const M = mat(S.color), D = mat(S.dark), H = mat(S.head || S.color);
  const [bl, bh, bw] = S.body;
  const bodyY = .32;

  const body = sph(1, M, 9);
  body.scale.set(bl * .5, bh * .5, bw * .5);
  body.position.y = bodyY;
  body.rotation.z = -.18;
  g.add(body);

  const headG = new THREE.Group();
  headG.position.set(bl * .42, bodyY + bh * .42, 0);
  const head = sph(bh * .42, H, 8);
  headG.add(head);
  const beak = cone(bh * .17, bh * .5, mat(S.beak), 5);
  beak.rotation.z = -Math.PI / 2;
  beak.position.set(bh * .45, S.raptor ? bh * .05 : 0, 0);
  if (S.raptor) beak.rotation.x = 0, beak.scale.set(1, 1.1, 1);
  headG.add(beak);
  const eyeM = new THREE.MeshStandardMaterial({ color: 0x0f0b08, emissive: 0x4a3310, emissiveIntensity: .8, roughness: .25 });
  for (const s of [-1, 1]) {
    const e = sph(bh * .085, eyeM, 6);
    e.position.set(bh * .24, bh * .1, s * bh * .3);
    headG.add(e);
  }
  g.add(headG);

  // wings — two panels each so they can fold and beat
  const wings = [];
  for (const s of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(0, bodyY + bh * .22, s * bw * .35);
    const inner = new THREE.Mesh(new THREE.PlaneGeometry(S.wingspan * .34, bh * 1.25), M);
    inner.material.side = THREE.DoubleSide;
    inner.rotation.x = Math.PI / 2;
    inner.position.z = s * S.wingspan * .17;
    shoulder.add(inner);
    const elbow = new THREE.Group();
    elbow.position.z = s * S.wingspan * .34;
    const outer = new THREE.Mesh(new THREE.PlaneGeometry(S.wingspan * .32, bh * .95), D);
    outer.material.side = THREE.DoubleSide;
    outer.rotation.x = Math.PI / 2;
    outer.position.z = s * S.wingspan * .16;
    elbow.add(outer);
    shoulder.add(elbow);
    g.add(shoulder);
    wings.push({ shoulder, elbow, side: s });
  }

  const tail = new THREE.Mesh(new THREE.PlaneGeometry(bl * .7, bw * 1.1), D);
  tail.material.side = THREE.DoubleSide;
  tail.rotation.x = Math.PI / 2;
  tail.position.set(-bl * .58, bodyY + bh * .05, 0);
  g.add(tail);

  // legs
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(bl * .04, bodyY - bh * .3, s * bw * .22);
    const leg = cyl(bh * .055, bh * .045, .22, mat(S.beak), 4);
    leg.position.y = -.11;
    hip.add(leg);
    const foot = box(bh * .3, .02, bh * .22, mat(S.beak));
    foot.position.set(bh * .06, -.22, 0);
    hip.add(foot);
    g.add(hip);
    legs.push({ hip, knee: hip, phase: s > 0 ? 0 : Math.PI });
  }

  g.userData = { legs, wings, head: headG, tail, body, type: 'bird', materials: [M, D, H, eyeM] };
  return g;
}

/* ═══════════════ the animal actor ═══════════════ */

export class Animal {
  constructor(key, { seed = 1, scale = 1 } = {}) {
    const S = SPECIES[key] || SPECIES.shual;
    this.key = key;
    this.spec = S;
    this.object = S.type === 'bird' ? buildBird(S, seed) : buildQuadruped(S, seed);
    this.object.scale.setScalar((S.scale || 1) * scale);
    this.object.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });

    this.pos = new THREE.Vector3();
    this.heading = 0;
    this.speed = 0;
    this._t = makeRng(seed)() * 20;
    this._phase = this._t;
    this.flying = false;
    this.flyHeight = 0;
    this._wp = null;
    this._done = null;
  }

  placeAt(x, z, heading = 0) {
    this.pos.set(x, 0, z);
    this.heading = heading;
    this.object.position.copy(this.pos);
    this.object.rotation.y = heading;
    return this;
  }

  /** Walk (or fly) to a point; resolves on arrival. */
  moveTo(x, z, { speed = 1.6, fly = false, height = 0 } = {}) {
    this.flying = fly;
    this.flyHeight = height;
    this._wp = new THREE.Vector3(x, 0, z);
    this._speedTarget = speed;
    return new Promise(res => { this._done = res; });
  }

  stop() { this._wp = null; this._speedTarget = 0; if (this._done) { this._done(); this._done = null; } }

  lookAt(x, z) {
    this._lookTarget = new THREE.Vector2(x, z);
  }

  update(dt) {
    this._t += dt;
    const ud = this.object.userData;

    // locomotion
    if (this._wp) {
      const dx = this._wp.x - this.pos.x, dz = this._wp.z - this.pos.z;
      const dist = Math.hypot(dx, dz);
      if (dist < .25) {
        this._wp = null;
        if (this._done) { this._done(); this._done = null; }
        this._speedTarget = 0;
      } else {
        const want = Math.atan2(dx, dz);
        let diff = want - this.heading;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.heading += diff * Math.min(1, dt * 4);
        const sp = this._speedTarget;
        this.pos.x += Math.sin(this.heading) * sp * dt;
        this.pos.z += Math.cos(this.heading) * sp * dt;
      }
    }
    this.speed = lerp(this.speed, this._wp ? this._speedTarget : 0, 1 - Math.pow(.02, dt));

    const targetY = this.flying ? this.flyHeight : 0;
    this.object.position.set(this.pos.x, lerp(this.object.position.y, targetY, 1 - Math.pow(.05, dt)), this.pos.z);
    this.object.rotation.y = this.heading;

    if (this._lookTarget && ud.head) {
      const a = Math.atan2(this._lookTarget.x - this.pos.x, this._lookTarget.y - this.pos.z) - this.heading;
      let d = a; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2;
      ud.head.rotation.y = lerp(ud.head.rotation.y, clamp(d, -.9, .9), 1 - Math.pow(.05, dt));
    }

    const moving = this.speed > .05;
    const stride = this._t * (6 + this.speed * 2.5);

    if (ud.type === 'quad') {
      ud.legs.forEach(l => {
        const sw = moving ? Math.sin(stride + l.phase) * .5 * clamp(this.speed / 1.8) : 0;
        l.hip.rotation.z = lerp(l.hip.rotation.z, sw, 1 - Math.pow(.001, dt));
        l.knee.rotation.z = lerp(l.knee.rotation.z, Math.max(0, -sw) * .8, 1 - Math.pow(.001, dt));
      });
      this.object.position.y += moving ? Math.abs(Math.sin(stride)) * .02 : 0;
      if (ud.tail) ud.tail.rotation.x = Math.sin(this._t * 1.3 + this._phase) * .22;
      if (ud.body) {
        const b = 1 + Math.sin(this._t * 1.1 + this._phase) * .012;
        ud.body.scale.y = (this.spec.body[1] * .5) * b;
      }
      if (ud.head && !this._lookTarget) {
        ud.head.rotation.x = Math.sin(this._t * .7 + this._phase) * .08;
      }
    } else {
      const flapping = this.flying && (moving || this.flyHeight > .5);
      const beat = Math.sin(this._t * (flapping ? 9 : 1.4) + this._phase);
      ud.wings.forEach(w => {
        const open = flapping ? 1 : .12;
        w.shoulder.rotation.x = w.side * (beat * .85 * open + (flapping ? .1 : .9) * (w.side > 0 ? 1 : 1) * (1 - open) * 0);
        w.shoulder.rotation.y = flapping ? 0 : w.side * -1.15;
        w.elbow.rotation.x = w.side * (flapping ? beat * .5 : -1.0);
      });
      if (!flapping) {
        ud.legs.forEach(l => {
          const sw = moving ? Math.sin(stride * 1.6 + l.phase) * .5 : 0;
          l.hip.rotation.z = lerp(l.hip.rotation.z, sw, 1 - Math.pow(.001, dt));
        });
        this.object.position.y += moving ? Math.abs(Math.sin(stride * 1.6)) * .03 : 0;
      }
      if (ud.head) ud.head.rotation.x = Math.sin(this._t * 2.2 + this._phase) * .12;
      if (ud.tail) ud.tail.rotation.z = Math.sin(this._t * 1.1) * .1;
    }
  }

  setGlow(v) {
    this.object.userData.materials?.forEach(m => { m.emissiveIntensity = .25 + v * 2.2; });
  }
  setDesaturate(v) {
    // fade the species colour toward grey as the garden's joy drains
    this.object.userData.materials?.forEach(m => {
      if (!m.userData.base) m.userData.base = m.color.clone();
      const g = m.userData.base.r * .299 + m.userData.base.g * .587 + m.userData.base.b * .114;
      m.color.copy(m.userData.base).lerp(new THREE.Color(g, g, g), clamp(v));
    });
  }
  dispose() {
    this.object.traverse(o => o.geometry?.dispose?.());
    this.object.userData.materials?.forEach(m => m.dispose());
  }
}

/** Animals arrive two by two. That is the whole scene. */
export function makePair(key, { seed = 1, gap = 1.3, scale = 1 } = {}) {
  return [
    new Animal(key, { seed: seed * 3 + 1, scale }),
    new Animal(key, { seed: seed * 7 + 5, scale: scale * .92 }),
  ];
}

export { SPECIES };
