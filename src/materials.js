// Bridges the plain-data shader library into live THREE.ShaderMaterials.
// Everything here is defensive: if a shader is missing or fails to compile the
// scene falls back to a plausible standard material rather than going black.

import * as THREE from 'three';

let SHADERS = {};
let loaded = false;

export async function initShaders() {
  try {
    const mod = await import('./shaders.js');
    SHADERS = mod.SHADERS || mod.default || {};
    loaded = true;
  } catch (err) {
    console.warn('[materials] shader library unavailable, using fallbacks', err);
    SHADERS = {};
  }
  return SHADERS;
}

export const hasShader = name => loaded && !!SHADERS[name];
export const shaderDesc = name => SHADERS[name];

const SIDES = { front: THREE.FrontSide, back: THREE.BackSide, double: THREE.DoubleSide };
const BLENDINGS = {
  normal: THREE.NormalBlending, additive: THREE.AdditiveBlending,
  subtractive: THREE.SubtractiveBlending, multiply: THREE.MultiplyBlending, none: THREE.NoBlending,
};
const resolveBlending = v =>
  (typeof v === 'string' ? BLENDINGS[v.toLowerCase()] : v) ?? undefined;

function toUniformValue(key, raw) {
  const v = raw && typeof raw === 'object' && 'value' in raw ? raw.value : raw;
  if (Array.isArray(v)) {
    if (v.length === 2) return new THREE.Vector2(v[0], v[1]);
    if (v.length === 3) {
      return /colou?r|tint|ink/i.test(key)
        ? new THREE.Color(v[0], v[1], v[2])
        : new THREE.Vector3(v[0], v[1], v[2]);
    }
    if (v.length === 4) return new THREE.Vector4(v[0], v[1], v[2], v[3]);
    return v.slice();
  }
  if (typeof v === 'string') return new THREE.Color(v);
  return v;
}

export function buildUniforms(name, overrides = {}) {
  const desc = SHADERS[name];
  const out = {};
  if (desc && desc.uniforms) {
    for (const k in desc.uniforms) out[k] = { value: toUniformValue(k, desc.uniforms[k]) };
  }
  for (const k in overrides) out[k] = { value: toUniformValue(k, overrides[k]) };
  return out;
}

/**
 * Make a ShaderMaterial from the library.
 * opts: { uniforms, transparent, depthWrite, depthTest, blending, side, fallback }
 */
export function makeMaterial(name, opts = {}) {
  const desc = SHADERS[name];
  if (!desc || !desc.vertexShader || !desc.fragmentShader) {
    return opts.fallback instanceof THREE.Material
      ? opts.fallback
      : new THREE.MeshStandardMaterial({
          color: opts.fallbackColor ?? 0x44423c,
          roughness: 0.9, metalness: 0.0,
          side: SIDES[opts.side ?? desc?.side] ?? THREE.FrontSide,
          transparent: !!opts.transparent,
        });
  }

  const mat = new THREE.ShaderMaterial({
    vertexShader: desc.vertexShader,
    fragmentShader: desc.fragmentShader,
    uniforms: buildUniforms(name, opts.uniforms),
    transparent: opts.transparent ?? desc.transparent ?? false,
    depthWrite: opts.depthWrite ?? desc.depthWrite ?? true,
    depthTest: opts.depthTest ?? true,
    side: SIDES[opts.side ?? desc.side] ?? THREE.FrontSide,
    blending: resolveBlending(opts.blending) ?? resolveBlending(desc.blending) ?? THREE.NormalBlending,
    toneMapped: opts.toneMapped ?? true,
  });
  // additive surfaces must not write depth or they punch holes in what follows
  if (mat.blending === THREE.AdditiveBlending && opts.depthWrite === undefined && desc.depthWrite === undefined) {
    mat.depthWrite = false;
    mat.transparent = true;
  }
  mat.userData.shaderName = name;
  return mat;
}

/** Safe uniform write — silently ignores unknown names. */
export function setU(mat, key, value) {
  const u = mat && mat.uniforms && mat.uniforms[key];
  if (!u) return;
  const cur = u.value;
  if (cur && cur.isColor) {
    if (value && value.isColor) cur.copy(value);
    else if (Array.isArray(value)) cur.setRGB(value[0], value[1], value[2]);
    else cur.set(value);
  } else if (cur && cur.isVector3) {
    if (Array.isArray(value)) cur.set(value[0], value[1], value[2]); else cur.copy(value);
  } else if (cur && cur.isVector2) {
    if (Array.isArray(value)) cur.set(value[0], value[1]); else cur.copy(value);
  } else if (cur && cur.isVector4) {
    if (Array.isArray(value)) cur.set(value[0], value[1], value[2], value[3]); else cur.copy(value);
  } else {
    u.value = value;
  }
}

export function getU(mat, key) {
  return mat && mat.uniforms && mat.uniforms[key] ? mat.uniforms[key].value : undefined;
}

/** Registry of materials that want a uTime uniform ticked every frame. */
const timed = new Set();
export function animate(mat) { if (mat && mat.uniforms && mat.uniforms.uTime) timed.add(mat); return mat; }
export function unanimate(mat) { timed.delete(mat); }
export function tickMaterials(t) { for (const m of timed) m.uniforms.uTime.value = t; }
export function clearTimed() { timed.clear(); }
