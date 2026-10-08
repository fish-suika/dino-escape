// ===== 難易度（純ロジック。three.js 非依存）=====
// 基準の時間 e＝「噴火が始まってからの秒」（= P.time - volcano.eruptDelay）。マグマも噴石も噴火で動き出すので、資料 §17 の
// 0〜20 / 20〜40 / 40〜60 / 60秒以降 は、この e で数える（ゲーム開始から数えると噴火前の 4 秒ぶんチュートリアルが短くなるため）。
// 強度 s（0〜1）は区間の境目でなめらかに（折れ線で連続）つながり、階段状には変わらない。噴石の間隔・大型率・マグマの速さ・障害物の密度・画面揺れは全部この s から決まる。
const STAGE_NAMES = ['tutorial', 'normal', 'danger', 'final'];

function difficultyAt(e) {
  const D = CFG.difficulty, K = D.knots;
  if (!(e > 0)) e = 0;
  let s = K[K.length - 1][1];
  for (let i = 1; i < K.length; i++) {
    if (e < K[i][0]) { s = obLerp(K[i - 1][1], K[i][1], (e - K[i - 1][0]) / (K[i][0] - K[i - 1][0])); break; }
  }
  let stage = 0;
  for (let i = 0; i < D.stageFrom.length; i++) if (e >= D.stageFrom[i]) stage = i;
  const last = stage >= D.stageFrom.length - 1, a = D.stageFrom[stage], b = last ? a : D.stageFrom[stage + 1];
  return { e, s, stage, next: last ? stage : stage + 1, blend: last ? 1 : (e - a) / (b - a), name: STAGE_NAMES[stage], label: D.labels[stage] };
}

// 距離 → 「ふつうに走ったときの噴火後の秒」。障害物は距離で決まる（seed と距離だけで再現できる）ので、距離から難易度を引くのに使う。被弾の減速は考えない
function nominalTime(dist) {
  const a = CFG.run.accel / 2, b = CFG.run.baseSpeed, d = Math.max(0, dist);
  const t = a > 0 ? (-b + Math.sqrt(b * b + 4 * a * d)) / (2 * a) : d / b;
  const tMax = (CFG.run.maxSpeed - CFG.run.baseSpeed) / CFG.run.accel;   // 最高速に達してからは等速
  return t <= tMax ? t : tMax + (d - (b * tMax + a * tMax * tMax)) / CFG.run.maxSpeed;
}
function difficultyAtDist(dist) { return difficultyAt(nominalTime(dist) - CFG.volcano.eruptDelay); }
// その距離でのふつうの走る速さ ÷ 基準速度（障害物の間隔を速さに比例して広げるのに使う。1 以上）
function speedScaleAtDist(dist) { return speedAt(nominalTime(dist)) / CFG.run.baseSpeed; }

// 噴石：強度 s での 落下間隔 / 同時数の上限 / 大きさの重み。s が null/undefined なら従来の固定値（Phase 3 の挙動）
function rockParams(s) {
  const R = CFG.rock, D = CFG.difficulty.rock;
  if (s == null) return { interval: R.interval, maxActive: R.maxActive, weights: R.weights, aim: R.aimChance };
  const w0 = D.weights0, w1 = D.weights1, u = smooth01((s - D.largeFrom) / (1 - D.largeFrom));   // 大型は強度 largeFrom（= 40 秒時点）まで 0、そこから増える
  const large = w1.large * u, rest = 1 - large;
  const sm = obLerp(w0.small, w1.small, s), md = obLerp(w0.mid, w1.mid, s), sum = sm + md;
  return { interval: obLerp(D.interval0, D.interval1, Math.pow(s, D.curve)), maxActive: Math.min(R.maxActive, Math.round(obLerp(D.active0, D.active1, s))), aim: obLerp(D.aim0, D.aim1, s),
           weights: { small: rest * sm / sum, mid: rest * md / sum, large } };
}

// マグマの速さ：噴火後 e 秒。強度 s にそって speed0 → speedMax（序盤遅く・中盤少しずつ・終盤かなり速く）
function magmaSpeedAt(e) {
  const C = CFG.magma;
  return obLerp(C.speed0, C.speedMax, Math.pow(difficultyAt(e).s, CFG.difficulty.magmaCurve));
}

// 60 秒以降の常時の小刻みな画面揺れの大きさ（位置のみ）。final の少し前から 0 → amp
function finalShake(e) { const S = CFG.difficulty.shake; return S.amp * smooth01((e - S.from) / S.over); }
// 噴火の迫力の倍率（0〜1）。強度が上がるほど最大へ
function eruptionMul(s) { const E = CFG.difficulty.eruptMul; return obLerp(E, 1, s); }

// クリア：走行距離が goal.distance に届いた
function reachedGoal(G) { return G.P.dist >= CFG.goal.distance; }

// マグマの「ひるみ」：先端が近いほど少しだけ遅くなる（rubber band）。被弾でじわじわ追いつかれても、近づいたぶん少し猶予が生まれて「ギリギリ逃げ切る」展開になる。
// gap >= range なら 1.0（影響なし）、gap = 0 で min。被弾なしで走っている間は gap が range より大きいので効かない
function magmaRubber(gap) { const C = CFG.magma; return obLerp(C.rubberMin, 1, clamp01(gap / C.rubberRange)); }
