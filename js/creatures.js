// BLUE HAVEN (rebuild r1) — fully 3D procedural deep-sea life. © MOTOR AA
// Bodies are built in code (volumetric bodies, separate fins, eyes); motion = vertex-shader spine wave + true 3D steering.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { U, rng, noise3, sandHeight, setGlow } from './common.js?v=r4';
import { obstacles } from './env.js?v=r4';

const C = (h) => new THREE.Color(h);
const tmpC = new THREE.Color();
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
function finAttr(g, part, uFn) { const p = g.attributes.position, a = new Float32Array(p.count * 2); for (let i = 0; i < p.count; i++) { a[i * 2] = part; a[i * 2 + 1] = uFn ? uFn(p.getX(i), p.getY(i), p.getZ(i)) : 0; } g.setAttribute('aFin', new THREE.BufferAttribute(a, 2)); return g; }
function solid(g, col, glow = 0, part = 5) { const n = g.attributes.position.count, a = new Float32Array(n * 3), c = C(col); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); if (g.attributes.uv) g.deleteAttribute('uv'); setGlow(g, glow); if (!g.attributes.aFin) finAttr(g, part); return g; }
function fixNormals(g) { const n = g.attributes.normal, p = g.attributes.position; for (let i = 0; i < n.count; i++) { const x = n.getX(i), y = n.getY(i), z = n.getZ(i); if (!(x * x + y * y + z * z > 1e-10)) { const px = p.getX(i), py = p.getY(i), pz = p.getZ(i), l = Math.hypot(px, py, pz) || 1; n.setXYZ(i, px / l, py / l, pz / l || 1); } } return g; }
const merge = (parts) => fixNormals(mergeGeometries(parts.map(p => { if (!p.attributes.normal) p.computeVertexNormals(); if (p.attributes.uv) p.deleteAttribute('uv'); return p; })));

// Swim material: spine wave (traveling, amplitude grows to the tail), turn/pitch bend, fin flutter,
// gill + mouth breathing, manta wing flap, whale fluke stroke, with normal correction.
const SWIM_GLSL = `
uniform float uTime; uniform vec4 uSw;
attribute vec2 aFin; attribute vec4 aSwim; attribute vec4 aSwim2; attribute float aGlow;
varying vec3 vOP; varying float vFlash; varying float vGlowV; varying float vSeed;
vec3 swimD(vec3 p){
  float part = aFin.x, u = aFin.y;
  float ph = aSwim.x, amp = aSwim.y, bend = aSwim.z, pit = aSwim.w;
  float s = clamp(0.5 - p.z, 0.0, 1.3);
  float tt = uTime + aSwim2.y * 37.0;
  vec3 d = vec3(0.0);
#if SWIM == 2
  float A = amp * (uSw.y + uSw.z * s * s * s);
  d.y += A * sin(ph - s * uSw.x);
  d.x += bend * s * s * 0.35;
  if (part > 0.5 && part < 1.5) d.y += amp * 0.035 * u * sin(ph - s * uSw.x - 1.0);
  if (part > 2.5 && part < 4.5) d.y += u * 0.25 * sin(tt * 0.8 + part);
#elif SWIM == 3
  float w = clamp(abs(p.x) / 0.5, 0.0, 1.0);
  d.y += amp * uSw.y * pow(w, 1.35) * sin(ph - w * 1.5 - s * uSw.x);
  d.x += bend * s * s * 0.3;
  d.y += pit * s * s * 0.2;
  if (part > 0.5 && part < 1.5) { d.x += 0.05 * s * s * sin(tt * 1.4 - s * 7.0); d.y += 0.02 * s * sin(tt * 1.1 - s * 5.0); }
  if (part > 1.5 && part < 2.5) d.x += sign(p.x) * 0.012 * u * sin(tt * 0.9);
#elif SWIM == 4
  float dd = max(0.0, -p.z - 0.05);
  d.x += sin(p.z * 9.0 + ph + p.x * 30.0) * dd * 0.09 + bend * dd * dd * 0.8;
  d.y += cos(p.z * 7.0 + ph * 0.8 + p.y * 30.0) * dd * 0.07 + pit * dd * dd * 0.4;
  float m = smoothstep(0.0, 0.5, p.z);
  d.xy += p.xy * sin(ph * 0.5) * 0.07 * m;
  if (part > 1.5 && part < 2.5) d.y += 0.035 * u * sin(tt * 3.0 + p.z * 22.0);
#else
  #if SWIM == 1
  float A = amp * (uSw.y + uSw.z * s);
  #else
  float A = amp * (uSw.y + uSw.z * s * s);
  #endif
  d.x += A * sin(ph - s * uSw.x) + bend * s * s * 0.5;
  d.y += pit * s * s * 0.3;
  if (part > 0.5 && part < 1.5) d.x += amp * 0.05 * u * sin(ph - s * uSw.x - 1.3);
  if (part > 1.5 && part < 2.5) d.x += 0.012 * u * sin(tt * 7.0 + p.z * 28.0);
  if (part > 2.5 && part < 4.5) { float fl = sin(tt * 3.2 + (part - 3.0) * 1.3) * (0.45 + 0.8 * aSwim2.z); d.y += u * fl * 0.7; d.z -= u * abs(fl) * 0.3; }
  if (part > 5.5) { d.x += u * 0.05 * sin(tt * 1.3); d.y += u * 0.035 * sin(tt * 0.9 + 1.0); }
  float br = sin(tt * 2.3);
  if (part < 0.5) {
    float g = smoothstep(0.08, 0.17, s) * smoothstep(0.34, 0.2, s); d.xy += p.xy * g * br * 0.05;
    float mo = smoothstep(0.07, 0.0, s) * step(p.y, 0.0); d.y -= mo * uSw.w * (0.5 + 0.5 * br);
  }
#endif
  return d;
}`;
const FRAG_HEAD = `
uniform float uTime; uniform float uGlowStr; uniform vec3 uRimCol; uniform vec3 uSheen; uniform float uPaintF; uniform float uSelf;
varying vec3 vOP; varying float vFlash; varying float vGlowV; varying float vSeed;
float hh3(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float vn3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(hh3(i), hh3(i + vec3(1,0,0)), f.x), mix(hh3(i + vec3(0,1,0)), hh3(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(hh3(i + vec3(0,0,1)), hh3(i + vec3(1,0,1)), f.x), mix(hh3(i + vec3(0,1,1)), hh3(i + vec3(1,1,1)), f.x), f.y), f.z); }`;
const MODE = { fish: 0, eel: 1, whale: 2, ray: 3, squid: 4 };
export function swimMaterial(o = {}) {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: o.rough ?? 0.5, metalness: o.metal ?? 0.05, side: THREE.DoubleSide });
  const mode = MODE[o.mode || 'fish'];
  const uSw = { value: new THREE.Vector4(...(o.wave || [5.6, 0.02, 0.11, 0.0])) };
  const sheen = { value: (o.sheen || C('#000000')).clone() };
  mat.userData.uSw = uSw;
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uTime: U.uTime, uRimCol: U.uRimCol, uGlowStr: U.uGlowStr, uSw, uSheen: sheen, uPaintF: { value: o.paintF ?? 14 }, uSelf: { value: o.self ?? 0.07 } });
    sh.vertexShader = `#define SWIM ${mode}\n` + sh.vertexShader
      .replace('#include <common>', `#include <common>\n${SWIM_GLSL}`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        vec3 swD0 = swimD(position);
        { float e = 0.008; vec3 dzv = (swimD(position + vec3(0.0, 0.0, e)) - swD0) / e; vec3 dxv = (swimD(position + vec3(e, 0.0, 0.0)) - swD0) / e;
          vec3 nn = objectNormal - vec3(dot(dxv, objectNormal), 0.0, dot(dzv, objectNormal)); objectNormal = dot(nn, nn) > 1e-12 ? normalize(nn) : vec3(0.0, 1.0, 0.0); }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed += swD0; vOP = position; vFlash = aSwim2.x; vGlowV = aGlow; vSeed = aSwim2.y;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>\n${FRAG_HEAD}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
        diffuseColor.rgb *= 0.9 + 0.2 * vn3(vOP * uPaintF + vSeed * 13.0);`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float vdist = length(vViewPosition);
        float frr = pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 2.2);
        { float gl = vGlowV * (0.84 + 0.16 * sin(uTime * 0.9 + vOP.z * 3.0 + vSeed * 6.28)) * uGlowStr * (1.0 - 0.5 * smoothstep(9.0, 32.0, vdist));
          totalEmissiveRadiance += diffuseColor.rgb * (gl + uSelf * (0.6 + 0.4 * frr));
          totalEmissiveRadiance += vec3(0.5, 0.78, 1.0) * vFlash * (0.18 + 0.9 * frr); }`)
      .replace('#include <opaque_fragment>', `
        outgoingLight += uRimCol * frr * 1.1 + uSheen * frr * (0.7 + 0.3 * sin(vOP.z * 9.0 + uTime * 0.6));
        outgoingLight *= mix(vec3(1.0), vec3(0.72, 0.92, 1.05), 1.0 - exp(-0.6 * vdist * 0.045));
        #include <opaque_fragment>`);
  };
  mat.customProgramCacheKey = () => 'swim' + mode + (o.paintF ?? 14) + '_' + (o.self ?? 0.07);
  return mat;
}

