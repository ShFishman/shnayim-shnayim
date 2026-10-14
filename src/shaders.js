/**
 * shaders.js — the procedural look of שניים שניים / Two by Two.
 *
 * Plain data only: every export is a string or a JSON-ish object. No imports,
 * no three.js. materials.js turns the `uniforms` arrays into Vector2/Vector3/
 * Color and the descriptor flags into ShaderMaterial options.
 *
 * Written for THREE.ShaderMaterial (NOT RawShaderMaterial):
 *   - three injects projectionMatrix / modelViewMatrix / modelMatrix /
 *     viewMatrix / normalMatrix / cameraPosition and the attributes
 *     position / normal / uv. None of them are redeclared here.
 *   - GLSL1 source (varying / gl_FragColor). three handles GLSL3 translation.
 *   - no #version, no precision statement, no layout qualifiers.
 *
 * Every fragment stage that needs it has NOISE_CHUNK concatenated in front,
 * so each shader string compiles standalone.
 *
 * FIRMAMENT, WATER, VEIL and NOISE_CHUNK are carried over from the Bereshit
 * engine. GROUND, RAIN, CLOUDS and WOOD are new for the Flood.
 */

/* ------------------------------------------------------------------ *
 * Shared procedural toolkit.
 * Cost notes: gnoise3 = 8 hash33, vnoise3 = 8 hash13. The fbm helpers
 * are fixed-octave so every loop bound is a compile-time constant.
 * ------------------------------------------------------------------ */
export const NOISE_CHUNK = `
/* guarded: three's injected chunks may already define these, and redefining
   a macro with a different body is a compile error */
#ifndef TAU
#define TAU 6.28318530718
#endif
#ifndef PI
#define PI 3.141592653589793
#endif

float hash11(float p){
  p = fract(p * 0.1031);
  p *= p + 33.33;
  p *= p + p;
  return fract(p);
}
float hash12(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}
float hash13(vec3 p){
  vec3 p3 = fract(p * 0.1031);
  p3 += dot(p3, p3.zyx + 31.32);
  return fract((p3.x + p3.y) * p3.z);
}
vec2 hash22(vec2 p){
  vec3 p3 = fract(vec3(p.xyx) * vec3(0.1031, 0.1030, 0.0973));
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.xx + p3.yz) * p3.zy);
}
vec3 hash33(vec3 p){
  p = fract(p * vec3(0.1031, 0.1030, 0.0973));
  p += dot(p, p.yxz + 33.33);
  return fract((p.xxy + p.yxx) * p.zyx);
}

/* smootherstep weights */
vec3 quintic3(vec3 f){ return f * f * f * (f * (f * 6.0 - 15.0) + 10.0); }
vec2 quintic2(vec2 f){ return f * f * f * (f * (f * 6.0 - 15.0) + 10.0); }

/* --- value noise, 0..1 --- */
float vnoise3(vec3 p){
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 w = quintic3(f);
  float n000 = hash13(i + vec3(0.0, 0.0, 0.0));
  float n100 = hash13(i + vec3(1.0, 0.0, 0.0));
  float n010 = hash13(i + vec3(0.0, 1.0, 0.0));
  float n110 = hash13(i + vec3(1.0, 1.0, 0.0));
  float n001 = hash13(i + vec3(0.0, 0.0, 1.0));
  float n101 = hash13(i + vec3(1.0, 0.0, 1.0));
  float n011 = hash13(i + vec3(0.0, 1.0, 1.0));
  float n111 = hash13(i + vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(n000, n100, w.x), mix(n010, n110, w.x), w.y),
             mix(mix(n001, n101, w.x), mix(n011, n111, w.x), w.y), w.z);
}
float vnoise2(vec2 p){
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 w = quintic2(f);
  float a = hash12(i + vec2(0.0, 0.0));
  float b = hash12(i + vec2(1.0, 0.0));
  float c = hash12(i + vec2(0.0, 1.0));
  float d = hash12(i + vec2(1.0, 1.0));
  return mix(mix(a, b, w.x), mix(c, d, w.x), w.y);
}

/* --- gradient noise, roughly -1..1, simplex-ish in character --- */
float gdot3(vec3 i, vec3 f){
  vec3 g = normalize(hash33(i) * 2.0 - 1.0);
  return dot(g, f);
}
float gnoise3(vec3 p){
  vec3 i = floor(p);
  vec3 f = fract(p);
  vec3 w = quintic3(f);
  float n000 = gdot3(i + vec3(0.0, 0.0, 0.0), f - vec3(0.0, 0.0, 0.0));
  float n100 = gdot3(i + vec3(1.0, 0.0, 0.0), f - vec3(1.0, 0.0, 0.0));
  float n010 = gdot3(i + vec3(0.0, 1.0, 0.0), f - vec3(0.0, 1.0, 0.0));
  float n110 = gdot3(i + vec3(1.0, 1.0, 0.0), f - vec3(1.0, 1.0, 0.0));
  float n001 = gdot3(i + vec3(0.0, 0.0, 1.0), f - vec3(0.0, 0.0, 1.0));
  float n101 = gdot3(i + vec3(1.0, 0.0, 1.0), f - vec3(1.0, 0.0, 1.0));
  float n011 = gdot3(i + vec3(0.0, 1.0, 1.0), f - vec3(0.0, 1.0, 1.0));
  float n111 = gdot3(i + vec3(1.0, 1.0, 1.0), f - vec3(1.0, 1.0, 1.0));
  return mix(mix(mix(n000, n100, w.x), mix(n010, n110, w.x), w.y),
             mix(mix(n001, n101, w.x), mix(n011, n111, w.x), w.y), w.z) * 1.35;
}

/* --- fbm. value variants return 0..1, gradient variants return about -1..1 --- */
float vfbm3(vec3 p){
  float s = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < 3; i++){
    s += a * vnoise3(p);
    n += a;
    p = p * 2.03 + vec3(7.3, 11.1, 3.7);
    a *= 0.5;
  }
  return s / max(n, 0.0001);
}
float vfbm4(vec3 p){
  float s = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < 4; i++){
    s += a * vnoise3(p);
    n += a;
    p = p * 2.03 + vec3(7.3, 11.1, 3.7);
    a *= 0.5;
  }
  return s / max(n, 0.0001);
}
float fbm3(vec3 p){
  float s = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < 3; i++){
    s += a * gnoise3(p);
    n += a;
    p = p * 2.07 + vec3(11.7, 3.1, 7.3);
    a *= 0.5;
  }
  return s / max(n, 0.0001);
}
float fbm4(vec3 p){
  float s = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < 4; i++){
    s += a * gnoise3(p);
    n += a;
    p = p * 2.07 + vec3(11.7, 3.1, 7.3);
    a *= 0.5;
  }
  return s / max(n, 0.0001);
}
float fbm5(vec3 p){
  float s = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < 5; i++){
    s += a * gnoise3(p);
    n += a;
    p = p * 2.07 + vec3(11.7, 3.1, 7.3);
    a *= 0.5;
  }
  return s / max(n, 0.0001);
}
float vfbm2(vec2 p){
  float s = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < 4; i++){
    s += a * vnoise2(p);
    n += a;
    p = p * 2.11 + vec2(5.7, 9.3);
    a *= 0.5;
  }
  return s / max(n, 0.0001);
}

/* ridged multifractal, 0..1 — the vein / filament former */
float ridged3(vec3 p){
  float s = 0.0, a = 0.5, n = 0.0;
  for (int i = 0; i < 4; i++){
    float v = 1.0 - abs(gnoise3(p));
    v *= v;
    s += a * v;
    n += a;
    p = p * 2.13 + vec3(3.3, 1.7, 9.2);
    a *= 0.55;
  }
  return s / max(n, 0.0001);
}

/* domain warp: feed fbm back into its own coordinates */
vec3 warp3(vec3 p, float amt){
  vec3 q = vec3(
    vfbm3(p),
    vfbm3(p + vec3(5.2, 1.3, 4.7)),
    vfbm3(p + vec3(9.1, 7.7, 2.3))
  );
  return p + amt * (q * 2.0 - 1.0);
}

mat2 rot2(float a){ float c = cos(a), s = sin(a); return mat2(c, -s, s, c); }
float luma(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }

/* ~1/255 of hash noise: kills 8-bit banding in big smooth gradients */
float ditherMask(vec2 fragXY){
  float h = hash12(fragXY + vec2(0.37, 0.71));
  return (h - 0.5) * 0.0039;
}
float saturate1(float x){ return clamp(x, 0.0, 1.0); }
vec3 saturate3(vec3 x){ return clamp(x, vec3(0.0), vec3(1.0)); }
`;


