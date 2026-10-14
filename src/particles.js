// Particle systems: the dust that becomes Adam, the swarms of day five,
// the stars of day four, Eden's drifting motes, and the embers of the exile.

import * as THREE from 'three';
import { makeMaterial, setU, hasShader } from './materials.js';
import { makeRng, clamp, lerp } from './utils.js';

/* ═══════════════ dust → human ═══════════════ */

/**
 * A cloud of dust motes that can assemble into an arbitrary target shape.
 * `targets` is a Float32Array of xyz triples (one per particle).
 */
export class DustCloud {
  constructor(targets, {
    color = 0xbe8f5e, breathColor = 0xfff1cf, size = 2.6, spread = 7, seed = 7,
    start = 'ground', origin = [0, 0, 0],
  } = {}) {
    const rng = makeRng(seed);
    const count = targets.length / 3;
    const geo = new THREE.BufferGeometry();

    const pos = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const tgt = new Float32Array(targets);

    for (let i = 0; i < count; i++) {
      if (start === 'line') {
        // drawn out of a side as a single vertical seam of light
        const t = rng();
        pos[i * 3] = origin[0] + (rng() - .5) * .14;
        pos[i * 3 + 1] = origin[1] + t * spread;
        pos[i * 3 + 2] = origin[2] + (rng() - .5) * .14;
      } else if (start === 'point') {
        const a = rng() * Math.PI * 2, b = Math.acos(rng() * 2 - 1), r = Math.pow(rng(), .4) * spread * .2;
        pos[i * 3] = origin[0] + Math.sin(b) * Math.cos(a) * r;
        pos[i * 3 + 1] = origin[1] + Math.cos(b) * r;
        pos[i * 3 + 2] = origin[2] + Math.sin(b) * Math.sin(a) * r;
      } else {
        // scattered on a flat swirl near the ground — dust of the earth
        const a = rng() * Math.PI * 2;
        const r = Math.pow(rng(), .55) * spread;
        pos[i * 3] = origin[0] + Math.cos(a) * r;
        pos[i * 3 + 1] = origin[1] + rng() * .35;
        pos[i * 3 + 2] = origin[2] + Math.sin(a) * r;
      }
      seeds[i] = rng();
    }

    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aTarget', new THREE.BufferAttribute(tgt, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    geo.computeBoundingSphere();
    geo.boundingSphere.radius = Math.max(spread, 6);

    this.material = hasShader('DUST')
      ? makeMaterial('DUST', {
          transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
          uniforms: { uSize: size, uColor: new THREE.Color(color), uBreathColor: new THREE.Color(breathColor) },
        })
      : new THREE.PointsMaterial({
          color, size: size * .02, transparent: true, opacity: .9,
          blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true,
        });

    this.points = new THREE.Points(geo, this.material);
    this.points.frustumCulled = false;
    this.object = this.points;
    this._form = 0; this._breath = 0;
  }

  set form(v) { this._form = clamp(v); setU(this.material, 'uForm', this._form); }
  get form() { return this._form; }
  set breath(v) { this._breath = clamp(v); setU(this.material, 'uBreath', this._breath); }
  get breath() { return this._breath; }
  set time(t) { setU(this.material, 'uTime', t); }

  dispose() { this.points.geometry.dispose(); this.material.dispose(); }
}

/** Sample surface points from any mesh/group into a flat Float32Array of targets. */
export function sampleSurface(root, count, seed = 11) {
  const rng = makeRng(seed);
  const tris = [];
  const m = new THREE.Matrix4();
  root.updateWorldMatrix(true, true);

  root.traverse(o => {
    if (!o.isMesh || !o.geometry) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry;
    const p = g.attributes.position;
    m.copy(o.matrixWorld);
    for (let i = 0; i < p.count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(p, i).applyMatrix4(m);
      const b = new THREE.Vector3().fromBufferAttribute(p, i + 1).applyMatrix4(m);
      const c = new THREE.Vector3().fromBufferAttribute(p, i + 2).applyMatrix4(m);
      const area = new THREE.Triangle(a, b, c).getArea();
      if (area > 1e-9) tris.push({ a, b, c, area });
    }
    if (g !== o.geometry) g.dispose();
  });

  const out = new Float32Array(count * 3);
  if (!tris.length) return out;

  // area-weighted cumulative table so dense little parts don't hog the samples
  let total = 0;
  const cum = tris.map(t => (total += t.area));

  for (let i = 0; i < count; i++) {
    const r = rng() * total;
    let lo = 0, hi = cum.length - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (cum[mid] < r) lo = mid + 1; else hi = mid; }
    const t = tris[lo];
    let u = rng(), v = rng();
    if (u + v > 1) { u = 1 - u; v = 1 - v; }
    out[i * 3]     = t.a.x + u * (t.b.x - t.a.x) + v * (t.c.x - t.a.x);
    out[i * 3 + 1] = t.a.y + u * (t.b.y - t.a.y) + v * (t.c.y - t.a.y);
    out[i * 3 + 2] = t.a.z + u * (t.b.z - t.a.z) + v * (t.c.z - t.a.z);
  }
  return out;
}

