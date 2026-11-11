// BLUE HAVEN — procedural underwater ambient music & sound effects (Web Audio API).
// Everything is synthesised at runtime by this project's own code. No samples, no audio files, no borrowed melodies.
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);
// Original slow progression in A-flat lydian colour (pads), with pentatonic chimes.
const CHORDS = [[44, 51, 58, 60, 63, 67], [41, 48, 56, 60, 63, 67], [49, 56, 60, 63, 65, 70], [46, 53, 58, 62, 65, 70]];
const SCALE = [68, 70, 72, 75, 77, 80, 82, 84, 87, 89];

export class SeaAudio {
  constructor() { this.ctx = null; this.muted = false; this.started = false; this.game = 0; }
  start() {
    if (this.started) { if (this.ctx.state !== 'running') this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC(); this.started = true;
    this.master = ctx.createGain(); this.master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor(); comp.threshold.value = -16; comp.ratio.value = 3;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 5200; // gentle "underwater" softening
    this.master.connect(lp).connect(comp).connect(ctx.destination);
    this.master.gain.setTargetAtTime(this.muted ? 0 : 0.75, ctx.currentTime, 2.0);
    this.reverb = ctx.createConvolver(); this.reverb.buffer = this.impulse(6, 2.2);
    const rg = ctx.createGain(); rg.gain.value = 0.7; this.reverb.connect(rg).connect(this.master);
    this.delay = ctx.createDelay(2); this.delay.delayTime.value = 0.48;
    const fb = ctx.createGain(); fb.gain.value = 0.42; const dl = ctx.createBiquadFilter(); dl.type = 'lowpass'; dl.frequency.value = 1800;
    this.delay.connect(dl).connect(fb).connect(this.delay); dl.connect(this.reverb); const dOut = ctx.createGain(); dOut.gain.value = 0.3; dl.connect(dOut).connect(this.master);
    this.music = ctx.createGain(); this.music.gain.value = 1; this.music.connect(this.master); this.music.connect(this.reverb);
    this.sfx = ctx.createGain(); this.sfx.gain.value = 0.9; this.sfx.connect(this.master); this.sfx.connect(this.reverb);
    // ocean hush: brown noise, low-passed, slowly swelling
    const n = ctx.createBufferSource(); n.buffer = this.noise(8, true); n.loop = true;
    const nf = ctx.createBiquadFilter(); nf.type = 'lowpass'; nf.frequency.value = 340; const ng = ctx.createGain(); ng.gain.value = 0.22;
    const lfo = ctx.createOscillator(); lfo.frequency.value = 0.07; const lg = ctx.createGain(); lg.gain.value = 0.09; lfo.connect(lg).connect(ng.gain); lfo.start();
    const lfo2 = ctx.createOscillator(); lfo2.frequency.value = 0.05; const lg2 = ctx.createGain(); lg2.gain.value = 120; lfo2.connect(lg2).connect(nf.frequency); lfo2.start();
    n.connect(nf).connect(ng).connect(this.master); n.start();
    this.nextBar = ctx.currentTime + 0.3; this.chord = 0; this.nextNote = ctx.currentTime + 3; this.nextBubble = ctx.currentTime + 2; this.lastIdx = 4;
    this.timer = setInterval(() => this.schedule(), 200); this.schedule();
  }
  impulse(sec, decay) { const c = this.ctx, len = Math.floor(sec * c.sampleRate), b = c.createBuffer(2, len, c.sampleRate); for (let ch = 0; ch < 2; ch++) { const d = b.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay); } return b; }
  noise(sec, brown) { const c = this.ctx, len = Math.floor(sec * c.sampleRate), b = c.createBuffer(1, len, c.sampleRate), d = b.getChannelData(0); let l = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; if (brown) { l = (l + 0.02 * w) / 1.02; d[i] = l * 3.5; } else d[i] = w; } return b; }
  setMuted(m) { this.muted = m; if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.75, this.ctx.currentTime, 0.3); }
  setGame(on) { this.game = on ? 1 : 0; }

  pad(t, midi, dur, gain) {
    const c = this.ctx, f = mtof(midi), g = c.createGain(), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 520 + Math.random() * 300; lp.Q.value = 0.6;
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
    while (this.nextBar < ahead) {
      const ch = CHORDS[this.chord % CHORDS.length], dur = 10;
      ch.forEach((m, i) => this.pad(this.nextBar + i * 0.25, m, dur, i === 0 ? 0.05 : 0.026));
      this.chord++; this.nextBar += dur;
    }
    while (this.nextNote < ahead) {
      let idx = this.lastIdx + Math.round((Math.random() - 0.5) * 4); idx = Math.max(0, Math.min(SCALE.length - 1, idx)); this.lastIdx = idx;
      this.bell(this.nextNote, SCALE[idx], 0.05 + 0.03 * this.game);
      if (Math.random() < 0.3) this.bell(this.nextNote + 0.18, SCALE[Math.min(SCALE.length - 1, idx + 2)], 0.035);
      this.nextNote += (this.game ? 0.9 : 1.8) + Math.random() * (this.game ? 1.2 : 3.2);
    }
    while (this.nextBubble < ahead) { const k = 1 + Math.floor(Math.random() * 4); for (let i = 0; i < k; i++) this.bubble(this.nextBubble + i * (0.06 + Math.random() * 0.1), 0.018 + Math.random() * 0.02); this.nextBubble += 3 + Math.random() * 7; }
  }
  // ---- events ----
  pearl(combo = 0, golden = false) { if (!this.ctx) return; const t = this.ctx.currentTime; const m = SCALE[Math.min(SCALE.length - 1, combo % SCALE.length)] + (combo >= SCALE.length ? 0 : 0); this.bell(t, m, 0.11, this.sfx); this.bubble(t, 0.04, 400); if (golden) { this.bell(t + 0.09, m + 7, 0.09, this.sfx); this.bell(t + 0.18, m + 12, 0.07, this.sfx); } }
  eat() { if (!this.ctx) return; const t = this.ctx.currentTime; this.bubble(t, 0.06, 180); this.bell(t + 0.03, SCALE[Math.floor(Math.random() * 5)] - 12, 0.05, this.sfx); }
  drop() { if (!this.ctx) return; const t = this.ctx.currentTime; for (let i = 0; i < 3; i++) this.bubble(t + i * 0.05, 0.03, 500); }
  tap() { if (!this.ctx) return; this.bubble(this.ctx.currentTime, 0.035, 330); }
  unlock() { if (!this.ctx) return; const t = this.ctx.currentTime; [0, 2, 4, 5, 7, 9].forEach((k, i) => this.bell(t + i * 0.11, SCALE[k] , 0.08, this.sfx)); for (let i = 0; i < 8; i++) this.bubble(t + 0.3 + i * 0.07, 0.03, 300); }
  finish() { if (!this.ctx) return; const t = this.ctx.currentTime; [4, 6, 8, 9].forEach((k, i) => this.bell(t + i * 0.16, SCALE[k], 0.09, this.sfx)); }
}
