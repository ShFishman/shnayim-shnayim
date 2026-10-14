// engine.js — renderer, camera rig, post stack and the master frame loop.
//
// Adapted from the Bereshit engine. The big change is the camera: that one was
// a cinematic rig that only knew how to be flown along authored paths. This one
// is dual-mode — it follows Noah around during play, and can still be taken
// over for the opening and the ending.

import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { clock, clamp, lerp, ease, dpr, isMobile, makeRng } from './utils.js';
import { makeMaterial, setU, tickMaterials, hasShader } from './materials.js';

const rng = makeRng(90210);

const V0 = new THREE.Vector3();
const V1 = new THREE.Vector3();

/* ───────────────────────── camera rig ─────────────────────────
 * mode 'follow' — orbits a moving subject at a spring-damped distance.
 * mode 'free'   — authored moves, for the title shot and the ending.
 */

export class Rig {
  constructor(camera) {
    this.cam = camera;
    this.mode = 'free';

    // free-mode state
    this.pos = new THREE.Vector3(0, 6, 18);
    this.target = new THREE.Vector3(0, 2, 0);

    // follow-mode state
    this.subject = null;             // THREE.Object3D to chase
    this.yaw = 0;                    // orbit angle, radians
    this.pitch = 0.34;               // look-down angle
    this.dist = 11;                  // desired boom length
    this.height = 2.1;               // how far above the subject we aim
    this.minDist = 4;
    this.maxDist = 22;
    this.groundFn = null;            // (x,z) => height, keeps us out of the dirt

    this._smoothPos = new THREE.Vector3(0, 6, 18);
    this._smoothTarget = new THREE.Vector3(0, 2, 0);
    this._warm = false;

    this.up = new THREE.Vector3(0, 1, 0);
    this.roll = 0;
    this.fov = 60;

    this.drift = 0.12;               // a little handheld life; far less than the film rig
    this.shakeAmt = 0;
    this.shakeDecay = 1.6;
    this._t = 0;
    this._noiseSeed = rng.range(0, 1000);
  }

  follow(subject, opts = {}) {
    this.subject = subject;
    this.mode = 'follow';
    Object.assign(this, opts);
    return this;
  }

  free() { this.mode = 'free'; return this; }

  /** Nudge the orbit. dx/dy are in radians. */
  orbit(dx, dy) {
    this.yaw -= dx;
    this.pitch = clamp(this.pitch + dy, -0.15, 1.15);
  }

  zoomBy(d) { this.dist = clamp(this.dist + d, this.minDist, this.maxDist); }

  async moveTo(pos, target, dur = 3, easing = ease.inOutCubic) {
    this.mode = 'free';
    const p0 = this.pos.clone(), t0 = this.target.clone();
    const p1 = Array.isArray(pos) ? new THREE.Vector3(...pos) : pos.clone();
    const t1 = Array.isArray(target) ? new THREE.Vector3(...target) : target.clone();
    await clock.to(dur, e => {
      this.pos.lerpVectors(p0, p1, e);
      this.target.lerpVectors(t0, t1, e);
    }, easing);
  }

  async arcTo(pos, target, dur = 4, lift = 1.4, easing = ease.inOutCubic) {
    this.mode = 'free';
    const p0 = this.pos.clone(), t0 = this.target.clone();
    const p1 = Array.isArray(pos) ? new THREE.Vector3(...pos) : pos.clone();
    const t1 = Array.isArray(target) ? new THREE.Vector3(...target) : target.clone();
    const mid = p0.clone().add(p1).multiplyScalar(.5);
    mid.y += lift;
    await clock.to(dur, e => {
      const a = p0.clone().lerp(mid, e), b = mid.clone().lerp(p1, e);
      this.pos.copy(a.lerp(b, e));
      this.target.lerpVectors(t0, t1, e);
    }, easing);
  }

  async zoom(fov, dur = 2, easing = ease.inOutCubic) {
    const f0 = this.fov;
    await clock.to(dur, e => { this.fov = lerp(f0, fov, e); }, easing);
  }

