// BLUE HAVEN r5 — encyclopedia, care & bonding, breeding, visiting events, theme sets / light / music,
// photo mode, visiting other aquariums, idle rewards & daily quests, sleep mode. © MOTOR AA (no ads, self-made audio)
import { SETS, SET_ORDER } from './sets.js?v=r5';
import { TRACKS } from './audio.js?v=r5';

const DAY = 86400000, HOUR = 3600000;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const dayKey = (d = new Date()) => d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
const hash = (s) => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0; return Math.abs(h); };

// ---------- encyclopedia data ----------
// behaviours (hidden until unlocked) and rare colour variants (1 golden · 2 aurora · 3 ghost)
const DEX = {
  lantern: { b: ['wave', 'swirl', 'flash'], v: [1, 2] }, hatchet: { b: ['flash', 'wave', 'swirl'], v: [3, 1] },
  angler: { b: ['lure', 'dash', 'glide'], v: [2, 3] }, eel: { b: ['bloom', 'glide', 'dash'], v: [1, 3] },
  jelly: { b: ['bloom', 'gather', 'rise'], v: [] }, comb: { b: ['bloom', 'gather', 'rise'], v: [] },
  dumbo: { b: ['rise', 'glide', 'dash'], v: [] }, manta: { b: ['glide', 'rise', 'circle'], v: [3, 2] },
  squid: { b: ['dash', 'bloom', 'circle'], v: [2, 1] }, whale: { b: ['song', 'glide', 'circle'], v: [3, 1] },
};
const NEED = [{ w: 15 }, { f: 3 }, { w: 120, f: 10 }]; // secret k unlocks at: watch seconds / feeds (3rd: either)
const VAR_COL = { 1: '#ffc860', 2: '#7affd8', 3: '#eef4ff' };
const BREEDS = (sp) => sp.kind === 'school' || sp.kind === 'swim';
const LIGHTS = { moon: null, teal: ['#3fb0b8', '#7ee0d8', '#9ff0e8'], violet: ['#7a6ad8', '#a890f0', '#c0a8ff'], amber: ['#b08a5a', '#f0c080', '#ffd0a0'], rose: ['#c07aa0', '#f0a0c8', '#ffc0dc'] };
const LIGHT_SW = { moon: '#86b0e6', teal: '#7ee0d8', violet: '#a890f0', amber: '#f0c080', rose: '#f0a0c8' };
const FILTERS = { none: '', vivid: 'saturate(1.45) contrast(1.08)', dream: 'brightness(1.08) saturate(1.25) blur(0.5px)', warm: 'sepia(0.4) saturate(1.35) hue-rotate(-12deg)', cool: 'hue-rotate(14deg) saturate(1.3) brightness(1.04)', mono: 'grayscale(1) contrast(1.15)', noir: 'grayscale(1) contrast(1.5) brightness(0.85)' };
// visiting events by local time & date
const EVENTS = ['pod', 'migr', 'meteor'];
function windows(id, d) {
  const wd = d.getDay(), m = d.getMonth() + 1, dd = d.getDate(), H = 60;
  if (id === 'pod') return [[12 * H, 12 * H + 20], [20 * H, 20 * H + 20]];
  if (id === 'migr') return [1, 3, 5].includes(wd) ? [[18 * H, 19 * H]] : wd === 0 ? [[9 * H, 10 * H]] : [];
  if (id === 'meteor') { if ((m === 8 && (dd === 12 || dd === 13)) || (m === 12 && (dd === 13 || dd === 14))) return [[20 * H, 24 * H]]; return wd === 6 || wd === 0 ? [[21 * H, 23 * H]] : []; }
  return [];
}
// daily quests
const QUESTS = { arcade2: [2, 20], play: [1, 15], feed3: [3, 15], pet10: [10, 15], watch60: [60, 15], photo1: [1, 20], visit1: [1, 20], heart1: [1, 20], pearls60: [60, 20], dex1: [1, 25], event1: [1, 25] };

