// BLUE HAVEN — procedural sea life (all geometry built in code) + gentle boids.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { U, rng, noise3, sandHeight, underwater } from './common.js';
import { obstacles } from './env.js';

const C = (h) => new THREE.Color(h);
const tmpC = new THREE.Color();
const sstep = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };

// ---------------- fish geometry ----------------
function fishGeometry(sh, paint, finPaint, eyeCol = '#0b0b10') {
  const { H, W, peak = 0.55, r0 = 0.16, belly = 1.0, tailLen = 0.18, tailH = 0.2, fork = 0.5, nose = 1.0 } = sh;
  const zt = -0.5 + tailLen, NZ = sh.nz || 34, NA = sh.na || 22, P = [], Cc = [], I = [];
  const prof = (t) => t < peak ? r0 + (1 - r0) * Math.sin(0.5 * Math.PI * t / peak) : Math.pow(Math.max(0, 1 - Math.pow((t - peak) / (1 - peak), 2)), 0.5 * nose);
  const zOf = (t) => zt + t * (0.5 - zt);
  for (let i = 0; i <= NZ; i++) {
    const t = i / NZ, z = zOf(t), f = prof(t);
    for (let j = 0; j <= NA; j++) {
      const a = j / NA * Math.PI * 2, ca = Math.cos(a), sa = Math.sin(a);
      const x = W * f * ca; let y = H * f * sa; if (y < 0) y *= belly;
      P.push(x, y, z); paint(tmpC, z, sa, ca, t); Cc.push(tmpC.r, tmpC.g, tmpC.b);
    }
  }
  for (let i = 0; i < NZ; i++) for (let j = 0; j < NA; j++) { const a = i * (NA + 1) + j, b = a + NA + 1; I.push(a, b, a + 1, b, b + 1, a + 1); }
  const body = new THREE.BufferGeometry(); body.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); body.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3)); body.setIndex(I); body.computeVertexNormals();
  const parts = [body];
  const sheet = (fn, nu, nv, kind) => {
    const P2 = [], C2 = [], I2 = [];
    for (let i = 0; i <= nu; i++) for (let j = 0; j <= nv; j++) { const u = i / nu, v = j / nv; const p = fn(u, v); P2.push(p[0], p[1], p[2]); finPaint(tmpC, kind, u, v, p[2]); C2.push(tmpC.r, tmpC.g, tmpC.b); }
    for (let i = 0; i < nu; i++) for (let j = 0; j < nv; j++) { const a = i * (nv + 1) + j, b = a + nv + 1; I2.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P2, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C2, 3)); g.setIndex(I2); g.computeVertexNormals(); parts.push(g);
  };
  const h0 = H * r0 * 0.9;
  // tail: v from -1..1 mapped
  sheet((u, v) => { const vv = v * 2 - 1, av = Math.abs(vv); const hh = h0 + (tailH - h0) * Math.pow(u, 0.8); return [0, vv * hh, zt + 0.01 - u * tailLen * (1 - fork * Math.pow(1 - av, 1.6))]; }, 8, 10, 'tail');
  const topY = (z) => { const t = (z - zt) / (0.5 - zt); return H * prof(Math.min(1, Math.max(0, t))); };
  if (sh.dorsal) { const d = sh.dorsal; sheet((u, v) => { const z = d.z0 + (d.z1 - d.z0) * u; const by = topY(z) * 0.92; const hgt = d.h * Math.sin(Math.PI * Math.pow(u, d.pow || 0.8)) ** 0.7; return [0, by + hgt * v, z - (d.rake || 0) * v * (1 - u * 0.3)]; }, 14, 3, 'dorsal'); }
  if (sh.anal) { const d = sh.anal; sheet((u, v) => { const z = d.z0 + (d.z1 - d.z0) * u; const by = -topY(z) * belly * 0.92; const hgt = d.h * Math.sin(Math.PI * Math.pow(u, d.pow || 0.8)) ** 0.7; return [0, by - hgt * v, z - (d.rake || 0) * v * (1 - u * 0.3)]; }, 12, 3, 'anal'); }
  // pectoral fins
  const pz = zt + 0.68 * (0.5 - zt), pw = W * prof(0.68);
  for (const s of [-1, 1]) sheet((u, v) => [s * (pw * 0.95 + u * 0.09), -H * 0.18 + (v - 0.5) * 0.06 * (1 - u * 0.5) - u * 0.03, pz - u * 0.09 - v * 0.04], 3, 2, 'pect');
  // eyes
  const ez = zt + (sh.eyeT || 0.86) * (0.5 - zt), ef = prof(sh.eyeT || 0.86), er = sh.eyeR || 0.035;
  for (const s of [-1, 1]) { const e = new THREE.SphereGeometry(er, 10, 8); e.scale(0.6, 1, 1); e.translate(s * W * ef * 0.88, H * ef * (sh.eyeY ?? 0.22), ez); const n = e.attributes.position.count, c = new Float32Array(n * 3), ec = C(eyeCol); for (let i = 0; i < n; i++) c.set([ec.r, ec.g, ec.b], i * 3); e.setAttribute('color', new THREE.BufferAttribute(c, 3)); e.deleteAttribute('uv'); parts.push(e); }
  return mergeGeometries(parts);
}

