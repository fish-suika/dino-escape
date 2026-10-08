// ===== 障害物（純ロジック。three.js 非依存）=====
// 岩・倒木・クレーター・マグマ溜まりを、走行距離に沿って「枠（slot）」ごとに決める。
// 枠 k の位置は startDist + k*slotStep + ばらつき(0〜slotStep-minGapZ) なので、隣り合う枠は必ず minGapZ 以上離れる。
// 1 つの枠には障害物が 1 個までなので、同じ z 帯（横一列）に 2 個並ぶことはない。結果は seed と k だけで決まる（再現できる）。
function obRng(seed, k) {   // (seed, k) から作る小さな乱数列（mulberry32）
  let h = (seed | 0) ^ Math.imul((k + 1) | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 16), 0x85ebca6b); h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35); h ^= h >>> 16;
  let s = h >>> 0;
  return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
function obLerp(a, b, t) { return a + (b - a) * t; }

// 枠が埋まる確率。走行距離で start → end へ線形に増える（level は先取り分 0〜1）
function obDensity(dist, level) {
  const D = CFG.obstacle.density, t = clamp01(difficultyAtDist(dist).s + (level || 0));   // 難易度の強度（その距離を走る頃の噴火後の秒から）
  return obLerp(D.start, D.end, t);
}

// 枠 k の「素の」障害物（他との兼ね合いを見る前）。無ければ null。乱数は常に同じ順に使う
function obSlot(seed, k, level) {
  const O = CFG.obstacle, rng = obRng(seed, k);
  const u = O.startDist + k * O.slotStep + rng() * (O.slotStep - O.minGapZ);   // 基準速度での位置
  const dist = O.startDist + (u - O.startDist) * speedScaleAtDist(u);   // 速く走るほど間隔を広げる（時間で見た間隔・ジャンプの余裕が一定になる。単調増加なので順序と最低間隔 minGapZ は保たれる）
  const fill = rng(), pick = rng(), a = rng(), b = rng(), c = rng();
  if (fill >= obDensity(dist, level)) return null;
  const types = ['rock', 'log', 'crater', 'pool'].filter(t => dist - O.startDist >= O.unlock[t] && O.weights[t] > 0);
  if (!types.length) return null;
  let tot = 0; for (const t of types) tot += O.weights[t];
  let x = pick * tot, type = types[types.length - 1];
  for (const t of types) { if (x < O.weights[t]) { type = t; break; } x -= O.weights[t]; }
  const lim = CFG.move.maxX, ob = { type, dist, z: -dist, hit: false };
  if (type === 'rock') {
    const R = O.rock, r = obLerp(R.rMin, R.rMax, a);
    Object.assign(ob, { x: (c * 2 - 1) * (lim - 1), r, h: obLerp(R.hMin, R.hMax, b), hw: r * R.shrink, hd: r * R.shrink });
  } else if (type === 'log') {
    const L = O.log, len = obLerp(L.lenMin, L.lenMax, a), reach = Math.max(0, lim + L.overhang - len / 2);
    Object.assign(ob, { x: (c * 2 - 1) * reach, len, h: L.h, hw: len / 2, hd: L.r, r: L.r });
  } else if (type === 'crater') {
    const C = O.crater, r = obLerp(C.rMin, C.rMax, a);
    Object.assign(ob, { x: (c * 2 - 1) * (lim - 1), r, h: C.clearY, hw: r, hd: r });
  } else {
    const Pl = O.pool, r = obLerp(Pl.rMin, Pl.rMax, a);
    Object.assign(ob, { x: (c * 2 - 1) * (lim - r * 0.5), r, h: Pl.clearY, hw: r, hd: r });
  }
  return ob;
}

// 枠 k の最終的な障害物。近くに倒木（素の判定）があれば、倒木自身が後ろの枠なら消し、他の種類は消す（倒木の前後を空ける）
function obFinal(seed, k, level) {
  const O = CFG.obstacle, ob = obSlot(seed, k, level);
  if (!ob) return null;
  for (let j = -3; j <= 3; j++) {
    if (j === 0 || k + j < 0) continue;
    const n = obSlot(seed, k + j, level);
    if (!n || n.type !== 'log' || Math.abs(n.dist - ob.dist) >= O.logClearZ * speedScaleAtDist(ob.dist)) continue;
    if (ob.type !== 'log' || j < 0) return null;
  }
  return ob;
}

// 走行距離 [-zFrom, -zTo) にある障害物を、手前（スタート側）から順に返す（zFrom > zTo。z は前方が負）。同じ引数なら同じ結果
function planObstacles(seed, zFrom, zTo, level) {
  const O = CFG.obstacle, d0 = -zFrom, d1 = -zTo, out = [];
  const gMax = CFG.run.maxSpeed / CFG.run.baseSpeed, k0 = Math.max(0, Math.floor((d0 - O.startDist) / (O.slotStep * gMax)) - 1), k1 = Math.ceil((d1 - O.startDist) / O.slotStep) + 1;
  for (let k = k0; k <= k1; k++) {
    const ob = obFinal(seed, k, level);
    if (ob && ob.dist >= d0 && ob.dist < d1) out.push(ob);
  }
  return out;
}

function newObstacles(seed) {
  return { seed: seed == null ? CFG.obstacle.seed : seed, list: [], nextId: 1, genDist: 0, prevZ: 0, off: false, level: 0 };
}

// 岩・倒木・マグマ溜まりで転倒：Phase 3 の knocked → recover をそのまま使う（吹き飛びより弱い、つんのめる転がり）
function tripPlayer(P, T) {
  P.state = 'knocked'; P.stateT = 0; P.knockT = T.knock; P.power = 0.5;
  P.kvx = 0; P.kvf = T.fwd; P.vx = 0; P.vy = T.up; P.y = Math.max(P.y, 0) + 0.01; P.grounded = false;
  P.tumble = 0; P.spinRate = -T.spin;
  P.slow = T.slowSec; P.slowF = T.slowFactor; P.trips++;
}
// クレーター：転倒せず、少しつまずいて軽く減速
function stumblePlayer(P) {
  const S = CFG.obstacle.stumble;
  P.stumbleT = S.tiltSec;
  if (P.slow <= 0) { P.slow = S.slowSec; P.slowF = S.slowFactor; }   // すでに減速中ならそのまま
}

// 障害物 ob にプレイヤー（この 1 フレームで z が prevZ → P.z と動いた）が当たるか。ジャンプで高さが足りていれば当たらない
function obHits(ob, P, prevZ) {
  const O = CFG.obstacle;
  const top = ob.h - (ob.type === 'rock' || ob.type === 'log' ? O.footMargin : 0);   // 岩・倒木は少し甘め
  if (ob.hit || P.y >= top) return false;
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
