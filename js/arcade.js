// BLUE HAVEN — arcade minigames on a 2D canvas over the deep sea (original designs, © MOTOR AA).
// Bubble Rhythm · Glow Run · Glow Memory · School Escape. Touch + mouse (+ keys on desktop). Sounds are synthesised by audio.js.
export const ARCADE = ['bubble', 'run', 'memory', 'escape'];
export const DUR = { bubble: 60, run: 75, memory: 90, escape: 60 };
export const RATE = { bubble: 160, run: 45, memory: 18, escape: 30 }; // score per pearl
const TAU = Math.PI * 2, rnd = (a, b) => a + Math.random() * (b - a), clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const glowCache = new Map();
function glowSprite(col, size = 64) {
  const k = col + size; if (glowCache.has(k)) return glowCache.get(k);
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); const r = size / 2;
  const gr = g.createRadialGradient(r, r, 0, r, r, r); gr.addColorStop(0, col); gr.addColorStop(0.25, col.replace(/[\d.]+\)$/, '0.45)')); gr.addColorStop(1, col.replace(/[\d.]+\)$/, '0)'));
  g.fillStyle = gr; g.fillRect(0, 0, size, size); glowCache.set(k, c); return c;
}
const rgba = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${a})`; };

export class Arcade {
  constructor(canvas, audio, hooks) {
    this.cv = canvas; this.g = canvas.getContext('2d'); this.audio = audio; this.hooks = hooks; this.id = null; this.st = null;
    this.ptr = { down: false, x: 0, y: 0 }; this.keys = new Set(); this.parts = []; this.texts = []; this.snow = [];
    const pos = (e) => { const r = canvas.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
    canvas.addEventListener('pointerdown', (e) => { if (!this.id) return; e.preventDefault(); const [x, y] = pos(e); Object.assign(this.ptr, { down: true, x, y }); try { canvas.setPointerCapture(e.pointerId); } catch (_) {} if (this.st && this.st.intro <= 0 && !this.st.over && this.G.tap) this.G.tap.call(this, x, y); });
    canvas.addEventListener('pointermove', (e) => { if (!this.id) return; const [x, y] = pos(e); this.ptr.x = x; this.ptr.y = y; });
    const up = () => { this.ptr.down = false; }; canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    addEventListener('keydown', (e) => { if (!this.id) return; this.keys.add(e.code); if (this.st && this.st.intro <= 0 && !this.st.over && this.G.key) this.G.key.call(this, e.code); });
    addEventListener('keyup', (e) => this.keys.delete(e.code));
    addEventListener('resize', () => this.resize()); this.resize();
  }
  resize() {
    const dpr = Math.min(devicePixelRatio || 1, 2); this.dpr = dpr; this.W = innerWidth; this.H = innerHeight;
    this.cv.width = Math.round(this.W * dpr); this.cv.height = Math.round(this.H * dpr); this.g.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.S = clamp(Math.min(this.W, this.H * 0.62) / 412, 0.7, 1.8); this.bg = null;
    if (this.G && this.G.layout) this.G.layout.call(this);
  }
  get active() { return !!this.id; }
  start(id) {
    this.id = id; this.G = GAMES[id]; this.parts.length = 0; this.texts.length = 0; this.shake = 0;
    this.st = { score: 0, mult: 1, combo: 0, best: 0, t: 0, dur: DUR[id], lives: 3, over: false, intro: 2.2, said: 0 };
    this.snow = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), r: rnd(0.6, 2.2), v: rnd(4, 14), ph: rnd(0, TAU) }));
    this.cv.classList.remove('hidden'); this.G.init.call(this); if (this.G.layout) this.G.layout.call(this); this.hud();
  }
  stop() { this.id = null; this.G = null; this.cv.classList.add('hidden'); this.ptr.down = false; }
  finish() { if (this.st.over) return; this.st.over = true; if (this.G.final) this.G.final.call(this); this.hud(); setTimeout(() => { const r = { id: this.id, score: Math.floor(this.st.score) }; this.stop(); this.hooks.end(r); }, 900); }
  hud() { const s = this.st; this.hooks.hud({ left: Math.max(0, s.dur - s.t), dur: s.dur, score: Math.floor(s.score), mult: s.mult, lives: s.lives, livesKind: this.G.livesKind || 'shell' }); }
  frame(dt) {
    if (!this.id) return; const s = this.st;
    if (s.intro > 0) { const before = Math.ceil(s.intro); s.intro -= dt; if (Math.ceil(s.intro) !== before && this.audio) this.audio.tone(s.intro <= 0 ? 79 : 67, 0.06, 0.25); }
    else if (!s.over) { s.t += dt; this.G.update.call(this, dt); if (s.t >= s.dur || s.lives <= 0) this.finish(); }
    for (let i = this.parts.length - 1; i >= 0; i--) { const p = this.parts[i]; p.life -= dt; p.x += p.vx * dt; p.y += p.vy * dt; p.vx *= 0.96; p.vy *= 0.96; if (p.life <= 0) this.parts.splice(i, 1); }
    for (let i = this.texts.length - 1; i >= 0; i--) { const p = this.texts[i]; p.life -= dt; p.y -= 34 * dt; if (p.life <= 0) this.texts.splice(i, 1); }
    this.shake = Math.max(0, this.shake - dt * 3);
    this.draw(dt); this.hudT = (this.hudT || 0) - dt; if (this.hudT <= 0) { this.hud(); this.hudT = 0.1; }
  }
  // ---- helpers ----
  add(base, x, y, col = '#fff3ea') { const v = Math.round(base * this.st.mult); this.st.score += v; if (x !== undefined) this.say(x, y, '+' + v, col); return v; }
  say(x, y, txt, col = '#fff3ea', size = 20) { this.texts.push({ x, y, txt, col, size, life: 0.9 }); }
  sparks(x, y, n, col = '#bff8ff', sp = 140) { for (let i = 0; i < n; i++) { const a = rnd(0, TAU), v = rnd(0.3, 1) * sp * this.S; this.parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: rnd(0.35, 0.8), col, r: rnd(1.5, 3.5) * this.S }); } }
  glow(x, y, r, col) { const sp = glowSprite(col); this.g.drawImage(sp, x - r, y - r, r * 2, r * 2); }
  background() {
    const { W, H } = this; if (this.bg && this.bg.width === Math.round(W * this.dpr)) return this.bg;
    const c = document.createElement('canvas'); c.width = Math.round(W * this.dpr); c.height = Math.round(H * this.dpr); const g = c.getContext('2d'); g.scale(this.dpr, this.dpr);
    const gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, '#1f6aa0'); gr.addColorStop(0.45, '#124476'); gr.addColorStop(1, '#08223e'); g.fillStyle = gr; g.fillRect(0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i++) { const x = W * (0.1 + i * 0.21) + rnd(-20, 20), w = W * rnd(0.08, 0.16), sg = g.createLinearGradient(0, 0, 0, H * 0.9); sg.addColorStop(0, 'rgba(140,200,255,0.16)'); sg.addColorStop(1, 'rgba(140,200,255,0)');
      g.fillStyle = sg; g.beginPath(); g.moveTo(x, 0); g.lineTo(x + w, 0); g.lineTo(x + w * 2.2 - W * 0.12, H * 0.9); g.lineTo(x + w * 0.6 - W * 0.12, H * 0.9); g.closePath(); g.fill(); }
    g.globalCompositeOperation = 'source-over';
    const vg = g.createRadialGradient(W / 2, H * 0.45, Math.min(W, H) * 0.3, W / 2, H * 0.5, Math.max(W, H) * 0.8); vg.addColorStop(0, 'rgba(0,10,30,0)'); vg.addColorStop(1, 'rgba(0,10,30,0.45)'); g.fillStyle = vg; g.fillRect(0, 0, W, H);
    this.bg = c; return c;
  }
  draw(dt) {
    const g = this.g, { W, H } = this, s = this.st;
    g.save(); if (this.shake > 0) g.translate(rnd(-1, 1) * this.shake * 8, rnd(-1, 1) * this.shake * 8);
    g.drawImage(this.background(), 0, 0, W, H);
    g.globalCompositeOperation = 'lighter';
    for (const p of this.snow) { p.y -= (p.v / H) * dt * 0.6; p.x += Math.sin(s.t * 0.4 + p.ph) * 0.00006; if (p.y < -0.02) { p.y = 1.02; p.x = Math.random(); } g.fillStyle = 'rgba(200,235,255,0.35)'; g.fillRect(p.x * W, p.y * H, p.r, p.r); }
    g.globalCompositeOperation = 'source-over';
    this.G.draw.call(this, g, dt);
    g.globalCompositeOperation = 'lighter';
    for (const p of this.parts) { const a = clamp(p.life * 1.6, 0, 1); this.glow(p.x, p.y, p.r * 3.2, p.col.startsWith('rgba') ? p.col : rgba(p.col, 0.9 * a)); }
    g.globalCompositeOperation = 'source-over';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const p of this.texts) { g.globalAlpha = clamp(p.life * 2, 0, 1); g.font = `700 ${Math.round(p.size * this.S)}px system-ui, sans-serif`; g.fillStyle = p.col; g.shadowColor = 'rgba(0,20,40,0.7)'; g.shadowBlur = 8; g.fillText(p.txt, p.x, p.y); }
    g.globalAlpha = 1; g.shadowBlur = 0;
    if (s.intro > 0) { const n = Math.ceil(s.intro - 0.2), txt = s.intro > 0.25 ? (n > 0 ? String(n) : this.hooks.t('go')) : this.hooks.t('go'); const k = s.intro % 1;
      g.font = `700 ${Math.round(72 * this.S * (1 + k * 0.25))}px Georgia, serif`; g.fillStyle = `rgba(255,243,234,${0.35 + 0.65 * k})`; g.shadowColor = 'rgba(0,20,40,0.6)'; g.shadowBlur = 18; g.fillText(txt, W / 2, H * 0.42); g.shadowBlur = 0;
      g.font = `600 ${Math.round(16 * this.S)}px system-ui, sans-serif`; g.fillStyle = 'rgba(243,251,251,0.9)'; this.wrap(this.hooks.t('ga_' + this.id + '_d'), W / 2, H * 0.55, W * 0.82, 22 * this.S); }
    g.restore();
  }
  wrap(text, x, y, maxW, lh) { const g = this.g, words = text.split(/(\s+)/); let line = '', yy = y; const cjk = /[\u0E00-\u0E7F\u3040-\u9FFF\uAC00-\uD7AF]/.test(text) && !/\s/.test(text);
    const units = cjk ? [...text] : words; for (const w of units) { const test = line + w; if (g.measureText(test).width > maxW && line.trim()) { g.fillText(line.trim(), x, yy); line = w; yy += lh; } else line = test; } if (line.trim()) g.fillText(line.trim(), x, yy); }
}
const GAMES = {};

// ---------- 1. Bubble Rhythm: bubbles rise to the beat; tap them as they pass the glowing rings ----------
GAMES.bubble = {
  init() { const s = this.st; Object.assign(s, { bpm: 92, nextHit: 2.0, nextBeat: 0, beatK: 0, notes: [], ringP: [0, 0, 0], perfect: 0, travel: 2.1 }); },
  layout() { const { W, H } = this; this.st.lanes = [W * 0.2, W * 0.5, W * 0.8]; this.st.yT = H * 0.36; },
  lane(x) { const L = this.st.lanes; let b = 0; for (let i = 1; i < 3; i++) if (Math.abs(x - L[i]) < Math.abs(x - L[b])) b = i; return b; },
  update(dt) {
    const s = this.st, step = 60 / s.bpm; s.bpm = Math.min(140, 92 + s.t * 0.85);
    // beat pulse + soft procedural kick
    while (s.nextBeat <= s.t) { s.beatK = 1; if (this.audio) this.audio.thump(undefined, 0.12 + (s.combo >= 16 ? 0.05 : 0)); s.nextBeat += step; }
    s.beatK = Math.max(0, s.beatK - dt * 4);
    // chart generation, a little ahead of time
    while (s.nextHit < s.t + s.travel + 0.1 && s.nextHit < s.dur - 0.4) {
      const lvl = s.t / s.dur, dense = Math.random() < 0.15 + lvl * 0.45;
      if (Math.random() < 0.82) { const ln = Math.floor(Math.random() * 3); s.notes.push({ lane: ln, hit: s.nextHit, done: 0, gold: Math.random() < 0.09 });
        if (lvl > 0.3 && Math.random() < 0.12 + lvl * 0.12) s.notes.push({ lane: (ln + 1 + Math.floor(Math.random() * 2)) % 3, hit: s.nextHit, done: 0, gold: false }); }
      s.nextHit += dense ? step / 2 : step;
    }
    for (const n of s.notes) if (!n.done && s.t - n.hit > 0.2) { n.done = -1; s.combo = 0; s.mult = 1; this.say(s.lanes[n.lane], s.yT - 40 * this.S, this.hooks.t('miss'), '#9fb4d8', 16); }
    s.notes = s.notes.filter((n) => s.t - n.hit < 1.2);
    for (let i = 0; i < 3; i++) s.ringP[i] = Math.max(0, s.ringP[i] - dt * 3);
  },
  tap(x, y) { GAMES.bubble.hitLane.call(this, GAMES.bubble.lane.call(this, x)); },
  key(code) { const m = { Digit1: 0, KeyA: 0, ArrowLeft: 0, Digit2: 1, KeyS: 1, ArrowDown: 1, Space: 1, Digit3: 2, KeyD: 2, ArrowRight: 2 }; if (code in m) GAMES.bubble.hitLane.call(this, m[code]); },
  hitLane(ln) {
    const s = this.st; s.ringP[ln] = 1; let best = null, bd = 9;
    for (const n of s.notes) if (!n.done && n.lane === ln) { const d = Math.abs(s.t - n.hit); if (d < bd) { bd = d; best = n; } }
    const x = s.lanes[ln], y = s.yT;
    if (!best || bd > 0.3) return;
    if (bd > 0.15) { best.done = -1; s.combo = 0; s.mult = 1; this.say(x, y - 40 * this.S, this.hooks.t('miss'), '#9fb4d8', 16); if (this.audio) this.audio.tone(50, 0.05, 0.2, 'triangle'); return; }
    best.done = 1; s.combo++; s.mult = Math.min(4, 1 + Math.floor(s.combo / 8)); const perfect = bd <= 0.075; if (perfect) s.perfect++;
    this.add((perfect ? 100 : 50) * (best.gold ? 3 : 1), x, y - 46 * this.S, best.gold ? '#ffd98a' : '#fff3ea');
    this.say(x, y + 44 * this.S, this.hooks.t(perfect ? 'perfect' : 'good'), perfect ? '#9ff8ff' : '#d8e4ff', 15);
    this.sparks(x, y, best.gold ? 22 : 12, best.gold ? '#ffd98a' : '#bff8ff');
    if (this.audio) this.audio.hit(ln * 2 + (s.combo % 4), best.gold);
  },
  draw(g) {
    const s = this.st, S = this.S, v = (this.H - s.yT + 60 * S) / s.travel;
    g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 3; i++) { const x = s.lanes[i]; const lg = g.createLinearGradient(0, 0, 0, this.H); lg.addColorStop(0, 'rgba(120,220,255,0)'); lg.addColorStop(0.36, `rgba(120,220,255,${0.07 + s.ringP[i] * 0.12})`); lg.addColorStop(1, 'rgba(120,220,255,0.02)'); g.fillStyle = lg; g.fillRect(x - 34 * S, 0, 68 * S, this.H); }
    for (let i = 0; i < 3; i++) { const x = s.lanes[i], r = (34 + s.beatK * 5 + s.ringP[i] * 8) * S; this.glow(x, s.yT, r * 1.9, `rgba(120,230,255,${0.18 + s.ringP[i] * 0.3})`);
      g.strokeStyle = `rgba(200,250,255,${0.55 + s.beatK * 0.3})`; g.lineWidth = 3 * S; g.beginPath(); g.arc(x, s.yT, r, 0, TAU); g.stroke(); }
    g.globalCompositeOperation = 'source-over';
    for (const n of s.notes) {
      if (n.done === 1) continue; const y = s.yT + (n.hit - s.t) * v; if (y > this.H + 60 * S || y < -60 * S) continue;
      const x = s.lanes[n.lane] + Math.sin(n.hit * 3 + s.t * 2) * 4 * S, r = 27 * S, fade = n.done === -1 ? 0.35 : 1;
      g.globalAlpha = fade; const bg = g.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.1, x, y, r);
      if (n.gold) { bg.addColorStop(0, 'rgba(255,240,200,0.9)'); bg.addColorStop(0.6, 'rgba(255,200,110,0.28)'); bg.addColorStop(1, 'rgba(255,210,130,0.75)'); }
      else { bg.addColorStop(0, 'rgba(255,255,255,0.75)'); bg.addColorStop(0.55, 'rgba(160,230,255,0.12)'); bg.addColorStop(1, 'rgba(190,240,255,0.7)'); }
      g.fillStyle = bg; g.beginPath(); g.arc(x, y, r, 0, TAU); g.fill();
      g.strokeStyle = n.gold ? 'rgba(255,230,170,0.9)' : 'rgba(220,250,255,0.85)'; g.lineWidth = 1.6 * S; g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.ellipse(x - r * 0.38, y - r * 0.42, r * 0.18, r * 0.11, -0.6, 0, TAU); g.fill(); g.globalAlpha = 1;
    }
    if (s.combo >= 4) { g.textAlign = 'center'; g.font = `700 ${Math.round(22 * S)}px Georgia, serif`; g.fillStyle = 'rgba(255,243,234,0.85)'; g.fillText(s.combo + ' ' + this.hooks.t('combo'), this.W / 2, this.H * 0.78); }
  },
};

// ---------- 2. Glow Run: steer a glowing fish through a narrowing cave ----------
GAMES.run = {
  livesKind: 'heart',
  init() { const s = this.st; Object.assign(s, { y: this.H * 0.5, vy: 0, dist: 0, inv: 0, chain: 0, lastEat: -9, obs: [], food: [], spO: 1.4, spF: 0.4, trail: [] }); },
  walls(sx) { const s = this.st, H = this.H, x = s.dist + sx, c = H * 0.56 + Math.sin(x * 0.0029) * H * 0.1 + Math.sin(x * 0.0011 + 1.3) * H * 0.07; const gap = H * (0.66 - 0.28 * Math.min(1, s.t / 65)); return [c - gap / 2, c + gap / 2]; },
  update(dt) {
    const s = this.st, S = this.S, px = this.W * 0.26, pr = 13 * S, spd = (210 + s.t * 3.4) * S; s.dist += spd * dt; s.score += dt * (4 + s.t * 0.08);
    let ty = s.y; if (this.ptr.down) ty = this.ptr.y; if (this.keys.has('ArrowUp') || this.keys.has('KeyW')) ty = s.y - 260 * S; if (this.keys.has('ArrowDown') || this.keys.has('KeyS')) ty = s.y + 260 * S;
    const ny = s.y + (ty - s.y) * Math.min(1, dt * 7); s.vy = (ny - s.y) / Math.max(dt, 1e-3); s.y = ny;
    const [top, bot] = GAMES.run.walls.call(this, px); s.inv = Math.max(0, s.inv - dt);
    if (s.y - pr < top || s.y + pr > bot) { s.y = clamp(s.y, top + pr + 2, bot - pr - 2); GAMES.run.hurt.call(this); }
    s.spO -= dt; if (s.spO <= 0) { s.spO = Math.max(0.5, 1.45 - s.t * 0.014) * rnd(0.8, 1.2); const wx = this.W + 60 * S, [t2, b2] = GAMES.run.walls.call(this, wx), r = Math.random();
      if (r < 0.42) s.obs.push({ k: 'jelly', x: s.dist + wx, y: rnd(t2 + 40 * S, b2 - 40 * S), ph: rnd(0, TAU), r: 20 * S });
      else if (r < 0.72) s.obs.push({ k: 'urchin', x: s.dist + wx, y: Math.random() < 0.5 ? t2 + rnd(14, 60) * S : b2 - rnd(14, 60) * S, ph: 0, r: 17 * S });
      else { const fromTop = Math.random() < 0.5; s.obs.push({ k: 'spike', x: s.dist + wx, top: fromTop, len: rnd(0.28, 0.46) * (b2 - t2), r: 12 * S }); } }
    s.spF -= dt; if (s.spF <= 0) { s.spF = rnd(0.9, 1.6); const wx = this.W + 40 * S, [t2, b2] = GAMES.run.walls.call(this, wx), cy = rnd(t2 + 50 * S, b2 - 50 * S), n = 5 + Math.floor(Math.random() * 4), amp = rnd(10, 40) * S;
      for (let i = 0; i < n; i++) s.food.push({ x: s.dist + wx + i * 30 * S, y: cy + Math.sin(i * 0.9) * amp, ph: rnd(0, TAU), gold: i === n - 1 && Math.random() < 0.3 }); }
    for (const o of s.obs) { const sx = o.x - s.dist; let hx = sx, hy = o.y, hr = o.r;
      if (o.k === 'jelly') { o.y += Math.sin(s.t * 2.2 + o.ph) * 30 * S * dt; hy = o.y; }
      if (o.k === 'spike') { const [t2, b2] = GAMES.run.walls.call(this, sx); hy = o.top ? t2 + o.len * 0.75 : b2 - o.len * 0.75; hr = 11 * S; o.base = o.top ? t2 : b2; }
      if (Math.hypot(hx - px, hy - s.y) < hr + pr * 0.8) GAMES.run.hurt.call(this);
      if (o.k === 'spike') { const hy2 = o.top ? o.base + o.len * 0.4 : o.base - o.len * 0.4; if (Math.hypot(sx - px, hy2 - s.y) < 16 * S + pr * 0.7) GAMES.run.hurt.call(this); } }
    for (const f of s.food) { if (f.got) continue; const sx = f.x - s.dist; if (Math.hypot(sx - px, f.y - s.y) < 24 * S) { f.got = 1;
      s.chain = s.t - s.lastEat < 1.4 ? s.chain + 1 : 1; s.lastEat = s.t; s.mult = Math.min(5, 1 + Math.floor(s.chain / 6)); this.add(f.gold ? 50 : 10, sx, f.y - 18 * S, f.gold ? '#ffd98a' : '#c8ffe8');
      this.sparks(sx, f.y, f.gold ? 14 : 5, f.gold ? '#ffd98a' : '#9affd0', 90); if (this.audio) this.audio.hit(s.chain % 10, f.gold); } }
    s.obs = s.obs.filter((o) => o.x - s.dist > -80 * S); s.food = s.food.filter((f) => !f.got && f.x - s.dist > -40 * S);
    s.trail.push({ x: px, y: s.y }); if (s.trail.length > 14) s.trail.shift(); for (const p of s.trail) p.x -= spd * dt;
  },
  hurt() { const s = this.st; if (s.inv > 0) return; s.inv = 1.4; s.lives--; s.mult = 1; s.chain = 0; this.shake = 1; this.sparks(this.W * 0.26, s.y, 16, '#ff9aa8', 160); if (this.audio) this.audio.hurt(); },
  draw(g) {
    const s = this.st, S = this.S, W = this.W, H = this.H, px = W * 0.26;
    // cave rock (far parallax ridge, then walls)
    g.fillStyle = 'rgba(6,24,44,0.55)'; g.beginPath(); g.moveTo(0, H); for (let x = 0; x <= W + 20; x += 20) g.lineTo(x, H * 0.86 + Math.sin((x + s.dist * 0.3) * 0.006) * H * 0.05); g.lineTo(W, H); g.fill();
    const top = [], bot = []; for (let x = -10; x <= W + 20; x += 14 * S) { const [a, b] = GAMES.run.walls.call(this, x); top.push([x, a]); bot.push([x, b]); }
    const rock = g.createLinearGradient(0, 0, 0, H); rock.addColorStop(0, '#04101f'); rock.addColorStop(0.5, '#020a14'); rock.addColorStop(1, '#04101f'); g.fillStyle = rock;
    g.beginPath(); g.moveTo(-10, -10); for (const [x, y] of top) g.lineTo(x, y); g.lineTo(W + 20, -10); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(-10, H + 10); for (const [x, y] of bot) g.lineTo(x, y); g.lineTo(W + 20, H + 10); g.closePath(); g.fill();
    g.strokeStyle = 'rgba(130,225,245,0.6)'; g.lineWidth = 2.4 * S; g.shadowColor = 'rgba(120,220,255,0.6)'; g.shadowBlur = 10 * S; for (const L of [top, bot]) { g.beginPath(); L.forEach(([x, y], i) => i ? g.lineTo(x, y) : g.moveTo(x, y)); g.stroke(); } g.shadowBlur = 0;
    // obstacles
    for (const o of s.obs) { const sx = o.x - s.dist; if (sx < -60 * S || sx > W + 80 * S) continue;
      if (o.k === 'jelly') { const r = o.r; g.globalCompositeOperation = 'lighter'; this.glow(sx, o.y, r * 2.2, 'rgba(255,120,200,0.32)'); g.globalCompositeOperation = 'source-over';
        g.fillStyle = 'rgba(255,150,215,0.75)'; g.beginPath(); g.arc(sx, o.y, r, Math.PI, 0); g.quadraticCurveTo(sx, o.y + r * 0.35, sx - r, o.y); g.fill();
        g.strokeStyle = 'rgba(255,190,230,0.7)'; g.lineWidth = 1.5 * S; for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(sx + k * r * 0.35, o.y + 2); for (let j = 1; j <= 5; j++) g.lineTo(sx + k * r * 0.35 + Math.sin(s.t * 5 + j + k) * 3 * S, o.y + j * r * 0.32); g.stroke(); } }
      else if (o.k === 'urchin') { g.fillStyle = '#1a0f2a'; g.strokeStyle = '#3a2050'; g.lineWidth = 2 * S; for (let k = 0; k < 16; k++) { const a = k / 16 * TAU + s.t * 0.4; g.beginPath(); g.moveTo(sx, o.y); g.lineTo(sx + Math.cos(a) * o.r * 1.7, o.y + Math.sin(a) * o.r * 1.7); g.stroke(); }
        g.beginPath(); g.arc(sx, o.y, o.r * 0.85, 0, TAU); g.fill(); g.globalCompositeOperation = 'lighter'; for (let k = 0; k < 16; k += 2) { const a = k / 16 * TAU + s.t * 0.4; this.glow(sx + Math.cos(a) * o.r * 1.7, o.y + Math.sin(a) * o.r * 1.7, 4 * S, 'rgba(255,90,120,0.8)'); } g.globalCompositeOperation = 'source-over'; }
      else if (o.base !== undefined) { const d = o.top ? 1 : -1; g.fillStyle = '#061626'; g.beginPath(); g.moveTo(sx - 18 * S, o.base - d * 4); g.lineTo(sx + 18 * S, o.base - d * 4); g.lineTo(sx + 2 * S, o.base + d * o.len); g.closePath(); g.fill(); g.strokeStyle = 'rgba(140,220,240,0.35)'; g.lineWidth = 1.5 * S; g.stroke(); } }
    // plankton
    g.globalCompositeOperation = 'lighter';
    for (const f of s.food) { const sx = f.x - s.dist, y = f.y + Math.sin(s.t * 3 + f.ph) * 3 * S; this.glow(sx, y, (f.gold ? 14 : 9) * S, f.gold ? 'rgba(255,215,130,0.9)' : 'rgba(150,255,210,0.85)'); }
    // player: glowing fish + trail
    s.trail.forEach((p, i) => this.glow(p.x, p.y, (3 + i * 0.6) * S, `rgba(140,240,255,${0.04 + i * 0.02})`));
    const blink = s.inv > 0 && Math.floor(s.inv * 10) % 2 === 0; this.glow(px, s.y, 34 * S, 'rgba(120,230,255,0.35)');
    g.globalCompositeOperation = 'source-over';
    if (!blink) { const a = clamp(s.vy / (600 * S), -0.6, 0.6); g.save(); g.translate(px, s.y); g.rotate(a); const r = 13 * S;
      g.fillStyle = '#bff4ff'; g.beginPath(); g.ellipse(0, 0, r * 1.5, r * 0.8, 0, 0, TAU); g.fill(); g.fillStyle = '#7fd8f0'; g.beginPath(); g.moveTo(-r * 1.2, 0); g.lineTo(-r * 2.3, -r * 0.8); g.lineTo(-r * 2.1, 0); g.lineTo(-r * 2.3, r * 0.8); g.closePath(); g.fill();
      g.fillStyle = '#0a1a2a'; g.beginPath(); g.arc(r * 0.8, -r * 0.18, r * 0.2, 0, TAU); g.fill(); g.restore(); }
  },
};

// ---------- 3. Glow Memory: corals light up in a pattern; repeat it (longer, faster, and later the ring turns) ----------
const PADS = ['#5af0ff', '#ff7ad0', '#ffd25a', '#7aff9a', '#a890ff', '#ff9a5a'];
GAMES.memory = {
  init() { const s = this.st; Object.assign(s, { seq: [], phase: 'pause', timer: 1.0, idx: 0, round: 0, streak: 0, lit: [0, 0, 0, 0, 0, 0], rot: 0, msg: '' }); },
  layout() { const s = this.st; s.cx = this.W / 2; s.cy = this.H * 0.56; s.R = Math.min(this.W * 0.33, this.H * 0.24); s.pr = s.R * 0.42; },
  pos(i) { const s = this.st, a = -Math.PI / 2 + i / 6 * TAU + s.rot; return [s.cx + Math.cos(a) * s.R, s.cy + Math.sin(a) * s.R]; },
  flash(i, strong = 1) { const s = this.st; s.lit[i] = strong; if (this.audio) this.audio.padNote(i); },
  update(dt) {
    const s = this.st; for (let i = 0; i < 6; i++) s.lit[i] = Math.max(0, s.lit[i] - dt * 2.6);
    if (s.round >= 6) s.rot += dt * Math.min(0.5, 0.08 + (s.round - 6) * 0.05);
    s.timer -= dt;
    if (s.phase === 'pause' && s.timer <= 0) { if (!s.replay) { let n; do n = Math.floor(Math.random() * 6); while (n === s.seq[s.seq.length - 1]); s.seq.push(n); if (s.seq.length < 3) { s.timer = 0; return; } s.round++; }
      s.replay = false; s.phase = 'show'; s.idx = 0; s.timer = 0.35; s.msg = this.hooks.t('watch'); }
    else if (s.phase === 'show' && s.timer <= 0) { const gap = Math.max(0.26, 0.64 - s.round * 0.035); if (s.idx < s.seq.length) { GAMES.memory.flash.call(this, s.seq[s.idx]); s.idx++; s.timer = gap; } else { s.phase = 'input'; s.idx = 0; s.msg = this.hooks.t('yourTurn'); } }
  },
  tap(x, y) {
    const s = this.st; if (s.phase !== 'input') return;
    for (let i = 0; i < 6; i++) { const [px, py] = GAMES.memory.pos.call(this, i); if (Math.hypot(x - px, y - py) < s.pr * 1.1) { GAMES.memory.press.call(this, i, px, py); return; } }
  },
  key(code) { const m = { Digit1: 0, Digit2: 1, Digit3: 2, Digit4: 3, Digit5: 4, Digit6: 5 }; if (code in m) { const [px, py] = GAMES.memory.pos.call(this, m[code]); GAMES.memory.press.call(this, m[code], px, py); } },
  press(i, px, py) {
    const s = this.st; if (s.phase !== 'input') return; GAMES.memory.flash.call(this, i);
    if (s.seq[s.idx] === i) { s.idx++; this.sparks(px, py, 6, PADS[i], 90);
      if (s.idx >= s.seq.length) { s.streak++; s.mult = Math.min(4, 1 + Math.floor(s.streak / 2) * 0.5); this.add(s.seq.length * 10, s.cx, s.cy, '#fff3ea'); this.sparks(s.cx, s.cy, 18, '#fff3ea', 160);
        if (this.audio) this.audio.finish(); s.phase = 'pause'; s.timer = 0.9; s.msg = this.hooks.t('round') + ' ' + (s.round + 1); } }
    else { s.lives--; s.streak = 0; s.mult = 1; this.shake = 0.7; if (this.audio) this.audio.hurt(); s.phase = 'pause'; s.timer = 1.1; s.replay = true; s.msg = this.hooks.t('miss'); }
  },
  draw(g) {
    const s = this.st, S = this.S;
    g.globalCompositeOperation = 'lighter'; this.glow(s.cx, s.cy, s.R * 1.9, 'rgba(90,160,255,0.12)'); g.globalCompositeOperation = 'source-over';
    for (let i = 0; i < 6; i++) { const [x, y] = GAMES.memory.pos.call(this, i), L = s.lit[i], c = PADS[i], r = s.pr;
      if (L > 0) { g.globalCompositeOperation = 'lighter'; this.glow(x, y, r * (1.6 + L * 0.8), rgba(c, 0.55 * L)); g.globalCompositeOperation = 'source-over'; }
      g.fillStyle = rgba(c, 0.16 + L * 0.5); g.beginPath(); g.arc(x, y, r * (1 + L * 0.06), 0, TAU); g.fill();
      g.strokeStyle = rgba(c, 0.55 + L * 0.45); g.lineWidth = 2.2 * S; g.stroke();
      // each pad has its own bioluminescent motif
      g.strokeStyle = rgba(c, 0.45 + L * 0.5); g.fillStyle = rgba(c, 0.5 + L * 0.5); g.lineWidth = 1.6 * S;
      if (i === 0) for (let k = 1; k <= 3; k++) { g.beginPath(); g.arc(x, y, r * k * 0.22, 0, TAU); g.stroke(); }
      if (i === 1) for (let k = 0; k < 8; k++) { const a = k / 8 * TAU; g.beginPath(); g.arc(x + Math.cos(a) * r * 0.5, y + Math.sin(a) * r * 0.5, r * 0.09, 0, TAU); g.fill(); }
      if (i === 2) { g.beginPath(); for (let k = 0; k < 10; k++) { const a = k / 10 * TAU - Math.PI / 2, rr = k % 2 ? r * 0.25 : r * 0.6; g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); } g.closePath(); g.stroke(); }
      if (i === 3) for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(x - r * 0.55, y + k * r * 0.3); g.bezierCurveTo(x - r * 0.2, y + k * r * 0.3 - r * 0.25, x + r * 0.2, y + k * r * 0.3 + r * 0.25, x + r * 0.55, y + k * r * 0.3); g.stroke(); }
      if (i === 4) { g.beginPath(); for (let k = 0; k < 6; k++) { const a = k / 6 * TAU; g.lineTo(x + Math.cos(a) * r * 0.55, y + Math.sin(a) * r * 0.55); } g.closePath(); g.stroke(); g.beginPath(); g.arc(x, y, r * 0.16, 0, TAU); g.fill(); }
      if (i === 5) for (let k = 0; k < 3; k++) { const a = k / 3 * TAU + s.t; g.beginPath(); g.arc(x + Math.cos(a) * r * 0.28, y + Math.sin(a) * r * 0.28, r * 0.2, 0, TAU); g.stroke(); } }
    g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = 'rgba(243,251,251,0.92)';
    g.font = `600 ${Math.round(18 * S)}px system-ui, sans-serif`; g.fillText(s.msg, s.cx, s.cy - 6 * S);
    g.font = `500 ${Math.round(13 * S)}px system-ui, sans-serif`; g.fillStyle = 'rgba(243,251,251,0.7)'; g.fillText(this.hooks.t('round') + ' ' + Math.max(1, s.round) + ' · ' + s.seq.length, s.cx, s.cy + 18 * S);
    if (s.phase === 'input') { g.fillStyle = 'rgba(255,243,234,0.85)'; for (let k = 0; k < s.seq.length; k++) { g.globalAlpha = k < s.idx ? 1 : 0.3; g.beginPath(); g.arc(s.cx + (k - (s.seq.length - 1) / 2) * 12 * S, s.cy + s.R + s.pr + 26 * S, 3.5 * S, 0, TAU); g.fill(); } g.globalAlpha = 1; }
  },
};

// ---------- 4. School Escape: lead a little school with your light; feed it and keep it away from hunters ----------
GAMES.escape = {
  livesKind: 'fish',
  init() { const s = this.st, W = this.W, H = this.H; Object.assign(s, { L: { x: W / 2, y: H * 0.6 }, fish: [], hunters: [], clouds: [], spC: 1.0, chain: 0, nextHunter: 18, bonus: 0 });
    for (let i = 0; i < 24; i++) s.fish.push({ x: W / 2 + rnd(-40, 40), y: H * 0.6 + rnd(-40, 40), vx: rnd(-20, 20), vy: rnd(-20, 20), ph: rnd(0, TAU) });
    s.hunters.push({ x: -40, y: H * 0.25, vx: 60, vy: 0, cd: 2.5 }); s.lives = s.fish.length; },
  update(dt) {
    const s = this.st, S = this.S, W = this.W, H = this.H, L = s.L;
    if (this.ptr.down) { L.x += (this.ptr.x - L.x) * Math.min(1, dt * 6); L.y += (this.ptr.y - L.y) * Math.min(1, dt * 6); }
    const kx = (this.keys.has('ArrowRight') || this.keys.has('KeyD')) - (this.keys.has('ArrowLeft') || this.keys.has('KeyA')), ky = (this.keys.has('ArrowDown') || this.keys.has('KeyS')) - (this.keys.has('ArrowUp') || this.keys.has('KeyW'));
    L.x = clamp(L.x + kx * 300 * S * dt, 20, W - 20); L.y = clamp(L.y + ky * 300 * S * dt, 90 * S, H - 20);
    if (s.t > s.nextHunter && s.hunters.length < 4) { s.hunters.push({ x: Math.random() < 0.5 ? -40 : W + 40, y: rnd(H * 0.2, H * 0.9), vx: 0, vy: 0, cd: 1.5 }); s.nextHunter += 17; }
    // boids
    const F = s.fish, maxV = 165 * S;
    for (const f of F) { let ax = (L.x - f.x) * 1.9, ay = (L.y - f.y) * 1.9, sx = 0, sy = 0, avx = 0, avy = 0, n = 0;
      for (const o of F) { if (o === f) continue; const dx = f.x - o.x, dy = f.y - o.y, d2 = dx * dx + dy * dy; if (d2 < (16 * S) ** 2) { sx += dx / (d2 + 1) * 900 * S; sy += dy / (d2 + 1) * 900 * S; } if (d2 < (50 * S) ** 2) { avx += o.vx; avy += o.vy; n++; } }
      if (n) { ax += (avx / n - f.vx) * 1.2; ay += (avy / n - f.vy) * 1.2; } ax += sx * 6; ay += sy * 6; let flee = 0;
      for (const h of s.hunters) { const dx = f.x - h.x, dy = f.y - h.y, d = Math.hypot(dx, dy); if (d < 120 * S) { const k = (1 - d / (120 * S)) * 2400 * S; ax += dx / (d + 1) * k; ay += dy / (d + 1) * k; flee = 1; } }
      f.vx += ax * dt; f.vy += ay * dt; const v = Math.hypot(f.vx, f.vy), mv = maxV * (flee ? 1.45 : 1); if (v > mv) { f.vx *= mv / v; f.vy *= mv / v; }
      f.x = clamp(f.x + f.vx * dt, 6, W - 6); f.y = clamp(f.y + f.vy * dt, 70 * S, H - 6); }
    // hunters chase the nearest fish; your light nudges them away
    const hs = (95 + s.t * 1.7) * S;
    for (const h of s.hunters) { h.cd = Math.max(0, h.cd - dt); let best = null, bd = 1e9; for (const f of F) { const d = Math.hypot(f.x - h.x, f.y - h.y); if (d < bd) { bd = d; best = f; } }
      let tx = W / 2, ty = H / 2; if (best) { tx = best.x; ty = best.y; } let ax = tx - h.x, ay = ty - h.y; const dl = Math.hypot(h.x - L.x, h.y - L.y); if (dl < 90 * S) { ax += (h.x - L.x) / (dl + 1) * 260; ay += (h.y - L.y) / (dl + 1) * 260; }
      const al = Math.hypot(ax, ay) || 1, sp = h.cd > 0 ? hs * 0.5 : hs; h.vx += (ax / al * sp - h.vx) * Math.min(1, dt * 1.6); h.vy += (ay / al * sp - h.vy) * Math.min(1, dt * 1.6); h.x += h.vx * dt; h.y += h.vy * dt;
      if (best && bd < 15 * S && h.cd <= 0) { F.splice(F.indexOf(best), 1); h.cd = 1.1; s.chain = 0; s.mult = 1; this.sparks(best.x, best.y, 14, '#ff9aa8', 120); this.shake = 0.5; if (this.audio) this.audio.hurt(); } }
    s.lives = F.length;
    // plankton clouds
    s.spC -= dt; if (s.spC <= 0 && s.clouds.length < 3) { s.clouds.push({ x: rnd(W * 0.12, W * 0.88), y: rnd(H * 0.22, H * 0.88), n: 12, r: 42 * S, eat: 0, age: 0 }); s.spC = rnd(2.2, 3.6); }
    for (const c of s.clouds) { c.age += dt; let inside = 0; for (const f of F) if (Math.hypot(f.x - c.x, f.y - c.y) < c.r) inside++;
      c.eat += inside * dt * 2.2; while (c.eat >= 1 && c.n > 0) { c.eat -= 1; c.n--; this.add(5, c.x + rnd(-20, 20) * S, c.y - 20 * S, '#c8ffe8'); if (this.audio && Math.random() < 0.5) this.audio.tone(74 + Math.floor(Math.random() * 3) * 3, 0.03, 0.18); }
      if (c.n <= 0 && !c.done) { c.done = 1; s.chain++; s.mult = Math.min(5, 1 + s.chain * 0.5); this.sparks(c.x, c.y, 18, '#9affd0', 130); if (this.audio) this.audio.hit(s.chain, true); } }
    s.clouds = s.clouds.filter((c) => !c.done && c.age < 14);
  },
  final() { const s = this.st, b = s.fish.length * 25; s.score += b; s.bonus = b; if (b) this.say(this.W / 2, this.H * 0.4, '+' + b, '#ffd98a', 30); },
  draw(g) {
    const s = this.st, S = this.S;
    g.globalCompositeOperation = 'lighter';
    for (const c of s.clouds) { for (let k = 0; k < c.n; k++) { const a = k * 2.399 + s.t * 0.6, rr = c.r * Math.sqrt((k + 0.5) / 12) * 0.85; this.glow(c.x + Math.cos(a) * rr, c.y + Math.sin(a) * rr, 7 * S, 'rgba(150,255,200,0.8)'); } this.glow(c.x, c.y, c.r * 1.4, 'rgba(120,255,200,0.1)'); }
    this.glow(s.L.x, s.L.y, 70 * S, 'rgba(255,240,200,0.3)'); this.glow(s.L.x, s.L.y, 16 * S, 'rgba(255,250,235,0.95)');
    for (const f of s.fish) this.glow(f.x, f.y, 9 * S, 'rgba(140,235,255,0.45)');
    g.globalCompositeOperation = 'source-over';
    for (const f of s.fish) { const a = Math.atan2(f.vy, f.vx); g.save(); g.translate(f.x, f.y); g.rotate(a); const r = 5 * S; g.fillStyle = '#d4f6ff';
      g.beginPath(); g.ellipse(0, 0, r * 1.6, r * 0.7, 0, 0, TAU); g.fill(); g.beginPath(); g.moveTo(-r * 1.3, 0); g.lineTo(-r * 2.4, -r * 0.7 + Math.sin(s.t * 14 + f.ph) * r * 0.3); g.lineTo(-r * 2.4, r * 0.7 + Math.sin(s.t * 14 + f.ph) * r * 0.3); g.closePath(); g.fill(); g.restore(); }
    for (const h of s.hunters) { const a = Math.atan2(h.vy, h.vx); g.save(); g.translate(h.x, h.y); g.rotate(a); const r = 16 * S;
      g.fillStyle = '#0a1424'; g.strokeStyle = 'rgba(160,190,230,0.45)'; g.lineWidth = 1.5 * S; g.beginPath(); g.moveTo(r * 2.2, 0); g.quadraticCurveTo(r * 0.6, -r * 0.95, -r * 1.6, -r * 0.25); g.lineTo(-r * 2.6, -r * 0.9); g.lineTo(-r * 2.2, 0); g.lineTo(-r * 2.6, r * 0.9); g.lineTo(-r * 1.6, r * 0.25); g.quadraticCurveTo(r * 0.6, r * 0.95, r * 2.2, 0); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(-r * 0.2, -r * 0.6); g.lineTo(-r * 0.8, -r * 1.5); g.lineTo(-r * 0.9, -r * 0.5); g.fill(); g.stroke();
      g.globalCompositeOperation = 'lighter'; this.glow(r * 1.3, -r * 0.25, 5 * S, 'rgba(255,90,90,0.9)'); g.globalCompositeOperation = 'source-over'; g.restore(); }
  },
};
