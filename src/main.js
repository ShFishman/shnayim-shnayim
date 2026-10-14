// main.js — boot, the run of play, and the ending.

import * as THREE from 'three';
import { initShaders, setU } from './materials.js';
import { clock, clamp, lerp, smoothstep, ease, makeRng, isMobile } from './utils.js';
import T from './content.js';

const canvas = document.getElementById('stage');
const boot = document.getElementById('boot');
const bootNote = document.getElementById('boot-note');
const gate = document.getElementById('gate');

// Shaders must be loaded before anything builds a material, or every surface
// silently falls back to grey standard material.
bootNote.textContent = 'טוען…';
await initShaders();

const { Engine } = await import('./engine.js');
const { Terrain, Ocean, Sky, Rain, VALLEY } = await import('./world.js');
const { Ark, ARK } = await import('./ark.js');
const { Noah, Input } = await import('./player.js');
const { Herd, HERD_LIMIT, CALL_RADIUS } = await import('./animals.js');
const { Animal } = await import('./fauna.js');
const { Crowd } = await import('./villagers.js');
const { HUD } = await import('./hud.js');
const { Grove } = await import('./flora.js');
const { Audio } = await import('./audio.js');

/* ───────────────────────── timeline ─────────────────────────
 * Seconds from the first step. Water is a curve, not a line: almost nothing
 * happens for the first minute, then it runs away from you.
 */
const RUN = 390;                 // seconds of play before the ark lifts
const PHASES = [
  { id: 'calm',  at: 0 },
  { id: 'cloud', at: 55 },
  { id: 'first', at: 115 },
  { id: 'rain',  at: 175 },
  { id: 'flood', at: 250 },
  { id: 'lift',  at: RUN },
];
const WATER_LOW = -12;
const WATER_HIGH = 12;

function waterAt(t) {
  const u = clamp(t / RUN, 0, 1);
  // Gentle exponent: the valley floor goes under around t=265 of 390, so two
  // thirds of the run is dry and the last two minutes are the panic.
  return lerp(WATER_LOW, WATER_HIGH, Math.pow(u, 1.8));
}

function stormAt(t) {
  return clamp((t - 55) / (RUN - 90), 0, 1);
}

function rainAt(t) {
  if (t < 110) return 0;
  if (t < 175) return clamp((t - 110) / 65, 0, 1) * 0.3;
  return clamp(0.3 + (t - 175) / 150, 0, 1);
}

/* ───────────────────────── build ───────────────────────── */

bootNote.textContent = 'בונה את העולם…';

const engine = new Engine(canvas);
engine.scene.fog = new THREE.Fog(0xbfd9ec, 150, 380);

const terrain = new Terrain({ seed: 1771 });
engine.scene.add(terrain.mesh);

const ocean = new Ocean({ level: WATER_LOW });
engine.scene.add(ocean.mesh);

const sky = new Sky();
engine.scene.add(sky.group);

// Rain sprites are alpha-blended and overlap heavily; past ~6k the cost is
// all overdraw for no visible gain.
const rain = new Rain({ count: isMobile() ? 2600 : 6000 });
engine.scene.add(rain.points);

const SUN = new THREE.Vector3(0.35, 0.55, -0.75).normalize();
const sunArr = [SUN.x, SUN.y, SUN.z];
sky.setSun(SUN);
terrain.setSun(sunArr);
ocean.setSun(sunArr);

const ark = new Ark({ terrain });
engine.scene.add(ark.group);
ark.setSun(sunArr);
ark.setDoor(1);

// trees, on the ground, out of the play area and off the cliffs
bootNote.textContent = 'נוטע עצים…';
{
  const rng = makeRng(2024);
  const placements = [];
  for (let i = 0; i < (isMobile() ? 70 : 140); i++) {
    const a = rng.range(0, 6.2832);
    const r = rng.range(27, 80);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (terrain.slopeAt(x, z) > 0.40) continue;
    if (Math.abs(x) < 7 && z > 8 && z < 34) continue;   // keep the ramp approach clear
    const y = terrain.heightAt(x, z);
    if (y < -0.5) continue;
    placements.push({ x, y, z, scale: rng.range(0.55, 0.95), rot: rng.range(0, 6.28), species: i % 4 });
  }
  const grove = new Grove({
    placements, leafA: 0x35702c, leafB: 0x7fba45, bark: 0x53391f, canopy: 1.75,
  });
  grove.setLight(SUN);
  engine.scene.add(grove.object);
  window.__grove = grove;
}

