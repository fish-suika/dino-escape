// ===== 障害物（純ロジック。three.js 非依存）=====
// 岩・倒木・クレーター・マグマ溜まり（地上の障害物＝レーンを変えて避ける）とアーチ（頭上＝くぐる）を、走行距離に沿って「行」ごとに決める。
// 1 つの行 = 同じ z の横一列。地上の障害物は 1 レーン幅（倒木も 1 レーン）で、1 行で塞ぐのは最大 2 レーン（3 レーンすべては塞がない）。
// 行は手前から順に作り、前の行との間隔は「いちばん不利なレーンからでも、通れるレーンへ移れる時間（レーン移動×必要レーン数＋反応時間）」以上に広げる。
// 結果は seed と level だけで決まる（同じ引数なら同じ。取り出す範囲の切り方にも依らない）。
function obRng(seed, k) {   // (seed, k) から作る小さな乱数列（mulberry32）
  let h = (seed | 0) ^ Math.imul((k + 1) | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); h ^= h >>> 16;
  let s = h >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function obLerp(a, b, t) { return a + (b - a) * t; }

// その距離を「ふつうに走ったとき」の速さ（u/s）。行の間隔を速さに比例して広げるのに使う
function obSpeedAt(dist) { return speedAt(nominalTime(dist)); }
// 障害物の前後の広がり（この範囲に入ると触れる）
function obExtent(ob) { return (ob.type === 'crater' || ob.type === 'pool' ? ob.r : ob.hd) + CFG.obstacle.depthPad; }

// アーチの支えの柱の位置（アーチの中心から左右 ±x）。幅 n レーンのアーチは、通る n レーンの外側の境目（またはその外）にだけ柱を立てる＝走るレーンの中には立てない。
// inner = 柱の内側のふち、gap = 柱のふちから、最も近いレーン中心（走る位置）までの距離。見た目（38-obstacles.js）も同じ値を使う
function archPostSpec(n) {
  const A = CFG.obstacle.arch, W = CFG.lane.width, P = A.post, x = n * W / 2 + P.off, inner = x - P.r;
  const outer = x + P.reach, c0= n % 2 ? 0 : W / 2;   // 走る位置（レーン中心）は n が奇数なら W の倍数、偶数なら W/2 + W の倍数
  let gap = Infinity; for (let k = -6; k <= 6; k++) { const c = c0 + k * W; gap = Math.min(gap, c < inner ? inner - c : c > outer ? c - outer : 0); }
  return { x, inner, outer, gap };
}

// 障害物 1 個を作る。lanes = 占有するレーン番号（地上の障害物は 1 つ、アーチは 1〜2）。a・b は 0〜1 の乱数（大きさのばらつき）
function obMake(type, lanes, dist, a, b) {
  const O = CFG.obstacle, W = CFG.lane.width, ob = { type, dist, z: -dist, hit: false, lanes: lanes.slice() };
  ob.x = lanes.reduce((s, i) => s + laneX(i), 0) / lanes.length;
  if (type === 'rock') {
    const R = O.rock, r = obLerp(R.rMin, R.rMax, a);
    Object.assign(ob, { r, h: obLerp(R.hMin, R.hMax, b), hw: r * R.shrink, hd: r * R.shrink });
  } else if (type === 'log') {   // 倒木：1 レーン幅の短い丸太（複数のレーンは塞がない）
    const Lg = O.log;
    Object.assign(ob, { len: Lg.len, h: Lg.r * 2, hw: Lg.len / 2, hd: Lg.r, r: Lg.r });
  } else if (type === 'crater') {
    const r = obLerp(O.crater.rMin, O.crater.rMax, a);
    Object.assign(ob, { r, h: 0, hw: r, hd: r });
  } else if (type === 'pool') {
    const r = obLerp(O.pool.rMin, O.pool.rMax, a);
    Object.assign(ob, { r, h: 0, hw: r, hd: r });
  } else {   // arch：梁が clear の高さにかかる。立ったままだと頭が当たり、滑走（くぐる）なら通れる
    const A = O.arch, hw = lanes.length * W / 2 - A.inset;
    Object.assign(ob, { hw, hd: A.hd, r: A.hd, h: A.clear, clear: A.clear, top: A.clear + A.beamH });
  }
  return ob;
}

// 行の配置が生成済みのものを覚えておく（seed×level ごと）。手前から順に作るので、どの範囲から取り出しても同じ結果になる
const OBGEN = new Map();
function obGen(seed, level) {
  const key = (seed | 0) + '|' + (level || 0);
  let G = OBGEN.get(key);
  if (!G) {
    G = { seed: seed | 0, level: level || 0, rows: [], k: 0, end: CFG.obstacle.startDist - 30, prev: null };
    OBGEN.set(key, G);
    if (OBGEN.size > 24) OBGEN.delete(OBGEN.keys().next().value);
  }
  return G;
}
function obGenClear() { OBGEN.clear(); }   // CFG を書き換えたあと（テスト用）に作り直させる

// 前の行の通れるレーン prevPass から、次の行の通れるレーン pass へ、どのレーンにいても移れるために必要な秒（レーン移動の回数×1 回の秒＋反応時間）
function obNeedSec(prevPass, pass) {
  const L = CFG.lane, g = CFG.obstacle.gap;
  if (!prevPass) return 0;
  let n = 0;
  for (const i of prevPass) { let m = 9; for (const j of pass) m = Math.min(m, Math.abs(i - j)); n = Math.max(n, m); }
  return n > 0 ? n * (L.shiftSec + g.moveExtra) + g.react : 0;
}

// 次の行を 1 つ作る
function obGenRow(G) {
  const O = CFG.obstacle, g = O.gap, nL = CFG.lane.count, rng = obRng(G.seed, G.k++);
  const dApprox = G.end + 25, dMin = Math.max(G.end + 8, O.startDist), s = clamp01(difficultyAtDist(dApprox).s + G.level);
  const pickR = rng(), laneR = rng(), nR = rng(), pairR = rng(), lane2R = rng(), type2R = rng(), a = rng(), b = rng(), a2 = rng(), b2 = rng(), jit = rng();
  const types = ['rock', 'log', 'crater', 'pool', 'arch'].filter(t => dMin - O.startDist >= O.unlock[t] && O.weights[t] > 0);
  let tot = 0; for (const t of types) tot += O.weights[t];
  let x = pickR * tot, type = types[types.length - 1];
  for (const t of types) { if (x < O.weights[t]) { type = t; break; } x -= O.weights[t]; }
  const obs = [];
  let blocked = [], pass;
  if (type === 'arch') {
    const lanes = nR < O.arch.oneLane ? [Math.min(nL - 1, Math.floor(laneR * nL))] : (() => { const p = Math.min(nL - 2, Math.floor(laneR * (nL - 1))); return [p, p + 1]; })();
    obs.push(obMake('arch', lanes, 0, a, b)); pass = [...Array(nL).keys()];   // アーチの下はくぐれば通れる＝全レーン
  } else {
    const ln = Math.min(nL - 1, Math.floor(laneR * nL));
    obs.push(obMake(type, [ln], 0, a, b)); blocked = [ln];
    if (dMin - O.startDist >= O.pair.from && pairR < obLerp(O.pair.p0, O.pair.p1, s)) {   // 2 レーン塞ぐ行（残り 1 レーン）
      const ln2 = (ln + 1 + Math.min(nL - 2, Math.floor(lane2R * (nL - 1)))) % nL, t2 = ['rock', 'log', 'crater'][Math.min(2, Math.floor(type2R * 3))];
      obs.push(obMake(t2, [ln2], 0, a2, b2)); blocked.push(ln2);
    }
    pass = [...Array(nL).keys()].filter(i => blocked.indexOf(i) < 0);
  }
  const arch = type === 'arch', ext = Math.max(...obs.map(obExtent));
  let T = Math.max(g.min, obNeedSec(G.prev && G.prev.pass, pass));
  let target = obLerp(g.start, g.end, s) * (1 - g.jitter + 2 * g.jitter * jit);
  if (arch || (G.prev && G.prev.arch)) { T = Math.max(T, g.archSec); target = Math.max(target, g.archSec); }
  const sec = Math.max(T, target), v0 = obSpeedAt(G.end), v = obSpeedAt(G.end + 2 * sec * v0 * g.margin);   // 速さは先のほうで速い＝大きいほうを使う（安全側）
  const dist = G.end + sec * v * g.margin + ext;
  for (const ob of obs) { ob.dist = dist; ob.z = -dist; }
  const row = { k: G.k - 1, dist, start: dist - ext, end: dist + ext, obs, blocked, pass, arch, type: obs[0].type };
  obs.forEach(ob => { ob.row = row.k; });
  G.rows.push(row); G.end = row.end; G.prev = row;
  return row;
}

// 走行距離 toDist まで（それを越える行が 1 つできるまで）作っておく。返すのは生成済みの全行（読み取り専用）
function obRows(seed, toDist, level) {
  const G = obGen(seed, level);
  while (!G.rows.length || G.rows[G.rows.length - 1].dist < toDist) obGenRow(G);
  return G.rows;
}

// 走行距離 [-zFrom, -zTo) にある障害物を、手前（スタート側）から順に返す（zFrom > zTo。z は前方が負）。同じ引数なら同じ結果。返すのは作業用のコピー
function planObstacles(seed, zFrom, zTo, level) {
  const d0 = -zFrom, d1 = -zTo, out = [], rows = obRows(seed, d1, level);
  for (const r of rows) {
    if (r.dist >= d1) break;
    if (r.dist < d0) continue;
    for (const ob of r.obs) out.push(Object.assign({}, ob, { lanes: ob.lanes.slice() }));
  }
  return out;
}

// 行の列 rows に「通れる経路」があるか。各行で通れるレーン（地上の障害物が無い、またはアーチ）の集合から、レーン移動の時間（1 レーン shiftSec＋反応時間 react）を
// 考えて最後まで到達できるか（ok）。さらに、どの通れるレーンからでも次の行の通れるレーンへ間に合うか（robust＝行き止まりが無い）。minSlack は余った秒のうち最小のもの
function obRouteCheck(rows) {
  const L = CFG.lane, g = CFG.obstacle.gap;
  let S = null, prev = null, robust = true, minSlack = Infinity;
  for (const r of rows) {
    if (!r.pass.length) return { ok: false, robust: false, minSlack: -Infinity, at: r.k };
    if (!prev) S = r.pass.slice();
    else {
      const T = (r.start - prev.end) / obSpeedAt(r.start), need = (i, j) => i === j ? 0 : Math.abs(i - j) * L.shiftSec + g.react;
      for (const i of prev.pass) {
        let best = -Infinity; for (const j of r.pass) best = Math.max(best, T - need(i, j));
        if (best < 0) robust = false; minSlack = Math.min(minSlack, best);
      }
      S = r.pass.filter(j => S.some(i => T >= need(i, j)));
      if (!S.length) return { ok: false, robust: false, minSlack, at: r.k };
    }
    prev = r;
  }
  return { ok: true, robust, minSlack };
}

function newObstacles(seed) {
  return { seed: seed == null ? CFG.obstacle.seed : seed, list: [], nextId: 1, genDist: 0, prevZ: 0, off: false, level: 0 };
}

// 岩・倒木・マグマ溜まりで転倒：Phase 3 の knocked → recover をそのまま使う（吹き飛びより弱い、つんのめる転がり）
function tripPlayer(P, T) {
  P.state = 'knocked'; P.stateT = 0; P.knockT = T.knock; P.power = 0.5;
  P.kvx = 0; P.kvf = T.fwd; P.vx = 0; P.vy = T.up; P.y = Math.max(P.y, 0) + 0.01; P.grounded = false;
  P.tumble = 0; P.spinRate = -T.spin;
  P.slow = T.slowSec; P.slowF = T.slowFactor; P.trips++; lanePlayerCancel(P);
}
// クレーター：転倒せず、少しつまずいて軽く減速
function stumblePlayer(P) {
  const S = CFG.obstacle.stumble;
  P.stumbleT = S.tiltSec;
  if (P.slow <= 0) { P.slow = S.slowSec; P.slowF = S.slowFactor; }   // すでに減速中ならそのまま
}

// 障害物 ob にプレイヤー（この 1 フレームで z が prevZ → P.z と動いた）が当たるか。レーンが違えば（幅の外なら）当たらない。アーチは滑走中なら通れる
function obHits(ob, P, prevZ) {
  const O = CFG.obstacle;
  if (ob.hit) return false;
  if (ob.type === 'arch') {   // 頭上の障害物：梁の下端 clear より体が高い（立っている）と当たる。滑走中（低い姿勢）なら通れる
    if (playerHeight(P) <= ob.clear) return false;
    return Math.abs(P.x - ob.x) < ob.hw + O.dinoR && P.z <= ob.z + ob.hd + O.depthPad && prevZ >= ob.z - ob.hd - O.depthPad;
  }
  const dx = Math.abs(P.x - ob.x);
  if (ob.type === 'rock' || ob.type === 'log') {
    return dx < ob.hw + O.dinoR && P.z <= ob.z + ob.hd + O.depthPad && prevZ >= ob.z - ob.hd - O.depthPad;
  }
  const dz = ob.z < P.z ? P.z - ob.z : ob.z > prevZ ? ob.z - prevZ : 0;   // この 1 フレームの移動線分と中心との最短の前後差
  return Math.hypot(dx, dz) < ob.r + (ob.type === 'pool' ? O.dinoR : O.dinoR * 0.3);
}


// 1 フレーム進める：前方を生成・後方を破棄・衝突判定。OB.off なら何もしない。ev.hits = [{ ob, kind: 'trip' | 'stumble' }]
function stepObstacles(OB, P, dt) {
  const O = CFG.obstacle, ev = { hits: [], spawned: [], removed: 0 };
  if (OB.off) { OB.prevZ = P.z; return ev; }
  const need = P.dist + O.aheadDist;
  while (OB.genDist < need) {
    for (const ob of planObstacles(OB.seed, -OB.genDist, -(OB.genDist + O.chunk), OB.level)) {
      if (ob.dist >= CFG.goal.distance - CFG.clear.safeZone) continue;   // ゴールの手前から先は洞窟（安全地帯）。障害物は置かない
      ob.id = OB.nextId++; OB.list.push(ob); ev.spawned.push(ob);
    }
    OB.genDist += O.chunk;
  }
  const n0 = OB.list.length;
  OB.list = OB.list.filter(o => o.z <= P.z + O.behindDist); ev.removed = n0 - OB.list.length;
  if (P.state === 'run' && P.invuln <= 0) {
    for (const ob of OB.list) {
      if (!obHits(ob, P, OB.prevZ)) continue;
      ob.hit = true;   // 1 つの障害物では 1 回だけ（連続衝突ループ防止。復帰後の無敵も別にある）
      if (ob.type === 'crater') { stumblePlayer(P); ev.hits.push({ ob, kind: 'stumble' }); }
      else { tripPlayer(P, ob.type === 'pool' ? O.poolTrip : O.trip); ev.hits.push({ ob, kind: 'trip' }); }
      break;
    }
  }
  OB.prevZ = P.z;
  return ev;
}
