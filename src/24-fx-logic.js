// ===== 演出の純ロジック（three.js 非依存。verify.html でテスト）=====
// 画面揺れの合成と上限・ヒットストップ・音のダッキング・足音のタイミング・危険マーカーの近さ・つぶれ。
// ゲーム時間（物理）には触らない：ヒットストップは「ゲーム時間を進めない」だけで、演出側の時計は続く。
const FX_PI = Math.PI;
function fxClamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function fxInt() { return fxClamp01(CFG.fx.intensity); }

function fxNew() { return { hitstop: 0, duckDepth: 0, duckHold: 0, cool: {} }; }
function fxReset(F) { F.hitstop = 0; F.duckDepth = 0; F.duckHold = 0; F.cool = {}; }

// 画面揺れ：複数の揺れの大きさを二乗和の平方根で合成し、上限 cap で頭打ちにする（足し算だと重なったとき操作不能になる）
function fxShakeCombine(amps, cap) {
  let s = 0; for (const a of amps) if (a > 0) s += a * a;
  return Math.min(cap, Math.sqrt(s));
}
// 実際にカメラへ足す揺れの大きさ（演出の強さを掛ける）
function fxShakeTotal(amps) { return fxShakeCombine(amps, CFG.fx.shake.cap) * fxInt(); }

// ヒットストップ：sec 秒ゲーム時間を止める。重なったら長いほうを採用。上限あり
function fxHitstop(F, sec) { const H = CFG.fx.hitstop; F.hitstop = Math.max(F.hitstop, Math.min(H.max, sec * fxInt())); }
// 実時間 dt を渡す。止めるべきフレームなら true（その間ゲームは進めない）。止まる合計は hitstop 秒
function fxHitstopStep(F, dt) {
  if (F.hitstop <= 0) return false;
  F.hitstop = Math.max(0, F.hitstop - dt); return true;
}

// ダッキング：大きな音のとき他の音を下げる。depth=下げる深さ（0〜0.9）, hold=そのままの秒。戻りは release 秒かけて線形
function fxDuck(F, depth, hold) {
  F.duckDepth = Math.min(0.9, Math.max(F.duckDepth, depth * fxInt()));
  F.duckHold = Math.max(F.duckHold, hold == null ? CFG.fx.duck.hold : hold);
}
// 毎フレーム：音量の倍率（1=そのまま、下がると 1-depth）を返す
function fxDuckStep(F, dt) {
  if (F.duckHold > 0) F.duckHold = Math.max(0, F.duckHold - dt);
  else if (F.duckDepth > 0) F.duckDepth = Math.max(0, F.duckDepth - dt / CFG.fx.duck.release);
  return 1 - F.duckDepth;
}

// 足音：脚の位相 phase（ラジアン）が π を跨ぐたびに 1 歩。1 フレームに出す回数は 2 まで
function fxStepCount(prevPhase, phase) {
  if (!(phase > prevPhase)) return 0;
  return Math.min(2, Math.floor(phase / FX_PI) - Math.floor(prevPhase / FX_PI));
}

// 連続で鳴らさないための間隔ゲート（key ごと）。鳴らしてよければ true
function fxCooldown(F, key, now, gap) {
  const last = F.cool[key];
  if (last !== undefined && now - last < gap) return false;
  F.cool[key] = now; return true;
}

// 危険マーカーの近さ：まだ着弾していない噴石のうち、円の縁から恐竜までの水平距離が最小のもの。nearness は range で 1→0
function fxNearRock(rocks, P, range) {
  let best = Infinity;
  for (const r of rocks) {
    if (r.t >= r.warn) continue;
    const d = Math.max(0, Math.hypot(r.x - P.x, r.z - P.z) - r.radius);
    if (d < best) best = d;
  }
  return { d: best, nearness: best === Infinity ? 0 : fxClamp01(1 - best / range) };
}

// レーン移動の「入り→戻り」の山（-1〜1）。移動中でなければ 0。符号は移動方向（+1 = 右）、大きさは sin(π×進み具合) で 0 → 1 → 0（移動の秒 lane.shiftSec に合わせる）
function laneLean(P) {
  if (!P.laneMove || P.state !== 'run') return 0;
  const dir = Math.sign(laneX(P.lane) - P.laneFrom), u = clamp01(P.laneT / CFG.lane.shiftSec);
  return dir * Math.sin(Math.PI * u);
}
// 現在の値 cur を目標 target へなめらかに寄せる（連続した移動でもガクつかない）。dt 秒、追従の速さ follow
function laneLeanFollow(cur, target, dt) { return cur + (target - cur) * (1 - Math.exp(-CFG.dino.laneMove.follow * dt)); }
// レーン移動の専用ポーズの各部の角度（lean = -1〜1）。上限つき：体の傾き roll・ひねり yaw・頭 head・尻尾 tail（反対へ振る）・脚の開き（進む側の脚 legOut、反対の脚 legIn）
function laneMovePose(lean) {
  const K = CFG.dino.laneMove, m = Math.abs(lean);
  return { roll: -lean * K.roll, yaw: -lean * K.yaw, head: -lean * K.head, tail: -lean * K.tail, legR: lean > 0 ? lean * K.legOut : lean * K.legIn, legL: lean < 0 ? lean * K.legOut : lean * K.legIn, dip: m * K.dip };
}