bootNote.textContent = 'אוסף חיות…';
const herd = new Herd({ terrain, ark, scene: engine.scene, seed: 909 });
const crowd = new Crowd({ terrain, scene: engine.scene, seed: 404, count: T.villagers.length });

const noah = new Noah();
noah.pos.set(5, 0, 22);
noah.pos.y = terrain.heightAt(noah.pos.x, noah.pos.z);
engine.scene.add(noah.group);
herd.setPlayer(noah);

const hud = new HUD();
const audio = new Audio();
const input = new Input(canvas);

// the boom must clear the sea as well as the ground, or the endgame is
// played from inside the water
let waterNow = WATER_LOW;
engine.rig.groundFn = (x, z) => Math.max(terrain.heightAt(x, z), waterNow + 0.9);
noah.group.scale.setScalar(1.3);
engine.rig.follow(noah, { dist: 10, height: 2.3, pitch: 0.30 });
engine.rig.yaw = 0;
engine.rig.snap([5, 8, 34], [5, 2, 22]);

/* The ark is solid. Approximate it as an ellipse, but leave the ramp mouth
 * open or you cannot deliver anything. */
function blocked(x, z) {
  const dx = x - ARK.x;
  const dz = z - ARK.z;
  const inRamp = Math.abs(dx) < 3.4 && dz > ARK.halfWidth * 0.5;
  if (inRamp) return false;
  const a = ARK.len * 0.5 + 0.6;
  const b = ARK.halfWidth + 0.6;
  return (dx * dx) / (a * a) + (dz * dz) / (b * b) < 1;
}

/* ───────────────────────── state ───────────────────────── */

/* ?skip=1 jumps the opening, ?t=250 starts the clock partway in. Both exist
 * for testing the late game without playing six minutes to reach it. */
const QS = new URLSearchParams(location.search);

const G = {
  started: false,
  over: false,
  t: Math.max(0, Number(QS.get('t')) || 0),
  skipIntro: QS.has('skip'),
  phase: -1,
  shofarCd: 0,
  shofarMax: 1.15,
  believed: 0,
  paused: false,
  tipT: 8,
  tipI: 0,
  secretTeased: false,
};

const SHOFAR_RANGE = () => CALL_RADIUS + crowd.convincedCount * 2.2;

/* ───────────────────────── input wiring ───────────────────────── */

const btnSound = document.getElementById('btn-sound');
const btnLang = document.getElementById('btn-lang');
const btnFull = document.getElementById('btn-full');
const btnHelp = document.getElementById('btn-help');

btnSound.addEventListener('click', () => {
  const m = !audio.muted;
  audio.setMuted(m);
  btnSound.classList.toggle('off', m);
});
btnLang.addEventListener('click', () => {
  hud.setLang(!hud.showEn);
  btnLang.textContent = hud.showEn ? 'עב' : 'EN';
});
btnFull.addEventListener('click', () => {
  if (document.fullscreenElement) document.exitFullscreen?.();
  else document.documentElement.requestFullscreen?.();
});
btnHelp.addEventListener('click', () => togglePause());

function togglePause() {
  G.paused = !G.paused;
  engine.setPaused(G.paused);
  hud.setPaused(G.paused);
}

document.getElementById('pause-resume').addEventListener('click', togglePause);
document.getElementById('end-again').addEventListener('click', () => location.reload());

// touch controls
if (isMobile()) document.body.classList.add('touch');
setupTouch();

/* ───────────────────────── boot done ───────────────────────── */

boot.classList.add('gone');
gate.classList.add('in');

document.getElementById('gate-begin').addEventListener('click', async () => {
  gate.classList.remove('in');
  await audio.start();
  audio.setMusic(0.5, 0);
  engine.start();
  await playIntro();
  beginRun();
}, { once: true });

async function playIntro() {
  hud.setHudVisible(false);
  engine.rig.free();
  engine.rig.snap([0, 9, 40], [0, 3, 10]);
  engine.rig.moveTo([14, 7, 30], [0, 3, 2], 11, ease.inOutQuad);

  for (const v of T.intro) {
    if (G.skipIntro) break;
    await hud.verse(v, (v.dwell ?? 4000) / 1000);
  }
  hud.hideVerse();
}

function beginRun() {
  G.started = true;
  hud.setHudVisible(true);
  engine.rig.follow(noah, { dist: 10, height: 2.3, pitch: 0.30 });
  engine.rig.yaw = 0;
  setPhase(0);
  hud.toast(T.tips[0], { dur: 5 });
}

