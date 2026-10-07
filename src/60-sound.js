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
  // マグマ：近づくほど大きくなる低い唸り（ゴゴゴゴ）と、ジュワジュワ（高域ノイズ）
  SND.magmaG = c.createGain(); SND.magmaG.gain.value = 0; SND.magmaG.connect(SND.master);
  const mn = sndLoop(SND.brown); SND.magmaLP = c.createBiquadFilter(); SND.magmaLP.type = 'lowpass'; SND.magmaLP.frequency.value = 90;
  const mmod = c.createGain(); mmod.gain.value = 0.7; mn.connect(SND.magmaLP); SND.magmaLP.connect(mmod); mmod.connect(SND.magmaG); mn.start();   // 揺れは別段のゲインに掛ける（無音時に漏れないように）
  const mo = c.createOscillator(); mo.type = 'sine'; mo.frequency.value = 29; const mog = c.createGain(); mog.gain.value = 0.6; mo.connect(mog); mog.connect(SND.magmaG); mo.start();
  const mlfo = c.createOscillator(); mlfo.frequency.value = 2.1; const mlg = c.createGain(); mlg.gain.value = 0.3; mlfo.connect(mlg); mlg.connect(mmod.gain); mlfo.start();
  SND.sizzleG = c.createGain(); SND.sizzleG.gain.value = 0; SND.sizzleG.connect(SND.master);
  const szmod = c.createGain(); szmod.gain.value = 0.65; const sz = sndLoop(SND.white); SND.sizzleBP = c.createBiquadFilter(); SND.sizzleBP.type = 'bandpass'; SND.sizzleBP.frequency.value = 2600; SND.sizzleBP.Q.value = 0.8;
  const szlfo = c.createOscillator(); szlfo.frequency.value = 9; const szg = c.createGain(); szg.gain.value = 0.35; szlfo.connect(szg); szg.connect(szmod.gain); szlfo.start();   // ジュワジュワと揺らす
  sz.connect(SND.sizzleBP); SND.sizzleBP.connect(szmod); szmod.connect(SND.sizzleG); sz.start();
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


// マグマ接近の持続音。prox = 近さ 0〜1（遠いと 0）
function sndMagmaUpdate(prox) {
  if (!SND.ctx || !SND.magmaG) return;
  const S = CFG.sound, now = SND.ctx.currentTime, p = Math.pow(prox, 1.3);
  SND.magmaG.gain.setTargetAtTime(S.magmaRumble * p, now, 0.2);
  SND.magmaLP.frequency.setTargetAtTime(70 + 330 * p, now, 0.2);   // 近いほど低音に張りが出る
  SND.sizzleG.gain.setTargetAtTime(S.magmaSizzle * p, now, 0.2);
  SND.sizzleBP.frequency.setTargetAtTime(1800 + 1800 * p, now, 0.3);
}

// マグマに飲まれた音「ジュワッ」：高域ノイズが一気に沈み、ボコボコと低音
function sndMagmaDeath() {
  const c = SND.ctx; if (!c || c.state !== 'running') return;
  const t = c.currentTime, g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.9, t + 0.04); g.gain.exponentialRampToValueAtTime(0.001, t + 1.6); g.connect(SND.master);
  const s = c.createBufferSource(); s.buffer = SND.white; const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.1;
  f.frequency.setValueAtTime(5200, t); f.frequency.exponentialRampToValueAtTime(500, t + 1.4);
  s.connect(f); f.connect(g); s.start(t); s.stop(t + 1.7);
  const o = c.createOscillator(), og = c.createGain(); o.type = 'sine'; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(30, t + 0.9);
  og.gain.setValueAtTime(0.9, t); og.gain.exponentialRampToValueAtTime(0.001, t + 1.1); o.connect(og); og.connect(SND.master); o.start(t); o.stop(t + 1.2);
  for (let i = 0; i < 4; i++) {   // ボコッ、ボコッ
    const b = c.createOscillator(), bg = c.createGain(), tb = t + 0.25 + i * 0.17 + Math.random() * 0.05; b.type = 'sine';
    b.frequency.setValueAtTime(160 + Math.random() * 60, tb); b.frequency.exponentialRampToValueAtTime(60, tb + 0.12);
    bg.gain.setValueAtTime(0.0001, tb); bg.gain.exponentialRampToValueAtTime(0.35, tb + 0.015); bg.gain.exponentialRampToValueAtTime(0.001, tb + 0.14);
    b.connect(bg); bg.connect(SND.master); b.start(tb); b.stop(tb + 0.16);
  }
}

// 恐竜の短い悲鳴「キュィィ……」：高い声が急に下がって消える
function sndDinoDie() {
  const c = SND.ctx; if (!c || c.state !== 'running') return;
  const t = c.currentTime, g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.3, t + 0.03); g.gain.exponentialRampToValueAtTime(0.001, t + 0.75); g.connect(SND.master);
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.4; f.frequency.setValueAtTime(2000, t); f.frequency.exponentialRampToValueAtTime(500, t + 0.7); f.connect(g);
  const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(180, t + 0.7);
  const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 22; lg.gain.value = 40; l.connect(lg); lg.connect(o.frequency);
  o.connect(f); o.start(t); l.start(t); o.stop(t + 0.8); l.stop(t + 0.8);
}

