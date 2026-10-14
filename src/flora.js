// Procedural plant life: recursive trees, instanced grass, flowers,
// and the Tree of Knowledge itself.

import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { makeMaterial, setU, animate, hasShader } from './materials.js';
import { makeRng, clamp, lerp, isMobile } from './utils.js';

/* ═══════════════ recursive branch skeleton ═══════════════ */

function growBranches({
  seed = 1, height = 6, radius = .34, levels = 4, splits = 3,
  lean = .42, twist = 2.2, taper = .62, curve = .3,
} = {}) {
  const rng = makeRng(seed);
  const segs = [];
  const tips = [];

  const grow = (origin, dir, len, rad, level) => {
    const steps = level === 0 ? 5 : 3;
    let p = origin.clone();
    let d = dir.clone().normalize();
    const segLen = len / steps;
    for (let s = 0; s < steps; s++) {
      const r0 = lerp(rad, rad * taper, s / steps);
      const r1 = lerp(rad, rad * taper, (s + 1) / steps);
      // bend as it rises — nothing in a garden grows on a ruler
      const bend = new THREE.Vector3(
        (rng() - .5) * curve, (rng() - .5) * curve * .35, (rng() - .5) * curve
      );
      d.add(bend.multiplyScalar(.5 / (level + 1))).normalize();
      const next = p.clone().addScaledVector(d, segLen);
      segs.push({ a: p.clone(), b: next.clone(), r0, r1 });
      p = next;
    }
    if (level >= levels) { tips.push({ p: p.clone(), d: d.clone(), r: rad * taper, level }); return; }

    const n = Math.max(2, Math.round(splits - level * .5 + rng() * 1.4));
    const baseAngle = rng() * Math.PI * 2;
    for (let i = 0; i < n; i++) {
      const a = baseAngle + (i / n) * Math.PI * 2 + (rng() - .5) * .8;
      const spread = lean * (.75 + rng() * .7);
      const side = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      const nd = d.clone().multiplyScalar(1 - spread * .55).addScaledVector(side, spread).normalize();
      nd.applyAxisAngle(d, twist * rng() * .3);
      grow(p, nd, len * (.58 + rng() * .22), rad * taper * (.72 + rng() * .18), level + 1);
    }
  };

  grow(new THREE.Vector3(0, 0, 0), new THREE.Vector3((rng() - .5) * .12, 1, (rng() - .5) * .12), height, radius, 0);
  return { segs, tips };
}

function segmentsToGeometry(segs, radialSegs = 6) {
  const parts = [];
  const up = new THREE.Vector3(0, 1, 0);
  for (const s of segs) {
    const dir = s.b.clone().sub(s.a);
    const len = dir.length();
    if (len < 1e-4) continue;
    const g = new THREE.CylinderGeometry(s.r1, s.r0, len, radialSegs, 1, true);
    const q = new THREE.Quaternion().setFromUnitVectors(up, dir.clone().normalize());
    const m = new THREE.Matrix4().compose(
      s.a.clone().addScaledVector(dir, .5), q, new THREE.Vector3(1, 1, 1));
    g.applyMatrix4(m);
    parts.push(g);
  }
  if (!parts.length) return new THREE.BufferGeometry();
  const merged = mergeGeometries(parts, false);
  parts.forEach(p => p.dispose());
  merged.computeVertexNormals();
  return merged;
}

