// BLUE HAVEN (deep sea) — procedural, friendly deep-sea life (all geometry built in code) + gentle boids.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { U, rng, noise3, sandHeight, deep, setGlow } from './common.js';
import { obstacles } from './env.js';

const C = (h) => new THREE.Color(h);
const tmpC = new THREE.Color();
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
function solid(g, col, glow = 0) { const n = g.attributes.position.count, a = new Float32Array(n * 3), c = C(col); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); if (g.attributes.uv) g.deleteAttribute('uv'); return setGlow(g, glow); }

// ---------------- fish-like body builder ----------------
function fishGeometry(sh, paint, finPaint) {
  const { H, W, peak = 0.55, r0 = 0.16, belly = 1.0, tailLen = 0.18, tailH = 0.2, fork = 0.5, nose = 1.0 } = sh;
  const zt = -0.5 + tailLen, NZ = sh.nz || 34, NA = sh.na || 22, P = [], Cc = [], G = [], I = [];
  const prof = (t) => t < peak ? r0 + (1 - r0) * Math.sin(0.5 * Math.PI * t / peak) : Math.pow(Math.max(0, 1 - Math.pow((t - peak) / (1 - peak), 2)), 0.5 * nose);
  for (let i = 0; i <= NZ; i++) {
    const t = i / NZ, z = zt + t * (0.5 - zt), f = prof(t);
    for (let j = 0; j <= NA; j++) {
      const a = j / NA * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      let y = H * f * sa; if (y < 0) y *= belly; P.push(W * f * ca, y, z);
      const gl = paint(tmpC, z, sa, ca, t) || 0; Cc.push(tmpC.r, tmpC.g, tmpC.b); G.push(gl);
    }
  }
  for (let i = 0; i < NZ; i++) for (let j = 0; j < NA; j++) { const a = i * (NA + 1) + j, b = a + NA + 1; I.push(a, b, a + 1, b, b + 1, a + 1); }
  const mk = (P, Cc, G, I) => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3)); g.setAttribute('aGlow', new THREE.Float32BufferAttribute(G, 1)); g.setIndex(I); g.computeVertexNormals(); return g; };
  const parts = [mk(P, Cc, G, I)];
  const sheet = (fn, nu, nv, kind) => {
    const P2 = [], C2 = [], G2 = [], I2 = [];
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) { const u = i / nu, v = j / nv, p = fn(u, v); P2.push(p[0], p[1], p[2]); const gl = finPaint(tmpC, kind, u, v) || 0; C2.push(tmpC.r, tmpC.g, tmpC.b); G2.push(gl); }
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = i * (nv + 1) + j, b = a + nv + 1; I2.push(a, b, a + 1, b, b + 1, a + 1); }
    parts.push(mk(P2, C2, G2, I2));
  };
  const h0 = H * r0 * 0.9;
  if (sh.flukes) sheet((u, v) => { const vv = v * 2 - 1, av = Math.abs(vv); const hh = W * r0 + (tailH - W * r0) * Math.pow(u, 0.7); return [vv * hh, 0, zt + 0.01 - u * tailLen * (1 - fork * Math.pow(1 - av, 1.6))]; }, 8, 12, 'tail');
  else sheet((u, v) => { const vv = v * 2 - 1, av = Math.abs(vv); const hh = h0 + (tailH - h0) * Math.pow(u, 0.8); return [0, vv * hh, zt + 0.01 - u * tailLen * (1 - fork * Math.pow(1 - av, 1.6))]; }, 8, 10, 'tail');
  const topY = (z) => H * prof(Math.min(1, Math.max(0, (z - zt) / (0.5 - zt))));
  if (sh.dorsal) { const d = sh.dorsal; sheet((u, v) => { const z = d.z0 + (d.z1 - d.z0) * u; return [0, topY(z) * 0.92 + d.h * Math.sin(Math.PI * Math.pow(u, d.pow || 0.8)) ** 0.7 * v, z - (d.rake || 0) * v]; }, 14, 3, 'dorsal'); }
  if (sh.anal) { const d = sh.anal; sheet((u, v) => { const z = d.z0 + (d.z1 - d.z0) * u; return [0, -topY(z) * belly * 0.92 - d.h * Math.sin(Math.PI * Math.pow(u, d.pow || 0.8)) ** 0.7 * v, z - (d.rake || 0) * v]; }, 12, 3, 'anal'); }
  const pz = zt + 0.68 * (0.5 - zt), pw = W * prof(0.68), ps = sh.pect || 0.09;
  for (const s of [-1, 1]) sheet((u, v) => [s * (pw * 0.95 + u * ps), -H * 0.18 + (v - 0.5) * ps * 0.7 * (1 - u * 0.5) - u * 0.03, pz - u * ps - v * ps * 0.4], 3, 2, 'pect');
  const ez = zt + (sh.eyeT || 0.86) * (0.5 - zt), ef = prof(sh.eyeT || 0.86), er = sh.eyeR || 0.035;
  for (const s of [-1, 1]) {
    const e = new THREE.SphereGeometry(er, 14, 10); e.scale(0.6, 1, 1); e.translate(s * W * ef * 0.88, H * ef * (sh.eyeY ?? 0.22), ez); parts.push(solid(e, sh.eyeCol || '#06070c', 0));
    if (sh.eyeShine) { const hl = new THREE.SphereGeometry(er * 0.32, 8, 6); hl.translate(s * (W * ef * 0.88 + er * 0.45), H * ef * (sh.eyeY ?? 0.22) + er * 0.35, ez + er * 0.3); parts.push(solid(hl, '#ffffff', 1.5)); }
  }
  if (sh.lure) { // anglerfish lure: curved stalk + glowing bulb
    const pts = []; for (let i = 0; i <= 10; i++) { const t = i / 10; pts.push(new THREE.Vector3(0, H * 0.85 + Math.sin(t * Math.PI * 0.9) * H * 0.75, 0.22 + t * 0.42)); }
    const st = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 12, 0.012, 5, false); parts.push(solid(st, '#4a3048', 0.1));
    const b = new THREE.SphereGeometry(0.06, 14, 10); const e = pts[10]; b.translate(e.x, e.y, e.z); parts.push(solid(b, '#a8fff0', 3.2));
  }
  return mergeGeometries(parts.map(p => { if (p.attributes.normal === undefined) p.computeVertexNormals(); return p; }));
}