// let a click skip the opening
addEventListener('pointerdown', () => { if (!G.started) G.skipIntro = true; });
addEventListener('keydown', e => {
  if (e.code === 'Escape' && G.started && !G.over) togglePause();
  if (!G.started) G.skipIntro = true;
});

/* ───────────────────────── phases ───────────────────────── */

function setPhase(i) {
  if (i <= G.phase) return;
  G.phase = i;
  const p = PHASES[i];
  const text = T.phases.find(x => x.id === p.id) || T.phases[0];
  hud.setPhase(text);
  const shout = T.phaseShout[p.id];
  if (shout) hud.toast(shout, { dur: 4.2, kind: 'phase' });

  if (p.id === 'first') audio.thunder(0.85);
  if (p.id === 'rain') { audio.thunder(0.6); engine.rig.shake(0.25, 2); }
  if (p.id === 'flood') { audio.thunder(0.1); engine.rig.shake(0.7, 1.4); }
}

/* A handle for debugging from the console: window.__game.ocean.mesh.position
 * and friends. Harmless in production and very useful when something in the
 * scene is not where you think it is. */
window.__game = { THREE, RaycasterCtor: THREE.Raycaster,
                  engine, terrain, ocean, sky, rain, ark, herd, crowd, noah, hud, audio, G,
                  waterAt, stormAt, rainAt, RUN, WATER_LOW, WATER_HIGH };

/* ───────────────────────── frame ───────────────────────── */

const tmpV = new THREE.Vector3();

