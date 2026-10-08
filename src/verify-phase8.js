// ===== Phase 8：タイトル→開始、スコア、ベストスコア、クリア演出の状態機械、リスタート =====
(() => {
  const DT = 1 / 60, NOI = { left: false, right: false, jump: false }, SC = CFG.score, K = CFG.clear;
  const quietG = () => { const G = newGame(); G.OB.off = true; G.RS.timer = 1e9; return G; };   // 噴石・障害物の出ない、まっさらなゲーム
  const fakeStore = (init) => { const m = {}; if (init != null) m[SC.bestKey] = String(init); return { m, getItem: k => (k in m ? m[k] : null), setItem: (k, v) => { m[k] = String(v); } }; };
  const throwing = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  const ev0 = () => ({ landed: [], obstacle: { hits: [] } });
  const mkRock = (id, size, x, z) => ({ id, size, x, z, radius: CFG.rock.sizes[size].radius });
  const R_ = size => CFG.rock.sizes[size].radius + CFG.hit.dinoR;

  // ---- タイトル → 開始（flow）----
  check('flow：開いた直後は title。stepFlow を何度回してもゲームの時間・距離・噴火タイマーは進まない', (() => {
    const G = newGame(), F = newFlow(null); let ok = F.mode === 'title';
    for (let i = 0; i < 600; i++) stepFlow(F, G, { left: true, right: false, jump: true }, DT);
    return ok && F.mode === 'title' && G.P.time === 0 && G.P.dist === 0 && G.P.x === 0 && volcanoState(G.P.time).state === 'idle' && G.RS.rocks.length === 0 && !G.M.active && F.t > 9;
  })());
  check('flow：title で R は効かない / flowStart で playing になり、2 回目は何もしない', (() => {
    const G = newGame(), F = newFlow(null); const r0 = flowCanRestart(F), a = flowStart(F), b = flowStart(F);
    return !r0 && a === true && b === false && F.mode === 'playing' && !flowCanRestart(F);
  })());
  check('flow：開始すると時間が進み、前進を始める（噴火タイマーも開始から数える）', (() => {
    const G = quietG(), F = newFlow(null); flowStart(F); for (let i = 0; i < 300; i++) stepFlow(F, G, NOI, DT);
    return G.P.time > 4.9 && G.P.dist > 70 && volcanoState(G.P.time).state === 'erupting';
  })());
  check('flow：既存の newGame / stepGame は開始前の状態を持たず、そのまま playing（ボット評価・既存テストの前提）', (() => { const G = newGame(); stepGame(G, NOI, DT); return G.M.phase === 'playing' && G.P.time > 0; })());
  check('flow：開始の瞬間のカメラ角はタイトルの角度から 0（通常の後ろ追従）へ戻り、リスタートでは最初から 0', (() => {
    const G = newGame(), F = newFlow(null), a0 = flowCamAz(F); flowStart(F);
    const a1 = flowCamAz(F); for (let i = 0; i < Math.ceil(CFG.title.blend * 60) + 2; i++) stepFlow(F, G, NOI, DT);
    const a2 = flowCamAz(F); flowRestart(F, G, 3);
    return Math.abs(a0 - CFG.title.az) <= CFG.title.drift + 1e-9 && a1 > 0 && a2 === 0 && flowCamAz(F) === 0;
  })());

  // ---- 死亡 → R（タイトルを経由しない）----
  const dieFlow = () => { const G = quietG(), F = newFlow(fakeStore(0)); flowStart(F); for (let i = 0; i < 30; i++) stepFlow(F, G, NOI, DT); G.M.active = true; G.M.front = G.P.dist + 5; G.M.t = 50; let died = false; for (let i = 0; i < 5; i++) died = stepFlow(F, G, NOI, DT).died || died; return { G, F, died }; };
  check('flow：マグマに追いつかれると over。結果は 逃走距離 と スコアと ベスト を持ち、R が効く', (() => {
    const { G, F, died } = dieFlow();
    return died && F.mode === 'over' && flowCanRestart(F) && F.dist === Math.floor(G.P.dist) && F.score === F.dist + F.S.bonus && F.score > 0 && F.best === F.score && F.newRecord;
  })());
  check('flow：R（flowRestart）で全状態が初期化され、タイトルを経由せず playing。すぐ走り、噴火タイマーも最初から', (() => {
    const { G, F } = dieFlow(); const S0 = F.S; flowRestart(F, G, 7);
    const fresh = F.mode === 'playing' && G.P.time === 0 && G.P.dist === 0 && G.M.phase === 'playing' && !G.M.active && G.RS.rocks.length === 0 && F.S !== S0 && F.S.bonus === 0 && F.clear === null && F.score === 0 && !F.newRecord;
    for (let i = 0; i < 60; i++) stepFlow(F, G, NOI, DT);
    return fresh && G.P.dist > 14 && volcanoState(G.P.time).state === 'idle' && F.mode === 'playing';
  })());
  check('flow：何度 死亡→R を繰り返しても mode は title に戻らず、状態が持ち越されない', (() => {
    const G = quietG(), F = newFlow(null); flowStart(F);
    for (let n = 0; n < 5; n++) {
      for (let i = 0; i < 20; i++) stepFlow(F, G, NOI, DT);
      G.M.active = true; G.M.front = G.P.dist + 5; G.M.t = 50; for (let i = 0; i < 4; i++) stepFlow(F, G, NOI, DT);
      if (F.mode !== 'over') return false;
      flowRestart(F, G, n); G.OB.off = true; G.RS.timer = 1e9;
      if (F.mode !== 'playing' || G.P.time !== 0 || G.M.phase !== 'playing' || G.M.clearT !== 0 || F.S.bonus !== 0) return false;
    }
    return true;
  })());

  // ---- スコア：ギリギリ回避 ----
  const sg = () => { const G = newGame(); return { G, S: newScore() }; };
  check('スコア：着弾点から（半径＋恐竜半径）の 1.4 倍で無傷なら GREAT ESCAPE! で +100（中型）', (() => {
    const { G, S } = sg(), r = mkRock(1, 'mid', 1.4 * R_('mid'), 0), e = ev0(); e.landed.push({ rock: r, hit: false });
    scoreStep(S, G, e, DT); const t = scoreTake(S);
    return S.bonus === SC.rock && t.length === 1 && t[0].kind === 'great' && t[0].text === TEXT.great && t[0].pts === 100 && scoreTake(S).length === 0;
  })());
  check('スコア：大型のギリギリ回避は +300（BIG ESCAPE!!）', (() => { const { G, S } = sg(), e = ev0(); e.landed.push({ rock: mkRock(1, 'large', 1.3 * R_('large'), 0), hit: false }); scoreStep(S, G, e, DT); return S.bonus === SC.rockLarge && scoreTake(S)[0].kind === 'big'; })());
  check('スコア：1.8 倍より遠い（大きく外れた）噴石は加点なし。ちょうど 1.8 倍はギリギリ', (() => {
    const A = sg(), B = sg(), e1 = ev0(), e2 = ev0(); e1.landed.push({ rock: mkRock(1, 'small', 1.85 * R_('small'), 0), hit: false }); e2.landed.push({ rock: mkRock(2, 'small', 1.79 * R_('small'), 0), hit: false });
    scoreStep(A.S, A.G, e1, DT); scoreStep(B.S, B.G, e2, DT); return A.S.bonus === 0 && B.S.bonus === SC.rock;
  })());
  check('スコア：被弾した噴石はボーナスなし、さらに連続回避コンボが切れる', (() => {
    const { G, S } = sg(); S.combo = 5; const e = ev0(); e.landed.push({ rock: mkRock(1, 'mid', 0.1, 0), hit: true }); scoreStep(S, G, e, DT); return S.bonus === 0 && S.combo === 0;
  })());
  check('スコア：同じ噴石の着弾を 2 回流しても二重に加点しない（id ごとに 1 回）', (() => {
    const { G, S } = sg(); const r = mkRock(9, 'mid', 1.3 * R_('mid'), 0); for (let i = 0; i < 3; i++) { const e = ev0(); e.landed.push({ rock: r, hit: false }); scoreStep(S, G, e, DT); } return S.bonus === SC.rock && S.n.great === 1;
  })());
  check('スコア：吹き飛び中・復帰後の無敵中は加点しない', (() => {
    const A = sg(), B = sg(); A.G.P.state = 'knocked'; B.G.P.invuln = 1; const e1 = ev0(), e2 = ev0(); e1.landed.push({ rock: mkRock(1, 'mid', 1.3 * R_('mid'), 0), hit: false }); e2.landed.push({ rock: mkRock(2, 'mid', 1.3 * R_('mid'), 0), hit: false });
    scoreStep(A.S, A.G, e1, DT); scoreStep(B.S, B.G, e2, DT); return A.S.bonus === 0 && B.S.bonus === 0;
  })());
  check('スコア：円の中でジャンプして爆風の上を越えたら（1.0 倍未満でも）ギリギリ回避', (() => { const { G, S } = sg(); G.P.y = CFG.hit.maxY + 0.3; const e = ev0(); e.landed.push({ rock: mkRock(1, 'mid', 0.5, 0), hit: false }); scoreStep(S, G, e, DT); return S.bonus === SC.rock; })());
  check('スコア：大型の警告円の中にいて、着弾までに円の外へ逃げ切った → +300（遠く離れていても）。中型では同じでも加点なし', (() => {
    const A = sg(), B = sg(); A.G.RS.rocks.push(mkRock(1, 'large', 0, 0)); B.G.RS.rocks.push(mkRock(2, 'mid', 0, 0));
    scoreStep(A.S, A.G, ev0(), DT); scoreStep(B.S, B.G, ev0(), DT); const inside = A.S.inside[1] === true && B.S.inside[2] === true;
    A.G.RS.rocks = []; B.G.RS.rocks = []; A.G.P.x = 14; B.G.P.x = 14;   // 逃げた（1.8 倍より遠く）
    const ea = ev0(), eb = ev0(); ea.landed.push({ rock: mkRock(1, 'large', 0, 0), hit: false }); eb.landed.push({ rock: mkRock(2, 'mid', 0, 0), hit: false });
    scoreStep(A.S, A.G, ea, DT); scoreStep(B.S, B.G, eb, DT);
    return inside && A.S.bonus === SC.rockLarge && B.S.bonus === 0 && A.S.inside[1] === undefined;
  })());
  check('スコア：実際に stepGame で噴石を落とす：外れて着弾(1.4 倍)で +100、真下で被弾なら加点なし', (() => {
    const run = dx => {
      const G = quietG(), S = newScore(); G.OB.off = true; for (let i = 0; i < 20; i++) stepGame(G, NOI, DT);
      const w = CFG.rock.sizes.mid.warn; spawnRock(G.RS, 'mid', G.P.x + dx, G.P.z - G.P.speed * w - 0.05, null);
      let hit = false; for (let i = 0; i < 120; i++) { const ev = stepGame(G, NOI, DT); scoreStep(S, G, ev, DT); hit = hit || ev.landed.some(l => l.hit); }
      return { S, hit };
    };
    const a = run(1.4 * R_('mid')), b = run(0);
    return a.S.bonus === SC.rock && !a.hit && b.hit && b.S.bonus === 0;
  })());

  // ---- スコア：障害物の連続回避コンボ ----
  const mkOb = (id, z, x) => ({ id, type: 'rock', x: x == null ? 0 : x, z, hw: 1, hd: 1, r: 1, h: 1, hit: false });
  const passAll = (G, S, obs) => { G.OB.list = obs; G.P.z = Math.min(...obs.map(o => o.z)) - 5; scoreStep(S, G, ev0(), DT); };
  check('スコア：障害物を 1・2 個連続は加点なし、3 連続で +150(50×3)、4 連続でさらに +200', (() => {
    const { G, S } = sg(); const obs = [1, 2, 3, 4].map(i => mkOb(i, -10 * i));
    const seen = []; for (const o of obs) { G.OB.list = obs; G.P.z = o.z - 4; scoreStep(S, G, ev0(), DT); seen.push(S.bonus); }
    return seen[0] === 0 && seen[1] === 0 && seen[2] === 150 && seen[3] === 350 && S.combo === 4 && S.n.combo === 2;
  })());
  check('スコア：障害物にぶつかる（ev.obstacle.hits）とコンボがリセットされ、再び 3 連続が必要', (() => {
    const { G, S } = sg(); const obs = [1, 2, 3, 4, 5, 6].map(i => mkOb(i, -10 * i)); G.OB.list = obs;
    G.P.z = -34; scoreStep(S, G, ev0(), DT); const b1 = S.bonus, c1 = S.combo;
    const e = ev0(); e.obstacle.hits.push({ ob: obs[3], kind: 'trip' }); obs[3].hit = true; G.P.z = -44; scoreStep(S, G, e, DT);   // 4 個目にぶつかる
    const c2 = S.combo; G.P.z = -54; scoreStep(S, G, ev0(), DT); G.P.z = -64; scoreStep(S, G, ev0(), DT);
    return c1 === 3 && b1 === 150 && c2 === 0 && S.combo === 2 && S.bonus === 150;
  })());
  check('スコア：遠く(左右に離れて)通っただけの障害物は回避と数えず、コンボも切らない', (() => {
    const { G, S } = sg(); const obs = [mkOb(1, -10), mkOb(2, -20, 12), mkOb(3, -30)]; G.OB.list = obs; G.P.z = -34; scoreStep(S, G, ev0(), DT); return S.combo === 2 && S.bonus === 0;
  })());
  check('スコア：すでに ob.hit の障害物・無敵中に通った障害物は数えない。同じ障害物を何度見ても 1 回だけ', (() => {
    const { G, S } = sg(); const a = mkOb(1, -10); a.hit = true; G.OB.list = [a, mkOb(2, -20)]; G.P.z = -24; G.P.invuln = 1; scoreStep(S, G, ev0(), DT); const c0 = S.combo;
    G.P.invuln = 0; G.OB.list = [mkOb(3, -30)]; G.P.z = -36; scoreStep(S, G, ev0(), DT); scoreStep(S, G, ev0(), DT); scoreStep(S, G, ev0(), DT);
    return c0 === 0 && S.combo === 1;
  })());
  check('スコア：コンボの倍率は上限(comboCap)で頭打ち（暴走しない）', (() => {
    const { G, S } = sg(); const obs = []; for (let i = 1; i <= 14; i++) obs.push(mkOb(i, -10 * i)); G.OB.list = obs; G.P.z = -10 * 14 - 6; scoreStep(S, G, ev0(), DT);
    const last = S.events[S.events.length - 1]; return S.combo === 14 && last.pts === SC.comboMul * SC.comboCap;
  })());
  check('スコア：クレーター・マグマ溜まりも、横に避けて通れば回避（種類ごとの奥行きで判定）', (() => {
    const { G, S } = sg(); G.OB.list = [{ id: 1, type: 'pool', x: 3, z: -10, r: 2.5, hw: 2.5, hd: 2.5, hit: false }]; G.P.z = -10; scoreStep(S, G, ev0(), DT); const before = S.combo; G.P.z = -14; scoreStep(S, G, ev0(), DT); return before === 0 && S.combo === 1;
  })());

  // ---- スコア：マグマが近い状態 ----
  check('スコア：マグマとの距離が 20u 以内で走り続けると 1 秒ごとに +40。離れると連続が途切れる', (() => {
    const { G, S } = sg(); G.M.active = true; G.P.dist = 100; G.M.front = 90;   // 差 10
    for (let i = 0; i < 59; i++) scoreStep(S, G, ev0(), DT); const a = S.bonus; scoreStep(S, G, ev0(), DT); scoreStep(S, G, ev0(), DT); const b = S.bonus;
    for (let i = 0; i < 60; i++) scoreStep(S, G, ev0(), DT); const c = S.bonus;
    G.M.front = 70; scoreStep(S, G, ev0(), DT); const reset = S.nearT === 0; G.M.front = 90; for (let i = 0; i < 59; i++) scoreStep(S, G, ev0(), DT);
    return a === 0 && b === SC.magmaPerSec && c === 2 * SC.magmaPerSec && reset && S.bonus === 2 * SC.magmaPerSec;
  })());
  check('スコア：マグマが遠い・噴火前・吹き飛び中は加点なし', (() => {
    const A = sg(), B = sg(), C = sg(); A.G.M.active = true; A.G.P.dist = 100; A.G.M.front = 50; B.G.M.active = false; B.G.P.dist = 100; B.G.M.front = 90; C.G.M.active = true; C.G.P.dist = 100; C.G.M.front = 90; C.G.P.state = 'knocked';
    for (let i = 0; i < 300; i++) { scoreStep(A.S, A.G, ev0(), DT); scoreStep(B.S, B.G, ev0(), DT); scoreStep(C.S, C.G, ev0(), DT); } return A.S.bonus === 0 && B.S.bonus === 0 && C.S.bonus === 0;
  })());
  check('スコア：合計 = 距離(整数) + ボーナス。ボーナスが無ければ距離そのもの', (() => { const { G, S } = sg(); G.P.dist = 123.9; const a = scoreTotal(S, G.P); S.bonus = 250; return a === 123 && scoreTotal(S, G.P) === 373 && scoreTotal(S, G.P, 500.7) === 750; })());
  check('スコア：同じ入力を 2 回やれば同じ結果（乱数に依らない）', (() => {
    const f = () => { const G = quietG(), S = newScore(); spawnRock(G.RS, 'mid', 3, -40, null); for (let i = 0; i < 180; i++) { const ev = stepGame(G, NOI, DT); scoreStep(S, G, ev, DT); } return JSON.stringify([S.bonus, S.combo, S.n]); };
    return f() === f();
  })());

  // ---- ベストスコア（localStorage）----
  check('ベスト：保存と読み出し。値が無い・壊れた値・負の値は 0', (() => {
    const st = fakeStore(); const a = bestRead(st); bestWrite(st, 4321); const b = bestRead(st);
    st.m[SC.bestKey] = 'abc'; const c = bestRead(st); st.m[SC.bestKey] = '-5'; const d = bestRead(st);
    return a === 0 && b === 4321 && c === 0 && d === 0;
  })());
  check('ベスト：localStorage が例外を投げる/使えない/null でも落ちず、0 や false を返す', (() => {
    let ok = true; try { ok = bestRead(throwing) === 0 && bestWrite(throwing, 5) === false && bestRead(null) === 0 && bestWrite(null, 5) === false && bestRead(undefined) === 0; } catch (e) { return false; }
    let st; try { st = bestStorage(); } catch (e) { return false; }
    return ok && (st === null || typeof st === 'object');
  })());
  check('ベスト：スコアが上回ったときだけ更新・保存（NEW RECORD）。同点・下回りは更新しない', (() => {
    const st = fakeStore(1000), G = newGame(), F = newFlow(st); G.P.dist = 600; flowFinish(F, G.P); const low = !F.newRecord && F.best === 1000 && st.m[SC.bestKey] === '1000';
    G.P.dist = 1000; flowFinish(F, G.P); const same = !F.newRecord && F.best === 1000;
    F.S.bonus = 300; G.P.dist = 1500; flowFinish(F, G.P); return F.best === 0 ? false : low && same && F.newRecord && F.score === 1800 && F.best === 1800 && st.m[SC.bestKey] === '1800';
  })());
  check('ベスト：保存できない環境でも、そのセッション中はベストが更新され、NEW RECORD も出る（例外を出さない）', (() => {
    const G = newGame(), F = newFlow(throwing); const b0 = F.best; G.P.dist = 700; flowFinish(F, G.P); const a = F.newRecord && F.best === 700; G.P.dist = 300; flowFinish(F, G.P); return b0 === 0 && a && !F.newRecord && F.best === 700;
  })());
  check('ベスト：flow を作ると保存済みのベストを読む（タイトルに表示できる）', newFlow(fakeStore(2468)).best === 2468 && newFlow(null).best === 0);

  // ---- クリア演出の状態機械 ----
  const stages = ['runin', 'breathe', 'lookback', 'eruption', 'relief', 'result'];
  const nearGoal = () => { const G = quietG(), F = newFlow(fakeStore(0)); flowStart(F); G.P.dist = CFG.goal.distance - 0.5; G.P.time = 100; G.P.speed = 20.8; return { G, F }; };
  const toClear = (G, F) => { for (let i = 0; i < 10 && F.mode !== 'clear'; i++) stepFlow(F, G, NOI, DT); };
  check('クリア演出：段階は runin→breathe→lookback→eruption→relief→result の順で、秒数は CFG.clear どおり（誤差 1 フレーム）', (() => {
    const { G, F } = nearGoal(); toClear(G, F); if (F.mode !== 'clear') return false;
    const t0 = F.clear.T, at = {}; let t = 0, seq = [F.clear.stage];
    for (let i = 0; i < 60 * 30 && F.clear.stage !== 'result'; i++) { const e = stepFlow(F, G, NOI, DT); t += DT; e.clear.forEach(x => { if (x.indexOf('stage:') === 0) { at[x.slice(6)] = t; seq.push(x.slice(6)); } }); }
    const ex = { breathe: K.runIn, lookback: K.runIn + K.breathe, eruption: K.runIn + K.breathe + K.lookBack, relief: K.runIn + K.breathe + K.lookBack + K.eruption, result: K.runIn + K.breathe + K.lookBack + K.eruption + K.relief };
    return JSON.stringify(seq) === JSON.stringify(stages) && Object.keys(ex).every(k => Math.abs(at[k] - ex[k]) < 2 * DT);
  })());
  check('クリア演出：各段階の出来事（stage:…, boom, relief-text）は 1 回ずつ。boom は eruption の始まり、relief-text は relief の reliefText 秒後', (() => {
    const { G, F } = nearGoal(); toClear(G, F); const cnt = {}, when = {}; let t = 0;
    for (let i = 0; i < 60 * 30 && F.clear.stage !== 'result'; i++) { const e = stepFlow(F, G, NOI, DT); t += DT; e.clear.forEach(x => { cnt[x] = (cnt[x] || 0) + 1; when[x] = t; }); }
    for (let i = 0; i < 120; i++) stepFlow(F, G, NOI, DT).clear.forEach(x => { cnt[x] = (cnt[x] || 0) + 1; });
    const tb = K.runIn + K.breathe + K.lookBack;
    return cnt.boom === 1 && cnt['relief-text'] === 1 && stages.slice(1).every(s => cnt['stage:' + s] === 1) && Math.abs(when.boom - tb) < 2 * DT && Math.abs(when['relief-text'] - (tb + K.eruption + K.reliefText)) < 2 * DT;
  })());
  check('クリア演出：走り込みで指定の距離(stopDist)だけ進んでぴたりと止まり、速さは負にならず、行き過ぎない', (() => {
    for (const v0 of [6, 10, 16, 20.8, 26, 34]) {
      const C = { v0, d0: 0 }; let ps = 0;
      for (let t = 0; t <= K.runIn + 1; t += 0.01) { const r = clearRunAt(C, t); if (r.v < 0 || r.s < ps - 1e-9 || r.s > K.stopDist + 1e-9) return false; ps = r.s; }
      const e = clearRunAt(C, K.runIn); if (Math.abs(e.s - K.stopDist) > 1e-9 || e.v !== 0 || Math.abs(clearRunAt(C, 0).v - v0) > 1e-9) return false;
    }
    return true;
  })());
  check('クリア演出：実際に流して、クリア時の距離から stopDist 先で停止し(P.speed=0)、洞窟の中央(x=0)に寄る。クリア時の結果距離は到達時の値', (() => {
    const { G, F } = nearGoal(); G.P.lane = 2; G.P.x = laneX(2); toClear(G, F); const d0 = G.P.dist, fd = F.dist;
    for (let i = 0; i < 60 * (K.runIn + 0.5); i++) stepFlow(F, G, NOI, DT);
    return Math.abs(G.P.dist - (F.clear.d0 + K.stopDist)) < 1e-6 && G.P.speed === 0 && Math.abs(G.P.x) < 1e-9 && fd === Math.floor(F.clear.d0) && d0 >= CFG.goal.distance && Math.abs(G.P.z + G.P.dist) < 1e-9;
  })());
  check('クリア演出：R は演出中は効かず、結果画面（result）になってから効く。クリア→R で playing に戻り初期化', (() => {
    const { G, F } = nearGoal(); toClear(G, F); let early = false;
    for (let i = 0; i < 60 * 30 && F.clear.stage !== 'result'; i++) { early = early || flowCanRestart(F); stepFlow(F, G, NOI, DT); }
    const ok = !early && flowCanRestart(F); flowRestart(F, G, 4);
    return ok && F.mode === 'playing' && F.clear === null && G.M.phase === 'playing' && G.P.dist === 0 && G.P.state === 'run';
  })());
  check('クリア演出：Space で結果画面へ飛ばせる（skipFrom 秒より前は無視。連打のジャンプで誤って飛ばさない）', (() => {
    const { G, F } = nearGoal(); toClear(G, F); const a = clearSkip(F.clear, G.P);
    for (let i = 0; i < 60 * (K.skipFrom + 0.1); i++) stepFlow(F, G, NOI, DT);
    const st = F.clear.stage, b = clearSkip(F.clear, G.P), c = clearSkip(F.clear, G.P);
    return a.length === 0 && st !== 'result' && b.indexOf('stage:result') >= 0 && b.indexOf('skip') >= 0 && F.clear.stage === 'result' && c.length === 0 && flowCanRestart(F) && Math.abs(G.P.dist - (F.clear.d0 + K.stopDist)) < 1e-6 && F.clear.skipped;
  })());
  check('クリア演出：見た目の値は 0〜1 の範囲で、回る→爆発（閃光・驚き最大）→ほっとの順に動く', (() => {
    const C = { i: 0, t: 0 }, at = (i, t) => { C.i = i; C.t = t; return C; };
    const inRange = [0, 1, 2, 3, 4, 5].every(i => [0, 0.3, 1, 2.5, 4].every(t => { at(i, t); return [clearTurn(C), clearCam(C), clearShock(C), clearRelief(C), clearMega(C), clearFlash(C)].every(v => v >= 0 && v <= 1.0001); }));
    let mono = true, p = -1; for (let t = 0; t <= K.lookBack; t += 0.02) { const v = clearTurn(at(2, t)); if (v < p - 1e-9) mono = false; p = v; }
    return inRange && mono && clearTurn(at(1, 1)) === 0 && clearTurn(at(2, K.lookTurn)) === 1 && clearTurn(at(3, 0)) === 1 && clearCam(at(2, K.lookBack)) === 1 &&
      clearFlash(at(3, 0)) === K.flash.max && clearFlash(at(3, K.flash.sec)) === 0 && clearFlash(at(2, 0)) === 0 && clearShock(at(3, 0)) === 1 && clearShock(at(2, 1)) === 0 &&
      clearRelief(at(3, 1)) === 0 && clearRelief(at(5, 0)) === 1 && clearMega(at(3, 1)) === 1 && clearMega(at(2, 1)) === 0;
  })());
  check('クリア演出：火山の音は走り込みで小さくなり、大爆発で大きく、そのあと小さい。画面揺れは爆発で最大でも cap 以内', (() => {
    const C = { i: 0, t: 0 }, at = (i, t) => { C.i = i; C.t = t; return C; }, V = K.vol;
    const sh = clearShakeAmp(at(3, 0)); at(0, 0); const v0 = clearVolMul(C), v1 = clearVolMul(at(0, K.runIn)), v2 = clearVolMul(at(1, 1)), v3 = clearVolMul(at(3, 1)), v4 = clearVolMul(at(5, 1));
    return v0 === 1 && Math.abs(v1 - V.safe) < 1e-9 && v2 === V.safe && v3 === V.boom && v4 === V.after && V.safe < 1 && V.boom > 1 && fxShakeTotal([sh, 0.3, 0.2]) <= CFG.fx.shake.cap + 1e-9 && sh > 0.4;
  })());
  check('クリア演出：マグマは沈んで静まる（0 → lavaSink）、クリア前は沈まない', (() => { const C = { T: 0 }; const a = clearLavaSink(C); C.T = K.lavaSinkSec; const b = clearLavaSink(C); return a === 0 && Math.abs(b - K.lavaSink) < 1e-9; })());
  check('クリア：到達した距離のスコアが記録され、ベストが更新される（演出より前に確定）', (() => {
    const { G, F } = nearGoal(); toClear(G, F); return F.score >= CFG.goal.distance && F.score === F.dist + F.S.bonus && F.newRecord && F.best === F.score;
  })());
  check('障害物：ゴールの手前 safeZone から先（洞窟）には置かない。それより手前の配置は従来どおり', (() => {
    let nearZone = 0, any = 0, planned = 0; const zone = CFG.goal.distance - CFG.clear.safeZone;
    for (const seed of [1, 7, 99, 1234]) {
      const OB = newObstacles(seed), P = newPlayer(); P.dist = CFG.goal.distance - 100; P.z = -P.dist;
      stepObstacles(OB, P, DT); nearZone += OB.list.filter(o => o.dist >= zone).length; any += OB.list.length;
      planned += planObstacles(seed, -zone, -(zone + 80)).length;   // 何もしなければ置かれていたはずの数（フィルタに効果があること）
    }
    return nearZone === 0 && any > 0 && planned > 0;
  })());
  check('調整値：クリア演出の秒数は合計 10〜20 秒、洞窟は恐竜が入って回り込める大きさ（停止位置が入口より奥、回り込みの半径が半幅以内）', (() => {
    const tot = K.runIn + K.breathe + K.lookBack + K.eruption + K.relief, cv = K.cave;
    return tot >= 10 && tot <= 20 && K.stopDist > cv.mouth - 0 && K.lookTurn < K.lookBack && K.reliefText < K.relief && CFG.orbit.R < cv.halfW && K.stopDist + CFG.orbit.R < cv.mouth + cv.length;
  })());
  check('dt の上限（タブ復帰で巨大にならない）は 0.1 秒以下', CFG.dt.max > 0 && CFG.dt.max <= 0.1);
})();