// ---------------- giant squid (gentle) ----------------
function squidGeometry() {
  const parts = [];
  // mantle along +z (tip at +0.5), opening at z≈0
  const mp = []; for (let i = 0; i <= 20; i++) { const t = i / 20; mp.push(new THREE.Vector2(0.075 * Math.pow(Math.sin(Math.PI * (0.5 + 0.5 * t)), 0.6) + 0.004, 0.5 * t)); }
  const mantle = new THREE.LatheGeometry(mp.reverse(), 22); mantle.rotateX(Math.PI / 2); // y→z
  { const p = mantle.attributes.position, c = new Float32Array(p.count * 3), gl = new Float32Array(p.count); for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); const n = noise3(x * 60, y * 60, z * 30); tmpC.copy(C('#e07a5a')).lerp(C('#ffc0a0'), sstep(0.02, -0.06, y)).lerp(C('#b04a3a'), n > 0.6 ? 0.5 : 0); c.set([tmpC.r, tmpC.g, tmpC.b], i * 3); gl[i] = n > 0.72 ? 0.5 : 0.04; } mantle.setAttribute('color', new THREE.BufferAttribute(c, 3)); mantle.setAttribute('aGlow', new THREE.BufferAttribute(gl, 1)); mantle.deleteAttribute('uv'); }
  parts.push(mantle);
  for (const s of [-1, 1]) { const f = new THREE.BufferGeometry(); f.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.5, s * 0.11, 0, 0.36, 0, 0, 0.3], 3)); f.setIndex([0, 1, 2]); f.computeVertexNormals(); parts.push(solid(f, '#f09070', 0.15)); }
  const head = new THREE.SphereGeometry(0.06, 18, 12); head.scale(1, 0.9, 1.3); head.translate(0, 0, -0.03); parts.push(solid(head, '#e88a6a', 0.04));
  for (const s of [-1, 1]) { const e = new THREE.SphereGeometry(0.03, 16, 12); e.translate(s * 0.05, 0.01, -0.03); parts.push(solid(e, '#0a0c18', 0)); const ring = new THREE.TorusGeometry(0.031, 0.005, 6, 20); ring.rotateY(Math.PI / 2); ring.translate(s * 0.058, 0.01, -0.03); parts.push(solid(ring, '#a8e8ff', 1.6)); const hl = new THREE.SphereGeometry(0.008, 8, 6); hl.translate(s * 0.075, 0.022, -0.02); parts.push(solid(hl, '#ffffff', 1.8)); }
  const armCol = C('#e07a5a');
  for (let k = 0; k < 10; k++) {
    const a = k / 10 * Math.PI * 2, long = k === 2 || k === 7, len = long ? 0.75 : 0.32, rad = long ? 0.008 : 0.016;
    const arm = new THREE.CylinderGeometry(rad * 0.25, rad, len, 6, long ? 24 : 12); arm.translate(0, -len / 2, 0); arm.rotateX(Math.PI / 2); // along -z
    const p = arm.attributes.position; for (let i = 0; i < p.count; i++) { const zz = p.getZ(i), t = -zz / len; p.setX(i, p.getX(i) + Math.cos(a) * 0.035 * (1 + t * (long ? 0.6 : 1.4))); p.setY(i, p.getY(i) + Math.sin(a) * 0.035 * (1 + t * (long ? 0.6 : 1.4))); p.setZ(i, zz - 0.07); }
    arm.computeVertexNormals(); solid(arm, armCol.getHexString ? '#' + armCol.getHexString() : '#e07a5a', 0.05); parts.push(arm);
    if (long) { const club = new THREE.SphereGeometry(0.018, 8, 6); club.scale(1, 1, 2.2); club.translate(Math.cos(a) * 0.035 * 1.6, Math.sin(a) * 0.035 * 1.6, -0.07 - len); parts.push(solid(club, '#f0a080', 0.6)); }
  }
  return mergeGeometries(parts.map(p => { if (!p.attributes.normal) p.computeVertexNormals(); return p; }));
}

