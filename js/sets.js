// BLUE HAVEN r5 — theme sets (shipwreck · ruins · crystal cave). Procedural, original geometry. © MOTOR AA
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rng, sandHeight, deep, setGlow, noise3 } from './common.js?v=r5';
import { makeRock, obstacles } from './env.js?v=r5';

const C = (h) => new THREE.Color(h);
const mat = deep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9 }), { rim: 0.4, glow: 1.7 });
const matD = deep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }), { rim: 0.4, glow: 1.7 });
const crystalMat = deep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.25, metalness: 0.1 }), { rim: 0.9, glow: 2.0 });
function paint(g, fn) { // fn(color, x, y, z) => glow
  if (g.index) g = g.toNonIndexed(); if (g.attributes.uv) g.deleteAttribute('uv');
  const p = g.attributes.position, col = new Float32Array(p.count * 3), gl = new Float32Array(p.count), c = new THREE.Color();
  for (let i = 0; i < p.count; i++) { gl[i] = fn(c, p.getX(i), p.getY(i), p.getZ(i)) || 0; col.set([c.r, c.g, c.b], i * 3); }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aGlow', new THREE.BufferAttribute(gl, 1)); g.computeVertexNormals(); return g;
}
const place = (g, x, y, z, rx = 0, ry = 0, rz = 0, s = 1) => { g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, rz)), new THREE.Vector3(s, s, s))); return g; };

// ---- sunken ship: listing half-buried hull, ribs at the broken stern, a fallen mast and a softly glowing chest ----
function shipwreck() {
  const cx = -8, cz = -19, g = new THREE.Group(), r = rng(901), parts = [], wood = C('#3a2c26'), wood2 = C('#5a4636'), moss = C('#2a5a50');
  const prof = []; for (let i = 0; i <= 18; i++) { const t = i / 18; prof.push(new THREE.Vector2(1.9 * Math.pow(Math.sin(Math.PI * (0.05 + t * 0.9)), 0.55), (t - 0.5) * 11)); }
  let hull = new THREE.LatheGeometry(prof, 28, -Math.PI * 0.32, Math.PI * 0.82); // open-topped half shell
  hull = paint(hull, (c, x, y, z) => { const plank = Math.abs(Math.sin(Math.atan2(z, x) * 9)) < 0.12; c.copy(plank ? wood : wood2); const n = noise3(x * 1.3, y * 0.7, z * 1.3); if (n > 0.6) c.lerp(moss, 0.6); if (n > 0.74) { c.copy(C('#5af0d0')); return 1.6; } return 0; });
  parts.push(place(hull, 0, 0, 0, Math.PI / 2, 0, 0)); // axis along z
  for (let i = 0; i < 6; i++) { let rib = new THREE.TorusGeometry(1.75, 0.09, 6, 16, Math.PI * 0.95); rib = paint(rib, (c) => { c.copy(wood); return 0; }); parts.push(place(rib, 0, 0, 5.6 + i * 0.55, 0, 0, Math.PI * 1.02 + r() * 0.1, 1 - i * 0.07)); }
  for (let i = 0; i < 7; i++) { let pl = new THREE.BoxGeometry(3.4, 0.08, 0.5); pl = paint(pl, (c) => { c.copy(i % 2 ? wood2 : wood); return 0; }); parts.push(place(pl, 0.2, -0.05, -4 + i * 1.15, 0, (r() - 0.5) * 0.1, (r() - 0.5) * 0.2)); }
  let mast = new THREE.CylinderGeometry(0.13, 0.18, 7.5, 8); mast = paint(mast, (c, x, y) => { c.copy(wood2); return 0; });
  parts.push(place(mast, 1.8, 0.9, -0.5, 0.15, 0, -1.25));
  let yard = new THREE.CylinderGeometry(0.08, 0.08, 3.6, 6); yard = paint(yard, (c) => { c.copy(wood); return 0; }); parts.push(place(yard, 4.2, 1.9, -0.4, 0, 0.3, 0.2));
  let chest = new THREE.BoxGeometry(1.0, 0.62, 0.66); chest = paint(chest, (c, x, y) => { c.copy(C('#4a3424')); if (Math.abs(y - 0.08) < 0.05 || Math.abs(Math.abs(x) - 0.42) < 0.05) { c.copy(C('#d8a84a')); return 0.5; } return 0; });
  parts.push(place(chest, -2.3, 0.0, 2.8, 0, 0.6, 0.1));
  let gold = new THREE.IcosahedronGeometry(0.34, 1); gold = paint(gold, (c) => { c.copy(C('#ffd070')); return 2.2; }); parts.push(place(gold, -2.3, 0.36, 2.8, 0, 0, 0, 1)); parts.push(place(paint(new THREE.IcosahedronGeometry(0.2, 1), (c) => { c.copy(C('#ffe08a')); return 2.0; }), -1.85, 0.12, 3.25));
  for (let i = 0; i < 5; i++) { let lamp = new THREE.SphereGeometry(0.14, 10, 8); lamp = paint(lamp, (c) => { c.copy(C('#ffc27a')); return 2.4; }); parts.push(place(lamp, (r() - 0.5) * 2.4, 0.7 + r() * 0.4, -4 + i * 2)); }
  const m = new THREE.Mesh(mergeGeometries(parts), matD);
  const y0 = sandHeight(cx, cz) - 0.35; m.position.set(cx, y0, cz); m.rotation.set(0.05, 0.9, 0.32); g.add(m);
  g.add(makeRock(931, cx + 5, cz + 3, 1.2), makeRock(932, cx - 4.5, cz - 4, 1.0));
  for (let k = -2; k <= 2; k++) obstacles.push({ x: cx + Math.sin(0.9) * k * 2.4, y: y0 + 0.6, z: cz + Math.cos(0.9) * k * 2.4, r: 2.0 });
  g.userData.light = { pos: new THREE.Vector3(cx - 1, y0 + 2.5, cz + 1), color: '#ffb070', intensity: 7, dist: 13 };
  g.userData.focus = new THREE.Vector3(cx, y0 + 2, cz); g.userData.dist = 15;
  return g;
}

