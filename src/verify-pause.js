// ===== 改修B：一時停止（ポーズ）と、タイトルへ戻る =====
(() => {
  const DT = 1 / 60, NOI = { left: false, right: false, slide: false }, CP = CFG.pause;
  const quietG = () => { const G = newGame(); G.OB.off = true; G.RS.timer = 1e9; return G; };
  const run = (F, G, n) => { for (let i = 0; i < n; i++) stepFlow(F, G, NOI, DT); };
  const playing = () => { const G = quietG(), F = newFlow(null); flowStart(F); run(F, G, 60); return { G, F }; };
  const snap = G => JSON.stringify([G.P.time, G.P.dist, G.P.x, G.P.z, G.P.speed, G.M.t, G.M.front, G.RS.timer, G.RS.rocks.length]);

  check('ポーズ：playing のときだけ入れる。タイトル・ゲームオーバー・クリア演出中・結果画面では入れない', (() => {
    const G = quietG(), F = newFlow(null); const t = flowPause(F);
    flowStart(F); F.mode = 'over'; const o = flowPause(F);
    F.mode = 'clear'; F.clear = newClearSeq(16, G.P); const c = flowPause(F); F.clear.stage = 'result'; const r = flowPause(F);
    return !t && !o && !c && !r && !F.paused;
  })());
  check('ポーズ：一時停止中は stepFlow を何度回しても時間・距離・噴火タイマー・マグマ・噴石が進まない', (() => {
    const { G, F } = playing(); const a = snap(G); flowPause(F); run(F, G, 600);
    return F.paused && snap(G) === a && flowMenuShown(F);
  })());
  check('ポーズ：連打しても二重にならない（pause を 5 回 → 1 回分・resume を 5 回 → カウントダウンは 1 本）', (() => {
    const { F } = playing(); const r = [1, 2, 3, 4, 5].map(() => flowPause(F)); F.pauseSel = 2;
    const q = [1, 2, 3, 4, 5].map(() => flowResume(F));
    return r[0] === true && r.slice(1).every(x => x === false) && q[0] === true && q.slice(1).every(x => x === false) && F.resumeT === CP.stepSec * CP.steps;
  })());
  check('ポーズ：再開は 3→2→1 のカウントダウン（各 stepSec 秒）を挟み、その間はゲームが動かない。終わると動き出す', (() => {
    const { G, F } = playing(); flowPause(F); const a = snap(G); flowResume(F);
    const seen = []; let guard = 0;
    while (F.paused && guard++ < 1000) { const nn = flowCountNum(F); if (seen[seen.length - 1] !== nn) seen.push(nn); stepFlow(F, G, NOI, DT); }
    const frozen = snap(G) === a, still = !F.paused && !flowCounting(F);
    run(F, G, 30);
    return frozen && still && seen.join() === '3,2,1' && G.P.time > 0.4 && Math.abs(guard * DT - CP.stepSec * CP.steps) < 0.05;
  })());
  check('ポーズ：再開カウントダウン中に Esc（flowPause）するとメニューへ戻る。もう一度再開すればまた最初から数える', (() => {
    const { G, F } = playing(); flowPause(F); flowResume(F); run(F, G, 70);
    const back = flowPause(F), inMenu = flowMenuShown(F) && F.resumeT === 0; flowResume(F);
    return back && inMenu && F.resumeT === CP.stepSec * CP.steps && flowCountNum(F) === 3;
  })());
  check('ポーズ：メニューの選択は ↑↓ で循環（4 項目）。カウントダウン中・ポーズ外では動かない', (() => {
    const { F } = playing(); const out = flowMenuMove(F, 1); flowPause(F);
    const a = [flowMenuMove(F, 1), F.pauseSel], b = (flowMenuMove(F, -1), flowMenuMove(F, -1), F.pauseSel), c = (flowMenuMove(F, 1), F.pauseSel);
    F.pauseSel = 0; flowMenuMove(F, -1); const wrap = F.pauseSel; F.pauseSel = 3; flowMenuMove(F, 1); const wrap2 = F.pauseSel;
    flowResume(F); const cnt = flowMenuMove(F, 1);
    return !out && a[0] && a[1] === 1 && b === 3 && c === 0 && wrap === 3 && wrap2 === 0 && !cnt && PAUSE_ITEMS.length === 4;
  })());
  check('ポーズ：決定。再開はカウントダウンを始め、それ以外は項目名を返す。メニューが出ていないときは null', (() => {
    const { F } = playing(); const none = flowMenuChoose(F, 0); flowPause(F);
    const names = [1, 2, 3].map(i => flowMenuChoose(F, i)); const res = flowMenuChoose(F, 0), again = flowMenuChoose(F, 0);
    return none === null && names.join() === 'restart,title,mute' && res === 'resume' && flowCounting(F) && again === null;
  })());
  check('ポーズ：ポーズ中に経過した時間はゲームに入らない（途中で 10 秒止めても結果が同じ）', (() => {
    const A = playing(), B = playing(); run(A.F, A.G, 120);
    run(B.F, B.G, 60); flowPause(B.F); run(B.F, B.G, 600); flowResume(B.F); let g = 0; while (B.F.paused && g++ < 999) stepFlow(B.F, B.G, NOI, DT); run(B.F, B.G, 59);
    return Math.abs(A.G.P.time - B.G.P.time) < DT * 2 && Math.abs(A.G.P.dist - B.G.P.dist) < 1.5;
  })());
  check('ポーズ：最初からやり直す（flowRestart）でポーズ状態も初期化され、すぐ playing で動く', (() => {
    const { G, F } = playing(); flowPause(F); flowMenuMove(F, 2); flowRestart(F, G, 5); run(F, G, 30);
    return F.mode === 'playing' && !F.paused && F.resumeT === 0 && F.pauseSel === 0 && G.P.time > 0.4 && flowPause(F);
  })());
  check('ポーズ：タイトルに戻る（flowToTitle）で全初期化。時間は止まったまま、Space（flowStart）でまた開始できる。ベストは残る', (() => {
    const st = { m: {}, getItem(k) { return k in this.m ? this.m[k] : null; }, setItem(k, v) { this.m[k] = String(v); } };
    const G = quietG(), F = newFlow(st); F.best = 1234; flowStart(F); run(F, G, 200); flowPause(F); flowMenuMove(F, 1); flowToTitle(F, G, 9);
    const fresh = newGame(); const t0 = F.mode === 'title' && !F.paused && F.pauseSel === 0 && G.P.time === 0 && G.P.dist === 0 && G.P.x === 0 && G.RS.rocks.length === 0 && !G.M.active && F.best === 1234 && F.S.bonus === 0 && !flowPause(F);
    run(F, G, 300); const still = G.P.time === 0 && F.mode === 'title';
    const s = flowStart(F); run(F, G, 60);
    return t0 && still && s && F.mode === 'playing' && G.P.time > 0.9 && F.fromTitle === true && fresh.P.speed <= G.P.speed + 1e-9;
  })());
  check('ポーズ：開始→一時停止→やり直す / タイトルへ を 3 周しても状態が持ち越されない（距離・スコア・噴石・障害物・マグマ）', (() => {
    const F = newFlow(null); const G = newGame(); let ok = true;
    for (let k = 0; k < 3; k++) {
      flowStart(F); run(F, G, 400 + k * 60); flowPause(F); run(F, G, 30);
      if (k % 2 === 0) flowRestart(F, G, 11 + k); else flowToTitle(F, G, 11 + k);
      ok = ok && G.P.time === 0 && G.P.dist === 0 && G.RS.rocks.length === 0 && G.OB.list.length === 0 && !G.M.active && F.S.bonus === 0 && F.S.combo === 0 && !F.paused;
    }
    return ok;
  })());
})();

// ===== 改修C：ゲーム名・操作文言（ジャンプ廃止）=====
(() => {
  check('文言：ゲーム名（ロゴ・タブのタイトル）は英語の DINO ESCAPE、サブタイトルは日本語のまま', TEXT.logo === 'DINO ESCAPE' && TEXT.docTitle.indexOf('DINO ESCAPE') === 0 && TEXT.tag === '火山から逃げろ！');
  check('文言：操作ヒント・キー表にジャンプが無く、レーン移動・くぐる・一時停止・音がある', TEXT.hint.indexOf('ジャンプ') < 0 && TEXT.keyJump === undefined && TEXT.keySpace === undefined && TEXT.hint.indexOf('レーン移動') >= 0 && TEXT.hint.indexOf('くぐる') >= 0 && TEXT.hint.indexOf('一時停止') >= 0 && TEXT.hint.indexOf('音') >= 0);
})();
