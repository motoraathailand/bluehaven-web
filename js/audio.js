// BLUE HAVEN — procedural underwater ambient music & sound effects (Web Audio API).
// Everything is synthesised at runtime by this project's own code. No samples, no audio files, no borrowed melodies.
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
// Original, very slow deep-sea progression (D dorian/lydian colours), with sparse low chimes.
const CHORDS = [[38, 45, 52, 57, 62], [36, 43, 50, 55, 64], [41, 48, 55, 57, 64], [34, 41, 50, 53, 60]];
const SCALE = [62, 64, 65, 69, 71, 74, 76, 77, 81, 83];

// r5: several original procedural tracks (all written by this project; no samples)
export const TRACKS = {
  deep: { chords: CHORDS, scale: SCALE, bar: 15, gap: [3.0, 5.0], bell: 0.035, pad: 1 },
  lullaby: { chords: [[45, 52, 57, 61, 64], [42, 49, 54, 57, 61], [38, 45, 50, 54, 57], [40, 47, 52, 56, 59]], scale: [69, 71, 73, 76, 78, 81, 83, 85], bar: 12, gap: [1.6, 0.9], bell: 0.03, pad: 0.8, box: true },
  current: { chords: [[40, 47, 52, 55, 59], [36, 43, 48, 52, 55], [43, 50, 55, 59, 62], [38, 45, 50, 53, 57]], scale: [64, 67, 69, 71, 74, 76, 79, 81], bar: 8, gap: [0.5, 0], bell: 0.03, pad: 0.7, pulse: true, arp: true },
  glass: { chords: [[41, 48, 55, 57, 64], [43, 50, 57, 59, 66], [38, 45, 52, 57, 62], [40, 47, 54, 59, 64]], scale: [77, 79, 81, 84, 86, 88, 91], bar: 10, gap: [0.38, 0], bell: 0.022, pad: 0.6, arp: true, high: true },
};
export class SeaAudio {
  constructor() { this.ctx = null; this.muted = false; this.started = false; this.game = 0; this.track = 'deep'; this.vol = 1; this.arpI = 0; }
  setTrack(id) { if (!TRACKS[id] || id === this.track) return; this.track = id; this.arpI = 0; if (this.ctx) { const now = this.ctx.currentTime; this.nextNote = now + 0.4; this.nextBar = Math.min(this.nextBar, now + 1.5); } }
  setVolume(v) { this.vol = Math.max(0, Math.min(1, v)); if (this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.75 * this.vol, this.ctx.currentTime, 0.6); }
  start() {
    if (this.started) { if (this.ctx.state !== 'running') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC(); this.started = true;
    this.master = ctx.createGain(); this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 3600; // gentle "underwater" softening
    this.master.connect(lp).connect(comp).connect(ctx.destination);
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.75 * this.vol, ctx.currentTime, 2.0);
    this.reverb = ctx.createConvolver(); this.reverb.buffer = this.impulse(8, 2.0);
    const rg = ctx.createGain(); rg.gain.value = 0.7; this.reverb.connect(rg).connect(this.master);
    this.delay = ctx.createDelay(2); this.delay.delayTime.value = 0.48;
    const fb = ctx.createGain(); fb.gain.value = 0.42; const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 1800;
    this.delay.connect(dl).connect(fb).connect(this.delay); dl.connect(this.reverb); const dOut = ctx.createGain(); dOut.gain.value = 0.3; dl.connect(dOut).connect(this.master);
    this.music = ctx.createGain(); this.music.gain.value = 1; this.music.connect(this.master); this.music.connect(this.reverb);
    this.sfx = ctx.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.master); this.sfx.connect(this.reverb);
    // ocean hush: brown noise, low-passed, slowly swelling
    const n = ctx.createBufferSource(); n.buffer = this.noise(8, true); n.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 210; const ng = ctx.createGain(); ng.gain.value = 0.26;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 0.09; lfo.connect(lg).connect(ng.gain); lfo.start();
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.05; const lg2 = ctx.createGain(); lg2.gain.value = 120; lfo2.connect(lg2).connect(nf.frequency); lfo2.start();
    n.connect(nf).connect(ng).connect(this.master); n.start();
    this.nextBar = ctx.currentTime + 0.3; this.chord = 0; this.nextNote = ctx.currentTime + 3; this.nextBubble = ctx.currentTime + 2; this.lastIdx = 4;
    this.timer = setInterval(() => this.schedule(), 200); this.schedule();
  }
  impulse(sec, decay) { const c = this.ctx, len = Math.floor(sec * c.sampleRate), b = c.createBuffer(2, len, c.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); } return b; }
  noise(sec, brown) { const c = this.ctx, len = Math.floor(sec * c.sampleRate), b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0); let l = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; if (brown) { l = (l + 0.02 * w) / 1.02; d[i] = l * 3.5; } else d[i] = w; } return b; }
  setMuted(m) { this.muted = m; if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.75 * this.vol, this.ctx.currentTime, 0.3); }
  setGame(on) { this.game = on ? 1 : 0; }

  pad(t, midi, dur, gain) {
    const c = this.ctx, f = mtof(midi), g = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320 + Math.random() * 200; lp.Q.value = 0.6;
    const lf = c.createOscillator(); lf.frequency.value = 0.1 + Math.random() * 0.1; const lfg = c.createGain(); lfg.gain.value = 180; lf.connect(lfg).connect(lp.frequency); lf.start(t); lf.stop(t + dur + 6);
    for (const [type, det] of [['sine', -5], ['triangle', 5], ['sine', 1200]]) { const o = c.createOscillator(); o.type = type; o.frequency.value = f; o.detune.value = det; const og = c.createGain(); og.gain.value = det === 1200 ? 0.12 : 0.5; o.connect(og).connect(lp); o.start(t); o.stop(t + dur + 6); }
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 3.5); g.gain.setValueAtTime(gain, t + dur); g.gain.linearRampToValueAtTime(0, t + dur + 5.5);
    lp.connect(g).connect(this.music);
  }
  bell(t, midi, gain = 0.08, dest) {
    const c = this.ctx, f = mtof(midi), g = c.createGain();
    for (const [r, a, d] of [[1, 1, 2.6], [2.0, 0.25, 1.2], [3.01, 0.12, 0.7], [4.2, 0.05, 0.4]]) { const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = f * r; const og = c.createGain(); og.gain.setValueAtTime(0, t); og.gain.linearRampToValueAtTime(a, t + 0.012); og.gain.exponentialRampToValueAtTime(0.0008, t + d); o.connect(og).connect(g); o.start(t); o.stop(t + d + 0.1); }
    g.gain.value = gain; g.connect(dest || this.music); g.connect(this.delay);
  }
  bubble(t, gain = 0.05, base = 260) {
    const c = this.ctx, o = c.createOscillator(), g = c.createGain(); o.type = 'sine';
    const f0 = base * (0.8 + Math.random() * 0.6); o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(f0 * 3.2, t + 0.07 + Math.random() * 0.05);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.14);
    o.connect(g).connect(this.sfx); o.start(t); o.stop(t + 0.2);
  }
  schedule() {
    const c = this.ctx; if (!c) return; const now = c.currentTime, ahead = now + 0.6;
    const T = TRACKS[this.track] || TRACKS.deep, SC = T.scale;
    while (this.nextBar < ahead) {
      const ch = T.chords[this.chord % T.chords.length], dur = T.bar;
      ch.forEach((m, i) => this.pad(this.nextBar + i * 0.25, m, dur, (i === 0 ? 0.05 : 0.026) * T.pad));
      if (T.pulse) for (let b = 0; b < dur / 1; b++) this.soft(this.nextBar + b * 1.0, ch[0] - 12, b % 4 === 0 ? 0.05 : 0.028);
      this.curChord = ch; this.chord++; this.nextBar += dur;
    }
    while (this.nextNote < ahead) {
      if (T.arp) { const ch = this.curChord || T.chords[0], seq = [0, 2, 4, 3, 1, 3, 4, 2], k = seq[this.arpI++ % seq.length], m = ch[k] + (T.high ? 24 : 12);
        this.bell(this.nextNote, m, T.bell * (this.arpI % 4 === 1 ? 1.3 : 1)); this.nextNote += T.gap[0] * (this.game ? 0.8 : 1); continue; }
      let idx = this.lastIdx + Math.round((Math.random() - 0.5) * 4); idx = Math.max(0, Math.min(SC.length - 1, idx)); this.lastIdx = idx;
      this.bell(this.nextNote, SC[idx], T.bell + 0.03 * this.game);
      if (T.box) { this.bell(this.nextNote + 0.45, SC[Math.max(0, idx - 2)], T.bell * 0.8); this.bell(this.nextNote + 0.9, SC[Math.min(SC.length - 1, idx + 1)], T.bell * 0.7); }
      else if (Math.random() < 0.3) this.bell(this.nextNote + 0.18, SC[Math.min(SC.length - 1, idx + 2)], 0.035);
      this.nextNote += (this.game ? 1.0 : T.gap[0]) + Math.random() * (this.game ? 1.4 : T.gap[1]);
    }
    while (this.nextBubble < ahead) { const k = 1 + Math.floor(Math.random() * 4); for (let i = 0; i < k; i++) this.bubble(this.nextBubble + i * (0.06 + Math.random() * 0.1), 0.018 + Math.random() * 0.02); this.nextBubble += 5 + Math.random() * 9; }
    if (!this.nextWhale) this.nextWhale = now + 12;
    if (this.nextWhale < ahead) { this.whale(this.nextWhale); this.nextWhale += 28 + Math.random() * 30; }
  }
  // soft low pulse (track 'current')
  soft(t, midi, gain) { const c = this.ctx, o = c.createOscillator(), g = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 220; o.type = 'triangle'; o.frequency.value = mtof(midi); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.04); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.7); o.connect(lp).connect(g).connect(this.music); o.start(t); o.stop(t + 0.75); }
  // soft, distant whale-like call: gliding sines through a vowel-ish band filter
  whale(t, loud = 1) {
    if (!this.ctx) return;
    const c = this.ctx, base = 150 + Math.random() * 80, dur = 3.5 + Math.random() * 2.5, g = c.createGain(), bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 520; bp.Q.value = 1.4;
    bp.frequency.setValueAtTime(420, t); bp.frequency.linearRampToValueAtTime(780, t + dur * 0.6); bp.frequency.linearRampToValueAtTime(380, t + dur);
    for (const [mul, gn] of [[1, 0.6], [2.01, 0.3], [3.0, 0.12]]) { const o = c.createOscillator(); o.type = 'sine'; const f = base * mul; o.frequency.setValueAtTime(f, t); o.frequency.exponentialRampToValueAtTime(f * (1.35 + Math.random() * 0.2), t + dur * 0.55); o.frequency.exponentialRampToValueAtTime(f * 0.92, t + dur);
      const v = c.createOscillator(); v.frequency.value = 4.5; const vg = c.createGain(); vg.gain.value = f * 0.006; v.connect(vg).connect(o.frequency); v.start(t); v.stop(t + dur + 0.2);
      const og = c.createGain(); og.gain.value = gn; o.connect(og).connect(bp); o.start(t); o.stop(t + dur + 0.2); }
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.05 * loud, t + dur * 0.3); g.gain.linearRampToValueAtTime(0.035 * loud, t + dur * 0.7); g.gain.linearRampToValueAtTime(0, t + dur);
    bp.connect(g); g.connect(this.reverb); const dry = c.createGain(); dry.gain.value = 0.3; g.connect(dry).connect(this.music);
  }
  // ---- events ----
  pearl(combo = 0, golden = false) { if (!this.ctx) return; const t = this.ctx.currentTime; const m = SCALE[Math.min(SCALE.length - 1, combo % SCALE.length)] + (combo >= SCALE.length ? 0 : 0); this.bell(t, m, 0.11, this.sfx); this.bubble(t, 0.04, 400); if (golden) { this.bell(t + 0.09, m + 7, 0.09, this.sfx); this.bell(t + 0.18, m + 12, 0.07, this.sfx); } }
  eat() { if (!this.ctx) return; const t = this.ctx.currentTime; this.bubble(t, 0.06, 180); this.bell(t + 0.03, SCALE[Math.floor(Math.random() * 5)] - 12, 0.05, this.sfx); }
  drop() { if (!this.ctx) return; const t = this.ctx.currentTime; for (let i = 0; i < 3; i++) this.bubble(t + i * 0.05, 0.03, 500); }
  tap() { if (!this.ctx) return; this.bubble(this.ctx.currentTime, 0.035, 330); }
  unlock() { if (!this.ctx) return; const t = this.ctx.currentTime; [0, 2, 4, 5, 7, 9].forEach((k, i) => this.bell(t + i * 0.11, SCALE[k] , 0.08, this.sfx)); for (let i = 0; i < 8; i++) this.bubble(t + 0.3 + i * 0.07, 0.03, 300); }
  finish() { if (!this.ctx) return; const t = this.ctx.currentTime; [4, 6, 8, 9].forEach((k, i) => this.bell(t + i * 0.16, SCALE[k], 0.09, this.sfx)); }
  // ---- arcade sfx (synthesised; no samples) ----
  tone(midi, gain = 0.08, dur = 0.35, type = 'sine', t) { if (!this.ctx) return; const c = this.ctx; t = t ?? c.currentTime; const o = c.createOscillator(), g = c.createGain(); o.type = type; o.frequency.value = mtof(midi); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t + dur); o.connect(g).connect(this.sfx); o.start(t); o.stop(t + dur + 0.05); }
  thump(t, gain = 0.14) { if (!this.ctx) return; const c = this.ctx; t = t ?? c.currentTime; const o = c.createOscillator(), g = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.16); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(gain, t + 0.006); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.3); o.connect(g).connect(this.master); o.start(t); o.stop(t + 0.35); }
  hit(k = 0, golden = false) { if (!this.ctx) return; const t = this.ctx.currentTime, m = SCALE[((k % SCALE.length) + SCALE.length) % SCALE.length]; this.bell(t, m, 0.09, this.sfx); this.bubble(t, 0.03, 420); if (golden) this.bell(t + 0.08, m + 12, 0.06, this.sfx); }
  hurt() { if (!this.ctx) return; const c = this.ctx, t = c.currentTime, o = c.createOscillator(), g = c.createGain(); o.type = 'triangle'; o.frequency.setValueAtTime(330, t); o.frequency.exponentialRampToValueAtTime(80, t + 0.35); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.12, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.4); o.connect(g).connect(this.sfx); o.start(t); o.stop(t + 0.45); }
  padNote(i) { if (!this.ctx) return; const t = this.ctx.currentTime, m = [62, 65, 67, 69, 72, 74][i % 6]; this.bell(t, m, 0.1, this.sfx); this.tone(m - 12, 0.05, 0.5, 'triangle', t); }
  // r5 sfx
  heart() { if (!this.ctx) return; const t = this.ctx.currentTime; [0, 4, 7].forEach((k, i) => this.bell(t + i * 0.07, 74 + k, 0.07, this.sfx)); }
  shutter() { if (!this.ctx) return; const c = this.ctx, t = c.currentTime, n = c.createBufferSource(); n.buffer = this.noise(0.12, false); const f = c.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500; const g = c.createGain(); g.gain.setValueAtTime(0.12, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.1); n.connect(f).connect(g).connect(this.sfx); n.start(t); this.bell(t + 0.05, 86, 0.04, this.sfx); }
  chime() { if (!this.ctx) return; const t = this.ctx.currentTime; [0, 3, 7, 10, 14].forEach((k, i) => this.bell(t + i * 0.12, 69 + k, 0.06, this.sfx)); }
  song() { if (!this.ctx) return; const t = this.ctx.currentTime; this.whale(t + 0.1, 2.4); this.whale(t + 2.2, 1.8); }
}