// ---------------- species ----------------
export const SPECIES = {
  lantern: {
    kind: 'fish', len: 0.42, speed: 2.6, minSpeed: 1.3, school: 1.0, start: 18, max: 70, step: 10, cost: 0, addCost: 8, y: [2, 12], turn: 3.0, freq: 14,
    shape: { H: 0.14, W: 0.075, peak: 0.45, r0: 0.18, tailLen: 0.2, tailH: 0.11, fork: 0.65, dorsal: { z0: -0.05, z1: 0.12, h: 0.06, rake: 0.03 }, anal: { z0: -0.22, z1: -0.04, h: 0.04, rake: 0.02 }, eyeR: 0.05, eyeT: 0.84, eyeCol: '#1a2a44', eyeShine: true },
    paint: (c, z, sa, ca, t) => { c.copy(C('#8aa0b8')).lerp(C('#1c2a44'), sstep(0.1, 0.7, sa)).lerp(C('#c8d4e0'), sstep(-0.2, -0.8, sa)); const row = Math.abs(sa + 0.55) < 0.12 || Math.abs(sa + 0.85) < 0.08; const dot = Math.abs((z * 26) - Math.round(z * 26)) < 0.22; if (row && dot && z > -0.3 && z < 0.4) { c.copy(C('#7ff8ff')); return 2.6; } return 0; },
    fin: (c) => { c.copy(C('#5a6a88')); return 0; }, sheen: C('#1a3a6a'),
  },
  hatchet: {
    kind: 'fish', len: 0.38, speed: 1.8, minSpeed: 0.8, school: 0.8, start: 0, max: 30, step: 6, cost: 20, addCost: 10, y: [3, 13], turn: 2.6, freq: 12,
    shape: { H: 0.44, W: 0.06, peak: 0.42, r0: 0.12, belly: 1.25, tailLen: 0.2, tailH: 0.12, fork: 0.5, nose: 0.6, dorsal: { z0: -0.12, z1: 0.0, h: 0.06, rake: 0.02 }, eyeR: 0.06, eyeT: 0.8, eyeY: 0.45, eyeCol: '#1a2a3a', eyeShine: true },
    paint: (c, z, sa) => { c.copy(C('#d8e2f0')).lerp(C('#4a5878'), sstep(0.3, 0.85, sa)); if (sa < -0.86 && Math.abs((z * 30) - Math.round(z * 30)) < 0.28 && z > -0.28 && z < 0.38) { c.copy(C('#80b8ff')); return 2.4; } return 0; },
    fin: (c) => { c.copy(C('#a8b8d0')); return 0.05; }, sheen: C('#5080c0'), metal: 0.6,
  },
  angler: {
    kind: 'fish', len: 0.75, speed: 0.8, minSpeed: 0.25, school: 0, start: 0, max: 5, step: 1, cost: 35, addCost: 25, y: [1.6, 7], turn: 1.6, freq: 7,
    shape: { H: 0.36, W: 0.32, peak: 0.55, r0: 0.25, nose: 0.45, tailLen: 0.16, tailH: 0.16, fork: 0.0, pect: 0.14, eyeR: 0.065, eyeT: 0.8, eyeY: 0.42, eyeShine: true, lure: true, dorsal: { z0: -0.3, z1: -0.08, h: 0.08, pow: 1 }, anal: { z0: -0.3, z1: -0.12, h: 0.07, pow: 1 } },
    paint: (c, z, sa, ca) => { c.copy(C('#4a3050')).lerp(C('#8a6a88'), sstep(0.0, -0.7, sa)); if (noise3(z * 18, sa * 4, ca * 4) > 0.66) c.lerp(C('#c8a8c8'), 0.6); if (z > 0.44 && Math.abs(sa + 0.1) < 0.1) c.copy(C('#2a1828')); return 0.02; },
    fin: (c, kind, u, v) => { c.copy(C('#5a3a5a')).lerp(C('#a088b0'), v * 0.6); return 0.05; }, sheen: C('#402048'),
  },
  jelly: { kind: 'jelly', len: 1.0, start: 0, max: 16, step: 4, cost: 45, addCost: 12 },
  comb: { kind: 'comb', len: 0.8, start: 0, max: 14, step: 3, cost: 55, addCost: 15 },
  dumbo: { kind: 'dumbo', len: 0.9, start: 0, max: 4, step: 1, cost: 80, addCost: 50, speed: 0.75, minSpeed: 0.3, y: [1.8, 9], turn: 0.9, wide: 18, freq: 2.2 },
  squid: { kind: 'squid', len: 7.5, start: 0, max: 2, step: 1, cost: 170, addCost: 120, large: true, speed: 1.7, minSpeed: 1.0, y: [7, 16], turn: 0.4, wide: 26, freq: 2.6 },
  whale: {
    kind: 'fish', swim: 'whale', len: 13, speed: 1.9, minSpeed: 1.2, school: 0, start: 0, max: 1, step: 1, cost: 260, addCost: 0, y: [12, 19], turn: 0.3, freq: 1.6, large: true, wide: 32,
    shape: { nz: 120, na: 48, H: 0.12, W: 0.11, peak: 0.72, r0: 0.1, nose: 0.12, belly: 0.9, tailLen: 0.16, tailH: 0.17, fork: 0.35, flukes: true, dorsal: { z0: -0.1, z1: 0.0, h: 0.025, pow: 1.2 }, pect: 0.06, eyeR: 0.008, eyeT: 0.84, eyeY: -0.1 },
    paint: (c, z, sa, ca) => { c.copy(C('#5a6272')).lerp(C('#7a8494'), sstep(-0.3, -0.9, sa)); const n = noise3(z * 40, sa * 6, ca * 6); if (n > 0.62 && n < 0.65) c.lerp(C('#8a92a4'), 0.5); if (z > 0.2 && sa < -0.3 && Math.abs(ca) < 0.4) c.lerp(C('#d8dce4'), 0.5 * sstep(0.2, 0.3, z)); return 0.02; },
    fin: (c, kind, u) => { c.copy(C('#4a5262')).lerp(C('#6a7282'), u * 0.4); return 0; }, sheen: C('#203040'),
  },
};
export const SPECIES_ORDER = ['lantern', 'hatchet', 'angler', 'jelly', 'comb', 'dumbo', 'squid', 'whale'];