// Geometry: volumetric fish body + separate fins (parts: 0 body, 1 caudal, 2 median fins, 3/4 pectorals, 5 eyes, 6 lure)
function fishGeometry(sh, paint, finPaint, lo = false) {
  const { H, W, peak = 0.55, r0 = 0.16, belly = 1.0, tailLen = 0.18, tailH = 0.2, fork = 0.5, nose = 1.0, keel = 0.0 } = sh;
  const zt = -0.5 + tailLen, NZ = lo ? 12 : (sh.nz || 36), NA = lo ? 8 : (sh.na || 22), P = [], Cc = [], G = [], F = [], I = [];
  const prof = (t) => t < peak ? r0 + (1 - r0) * Math.sin(0.5 * Math.PI * t / peak) : Math.pow(Math.max(0, 1 - Math.pow((t - peak) / (1 - peak), 2)), 0.5 * nose);
  for (let i = 0; i <= NZ; i++) {
    const t = i / NZ, z = zt + t * (0.5 - zt), f = prof(t);
    for (let j = 0; j <= NA; j++) {
      const a = j / NA * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      let y = H * f * sa; if (y < 0) y *= belly; const x = W * f * ca * (1 - keel * Math.max(0, -sa) * 0.4);
      P.push(x, y, z);
      const gl = paint(tmpC, z, sa, ca, t) || 0; Cc.push(tmpC.r, tmpC.g, tmpC.b); G.push(gl); F.push(0, 0);
    }
  }
  for (let i = 0; i < NZ; i++) for (let j = 0; j < NA; j++) { const a = i * (NA + 1) + j, b = a + NA + 1; I.push(a, b, a + 1, b, b + 1, a + 1); }
  const mk = (P, Cc, G, F, I) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3)); g.setAttribute('aGlow', new THREE.Float32BufferAttribute(G, 1)); g.setAttribute('aFin', new THREE.Float32BufferAttribute(F, 2)); g.setIndex(I); g.computeVertexNormals(); return g; };
  const parts = [mk(P, Cc, G, F, I)];
  const sheet = (fn, nu, nv, kind, part, uOf) => {
    const P2 = [], C2 = [], G2 = [], F2 = [], I2 = [];
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) { const u = i / nu, v = j / nv, p = fn(u, v); P2.push(p[0], p[1], p[2]); const gl = finPaint(tmpC, kind, u, v) || 0; C2.push(tmpC.r, tmpC.g, tmpC.b); G2.push(gl); F2.push(part, uOf(u, v)); }
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = i * (nv + 1) + j, b = a + nv + 1; I2.push(a, b, a + 1, b, b + 1, a + 1); }
    parts.push(mk(P2, C2, G2, F2, I2));
  };
  const h0 = H * r0 * 0.9, q = lo ? 0.5 : 1;
  if (sh.flukes) sheet((u, v) => { const vv = v * 2 - 1, av = Math.abs(vv); const hh = W * r0 + (tailH - W * r0) * Math.pow(u, 0.7); return [vv * hh, Math.sin(u * 3.1) * 0.004, zt + 0.01 - u * tailLen * (1 - fork * Math.pow(1 - av, 1.6))]; }, Math.ceil(8 * q), Math.ceil(12 * q), 'tail', 1, (u) => u);
  else sheet((u, v) => { const vv = v * 2 - 1, av = Math.abs(vv); const hh = h0 + (tailH - h0) * Math.pow(u, 0.8); return [0, vv * hh, zt + 0.01 - u * tailLen * (1 - fork * Math.pow(1 - av, 1.6))]; }, Math.ceil(8 * q), Math.ceil(10 * q), 'tail', 1, (u) => u);
  const topY = (z) => H * prof(Math.min(1, Math.max(0, (z - zt) / (0.5 - zt))));
  if (sh.dorsal) { const d = sh.dorsal; sheet((u, v) => { const z = d.z0 + (d.z1 - d.z0) * u; return [0, topY(z) * 0.9 + d.h * Math.sin(Math.PI * Math.pow(u, d.pow || 0.8)) ** 0.7 * v, z - (d.rake || 0) * v]; }, Math.ceil((d.nu || 14) * q), lo ? 1 : 3, 'dorsal', 2, (u, v) => v); }
  if (sh.anal) { const d = sh.anal; sheet((u, v) => { const z = d.z0 + (d.z1 - d.z0) * u; return [0, -topY(z) * belly * 0.9 - d.h * Math.sin(Math.PI * Math.pow(u, d.pow || 0.8)) ** 0.7 * v, z - (d.rake || 0) * v]; }, Math.ceil((d.nu || 12) * q), lo ? 1 : 3, 'anal', 2, (u, v) => v); }
  if (!lo || sh.big) {
    const pz = zt + 0.68 * (0.5 - zt), pw = W * prof(0.68), ps = sh.pect || 0.09;
    for (const s of [-1, 1]) sheet((u, v) => [s * (pw * 0.92 + u * ps * 0.9), -H * 0.2 + (v - 0.5) * ps * 0.7 * (1 - u * 0.5) - u * ps * 0.25, pz - u * ps * 0.8 - v * ps * 0.4], 4, 2, 'pect', s < 0 ? 3 : 4, (u) => u * ps);
    if (sh.pelvic) for (const s of [-1, 1]) sheet((u, v) => [s * (W * 0.3 + u * sh.pelvic * 0.4), -H * prof(0.5) * belly * 0.85 - u * sh.pelvic * 0.8, zt + 0.45 * (0.5 - zt) - u * sh.pelvic * 0.6 - v * sh.pelvic * 0.4], 3, 2, 'pelvic', 2, (u) => u);
  }
  if (!lo) {
    const ez = zt + (sh.eyeT || 0.86) * (0.5 - zt), ef = prof(sh.eyeT || 0.86), er = sh.eyeR || 0.035, ey = H * ef * (sh.eyeY ?? 0.22);
    for (const s of [-1, 1]) {
      const ex = s * W * ef * 0.86;
      const iris = new THREE.SphereGeometry(er, 16, 12); iris.scale(0.55, 1, 1); iris.translate(ex, ey, ez); parts.push(solid(iris, sh.iris || '#c8d8e8', sh.irisGlow || 0.15));
      const pup = new THREE.SphereGeometry(er * 0.66, 14, 10); pup.scale(0.55, 1, 1); pup.translate(ex + s * er * 0.22, ey, ez + er * 0.05); parts.push(solid(pup, sh.eyeCol || '#05060a', 0));
      const hl = new THREE.SphereGeometry(er * 0.22, 8, 6); hl.translate(ex + s * er * 0.42, ey + er * 0.36, ez + er * 0.3); parts.push(solid(hl, '#ffffff', 1.2));
    }
  }
  if (sh.lure) {
    const pts = []; for (let i = 0; i <= 12; i++) { const t = i / 12; pts.push(new THREE.Vector3(0, H * 0.85 + Math.sin(t * Math.PI * 0.85) * H * 0.85, 0.2 + t * 0.44)); }
    const st = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), lo ? 6 : 14, 0.011, 5, false); solid(st, '#4a3048', 0.1, 6); finAttr(st, 6, (x, y, z) => clamp((z - 0.2) / 0.44, 0, 1)); parts.push(st);
    const b = new THREE.SphereGeometry(0.055, 14, 10); const e = pts[12]; b.translate(e.x, e.y, e.z); solid(b, '#b8fff4', 3.6, 6); finAttr(b, 6, () => 1); parts.push(b);
  }
  return merge(parts);
}

// manta: flattened wing body, cephalic fins, whip tail. x = span [-0.5, 0.5]
function mantaGeometry(lo = false) {
  const NU = lo ? 16 : 44, NV = lo ? 6 : 16, parts = [];
  for (const side of [1, -1]) {
    const P = [], Cc = [], G = [], F = [], I = [];
    for (let i = 0; i <= NU; i++) for (let j = 0; j <= NV; j++) {
      const x = (i / NU - 0.5), w = Math.abs(x) / 0.5, v = j / NV;
      const zf = 0.21 - 0.31 * Math.pow(w, 1.5), zb = -0.15 + 0.01 * w - 0.03 * Math.sin(w * Math.PI);
      const z = zf + (zb - zf) * v;
      const th = (0.06 * Math.pow(1 - w, 1.8) + 0.0025) * Math.pow(Math.sin(Math.PI * clamp(v, 0, 1)), 0.6);
      const y = side > 0 ? th : -th * 0.65;
      P.push(x, y, z); F.push(0, 0);
      if (side > 0) { tmpC.copy(C('#1d2640')).lerp(C('#3c4a6c'), sstep(0.1, 0.45, w) * sstep(0.7, 0.2, v) * 0.7); const n = noise3(x * 30, z * 30, 3); if (n > 0.64) tmpC.lerp(C('#5a6a8a'), 0.4); const edge = v < 0.08 && w > 0.15 && Math.abs((w * 24) - Math.round(w * 24)) < 0.25; if (edge) tmpC.setRGB(0.5, 0.95, 1.0); Cc.push(tmpC.r, tmpC.g, tmpC.b); G.push(edge ? 2.0 : 0.02); }
      else { tmpC.copy(C('#d6dce6')).lerp(C('#8a94a8'), sstep(0.6, 1.0, w)); if (noise3(x * 40 + 9, z * 40, 1) > 0.7 && w < 0.5) tmpC.lerp(C('#2a3040'), 0.7); if (z > 0.17 && w < 0.06) tmpC.copy(C('#141822')); Cc.push(tmpC.r, tmpC.g, tmpC.b); G.push(0.01); }
    }
    for (let i = 0; i < NU; i++) for (let j = 0; j < NV; j++) { const a = i * (NV + 1) + j, b = a + NV + 1; if (side > 0) I.push(a, a + 1, b, b, a + 1, b + 1); else I.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3)); g.setAttribute('aGlow', new THREE.Float32BufferAttribute(G, 1)); g.setAttribute('aFin', new THREE.Float32BufferAttribute(F, 2)); g.setIndex(I); g.computeVertexNormals(); parts.push(g);
  }
  for (const s of [-1, 1]) { const P = [], I = []; const nu = 6, nv = 3; for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) { const u = i / nu, v = j / nv; const a = u * 1.6; P.push(s * (0.055 + 0.012 * v - Math.sin(a) * 0.012), -0.004 - (1 - Math.cos(a)) * 0.02 + v * 0.006, 0.19 + Math.sin(a) * 0.05); } for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = i * (nv + 1) + j, b = a + nv + 1; I.push(a, b, a + 1, b, b + 1, a + 1); } const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I); g.computeVertexNormals(); finAttr(g, 2, (x, y, z) => clamp((z - 0.19) / 0.05, 0, 1)); solid(g, '#2a3450', 0.02, 2); parts.push(g); }
  const tail = new THREE.CylinderGeometry(0.0015, 0.008, 0.42, 5, lo ? 6 : 16); tail.rotateX(-Math.PI / 2); tail.translate(0, 0.004, -0.36); finAttr(tail, 1, (x, y, z) => clamp((-0.15 - z) / 0.42, 0, 1)); solid(tail, '#1a2236', 0.02, 1); parts.push(tail);
  if (!lo) for (const s of [-1, 1]) { const e = new THREE.SphereGeometry(0.012, 12, 8); e.translate(s * 0.068, 0.012, 0.17); parts.push(solid(e, '#05060a', 0, 0)); const r = new THREE.TorusGeometry(0.012, 0.0025, 6, 16); r.rotateY(Math.PI / 2); r.translate(s * 0.074, 0.012, 0.17); parts.push(solid(r, '#9ae8ff', 1.4, 0)); }
  return merge(parts);
}