/* ═══════════════ generic soft-point system ═══════════════ */

const POINT_VERT = `
attribute float aSeed;
attribute float aScale;
uniform float uTime;
uniform float uSize;
uniform float uReveal;
uniform float uDrift;
varying float vSeed;
varying float vAlpha;
void main(){
  vSeed = aSeed;
  vec3 p = position;
  float w = uTime * (0.25 + aSeed * 0.5);
  p.x += sin(w + aSeed * 31.0) * 0.45 * uDrift;
  p.y += cos(w * 0.8 + aSeed * 17.0) * 0.35 * uDrift;
  p.z += sin(w * 0.6 + aSeed * 53.0) * 0.45 * uDrift;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float d = -mv.z;
  float appear = smoothstep(aSeed * 0.85, aSeed * 0.85 + 0.15, uReveal);
  vAlpha = appear * (0.35 + 0.65 * (0.5 + 0.5 * sin(uTime * 1.7 + aSeed * 90.0)));
  gl_PointSize = max(1.0, uSize * aScale * (12.0 / max(d, 0.6)) * appear);
  gl_Position = projectionMatrix * mv;
}`;

const POINT_FRAG = `
uniform vec3 uColor;
uniform vec3 uColor2;
uniform float uOpacity;
varying float vSeed;
varying float vAlpha;
void main(){
  vec2 c = gl_PointCoord - 0.5;
  float d = dot(c, c);
  if (d > 0.25) discard;
  float a = smoothstep(0.25, 0.0, d);
  a = pow(a, 1.6);
  vec3 col = mix(uColor, uColor2, vSeed);
  gl_FragColor = vec4(col, a * vAlpha * uOpacity);
}`;

/** Drifting motes — pollen and light in the garden, ash after the fall. */
export class Motes {
  constructor({ count = 900, radius = 46, height = 16, color = 0xffe6a8, color2 = 0xaee2ff, size = 3.2, seed = 3 } = {}) {
    const rng = makeRng(seed);
    const pos = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const scale = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * radius;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = Math.pow(rng(), 1.6) * height + .3;
      pos[i * 3 + 2] = Math.sin(a) * r;
      seeds[i] = rng();
      scale[i] = .5 + rng() * rng() * 2.2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    geo.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), radius * 1.6);

    this.material = new THREE.ShaderMaterial({
      vertexShader: POINT_VERT, fragmentShader: POINT_FRAG,
      uniforms: {
        uTime: { value: 0 }, uSize: { value: size }, uReveal: { value: 0 }, uDrift: { value: 1 },
        uColor: { value: new THREE.Color(color) }, uColor2: { value: new THREE.Color(color2) },
        uOpacity: { value: 1 },
      },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    });
    this.object = new THREE.Points(geo, this.material);
    this.object.frustumCulled = false;
  }
  set reveal(v) { this.material.uniforms.uReveal.value = clamp(v); }
  set opacity(v) { this.material.uniforms.uOpacity.value = v; }
  set time(t) { this.material.uniforms.uTime.value = t; }
  setColors(a, b) { this.material.uniforms.uColor.value.set(a); this.material.uniforms.uColor2.value.set(b); }
  dispose() { this.object.geometry.dispose(); this.material.dispose(); }
}

/* ═══════════════ stars ═══════════════ */