// ---- ancient ruins: fluted columns on a cracked platform, a lintel, fallen drums and glowing glyph rings ----
function ruins() {
  const cx = 18.5, cz = 3.5, g = new THREE.Group(), r = rng(777), parts = [], stone = C('#5a6270'), stone2 = C('#3e4656'), moss = C('#2f5a52');
  const y0 = sandHeight(cx, cz);
  const st = (c, x, y, z) => { c.copy(stone).lerp(stone2, noise3(x * 2, y * 2, z * 2)); if (noise3(x * 0.9 + 3, y * 1.4, z * 0.9) > 0.63) c.lerp(moss, 0.7); return 0; };
  let base = new THREE.BoxGeometry(8.5, 0.6, 6.0, 8, 1, 6); base = paint(base, st); parts.push(place(base, 0, 0.1, 0));
  let step = new THREE.BoxGeometry(9.6, 0.3, 7.0, 4, 1, 4); step = paint(step, st); parts.push(place(step, 0, -0.25, 0));
  const cols = [[-3.2, -2.1, 4.8], [-1.05, -2.1, 5.2], [1.1, -2.1, 3.1], [3.2, -2.1, 5.0], [-3.2, 2.1, 2.2], [3.2, 2.1, 4.1]];
  for (const [x, z, h] of cols) {
    let c = new THREE.CylinderGeometry(0.42, 0.48, h, 14, 6); const pos = c.attributes.position; for (let i = 0; i < pos.count; i++) { const a = Math.atan2(pos.getZ(i), pos.getX(i)), k = 1 - 0.07 * Math.max(0, Math.cos(a * 7)); pos.setX(i, pos.getX(i) * k); pos.setZ(i, pos.getZ(i) * k); }
    c = paint(c, st); parts.push(place(c, x, 0.4 + h / 2, z, (r() - 0.5) * 0.05, r() * 3, (r() - 0.5) * 0.05));
    let cap = new THREE.BoxGeometry(1.15, 0.32, 1.15); cap = paint(cap, st); if (h > 4.5) parts.push(place(cap, x, 0.4 + h + 0.16, z));
    let ring = new THREE.TorusGeometry(0.56, 0.05, 6, 24); ring = paint(ring, (cc) => { cc.copy(C('#5af0ff')); return 2.4; }); parts.push(place(ring, x, 1.0, z, Math.PI / 2, 0, 0));
  }
  let lintel = new THREE.BoxGeometry(5.2, 0.55, 1.1, 6, 1, 1); lintel = paint(lintel, st); parts.push(place(lintel, -1.0, 0.4 + 5.2 + 0.5, -2.1, 0, 0, -0.04));
  for (let i = 0; i < 3; i++) { let d = new THREE.CylinderGeometry(0.44, 0.44, 1.0, 14); d = paint(d, st); parts.push(place(d, 1.5 + i * 1.05, 0.85, 3.6 + r() * 0.3, Math.PI / 2 + (r() - 0.5) * 0.2, 0.3, 0)); }
  let glyph = new THREE.TorusGeometry(0.9, 0.06, 6, 6); glyph = paint(glyph, (cc) => { cc.copy(C('#9affd8')); return 2.6; }); parts.push(place(glyph, 0, 0.42, 0, Math.PI / 2, 0, 0));
  let glyph2 = new THREE.TorusGeometry(1.5, 0.04, 6, 32); glyph2 = paint(glyph2, (cc) => { cc.copy(C('#5ad8ff')); return 2.0; }); parts.push(place(glyph2, 0, 0.42, 0, Math.PI / 2, 0, 0));
  const m = new THREE.Mesh(mergeGeometries(parts), mat); m.position.set(cx, y0, cz); m.rotation.y = -0.5; g.add(m);
  for (const [x, z] of cols) { const v = new THREE.Vector3(x, 0, z).applyAxisAngle(new THREE.Vector3(0, 1, 0), -0.5); obstacles.push({ x: cx + v.x, y: y0 + 2.5, z: cz + v.z, r: 0.9 }); }
  g.userData.light = { pos: new THREE.Vector3(cx, y0 + 2.5, cz), color: '#60e8ff', intensity: 7, dist: 12 };
  g.userData.focus = new THREE.Vector3(cx, y0 + 2.6, cz); g.userData.dist = 14;
  return g;
}

