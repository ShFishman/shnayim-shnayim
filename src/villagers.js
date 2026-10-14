// villagers.js — the neighbours.
//
// Scripturally they are the whole tragedy: Noah preaches for a hundred and
// twenty years and converts nobody. Mechanically they are a side objective —
// each one you talk round widens the shofar's reach — and the running joke is
// that they only come round once the water is at their ankles.

import * as THREE from 'three';
import { clamp, lerp, makeRng } from './utils.js';
import T from './content.js';

const ROBES = [0x5a7fb5, 0x7a5fa0, 0x4f8f78, 0xb5873f, 0x9d5563, 0x5f6f82, 0x87a04f];
const SKINS = [0xe8b98c, 0xd3a071, 0xbb8559, 0xf0c79c];

const flat = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.88, metalness: 0, flatShading: true });

export class Villager {
  constructor(i, { terrain, seed = 1 }) {
    this.index = i;
    this.data = T.villagers[i % T.villagers.length];
    this.terrain = terrain;
    this.rng = makeRng(seed);
    this.lineIndex = 0;
    this.sway = 0;
    this.convinced = false;
    this.spoken = false;

    const robeC = ROBES[i % ROBES.length];
    const skinC = SKINS[i % SKINS.length];
    const tall = this.rng.range(0.86, 1.12);

    this.group = new THREE.Group();
    this.body = new THREE.Group();
    this.group.add(this.body);

    const robe = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.62, 1.38, 9), flat(robeC));
    robe.position.y = 0.69;
    robe.castShadow = true;
    this.body.add(robe);

    this.head = new THREE.Group();
    this.head.position.y = 1.46;
    this.body.add(this.head);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.26, 10, 8), flat(skinC));
    head.castShadow = true;
    this.head.add(head);

    // headwrap, so a crowd reads as a crowd
    const wrap = new THREE.Mesh(new THREE.SphereGeometry(0.275, 10, 7, 0, 6.28, 0, Math.PI * 0.5), flat(robeC));
    wrap.position.y = 0.03;
    this.head.add(wrap);

    const eyeMat = flat(0x241a12);
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.038, 7, 5), eyeMat);
      e.position.set(s * 0.10, 0.01, 0.238);
      this.head.add(e);
    }

    // arms
    this.arms = [];
    for (const s of [-1, 1]) {
      const g = new THREE.Group();
      g.position.set(s * 0.40, 1.22, 0);
      const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.44, 3, 6), flat(robeC));
      a.position.y = -0.26;
      a.castShadow = true;
      g.add(a);
      this.body.add(g);
      this.arms.push(g);
    }

    this.group.scale.setScalar(tall);

    // ── state ──
    this.pos = new THREE.Vector3();
    this.heading = 0;
    this.speed = 0;
    this._wp = null;
    this._wait = this.rng.range(0, 4);
    this._walk = 0;
    this._talk = 0;
    this.panicking = false;
  }

  placeAt(x, z) {
    this.pos.set(x, 0, z);
    this.home = new THREE.Vector3(x, 0, z);
    this.group.position.copy(this.pos);
    return this;
  }

  /** Next line of dialogue. Returns {he,en,sway} or null when exhausted. */
  nextLine() {
    const lines = this.data.lines;
    const l = lines[Math.min(this.lineIndex, lines.length - 1)];
    this.lineIndex++;
    this.sway += l.sway;
    this._talk = 1.4;
    this.spoken = true;
    if (this.sway >= 3 && !this.convinced) {
      this.convinced = true;
      return { ...l, justConvinced: true };
    }
    return l;
  }

  get exhausted() { return this.lineIndex >= this.data.lines.length; }

  update(dt, ctx) {
    const { waterLevel, player } = ctx;
    const ground = this.terrain.heightAt(this.pos.x, this.pos.z);

    // once the water arrives they stop being funny and start climbing
    if (waterLevel > ground - 0.4) this.panicking = true;

    if (this.panicking) {
      this._wait -= dt;
      if (this._wait <= 0) {
        this._wait = 1.4;
        let best = null, bestH = -1e9;
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * 6.28;
          const tx = this.pos.x + Math.cos(a) * 10;
          const tz = this.pos.z + Math.sin(a) * 10;
          const h = this.terrain.heightAt(tx, tz);
          if (h > bestH && this.terrain.slopeAt(tx, tz) < 0.6) { bestH = h; best = [tx, tz]; }
        }
        if (best) this._wp = new THREE.Vector3(best[0], 0, best[1]);
      }
      this._speed = 4.0;
    } else {
      this._wait -= dt;
      if (this._wait <= 0 && !this._wp) {
        this._wait = this.rng.range(3, 8);
        const a = this.rng.range(0, 6.28), r = this.rng.range(2, 9);
        const tx = this.home.x + Math.cos(a) * r, tz = this.home.z + Math.sin(a) * r;
        if (this.terrain.slopeAt(tx, tz) < 0.45) this._wp = new THREE.Vector3(tx, 0, tz);
      }
      this._speed = 1.5;
    }

    // stop and face Noah while talking
    if (this._talk > 0) {
      this._talk -= dt;
      this._wp = null;
      if (player) {
        const want = Math.atan2(player.pos.x - this.pos.x, player.pos.z - this.pos.z);
        let d = want - this.heading;
        while (d > Math.PI) d -= 6.283185;
        while (d < -Math.PI) d += 6.283185;
        this.heading += d * Math.min(1, dt * 6);
      }
    }

    if (this._wp) {
      const dx = this._wp.x - this.pos.x, dz = this._wp.z - this.pos.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.5) { this._wp = null; this.speed = 0; }
      else {
        const want = Math.atan2(dx, dz);
        let diff = want - this.heading;
        while (diff > Math.PI) diff -= 6.283185;
        while (diff < -Math.PI) diff += 6.283185;
        this.heading += diff * Math.min(1, dt * 4);
        this.speed = lerp(this.speed, this._speed, 1 - Math.pow(0.02, dt));
        this.pos.x += Math.sin(this.heading) * this.speed * dt;
        this.pos.z += Math.cos(this.heading) * this.speed * dt;
      }
    } else {
      this.speed = lerp(this.speed, 0, 1 - Math.pow(0.02, dt));
    }

    const g = this.terrain.heightAt(this.pos.x, this.pos.z);
    const wade = clamp((waterLevel - g) / 1.3, 0, 1);
    this.group.position.set(this.pos.x, g - wade * 0.5, this.pos.z);
    this.group.rotation.y = this.heading;

    // walk cycle
    const gait = clamp(this.speed / 3.2, 0, 1);
    this._walk += dt * (4 + gait * 8) * (gait > 0.02 ? 1 : 0);
    const sw = Math.sin(this._walk) * gait;
    this.arms[0].rotation.x = sw * 0.8;
    this.arms[1].rotation.x = -sw * 0.8;
    this.body.position.y = Math.abs(Math.sin(this._walk)) * 0.07 * gait;

    // while talking, gesture; while panicking, arms up
    if (this._talk > 0) {
      const w = Math.sin(this._talk * 11) * 0.5;
      this.arms[0].rotation.x = -0.7 + w;
      this.arms[1].rotation.x = -0.7 - w;
    } else if (this.panicking) {
      this.arms[0].rotation.x = -2.5;
      this.arms[1].rotation.x = -2.5;
    }
  }
}

export class Crowd {
  constructor({ terrain, scene, seed = 404, count = 7 }) {
    this.terrain = terrain;
    this.list = [];
    const rng = makeRng(seed);
    for (let i = 0; i < count; i++) {
      // keep them in the middle third: close enough to meet, not underfoot
      let x = 0, z = 0;
      for (let t = 0; t < 30; t++) {
        const a = (i / count) * 6.28 + rng.range(-0.5, 0.5);
        const r = rng.range(14, 38);
        x = Math.cos(a) * r; z = Math.sin(a) * r;
        if (terrain.slopeAt(x, z) < 0.35) break;
      }
      const v = new Villager(i, { terrain, seed: seed + i * 17 }).placeAt(x, z);
      this.list.push(v);
      scene.add(v.group);
    }
  }

  /** Closest villager within `r`, for the talk prompt. */
  nearest(x, z, r = 4.2) {
    let best = null, bd = r;
    for (const v of this.list) {
      const d = Math.hypot(v.pos.x - x, v.pos.z - z);
      if (d < bd) { bd = d; best = v; }
    }
    return best;
  }

  get convincedCount() { return this.list.filter(v => v.convinced).length; }

  update(dt, ctx) { for (const v of this.list) v.update(dt, ctx); }
}
