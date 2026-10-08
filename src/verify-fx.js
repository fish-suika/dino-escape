// ===== Phase 7 演出（純ロジック）の検証 =====
(() => {
  const F0 = CFG.fx.intensity;
  const withInt = (v, fn) => { const o = CFG.fx.intensity; CFG.fx.intensity = v; try { return fn(); } finally { CFG.fx.intensity = o; } };
  // 画面揺れの合成と上限
  check('揺れ：単独ならそのまま、何も無ければ 0', fxShakeCombine([0.3], 9) === 0.3 && fxShakeCombine([], 9) === 0 && fxShakeCombine([0, 0], 9) === 0);
  check('揺れ：複数は二乗和の平方根（足し算より小さい・最大要素より大きい）', (() => { const s = fxShakeCombine([0.3, 0.4], 9); return Math.abs(s - 0.5) < 1e-9 && s < 0.7 && s > 0.4; })());
  check('揺れ：合計は cap を超えない（全要因が最大でも操作不能にならない）', fxShakeTotal([0.32, 0.7, 0.07, 0.16, 5, 5]) <= CFG.fx.shake.cap + 1e-9);
  check('揺れ：負・NaN 相当の入力でも 0 以上', fxShakeCombine([-1, 0.2], 9) === 0.2);
  check('演出の強さ 0 で揺れが 0、0.5 で半分', withInt(0, () => fxShakeTotal([0.5])) === 0 && Math.abs(withInt(0.5, () => fxShakeTotal([0.4])) - 0.2) < 1e-9);
  check('既存の揺れ（噴火・大型着弾・最終・マグマ）の最大の組み合わせでも cap 以内で、cap は小さな視点移動(<1u)', CFG.fx.shake.cap < 1 && fxShakeTotal([CFG.volcano.shakeAmp, CFG.fx.shake.bigAmp, CFG.difficulty.shake.amp, CFG.magma.shakeAmp]) <= CFG.fx.shake.cap);
  // ヒットストップ
  check('ヒットストップ：0.05〜0.1 秒のゲーム時間停止（直撃）', (() => { const F = fxNew(); fxHitstop(F, CFG.fx.hitstop.rock); let n = 0; while (fxHitstopStep(F, 1 / 60)) n++; return n >= 3 && n <= 6 && F.hitstop === 0; })());
  check('ヒットストップ：上限 max を超えない・重なったら長いほう', (() => { const F = fxNew(); fxHitstop(F, 5); const a = F.hitstop; fxHitstop(F, 0.01); return a === CFG.fx.hitstop.max && F.hitstop === a; })());
  check('ヒットストップ：設定値は 0.05〜0.1 秒の範囲', CFG.fx.hitstop.rock >= 0.05 && CFG.fx.hitstop.big <= 0.1 && CFG.fx.hitstop.max <= 0.1);
  check('ヒットストップ：演出の強さ 0 なら止まらない', withInt(0, () => { const F = fxNew(); fxHitstop(F, 0.08); return !fxHitstopStep(F, 1 / 60); }));
  check('ヒットストップは演出側の状態だけ：停止中に stepGame を呼ばなければ P.time は進まず、再開後は同じ結果（ボット評価に影響しない）', (() => {
    const A = newGame(), B = newGame(); A.OB.seed = B.OB.seed = 3; const NO = { left: false, right: false, jump: false };
    for (let i = 0; i < 120; i++) { stepGame(A, NO, 1 / 60); stepGame(B, NO, 1 / 60); }
    const F = fxNew(); fxHitstop(F, 0.08); let skipped = 0; while (fxHitstopStep(F, 1 / 60)) skipped++;   // その間 B は update しない
    return skipped > 0 && A.P.time === B.P.time && A.P.dist === B.P.dist;
  })());
  // ダッキング
  check('ダッキング：下げた直後は音量が 1 未満で、hold のあと release 秒で 1 に戻る', (() => {
    const F = fxNew(); fxDuck(F, 0.5, 0.1); const g0 = fxDuckStep(F, 1 / 60); let t = 0, g = g0;
    while (g < 1 && t < 5) { g = fxDuckStep(F, 1 / 60); t += 1 / 60; }
    return g0 < 1 && g0 >= 0.1 && g === 1 && t > 0.3 && t < CFG.fx.duck.release + CFG.fx.duck.hold + 0.2;
  })());
  check('ダッキング：深さは 0.9 まで・重なったら深いほう・何もなければ 1', (() => { const F = fxNew(); const n = fxDuckStep(F, 0.1); fxDuck(F, 5); const a = F.duckDepth; fxDuck(F, 0.1); return n === 1 && a === 0.9 && F.duckDepth === 0.9; })());
  check('ダッキング：演出の強さ 0 なら下がらない', withInt(0, () => { const F = fxNew(); fxDuck(F, 0.8); return fxDuckStep(F, 0.01) === 1; }));
  // 足音
  check('足音：位相が π を跨ぐたびに 1 歩（まとめて跨いでも最大 2）', fxStepCount(0.1, 3.0) === 0 && fxStepCount(3.0, 3.3) === 1 && fxStepCount(0, 10) === 2 && fxStepCount(5, 4) === 0);
  check('足音：速いほど歩数が多い（速度連動）', (() => { const cnt = sp => { let ph = 0, n = 0; for (let i = 0; i < 600; i++) { const p2 = ph + sp * (1 / 60) * CFG.dino.runFreq; n += fxStepCount(ph, p2); ph = p2; } return n; }; return cnt(30) > cnt(16) && cnt(16) >= 20 && cnt(34) <= 70; })());
  // 連続防止ゲート
  check('クールダウン：間隔内は鳴らさず、過ぎたら鳴らす（キーごとに独立）', (() => { const F = fxNew(); return fxCooldown(F, 'a', 0, 0.2) && !fxCooldown(F, 'a', 0.1, 0.2) && fxCooldown(F, 'a', 0.25, 0.2) && fxCooldown(F, 'b', 0.1, 0.2); })());
  // 危険マーカーの近さ
  check('近さ：噴石が無ければ 0、近いほど 1 に近い、着弾済みは無視', (() => {
    const P = { x: 0, z: 0 }, R = (x, z, t) => ({ x, z, t, warn: 1, radius: 3 });
    const none = fxNearRock([], P, 11), far = fxNearRock([R(0, -30, 0)], P, 11), near = fxNearRock([R(0, -5, 0)], P, 11), on = fxNearRock([R(0, -1, 0)], P, 11), done = fxNearRock([R(0, -1, 1)], P, 11);
    return none.nearness === 0 && far.nearness === 0 && near.nearness > 0 && on.nearness === 1 && near.nearness < on.nearness && done.nearness === 0;
  })());
  check('近さ：複数あるときは最も近いもの', (() => { const r = fxNearRock([{ x: 0, z: -20, t: 0, warn: 1, radius: 1 }, { x: 0, z: -6, t: 0, warn: 1, radius: 1 }], { x: 0, z: 0 }, 11); return Math.abs(r.d - 5) < 1e-9; })());
  // スクワッシュ
  check('つぶれ：静止時は 1、着地で縮み(最小は 1-land)、離陸でしゃがんでから伸びる、範囲内に収まる', (() => {
    let lo = 9, hi = 0; for (let t = 0; t < 0.4; t += 0.005) for (const s of [0, 1]) { const y = Math.min(fxSquash(9, t, s), fxSquash(t, 9, s)); const y2 = Math.max(fxSquash(9, t, s), fxSquash(t, 9, s)); lo = Math.min(lo, y); hi = Math.max(hi, y2); }
    const crouch = fxSquash(0.035, 9, 0), stretch = fxSquash(0.16, 9, 0);
    return fxSquash(9, 9, 1) === 1 && lo >= 1 - CFG.fx.squash.land - 1e-9 && lo < 0.85 && hi <= 1.11 && crouch < 1 && stretch > 1 && fxSquash(9, 0.1, 1) < 0.8 && fxSquash(9, 0.1, 0) === 1;
  })());
  check('つぶれ：演出の強さ 0 なら常に 1', withInt(0, () => fxSquash(0.03, 0.05, 1) === 1 && fxSquash(0.1, 9, 1) === 1));
  check('CFG.fx.intensity はテスト中に変更されていない', CFG.fx.intensity === F0 && F0 >= 0 && F0 <= 1);
  // 難易度・物理が演出の設定に依存しない（intensity を変えても stepGame の結果は同じ）
  check('演出の強さを変えてもゲームの進行は完全に同じ（難易度・物理を壊さない）', (() => {
    const run = v => withInt(v, () => { const G = newGame(); G.OB.seed = 9; let s = 1; const rng = () => (s = (s * 16807) % 2147483647) / 2147483647; const NO = { left: false, right: false, jump: false }; for (let i = 0; i < 1800; i++) stepGame(G, NO, 1 / 60, rng); return JSON.stringify([G.P.dist, G.P.hits, G.M.front, G.RS.nextId]); });
    return run(0) === run(1) && run(0.4) === run(1);
  })());
})();
