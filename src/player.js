// player.js — Noah, and the hands that move him.
//
// He is built from primitives rather than loaded, so there are no assets to
// ship and he can be animated by rotating a handful of groups. The silhouette
// is doing the work: enormous beard, round body, tall staff.

import * as THREE from 'three';
import { clamp, lerp, ease } from './utils.js';

const SKIN = 0xe8b98c;
const ROBE = 0xc8623f;
const ROBE_DK = 0x8e3f27;
const HAIR = 0xf2efe6;
const WOOD = 0x6b4a2a;

const flat = (color, extra = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.85, metalness: 0, flatShading: true, ...extra });

export class Noah {
  constructor() {
    this.group = new THREE.Group();

    this.mats = {
      skin: flat(SKIN), robe: flat(ROBE), robeDk: flat(ROBE_DK),
      hair: flat(HAIR), wood: flat(WOOD),
    };

    // ── body: a bell, so he reads as robed and slightly round ──
    this.bodyPivot = new THREE.Group();
    this.group.add(this.bodyPivot);

    const robeGeo = new THREE.CylinderGeometry(0.42, 0.78, 1.55, 10, 1);
    const robe = new THREE.Mesh(robeGeo, this.mats.robe);
    robe.position.y = 0.78;
    robe.castShadow = true;
    this.bodyPivot.add(robe);

    // sash
    const sash = new THREE.Mesh(new THREE.CylinderGeometry(0.60, 0.63, 0.18, 10, 1), this.mats.robeDk);
    sash.position.y = 0.86;
    this.bodyPivot.add(sash);

    // ── head ──
    this.headPivot = new THREE.Group();
    this.headPivot.position.y = 1.62;
    this.bodyPivot.add(this.headPivot);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.30, 12, 10), this.mats.skin);
    head.castShadow = true;
    this.headPivot.add(head);

    // the beard is the character
    const beard = new THREE.Mesh(new THREE.ConeGeometry(0.30, 0.78, 9), this.mats.hair);
    beard.position.set(0, -0.30, 0.07);
    beard.rotation.x = 0.16;
    beard.castShadow = true;
    this.headPivot.add(beard);

    const brow = new THREE.Mesh(new THREE.SphereGeometry(0.31, 12, 8, 0, Math.PI * 2, 0, Math.PI * 0.42), this.mats.hair);
    brow.position.y = 0.04;
    this.headPivot.add(brow);

    // eyes, so he has somewhere to look from
    const eyeGeo = new THREE.SphereGeometry(0.045, 8, 6);
    const eyeMat = flat(0x241a12);
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(eyeGeo, eyeMat);
      e.position.set(s * 0.115, 0.02, 0.272);
      this.headPivot.add(e);
    }
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.16, 6), this.mats.skin);
    nose.position.set(0, -0.06, 0.29);
    nose.rotation.x = Math.PI / 2;
    this.headPivot.add(nose);

    // ── arms ──
    const armGeo = new THREE.CapsuleGeometry(0.10, 0.52, 3, 7);
    this.armL = new THREE.Group();
    this.armR = new THREE.Group();
    this.armL.position.set(-0.50, 1.36, 0);
    this.armR.position.set(0.50, 1.36, 0);
    for (const [g, m] of [[this.armL, this.mats.robe], [this.armR, this.mats.robe]]) {
      const a = new THREE.Mesh(armGeo, m);
      a.position.y = -0.30;
      a.castShadow = true;
      g.add(a);
      const hand = new THREE.Mesh(new THREE.SphereGeometry(0.11, 8, 6), this.mats.skin);
      hand.position.y = -0.60;
      g.add(hand);
      this.bodyPivot.add(g);
    }

    // ── feet, peeking out from under the robe ──
    this.feet = [];
    for (const s of [-1, 1]) {
      const f = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.12, 0.34), this.mats.wood);
      f.position.set(s * 0.22, 0.06, 0);
      f.castShadow = true;
      this.bodyPivot.add(f);
      this.feet.push(f);
    }

    // ── staff, carried in the left hand ──
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.055, 2.1, 7), this.mats.wood);
    staff.position.set(0, -0.35, 0.06);
    staff.rotation.z = 0.12;
    staff.castShadow = true;
    this.armL.add(staff);
    this.staff = staff;

    // ── shofar, raised when he calls ──
    this.shofar = new THREE.Group();
    const horn = new THREE.Mesh(this._hornGeometry(), flat(0xd9c08a));
    horn.castShadow = true;
    this.shofar.add(horn);
    this.shofar.position.set(0, -0.62, 0.12);
    this.shofar.visible = false;
    this.armR.add(this.shofar);

    // ── state ──
    this.pos = new THREE.Vector3(0, 0, 18);
    this.heading = Math.PI;
    this.speed = 0;
    this.maxSpeed = 11.5;
    this.radius = 0.6;
    this._walk = 0;
    this._blow = 0;      // 0..1 shofar raise
    this._bobPhase = 0;
    this.inWater = 0;    // 0 dry .. 1 wading

    this.group.position.copy(this.pos);
  }

  _hornGeometry() {
    // a curved, tapering horn swept along an arc
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.22, 0.10, 0.04),
      new THREE.Vector3(0.48, 0.14, 0.02),
      new THREE.Vector3(0.74, 0.04, -0.06),
      new THREE.Vector3(0.92, -0.14, -0.12),
    ]);
    return new THREE.TubeGeometry(curve, 18, 0.075, 7, false);
  }

  /** Raise the shofar for `dur` seconds. */
  blow(dur = 0.8) {
    this._blow = 1;
    this._blowLeft = dur;
  }

  /**
   * input: { x, z } desired direction in world space (already camera-relative),
   * magnitude 0..1. run: boolean.
   */
  update(dt, input, terrain, opts = {}) {
    const { waterLevel = -999, blocked = null } = opts;

    const mag = Math.min(1, Math.hypot(input.x, input.z));
    // walking used to be a crawl; the gap between walk and sprint is now
    // a flourish rather than the difference between fun and tedious
    const target = mag * this.maxSpeed * (input.run ? 1.0 : 0.80);

    // wading is slow, and that is the whole late-game pressure
    const wade = clamp((waterLevel - (this.pos.y)) / 1.4, 0, 1);
    this.inWater = wade;
    const slowed = target * lerp(1, 0.46, wade);

    this.speed = lerp(this.speed, slowed, 1 - Math.pow(0.00002, dt));

    if (mag > 0.02) {
      const want = Math.atan2(input.x, input.z);
      // shortest-arc turn
      let d = want - this.heading;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      this.heading += d * (1 - Math.pow(0.00003, dt));
    }

    if (this.speed > 0.01) {
      const nx = this.pos.x + Math.sin(this.heading) * this.speed * dt;
      const nz = this.pos.z + Math.cos(this.heading) * this.speed * dt;

      // refuse cliffs, and anything the caller says is solid
      const slope = terrain.slopeAt(nx, nz);
      const hit = blocked ? blocked(nx, nz, this.radius) : false;
      if (slope < 0.62 && !hit) {
        this.pos.x = nx;
        this.pos.z = nz;
      } else {
        // slide along the obstacle instead of sticking to it
        const sx = this.pos.x + Math.sin(this.heading) * this.speed * dt;
        const sz = this.pos.z;
        if (terrain.slopeAt(sx, sz) < 0.62 && !(blocked && blocked(sx, sz, this.radius))) {
          this.pos.x = sx;
        } else {
          const tx = this.pos.x;
          const tz = this.pos.z + Math.cos(this.heading) * this.speed * dt;
          if (terrain.slopeAt(tx, tz) < 0.62 && !(blocked && blocked(tx, tz, this.radius))) this.pos.z = tz;
        }
      }
    }

    this.pos.y = terrain.heightAt(this.pos.x, this.pos.z);
    this.group.position.copy(this.pos);
    this.group.rotation.y = this.heading;

    // ── animation ──
    const gait = this.speed / this.maxSpeed;
    this._walk += dt * (4.0 + gait * 9.0) * (gait > 0.02 ? 1 : 0);
    const sw = Math.sin(this._walk) * gait;

    this.armL.rotation.x = sw * 0.85;
    this.armR.rotation.x = -sw * 0.85 * (1 - this._blow);
    this.feet[0].position.z = sw * 0.26;
    this.feet[1].position.z = -sw * 0.26;
    this.feet[0].position.y = 0.06 + Math.max(0, sw) * 0.10;
    this.feet[1].position.y = 0.06 + Math.max(0, -sw) * 0.10;

    // bounce, and a forward lean when running
    this._bobPhase += dt * (6.0 + gait * 10.0) * (gait > 0.02 ? 1 : 0);
    this.bodyPivot.position.y = Math.abs(Math.sin(this._bobPhase)) * 0.085 * gait;
    this.bodyPivot.rotation.x = gait * 0.11;
    this.headPivot.rotation.z = Math.sin(this._walk * 0.5) * 0.05 * gait;

    // sink into the water as it rises
    this.group.position.y = this.pos.y - wade * 0.55;

    // ── shofar ──
    if (this._blow > 0) {
      this._blowLeft -= dt;
      this.shofar.visible = true;
      const raise = ease.outBack(clamp(1 - this._blowLeft / 0.8, 0, 1));
      this.armR.rotation.x = lerp(this.armR.rotation.x, -2.0, raise);
      this.armR.rotation.z = lerp(0, -0.5, raise);
      this.headPivot.rotation.x = lerp(0, -0.3, raise);
      if (this._blowLeft <= 0) { this._blow = 0; }
    } else {
      this.shofar.visible = false;
      this.armR.rotation.z = lerp(this.armR.rotation.z, 0, 1 - Math.pow(0.01, dt));
      this.headPivot.rotation.x = lerp(this.headPivot.rotation.x, 0, 1 - Math.pow(0.01, dt));
    }
  }
}