function squidGeometry(lo = false) {
  const parts = [], rs = lo ? 10 : 22;
  const mp = []; for (let i = 0; i <= 20; i++) { const t = i / 20; mp.push(new THREE.Vector2(0.075 * Math.pow(Math.sin(Math.PI * (0.5 + 0.5 * t)), 0.6) + 0.004, 0.5 * t)); }
  const mantle = new THREE.LatheGeometry(mp.reverse(), rs); mantle.rotateX(Math.PI / 2);
  { const p = mantle.attributes.position, c = new Float32Array(p.count * 3), gl = new Float32Array(p.count); for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const n = noise3(x * 60, y * 60, z * 30); tmpC.copy(C('#d0705a')).lerp(C('#ffc8b0'), sstep(0.02, -0.06, y)).lerp(C('#a03a30'), n > 0.6 ? 0.5 : 0); c.set([tmpC.r, tmpC.g, tmpC.b], i * 3); gl[i] = n > 0.74 ? 0.6 : 0.03; } mantle.setAttribute('color', new THREE.BufferAttribute(c, 3)); mantle.setAttribute('aGlow', new THREE.BufferAttribute(gl, 1)); mantle.deleteAttribute('uv'); finAttr(mantle, 0); }
  parts.push(mantle);
  for (const s of [-1, 1]) { const P = [], I = []; for (let i = 0; i <= 6; i++) for (let j = 0; j <= 2; j++) { const u = i / 6, v = j / 2; const z = 0.3 + u * 0.2, wdt = Math.sin(u * Math.PI) * 0.1 + 0.01; P.push(s * (0.03 + v * wdt), 0, z); } for (let i = 0; i < 6; i++) for (let j = 0; j < 2; j++) { const a = i * 3 + j, b = a + 3; I.push(a, b, a + 1, b, b + 1, a + 1); } const f = new THREE.BufferGeometry(); f.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); f.setIndex(I); f.computeVertexNormals(); finAttr(f, 2, (x) => clamp((Math.abs(x) - 0.03) / 0.1, 0, 1)); solid(f, '#f09070', 0.12, 2); parts.push(f); }
  const head = new THREE.SphereGeometry(0.06, 18, 12); head.scale(1, 0.9, 1.3); head.translate(0, 0, -0.03); parts.push(solid(head, '#e08068', 0.04, 0));
  if (!lo) for (const s of [-1, 1]) { const e = new THREE.SphereGeometry(0.03, 16, 12); e.translate(s * 0.05, 0.01, -0.03); parts.push(solid(e, '#0a0c18', 0, 0)); const ring = new THREE.TorusGeometry(0.031, 0.005, 6, 20); ring.rotateY(Math.PI / 2); ring.translate(s * 0.058, 0.01, -0.03); parts.push(solid(ring, '#a8e8ff', 1.6, 0)); const hl = new THREE.SphereGeometry(0.008, 8, 6); hl.translate(s * 0.075, 0.022, -0.02); parts.push(solid(hl, '#ffffff', 1.6, 0)); }
  for (let k = 0; k < 10; k++) {
    const a = k / 10 * Math.PI * 2, long = k === 2 || k === 7, len = long ? 0.75 : 0.32, rad = long ? 0.008 : 0.016;
    const arm = new THREE.CylinderGeometry(rad * 0.25, rad, len, lo ? 4 : 6, long ? 24 : 12); arm.translate(0, -len / 2, 0); arm.rotateX(Math.PI / 2);
    const p = arm.attributes.position; for (let i = 0; i < p.count; i++) { const zz = p.getZ(i), t = -zz / len; p.setX(i, p.getX(i) + Math.cos(a) * 0.035 * (1 + t * (long ? 0.6 : 1.4))); p.setY(i, p.getY(i) + Math.sin(a) * 0.035 * (1 + t * (long ? 0.6 : 1.4))); p.setZ(i, zz - 0.07); }
    arm.computeVertexNormals(); solid(arm, '#d8735a', 0.04, 1); parts.push(arm);
    if (long) { const club = new THREE.SphereGeometry(0.018, 8, 6); club.scale(1, 1, 2.2); club.translate(Math.cos(a) * 0.035 * 1.6, Math.sin(a) * 0.035 * 1.6, -0.07 - len); parts.push(solid(club, '#f0a080', 0.6, 1)); }
  }
  return merge(parts);
}

// Species table (ids kept for save compatibility; manta + eel are new)
export const SPECIES = {
  lantern: {
    kind: 'school', len: 0.42, speed: 2.5, minSpeed: 1.1, start: 48, max: 160, step: 24, cost: 0, addCost: 8, y: [3, 13], freq: 13, wave: [5.4, 0.02, 0.12, 0.012],
    sep: 0.52, nbr: 1.8,
    shape: { H: 0.14, W: 0.075, peak: 0.45, r0: 0.18, tailLen: 0.2, tailH: 0.11, fork: 0.65, dorsal: { z0: -0.05, z1: 0.12, h: 0.06, rake: 0.03 }, anal: { z0: -0.22, z1: -0.04, h: 0.04, rake: 0.02 }, pelvic: 0.04, eyeR: 0.05, eyeT: 0.84, iris: '#9ab8d8' },
    paint: (c, z, sa) => { c.copy(C('#6c84a2')).lerp(C('#142038'), sstep(0.02, 0.65, sa)).lerp(C('#b4c2d6'), sstep(-0.25, -0.9, sa)); if (Math.abs(z - 0.32) < 0.012 && Math.abs(sa) < 0.5) c.lerp(C('#3a4a66'), 0.6); const row = Math.abs(sa + 0.55) < 0.11 || Math.abs(sa + 0.86) < 0.07; const dot = Math.abs((z * 24) - Math.round(z * 24)) < 0.2; if (row && dot && z > -0.28 && z < 0.36) { c.copy(C('#7ff8ff')); return 2.2; } return 0; },
    fin: (c, k, u, v) => { c.copy(C('#4a5c7c')).lerp(C('#8aa6c8'), v * 0.4); return 0; }, sheen: C('#2a5a9a'),
  },
  hatchet: {
    kind: 'school', len: 0.38, speed: 1.9, minSpeed: 0.8, start: 0, max: 60, step: 12, cost: 20, addCost: 10, y: [4, 14], freq: 11, wave: [5.0, 0.02, 0.1, 0.01],
    sep: 0.4, nbr: 1.9, metal: 0.55, rough: 0.28,
    shape: { H: 0.44, W: 0.06, peak: 0.42, r0: 0.12, belly: 1.25, keel: 0.6, tailLen: 0.2, tailH: 0.12, fork: 0.5, nose: 0.6, dorsal: { z0: -0.12, z1: 0.0, h: 0.06, rake: 0.02 }, anal: { z0: -0.26, z1: -0.08, h: 0.035 }, eyeR: 0.065, eyeT: 0.8, eyeY: 0.45, iris: '#c8e0ff', irisGlow: 0.4 },
    paint: (c, z, sa) => { c.copy(C('#b8c4d6')).lerp(C('#2a3654'), sstep(0.25, 0.85, sa)); if (sa < -0.86 && Math.abs((z * 30) - Math.round(z * 30)) < 0.26 && z > -0.28 && z < 0.38) { c.copy(C('#80b8ff')); return 2.0; } return 0; },
    fin: (c) => { c.copy(C('#a8b8d0')); return 0.04; }, sheen: C('#5585c8'),
  },
  angler: {
    kind: 'swim', mode: 'fish', len: 0.8, speed: 0.75, minSpeed: 0.2, start: 0, max: 5, step: 1, cost: 35, addCost: 25, y: [1.4, 6], freq: 5, turn: 1.4, wave: [4.6, 0.015, 0.09, 0.03],
    glide: 0.6, burst: 0.08, floor: true,
    shape: { H: 0.36, W: 0.32, peak: 0.55, r0: 0.25, nose: 0.45, tailLen: 0.16, tailH: 0.16, fork: 0.0, pect: 0.15, eyeR: 0.06, eyeT: 0.8, eyeY: 0.42, iris: '#d8c8e8', lure: true, dorsal: { z0: -0.3, z1: -0.08, h: 0.08, pow: 1 }, anal: { z0: -0.3, z1: -0.12, h: 0.07, pow: 1 } },
    paint: (c, z, sa, ca) => { c.copy(C('#3e2846')).lerp(C('#8a6a88'), sstep(0.0, -0.7, sa)); if (noise3(z * 18, sa * 4, ca * 4) > 0.66) c.lerp(C('#c8a8c8'), 0.5); if (z > 0.43 && Math.abs(sa + 0.1) < 0.09) c.copy(C('#1e1020')); if (z > 0.44 && sa < -0.1 && Math.abs((ca * 9) - Math.round(ca * 9)) < 0.15) { c.copy(C('#f0eadc')); return 0.15; } return 0.02; },
    fin: (c, kind, u, v) => { c.copy(C('#4e3456')).lerp(C('#a088b0'), v * 0.6); return 0.04; }, sheen: C('#402048'),
  },
  eel: {
    kind: 'swim', mode: 'eel', len: 2.0, speed: 0.9, minSpeed: 0.35, start: 0, max: 4, step: 1, cost: 40, addCost: 22, y: [0.8, 3.5], freq: 3.2, turn: 1.2, wave: [12.5, 0.045, 0.08, 0.004],
    glide: 0.2, burst: 0.05, floor: true,
    shape: { nz: 70, na: 12, H: 0.034, W: 0.028, peak: 0.2, r0: 0.35, nose: 0.75, tailLen: 0.05, tailH: 0.022, fork: 0, pect: 0.025, eyeR: 0.011, eyeT: 0.94, eyeY: 0.3, iris: '#ffe8a0', irisGlow: 0.6, dorsal: { z0: -0.46, z1: 0.32, h: 0.022, nu: 40, pow: 0.5 }, anal: { z0: -0.46, z1: 0.0, h: 0.018, nu: 30, pow: 0.5 } },
    paint: (c, z, sa) => { c.copy(C('#2a1c48')).lerp(C('#6a5aa0'), sstep(0.0, -0.8, sa)); if (z > 0.42 && sa < -0.2) c.lerp(C('#e8e0f0'), 0.6); const line = Math.abs(sa) < 0.14 && z < 0.42; const dash = Math.abs((z * 36) - Math.round(z * 36)) < 0.3; if (line && dash) { c.copy(C('#8afff0')); return 2.2; } return 0.02; },
    fin: (c, k, u, v) => { c.copy(C('#4a3a80')).lerp(C('#9ad8ff'), v * 0.7); return v > 0.85 ? 1.1 : 0.05; }, sheen: C('#4030a0'),
  },
  jelly: { kind: 'jelly', len: 1.0, start: 0, max: 16, step: 4, cost: 45, addCost: 12 },
  comb: { kind: 'comb', len: 0.8, start: 0, max: 14, step: 3, cost: 55, addCost: 15 },
  dumbo: { kind: 'dumbo', len: 0.9, start: 0, max: 4, step: 1, cost: 80, addCost: 50, speed: 0.7, minSpeed: 0.25, y: [1.8, 9], turn: 0.8, wide: 18, freq: 2.2, glide: 0.5 },
  manta: {
    kind: 'swim', mode: 'ray', len: 5.2, speed: 1.6, minSpeed: 0.9, start: 0, max: 2, step: 1, cost: 140, addCost: 90, large: true, y: [6, 15], freq: 0.85, turn: 0.5, wide: 20, wave: [2.6, 0.32, 0, 0],
    glide: 0.35, burst: 0, bank: 0.9, predator: true,
  },
  squid: { kind: 'swim', mode: 'squid', len: 7.5, start: 0, max: 2, step: 1, cost: 170, addCost: 120, large: true, speed: 1.6, minSpeed: 0.9, y: [8, 16], turn: 0.4, wide: 24, freq: 2.6, glide: 0.4, bank: 0.4, predator: true },
  whale: {
    kind: 'swim', mode: 'whale', len: 13, speed: 1.8, minSpeed: 1.1, start: 0, max: 1, step: 1, cost: 260, addCost: 0, y: [13, 19], turn: 0.28, freq: 1.3, large: true, wide: 28, wave: [3.4, 0.004, 0.11, 0], glide: 0.3, bank: 0.35, predator: true,
    shape: { nz: 120, na: 44, big: true, H: 0.12, W: 0.11, peak: 0.72, r0: 0.1, nose: 0.12, belly: 0.9, tailLen: 0.16, tailH: 0.17, fork: 0.35, flukes: true, dorsal: { z0: -0.1, z1: 0.0, h: 0.025, pow: 1.2 }, pect: 0.06, eyeR: 0.008, eyeT: 0.84, eyeY: -0.1, iris: '#30343c' },
    paint: (c, z, sa, ca) => { c.copy(C('#545c6c')).lerp(C('#7a8494'), sstep(-0.3, -0.9, sa)); const n = noise3(z * 40, sa * 6, ca * 6); if (n > 0.62 && n < 0.66) c.lerp(C('#9aa2b4'), 0.5); if (z > 0.2 && sa < -0.3 && Math.abs(ca) < 0.4) c.lerp(C('#d8dce4'), 0.5 * sstep(0.2, 0.3, z)); return 0.02; },
    fin: (c, kind, u) => { c.copy(C('#4a5262')).lerp(C('#6a7282'), u * 0.4); return 0; }, sheen: C('#203040'),
  },
};
export const SPECIES_ORDER = ['lantern', 'hatchet', 'angler', 'eel', 'jelly', 'comb', 'dumbo', 'manta', 'squid', 'whale'];