// 噴石の落下音「ヒュゥゥゥ」：高い音から低い音へ。大きい石ほど低く重い。dur=着弾までの秒
function sndRockFall(dur, size) {
  const c = SND.ctx; if (!c || c.state !== 'running') return;
  const big = size === 'large' ? 2 : size === 'mid' ? 1 : 0, t = c.currentTime;
  const g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16 + big * 0.06, t + dur * 0.85); g.gain.linearRampToValueAtTime(0, t + dur + 0.03); g.connect(SND.master);
  const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(2300 - big * 600, t); o.frequency.exponentialRampToValueAtTime(520 - big * 120, t + dur);
  o.connect(g); o.start(t); o.stop(t + dur + 0.05);
  const n = c.createBufferSource(); n.buffer = SND.white; const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.Q.value = 3;
  bp.frequency.setValueAtTime(1800 - big * 400, t); bp.frequency.exponentialRampToValueAtTime(400, t + dur);
  const ng = c.createGain(); ng.gain.value = 0.6; n.connect(bp); bp.connect(ng); ng.connect(g); n.start(t); n.stop(t + dur + 0.05);
}

// 着弾「ドゴン！」：サイズで重さを変える（低音スイープ＋ノイズ）
function sndRockImpact(size) {
  const c = SND.ctx; if (!c || c.state !== 'running') return;
  const P = { small: [150, 45, 0.5, 0.7], mid: [110, 32, 0.85, 1.0], large: [80, 20, 1.5, 1.5] }[size] || [110, 32, 0.85, 1];
  const t = c.currentTime;
  const og = c.createGain(); og.gain.setValueAtTime(P[3], t); og.gain.exponentialRampToValueAtTime(0.001, t + P[2]); og.connect(SND.master);
  const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(P[0], t); o.frequency.exponentialRampToValueAtTime(P[1], t + P[2] * 0.8);
  o.connect(og); o.start(t); o.stop(t + P[2] + 0.05);
  const ng = c.createGain(); ng.gain.setValueAtTime(P[3] * 0.8, t); ng.gain.exponentialRampToValueAtTime(0.001, t + P[2] * 0.7); ng.connect(SND.master);
  const n = c.createBufferSource(); n.buffer = SND.white; const f = c.createBiquadFilter(); f.type = 'lowpass';
  f.frequency.setValueAtTime(2500, t); f.frequency.exponentialRampToValueAtTime(80, t + P[2] * 0.6);
  n.connect(f); f.connect(ng); n.start(t); n.stop(t + P[2] + 0.05);
}

// 恐竜の悲鳴「ギャーー」：のこぎり波を上から下へ、ビブラート付き
function sndScream() {
  const c = SND.ctx; if (!c || c.state !== 'running') return;
  const t = c.currentTime, g = c.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.28, t + 0.05); g.gain.exponentialRampToValueAtTime(0.001, t + 0.9); g.connect(SND.master);
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2; f.frequency.setValueAtTime(1400, t); f.frequency.exponentialRampToValueAtTime(600, t + 0.8); f.connect(g);
  const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.setValueAtTime(620, t); o.frequency.exponentialRampToValueAtTime(240, t + 0.85);
  const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = 15; lg.gain.value = 28; l.connect(lg); lg.connect(o.frequency);
  o.connect(f); o.start(t); l.start(t); o.stop(t + 0.95); l.stop(t + 0.95);
}

// 障害物にぶつかった「ドン！」：strength 0〜1（クレーターは弱く、マグマ溜まりはジュッと混ざる）
function sndThud(strength, sizzle) {
  const c = SND.ctx; if (!c || c.state !== 'running') return;
  const t = c.currentTime, v = 0.5 + 0.5 * strength;
  const og = c.createGain(); og.gain.setValueAtTime(0.9 * v, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.32); og.connect(SND.master);
  const o = c.createOscillator(); o.type = 'sine'; o.frequency.setValueAtTime(140, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.25); o.connect(og); o.start(t); o.stop(t + 0.35);
  const ng = c.createGain(); ng.gain.setValueAtTime(0.5 * v, t); ng.gain.exponentialRampToValueAtTime(0.001, t + (sizzle ? 0.5 : 0.18)); ng.connect(SND.master);
  const n = c.createBufferSource(); n.buffer = SND.white; const f = c.createBiquadFilter(); f.type = sizzle ? 'bandpass' : 'lowpass';
  f.frequency.setValueAtTime(sizzle ? 3000 : 1800, t); f.frequency.exponentialRampToValueAtTime(sizzle ? 1200 : 120, t + 0.2); n.connect(f); f.connect(ng); n.start(t); n.stop(t + 0.55);
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
