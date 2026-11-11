// BLUE HAVEN (deep sea) — environment: abyssal water, silt floor, rocks, bioluminescent plants & corals, vents, particles.
import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import { U, rng, fbm, noise3, sandHeight, deep, setGlow } from './common.js?v=r2';

export const PAL = {
  deep: new THREE.Color('#03101f'), mid: new THREE.Color('#0a2c4c'), up: new THREE.Color('#114270'), top: new THREE.Color('#1d6496'),
};
export const obstacles = []; // {x,y,z,r}
const C = (h) => new THREE.Color(h);

export function makeBackdrop() {
  const m = new THREE.ShaderMaterial({
    uniforms: { uDeep: { value: PAL.deep }, uMid: { value: PAL.mid }, uUp: { value: PAL.up }, uTop: { value: PAL.top }, uTime: U.uTime },
    side: THREE.BackSide, depthWrite: false, fog: false,
    vertexShader: `varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = p.xyww; }`,
    fragmentShader: `uniform vec3 uDeep, uMid, uUp, uTop; uniform float uTime; varying vec3 vD;
      void main(){ vec3 d = normalize(vD); float y = d.y;
        vec3 c = mix(uDeep, uMid, smoothstep(-0.6, -0.02, y));
        c = mix(c, uUp, smoothstep(0.06, 0.8, y));
        c = mix(c, uTop, smoothstep(0.75, 1.0, y) * 0.8);
        // very faint, soft memory of daylight far above
        c += vec3(0.05, 0.11, 0.17) * pow(max(y, 0.0), 3.0) * (0.85 + 0.15 * sin(uTime * 0.2));
        gl_FragColor = vec4(c, 1.0); }`,
  });
  const s = new THREE.Mesh(new THREE.SphereGeometry(500, 32, 24), m); s.renderOrder = -10; s.frustumCulled = false; return s;
}

export function makeSilt(seg) {
  const g = new THREE.PlaneGeometry(320, 320, seg, seg); g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3);
  const a = C('#3a4660'), b = C('#253042'), c = C('#4c5468'), d = C('#2c4462'), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), z = pos.getZ(i); pos.setY(i, sandHeight(x, z));
    const n = fbm(x * 0.08, z * 0.08, 3), n2 = fbm(x * 0.4 + 9, z * 0.4, 2);
    tmp.copy(a).lerp(b, THREE.MathUtils.clamp((n - 0.35) * 1.8, 0, 1)).lerp(c, THREE.MathUtils.clamp((n2 - 0.6) * 2.5, 0, 0.6)).lerp(d, THREE.MathUtils.clamp((0.45 - n) * 2, 0, 0.5));
    col.set([tmp.r, tmp.g, tmp.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.computeVertexNormals();
  return new THREE.Mesh(g, deep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 }), { rim: 0.15 }));
}