// Shared instanced renderer with LOD (hi near the camera, lo far away)
const UPV = new THREE.Vector3(0, 1, 0);
const v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3(), m4 = new THREE.Matrix4();
function writeBasis(arr, o, p, f, roll, sc) {
  let rx = f.z, rz = -f.x; const rl = Math.hypot(rx, rz); if (rl < 1e-4) { rx = 1; rz = 0; } else { rx /= rl; rz /= rl; }
  const ux = f.y * rz, uy = f.z * rx - f.x * rz, uz = -f.y * rx;
  const c = Math.cos(roll), s = Math.sin(roll);
  const Xx = rx * c + ux * s, Xy = uy * s, Xz = rz * c + uz * s;
  const Yx = ux * c - rx * s, Yy = uy * c, Yz = uz * c - rz * s;
  arr[o] = Xx * sc; arr[o + 1] = Xy * sc; arr[o + 2] = Xz * sc; arr[o + 3] = 0;
  arr[o + 4] = Yx * sc; arr[o + 5] = Yy * sc; arr[o + 6] = Yz * sc; arr[o + 7] = 0;
  arr[o + 8] = f.x * sc; arr[o + 9] = f.y * sc; arr[o + 10] = f.z * sc; arr[o + 11] = 0;
  arr[o + 12] = p.x; arr[o + 13] = p.y; arr[o + 14] = p.z; arr[o + 15] = 1;
}
class LodMesh {
  constructor(geoHi, geoLo, mat, max, lodDist) {
    this.group = new THREE.Group(); this.lodDist = lodDist; this.max = max; this.levels = [];
    for (const geo of geoLo ? [geoHi, geoLo] : [geoHi]) {
      const a1 = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4), a2 = new THREE.InstancedBufferAttribute(new Float32Array(max * 4), 4);
      a1.setUsage(THREE.DynamicDrawUsage); a2.setUsage(THREE.DynamicDrawUsage); geo.setAttribute('aSwim', a1); geo.setAttribute('aSwim2', a2);
      const m = new THREE.InstancedMesh(geo, mat, max); m.count = 0; m.frustumCulled = false; m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      this.group.add(m); this.levels.push({ m, a1, a2, k: 0 });
    }
  }
  begin() { for (const L of this.levels) L.k = 0; }
  put(camPos, p, f, roll, sc, ph, amp, bend, pit, flash, seed, glide) {
    const far = this.levels.length > 1 && camPos && p.distanceToSquared(camPos) > this.lodDist * this.lodDist * Math.max(1, sc * 2);
    const L = far ? this.levels[1] : this.levels[0];
    const k = L.k++; writeBasis(L.m.instanceMatrix.array, k * 16, p, f, roll, sc);
    const a = L.a1.array, b = L.a2.array; a[k * 4] = ph; a[k * 4 + 1] = amp; a[k * 4 + 2] = bend; a[k * 4 + 3] = pit; b[k * 4] = flash; b[k * 4 + 1] = seed; b[k * 4 + 2] = glide; b[k * 4 + 3] = 0;
  }
  end() { for (const L of this.levels) { L.m.count = L.k; L.m.instanceMatrix.needsUpdate = true; L.a1.needsUpdate = true; L.a2.needsUpdate = true; } }
}
export const LOD = { dist: 11 };

// environment forces (rocks, seabed, boundary, ceiling)
function envForce(p, v, len, wide, yr, acc, k = 1) {
  for (const o of obstacles) {
    const dx = p.x - o.x, dy = p.y - o.y, dz = p.z - o.z, d2 = dx * dx + dy * dy + dz * dz, rr = o.r + Math.min(len, 3) * 0.5 + 0.5, rr2 = rr + 1.8;
    if (d2 < rr2 * rr2) { const d = Math.sqrt(d2) + 1e-4, w = Math.pow((rr2 - d) / 1.8, 2) * 7 * k; acc.x += dx / d * w; acc.y += dy / d * w * 0.5; acc.z += dz / d * w;
      const vn = (v.x * dx + v.z * dz) / d; if (vn < 0) { acc.x -= dx / d * vn * 1.2; acc.z -= dz / d * vn * 1.2; } }
  }
  const R = wide, rad = Math.hypot(p.x, p.z); if (rad > R) { acc.x -= p.x / rad * (rad - R) * 0.6; acc.z -= p.z / rad * (rad - R) * 0.6; }
  const fl = sandHeight(p.x, p.z) + 0.5 + Math.min(len, 4) * 0.25; if (p.y < fl + 1.0) acc.y += (fl + 1.0 - p.y) * 5;
  if (p.y > yr[1] + 1.5) acc.y -= (p.y - yr[1] - 1.5) * 1.2; if (p.y > 21) acc.y -= (p.y - 21) * 4;
}