// ---------------- species ----------------
export const SPECIES = {
  minnow: {
    kind: 'fish', len: 0.42, speed: 2.8, minSpeed: 1.4, school: 1.0, start: 16, max: 60, step: 10, cost: 0, addCost: 8, y: [2, 12], turn: 3.0, freq: 14,
    shape: { H: 0.13, W: 0.065, peak: 0.5, r0: 0.18, tailLen: 0.2, tailH: 0.11, fork: 0.7, dorsal: { z0: -0.05, z1: 0.12, h: 0.06, rake: 0.03 }, anal: { z0: -0.2, z1: -0.05, h: 0.04, rake: 0.02 }, eyeR: 0.03 },
    paint: (c, z, sa) => { c.copy(C('#e4f0f2')).lerp(C('#2d6f94'), sstep(0.2, 0.75, sa)).lerp(C('#fbfdfc'), sstep(-0.2, -0.8, sa)); const st = Math.exp(-Math.pow((sa - 0.12) / 0.09, 2)); c.lerp(C('#9ffcff').multiplyScalar(1.5), st * 0.8); },
    fin: (c) => c.copy(C('#bcd8e2')),
    sheen: C('#3fa8c8'),
  },
  clown: {
    kind: 'fish', len: 0.55, speed: 1.4, minSpeed: 0.5, school: 0.15, start: 0, max: 12, step: 2, cost: 20, addCost: 10, y: [0.8, 5], turn: 3.5, freq: 12, home: true,
    shape: { H: 0.25, W: 0.12, peak: 0.5, r0: 0.25, tailLen: 0.17, tailH: 0.17, fork: 0.0, nose: 0.8, dorsal: { z0: -0.3, z1: 0.22, h: 0.1, rake: 0.02, pow: 0.9 }, anal: { z0: -0.26, z1: -0.04, h: 0.09, rake: 0.03 }, eyeR: 0.04, eyeT: 0.85 },
    paint: (c, z) => {
      c.copy(C('#ff7418')); let band = 0;
      for (const [bz, bw] of [[0.27, 0.045], [0.02, 0.055], [-0.24, 0.03]]) { const d = Math.abs(z - bz); if (d < bw) band = 2; else if (d < bw + 0.018 && band < 1) band = 1; }
      if (band === 2) c.copy(C('#fff9f2')); else if (band === 1) c.copy(C('#1a1210'));
      if (z > 0.42) c.lerp(C('#ff9a3a'), 0.4);
    },
    fin: (c, kind, u, v) => { c.copy(C('#ff7418')); if (v > 0.78) c.copy(C('#1a1210')); if (kind === 'tail' && u > 0.85) c.copy(C('#1a1210')); if (kind === 'pect') c.copy(C('#ff8a30')); },
    sheen: C('#401800'),
  },
  angel: {
    kind: 'fish', len: 0.75, speed: 1.1, minSpeed: 0.4, school: 0.2, start: 0, max: 10, step: 2, cost: 35, addCost: 14, y: [2, 9], turn: 2.0, freq: 8,
    shape: { H: 0.38, W: 0.07, peak: 0.45, r0: 0.18, tailLen: 0.16, tailH: 0.2, fork: 0.15, nose: 0.9, dorsal: { z0: -0.3, z1: 0.25, h: 0.38, rake: 0.32, pow: 0.7 }, anal: { z0: -0.3, z1: 0.12, h: 0.34, rake: 0.3, pow: 0.7 }, eyeR: 0.04, eyeT: 0.84 },
    paint: (c, z, sa) => { c.copy(C('#ffd23f')).lerp(C('#ffb02a'), sstep(0.3, -0.6, sa)); const s = Math.sin(z * 34 + sa * 1.2); if (s > 0.55 && z < 0.3) c.lerp(C('#2a58c8'), 0.9); if (z > 0.38) c.lerp(C('#3070e0'), 0.75); },
    fin: (c, kind, u, v) => { c.copy(C('#ffd23f')); if (kind === 'dorsal' || kind === 'anal') { if (v > 0.55) c.lerp(C('#2a6ae0'), 0.85); if (v > 0.9) c.copy(C('#9fe8ff')); } if (kind === 'tail') c.copy(C('#ffe070')); },
    sheen: C('#203060'),
  },
  tang: {
    kind: 'fish', len: 0.62, speed: 2.0, minSpeed: 0.8, school: 0.55, start: 0, max: 24, step: 4, cost: 45, addCost: 12, y: [2, 10], turn: 2.6, freq: 10,
    shape: { H: 0.3, W: 0.08, peak: 0.45, r0: 0.16, tailLen: 0.17, tailH: 0.2, fork: 0.35, nose: 0.9, dorsal: { z0: -0.3, z1: 0.24, h: 0.08, rake: 0.03, pow: 1 }, anal: { z0: -0.3, z1: 0.0, h: 0.07, rake: 0.03, pow: 1 }, eyeR: 0.038 },
    paint: (c, z, sa) => { c.copy(C('#2063e0')).lerp(C('#3a8cff'), sstep(-0.4, 0.4, -sa) * 0.4); const pal = Math.abs(sa - 0.25 - Math.sin(z * 6) * 0.25) < 0.14 && z < 0.32 && z > -0.28; if (pal) c.copy(C('#0d1428')); if (z < -0.28) c.lerp(C('#ffd02a'), sstep(-0.28, -0.33, z)); },
    fin: (c, kind, u, v) => { c.copy(C('#1d4fb8')); if (v > 0.8) c.copy(C('#0d1428')); if (kind === 'tail') c.copy(C('#ffd02a')); if (kind === 'pect') c.copy(C('#ffd860')); },
    sheen: C('#2060ff'),
  },
  whale: {
    kind: 'fish', len: 9.5, speed: 2.1, minSpeed: 1.3, school: 0, start: 0, max: 1, step: 1, cost: 260, addCost: 0, y: [10, 19], turn: 0.35, freq: 2.2, large: true, wide: 30,
    shape: { nz: 170, na: 64, H: 0.11, W: 0.13, peak: 0.62, r0: 0.12, tailLen: 0.2, tailH: 0.2, fork: 0.55, nose: 0.55, belly: 0.75, dorsal: { z0: -0.06, z1: 0.06, h: 0.09, rake: 0.05, pow: 0.6 }, eyeR: 0.012, eyeT: 0.95, eyeY: 0.05 },
    paint: (c, z, sa, ca) => {
      c.copy(C('#d8e2e4')).lerp(C('#2d4658'), sstep(-0.45, 0.05, sa));
      if (sa > -0.25) { const gz = z * 42, gy = Math.atan2(sa, ca) * 1.6 + Math.floor(gz) * 0.5; const fx = gz - Math.floor(gz) - 0.5, fy = gy - Math.floor(gy) - 0.5; const sp = Math.hypot(fx, fy) < 0.26; const stripe = false; if (sp || stripe) c.copy(C('#e8f2f0')); }
    },
    fin: (c, kind, u, v) => { c.copy(C('#5e7f96')).lerp(C('#8aa8b8'), u * 0.4); if (((u * 9 | 0) + (v * 7 | 0)) % 3 === 0 && kind !== 'pect') c.lerp(C('#dfeaea'), 0.5); },
    sheen: C('#102030'),
  },
  jelly: { kind: 'jelly', len: 1.0, start: 0, max: 20, step: 4, cost: 55, addCost: 12 },
  turtle: { kind: 'turtle', len: 1.6, start: 0, max: 3, step: 1, cost: 110, addCost: 80, large: true, speed: 1.3, minSpeed: 0.7, y: [2.5, 11], turn: 0.6, wide: 22 },
  manta: { kind: 'manta', len: 2.7, start: 0, max: 2, step: 1, cost: 170, addCost: 120, large: true, speed: 2.6, minSpeed: 1.6, y: [7, 17], turn: 0.5, wide: 28 },
};
export const SPECIES_ORDER = ['minnow', 'clown', 'angel', 'tang', 'jelly', 'turtle', 'manta', 'whale'];