function canopyFromTips(tips, { seed = 2, blobs = 2, size = 1.1, detail = 0 } = {}) {
  const rng = makeRng(seed + 991);
  const parts = [];
  const proto = new THREE.IcosahedronGeometry(1, detail);
  for (const t of tips) {
    for (let i = 0; i < blobs; i++) {
      const g = proto.clone();
      const s = size * (.6 + rng() * .8);
      const m = new THREE.Matrix4().compose(
        t.p.clone().addScaledVector(t.d, .25 + rng() * .5)
          .add(new THREE.Vector3((rng() - .5) * size, (rng() - .5) * size * .6, (rng() - .5) * size)),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(rng() * 3, rng() * 3, rng() * 3)),
        new THREE.Vector3(s, s * (.6 + rng() * .4), s),
      );
      g.applyMatrix4(m);
      parts.push(g);
    }
  }
  proto.dispose();
  if (!parts.length) return new THREE.BufferGeometry();
  const merged = mergeGeometries(parts, false);
  parts.forEach(p => p.dispose());
  merged.computeVertexNormals();
  return merged;
}

/* ═══════════════ leaf material with wind ═══════════════ */

const LEAF_VERT = `
uniform float uTime;
uniform float uWind;
uniform float uWither;
varying vec3 vNormal;
varying vec3 vWorld;
varying float vHeight;
void main(){
  mat4 im = mat4(1.0);
  vec3 n = normal;
  #ifdef USE_INSTANCING
    im = instanceMatrix;
    n = mat3(instanceMatrix) * n;
  #endif
  vec4 wp = modelMatrix * im * vec4(position, 1.0);
  float sway = sin(uTime * 1.1 + wp.x * 0.35 + wp.z * 0.28) * 0.5
             + sin(uTime * 2.3 + wp.x * 0.9) * 0.22;
  float amt = uWind * clamp(wp.y * 0.1, 0.0, 1.0);
  wp.x += sway * amt;
  wp.z += cos(uTime * 1.4 + wp.z * 0.4) * amt * 0.7;
  wp.y -= uWither * 0.35 * clamp(wp.y * 0.08, 0.0, 1.0);
  vNormal = normalize(normalMatrix * n);
  vWorld = wp.xyz;
  vHeight = wp.y;
  gl_Position = projectionMatrix * viewMatrix * wp;
}`;

const LEAF_FRAG = `
uniform vec3 uColorA;
uniform vec3 uColorB;
uniform vec3 uLightDir;
uniform float uWither;
uniform float uGlow;
varying vec3 vNormal;
varying vec3 vWorld;
varying float vHeight;
float h31(vec3 p){ return fract(sin(dot(p, vec3(12.9898,78.233,37.719))) * 43758.5453); }
void main(){
  vec3 n = normalize(vNormal);
  vec3 l = normalize(uLightDir);
  float d = max(dot(n, l), 0.0);
  float wrap = (dot(n, l) * 0.5 + 0.5);
  float back = pow(clamp(dot(-n, l) * 0.5 + 0.5, 0.0, 1.0), 2.0) * 0.5;
  float v = h31(floor(vWorld * 2.2));
  vec3 base = mix(uColorA, uColorB, v * 0.75 + vHeight * 0.02);
  vec3 dead = vec3(0.34, 0.27, 0.17);
  base = mix(base, dead, uWither);
  vec3 col = base * (0.28 + 0.72 * wrap) + base * d * 0.55 + base * back * (1.0 - uWither);
  col += uGlow * base * 0.6;
  gl_FragColor = vec4(col, 1.0);
}`;

export function leafMaterial({ a = 0x4e7f3a, b = 0x86b84e, lightDir = [0.4, 0.8, 0.3] } = {}) {
  const m = new THREE.ShaderMaterial({
    vertexShader: LEAF_VERT, fragmentShader: LEAF_FRAG,
    uniforms: {
      uTime: { value: 0 }, uWind: { value: .35 }, uWither: { value: 0 }, uGlow: { value: 0 },
      uColorA: { value: new THREE.Color(a) }, uColorB: { value: new THREE.Color(b) },
      uLightDir: { value: new THREE.Vector3(...lightDir).normalize() },
    },
    side: THREE.DoubleSide,
  });
  return animate(m);
}

export function barkMaterial({ color = 0x4a3826 } = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: .92, metalness: 0, flatShading: false });
}

/* ═══════════════ a grove of instanced trees ═══════════════ */