// ---- crystal cave: a rock overhang sheltering clusters of violet & cyan crystals ----
function crystalCave() {
  const cx = 0.5, cz = 16.5, g = new THREE.Group(), r = rng(313), parts = [];
  const y0 = sandHeight(cx, cz);
  const cols = [['#b48aff', '#f0d8ff'], ['#5ae8ff', '#e0ffff'], ['#ff8ad8', '#ffe0f4']];
  for (let k = 0; k < 7; k++) {
    const a = r() * 6.28, d = 0.6 + Math.sqrt(r()) * 3.2, bx = Math.cos(a) * d, bz = Math.sin(a) * d, [c1, c2] = cols[k % 3];
    for (let i = 0; i < 5 + Math.floor(r() * 4); i++) {
      const h = 0.6 + r() * (k < 2 ? 2.6 : 1.5), rad = 0.1 + r() * 0.16;
      let cr = new THREE.CylinderGeometry(0, rad, h * 0.25, 6, 1); cr.translate(0, h * 0.875, 0);
      let body = new THREE.CylinderGeometry(rad, rad * 1.1, h * 0.75, 6, 1); body.translate(0, h * 0.375, 0);
      let geo = mergeGeometries([cr.toNonIndexed(), body.toNonIndexed()]);
      geo = paint(geo, (c, x, y) => { const t = y / h; c.copy(C(c1)).lerp(C(c2), t * t); return 0.4 + 2.2 * t * t; });
      parts.push(place(geo, bx + (r() - 0.5) * 0.5, -0.1, bz + (r() - 0.5) * 0.5, (r() - 0.5) * 0.9, r() * 6, (r() - 0.5) * 0.9));
    }
  }
  const m = new THREE.Mesh(mergeGeometries(parts), crystalMat); m.position.set(cx, y0, cz); g.add(m);
  // overhang: a short arc of rocks behind the crystals
  for (let i = 0; i <= 6; i++) { const a = Math.PI * (0.1 + 0.8 * i / 6), x = cx + Math.cos(a) * 4.4, z = cz + 1.5 + Math.sin(a) * 2.2, y = Math.sin(a) * 3.2; const rk = makeRock(950 + i, x, z, 1.2 + Math.sin(i * 1.7) * 0.3); rk.position.y += y; g.add(rk); obstacles.push({ x, y: rk.position.y, z, r: 1.3 }); }
  for (const [x, z] of [[1.5, 0.5], [-2, -0.5], [0.2, -2.0]]) obstacles.push({ x: cx + x, y: y0 + 1, z: cz + z, r: 1.0 });
  g.userData.light = { pos: new THREE.Vector3(cx, y0 + 2, cz), color: '#b890ff', intensity: 8, dist: 12 };
  g.userData.focus = new THREE.Vector3(cx, y0 + 2, cz); g.userData.dist = 12;
  return g;
}

export const SETS = { wreck: { cost: 150, build: shipwreck }, ruins: { cost: 180, build: ruins }, crystal: { cost: 220, build: crystalCave } };
export const SET_ORDER = ['wreck', 'ruins', 'crystal'];
