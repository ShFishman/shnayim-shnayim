// animals.js — the creatures, and the logic that makes them a conga line.
//
// fauna.js knows how to build and animate an animal. It does not know about
// terrain, water, or being herded, so Critter wraps it and supplies those.
//
// One important detail: Animal.update() drives object.position.y toward 0 with
// a lerp off its own previous value. If we simply add the terrain height after
// each update the lerp feeds on its own output and the animal climbs to the
// moon. So we zero Y before update and re-apply the ground height after.

import * as THREE from 'three';
import { Animal, SPECIES } from './fauna.js';
import { clamp, lerp, makeRng } from './utils.js';
import T from './content.js';

export const HERD_LIMIT = 4;      // how many can trail you at once
export const CALL_RADIUS = 11;    // base shofar reach

const STATE = { IDLE: 0, FOLLOW: 1, BOARD: 2, DONE: 3, PANIC: 4 };

export class Critter {
  constructor(key, sex, { seed = 1, terrain, scale = 1 } = {}) {
    this.key = key;
    this.sex = sex;                       // 'm' | 'f'
    this.terrain = terrain;
    this.animal = new Animal(key, { seed, scale });
    this.object = this.animal.object;
    this.state = STATE.IDLE;
    this.rng = makeRng(seed * 7 + 13);
    this.home = new THREE.Vector3();
    this.wanderT = this.rng.range(0, 3);
    this.leader = null;                   // player or the critter ahead
    this.followGap = 2.0;
    this.boarded = false;
    this.panicked = false;
    this._nudge = 0;

    // a female is a touch smaller, which is all the sex dimorphism this needs
    const s = (sex === 'f' ? 0.88 : 1.0);
    this.object.scale.multiplyScalar(s);
    this._baseScale = this.object.scale.clone();
    this._climb = 0;

    // a small coloured marker so pairs read at a glance
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.42, 0.055, 6, 14),
      new THREE.MeshBasicMaterial({ color: sex === 'f' ? 0xff8fc0 : 0x6fd0ff, transparent: true, opacity: 0.85 }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.04;
    this.ring = ring;
    this.showRing = true;          // extras and the unicorn turn this off
    this.object.add(ring);
  }

  placeAt(x, z) {
    this.animal.placeAt(x, z, this.rng.range(0, 6.28));
    this.home.set(x, 0, z);
    return this;
  }

  get pos() { return this.animal.pos; }

  /** Pull this critter into the line behind `leader`. */
  startFollowing(leader, gap) {
    this.leader = leader;
    this.followGap = gap;
    this.state = STATE.FOLLOW;
    this.panicked = false;
  }

  stopFollowing() {
    this.leader = null;
    this.state = STATE.IDLE;
    this.home.copy(this.animal.pos);
  }

  update(dt, ctx) {
    const { waterLevel, ark } = ctx;
    const a = this.animal;
    const ground = this.terrain.heightAt(a.pos.x, a.pos.z);

    // drowning check — any state
    if (this.state !== STATE.DONE && waterLevel > ground + 0.25) {
      if (this.state === STATE.IDLE) this.state = STATE.PANIC;
    }

    switch (this.state) {
      case STATE.IDLE: this._idle(dt); break;
      case STATE.PANIC: this._panic(dt, waterLevel); break;
      case STATE.FOLLOW: this._follow(dt, ark); break;
      case STATE.BOARD: this._board(dt, ark); break;
      case STATE.DONE: break;
    }

    // --- see the header note: zero, update, re-ground ---
    a.object.position.y = 0;
    a.update(dt);
    const g = this.terrain.heightAt(a.pos.x, a.pos.z);
    a.object.position.y += g;

    // sink a little when wading
    const wade = clamp((waterLevel - g) / 1.2, 0, 1);
    if (wade > 0) a.object.position.y -= wade * 0.42;

    // climbing the ramp: rise toward the door and shrink into it
    if (this.state === STATE.BOARD && this._climb > 0) {
      const topY = ark.group.position.y + 1.1;
      a.object.position.y = lerp(a.object.position.y, topY, this._climb);
      const k = 1 - this._climb * 0.55;
      this.object.scale.set(this._baseScale.x * k, this._baseScale.y * k, this._baseScale.z * k);
    }

    this.ring.visible = this.showRing && this.state !== STATE.DONE && wade < 0.8;
  }

  _idle(dt) {
    this.wanderT -= dt;
    if (this.wanderT <= 0) {
      this.wanderT = this.rng.range(2.5, 6.5);
      const ang = this.rng.range(0, 6.28);
      const r = this.rng.range(2, 7);
      const tx = this.home.x + Math.cos(ang) * r;
      const tz = this.home.z + Math.sin(ang) * r;
      if (this.terrain.slopeAt(tx, tz) < 0.5) {
        this.animal._wp = new THREE.Vector3(tx, 0, tz);
        this.animal._speedTarget = this.rng.range(0.7, 1.4);
      }
    }
  }