// ---------------- generic swimmer group ----------------
const UP = new THREE.Vector3(0, 1, 0);
const m4 = new THREE.Matrix4(), v1 = new THREE.Vector3(), v2 = new THREE.Vector3(), v3 = new THREE.Vector3();
export class Group {
  constructor(id, sp, max) {
    this.id = id; this.sp = sp; this.max = max; this.n = 0;
    this.pos = []; this.vel = []; this.ph = []; this.bend = []; this.tgt = []; this.tgtT = []; this.grow = [];
    this.groupTarget = new THREE.Vector3(0, 6, 0); this.groupT = 0; this.home = null; this.r = rng(id.length * 97);
  }
  randomPoint(out, near) {
    const sp = this.sp, r = this.r;
    if (near) { out.set(near.x + (r() - 0.5) * 5, near.y + (r() - 0.3) * 2.5, near.z + (r() - 0.5) * 5); return out; }
    const R = sp.wide || 20, a = r() * 6.28, d = Math.sqrt(r()) * R;
    out.set(Math.cos(a) * d, 0, Math.sin(a) * d); out.y = Math.max(sandHeight(out.x, out.z) + 1, sp.y[0]) + r() * (sp.y[1] - sp.y[0]);
    return out;
  }
  add(arrive) {
    if (this.n >= this.max) return -1;
    const i = this.n++, p = new THREE.Vector3();
    if (arrive) { const a = this.r() * 6.28; p.set(Math.cos(a) * 34, (this.sp.y[0] + this.sp.y[1]) / 2, Math.sin(a) * 34); }
    else if (this.sp.school > 0.5 && i > 0) p.copy(this.pos[0]).add(v1.set(this.r() - 0.5, this.r() - 0.5, this.r() - 0.5).multiplyScalar(3));
    else this.randomPoint(p, this.home);
    this.pos[i] = p; this.vel[i] = new THREE.Vector3(-p.x, 0, -p.z).normalize().multiplyScalar(this.sp.speed || 1);
    if (!arrive) this.vel[i].set(this.r() - 0.5, 0, this.r() - 0.5).normalize().multiplyScalar(this.sp.speed || 1);
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
      // goal
      const goal = school > 0.5 ? this.groupTarget : this.tgt[i];
      acc.addScaledVector(v1.subVectors(goal, p).normalize(), 0.9);
      // flocking
      if (school > 0) {
        let cnt = 0; const coh = v1.set(0, 0, 0), ali = v2.set(0, 0, 0);
        for (let j = 0; j < n; j++) { if (j === i) continue; const q = this.pos[j]; const dx = p.x - q.x, dy = p.y - q.y, dz = p.z - q.z, d2 = dx * dx + dy * dy + dz * dz;
          if (d2 < 0.36 * sp.len * 6) { const k = 1.6 / (d2 + 0.02); acc.x += dx * k * 0.08; acc.y += dy * k * 0.08; acc.z += dz * k * 0.08; }
          if (d2 < 9) { coh.add(q); ali.add(this.vel[j]); cnt++; } }
        if (cnt) { coh.multiplyScalar(1 / cnt).sub(p); acc.addScaledVector(coh, 0.5 * school); ali.multiplyScalar(1 / cnt).sub(v); acc.addScaledVector(ali, 0.6 * school); }
      }
      // food
      if (ctx.food && ctx.food.length && !sp.large) {
        let best = null, bd = 1e9; for (const f of ctx.food) { if (f.eaten) continue; const d = f.p.distanceToSquared(p); if (d < bd) { bd = d; best = f; } }
        if (best && bd < 400) { acc.addScaledVector(v1.subVectors(best.p, p).normalize(), 3.0); if (bd < 0.12 + sp.len * 0.2) ctx.onEat(best, this, i); }
      }
      // obstacles
      for (const o of obstacles) { const dx = p.x - o.x, dy = p.y - o.y, dz = p.z - o.z, d = Math.hypot(dx, dy, dz), rr = o.r + sp.len * 0.6 + 0.4; if (d < rr) { const k = (rr - d) / rr * 4; acc.x += dx / d * k; acc.y += dy / d * k * 0.6; acc.z += dz / d * k; } }
      // bounds
      const R = (sp.wide || 24) + 4, rad = Math.hypot(p.x, p.z); if (rad > R) { acc.x -= p.x / rad * (rad - R) * 0.4; acc.z -= p.z / rad * (rad - R) * 0.4; }
      const floor = sandHeight(p.x, p.z) + 0.6 + sp.len * 0.3; if (p.y < floor + 0.5) acc.y += (floor + 0.5 - p.y) * 3; if (p.y > sp.y[1] + 2) acc.y -= (p.y - sp.y[1] - 2) * 0.5;
      if (ctx.avoid) { const dx = p.x - ctx.avoid.x, dy = p.y - ctx.avoid.y, dz = p.z - ctx.avoid.z, d = Math.hypot(dx, dy, dz); if (d < 2.2 && !sp.large) { acc.x += dx / d * 3; acc.y += dy / d * 3; acc.z += dz / d * 3; } }
      // integrate
      const prevX = v.x, prevZ = v.z;
      v.addScaledVector(acc, dt * sp.turn);
      let s = v.length(); const sT = THREE.MathUtils.clamp(s, minS, maxS * (ctx.food && ctx.food.length ? 1.4 : 1)); v.multiplyScalar(sT / Math.max(s, 1e-4)); s = sT;
      v.y *= 1 - dt * 1.5; // prefer level swimming
      p.addScaledVector(v, dt);
      const yawRate = (prevX * v.z - prevZ * v.x) / (s * s + 1e-4) / dt;
      if (Number.isFinite(yawRate)) this.bend[i] += (THREE.MathUtils.clamp(yawRate * 0.25, -0.5, 0.5) - this.bend[i]) * Math.min(1, dt * 5);
      this.ph[i] += dt * ((sp.freq || 2) * (0.45 + 0.55 * s / maxS));
      if (this.grow[i] < 1) this.grow[i] = Math.min(1, this.grow[i] + dt * 0.25);
    }
  }
}