engine.onFrame((dt, elapsed) => {
  hud.update(dt);

  if (!G.started || G.paused) { ocean.recentre(noah.pos.x, noah.pos.z); return; }

  if (!G.over) G.t += dt;

  // ── world state from the clock ──
  const storm = stormAt(G.t);
  const water = waterAt(G.t);
  waterNow = water;
  ocean.setLevel(water);
  ocean.setStorm(storm);
  sky.setStorm(storm);
  terrain.setWaterLevel(water);
  terrain.setDrown(storm * 0.8);
  const rainLevel = rainAt(G.t);
  rain.setIntensity(rainLevel);
  ark.setWet(rainLevel);
  audio.setRain(rainLevel);
  audio.setMusic(0.5 + storm * 0.4, storm);
  engine.lights.key.intensity = lerp(2.1, 0.35, storm);
  engine.lights.hemi.intensity = lerp(0.85, 0.42, storm);
  engine.lights.amb.intensity = lerp(0.55, 0.40, storm);
  if (engine.scene.fog) {
    engine.scene.fog.near = lerp(150, 34, storm);
    engine.scene.fog.far = lerp(380, 155, storm);
    engine.scene.fog.color.setRGB(
      lerp(0.546, 0.044, storm), lerp(0.768, 0.058, storm), lerp(0.888, 0.080, storm));
    engine.scene.background.copy(engine.scene.fog.color);
  }

  // random thunder once it is properly raining
  if (rainLevel > 0.35 && Math.random() < dt * 0.14) audio.thunder(Math.random());

  // advance phase
  for (let i = PHASES.length - 1; i >= 0; i--) {
    if (G.t >= PHASES[i].at) { setPhase(i); break; }
  }

  // ── player ──
  if (!G.over) {
    const [ddx, ddy] = input.takeDrag();
    if (ddx || ddy) engine.rig.orbit(ddx, ddy);
    const w = input.takeWheel();
    if (w) engine.rig.zoomBy(w * 1.3);

    const ax = input.axes();
    const yaw = engine.rig.yaw;
    // camera forward on the ground plane, and its right-hand perpendicular
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    const rx = -Math.cos(yaw), rz = Math.sin(yaw);
    const mx = fx * ax.y + rx * ax.x;
    const mz = fz * ax.y + rz * ax.x;

    noah.update(dt, { x: mx, z: mz, run: ax.run }, terrain, { waterLevel: water, blocked });

    // shofar
    G.shofarCd = Math.max(0, G.shofarCd - dt);
    hud.setShofar(1 - G.shofarCd / G.shofarMax);
    if (input.pressed('Space') && G.shofarCd <= 0) {
      G.shofarCd = G.shofarMax;
      noah.blow(0.8);
      audio.shofar();
      const n = herd.call(noah.pos.x, noah.pos.z, SHOFAR_RANGE());
      if (n > 0) for (let i = 0; i < n; i++) setTimeout(() => audio.honk('call' + i), 220 + i * 110);
    }

    // talk
    const near = crowd.nearest(noah.pos.x, noah.pos.z, 4.4);
    hud.setPrompt(!!near && !G.over, near ? { he: 'E — לְדַבֵּר', en: 'E — Talk' } : null);
    if (near && input.pressed('KeyE')) {
      const line = near.nextLine();
      hud.speak(near.data.name, line);
      audio.blip();
      if (line.justConvinced) {
        G.believed++;
        audio.chime(true);
        setTimeout(() => hud.toast(T.believed, { dur: 4.5, kind: 'good' }), 2200);
      }
    }
  }

  // ── world actors ──
  const ctx = { waterLevel: water, ark, player: noah };
  herd.update(dt, ctx);
  crowd.update(dt, ctx);
  // It floats as soon as the water reaches the keel. Holding it down until
  // the finale looked dramatic on paper and looked like a sunk boat on screen.
  ark.allowFloat = true;
  ark.update(dt, elapsed, water);

  // ── herd events → HUD ──
  for (const ev of herd.drainEvents()) {
    switch (ev.type) {
      case 'called': hud.toast(T.herd.called, { dur: 2.2 }); break;
      case 'full': hud.toast(T.herd.full, { dur: 2.6, kind: 'warn' }); audio.buzz(); break;
      case 'single': hud.toast(T.herd.lonely, { dur: 2.8 }); audio.blip(); break;
      case 'same-sex': hud.toast(T.herd.sameSex, { dur: 4.0, kind: 'warn' }); audio.buzz(); break;
      case 'extra-aboard': audio.honk(ev.key); break;
      case 'secret-called': if (!G.secretTeased) { G.secretTeased = true; hud.toast(T.secret.tease, { dur: 4 }); } break;
      case 'secret-aboard': hud.toast(T.secret.line, { dur: 5.5, kind: 'good' }); audio.chime(true); break;
      case 'pair': {
        const s = T.species.find(x => x.key === ev.key);
        if (s) hud.toast(s.line, { dur: 5.0, kind: 'good' });
        audio.chime(true);
        audio.honk(ev.key, ev.key === 'pil' || ev.key === 'hipo');
        break;
      }
    }
  }

  hud.setManifest(herd.manifest);
  hud.setPairs(herd.pairsComplete, herd.totalPairs);
  hud.setWater(clamp((water - WATER_LOW) / (WATER_HIGH - WATER_LOW), 0, 1));

  // ── nudge toward the nearest animal you still need ──
  const nl = herd.nearestLoose(noah.pos.x, noah.pos.z);
  if (nl && nl.dist > 16) {
    tmpV.copy(nl.critter.object.position);
    tmpV.y += 2.2;
    tmpV.project(engine.camera);
    const onScreen = tmpV.z < 1 && Math.abs(tmpV.x) < 0.92 && Math.abs(tmpV.y) < 0.92;
    if (!onScreen) {
      const ang = Math.atan2(tmpV.y, tmpV.x);
      const m = 0.84;
      let sx = tmpV.x, sy = tmpV.y;
      if (tmpV.z > 1) { sx = -sx; sy = -sy; }
      const k = m / Math.max(Math.abs(sx), Math.abs(sy), 1e-4);
      sx *= k; sy *= k;
      hud.setMarker({
        x: (sx * 0.5 + 0.5) * innerWidth,
        y: (-sy * 0.5 + 0.5) * innerHeight,
        angle: -Math.atan2(sy, sx),
      }, true, nl.dist);
    } else hud.setMarker(null, false);
  } else hud.setMarker(null, false);

  // ── rolling tips ──
  G.tipT -= dt;
  if (G.tipT <= 0 && G.t < 200) {
    G.tipT = 26;
    G.tipI = (G.tipI + 1) % T.tips.length;
    if (G.tipI > 0) hud.toast(T.tips[G.tipI], { dur: 5 });
  }

  // ── follow bits ──
  ocean.recentre(noah.pos.x, noah.pos.z);
  sky.recentre(engine.camera.position.x, engine.camera.position.z);
  rain.update(engine.camera.position);
  engine.trackShadow(noah.pos.x, noah.pos.z);

  // ── the end ──
  if (!G.over && G.t >= RUN) finish();
});

/* ───────────────────────── ending ───────────────────────── */