/* ================================================================== *
 * 2. FIRMAMENT — the sky dome. Pre-dawn to day to dusk to night.
 * ================================================================== */

const FIRMAMENT_VERT = `
varying vec3 vWorldDir;
varying vec2 vUv;

void main(){
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  /* world-space direction: stars are anchored to the world, so they do not
     swim when the camera turns */
  vWorldDir = wp.xyz - cameraPosition;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FIRMAMENT_FRAG = NOISE_CHUNK + `
uniform float uTime;
uniform vec3  uSunDir;
uniform vec3  uMoonDir;
uniform float uDayNight;
uniform float uStars;
uniform float uHaze;
uniform vec3  uTopColor;
uniform vec3  uHorizonColor;
uniform vec3  uNightColor;

varying vec3 vWorldDir;
varying vec2 vUv;

/* stable cube-face parameterisation of a direction: gives the star field a
   seam-free 2D lattice with no poles and no 27-cell neighbourhood loop */
vec2 cubeDirUV(vec3 d, out float face){
  vec3 a = abs(d);
  if (a.x >= a.y && a.x >= a.z){
    face = d.x > 0.0 ? 0.0 : 1.0;
    return vec2(d.z, d.y) / max(a.x, 0.00001);
  }
  if (a.y >= a.z){
    face = d.y > 0.0 ? 2.0 : 3.0;
    return vec2(d.x, d.z) / max(a.y, 0.00001);
  }
  face = d.z > 0.0 ? 4.0 : 5.0;
  return vec2(d.x, d.y) / max(a.z, 0.00001);
}

/* one lattice of stars. jitter is kept inside the cell so no neighbour
   lookup is needed — cheap enough to stack three times */