// ---------------- fish (instanced) ----------------
export class FishSpecies extends Group {
  constructor(id, hq) {
    const sp = SPECIES[id]; super(id, sp, sp.max);
    const geo = fishGeometry(sp.shape, sp.paint, sp.fin);
    this.attr = new THREE.InstancedBufferAttribute(new Float32Array(sp.max * 4), 4); this.attr.setUsage(THREE.DynamicDrawUsage); geo.setAttribute('aSwim', this.attr);
    const mat = underwater(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: id === 'minnow' ? 0.3 : 0.5, metalness: id === 'minnow' ? 0.35 : 0.05, side: THREE.DoubleSide }), { swim: 'fish', caus: 0.55, rim: 0.7, sheen: sp.sheen });
    this.mesh = new THREE.InstancedMesh(geo, mat, sp.max); this.mesh.count = 0; this.mesh.frustumCulled = false; this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  }
  sync() {
    const s = this.sp.len;
    for (let i = 0; i < this.n; i++) {
      const v = this.vel[i]; m4.identity().lookAt(v, v2.set(0, 0, 0), UP); const g = s * this.grow[i]; m4.scale(v1.set(g, g, g)); m4.setPosition(this.pos[i]); this.mesh.setMatrixAt(i, m4);
      this.attr.setXYZW(i, this.ph[i], 0, this.bend[i], this.sp.large ? 0.7 : 1);
    }
    this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true; this.attr.needsUpdate = true;
  }
  worldPos(i) { return this.pos[i]; }
}