// SCHOOL — boids with 3D modes: cruise (turn waves), bait-ball tornado, split & merge, flee/regroup
export class School {
  constructor(id) {
    const sp = SPECIES[id]; this.id = id; this.sp = sp; this.max = sp.max; this.n = 0; this.r = rng(id.length * 131 + 7);
    this.pos = []; this.vel = []; this.ph = []; this.bend = []; this.pit = []; this.roll = []; this.fwd = []; this.flash = []; this.startle = []; this.seed = []; this.fired = []; this.grow = []; this.side = []; this.glide = [];
    this.acc = new Float32Array(this.max * 3); this.ali = new Float32Array(this.max * 3); this.coh = new Float32Array(this.max * 3); this.cnt = new Float32Array(this.max); this.floorY = new Float32Array(this.max); this.stIn = new Float32Array(this.max); this.stT = new Float32Array(this.max);
    const mat = swimMaterial({ mode: 'fish', wave: sp.wave, sheen: sp.sheen, metal: sp.metal, rough: sp.rough, paintF: 18, self: 0.32 });
    this.render = new LodMesh(fishGeometry(sp.shape, sp.paint, sp.fin, false), fishGeometry(sp.shape, sp.paint, sp.fin, true), mat, this.max, LOD.dist);
    this.mesh = this.render.group;
    const L = id === 'lantern';
    this.C = new THREE.Vector3(0, 8, 0); this.V = new THREE.Vector3(1, 0, 0); this.T = new THREE.Vector3(L ? -4 : 6, L ? 8 : 10, L ? 3 : -5);
    this.dir = new THREE.Vector3(1, 0, 0.3).normalize(); this.mode = 'cruise'; this.modeT = 9 + this.r() * 4; this.turnT = 3; this.cycle = L ? 0 : 2;
    this.ball = { c: new THREE.Vector3(), R: 3, H: 4, dir: 1 }; this.split = { perp: new THREE.Vector3(), d: 5 }; this.wave = null; this.lock = false; this.time = 0;
  }
  add(arrive) {
    if (this.n >= this.max) return -1; const i = this.n++, r = this.r, p = new THREE.Vector3();
    if (arrive) { const a = r() * 6.28; p.set(Math.cos(a) * 26, 7 + r() * 4, Math.sin(a) * 26); }
    else if (i > 0) p.copy(this.pos[0]).add(v1.set(r() - 0.5, (r() - 0.5) * 0.6, r() - 0.5).multiplyScalar(2 + Math.sqrt(this.n) * 0.35));
    else p.copy(this.T);
    this.pos[i] = p; this.vel[i] = (arrive ? v1.set(-p.x, 0, -p.z).normalize() : v1.copy(this.dir)).clone().multiplyScalar(this.sp.speed);
    this.fwd[i] = this.vel[i].clone().normalize(); this.ph[i] = r() * 6.28; this.bend[i] = 0; this.pit[i] = 0; this.roll[i] = 0; this.flash[i] = 0; this.startle[i] = 0; this.seed[i] = r(); this.fired[i] = true; this.grow[i] = arrive ? 0.3 : 1; this.side[i] = 1; this.glide[i] = 0;
    this.floorY[i] = sandHeight(p.x, p.z);
    return i;
  }
  setMode(m) {
    const sp = this.sp, r = this.r; this.mode = m;
    if (m === 'ball') { const b = this.ball; b.c.copy(this.C); const rad = Math.hypot(b.c.x, b.c.z); if (rad > 9) b.c.multiplyScalar(9 / rad); b.c.y = clamp(b.c.y, sp.y[0] + 3, sp.y[1] - 2); b.c.y = Math.max(b.c.y, sandHeight(b.c.x, b.c.z) + 5.5, 7); b.R = 0.7 + Math.sqrt(this.n) * 0.15; b.H = b.R * 1.45; b.dir = r() < 0.5 ? 1 : -1; this.modeT = 15 + r() * 4; }
    else if (m === 'split') { const s = this.split; s.perp.set(-this.dir.z, 0, this.dir.x).normalize(); s.d = 3 + Math.sqrt(this.n) * 0.35; for (let i = 0; i < this.n; i++) { const d = (this.pos[i].x - this.C.x) * s.perp.x + (this.pos[i].z - this.C.z) * s.perp.z; this.side[i] = d >= 0 ? 1 : -1; } this.modeT = 8 + r() * 3; }
    else { this.modeT = 11 + r() * 5; this.turnT = 1.5; }
  }
  newHeading(force) {
    const r = this.r, sp = this.sp, C0 = this.C;
    const a = r() * 6.28; v1.set(Math.cos(a), (r() - 0.5) * 0.5, Math.sin(a));
    const rad = Math.hypot(C0.x, C0.z); if (rad > 6) v1.addScaledVector(v2.set(-C0.x, 0, -C0.z).normalize(), rad / 8);
    const midY = (sp.y[0] + sp.y[1]) / 2; v1.y += (midY - C0.y) * 0.12; v1.normalize(); v1.y = clamp(v1.y, -0.4, 0.4); v1.normalize();
    if (!force && v1.dot(this.dir) > 0.8) v1.applyAxisAngle(UPV, 1.2 * (r() < 0.5 ? 1 : -1));
    this.dir.copy(v1);
    const ext = 1.5 + Math.sqrt(this.n) * 0.3; // the turn starts on the side facing the new heading and sweeps through
    this.wave = { o: C0.clone().addScaledVector(this.dir, ext), t0: this.time, c: 4.2 + this.sp.len * 2, dir: this.dir.clone() };
    for (let i = 0; i < this.n; i++) this.fired[i] = false;
  }
  scare(p, strength = 1) { for (let i = 0; i < this.n; i++) { const d = this.pos[i].distanceTo(p); if (d < 5) this.startle[i] = Math.max(this.startle[i], strength * (1 - d / 5)); } }
  step(dt, ctx) {
    if (!(dt > 1e-4) || !this.n) return;
    const sp = this.sp, n = this.n, time = (this.time += dt), r = this.r;
    let cx = 0, cy = 0, cz = 0, vx = 0, vy = 0, vz = 0; for (let i = 0; i < n; i++) { const p = this.pos[i], v = this.vel[i]; cx += p.x; cy += p.y; cz += p.z; vx += v.x; vy += v.y; vz += v.z; }
    this.C.set(cx / n, cy / n, cz / n); this.V.set(vx / n, vy / n, vz / n);
    if (!this.lock) { this.modeT -= dt; if (this.modeT <= 0) { const seq = ['ball', 'cruise', 'split', 'cruise']; this.setMode(seq[this.cycle++ % seq.length]); } }
    if (this.mode === 'cruise') { this.turnT -= dt; if (this.turnT <= 0) { this.newHeading(false); this.turnT = 4.5 + r() * 3; } }
    this.T.copy(this.C).addScaledVector(this.dir, 7);
    const A = this.acc, AL = this.ali, CO = this.coh, CN = this.cnt; A.fill(0, 0, n * 3); AL.fill(0, 0, n * 3); CO.fill(0, 0, n * 3); CN.fill(0, 0, n);
    const sep = sp.sep, sep2 = sep * sep, nb2 = sp.nbr * sp.nbr, st = this.startle, splitMode = this.mode === 'split';
    const SI = this.stIn, ST = this.stT; for (let i = 0; i < n; i++) { SI[i] = st[i]; ST[i] = 0; }
    for (let i = 0; i < n; i++) {
      const p = this.pos[i], vi = this.vel[i];
      for (let j = i + 1; j < n; j++) {
        const q = this.pos[j]; const dx = p.x - q.x, dy = p.y - q.y, dz = p.z - q.z, d2 = dx * dx + dy * dy + dz * dz;
        if (d2 > nb2) continue;
        const vj = this.vel[j];
        if (!splitMode || this.side[i] === this.side[j]) {
          const i3 = i * 3, j3 = j * 3;
          AL[i3] += vj.x; AL[i3 + 1] += vj.y; AL[i3 + 2] += vj.z; AL[j3] += vi.x; AL[j3 + 1] += vi.y; AL[j3 + 2] += vi.z;
          CO[i3] += q.x; CO[i3 + 1] += q.y; CO[i3 + 2] += q.z; CO[j3] += p.x; CO[j3 + 1] += p.y; CO[j3 + 2] += p.z; CN[i]++; CN[j]++;
        }
        if (d2 < sep2) { const d = Math.sqrt(d2) + 1e-4, w = (1 - d / sep) * 7 / d; A[i * 3] += dx * w; A[i * 3 + 1] += dy * w * 0.7; A[i * 3 + 2] += dz * w; A[j * 3] -= dx * w; A[j * 3 + 1] -= dy * w * 0.7; A[j * 3 + 2] -= dz * w; }
        // startle contagion travels fish-to-fish (one hop per frame, decaying) => visible flash ripple through the school
        if (SI[i] > 0.3) ST[j] = Math.max(ST[j], SI[i] * 0.8); if (SI[j] > 0.3) ST[i] = Math.max(ST[i], SI[j] * 0.8);
      }
    }
    for (let i = 0; i < n; i++) if (ST[i] > st[i]) st[i] += (ST[i] - st[i]) * Math.min(1, dt * 9);
    const threats = ctx.threats || [], food = ctx.food && ctx.food.length ? ctx.food : null;
    const wave = this.wave, waveR = wave ? (time - wave.t0) * wave.c : 0; if (wave && waveR > 30) this.wave = null;
    const ballMode = this.mode === 'ball', B = this.ball, frameNo = (time * 60) | 0;
    for (let i = 0; i < n; i++) {
      const p = this.pos[i], v = this.vel[i], ax = v3.set(A[i * 3], A[i * 3 + 1], A[i * 3 + 2]);
      const sf = 0.88 + 0.24 * this.seed[i];
      let spd = sp.speed * sf * (1 + 0.12 * Math.sin(time * 0.7 + this.seed[i] * 40));
      const c = CN[i];
      if (c > 0) {
        const aliW = ballMode ? 0.6 : 1.5, cohW = ballMode ? 0.1 : 0.7;
        ax.x += (AL[i * 3] / c - v.x) * aliW; ax.y += (AL[i * 3 + 1] / c - v.y) * aliW; ax.z += (AL[i * 3 + 2] / c - v.z) * aliW;
        ax.x += (CO[i * 3] / c - p.x) * cohW; ax.y += (CO[i * 3 + 1] / c - p.y) * cohW; ax.z += (CO[i * 3 + 2] / c - p.z) * cohW;
      } else ax.addScaledVector(v1.subVectors(this.C, p), 0.35);
      if (!splitMode) { const dc = p.distanceTo(this.C), far = clamp((dc - 3) / 6, 0, 1); if (far > 0) ax.addScaledVector(v1.subVectors(this.C, p), far * 0.9 / dc * 3); }
      if (ballMode) { // bait-ball tornado: tangential swirl + radial spring (wider at the top), layered heights
        const rx = p.x - B.c.x, ry = p.y - B.c.y, rz = p.z - B.c.z, rh = Math.hypot(rx, rz) + 1e-3;
        const layer = 0.3 + 0.7 * Math.sqrt(this.seed[i]);
        const yT = Math.sin(this.seed[i] * 6.28 + time * 0.35) * B.H * 0.5;
        const Rd = B.R * layer * (0.72 + 0.38 * clamp(ry / B.H + 0.5, 0, 1.2));
        spd *= 1.1;
        const tx = -rz / rh * B.dir, tz = rx / rh * B.dir;
        const dvx = tx * spd + (Rd - rh) * rx / rh * 1.6, dvz = tz * spd + (Rd - rh) * rz / rh * 1.6, dvy = (yT - ry) * 0.9;
        ax.x += (dvx - v.x) * 2.6; ax.y += (dvy - v.y) * 2.0; ax.z += (dvz - v.z) * 2.6;
      } else {
        const tgt = splitMode ? v1.copy(this.T).addScaledVector(this.split.perp, this.side[i] * this.split.d) : v1.copy(this.T);
        v2.subVectors(tgt, p); const dl = v2.length() + 1e-3; v2.multiplyScalar(spd / dl);
        const w = splitMode ? 1.1 : 0.45; ax.x += (v2.x - v.x) * w; ax.y += (v2.y - v.y) * w * 0.8; ax.z += (v2.z - v.z) * w;
      }
      if (wave && !this.fired[i] && p.distanceTo(wave.o) <= waveR + (1 - this.seed[i]) * 0.3) {
        this.fired[i] = true; const s = v.length(); v.lerp(v1.copy(wave.dir).multiplyScalar(s), 0.75).normalize().multiplyScalar(s * 1.25); this.flash[i] = Math.max(this.flash[i], 0.55);
      }
      for (const th of threats) {
        const dx = p.x - th.p.x, dy = p.y - th.p.y, dz = p.z - th.p.z, d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < th.r * th.r) { const d = Math.sqrt(d2) + 1e-3, k = 1 - d / th.r; ax.x += dx / d * k * 22 * th.k; ax.y += dy / d * k * 12 * th.k; ax.z += dz / d * k * 22 * th.k; st[i] = Math.max(st[i], k * th.k); }
      }
      if (food) { let best = null, bd = 1e9; for (const f of food) { if (f.eaten) continue; const d = f.p.distanceToSquared(p); if (d < bd) { bd = d; best = f; } } if (best && bd < 220) { ax.addScaledVector(v1.subVectors(best.p, p).normalize(), 6); spd *= 1.25; if (bd < 0.1) ctx.onEat(best, this, i); } }
      if ((i + frameNo) % 6 === 0) this.floorY[i] = sandHeight(p.x, p.z);
      envForce(p, v, sp.len, 22, sp.y, ax, 1);
      const fl = this.floorY[i] + 1.0; if (p.y < fl) ax.y += (fl - p.y) * 8;
      const S = st[i]; if (S > 0.02) { spd *= 1 + 1.4 * S; this.flash[i] = Math.max(this.flash[i], S * 0.8); ax.x += Math.sin(this.seed[i] * 91 + time * 7) * S * 3; ax.z += Math.cos(this.seed[i] * 71 + time * 6) * S * 3; }
      st[i] = Math.max(0, S - dt * 0.9); this.flash[i] = Math.max(0, this.flash[i] - dt * 1.4);
      const gl = Math.max(0, Math.sin(time * 0.5 + this.seed[i] * 30) - 0.75) * 4; this.glide[i] += (gl - this.glide[i]) * Math.min(1, dt * 3);
      spd *= 1 - this.glide[i] * 0.18;
      v.x += ax.x * dt; v.y += ax.y * dt; v.z += ax.z * dt;
      let s = v.length() + 1e-5; const sT = s + (clamp(spd, sp.minSpeed, sp.speed * 2.8) - s) * Math.min(1, dt * 2.2); v.multiplyScalar(sT / s); s = sT;
      if (Math.abs(v.y) > s * 0.55) v.y = Math.sign(v.y) * s * 0.55;
      p.addScaledVector(v, dt);
      const f = this.fwd[i]; const ox = f.x, oy = f.y, oz = f.z;
      f.lerp(v1.copy(v).multiplyScalar(1 / s), Math.min(1, dt * 9)).normalize();
      const yawRate = (oz * f.x - ox * f.z) / dt, pitchRate = (f.y - oy) / dt;
      this.roll[i] += (clamp(-yawRate * 0.22, -0.75, 0.75) - this.roll[i]) * Math.min(1, dt * 5);
      this.bend[i] += (clamp(yawRate * 0.11, -0.35, 0.35) - this.bend[i]) * Math.min(1, dt * 7);
      this.pit[i] += (clamp(-pitchRate * 0.1, -0.25, 0.25) - this.pit[i]) * Math.min(1, dt * 6);
      this.ph[i] += dt * sp.freq * (0.35 + 0.65 * s / sp.speed) * (1 - this.glide[i] * 0.7);
      if (this.grow[i] < 1) this.grow[i] = Math.min(1, this.grow[i] + dt * 0.3);
    }
  }
  sync(camera) {
    const R = this.render, sp = this.sp, cp = camera ? camera.position : null; R.lodDist = LOD.dist; R.begin();
    for (let i = 0; i < this.n; i++) {
      const s = this.vel[i].length(), amp = (0.45 + 0.55 * Math.min(1.6, s / sp.speed)) * (1 - this.glide[i] * 0.75) + this.startle[i] * 0.4;
      R.put(cp, this.pos[i], this.fwd[i], this.roll[i], sp.len * this.grow[i], this.ph[i], amp, this.bend[i], this.pit[i], this.flash[i], this.seed[i], this.glide[i]);
    }
    R.end();
  }
}