// ---------------- generic swimmer group ----------------
const UP = new THREE.Vector3(0, 1, 0);
const m4 = new THREE.Matrix4(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
export class Group {
  constructor(id, sp, max) {
    this.id = id; this.sp = sp; this.max = max; this.n = 0;
    this.pos = []; this.vel = []; this.ph = []; this.bend = []; this.tgt = []; this.tgtT = []; this.grow = [];
    this.groupTarget = new THREE.Vector3(0, 6, 0); this.groupT = 0; this.home = null; this.r = rng(id.length * 97 + 3);
  }
  randomPoint(out, near) {
    const sp = this.sp, r = this.r;
    if (near) { out.set(near.x + (r() - 0.5) * 5, near.y + (r() - 0.3) * 2.5, near.z + (r() - 0.5) * 5); return out; }
    const R = sp.wide || 20, a = r() * 6.28, d = Math.sqrt(r()) * R;
    out.set(Math.cos(a) * d, 0, Math.sin(a) * d); out.y = Math.max(sandHeight(out.x, out.z) + 1, sp.y[0]) + r() * (sp.y[1] - sp.y[0]); return out;
  }
  add(arrive) {
    if (this.n >= this.max) return -1;
    const i = this.n++, p = new THREE.Vector3();
    if (arrive) { const a = this.r() * 6.28; p.set(Math.cos(a) * 34, (this.sp.y[0] + this.sp.y[1]) / 2, Math.sin(a) * 34); }
    else if (this.sp.school > 0.5 && i > 0) p.copy(this.pos[0]).add(v1.set(this.r() - 0.5, this.r() - 0.5, this.r() - 0.5).multiplyScalar(3));
    else this.randomPoint(p, this.home);
    this.pos[i] = p; this.vel[i] = arrive ? new THREE.Vector3(-p.x, 0, -p.z).normalize().multiplyScalar(this.sp.speed || 1) : new THREE.Vector3(this.r() - 0.5, 0, this.r() - 0.5).normalize().multiplyScalar(this.sp.speed || 1);
    this.ph[i] = this.r() * 6.28; this.bend[i] = 0; this.tgt[i] = this.randomPoint(new THREE.Vector3(), this.home); this.tgtT[i] = 2 + this.r() * 6; this.grow[i] = arrive ? 0.2 : 1;
    return i;
  }
  step(dt, ctx) {
    if (!(dt > 1e-4)) return;
    const sp = this.sp, n = this.n, school = sp.school || 0, maxS = sp.speed, minS = sp.minSpeed;
    this.groupT -= dt; if (this.groupT <= 0) { this.randomPoint(this.groupTarget, this.home); this.groupT = 7 + this.r() * 8; }
    for (let i = 0; i < n; i++) {
      const p = this.pos[i], v = this.vel[i], acc = v3.set(0, 0, 0);
      this.tgtT[i] -= dt; if (this.tgtT[i] <= 0 || p.distanceToSquared(this.tgt[i]) < 2) { this.randomPoint(this.tgt[i], this.home); this.tgtT[i] = 4 + this.r() * 8; }
      acc.addScaledVector(v1.subVectors(school > 0.5 ? this.groupTarget : this.tgt[i], p).normalize(), 0.9);
      if (school > 0) {
        let cnt = 0; const coh = v1.set(0, 0, 0), ali = v2.set(0, 0, 0);
        for (let j = 0; j < n; j++) { if (j === i) continue; const q = this.pos[j]; const dx = p.x - q.x, dy = p.y - q.y, dz = p.z - q.z, d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < 0.36 * sp.len * 6) { const k = 1.6 / (d2 + 0.02); acc.x += dx * k * 0.08; acc.y += dy * k * 0.08; acc.z += dz * k * 0.08; }
          if (d2 < 9) { coh.add(q); ali.add(this.vel[j]); cnt++; } }
        if (cnt) { coh.multiplyScalar(1 / cnt).sub(p); acc.addScaledVector(coh, 0.5 * school); ali.multiplyScalar(1 / cnt).sub(v); acc.addScaledVector(ali, 0.6 * school); }
      }
      if (ctx.food && ctx.food.length && !sp.large) {
        let best = null, bd = 1e9; for (const f of ctx.food) { if (f.eaten) continue; const d = f.p.distanceToSquared(p); if (d < bd) { bd = d; best = f; } }
        if (best && bd < 400) { acc.addScaledVector(v1.subVectors(best.p, p).normalize(), 3.0); if (bd < 0.12 + sp.len * 0.2) ctx.onEat(best, this, i); }
      }
      for (const o of obstacles) { const dx = p.x - o.x, dy = p.y - o.y, dz = p.z - o.z, d = Math.hypot(dx, dy, dz), rr = o.r + Math.min(sp.len, 3) * 0.6 + 0.4; if (d < rr) { const k = (rr - d) / rr * 4; acc.x += dx / d * k; acc.y += dy / d * k * 0.6; acc.z += dz / d * k; } }
      const R = (sp.wide || 24) + 4, rad = Math.hypot(p.x, p.z); if (rad > R) { acc.x -= p.x / rad * (rad - R) * 0.4; acc.z -= p.z / rad * (rad - R) * 0.4; }
      const floor = sandHeight(p.x, p.z) + 0.6 + Math.min(sp.len, 3) * 0.3; if (p.y < floor + 0.5) acc.y += (floor + 0.5 - p.y) * 3; if (p.y > sp.y[1] + 2) acc.y -= (p.y - sp.y[1] - 2) * 0.5;
      if (ctx.avoid && !sp.large) { const dx = p.x - ctx.avoid.x, dy = p.y - ctx.avoid.y, dz = p.z - ctx.avoid.z, d = Math.hypot(dx, dy, dz); if (d < 2.2) { acc.x += dx / d * 3; acc.y += dy / d * 3; acc.z += dz / d * 3; } }
      const prevX = v.x, prevZ = v.z;
      v.addScaledVector(acc, dt * sp.turn);
      let s = v.length(); const sT = THREE.MathUtils.clamp(s, minS, maxS * (ctx.food && ctx.food.length ? 1.4 : 1)); v.multiplyScalar(sT / Math.max(s, 1e-4)); s = sT;
      v.y *= 1 - dt * 1.5; p.addScaledVector(v, dt);
      const yawRate = (prevX * v.z - prevZ * v.x) / (s * s + 1e-4) / dt;
      if (Number.isFinite(yawRate)) this.bend[i] += (THREE.MathUtils.clamp(yawRate * 0.25, -0.5, 0.5) - this.bend[i]) * Math.min(1, dt * 5);
      this.ph[i] += dt * ((sp.freq || 2) * (0.45 + 0.55 * s / maxS));
      if (this.grow[i] < 1) this.grow[i] = Math.min(1, this.grow[i] + dt * 0.25);
    }
  }
}

