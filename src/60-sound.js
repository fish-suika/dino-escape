// ===== サウンド（WebAudio で生成。外部ファイルなし）。最初のキー押下で開始、M でミュート =====
const SND = { ctx: null, master: null, rumbleG: null, hissG: null, muted: false, noiseBuf: null };

function sndNoise(ctx, brown) {
  const n = ctx.sampleRate * 2, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
  let last = 0;
  for (let i = 0; i < n; i++) { const w = Math.random() * 2 - 1; if (brown) { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; } else d[i] = w; }
  return b;
}
function sndLoop(buf) { const s = SND.ctx.createBufferSource(); s.buffer = buf; s.loop = true; return s; }

function sndStart() {
  if (SND.ctx) { if (SND.ctx.state === 'suspended') SND.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  let c; try { c = new AC(); } catch (e) { return; }
  SND.ctx = c;
  SND.master = c.createGain(); SND.master.gain.value = SND.muted ? 0 : CFG.sound.master; SND.master.connect(c.destination);
  SND.brown = sndNoise(c, true); SND.white = sndNoise(c, false);
  // ゴゴゴゴ：低域ノイズ＋低い正弦波、ゆっくり揺らす
  SND.rumbleG = c.createGain(); SND.rumbleG.gain.value = 0; SND.rumbleG.connect(SND.master);
  const n = sndLoop(SND.brown), lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 140;
  n.connect(lp); lp.connect(SND.rumbleG); n.start();
  const o = c.createOscillator(); o.type = 'sine'; o.frequency.value = 38; const og = c.createGain(); og.gain.value = 0.5;
  o.connect(og); og.connect(SND.rumbleG); o.start();
  const lfo = c.createOscillator(); lfo.frequency.value = 3.2; const lg = c.createGain(); lg.gain.value = 0.25;
  lfo.connect(lg); lg.connect(SND.rumbleG.gain); lfo.start();
  // 噴火中の吹き出し音（シュゴォォ）
  SND.hissG = c.createGain(); SND.hissG.gain.value = 0; SND.hissG.connect(SND.master);
  const h = sndLoop(SND.white), bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 500; bp.Q.value = 0.6;
  h.connect(bp); bp.connect(SND.hissG); h.start();
}

// 大噴火の爆発音：ノイズ（高→低に絞る）＋低音スイープ
function sndBoom() {
  const c = SND.ctx; if (!c || c.state !== 'running') return;
  const t = c.currentTime, g = c.createGain();
  g.gain.setValueAtTime(1, t); g.gain.exponentialRampToValueAtTime(0.001, t + 3.2); g.connect(SND.master);
  const s = c.createBufferSource(); s.buffer = SND.white; const f = c.createBiquadFilter(); f.type = 'lowpass';
  f.frequency.setValueAtTime(3500, t); f.frequency.exponentialRampToValueAtTime(70, t + 2.6);
  s.connect(f); f.connect(g); s.start(t); s.stop(t + 3.3);
  const o = c.createOscillator(), og = c.createGain(); o.type = 'sine';
  o.frequency.setValueAtTime(120, t); o.frequency.exponentialRampToValueAtTime(24, t + 2);
  og.gain.setValueAtTime(1.4, t); og.gain.exponentialRampToValueAtTime(0.001, t + 2.8);
  o.connect(og); og.connect(SND.master); o.start(t); o.stop(t + 3);
}

// 毎フレーム：火山の状態に応じて持続音の大きさを変える
function sndUpdate(fx) {
  if (!SND.ctx || !SND.rumbleG) return;
  const S = CFG.sound, now = SND.ctx.currentTime;
  SND.rumbleG.gain.setTargetAtTime(S.rumbleIdle + (S.rumbleErupt - S.rumbleIdle) * fx.k, now, 0.3);
  SND.hissG.gain.setTargetAtTime(0.18 * fx.k, now, 0.4);
}

function sndToggleMute() {
  SND.muted = !SND.muted;
  if (SND.master) SND.master.gain.setTargetAtTime(SND.muted ? 0 : CFG.sound.master, SND.ctx.currentTime, 0.05);
  const el = document.getElementById('mute'); if (el) el.textContent = SND.muted ? '♪ OFF (M)' : '♪ ON (M)';
}

function bindSound() {
  addEventListener('keydown', e => { sndStart(); if (e.code === 'KeyM' && !e.repeat) sndToggleMute(); });
  addEventListener('pointerdown', sndStart);
}
