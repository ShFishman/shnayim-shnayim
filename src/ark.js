// ark.js — the Ark. Hull is lofted from elliptical cross-sections so it reads
// as a boat rather than a crate, then planked by the WOOD shader.
//
// Torah gives 300x50x30 cubits. Faithfully scaled that is ~150m long, which
// would take half a minute to run around and wreck the pacing, so this one is
// a stocky caricature: big enough to be the landmark you navigate by, small
// enough to sprint to.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, setU, animate } from './materials.js';
import { clamp, lerp, makeRng } from './utils.js';

export const ARK = {
  len: 40,
  halfWidth: 7.0,
  depth: 5.4,
  deckY: 0.0,        // local Y of the deck surface
  rampLen: 11,
  x: 0, z: 0,        // world placement
  heading: 0,
};

/* Loft a hull: a grid over (length t, section angle a). */
function hullGeometry({ len, halfWidth, depth, nT = 36, nA = 16 }) {
  const pos = [], nrm = [], uv = [], idx = [];

  const widthAt = t => halfWidth * Math.pow(1 - Math.pow(Math.abs(t), 3.2) * 0.94, 0.65);
  const depthAt = t => depth * (1 - Math.pow(Math.abs(t), 2.6) * 0.30);
  // sheer: the deck line lifts toward bow and stern, which is what makes a
  // boat look like a boat instead of a bathtub
  const sheerAt = t => Math.pow(Math.abs(t), 2.2) * depth * 0.34;

  for (let i = 0; i <= nT; i++) {
    const t = (i / nT) * 2 - 1;
    const x = t * len * 0.5;
    const w = Math.max(widthAt(t), 0.04);
    const d = depthAt(t);
    const sh = sheerAt(t);

    for (let j = 0; j <= nA; j++) {
      const s = j / nA;
      const a = Math.PI + s * Math.PI;          // port -> keel -> starboard
      const lat = w * Math.cos(a);
      const y = d * Math.sin(a) + sh;           // sin is negative here: hull hangs below deck
      pos.push(x, y, lat);
      uv.push(s, (t + 1) * 0.5);
      nrm.push(0, 0, 0);
    }
  }

  const row = nA + 1;
  for (let i = 0; i < nT; i++) {
    for (let j = 0; j < nA; j++) {
      const a = i * row + j, b = a + row, c = a + 1, d = b + 1;
      idx.push(a, b, c, c, b, d);
    }
  }

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Cap the open top of the hull with a deck slab. */
function deckGeometry({ len, halfWidth, depth, nT = 36 }) {
  const pos = [], idx = [], uv = [];
  const widthAt = t => halfWidth * Math.pow(1 - Math.pow(Math.abs(t), 3.2) * 0.94, 0.65);
  const sheerAt = t => Math.pow(Math.abs(t), 2.2) * depth * 0.34;

  for (let i = 0; i <= nT; i++) {
    const t = (i / nT) * 2 - 1;
    const x = t * len * 0.5;
    const w = Math.max(widthAt(t), 0.04);
    const y = sheerAt(t) + 0.02;
    pos.push(x, y, -w); uv.push(0, (t + 1) * 0.5);
    pos.push(x, y, w);  uv.push(1, (t + 1) * 0.5);
  }
  for (let i = 0; i < nT; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3;
    idx.push(a, c, b, b, c, d);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export class Ark {
  constructor({ terrain = null } = {}) {
    this.group = new THREE.Group();
    this.group.position.set(ARK.x, 0, ARK.z);
    this.group.rotation.y = ARK.heading;

    this.woodMat = animate(makeMaterial('WOOD', { fallbackColor: 0x7a4f2a }));

    // ── hull + deck ──
    const hull = hullGeometry(ARK);
    const deck = deckGeometry(ARK);
    const hullMesh = new THREE.Mesh(mergeGeometries([hull, deck], false), this.woodMat);
    hullMesh.castShadow = true;
    hullMesh.receiveShadow = true;
    this.group.add(hullMesh);
    this.hullMesh = hullMesh;

    // ── the house on deck ──
    const house = new THREE.Group();
    const bodyH = 4.2;
    const body = new THREE.Mesh(new THREE.BoxGeometry(24, bodyH, 9.2), this.woodMat);
    body.position.y = bodyH / 2;
    body.castShadow = true; body.receiveShadow = true;
    house.add(body);

    // pitched roof, built as a prism
    const roof = new THREE.Mesh(this._roofGeometry(25.5, 3.0, 10.4), this.woodMat);
    roof.position.y = bodyH;
    roof.castShadow = true;
    house.add(roof);

    // a second, smaller storey, because three decks is in the text
    const topH = 2.4;
    const top = new THREE.Mesh(new THREE.BoxGeometry(10, topH, 6.4), this.woodMat);
    top.position.set(-4, bodyH + 3.0 + topH / 2, 0);
    top.castShadow = true;
    house.add(top);
    const topRoof = new THREE.Mesh(this._roofGeometry(11.2, 1.8, 7.4), this.woodMat);
    topRoof.position.set(-4, bodyH + 3.0 + topH, 0);
    topRoof.castShadow = true;
    house.add(topRoof);

    // the window Noah opens for the raven and the dove
    const winMat = new THREE.MeshStandardMaterial({ color: 0x1a1008, roughness: 1 });
    const win = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.4, 0.3), winMat);
    win.position.set(-4, bodyH + 3.0 + topH * 0.6, 3.25);
    house.add(win);
    this.window = win;

    house.position.y = 0.02;
    this.group.add(house);
    this.house = house;

    // ── the big door, amidships on the +Z side ──
    this.doorPivot = new THREE.Group();
    this.doorPivot.position.set(3.4, -1.6, ARK.halfWidth * 0.86);
    const door = new THREE.Mesh(new THREE.BoxGeometry(6.8, 5.2, 0.45), this.woodMat);
    door.position.set(-3.4, 2.6, 0);
    door.castShadow = true;
    this.doorPivot.add(door);
    this.group.add(this.doorPivot);
    this.doorOpen = 0;

    // ── boarding ramp ──
    const ramp = new THREE.Mesh(new THREE.BoxGeometry(ARK.rampLen, 0.4, 5.2), this.woodMat);
    ramp.castShadow = true; ramp.receiveShadow = true;
    this.rampPivot = new THREE.Group();
    this.rampPivot.position.set(0, -2.0, ARK.halfWidth * 0.82);
    ramp.position.set(0, 0, ARK.rampLen * 0.5);
    ramp.rotation.x = -0.30;
    this.rampPivot.add(ramp);
    this.group.add(this.rampPivot);

    // side rails so the ramp reads as a walkway
    const railMat = this.woodMat;
    for (const s of [-1, 1]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(ARK.rampLen, 0.7, 0.3), railMat);
      rail.position.set(0, 0.8, ARK.rampLen * 0.5 + s * 2.5);
      rail.rotation.x = -0.30;
      this.rampPivot.add(rail);
    }

    // ── scaffolding, because it is famously never finished ──
    const scaffold = new THREE.Group();
    const rng = makeRng(77);
    for (let i = 0; i < 7; i++) {
      const h = rng.range(5, 9);
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.35, h, 0.35), this.woodMat);
      p.position.set(rng.range(-18, 18), h / 2 - 3.6, (rng() < 0.5 ? -1 : 1) * rng.range(7.4, 8.6));
      p.castShadow = true;
      scaffold.add(p);
    }
    this.group.add(scaffold);
    this.scaffold = scaffold;

    // ── placement ──
    this.baseY = (terrain ? terrain.heightAt(ARK.x, ARK.z) : 0) + ARK.depth * 0.96;
    this.group.position.y = this.baseY;

    this.floating = false;
    this.allowFloat = false;   // the run of play opens this at the finale
    this._bob = 0;

    // where animals walk to in order to board (foot of the ramp, world space)
    this.boardX = ARK.x;
    this.boardZ = ARK.z + ARK.halfWidth * 0.82 + ARK.rampLen * 0.78;
    this.boardRadius = 6.5;
  }

  _roofGeometry(len, h, w) {
    // triangular prism running along X
    const hw = w / 2, hl = len / 2;
    const pos = [
      -hl, 0, -hw, -hl, 0, hw, -hl, h, 0,
      hl, 0, -hw, hl, 0, hw, hl, h, 0,
    ];
    const idx = [
      0, 2, 1, 3, 4, 5,          // gable ends
      0, 1, 4, 0, 4, 3,          // underside
      1, 2, 5, 1, 5, 4,          // +Z slope
      0, 3, 5, 0, 5, 2,          // -Z slope
    ];
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    // WOOD planks off local Y; give the roof a uv so it still gets grain
    const uv = [];
    for (let i = 0; i < pos.length / 3; i++) uv.push(pos[i * 3] / len + .5, pos[i * 3 + 1] / Math.max(h, .001));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    return g;
  }

  /** Is this world point on the ramp / in the doorway? */
  atBoarding(x, z) {
    const dx = x - this.boardX, dz = z - this.boardZ;
    return dx * dx + dz * dz < this.boardRadius * this.boardRadius;
  }

  setDoor(open) {
    this.doorOpen = clamp(open, 0, 1);
    this.doorPivot.rotation.y = -this.doorOpen * 1.5;
  }

  setWet(v) { setU(this.woodMat, 'uWet', clamp(v, 0, 1)); }
  setSun(dir) { setU(this.woodMat, 'uSunDir', dir); }

  /** Once the water reaches the keel the ark lifts and starts to roll. */
  update(dt, t, waterLevel) {
    const keel = this.baseY - ARK.depth * 0.92;
    const lift = waterLevel - keel;

    if (lift > 0 && this.allowFloat) {
      this.floating = true;
      const targetY = waterLevel + ARK.depth * 0.52;
      this.group.position.y = lerp(this.group.position.y, targetY, 1 - Math.pow(0.08, dt));
      this._bob = Math.min(1, this._bob + dt * 0.4);
    } else {
      this.floating = false;
      this.group.position.y = lerp(this.group.position.y, this.baseY, 1 - Math.pow(0.2, dt));
      this._bob = Math.max(0, this._bob - dt * 0.6);
    }

    if (this._bob > 0.001) {
      const b = this._bob;
      this.group.rotation.z = Math.sin(t * 0.72) * 0.045 * b;
      this.group.rotation.x = Math.sin(t * 0.51 + 1.3) * 0.028 * b;
      this.group.position.y += Math.sin(t * 0.9) * 0.22 * b;
    }
  }
}