// SWIMMERS — individuals with 3D wander targets, bursts & glides, banking (angler, eel, manta, squid, whale)
class Mover {
  constructor(id) {
    const sp = SPECIES[id]; this.id = id; this.sp = sp; this.max = sp.max; this.n = 0; this.r = rng(id.length * 97 + 3 + id.charCodeAt(0));
    this.pos = []; this.vel = []; this.ph = []; this.bend = []; this.pit = []; this.roll = []; this.fwd = []; this.tgt = []; this.tgtT = []; this.grow = []; this.burst = []; this.glide = []; this.glideT = []; this.seed = [];
  }
  randomPoint(out, ctx) {
    const sp = this.sp, r = this.r;
    if (sp.predator && ctx && ctx.schoolC && r() < 0.45) { out.copy(ctx.schoolC).add(v1.set((r() - 0.5) * 4, (r() - 0.5) * 2, (r() - 0.5) * 4)); out.y = clamp(out.y, sp.y[0], sp.y[1]); return out; }
    const R = sp.wide || 18, a = r() * 6.28, d = Math.sqrt(r()) * R;
    out.set(Math.cos(a) * d, 0, Math.sin(a) * d);
    const fl = sandHeight(out.x, out.z);
    out.y = sp.floor ? fl + sp.y[0] + r() * (sp.y[1] - sp.y[0]) : Math.max(fl + 2 + Math.min(sp.len, 4) * 0.4, sp.y[0] + r() * (sp.y[1] - sp.y[0]));
    return out;
  }
  add(arrive) {
    if (this.n >= this.max) return -1;
    const i = this.n++, r = this.r, p = new THREE.Vector3();
    if (arrive) { const a = r() * 6.28; p.set(Math.cos(a) * 30, (this.sp.y[0] + this.sp.y[1]) / 2 + (this.sp.floor ? 2 : 0), Math.sin(a) * 30); } else this.randomPoint(p);
    this.pos[i] = p; this.vel[i] = new THREE.Vector3(arrive ? -p.x : r() - 0.5, 0, arrive ? -p.z : r() - 0.5).normalize().multiplyScalar(this.sp.speed || 1);
    this.fwd[i] = this.vel[i].clone().normalize(); this.ph[i] = r() * 6.28; this.bend[i] = 0; this.pit[i] = 0; this.roll[i] = 0; this.seed[i] = r();
    this.tgt[i] = this.randomPoint(new THREE.Vector3()); this.tgtT[i] = 3 + r() * 6; this.grow[i] = arrive ? 0.2 : 1; this.burst[i] = 0; this.glide[i] = 0; this.glideT[i] = 2 + r() * 5;
    return i;
  }
  step(dt, ctx) {
    if (!(dt > 1e-4)) return;
    const sp = this.sp, n = this.n, r = this.r;
    for (let i = 0; i < n; i++) {
      const p = this.pos[i], v = this.vel[i], ax = v3.set(0, 0, 0);
      this.tgtT[i] -= dt; if (this.tgtT[i] <= 0 || p.distanceToSquared(this.tgt[i]) < Math.max(2, sp.len * sp.len * 0.5)) { this.randomPoint(this.tgt[i], ctx); this.tgtT[i] = 5 + r() * 9; }
      if (sp.burst && r() < dt * sp.burst) this.burst[i] = 1;
      this.burst[i] = Math.max(0, this.burst[i] - dt * 0.6);
      this.glideT[i] -= dt; if (this.glideT[i] <= 0) { if (this.glide[i] > 0.5) { this.glide[i] = 0; this.glideT[i] = 3 + r() * 6; } else { this.glide[i] = 1; this.glideT[i] = 1.5 + r() * 3 * (sp.glide || 0.3); } }
      const gl = this.glide[i] * (sp.glide || 0);
      let spd = (sp.minSpeed + (sp.speed - sp.minSpeed) * (0.55 + 0.45 * Math.sin(U.uTime.value * 0.13 + this.seed[i] * 20))) * (1 - gl * 0.45) * (1 + this.burst[i] * 1.5);
      if (ctx.food && ctx.food.length && !sp.large) { let best = null, bd = 1e9; for (const f of ctx.food) { if (f.eaten) continue; const d = f.p.distanceToSquared(p); if (d < bd) { bd = d; best = f; } } if (best && bd < 300) { this.tgt[i].copy(best.p); spd *= 1.4; if (bd < 0.12 + sp.len * 0.15) ctx.onEat(best, this, i); } }
      v2.subVectors(this.tgt[i], p); const dl = v2.length() + 1e-3; v2.multiplyScalar(spd / dl);
      const turn = sp.turn || 1; ax.x += (v2.x - v.x) * turn; ax.y += (v2.y - v.y) * turn * 0.7; ax.z += (v2.z - v.z) * turn;
      if (!sp.large && ctx.threats) for (const th of ctx.threats) { const dx = p.x - th.p.x, dy = p.y - th.p.y, dz = p.z - th.p.z, d = Math.hypot(dx, dy, dz), R = th.r * 0.7; if (d < R && d > 1e-3) { const k = (1 - d / R) * th.k; ax.x += dx / d * k * 6; ax.y += dy / d * k * 3; ax.z += dz / d * k * 6; this.burst[i] = Math.max(this.burst[i], k * 0.7); } }
      envForce(p, v, sp.len, (sp.wide || 18) + 4, sp.floor ? [0, 30] : sp.y, ax, sp.large ? 0.6 : 1);
      if (sp.floor) { const hT = sandHeight(p.x, p.z) + sp.y[1]; if (p.y > hT) ax.y -= (p.y - hT) * 1.5; }
      for (let j = 0; j < n; j++) { if (j === i) continue; const q = this.pos[j], dx = p.x - q.x, dy = p.y - q.y, dz = p.z - q.z, d = Math.hypot(dx, dy, dz), rr = sp.len * 1.2 + 0.5; if (d < rr && d > 1e-3) { const k = (rr - d) / rr * 3; ax.x += dx / d * k; ax.y += dy / d * k; ax.z += dz / d * k; } }
      v.addScaledVector(ax, dt);
      let s = v.length() + 1e-5; const sT = clamp(s, sp.minSpeed * 0.6, sp.speed * (1 + this.burst[i] * 1.6) * 1.2); v.multiplyScalar(sT / s); s = sT;
      if (Math.abs(v.y) > s * 0.5) v.y = Math.sign(v.y) * s * 0.5;
      p.addScaledVector(v, dt);
      const f = this.fwd[i], ox = f.x, oy = f.y, oz = f.z;
      f.lerp(v1.copy(v).multiplyScalar(1 / s), Math.min(1, dt * (sp.large ? 1.5 : 4))).normalize();
      const yawRate = (oz * f.x - ox * f.z) / dt, pitchRate = (f.y - oy) / dt, bk = sp.bank ?? 0.5;
      this.roll[i] += (clamp(-yawRate * bk * 1.4, -bk, bk) - this.roll[i]) * Math.min(1, dt * 2.5);
      this.bend[i] += (clamp(yawRate * (sp.large ? 0.5 : 0.25), -0.4, 0.4) - this.bend[i]) * Math.min(1, dt * 4);
      this.pit[i] += (clamp(-pitchRate * 0.3, -0.3, 0.3) - this.pit[i]) * Math.min(1, dt * 4);
      this.ph[i] += dt * (sp.freq || 2) * (0.4 + 0.6 * s / sp.speed) * (1 - gl * 0.8) * (1 + this.burst[i] * 0.8);
      if (this.grow[i] < 1) this.grow[i] = Math.min(1, this.grow[i] + dt * 0.25);
    }
  }
}
export class Swimmers extends Mover {
  constructor(id) {
    super(id); const sp = this.sp;
    let hi, lo;
    if (sp.mode === 'ray') { hi = mantaGeometry(false); lo = mantaGeometry(true); }
    else if (sp.mode === 'squid') { hi = squidGeometry(false); lo = null; }
    else { hi = fishGeometry(sp.shape, sp.paint, sp.fin, false); lo = sp.large ? null : fishGeometry(sp.shape, sp.paint, sp.fin, true); }
    const mat = swimMaterial({ mode: sp.mode, wave: sp.wave || [5, 0, 0, 0], sheen: sp.sheen || C('#203050'), rough: sp.mode === 'ray' ? 0.55 : 0.5, paintF: sp.large ? 6 : 12 });
    this.render = new LodMesh(hi, lo, mat, this.max, LOD.dist * 1.6); this.mesh = this.render.group;
  }
  sync(camera) {
    const R = this.render, sp = this.sp, cp = camera ? camera.position : null; R.lodDist = LOD.dist * 1.6; R.begin();
    for (let i = 0; i < this.n; i++) {
      const s = this.vel[i].length(), gl = this.glide[i] * (sp.glide || 0);
      const amp = sp.mode === 'ray' ? (1 - gl * 0.7) * (0.8 + this.burst[i] * 0.4) : (0.45 + 0.55 * s / sp.speed) * (1 - gl * 0.7) + this.burst[i] * 0.4;
      R.put(cp, this.pos[i], this.fwd[i], this.roll[i], sp.len * this.grow[i], this.ph[i], amp, this.bend[i], this.pit[i], 0, this.seed[i], gl);
    }
    R.end();
  }
}

// DUMBO OCTOPUS — group models, 3D drifting, ear-fin flapping, web pulses
const deepLite = (mat) => { mat.onBeforeCompile = (sh) => { sh.uniforms.uRimCol = U.uRimCol; sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform vec3 uRimCol;').replace('#include <opaque_fragment>', `{ float fr = pow(1.0 - clamp(abs(dot(normal, normalize(vViewPosition))), 0.0, 1.0), 2.2); outgoingLight += uRimCol * fr * 1.2 + vec3(0.25, 0.08, 0.12) * fr; outgoingLight *= mix(vec3(1.0), vec3(0.72, 0.92, 1.05), 1.0 - exp(-0.6 * length(vViewPosition) * 0.045)); }\n#include <opaque_fragment>`); }; mat.customProgramCacheKey = () => 'deepLite'; return mat; };
function vcol(g, fn) { const p = g.attributes.position, c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { fn(tmpC, p.getX(i), p.getY(i), p.getZ(i)); c.set([tmpC.r, tmpC.g, tmpC.b], i * 3); } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); if (g.attributes.uv) g.deleteAttribute('uv'); return g; }
function dumboModel() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const mat = deepLite(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: THREE.DoubleSide }));
  const head = new THREE.SphereGeometry(0.32, 30, 22); head.scale(1, 1.12, 1); head.translate(0, 0.18, 0);
  vcol(head, (c, x, y, z) => { c.copy(C('#e87a7a')).lerp(C('#c8587a'), sstep(0.1, 0.5, y)); if (noise3(x * 14, y * 14, z * 14) > 0.68) c.lerp(C('#ffc0b0'), 0.5); });
  body.add(new THREE.Mesh(head, mat));
  const spr = []; for (let i = 0; i <= 10; i++) { const t = i / 10; spr.push(new THREE.Vector2(0.24 + t * 0.32 + Math.sin(t * 3) * 0.03, -t * 0.32)); }
  const skirt = new THREE.LatheGeometry(spr, 40); { const p = skirt.attributes.position; for (let i = 0; i < p.count; i++) { const a = Math.atan2(p.getZ(i), p.getX(i)), y = p.getY(i); p.setY(i, y + Math.sin(a * 8) * 0.02 * (-y / 0.32)); } }
  vcol(skirt, (c, x, y, z) => { const a = Math.atan2(z, x); const rib = Math.pow(Math.abs(Math.cos(a * 4)), 12); c.copy(C('#e07888')).lerp(C('#a8406a'), rib * 0.6).lerp(C('#ffb8c0'), sstep(-0.2, -0.32, y) * 0.5); }); skirt.computeVertexNormals();
  const sk = new THREE.Mesh(skirt, mat); sk.position.y = -0.02; body.add(sk);
  const ears = [];
  for (const s of [-1, 1]) { const piv = new THREE.Group(); piv.position.set(s * 0.22, 0.36, 0); const e = new THREE.SphereGeometry(0.16, 16, 10).scale(1, 0.25, 0.8); e.translate(s * 0.13, 0, 0); vcol(e, (c) => c.set('#e88098')); piv.add(new THREE.Mesh(e, mat)); body.add(piv); ears.push(piv); }
  for (const s of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), new THREE.MeshStandardMaterial({ color: '#0a0a14', roughness: 0.15 })); eye.position.set(s * 0.15, 0.2, 0.25); body.add(eye); const hl = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' })); hl.position.set(s * 0.15 + 0.02, 0.24, 0.31); body.add(hl); }
  root.userData = { ears, skirt: sk, body };
  return root;
}
export class Dumbos extends Mover {
  constructor() { super('dumbo'); this.mesh = new THREE.Group(); this.models = []; }
  add(arrive) { const i = super.add(arrive); if (i >= 0) { const m = dumboModel(); this.models.push(m); this.mesh.add(m); } return i; }
  sync() {
    for (let i = 0; i < this.n; i++) {
      const m = this.models[i], f = this.fwd[i], ph = this.ph[i]; m.position.copy(this.pos[i]); m.position.y += Math.sin(ph * 0.5) * 0.12;
      m.rotation.set(0, Math.atan2(f.x, f.z), this.roll[i] * 0.6, 'YXZ'); m.userData.body.rotation.x = 0.35 - Math.asin(clamp(f.y, -0.6, 0.6)) + Math.sin(ph * 0.5) * 0.08; m.scale.setScalar(this.sp.len * this.grow[i]);
      const [l, r] = m.userData.ears; const fl = Math.sin(ph * 2) * (0.55 - this.glide[i] * 0.35); l.rotation.z = fl; r.rotation.z = -fl;
      const sk = m.userData.skirt, k = Math.sin(ph); sk.scale.set(1 + k * 0.09, 1 - k * 0.11, 1 + k * 0.09);
    }
  }
}

