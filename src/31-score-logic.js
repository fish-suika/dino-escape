// ===== スコアとベストスコア（純ロジック。three.js 非依存。verify.html でテスト）=====
// スコア = 走った距離(m) + ボーナス。ボーナスは scoreStep が毎フレーム見て加算し、画面に出すもの（「+100」「GREAT ESCAPE!」）は S.events に積む。
// 重複加点を防ぐ：噴石は id ごとに 1 回（S.done）、障害物も id ごとに 1 回（S.passed）。被弾した噴石・ぶつかった障害物は加点なし。
function newScore() { return { bonus: 0, combo: 0, bestCombo: 0, nearT: 0, nearSec: 0, inside: {}, done: {}, passed: {}, n: { great: 0, big: 0, combo: 0, magma: 0 }, events: [] }; }

function scoreTotal(S, P, dist) { return Math.floor(dist != null ? dist : P.dist) + S.bonus; }

function scoreAdd(S, kind, pts, text) {
  S.bonus += pts;
  const e = { kind, pts, text }; S.events.push(e); return e;
}
function scoreTake(S) { const e = S.events; S.events = []; return e; }   // 画面に出す分を取り出す（取り出したら空になる）

// stepGame のあと毎フレーム呼ぶ。ev は stepGame の戻り値
function scoreStep(S, G, ev, dt) {
  const { P, M, RS, OB } = G, SC = CFG.score, H = CFG.hit, O = CFG.obstacle;
  // 1) 噴石：着弾の瞬間に判定。直撃ならコンボも切れる
  for (const l of ev.landed) {
    const r = l.rock;
    if (S.done[r.id]) continue;
    S.done[r.id] = true;
    const was = S.inside[r.id]; delete S.inside[r.id];
    if (l.hit) { S.combo = 0; continue; }
    if (P.state !== 'run' || P.invuln > 0) continue;            // 吹き飛び中・復帰後の無敵中は加点しない
    const R = r.radius + H.dinoR, ratio = Math.hypot(P.x - r.x, P.z - r.z) / R, large = r.size === 'large';
    const near = ratio <= SC.near.hi && ratio >= SC.near.lo;   // ギリギリ（円の外すぐ）
    if (near || (large && was)) {                                // 大型は、警告円の中にいたのに着弾までに出て逃げ切ったときも
      if (large) { S.n.big++; scoreAdd(S, 'big', SC.rockLarge, TEXT.big); }
      else { S.n.great++; scoreAdd(S, 'great', SC.rock, TEXT.great); }
    }
  }
  // 着弾前の噴石：警告円（着弾半径＋恐竜半径）の中に入ったことがあるかを覚える
  if (P.state === 'run') for (const r of RS.rocks) if (!S.inside[r.id] && Math.hypot(P.x - r.x, P.z - r.z) < r.radius + H.dinoR) S.inside[r.id] = true;
  // 2) 障害物：ぶつかったらコンボが切れる。通り過ぎたら（ぶつからず・近くを通った）コンボが 1 つ増える
  if (ev.obstacle && ev.obstacle.hits.length) S.combo = 0;
  if (OB && M.phase === 'playing') {
    for (const ob of OB.list) {
      if (S.passed[ob.id]) continue;
      const depth = ob.type === 'crater' || ob.type === 'pool' ? ob.r : ob.hd;
      if (P.z > ob.z - depth - O.depthPad) continue;             // まだ通り過ぎていない（前方は -z）
      S.passed[ob.id] = true;
      if (ob.hit || P.state !== 'run' || P.invuln > 0) continue;
      if (Math.abs(P.x - ob.x) > ob.hw + O.dinoR + SC.comboLateral) continue;   // 遠くを通っただけ：回避とは数えない（コンボは切れない）
      S.combo++; S.bestCombo = Math.max(S.bestCombo, S.combo);
      if (S.combo >= SC.comboFrom) { S.n.combo++; scoreAdd(S, 'combo', SC.comboMul * Math.min(S.combo, SC.comboCap), TEXT.combo + S.combo); }
    }
  }
  // 3) マグマが近い状態で走り続けた：連続 1 秒ごと
  if (M.phase === 'playing' && M.active && P.state === 'run' && magmaGap(M, P) < SC.magmaGap) {
    S.nearT += dt;
    while (S.nearT >= S.nearSec + 1) { S.nearSec++; S.n.magma++; scoreAdd(S, 'magma', SC.magmaPerSec, TEXT.magmaRun); }
  } else { S.nearT = 0; S.nearSec = 0; }
}

// ---- ベストスコア：localStorage（使えない・例外でも落ちない。st は getItem/setItem を持つもの。null でも可）----
function bestStorage() { try { return window.localStorage || null; } catch (e) { return null; } }   // file:// やプライベートモードでは例外になることがある
function bestRead(st) {
  try { const n = parseInt(st.getItem(CFG.score.bestKey), 10); return n > 0 ? n : 0; } catch (e) { return 0; }
}
function bestWrite(st, score) {
  try { st.setItem(CFG.score.bestKey, String(score)); return true; } catch (e) { return false; }
}
