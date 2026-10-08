// ===== 噴石のスケジューラ（純ロジック。three.js 非依存） =====
function rr(rng, a, b) { return a + (rng ? rng() : Math.random()) * (b - a); }

function newRockSched() { return { timer: CFG.rock.firstDelay, rocks: [], nextId: 1, s: null }; }   // s = 難易度の強度（null なら固定値）

function pickRockSize(r, weights) {
  const w = weights || CFG.rock.weights, x = r * (w.small + w.mid + w.large);
  return x < w.small ? 'small' : x < w.small + w.mid ? 'mid' : 'large';
}

// 落下地点：着弾までに恐竜が進む距離を見込んで前方にずらす。aimed なら恐竜の予想位置の近く、そうでなければ前方の荒野のどこか
function pickRockTarget(P, size, rng, aimChance) {
  const R = CFG.rock, C = R.sizes[size], lim = CFG.move.maxX + R.edgeMargin;
  const lead = Math.max(0, P.speed) * C.warn, aimed = rr(rng, 0, 1) < (aimChance == null ? R.aimChance : aimChance);
  let x, z;
  if (aimed) { x = P.x + rr(rng, -R.aimJitterX, R.aimJitterX); z = P.z - lead + rr(rng, -R.aimJitterZ, R.aimJitterZ); }
  else { x = rr(rng, -R.spreadX, R.spreadX); z = P.z - lead - rr(rng, 3, R.aheadExtra); }
  return { x: Math.max(-lim, Math.min(lim, x)), z, aimed };
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
// 着弾地点の危険帯：その噴石が着弾する時刻に、プレイヤー（いまの速さで直進すると仮定）が円に入ってしまう x の範囲。届かなければ null
function rockZone(P, size, x, z, rem) {
  const C = CFG.rock.sizes[size], F = CFG.rock.fair, v = Math.max(P.speed, 1), R = C.radius + CFG.hit.dinoR + F.margin;
  const dz = Math.abs(P.z - v * rem - z);
  if (dz >= R) return null;
  const dx = Math.sqrt(R * R - dz * dz);
  return { lo: x - dx, hi: x + dx, rem };
}
// この噴石 cand = { size, x, z, rem } を足しても、プレイヤーが着弾までに安全な x へ走って逃げ切れるか。
// 反応時間 react のあと最高横速度で走る（助走ぶん accelLoss を引く）。跳ばないと越えられない障害物が目前なら、空中で動きにくいぶん jumpPenalty を引く。
// 噴石どうしが重なって逃げ道が足りなくなる配置、逃げる時間が足りない配置を弾く（資料 §16「必ず回避可能なルートを作る」）
function rockEscapable(S, P, cand, OB) {
  const F = CFG.rock.fair, M = CFG.move, zones = [];
  for (const r of S.rocks) { const z = rockZone(P, r.size, r.x, r.z, r.warn - r.t); if (z) zones.push(z); }
  const zc = rockZone(P, cand.size, cand.x, cand.z, cand.rem); if (zc) zones.push(zc);
  const inZ = (x, z) => x > z.lo && x < z.hi, here = zones.filter(z => inZ(P.x, z));
  if (!here.length) return true;
  let best = null;
  for (let x = -M.maxX; x <= M.maxX + 1e-9; x += 0.25) {
    if (zones.some(z => inZ(x, z))) continue;
    if (best === null || Math.abs(x - P.x) < Math.abs(best - P.x)) best = x;
  }
  if (best === null) return false;
  let avail = M.maxSpeed * (Math.min(...here.map(z => z.rem)) - F.react) - F.accelLoss;
  if (OB && OB.list) {
    const O = CFG.obstacle, v = Math.max(P.speed, 1);
    for (const ob of OB.list) {
      if (ob.type === 'pool') continue;
      const tz = (P.z - (ob.z + (ob.type === 'crater' ? ob.r : ob.hd) + O.depthPad)) / v;
      if (tz > -0.1 && tz < cand.rem + 0.3 && Math.abs(P.x - ob.x) < ob.hw + O.dinoR + 0.6) { avail -= F.jumpPenalty; break; }
    }
  }
  return Math.abs(best - P.x) <= avail;
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