export class StarField {
  constructor({ count = 2600, radius = 900, seed = 42 } = {}) {
    const rng = makeRng(seed);
    const pos = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const scale = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      // bias toward a milky band for a sky that has structure
      const band = rng() < .42;
      const u = rng() * 2 - 1;
      const theta = rng() * Math.PI * 2;
      let phi = Math.acos(band ? u * .22 : u);
      const r = radius * (.82 + rng() * .18);
      const sp = Math.sin(phi);
      pos[i * 3] = r * sp * Math.cos(theta);
      pos[i * 3 + 1] = Math.abs(r * Math.cos(phi)) * .9 + 20;
      pos[i * 3 + 2] = r * sp * Math.sin(theta);
      seeds[i] = rng();
      scale[i] = .35 + Math.pow(rng(), 3) * 3.4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    geo.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), radius * 2);

    this.material = new THREE.ShaderMaterial({
      vertexShader: POINT_VERT, fragmentShader: POINT_FRAG,
      uniforms: {
        uTime: { value: 0 }, uSize: { value: 240 }, uReveal: { value: 0 }, uDrift: { value: 0 },
        uColor: { value: new THREE.Color(0xfff6e2) }, uColor2: { value: new THREE.Color(0x9fc4ff) },
        uOpacity: { value: 1 },
      },
      transparent: true, depthWrite: false, depthTest: false,
      blending: THREE.AdditiveBlending, toneMapped: false,
    });
    this.object = new THREE.Points(geo, this.material);
    this.object.frustumCulled = false;
    this.object.renderOrder = -10;
  }
  set reveal(v) { this.material.uniforms.uReveal.value = clamp(v); }
  set opacity(v) { this.material.uniforms.uOpacity.value = v; }
  set time(t) { this.material.uniforms.uTime.value = t; }
  dispose() { this.object.geometry.dispose(); this.material.dispose(); }
}

/* ═══════════════ swarms: fish and birds ═══════════════ */

/**
 * Cheap, good-looking flocking: every agent chases a slowly wandering attractor
 * with per-agent noise offsets. Reads as a shoal or a flight without the cost
 * of real neighbour queries.
 */
export class Swarm {
  constructor({
    count = 160, kind = 'bird', color = 0xdfe8ff, emissive = 0x6688cc,
    center = [0, 14, -18], spread = 16, speed = 1, scale = 1, seed = 5,
  } = {}) {
    const rng = makeRng(seed);
    this.kind = kind;
    this.count = count;
    this.center = new THREE.Vector3(...center);
    this.spread = spread;
    this.speed = speed;
    this._t = rng() * 50;

    const geo = kind === 'fish' ? fishGeometry() : birdGeometry();
    geo.scale(scale, scale, scale);
    const mat = new THREE.MeshStandardMaterial({
      color, emissive, emissiveIntensity: .35, roughness: .55, metalness: .1,
      side: THREE.DoubleSide, transparent: true, opacity: 0,
    });
    this.material = mat;
    this.mesh = new THREE.InstancedMesh(geo, mat, count);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.object = this.mesh;

    this.agents = [];
    for (let i = 0; i < count; i++) {
      this.agents.push({
        pos: new THREE.Vector3(
          this.center.x + (rng() - .5) * spread * 2,
          this.center.y + (rng() - .5) * spread,
          this.center.z + (rng() - .5) * spread * 2),
        vel: new THREE.Vector3(rng() - .5, (rng() - .5) * .3, rng() - .5).normalize().multiplyScalar(2),
        phase: rng() * Math.PI * 2,
        rate: .8 + rng() * .9,
        off: new THREE.Vector3(rng() * 100, rng() * 100, rng() * 100),
        wobble: .6 + rng() * .8,
      });
    }
    this._m = new THREE.Matrix4();
    this._q = new THREE.Quaternion();
    this._up = new THREE.Vector3(0, 1, 0);
    this._scl = new THREE.Vector3(1, 1, 1);
    this._tmp = new THREE.Vector3();
  }

  set opacity(v) { this.material.opacity = clamp(v); }
  get opacity() { return this.material.opacity; }