export class Grove {
  /**
   * species: how many distinct tree geometries to generate (each instanced).
   * placements: [{x,z,scale,rot,species}] — supply your own, or let it scatter.
   */
  constructor({
    count = 46, radius = 48, inner = 9, seed = 21, species = 4,
    leafA = 0x47763a, leafB = 0x8ec256, bark = 0x4a3826, scale = 1, canopy = 1,
    placements = null, exclude = [],
  } = {}) {
    const rng = makeRng(seed);
    this.group = new THREE.Group();
    this.object = this.group;
    this.leafMat = leafMaterial({ a: leafA, b: leafB });
    this.barkMat = barkMaterial({ color: bark });

    const lowDetail = isMobile();
    const kinds = [];
    for (let s = 0; s < species; s++) {
      const { segs, tips } = growBranches({
        seed: seed * 31 + s * 7,
        height: 5 + rng() * 4.5,
        radius: .24 + rng() * .18,
        levels: lowDetail ? 3 : 4,
        splits: 2 + Math.floor(rng() * 2),
        lean: .34 + rng() * .3,
        taper: .6 + rng() * .1,
      });
      kinds.push({
        trunk: segmentsToGeometry(segs, lowDetail ? 5 : 6),
        canopy: canopyFromTips(tips, { seed: seed + s, blobs: lowDetail ? 1 : 2, size: (1.0 + rng() * .7) * canopy, detail: lowDetail ? 0 : 1 }),
      });
    }

    const spots = placements || scatter(count, radius, inner, rng, exclude);
    const perKind = kinds.map(() => []);
    spots.forEach((p, i) => perKind[(p.species ?? i) % kinds.length].push(p));

    this.trunks = []; this.canopies = [];
    kinds.forEach((k, i) => {
      const list = perKind[i];
      if (!list.length) return;
      const t = new THREE.InstancedMesh(k.trunk, this.barkMat, list.length);
      const c = new THREE.InstancedMesh(k.canopy, this.leafMat, list.length);
      t.castShadow = c.castShadow = !lowDetail;
      t.receiveShadow = c.receiveShadow = !lowDetail;
      const m = new THREE.Matrix4();
      list.forEach((p, j) => {
        const s = (p.scale ?? (.75 + rng() * .7)) * scale;
        m.compose(
          new THREE.Vector3(p.x, p.y ?? 0, p.z),
          new THREE.Quaternion().setFromEuler(new THREE.Euler(0, p.rot ?? rng() * 6.28, 0)),
          new THREE.Vector3(s, s * (.9 + rng() * .3), s));
        t.setMatrixAt(j, m); c.setMatrixAt(j, m);
      });
      t.instanceMatrix.needsUpdate = true; c.instanceMatrix.needsUpdate = true;
      this.group.add(t, c);
      this.trunks.push(t); this.canopies.push(c);
    });
  }

  set wind(v) { this.leafMat.uniforms.uWind.value = v; }
  set wither(v) { this.leafMat.uniforms.uWither.value = clamp(v); }
  set glow(v) { this.leafMat.uniforms.uGlow.value = v; }
  setLight(dir) { this.leafMat.uniforms.uLightDir.value.copy(dir).normalize(); }

  dispose() {
    this.trunks.concat(this.canopies).forEach(m => m.geometry.dispose());
    this.leafMat.dispose(); this.barkMat.dispose();
  }
}

function scatter(count, radius, inner, rng, exclude = []) {
  const out = [];
  let guard = 0;
  while (out.length < count && guard++ < count * 40) {
    const a = rng() * Math.PI * 2;
    const r = inner + Math.sqrt(rng()) * (radius - inner);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (exclude.some(e => Math.hypot(x - e.x, z - e.z) < (e.r ?? 4))) continue;
    if (out.some(p => Math.hypot(x - p.x, z - p.z) < 3.4)) continue;
    out.push({ x, z, rot: rng() * 6.28, scale: .7 + rng() * .8 });
  }
  return out;
}

