// BLUE HAVEN — first playable sample. © MOTOR AA
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { U, rng, sandHeight } from './common.js?v=deep2';
import * as E from './env.js?v=deep2';
import { SPECIES, SPECIES_ORDER, InstSpecies, Dumbos, Jellies, CombJellies } from './creatures.js?v=deep2';
import { SeaAudio } from './audio.js?v=deep2';
import { LANGS, detectLang, setLang, getLang, t } from './i18n.js?v=deep2';

const qs = new URLSearchParams(location.search);
const SHOT = qs.has('shot'), DEMO = qs.has('demo');
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
const isMobile = isTouch && Math.min(screen.width, screen.height) < 900;
const QUALITY = qs.get('q') || (isMobile ? 'mid' : 'high');
const HQ = QUALITY === 'high', LOW = QUALITY === 'low';
U.uLowQ.value = LOW ? 1 : 0;

// ---------- renderer ----------
const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: SHOT });
const maxPR = LOW ? 0.8 : QUALITY === 'mid' ? Math.min(devicePixelRatio, 1.5) : Math.min(devicePixelRatio, 2);
let pixelRatio = HQ ? Math.min(devicePixelRatio, 1.5) : Math.min(maxPR, LOW ? 0.8 : 1.1);
renderer.setPixelRatio(pixelRatio);
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.2;
renderer.outputColorSpace = THREE.SRGBColorSpace;
const prRef = { value: pixelRatio };

const scene = new THREE.Scene();
scene.fog = new THREE.FogExp2(E.PAL.mid.clone(), 0.034);
const camera = new THREE.PerspectiveCamera(55, 1, 0.1, 1200);

// ---------- environment ----------
const backdrop = E.makeBackdrop(); scene.add(backdrop);
scene.add(E.makeSilt(LOW ? 110 : HQ ? 220 : 160));
const hemi = new THREE.HemisphereLight('#1c3466', '#06070e', 0.55); scene.add(hemi);
const moon = new THREE.DirectionalLight('#5a78c0', 0.35); moon.position.set(-10, 60, 8); scene.add(moon);
// soft light that travels with the viewer + a gentle glowing guide orb, so the abyss stays calm and readable
const camLight = new THREE.PointLight('#a8c0ff', 16, 30, 1.3); scene.add(camLight);
const orb = new THREE.Group(); scene.add(orb);
orb.add(new THREE.Mesh(new THREE.SphereGeometry(0.16, 20, 14), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.8, 3.2) })));
const orbLight = new THREE.PointLight('#9fe8ff', 14, 16, 1.4); orb.add(orbLight);
const orbHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'); const gr = x.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(200,245,255,0.9)'); gr.addColorStop(0.35, 'rgba(120,210,255,0.25)'); gr.addColorStop(1, 'rgba(80,160,255,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); const tx = new THREE.CanvasTexture(c); tx.colorSpace = THREE.SRGBColorSpace; return tx; })(), blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
orbHalo.scale.setScalar(1.5); orb.add(orbHalo);
const orbPos = new THREE.Vector3(2, 6, 4);
const ROCKS = [[301, 7.5, -2.5, 2.4, {}], [302, 9.8, 0.5, 1.3, {}], [303, -5.5, 1.5, 1.6, {}], [304, 2.5, -6.5, 1.9, { sx: 1.4 }], [305, -16, -3, 3.2, { sz: 1.3 }], [306, 18, 12, 3.6, {}], [307, -4, -12, 2.6, {}], [308, 14, -2, 1.0, {}], [309, -9.5, 13, 1.4, {}], [310, 22, -16, 4.5, {}], [311, -26, 6, 5, {}], [312, 6, -18, 3.4, {}]];
for (const [s, x, z, sc, o] of ROCKS) scene.add(E.makeRock(s, x, z, sc, o));
scene.add(E.makeSeaPens(LOW ? 30 : 60, 5, { x: 0, z: 0, r: 28 }, [{ x: 0, z: 0, r: 3 }]));
scene.add(E.makeBaseCorals(HQ));
scene.add(E.makeFloorSpecks(LOW ? 300 : 700, prRef));
const snow = E.makeSnow(LOW ? 320 : HQ ? 1100 : 750, prRef); scene.add(snow);
scene.add(E.makeBubbles(LOW ? 14 : 24, new THREE.Vector3(8.6, sandHeight(8.6, -1.5) + 1.2, -1.5), prRef, 22, 0.3, 0.8));
// pooled decor lights (fixed count => no shader recompiles when decor is added)
const lightDefs = [];
const pool = []; for (let i = 0; i < (LOW ? 2 : HQ ? 5 : 4); i++) { const l = new THREE.PointLight('#ffffff', 0, 10, 1.4); scene.add(l); pool.push(l); }
let poolT = 0;
function assignLights() { const t = cam.target; const sorted = lightDefs.slice().sort((a, b) => a.pos.distanceToSquared(t) - b.pos.distanceToSquared(t)); pool.forEach((l, i) => { const d = sorted[i]; if (d) { l.position.copy(d.pos); l.color.set(d.color); l.userData.target = d.intensity; l.distance = d.dist; } else l.userData.target = 0; }); }

// ---------- decorations ----------
const DECOR = {
  anem: { cost: 25, build: () => E.makeAnemones(HQ), focus: new THREE.Vector3(-1.6, 2, 6), dist: 9 },
  coral: { cost: 35, build: () => E.makeCoralGarden(HQ), focus: new THREE.Vector3(-9, 2, -5), dist: 13 },
  vent: { cost: 45, build: () => E.makeVent(), focus: new THREE.Vector3(11, 4, 10), dist: 15 },
  sponge: { cost: 50, build: () => E.makeGlassGrove(), focus: new THREE.Vector3(13, 2.5, -9), dist: 13 },
  clam: { cost: 55, build: () => E.makeClam(HQ), focus: new THREE.Vector3(5, 1.5, 7), dist: 8 },
  arch: { cost: 60, build: () => E.makeArch(), focus: new THREE.Vector3(-14, 4, 9), dist: 16 },
};
const DECOR_ORDER = ['anem', 'coral', 'vent', 'sponge', 'clam', 'arch'];
const decorObj = {}; const growing = [];
let clamGroup = null;
function placeDecor(id, animate) {
  if (decorObj[id]) return; const g = DECOR[id].build(); decorObj[id] = g; scene.add(g);
  if (g.userData.light) { lightDefs.push(g.userData.light); poolT = 0; }
  if (id === 'clam') { clamGroup = g; scene.add(E.makeBubbles(LOW ? 16 : 28, g.userData.emitter, prRef, 22, 0.25, 1.1)); }
  if (id === 'vent') for (const tp of g.userData.tops) scene.add(E.makeBubbles(LOW ? 16 : 30, tp, prRef, 20, 0.4, 1.6, true));
  if (animate) { g.scale.setScalar(0.01); growing.push({ g, t: 0 }); }
}

// ---------- creatures ----------
const groups = {};
function ensureGroup(id) {
  if (groups[id]) return groups[id];
  const sp = SPECIES[id]; let g;
  if (sp.kind === 'fish' || sp.kind === 'squid') g = new InstSpecies(id); else if (sp.kind === 'dumbo') g = new Dumbos(); else if (sp.kind === 'comb') g = new CombJellies(); else g = new Jellies();
  groups[id] = g; scene.add(g.mesh); return g;
}
function addCreatures(id, n, arrive) { const g = ensureGroup(id); let first = -1; for (let i = 0; i < n; i++) { const k = g.add(arrive); if (first < 0) first = k; } return first; }

// ---------- save ----------
const SAVE_KEY = 'bluehaven.deep.save.v2';
let save = { pearls: 30, counts: { lantern: SPECIES.lantern.start }, decor: {}, plays: 0 };
try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (s && s.counts) save = Object.assign(save, s); } catch (e) {}
if (DEMO) save = { pearls: 120, counts: { lantern: 46, hatchet: 18, angler: 3, jelly: 8, comb: 9, dumbo: 2, squid: 1, whale: 1 }, decor: { anem: 1, coral: 1, vent: 1, sponge: 1, clam: 1, arch: 1 }, plays: 3 };
function persist() { if (DEMO) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) {} }
for (const id of DECOR_ORDER) if (save.decor[id]) placeDecor(id, false);
for (const id of SPECIES_ORDER) if (save.counts[id]) addCreatures(id, save.counts[id], false);