// ---------------- instanced swimmers (fish, whale, squid) ----------------
export class InstSpecies extends Group {
  constructor(id) {
    const sp = SPECIES[id]; super(id, sp, sp.max);
    const geo = sp.kind === 'squid' ? squidGeometry() : fishGeometry(sp.shape, sp.paint, sp.fin);
    this.attr = new THREE.InstancedBufferAttribute(new Float32Array(sp.max * 4), 4); this.attr.setUsage(THREE.DynamicDrawUsage); geo.setAttribute('aSwim', this.attr);
    const mat = deep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: sp.metal ? 0.25 : 0.5, metalness: sp.metal || 0.05, side: THREE.DoubleSide }), { swim: sp.kind === 'squid' ? 'squid' : (sp.swim || 'fish'), rim: 1.0, glow: 1.0, sheen: sp.sheen || null });
    this.mesh = new THREE.InstancedMesh(geo, mat, sp.max); this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }
  sync() {
    const s = this.sp.len;
    for (let i = 0; i < this.n; i++) {
      const v = this.vel[i]; m4.identity().lookAt(v, v2.set(0, 0, 0), UP);
      if (this.sp.large) m4.multiply(new THREE.Matrix4().makeRotationZ(THREE.MathUtils.clamp(-this.bend[i] * 0.6, -0.3, 0.3)));
      const g = s * this.grow[i]; m4.scale(v1.set(g, g, g)); m4.setPosition(this.pos[i]); this.mesh.setMatrixAt(i, m4);
      this.attr.setXYZW(i, this.ph[i], 0, this.bend[i], this.sp.large ? 0.7 : 1);
    }
    this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true; this.attr.needsUpdate = true;
  }
}