vec3 starLayer(vec3 d, float density, float radius, float seed, float cutoff){
  float face;
  vec2 c = cubeDirUV(d, face);
  vec2 g = c * density;
  vec2 cell = floor(g);
  vec2 f = fract(g);

  vec2 key = cell + vec2(face * 37.0 + seed, face * 11.0 - seed);
  float pick = hash12(key);
  if (pick < cutoff) return vec3(0.0);

  vec2 jitter = hash22(key + 3.17);
  vec2 center = vec2(0.3) + 0.4 * jitter;
  float dist = length(f - center);

  float mag = hash12(key + 9.71);
  /* radius is in cell fractions. kept above roughly a pixel at 1080p so the
     discs do not shimmer, and the halo is clamped to the jitter margin so it
     can never clip against the cell border and read as a square */
  float r = radius * (0.45 + 0.85 * mag * mag);
  float core = smoothstep(r, 0.0, dist);
  float glow = smoothstep(min(r * 3.0, 0.29), 0.0, dist) * 0.16;

  /* twinkle: two detuned oscillators so it never reads as a sine */
  float ph = jitter.x * TAU;
  float tw = 0.62
           + 0.26 * sin(uTime * (1.1 + 2.6 * jitter.y) + ph)
           + 0.12 * sin(uTime * (3.7 + 1.9 * mag) + ph * 2.3);

  /* spectral class: cool blue-white through warm amber */
  vec3 tint = mix(vec3(0.72, 0.82, 1.0), vec3(1.0, 0.86, 0.66), jitter.y);
  return tint * (core * tw + glow) * (0.35 + 0.95 * mag);
}

void main(){
  vec3 dir = normalize(vWorldDir);
  vec3 sunN = normalize(uSunDir);
  vec3 moonN = normalize(uMoonDir);
  float up = clamp(dir.y, -1.0, 1.0);
  float day = clamp(uDayNight, 0.0, 1.0);

  /* ---- daylight gradient -------------------------------------- */
  float zen = pow(clamp(up * 0.5 + 0.5, 0.0, 1.0), 0.65);
  float hazeBand = exp(-max(up, 0.0) * mix(7.0, 2.4, clamp(uHaze, 0.0, 1.0)));
  vec3 daySky = mix(uTopColor, uHorizonColor, clamp(hazeBand, 0.0, 1.0));
  daySky = mix(daySky, uTopColor, zen * 0.35);

  /* ---- night gradient ----------------------------------------- */
  vec3 nightSky = mix(uNightColor * 1.5, uNightColor * 0.55, zen);
  nightSky = mix(nightSky, uNightColor * vec3(1.25, 1.1, 1.0), hazeBand * 0.5);

  /* ---- stars, milky band, both anchored to world direction ----- */
  float band = 1.0 - abs(dot(dir, normalize(vec3(0.33, 0.78, -0.53))));
  float milkyShape = smoothstep(0.78, 1.0, band);
  float milkyN = vfbm4(dir * 5.5 + 13.0) * 0.5 + 0.5 * vfbm3(dir * 14.0);
  vec3 milky = vec3(0.30, 0.33, 0.44) * milkyShape * milkyShape * (0.25 + 0.95 * milkyN) * 0.55;

  vec3 stars = vec3(0.0);
  stars += starLayer(dir, 120.0, 0.14, 0.0, 0.86);
  stars += starLayer(dir, 260.0, 0.16, 17.0, 0.90) * 0.75;
  stars += starLayer(dir, 520.0, 0.19, 53.0, 0.945) * 0.5;
  /* the galactic band is crowded with faint stars */
  stars += starLayer(dir, 700.0, 0.21, 91.0, 0.962) * milkyShape * 1.4;

  float horizonCull = smoothstep(-0.07, 0.12, up);
  float starVis = clamp(uStars, 0.0, 1.0) * horizonCull;
  nightSky += (stars * 1.35 + milky) * starVis;

  /* ---- moon: disc plus soft crescent terminator ---------------- */
  float moonAng = acos(clamp(dot(dir, moonN), -1.0, 1.0));
  float moonR = 0.045;
  vec3 mUpRef = abs(moonN.y) > 0.95 ? vec3(1.0, 0.0, 0.0) : vec3(0.0, 1.0, 0.0);
  vec3 mT = normalize(cross(mUpRef, moonN));
  vec3 mB = cross(moonN, mT);
  vec2 mLocal = vec2(dot(dir, mT), dot(dir, mB)) / moonR;
  float mr2 = dot(mLocal, mLocal);
  float onDisc = smoothstep(1.0, 0.90, sqrt(max(mr2, 0.0)));
  /* fake the sphere normal inside the disc so the terminator curves */
  vec3 mNrm = normalize(moonN * sqrt(max(1.0 - min(mr2, 1.0), 0.0)) + mT * mLocal.x + mB * mLocal.y);
  float phase = smoothstep(-0.14, 0.22, dot(mNrm, sunN));
  float maria = 0.78 + 0.22 * vfbm3(mNrm * 9.0);
  vec3 moonCol = vec3(0.92, 0.92, 0.86) * maria * phase;
  float moonHalo = exp(-moonAng * 16.0) * 0.16 + exp(-moonAng * 3.0) * 0.03;
  float moonVis = (1.0 - day * 0.88) * smoothstep(-0.08, 0.06, moonN.y);
  nightSky += (moonCol * onDisc * 1.6 + vec3(0.65, 0.70, 0.85) * moonHalo) * moonVis;

  /* ---- blend the two skies ------------------------------------- */
  vec3 col = mix(nightSky, daySky, smoothstep(0.0, 1.0, day));

  /* ---- sun: disc, bloom, and the low-angle wash ---------------- */
  float sunDot = dot(dir, sunN);
  float sunAng = acos(clamp(sunDot, -1.0, 1.0));
  float above = smoothstep(-0.13, 0.03, sunN.y);
  float lowSun = 1.0 - smoothstep(-0.05, 0.40, sunN.y);

  vec3 sunHot = mix(vec3(1.0, 0.56, 0.26), vec3(1.0, 0.98, 0.92), 1.0 - lowSun);
  float disc = smoothstep(0.0130, 0.0092, sunAng);
  float bloom = pow(max(sunDot, 0.0), 1400.0) * 0.8
              + pow(max(sunDot, 0.0), 180.0) * 0.30
              + pow(max(sunDot, 0.0), 14.0) * 0.16;
  /* dawn and dusk smear along the horizon, not around the disc */
  float wash = pow(max(sunDot, 0.0), 3.0) * hazeBand * lowSun;

  col += sunHot * (disc * 14.0 + bloom * 3.2) * above;
  col += mix(vec3(1.0, 0.42, 0.18), vec3(1.0, 0.72, 0.42), 0.35) * wash * 1.5 * above;
  /* residual pre-dawn glow while the sun is still under the edge */
  col += vec3(0.35, 0.22, 0.30) * hazeBand * pow(max(sunDot, 0.0), 2.0)
       * (1.0 - above) * smoothstep(-0.35, -0.05, sunN.y);

  /* mie-ish forward scatter tinting the whole dome near sunrise */
  col += uHorizonColor * 0.25 * pow(max(sunDot, 0.0), 6.0) * day;

  /* under the horizon line the dome darkens so the ground meets it cleanly */
  col *= mix(0.22, 1.0, smoothstep(-0.30, 0.0, up));

  /* soft shoulder, then dither */
  col = col / (1.0 + col * 0.22);
  col += ditherMask(gl_FragCoord.xy * 1.013);

  gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
}
`;

/* ================================================================== *
 * 3. WATER — summed Gerstner waves with analytic normals.
 * ================================================================== */

const WATER_VERT = `
/* NOISE_CHUNK is only prepended to fragment stages, but gerstner() below
   needs TAU, so it is declared here too (guarded: three may inject it). */