async function finish() {
  G.over = true;
  hud.setPrompt(false);
  hud.setMarker(null, false);
  ark.setDoor(0);

  const pairs = herd.pairsComplete;
  const total = herd.totalPairs;
  const grade = pairs >= total ? 'perfect' : pairs >= Math.ceil(total * 0.55) ? 'good' : 'poor';

  // if the unicorn is still in the line when the door shuts, it misses it
  const uniInLine = herd.line.includes(herd.unicorn);
  const uniAboard = !!herd.secretAboard;

  engine.rig.free();
  const p = noah.group.position;
  engine.rig.snap([p.x + 10, p.y + 7, p.z + 16], [ARK.x, 6, ARK.z]);
  engine.rig.moveTo([26, 24, 52], [0, 10, 0], 13, ease.inOutQuad);

  audio.setMusic(0.75, 0.2);
  audio.chime(true);

  await clock.wait(2.2);
  if (!uniAboard && uniInLine) {
    hud.toast(T.secret.missed, { dur: 6.5, kind: 'warn' });
    await clock.wait(6.5);
  }

  for (const v of T.outro) await hud.verse(v, (v.dwell ?? 4200) / 1000);

  // send the dove out of the window
  audio.wings(11);
  audio.setRain(0);
  releaseDove();
  await clock.wait(2.6);

  hud.setHudVisible(false);
  hud.showEnding({
    grade, pairs, totalPairs: total,
    animals: herd.aboardCount,
    believed: G.believed,
    secret: uniAboard,
    timeLeft: 0,
  });
}

/* ───────────────────────── the dove ─────────────────────────
 * Not a herd member: it is released from the window at the end and simply
 * flies, so it needs none of the herding machinery.
 */

function releaseDove() {
  const dove = new Animal('yonah', { seed: 77, scale: 1.25 });
  const start = ark.group.position;
  dove.placeAt(start.x - 4, start.z + 4);
  dove.object.position.set(start.x - 4, start.y + 10.5, start.z + 4);
  dove.flying = true;
  dove.flyHeight = 10.5;
  engine.scene.add(dove.object);

  let t = 0;
  const stop = engine.onFrame((dt) => {
    t += dt;
    // a wide rising spiral away from the ark
    const r = 9 + t * 5.5;
    const a = t * 0.85;
    dove.pos.set(start.x + Math.cos(a) * r, 0, start.z + Math.sin(a) * r);
    dove.heading = a + Math.PI / 2;
    dove.speed = 4;
    dove._wp = null;
    dove.object.position.set(dove.pos.x, start.y + 10.5 + t * 2.4, dove.pos.z);
    dove.object.rotation.y = dove.heading;
    dove.object.rotation.z = Math.sin(t * 2.2) * 0.22;
    // keep the wings beating: Animal only flaps while it believes it is flying
    dove.flying = true;
    dove.flyHeight = dove.object.position.y;
    dove.update(dt);
    dove.object.position.set(dove.pos.x, start.y + 10.5 + t * 2.4, dove.pos.z);
    if (t > 14) { stop(); engine.scene.remove(dove.object); dove.dispose(); }
  });
}

/* ───────────────────────── touch ───────────────────────── */

function setupTouch() {
  const stick = document.getElementById('stick');
  const knob = document.getElementById('stick-knob');
  const btnShofar = document.getElementById('btn-shofar');
  const btnTalk = document.getElementById('btn-talk');
  if (!stick) return;

  let id = null, cx = 0, cy = 0;
  const R = 54;

  stick.addEventListener('pointerdown', e => {
    id = e.pointerId;
    const r = stick.getBoundingClientRect();
    cx = r.left + r.width / 2; cy = r.top + r.height / 2;
    input.stick.active = true;
    stick.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  stick.addEventListener('pointermove', e => {
    if (e.pointerId !== id) return;
    let dx = e.clientX - cx, dy = e.clientY - cy;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx = dx / d * R; dy = dy / d * R; }
    knob.style.transform = `translate(${dx}px,${dy}px)`;
    input.stick.x = dx / R;
    input.stick.y = dy / R;
    input.stick.run = d > R * 0.78;
  });
  const up = e => {
    if (e.pointerId !== id) return;
    id = null;
    knob.style.transform = 'translate(0,0)';
    input.stick.x = input.stick.y = 0;
    input.stick.active = false;
    input.stick.run = false;
  };
  stick.addEventListener('pointerup', up);
  stick.addEventListener('pointercancel', up);

  btnShofar.addEventListener('click', () => { input._pressed.add('Space'); });
  btnTalk.addEventListener('click', () => { input._pressed.add('KeyE'); });
}