// ---------------- dumbo octopus ----------------
function dumboModel() {
  const root = new THREE.Group(), body = new THREE.Group(); root.add(body);
  const mat = deep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: THREE.DoubleSide }), { rim: 0.7, glow: 1.0, sheen: C('#ff90b0') });
  const head = new THREE.SphereGeometry(0.32, 28, 20); head.scale(1, 1.12, 1); head.translate(0, 0.18, 0);
  { const p = head.attributes.position, c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const y = p.getY(i); tmpC.copy(C('#e87a7a')).lerp(C('#d0607e'), sstep(0.1, 0.5, y)); if (noise3(p.getX(i) * 14, y * 14, p.getZ(i) * 14) > 0.68) tmpC.lerp(C('#ffc0b0'), 0.5); c.set([tmpC.r, tmpC.g, tmpC.b], i * 3); } head.setAttribute('color', new THREE.BufferAttribute(c, 3)); setGlow(head, 0.06); head.deleteAttribute('uv'); }
  body.add(new THREE.Mesh(head, mat));
  // webbed skirt
  const sp = []; for (let i = 0; i <= 10; i++) { const t = i / 10; sp.push(new THREE.Vector2(0.24 + t * 0.32 + Math.sin(t * 3) * 0.03, -t * 0.32)); }
  const skirt = new THREE.LatheGeometry(sp, 40); { const p = skirt.attributes.position, c = new Float32Array(p.count * 3), gl = new Float32Array(p.count); for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), y = p.getY(i), a = Math.atan2(z, x); const rib = Math.pow(Math.abs(Math.cos(a * 4)), 12); p.setY(i, y + Math.sin(a * 8) * 0.02 * (-y / 0.32)); tmpC.copy(C('#e07888')).lerp(C('#a8406a'), rib * 0.6).lerp(C('#ffb8c0'), sstep(-0.2, -0.32, y) * 0.5); c.set([tmpC.r, tmpC.g, tmpC.b], i * 3); gl[i] = 0.05 + (y < -0.28 ? 0.45 : 0); } skirt.setAttribute('color', new THREE.BufferAttribute(c, 3)); skirt.setAttribute('aGlow', new THREE.BufferAttribute(gl, 1)); skirt.deleteAttribute('uv'); skirt.computeVertexNormals(); }
  const sk = new THREE.Mesh(skirt, mat); sk.position.y = -0.02; body.add(sk);
  const ears = [];
  for (const s of [-1, 1]) { const piv = new THREE.Group(); piv.position.set(s * 0.22, 0.36, 0); const e = solid(new THREE.SphereGeometry(0.16, 16, 10).scale(1, 0.25, 0.8), '#e88098', 0.08); e.translate(s * 0.13, 0, 0); piv.add(new THREE.Mesh(e, mat)); body.add(piv); ears.push(piv); }
  for (const s of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), new THREE.MeshStandardMaterial({ color: '#0a0a14', roughness: 0.15 })); eye.position.set(s * 0.15, 0.2, 0.25); body.add(eye); const hl = new THREE.Mesh(new THREE.SphereGeometry(0.022, 8, 6), new THREE.MeshBasicMaterial({ color: '#ffffff' })); hl.position.set(s * 0.15 + 0.02, 0.24, 0.31); body.add(hl); }
  root.userData = { ears, skirt: sk, body };
  return root;
}
export class Dumbos extends Group {
  constructor() { super('dumbo', SPECIES.dumbo, SPECIES.dumbo.max); this.mesh = new THREE.Group(); this.models = []; }
  add(arrive) { const i = super.add(arrive); if (i >= 0) { const m = dumboModel(); this.models.push(m); this.mesh.add(m); } return i; }
  sync() {
    for (let i = 0; i < this.n; i++) {
      const m = this.models[i], v = this.vel[i], ph = this.ph[i]; m.position.copy(this.pos[i]); m.position.y += Math.sin(ph * 0.5) * 0.12;
      m.rotation.set(0, Math.atan2(v.x, v.z), 0); m.userData.body.rotation.x = 0.35 + Math.sin(ph * 0.5) * 0.08; m.scale.setScalar(this.sp.len * this.grow[i]);
      const [l, r] = m.userData.ears; l.rotation.z = Math.sin(ph * 2) * 0.5; r.rotation.z = -Math.sin(ph * 2) * 0.5;
      const sk = m.userData.skirt, k = Math.sin(ph); sk.scale.set(1 + k * 0.08, 1 - k * 0.1, 1 + k * 0.08);
    }
  }
}