/* ───────────────────────── input ─────────────────────────
 * Keyboard + mouse-drag orbit on desktop; a thumbstick and two buttons on
 * touch. Both produce the same {x,z,run} so the player never branches.
 */

export class Input {
  constructor(dom) {
    this.keys = new Set();
    this.dragging = false;
    this.dragDX = 0;
    this.dragDY = 0;
    this.wheel = 0;
    this.stick = { x: 0, y: 0, active: false };
    this._pressed = new Set();
    this.enabled = true;

    addEventListener('keydown', e => {
      if (e.repeat) return;
      this.keys.add(e.code);
      this._pressed.add(e.code);
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    addEventListener('keyup', e => this.keys.delete(e.code));
    addEventListener('blur', () => this.keys.clear());

    dom.addEventListener('pointerdown', e => {
      if (e.target.closest('button, .hud-btn, .dlg')) return;
      this.dragging = true;
      this._lx = e.clientX; this._ly = e.clientY;
      dom.setPointerCapture?.(e.pointerId);
    });
    dom.addEventListener('pointermove', e => {
      if (!this.dragging) return;
      this.dragDX += (e.clientX - this._lx);
      this.dragDY += (e.clientY - this._ly);
      this._lx = e.clientX; this._ly = e.clientY;
    });
    const end = () => { this.dragging = false; };
    dom.addEventListener('pointerup', end);
    dom.addEventListener('pointercancel', end);
    dom.addEventListener('wheel', e => { this.wheel += Math.sign(e.deltaY); e.preventDefault(); }, { passive: false });
  }

  /** True once per physical press. */
  pressed(code) {
    if (this._pressed.has(code)) { this._pressed.delete(code); return true; }
    return false;
  }

  down(code) { return this.keys.has(code); }

  /** Consume accumulated mouse drag, in radians. */
  takeDrag() {
    const dx = this.dragDX * 0.0052, dy = this.dragDY * 0.004;
    this.dragDX = 0; this.dragDY = 0;
    return [dx, dy];
  }

  takeWheel() { const w = this.wheel; this.wheel = 0; return w; }

  /** Movement vector in camera space: x = right, y = forward. */
  axes() {
    let x = 0, y = 0;
    if (this.down('KeyW') || this.down('ArrowUp')) y += 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.stick.active) { x += this.stick.x; y += -this.stick.y; }
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    return { x, y, run: this.down('ShiftLeft') || this.down('ShiftRight') || this.stick.run };
  }

  clearPressed() { this._pressed.clear(); }
}
