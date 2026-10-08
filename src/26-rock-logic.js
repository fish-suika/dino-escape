// ===== 噴石のスケジューラ（純ロジック。three.js 非依存） =====
function rr(rng, a, b) { return a + (rng ? rng() : Math.random()) * (b - a); }

function newRockSched() { return { timer: CFG.rock.firstDelay, rocks: [], nextId: 1, s: null }; }   // s = 難易度の強度（null なら固定値）

function pickRockSize(r, weights) {
  const w = weights || CFG.rock.weights, x = r * (w.small + w.mid + w.large);
  return x < w.small ? 'small' : x < w.small + w.mid ? 'mid' : 'large';
}

// 落下地点の候補（x）：レーンの中心とレーンの間。着弾の当たり円がちょうど何レーンぶんの中心を覆うかを数え、
// 小型=1 レーン / 中型=1〜2 レーン / 大型=2 レーン（全レーンを覆う配置は置かない＝必ず安全なレーンが残る）だけ残す
function rockCovered(x, size) {   // 当たり円が覆うレーン番号
  const R = CFG.rock.sizes[size].radius + CFG.hit.dinoR, out = [];
  for (let i = 0; i < CFG.lane.count; i++) if (Math.abs(laneX(i) - x) < R) out.push(i);
  return out;
}
function rockSpots(size) {
  const n = CFG.lane.count, out = [];
  for (let k = 0; k < 2 * n - 1; k++) {
    const x = (laneX(0) + laneX(n - 1)) / 2 + (k - (n - 1)) * CFG.lane.width / 2, c = rockCovered(x, size).length;
    if (size === 'small' ? c === 1 : c >= 1 && c <= n - 1) out.push({ x, lanes: rockCovered(x, size) });
  }
  return out;
}

// 落下地点：着弾までに恐竜が進む距離を見込んで前方にずらす。aimed なら恐竜のいるレーンを覆う位置、そうでなければ前方のどこか（x はレーンに吸着）
function pickRockTarget(P, size, rng, aimChance) {
  const R = CFG.rock, C = R.sizes[size];
  const lead = Math.max(0, P.speed) * C.warn, aimed = rr(rng, 0, 1) < (aimChance == null ? R.aimChance : aimChance);
  let spots = rockSpots(size), z;
  if (aimed) { const hit = spots.filter(s => s.lanes.indexOf(P.lane) >= 0); if (hit.length) spots = hit; z = P.z - lead + rr(rng, -R.aimJitterZ, R.aimJitterZ); }
  else z = P.z - lead - rr(rng, 3, R.aheadExtra);
  const s = spots[Math.min(spots.length - 1, Math.floor(rr(rng, 0, 1) * spots.length))];
  return { x: s.x, z, aimed };
}

// 噴石を1個追加（同時数が上限なら null）。warn は開発用の秒数上書き
function spawnRock(S, size, x, z, rng, warn) {
  if (S.rocks.length >= CFG.rock.maxActive) return null;
  const C = CFG.rock.sizes[size];
  const r = { id: S.nextId++, size, x, z, t: 0, warn: warn || C.warn, radius: C.radius, vis: C.vis, H: C.fallH,
              ox: rr(rng, -CFG.rock.sideOff, CFG.rock.sideOff), oz: CFG.rock.backDist * rr(rng, 0.8, 1.2) };
  S.rocks.push(r); return r;
}

// 飛行中の位置：後方の高い所から放物線で着弾点へ（y は着弾で 0）
function rockPos(r) {
  const u = Math.min(1, r.t / r.warn);
  return { x: r.x + r.ox * (1 - u), y: r.H * (1 - u * u), z: r.z + r.oz * (1 - u), u };
}


