// BLUE HAVEN — environment: water volume, surface, sand, rocks, plants, corals, light rays, particles, bubbles.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { U, rng, fbm, noise3, sandHeight, underwater } from './common.js';

export const SURF = 30;
export const PAL = {
  deep: new THREE.Color('#041a2c'), mid: new THREE.Color('#0f5670'), up: new THREE.Color('#2a9bb0'), top: new THREE.Color('#bdf3ee'),
  sun: new THREE.Color('#ffe6b8'),
};
export const RAY_DIR = new THREE.Vector3(0.22, -1, 0.14).normalize();
export const obstacles = []; // {x,y,z,r}

const GRAD_GLSL = /* glsl */`
uniform vec3 uDeep, uMid, uUp, uTop, uSun, uRayDir;
vec3 waterGrad(vec3 d){
  float y = d.y;
  vec3 c = mix(uDeep, uMid, smoothstep(-0.7, 0.02, y));
  c = mix(c, uUp, smoothstep(0.02, 0.6, y));
  c = mix(c, uTop, smoothstep(0.55, 1.0, y));
  float s = max(dot(d, -uRayDir), 0.0);
  c += uSun * (pow(s, 6.0) * 0.35 + pow(s, 40.0) * 0.9) * smoothstep(-0.1, 0.5, y);
  return c;
}`;
function gradUniforms() {
  return { uDeep: { value: PAL.deep }, uMid: { value: PAL.mid }, uUp: { value: PAL.up }, uTop: { value: PAL.top }, uSun: { value: PAL.sun }, uRayDir: { value: RAY_DIR } };
}

export function makeBackdrop() {
  const m = new THREE.ShaderMaterial({
    uniforms: gradUniforms(), side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: GRAD_GLSL + `varying vec3 vD; void main(){ gl_FragColor = vec4(waterGrad(normalize(vD)), 1.0); }`,
  });
  const s = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 24), m); s.renderOrder = -10; s.frustumCulled = false;
  return s;
}