// ---------------- manta (instanced, flapping in shader) ----------------
function mantaGeometry() {
  const NX = 44, NV = 14, parts = [];
  const le = (ax) => 0.42 - 0.52 * Math.pow(ax, 1.35), te = (ax) => -0.42 + 0.3 * Math.pow(ax, 0.9);
  for (const side of [1, -1]) {
    const P = [], Cc = [], I = [];
    for (let i = 0; i <= NX; i++) for (let j = 0; j <= NV; j++) {
      const x = -1 + 2 * i / NX, ax = Math.abs(x), v = j / NV, z = te(ax) + (le(ax) - te(ax)) * v;
      const th = (0.11 * Math.pow(1 - ax, 1.6) * Math.sin(Math.PI * v) + 0.004) * side;
      P.push(x, th, z);
      if (side > 0) { tmpC.copy(C('#1c2836')).lerp(C('#2a3c4e'), noise3(x * 5, 0, z * 5)); if (ax > 0.12 && ax < 0.45 && v > 0.55 && v < 0.85) tmpC.lerp(C('#c8d2da'), 0.75 * sstep(0.12, 0.2, ax) * sstep(0.45, 0.35, ax)); }
      else { tmpC.copy(C('#eef3f4')).lerp(C('#5a6c7a'), sstep(0.7, 1.0, ax) + sstep(0.15, 0.0, v) * 0.6); if (noise3(x * 9, 3, z * 9) > 0.68 && ax < 0.4) tmpC.lerp(C('#30383e'), 0.7); }
      Cc.push(tmpC.r, tmpC.g, tmpC.b);
    }
    for (let i = 0; i < NX; i++) for (let j = 0; j < NV; j++) { const a = i * (NV + 1) + j, b = a + NV + 1; if (side > 0) I.push(a, a + 1, b, b, a + 1, b + 1); else I.push(a, b, a + 1, b, b + 1, a + 1); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3)); g.setIndex(I); g.computeVertexNormals(); parts.push(g);
  }
  // cephalic fins
  for (const s of [-1, 1]) { const g = new THREE.CylinderGeometry(0.025, 0.04, 0.2, 6, 1); g.rotateX(Math.PI / 2); g.translate(s * 0.11, 0.0, 0.47); g.deleteAttribute('uv'); const n = g.attributes.position.count, c = new Float32Array(n * 3).fill(0.15); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.toNonIndexed; parts.push(g); }
  { const g = new THREE.CylinderGeometry(0.004, 0.018, 0.75, 5, 1); g.rotateX(Math.PI / 2); g.translate(0, 0, -0.78); g.deleteAttribute('uv'); const n = g.attributes.position.count, c = new Float32Array(n * 3).fill(0.12); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); parts.push(g); }
  return mergeGeometries(parts.map(p => p.index ? p : p));
}
export class Mantas extends Group {
  constructor() {
    const sp = SPECIES.manta; super('manta', sp, sp.max);
    const geo = mantaGeometry(); this.attr = new THREE.InstancedBufferAttribute(new Float32Array(sp.max * 4), 4); geo.setAttribute('aSwim', this.attr);
    this.mesh = new THREE.InstancedMesh(geo, underwater(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55, side: THREE.DoubleSide }), { swim: 'manta', caus: 0.8, rim: 0.6 }), sp.max);
    this.mesh.count = 0; this.mesh.frustumCulled = false;
  }
  sync() {
    for (let i = 0; i < this.n; i++) { const v = this.vel[i]; m4.identity().lookAt(v, v2.set(0, 0, 0), UP); const roll = THREE.MathUtils.clamp(-this.bend[i] * 0.8, -0.4, 0.4); m4.multiply(new THREE.Matrix4().makeRotationZ(roll)); const g = this.sp.len * this.grow[i]; m4.scale(v1.set(g, g, g)); m4.setPosition(this.pos[i]); this.mesh.setMatrixAt(i, m4); this.attr.setXYZW(i, this.ph[i], 0, 0, 1); }
    this.mesh.count = this.n; this.mesh.instanceMatrix.needsUpdate = true; this.attr.needsUpdate = true;
  }
}
SPECIES.manta.freq = 1.6;
SPECIES.turtle.freq = 1.5;