  /** Water is here: run for the highest ground within reach. */
  _panic(dt, waterLevel) {
    this.panicked = true;
    this.wanderT -= dt;
    if (this.wanderT <= 0) {
      this.wanderT = 1.2;
      let best = null, bestH = -1e9;
      for (let i = 0; i < 8; i++) {
        const ang = (i / 8) * 6.28;
        const tx = this.animal.pos.x + Math.cos(ang) * 9;
        const tz = this.animal.pos.z + Math.sin(ang) * 9;
        const h = this.terrain.heightAt(tx, tz);
        if (h > bestH && this.terrain.slopeAt(tx, tz) < 0.6) { bestH = h; best = [tx, tz]; }
      }
      if (best) {
        this.animal._wp = new THREE.Vector3(best[0], 0, best[1]);
        this.animal._speedTarget = 3.0;
      }
    }
    // if it got back above water, calm down
    const g = this.terrain.heightAt(this.animal.pos.x, this.animal.pos.z);
    if (waterLevel < g - 0.6) { this.state = STATE.IDLE; this.panicked = false; this.home.copy(this.animal.pos); }
  }

  _follow(dt, ark) {
    const L = this.leader;
    if (!L) { this.state = STATE.IDLE; return; }
    const lx = L.pos ? L.pos.x : L.x;
    const lz = L.pos ? L.pos.z : L.z;
    const dx = lx - this.animal.pos.x, dz = lz - this.animal.pos.z;
    const d = Math.hypot(dx, dz);

    if (d > this.followGap) {
      // aim for a point `gap` short of the leader so the line keeps spacing
      const k = (d - this.followGap) / d;
      this.animal._wp = new THREE.Vector3(
        this.animal.pos.x + dx * k, 0, this.animal.pos.z + dz * k,
      );
      // hustle if it has fallen behind, amble if it is close
      this.animal._speedTarget = clamp(1.0 + (d - this.followGap) * 0.9, 0.8, 7.0);
    } else {
      this.animal._wp = null;
      this.animal._speedTarget = 0;
    }

    // close enough to the ramp? walk aboard
    if (ark && ark.atBoarding(this.animal.pos.x, this.animal.pos.z)) {
      this.state = STATE.BOARD;
      this.leader = null;
      this._boardT = 0;
    }
  }

  _board(dt, ark) {
    this._boardT += dt;
    const doorZ = ark.boardZ - 8.2;
    this.animal._wp = new THREE.Vector3(ark.boardX, 0, doorZ);
    this.animal._speedTarget = 2.6;

    const d = Math.hypot(this.animal.pos.x - ark.boardX, this.animal.pos.z - doorZ);
    // 0 at the foot of the ramp, 1 at the doorway
    const climb = clamp(1 - d / Math.max(ark.boardRadius + 3.5, 0.001), 0, 1);
    this._climb = climb;

    if (d < 1.4 || this._boardT > 8) {
      this.state = STATE.DONE;
      this.boarded = true;
      this.object.visible = false;
      this.object.scale.copy(this._baseScale);
    }
  }
}

/* ───────────────────────── the herd ───────────────────────── */

export class Herd {
  constructor({ terrain, ark, scene, seed = 909 }) {
    this.terrain = terrain;
    this.ark = ark;
    this.scene = scene;
    this.rng = makeRng(seed);
    this.critters = [];
    this.line = [];               // ordered: line[0] follows the player
    this.manifest = new Map();    // speciesKey -> { m: bool, f: bool }
    this.events = [];             // drained by main for HUD messages

    this._spawnRoster();
  }

  _spawnRoster() {
    const listed = T.species.map(s => s.key);
    for (const key of listed) this.manifest.set(key, { m: false, f: false });

    // the eight that count, scattered in a ring so you must tour the valley
    listed.forEach((key, i) => {
      const baseAng = (i / listed.length) * Math.PI * 2 + this.rng.range(-0.3, 0.3);
      for (const sex of ['m', 'f']) {
        const ang = baseAng + this.rng.range(-0.22, 0.22);
        const r = this.rng.range(20, 46);
        const [x, z] = this._findSpot(ang, r);
        const c = new Critter(key, sex, {
          seed: (i + 1) * 31 + (sex === 'm' ? 3 : 7),
          terrain: this.terrain,
        }).placeAt(x, z);
        this.critters.push(c);
        this.scene.add(c.object);
      }
    });

    // background wildlife, for life and for misdirection
    for (let i = 0; i < 10; i++) {
      const key = T.extras[i % T.extras.length];
      if (!SPECIES[key]) continue;
      const [x, z] = this._findSpot(this.rng.range(0, 6.28), this.rng.range(16, 58));
      const c = new Critter(key, this.rng() < 0.5 ? 'm' : 'f', {
        seed: 500 + i, terrain: this.terrain,
      }).placeAt(x, z);
      c.extra = true;
      c.showRing = false;
      this.critters.push(c);
      this.scene.add(c.object);
    }

    // the unicorn, hiding
    const [ux, uz] = this._findSpot(this.rng.range(0, 6.28), this.rng.range(52, 64));
    const uni = new Critter(T.secret.key, 'f', { seed: 1313, terrain: this.terrain }).placeAt(ux, uz);
    uni.isSecret = true;
    uni.showRing = false;
    this.critters.push(uni);
    this.scene.add(uni.object);
    this.unicorn = uni;
  }