/* ═══════════════ grass ═══════════════ */

const GRASS_VERT = `
uniform float uTime;
uniform float uWind;
uniform float uWither;
uniform float uGrow;
attribute float aSeed;
attribute float aHeight;
varying float vY;
varying float vSeed;
void main(){
  vSeed = aSeed; vY = uv.y;
  vec3 local = position;
  local.y *= smoothstep(aSeed * 0.5, aSeed * 0.5 + 0.5, uGrow);
  vec4 wp = vec4(local, 1.0);
  #ifdef USE_INSTANCING
    wp = instanceMatrix * wp;
  #endif
  float t = uTime * (0.9 + aSeed * 0.6);
  float gust = sin(t + wp.x * 0.22 + wp.z * 0.19) * 0.6 + sin(t * 2.7 + aSeed * 40.0) * 0.25;
  float bend = gust * uWind * pow(uv.y, 2.0);
  wp.x += bend * 0.9;
  wp.z += bend * 0.5;
  wp.y -= uWither * uv.y * aHeight * 0.55;
  gl_Position = projectionMatrix * modelViewMatrix * wp;
}`;

const GRASS_FRAG = `
uniform vec3 uBase;
uniform vec3 uTip;
uniform float uWither;
varying float vY;
varying float vSeed;
void main(){
  vec3 dead = vec3(0.42, 0.35, 0.2);
  vec3 b = mix(uBase, dead * 0.7, uWither);
  vec3 t = mix(uTip, dead, uWither);
  vec3 col = mix(b, t, vY);
  col *= 0.78 + 0.35 * vSeed;
  col *= 0.55 + 0.45 * vY;
  gl_FragColor = vec4(col, 1.0);
}`;

export class GrassField {
  constructor({ count = 26000, radius = 40, inner = 0, seed = 9, base = 0x2d4a1e, tip = 0x7fae44, height = 1 } = {}) {
    const n = isMobile() ? Math.floor(count * .3) : count;
    const rng = makeRng(seed);

    const blade = new THREE.PlaneGeometry(.085, 1, 1, 3);
    blade.translate(0, .5, 0);

    this.material = new THREE.ShaderMaterial({
      vertexShader: GRASS_VERT, fragmentShader: GRASS_FRAG,
      uniforms: {
        uTime: { value: 0 }, uWind: { value: .25 }, uWither: { value: 0 }, uGrow: { value: 1 },
        uBase: { value: new THREE.Color(base) }, uTip: { value: new THREE.Color(tip) },
      },
      side: THREE.DoubleSide,
    });
    animate(this.material);

    const mesh = new THREE.InstancedMesh(blade, this.material, n);
    const seeds = new Float32Array(n), heights = new Float32Array(n);
    const m = new THREE.Matrix4();
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2;
      const r = inner + Math.sqrt(rng()) * (radius - inner);
      const h = (.35 + rng() * rng() * 1.5) * height;
      m.compose(
        new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r),
        new THREE.Quaternion().setFromEuler(new THREE.Euler(0, rng() * 6.28, (rng() - .5) * .3)),
        new THREE.Vector3(1, h, 1));
      mesh.setMatrixAt(i, m);
      seeds[i] = rng(); heights[i] = h;
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.geometry.setAttribute('aSeed', new THREE.InstancedBufferAttribute(seeds, 1));
    mesh.geometry.setAttribute('aHeight', new THREE.InstancedBufferAttribute(heights, 1));
    mesh.frustumCulled = false;
    mesh.receiveShadow = true;
    this.object = mesh;
  }
  set wind(v) { this.material.uniforms.uWind.value = v; }
  set wither(v) { this.material.uniforms.uWither.value = clamp(v); }
  set growth(v) { this.material.uniforms.uGrow.value = clamp(v); }
  dispose() { this.object.geometry.dispose(); this.material.dispose(); }
}