  snap(pos, target) {
    if (pos) this.pos.copy(Array.isArray(pos) ? new THREE.Vector3(...pos) : pos);
    if (target) this.target.copy(Array.isArray(target) ? new THREE.Vector3(...target) : target);
    this._smoothPos.copy(this.pos);
    this._smoothTarget.copy(this.target);
    this._warm = true;
  }

  shake(amount = .4, decay = 1.6) {
    this.shakeAmt = Math.max(this.shakeAmt, amount);
    this.shakeDecay = decay;
  }

  update(dt) {
    this._t += dt;
    const t = this._t + this._noiseSeed;

    if (this.mode === 'follow' && this.subject) {
      // accept either a THREE.Object3D or a game actor carrying a `pos`
      const s = this.subject.position || this.subject.pos;
      if (!s) return;
      const cp = Math.cos(this.pitch), sp = Math.sin(this.pitch);
      V0.set(
        s.x + Math.sin(this.yaw) * cp * this.dist,
        s.y + this.height + sp * this.dist,
        s.z + Math.cos(this.yaw) * cp * this.dist,
      );
      // never let the camera sink into the valley floor
      if (this.groundFn) {
        const g = this.groundFn(V0.x, V0.z) + 1.3;
        if (V0.y < g) V0.y = g;
      }
      V1.set(s.x, s.y + this.height * 0.72, s.z);

      // critically-damped-ish smoothing, frame-rate independent
      const kPos = 1 - Math.pow(0.0015, dt);
      const kTgt = 1 - Math.pow(0.0004, dt);
      if (!this._warm) { this._smoothPos.copy(V0); this._smoothTarget.copy(V1); this._warm = true; }
      this._smoothPos.lerp(V0, kPos);
      this._smoothTarget.lerp(V1, kTgt);
      this.pos.copy(this._smoothPos);
      this.target.copy(this._smoothTarget);
    } else {
      this._smoothPos.copy(this.pos);
      this._smoothTarget.copy(this.target);
      this._warm = true;
    }

    // a touch of handheld so static shots are not dead
    const dx = (Math.sin(t * .37) * .6 + Math.sin(t * .91) * .25) * .05 * this.drift;
    const dy = (Math.cos(t * .29) * .6 + Math.sin(t * .83) * .22) * .045 * this.drift;
    const dz = Math.sin(t * .21) * .03 * this.drift;

    let sx = 0, sy = 0, sz = 0;
    if (this.shakeAmt > 0.0001) {
      const a = this.shakeAmt;
      sx = (rng() - .5) * a; sy = (rng() - .5) * a; sz = (rng() - .5) * a * .5;
      this.shakeAmt *= Math.pow(.08, dt * this.shakeDecay);
    }

    this.cam.position.set(this.pos.x + dx + sx, this.pos.y + dy + sy, this.pos.z + dz + sz);
    this.cam.up.set(Math.sin(this.roll), Math.cos(this.roll), 0);
    this.cam.lookAt(this.target);
    if (Math.abs(this.cam.fov - this.fov) > .01) {
      this.cam.fov = lerp(this.cam.fov, this.fov, 1 - Math.pow(.02, dt));
      this.cam.updateProjectionMatrix();
    }
  }
}

/* ───────────────────────── engine ───────────────────────── */

export class Engine {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({
      canvas, antialias: !isMobile(), powerPreference: 'high-performance',
      stencil: false, alpha: false,
    });
    this.renderer.setPixelRatio(dpr());
    this.renderer.setSize(innerWidth, innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    // ACES desaturates and milks the midtones. This is a flat cartoon, so the
    // colours are authored directly and tone mapping stays out of the way.
    this.renderer.toneMapping = THREE.NoToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.shadowMap.enabled = !isMobile();
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.autoClear = true;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8ec6e8);