// ---------- post ----------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.8, 0.6, 0.3); composer.addPass(bloom);
composer.addPass(new OutputPass());
const grade = new ShaderPass({
  uniforms: { tDiffuse: { value: null }, res: { value: new THREE.Vector2(1, 1) }, time: { value: 0 }, vig: { value: 0.62 }, low: { value: LOW ? 1 : 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 res; uniform float time, vig, low; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    float n2(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h(i), h(i + vec2(1, 0)), f.x), mix(h(i + vec2(0, 1)), h(i + vec2(1, 1)), f.x), f.y); }
    void main(){
      vec2 uv = vUv;
      uv += vec2(sin(uv.y * 10.0 + time * 0.5), cos(uv.x * 8.0 + time * 0.4)) * 0.0008;   // gentle water wobble
      vec2 px = 1.0 / res;
      vec2 w = vec2(n2(uv * res / 7.0), n2(uv * res / 7.0 + 9.1)) - 0.5;                       // painterly brush warp
      vec3 c = texture2D(tDiffuse, uv + w * px * 2.0).rgb;
      if (low < 0.5) {
        c = c * 0.72 + 0.28 * texture2D(tDiffuse, uv + w.yx * px * 3.2).rgb;
        vec2 d0 = (uv - 0.5); float ca = dot(d0, d0) * 0.006;                                  // soft chromatic edge
        c.r = mix(c.r, texture2D(tDiffuse, uv + d0 * ca * 4.0).r, 0.5);
      }
      float l = dot(c, vec3(0.299, 0.587, 0.114));
      c = mix(vec3(l), c, 1.1);
      vec3 lift = vec3(0.004, 0.012, 0.03), gain = vec3(0.97, 1.0, 1.06);
      c = mix(lift + c * (1.0 - lift), c * gain, smoothstep(0.0, 1.0, l));
      c = mix(c, c * c * (3.0 - 2.0 * c), 0.18);
      c += (n2(uv * res * 0.5) - 0.5) * 0.02 + (h(uv * res + fract(time)) - 0.5) * 0.012;
      vec2 d = uv - 0.5; d.x *= res.x / res.y * 0.75;
      c *= 1.0 - vig * smoothstep(0.3, 1.0, length(d));
      c = mix(c, c * vec3(0.7, 0.85, 1.1), smoothstep(0.35, 1.0, length(d)) * 0.6);
      gl_FragColor = vec4(clamp(c, 0.0, 1.0), 1.0);
    }`,
});
composer.addPass(grade);
function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setPixelRatio(pixelRatio); renderer.setSize(w, h, false); composer.setPixelRatio(pixelRatio); composer.setSize(w, h);
  camera.aspect = w / h; camera.fov = w < h ? 66 : 52; camera.updateProjectionMatrix();
  bloom.resolution.set(w * pixelRatio * 0.5, h * pixelRatio * 0.5); grade.uniforms.res.value.set(w * pixelRatio, h * pixelRatio); prRef.value = pixelRatio;
}
addEventListener('resize', resize); resize();

// ---------- camera rig ----------
const cam = { yaw: 0.55, pitch: 0.1, dist: 24, tYaw: 0.55, tPitch: 0.1, tDist: 24, target: new THREE.Vector3(0, 5.5, 0), tTarget: new THREE.Vector3(0, 5.5, 0), idle: 0, follow: null, fYaw: 0.9 };
if (innerHeight > innerWidth) { cam.dist = cam.tDist = 30; }
const ST = { mode: 'title', mg: null };
const audio = new SeaAudio();
try { audio.muted = localStorage.getItem('bluehaven.muted') === '1'; } catch (e) {}

// ---------- UI ----------
const $ = (id) => document.getElementById(id);
const PEARL_DOT = '<span class="pearlDot"></span>';
function setPearls(bump) { $('pearlCount').textContent = save.pearls; document.querySelectorAll('.pearlMirror').forEach(e => e.textContent = save.pearls); if (bump) { const p = $('pearlPill'); p.classList.remove('bump'); void p.offsetWidth; p.classList.add('bump'); } }
function refreshTexts() {
  $('langCode').textContent = getLang().toUpperCase();
  $('muteLabel').textContent = t(audio.muted ? 'unmute' : 'mute'); $('muteBtn').setAttribute('aria-label', t(audio.muted ? 'unmute' : 'mute'));
  $('icSound').innerHTML = audio.muted ? '<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M17 9l5 6M22 9l-5 6"/>' : '<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>';
  const h = isTouch ? t('hintTouch') : t('hintKeys'); $('hint').textContent = h; $('startHint').textContent = h;
  const menu = $('langMenu'); menu.innerHTML = '';
  for (const L of LANGS) { const b = document.createElement('button'); b.textContent = L.label; b.className = L.code === getLang() ? 'on' : ''; b.onclick = () => { setLang(L.code); refreshTexts(); menu.classList.add('hidden'); }; menu.appendChild(b); }
  if (cam.follow) $('followName').textContent = t('following') + ' · ' + t('sp_' + cam.follow.g.id);
  renderShop(); setPearls(false);
}
setLang(qs.get('lang') || detectLang(), false);
$('langBtn').onclick = (e) => { e.stopPropagation(); $('langMenu').classList.toggle('hidden'); };
document.addEventListener('pointerdown', (e) => { if (!$('langMenu').contains(e.target) && !e.target.closest('#langBtn')) $('langMenu').classList.add('hidden'); });
function toggleMute() { audio.setMuted(!audio.muted); try { localStorage.setItem('bluehaven.muted', audio.muted ? '1' : '0'); } catch (e) {} refreshTexts(); }
$('muteBtn').onclick = toggleMute;

// art for cards (simple original vector silhouettes)
const fishSvg = (body, fin, extra = '', tall = 1) => `<svg viewBox="0 0 96 64" class="art"><path d="M16 32c12-${14 * tall} 40-${14 * tall} 56 0-16 ${14 * tall}-44 ${14 * tall}-56 0z" fill="${body}"/><path d="M70 32l18-12v24z" fill="${fin}"/>${extra}<circle cx="26" cy="29" r="2.6" fill="#10141c"/></svg>`;
const ART = {
  lantern: `<svg viewBox="0 0 96 64" class="art">${[[10, 20], [40, 12], [30, 36], [56, 28], [14, 46]].map(([x, y]) => `<g transform="translate(${x} ${y})"><path d="M0 7c5-7 17-7 24 0-7 7-19 7-24 0z" fill="#4a5a7a"/><path d="M24 7l8-5v10z" fill="#3a4a6a"/><circle cx="5" cy="5.5" r="2.4" fill="#cfe8ff"/>${[8, 12, 16, 20].map(cx => `<circle cx="${cx}" cy="9" r="1" fill="#7ff8ff"/>`).join('')}</g>`).join('')}</svg>`,
  hatchet: `<svg viewBox="0 0 96 64" class="art"><path d="M22 18c14-6 34 0 40 12l14-8v22l-14-8c-6 10-22 16-34 10-8-6-12-20-6-28z" fill="#c8d4e8"/><path d="M26 48c10 4 22 2 30-6" stroke="#80b8ff" stroke-width="3" stroke-dasharray="2 3" fill="none"/><circle cx="30" cy="26" r="5" fill="#1a2a3a"/><circle cx="31.5" cy="24.5" r="1.6" fill="#fff"/></svg>`,
  angler: `<svg viewBox="0 0 96 64" class="art"><ellipse cx="44" cy="38" rx="24" ry="18" fill="#5a3a5a"/><path d="M66 38l16-10v20z" fill="#6a4a6a"/><path d="M34 22c0-14 18-18 24-12" stroke="#7a5a7a" stroke-width="2" fill="none"/><circle cx="60" cy="11" r="6" fill="#a8fff0"/><circle cx="60" cy="11" r="11" fill="#a8fff0" opacity=".25"/><circle cx="32" cy="32" r="6" fill="#0a0a14"/><circle cx="34" cy="30" r="2" fill="#fff"/><path d="M22 44c6 3 12 3 16 0" stroke="#2a1828" stroke-width="2" fill="none"/></svg>`,
  jelly: `<svg viewBox="0 0 96 64" class="art"><path d="M28 30c0-14 40-14 40 0z" fill="#6a4ad8" opacity=".9"/><path d="M30 29c6-2 30-2 36 0" stroke="#5af0ff" stroke-width="2.5" fill="none"/>${[32, 40, 48, 56, 64].map(x => `<path d="M${x} 30c-3 8 3 14 0 26" stroke="#8ab8ff" stroke-width="1.6" fill="none"/>`).join('')}</svg>`,
  comb: `<svg viewBox="0 0 96 64" class="art"><ellipse cx="48" cy="32" rx="16" ry="24" fill="#2a3a6a" opacity=".6"/>${['#ff5a8a', '#ffd25a', '#5affa0', '#5ac8ff'].map((c, i) => `<path d="M${36 + i * 8} 12c${i < 2 ? -6 : 6} 12 ${i < 2 ? -6 : 6} 28 0 40" stroke="${c}" stroke-width="2.4" stroke-dasharray="3 2" fill="none"/>`).join('')}</svg>`,
  dumbo: `<svg viewBox="0 0 96 64" class="art"><path d="M26 40c0 10 10 18 22 18s22-8 22-18z" fill="#ff9aa8"/><circle cx="48" cy="28" r="18" fill="#ffb0a0"/><ellipse cx="26" cy="22" rx="9" ry="5" fill="#ff8aa0" transform="rotate(-25 26 22)"/><ellipse cx="70" cy="22" rx="9" ry="5" fill="#ff8aa0" transform="rotate(25 70 22)"/><circle cx="41" cy="30" r="4" fill="#0a0a14"/><circle cx="55" cy="30" r="4" fill="#0a0a14"/><circle cx="42" cy="29" r="1.3" fill="#fff"/><circle cx="56" cy="29" r="1.3" fill="#fff"/></svg>`,
  squid: `<svg viewBox="0 0 96 64" class="art"><path d="M80 32l-8-10-26 4v12l26 4z" fill="#e07a5a"/><path d="M80 32l10-8v16z" fill="#f09070"/><circle cx="46" cy="32" r="8" fill="#e88a6a"/><circle cx="44" cy="30" r="4" fill="#0a0c18"/><circle cx="44" cy="30" r="5" fill="none" stroke="#a8e8ff" stroke-width="1.2"/>${[24, 28, 32, 36, 40].map((y, i) => `<path d="M40 ${y + 8}c-10 0-18 ${i - 2} -${30 + (i % 2) * 6} ${(i - 2) * 3}" stroke="#e07a5a" stroke-width="2" fill="none"/>`).join('')}</svg>`,
  whale: `<svg viewBox="0 0 96 64" class="art"><path d="M8 26c0-6 6-8 14-8h30c10 0 20 6 26 12l10-8v20l-10-6c-8 6-20 8-30 8H22c-8 0-14-4-14-10z" fill="#6a7484"/><path d="M14 40c12 2 30 2 44 0" stroke="#c8ccd8" stroke-width="2" fill="none"/><path d="M30 24l6 6M40 22l4 8" stroke="#c8ccd8" stroke-width="1" /><circle cx="20" cy="34" r="1.6" fill="#111"/></svg>`,
  anem: `<svg viewBox="0 0 96 64" class="art"><rect x="36" y="42" width="24" height="16" rx="6" fill="#3a2a5a"/>${Array.from({ length: 11 }, (_, i) => { const a = Math.PI + 0.25 + i * 0.27; return `<path d="M48 44q${(Math.cos(a) * 10).toFixed(1)} ${(Math.sin(a) * 12).toFixed(1)} ${(Math.cos(a) * 20).toFixed(1)} ${(Math.sin(a) * 26).toFixed(1)}" stroke="#7a7ac8" stroke-width="3" stroke-linecap="round" fill="none"/><circle cx="${(48 + Math.cos(a) * 20).toFixed(1)}" cy="${(44 + Math.sin(a) * 26).toFixed(1)}" r="2.8" fill="#9af8ff"/>`; }).join('')}</svg>`,
  coral: `<svg viewBox="0 0 96 64" class="art"><path d="M30 60V40l-8-12M30 44l8-14M30 36l-2-14" stroke="#3a2a6a" stroke-width="5" stroke-linecap="round" fill="none"/>${[[22, 28], [38, 30], [28, 22]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="3.4" fill="#ff5ac8"/>`).join('')}<path d="M62 60V42l-6-10M62 46l8-12" stroke="#1a3a5a" stroke-width="5" stroke-linecap="round" fill="none"/><circle cx="56" cy="32" r="3.4" fill="#5af0ff"/><circle cx="70" cy="34" r="3.4" fill="#5af0ff"/></svg>`,
  vent: `<svg viewBox="0 0 96 64" class="art"><path d="M38 60l4-36h12l4 36z" fill="#3a2e32"/><path d="M44 30l3 8-2 8M50 34l2 10" stroke="#ff7a30" stroke-width="2" fill="none"/><path d="M60 60l3-20h8l3 20z" fill="#3a2e32"/><path d="M48 22c-4-6 4-10 0-18M67 38c-3-5 3-8 0-14" stroke="#ffb080" stroke-width="2" opacity=".6" fill="none"/><circle cx="52" cy="10" r="2" fill="none" stroke="#ffd0b0"/><circle cx="45" cy="16" r="1.5" fill="none" stroke="#ffd0b0"/>${[24, 28, 80].map(x => `<rect x="${x}" y="46" width="3" height="14" fill="#d8d4cc"/><circle cx="${x + 1.5}" cy="45" r="3" fill="#ff3a6a"/>`).join('')}</svg>`,
  sponge: `<svg viewBox="0 0 96 64" class="art">${[[34, 1], [56, 0.8], [70, 0.6]].map(([x, s]) => `<path d="M${x - 8 * s} 60c-${4 * s} -${16 * s} ${-2 * s} -${36 * s} ${-4 * s} -${50 * s}h${24 * s}c${-2 * s} ${14 * s} 0 ${34 * s} ${-4 * s} ${50 * s}z" fill="none" stroke="#9fd8ff" stroke-width="1.6"/><path d="M${x - 10 * s} ${60 - 20 * s}h${20 * s}M${x - 11 * s} ${60 - 36 * s}h${22 * s}" stroke="#9fd8ff" stroke-width="1" opacity=".6"/>`).join('')}</svg>`,
  clam: `<svg viewBox="0 0 96 64" class="art"><path d="M14 44c4 14 64 14 68 0z" fill="#6a6a80"/><path d="M14 40c0-24 68-24 68 0z" fill="#8a8aa0"/><path d="M24 40c4-8 44-8 48 0z" fill="#30a0d0"/><circle cx="48" cy="38" r="9" fill="#d8e8ff" opacity=".35"/><circle cx="48" cy="38" r="6" fill="#ffffff"/></svg>`,
  arch: `<svg viewBox="0 0 96 64" class="art"><path d="M12 60V34a36 30 0 0 1 72 0v26H66V36a18 16 0 0 0-36 0v24z" fill="#3a3a48"/>${[[20, 30], [30, 16], [52, 8], [70, 18], [78, 40], [16, 48]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="2" fill="#40e8d0"/>`).join('')}</svg>`,
};

let shopTab = 'life';
function itemState(kind, id) {
  if (kind === 'decor') { const owned = !!save.decor[id]; return { owned, cost: DECOR[id].cost, done: owned, label: owned ? t('owned') : t('place') }; }
  const sp = SPECIES[id], n = save.counts[id] || 0;
  if (n === 0) return { owned: false, cost: sp.cost, done: false, label: t('unlock'), count: 0 };
  if (n >= sp.max) return { owned: true, cost: 0, done: true, label: t('full'), count: n };
  return { owned: true, cost: sp.addCost, done: false, label: t('addMore') + ' +' + Math.min(sp.step, sp.max - n), count: n };
}
function renderShop() {
  const grid = $('shopGrid'); grid.innerHTML = '';
  const list = shopTab === 'life' ? SPECIES_ORDER.map(id => ['life', id]) : DECOR_ORDER.map(id => ['decor', id]);
  for (const [kind, id] of list) {
    const s = itemState(kind, id), el = document.createElement('div'); el.className = 'item' + (s.owned ? ' owned' : '');
    const name = t(kind === 'life' ? 'sp_' + id : 'dc_' + id);
    const large = kind === 'life' && SPECIES[id].large ? `<span class="badge">${t('large')}</span>` : '';
    const count = kind === 'life' && s.count ? `× ${s.count}` : '';
    el.innerHTML = `${large}${ART[id]}<div class="nm">${name}</div><div class="ct">${count}</div>`;
    const b = document.createElement('button'); b.className = 'buy' + (s.done ? ' done' : save.pearls < s.cost ? ' poor' : '');
    b.innerHTML = s.done ? `<svg viewBox="0 0 24 24" class="ic"><path d="M5 13l4 4L19 7"/></svg><span>${s.label}</span>` : `<span>${s.label}</span>${s.cost ? PEARL_DOT + '<b>' + s.cost + '</b>' : ''}`;
    if (!s.done) b.onclick = () => buy(kind, id);
    el.appendChild(b); grid.appendChild(el);
  }
}
document.querySelectorAll('.tab').forEach(b => b.onclick = () => { shopTab = b.dataset.tab; document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === b)); renderShop(); audio.tap(); });
function buy(kind, id) {
  const s = itemState(kind, id);
  if (save.pearls < s.cost) { toast('', t('needMore')); audio.tap(); return; }
  save.pearls -= s.cost; setPearls(true);
  closeSheets(); audio.unlock();
  if (kind === 'decor') {
    save.decor[id] = 1; placeDecor(id, true); stopFollow();
    cam.tTarget.copy(DECOR[id].focus); cam.tDist = DECOR[id].dist; cam.tPitch = 0.28; cam.idle = -6;
    toast(t('dc_' + id), t('newDecor'));
  } else {
    const sp = SPECIES[id], n = save.counts[id] || 0, add = n === 0 ? (id === 'lantern' ? sp.start : sp.step) : Math.min(sp.step, sp.max - n);
    save.counts[id] = n + add; const first = addCreatures(id, add, true);
    if (first >= 0) setTimeout(() => startFollow(groups[id], first), 400);
    toast(t('sp_' + id), n === 0 ? t('newFriend') : t('moreFish'));
  }
  persist(); renderShop();
}
let toastTm = 0;
function toast(a, b) { const el = $('toast'); el.querySelector('.t1').textContent = a; el.querySelector('.t2').textContent = b; el.classList.remove('hidden'); clearTimeout(toastTm); toastTm = setTimeout(() => el.classList.add('hidden'), SHOT ? 1e9 : 4200); }

function openSheet(id) { closeSheets(); $(id).classList.remove('hidden'); if (id === 'shopPanel') renderShop(); audio.tap(); }
function closeSheets() { for (const id of ['gamesPanel', 'shopPanel', 'resultPanel']) $(id).classList.add('hidden'); }
document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => { $(b.dataset.close).classList.add('hidden'); audio.tap(); });
document.querySelectorAll('.sheet').forEach(s => s.addEventListener('pointerdown', (e) => { if (e.target === s && s.id !== 'resultPanel') s.classList.add('hidden'); }));
$('gamesBtn').onclick = () => openSheet('gamesPanel');
$('shopBtn').onclick = () => openSheet('shopPanel');
document.querySelectorAll('[data-game]').forEach(b => b.onclick = () => startMinigame(b.dataset.game));

// ---------- follow ----------
function startFollow(g, i) { cam.follow = { g, i }; cam.fYaw = 0.9; $('followChip').classList.remove('hidden'); $('followName').textContent = t('following') + ' · ' + t('sp_' + g.id); }
function stopFollow() { if (!cam.follow) return; cam.follow = null; $('followChip').classList.add('hidden'); cam.tTarget.set(0, 5.5, 0); cam.tDist = innerHeight > innerWidth ? 30 : 25; }
$('stopFollow').onclick = () => { stopFollow(); audio.tap(); };

// ---------- picking ----------
const pv = new THREE.Vector3();
function toScreen(p, out) { pv.copy(p).project(camera); out.x = (pv.x * 0.5 + 0.5) * innerWidth; out.y = (-pv.y * 0.5 + 0.5) * innerHeight; out.z = pv.z; return out; }
function pickCreature(x, y) {
  let best = null, bd = 1e9; const sp = { x: 0, y: 0, z: 0 };
  for (const g of Object.values(groups)) for (let i = 0; i < g.n; i++) {
    toScreen(g.pos[i], sp); if (sp.z > 1) continue;
    const dist = camera.position.distanceTo(g.pos[i]); const rad = Math.max(34, (g.sp.len * 0.6) / dist * innerHeight * 1.2);
    const d = Math.hypot(sp.x - x, sp.y - y); if (d < rad && d / rad < bd) { bd = d / rad; best = { g, i }; }
  }
  return best;
}

// ---------- input ----------
const pointers = new Map(); const keys = new Set(); let pinch0 = 0, dist0 = 0;
canvas.addEventListener('pointerdown', (e) => { if (ST.mode === 'title') return; pointers.set(e.pointerId, { x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, t: performance.now(), drag: false }); try { canvas.setPointerCapture(e.pointerId); } catch (_) {}
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); dist0 = cam.tDist; } });
canvas.addEventListener('pointermove', (e) => {
  const p = pointers.get(e.pointerId); if (!p) return; const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (!p.drag && Math.hypot(p.x - p.sx, p.y - p.sy) > 9) p.drag = true;
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); if (pinch0 > 0) cam.tDist = THREE.MathUtils.clamp(dist0 * pinch0 / d, 5, 42); cam.idle = 0; return; }
  if (p.drag && !ST.mg) { if (cam.follow) cam.fYaw -= dx * 0.006; else cam.tYaw -= dx * 0.005; cam.tPitch = THREE.MathUtils.clamp(cam.tPitch + dy * 0.003, -0.15, 0.95); cam.idle = 0; }
});
const endPtr = (e) => { const p = pointers.get(e.pointerId); pointers.delete(e.pointerId); if (pointers.size < 2) pinch0 = 0; if (p && !p.drag && performance.now() - p.t < 450 && e.type === 'pointerup') onTap(e.clientX, e.clientY); };
canvas.addEventListener('pointerup', endPtr); canvas.addEventListener('pointercancel', endPtr);
canvas.addEventListener('wheel', (e) => { e.preventDefault(); cam.tDist = THREE.MathUtils.clamp(cam.tDist * (1 + Math.sign(e.deltaY) * 0.08), 5, 42); cam.idle = 0; }, { passive: false });
addEventListener('keydown', (e) => {
  if (ST.mode === 'title') { if (e.code === 'Enter' || e.code === 'Space') startPlay(); return; }
  keys.add(e.code);
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'KeyG' && !ST.mg) openSheet('gamesPanel');
  if (e.code === 'KeyB' && !ST.mg) openSheet('shopPanel');
  if (e.code === 'Escape') { closeSheets(); stopFollow(); }
});
addEventListener('keyup', (e) => keys.delete(e.code));
addEventListener('blur', () => { keys.clear(); pointers.clear(); });
function onTap(x, y) {
  if (ST.mg === 'pearls') return tapPearl(x, y);
  if (ST.mg === 'feed') return dropFood(x, y);
  const hit = pickCreature(x, y);
  if (hit) { startFollow(hit.g, hit.i); audio.tap(); } else if (cam.follow) stopFollow();
}

// ---------- effects: sparkles & floaters ----------
const SPARK_N = 160; const sparkGeo = new THREE.BufferGeometry(); const sparkPos = new Float32Array(SPARK_N * 3), sparkA = new Float32Array(SPARK_N); const sparkVel = [];
for (let i = 0; i < SPARK_N; i++) sparkVel.push(new THREE.Vector3());
sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3)); sparkGeo.setAttribute('aA', new THREE.BufferAttribute(sparkA, 1));
const sparks = new THREE.Points(sparkGeo, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: { uPR: prRef },
  vertexShader: `uniform float uPR; attribute float aA; varying float vA; void main(){ vA = aA; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(uPR * 180.0 * aA / max(-mv.z, 0.5), 0.0, 40.0); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); float s = smoothstep(0.5, 0.0, d) + smoothstep(0.06, 0.0, abs(c.x)) * smoothstep(0.5, 0.0, abs(c.y)) * 0.6 + smoothstep(0.06, 0.0, abs(c.y)) * smoothstep(0.5, 0.0, abs(c.x)) * 0.6; gl_FragColor = vec4(vec3(1.0, 0.95, 0.85) * s * vA, 1.0); }` }));
sparks.frustumCulled = false; scene.add(sparks); let sparkIdx = 0;
function burst(p, n = 14, gold = false) { for (let k = 0; k < n; k++) { const i = sparkIdx = (sparkIdx + 1) % SPARK_N; sparkPos.set([p.x, p.y, p.z], i * 3); sparkVel[i].set(Math.random() - 0.5, Math.random() - 0.3, Math.random() - 0.5).normalize().multiplyScalar(1.5 + Math.random() * 2.5); sparkA[i] = gold ? 1.4 : 1.0; } }
function floater(x, y, text, gold) { const el = document.createElement('div'); el.className = 'floater' + (gold ? ' gold' : ''); el.textContent = text; el.style.left = x + 'px'; el.style.top = y + 'px'; $('floaters').appendChild(el); setTimeout(() => el.remove(), 1200); }

// ---------- minigame: drifting pearls ----------
const PEARL_MAX = 26;
const pearlMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.15, metalness: 0.2, emissive: '#bfe6ff', emissiveIntensity: 0.8 });
const pearlMesh = new THREE.InstancedMesh(new THREE.SphereGeometry(0.3, 28, 18), pearlMat, PEARL_MAX); pearlMesh.count = 0; pearlMesh.frustumCulled = false; scene.add(pearlMesh);
const glowGeo = new THREE.BufferGeometry(); const glowPos = new Float32Array(PEARL_MAX * 3), glowA = new Float32Array(PEARL_MAX); glowGeo.setAttribute('position', new THREE.BufferAttribute(glowPos, 3)); glowGeo.setAttribute('aA', new THREE.BufferAttribute(glowA, 1));
const pearlGlow = new THREE.Points(glowGeo, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: { uPR: prRef },
  vertexShader: `uniform float uPR; attribute float aA; varying float vA; void main(){ vA = aA; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(uPR * 560.0 * abs(aA) / max(-mv.z, 0.5), 0.0, 220.0); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); float s = pow(smoothstep(0.5, 0.0, d), 2.0); vec3 c = vA < 0.0 ? vec3(1.0, 0.78, 0.35) : vec3(0.55, 0.85, 1.0); gl_FragColor = vec4(c * s * 0.38 * min(abs(vA), 1.0), 1.0); }` }));
pearlGlow.frustumCulled = false; scene.add(pearlGlow);
const pearls = []; const mgState = { time: 0, dur: 40, score: 0, spawn: 0, combo: 0, lastHit: 0, food: [], bites: 0, eatSfx: 0 };
const fwd = new THREE.Vector3(), rgt = new THREE.Vector3(), upv = new THREE.Vector3(), m4 = new THREE.Matrix4(), q0 = new THREE.Quaternion(), s1 = new THREE.Vector3();
function spawnPearl() {
  if (pearls.length >= PEARL_MAX) return;
  camera.getWorldDirection(fwd); rgt.crossVectors(fwd, camera.up).normalize(); upv.crossVectors(rgt, fwd).normalize();
  const depth = 8 + Math.random() * 6, halfH = depth * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)), halfW = halfH * camera.aspect;
  const p = camera.position.clone().addScaledVector(fwd, depth).addScaledVector(rgt, (Math.random() * 2 - 1) * halfW * 0.78).addScaledVector(upv, -halfH * 1.1);
  p.y = Math.max(p.y, sandHeight(p.x, p.z) + 0.6);
  const gold = Math.random() < 0.14; const speed = (gold ? 2.2 : 1.3) + Math.random() * 0.9;
  pearls.push({ p, gold, speed, life: (halfH * 2.4) / speed, age: 0, ph: Math.random() * 6.28, pop: 0 });
}
function tapPearl(x, y) {
  let best = -1, bd = 1e9; const s = { x: 0, y: 0, z: 0 };
  pearls.forEach((pl, i) => { if (pl.pop) return; toScreen(pl.p, s); const rad = Math.max(48, 0.6 / camera.position.distanceTo(pl.p) * innerHeight * 1.3); const d = Math.hypot(s.x - x, s.y - y); if (d < rad && d < bd) { bd = d; best = i; } });
  if (best < 0) { mgState.combo = 0; return; }
  const pl = pearls[best]; pl.pop = 0.001; const val = pl.gold ? 3 : 1; mgState.score += val;
  mgState.combo = (U.uTime.value - mgState.lastHit < 1.6) ? mgState.combo + 1 : 0; mgState.lastHit = U.uTime.value;
  audio.pearl(mgState.combo, pl.gold); burst(pl.p, pl.gold ? 22 : 12, pl.gold); floater(x, y, '+' + val, pl.gold); $('mgScore').textContent = mgState.score;
}

// ---------- minigame: feeding ----------
const FOOD_MAX = 140; const foodGeo = new THREE.BufferGeometry(); const foodPos = new Float32Array(FOOD_MAX * 3), foodA = new Float32Array(FOOD_MAX);
foodGeo.setAttribute('position', new THREE.BufferAttribute(foodPos, 3)); foodGeo.setAttribute('aA', new THREE.BufferAttribute(foodA, 1));
const foodPts = new THREE.Points(foodGeo, new THREE.ShaderMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, uniforms: { uPR: prRef },
  vertexShader: `uniform float uPR; attribute float aA; varying float vA; void main(){ vA = aA; vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = clamp(uPR * 220.0 / max(-mv.z, 0.5), 0.0, 44.0) * step(0.01, aA); gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c * vec2(1.0, 1.6)); float s = pow(smoothstep(0.5, 0.0, d), 1.6); gl_FragColor = vec4(vec3(0.75, 0.95, 1.0) * (0.7 + 1.3 * smoothstep(0.18, 0.0, d)) * s * vA, 1.0); }` }));
foodPts.frustumCulled = false; scene.add(foodPts);
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
function dropFood(x, y) {
  ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); ray.setFromCamera(ndc, camera);
  const d = THREE.MathUtils.clamp(camera.position.distanceTo(cam.target) * 0.8, 6, 18); const c = ray.ray.at(d, new THREE.Vector3());
  c.y = Math.max(c.y, sandHeight(c.x, c.z) + 2.5);
  for (let k = 0; k < 6 && mgState.food.length < FOOD_MAX; k++) mgState.food.push({ p: c.clone().add(new THREE.Vector3((Math.random() - 0.5) * 0.9, (Math.random() - 0.5) * 0.5, (Math.random() - 0.5) * 0.9)), v: 0.25 + Math.random() * 0.2, ph: Math.random() * 6, eaten: false, age: 0 });
  audio.drop(); burst(c, 5);
}
const sTmp = { x: 0, y: 0, z: 0 };
function onEat(f, g, i) {
  if (f.eaten) return; f.eaten = true; mgState.bites++; mgState.score++; $('mgScore').textContent = mgState.score;
  if (U.uTime.value - mgState.eatSfx > 0.12) { audio.eat(); mgState.eatSfx = U.uTime.value; toScreen(f.p, sTmp); if (sTmp.z < 1) floater(sTmp.x, sTmp.y, '+1'); }
  burst(f.p, 4);
}

function startMinigame(kind) {
  closeSheets(); stopFollow();
  ST.mg = kind; Object.assign(mgState, { time: 0, dur: kind === 'pearls' ? 40 : 35, score: 0, spawn: 0, combo: 0, food: [], bites: 0 });
  pearls.length = 0; $('mgScore').textContent = '0'; $('mgHud').classList.remove('hidden'); $('dock').classList.add('hidden'); $('hint').classList.add('hidden');
  cam.tTarget.set(0, kind === 'pearls' ? 6 : 5, 0); cam.tDist = kind === 'pearls' ? 17 : 20; cam.tPitch = kind === 'pearls' ? 0.05 : 0.18;
  audio.setGame(true); audio.tap();
  toast(t(kind === 'pearls' ? 'mg1' : 'mg2'), t(kind === 'pearls' ? 'mg1d' : 'mg2d'));
}
function endMinigame() {
  if (!ST.mg) return; const earned = mgState.score + 5; ST.mg = null;
  pearls.forEach(p => { if (!p.pop) p.pop = 0.001; });
  $('mgHud').classList.add('hidden'); audio.setGame(false); audio.finish();
  $('earnedN').textContent = '+' + earned; $('resultPanel').classList.remove('hidden'); $('resultPanel').dataset.earned = earned;
  $('toast').classList.add('hidden');
}
$('mgEnd').onclick = endMinigame;
function collect(thenShop) { const e = +($('resultPanel').dataset.earned || 0); $('resultPanel').dataset.earned = 0; save.pearls += e; save.plays = (save.plays || 0) + 1; persist(); setPearls(true); closeSheets(); $('dock').classList.remove('hidden'); audio.tap(); if (thenShop) openSheet('shopPanel'); cam.tTarget.set(0, 5.5, 0); cam.tDist = innerHeight > innerWidth ? 30 : 25; }
$('collectBtn').onclick = () => collect(false); $('toShopBtn').onclick = () => collect(true);

function updateMinigame(dt) {
  // pearls
  if (ST.mg === 'pearls') { mgState.spawn -= dt; if (mgState.spawn <= 0 && mgState.time < mgState.dur - 2) { spawnPearl(); if (Math.random() < 0.25) spawnPearl(); mgState.spawn = 0.45 + Math.random() * 0.5; } }
  let k = 0;
  for (let i = pearls.length - 1; i >= 0; i--) { const pl = pearls[i]; pl.age += dt; if (pl.pop) pl.pop += dt * 4; if (pl.age > pl.life || pl.pop > 1) pearls.splice(i, 1); }
  for (const pl of pearls) {
    pl.p.y += pl.speed * dt; pl.p.x += Math.sin(U.uTime.value * 1.3 + pl.ph) * 0.25 * dt;
    const sc = (pl.gold ? 1.25 : 1) * (pl.pop ? (1 + pl.pop * 0.8) * (1 - pl.pop) : Math.min(1, pl.age * 3));
    m4.compose(pl.p, q0, s1.setScalar(Math.max(0.001, sc))); pearlMesh.setMatrixAt(k, m4); pearlMesh.setColorAt(k, pl.gold ? new THREE.Color(1.8, 1.25, 0.45) : new THREE.Color(1, 1, 1));
    glowPos.set([pl.p.x, pl.p.y, pl.p.z], k * 3); glowA[k] = (pl.gold ? -1.3 : 1) * sc; k++;
  }
  pearlMesh.count = k; pearlMesh.instanceMatrix.needsUpdate = true; if (pearlMesh.instanceColor) pearlMesh.instanceColor.needsUpdate = true;
  for (let i = k; i < PEARL_MAX; i++) glowA[i] = 0; glowGeo.attributes.position.needsUpdate = true; glowGeo.attributes.aA.needsUpdate = true;
  // food
  const F = mgState.food; for (let i = F.length - 1; i >= 0; i--) { const f = F[i]; f.age += dt; f.p.y -= f.v * dt; f.p.x += Math.sin(U.uTime.value * 2 + f.ph) * 0.15 * dt; if (f.eaten || f.age > 22 || f.p.y < sandHeight(f.p.x, f.p.z) + 0.1) F.splice(i, 1); }
  for (let i = 0; i < FOOD_MAX; i++) { if (i < F.length) { foodPos.set([F[i].p.x, F[i].p.y, F[i].p.z], i * 3); foodA[i] = Math.min(1, F[i].age * 3) * (1 - Math.max(0, F[i].age - 20) / 2); } else foodA[i] = 0; }
  foodGeo.attributes.position.needsUpdate = true; foodGeo.attributes.aA.needsUpdate = true;
  if (ST.mg) {
    mgState.time += dt; const left = Math.max(0, mgState.dur - mgState.time); $('mgTime').textContent = Math.ceil(left);
    $('ringFg').style.strokeDashoffset = String(119.4 * (1 - left / mgState.dur));
    if (left <= 0) endMinigame();
  }
}

// ---------- start ----------
function startPlay() {
  if (ST.mode !== 'title') return;
  audio.start(); audio.setMuted(audio.muted);
  $('startScreen').classList.add('hidden'); ST.mode = 'play';
  $('dock').classList.remove('hidden'); $('hint').classList.remove('hidden'); setTimeout(() => $('hint').classList.add('hidden'), 9000);
  cam.tDist = innerHeight > innerWidth ? 30 : 24; cam.tPitch = 0.1;
}
$('startBtn').onclick = startPlay;

// ---------- adaptive quality ----------
let fpsAcc = 0, fpsN = 0, fpsT = 0;
function adapt(dt) {
  fpsAcc += dt; fpsN++; fpsT += dt; if (fpsT < 2.5) return; const fps = fpsN / fpsAcc; fpsAcc = fpsN = fpsT = 0; if (SHOT) return;
  if (fps < 40 && pixelRatio > 0.65) { pixelRatio = Math.max(0.65, pixelRatio - 0.15); resize(); }
  else if (fps < 28 && pixelRatio <= 0.65) { if (bloom.enabled) bloom.enabled = false; else U.uLowQ.value = 1; }
  else if (fps > 57 && pixelRatio < maxPR) { pixelRatio = Math.min(maxPR, pixelRatio + 0.1); resize(); }
}

// ---------- main loop ----------
const clock = new THREE.Clock(); const camPos = new THREE.Vector3(), tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
let camInit = false;
const ctx = { food: null, onEat, avoid: null };
function frame() {
  const dt = Math.min(clock.getDelta(), 0.05); adapt(dt);
  tick(dt);
  composer.render(dt);
  requestAnimationFrame(frame);
}
function tick(dt) {
  const time = (U.uTime.value += dt);
  grade.uniforms.time.value = time;
  ctx.food = ST.mg === 'feed' ? mgState.food : (mgState.food.length ? mgState.food : null); ctx.avoid = camera.position;
  for (const g of Object.values(groups)) { g.step(dt, ctx); g.sync(); }
  updateMinigame(dt);
  for (let i = growing.length - 1; i >= 0; i--) { const gr = growing[i]; gr.t += dt / 2.2; const e = 1 - Math.pow(1 - Math.min(1, gr.t), 3); gr.g.scale.setScalar(Math.max(0.01, e)); if (gr.t >= 1) growing.splice(i, 1); }
  if (clamGroup) { clamGroup.userData.hinge.rotation.x = -0.5 - Math.sin(time * 0.35) * 0.12; }
  poolT -= dt; if (poolT <= 0) { assignLights(); poolT = 0.5; }
  for (const l of pool) { l.intensity += ((l.userData.target || 0) * (0.85 + 0.15 * Math.sin(time * 1.3 + l.position.x)) - l.intensity) * Math.min(1, dt * 2); }
  // sparks
  for (let i = 0; i < SPARK_N; i++) { if (sparkA[i] <= 0) continue; sparkA[i] = Math.max(0, sparkA[i] - dt * 1.4); sparkPos[i * 3] += sparkVel[i].x * dt; sparkPos[i * 3 + 1] += sparkVel[i].y * dt; sparkPos[i * 3 + 2] += sparkVel[i].z * dt; sparkVel[i].multiplyScalar(1 - dt * 2.5); }
  sparkGeo.attributes.position.needsUpdate = true; sparkGeo.attributes.aA.needsUpdate = true;

  // camera
  cam.idle += dt;
  if (keys.has('ArrowLeft') || keys.has('KeyA')) { if (cam.follow) cam.fYaw += dt; else cam.tYaw += dt * 0.9; cam.idle = 0; }
  if (keys.has('ArrowRight') || keys.has('KeyD')) { if (cam.follow) cam.fYaw -= dt; else cam.tYaw -= dt * 0.9; cam.idle = 0; }
  if (keys.has('ArrowUp') || keys.has('KeyW')) { cam.tDist = Math.max(5, cam.tDist - dt * 10); cam.idle = 0; }
  if (keys.has('ArrowDown') || keys.has('KeyS')) { cam.tDist = Math.min(42, cam.tDist + dt * 10); cam.idle = 0; }
  if (ST.mode === 'title') cam.tYaw += dt * 0.04;
  else if (cam.idle > 5 && !cam.follow && !ST.mg) cam.tYaw += dt * 0.035;
  const k = Math.min(1, dt * 3);
  cam.yaw += (cam.tYaw - cam.yaw) * k; cam.pitch += (cam.tPitch - cam.pitch) * k; cam.dist += (cam.tDist - cam.dist) * Math.min(1, dt * 2);
  if (cam.follow) {
    const { g, i } = cam.follow; const fp = g.pos[i], fv = g.vel[i];
    const fd = (g.sp.len > 2 ? g.sp.len * 1.25 + 3 : Math.max(2.4, g.sp.len * 3.2 + 1.6)) * (cam.tDist / 24);
    cam.target.lerp(fp, Math.min(1, dt * 3));
    const heading = Math.atan2(fv.x, fv.z) + Math.PI + cam.fYaw;
    camPos.set(Math.sin(heading) * fd * Math.cos(cam.pitch), Math.sin(cam.pitch) * fd + fd * 0.15, Math.cos(heading) * fd * Math.cos(cam.pitch)).add(cam.target);
    camPos.y = Math.max(camPos.y, sandHeight(camPos.x, camPos.z) + 0.8);
    camera.position.lerp(camPos, Math.min(1, dt * 1.8));
  } else {
    cam.target.lerp(cam.tTarget, Math.min(1, dt * 1.2));
    camPos.set(Math.sin(cam.yaw) * Math.cos(cam.pitch) * cam.dist, Math.sin(cam.pitch) * cam.dist, Math.cos(cam.yaw) * Math.cos(cam.pitch) * cam.dist).add(cam.target);
    camPos.y += Math.sin(time * 0.4) * 0.15;
    camPos.y = THREE.MathUtils.clamp(camPos.y, sandHeight(camPos.x, camPos.z) + 1.0, 30);
    if (!camInit) { camera.position.copy(camPos); camInit = true; }
    camera.position.lerp(camPos, Math.min(1, dt * 2.2));
  }
  for (const o of E.obstacles) { const dx = camera.position.x - o.x, dy = camera.position.y - o.y, dz = camera.position.z - o.z, d = Math.hypot(dx, dy, dz), rr = o.r * 1.15 + 0.9; if (d < rr && d > 1e-3) camera.position.addScaledVector(tmp.set(dx, dy, dz), (rr - d) / d); }
  camera.position.y = Math.max(camera.position.y, sandHeight(camera.position.x, camera.position.z) + 0.7);
  camera.lookAt(cam.target);
  backdrop.position.copy(camera.position);
  camLight.position.copy(camera.position).add(tmp.set(0, 1.2, 0));
  tmp2.set(Math.sin(time * 0.23) * 2.4, 1.6 + Math.sin(time * 0.31) * 0.7, Math.cos(time * 0.19) * 2.4).add(cam.target);
  if (cam.follow) tmp2.add(tmp.set(Math.sin(time * 0.2) * 3.5, 2.6, Math.cos(time * 0.2) * 3.5).multiplyScalar(Math.max(1, cam.follow.g.sp.len * 0.35)));
  if (ST.mg === 'pearls') tmp2.copy(camera.position).lerp(cam.target, 0.35).add(tmp.set(0, 2.5, 0));
  orbPos.lerp(tmp2, Math.min(1, dt * 0.8)); orb.position.copy(orbPos); orbLight.intensity = 12 + Math.sin(time * 1.7) * 2; { const od = orbPos.distanceTo(camera.position); orbHalo.material.opacity = THREE.MathUtils.smoothstep(od, 2.5, 7); orb.children[0].visible = od > 1.2; }
  snow.material.uniforms.uCam.value.copy(camera.position);
}

// ---------- hooks for automated screenshots ----------
window.__bh = {
  start: startPlay, openShop: (tab) => { if (tab) { shopTab = tab; document.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x.dataset.tab === tab)); } openSheet('shopPanel'); }, openGames: () => openSheet('openGames' && 'gamesPanel'),
  mg: startMinigame, end: endMinigame, follow: (id, i = 0) => { if (groups[id]) startFollow(groups[id], i); },
  view: (yaw, pitch, dist, x, y, z) => { cam.yaw = cam.tYaw = yaw; cam.pitch = cam.tPitch = pitch; cam.dist = cam.tDist = dist; cam.target.set(x, y, z); cam.tTarget.set(x, y, z); camInit = false; cam.idle = -1e9; },
  tapAllPearls: () => { for (const pl of pearls) { const s = toScreen(pl.p, { x: 0, y: 0, z: 0 }); tapPearl(s.x, s.y); } },
  scene, renderer, composer, bloom, camera,
  dropAt: (x, y) => dropFood(x, y), ff: (sec) => { for (let i = 0; i < sec / 0.05; i++) tick(0.05); }, buy, groups, save, cam, pearls,
};

refreshTexts(); setPearls(false);
requestAnimationFrame(() => $('fade').classList.add('off'));
if (SHOT) document.body.classList.add('shot');
if (qs.has('auto')) { ST.mode = 'play'; $('startScreen').classList.add('hidden'); $('dock').classList.remove('hidden'); }
frame();
