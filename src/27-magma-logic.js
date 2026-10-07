// ===== マグマと一回のゲーム進行（純ロジック。three.js 非依存） =====
// 位置は「走行距離（dist）の座標」で持つ。M.front＝マグマ先端の位置、P.dist＝プレイヤーの位置。前方ほど大きい
// 差（gap）= P.dist - M.front が 0 以下になったらゲームオーバー（ジャンプ中でも関係なし）
function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }

function newMagma() { return { phase: 'playing', active: false, front: -CFG.magma.startGap, speed: 0, t: 0, deadT: 0, deathDist: 0 }; }
function newGame() { return { P: newPlayer(), M: newMagma(), RS: newRockSched(), OB: newObstacles() }; }

// 噴火してから e 秒後のマグマの速さ
function magmaSpeedAt(e) { const C = CFG.magma; return Math.min(C.speedMax, C.speed0 + C.accel * Math.max(0, e)); }
function magmaGap(M, P) { return P.dist - M.front; }
// 近さ 0〜1（range 以上離れていれば 0、接触で 1）
function magmaProx(gap, range) { return clamp01(1 - gap / range); }
// HUD のゲージ：点灯する点の数（0〜dangerGaps.length）。近いほど多い
function magmaDanger(gap) { let n = 0; for (const g of CFG.magma.dangerGaps) if (gap < g) n++; return n; }

// マグマを 1 フレーム進める。このフレームで追いつかれたら true
function stepMagma(M, P, dt, erupting) {
  const C = CFG.magma;
  if (M.phase === 'dead') {   // 死亡後：先端はプレイヤーを少し越えるまで進んで止まる（溶岩面が恐竜に被さる）
    M.deadT += dt;
    const cap = M.deathDist + C.deathOvershoot;
    M.speed = 0;
    M.front += (cap - M.front) * (1 - Math.exp(-6 * dt));   // なめらかに越えて止まる（cap は超えない）
    return false;
  }
  if (!M.active) {
    M.front = P.dist - C.startGap;   // 噴火前は動かない（常に startGap だけ後ろで待機）
    if (!erupting) return false;
    M.active = true;
  }
  M.t += dt; M.speed = magmaSpeedAt(M.t); M.front += M.speed * dt;
  if (P.dist - M.front <= 0) {
    M.phase = 'dead'; M.deadT = 0; M.deathDist = P.dist; M.front = P.dist;
    P.state = 'dead'; P.stateT = 0; P.vx = 0; P.vy = 0; P.kvx = 0; P.kvf = 0; P.invuln = 0; P.slow = 0; P.tumble = 0;
    if (P.y < 0.05) { P.y = 0; P.grounded = true; }
    return true;
  }
  return false;
}

// ゲーム全体を 1 フレーム進める。G = { P, M, RS }。playing の間だけ前進・操作・噴石の新規生成が動く。
// dead の間はプレイヤーは動かず（P.stateT は死亡演出の経過秒）、噴石は新しく出ないが、すでに落下中のものは着弾する。
function stepGame(G, inp, dt, rng) {
  const { P, M, RS, OB } = G, ev = { spawned: [], landed: [], died: false, obstacle: { hits: [], spawned: [], removed: 0 } };
  if (M.phase === 'playing') {
    stepPlayer(P, inp, dt);
    if (OB) ev.obstacle = stepObstacles(OB, P, dt);
    const erupting = volcanoState(P.time).state === 'erupting';
    const r = stepRocks(RS, P, dt, erupting, rng); ev.spawned = r.spawned; ev.landed = r.landed;
    ev.died = stepMagma(M, P, dt, erupting);
  } else {
    P.stateT += dt;
    const r = stepRocks(RS, P, dt, false, rng); ev.landed = r.landed;
    stepMagma(M, P, dt, false);
  }
  return ev;
}

// 全状態を初期化（オブジェクトの参照は変えず、中身だけ入れ替える）
function resetGame(G, seed) {
  Object.assign(G.P, newPlayer()); Object.assign(G.M, newMagma()); Object.assign(G.RS, newRockSched()); Object.assign(G.OB, newObstacles(seed));
  return G;
}