// JELLIES — pulsing bell (thrust on contraction, tilting axis) + verlet tentacles & oral arms as soft ribbons
const BELL_VS = `
  uniform float uTime; attribute vec2 aPh; varying float vH; varying vec3 vN; varying vec3 vV; varying vec2 vXZ; varying float vC; varying float vSeed;
  void main(){
    vec3 p = position; float c = aPh.x;
    float k = smoothstep(0.1, 0.5, 0.5 - p.y);
    p.xz *= 1.0 - c * 0.2 * k; p.y *= 1.0 + c * 0.12; p.y -= c * 0.05 * k;
    p.y += sin(atan(p.z, p.x + 1e-4) * 16.0) * 0.012 * k;
    vH = position.y; vXZ = position.xz; vC = c; vSeed = aPh.y;
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(p, 1.0);
    vN = normalize(normalMatrix * mat3(instanceMatrix) * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv;
  }`;
const BELL_FS = `
  uniform vec3 uCol; uniform vec3 uGlow; uniform float uTime; varying float vH; varying vec3 vN; varying vec3 vV; varying vec2 vXZ; varying float vC; varying float vSeed;
  void main(){
    float fr = pow(clamp(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 1.7); float fade = exp(-length(vV) * 0.032);
    float ang = atan(vXZ.y, vXZ.x + 1e-4);
    float rim = smoothstep(0.06, 0.0, abs(vH - 0.02)) * (0.6 + 0.4 * sin(ang * 16.0));
    float canal = pow(abs(cos(ang * 4.0)), 24.0) * step(0.12, vH) * 0.45;
    float gon = smoothstep(0.07, 0.0, abs(length(abs(vXZ) - vec2(0.11)) - 0.06)) * step(0.28, vH);
    float wave = 0.55 + 0.45 * sin(uTime * 1.6 - ang * 2.0 + vSeed * 6.0);
    vec3 c = uCol * (0.1 + fr * 0.7) + uGlow * (rim * (0.5 + 0.6 * wave) + canal * (0.5 + vC * 0.6) + gon * 0.55);
    gl_FragColor = vec4(c * fade * 0.68, 1.0);
  }`;
