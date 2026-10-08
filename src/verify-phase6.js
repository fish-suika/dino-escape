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
  check('公平：どの大きさでも、警告の残り(反応 fair.react を除く)で隣の 2 レーン先まで移れる', Object.entries(CFG.rock.sizes).every(([k, c]) => c.warn - CFG.rock.fair.react >= 2 * (CFG.lane.shiftSec + CFG.rock.fair.moveExtra) + 0.1));
  check('公平：小・中・大の円は、危険が及ぶレーンの数が 1 / 1〜2 / 2 で、どれも「安全なレーンが 1 つ以上残る」', ['small', 'mid', 'large'].every(s => rockSpots(s).length > 0 && rockSpots(s).every(sp => sp.lanes.length >= 1 && sp.lanes.length <= CFG.lane.count - 1)) && rockSpots('small').every(sp => sp.lanes.length === 1) && Math.max(...rockSpots('large').map(sp => sp.lanes.length)) === 2);
  check('公平：rockEscapable — 重なって安全なレーンが無くなる配置は弾き、離れた配置は通す', (() => {
    const P = newPlayer(); P.speed = 16; const S = newRockSched(), W = CFG.lane.width;
    spawnRock(S, 'large', -W, P.z - P.speed * 0.9, obRng(1, 1)); S.rocks[0].t = 0.7;   // 左 2 レーン（0 と 1）を覆う大型が落ちかけている
    const bad = rockEscapable(S, P, { size: 'mid', x: W / 2, z: P.z - P.speed * 1.2, rem: 1.2 }, null);   // 右 2 レーンを覆う中型を足すと逃げ場がない
    const ok = rockEscapable(newRockSched(), P, { size: 'large', x: -W / 2, z: P.z - P.speed * 1.6, rem: 1.6 }, null);   // 右のレーンへ 1 回で移れる
    const far = rockEscapable(S, P, { size: 'small', x: 0, z: P.z - 200, rem: 0.9 }, null);
    const late = (() => { const Q = newPlayer(); Q.speed = 16; const T = newRockSched(); spawnRock(T, 'large', -W, Q.z - Q.speed * 0.15, obRng(1, 2)); T.rocks[0].t = 1.45; return rockEscapable(T, Q, { size: 'small', x: 0, z: Q.z - 300, rem: 0.9 }, null); })();   // 残り 0.15 秒では隣へ移れない
    return bad === false && ok === true && far === true && late === false;
  })());
  check('公平：逃げ先のレーンに障害物があって塞がれていると、逃げ切れないと判定する', (() => {
    const P = newPlayer(); P.speed = 16; const W = CFG.lane.width, S = newRockSched(), OB = newObstacles();
    const cand = { size: 'large', x: -W / 2, z: P.z - P.speed * 1.6, rem: 1.6 };   // 左 2 レーンが危険 → 逃げ先は右レーンだけ
    const free = rockEscapable(S, P, cand, OB);
    OB.list.push({ type: 'pool', x: W, z: P.z - 20, r: 3, hw: 3, hd: 3, h: 1.4, hit: false });   // その右レーンに溜まりが 1 秒ほど先にある
    return free === true && rockEscapable(S, P, cand, OB) === false;
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
  // 噴石被弾の減速の緩和（A 担当）：減速は短く・弱く、操作不能＋遅い時間は中型で約 2.5 秒
  (() => {
    const S = CFG.rock.sizes, H = CFG.hit, R = ['small', 'mid', 'large'];
    check('被弾緩和：減速の秒は 小 0.8 / 中 1.2〜1.5 / 大 1.8 以内、倍率は 小 0.85 / 中 0.75 / 大 0.65 で、大型ほど長く強い', S.small.slowSec <= 0.8 && S.mid.slowSec >= 1.2 && S.mid.slowSec <= 1.5 && S.large.slowSec <= 1.8 && S.small.slowSec < S.mid.slowSec && S.mid.slowSec < S.large.slowSec && S.small.slowF > S.mid.slowF && S.mid.slowF > S.large.slowF && S.mid.slowF >= 0.7 && S.large.slowF >= 0.6);
    const total = R.map(s => { const P = newPlayer(); knockPlayer(P, P.x, P.z, s); let t = 0; while (P.state !== 'run' && t < 6) { stepPlayer(P, NONE, 1 / 60); t += 1 / 60; } return t + P.slow; });
    check('被弾緩和：操作不能の時間＋遅い時間の合計は、中型で 2.7 秒以内（以前は約 4.6 秒）・大型でも 3.5 秒以内', total[1] <= 2.7 && total[2] <= 3.6, JSON.stringify(total));
    const loss = s => { const A = newPlayer(), B = newPlayer(); run(A, NONE, 8); run(B, NONE, 8); knockPlayer(B, B.x, B.z, s); run(A, NONE, 12); run(B, NONE, 12); return A.dist - B.dist; };
    const L = R.map(loss);
    check('被弾緩和：被弾で失う距離は中型で 15u 以内（以前は約 30u）で、ゼロにはならない（被弾は痛い）', L[1] <= 15 && L.every(v => v > 5), JSON.stringify(L.map(v => +v.toFixed(1))));
    check('被弾緩和：減速は復帰後に徐々に回復する（slowRamp 秒かけてなめらかに 1 へ）', H.slowRamp >= 0.5 && (() => { const P = newPlayer(); knockPlayer(P, P.x, P.z, 'mid'); runUntil(P, NONE, p => p.state === 'run', 6); const r = []; for (let i = 0; i < 60 * 3; i++) { stepPlayer(P, NONE, STEP); r.push(P.speed / speedAt(P.time)); } let up = 0; for (let i = 1; i < r.length; i++) if (r[i] > r[i - 1] + 1e-9) up++; return r[0] < 0.8 && r[r.length - 1] === 1 && up > H.slowRamp * 60 * 0.5 && r.every((v, i) => i === 0 || v >= r[i - 1] - 1e-9); })());
  })();
  // マグマの見え方（先端が近いとき恐竜が溶岩に隠れない）：溶岩の高さの倍率
  (() => {
    const V = CFG.magma.view;
    check('マグマ表示：遠いうちは高さ 1（そのまま）。先端が近づくほど単調に低くなり、最も近くても 0 にはならない（先端は見え続ける）', magmaViewScale(60, false) === 1 && magmaViewScale(V.far, false) === 1 && Math.abs(magmaViewScale(V.near, false) - V.min) < 1e-9 && Math.abs(magmaViewScale(0, false) - V.min) < 1e-9 && V.min > 0.1 && (() => { let p = 2; for (let g = 80; g >= 0; g -= 0.25) { const s = magmaViewScale(g, false); if (s > p + 1e-12) return false; p = s; } return true; })());
    check('マグマ表示：死亡のときだけ高さ 1（溶岩が恐竜を覆ってよい）', magmaViewScale(0, true) === 1 && magmaViewScale(3, true) === 1);
    check('マグマ表示：先端 3〜4u では溶岩の波頭の高さ（crestH × 倍率）が、カメラから恐竜の足もとへの視線より低い（隠さない）', (() => {
      const C = CFG.cam, M = CFG.magma; return [3, 4, 5, 6, 8].every(g => { const hs = magmaViewScale(g, false), crest = 0.1 + (M.crestH + 0.6 - 0.1) * hs, zc = g + 1.8, sight = C.height * zc / C.back; return zc > C.back || crest < sight; });
    })());
    check('マグマ表示：危険な距離の判定（触れたらゲームオーバー・danger ゲージ）は表示の倍率に影響されない', (() => { const a = magmaDanger(10), s = magmaViewScale(10, false); return a === magmaDanger(10) && s < 1 && magmaDanger(0) === CFG.magma.dangerGaps.length; })());
  })();
  // ボット評価（3 レーン制。見逃し率 err = 各危険を見逃す確率。dodge は隣のレーンへ避ける割合）
  const perfect = botSummary({ err: 0 }, 40), none = botSummary({ err: 1 }, 20), sloppy = botSummary({ err: 0.1 }, 40), bad = botSummary({ err: 0.2 }, 40), worse = botSummary({ err: 0.4 }, 40);
  const jumpy = botSummary({ err: 0, dodge: 0 }, 20), dodgy = botSummary({ err: 0, dodge: 1 }, 20);
  window.__bots = { perfect: botLine(perfect), sloppy10: botLine(sloppy), sloppy20: botLine(bad), sloppy40: botLine(worse), none: botLine(none), dodge0: botLine(jumpy), dodge1: botLine(dodgy) };
  const pre = document.createElement('pre'); pre.id = 'bots'; pre.style.cssText = 'color:#9ab;font-size:12px;margin-top:12px;white-space:pre-wrap';
  pre.textContent = Object.entries(window.__bots).map(([k, v]) => k + ': ' + v).join('\n'); document.body.appendChild(pre);
  check('ボット：完璧に避けるボットは 85% 以上クリアでき、クリア時間は 1〜3 分(約 2 分)', perfect.clearRate >= 0.85 && perfect.clearT >= 100 && perfect.clearT <= 140, botLine(perfect));
  check('ボット：ジャンプ・くぐる中心（dodge 0）でも、隣のレーンへ避ける中心（dodge 1）でも、完璧なら 80% 以上クリアできる', jumpy.clearRate >= 0.8 && dodgy.clearRate >= 0.8, botLine(jumpy) + ' / ' + botLine(dodgy));
  check('ボット：何も避けない(立ち止まる)ボットはほぼ全員(90% 以上)100 秒以内に死ぬ', none.clearRate <= 0.1 && Math.max(...none.deadTs) < 100, botLine(none));
  check('ボット：10% 見逃すボットは半分前後(40〜90%)クリア、20% / 40% と見逃すほど減る（ギリギリ）', sloppy.clearRate >= 0.4 && sloppy.clearRate <= 0.9 && bad.clearRate > 0.1 && bad.clearRate < sloppy.clearRate && worse.clearRate < bad.clearRate && worse.clearRate <= 0.4, botLine(sloppy) + ' / ' + botLine(bad) + ' / ' + botLine(worse));
  check('ボット：失敗するときの死亡時刻は後半(平均 70 秒以降)に偏る', isNaN(bad.deadT) || bad.deadT >= 70, botLine(bad));
})();
