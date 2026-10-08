// ===== Phase 6：難易度・クリア・公平性・ボット =====
(() => {
  const D = CFG.difficulty, DT = 1 / 60, NOI = { left: false, right: false, jump: false };
  // difficultyAt：ステージ境界・単調性・連続性
  check('難易度：0〜20 秒=tutorial/LOW、20〜40=normal/MID、40〜60=danger/HIGH、60 秒以降=final/MAX',
    difficultyAt(0).name === 'tutorial' && difficultyAt(19.9).label === 'LOW' && difficultyAt(20).name === 'normal' && difficultyAt(39.9).label === 'MID' && difficultyAt(40).name === 'danger' && difficultyAt(59.9).label === 'HIGH' && difficultyAt(60).name === 'final' && difficultyAt(500).label === 'MAX');
  check('難易度：強度は 0 で始まり 1 に届き、負の時間でも 0', difficultyAt(0).s === 0 && difficultyAt(-5).s === 0 && difficultyAt(1e6).s === 1);
  check('難易度：強度は単調増加で、境界(20/40/60 秒)の前後で連続（階段状に急変しない）', (() => {
    let p = -1, maxJump = 0; for (let e = 0; e < 120; e += 0.01) { const s = difficultyAt(e).s; if (s < p - 1e-12) return false; if (p >= 0) maxJump = Math.max(maxJump, s - p); p = s; } return maxJump < 0.005;
  })());
  check('難易度：ステージ内の進行度 blend は 0〜1、最終ステージは 1、next は次のステージ', (() => { for (let e = 0; e < 100; e += 0.5) { const d = difficultyAt(e); if (d.blend < 0 || d.blend > 1) return false; } return difficultyAt(70).blend === 1 && difficultyAt(25).next === 2; })());
  check('難易度：距離から引いた強度も単調（ふつうに走った時刻に換算）', (() => { let p = -1; for (let d = 0; d < 6000; d += 10) { const s = difficultyAtDist(d).s; if (s < p - 1e-12) return false; p = s; } return difficultyAtDist(0).s === 0 && difficultyAtDist(2200).s > 0.9; })());
  check('難易度：nominalTime は speedAt を積分した時間と一致', Math.abs(nominalTime(CFG.goal.distance) - (() => { let t = 0, d = 0; while (d < CFG.goal.distance) { d += speedAt(t) * 0.001; t += 0.001; } return t; })()) < 0.1);
  // 噴石
  const rp0 = rockParams(0), rp1 = rockParams(1);
  check('噴石：落下間隔は序盤約 3 秒 → 最終約 0.5 秒、強度で単調に縮む', Math.abs(rp0.interval - 3) < 1e-9 && Math.abs(rp1.interval - 0.5) < 1e-9 && (() => { let p = 99; for (let s = 0; s <= 1; s += 0.02) { const v = rockParams(s).interval; if (v > p + 1e-12) return false; p = v; } return true; })());
  check('噴石：同時数の上限は強度で増え、枠数(rock.maxActive)を超えない', rp1.maxActive > rp0.maxActive && rp1.maxActive <= CFG.rock.maxActive);
  check('噴石：大型は 40 秒時点まで出ず、その後増える。重みの合計は 1', rockParams(difficultyAt(40).s).weights.large === 0 && rockParams(difficultyAt(30).s).weights.large === 0 && rp1.weights.large > rockParams(0.7).weights.large && rockParams(0.7).weights.large > 0 && [0, 0.3, 0.6, 1].every(s => { const w = rockParams(s).weights; return Math.abs(w.small + w.mid + w.large - 1) < 1e-9; }));
  check('噴石：1 個ごとの警告時間(猶予)は難易度で縮めない（最低 0.9 秒を維持）', Object.values(CFG.rock.sizes).every(c => c.warn >= 0.9));
  check('噴石：stepGame が強度を RS.s に反映し、終盤ほど多く降る', (() => {
    const cnt = (e0) => { const G = newGame(); G.OB.off = true; G.P.invuln = 1e9; G.P.time = CFG.volcano.eruptDelay + e0; let n = 0; const rng = obRng(3, 3); for (let i = 0; i < 60 * 30; i++) { const ev = stepGame(G, NOI, DT, rng); n += ev.spawned.length; if (G.M.phase !== 'playing') break; G.M.front = G.P.dist - 60; } return n; };
    return cnt(50) > cnt(0) * 2;
  })());
  // 公平性：警告時間と横移動で逃げ切れる
  check('公平：どの大きさでも、警告の残り(反応 fair.react を除く)で 横に逃げられる距離 ≥ 半径＋恐竜半径', Object.entries(CFG.rock.sizes).every(([k, c]) => CFG.move.maxSpeed * (c.warn - CFG.rock.fair.react) - CFG.rock.fair.accelLoss >= c.radius + CFG.hit.dinoR + 0.1), JSON.stringify(Object.entries(CFG.rock.sizes).map(([k, c]) => [k, CFG.move.maxSpeed * (c.warn - CFG.rock.fair.react) - CFG.rock.fair.accelLoss, c.radius + CFG.hit.dinoR])));
  check('公平：ジャンプ中の逃げにくさを引いても、中・大型は逃げ切れる', Object.entries(CFG.rock.sizes).filter(([k]) => k !== 'small').every(([k, c]) => CFG.move.maxSpeed * (c.warn - CFG.rock.fair.react) - CFG.rock.fair.accelLoss - CFG.rock.fair.jumpPenalty >= c.radius + CFG.hit.dinoR));
  check('公平：rockEscapable — 重なって逃げ道が無くなる配置は弾き、離れた配置は通す', (() => {
    const P = newPlayer(); P.x = 0; P.speed = 16; const S = newRockSched();
    spawnRock(S, 'large', -6, P.z - P.speed * 0.9, obRng(1, 1)); S.rocks[0].t = 0.7;
    const bad = rockEscapable(S, P, { size: 'large', x: 6, z: P.z - P.speed * 1.6, rem: 1.6 }, null);
    const ok = rockEscapable(newRockSched(), P, { size: 'large', x: 0, z: P.z - P.speed * 1.6, rem: 1.6 }, null);
    const far = rockEscapable(S, P, { size: 'small', x: 0, z: P.z - 200, rem: 0.9 }, null);
    return bad === false && ok === true && far === true;
  })());
  check('公平：実プレイ中に出た噴石は、出た時点で全部 rockEscapable（終盤の強度で 20 秒走って検査）', (() => {
    const G = newGame(); G.OB.off = true; G.P.invuln = 1e9; G.P.time = CFG.volcano.eruptDelay + 70; let n = 0, bad = 0; const rng = obRng(5, 5);
    for (let i = 0; i < 60 * 20; i++) {
      const S0 = { rocks: G.RS.rocks.map(r => Object.assign({}, r)) };
      const ev = stepGame(G, NOI, DT, rng), P0 = G.P;
      for (const r of ev.spawned) { n++; if (!rockEscapable(S0, P0, { size: r.size, x: r.x, z: r.z, rem: r.warn }, null)) bad++; }
      G.M.front = G.P.dist - 60;
    }
    return n > 10 && bad === 0;
  })());
  // マグマ
  check('マグマ：速さは 序盤 speed0 → 終盤 speedMax まで単調に上がる（序盤は遅く、終盤かなり速い）', magmaSpeedAt(0) === CFG.magma.speed0 && magmaSpeedAt(1e6) === CFG.magma.speedMax && CFG.magma.speedMax > CFG.magma.speed0 * 1.3 && (() => { let p = 0; for (let e = 0; e < 200; e += 0.5) { const v = magmaSpeedAt(e); if (v < p - 1e-12) return false; p = v; } return true; })());
  check('マグマ：近いほど少し遅くなる(ひるみ)。遠ければ影響なし', magmaRubber(1000) === 1 && magmaRubber(0) === CFG.magma.rubberMin && magmaRubber(20) < magmaRubber(40));
  check('マグマ：被弾なしで走り続けると、クリアまでに 20〜60u まで縮む（緊張）', (() => { const G = newGame(); G.RS.timer = 1e9; G.OB.off = true; let mn = 1e9; while (G.M.phase === 'playing') { stepGame(G, NOI, DT); if (G.M.active) mn = Math.min(mn, magmaGap(G.M, G.P)); } window.__quietMin = mn; return G.M.phase === 'clear' && mn >= 20 && mn <= 60; })(), 'min ' + window.__quietMin);
  // 障害物
  check('障害物：間隔は速く走るほど広がる。最低間隔は常に minGapZ × 速度倍率以上', (() => { const a = planObstacles(9, 0, -1000, 0), b = planObstacles(9, -1800, -2800, 0); const gaps = l => l.slice(1).map((o, i) => o.dist - l[i].dist); return Math.min(...gaps(a)) >= CFG.obstacle.minGapZ - 1e-9 && Math.min(...gaps(b)) >= CFG.obstacle.minGapZ * speedScaleAtDist(1800) - 1e-6 && speedScaleAtDist(2200) > speedScaleAtDist(0); })());
  check('障害物：高速でも連続した障害物の「時間」の間隔はジャンプの滞空時間 × 0.85 以上', CFG.obstacle.minGapZ / CFG.run.baseSpeed >= jumpStats().air * 0.85 && [0, 500, 1000, 2000, 2200, 6000].every(d => CFG.obstacle.minGapZ * speedScaleAtDist(d) / speedAt(nominalTime(d)) >= jumpStats().air * 0.85 - 1e-9));
  // クリア
  check('クリア：goal.distance は被弾なしで 100〜140 秒(1〜3 分内、目標約 2 分)で届く距離', (() => { const t = nominalTime(CFG.goal.distance); return t >= 100 && t <= 140; })());
  check('クリア：reachedGoal は距離で決まる', (() => { const G = newGame(); const a = reachedGoal(G); G.P.dist = CFG.goal.distance - 0.01; const b = reachedGoal(G); G.P.dist = CFG.goal.distance; return a === false && b === false && reachedGoal(G) === true; })());
  const clearG = () => { const G = newGame(); G.OB.off = true; G.RS.timer = 1e9; G.P.dist = CFG.goal.distance - 0.5; G.P.time = 100; return G; };
  check('クリア：到達したら phase が clear になり、ev.cleared が 1 回だけ立つ', (() => { const G = clearG(); let c = 0; for (let i = 0; i < 120; i++) c += stepGame(G, NOI, DT).cleared ? 1 : 0; return G.M.phase === 'clear' && c === 1; })());
  check('クリア：clear 中は前進・マグマ・噴石・距離・横移動が止まる', (() => { const G = clearG(); for (let i = 0; i < 60; i++) stepGame(G, NOI, DT); const d = G.P.dist, f = G.M.front, z = G.P.z; spawnRock(G.RS, 'mid', 0, -9999, null); const t0 = G.RS.rocks[0].t; for (let i = 0; i < 300; i++) stepGame(G, { left: true, right: false, jump: true }, DT); return G.P.dist === d && G.M.front === f && G.P.z === z && G.P.x === 0 && G.RS.rocks[0].t === t0 && G.M.phase === 'clear' && G.P.speed === 0; })());
  check('クリア：到達の時点で落下中の噴石は消え、dead にはならない', (() => { const G = clearG(); spawnRock(G.RS, 'large', 0, -9999, null); for (let i = 0; i < 60; i++) stepGame(G, NOI, DT); return G.RS.rocks.length === 0 && G.M.phase === 'clear' && G.P.state !== 'dead'; })());
  check('クリア：同じフレームで追いつかれたら dead が優先', (() => { const G = clearG(); G.P.dist = CFG.goal.distance - 0.1; G.M.active = true; G.M.front = G.P.dist + 5; G.M.t = 50; let died = false; for (let i = 0; i < 5; i++) { const ev = stepGame(G, NOI, DT); died = died || ev.died; } return died && G.M.phase === 'dead'; })());
  check('クリア：リセットで playing・初期状態に戻る', (() => { const G = clearG(); for (let i = 0; i < 90; i++) stepGame(G, NOI, DT); resetGame(G, 5); return G.M.phase === 'playing' && G.M.clearT === 0 && G.P.dist === 0 && G.RS.s === null && JSON.stringify(G.M) === JSON.stringify(newMagma()); })());
  check('クリア：空中で到達しても着地して止まる', (() => { const G = clearG(); G.P.y = 1.5; G.P.vy = 3; G.P.grounded = false; for (let i = 0; i < 120; i++) stepGame(G, NOI, DT); return G.M.phase === 'clear' && G.P.y === 0 && G.P.grounded; })());
  // ボット評価
  const perfect = botSummary({ err: 0 }, 40), none = botSummary({ err: 1 }, 20), sloppy = botSummary({ err: 0.1 }, 40), bad = botSummary({ err: 0.2 }, 40);
  window.__bots = { perfect: botLine(perfect), sloppy10: botLine(sloppy), sloppy20: botLine(bad), none: botLine(none) };
  check('ボット：完璧に避けるボットは 85% 以上クリアでき、クリア時間は 1〜3 分(約 2 分)', perfect.clearRate >= 0.85 && perfect.clearT >= 100 && perfect.clearT <= 140, botLine(perfect));
  check('ボット：何も避けない(立ち止まる)ボットは 90 秒以内に全員死ぬ', none.clear === 0 && Math.max(...none.deadTs) < 90, botLine(none));
  check('ボット：10% 見逃すボットは半分前後(30〜90%)クリア、20% 見逃すとさらに減る（ギリギリ）', sloppy.clearRate >= 0.3 && sloppy.clearRate <= 0.9 && bad.clearRate > 0 && bad.clearRate < sloppy.clearRate && bad.clearRate < 0.7, botLine(sloppy) + ' / ' + botLine(bad));
  check('ボット：失敗するときの死亡時刻は後半(平均 70 秒以降)に偏る', isNaN(bad.deadT) || bad.deadT >= 70, botLine(bad));
})();