export function makeSurface() {
  const u = Object.assign(gradUniforms(), { uTime: U.uTime });
  const m = new THREE.ShaderMaterial({
    uniforms: u, side: THREE.DoubleSide, depthWrite: false, transparent: true, fog: false,
    vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }`,
    fragmentShader: GRAD_GLSL + `
      uniform float uTime; varying vec3 vW;
      vec2 h2(vec2 p){ p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
      float cell(vec2 p, float t){ vec2 i = floor(p), f = fract(p); float a = 8.0, b = 8.0;
        for (int y=-1;y<=1;y++) for (int x=-1;x<=1;x++){ vec2 g = vec2(float(x), float(y)); vec2 o = 0.5 + 0.45 * sin(t + 6.28 * h2(i + g)); float d = length(g + o - f); if (d < a) { b = a; a = d; } else if (d < b) b = d; }
        return b - a; }
      void main(){
        vec3 d = normalize(vW - cameraPosition);
        float dist = length(vW - cameraPosition);
        vec3 bg = waterGrad(d);
        float c = 1.0 - smoothstep(0.0, 0.3, cell(vW.xz * 0.09, uTime * 0.6));
        float c2 = 1.0 - smoothstep(0.0, 0.25, cell(vW.xz * 0.05 + 7.0, -uTime * 0.4));
        float fade = exp(-dist * 0.012);
        vec3 col = bg * (0.92 + (c * 0.5 + c2 * 0.35) * fade) + uTop * 0.08 * fade;
        gl_FragColor = vec4(col, 0.9 * smoothstep(0.0, 0.15, d.y) * exp(-dist * 0.006));
      }`,
  });
  const p = new THREE.Mesh(new THREE.PlaneGeometry(900, 900, 1, 1), m);
  p.rotation.x = Math.PI / 2; p.position.y = SURF; p.renderOrder = -9;
  return p;
}

export function makeSand(seg) {
  const g = new THREE.PlaneGeometry(320, 320, seg, seg); g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
  const a = new THREE.Color('#cdb88f'), b = new THREE.Color('#9c8462'), c = new THREE.Color('#5d7e80'), d = new THREE.Color('#e2d0aa'), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i), h = sandHeight(x, z);
    pos.setY(i, h);
    const n = fbm(x * 0.08, z * 0.08, 3), n2 = fbm(x * 0.4 + 9, z * 0.4, 2);
    tmp.copy(a).lerp(b, THREE.MathUtils.clamp((n - 0.35) * 1.6, 0, 1));
    tmp.lerp(d, THREE.MathUtils.clamp((n2 - 0.6) * 2.0, 0, 0.6));
    tmp.lerp(c, THREE.MathUtils.clamp((Math.hypot(x, z) - 30) / 40, 0, 0.55));
    tmp.multiplyScalar(0.92 + n2 * 0.16);
    col.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  const m = underwater(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }), { caus: 1.35, rim: 0.15 });
  return new THREE.Mesh(g, m);
}

// ---------------- rocks ----------------
const rockMat = underwater(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, flatShading: false }), { caus: 1.1, rim: 0.22 });
export function rockGeometry(seed, detail = 4, flat = 0.62) {
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, detail).deleteAttribute('normal').deleteAttribute('uv')); const r = rng(seed); const ox = r() * 50, oy = r() * 50;
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3), v = new THREE.Vector3(), tmp = new THREE.Color();
  const base = new THREE.Color('#6c645c'), dark = new THREE.Color('#3a3a40'), moss = new THREE.Color('#6e8a5a'), pink = new THREE.Color('#d48c96'), teal = new THREE.Color('#4f8a86');
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = noise3(v.x * 1.4 + ox, v.y * 1.4, v.z * 1.4 + oy), n2 = noise3(v.x * 4 + oy, v.y * 4, v.z * 4);
    const k = 0.72 + n * 0.55 + n2 * 0.12 + (noise3(v.x * 9 + ox, v.y * 9, v.z * 9) - 0.5) * 0.07;
    v.multiplyScalar(k); v.y *= flat; if (v.y < -0.25) v.y = -0.25 + (v.y + 0.25) * 0.3;
    pos.setXYZ(i, v.x, v.y, v.z);
    const up = THREE.MathUtils.clamp(v.y / flat + 0.2, 0, 1);
    tmp.copy(dark).lerp(base, up);
    tmp.lerp(moss, THREE.MathUtils.clamp((n - 0.45) * 3, 0, 1) * up * 0.8);
    tmp.lerp(pink, THREE.MathUtils.clamp((n2 - 0.62) * 4, 0, 1) * 0.8);
    tmp.lerp(teal, THREE.MathUtils.clamp((0.4 - n) * 3, 0, 1) * 0.4);
    col.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  return g;
}
export function makeRock(seed, x, z, s, opts = {}) {
  const m = new THREE.Mesh(rockGeometry(seed, opts.detail ?? 4, opts.flat ?? 0.62), rockMat);
  m.scale.set(s * (opts.sx || 1), s, s * (opts.sz || 1));
  m.position.set(x, sandHeight(x, z) + (opts.y || 0), z); m.rotation.y = seed * 1.7;
  obstacles.push({ x, y: m.position.y + s * 0.3, z, r: s * 1.1 * Math.max(opts.sx || 1, opts.sz || 1) });
  return m;
}

// ---------------- plants ----------------
function colorize(g, c) { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); return g; }
function ribbon(pts, widths, colors, normalHint) {
  // pts: Vector3[], side vector perpendicular to path, build quad strip
  const n = pts.length, P = [], C = [], I = [];
  for (let i = 0; i < n; i++) {
    const t = i < n - 1 ? pts[i + 1].clone().sub(pts[i]) : pts[i].clone().sub(pts[i - 1]);
    const side = new THREE.Vector3().crossVectors(t, normalHint).normalize().multiplyScalar(widths[i] * 0.5);
    P.push(pts[i].x - side.x, pts[i].y - side.y, pts[i].z - side.z, pts[i].x + side.x, pts[i].y + side.y, pts[i].z + side.z);
    C.push(colors[i].r, colors[i].g, colors[i].b, colors[i].r, colors[i].g, colors[i].b);
    if (i < n - 1) { const a = i * 2; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(C, 3)); g.setIndex(I);
  g.computeVertexNormals(); return g;
}
export function makeSeagrass(count, seed = 5, area = { x: 0, z: 0, r: 34 }, avoid = []) {
  const r = rng(seed), blades = [];
  const c0 = new THREE.Color('#2f5a2a'), c1 = new THREE.Color('#9dbb4a'), c2 = new THREE.Color('#d7d070');
  for (let b = 0; b < 7; b++) {
    const a = r() * Math.PI * 2, rad = r() * 0.25, h = 0.7 + r() * 1.0, lean = 0.15 + r() * 0.3, pts = [], w = [], cs = [];
    for (let i = 0; i <= 6; i++) { const t = i / 6; pts.push(new THREE.Vector3(Math.cos(a) * (rad + lean * t * t), h * t, Math.sin(a) * (rad + lean * t * t))); w.push(0.09 * (1 - t * 0.85)); cs.push(c0.clone().lerp(c1, t).lerp(c2, t * t * 0.5)); }
    blades.push(ribbon(pts, w, cs, new THREE.Vector3(Math.cos(a), 0, Math.sin(a))));
  }
  const g = mergeGeometries(blades);
  const m = underwater(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.8, emissive: '#1d3010' }), { sway: { amp: 0.35, height: 1.7 }, caus: 0.7, rim: 0.4 });
  const im = new THREE.InstancedMesh(g, m, count); const d = new THREE.Object3D(); let k = 0, tries = 0;
  while (k < count && tries++ < count * 30) {
    const x = area.x + (r() * 2 - 1) * area.r, z = area.z + (r() * 2 - 1) * area.r;
    if (Math.hypot(x - area.x, z - area.z) > area.r) continue;
    if (fbm(x * 0.09 + 4, z * 0.09, 3) < 0.5) continue; // patchy meadows
    if (avoid.some(o => Math.hypot(x - o.x, z - o.z) < o.r)) continue;
    d.position.set(x, sandHeight(x, z) - 0.05, z); d.rotation.y = r() * 6.28; d.scale.setScalar(0.7 + r() * 0.8); d.updateMatrix(); im.setMatrixAt(k++, d.matrix);
  }
  im.count = k; return im;
}
export function makeKelp(spots, seed = 9) {
  const r = rng(seed), parts = [];
  const H = 15, stem = new THREE.Color('#5a4a1e'), blade = new THREE.Color('#a8902e'), tip = new THREE.Color('#e3cf6a');
  // stipe
  { const pts = [], w = [], cs = []; for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push(new THREE.Vector3(Math.sin(t * 3) * 0.3, H * t, Math.cos(t * 2) * 0.2)); w.push(0.12); cs.push(stem.clone().lerp(blade, t)); }
    parts.push(ribbon(pts, w, cs, new THREE.Vector3(1, 0, 0))); }
  for (let i = 0; i < 20; i++) {
    const y = 1.2 + i * (H - 1.5) / 20, a = i * 2.4 + r(), len = 1.3 + r() * 0.8, pts = [], w = [], cs = [];
    const base = new THREE.Vector3(Math.sin(y / H * 3) * 0.3, y, Math.cos(y / H * 2) * 0.2);
    for (let j = 0; j <= 6; j++) { const t = j / 6; pts.push(base.clone().add(new THREE.Vector3(Math.cos(a) * len * t, len * t * 0.9 - t * t * 0.5, Math.sin(a) * len * t))); w.push(0.42 * Math.sin(Math.PI * Math.min(1, t * 1.1 + 0.08))); cs.push(blade.clone().lerp(tip, t * 0.8)); }
    parts.push(ribbon(pts, w, cs, new THREE.Vector3(-Math.sin(a), 0.4, Math.cos(a)).normalize()));
  }
  const g = mergeGeometries(parts);
  const m = underwater(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.7, emissive: '#3a3008', emissiveIntensity: 1 }), { sway: { amp: 2.4, height: H }, caus: 0.6, rim: 0.5 });
  const im = new THREE.InstancedMesh(g, m, spots.length); const d = new THREE.Object3D();
  spots.forEach((s, i) => { d.position.set(s.x, sandHeight(s.x, s.z) - 0.1, s.z); d.rotation.y = r() * 6.28; d.scale.setScalar(s.s); d.updateMatrix(); im.setMatrixAt(i, d.matrix); obstacles.push({ x: s.x, y: 4, z: s.z, r: 1.2 }); });
  return im;
}

// ---------------- corals ----------------
const coralMat = underwater(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 }), { caus: 1.0, rim: 0.55 });
function branchCoral(seed, cBase, cTip, o = {}) {
  const r = rng(seed), parts = [], up = new THREE.Vector3(0, 1, 0);
  const depthMax = o.depth ?? 4, planar = o.planar ?? false;
  function grow(p, dir, len, rad, depth) {
    const seg = new THREE.CylinderGeometry(rad * 0.72, rad, len, 7, 1); seg.translate(0, len / 2, 0);
    const q = new THREE.Quaternion().setFromUnitVectors(up, dir); seg.applyQuaternion(q); seg.translate(p.x, p.y, p.z);
    const t = depth / depthMax; colorize(seg, cBase.clone().lerp(cTip, t * t));
    parts.push(seg);
    const end = p.clone().addScaledVector(dir, len);
    if (depth >= depthMax) { const cap = new THREE.SphereGeometry(rad * 0.9, 7, 5); cap.translate(end.x, end.y, end.z); colorize(cap, cTip.clone().multiplyScalar(1.25)); parts.push(cap); return; }
    const n = depth === 0 ? 3 + Math.floor(r() * 2) : 2 + (r() < 0.35 ? 1 : 0);
    for (let i = 0; i < n; i++) {
      const nd = dir.clone();
      if (planar) nd.add(new THREE.Vector3((r() * 2 - 1) * 0.9, 0.25, 0)); else nd.add(new THREE.Vector3((r() * 2 - 1) * 0.8, 0.15 + r() * 0.2, (r() * 2 - 1) * 0.8));
      nd.normalize(); grow(end, nd, len * (0.72 + r() * 0.15), rad * 0.72, depth + 1);
    }
  }
  grow(new THREE.Vector3(), new THREE.Vector3(0, 1, 0), o.len ?? 0.7, o.rad ?? 0.13, 0);
  return mergeGeometries(parts);
}
function brainCoral(seed, c1, c2, detail) {
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, detail).deleteAttribute('normal').deleteAttribute('uv')), r = rng(seed), o = r() * 40;
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3), v = new THREE.Vector3(), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const w = noise3(v.x * 2 + o, v.y * 2, v.z * 2) * 6;
    const ridge = Math.sin((v.x * 9 + v.z * 7 + w * 3)) * 0.5 + 0.5;
    v.multiplyScalar(1 + ridge * 0.05 + noise3(v.x + o, v.y, v.z) * 0.15); v.y *= 0.72; if (v.y < -0.1) v.y = -0.1;
    pos.setXYZ(i, v.x, v.y, v.z);
    tmp.copy(c1).lerp(c2, ridge); col.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
}
function tableCoral(seed, c1, c2) {
  const r = rng(seed), parts = [];
  const stem = new THREE.CylinderGeometry(0.15, 0.25, 0.9, 8); stem.translate(0, 0.45, 0); colorize(stem, c1.clone().multiplyScalar(0.7)); parts.push(stem);
  for (let k = 0; k < 3; k++) {
    const rad = 1.6 - k * 0.45, y = 0.9 + k * 0.28;
    const d = new THREE.CylinderGeometry(rad, rad * 0.85, 0.12, 28, 1); const p = d.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), a = Math.atan2(z, x), rr = Math.hypot(x, z); p.setY(i, p.getY(i) + Math.sin(a * 5 + seed) * 0.06 * rr + rr * rr * 0.03); }
    d.computeVertexNormals(); d.translate((r() - 0.5) * 0.3, y, (r() - 0.5) * 0.3);
    colorize(d, c1.clone().lerp(c2, k / 2)); parts.push(d);
  }
  return mergeGeometries(parts);
}
function spongeCluster(seed, c1, c2) {
  const r = rng(seed), parts = [];
  for (let i = 0; i < 5; i++) {
    const h = 0.8 + r() * 1.4, rad = 0.18 + r() * 0.14;
    const g = new THREE.CylinderGeometry(rad, rad * 0.7, h, 12, 4, true); g.translate(0, h / 2, 0);
    const p = g.attributes.position; for (let j = 0; j < p.count; j++) { const y = p.getY(j); p.setX(j, p.getX(j) * (1 + Math.sin(y * 5) * 0.06)); }
    g.computeVertexNormals(); g.rotateZ((r() - 0.5) * 0.5); g.rotateX((r() - 0.5) * 0.5); g.translate((r() - 0.5) * 0.7, 0, (r() - 0.5) * 0.7);
    colorize(g, c1.clone().lerp(c2, r())); parts.push(g);
  }
  return mergeGeometries(parts);
}
function placeGeo(geo, mat, x, z, s, rot = 0, yOff = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, sandHeight(x, z) + yOff, z); m.scale.setScalar(s); m.rotation.y = rot; return m;
}
const C = (h) => new THREE.Color(h);
const coralMat2 = underwater(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide }), { caus: 1.0, rim: 0.55 });

export function makeBaseCorals(hq) {
  const g = new THREE.Group();
  g.add(placeGeo(brainCoral(3, C('#b27a3e'), C('#ecc985'), hq ? 5 : 4), coralMat, 1.8, -1.2, 1.1, 0, 0.05));
  g.add(placeGeo(branchCoral(11, C('#c2486a'), C('#ffb3c6')), coralMat, 4.4, 0.6, 1.4));
  g.add(placeGeo(spongeCluster(5, C('#e08a2c'), C('#f5c04a')), coralMat2, -3.2, 3.6, 1.0));
  g.add(placeGeo(branchCoral(19, C('#5b4aa8'), C('#a8c8ff'), { depth: 3, len: 0.6 }), coralMat, -1.4, -3.4, 1.3));
  obstacles.push({ x: 1.8, y: 0.5, z: -1.2, r: 1.2 }, { x: 4.4, y: 1.5, z: 0.6, r: 1.6 });
  return g;
}

export function makeCoralGarden(hq) {
  const g = new THREE.Group(), cx = -9, cz = -6, r = rng(77);
  g.add(placeGeo(tableCoral(1, C('#7a5bb0'), C('#b9a6ff')), coralMat, cx + 1, cz - 1, 1.5, 0.3));
  g.add(placeGeo(tableCoral(2, C('#3f8c8a'), C('#9be2c9')), coralMat, cx - 3.5, cz + 2.5, 1.0, 1.2));
  g.add(placeGeo(brainCoral(8, C('#4f7f3a'), C('#c9e08a'), hq ? 5 : 4), coralMat, cx + 3.5, cz + 2, 1.4, 0, 0.05));
  g.add(placeGeo(brainCoral(9, C('#a8506a'), C('#f2a0a8'), hq ? 4 : 3), coralMat, cx - 1.5, cz + 4.2, 0.8, 0, 0.05));
  const fan = branchCoral(23, C('#9c2a52'), C('#ff7fa0'), { planar: true, depth: 5, len: 0.6, rad: 0.07 });
  g.add(placeGeo(fan, coralMat, cx - 4.5, cz - 2.5, 1.8, 0.4));
  g.add(placeGeo(fan, coralMat, cx + 5.5, cz - 2.2, 1.4, -0.6));
  const cols = [[C('#d0542e'), C('#ffc070')], [C('#2c6cc0'), C('#9fe0ff')], [C('#c03a8a'), C('#ffb0e8')], [C('#e0c040'), C('#fff0a0')]];
  for (let i = 0; i < 7; i++) {
    const a = r() * 6.28, d = 1.5 + r() * 4.5, [c1, c2] = cols[i % cols.length];
    g.add(placeGeo(branchCoral(40 + i, c1, c2, { depth: 3 + (i % 2) }), coralMat, cx + Math.cos(a) * d, cz + Math.sin(a) * d, 0.8 + r() * 0.8, r() * 6));
  }
  g.add(placeGeo(spongeCluster(12, C('#7a3fa0'), C('#d080e0')), coralMat2, cx + 0.5, cz + 4.8, 1.2));
  g.add(placeGeo(spongeCluster(13, C('#d07020'), C('#ffd060')), coralMat2, cx - 5.5, cz - 0.2, 0.9));
  obstacles.push({ x: cx, y: 1.5, z: cz, r: 3.5 });
  return g;
}

export function makeAnemones(hq) {
  const parts = [], r = rng(31);
  const col = new THREE.CylinderGeometry(0.42, 0.5, 0.5, 14); col.translate(0, 0.25, 0); colorize(col, C('#8a2f5a')); parts.push(col);
  const n = hq ? 70 : 44, up = new THREE.Vector3(0, 1, 0);
  for (let i = 0; i < n; i++) {
    const a = i * 2.39996, rr = 0.42 * Math.sqrt((i + 0.5) / n), len = 0.55 + r() * 0.35;
    const tcone = new THREE.CylinderGeometry(0.012, 0.04, len, 5, 4); tcone.translate(0, len / 2, 0);
    const dir = new THREE.Vector3(Math.cos(a) * rr * 1.4, 1, Math.sin(a) * rr * 1.4).normalize();
    tcone.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir)); tcone.translate(Math.cos(a) * rr, 0.48, Math.sin(a) * rr);
    const p = tcone.attributes.position, c = new Float32Array(p.count * 3), base = C('#e9b6d8'), tip = C('#ff7ac0').multiplyScalar(1.7);
    for (let j = 0; j < p.count; j++) { const t = THREE.MathUtils.clamp((p.getY(j) - 0.48) / len, 0, 1); const cc = base.clone().lerp(tip, Math.pow(t, 3)); c.set([cc.r, cc.g, cc.b], j * 3); }
    tcone.setAttribute('color', new THREE.BufferAttribute(c, 3)); parts.push(tcone);
  }
  const g = mergeGeometries(parts);
  const m = underwater(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }), { sway: { amp: 0.28, height: 1.4 }, caus: 0.7, rim: 0.7 });
  const spots = [[-2, 6, 1.3], [-0.6, 7.2, 1.0], [-3.3, 7.4, 0.9], [-1.4, 4.6, 0.8], [0.6, 5.6, 0.7]];
  const im = new THREE.InstancedMesh(g, m, spots.length); const d = new THREE.Object3D();
  spots.forEach(([x, z, s], i) => { d.position.set(x, sandHeight(x, z) - 0.05, z); d.scale.setScalar(s * 1.4); d.rotation.y = i; d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
  const grp = new THREE.Group(); grp.add(im);
  grp.add(makeRock(404, -1.6, 6.2, 1.1, { flat: 0.4, y: -0.3, detail: 3 }));
  grp.userData.home = new THREE.Vector3(-1.6, sandHeight(-1.6, 6) + 1.4, 6);
  return grp;
}

export function makeArch() {
  const g = new THREE.Group(), cx = -14, cz = 9, R = 4.4;
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI * i / 12, x = cx + Math.cos(a) * R, y = Math.sin(a) * R * 1.15;
    const m = new THREE.Mesh(rockGeometry(500 + i, 3, 0.85), rockMat);
    const s = 1.35 + (i === 0 || i === 12 ? 0.6 : 0) + Math.sin(i * 1.3) * 0.2;
    m.position.set(x, sandHeight(x, cz) + y + 0.3, cz + Math.sin(i * 2.1) * 0.3); m.scale.set(s, s * 1.0, s * 1.1); m.rotation.set(i, i * 0.7, i * 0.3);
    g.add(m); obstacles.push({ x, y: m.position.y, z: cz, r: s * 1.1 });
  }
  g.add(makeRock(611, cx - 5.5, cz + 1.5, 1.6), makeRock(612, cx + 5.8, cz - 1, 1.2));
  g.add(placeGeo(branchCoral(71, C('#d06030'), C('#ffd090'), { depth: 3 }), coralMat, cx + 4.8, cz + 1.8, 0.8));
  const top = placeGeo(spongeCluster(72, C('#4060c0'), C('#90c0ff')), coralMat2, cx, cz, 0.6); top.position.y += R * 1.15 + 1.0; g.add(top);
  return g;
}

export function makeClam(hq) {
  const g = new THREE.Group(), x = 5, z = 7;
  const shellPart = (flip) => {
    const geo = new THREE.SphereGeometry(1, hq ? 48 : 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const p = geo.attributes.position, c = new Float32Array(p.count * 3), a = C('#d8d0bc'), b = C('#9a8f7a');
    for (let i = 0; i < p.count; i++) {
      let vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i); const ang = Math.atan2(vz, vx), rim = 1 - vy;
      const rib = Math.abs(Math.sin(ang * 3.5)); const k = 1 + rib * 0.12 * rim;
      vx *= k * 1.4; vz *= k * 0.9; vy = vy * 0.55 + rib * 0.08 * rim * rim;
      p.setXYZ(i, vx, vy, vz); const cc = b.clone().lerp(a, rib * 0.7 + 0.3 * (1 - rim)); c.set([cc.r, cc.g, cc.b], i * 3);
    }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, coralMat2); if (flip) m.rotation.x = Math.PI; return m;
  };
  const bottom = shellPart(true); const hinge = new THREE.Group(); const top = shellPart(false);
  hinge.position.set(0, 0, -0.85); top.position.set(0, 0, 0.85); hinge.add(top); hinge.rotation.x = -0.55;
  const mantleG = new THREE.SphereGeometry(1, 40, 12); mantleG.scale(1.32, 0.16, 0.82);
  { const p = mantleG.attributes.position, c = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const vx = p.getX(i), vz = p.getZ(i); const n = noise3(vx * 3, 0, vz * 3); const cc = C('#1b4f9a').lerp(C('#40d0c8'), n).lerp(C('#a060e0'), Math.max(0, Math.sin(vx * 9) * Math.sin(vz * 9)) * 0.6).multiplyScalar(1.3); c.set([cc.r, cc.g, cc.b], i * 3); }
    mantleG.setAttribute('color', new THREE.BufferAttribute(c, 3)); }
  const mantle = new THREE.Mesh(mantleG, underwater(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, emissive: '#0a3050', emissiveIntensity: 1 }), { caus: 0.6, rim: 1.0, sheen: C('#60ffe0') }));
  mantle.position.y = 0.05;
  const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.32, 32, 20), underwater(new THREE.MeshStandardMaterial({ color: '#fff4ec', roughness: 0.15, metalness: 0.3, emissive: '#ffd8c0', emissiveIntensity: 0.55 }), { caus: 0.2, rim: 1.5, sheen: C('#c0a0ff') }));
  pearl.position.set(0, 0.32, 0.15);
  const clam = new THREE.Group(); clam.add(bottom, hinge, mantle, pearl); clam.scale.setScalar(1.35); clam.rotation.y = -0.6;
  clam.position.set(x, sandHeight(x, z) + 0.15, z);
  g.add(clam); g.userData.hinge = hinge; g.userData.pearl = pearl;
  const light = new THREE.PointLight('#9fe8ff', 6, 7, 1.6); light.position.set(x, sandHeight(x, z) + 1.0, z); g.add(light);
  g.userData.emitter = new THREE.Vector3(x, sandHeight(x, z) + 0.6, z);
  obstacles.push({ x, y: sandHeight(x, z) + 0.6, z, r: 2.2 });
  return g;
}

// ---------------- light rays ----------------
export function makeRays(n, seed = 3) {
  const base = new THREE.PlaneGeometry(1, 1, 1, 8); base.translate(0.5, 0.5, 0);
  const g = new THREE.InstancedBufferGeometry(); g.index = base.index; g.attributes.position = base.attributes.position; g.attributes.uv = base.attributes.uv;
  const r = rng(seed), P = new Float32Array(n * 3), S = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { const a = r() * 6.28, d = Math.sqrt(r()) * 34; P.set([Math.cos(a) * d - 6, SURF, Math.sin(a) * d - 4], i * 3); S.set([1.5 + r() * 4.5, 26 + r() * 14, r() * 100], i * 3); }
  g.setAttribute('iPos', new THREE.InstancedBufferAttribute(P, 3)); g.setAttribute('iSize', new THREE.InstancedBufferAttribute(S, 3)); g.instanceCount = n;
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
    uniforms: { uTime: U.uTime, uDir: { value: RAY_DIR }, uCol: { value: new THREE.Color('#ffefc8') }, uStr: { value: 0.16 } },
    vertexShader: `uniform vec3 uDir; uniform float uTime; attribute vec3 iPos; attribute vec3 iSize; varying vec2 vUv; varying float vFade; varying float vPh;
      void main(){
        vUv = uv; vPh = iSize.z;
        vec3 d = normalize(uDir);
        vec3 p = iPos + vec3(sin(uTime * 0.05 + iSize.z) * 2.0, 0.0, cos(uTime * 0.04 + iSize.z) * 2.0) + d * ((1.0 - uv.y) * iSize.y);
        vec3 toC = normalize(cameraPosition - p); vec3 side = normalize(cross(d, toC));
        p += side * (uv.x - 0.5) * iSize.x * (1.0 + (1.0 - uv.y) * 0.8);
        float dc = length(cameraPosition - p);
        vFade = smoothstep(2.0, 10.0, dc) * exp(-dc * 0.012);
        gl_Position = projectionMatrix * viewMatrix * vec4(p, 1.0);
      }`,
    fragmentShader: `uniform vec3 uCol; uniform float uStr; uniform float uTime; varying vec2 vUv; varying float vFade; varying float vPh;
      void main(){
        float x = sin(3.14159 * vUv.x); x *= x;
        float flick = 0.55 + 0.45 * sin(uTime * 0.6 + vPh * 3.0) * sin(uTime * 0.37 + vPh);
        float a = x * pow(vUv.y, 1.3) * flick * vFade * uStr;
        gl_FragColor = vec4(uCol * a, 1.0);
      }`,
  });
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.renderOrder = 5; return mesh;
}

// ---------------- marine snow ----------------
export function makeSnow(n, prRef) {
  const g = new THREE.BufferGeometry(), r = rng(21), P = new Float32Array(n * 3), A = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { P.set([r() * 40, r() * 40, r() * 40], i * 3); A.set([0.5 + r() * 1.2, r()], i * 2); }
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('aS', new THREE.BufferAttribute(A, 2));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uTime: U.uTime, uPR: prRef, uCam: { value: new THREE.Vector3() }, uCol: { value: new THREE.Color('#fff2d6') } },
    vertexShader: `uniform float uTime, uPR; uniform vec3 uCam; attribute vec2 aS; varying float vA; varying float vB;
      void main(){
        vec3 drift = vec3(sin(uTime * 0.1 + aS.y * 20.0) * 0.6 + uTime * 0.15, -uTime * 0.12 * (0.4 + aS.y), cos(uTime * 0.08 + aS.y * 9.0) * 0.6);
        vec3 p = mod(position + drift - uCam + 20.0, 40.0) - 20.0 + uCam;
        vec4 mv = viewMatrix * vec4(p, 1.0); float d = -mv.z;
        float near = 1.0 - smoothstep(1.0, 5.0, d);
        vB = near;
        gl_PointSize = clamp(aS.x * uPR * (90.0 / max(d, 0.5)) * (1.0 + near * 1.2), 1.0, 28.0);
        vA = (0.22 + 0.5 * aS.y) * smoothstep(0.3, 1.5, d) * (1.0 - smoothstep(10.0, 20.0, d)) * (1.0 - near * 0.85);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `uniform vec3 uCol; varying float vA; varying float vB;
      void main(){ float d = length(gl_PointCoord - 0.5); float s = mix(smoothstep(0.5, 0.0, d), smoothstep(0.5, 0.35, d) * 0.6, vB); gl_FragColor = vec4(uCol * s * vA, 1.0); }`,
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; return pts;
}

// ---------------- bubbles ----------------
export function makeBubbles(n, origin, prRef, height = 22, spread = 0.35, rate = 1) {
  const g = new THREE.BufferGeometry(), r = rng(Math.floor(origin.x * 100 + origin.z)), P = new Float32Array(n * 3), A = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { A.set([r(), 0.6 + r() * 0.8, r(), r()], i * 4); }
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('aS', new THREE.BufferAttribute(A, 4));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false,
    uniforms: { uTime: U.uTime, uPR: prRef, uH: { value: height }, uSp: { value: spread }, uRate: { value: rate } },
    vertexShader: `uniform float uTime, uPR, uH, uSp, uRate; attribute vec4 aS; varying float vA;
      void main(){
        float life = fract(aS.x + uTime * aS.y * 0.045 * uRate);
        vec3 p = vec3((aS.z - 0.5) * uSp + sin(uTime * 2.4 + aS.w * 30.0) * 0.12 * life * 3.0, life * uH, (aS.w - 0.5) * uSp + cos(uTime * 2.0 + aS.z * 30.0) * 0.12 * life * 3.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); float d = -mv.z;
        gl_PointSize = clamp((0.08 + aS.y * 0.08) * (1.0 + life * 1.5) * uPR * 600.0 / max(d, 0.5), 1.5, 80.0);
        vA = smoothstep(0.0, 0.04, life) * (1.0 - smoothstep(0.75, 1.0, life)) * (1.0 - smoothstep(25.0, 60.0, d));
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying float vA;
      void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c);
        float ring = smoothstep(0.5, 0.44, d) * smoothstep(0.2, 0.46, d);
        float hl = smoothstep(0.16, 0.0, length(c - vec2(-0.16, -0.16)));
        float a = (ring * 0.65 + hl * 0.9 + 0.08 * smoothstep(0.5, 0.0, d)) * vA;
        gl_FragColor = vec4(vec3(0.85, 0.97, 1.0) * (1.0 + hl), a); }`,
  });
  const pts = new THREE.Points(g, m); pts.position.copy(origin); pts.frustumCulled = false; return pts;
}