/* ═══════════════ flowers ═══════════════ */

export class Flowers {
  constructor({ count = 900, radius = 36, inner = 2, seed = 15, palette = [0xffd36e, 0xff8fb1, 0xc9a7ff, 0xfff6e0] } = {}) {
    const n = isMobile() ? Math.floor(count * .4) : count;
    const rng = makeRng(seed);
    const petal = new THREE.CircleGeometry(.1, 6);
    const stem = new THREE.CylinderGeometry(.012, .016, .45, 3);
    stem.translate(0, .225, 0);
    const geo = mergeGeometries([stem, petal.clone().rotateX(-Math.PI / 2).translate(0, .46, 0)], false);
    petal.dispose(); stem.dispose();

    this.material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .7, side: THREE.DoubleSide, emissive: 0x221100, emissiveIntensity: .25 });
    const mesh = new THREE.InstancedMesh(geo, this.material, n);
    const m = new THREE.Matrix4();
    const col = new THREE.Color();
    for (let i = 0; i < n; i++) {
      const a = rng() * Math.PI * 2, r = inner + Math.sqrt(rng()) * (radius - inner);
      const s = .7 + rng() * 1.1;
      m.compose(new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r),
        new THREE.Quaternion().setFromEuler(new THREE.Euler((rng() - .5) * .2, rng() * 6.28, (rng() - .5) * .2)),
        new THREE.Vector3(s, s, s));
      mesh.setMatrixAt(i, m);
      col.set(palette[Math.floor(rng() * palette.length)]);
      mesh.setColorAt(i, col);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    this.object = mesh;
    this._count = n;
  }
  dispose() { this.object.geometry.dispose(); this.material.dispose(); }
}

/* ═══════════════ the Tree of Knowledge ═══════════════ */

export class TreeOfKnowledge {
  constructor({ seed = 1312, height = 9.5, fruitCount = 16 } = {}) {
    this.group = new THREE.Group();
    this.object = this.group;

    const { segs, tips } = growBranches({
      seed, height, radius: .62, levels: isMobile() ? 3 : 4,
      splits: 3, lean: .55, twist: 3.4, taper: .66, curve: .55,
    });

    // roots: branches grown downward and splayed
    const rootSegs = growBranches({ seed: seed + 5, height: 2.4, radius: .5, levels: 2, splits: 3, lean: .95, taper: .55 }).segs
      .map(s => ({
        a: new THREE.Vector3(s.a.x * 1.6, -s.a.y * .45, s.a.z * 1.6),
        b: new THREE.Vector3(s.b.x * 1.6, -s.b.y * .45, s.b.z * 1.6),
        r0: s.r0, r1: s.r1,
      }));

    const trunkGeo = segmentsToGeometry(segs.concat(rootSegs), 8);
    this.barkMat = makeMaterial('TREE', {
      uniforms: { uBarkColor: new THREE.Color(0x2a1d16), uVeinColor: new THREE.Color(0xff9a4a) },
      fallback: new THREE.MeshStandardMaterial({ color: 0x2a1d16, roughness: .85, emissive: 0x200800, emissiveIntensity: .3 }),
    });
    animate(this.barkMat);
    const trunk = new THREE.Mesh(trunkGeo, this.barkMat);
    trunk.castShadow = true; trunk.receiveShadow = true;
    this.group.add(trunk);

    const canopyGeo = canopyFromTips(tips, { seed: seed + 3, blobs: 2, size: 1.5, detail: isMobile() ? 0 : 1 });
    this.leafMat = leafMaterial({ a: 0x27461f, b: 0x4d7a30 });
    const canopy = new THREE.Mesh(canopyGeo, this.leafMat);
    canopy.castShadow = true;
    this.group.add(canopy);

    // fruit
    this.fruitMat = makeMaterial('FRUIT', {
      transparent: true, toneMapped: false,
      uniforms: { uRipeness: 0.45 },
      fallback: new THREE.MeshStandardMaterial({ color: 0xcc2b2b, emissive: 0xff4422, emissiveIntensity: 1.2, roughness: .35 }),
    });
    animate(this.fruitMat);
    const fruitGeo = new THREE.IcosahedronGeometry(.17, 2);
    this.fruits = [];
    const rng = makeRng(seed + 77);
    const pool = tips.filter(t => t.p.y > height * .5);
    for (let i = 0; i < fruitCount && pool.length; i++) {
      const t = pool[Math.floor(rng() * pool.length)];
      const f = new THREE.Mesh(fruitGeo, this.fruitMat);
      f.position.copy(t.p).add(new THREE.Vector3((rng() - .5) * .8, -.3 - rng() * .5, (rng() - .5) * .8));
      f.userData.base = f.position.clone();
      f.userData.phase = rng() * 6.28;
      this.group.add(f);
      this.fruits.push(f);
    }

    // the one fruit the story turns on — reachable, lit, waiting
    this.theFruit = this.fruits.length
      ? this.fruits.reduce((best, f) => (Math.abs(f.position.y - 2.6) < Math.abs(best.position.y - 2.6) ? f : best), this.fruits[0])
      : null;
    if (this.theFruit) {
      this.theFruit.scale.setScalar(1.45);
      this.theFruit.userData.base.set(1.5, 2.9, 1.2);
      this.theFruit.position.copy(this.theFruit.userData.base);
    }

    this.glow = new THREE.PointLight(0xff7a3c, 0, 18, 2);
    this.glow.position.set(0, 3.2, 0);
    this.group.add(this.glow);

    this._t = 0;
    this._temptation = 0;
  }

