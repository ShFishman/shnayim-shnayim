// world.js — the valley, the sea that swallows it, the sky above it and the
// rain in between.
//
// The terrain is displaced on the CPU from an analytic height function, and
// heightAt() evaluates that same function. Gameplay and geometry therefore
// agree exactly, with no raycasting and no grid sampling error.

import * as THREE from 'three';
import { makeMaterial, setU, animate } from './materials.js';
import { clamp, lerp, smoothstep, makeRng } from './utils.js';

export const VALLEY = {
  size: 190,        // terrain plane is size x size
  seg: 180,         // grid resolution
  rimStart: 40,     // radius where the valley wall begins to climb
  rimEnd: 86,
  rimHeight: 17,
  padRadius: 13,    // flat ground around the ark
  floor: 0.3,
};

/* ───────────────── CPU value noise ─────────────────
 * Deliberately the same shape as the GLSL vnoise2 in shaders.js so the
 * painted ground and the solid ground describe the same world.
 */
function hash2(x, y, seed) {
  let h = Math.sin(x * 127.1 + y * 311.7 + seed * 0.731) * 43758.5453123;
  return h - Math.floor(h);
}
const quintic = f => f * f * f * (f * (f * 6 - 15) + 10);

export function makeNoise2(seed = 7) {
  return (x, y) => {
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const wx = quintic(fx), wy = quintic(fy);
    const a = hash2(ix, iy, seed);
    const b = hash2(ix + 1, iy, seed);
    const c = hash2(ix, iy + 1, seed);
    const d = hash2(ix + 1, iy + 1, seed);
    return lerp(lerp(a, b, wx), lerp(c, d, wx), wy);
  };
}

export function makeFbm2(seed = 7, octaves = 4) {
  const n = makeNoise2(seed);
  return (x, y) => {
    let s = 0, a = 0.5, norm = 0;
    for (let i = 0; i < octaves; i++) {
      s += a * n(x, y);
      norm += a;
      x = x * 2.03 + 7.3; y = y * 2.03 + 11.1;
      a *= 0.5;
    }
    return s / norm;
  };
}

/* ───────────────── terrain ───────────────── */

// Knolls give the valley landmarks, and strand animals on high ground as the
// water comes up — which is what makes the last two minutes tense.
const KNOLLS = [
  { x: -26, z: -20, h: 7.5, s: 13 },
  { x: 30, z: -28, h: 6.0, s: 11 },
  { x: -34, z: 24, h: 8.5, s: 14 },
  { x: 24, z: 30, h: 5.0, s: 10 },
  { x: 2, z: -40, h: 9.0, s: 15 },
];

export class Terrain {
  constructor({ seed = 1771 } = {}) {
    this.fbmA = makeFbm2(seed, 4);
    this.fbmB = makeFbm2(seed + 91, 3);

    const { size, seg } = VALLEY;
    const geo = new THREE.PlaneGeometry(size, size, seg, seg);
    geo.rotateX(-Math.PI / 2);

    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      pos.setY(i, this.heightAt(x, z));
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();

    this.material = animate(makeMaterial('GROUND', { fallbackColor: 0x5d8a3a }));
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.receiveShadow = true;
    this.mesh.name = 'terrain';
  }

  /** Analytic height. Must stay in sync with the displacement loop above. */
  heightAt(x, z) {
    const r = Math.hypot(x, z);
    const { rimStart, rimEnd, rimHeight, padRadius, floor } = VALLEY;

    // the bowl wall
    let h = smoothstep((r - rimStart) / (rimEnd - rimStart)) * rimHeight;

    // rolling ground
    h += (this.fbmA(x * 0.018, z * 0.018) - 0.5) * 7.0;
    h += (this.fbmB(x * 0.055, z * 0.055) - 0.5) * 2.0;

    // landmark knolls
    for (const k of KNOLLS) {
      const dx = x - k.x, dz = z - k.z;
      h += k.h * Math.exp(-(dx * dx + dz * dz) / (2 * k.s * k.s));
    }

    // flat building site for the ark
    const pad = 1 - smoothstep((r - padRadius) / 15);
    h = lerp(h, floor, pad * 0.94);

    return h;
  }

  /** Surface normal by central difference — used to tilt animals on slopes. */
  normalAt(x, z, out = new THREE.Vector3()) {
    const e = 0.6;
    const hL = this.heightAt(x - e, z), hR = this.heightAt(x + e, z);
    const hD = this.heightAt(x, z - e), hU = this.heightAt(x, z + e);
    return out.set(hL - hR, 2 * e, hD - hU).normalize();
  }

  /** How steep it is here, 0 flat .. 1 cliff. Blocks movement up walls. */
  slopeAt(x, z) {
    const n = this.normalAt(x, z, new THREE.Vector3());
    return 1 - clamp(n.y, 0, 1);
  }

  setWaterLevel(y) { setU(this.material, 'uWaterLevel', y); }
  setDrown(v) { setU(this.material, 'uDrown', v); }
  setSun(dir) { setU(this.material, 'uSunDir', dir); }
}

/* ───────────────── the flood ───────────────── */

export class Ocean {
  constructor({ level = -12, size = 1400 } = {}) {
    // ~1 vertex per 1.5m near the middle is plenty for the Gerstner stack
    const geo = new THREE.PlaneGeometry(size, size, 220, 220);
    geo.rotateX(-Math.PI / 2);
    this.material = animate(makeMaterial('WATER', { fallbackColor: 0x2d6e7e }));
    this.mesh = new THREE.Mesh(geo, this.material);
    this.mesh.name = 'ocean';
    this.mesh.renderOrder = -1;
    this.level = level;
    this.mesh.position.y = level;
  }