// ---------------- turtles (small groups with animated flippers) ----------------
function turtleModel() {
  const root = new THREE.Group();
  const mat = underwater(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), { caus: 0.9, rim: 0.6 });
  const shell = new THREE.SphereGeometry(0.5, 40, 20); const p = shell.attributes.position, c = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const top = y > 0; y = top ? y * 0.55 : y * 0.22; z *= 1.25; x *= 1.0; p.setXYZ(i, x, y, z);
    if (top) { // scutes: voronoi-ish cells
      let f1 = 9, f2 = 9; for (const [cx, cz] of [[0, 0.32], [0, 0.0], [0, -0.32], [0.3, 0.2], [-0.3, 0.2], [0.3, -0.18], [-0.3, -0.18], [0, 0.6], [0.45, 0.45], [-0.45, 0.45], [0.48, -0.1], [-0.48, -0.1], [0, -0.6], [0.4, -0.45], [-0.4, -0.45]]) { const d = Math.hypot(x - cx, z - cz); if (d < f1) { f2 = f1; f1 = d; } else if (d < f2) f2 = d; }
      const edge = sstep(0.06, 0.0, f2 - f1); tmpC.copy(C('#5a4022')).lerp(C('#8a6a3a'), sstep(0.25, 0.0, f1)).lerp(C('#3a5a3a'), noise3(x * 6, y * 6, z * 6) * 0.5).lerp(C('#e8d6a8'), edge * 0.75);
    } else tmpC.copy(C('#e6d29a'));
    c.set([tmpC.r, tmpC.g, tmpC.b], i * 3);
  }
  shell.setAttribute('color', new THREE.BufferAttribute(c, 3)); shell.computeVertexNormals();
  root.add(new THREE.Mesh(shell, mat));
  const skin = (g, a = '#7a8a5a', b = '#d8c890') => { const p = g.attributes.position, c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const n = noise3(p.getX(i) * 18, p.getY(i) * 18, p.getZ(i) * 18); tmpC.copy(C(a)).lerp(C(b), n > 0.55 ? 0.8 : 0.1); c.set([tmpC.r, tmpC.g, tmpC.b], i * 3); } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g; };
  const head = new THREE.Mesh(skin(new THREE.SphereGeometry(0.16, 20, 14).scale(0.9, 0.75, 1.3)), mat); head.position.set(0, 0.03, 0.75); root.add(head);
  const neck = new THREE.Mesh(skin(new THREE.CylinderGeometry(0.1, 0.13, 0.3, 12).rotateX(Math.PI / 2)), mat); neck.position.set(0, 0.01, 0.6); root.add(neck);
  for (const s of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), new THREE.MeshStandardMaterial({ color: '#080808', roughness: 0.2 })); e.position.set(s * 0.1, 0.07, 0.85); root.add(e); }
  const flip = (len, w, x, z, front) => { const piv = new THREE.Group(); piv.position.set(x, -0.02, z); const g = skin(new THREE.SphereGeometry(0.5, 16, 8).scale(len, 0.05, w)); g.translate(Math.sign(x) * len * 0.45, 0, -w * 0.25); const m = new THREE.Mesh(g, mat); piv.add(m); piv.rotation.y = Math.sign(x) * (front ? -0.35 : 0.5); root.add(piv); return piv; };
  root.userData.fl = [flip(0.95, 0.32, 0.4, 0.35, true), flip(0.95, 0.32, -0.4, 0.35, true), flip(0.35, 0.22, 0.32, -0.45, false), flip(0.35, 0.22, -0.32, -0.45, false)];
  root.userData.head = head;
  return root;
}
export class Turtles extends Group {
  constructor() { super('turtle', SPECIES.turtle, SPECIES.turtle.max); this.mesh = new THREE.Group(); this.models = []; }
  add(arrive) { const i = super.add(arrive); if (i >= 0) { const m = turtleModel(); this.models.push(m); this.mesh.add(m); } return i; }
  sync() {
    for (let i = 0; i < this.n; i++) {
      const m = this.models[i], v = this.vel[i]; m.position.copy(this.pos[i]); m4.identity().lookAt(v, v2.set(0, 0, 0), UP); m.quaternion.setFromRotationMatrix(m4); m.rotateZ(-this.bend[i] * 0.6); m.scale.setScalar(this.sp.len * this.grow[i]);
      const ph = this.ph[i], fl = m.userData.fl;
      fl[0].rotation.z = Math.sin(ph) * 0.55; fl[1].rotation.z = -Math.sin(ph) * 0.55; fl[0].rotation.x = fl[1].rotation.x = Math.cos(ph) * 0.25;
      fl[2].rotation.z = Math.sin(ph + 1) * 0.2; fl[3].rotation.z = -Math.sin(ph + 1) * 0.2;
      m.userData.head.rotation.y = Math.sin(ph * 0.3) * 0.15;
    }
  }
}