export function initR5(H) {
  const { THREE, $, t } = H;
  const S = () => H.save;
  const ui = { photo: false, sleep: null, visit: null, pet: 0, care: null, petCap: {}, feedT: {} };
  const ctxLite = { threats: [], food: null, schoolC: null, avoid: null };
  const LANG = () => H.getLang();
  const fmtTime = (d) => d.toLocaleTimeString(LANG() === 'zh' ? 'zh-CN' : LANG(), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const fmtDay = (d) => d.toLocaleDateString(LANG() === 'zh' ? 'zh-CN' : LANG(), { weekday: 'short', month: 'short', day: 'numeric' });
  const sv = (k, def) => { const s = S(); if (s[k] === undefined || s[k] === null || typeof s[k] !== typeof def || Array.isArray(def) !== Array.isArray(s[k])) s[k] = def; return s[k]; };
  const stats = () => sv('stats', {});
  const save = (now) => H.persist(now);
  const world = () => ui.visit ? ui.visit.groups : H.groups;

  // ---------- light colour & music ----------
  const base = { h: H.hemi.color.clone(), m: H.moon.color.clone(), c: H.camLight.color.clone() };
  function applyLight(id) { const L = LIGHTS[id]; if (!L) { H.hemi.color.copy(base.h); H.moon.color.copy(base.m); H.camLight.color.copy(base.c); } else { H.hemi.color.set(L[0]); H.moon.color.set(L[1]); H.camLight.color.set(L[2]); } }
  function setLight(id) { S().light = id; applyLight(id); save(); renderShopExtra(); pubSoon(); }
  function setBgm(id) { S().bgm = id; if (!ui.sleep) H.audio.setTrack(id); save(); renderShopExtra(); if (!$('setPanel').classList.contains('hidden')) renderSettingsExtra(); }

  // ---------- theme sets ----------
  const setObj = {};
  function placeSet(id, animate) {
    if (setObj[id]) return; const g = SETS[id].build(); setObj[id] = g; H.scene.add(g);
    if (g.userData.light) { H.lightDefs.push(g.userData.light); H.assignLights(); }
    if (animate) H.grow(g);
  }
  function buySet(id) {
    const s = S(), owned = sv('sets', []); if (owned.includes(id)) return;
    if (s.pearls < SETS[id].cost) { H.toast('', t('needMore')); return; }
    s.pearls -= SETS[id].cost; owned.push(id); H.setPearls(true); placeSet(id, true); H.closeSheets(); H.audio.unlock();
    const g = setObj[id]; H.stopFollow(); Object.assign(H.cam, { home: false, tPitch: 0.25, idle: -6, tDist: g.userData.dist }); H.cam.tTarget.copy(g.userData.focus);
    H.toast(t('set_' + id), t('newDecor')); save(); pubSoon();
  }
  const SET_ART = {
    wreck: '<svg viewBox="0 0 96 64" class="art"><path d="M10 40l10 14h52l14-18z" fill="#4a3a30"/><path d="M20 54l4-10h46l-4 10z" fill="#3a2c26"/><path d="M44 40V8l22 16-22 6" fill="none" stroke="#6a5644" stroke-width="3"/><circle cx="30" cy="46" r="2.4" fill="#ffc27a"/><circle cx="50" cy="47" r="2.4" fill="#ffc27a"/><circle cx="74" cy="50" r="4" fill="#ffd070"/></svg>',
    ruins: '<svg viewBox="0 0 96 64" class="art"><rect x="10" y="54" width="76" height="6" fill="#4a5262"/>' + [16, 34, 52, 70].map((x, i) => `<rect x="${x}" y="${i === 2 ? 34 : 16}" width="9" height="${i === 2 ? 20 : 38}" fill="#6a7484"/><rect x="${x - 2}" y="48" width="13" height="2" fill="#5af0ff"/>`).join('') + '<rect x="12" y="12" width="34" height="5" fill="#5a6270"/></svg>',
    crystal: '<svg viewBox="0 0 96 64" class="art"><path d="M8 60c6-30 26-44 40-44s34 14 40 44z" fill="#2a2c3c"/>' + [[30, 22, '#b48aff'], [42, 30, '#5ae8ff'], [54, 18, '#ff8ad8'], [64, 28, '#b48aff']].map(([x, h, c]) => `<path d="M${x} 60v-${h}l5-6 5 6v${h}z" fill="${c}" opacity=".9"/>`).join('') + '</svg>',
  };
  function renderShopSets(grid) {
    const owned = sv('sets', []);
    for (const id of SET_ORDER) {
      const own = owned.includes(id), c = SETS[id].cost, el = document.createElement('div'); el.className = 'item' + (own ? ' owned' : '');
      el.innerHTML = `<span class="badge">${t('setBadge')}</span>${SET_ART[id]}<div class="nm">${t('set_' + id)}</div><div class="ct">${t('set_' + id + '_d')}</div>`;
      const b = document.createElement('button'); b.className = 'buy' + (own ? ' done' : S().pearls < c ? ' poor' : '');
      b.innerHTML = own ? `<svg viewBox="0 0 24 24" class="ic"><path d="M5 13l4 4L19 7"/></svg><span>${t('owned')}</span>` : `<span>${t('place')}</span>${H.PEARL_DOT}<b>${c}</b>`;
      if (!own) b.onclick = () => buySet(id); el.appendChild(b); grid.appendChild(el);
    }
  }
  function chips(box, list, cur, label, onPick, swatch) {
    box.innerHTML = ''; for (const id of list) { const b = document.createElement('button'); b.className = id === cur ? 'on' : ''; b.innerHTML = (swatch ? `<i class="sw" style="background:${swatch[id]}"></i>` : '') + esc(label(id)); b.onclick = () => { onPick(id); H.audio.tap(); }; box.appendChild(b); }
  }
  function renderShopExtra() {
    const ex = $('shopExtra'); if (!ex || ex.classList.contains('hidden')) return;
    ex.innerHTML = `<div class="setLbl">${t('lightColor')}</div><div id="lightChips" class="chips"></div><div class="setLbl">${t('bgm')}</div><div id="bgmChips" class="chips"></div><p class="note">${t('musicNote')}</p>`;
    chips($('lightChips'), Object.keys(LIGHTS), S().light || 'moon', (id) => t('lt_' + id), setLight, LIGHT_SW);
    chips($('bgmChips'), Object.keys(TRACKS), S().bgm || 'deep', (id) => t('bgm_' + id), setBgm);
  }
  function renderSettingsExtra() { const b = $('setBgm'); if (b) chips(b, Object.keys(TRACKS), S().bgm || 'deep', (id) => t('bgm_' + id), setBgm); }

  // ---------- tints, babies & breeding ----------
  const key = (id, i) => id + '_' + i;
  function applyTints() { const tn = sv('tint', {}); for (const [k, v] of Object.entries(tn)) { const j = k.lastIndexOf('_'), id = k.slice(0, j), i = +k.slice(j + 1), g = H.groups[id]; if (g && g.tint && i < g.n) g.tint[i] = v; } }
  const babyScale = (b) => clamp(0.35 + 0.65 * (Date.now() - b.b) / (12 * HOUR), 0.35, 1);
  const babyIdx = {}; // species -> group index of its baby
  function spawnBabies() {
    for (const b of sv('babies', [])) { if (babyIdx[b.s] !== undefined) continue; const g = H.ensureGroup(b.s); const i = g.add(false); if (i < 0) continue; babyIdx[b.s] = i; g.grow[i] = g.gmax[i] = babyScale(b); if (b.r) g.tint[i] = b.r; }
  }
  function breedCheck(silent) {
    const s = S(), st = stats(), now = Date.now(), babies = sv('babies', []);
    for (let k = babies.length - 1; k >= 0; k--) { // grown up => joins the family
      const b = babies[k], g = H.groups[b.s], i = babyIdx[b.s]; const sc = babyScale(b); if (g && i !== undefined) g.gmax[i] = sc;
      if (sc >= 1) { babies.splice(k, 1); delete babyIdx[b.s]; const sp = H.SPECIES[b.s]; s.counts[b.s] = Math.min(sp.max, (s.counts[b.s] || 0) + 1); if (b.r) sv('tint', {})[key(b.s, s.counts[b.s] - 1)] = b.r; if (!silent) H.toast(t('sp_' + b.s), t('babyGrown')); save(); }
    }
    const last = st.lb || now; const dh = (now - last) / HOUR; st.lb = now; if (dh <= 0) return;
    for (const id of H.SPECIES_ORDER) {
      const sp = H.SPECIES[id], n = s.counts[id] || 0; if (!BREEDS(sp) || n < 2 || babies.length >= 6 || babies.some((b) => b.s === id) || n + 1 > sp.max) continue;
      const p = 1 - Math.exp(-Math.min(dh, 48) / (sp.large ? 20 : 8)); if (Math.random() > p) continue;
      const vs = DEX[id].v, r = vs.length && Math.random() < 0.1 ? vs[Math.floor(Math.random() * vs.length)] : 0;
      const b = { s: id, b: now - (dh > 1 ? Math.random() * Math.min(dh, 11) * HOUR : 0), r }; babies.push(b); spawnBabies();
      if (r) { const d = dexOf(id); const vi = vs.indexOf(r); d.v |= 1 << vi; }
      if (!silent) { H.toast(t('babyBorn'), t('sp_' + id) + (r ? ' · ' + t('var_' + r) : '')); H.audio.chime(); }
      save(); break;
    }
  }
  function forceBaby(id) { stats().lb = Date.now() - 400 * HOUR; const sv0 = Math.random; let first = true; Math.random = () => (first ? (first = false, 0) : sv0()); try { breedCheck(false); } finally { Math.random = sv0; } }

  // ---------- encyclopedia ----------
  function dexOf(id) { const d = sv('dex', {}); if (!d[id] || typeof d[id] !== 'object') d[id] = { w: 0, f: 0, s: 0, v: 0 }; return d[id]; }
  function dexUnlocks(id, fromFish) {
    const d = dexOf(id), info = DEX[id]; let news = [];
    NEED.forEach((nd, k) => { if (d.s & (1 << k)) return; const ok = k < 2 ? ((nd.w && d.w >= nd.w) || (nd.f && d.f >= nd.f)) : (d.w >= nd.w || d.f >= nd.f); if (ok) { d.s |= 1 << k; news.push(t('bh_' + info.b[k])); } });
    info.v.forEach((v, k) => { if (d.v & (1 << k)) return; const ok = k === 0 ? d.w >= 60 : (d.f >= 15 || (d.f >= 5 && Math.random() < 0.1)); if (ok) { d.v |= 1 << k; news.push(t('var_' + v)); if (fromFish) { const g = H.groups[id]; if (g && g.tint) { g.tint[fromFish.i] = v; sv('tint', {})[key(id, fromFish.i)] = v; } } } });
    if (news.length) { H.toast(t('dexNew'), t('sp_' + id) + ' · ' + news.join(' · ')); H.audio.unlock(); q('dex1'); save(); }
  }
  function dexDone() { let n = 0, tot = 0; for (const id of H.SPECIES_ORDER) { const d = (S().dex || {})[id], info = DEX[id]; tot += 3 + info.v.length; if (d) { for (let k = 0; k < 3; k++) if (d.s & (1 << k)) n++; for (let k = 0; k < info.v.length; k++) if (d.v & (1 << k)) n++; } } return [n, tot]; }
  function renderDex() {
    const box = $('dexGrid'); box.innerHTML = ''; const [n, tot] = dexDone(); $('dexProg').textContent = `${n} / ${tot}`; $('dexBar').style.width = (100 * n / tot).toFixed(1) + '%';
    for (const id of H.SPECIES_ORDER) {
      const own = (S().counts[id] || 0) > 0, d = (S().dex || {})[id] || { w: 0, f: 0, s: 0, v: 0 }, info = DEX[id], c = document.createElement('div'); c.className = 'dcard' + (own ? '' : ' locked');
      let rows = info.b.map((b, k) => { const on = d.s & (1 << k), nd = NEED[k]; const hint = k < 2 ? (nd.w ? t('needWatch').replace('{n}', nd.w) : t('needFeed').replace('{n}', nd.f)) : t('needEither').replace('{w}', nd.w).replace('{f}', nd.f);
        return `<div class="drow${on ? ' on' : ''}"><span>${on ? '✦ ' + t('bh_' + b) : '？ ' + hint}</span>${on && own ? `<button class="mini" data-show="${id}:${b}">${t('showMe')}</button>` : ''}</div>`; }).join('');
      const vars = info.v.length ? `<div class="dvars">${info.v.map((v, k) => `<span class="vchip${d.v & (1 << k) ? ' on' : ''}"><i style="background:${d.v & (1 << k) ? VAR_COL[v] : 'transparent'}"></i>${d.v & (1 << k) ? t('var_' + v) : '？'}</span>`).join('')}</div>` : '';
      c.innerHTML = `<div class="dtop">${H.ART[id]}<div><b>${own ? t('sp_' + id) : '???'}</b><div class="dstat">${own ? `${t('watched')} ${Math.floor(d.w / 60)}:${String(Math.floor(d.w % 60)).padStart(2, '0')} · ${t('fed')} ${d.f}` : t('dexLocked')}</div></div></div>${own ? `<p class="dfact">${t('dx_' + id)}</p>` : ''}${rows}${vars}`;
      box.appendChild(c);
    }
    box.querySelectorAll('[data-show]').forEach((b) => b.onclick = () => { const [id, bh] = b.dataset.show.split(':'); H.closeSheets(); showBehaviour(id, bh); });
  }
  const nudges = [];
  function showBehaviour(id, bh) {
    const g = H.groups[id]; if (!g || !g.n) return; const i = Math.floor(Math.random() * Math.min(g.n, (S().counts[id] || g.n))); H.startFollow(g, i);
    const T = H.cam.target, U = H.U;
    if (bh === 'wave' && g.newHeading) g.newHeading(true);
    else if (bh === 'swirl' && g.setMode) g.setMode('ball');
    else if (bh === 'flash' && g.scare) g.scare(g.pos[i], 1.2);
    else if (bh === 'dash' && g.burst) for (let k = 0; k < g.n; k++) g.burst[k] = 1;
    else if (bh === 'glide' && g.glide) for (let k = 0; k < g.n; k++) { g.glide[k] = 1; g.glideT[k] = 4; }
    else if (bh === 'song') H.audio.song();
    else if (bh === 'lure' || bh === 'bloom') { const g0 = U.uGlowStr.value; let tt = 0; nudges.push({ dur: 3.2, f: (dt) => { tt += dt; U.uGlowStr.value = g0 * (1 + 0.9 * Math.sin(Math.min(1, tt / 3.2) * Math.PI)); }, end: () => { U.uGlowStr.value = g0; } }); }
    else if (bh === 'gather' || bh === 'rise' || bh === 'circle') {
      const c = T.clone(); let tt = 0; nudges.push({ dur: 6, f: (dt) => { tt += dt; for (let k = 0; k < g.n; k++) { const p = g.pos[k]; let tx, ty, tz; if (bh === 'rise') { tx = p.x; ty = p.y + 1; tz = p.z; } else if (bh === 'gather') { tx = c.x; ty = c.y; tz = c.z; } else { const a = tt * 0.8 + k * 2.1; tx = c.x + Math.cos(a) * 5; ty = c.y + 1; tz = c.z + Math.sin(a) * 5; }
        if (g.tgt) { g.tgt[k].set(tx, ty, tz); g.tgtT[k] = 1; } else { const s = Math.min(1, dt * 0.5); const dx = (tx - p.x) * s, dy = (ty - p.y) * s, dz = (tz - p.z) * s; if (g.shift) g.shift(k, dx, dy, dz); else p.set(p.x + dx, p.y + dy, p.z + dz); } } } });
    }
    H.audio.chime(); H.toast(t('bh_' + bh), t('sp_' + id));
  }

  // ---------- care & bonding ----------
  const bondOf = (id, i) => (S().bond || {})[key(id, i)] || 0;
  const isBaby = (id, i) => babyIdx[id] === i;
  const nameOf = (id, i) => (S().names || {})[key(id, i)] || '';
  function addBond(id, i, n) { if (isBaby(id, i) || ui.visit) return; const b = sv('bond', {}), k = key(id, i), was = b[k] || 0; b[k] = clamp(was + n, 0, 100); if (was < 60 && b[k] >= 60) { H.toast(t('bonded'), (nameOf(id, i) || t('sp_' + id)) + ' · ' + t('bondedHint')); H.audio.unlock(); } renderCare(); save(); }
  function bondLabel(v) { return v >= 100 ? t('bond4') : v >= 60 ? t('bond3') : v >= 20 ? t('bond2') : t('bond1'); }
  function renderCare() {
    const c = ui.care, el = $('care'); if (!c) { el.classList.add('hidden'); document.body.classList.remove('caring'); return; }
    const { g, i } = c, id = g.id, v = bondOf(id, i), baby = isBaby(id, i);
    el.classList.remove('hidden'); document.body.classList.add('caring');
    $('careName').textContent = (nameOf(id, i) || t('sp_' + id)) + (baby ? ' · ' + t('baby') : '');
    $('careBond').textContent = baby ? t('babyNote') : bondLabel(v) + ' · ' + v + '/100'; $('careBar').style.width = (baby ? 0 : v) + '%';
    $('careNameBtn').classList.toggle('hidden', baby || !!ui.visit); $('careFeed').classList.toggle('hidden', !!ui.visit); $('carePet').classList.toggle('hidden', !!ui.visit);
  }
  function feedCare() {
    const c = ui.care; if (!c) return; const { g, i } = c, id = g.id, k = key(id, i), now = performance.now();
    if (ui.feedT[k] && now - ui.feedT[k] < 20000) { H.toast('', t('fullTummy')); return; } ui.feedT[k] = now;
    H.burst(g.pos[i], 10); H.audio.eat(); const s = H.toScreen(g.pos[i], { x: 0, y: 0, z: 0 }); if (s.z < 1) H.floater(s.x, s.y - 30, '♥ +6', true);
    const d = dexOf(id); d.f++; addBond(id, i, 6); q('feed3'); dexUnlocks(id, { i }); save();
  }
  function petTick(x, y) {
    const c = ui.care; if (!c) return; const { g, i } = c, id = g.id, k = key(id, i); ui.petCap[k] = (ui.petCap[k] || 0) + 1; H.audio.tone(76 + (ui.petCap[k] % 5) * 2, 0.04, 0.3);
    H.floater(x, y - 20, '♥', false); q('pet10'); if (ui.petCap[k] <= 25) addBond(id, i, 1); else renderCare();
  }
  function nameCare() { const c = ui.care; if (!c) return; $('nameInput').value = nameOf(c.g.id, c.i); $('nameFor').textContent = t('sp_' + c.g.id); H.openSheet('namePanel'); setTimeout(() => $('nameInput').focus(), 200); }
  function saveName() { const c = ui.care; if (!c) return; const v = $('nameInput').value.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 16); const nm = sv('names', {}), k = key(c.g.id, c.i); if (v) nm[k] = v; else delete nm[k]; H.closeSheets(); renderCare(); H.refreshFollow(); save(); }
  function callBonded(p) {
    let n = 0; for (const [k, v] of Object.entries(S().bond || {})) { if (v < 60) continue; const j = k.lastIndexOf('_'), id = k.slice(0, j), i = +k.slice(j + 1), g = H.groups[id]; if (!g || i >= g.n) continue; if (!g.call || g.call.p.distanceTo(p) > 0.01) g.call = { p: p.clone(), t: 9, who: new Set() }; g.call.who.add(i); g.call.t = 9; n++; if (n >= 12) break; }
    return n;
  }

  // ---------- visiting events ----------
  const evObj = {}; let evTimer = 0;
  function liveEvents(now = new Date()) {
    const force = H.LOCAL && H.qs.get('ev'); const mins = now.getHours() * 60 + now.getMinutes(); const out = [];
    for (const id of EVENTS) { if (force === id) { out.push({ id, s: null, e: null }); continue; } for (const [a, b] of windows(id, now)) if (mins >= a && mins < b) out.push({ id, s: a, e: b }); }
    return out;
  }
  function upcoming(n = 8) {
    const now = new Date(), list = [];
    for (let k = 0; k < 9; k++) { const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + k); for (const id of EVENTS) for (const [a, b] of windows(id, d)) { const s = new Date(d.getTime() + a * 60000), e = new Date(d.getTime() + b * 60000); if (e > now) list.push({ id, s, e }); } }
    return list.sort((x, y) => x.s - y.s).slice(0, n);
  }
  function makeEvent(id) {
    if (id === 'pod') { const g = H.makeGroup('whale', 3, 77); for (let k = 0; k < 3; k++) g.add(true); H.scene.add(g.mesh); return { g, song: 3 }; }
    if (id === 'migr') { const g = H.makeGroup('jelly', 18, 9); g.col.set('#ff6ab8'); g.glowC.set('#ffd28a').multiplyScalar(1.3); g.ribbons.material.uniforms.uCol.value.set('#e05aa8'); g.ribbons.material.uniforms.uGlow.value.set('#ffd28a'); for (let k = 0; k < 18; k++) g.add(true); H.scene.add(g.mesh); return { g }; }
    if (id === 'meteor') {
      const N = 40, pos = new Float32Array(N * 6), col = new Float32Array(N * 6), geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      const m = new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); m.frustumCulled = false; H.scene.add(m); const hd = new THREE.Points(geo, new THREE.PointsMaterial({ size: 1.1, map: glowDot(), alphaTest: 0.01, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })); hd.frustumCulled = false; m.add(hd);
      const st = Array.from({ length: N }, () => ({ life: 0, p: new THREE.Vector3(), v: new THREE.Vector3() })); return { m, st, geo, pos, col, spawn: 0 };
    }
  }
  let _dot = null; function glowDot() { if (_dot) return _dot; const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.25, 'rgba(255,240,200,0.8)'); gr.addColorStop(1, 'rgba(255,220,160,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); _dot = new THREE.CanvasTexture(c); return _dot; }
  function killEvent(id) { const o = evObj[id]; if (!o) return; if (o.g) { H.scene.remove(o.g.mesh); o.g.mesh.traverse((x) => { if (x.geometry) x.geometry.dispose(); }); } if (o.m) { H.scene.remove(o.m); o.geo.dispose(); o.m.traverse((x) => { if (x.material) x.material.dispose(); }); } delete evObj[id]; }
  function eventsTick(dt, time) {
    evTimer -= dt; if (evTimer <= 0) { evTimer = 2; const live = liveEvents().map((e) => e.id);
      for (const id of EVENTS) { if (live.includes(id) && !evObj[id] && !ui.visit) { evObj[id] = makeEvent(id); onEventSeen(id); } else if ((!live.includes(id) || ui.visit) && evObj[id]) killEvent(id); }
      renderBanner(); }
    const cp = H.camera;
    const pod = evObj.pod; if (pod) { const g = pod.g; for (let k = 0; k < g.n; k++) { const p = g.pos[k], a = Math.atan2(p.z, p.x) + 0.45; g.tgt[k].set(Math.cos(a) * 22, 14.5 + k * 1.3, Math.sin(a) * 22); g.tgtT[k] = 5; } g.step(dt, ctxLite); g.sync(cp);
      if (ui.watch === 'pod' && !H.cam.home && !H.cam.follow) { const c = new THREE.Vector3(); for (let k = 0; k < g.n; k++) c.add(g.pos[k]); c.multiplyScalar(1 / g.n); H.cam.tTarget.lerp(c, Math.min(1, dt * 2)); H.cam.tDist = 26; }
      pod.song -= dt; if (pod.song <= 0) { pod.song = 14 + Math.random() * 10; if (H.audio.ctx) H.audio.whale(H.audio.ctx.currentTime, 1.6); } }
    const mg = evObj.migr; if (mg) { const g = mg.g; g.step(dt, ctxLite); for (let k = 0; k < g.n; k++) { const p = g.pos[k], w = 0.07; g.shift(k, -p.z * w * dt, 0, p.x * w * dt); } g.sync(cp); }
    const me = evObj.meteor; if (me) {
      me.spawn -= dt; for (const s of me.st) { if (s.life > 0 || me.spawn > 0) continue; const a = Math.random() * 6.28, r = 10 + Math.random() * 26; s.p.set(Math.cos(a) * r, 30 + Math.random() * 6, Math.sin(a) * r); { const d = Math.random() * 6.28, sp = 9 + Math.random() * 6; s.v.set(Math.cos(d) * sp, -10 - Math.random() * 6, Math.sin(d) * sp); } s.life = 1; me.spawn = 0.12 + Math.random() * 0.3; }
      me.st.forEach((s, k) => { if (s.life > 0) { s.life -= dt * 0.75; s.p.addScaledVector(s.v, dt); } const a = Math.max(0, s.life), o = k * 6; me.pos.set([s.p.x, s.p.y, s.p.z, s.p.x - s.v.x * 0.45, s.p.y - s.v.y * 0.45, s.p.z - s.v.z * 0.45], o); me.col.set([1.0 * a, 0.95 * a, 0.8 * a, 0, 0, 0], o); });
      me.geo.attributes.position.needsUpdate = true; me.geo.attributes.color.needsUpdate = true;
    }
  }
  function onEventSeen(id) {
    if (H.ST.mode !== 'play') { ui.evPending = id; return; }
    const st = stats(), dk = dayKey(); if (!st.ev || st.ev.d !== dk) st.ev = { d: dk, s: [] };
    if (!st.ev.s.includes(id)) { st.ev.s.push(id); S().pearls += 15; H.setPearls(true); q('event1'); H.toast(t('ev_' + id), t('evArrived') + ' +15'); H.audio.chime(); save(); }
  }
  function renderBanner() {
    const live = liveEvents(), b = $('evBanner'); $('railEv').classList.toggle('dot', live.length > 0);
    if (!live.length || ui.photo || ui.sleep || ui.visit || H.ST.mode !== 'play' || H.ST.mg) { b.classList.add('hidden'); return; }
    const e = live[0]; b.classList.remove('hidden');
    $('evText').textContent = t('ev_' + e.id) + (e.s !== null ? ` · ${t('evUntil')} ${String(Math.floor(e.e / 60) % 24).padStart(2, '0')}:${String(e.e % 60).padStart(2, '0')}` : '');
    $('evWatch').onclick = () => watchEvent(e.id);
  }
  function watchEvent(id) { H.closeSheets(); H.stopFollow(); const c = H.cam; c.home = false; c.idle = -20; ui.watch = id; if (id === 'pod') { c.tTarget.set(0, 13, 0); c.tDist = 30; c.tPitch = -0.12; } else if (id === 'migr') { c.tTarget.set(0, 9, 0); c.tDist = 24; c.tPitch = 0.05; } else { c.tTarget.set(0, 16, 0); c.tDist = 22; c.tPitch = -0.15; } }
  function renderEvents() {
    const live = liveEvents(), box = $('evList'); box.innerHTML = '';
    if (live.length) box.insertAdjacentHTML('beforeend', live.map((e) => `<div class="evRow live"><i class="evIc ${e.id}"></i><div><b>${t('ev_' + e.id)}</b><p>${t('ev_' + e.id + '_d')}</p></div><button class="mini" data-ev="${e.id}">${t('evWatchBtn')}</button></div>`).join(''));
    box.insertAdjacentHTML('beforeend', `<div class="setLbl">${t('evNext')}</div>` + upcoming(8).map((e) => `<div class="evRow"><i class="evIc ${e.id}"></i><div><b>${t('ev_' + e.id)}</b><p>${fmtDay(e.s)} · ${fmtTime(e.s)}–${fmtTime(e.e)}</p></div></div>`).join(''));
    box.insertAdjacentHTML('beforeend', `<p class="note">${t('evNote')}</p>`);
    box.querySelectorAll('[data-ev]').forEach((b) => b.onclick = () => watchEvent(b.dataset.ev));
  }

  // ---------- daily quests & idle rewards ----------
  function quests() {
    const dk = dayKey(); let Q = S().quests;
    if (!Q || Q.day !== dk || !Array.isArray(Q.l)) {
      const pool = Object.keys(QUESTS), h = hash(dk), pick = []; let k = h;
      while (pick.length < 3) { const id = pool[k % pool.length]; if (!pick.includes(id)) pick.push(id); k = Math.floor(k / 3) + 7 + pick.length * 13; }
      const game = ['bubble', 'run', 'memory', 'escape'][h % 4];
      Q = S().quests = { day: dk, l: pick.map((id) => ({ id, n: 0, c: 0, g: id === 'play' ? game : '' })), all: 0 };
    }
    return Q;
  }
  function q(id, n = 1, game) {
    const Q = quests(); let ch = false;
    for (const it of Q.l) { if (it.id !== id || it.c) continue; if (id === 'play' && game !== it.g) continue; const goal = QUESTS[id][0]; if (it.n < goal) { it.n = Math.min(goal, it.n + n); ch = true; if (it.n >= goal) { H.toast(t('questDone'), questText(it)); H.audio.chime(); } } }
    if (ch) { save(); renderQuestDot(); if (!$('questPanel').classList.contains('hidden')) renderQuests(); }
  }
  const questText = (it) => t('q_' + it.id).replace('{g}', it.g ? t('ga_' + it.g) : '').replace('{n}', QUESTS[it.id][0]);
  function renderQuestDot() { const Q = quests(); $('railQuest').classList.toggle('dot', Q.l.some((it) => !it.c && it.n >= QUESTS[it.id][0]) || (!Q.all && Q.l.every((it) => it.c))); }
  function renderQuests() {
    const Q = quests(), box = $('questList'); box.innerHTML = '';
    for (const it of Q.l) {
      const [goal, rw] = QUESTS[it.id], done = it.n >= goal, row = document.createElement('div'); row.className = 'qrow' + (it.c ? ' claimed' : done ? ' done' : '');
      row.innerHTML = `<div class="qtxt"><b>${esc(questText(it))}</b><div class="qbar"><i style="width:${100 * Math.min(1, it.n / goal)}%"></i></div><span>${Math.min(it.n, goal)} / ${goal}</span></div>`;
      const b = document.createElement('button'); b.className = 'cta small' + (done && !it.c ? '' : ' ghost'); b.disabled = !done || !!it.c;
      b.innerHTML = it.c ? `<svg viewBox="0 0 24 24" class="ic"><path d="M5 13l4 4L19 7"/></svg>` : `${H.PEARL_DOT}<b>+${rw}</b>`;
      b.onclick = () => { if (!done || it.c) return; it.c = 1; S().pearls += rw; H.setPearls(true); H.audio.pearl(3, true); save(); renderQuests(); renderQuestDot(); };
      row.appendChild(b); box.appendChild(row);
    }
    const allDone = Q.l.every((it) => it.c), ab = document.createElement('button'); ab.className = 'cta' + (allDone && !Q.all ? '' : ' ghost'); ab.disabled = !allDone || !!Q.all;
    ab.innerHTML = `<span>${Q.all ? t('allClaimed') : t('allBonus')}</span>${Q.all ? '' : H.PEARL_DOT + '<b>+30</b>'}`; ab.onclick = () => { if (!allDone || Q.all) return; Q.all = 1; S().pearls += 30; H.setPearls(true); H.audio.unlock(); save(); renderQuests(); renderQuestDot(); };
    box.appendChild(ab);
    const rate = idleRate(); $('idleInfo').textContent = t('idleInfo').replace('{r}', rate).replace('{c}', IDLE_CAP_H);
  }
  const IDLE_CAP_H = 8;
  function idleRate() { let n = 0; for (const v of Object.values(S().counts || {})) n += v; return Math.min(30, 6 + Math.floor(n / 12) + (S().sets || []).length * 2); }
  async function claimIdle(raw) {
    if (!raw || H.DEMO) return; let r = null; try { r = await H.net.claimIdle(raw.idleAt); } catch (e) { console.warn('[idle]', e.code || e.message); }
    if (!r || r.first) return; const mins = r.ms / 60000; if (mins < 10) return;
    const hrs = Math.min(IDLE_CAP_H, mins / 60), n = Math.max(1, Math.floor(hrs * idleRate()));
    ui.idle = { n, hrs: mins / 60 }; showIdle();
  }
  function showIdle() {
    const I = ui.idle; if (!I) return; if (H.ST.mode !== 'play') { ui.idleWait = true; return; }
    const h = Math.floor(I.hrs), m = Math.floor((I.hrs - h) * 60);
    $('idleAway').textContent = t('idleAway').replace('{t}', (h ? h + t('hShort') + ' ' : '') + m + t('mShort')); $('idleN').textContent = '+' + I.n; $('idleCap').classList.toggle('hidden', I.hrs < IDLE_CAP_H);
    H.closeSheets(); $('idlePanel').classList.remove('hidden');
  }
  $('idleClaim').onclick = () => { const I = ui.idle; if (!I) return; ui.idle = null; S().pearls += I.n; H.setPearls(true); H.audio.pearl(4, true); $('idlePanel').classList.add('hidden'); save(); };

  // ---------- photo mode ----------
  let filter = 'none', lastShot = null;
  function enterPhoto() {
    H.closeSheets(); ui.photo = true; document.body.classList.add('photo'); $('photoUI').classList.remove('hidden'); H.cam.idle = -1e9; H.cam.home = false;
    $('camUp').value = H.cam.tTarget.y.toFixed(1);
    renderFilters(); $('photoPrev').classList.add('hidden'); renderBanner();
  }
  function renderFilters() { const box = $('filterChips'); chips(box, Object.keys(FILTERS), filter, (id) => t('fx_' + id), (id) => { filter = id; H.canvas.style.filter = FILTERS[id]; renderFilters(); }); }
  function exitPhoto() { ui.photo = false; document.body.classList.remove('photo'); $('photoUI').classList.add('hidden'); H.canvas.style.filter = ''; H.cam.idle = 0; H.cam.home = true; H.cam.tDist = H.homeD(); renderBanner(); }
  function shoot() {
    H.renderNow(); const src = H.renderer.domElement, w = src.width, h = src.height, c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
    if (FILTERS[filter]) g.filter = FILTERS[filter]; g.drawImage(src, 0, 0); g.filter = 'none';
    const fs = Math.round(h * 0.022); g.font = `600 ${fs}px system-ui, sans-serif`; g.fillStyle = 'rgba(255,255,255,0.75)'; g.textAlign = 'right'; g.shadowColor = 'rgba(0,20,40,0.6)'; g.shadowBlur = fs * 0.6; g.fillText('BLUE HAVEN · MOTOR AA', w - fs, h - fs);
    H.audio.shutter(); const fl = $('flash'); fl.classList.remove('go'); void fl.offsetWidth; fl.classList.add('go');
    c.toBlob((blob) => { if (!blob) return; lastShot = blob; const url = URL.createObjectURL(blob); $('photoImg').src = url; $('photoPrev').classList.remove('hidden'); $('photoShare').classList.toggle('hidden', !(navigator.canShare && navigator.canShare({ files: [new File([blob], 'x.png', { type: 'image/png' })] }))); }, 'image/png');
    stats().photos = (stats().photos || 0) + 1; q('photo1');
  }
  const shotName = () => 'bluehaven-' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-') + '.png';
  $('photoSave').onclick = () => { if (!lastShot) return; const a = document.createElement('a'); a.href = URL.createObjectURL(lastShot); a.download = shotName(); document.body.appendChild(a); a.click(); a.remove(); H.toast('', t('photoSaved')); };
  $('photoShare').onclick = async () => { if (!lastShot) return; try { await navigator.share({ files: [new File([lastShot], shotName(), { type: 'image/png' })], title: 'BLUE HAVEN', text: t('shareText') }); } catch (e) {} };
  $('photoClosePrev').onclick = () => $('photoPrev').classList.add('hidden');
  $('shutter').onclick = shoot; $('photoExit').onclick = exitPhoto;
  $('camUp').oninput = (e) => { H.cam.tTarget.y = +e.target.value; };

  // ---------- sleep mode ----------
  function enterSleep() {
    H.closeSheets(); H.stopFollow(); ui.sleep = { left: 30 * 60, total: 30 * 60, fade: 0, idleUI: 0, frame: 0, exp: H.renderer.toneMappingExposure, glow: H.U.uGlowStr.value };
    document.body.classList.add('sleep'); $('sleepUI').classList.remove('hidden'); H.audio.setTrack('lullaby'); H.cam.home = true; H.cam.tPitch = 0.16; H.cam.tDist = H.homeD() * 1.25; renderSleep(); renderBanner();
  }
  function renderSleep() { const s = ui.sleep; if (!s) return; chips($('sleepChips'), ['15', '30', '60', 'inf'], s.total === Infinity ? 'inf' : String(s.total / 60), (k) => k === 'inf' ? t('sleepInf') : k + t('mShort'), (k) => { s.total = s.left = k === 'inf' ? Infinity : +k * 60; s.fade = 0; renderSleep(); }); updSleepTime(); }
  function updSleepTime() { const s = ui.sleep; if (!s) return; $('sleepTime').textContent = s.left === Infinity ? '∞' : `${Math.floor(s.left / 60)}:${String(Math.floor(s.left % 60)).padStart(2, '0')}`; }
  function exitSleep() { const s = ui.sleep; if (!s) return; ui.sleep = null; document.body.classList.remove('sleep', 'sleepDeep'); $('sleepUI').classList.add('hidden'); H.renderer.toneMappingExposure = s.exp; H.U.uGlowStr.value = s.glow; $('sleepDim').style.opacity = ''; H.audio.setVolume(1); H.audio.setTrack(S().bgm || 'deep'); H.setPaused(false); H.cam.tDist = H.homeD(); renderBanner(); }
  function sleepTick(dt) {
    const s = ui.sleep; if (!s) return; H.cam.tYaw += dt * 0.025; s.idleUI += dt; document.body.classList.toggle('sleepDeep', s.idleUI > 6);
    const tgtE = s.exp * 0.72; H.renderer.toneMappingExposure += (tgtE - H.renderer.toneMappingExposure) * Math.min(1, dt);
    if (s.left !== Infinity) { s.left -= dt; if (s.left <= 0) { s.left = 0; s.fade = Math.min(1, s.fade + dt / 60); H.audio.setVolume(1 - s.fade); $('sleepDim').style.opacity = String(0.45 + 0.55 * s.fade); if (s.fade >= 1) { H.setPaused(true); } } }
    if ((s.frame = (s.frame + 1) % 15) === 0) updSleepTime();
  }
  function sleepWake() { const s = ui.sleep; if (!s) return; s.idleUI = 0; document.body.classList.remove('sleepDeep'); if (s.fade >= 1 || s.left <= 0) { s.left = s.total === Infinity ? Infinity : 5 * 60; s.fade = 0; H.audio.setVolume(1); $('sleepDim').style.opacity = ''; H.setPaused(false); } }
  $('sleepUI').addEventListener('pointerdown', (e) => { if (e.target.closest('button')) return; sleepWake(); });
  $('sleepExit').onclick = exitSleep;

  // ---------- public aquarium, friends & visits ----------
  const CODE_AB = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  function myCode() { const s = S(); if (typeof s.code !== 'string' || s.code.length < 6) { let c = ''; const a = crypto.getRandomValues(new Uint8Array(8)); for (const x of a) c += CODE_AB[x % CODE_AB.length]; s.code = c; save(); } return s.code; }
  function myNick() { const s = S(); if (typeof s.nick !== 'string' || !s.nick) s.nick = t('diver') + ' ' + myCode().slice(0, 4); return s.nick; }
  function snapshot() {
    const s = S(), counts = {}; for (const [k, v] of Object.entries(s.counts || {})) if (v > 0) counts[k] = v;
    const decor = {}; for (const k of Object.keys(s.decor || {})) if (s.decor[k]) decor[k] = 1;
    const tint = {}; for (const [k, v] of Object.entries(s.tint || {})) tint[k] = v;
    return { nick: myNick(), counts, decor, code: myCode(), sets: (s.sets || []).slice(0, 10), light: s.light || 'moon', tint };
  }
  function pubSoon() { if (S().isPublic && !H.DEMO) H.net.publish(snapshot()); }
  async function setPublic(on) {
    const s = S(); s.isPublic = !!on; save(true);
    try { if (on) await H.net.publishNow(snapshot()); else await H.net.unpublish(); H.toast('', t(on ? 'pubOn' : 'pubOff')); } catch (e) { console.warn('[public]', e.code || e.message); H.toast('', t('netErr')); }
    renderVisit();
  }
  async function renderVisit() {
    const s = S(); myCode(); myNick();
    $('myCode').textContent = s.code; $('nickInput').value = s.nick; $('pubToggle').classList.toggle('on', !!s.isPublic); $('pubToggle').setAttribute('aria-checked', s.isPublic ? 'true' : 'false');
    $('pubState').textContent = t(s.isPublic ? 'pubStateOn' : 'pubStateOff');
    const fl = $('friendList'); const fr = sv('friends', []); fl.innerHTML = fr.length ? '' : `<p class="note">${t('noFriends')}</p>`;
    fr.forEach((f, k) => { const r = document.createElement('div'); r.className = 'frow'; r.innerHTML = `<div class="avatar sm">${esc((f.n || '?')[0].toUpperCase())}</div><div class="ftxt"><b>${esc(f.n || '?')}</b><span>${esc(f.c)}</span></div>`;
      const v = document.createElement('button'); v.className = 'cta small'; v.innerHTML = `<span>${t('visit')}</span>`; v.onclick = () => visitCode(f.c);
      const x = document.createElement('button'); x.className = 'mini close'; x.setAttribute('aria-label', t('remove')); x.innerHTML = '<svg viewBox="0 0 24 24" class="ic"><path d="M6 6l12 12M18 6L6 18"/></svg>'; x.onclick = () => { fr.splice(k, 1); save(); renderVisit(); };
      r.append(v, x); fl.appendChild(r); });
    if (s.isPublic && H.net.myUid()) { const n = await H.net.heartCount(H.net.myUid()); $('myHearts').textContent = n === null ? '' : '♥ ' + n; } else $('myHearts').textContent = '';
  }
  async function addFriend(code) {
    code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 12); if (code.length < 6) { H.toast('', t('codeBad')); return; }
    if (code === myCode()) { H.toast('', t('codeSelf')); return; }
    const fr = sv('friends', []); if (fr.some((f) => f.c === code)) { H.toast('', t('friendAlready')); return; }
    let r = null; try { r = await H.net.findByCode(code); } catch (e) { H.toast('', t('netErr')); return; }
    if (!r) { H.toast('', t('codeNotFound')); return; }
    if (fr.length >= 50) fr.shift(); fr.push({ c: code, n: String(r.data.nick || '').slice(0, 24) }); save(); H.toast(t('friendAdded'), r.data.nick || code); renderVisit();
  }
  async function visitCode(code) { let r = null; try { r = await H.net.findByCode(code); } catch (e) { H.toast('', t('netErr')); return; } if (!r) { H.toast('', t('codeNotFound')); return; } startVisit(r); }
  async function visitRandom() { let r = null; try { r = await H.net.randomPublic([]); } catch (e) { H.toast('', t('netErr')); return; } if (!r) { H.toast('', t('noPublic')); return; } startVisit(r); }
  function startVisit(r) {
    if (ui.visit) endVisit(); H.closeSheets(); H.stopFollow();
    const d = r.data, groups = {}, root = new THREE.Group(), obst0 = H.E.obstacles.length, lights0 = H.lightDefs.slice();
    for (const o of Object.values(H.decorObj)) o.visible = false; for (const o of Object.values(setObj)) o.visible = false; for (const g of Object.values(H.groups)) g.mesh.visible = false;
    for (const id of Object.keys(evObj)) killEvent(id);
    H.lightDefs.length = 0;
    for (const id of H.DECOR_ORDER) if (d.decor && d.decor[id]) { const g = H.DECOR[id].build(); root.add(g); if (g.userData.light) H.lightDefs.push(g.userData.light); }
    for (const id of SET_ORDER) if ((d.sets || []).includes(id)) { const g = SETS[id].build(); root.add(g); if (g.userData.light) H.lightDefs.push(g.userData.light); }
    for (const id of H.SPECIES_ORDER) { const n = Math.min(H.SPECIES[id].max, Math.max(0, Math.floor((d.counts || {})[id] || 0))); if (!n) continue; const g = H.makeGroup(id, 0, 1 + hash(r.uid) % 997); for (let k = 0; k < n; k++) g.add(false); groups[id] = g; root.add(g.mesh); }
    for (const [k, v] of Object.entries(d.tint || {})) { const j = k.lastIndexOf('_'), g = groups[k.slice(0, j)], i = +k.slice(j + 1); if (g && g.tint && i < g.n) g.tint[i] = clamp(+v || 0, 0, 3); }
    H.scene.add(root); H.assignLights(); applyLight(LIGHTS[d.light] ? d.light : 'moon');
    ui.visit = { uid: r.uid, nick: String(d.nick || '').slice(0, 24), code: d.code, root, groups, obst0, lights0 };
    H.setWorld(groups); document.body.classList.add('visiting'); $('visitBar').classList.remove('hidden'); $('visitNick').textContent = t('visiting').replace('{n}', ui.visit.nick);
    H.cam.home = true; H.cam.tDist = H.homeD(); renderBanner(); updHeart();
    stats().visits = (stats().visits || 0) + 1; q('visit1'); save();
  }
  async function updHeart() { const v = ui.visit; if (!v) return; $('visitHearts').textContent = '♥'; if (H.DEMO) return; const n = await H.net.heartCount(v.uid); if (ui.visit === v && n !== null) $('visitHearts').textContent = '♥ ' + n; }
  function endVisit() {
    const v = ui.visit; if (!v) return; ui.visit = null; H.stopFollow(); H.scene.remove(v.root); v.root.traverse((x) => { if (x.geometry) x.geometry.dispose(); });
    H.E.obstacles.length = v.obst0; H.lightDefs.length = 0; H.lightDefs.push(...v.lights0); H.assignLights();
    for (const o of Object.values(H.decorObj)) o.visible = true; for (const o of Object.values(setObj)) o.visible = true; for (const g of Object.values(H.groups)) g.mesh.visible = true;
    applyLight(S().light || 'moon'); H.setWorld(H.groups); document.body.classList.remove('visiting'); $('visitBar').classList.add('hidden'); H.cam.home = true; H.cam.tDist = H.homeD(); evTimer = 0; renderBanner();
  }
  $('visitHome').onclick = () => { endVisit(); H.audio.tap(); };
  $('visitHeart').onclick = async () => { const v = ui.visit; if (!v) return; const r = await H.net.sendHeart(v.uid); if (r === 'ok') { H.audio.heart(); H.toast('♥', t('heartSent').replace('{n}', v.nick)); stats().hearts = (stats().hearts || 0) + 1; q('heart1'); save(); updHeart(); const fl = $('visitHeart'); fl.classList.remove('pop'); void fl.offsetWidth; fl.classList.add('pop'); } else H.toast('', t(r === 'already' ? 'heartAlready' : r === 'self' ? 'codeSelf' : 'netErr')); };
  $('pubToggle').onclick = () => setPublic(!S().isPublic);
  $('nickSave').onclick = () => { const v = $('nickInput').value.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 24); if (!v) return; S().nick = v; save(); pubSoon(); H.toast('', t('saved')); };
  $('copyCode').onclick = async () => { const c = myCode(), url = location.origin + location.pathname + '?friend=' + c; try { if (navigator.share) await navigator.share({ title: 'BLUE HAVEN', text: t('codeShare').replace('{c}', c), url }); else { await navigator.clipboard.writeText(url); H.toast('', t('linkCopied')); } } catch (e) { try { await navigator.clipboard.writeText(url); H.toast('', t('linkCopied')); } catch (_) {} } };
  $('addFriendBtn').onclick = () => addFriend($('friendInput').value);
  $('randomVisit').onclick = visitRandom;

  // ---------- rail & panels ----------
  const open = (id, fn) => { H.openSheet(id); fn && fn(); };
  $('railDex').onclick = () => open('dexPanel', renderDex);
  $('railQuest').onclick = () => open('questPanel', renderQuests);
  $('railEv').onclick = () => open('eventPanel', renderEvents);
  $('railVisit').onclick = () => open('visitPanel', renderVisit);
  $('railPhoto').onclick = enterPhoto; $('railSleep').onclick = enterSleep;
  $('careFeed').onclick = feedCare; $('carePet').onclick = (e) => petTick(e.clientX || innerWidth / 2, e.clientY || innerHeight - 160); $('careNameBtn').onclick = nameCare; $('nameSave').onclick = saveName;
  $('nameInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') saveName(); });
  $('careDex').onclick = () => { open('dexPanel', renderDex); };

  // ---------- hooks used by main ----------
  let watchAcc = 0, breedT = 30, beatT = 240, petAcc = 0;
  return {
    get visiting() { return !!ui.visit; }, get photo() { return ui.photo; }, get sleeping() { return !!ui.sleep; },
    onLoad() { // after the save is applied (also re-run safely)
      for (const id of sv('sets', [])) if (SETS[id]) placeSet(id, false);
      applyLight(S().light || 'moon'); H.audio.setTrack(S().bgm || 'deep'); applyTints(); spawnBabies(); breedCheck(true); quests(); renderQuestDot();
    },
    afterLogin(raw) { claimIdle(raw); const fc = H.qs.get('friend'); if (fc) setTimeout(() => addFriend(fc), 1500); },
    onStart() { if (ui.idleWait) { ui.idleWait = false; setTimeout(showIdle, 900); } if (ui.evPending) { const id = ui.evPending; ui.evPending = null; setTimeout(() => onEventSeen(id), 1200); } evTimer = 0; },
    onPersist() { pubSoon(); },
    onFollow(g, i) { ui.care = { g, i }; renderCare(); },
    onUnfollow() { ui.care = null; renderCare(); },
    followName(g, i) { return (!ui.visit && nameOf(g.id, i)) || ''; },
    onTap(x, y) {
      ui.watch = null;
      if (ui.sleep) { sleepWake(); return true; }
      if (ui.photo) { H.ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); H.ray.setFromCamera(H.ndc, H.camera); const hit = H.pickCreature(x, y); if (hit) { H.cam.tTarget.copy(hit.g.pos[hit.i]); } else { const d = H.camera.position.distanceTo(H.cam.target); H.cam.tTarget.copy(H.ray.ray.at(d, new THREE.Vector3())); H.cam.tTarget.y = Math.max(H.cam.tTarget.y, H.sandHeight(H.cam.tTarget.x, H.cam.tTarget.z) + 1); } $('camUp').value = H.cam.tTarget.y.toFixed(1); return true; }
      if (ui.visit || H.cam.follow || H.pickCreature(x, y)) return false;
      H.ndc.set(x / innerWidth * 2 - 1, -(y / innerHeight) * 2 + 1); H.ray.setFromCamera(H.ndc, H.camera);
      const p = H.ray.ray.at(clamp(H.camera.position.distanceTo(H.cam.target) * 0.75, 5, 16), new THREE.Vector3()); p.y = Math.max(p.y, H.sandHeight(p.x, p.z) + 1.5);
      const n = callBonded(p); if (!n) return false; H.burst(p, 10, true); H.floater(x, y, '♪', true); H.audio.tone(81, 0.05, 0.5); H.audio.tone(86, 0.04, 0.6, 'sine', H.audio.ctx ? H.audio.ctx.currentTime + 0.12 : undefined); return true;
    },
    onDrag(x, y, dx, dy) { // stroking the followed creature = petting
      const c = ui.care; if (!c || ui.visit || ui.photo) return false; const s = H.toScreen(c.g.pos[c.i], { x: 0, y: 0, z: 0 }); if (s.z > 1) return false;
      const rad = Math.max(70, c.g.sp.len * 0.8 / H.camera.position.distanceTo(c.g.pos[c.i]) * innerHeight); if (Math.hypot(s.x - x, s.y - y) > rad) return false;
      petAcc += Math.hypot(dx, dy); if (petAcc > 70) { petAcc = 0; petTick(x, y); } return true;
    },
    tick(dt, time) {
      for (let k = nudges.length - 1; k >= 0; k--) { const n = nudges[k]; n.dur -= dt; n.f(dt); if (n.dur <= 0) { n.end && n.end(); nudges.splice(k, 1); } }
      eventsTick(dt, time); sleepTick(dt);
      if (ui.visit || H.ST.mode !== 'play') return;
      const f = H.cam.follow; if (f && !isBaby(f.g.id, f.i)) { const d = dexOf(f.g.id); d.w += dt; watchAcc += dt; if (watchAcc >= 5) { watchAcc -= 5; q('watch60', 5); dexUnlocks(f.g.id, { i: f.i }); save(); } }
      breedT -= dt; if (breedT <= 0) { breedT = 60; breedCheck(false); }
      beatT -= dt; if (beatT <= 0) { beatT = 240; if (document.visibilityState === 'visible') save(); }
    },
    frameGate() { const s = ui.sleep; if (!s) return true; s.skip = !s.skip; return !s.skip; }, // ~30 fps while sleeping
    onGame(id, score, earned) { if (['bubble', 'run', 'memory', 'escape'].includes(id)) q('arcade2'); q('play', 1, id); q('pearls60', earned); renderQuestDot(); },
    renderShopSets, renderShopExtra, renderSettingsExtra, renderBanner,
    shopFull(id) { return (S().counts[id] || 0) + (sv('babies', []).some((b) => b.s === id) ? 1 : 0); },
    refresh() { renderBanner(); renderQuestDot(); if (ui.care) renderCare(); if (ui.visit) $('visitNick').textContent = t('visiting').replace('{n}', ui.visit.nick); if (ui.sleep) renderSleep(); if (ui.photo) renderFilters();
      for (const [id, fn] of [['dexPanel', renderDex], ['questPanel', renderQuests], ['eventPanel', renderEvents], ['visitPanel', renderVisit]]) if (!$(id).classList.contains('hidden')) fn(); },
    // test & screenshot helpers (local only via window.__bh)
    test: { showBehaviour, forceBaby, enterPhoto, exitPhoto, shoot, enterSleep, exitSleep, startVisit, endVisit, visitRandom, visitCode, addFriend, setPublic, snapshot, liveEvents, upcoming, watchEvent, quests, q, dexOf, dexUnlocks, feedCare, petTick, callBonded, renderDex, renderQuests, renderEvents, renderVisit, showIdleTest: (n, hrs) => { ui.idle = { n, hrs }; showIdle(); }, ui, setLight, setBgm, buySet, placeSet, babyIdx, claimIdle },
  };
}