#ifndef TAU
#define TAU 6.28318530718
#endif

uniform float uTime;
uniform float uAmplitude;
uniform float uChoppiness;

varying vec3 vWorldPos;
varying vec3 vWorldNrm;
varying float vCrest;
varying vec2 vUv;

/* One Gerstner wave. Accumulates the analytic normal terms so the fragment
   stage never has to finite-difference the surface. */
vec3 gerstner(vec2 d0, float wl, float amp, float steep, float spd,
              vec2 xz, float t, inout vec3 nAcc, inout float curv){
  vec2 d = normalize(d0);
  float k = TAU / max(wl, 0.0001);
  float c = sqrt(9.81 / k);
  float f = k * (dot(d, xz) - c * spd * t);
  float a = amp;
  float q = steep / max(k * a * 4.0, 0.0001);
  q = min(q, 1.0);

  float sf = sin(f);
  float cf = cos(f);

  nAcc.x += -d.x * a * k * cf;
  nAcc.z += -d.y * a * k * cf;
  curv += q * a * k * sf;

  return vec3(q * a * d.x * cf, a * sf, q * a * d.y * cf);
}

void main(){
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vec2 xz = wp.xz;
  float t = uTime;

  float amp = max(uAmplitude, 0.0);
  float ch = clamp(uChoppiness, 0.0, 1.0);

  vec3 nAcc = vec3(0.0, 0.0, 0.0);
  float curv = 0.0;
  vec3 disp = vec3(0.0);

  disp += gerstner(vec2( 1.00,  0.18), 31.0, amp * 1.00, 0.85 * ch, 1.00, xz, t, nAcc, curv);
  disp += gerstner(vec2( 0.62, -0.78), 17.0, amp * 0.55, 0.75 * ch, 1.15, xz, t, nAcc, curv);
  disp += gerstner(vec2(-0.35,  0.94),  9.5, amp * 0.30, 0.65 * ch, 1.30, xz, t, nAcc, curv);
  disp += gerstner(vec2(-0.90, -0.44),  5.1, amp * 0.16, 0.55 * ch, 1.55, xz, t, nAcc, curv);
  disp += gerstner(vec2( 0.18,  0.98),  2.7, amp * 0.07, 0.40 * ch, 1.90, xz, t, nAcc, curv);

  wp.xyz += disp;

  vec3 nrm = normalize(vec3(nAcc.x, 1.0 - clamp(curv, 0.0, 0.98), nAcc.z));

  vWorldPos = wp.xyz;
  vWorldNrm = nrm;
  /* crest factor: pinched tops plus raw height, used for foam and sparkle */
  vCrest = clamp(curv * 1.1 + disp.y / max(amp * 1.6, 0.001) * 0.45, 0.0, 1.5);

  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const WATER_FRAG = NOISE_CHUNK + `
uniform float uTime;
uniform vec3  uSunDir;
uniform vec3  uDeepColor;
uniform vec3  uShallowColor;
uniform float uAmplitude;
uniform float uChoppiness;
uniform float uGlitter;

varying vec3 vWorldPos;
varying vec3 vWorldNrm;
varying float vCrest;
varying vec2 vUv;

void main(){
  vec3 nrm = normalize(vWorldNrm);
  vec3 viewV = normalize(cameraPosition - vWorldPos);
  vec3 sunN = normalize(uSunDir);
  float t = uTime;

  /* fine capillary ripples: three value-noise taps as a finite-difference
     bump, cheaper than another pair of Gerstner waves */
  vec2 rp = vWorldPos.xz * 1.35 + vec2(t * 0.35, -t * 0.27);
  float e = 0.08;
  float r0 = vfbm2(rp);
  float rx = vfbm2(rp + vec2(e, 0.0));
  float rz = vfbm2(rp + vec2(0.0, e));
  float rippleAmp = 0.35 * (0.3 + 0.7 * clamp(uChoppiness, 0.0, 1.0));
  nrm = normalize(nrm + vec3(-(rx - r0) / e, 0.0, -(rz - r0) / e) * rippleAmp);

  float ndv = clamp(dot(nrm, viewV), 0.0, 1.0);

  /* schlick fresnel, floor raised so grazing water never goes flat black */
  float fres = 0.025 + 0.975 * pow(1.0 - ndv, 5.0);

  /* body colour: deep when looking down into it, shallow at the slopes */
  float facing = pow(ndv, 0.7);
  vec3 body = mix(uShallowColor, uDeepColor, facing);
  /* subsurface lift on the back of the waves that face the sun */
  float through = pow(clamp(dot(normalize(vec3(nrm.x, -abs(nrm.y), nrm.z)), -sunN), 0.0, 1.0), 2.0);
  body += uShallowColor * through * 0.35 * clamp(uAmplitude, 0.0, 2.0);

  /* reflection tint: a cheap analytic sky instead of a cubemap */
  vec3 refl = reflect(-viewV, nrm);
  float ry = clamp(refl.y, 0.0, 1.0);
  vec3 skyTint = mix(vec3(0.62, 0.70, 0.80), vec3(0.16, 0.32, 0.62), pow(ry, 0.6));
  skyTint = mix(skyTint, vec3(1.0, 0.86, 0.66), pow(max(dot(refl, sunN), 0.0), 8.0) * 0.5);

  vec3 col = mix(body, skyTint, fres);

  /* sun glint: tight blinn-phong plus a broad sheen */
  vec3 half1 = normalize(sunN + viewV);
  float ndh = max(dot(nrm, half1), 0.0);
  float spec = pow(ndh, 420.0) * 3.4 + pow(ndh, 48.0) * 0.26;
  col += vec3(1.0, 0.95, 0.84) * spec * (0.25 + 0.75 * fres);

  /* Foam in the pinched crests, broken up by noise so it is not a contour.
     vCrest scales with uAmplitude, so a fixed threshold that looked right on a
     calm sea blankets the whole surface in white once the storm raises the
     waves. Normalising by amplitude keeps foam on the crests at every size. */
  float foamN = vfbm2(vWorldPos.xz * 2.6 + vec2(-t * 0.6, t * 0.4));
  float crestN = vCrest / (0.45 + 0.85 * clamp(uAmplitude, 0.0, 2.0));
  float foam = smoothstep(0.72, 1.30, crestN * (0.55 + 0.75 * foamN));
  foam *= smoothstep(0.15, 0.55, foamN);
  col = mix(col, vec3(0.90, 0.94, 0.97), clamp(foam, 0.0, 0.62));

  /* glitter: sparse hash sparkle riding the crests, gated by fresnel */
  vec2 gid = floor(vWorldPos.xz * 26.0);
  float gseed = hash12(gid);
  float sparkle = pow(max(sin(t * (5.0 + 11.0 * gseed) + gseed * TAU), 0.0), 36.0);
  sparkle *= step(0.86, gseed) * smoothstep(0.25, 0.9, vCrest);
  sparkle *= smoothstep(0.1, 0.7, max(dot(nrm, sunN), 0.0));
  col += vec3(1.0, 0.97, 0.90) * sparkle * clamp(uGlitter, 0.0, 2.0) * 2.2 * (0.3 + 0.7 * fres);

  /* distance haze so the plane does not end in a hard line */
  float dist = length(cameraPosition.xz - vWorldPos.xz);
  float haze = 1.0 - exp(-dist * 0.0022);
  col = mix(col, skyTint * 0.9, clamp(haze, 0.0, 0.85));

  col = col / (1.0 + col * 0.18);
  gl_FragColor = vec4(max(col, vec3(0.0)), 1.0);
}
`;


/* ================================================================== *
 * 10. VEIL — fullscreen overlay.
 * ================================================================== */

const VEIL_VERT = `
varying vec2 vUv;

void main(){
  vUv = uv;
  /* standard transform: works both for a quad under an identity camera and
     for a plane parented to an orthographic overlay scene */
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const VEIL_FRAG = NOISE_CHUNK + `
uniform float uTime;
uniform float uFade;
uniform vec3  uColor;
uniform float uVignette;
uniform float uGrain;
uniform float uRipple;
uniform vec2  uResolution;

varying vec2 vUv;

void main(){
  float t = uTime;
  vec2 res = max(uResolution, vec2(1.0));
  float aspect = res.x / res.y;

  vec2 p = vUv - 0.5;
  p.x *= aspect;
  float r = length(p);
  vec2 rdir = r > 0.0001 ? p / r : vec2(0.0);

  /* ---- revelation ripple ------------------------------------------- */
  float rp = clamp(uRipple, 0.0, 1.0);
  float ring = sin(r * 34.0 - t * 2.6) * exp(-r * 2.1);
  float ring2 = sin(r * 17.0 - t * 1.4 + 1.1) * exp(-r * 1.3);
  float wave = (ring * 0.7 + ring2 * 0.5) * rp;

  /* the displaced sampling point, used for everything that follows, so the
     whole overlay appears to bend */
  vec2 duv = vUv + rdir * wave * 0.045;

  /* chromatic separation along the ripple, which is what sells it as a
     distortion rather than as a drawn ring */
  float sep = wave * 0.012;
  float gR = vfbm2((duv + rdir * sep) * 3.0 + t * 0.05);
  float gG = vfbm2(duv * 3.0 + t * 0.05);
  float gB = vfbm2((duv - rdir * sep) * 3.0 + t * 0.05);
  vec3 bend = vec3(gR, gG, gB);

  float ringGlow = pow(clamp(abs(wave), 0.0, 1.0), 1.6) * rp;

  /* ---- vignette ------------------------------------------------------ */
  float vr = length((duv - 0.5) * vec2(aspect, 1.0));
  float vig = smoothstep(0.32, 0.86, vr);
  vig = pow(vig, 1.4);

  /* ---- grain --------------------------------------------------------- */
  vec2 gcoord = floor(duv * res / max(1.0, floor(res.y / 540.0) + 1.0));
  float gn = hash13(vec3(gcoord, floor(t * 24.0)));
  float grain = (gn - 0.5) * 2.0;

  /* ---- composite ----------------------------------------------------- */
  vec3 col = uColor;
  col = mix(col, col * (0.85 + 0.3 * bend), rp * 0.8);
  col = mix(col, vec3(1.0, 0.97, 0.90), clamp(ringGlow * 1.2, 0.0, 0.9));
  col += grain * clamp(uGrain, 0.0, 1.0) * 0.09;

  float a = clamp(uFade, 0.0, 1.0);
  a += vig * clamp(uVignette, 0.0, 1.0) * (1.0 - a * 0.55);
  a += ringGlow * 0.55;
  a += abs(grain) * clamp(uGrain, 0.0, 1.0) * 0.07 * (1.0 - a);
  a = clamp(a, 0.0, 1.0);

  col += ditherMask(gl_FragCoord.xy);
  gl_FragColor = vec4(saturate3(col), a);
}
`;


/* ================================================================== *
 * NOACH ADDITIONS — everything below is new for the Flood.
 * ================================================================== */

/* ------------------------------------------------------------------ *
 * GROUND — the valley floor. Cartoon-bright, softly banded, with a wet
 * band that tracks the rising water so the shoreline reads as the flood
 * climbs. Geometry is displaced on the CPU (gameplay has to query
 * heights), so this stage only colours.
 * ------------------------------------------------------------------ */
const GROUND_VERT = `
varying vec3 vWorldPos;
varying vec3 vWorldNrm;
varying vec2 vUv;

void main(){
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vWorldNrm = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const GROUND_FRAG = NOISE_CHUNK + `
uniform float uTime;
uniform vec3  uSunDir;
uniform vec3  uGrassA;
uniform vec3  uGrassB;
uniform vec3  uSand;
uniform vec3  uRock;
uniform float uWaterLevel;
uniform float uDrown;

varying vec3 vWorldPos;
varying vec3 vWorldNrm;
varying vec2 vUv;

void main(){
  vec3 N = normalize(vWorldNrm);
  float slope = 1.0 - clamp(N.y, 0.0, 1.0);

  /* two scales of blotch so the field never looks like a gradient */
  float blot = vfbm2(vWorldPos.xz * 0.055) * 0.65 + vfbm2(vWorldPos.xz * 0.21) * 0.35;

  vec3 grass = mix(uGrassA, uGrassB, saturate1(blot * 1.25));

  /* quantise into soft bands: reads as painted, not photoreal */
  float band = floor(blot * 4.0) / 4.0;
  grass = mix(grass, grass * (0.88 + band * 0.28), 0.55);

  float rocky = smoothstep(0.42, 0.72, slope + vfbm2(vWorldPos.xz * 0.6) * 0.12);
  vec3 col = mix(grass, uRock, rocky);

  /* sandy rim just above the waterline, soaked ground just below */
  float above = vWorldPos.y - uWaterLevel;
  float shore = 1.0 - smoothstep(0.0, 2.2, abs(above));
  col = mix(col, uSand, shore * 0.5 * (1.0 - rocky));

  float wet = 1.0 - smoothstep(-3.0, 0.35, above);
  col = mix(col, col * vec3(0.42, 0.50, 0.58), wet * 0.85);

  /* lambert plus a lifted wrap term so shadow sides stay colourful */
  float lam  = clamp(dot(N, normalize(uSunDir)), 0.0, 1.0);
  float wrap = clamp((dot(N, normalize(uSunDir)) + 0.45) / 1.45, 0.0, 1.0);
  col *= 0.55 + 0.75 * mix(lam, wrap, 0.65);

  col = mix(col, vec3(luma(col)) * vec3(0.78, 0.82, 0.92), uDrown * 0.6);

  col += ditherMask(gl_FragCoord.xy);
  gl_FragColor = vec4(saturate3(col), 1.0);
}
`;

/* ------------------------------------------------------------------ *
 * RAIN — one THREE.Points cloud that follows the camera. Particles live
 * in a local box and wrap with mod(), so the system is effectively
 * infinite and costs a single draw call. Square sprites are squeezed
 * into vertical streaks in the fragment stage.
 * ------------------------------------------------------------------ */
const RAIN_VERT = `
uniform float uTime;
uniform float uIntensity;
uniform float uBoxH;
uniform float uBoxR;
uniform vec3  uOrigin;
uniform vec2  uWind;
uniform float uSize;

attribute float aSeed;
attribute float aSpeed;

varying float vAlpha;

void main(){
  /* thin the field out at low intensity rather than shrinking the box */
  float live = step(aSeed, clamp(uIntensity, 0.0, 1.0));

  float fall = uTime * (9.0 + aSpeed * 13.0);
  vec3 p = position;
  p.y = mod(p.y - fall, uBoxH);
  p.xz += uWind * (uBoxH - p.y) * 0.06;

  /* wrap horizontally around the moving camera so we never run out */
  vec3 w;
  w.x = mod(p.x + uOrigin.x + uBoxR, uBoxR * 2.0) - uBoxR + uOrigin.x;
  w.z = mod(p.z + uOrigin.z + uBoxR, uBoxR * 2.0) - uBoxR + uOrigin.z;
  w.y = p.y + uOrigin.y - uBoxH * 0.35;

  vec4 mv = viewMatrix * vec4(w, 1.0);
  float dist = max(-mv.z, 0.001);

  gl_PointSize = uSize * (34.0 / dist) * (0.6 + aSpeed * 0.8) * live;
  gl_Position = projectionMatrix * mv;

  vAlpha = live * smoothstep(uBoxH, uBoxH * 0.72, p.y) * (1.0 - smoothstep(26.0, 60.0, dist));
}
`;

const RAIN_FRAG = `
uniform vec3  uColor;
uniform float uOpacity;

varying float vAlpha;

void main(){
  vec2 c = gl_PointCoord - 0.5;
  /* squeeze horizontally: a square sprite becomes a falling streak */
  float streak = 1.0 - smoothstep(0.06, 0.30, abs(c.x));
  float len    = 1.0 - smoothstep(0.18, 0.52, abs(c.y));
  float a = streak * len * vAlpha * uOpacity;
  if (a < 0.01) discard;
  gl_FragColor = vec4(uColor, a);
}
`;

/* ------------------------------------------------------------------ *
 * CLOUDS — a flat layer high overhead on a big disc. Starts as friendly
 * puffs and becomes the ceiling of the deluge via uCover and uDark.
 * ------------------------------------------------------------------ */
const CLOUD_VERT = `
varying vec3 vWorldPos;
varying vec2 vUv;

void main(){
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const CLOUD_FRAG = NOISE_CHUNK + `
uniform float uTime;
uniform float uCover;
uniform float uDark;
uniform vec3  uSunDir;
uniform vec3  uLitColor;
uniform vec3  uDarkColor;

varying vec3 vWorldPos;
varying vec2 vUv;

void main(){
  vec2 p = vWorldPos.xz * 0.012;
  vec2 drift = vec2(uTime * 0.012, uTime * 0.005);

  /* domain-warped fbm: billows rather than blobs */
  float w = vfbm2(p * 1.7 + drift * 2.0);
  vec2 q = p + vec2(w, -w) * 0.55 + drift;

  float d = vfbm2(q * 1.15) * 0.60 + vfbm2(q * 2.9) * 0.28 + vfbm2(q * 6.1) * 0.12;

  /* uCover lowers the threshold, so cloud grows to seal the sky */
  float thr = mix(0.62, 0.14, clamp(uCover, 0.0, 1.0));
  float a = smoothstep(thr, thr + 0.24, d);

  /* fade toward the rim of the disc so the layer has no hard edge */
  float r = length(vUv - 0.5) * 2.0;
  a *= 1.0 - smoothstep(0.72, 1.0, r);

  /* cheap self-shading: thicker core reads as a darker underside */
  float thick = smoothstep(thr, thr + 0.55, d);
  vec3 col = mix(uLitColor, uDarkColor, clamp(uDark, 0.0, 1.0) * 0.85 + thick * 0.25);
  col *= 0.80 + 0.35 * (1.0 - thick);

  /* a warm rim where the sun still gets through */
  float sun = clamp(dot(normalize(vec3(p.x, 0.45, p.y)), normalize(uSunDir)), 0.0, 1.0);
  col += vec3(1.0, 0.86, 0.62) * pow(sun, 7.0) * (1.0 - uDark) * 0.5 * (1.0 - thick);

  col += ditherMask(gl_FragCoord.xy);
  gl_FragColor = vec4(saturate3(col), clamp(a, 0.0, 1.0) * 0.96);
}
`;

/* ------------------------------------------------------------------ *
 * WOOD — gopher-wood planking for the ark. Horizontal boards with a
 * pitch-dark caulk seam between them, knots, and a wet sheen that comes
 * up with the rain.
 * ------------------------------------------------------------------ */
const WOOD_VERT = `
varying vec3 vWorldPos;
varying vec3 vWorldNrm;
varying vec3 vLocalPos;

void main(){
  vLocalPos = position;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWorldPos = wp.xyz;
  vWorldNrm = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const WOOD_FRAG = NOISE_CHUNK + `
uniform float uTime;
uniform vec3  uSunDir;
uniform vec3  uColorA;
uniform vec3  uColorB;
uniform float uPlank;
uniform float uWet;

varying vec3 vWorldPos;
varying vec3 vWorldNrm;
varying vec3 vLocalPos;

void main(){
  vec3 N = normalize(vWorldNrm);

  /* board index from local Y, so planking stays put when the ark rocks */
  float row  = floor(vLocalPos.y / max(uPlank, 0.001));
  float frac = fract(vLocalPos.y / max(uPlank, 0.001));

  float tone = hash11(row * 3.17 + 0.5);
  vec3 col = mix(uColorA, uColorB, tone * 0.85 + 0.15);

  /* grain running along the board */
  vec2 g = vec2(vLocalPos.x * 0.9 + vLocalPos.z * 0.9, row * 7.0);
  float grain = vfbm2(g * vec2(2.2, 1.0)) * 0.5 + vfbm2(g * vec2(9.0, 1.0)) * 0.5;
  col *= 0.86 + grain * 0.30;

  float kn = vnoise2(vec2(vLocalPos.x * 0.55 + row * 2.3, vLocalPos.z * 0.55));
  col *= 1.0 - smoothstep(0.80, 0.97, kn) * 0.45;

  /* caulk seam top and bottom of every board */
  float seam = smoothstep(0.0, 0.085, frac) * smoothstep(1.0, 0.915, frac);
  col *= 0.42 + 0.58 * seam;

  float lam  = clamp(dot(N, normalize(uSunDir)), 0.0, 1.0);
  float wrap = clamp((dot(N, normalize(uSunDir)) + 0.5) / 1.5, 0.0, 1.0);
  col *= 0.50 + 0.78 * mix(lam, wrap, 0.6);

  /* wet darkens the timber and adds a tight specular */
  col *= mix(1.0, 0.72, clamp(uWet, 0.0, 1.0));
  vec3 V = normalize(cameraPosition - vWorldPos);
  vec3 H = normalize(V + normalize(uSunDir));
  col += vec3(1.0) * pow(clamp(dot(N, H), 0.0, 1.0), 48.0) * uWet * 0.55;

  col += ditherMask(gl_FragCoord.xy);
  gl_FragColor = vec4(saturate3(col), 1.0);
}
`;

/* ================================================================== *
 * Descriptors.
 * ================================================================== */

export const SHADERS = {
  /* Sky dome. Draw on the inside of a large sphere. */
  FIRMAMENT: {
    vertexShader: FIRMAMENT_VERT,
    fragmentShader: FIRMAMENT_FRAG,
    uniforms: {
      uTime:          { value: 0 },
      uSunDir:        { value: [0.35, 0.55, -0.75] },
      uMoonDir:       { value: [-0.4, 0.5, 0.76] },
      uDayNight:      { value: 1 },
      uStars:         { value: 0 },
      uHaze:          { value: 0.35 },
      uTopColor:      { value: [0.0284, 0.2122, 0.6308] },
      uHorizonColor:  { value: [0.5457, 0.7682, 0.8879] },
      uNightColor:    { value: [0.0024, 0.0037, 0.0091] },
    },
    side: 'back', transparent: false, depthWrite: false,
  },

  /* Open water. World-space displacement: raise the flood by moving the
     mesh in Y and the wave field stays anchored instead of swimming. */
  WATER: {
    vertexShader: WATER_VERT,
    fragmentShader: WATER_FRAG,
    uniforms: {
      uTime:         { value: 0 },
      uSunDir:       { value: [0.35, 0.55, -0.75] },
      uDeepColor:    { value: [0.0033, 0.0423, 0.0685] },
      uShallowColor: { value: [0.0273, 0.2623, 0.3050] },
      uAmplitude:    { value: 0.18 },
      uChoppiness:   { value: 0.35 },
      uGlitter:      { value: 0.8 },
    },
    side: 'front', transparent: false, depthWrite: true,
  },

  /* Valley floor. */
  GROUND: {
    vertexShader: GROUND_VERT,
    fragmentShader: GROUND_FRAG,
    uniforms: {
      uTime:       { value: 0 },
      uSunDir:     { value: [0.35, 0.55, -0.75] },
      uGrassA:     { value: [0.0262, 0.1144, 0.0116] },
      uGrassB:     { value: [0.1512, 0.3900, 0.0612] },
      uSand:       { value: [0.6867, 0.5520, 0.2462] },
      uRock:       { value: [0.1946, 0.1779, 0.1500] },
      uWaterLevel: { value: -6 },
      uDrown:      { value: 0 },
    },
    side: 'front', transparent: false, depthWrite: true,
  },

  /* Falling rain. THREE.Points; needs aSeed + aSpeed attributes. */
  RAIN: {
    vertexShader: RAIN_VERT,
    fragmentShader: RAIN_FRAG,
    uniforms: {
      uTime:      { value: 0 },
      uIntensity: { value: 0 },
      uBoxH:      { value: 42 },
      uBoxR:      { value: 44 },
      uOrigin:    { value: [0, 0, 0] },
      uWind:      { value: [0.6, 0.2] },
      uSize:      { value: 1.5 },
      uColor:     { value: [0.76, 0.84, 0.95] },
      uOpacity:   { value: 0.55 },
    },
    side: 'front', transparent: true, depthWrite: false,
  },

  /* Overhead cloud layer on a big disc. */
  CLOUDS: {
    vertexShader: CLOUD_VERT,
    fragmentShader: CLOUD_FRAG,
    uniforms: {
      uTime:      { value: 0 },
      uCover:     { value: 0.25 },
      uDark:      { value: 0 },
      uSunDir:    { value: [0.35, 0.55, -0.75] },
      uLitColor:  { value: [1.0000, 0.9823, 0.9301] },
      uDarkColor: { value: [0.0423, 0.0513, 0.0802] },
    },
    side: 'double', transparent: true, depthWrite: false,
  },

  /* Ark planking. */
  WOOD: {
    vertexShader: WOOD_VERT,
    fragmentShader: WOOD_FRAG,
    uniforms: {
      uTime:   { value: 0 },
      uSunDir: { value: [0.35, 0.55, -0.75] },
      uColorA: { value: [0.1022, 0.0423, 0.0130] },
      uColorB: { value: [0.3916, 0.1746, 0.0482] },
      uPlank:  { value: 0.62 },
      uWet:    { value: 0 },
    },
    side: 'front', transparent: false, depthWrite: true,
  },

  /* Fullscreen transition overlay, driven by the engine. */
  VEIL: {
    vertexShader: VEIL_VERT,
    fragmentShader: VEIL_FRAG,
    uniforms: {
      uTime:       { value: 0 },
      uFade:       { value: 0 },
      uColor:      { value: [0.02, 0.03, 0.05] },
      uVignette:   { value: 0.35 },
      uGrain:      { value: 0.03 },
      uRipple:     { value: 0 },
      uResolution: { value: [1280, 720] },
    },
    side: 'front', transparent: true, depthWrite: false,
  },
};

export default SHADERS;