// ---------------- jellyfish ----------------
const JELLY_VS = `
  uniform float uTime; attribute float aPh; varying float vH; varying vec3 vN; varying vec3 vV; varying vec2 vUv2; varying float vPh;
  uniform float uPart;
  void main(){
    vec3 p = position; float ph = uTime * 1.3 + aPh * 6.2831; float pulse = sin(ph);
    if (uPart < 0.5) { float k = smoothstep(0.0, 1.0, 1.0 - p.y / 0.55); p.xz *= 1.0 + pulse * 0.12 * k; p.y *= 1.0 - pulse * 0.08; }
    else { float d = -p.y; p.x += sin(ph * 0.8 - d * 2.5 + p.z * 4.0) * d * 0.12; p.z += cos(ph * 0.7 - d * 2.2 + p.x * 4.0) * d * 0.12; p.xz *= 1.0 + pulse * 0.08 * smoothstep(0.3, 0.0, d); }
    vH = position.y; vUv2 = position.xz; vPh = pulse;
    vec4 w = instanceMatrix * vec4(p, 1.0); vec4 mv = modelViewMatrix * w;
    vN = normalize(normalMatrix * mat3(instanceMatrix) * normal); vV = -mv.xyz;
    gl_Position = projectionMatrix * mv;
  }`;
const JELLY_FS = `
  uniform float uPart; uniform vec3 uCol; uniform vec3 uGlow; varying float vH; varying vec3 vN; varying vec3 vV; varying vec2 vUv2; varying float vPh;
  void main(){
    float fr = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 1.6);
    float dist = length(vV); float fade = exp(-dist * 0.03);
    if (uPart < 0.5) {
      float r = length(vUv2), ang = atan(vUv2.y, vUv2.x);
      float rings = smoothstep(0.05, 0.0, abs(length(vUv2 - 0.14 * vec2(cos(floor(ang / 1.5708 + 0.5) * 1.5708), sin(floor(ang / 1.5708 + 0.5) * 1.5708))) - 0.07)) * step(0.3, vH);
      vec3 c = uCol * (0.18 + fr * 0.9) + uGlow * rings * 0.9 + uGlow * smoothstep(0.08, 0.0, abs(r - 0.5)) * 0.4;
      gl_FragColor = vec4(c * fade * (0.9 + 0.2 * vPh), 1.0);
    } else {
      float a = (1.0 - smoothstep(0.0, 2.2, -vH));
      gl_FragColor = vec4(uCol * (0.35 + fr * 0.5) * a * fade, 1.0);
    }
  }`;