// softly breathing bioluminescent specks on the seafloor
export function makeFloorSpecks(n, prRef) {
  const r = rng(61), P = new Float32Array(n * 3), A = new Float32Array(n * 2);
  for (let i = 0; i < n; i++) { const a = r() * 6.28, d = Math.sqrt(r()) * 34, x = Math.cos(a) * d, z = Math.sin(a) * d; P.set([x, sandHeight(x, z) + 0.08, z], i * 3); A.set([r(), r()], i * 2); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('aS', new THREE.BufferAttribute(A, 2));
  const m = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: { uTime: U.uTime, uPR: prRef },
    vertexShader: `uniform float uTime, uPR; attribute vec2 aS; varying float vA; varying float vH;
      void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); float d = -mv.z;
        float tw = 0.72 + 0.28 * sin(uTime * (0.12 + aS.x * 0.18) + aS.y * 40.0);
        vA = tw * exp(-d * 0.045) * 0.8; vH = aS.x;
        float ps = uPR * 60.0 / max(d, 0.5); vA *= clamp(ps / 2.5, 0.0, 1.0);
        gl_PointSize = clamp(ps, 2.5, 10.0); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `varying float vA; varying float vH; void main(){ float d = length(gl_PointCoord - 0.5); float s = smoothstep(0.5, 0.0, d);
      vec3 c = mix(vec3(0.3, 0.95, 1.0), vec3(0.55, 0.6, 1.0), vH); gl_FragColor = vec4(c * s * vA * 1.2, 1.0); }` });
  const p = new THREE.Points(g, m); p.frustumCulled = false; return p;
}

// ---------------- rocks ----------------
const rockMat = deep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }), { rim: 0.35, glow: 1.6 });
export function rockGeometry(seed, detail = 4, flat = 0.62, lichen = 1) {
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, detail).deleteAttribute('normal').deleteAttribute('uv'));
  const r = rng(seed), ox = r() * 50, oy = r() * 50;
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3), gl = new Float32Array(pos.count), v = new THREE.Vector3(), tmp = new THREE.Color();
  const base = C('#3a3a48'), dark = C('#14151e'), moss = C('#2a3a48'), lich = C('#40e8d0'), lich2 = C('#7a8cff');
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const n = noise3(v.x * 1.4 + ox, v.y * 1.4, v.z * 1.4 + oy), n2 = noise3(v.x * 4 + oy, v.y * 4, v.z * 4);
    v.multiplyScalar(0.72 + n * 0.55 + n2 * 0.12 + (noise3(v.x * 9 + ox, v.y * 9, v.z * 9) - 0.5) * 0.07); v.y *= flat; if (v.y < -0.25) v.y = -0.25 + (v.y + 0.25) * 0.3;
    pos.setXYZ(i, v.x, v.y, v.z);
    const up = THREE.MathUtils.clamp(v.y / flat + 0.2, 0, 1);
    tmp.copy(dark).lerp(base, up).lerp(moss, THREE.MathUtils.clamp((n - 0.45) * 3, 0, 1) * 0.6);
    const sp = noise3(v.x * 7 + oy, v.y * 7, v.z * 7 + ox); const L = lichen * THREE.MathUtils.clamp((sp - 0.66) * 7, 0, 1) * up;
    tmp.lerp(n2 > 0.5 ? lich : lich2, L);
    col.set([tmp.r, tmp.g, tmp.b], i * 3); gl[i] = L;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aGlow', new THREE.BufferAttribute(gl, 1)); g.computeVertexNormals();
  return g;
}
export function makeRock(seed, x, z, s, opts = {}) {
  const m = new THREE.Mesh(rockGeometry(seed, opts.detail ?? 4, opts.flat ?? 0.62, opts.lichen ?? 1), rockMat);
  m.scale.set(s * (opts.sx || 1), s, s * (opts.sz || 1)); m.position.set(x, sandHeight(x, z) + (opts.y || 0), z); m.rotation.y = seed * 1.7;
  obstacles.push({ x, y: m.position.y + s * 0.3, z, r: s * 1.1 * Math.max(opts.sx || 1, opts.sz || 1) });
  return m;
}

// ---------------- helpers ----------------
function colorize(g, c, glow = 0) { const n = g.attributes.position.count, a = new Float32Array(n * 3); for (let i = 0; i < n; i++) a.set([c.r, c.g, c.b], i * 3); g.setAttribute('color', new THREE.BufferAttribute(a, 3)); if (g.attributes.uv) g.deleteAttribute('uv'); return setGlow(g, glow); }
function placeGeo(geo, mat, x, z, s, rot = 0, yOff = 0) { const m = new THREE.Mesh(geo, mat); m.position.set(x, sandHeight(x, z) + yOff, z); m.scale.setScalar(s); m.rotation.y = rot; return m; }
const glowMat = deep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6 }), { rim: 0.6, glow: 1.8 });
const glowMat2 = deep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }), { rim: 0.6, glow: 1.8 });

// ---------------- corals ----------------
function branchCoral(seed, cBase, cTip, o = {}) {
  const r = rng(seed), parts = [], up = new THREE.Vector3(0, 1, 0), depthMax = o.depth ?? 4;
  function grow(p, dir, len, rad, depth) {
    const seg = new THREE.CylinderGeometry(rad * 0.72, rad, len, 7, 1); seg.translate(0, len / 2, 0);
    seg.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, dir)); seg.translate(p.x, p.y, p.z);
    const t = depth / depthMax; colorize(seg, cBase.clone().lerp(cTip, t * t), t * t * 0.5); parts.push(seg);
    const end = p.clone().addScaledVector(dir, len);
    if (depth >= depthMax) { const cap = new THREE.SphereGeometry(rad * 1.0, 7, 5); cap.translate(end.x, end.y, end.z); colorize(cap, cTip, 1.4); parts.push(cap); return; }
    const n = depth === 0 ? 3 + Math.floor(r() * 2) : 2 + (r() < 0.35 ? 1 : 0);
    for (let i = 0; i < n; i++) { const nd = dir.clone(); if (o.planar) nd.add(new THREE.Vector3((r() * 2 - 1) * 0.9, 0.25, 0)); else nd.add(new THREE.Vector3((r() * 2 - 1) * 0.8, 0.15 + r() * 0.2, (r() * 2 - 1) * 0.8)); nd.normalize(); grow(end, nd, len * (0.72 + r() * 0.15), rad * 0.72, depth + 1); }
  }
  grow(new THREE.Vector3(), new THREE.Vector3(0, 1, 0), o.len ?? 0.7, o.rad ?? 0.13, 0);
  return mergeGeometries(parts);
}
function brainCoral(seed, c1, c2, detail) {
  const g = mergeVertices(new THREE.IcosahedronGeometry(1, detail).deleteAttribute('normal').deleteAttribute('uv')), r = rng(seed), o = r() * 40;
  const pos = g.attributes.position, col = new Float32Array(pos.count * 3), gl = new Float32Array(pos.count), v = new THREE.Vector3(), tmp = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i); const w = noise3(v.x * 2 + o, v.y * 2, v.z * 2) * 6; const ridge = Math.sin(v.x * 9 + v.z * 7 + w * 3) * 0.5 + 0.5;
    v.multiplyScalar(1 + ridge * 0.05 + noise3(v.x + o, v.y, v.z) * 0.15); v.y *= 0.72; if (v.y < -0.1) v.y = -0.1; pos.setXYZ(i, v.x, v.y, v.z);
    tmp.copy(c1).lerp(c2, ridge); col.set([tmp.r, tmp.g, tmp.b], i * 3); gl[i] = Math.pow(ridge, 6) * 1.2;
  }
  g.setAttribute('color', new THREE.BufferAttribute(col, 3)); g.setAttribute('aGlow', new THREE.BufferAttribute(gl, 1)); g.computeVertexNormals(); return g;
}
// sea pen: a feathery glowing quill
function seaPenGeometry(seed, cStem, cLeaf) {
  const r = rng(seed), parts = [], H = 1.6;
  const stem = new THREE.CylinderGeometry(0.03, 0.05, H, 6, 6); stem.translate(0, H / 2, 0); colorize(stem, cStem, 0.2); parts.push(stem);
  for (let i = 0; i < 14; i++) {
    const y = 0.45 + i * (H - 0.5) / 14, len = 0.28 * Math.sin(Math.PI * (i + 1) / 15) + 0.06;
    for (const s of [-1, 1]) { const leaf = new THREE.PlaneGeometry(len, 0.07, 3, 1); leaf.translate(s * len / 2, 0, 0); leaf.rotateZ(s * 0.5); leaf.rotateY(r() * 0.3); leaf.translate(0, y, 0); colorize(leaf, cLeaf, 0.9 + r() * 0.4); leaf.deleteAttribute('normal'); leaf.computeVertexNormals(); parts.push(leaf); }
  }
  return mergeGeometries(parts.map(p => { if (!p.index) return p; return p; }));
}
export function makeSeaPens(count, seed, area, avoid = []) {
  const g = seaPenGeometry(seed, C('#5a3a4a'), C('#ffb86a'));
  const m = deep(new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.7 }), { sway: { amp: 0.18, height: 1.6 }, rim: 0.5, glow: 1.6 });
  const im = new THREE.InstancedMesh(g, m, count), d = new THREE.Object3D(), r = rng(seed + 1); let k = 0, tries = 0;
  while (k < count && tries++ < count * 40) {
    const x = area.x + (r() * 2 - 1) * area.r, z = area.z + (r() * 2 - 1) * area.r;
    if (Math.hypot(x - area.x, z - area.z) > area.r || fbm(x * 0.12 + 4, z * 0.12, 3) < 0.48) continue;
    if (avoid.some(o => Math.hypot(x - o.x, z - o.z) < o.r)) continue;
    d.position.set(x, sandHeight(x, z) - 0.05, z); d.rotation.y = r() * 6.28; d.scale.setScalar(0.6 + r() * 0.9); d.updateMatrix(); im.setMatrixAt(k++, d.matrix);
  }
  im.count = k; return im;
}
// glowing tube worms cluster
function tubeWormGeometry(seed, n = 18) {
  const r = rng(seed), parts = [];
  for (let i = 0; i < n; i++) {
    const a = r() * 6.28, d = Math.sqrt(r()) * 0.7, h = 0.6 + r() * 1.3;
    const tube = new THREE.CylinderGeometry(0.05, 0.065, h, 8, 1, true); tube.translate(0, h / 2, 0); tube.rotateZ((r() - 0.5) * 0.35); tube.rotateX((r() - 0.5) * 0.35); tube.translate(Math.cos(a) * d, 0, Math.sin(a) * d);
    colorize(tube, C('#8a8274'), 0.03); parts.push(tube);
    const tip = new THREE.Vector3(0, h, 0).applyEuler(new THREE.Euler()).add(new THREE.Vector3(Math.cos(a) * d, 0, Math.sin(a) * d));
    const plume = new THREE.ConeGeometry(0.11, 0.24, 9, 1); plume.rotateX(Math.PI); plume.translate(tip.x, tip.y + 0.08, tip.z); colorize(plume, C('#ff3a6a'), 1.0); plume.deleteAttribute('normal'); plume.computeVertexNormals(); parts.push(plume);
  }
  return mergeGeometries(parts.map(p => p.index ? p.toNonIndexed() : p));
}
// glass sponge: translucent lattice vase
const glassMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
  uniforms: { uTime: U.uTime, uCol: { value: C('#9fd8ff') } },
  vertexShader: `varying vec2 vUv; varying vec3 vN; varying vec3 vV; void main(){ vUv = uv; vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = -mv.xyz; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform float uTime; uniform vec3 uCol; varying vec2 vUv; varying vec3 vN; varying vec3 vV;
    void main(){ vec2 g = vec2(vUv.x * 28.0, vUv.y * 16.0); vec2 f = abs(fract(g + vec2(vUv.y * 4.0, 0.0)) - 0.5); vec2 f2 = abs(fract(vec2(g.x - vUv.y * 4.0, g.y)) - 0.5);
      float lat = max(smoothstep(0.42, 0.5, max(f.x, f.y)), smoothstep(0.44, 0.5, f2.x) * 0.6);
      float fr = pow(1.0 - abs(dot(normalize(vN), normalize(vV))), 2.0); float dist = length(vV);
      float a = (lat * 0.45 + fr * 0.35) * (0.8 + 0.2 * sin(uTime * 0.8 + vUv.y * 6.0)) * exp(-dist * 0.03) * smoothstep(0.0, 0.08, vUv.y);
      gl_FragColor = vec4(uCol * a, 1.0); }`,
});
function glassSponge(h = 2.2, rad = 0.45) {
  const pts = []; for (let i = 0; i <= 16; i++) { const t = i / 16; pts.push(new THREE.Vector2(rad * (0.45 + 0.75 * Math.sin(t * 2.2) + 0.12 * t), t * h)); }
  return new THREE.LatheGeometry(pts, 28);
}
export function makeGlassSponge(x, z, s) { const m = new THREE.Mesh(glassSponge(), glassMat); m.position.set(x, sandHeight(x, z) - 0.05, z); m.scale.setScalar(s); m.renderOrder = 4; return m; }

export function makeBaseCorals(hq) {
  const g = new THREE.Group();
  g.add(placeGeo(brainCoral(3, C('#2a2a5a'), C('#6a8cff'), hq ? 5 : 4), glowMat, 1.8, -1.2, 1.0, 0, 0.05));
  g.add(placeGeo(branchCoral(11, C('#3a1a4a'), C('#ff5ac8')), glowMat, 4.4, 0.6, 1.3));
  g.add(placeGeo(branchCoral(19, C('#1a2a4a'), C('#5af0ff'), { depth: 3, len: 0.6 }), glowMat, -1.4, -3.4, 1.2));
  g.add(placeGeo(tubeWormGeometry(5, 10), glowMat, -3.2, 3.6, 0.9));
  g.add(makeGlassSponge(6.5, -4.5, 1.0));
  obstacles.push({ x: 1.8, y: 0.5, z: -1.2, r: 1.2 }, { x: 4.4, y: 1.5, z: 0.6, r: 1.6 });
  return g;
}

export function makeCoralGarden(hq) {
  const g = new THREE.Group(), cx = -9, cz = -6, r = rng(77);
  g.add(placeGeo(brainCoral(8, C('#1a3a3a'), C('#40ffc8'), hq ? 5 : 4), glowMat, cx + 3.5, cz + 2, 1.3, 0, 0.05));
  g.add(placeGeo(brainCoral(9, C('#3a1a3a'), C('#ff70d0'), hq ? 4 : 3), glowMat, cx - 1.5, cz + 4.2, 0.8, 0, 0.05));
  const fan = branchCoral(23, C('#2a1040'), C('#c070ff'), { planar: true, depth: 5, len: 0.6, rad: 0.07 });
  g.add(placeGeo(fan, glowMat, cx - 4.5, cz - 2.5, 1.8, 0.4), placeGeo(fan, glowMat, cx + 5.5, cz - 2.2, 1.4, -0.6));
  const cols = [[C('#1a2040'), C('#5ae8ff')], [C('#301040'), C('#ff60c0')], [C('#102a30'), C('#60ffb0')], [C('#2a2010'), C('#ffc060')]];
  for (let i = 0; i < 8; i++) { const a = r() * 6.28, d = 1.5 + r() * 4.5, [c1, c2] = cols[i % cols.length]; g.add(placeGeo(branchCoral(40 + i, c1, c2, { depth: 3 + (i % 2) }), glowMat, cx + Math.cos(a) * d, cz + Math.sin(a) * d, 0.8 + r() * 0.8, r() * 6)); }
  g.add(makeSeaPens(26, 91, { x: cx, z: cz, r: 6 }, [{ x: cx, z: cz, r: 1 }]));
  g.userData.light = { pos: new THREE.Vector3(cx, 2.5, cz), color: '#7a6cff', intensity: 9, dist: 14 };
  obstacles.push({ x: cx, y: 1.5, z: cz, r: 3.5 });
  return g;
}

export function makeAnemones(hq) {
  const parts = [], r = rng(31), up = new THREE.Vector3(0, 1, 0);
  const col = new THREE.CylinderGeometry(0.42, 0.5, 0.5, 14); col.translate(0, 0.25, 0); colorize(col, C('#2a1638'), 0.1); parts.push(col);
  const n = hq ? 70 : 44;
  for (let i = 0; i < n; i++) {
    const a = i * 2.39996, rr = 0.42 * Math.sqrt((i + 0.5) / n), len = 0.55 + r() * 0.35;
    const tc = new THREE.CylinderGeometry(0.012, 0.04, len, 5, 4); tc.translate(0, len / 2, 0);
    tc.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(up, new THREE.Vector3(Math.cos(a) * rr * 1.4, 1, Math.sin(a) * rr * 1.4).normalize())); tc.translate(Math.cos(a) * rr, 0.48, Math.sin(a) * rr);
    const p = tc.attributes.position, c = new Float32Array(p.count * 3), gl = new Float32Array(p.count), base = C('#5a4a8a'), tip = C('#6ad8f0');
    for (let j = 0; j < p.count; j++) { const t = THREE.MathUtils.clamp((p.getY(j) - 0.48) / len, 0, 1); const cc = base.clone().lerp(tip, Math.pow(t, 2)); c.set([cc.r, cc.g, cc.b], j * 3); gl[j] = Math.pow(t, 3) * 1.1; }
    tc.setAttribute('color', new THREE.BufferAttribute(c, 3)); tc.setAttribute('aGlow', new THREE.BufferAttribute(gl, 1)); tc.deleteAttribute('uv'); parts.push(tc);
  }
  const g = mergeGeometries(parts);
  const m = deep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.55 }), { sway: { amp: 0.28, height: 1.4 }, rim: 0.5, glow: 1.2 });
  const spots = [[-2, 6, 1.3], [-0.6, 7.2, 1.0], [-3.3, 7.4, 0.9], [-1.4, 4.6, 0.8], [0.6, 5.6, 0.7], [-4.6, 5.6, 0.8]];
  const im = new THREE.InstancedMesh(g, m, spots.length), d = new THREE.Object3D();
  spots.forEach(([x, z, s], i) => { d.position.set(x, sandHeight(x, z) - 0.05, z); d.scale.setScalar(s * 1.4); d.rotation.y = i; d.updateMatrix(); im.setMatrixAt(i, d.matrix); });
  const grp = new THREE.Group(); grp.add(im, makeRock(404, -1.6, 6.2, 1.1, { flat: 0.4, y: -0.3, detail: 3 }));
  grp.userData.light = { pos: new THREE.Vector3(-1.8, 1.8, 6), color: '#60e8ff', intensity: 7, dist: 10 };
  return grp;
}

export function makeArch() {
  const g = new THREE.Group(), cx = -14, cz = 9, R = 4.4;
  for (let i = 0; i <= 12; i++) {
    const a = Math.PI * i / 12, x = cx + Math.cos(a) * R, y = Math.sin(a) * R * 1.15;
    const m = new THREE.Mesh(rockGeometry(500 + i, 4, 0.85, 1.6), rockMat); const s = 1.35 + (i === 0 || i === 12 ? 0.6 : 0) + Math.sin(i * 1.3) * 0.2;
    m.position.set(x, sandHeight(x, cz) + y + 0.3, cz + Math.sin(i * 2.1) * 0.3); m.scale.set(s, s, s * 1.1); m.rotation.set(i, i * 0.7, i * 0.3);
    g.add(m); obstacles.push({ x, y: m.position.y, z: cz, r: s * 1.1 });
  }
  g.add(makeRock(611, cx - 5.5, cz + 1.5, 1.6), makeRock(612, cx + 5.8, cz - 1, 1.2));
  g.add(makeGlassSponge(cx + 4.6, cz + 2.2, 0.9));
  g.userData.light = { pos: new THREE.Vector3(cx, 3, cz + 1), color: '#40d8c8', intensity: 6, dist: 12 };
  return g;
}

export function makeGlassGrove() {
  const g = new THREE.Group(), r = rng(55), cx = 13, cz = -9;
  for (let i = 0; i < 9; i++) { const a = r() * 6.28, d = Math.sqrt(r()) * 5; g.add(makeGlassSponge(cx + Math.cos(a) * d, cz + Math.sin(a) * d, 0.8 + r() * 1.4)); }
  g.add(makeRock(720, cx + 1, cz - 2, 1.6), makeRock(721, cx - 3, cz + 2, 1.1));
  g.add(makeSeaPens(14, 133, { x: cx, z: cz, r: 6 }));
  g.userData.light = { pos: new THREE.Vector3(cx, 3, cz), color: '#8fc8ff', intensity: 7, dist: 13 };
  return g;
}

export function makeClam(hq) {
  const g = new THREE.Group(), x = 5, z = 7;
  const shellMat = deep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, side: THREE.DoubleSide }), { rim: 0.8 });
  const shellPart = (flip) => {
    const geo = new THREE.SphereGeometry(1, hq ? 48 : 32, 16, 0, Math.PI * 2, 0, Math.PI / 2);
    const p = geo.attributes.position, c = new Float32Array(p.count * 3), a = C('#8a8aa0'), b = C('#4a4a60');
    for (let i = 0; i < p.count; i++) { let vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i); const ang = Math.atan2(vz, vx), rim = 1 - vy, rib = Math.abs(Math.sin(ang * 3.5)), k = 1 + rib * 0.12 * rim; vx *= k * 1.4; vz *= k * 0.9; vy = vy * 0.55 + rib * 0.08 * rim * rim; p.setXYZ(i, vx, vy, vz); const cc = b.clone().lerp(a, rib * 0.7 + 0.3 * (1 - rim)); c.set([cc.r, cc.g, cc.b], i * 3); }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, shellMat); if (flip) m.rotation.x = Math.PI; return m;
  };
  const bottom = shellPart(true), hinge = new THREE.Group(), top = shellPart(false);
  hinge.position.set(0, 0, -0.85); top.position.set(0, 0, 0.85); hinge.add(top); hinge.rotation.x = -0.55;
  const mg = new THREE.SphereGeometry(1, 40, 12); mg.scale(1.32, 0.16, 0.82);
  { const p = mg.attributes.position, c = new Float32Array(p.count * 3); for (let i = 0; i < p.count; i++) { const vx = p.getX(i), vz = p.getZ(i), n = noise3(vx * 3, 0, vz * 3); const cc = C('#103a8a').lerp(C('#30e0d0'), n).lerp(C('#a060ff'), Math.max(0, Math.sin(vx * 9) * Math.sin(vz * 9)) * 0.6); c.set([cc.r, cc.g, cc.b], i * 3); } mg.setAttribute('color', new THREE.BufferAttribute(c, 3)); setGlow(mg, (vx, vy, vz) => 0.5 + 0.5 * Math.max(0, Math.sin(vx * 9) * Math.sin(vz * 9))); }
  const mantle = new THREE.Mesh(mg, deep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35 }), { rim: 1.0, glow: 1.4, sheen: C('#40ffe0') })); mantle.position.y = 0.05;
  const pearl = new THREE.Mesh(new THREE.SphereGeometry(0.32, 32, 20), new THREE.MeshStandardMaterial({ color: '#fff4ec', roughness: 0.15, metalness: 0.2, emissive: '#d8e8ff', emissiveIntensity: 1.6 }));
  pearl.position.set(0, 0.32, 0.15);
  const clam = new THREE.Group(); clam.add(bottom, hinge, mantle, pearl); clam.scale.setScalar(1.35); clam.rotation.y = -0.6; clam.position.set(x, sandHeight(x, z) + 0.15, z);
  g.add(clam); g.userData.hinge = hinge; g.userData.pearl = pearl;
  g.userData.light = { pos: new THREE.Vector3(x, sandHeight(x, z) + 1.2, z), color: '#b8d8ff', intensity: 8, dist: 9 };
  g.userData.emitter = new THREE.Vector3(x, sandHeight(x, z) + 0.6, z);
  obstacles.push({ x, y: sandHeight(x, z) + 0.6, z, r: 2.2 });
  return g;
}

// hydrothermal vent: glowing-cracked chimneys, shimmering plume, bubbles, tube worms
const plumeMat = new THREE.ShaderMaterial({
  transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, uniforms: { uTime: U.uTime },
  vertexShader: `uniform float uTime; varying vec2 vUv; varying float vD; void main(){ vUv = uv; vec3 p = position; float t = uv.y;
    p.x += sin(t * 9.0 - uTime * 1.6) * 0.18 * t + sin(t * 3.0 - uTime * 0.7) * 0.4 * t; p.z += cos(t * 7.0 - uTime * 1.3) * 0.15 * t;
    vec4 mv = modelViewMatrix * vec4(p, 1.0); vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform float uTime; varying vec2 vUv; varying float vD;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
    void main(){ float t = vUv.y; float n = n2(vec2(vUv.x * 6.0, t * 8.0 - uTime * 1.2)) * 0.6 + n2(vec2(vUv.x * 13.0, t * 17.0 - uTime * 2.1)) * 0.4;
      float a = pow(sin(3.14159 * vUv.x), 2.0) * (1.0 - t) * smoothstep(0.0, 0.08, t) * (0.35 + 0.65 * n);
      vec3 c = mix(vec3(1.0, 0.55, 0.25), vec3(0.4, 0.5, 0.9), smoothstep(0.0, 0.5, t));
      gl_FragColor = vec4(c * a * 0.17 * smoothstep(2.0, 8.0, vD) * exp(-vD * 0.02), 1.0); }`,
});
export function makeVent() {
  const g = new THREE.Group(), cx = 11, cz = 10, r = rng(404);
  const chim = (x, z, h, rad) => {
    const geo = new THREE.CylinderGeometry(rad * 0.55, rad, h, 18, 14); geo.translate(0, h / 2, 0); const p = geo.attributes.position, c = new Float32Array(p.count * 3), gl = new Float32Array(p.count);
    for (let i = 0; i < p.count; i++) { const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i), n = noise3(vx * 3 + x, vy * 2, vz * 3), k = 1 + (n - 0.5) * 0.5 + Math.sin(vy * 5) * 0.06; p.setX(i, vx * k); p.setZ(i, vz * k);
      const crack = THREE.MathUtils.clamp((noise3(vx * 6, vy * 4 + x, vz * 6) - 0.62) * 6, 0, 1) * (0.4 + 0.6 * vy / h); const cc = C('#2a2228').lerp(C('#4a3a34'), n).lerp(C('#ff7a30'), crack); c.set([cc.r, cc.g, cc.b], i * 3); gl[i] = crack * 2.2 + (vy > h - 0.15 ? 1.0 : 0); }
    geo.setAttribute('color', new THREE.BufferAttribute(c, 3)); geo.setAttribute('aGlow', new THREE.BufferAttribute(gl, 1)); geo.deleteAttribute('uv'); geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, glowMat); m.position.set(x, sandHeight(x, z) - 0.2, z); g.add(m); obstacles.push({ x, y: m.position.y + h * 0.5, z, r: rad * 1.3 });
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.6 * rad + 0.6, 14, 1, 30), plumeMat); pl.geometry.translate(0, 7, 0); pl.position.set(x, m.position.y + h, z); pl.renderOrder = 6; g.add(pl);
    const pl2 = pl.clone(); pl2.rotation.y = Math.PI / 2; g.add(pl2);
    return new THREE.Vector3(x, m.position.y + h, z);
  };
  const tops = [chim(cx, cz, 4.2, 0.9), chim(cx + 1.8, cz - 0.6, 2.6, 0.6), chim(cx - 1.4, cz + 1.2, 1.8, 0.5)];
  for (let i = 0; i < 4; i++) { const a = r() * 6.28; g.add(placeGeo(tubeWormGeometry(70 + i, 16), glowMat, cx + Math.cos(a) * 2.6, cz + Math.sin(a) * 2.6, 0.9 + r() * 0.5)); }
  g.userData.tops = tops;
  g.userData.light = { pos: new THREE.Vector3(cx, sandHeight(cx, cz) + 3, cz), color: '#ff8a40', intensity: 8, dist: 13 };
  return g;
}

// ---------------- marine snow + plankton glints ----------------
export function makeSnow(n, prRef) {
  const g = new THREE.BufferGeometry(), r = rng(21), P = new Float32Array(n * 3), A = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { P.set([r() * 40, r() * 40, r() * 40], i * 3); A.set([0.5 + r() * 1.2, r(), r() < 0.12 ? 1 : 0], i * 3); }
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('aS', new THREE.BufferAttribute(A, 3));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { uTime: U.uTime, uPR: prRef, uCam: { value: new THREE.Vector3() } },
    vertexShader: `uniform float uTime, uPR; uniform vec3 uCam; attribute vec3 aS; varying float vA; varying float vG;
      void main(){
        vec3 drift = vec3(sin(uTime * 0.07 + aS.y * 20.0) * 0.6 + uTime * 0.05, -uTime * 0.09 * (0.4 + aS.y), cos(uTime * 0.06 + aS.y * 9.0) * 0.6);
        vec3 p = mod(position + drift - uCam + 20.0, 40.0) - 20.0 + uCam;
        vec4 mv = viewMatrix * vec4(p, 1.0); float d = -mv.z; float near = 1.0 - smoothstep(1.0, 5.0, d);
        vG = aS.z;
        float tw = aS.z > 0.5 ? 0.75 + 0.25 * sin(uTime * 0.25 + aS.y * 50.0) : 1.0;
        float ps = aS.x * uPR * (80.0 / max(d, 0.5)) * (1.0 + near * 1.2) * (aS.z > 0.5 ? 1.3 : 1.0);
        vA = (0.16 + 0.34 * aS.y) * smoothstep(0.3, 1.5, d) * (1.0 - smoothstep(10.0, 20.0, d)) * (1.0 - near * 0.85) * tw * (aS.z > 0.5 ? 1.5 : 1.0);
        vA *= clamp(ps / 2.5, 0.0, 1.0);
        gl_PointSize = clamp(ps, 2.5, 26.0);
        gl_Position = projectionMatrix * mv;
      }`,
    fragmentShader: `varying float vA; varying float vG;
      void main(){ float d = length(gl_PointCoord - 0.5); float s = smoothstep(0.5, 0.0, d); vec3 c = mix(vec3(0.75, 0.82, 1.0), vec3(0.3, 1.0, 0.95), vG); gl_FragColor = vec4(c * s * vA, 1.0); }`,
  });
  const pts = new THREE.Points(g, m); pts.frustumCulled = false; return pts;
}

export function makeBubbles(n, origin, prRef, height = 22, spread = 0.35, rate = 1, warm = false) {
  const g = new THREE.BufferGeometry(), r = rng(Math.floor(origin.x * 100 + origin.z)), P = new Float32Array(n * 3), A = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) A.set([r(), 0.6 + r() * 0.8, r(), r()], i * 4);
  g.setAttribute('position', new THREE.BufferAttribute(P, 3)); g.setAttribute('aS', new THREE.BufferAttribute(A, 4));
  const m = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending,
    uniforms: { uTime: U.uTime, uPR: prRef, uH: { value: height }, uSp: { value: spread }, uRate: { value: rate }, uCol: { value: warm ? C('#ffc8a0') : C('#bfe4ff') } },
    vertexShader: `uniform float uTime, uPR, uH, uSp, uRate; attribute vec4 aS; varying float vA; varying float vL;
      void main(){ float life = fract(aS.x + uTime * aS.y * 0.045 * uRate); vL = life;
        vec3 p = vec3((aS.z - 0.5) * uSp + sin(uTime * 2.4 + aS.w * 30.0) * 0.36 * life, life * uH, (aS.w - 0.5) * uSp + cos(uTime * 2.0 + aS.z * 30.0) * 0.36 * life);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); float d = -mv.z;
        gl_PointSize = clamp((0.08 + aS.y * 0.08) * (1.0 + life * 1.5) * uPR * 600.0 / max(d, 0.5), 1.5, 80.0);
        vA = smoothstep(0.0, 0.04, life) * (1.0 - smoothstep(0.6, 1.0, life)) * exp(-d * 0.04); gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform vec3 uCol; varying float vA; varying float vL;
      void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); float ring = smoothstep(0.5, 0.44, d) * smoothstep(0.2, 0.46, d);
        float hl = smoothstep(0.16, 0.0, length(c - vec2(-0.16, -0.16))); float a = (ring * 0.5 + hl * 0.7) * vA;
        gl_FragColor = vec4(uCol * a, 1.0); }`,
  });
  const pts = new THREE.Points(g, m); pts.position.copy(origin); pts.frustumCulled = false; return pts;
}

// ---------------- volumetric light shafts from the far surface (fade with depth) ----------------
export function makeLightShafts(n = 7) {
  const grp = new THREE.Group(), r = rng(808), list = [];
  const mat = new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide,
    uniforms: { uTime: U.uTime, uCol: { value: C('#7ab4e8') }, uStr: { value: 0.2 } },
    vertexShader: `varying vec2 vUv; varying float vD; varying float vSeed; uniform float uTime;
      void main(){ vUv = uv; vec3 p = position; vSeed = fract(modelMatrix[3].x * 0.137 + modelMatrix[3].z * 0.071);
        p.x += sin(uTime * 0.11 + vSeed * 20.0 + uv.y * 2.0) * 0.6 * (1.0 - uv.y);
        vec4 mv = modelViewMatrix * vec4(p, 1.0); vD = -mv.z; gl_Position = projectionMatrix * mv; }`,
    fragmentShader: `uniform float uTime; uniform vec3 uCol; uniform float uStr; varying vec2 vUv; varying float vD; varying float vSeed;
      float h(float x){ return fract(sin(x * 91.7) * 43758.5); }
      float n1(float x){ float i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f); return mix(h(i), h(i + 1.0), f); }
      void main(){
        float edge = pow(sin(3.14159 * vUv.x), 2.0);
        float streak = 0.55 + 0.45 * n1(vUv.x * 6.0 + vSeed * 30.0 + uTime * 0.04);
        float depth = 0.12 + 0.88 * pow(vUv.y, 1.3);                    // strongest high up, fades into the abyss
        float nearF = smoothstep(2.0, 9.0, vD) * (1.0 - smoothstep(45.0, 80.0, vD));
        float breathe = 0.85 + 0.15 * sin(uTime * 0.15 + vSeed * 12.0);
        gl_FragColor = vec4(uCol * uStr * edge * streak * depth * nearF * breathe, 1.0);
      }` });
  for (let i = 0; i < n; i++) {
    const w = 4 + r() * 6, h = 38;
    const g = new THREE.PlaneGeometry(w, h, 1, 8); g.translate(0, h / 2, 0);
    const m = new THREE.Mesh(g, mat); const a = r() * 6.28, d = 3 + r() * 18;
    m.position.set(Math.cos(a) * d, -2, Math.sin(a) * d); m.userData.tilt = (r() - 0.5) * 0.35; m.renderOrder = 6; m.frustumCulled = false;
    grp.add(m); list.push(m);
  }
  grp.userData.update = (cam) => { for (const m of list) { m.rotation.set(0, Math.atan2(cam.position.x - m.position.x, cam.position.z - m.position.z), m.userData.tilt, 'YXZ'); } };
  grp.userData.mat = mat;
  return grp;
}

// ---------------- glow kelp (tall swaying ribbons) ----------------
export function makeKelp(hq) {
  const r = rng(515), parts = [];
  const blade = (H, seed) => {
    const rr = rng(seed), NY = hq ? 28 : 16, P = [], Cc = [], G = [], I = [];
    for (let j = 0; j <= NY; j++) { const t = j / NY, y = t * H, wdt = (0.08 + 0.22 * Math.sin(Math.min(1, t * 1.15) * Math.PI) ) * (0.8 + 0.4 * rr()), tw = t * 2.4 + seed;
      const cx = Math.sin(t * 3 + seed) * 0.25 * t, cz = Math.cos(t * 2.3 + seed) * 0.2 * t;
      for (const s of [-1, 1]) { P.push(cx + Math.cos(tw) * wdt * s, y, cz + Math.sin(tw) * wdt * s); const c = new THREE.Color('#123a3a').lerp(C('#2a7a6a'), t * 0.8); const tip = t > 0.86 ? 1 : 0; if (Math.abs(s) && (j % 4 === 0) && t > 0.2) c.lerp(C('#6af0d0'), 0.35); Cc.push(c.r, c.g, c.b); G.push(tip ? 0.9 : (j % 4 === 0 && t > 0.2 ? 0.35 : 0.03)); }
    }
    for (let j = 0; j < NY; j++) { const a = j * 2; I.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3)); g.setAttribute('aGlow', new THREE.Float32BufferAttribute(G, 1)); g.setIndex(I); g.computeVertexNormals(); return g;
  };
  const clusters = [[-19, -8], [-14, 14], [16, 15], [19, -10], [3, 20], [-6, -19], [21, 4]];
  const grp = new THREE.Group();
  for (const [cx, cz] of clusters) {
    const k = hq ? 7 : 4;
    for (let i = 0; i < k; i++) {
      const x = cx + (r() - 0.5) * 4, z = cz + (r() - 0.5) * 4, H = 5 + r() * 5;
      if (obstacles.some(o => Math.hypot(o.x - x, o.z - z) < o.r + 0.3)) continue;
      const g = blade(H, r() * 100); g.translate(x, sandHeight(x, z) - 0.1, z); parts.push(g);
    }
  }
  const geo = mergeGeometries(parts);
  // sway: geometry is world-placed, so sway by local height above the seabed (approx. y + 2)
  const mat = deep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide }), { sway: { amp: 1.1, height: 11 }, glow: 1.2, rim: 0.8 });
  const m = new THREE.Mesh(geo, mat); grp.add(m); return grp;
}

// ---------------- sea grass meadows (instanced blades) ----------------
export function makeSeaGrass(n) {
  const r = rng(717);
  const g = new THREE.PlaneGeometry(0.07, 1, 1, 5); g.translate(0, 0.5, 0);
  { const p = g.attributes.position, c = new Float32Array(p.count * 3), gl = new Float32Array(p.count); for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setX(i, p.getX(i) * (1 - y * 0.85)); const col = C('#0e2a30').lerp(C('#2a6a6a'), y); c.set([col.r, col.g, col.b], i * 3); gl[i] = y > 0.85 ? 0.5 : 0.02; } g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setAttribute('aGlow', new THREE.BufferAttribute(gl, 1)); g.deleteAttribute('uv'); g.computeVertexNormals(); }
  const mat = deep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide }), { sway: { amp: 0.28, height: 1.0 }, glow: 1.0, rim: 0.6 });
  const mesh = new THREE.InstancedMesh(g, mat, n); const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), s = new THREE.Vector3(), p = new THREE.Vector3();
  const patches = [[-3, 9], [8, 5], [-10, 2], [4, -11], [12, -5], [-8, -8], [0, 14], [15, 9]];
  let k = 0;
  for (let i = 0; i < n * 3 && k < n; i++) {
    const [cx, cz] = patches[i % patches.length]; const a = r() * 6.28, d = Math.pow(r(), 0.7) * 3.6, x = cx + Math.cos(a) * d, z = cz + Math.sin(a) * d;
    if (obstacles.some(o => Math.hypot(o.x - x, o.z - z) < o.r + 0.2)) continue;
    p.set(x, sandHeight(x, z) - 0.05, z); q.setFromEuler(e.set((r() - 0.5) * 0.4, r() * 6.28, (r() - 0.5) * 0.4)); const h = 0.5 + r() * 1.1; s.set(1 + r() * 0.6, h, 1);
    m4.compose(p, q, s); mesh.setMatrixAt(k++, m4);
  }
  mesh.count = k; return mesh;
}

// ---------------- barrel & tube sponges ----------------
export function makeSponges(hq) {
  const r = rng(929), parts = [];
  const spots = [[-6.5, 4], [9, -6], [-12, -10], [6, 12], [-2, -15], [17, 2], [-17, 9], [12, 18]];
  for (const [x0, z0] of spots) {
    const k = 1 + Math.floor(r() * 3);
    for (let i = 0; i < k; i++) {
      const x = x0 + (r() - 0.5) * 2.2, z = z0 + (r() - 0.5) * 2.2; if (obstacles.some(o => Math.hypot(o.x - x, o.z - z) < o.r + 0.4)) continue;
      const barrel = r() < 0.5, H = barrel ? 0.8 + r() * 0.8 : 1.0 + r() * 1.4, R = barrel ? 0.35 + r() * 0.25 : 0.1 + r() * 0.08;
      const pts = []; for (let j = 0; j <= 12; j++) { const t = j / 12; const rad = barrel ? R * (0.75 + 0.35 * Math.sin(t * 2.6)) : R * (0.9 + 0.2 * t); pts.push(new THREE.Vector2(rad, t * H)); }
      pts.push(new THREE.Vector2(pts[12].x * 0.82, H)); pts.push(new THREE.Vector2(pts[12].x * 0.78, H * 0.55));
      const g = new THREE.LatheGeometry(pts, hq ? 22 : 12);
      const base = C(barrel ? (r() < 0.5 ? '#b0703a' : '#8a5a8a') : (r() < 0.5 ? '#c8a040' : '#5a7ab0')); const pp = g.attributes.position, c = new Float32Array(pp.count * 3), gl = new Float32Array(pp.count);
      for (let j = 0; j < pp.count; j++) { const px = pp.getX(j), py = pp.getY(j), pz = pp.getZ(j); const n = noise3(px * 9, py * 9, pz * 9); const col = base.clone().multiplyScalar(0.55 + 0.6 * n); if (py > H * 0.96) col.lerp(C('#ffd8a0'), 0.25); c.set([col.r, col.g, col.b], j * 3); gl[j] = (py > H * 0.97 ? 0.25 : 0.01); pp.setX(j, px * (1 + (n - 0.5) * 0.2)); pp.setZ(j, pz * (1 + (n - 0.5) * 0.2)); }
      g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setAttribute('aGlow', new THREE.BufferAttribute(gl, 1)); g.deleteAttribute('uv'); g.computeVertexNormals();
      g.rotateX((r() - 0.5) * 0.25); g.translate(x, sandHeight(x, z) - 0.08, z); parts.push(g);
    }
  }
  return new THREE.Mesh(mergeGeometries(parts), deep(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }), { rim: 0.6, glow: 1.0 }));
}