const RIB_VS = `attribute float aT; attribute float aA; varying float vT; varying float vA; varying float vD; void main(){ vT = aT; vA = aA; vec4 mv = modelViewMatrix * vec4(position, 1.0); vD = -mv.z; gl_Position = projectionMatrix * mv; }`;
const RIB_FS = `uniform vec3 uCol; uniform vec3 uGlow; varying float vT; varying float vA; varying float vD; void main(){ float a = pow(1.0 - vT, 1.3) * vA * exp(-vD * 0.032); vec3 c = mix(uGlow, uCol, vT * 0.8); gl_FragColor = vec4(c * a * 0.7, 1.0); }`;
export class Jellies {
  constructor(id = 'jelly') {
    this.id = id; this.sp = SPECIES[id]; this.max = this.sp.max; this.n = 0; this.pos = []; this.vel = []; this.axis = []; this.grow = []; this.phase = []; this.rate = []; this.size = []; this.wander = []; this.r = rng(1234);
    this.col = C('#5a3ad0'); this.glowC = C('#5af0ff').multiplyScalar(1.25);
    const bell = new THREE.LatheGeometry(Array.from({ length: 16 }, (_, i) => { const t = i / 15; return new THREE.Vector2(Math.sin(t * Math.PI / 2) * 0.5 * (1 + 0.1 * t), Math.cos(t * Math.PI / 2) * 0.5 - 0.06 * t * t); }), 40);
    this.aPh = new THREE.InstancedBufferAttribute(new Float32Array(this.max * 2), 2); this.aPh.setUsage(THREE.DynamicDrawUsage); bell.setAttribute('aPh', this.aPh);
    this.bell = new THREE.InstancedMesh(bell, new THREE.ShaderMaterial({ uniforms: { uTime: U.uTime, uCol: { value: this.col }, uGlow: { value: this.glowC } }, vertexShader: BELL_VS, fragmentShader: BELL_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }), this.max);
    this.bell.count = 0; this.bell.frustumCulled = false; this.bell.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.TN = 12; this.NN = 14; this.OA = 4; this.NA = 9;
    const per = this.TN * this.NN + this.OA * this.NA; this.nodesPer = per;
    this.cur = new Float32Array(this.max * per * 3); this.prev = new Float32Array(this.max * per * 3);
    const vcount = this.max * per * 2; this.rpos = new Float32Array(vcount * 3); const aT = new Float32Array(vcount), aA = new Float32Array(vcount), idx = [];
    let vi = 0; for (let j = 0; j < this.max; j++) for (let s = 0; s < this.TN + this.OA; s++) { const N = s < this.TN ? this.NN : this.NA; for (let k = 0; k < N; k++) { aT[vi] = aT[vi + 1] = k / (N - 1); if (k < N - 1) idx.push(vi, vi + 1, vi + 2, vi + 1, vi + 3, vi + 2); vi += 2; } }
    this.rgeo = new THREE.BufferGeometry(); this.rgeo.setAttribute('position', new THREE.BufferAttribute(this.rpos, 3).setUsage(THREE.DynamicDrawUsage)); this.rgeo.setAttribute('aT', new THREE.BufferAttribute(aT, 1)); this.aA = new THREE.BufferAttribute(aA, 1).setUsage(THREE.DynamicDrawUsage); this.rgeo.setAttribute('aA', this.aA); this.rgeo.setIndex(idx);
    this.ribbons = new THREE.Mesh(this.rgeo, new THREE.ShaderMaterial({ uniforms: { uCol: { value: this.col.clone().multiplyScalar(0.9) }, uGlow: { value: this.glowC.clone().multiplyScalar(0.8) } }, vertexShader: RIB_VS, fragmentShader: RIB_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    this.ribbons.frustumCulled = false; this.rgeo.setDrawRange(0, 0);
    this.mesh = new THREE.Group(); this.mesh.add(this.bell, this.ribbons);
  }
  add(arrive) {
    if (this.n >= this.max) return -1; const i = this.n++, r = this.r; const a = r() * 6.28, d = arrive ? 24 : 5 + r() * 15;
    this.pos[i] = new THREE.Vector3(Math.cos(a) * d + 3, 6 + r() * 9, Math.sin(a) * d - 3); this.vel[i] = new THREE.Vector3(); this.axis[i] = new THREE.Vector3((r() - 0.5) * 0.4, 1, (r() - 0.5) * 0.4).normalize();
    this.grow[i] = arrive ? 0.1 : 1; this.phase[i] = r() * 6.28; this.rate[i] = 1.6 + r() * 0.8; this.size[i] = 0.85 + r() * 0.5; this.wander[i] = r() * 100;
    const base = i * this.nodesPer * 3; let k = 0;
    for (let s = 0; s < this.TN + this.OA; s++) { const N = s < this.TN ? this.NN : this.NA; for (let q = 0; q < N; q++) { const o = base + (k + q) * 3; this.cur[o] = this.prev[o] = this.pos[i].x; this.cur[o + 1] = this.prev[o + 1] = this.pos[i].y - q * 0.15; this.cur[o + 2] = this.prev[o + 2] = this.pos[i].z; } k += N; }
    return i;
  }
  contraction(i) { const s = (this.phase[i] % 6.2832) / 6.2832; return s < 0.3 ? Math.sin(s / 0.3 * Math.PI * 0.5) : Math.pow(1 - (s - 0.3) / 0.7, 2); }
  step(dt, ctx) {
    if (!(dt > 1e-4)) return; const t = U.uTime.value;
    for (let i = 0; i < this.n; i++) {
      const p = this.pos[i], v = this.vel[i], ax = this.axis[i];
      const c0 = this.contraction(i); this.phase[i] += dt * this.rate[i]; const c1 = this.contraction(i);
      const w = this.wander[i]; v1.set(Math.sin(t * 0.07 + w) * 0.55, 1, Math.cos(t * 0.06 + w * 1.3) * 0.55);
      const rad = Math.hypot(p.x, p.z); if (rad > 18) v1.addScaledVector(v2.set(-p.x / rad, 0, -p.z / rad), (rad - 18) * 0.3);
      if (p.y > 17) v1.y -= (p.y - 17) * 0.6; const fl = sandHeight(p.x, p.z) + 3; if (p.y < fl) v1.y += (fl - p.y);
      for (const o of obstacles) { const dx = p.x - o.x, dy = p.y - o.y, dz = p.z - o.z, d = Math.hypot(dx, dy, dz), rr = o.r + 2; if (d < rr) v1.add(v2.set(dx, dy, dz).multiplyScalar((rr - d) / d)); }
      if (ctx && ctx.threats) for (const th of ctx.threats) { if (!th.large) continue; const d = p.distanceTo(th.p); if (d < th.r) v1.add(v2.subVectors(p, th.p).multiplyScalar(0.6 / d)); }
      v1.normalize(); ax.lerp(v1, Math.min(1, dt * 0.35)).normalize();
      const thrust = Math.max(0, c1 - c0) / dt; v.addScaledVector(ax, thrust * 0.32 * dt); v.y -= 0.035 * dt;
      v.multiplyScalar(Math.exp(-dt * 0.9)); p.addScaledVector(v, dt);
      if (this.grow[i] < 1) this.grow[i] = Math.min(1, this.grow[i] + dt * 0.2);
      this.simTentacles(i, dt, c1);
    }
  }
  bellBasis(i) { const ax = this.axis[i]; v1.set(1, 0, 0); if (Math.abs(ax.x) > 0.9) v1.set(0, 0, 1); const Z = v2.crossVectors(v1, ax).normalize(), X = v3.crossVectors(ax, Z).normalize(); return [X, ax, Z]; }
  simTentacles(i, dt, c) {
    const base = i * this.nodesPer * 3, P = this.cur, Q = this.prev, sz = this.size[i] * this.grow[i], [X, Y, Z] = this.bellBasis(i), p = this.pos[i];
    const t = U.uTime.value, damp = 0.965, g = -0.6 * dt * dt;
    let k = 0;
    for (let s = 0; s < this.TN + this.OA; s++) {
      const oral = s >= this.TN, N = oral ? this.NA : this.NN, seg = (oral ? 0.11 : 0.19) * sz;
      const a = oral ? (s - this.TN) / this.OA * 6.28 + 0.4 : s / this.TN * 6.28, rr = (oral ? 0.07 : 0.47 * (1 - c * 0.2)) * sz;
      const lx = Math.cos(a) * rr, ly = (oral ? -0.02 : 0.0) * sz, lz = Math.sin(a) * rr;
      const o0 = base + k * 3; P[o0] = Q[o0] = p.x + X.x * lx + Y.x * ly + Z.x * lz; P[o0 + 1] = Q[o0 + 1] = p.y + X.y * lx + Y.y * ly + Z.y * lz; P[o0 + 2] = Q[o0 + 2] = p.z + X.z * lx + Y.z * ly + Z.z * lz;
      for (let q = 1; q < N; q++) {
        const o = base + (k + q) * 3; const cx = P[o], cy = P[o + 1], cz = P[o + 2];
        const fx = Math.sin(t * 0.5 + q * 0.4 + s) * 0.08 * dt * dt, fz = Math.cos(t * 0.43 + q * 0.37 + s * 1.7) * 0.08 * dt * dt;
        P[o] += (cx - Q[o]) * damp + fx; P[o + 1] += (cy - Q[o + 1]) * damp + g; P[o + 2] += (cz - Q[o + 2]) * damp + fz;
        Q[o] = cx; Q[o + 1] = cy; Q[o + 2] = cz;
      }
      for (let it = 0; it < 2; it++) for (let q = 1; q < N; q++) {
        const o = base + (k + q) * 3, op = o - 3; const dx = P[o] - P[op], dy = P[o + 1] - P[op + 1], dz = P[o + 2] - P[op + 2]; const d = Math.hypot(dx, dy, dz) + 1e-6, e = (d - seg) / d;
        if (q === 1) { P[o] -= dx * e; P[o + 1] -= dy * e; P[o + 2] -= dz * e; } else { P[o] -= dx * e * 0.5; P[o + 1] -= dy * e * 0.5; P[o + 2] -= dz * e * 0.5; P[op] += dx * e * 0.5; P[op + 1] += dy * e * 0.5; P[op + 2] += dz * e * 0.5; }
      }
      k += N;
    }
  }
  sync(camera) {
    const cp = camera ? camera.position : new THREE.Vector3(0, 0, 30);
    for (let i = 0; i < this.n; i++) {
      const s = this.size[i] * this.grow[i], [X, Y, Z] = this.bellBasis(i);
      m4.makeBasis(X, Y, Z); m4.scale(v1.set(s, s, s)); m4.setPosition(this.pos[i]); this.bell.setMatrixAt(i, m4);
      this.aPh.setXY(i, this.contraction(i), (i * 0.618) % 1);
    }
    this.bell.count = this.n; this.bell.instanceMatrix.needsUpdate = true; this.aPh.needsUpdate = true;
    // camera-facing ribbons; width never below ~2px-equivalent so thin strands stay calm (no crawling)
    const P = this.cur, R = this.rpos, A = this.aA.array; let vi = 0, idxCount = 0;
    for (let i = 0; i < this.n; i++) {
      const base = i * this.nodesPer * 3; let k = 0; const sz = this.size[i] * this.grow[i];
      for (let s = 0; s < this.TN + this.OA; s++) {
        const oral = s >= this.TN, N = oral ? this.NA : this.NN;
        for (let q = 0; q < N; q++) {
          const o = base + (k + q) * 3, on = q < N - 1 ? o + 3 : o, op = q < N - 1 ? o : o - 3;
          const tx = P[on] - P[op], ty = P[on + 1] - P[op + 1], tz = P[on + 2] - P[op + 2];
          const vx = cp.x - P[o], vy = cp.y - P[o + 1], vz = cp.z - P[o + 2], dist = Math.hypot(vx, vy, vz);
          let sx = ty * vz - tz * vy, sy = tz * vx - tx * vz, sz2 = tx * vy - ty * vx; const sl = Math.hypot(sx, sy, sz2) + 1e-6;
          const tq = q / (N - 1); const w0 = (oral ? 0.05 * (1 - tq * 0.5) * (0.7 + 0.3 * Math.sin(q * 2.1)) : 0.011 * (1 - tq * 0.6)) * sz;
          const w = Math.max(w0, dist * 0.0021), alpha = (oral ? 0.55 : 0.9) * Math.min(1, w0 / w);
          sx *= w / sl; sy *= w / sl; sz2 *= w / sl;
          R[vi * 3] = P[o] - sx; R[vi * 3 + 1] = P[o + 1] - sy; R[vi * 3 + 2] = P[o + 2] - sz2; A[vi] = alpha; vi++;
          R[vi * 3] = P[o] + sx; R[vi * 3 + 1] = P[o + 1] + sy; R[vi * 3 + 2] = P[o + 2] + sz2; A[vi] = alpha; vi++;
          if (q < N - 1) idxCount += 6;
        }
        k += N;
      }
    }
    this.rgeo.attributes.position.needsUpdate = true; this.aA.needsUpdate = true; this.rgeo.setDrawRange(0, idxCount);
  }
}

// COMB JELLIES — rainbow ciliary shimmer, slow 3D drift with tumbling axis
export class CombJellies {
  constructor() {
    this.id = 'comb'; this.sp = SPECIES.comb; this.max = this.sp.max; this.n = 0; this.pos = []; this.vel = []; this.grow = []; this.r = rng(4321); this.q = []; this.spin = [];
    const g = new THREE.SphereGeometry(0.5, 40, 28); g.scale(0.62, 1, 0.62);
    this.aPh = new THREE.InstancedBufferAttribute(new Float32Array(this.max), 1); for (let i = 0; i < this.max; i++) this.aPh.array[i] = this.r(); g.setAttribute('aPh', this.aPh);
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uTime: U.uTime },
      vertexShader: `uniform float uTime; attribute float aPh; varying vec3 vP; varying vec3 vN; varying vec3 vV; varying float vPh;
        void main(){ vP = position; vPh = aPh; vec3 p = position; p.xz *= 1.0 + sin(uTime * 0.9 + aPh * 6.28 + p.y * 3.0) * 0.035;
          vec4 mv = modelViewMatrix * instanceMatrix * vec4(p, 1.0); vN = normalize(normalMatrix * mat3(instanceMatrix) * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uTime; varying vec3 vP; varying vec3 vN; varying vec3 vV; varying float vPh;
        vec3 hue(float h){ return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
        void main(){ float ang = atan(vP.z, vP.x + 1e-4); float row = pow(abs(cos(ang * 4.0)), 26.0);
          float along = vP.y * 6.0 - uTime * 2.2 + vPh * 10.0; float beat = 0.55 + 0.45 * sin(along * 2.0);
          float fr = pow(clamp(1.0 - abs(dot(normalize(vN), normalize(vV))), 0.0, 1.0), 2.0); float dist = length(vV); float fade = exp(-dist * 0.035);
          float far = 1.0 - 0.6 * smoothstep(8.0, 22.0, dist);
          vec3 rainbow = hue(fract(vP.y * 1.2 - uTime * 0.25 + ang * 0.05 + vPh)) * row * beat * smoothstep(0.48, 0.2, abs(vP.y)) * 0.85 * far;
          vec3 c = vec3(0.25, 0.35, 0.6) * (0.08 + fr * 0.55) + rainbow;
          gl_FragColor = vec4(c * fade, 1.0); }` });
    this.bell = new THREE.InstancedMesh(g, m, this.max); this.bell.count = 0; this.bell.frustumCulled = false; this.mesh = this.bell;
  }
  add(arrive) { if (this.n >= this.max) return -1; const i = this.n++, r = this.r; const a = r() * 6.28, d = arrive ? 24 : 4 + r() * 16; this.pos[i] = new THREE.Vector3(Math.cos(a) * d - 2, 4 + r() * 11, Math.sin(a) * d + 2); this.vel[i] = new THREE.Vector3(); this.grow[i] = arrive ? 0.1 : 1; this.q[i] = new THREE.Quaternion().setFromEuler(new THREE.Euler(r() - 0.5, r() * 6, r() - 0.5)); this.spin[i] = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.25); return i; }
  step(dt) {
    if (!(dt > 1e-4)) return; const t = U.uTime.value; const qd = new THREE.Quaternion(), e = new THREE.Euler();
    for (let i = 0; i < this.n; i++) {
      const p = this.pos[i], v = this.vel[i];
      v.x += (Math.sin(t * 0.11 + i * 1.7) * 0.12 - p.x * 0.003) * dt; v.y += (Math.sin(t * 0.13 + i) * 0.1 + (9 - p.y) * 0.004) * dt; v.z += (Math.cos(t * 0.09 + i * 2.3) * 0.12 - p.z * 0.003) * dt;
      for (const o of obstacles) { const dx = p.x - o.x, dy = p.y - o.y, dz = p.z - o.z, d = Math.hypot(dx, dy, dz), rr = o.r + 1.2; if (d < rr) v.addScaledVector(v1.set(dx, dy, dz), dt * (rr - d) / d); }
      const fl = sandHeight(p.x, p.z) + 2; if (p.y < fl) v.y += (fl - p.y) * dt;
      v.multiplyScalar(Math.exp(-dt * 0.5)); p.addScaledVector(v, dt);
      const sp = this.spin[i]; qd.setFromEuler(e.set(sp.x * dt, sp.y * dt, sp.z * dt)); this.q[i].multiply(qd);
      if (this.grow[i] < 1) this.grow[i] = Math.min(1, this.grow[i] + dt * 0.2);
    }
  }
  sync() { for (let i = 0; i < this.n; i++) { const s = (0.8 + (i % 3) * 0.2) * this.grow[i]; m4.compose(this.pos[i], this.q[i], v1.set(s, s, s)); this.bell.setMatrixAt(i, m4); } this.bell.count = this.n; this.bell.instanceMatrix.needsUpdate = true; }
}

export function makeGroup(id) {
  const sp = SPECIES[id];
  if (sp.kind === 'school') return new School(id);
  if (sp.kind === 'swim') return new Swimmers(id);
  if (sp.kind === 'dumbo') return new Dumbos();
  if (sp.kind === 'comb') return new CombJellies();
  return new Jellies('jelly');
}