  _findSpot(ang, r) {
    for (let tries = 0; tries < 24; tries++) {
      const x = Math.cos(ang) * r, z = Math.sin(ang) * r;
      const h = this.terrain.heightAt(x, z);
      if (this.terrain.slopeAt(x, z) < 0.38 && h > -1 && h < 13) return [x, z];
      ang += 0.37; r = Math.max(16, r - 1.1);
    }
    return [Math.cos(ang) * 24, Math.sin(ang) * 24];
  }

  /** Shofar blast: recruit everything loose within `radius`. */
  call(px, pz, radius) {
    if (this.line.length >= HERD_LIMIT) {
      this.events.push({ type: 'full' });
      return 0;
    }
    const cands = this.critters
      .filter(c => (c.state === STATE.IDLE || c.state === STATE.PANIC) && !c.boarded)
      .map(c => ({ c, d: Math.hypot(c.pos.x - px, c.pos.z - pz) }))
      .filter(o => o.d < radius)
      .sort((a, b) => a.d - b.d);

    let added = 0;
    for (const { c } of cands) {
      if (this.line.length >= HERD_LIMIT) break;
      this.line.push(c);
      added++;
      if (c.isSecret) this.events.push({ type: 'secret-called' });
    }
    this._relink();
    if (added) this.events.push({ type: 'called', n: added });
    return added;
  }

  /** Re-chain the line after any membership change. */
  _relink(player) {
    this.line.forEach((c, i) => {
      c._wasInLine = true;
      const leader = i === 0 ? (this._player || player) : this.line[i - 1];
      c.startFollowing(leader, i === 0 ? 2.6 : 2.3);
    });
  }

  setPlayer(p) { this._player = p; this._relink(p); }

  update(dt, ctx) {
    // Standing at the foot of the ramp sends the WHOLE line aboard. Without
    // this only the front one or two were inside the boarding radius and the
    // rest got towed away again when the player turned around.
    const p = this._player;
    if (p && this.ark && this.ark.atBoarding(p.pos.x, p.pos.z)) {
      for (const c of this.line) {
        if (c.state === STATE.FOLLOW) {
          c.state = STATE.BOARD;
          c.leader = null;
          c._boardT = 0;
        }
      }
    }

    // Anything that is no longer following leaves the line. This must drop
    // BOARD as well as DONE/IDLE: _relink() calls startFollowing() on whatever
    // is left, which would otherwise yank a boarding animal back off the ramp.
    let changed = false;
    for (let i = this.line.length - 1; i >= 0; i--) {
      const c = this.line[i];
      if (c.state === STATE.FOLLOW) continue;
      this.line.splice(i, 1);
      changed = true;
      if (c.state === STATE.DONE) { c._counted = true; this._onBoarded(c); }
    }
    if (changed) this._relink();

    for (const c of this.critters) c.update(dt, ctx);

    // a critter that finished climbing after it left the line still counts
    for (const c of this.critters) {
      if (c.state === STATE.DONE && !c._counted) {
        c._counted = true;
        if (!c._wasInLine) continue;
        this._onBoarded(c);
      }
    }
  }

  _onBoarded(c) {
    if (c.isSecret) { this.events.push({ type: 'secret-aboard' }); this.secretAboard = true; return; }
    if (c.extra) { this.events.push({ type: 'extra-aboard', key: c.key }); return; }
    const m = this.manifest.get(c.key);
    if (!m) return;
    const already = m[c.sex];
    m[c.sex] = true;
    if (already) {
      this.events.push({ type: 'same-sex', key: c.key });
    } else if (m.m && m.f) {
      this.events.push({ type: 'pair', key: c.key });
    } else {
      this.events.push({ type: 'single', key: c.key });
    }
  }

  get pairsComplete() {
    let n = 0;
    for (const [, v] of this.manifest) if (v.m && v.f) n++;
    return n;
  }

  get totalPairs() { return this.manifest.size; }

  get aboardCount() {
    let n = 0;
    for (const [, v] of this.manifest) { if (v.m) n++; if (v.f) n++; }
    return n;
  }

  /** Nearest loose animal, for the "something is over there" nudge. */
  nearestLoose(x, z) {
    let best = null, bd = 1e9;
    for (const c of this.critters) {
      if (c.boarded || c.extra || c.isSecret) continue;
      if (c.state !== STATE.IDLE && c.state !== STATE.PANIC) continue;
      const m = this.manifest.get(c.key);
      if (m && m[c.sex]) continue;           // already have this one
      const d = Math.hypot(c.pos.x - x, c.pos.z - z);
      if (d < bd) { bd = d; best = c; }
    }
    return best ? { critter: best, dist: bd } : null;
  }

  drainEvents() { const e = this.events; this.events = []; return e; }
}

export { STATE };