export class Jellies {
  constructor() {
    this.sp = SPECIES.jelly; this.max = this.sp.max; this.n = 0; this.pos = []; this.vel = []; this.r = rng(1234); this.id = 'jelly'; this.grow = [];
    const bell = new THREE.LatheGeometry(Array.from({ length: 14 }, (_, i) => { const t = i / 13; return new THREE.Vector2(Math.sin(t * Math.PI / 2) * 0.5 * (1 + 0.08 * t), Math.cos(t * Math.PI / 2) * 0.5 - 0.05 * t * t); }), 32);
    const strands = []; const r = rng(77);
    for (let k = 0; k < 18; k++) { const a = k / 18 * 6.28, rr = 0.46, len = 1.4 + r() * 1.2; const g = new THREE.CylinderGeometry(0.006, 0.01, len, 3, 16, true); g.translate(Math.cos(a) * rr, -len / 2 - 0.02, Math.sin(a) * rr); strands.push(g); }
    for (let k = 0; k < 4; k++) { const a = k / 4 * 6.28 + 0.4, len = 1.0 + r() * 0.4; const g = new THREE.CylinderGeometry(0.03, 0.06, len, 6, 16, true); g.translate(Math.cos(a) * 0.08, -len / 2, Math.sin(a) * 0.08); strands.push(g); }
    const tent = mergeGeometries(strands);
    this.aPh = new THREE.InstancedBufferAttribute(new Float32Array(this.max), 1);
    for (let i = 0; i < this.max; i++) this.aPh.array[i] = r();
    bell.setAttribute('aPh', this.aPh); tent.setAttribute('aPh', this.aPh);
    const mk = (part) => new THREE.ShaderMaterial({ uniforms: { uTime: U.uTime, uPart: { value: part }, uCol: { value: C('#b8a8ff') }, uGlow: { value: C('#ffb0e0').multiplyScalar(1.4) } }, vertexShader: JELLY_VS, fragmentShader: JELLY_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide });
    this.bell = new THREE.InstancedMesh(bell, mk(0), this.max); this.tent = new THREE.InstancedMesh(tent, mk(1), this.max);
    this.bell.count = this.tent.count = 0; this.bell.frustumCulled = this.tent.frustumCulled = false;
    this.mesh = new THREE.Group(); this.mesh.add(this.bell, this.tent);
    this.light = new THREE.PointLight('#c8a8ff', 0, 10, 1.5); this.mesh.add(this.light);
  }
  add(arrive) {
    if (this.n >= this.max) return -1; const i = this.n++, r = this.r;
    const a = r() * 6.28, d = arrive ? 26 : 6 + r() * 16; this.pos[i] = new THREE.Vector3(Math.cos(a) * d + 6, 8 + r() * 9, Math.sin(a) * d - 6); this.vel[i] = new THREE.Vector3((r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3); this.grow[i] = arrive ? 0.1 : 1;
    this.aPh.array[i] = r(); this.aPh.needsUpdate = true; return i;
  }
  step(dt) {
    const t = U.uTime.value;
    for (let i = 0; i < this.n; i++) {
      const p = this.pos[i], v = this.vel[i]; const ph = t * 1.3 + this.aPh.array[i] * 6.2831;
      const thrust = Math.max(0, Math.cos(ph)) * 0.35; v.y += (thrust - 0.12) * dt; v.y *= 1 - dt * 0.8;
      v.x += (Math.sin(t * 0.05 + i) * 0.05 - p.x * 0.002) * dt; v.z += (Math.cos(t * 0.04 + i * 2) * 0.05 - p.z * 0.002) * dt;
      p.addScaledVector(v, dt); if (p.y > 19) v.y -= dt * 0.5; if (p.y < 5) v.y += dt * 0.5;
      if (this.grow[i] < 1) this.grow[i] = Math.min(1, this.grow[i] + dt * 0.2);
    }
  }
  sync() {
    for (let i = 0; i < this.n; i++) { const s = (0.9 + (i % 3) * 0.25) * this.grow[i]; m4.makeRotationFromEuler(new THREE.Euler(Math.sin(i + U.uTime.value * 0.2) * 0.15, i, Math.cos(i * 2 + U.uTime.value * 0.15) * 0.15)); m4.scale(v1.set(s, s, s)); m4.setPosition(this.pos[i]); this.bell.setMatrixAt(i, m4); this.tent.setMatrixAt(i, m4); }
    this.bell.count = this.tent.count = this.n; this.bell.instanceMatrix.needsUpdate = this.tent.instanceMatrix.needsUpdate = true;
    if (this.n) { this.light.position.copy(this.pos[0]); this.light.intensity = 4; }
  }
}