  set temptation(v) {
    this._temptation = clamp(v);
    setU(this.barkMat, 'uTemptation', this._temptation);
    setU(this.fruitMat, 'uRipeness', .35 + this._temptation * .65);
    this.glow.intensity = this._temptation * 7;
    this.leafMat.uniforms.uGlow.value = this._temptation * .18;
  }
  get temptation() { return this._temptation; }

  update(dt) {
    this._t += dt;
    for (const f of this.fruits) {
      f.position.y = f.userData.base.y + Math.sin(this._t * .9 + f.userData.phase) * .035;
      f.rotation.y += dt * .25;
    }
    this.glow.intensity = this._temptation * (6 + Math.sin(this._t * 1.7) * 1.4);
  }

  /** Detach the fruit for the moment of the taking. */
  pluck() {
    const f = this.theFruit;
    if (f) { this.fruits = this.fruits.filter(x => x !== f); this.group.remove(f); }
    return f;
  }

  dispose() {
    this.group.traverse(o => { o.geometry?.dispose?.(); });
    this.barkMat.dispose(); this.leafMat.dispose(); this.fruitMat.dispose();
  }
}

/* ═══════════════ the Tree of Life — seen, never reached ═══════════════ */

export function treeOfLife({ seed = 808, height = 13 } = {}) {
  const g = new THREE.Group();
  const { segs, tips } = growBranches({ seed, height, radius: .5, levels: 3, splits: 3, lean: .3, taper: .7 });
  const mat = new THREE.MeshStandardMaterial({
    color: 0xf2e5c8, emissive: 0xffd99a, emissiveIntensity: .9, roughness: .4,
  });
  const trunk = new THREE.Mesh(segmentsToGeometry(segs, 7), mat);
  const canopy = new THREE.Mesh(canopyFromTips(tips, { seed: seed + 1, blobs: 2, size: 1.7, detail: 1 }),
    new THREE.MeshStandardMaterial({ color: 0xfff2d0, emissive: 0xffe0a0, emissiveIntensity: 1.5, roughness: .5 }));
  g.add(trunk, canopy);
  const light = new THREE.PointLight(0xffe2ad, 6, 40, 2);
  light.position.y = height * .7;
  g.add(light);
  return g;
}
