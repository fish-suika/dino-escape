// ===== 火山の噴火状態（純ロジック。経過秒 → 状態。three.js 非依存） =====
function smooth01(x) { x = Math.max(0, Math.min(1, x)); return x * x * (3 - 2 * x); }

// t = ゲーム開始からの秒。k = 噴火強度 0〜1、smoke = 煙の量（噴火前も少しある）
function volcanoState(t) {
  const V = CFG.volcano;
  if (!(t >= V.eruptDelay)) return { state: 'idle', k: 0, smoke: V.idleSmoke, shake: 0, flash: 0, boom: false };
  const e = t - V.eruptDelay, k = smooth01(e / V.rampTime);
  const sh = Math.max(0, 1 - e / V.shakeDur), fl = Math.max(0, 1 - e / V.flashDur);
  return { state: 'erupting', k, smoke: V.idleSmoke + (1 - V.idleSmoke) * k, shake: V.shakeAmp * sh * sh, flash: V.flashMax * fl * fl, boom: e < V.boomDur };
}