// ---------------- glow jellies (crown-like) ----------------
const JELLY_VS = `
  uniform float uTime; attribute float aPh; varying float vH; varying vec3 vN; varying vec3 vV; varying vec2 vUv2; varying float vPh; uniform float uPart;
  void main(){
    vec3 p = position; float ph = uTime * 1.1 + aPh * 6.2831; float pulse = sin(ph);
    if (uPart < 0.5) { float k = smoothstep(0.0, 1.0, 1.0 - p.y / 0.55); p.xz *= 1.0 + pulse * 0.12 * k; p.y *= 1.0 - pulse * 0.08; }
    else { float d = -p.y; p.x += sin(ph * 0.8 - d * 2.5 + p.z * 4.0) * d * 0.12; p.z += cos(ph * 0.7 - d * 2.2 + p.x * 4.0) * d * 0.12; p.xz *= 1.0 + pulse * 0.08 * smoothstep(0.3, 0.0, d); }
    vH = position.y; vUv2 = position.xz; vPh = pulse;
    vec4 mv = modelViewMatrix * instanceMatrix * vec4(p, 1.0);
    vN = normalize(normalMatrix * mat3(instanceMatrix) * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv;
  }`;
const JELLY_FS = `
  uniform float uPart; uniform vec3 uCol; uniform vec3 uGlow; uniform float uTime; varying float vH; varying vec3 vN; varying vec3 vV; varying vec2 vUv2; varying float vPh;
  void main(){
    float fr = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.6); float fade = exp(-length(vV) * 0.035);
    if (uPart < 0.5) {
      float r = length(vUv2), ang = atan(vUv2.y, vUv2.x);
      float ring = smoothstep(0.05, 0.0, abs(r - 0.47)) + smoothstep(0.03, 0.0, abs(r - 0.25)) * step(0.3, vH) * 0.7;
      float spokes = pow(abs(cos(ang * 8.0)), 30.0) * step(0.15, vH) * 0.6;
      float wave = 0.5 + 0.5 * sin(uTime * 2.0 - ang * 3.0);
      vec3 c = uCol * (0.14 + fr * 0.8) + uGlow * (ring * (0.6 + 0.8 * wave) + spokes);
      gl_FragColor = vec4(c * fade * (0.9 + 0.2 * vPh), 1.0);
    } else { float a = 1.0 - smoothstep(0.0, 2.2, -vH); gl_FragColor = vec4(mix(uCol, uGlow, 0.4) * (0.3 + fr * 0.5) * a * fade, 1.0); }
  }`;