  /** The whole flood mechanic: the wave field is world-anchored, so raising
   *  the water is literally moving the mesh. No shader work needed. */
  setLevel(y) {
    this.level = y;
    this.mesh.position.y = y;
  }

  setStorm(t) {
    // calm pond -> heaving sea
    // 1.25m waves on a 190m valley read as chaos, not as a flood; and that
    // much choppiness pushes every crest into the foam term.
    setU(this.material, 'uAmplitude', lerp(0.14, 0.70, t));
    setU(this.material, 'uChoppiness', lerp(0.25, 0.60, t));
    setU(this.material, 'uGlitter', lerp(0.9, 0.25, t));
    setU(this.material, 'uDeepColor', [
      lerp(0.0033, 0.0061, t), lerp(0.0423, 0.0185, t), lerp(0.0685, 0.0273, t),
    ]);
    setU(this.material, 'uShallowColor', [
      lerp(0.0273, 0.0185, t), lerp(0.2623, 0.0885, t), lerp(0.3050, 0.1096, t),
    ]);
  }

  setSun(dir) { setU(this.material, 'uSunDir', dir); }

  /** Follow the camera so the sea always reaches the horizon. */
  recentre(x, z) { this.mesh.position.x = x; this.mesh.position.z = z; }
}

/* ───────────────── sky ───────────────── */

export class Sky {
  constructor() {
    this.group = new THREE.Group();

    const domeGeo = new THREE.SphereGeometry(1200, 32, 20);
    this.domeMat = animate(makeMaterial('FIRMAMENT', { fallbackColor: 0x8ec6e8 }));
    this.dome = new THREE.Mesh(domeGeo, this.domeMat);
    this.dome.frustumCulled = false;
    this.group.add(this.dome);

    // cloud layer on a big disc overhead
    const discGeo = new THREE.CircleGeometry(620, 64);
    discGeo.rotateX(Math.PI / 2);
    this.cloudMat = animate(makeMaterial('CLOUDS', { fallbackColor: 0xffffff, transparent: true }));
    this.clouds = new THREE.Mesh(discGeo, this.cloudMat);
    this.clouds.position.y = 120;
    this.clouds.frustumCulled = false;
    this.clouds.renderOrder = 1;
    this.group.add(this.clouds);

    this.sunDir = new THREE.Vector3(0.35, 0.55, -0.75).normalize();
  }

  /** t: 0 = blue afternoon, 1 = the sky has closed over. */
  setStorm(t) {
    setU(this.domeMat, 'uDayNight', lerp(1, 0.22, t));
    setU(this.domeMat, 'uHaze', lerp(0.3, 0.95, t));
    setU(this.domeMat, 'uTopColor', [
      lerp(0.0284, 0.0080, t), lerp(0.2122, 0.0144, t), lerp(0.6308, 0.0252, t),
    ]);
    setU(this.domeMat, 'uHorizonColor', [
      lerp(0.5457, 0.0437, t), lerp(0.7682, 0.0578, t), lerp(0.8879, 0.0802, t),
    ]);
    setU(this.cloudMat, 'uCover', lerp(0.22, 1.0, t));
    setU(this.cloudMat, 'uDark', t);
  }

  setSun(dir) {
    this.sunDir.copy(dir).normalize();
    const a = [this.sunDir.x, this.sunDir.y, this.sunDir.z];
    setU(this.domeMat, 'uSunDir', a);
    setU(this.cloudMat, 'uSunDir', a);
  }

  recentre(x, z) {
    this.group.position.x = x;
    this.group.position.z = z;
  }
}

/* ───────────────── rain ───────────────── */

export class Rain {
  constructor({ count = 6000, boxH = 42, boxR = 44 } = {}) {
    const rng = makeRng(4242);
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count);
    const speed = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos[i * 3 + 0] = rng.range(-boxR, boxR);
      pos[i * 3 + 1] = rng.range(0, boxH);
      pos[i * 3 + 2] = rng.range(-boxR, boxR);
      seed[i] = rng();
      speed[i] = rng();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));

    this.material = animate(makeMaterial('RAIN', {
      transparent: true, depthWrite: false,
      fallback: new THREE.PointsMaterial({ color: 0xc8dcf0, size: 0.1, transparent: true, opacity: 0.5 }),
    }));
    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;   // it is always around the camera
    this.points.renderOrder = 2;
    this.points.visible = false;
    this.intensity = 0;
    setU(this.material, 'uBoxH', boxH);
    setU(this.material, 'uBoxR', boxR);
  }

  setIntensity(v) {
    this.intensity = clamp(v, 0, 1);
    setU(this.material, 'uIntensity', this.intensity);
    setU(this.material, 'uOpacity', lerp(0.30, 0.72, this.intensity));
    setU(this.material, 'uSize', lerp(0.9, 1.5, this.intensity));
    setU(this.material, 'uWind', [0.5 + this.intensity * 1.6, 0.2 + this.intensity * 0.5]);
    this.points.visible = this.intensity > 0.01;
  }

  update(camPos) {
    // snap to whole units: stops the wrap from shimmering as the camera drifts
    setU(this.material, 'uOrigin', [
      Math.round(camPos.x), Math.round(camPos.y), Math.round(camPos.z),
    ]);
  }
}