// ---- 公平性：「避けようがない」噴石を出さない ----
// 着地地点の危険帯：その噴石が着弾する時刻に、プレイヤー（いまの速さで直進すると仮定）が円に入ってしまう x の範囲。届かなければ null
function rockZone(P, size, x, z, rem) {
  const C = CFG.rock.sizes[size], F = CFG.rock.fair, v = Math.max(P.speed, 1), R = C.radius + CFG.hit.dinoR + F.margin;
  const dz = Math.abs(P.z - v * rem - z);
  if (dz >= R) return null;
  const dx = Math.sqrt(R * R - dz * dz);
  return { lo: x - dx, hi: x + dx, rem };
}
// この噴石 cand = { size, x, z, rem } を足しても、プレイヤーが着弾までに安全なレーンへ移って逃げ切れるか。
// 反応時間 react のあと、隣のレーンへは shiftSec（＋余裕）ずつかかる。着弾までに間に合うレーンで、障害物（岩・倒木・アーチ・溜まりなど）に塞がれていないものが 1 つでもあればよい。
// 噴石どうしが重なって安全なレーンが無くなる配置、移る時間が足りない配置を弾く（資料 §16「必ず回避可能なルートを作る」）
function rockEscapable(S, P, cand, OB) {
  const F = CFG.rock.fair, L = CFG.lane, zones = [];
  for (const r of S.rocks) { const z = rockZone(P, r.size, r.x, r.z, r.warn - r.t); if (z) zones.push(z); }
  const zc = rockZone(P, cand.size, cand.x, cand.z, cand.rem); if (zc) zones.push(zc);
  const inZ = (x, z) => x > z.lo && x < z.hi, here = zones.filter(z => inZ(P.x, z) || inZ(laneX(P.lane), z));
  if (!here.length) return true;
  const rem = Math.min(...here.map(z => z.rem)), rt = P.laneMove ? Math.max(0, L.shiftSec - P.laneT) : 0;
  const blocked = i => {
    if (!OB || !OB.list) return false;
    const O = CFG.obstacle, v = Math.max(P.speed, 1);
    for (const ob of OB.list) {
      const tz = (P.z - (ob.z + (ob.type === 'crater' || ob.type === 'pool' ? ob.r : ob.hd) + O.depthPad)) / v;
      if (tz > -0.1 && tz < rem + 0.3 && Math.abs(laneX(i) - ob.x) < ob.hw + O.dinoR + 0.3) return true;
    }
    return false;
  };
  for (let i = 0; i < L.count; i++) {
    if (zones.some(z => inZ(laneX(i), z)) || blocked(i)) continue;
    const n = Math.abs(i - P.lane);
    if (rt + n * (L.shiftSec + F.moveExtra) + F.react <= rem) return true;
  }
  return false;
}


// 1 フレーム進める。erupting のときだけ新しい噴石を出す。着弾した噴石は取り除き、直撃なら恐竜を吹き飛ばす
function stepRocks(S, P, dt, erupting, rng, OB) {
  const R = CFG.rock, ev = { spawned: [], landed: [] }, K = rockParams(S.s);
  if (erupting) {
    S.timer -= dt;
    if (S.timer <= 0) {
      if (S.rocks.length < K.maxActive) {
        const size = pickRockSize(rr(rng, 0, 1), K.weights), warn = R.sizes[size].warn;
        let tg = null;   // 逃げ切れない配置になる場所は選び直す（fair.tries 回まで）。全部だめなら少し待ってやり直す
        for (let i = 0; i < R.fair.tries && !tg; i++) { const c = pickRockTarget(P, size, rng, K.aim); if (rockEscapable(S, P, { size, x: c.x, z: c.z, rem: warn }, OB)) tg = c; }
        const r = tg ? spawnRock(S, size, tg.x, tg.z, rng) : null;
        if (r) { ev.spawned.push(r); S.timer = K.interval * (1 + R.jitter * (rr(rng, 0, 1) * 2 - 1)); } else S.timer = R.fair.retry;
      } else S.timer = 0.25;
    }
  }
  const alive = [];
  for (const r of S.rocks) {
    if (ev.spawned.indexOf(r) < 0) r.t += dt;
    if (r.t >= r.warn) {
      const hit = rockHitsPlayer(P, r.x, r.z, r.radius);
      if (hit) knockPlayer(P, r.x, r.z, r.size);
      ev.landed.push({ rock: r, hit });
    } else alive.push(r);
  }
  S.rocks = alive;
  return ev;
}
