// ===== 噴石のスケジューラ（純ロジック。three.js 非依存） =====
function rr(rng, a, b) { return a + (rng ? rng() : Math.random()) * (b - a); }

function newRockSched() { return { timer: CFG.rock.firstDelay, rocks: [], nextId: 1 }; }

function pickRockSize(r) {
  const w = CFG.rock.weights, x = r * (w.small + w.mid + w.large);
  return x < w.small ? 'small' : x < w.small + w.mid ? 'mid' : 'large';
}

// 落下地点：着弾までに恐竜が進む距離を見込んで前方にずらす。aimed なら恐竜の予想位置の近く、そうでなければ前方の荒野のどこか
function pickRockTarget(P, size, rng) {
  const R = CFG.rock, C = R.sizes[size], lim = CFG.move.maxX + R.edgeMargin;
  const lead = Math.max(0, P.speed) * C.warn, aimed = rr(rng, 0, 1) < R.aimChance;
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

// 1 フレーム進める。erupting のときだけ新しい噴石を出す。着弾した噴石は取り除き、直撃なら恐竜を吹き飛ばす
function stepRocks(S, P, dt, erupting, rng) {
  const R = CFG.rock, ev = { spawned: [], landed: [] };
  if (erupting) {
    S.timer -= dt;
    if (S.timer <= 0) {
      if (S.rocks.length < R.maxActive) {
        const size = pickRockSize(rr(rng, 0, 1)), tg = pickRockTarget(P, size, rng), r = spawnRock(S, size, tg.x, tg.z, rng);
        if (r) ev.spawned.push(r);
        S.timer = R.interval * (1 + R.jitter * (rr(rng, 0, 1) * 2 - 1));
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