    this.camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 3000);
    this.camera.position.set(0, 6, 18);
    this.rig = new Rig(this.camera);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    // gentle bloom: this is a sunny cartoon, not a cathedral
    this.bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.16, 0.55, 0.86);
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());

    this.veilScene = new THREE.Scene();
    this.veilCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.veilMat = makeMaterial('VEIL', {
      transparent: true, depthWrite: false, depthTest: false, toneMapped: false,
      fallback: new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0, depthTest: false }),
    });
    this.hasVeilShader = hasShader('VEIL');
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.veilMat);
    quad.frustumCulled = false;
    this.veilScene.add(quad);
    this.veil = { fade: 0, ripple: 0, grain: 0.018, vignette: 0.22 };

    this.lights = {};
    this._setupBaseLights();

    this.elapsed = 0;
    this._raf = 0;
    this._last = performance.now();
    this._onFrame = [];
    this._running = false;
    this._quality = 1;
    this._frameAcc = 0; this._frameCount = 0;
    this._paused = false;

    addEventListener('resize', () => this.resize(), { passive: true });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pause(); else this.resume();
    });
  }

  // Daylight by default — the Bereshit rig started every light at zero because
  // its story opens in the void. This one opens on a sunny afternoon.
  _setupBaseLights() {
    const amb = new THREE.AmbientLight(0x8fb4d8, 0.30);
    const hemi = new THREE.HemisphereLight(0x9fd0f0, 0x47682c, 0.55);
    const key = new THREE.DirectionalLight(0xfff3dc, 1.6);
    key.position.set(34, 48, 26);
    key.castShadow = !isMobile();
    if (key.shadow) {
      key.shadow.mapSize.set(2048, 2048);
      key.shadow.camera.near = 1;
      key.shadow.camera.far = 220;
      // the valley is ~140 across, so the film rig's +-34 box was far too tight
      const S = 72;
      key.shadow.camera.left = -S; key.shadow.camera.right = S;
      key.shadow.camera.top = S; key.shadow.camera.bottom = -S;
      key.shadow.bias = -0.0008; key.shadow.normalBias = 0.05;
    }
    const rim = new THREE.DirectionalLight(0x9fb8ff, 0.35);
    rim.position.set(-22, 14, -26);
    this.scene.add(amb, hemi, key, rim, key.target);
    this.lights = { amb, hemi, key, rim };
  }

  /** Keep the shadow box centred on the player or it wastes all its texels. */
  trackShadow(x, z) {
    const k = this.lights.key;
    if (!k || !k.castShadow) return;
    k.position.set(x + 34, 48, z + 26);
    k.target.position.set(x, 0, z);
    k.target.updateMatrixWorld();
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    this.renderer.setPixelRatio(dpr() * this._quality);
    this.renderer.setSize(w, h);
    this.composer.setSize(w, h);
    this.bloom.setSize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    setU(this.veilMat, 'uResolution', [w, h]);
  }

  onFrame(fn) {
    this._onFrame.push(fn);
    return () => { const i = this._onFrame.indexOf(fn); if (i >= 0) this._onFrame.splice(i, 1); };
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._last = performance.now();
    const loop = (now) => {
      this._raf = requestAnimationFrame(loop);
      let dt = (now - this._last) / 1000;
      this._last = now;
      if (dt > 0.1) dt = 0.1;
      if (this._paused) dt = 0;
      this.elapsed += dt;

      clock.update(dt);
      this.rig.update(dt);
      tickMaterials(this.elapsed);
      for (const f of this._onFrame) f(dt, this.elapsed);

      setU(this.veilMat, 'uTime', this.elapsed);
      setU(this.veilMat, 'uFade', this.veil.fade);
      setU(this.veilMat, 'uRipple', this.veil.ripple);
      setU(this.veilMat, 'uGrain', this.veil.grain);
      setU(this.veilMat, 'uVignette', this.veil.vignette);
      if (!this.hasVeilShader && this.veilMat.opacity !== undefined) this.veilMat.opacity = this.veil.fade;

      this.composer.render();
      if (this.veil.fade > 0.001 || this.veil.ripple > 0.001 || this.hasVeilShader) {
        const ac = this.renderer.autoClear;
        this.renderer.autoClear = false;
        this.renderer.clearDepth();
        this.renderer.render(this.veilScene, this.veilCam);
        this.renderer.autoClear = ac;
      }

      this._adaptQuality(dt);
    };
    this._raf = requestAnimationFrame(loop);
  }

  _adaptQuality(dt) {
    this._frameAcc += dt; this._frameCount++;
    if (this._frameAcc < 2) return;
    const avg = this._frameAcc / this._frameCount;
    this._frameAcc = 0; this._frameCount = 0;
    if (avg > 1 / 32 && this._quality > 0.6) { this._quality -= 0.12; this.resize(); }
    else if (avg < 1 / 55 && this._quality < 1) { this._quality = Math.min(1, this._quality + 0.08); this.resize(); }
  }

  /** Freeze gameplay without stopping the render loop (menus, dialogue). */
  setPaused(on) { this._paused = !!on; }

  pause() { if (this._raf) { cancelAnimationFrame(this._raf); this._raf = 0; this._running = false; } }
  resume() { if (!this._running) { this._last = performance.now(); this.start(); } }

  async fadeTo(v, dur = 1.5, easing = ease.inOutQuad) {
    const f0 = this.veil.fade;
    await clock.to(dur, e => { this.veil.fade = lerp(f0, v, e); }, easing);
  }
  async fadeOut(dur = 1.5) { return this.fadeTo(1, dur); }
  async fadeIn(dur = 2) { return this.fadeTo(0, dur); }

  async ripple(peak = 1, dur = 2.4) {
    await clock.to(dur, e => { this.veil.ripple = Math.sin(e * Math.PI) * peak; }, ease.linear);
    this.veil.ripple = 0;
  }

  setVeilColor(hex) { setU(this.veilMat, 'uColor', new THREE.Color(hex)); }

  flash(color = '#ffffff', dur = 0.9, peak = 1) {
    let el = document.querySelector('.flash');
    if (!el) { el = document.createElement('div'); el.className = 'flash'; document.body.appendChild(el); }
    el.style.background = color;
    el.style.transition = 'none';
    el.style.opacity = String(peak);
    requestAnimationFrame(() => {
      el.style.transition = `opacity ${dur}s cubic-bezier(.22,.61,.36,1)`;
      el.style.opacity = '0';
    });
  }

  async bloomTo(strength, radius, threshold, dur = 2) {
    const s0 = this.bloom.strength, r0 = this.bloom.radius, t0 = this.bloom.threshold;
    await clock.to(dur, e => {
      this.bloom.strength = lerp(s0, strength, e);
      if (radius != null) this.bloom.radius = lerp(r0, radius, e);
      if (threshold != null) this.bloom.threshold = lerp(t0, threshold, e);
    }, ease.inOutCubic);
  }

  async exposureTo(v, dur = 2) {
    const e0 = this.renderer.toneMappingExposure;
    await clock.to(dur, e => { this.renderer.toneMappingExposure = lerp(e0, v, e); }, ease.inOutCubic);
  }

  clearScene(keepLights = true) {
    const keep = keepLights ? new Set(Object.values(this.lights)) : new Set();
    if (keepLights && this.lights.key) keep.add(this.lights.key.target);
    for (let i = this.scene.children.length - 1; i >= 0; i--) {
      const o = this.scene.children[i];
      if (keep.has(o)) continue;
      this.scene.remove(o);
      disposeTree(o);
    }
    this.scene.fog = null;
  }
}

export function disposeTree(root) {
  root.traverse?.(o => {
    if (o.geometry) o.geometry.dispose?.();
    const m = o.material;
    if (Array.isArray(m)) m.forEach(x => x?.dispose?.());
    else m?.dispose?.();
  });
}
