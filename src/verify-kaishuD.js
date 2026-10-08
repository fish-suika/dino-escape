// ===== 改修D：洞窟の手前〜洞窟の中には噴石を落とさない / アーチの出現数 / アーチの柱の位置 =====
(() => {
  const DT = 1 / 60, G0 = CFG.goal, NOI = { left: false, right: false, slide: false };
  // 噴石の落下地点：ゴールの rockStop 手前から先（洞窟の手前〜洞窟の中）には選ばない
  check('洞窟の噴石：境目の判定（ゴールの rockStop 手前から先が洞窟エリア）', G0.rockStop >= 40 && G0.rockStop <= 80 && !rockInCaveZone(-(G0.distance - G0.rockStop - 0.01)) && rockInCaveZone(-(G0.distance - G0.rockStop)) && rockInCaveZone(-G0.distance) && rockInCaveZone(-(G0.distance + 30)));
  check('洞窟の噴石：洞窟エリアの落下地点は rockEscapable が必ず断る', (() => {
    const P = newPlayer(), S = newRockSched(); P.dist = G0.distance - 100; P.z = -P.dist; P.speed = 20;
    for (const size of ['small', 'mid', 'large']) for (const z of [-(G0.distance - G0.rockStop), -(G0.distance - 10), -G0.distance, -(G0.distance + 20)]) if (rockEscapable(S, P, { size, x: 0, z, rem: 1 }, null)) return false;
    return rockEscapable(S, P, { size: 'small', x: laneX(0), z: -(G0.distance - G0.rockStop - 20), rem: 1 }, null);
  })());
  const finalRun = (seed, startDist) => {   // 最終盤を最も激しい難易度(s=1)で走り抜けるあいだに出た噴石の落下地点（距離）を集める
    const P = newPlayer(), S = newRockSched(), rng = lcg(seed); P.speed = 21; P.dist = startDist; P.z = -P.dist; S.s = 1; S.timer = 0;
    const out = [];
    for (let i = 0; i < 60 * 14; i++) {
      P.dist += P.speed * DT; P.z = -P.dist; P.time += DT; P.lane = (i >> 7) % 3; P.x = laneX(P.lane);
      const ev = stepRocks(S, P, DT, true, rng, null); ev.spawned.forEach(r => out.push(-r.z));
      if (P.dist > G0.distance + 30) break;
    }
    return out;
  };
  check('洞窟の噴石：最終盤を走り抜けても、洞窟エリアに落下地点は選ばれない（300 seed）', (() => {
    let n = 0, bad = 0; for (let s = 1; s <= 300; s++) for (const d of finalRun(s, G0.distance - 140)) { n++; if (d >= G0.distance - G0.rockStop) bad++; }
    return bad === 0 && n > 300;
  })(), '');
  check('洞窟の噴石：洞窟の手前(rockStop)に着いたあとは新しい噴石が出ない', (() => {
    let late = 0; for (let s = 1; s <= 100; s++) { const P = newPlayer(), S = newRockSched(), rng = lcg(s); P.speed = 21; P.dist = G0.distance - G0.rockStop; P.z = -P.dist; S.s = 1; S.timer = 0; for (let i = 0; i < 600; i++) { P.dist += P.speed * DT; P.z = -P.dist; late += stepRocks(S, P, DT, true, rng, null).spawned.length; } }
    return late === 0;
  })());
  check('洞窟の噴石：ゴール到達の瞬間に既存の噴石・マーカーは全て消える', (() => {
    const G = newGame(); G.OB.off = true; G.P.dist = G0.distance - 0.5; G.P.z = -G.P.dist; G.P.time = 100;
    spawnRock(G.RS, 'large', 0, G.P.z - 30, lcg(1), 1.6); spawnRock(G.RS, 'small', laneX(0), G.P.z - 20, lcg(2), 0.9);
    let cleared = false; for (let i = 0; i < 10; i++) { const ev = stepGame(G, NOI, DT); cleared = cleared || ev.cleared; }
    return cleared && G.RS.rocks.length === 0;
  })());

  // アーチの出現数：重みを 0.18 に戻したときの約 1.5〜2 倍。解禁距離は変えない（距離 90 から）
  const archCount = () => { obGenClear(); let a = 0, rows = 0; for (let s = 1; s <= 80; s++) obRows(s * 7 + 3, 2150, 0).forEach(r => { if (r.dist < 2150) { rows++; if (r.arch) a++; } }); return { a: a / 80, rows: rows / 80 }; };
  check('アーチの出現数：以前（重み 0.18）の 1.5〜2 倍。行の総数は大きく減らない', (() => {
    const W = CFG.obstacle.weights, keep = W.arch; W.arch = 0.18; const before = archCount(); W.arch = keep; const after = archCount(); obGenClear();
    return after.a / before.a >= 1.5 && after.a / before.a <= 2.0 && after.rows >= before.rows * 0.9 && CFG.obstacle.unlock.arch === 40 && CFG.obstacle.startDist + CFG.obstacle.unlock.arch === 90;
  })());

  // クリア演出：洞窟の入口のすぐ内側で止まり、そのすぐ後ろ（洞窟の奥側）からカメラが入口越しに火山を見る
  check('クリア演出：恐竜は入口のすぐ内側（6u 以内）で止まり、振り返りのカメラも洞窟の中に収まる', (() => {
    const K = CFG.clear, cv = K.cave, c = K.cam;
    return K.stopDist > cv.mouth && K.stopDist - cv.mouth <= 6 && K.stopDist + c.R < cv.mouth + cv.length && c.R < cv.halfW && c.R >= 4 && c.h > 2.9;
  })());
  // アーチの柱：レーンの境目か、その外側にだけ。柱の半幅は 0.5u 以内、走る位置（レーン中心）から ±1.2u に入らない。2 レーン幅は真ん中の境目に立てない（柱は外側の 2 本だけ）
  check('アーチの柱：1・2 レーン幅とも、柱の中心は通るレーンの外側の境目かその外、半幅 0.5u 以内、レーン中心から 1.2u 以上離れている', [1, 2].every(n => {
    const s = archPostSpec(n), A = CFG.obstacle.arch, W = CFG.lane.width;
    return s.x >= n * W / 2 - 1e-9 && A.post.off >= 0 && A.post.r <= 0.5 && s.gap >= A.post.runHalf - 1e-9 && A.post.runHalf >= 1.2 - 1e-9 && Math.abs(s.inner - (s.x - A.post.r)) < 1e-9;
  }));
  check('アーチの柱：柱の内側のふちは、当たり判定の幅（通れる半幅）より外にある＝柱自体には当たらない', [1, 2].every(n => archPostSpec(n).inner > n * CFG.lane.width / 2 - CFG.obstacle.arch.inset - 0.3));
  check('アーチの柱：柱は 2 本だけ（外側の境目 ±x）。2 レーン幅の x は 1 レーン幅より外側＝真ん中の境目(±レーン幅/2 ではなく 0)には立たない', archPostSpec(2).x > archPostSpec(1).x && archPostSpec(2).x > CFG.lane.width && archPostSpec(1).x > CFG.lane.width / 2 - 1e-9);
})();