  update(dt, t) {
    this._t += dt * this.speed;
    const tt = this._t;
    // the shoal's heart wanders on a lazy lissajous
    const attract = this._tmp.set(
      this.center.x + Math.sin(tt * .17) * this.spread * 1.1,
      this.center.y + Math.sin(tt * .23) * this.spread * .35,
      this.center.z + Math.cos(tt * .13) * this.spread * 1.1,
    );

    for (let i = 0; i < this.count; i++) {
      const a = this.agents[i];
      const dir = attract.clone().sub(a.pos);
      const dist = dir.length();
      dir.normalize();

      // personal noise so the flock has texture
      const n = a.off;
      dir.x += Math.sin(tt * .9 + n.x) * .55 * a.wobble;
      dir.y += Math.sin(tt * 1.3 + n.y) * .35 * a.wobble;
      dir.z += Math.cos(tt * 1.1 + n.z) * .55 * a.wobble;

      const pull = clamp(dist / (this.spread * 1.5)) * 2.6 + .4;
      a.vel.addScaledVector(dir, pull * dt * 3.2);
      const sp = a.vel.length();
      const max = (this.kind === 'fish' ? 5.2 : 8.5) * this.speed;
      if (sp > max) a.vel.multiplyScalar(max / sp);
      if (sp < max * .35) a.vel.multiplyScalar(1.04);
      a.pos.addScaledVector(a.vel, dt);

      // orient along velocity, with a flap/undulate roll
      const flap = Math.sin(tt * 7 * a.rate + a.phase);
      this._m.lookAt(a.pos, a.pos.clone().add(a.vel), this._up);
      this._q.setFromRotationMatrix(this._m);
      const roll = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), flap * (this.kind === 'fish' ? .18 : .55));
      this._q.multiply(roll);
      const s = this.kind === 'fish' ? 1 : 1 + flap * .12;
      this._scl.set(s, 1, 1);
      this._m.compose(a.pos, this._q, this._scl);
      this.mesh.setMatrixAt(i, this._m);
    }
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  dispose() { this.mesh.geometry.dispose(); this.material.dispose(); }
}

function birdGeometry() {
  // a simple swept delta — reads as a bird in silhouette at any distance
  const g = new THREE.BufferGeometry();
  const v = new Float32Array([
    0, 0, .55,  -.52, .06, -.3,  0, 0, -.1,
    0, 0, .55,   0, 0, -.1,     .52, .06, -.3,
  ]);
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

function fishGeometry() {
  const g = new THREE.BufferGeometry();
  const v = new Float32Array([
    0, 0, .5,   -.14, 0, -.1,  0, .13, -.05,
    0, 0, .5,    0, .13, -.05,  .14, 0, -.1,
    0, 0, .5,    .14, 0, -.1,  0, -.11, -.05,
    0, 0, .5,    0, -.11, -.05, -.14, 0, -.1,
    -.14, 0, -.1, -.2, .2, -.5, 0, 0, -.42,
    .14, 0, -.1,  0, 0, -.42,   .2, .2, -.5,
  ]);
  g.setAttribute('position', new THREE.BufferAttribute(v, 3));
  g.computeVertexNormals();
  return g;
}

/* ═══════════════ embers / ash for the exile ═══════════════ */

export class Embers {
  constructor({ count = 420, radius = 26, seed = 77 } = {}) {
    const rng = makeRng(seed);
    const pos = new Float32Array(count * 3);
    const seeds = new Float32Array(count);
    const scale = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      const a = rng() * Math.PI * 2, r = Math.sqrt(rng()) * radius;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = rng() * 10;
      pos[i * 3 + 2] = Math.sin(a) * r;
      seeds[i] = rng();
      scale[i] = .4 + rng() * 1.6;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    geo.setAttribute('aScale', new THREE.BufferAttribute(scale, 1));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), radius * 2);

    this.base = new Float32Array(pos);
    this.geo = geo;
    this.material = new THREE.ShaderMaterial({
      vertexShader: POINT_VERT, fragmentShader: POINT_FRAG,
      uniforms: {
        uTime: { value: 0 }, uSize: { value: 4 }, uReveal: { value: 0 }, uDrift: { value: 1 },
        uColor: { value: new THREE.Color(0xff7a2c) }, uColor2: { value: new THREE.Color(0x553322) },
        uOpacity: { value: 1 },
      },
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
    });
    this.object = new THREE.Points(geo, this.material);
    this.object.frustumCulled = false;
    this._t = 0;
  }
  set reveal(v) { this.material.uniforms.uReveal.value = clamp(v); }
  update(dt) {
    this._t += dt;
    this.material.uniforms.uTime.value = this._t;
    const p = this.geo.attributes.position.array;
    const s = this.geo.attributes.aSeed.array;
    for (let i = 0; i < s.length; i++) {
      p[i * 3 + 1] += dt * (.5 + s[i] * 1.5);
      if (p[i * 3 + 1] > 14) p[i * 3 + 1] = 0;
    }
    this.geo.attributes.position.needsUpdate = true;
  }
  dispose() { this.geo.dispose(); this.material.dispose(); }
}