export class Jellies {
  constructor() {
    this.sp = SPECIES.jelly; this.max = this.sp.max; this.n = 0; this.pos = []; this.vel = []; this.r = rng(1234); this.id = 'jelly'; this.grow = [];
    const bell = new THREE.LatheGeometry(Array.from({ length: 14 }, (_, i) => { const t = i / 13; return new THREE.Vector2(Math.sin(t * Math.PI / 2) * 0.5 * (1 + 0.08 * t), Math.cos(t * Math.PI / 2) * 0.5 - 0.05 * t * t); }), 32);
    const strands = [], r = rng(77);
    for (let k = 0; k < 18; k++) { const a = k / 18 * 6.28, len = 1.4 + r() * 1.2; const g = new THREE.CylinderGeometry(0.006, 0.01, len, 3, 16, true); g.translate(Math.cos(a) * 0.46, -len / 2 - 0.02, Math.sin(a) * 0.46); strands.push(g); }
    for (let k = 0; k < 4; k++) { const a = k / 4 * 6.28 + 0.4, len = 1.0 + r() * 0.4; const g = new THREE.CylinderGeometry(0.03, 0.06, len, 6, 16, true); g.translate(Math.cos(a) * 0.08, -len / 2, Math.sin(a) * 0.08); strands.push(g); }
    const tent = mergeGeometries(strands);
    this.aPh = new THREE.InstancedBufferAttribute(new Float32Array(this.max), 1); for (let i = 0; i < this.max; i++) this.aPh.array[i] = r();
    bell.setAttribute('aPh', this.aPh); tent.setAttribute('aPh', this.aPh);
    const mk = (part) => new THREE.ShaderMaterial({ uniforms: { uTime: U.uTime, uPart: { value: part }, uCol: { value: C('#6a4ad8') }, uGlow: { value: C('#5af0ff').multiplyScalar(1.3) } }, vertexShader: JELLY_VS, fragmentShader: JELLY_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.bell = new THREE.InstancedMesh(bell, mk(0), this.max); this.tent = new THREE.InstancedMesh(tent, mk(1), this.max);
    this.bell.count = this.tent.count = 0; this.bell.frustumCulled = this.tent.frustumCulled = false;
    this.mesh = new THREE.Group(); this.mesh.add(this.bell, this.tent);
  }
  add(arrive) { if (this.n >= this.max) return -1; const i = this.n++, r = this.r; const a = r() * 6.28, d = arrive ? 26 : 6 + r() * 16; this.pos[i] = new THREE.Vector3(Math.cos(a) * d + 4, 6 + r() * 10, Math.sin(a) * d - 4); this.vel[i] = new THREE.Vector3((r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3); this.grow[i] = arrive ? 0.1 : 1; return i; }
  step(dt) {
    const t = U.uTime.value;
    for (let i = 0; i < this.n; i++) { const p = this.pos[i], v = this.vel[i], ph = t * 1.1 + this.aPh.array[i] * 6.2831; v.y += (Math.max(0, Math.cos(ph)) * 0.35 - 0.12) * dt; v.y *= 1 - dt * 0.8;
      v.x += (Math.sin(t * 0.05 + i) * 0.05 - p.x * 0.002) * dt; v.z += (Math.cos(t * 0.04 + i * 2) * 0.05 - p.z * 0.002) * dt; p.addScaledVector(v, dt); if (p.y > 18) v.y -= dt * 0.5; if (p.y < 4) v.y += dt * 0.5; if (this.grow[i] < 1) this.grow[i] = Math.min(1, this.grow[i] + dt * 0.2); }
  }
  sync() {
    for (let i = 0; i < this.n; i++) { const s = (0.9 + (i % 3) * 0.25) * this.grow[i]; m4.makeRotationFromEuler(new THREE.Euler(Math.sin(i + U.uTime.value * 0.2) * 0.15, i, Math.cos(i * 2 + U.uTime.value * 0.15) * 0.15)); m4.scale(v1.set(s, s, s)); m4.setPosition(this.pos[i]); this.bell.setMatrixAt(i, m4); this.tent.setMatrixAt(i, m4); }
    this.bell.count = this.tent.count = this.n; this.bell.instanceMatrix.needsUpdate = this.tent.instanceMatrix.needsUpdate = true;
  }
}

// ---------------- comb jellies (rainbow ciliary shimmer) ----------------
export class CombJellies extends Jellies {
  constructor() {
    super(); this.sp = SPECIES.comb; this.id = 'comb'; this.max = this.sp.max; this.r = rng(4321);
    this.mesh.remove(this.bell, this.tent);
    const g = new THREE.SphereGeometry(0.5, 40, 28); g.scale(0.62, 1, 0.62); g.setAttribute('aPh', this.aPh);
    const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uTime: U.uTime },
      vertexShader: `uniform float uTime; attribute float aPh; varying vec3 vP; varying vec3 vN; varying vec3 vV; varying float vPh;
        void main(){ vP = position; vPh = aPh; vec3 p = position; p.xz *= 1.0 + sin(uTime * 0.9 + aPh * 6.28 + p.y * 3.0) * 0.03;
          vec4 mv = modelViewMatrix * instanceMatrix * vec4(p, 1.0); vN = normalize(normalMatrix * mat3(instanceMatrix) * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
      fragmentShader: `uniform float uTime; varying vec3 vP; varying vec3 vN; varying vec3 vV; varying float vPh;
        vec3 hue(float h){ return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
        void main(){ float ang = atan(vP.z, vP.x); float row = pow(abs(cos(ang * 4.0)), 40.0);
          float along = vP.y * 6.0 - uTime * 3.0 + vPh * 10.0; float beat = 0.5 + 0.5 * sin(along * 2.0);
          float fr = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0); float fade = exp(-length(vV) * 0.035);
          vec3 rainbow = hue(fract(vP.y * 1.2 - uTime * 0.35 + ang * 0.05 + vPh)) * row * beat * smoothstep(0.48, 0.2, abs(vP.y)) * 1.6;
          vec3 c = vec3(0.25, 0.35, 0.6) * (0.08 + fr * 0.55) + rainbow;
          gl_FragColor = vec4(c * fade, 1.0); }` });
    this.bell = new THREE.InstancedMesh(g, m, this.max); this.bell.count = 0; this.bell.frustumCulled = false;
    this.tent = { setMatrixAt() {}, instanceMatrix: {}, count: 0 };
    this.mesh.add(this.bell);
  }
  sync() {
    for (let i = 0; i < this.n; i++) { const s = (0.8 + (i % 3) * 0.2) * this.grow[i]; m4.makeRotationFromEuler(new THREE.Euler(Math.sin(i + U.uTime.value * 0.15) * 0.4, U.uTime.value * 0.1 + i, Math.cos(i * 2 + U.uTime.value * 0.12) * 0.4)); m4.scale(v1.set(s, s, s)); m4.setPosition(this.pos[i]); this.bell.setMatrixAt(i, m4); }
    this.bell.count = this.n; this.bell.instanceMatrix.needsUpdate = true;
  }
}
