// ===== 検証（three.js を使わない純粋ロジック） =====
const $out = document.getElementById('out');
let nOk = 0, nNg = 0;
function check(name, cond, why) {
  const d = document.createElement('div'); d.className = 'r ' + (cond ? 'ok' : 'ng'); d.textContent = name;
  if (!cond) { nNg++; const w = document.createElement('div'); w.className = 'why'; w.textContent = why || ''; d.appendChild(w); } else nOk++;
  $out.appendChild(d);
}
const NONE = { left: false, right: false, slide: false };
function run(P, inp, sec, dt = 1 / 60) { const n = Math.round(sec / dt); for (let i = 0; i < n; i++) stepPlayer(P, i === 0 ? inp : NONE, dt); return P; }   // 入力は最初の 1 フレームだけ（押した瞬間）

// 速度
check('開始時の速度は baseSpeed', speedAt(0) === CFG.run.baseSpeed);
check('速度は時間で増える（10秒後 > 0秒後）', speedAt(10) > speedAt(0));
check('速度は maxSpeed で頭打ち', speedAt(1e6) === CFG.run.maxSpeed);
check('速度は単調増加', (() => { let p = 0; for (let t = 0; t < 2000; t += 7) { const s = speedAt(t); if (s < p) return false; p = s; } return true; })());

// 前進
(() => {
  const P = newPlayer(); run(P, NONE, 5);
  check('何も押さなくても前進し続ける（z が減る）', P.z < 0 && P.dist > 0);
  check('距離 = -z', Math.abs(P.dist + P.z) < 1e-9);
  const expect = CFG.run.baseSpeed * 5;
  check('5秒の距離は基準速度×5 以上、加速込みの上限以内', P.dist >= expect - 0.5 && P.dist <= speedAt(5) * 5 + 0.5, 'dist ' + P.dist);
  check('何も押さなければ x は 0 のまま', P.x === 0 && P.vx === 0);
})();

// 3 レーン制の横移動（左右キーは「押した瞬間」だけ有効。1 回 = 1 レーン）
(() => {
  const L = CFG.lane, W = L.width, sh = L.shiftSec, F = 1 / 60;
  const fresh = () => newPlayer();
  check('レーン：3 本・レーン幅は 4〜5u・移動は 0.12〜0.15 秒・開始は中央', L.count === 3 && W >= 4 && W <= 5 && sh >= 0.12 && sh <= 0.15 && fresh().lane === 1 && fresh().x === 0 && laneX(0) === -W && laneX(1) === 0 && laneX(2) === W);
  check('レーン：laneNearest は x に一番近いレーン（範囲外は端）', laneNearest(0.4) === 1 && laneNearest(-3) === 0 && laneNearest(3) === 2 && laneNearest(99) === 2 && laneNearest(-99) === 0);
  const P = fresh(); stepPlayer(P, { ...NONE, right: true }, F);
  check('右キーで右のレーンへ動き始める（lane が 2 になり、x は途中）', P.lane === 2 && P.laneMove && P.x > 0 && P.x < W && P.vx > 0, 'x ' + P.x);
  let mono = true, px = P.x, t = F, done = -1; while (t < 1) { stepPlayer(P, NONE, F); if (P.x < px - 1e-12) mono = false; px = P.x; t += F; if (done < 0 && !P.laneMove) done = t; }
  check('移動はなめらか（単調に進む）で shiftSec 前後で到着し、ぴったりレーン中心に止まる', mono && Math.abs(done - sh) < 2 * F + 1e-9 && P.x === W && P.lane === 2 && P.vx === 0, 'done ' + done + ' x ' + P.x);
  check('押しっぱなし（新しい押下なし）では連続して動かない（1 押下 = 1 レーン）', P.lane === 2 && P.x === W);
  const Q = fresh(); let held = 0; for (let i = 0; i < 120; i++) { stepPlayer(Q, i === 0 ? { ...NONE, left: true } : NONE, F); held++; }
  check('左キー 1 回で左のレーンへ（それ以上は動かない）', Q.lane === 0 && Q.x === -W);
  const E = fresh(); run(E, { ...NONE, right: true }, 1); run(E, { ...NONE, right: true }, 1);
  check('右端のレーンでさらに右を押しても動かない・バッファも残らない', E.lane === 2 && E.x === W && !E.laneMove && E.laneBuf.length === 0);
  const B2 = fresh(); run(B2, { left: true, right: true, slide: false }, 0.5);
  check('左右同時押しは動かない', B2.x === 0 && B2.lane === 1);
  // 入力バッファ：移動中に来た入力を覚えて、終わったら順に実行
  const A = fresh(); A.lane = 0; A.x = -W; stepPlayer(A, { ...NONE, right: true }, F); stepPlayer(A, { ...NONE, right: true }, F);
  check('移動中に来た入力は覚えられる（バッファ 1 件）', A.laneBuf.length === 1 && A.lane === 1);
  run(A, NONE, 0.5);
  check('覚えた入力が移動の終わりに実行され、2 回押せば 2 レーン先に着く（取りこぼさない）', A.lane === 2 && A.x === W && !A.laneMove && A.laneBuf.length === 0, 'lane ' + A.lane);
  const C = fresh(); stepPlayer(C, { ...NONE, right: true }, F); stepPlayer(C, { ...NONE, left: true }, F); run(C, NONE, 0.6);
  check('右→左と素早く押すと、右へ行ってから左へ戻る（順に実行）', C.lane === 1 && C.x === 0);
  (() => {
    const sh0 = L.shiftSec; L.shiftSec = 0.4;
    try {
      const X = fresh(); X.lane = 0; X.x = -W; stepPlayer(X, { ...NONE, right: true }, F); stepPlayer(X, { ...NONE, right: true }, F); run(X, NONE, 0.6);
      const Y = fresh(); Y.lane = 0; Y.x = -W; stepPlayer(Y, { ...NONE, right: true }, F); run(Y, NONE, 0.3); stepPlayer(Y, { ...NONE, right: true }, F); run(Y, NONE, 0.6);
      check('バッファは bufferSec を過ぎると捨てられる（早すぎる入力は忘れ、終わり際の入力は実行）', X.lane === 1 && Y.lane === 2, X.lane + ' / ' + Y.lane);
    } finally { L.shiftSec = sh0; }
  })();
  let lo = 9; const Z = fresh(); const seq = []; for (let i = 0; i < 600; i++) { stepPlayer(Z, { left: i % 7 === 0, right: i % 5 === 0 || i % 11 === 0, slide: i % 31 === 0 }, F); seq.push(Z.lane); if (Math.abs(Z.x) > W + 1e-9) lo = 0; }
  check('入力を乱打しても、レーンは 0〜2 の範囲・x は両端のレーン中心を超えない', lo === 9 && seq.every(l => l >= 0 && l <= 2));
  check('装飾の置き方：道側のふちは走れる範囲 maxX の外に余裕（decorGap / vergeGap）をとる（大きさによらず中心 x の最小値で保証）', CFG.world.decorGap > 2 && CFG.world.vergeGap > 1 && [0, 0.5, 4.5, 30].every(e => Math.abs(decorMinX(e, CFG.world.decorGap) - e - (CFG.move.maxX + CFG.world.decorGap)) < 1e-9) && decorMinX(1, CFG.world.vergeGap) - 1 > CFG.move.maxX && CFG.move.maxX > W);
  (() => {   // ジャンプ廃止：jump 入力は無視される。y は 0 のまま・着地状態のまま・速さも変わらない
    const J = fresh(), K = fresh(); let ok = true;
    for (let i = 0; i < 120; i++) { stepPlayer(J, { ...NONE, jump: i % 7 === 0 }, F); stepPlayer(K, NONE, F); if (J.y !== 0 || J.vy !== 0 || !J.grounded) ok = false; }
    check('ジャンプは廃止：jump 入力を何度送っても y = 0・vy = 0・接地のまま、走りも入力なしと同じ', ok && J.dist === K.dist && J.x === K.x && !J.sliding, 'y ' + J.y);
    check('ジャンプ関連の調整値と関数は無い（CFG.jump / jumpStats / slide.dive）', typeof CFG.jump === 'undefined' && typeof jumpStats === 'undefined' && CFG.slide.dive === undefined && CFG.hit.maxY === undefined && CFG.cam.jumpLift === undefined);
  })();
  const P5 = fresh(); run(P5, { ...NONE, right: true }, 1); const d1 = P5.dist, Q5 = fresh(); run(Q5, NONE, 1);
  check('レーン移動中も前進速度は変わらない', Math.abs(d1 - Q5.dist) < 1e-9);
})();

// 走り（ジャンプ廃止）
(() => {
  const R = newPlayer(); run(R, NONE, 0.5);
  check('何もしなければ y = 0・接地のまま', R.y === 0 && R.grounded && R.vy === 0);
  const Q = newPlayer(); run(Q, { ...NONE, slide: true }, 0.3);
  check('くぐる中も y = 0（地面を滑る）', Q.sliding && Q.y === 0 && Q.grounded);
})();


// くぐる（スライド）
(() => {
  const S = CFG.slide, F = 1 / 60;
  const P = newPlayer(); stepPlayer(P, { ...NONE, slide: true }, F);
  check('スライド：地上で押すと滑走が始まり、当たり判定の高さが低くなる', P.sliding && playerHeight(P) === S.slideH && S.slideH < S.standH && !newPlayer().sliding && playerHeight(newPlayer()) === S.standH);
  let t = F; while (P.sliding && t < 3) { stepPlayer(P, NONE, F); t += F; }
  check('スライド：継続は約 0.7 秒で終わる', Math.abs(t - S.sec) < 2 * F + 1e-9 && !P.sliding, 't ' + t);
  check('スライド：終わった直後はクールダウン（slideCd）', Math.abs(P.slideCd - S.cooldown) < 2 * F);
  check('スライド：クールダウン明けに押せばまた滑れる', (() => { const X = newPlayer(); stepPlayer(X, { ...NONE, slide: true }, F); run(X, NONE, S.sec + S.cooldown + 0.1); stepPlayer(X, { ...NONE, slide: true }, F); return X.sliding; })());
  check('スライド：早押し（明ける直前に押す）は覚えていて、明けた瞬間に始まる', (() => { const X = newPlayer(); stepPlayer(X, { ...NONE, slide: true }, F); run(X, NONE, S.sec + F); run(X, NONE, S.cooldown - 0.1); stepPlayer(X, { ...NONE, slide: true }, F); const was = X.sliding; run(X, NONE, 0.15); return !was && X.sliding; })());
  const T = newPlayer(); run(T, NONE, 1); const U = newPlayer(); stepPlayer(U, { ...NONE, slide: true }, F); run(U, NONE, 1 - F);
  check('スライド：前進速度は変わらない', Math.abs(T.dist - U.dist) < 1e-9);
  const K = newPlayer(); stepPlayer(K, { ...NONE, slide: true }, F); knockPlayer(K, 0, 0, 'mid');
  check('スライド：吹き飛ばされたら滑走は終わる', !K.sliding && K.slideT === 0);
  const M = newPlayer(); stepPlayer(M, { ...NONE, slide: true }, F); stepPlayer(M, { ...NONE, right: true }, F); run(M, NONE, 0.2);
  check('スライド：滑走中もレーン移動できる', M.lane === 2 && M.sliding);
  check('スライド：高さの設計（梁の下端 > 滑走の高さ / 梁の下端 < 立ちの高さ）', CFG.obstacle.arch.clear > S.slideH + 0.3 && CFG.obstacle.arch.clear < S.standH - 0.5, JSON.stringify({ c: CFG.obstacle.arch.clear }));
})();

// dt 非依存（フレームレートが違っても距離がほぼ同じ）
(() => {
  const A = newPlayer(); run(A, { ...NONE, right: true }, 3, 1 / 60); const B = newPlayer(); run(B, { ...NONE, right: true }, 3, 1 / 30);
  check('60fps と 30fps で 3 秒後の距離がほぼ同じ・レーン移動の結果も同じ', Math.abs(A.dist - B.dist) < 0.5 && A.lane === B.lane && A.x === B.x, A.dist + ' vs ' + B.dist);
})();

// 火山の噴火状態
(() => {
  const V = CFG.volcano, B = volcanoState(V.eruptDelay - 0.01), A = volcanoState(V.eruptDelay + 0.01);
  check('噴火前は idle・強度 0', volcanoState(0).state === 'idle' && B.state === 'idle' && B.k === 0 && B.shake === 0 && B.flash === 0 && !B.boom);
  check('負の時間でも idle', volcanoState(-5).state === 'idle');
  check('噴火前も少し煙を出している', B.smoke === V.idleSmoke && V.idleSmoke > 0);
  check('eruptDelay を過ぎると erupting', A.state === 'erupting' && A.boom);
  check('噴火直後は強度がほぼ 0（なめらかに立ち上がる）', A.k < 0.01);
  let mono = true, jump = false, prev = 0;
  for (let t = V.eruptDelay; t < V.eruptDelay + V.rampTime + 5; t += 1 / 60) { const k = volcanoState(t).k; if (k < prev - 1e-12) mono = false; if (k - prev > 0.05) jump = true; prev = k; }
  check('強度は単調増加でとびとびにならない', mono && !jump);
  check('rampTime 後は強度 1', volcanoState(V.eruptDelay + V.rampTime + 0.1).k === 1 && volcanoState(1e6).k === 1);
  check('煙の量は噴火後 1 に達する', volcanoState(1e6).smoke === 1);
  check('噴火直後に画面揺れ・閃光があり、上限内', A.shake > 0 && A.shake <= V.shakeAmp && A.flash > 0 && A.flash <= V.flashMax);
  const L = volcanoState(V.eruptDelay + Math.max(V.shakeDur, V.flashDur, V.boomDur) + 0.1);
  check('揺れ・閃光・「ドゴォォォン」は短時間で消える', L.shake === 0 && L.flash === 0 && !L.boom);
  check('揺れは操作不能にならない小ささ（カメラ移動 0.5u 未満）', V.shakeAmp < 0.5);
  check('火山は遠方の後方にある（fog より遠い）', V.dist > CFG.world.fogFar);
})();

// ===== Phase 3：恐竜の状態機械（直撃 → 吹き飛び → 起き上がり → 減速 → 無敵） =====
const H = CFG.hit, RK = CFG.rock;
const STEP = 1 / 60;
function runUntil(P, inp, fn, maxSec) { let t = 0; while (!fn(P) && t < maxSec) { stepPlayer(P, inp, STEP); t += STEP; } return t; }
(() => {
  const P = newPlayer(); run(P, NONE, 1);
  check('初期状態は run・無敵なし・減速なし', newPlayer().state === 'run' && newPlayer().invuln === 0 && newPlayer().slow === 0);
  check('着弾半径内・地上なら直撃判定', rockHitsPlayer(P, P.x + 1, P.z, RK.sizes.mid.radius));
  check('着弾半径の外なら当たらない', !rockHitsPlayer(P, P.x + RK.sizes.mid.radius + H.dinoR + 0.5, P.z, RK.sizes.mid.radius));
  check('前後方向に離れていても当たらない', !rockHitsPlayer(P, P.x, P.z - 20, RK.sizes.large.radius));
  check('噴石の判定は高さに関係ない：y がいくつでも（スライド中でも）着弾半径内なら直撃', [0, 0.5, 1.5, 3, 8].every(y => { const A = newPlayer(); run(A, NONE, 0.5); A.y = y; return rockHitsPlayer(A, A.x, A.z, RK.sizes.large.radius); }) && (() => { const A = newPlayer(); run(A, { ...NONE, slide: true }, 0.2); return A.sliding && rockHitsPlayer(A, A.x + 1, A.z, RK.sizes.small.radius); })());
  const Q = newPlayer(); run(Q, NONE, 0.5);
  check('地上スレスレの着弾（半径ぎりぎり内）は当たる', rockHitsPlayer(Q, Q.x + RK.sizes.small.radius + H.dinoR - 0.05, Q.z, RK.sizes.small.radius));
})();

(() => {
  const P = newPlayer(); run(P, NONE, 1);
  knockPlayer(P, P.x - 1, P.z, 'mid');
  check('直撃で knocked になり、体が浮く', P.state === 'knocked' && P.vy > 0 && !P.grounded && P.hits === 1);
  check('着弾の右にいたら右へ、左にいたら左へ吹き飛ぶ', (() => { const A = newPlayer(); knockPlayer(A, -3, 0, 'mid'); const B = newPlayer(); B.x = -5; knockPlayer(B, 0, 0, 'mid'); return A.kvx > 0 && B.kvx < 0; })());
  check('真下の直撃は広く空いている側へ吹き飛ぶ', (() => { const A = newPlayer(); A.x = 5; knockPlayer(A, 5, 0, 'mid'); const B = newPlayer(); B.x = -5; knockPlayer(B, -5, 0, 'mid'); return A.kvx < 0 && B.kvx > 0; })());
  check('前方にも飛ぶ（吹き飛び中も距離が増える）', P.kvf > 0);
  const A = newPlayer(); run(A, NONE, 1); knockPlayer(A, A.x, A.z, 'mid');
  const B = newPlayer(); run(B, NONE, 1); knockPlayer(B, B.x, B.z, 'mid');
  for (let i = 0; i < 30; i++) { stepPlayer(A, { left: true, right: false }, STEP); stepPlayer(B, NONE, STEP); }
  check('knocked 中は左右入力を無視（入力ありでも結果が同じ）', Math.abs(A.x - B.x) < 1e-9 && Math.abs(A.y - B.y) < 1e-9 && A.state === 'knocked');
  const seq = []; let prev = ''; const C = newPlayer(); run(C, NONE, 1); knockPlayer(C, C.x, C.z, 'mid');
  let maxY = 0, bounced = false, landedOnce = false, tt = 0, wasAir = false, minX = 9, maxXv = -9, nan = false;
  while (tt < 8 && !(C.state === 'run' && C.invuln > 0)) { stepPlayer(C, NONE, STEP); tt += STEP; if (C.state !== prev) { seq.push(C.state); prev = C.state; }
    maxY = Math.max(maxY, C.y); if (!C.grounded) wasAir = true; if (wasAir && C.state === 'knocked' && C.y === 0) landedOnce = true; if (landedOnce && C.state === 'knocked' && C.vy > 0 && C.y > 0) bounced = true;
    minX = Math.min(minX, C.x); maxXv = Math.max(maxXv, C.x); if (!isFinite(C.x + C.y + C.z)) nan = true; }
  check('流れは knocked → recover → run', seq.join('>') === 'knocked>recover>run', seq.join('>'));
  check('吹き飛び中に高さ1u以上まで舞い上がる', maxY > 1, 'maxY ' + maxY);
  check('地面に落ちて跳ね返る（バウンド）', bounced);
  check('吹き飛び中は荒野の左右限界を超えない・NaN にならない', minX >= -CFG.move.maxX - 1e-9 && maxXv <= CFG.move.maxX + 1e-9 && !nan);
  check('直撃から操作復帰までが短すぎず長すぎない（1〜2.6秒。中型で約1.5秒）', tt > 1 && tt < 2.6, 'tt ' + tt);
  check('復帰時は地上・y=0・回転が戻っている', C.y === 0 && C.grounded && C.tumble === 0);
  check('復帰後すぐ無敵時間（invuln = invulnSec）', Math.abs(C.invuln - H.invulnSec) < 0.05);
  const x1 = C.x, l1 = C.lane; run(C, { ...NONE, left: l1 > 0, right: l1 === 0 }, 0.3);
  check('起き上がり後は再び左右入力が効く（一番近いレーンから隣のレーンへ）', Math.abs(C.x - x1) > 0.1 && C.lane !== l1 && C.state === 'run' && (C.x === laneX(C.lane) || C.laneMove));
  const D = newPlayer(); knockPlayer(D, 0, 0, 'mid'); runUntil(D, NONE, p => p.state === 'run', 6); stepPlayer(D, { ...NONE, slide: true }, STEP);
  check('起き上がり後は再びくぐれる（ジャンプは無い）', D.sliding && D.grounded && D.y === 0 && D.vy === 0);
  const E = newPlayer(), F = newPlayer(); run(E, NONE, 1); run(F, NONE, 1); knockPlayer(F, F.x, F.z, 'mid'); const d0 = F.dist, e0 = E.dist; run(E, NONE, 1); run(F, NONE, 1);
  check('吹き飛び中も前には進むが、通常より遅い', F.dist - d0 > 0 && (F.dist - d0) < (E.dist - e0) - 0.5, (F.dist - d0) + ' vs ' + (E.dist - e0));
  check('P.z = -dist は吹き飛び中も保たれる', Math.abs(F.z + F.dist) < 1e-9);
})();

(() => {
  const res = ['small', 'mid', 'large'].map(s => { const P = newPlayer(); run(P, NONE, 1); P.x = 0; const x0 = P.x; knockPlayer(P, -1, P.z, s); let t = 0, peak = 0, far = 0;
    while (P.state === 'knocked') { stepPlayer(P, NONE, STEP); peak = Math.max(peak, P.y); far = Math.max(far, Math.abs(P.x - x0)); t += STEP; } return { x: far, t, peak, slow: P.slow }; });
  check('大型ほど遠くへ吹き飛ぶ（small < mid < large。端のレーンの外の限界 maxX で頭打ち）', res[0].x < res[1].x && res[1].x < res[2].x, JSON.stringify(res.map(r => r.x)));
  check('大型ほど高く舞い上がる', res[0].peak < res[1].peak && res[1].peak < res[2].peak);
  check('大型ほど吹き飛び時間が長い', res[0].t < res[1].t && res[1].t < res[2].t);
  check('大型ほど減速が長引く', res[0].slow < res[1].slow && res[1].slow < res[2].slow);
  check('小型でも最低限は吹き飛ぶ（上方向に 1u 以上）', res[0].peak > 1, 'peak ' + res[0].peak);
})();

(() => {
  const P = newPlayer(); run(P, NONE, 1); knockPlayer(P, P.x, P.z, 'mid'); runUntil(P, NONE, p => p.state === 'run', 6);
  stepPlayer(P, NONE, STEP);
  const s0 = P.speed, base = speedAt(P.time);
  check('復帰直後は移動速度が低下している（中型の slowF = 0.75 付近）', Math.abs(s0 / base - RK.sizes.mid.slowF) < 0.05, s0 + ' / ' + base);
  check('slow タイマーが残っている', P.slow > 1);
  const sp = []; let t = 0;
  while (t < RK.sizes.mid.slowSec + 1.5) { stepPlayer(P, NONE, STEP); t += STEP; sp.push(P.speed / speedAt(P.time)); }
  check('減速は一時的：やがて通常速度に戻る', Math.abs(sp[sp.length - 1] - 1) < 1e-9 && P.slow === 0, 'ratio ' + sp[sp.length - 1]);
  let mono = true; for (let i = 1; i < sp.length; i++) if (sp[i] < sp[i - 1] - 1e-9) mono = false;
  check('減速からの回復は単調でなめらか', mono);
  let jmp = 0; for (let i = 1; i < sp.length; i++) jmp = Math.max(jmp, Math.abs(sp[i] - sp[i - 1])); check('1フレームの速度変化は小さい（急に跳ねない）', jmp < 0.05, 'jump ' + jmp);
  check('無敵時間が切れる', P.invuln === 0);
})();

(() => {
  const P = newPlayer(); knockPlayer(P, 0, 0, 'mid'); runUntil(P, NONE, p => p.state === 'run', 6);
  check('無敵中は同じ場所に落ちても再被弾しない', P.invuln > 0 && !rockHitsPlayer(P, P.x, P.z, RK.sizes.large.radius));
  run(P, NONE, H.invulnSec * 0.5); check('無敵時間の半分では、まだ無敵', !rockHitsPlayer(P, P.x, P.z, 3));
  run(P, NONE, H.invulnSec * 0.5 + 0.05); check('無敵時間が終われば再び当たる', rockHitsPlayer(P, P.x, P.z, 3));
  const Q = newPlayer(); knockPlayer(Q, 0, 0, 'large');
  check('吹き飛び中・起き上がり中は再被弾しない', !rockHitsPlayer(Q, Q.x, Q.z, 8) && (runUntil(Q, NONE, p => p.state === 'recover', 6), !rockHitsPlayer(Q, Q.x, Q.z, 8)));
})();

(() => {
  const P = newPlayer(); let hits = 0, nan = false, runTime = 0;
  for (let i = 0; i < 60 * 40; i++) {   // 40 秒間、毎フレーム「真下に大型が落ちた」ことにする
    if (rockHitsPlayer(P, P.x, P.z, RK.sizes.large.radius)) { knockPlayer(P, P.x, P.z, 'large'); hits++; }
    stepPlayer(P, NONE, STEP); if (P.state === 'run') runTime += STEP;
    if (!isFinite(P.x + P.y + P.z + P.speed)) nan = true;
  }
  const cyc = H.knockBase + H.knockPer * RK.sizes.large.power + H.recoverSec + H.invulnSec;
  check('毎フレーム大型が直撃し続けても、1周期に1回しか被弾しない', hits <= 40 / cyc + 2, 'hits ' + hits + ' / cycle ' + cyc);
  check('連続被弾でも無敵のあいだは自由に走れる（run の時間が全体の3割以上）', runTime > 40 * 0.3, 'runTime ' + runTime);
  check('連続被弾でも前進し続ける・NaN にならない', P.dist > 150 && !nan, 'dist ' + P.dist);
})();

// ===== Phase 3：噴石スケジューラ =====
function lcg(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
(() => {
  const S = newRockSched(), P = newPlayer(); let n = 0;
  for (let i = 0; i < 60 * 30; i++) { stepPlayer(P, NONE, STEP); n += stepRocks(S, P, STEP, false, lcg(1)).spawned.length; }
  check('火山が噴火する前は噴石が降らない（30秒でも0個）', n === 0 && S.rocks.length === 0);
  const T = newRockSched(); let first = -1, t = 0; const P2 = newPlayer(), rng = lcg(7);
  for (let i = 0; i < 60 * 10 && first < 0; i++) { stepPlayer(P2, NONE, STEP); t += STEP; if (stepRocks(T, P2, STEP, true, rng).spawned.length) first = t; }
  check('噴火後、firstDelay 秒で最初の噴石が出る', Math.abs(first - RK.firstDelay) < 0.1, 'first ' + first);
})();

(() => {
  const S = newRockSched(), P = newPlayer(), rng = lcg(42); let spawned = 0, landed = 0, maxAlive = 0, hits = 0; const sizes = { small: 0, mid: 0, large: 0 };
  const T = 120;
  for (let i = 0; i < 60 * T; i++) { stepPlayer(P, NONE, STEP); const ev = stepRocks(S, P, STEP, true, rng); spawned += ev.spawned.length; landed += ev.landed.length; ev.spawned.forEach(r => sizes[r.size]++); ev.landed.forEach(l => { if (l.hit) hits++; }); maxAlive = Math.max(maxAlive, S.rocks.length); }
  const expect = (T - RK.firstDelay) / RK.interval;
  check('一定間隔で降る（120秒の個数が interval から計算した値の±25%）', spawned > expect * 0.75 && spawned < expect * 1.25, spawned + ' / ' + expect);
  check('降った噴石はすべて着弾して取り除かれる', landed >= spawned - RK.maxActive && S.rocks.length <= RK.maxActive);
  check('同時に存在する数が maxActive を超えない', maxAlive <= RK.maxActive, 'max ' + maxAlive);
  check('小型・中型が大半で、大型は少ない（large < 15%）', sizes.large / spawned < 0.15 && (sizes.small + sizes.mid) / spawned > 0.85, JSON.stringify(sizes));
  check('大型も出る（仕様どおり実装されている）', sizes.large > 0, JSON.stringify(sizes));
  check('まっすぐ走り続けるだけだと直撃することがある（狙いが効いている）', hits >= 1, 'hits ' + hits);
})();

(() => {
  const P = newPlayer(); run(P, NONE, 3); let bad = 0, aimedN = 0, aimedOk = 0, n = 0, snapBad = 0, lanesSeen = new Set(); const rng = lcg(5);
  for (let i = 0; i < 2000; i++) {
    const size = pickRockSize(rng()), tg = pickRockTarget(P, size, rng), warn = RK.sizes[size].warn, pred = P.z - P.speed * warn;
    const cov = rockCovered(tg.x, size);
    if (cov.length < 1 || cov.length > CFG.lane.count - 1 || (size === 'small' && cov.length !== 1)) bad++;   // 小=1 レーン / 中・大=全レーンは覆わない
    if (tg.z > pred + RK.aimJitterZ + 1e-9) bad++;
    if (Math.abs(tg.x * 2 / CFG.lane.width - Math.round(tg.x * 2 / CFG.lane.width)) > 1e-9) snapBad++;   // レーン中心またはレーンの間に吸着
    cov.forEach(l => lanesSeen.add(l));
    if (tg.aimed) { aimedN++; if (cov.indexOf(P.lane) >= 0 && Math.abs(tg.z - pred) <= RK.aimJitterZ + 1e-9) aimedOk++; }
    n++;
  }
  check('落下地点：レーン中心かレーンの間に吸着し、小型=1 レーン・中型=1〜2・大型=2 レーン（3 レーンすべてを覆わない）で、恐竜の予想位置より前方', bad === 0 && snapBad === 0, 'bad ' + bad + ' snap ' + snapBad);
  check('落下地点は 3 レーンすべてに降りうる', lanesSeen.size === CFG.lane.count);
  check('候補の数：小=3（各レーン）・中=5（レーンの中心と間）・大=4（端のレーン中心と間）', rockSpots('small').length === 3 && rockSpots('mid').length === 5 && rockSpots('large').length === 4, rockSpots('small').length + ',' + rockSpots('mid').length + ',' + rockSpots('large').length);
  check('狙いの噴石は、恐竜のいるレーンを覆い、着弾時の予想位置の近くに落ちる', aimedN > 0 && aimedOk === aimedN, aimedOk + '/' + aimedN);
  check('狙う確率は aimChance 付近', Math.abs(aimedN / n - RK.aimChance) < 0.05, aimedN / n);
  const slowP = newPlayer(); run(slowP, NONE, 3); slowP.speed *= 0.5; const fast = pickRockTarget(P, 'mid', () => 0.0), slw = pickRockTarget(slowP, 'mid', () => 0.0);
  check('減速中は着弾点が手前にずれる（速度を考慮している）', slw.z > fast.z, slw.z + ' vs ' + fast.z);
  check('端のレーンにいる恐竜を狙っても、そのレーンを覆う位置に降る', [0, 1, 2].every(l => { const Q = newPlayer(); Q.lane = l; Q.x = laneX(l); return ['small', 'mid', 'large'].every(s => rockCovered(pickRockTarget(Q, s, () => 0.0, 1).x, s).indexOf(l) >= 0); }));
})();

(() => {
  const S = newRockSched(), P = newPlayer(); run(P, NONE, 1);
  const w = ['small', 'mid', 'large'].map(s => RK.sizes[s]);
  check('警告時間は小 < 中 < 大で、どれも十分な猶予（0.8秒以上）', w[0].warn < w[1].warn && w[1].warn < w[2].warn && w[0].warn >= 0.8);
  check('着弾範囲は小 < 中 < 大・大型は大きい（中型の 1.35 倍以上＝2 レーンぶん）', w[0].radius < w[1].radius && w[1].radius < w[2].radius && w[2].radius >= 1.35 * w[1].radius);
  check('吹き飛びの強さは 小 < 中 < 大・画面揺れは小なし/中弱/大強', w[0].power < w[1].power && w[1].power < w[2].power && w[0].shake === 0 && w[1].shake > 0 && w[2].shake > w[1].shake);
  check('警告時間内に隣へ 2 レーン分移れる（反応時間を除いた猶予 ≥ 2 回のレーン移動）', w.every(c => c.warn - RK.fair.react >= 2 * (CFG.lane.shiftSec + RK.fair.moveExtra)));
  const r = spawnRock(S, 'mid', P.x, P.z - 20, lcg(3));
  const p0 = rockPos(r); r.t = r.warn * 0.5; const pm = rockPos(r); r.t = r.warn; const p1 = rockPos(r); r.t = 0;
  check('噴石は高い空から着弾点へ：始点は高く後方、終点は着弾点で y=0', p0.y > 10 && p0.z > r.z + 10 && Math.abs(p1.x - r.x) < 1e-9 && Math.abs(p1.z - r.z) < 1e-9 && Math.abs(p1.y) < 1e-9);
  check('落下中の高さは単調に下がる（加速して落ちる）', pm.y < p0.y && p1.y < pm.y && (p0.y - pm.y) < (pm.y - p1.y));
  let ev, t = 0; const Q = newPlayer(); Q.x = 10;
  while (S.rocks.length && t < 3) { ev = stepRocks(S, Q, STEP, false); t += STEP; if (ev.landed.length) break; }
  check('警告から warn 秒後に着弾する（遠くの恐竜は無傷）', Math.abs(t - r.warn) < 0.05 && ev.landed.length === 1 && !ev.landed[0].hit && Q.state === 'run', 't ' + t);
  const S2 = newRockSched(), P2 = newPlayer(); run(P2, NONE, 1);
  spawnRock(S2, 'large', P2.x, P2.z, lcg(2), 0.1); let ev2; for (let i = 0; i < 20; i++) { ev2 = stepRocks(S2, P2, STEP, false); if (ev2.landed.length) break; }
  check('着弾の瞬間に真下の恐竜がいれば直撃 → knocked', ev2.landed.length === 1 && ev2.landed[0].hit && P2.state === 'knocked');
  const S3 = newRockSched(); let cnt = 0; for (let i = 0; i < 20; i++) if (spawnRock(S3, 'small', 0, -50, lcg(i))) cnt++;
  check('spawnRock は maxActive を超えると null を返す', cnt === RK.maxActive && spawnRock(S3, 'small', 0, 0) === null);
})();

// ===== マグマ・ゲームオーバー =====
(() => {
  const MC = CFG.magma, DT = 1 / 60, NOI = { left: false, right: false };
  const quiet = () => { const G = newGame(); G.RS.timer = 1e9; G.OB.off = true; return G; };   // 噴石が出ない設定（マグマだけを見る）
  const go = (G, sec, inp) => { for (let i = 0, n = Math.round(sec / DT); i < n; i++) stepGame(G, inp || NOI, DT); return G; };

  check('設定：序盤のマグマは基準速度より遅く、上限もプレイヤーの上限以下', MC.speed0 < CFG.run.baseSpeed && MC.speedMax <= CFG.run.maxSpeed);
  check('マグマの速度は噴火直後 speed0 → 時間で単調に上がり → speedMax で頭打ち', magmaSpeedAt(0) === MC.speed0 && magmaSpeedAt(60) > magmaSpeedAt(10) && magmaSpeedAt(1e6) === MC.speedMax);
  check('速度は単調増加', (() => { let p = 0; for (let t = 0; t < 2000; t += 5) { const s = magmaSpeedAt(t); if (s < p) return false; p = s; } return true; })());

  const P0 = newPlayer(), M0 = newMagma();
  check('開始時：マグマは playing・未始動・startGap だけ後方', M0.phase === 'playing' && !M0.active && Math.abs(magmaGap(M0, P0) - MC.startGap) < 1e-9);
  check('距離計算：gap = P.dist - M.front', (() => { const P = newPlayer(), M = newMagma(); P.dist = 100; M.front = 70; return magmaGap(M, P) === 30; })());
  check('近さ：離れていれば 0・接触で 1・範囲内は単調', magmaProx(1000, 55) === 0 && magmaProx(0, 55) === 1 && magmaProx(20, 55) > magmaProx(40, 55));
  check('HUD ゲージ：近いほど点灯数が増える（0〜5）', magmaDanger(500) === 0 && magmaDanger(0) === MC.dangerGaps.length && magmaDanger(40) > magmaDanger(80));

  const A = quiet(); go(A, CFG.volcano.eruptDelay - 0.5);
  check('噴火前はマグマは動かない（常に startGap だけ後方）', !A.M.active && Math.abs(magmaGap(A.M, A.P) - MC.startGap) < 1e-6, 'gap ' + magmaGap(A.M, A.P));
  go(A, 1.0 + 0.2); const f0 = A.M.front; go(A, 1);
  check('噴火が始まるとマグマが動き出す（前進する）', A.M.active && A.M.front > f0 && A.M.t > 1, 'front ' + f0 + ' -> ' + A.M.front);
  check('動き出した直後の間隔は startGap 程度', (() => { const B = quiet(); go(B, CFG.volcano.eruptDelay + 0.05); return Math.abs(magmaGap(B.M, B.P) - MC.startGap) < 3; })());

  // 走り続ける（被弾なし）場合の余裕
  const B = quiet(); let minGap = 1e9, catchT = -1, t = 0;
  while (t < 900 && catchT < 0) { stepGame(B, NOI, DT); t += DT; if (B.M.active) minGap = Math.min(minGap, magmaGap(B.M, B.P)); if (B.M.phase === 'dead') catchT = t; }
  check('被弾せず走り続ければクリアまで追いつかれない（クリアで打ち切り）', catchT < 0, 'caught at ' + catchT);
  check('走り続けている間の最小間隔は 20u 以上（60 秒時点）', (() => { const C = quiet(); go(C, CFG.volcano.eruptDelay + 60); return magmaGap(C.M, C.P) > 20; })());
  window.__magmaCatchT = catchT; window.__minGap = minGap;

  // 被弾で減速（強制的に低速）すると追いつかれる
  const S = quiet(); S.P.slow = 1e9; S.P.slowF = 0.55; let st = 0; while (S.M.phase === 'playing' && st < 120) { stepGame(S, NOI, DT); st += DT; }
  check('ずっと減速していればマグマに追いつかれて dead になる', S.M.phase === 'dead' && S.P.state === 'dead', 'phase ' + S.M.phase + ' t ' + st);
  check('接触したとき先端はプレイヤーの位置（deathDist = P.dist = M.front）', Math.abs(S.M.deathDist - S.P.dist) < 1e-9 && Math.abs(S.M.front - S.P.dist) < 1e-6);

  // 1 発の被弾では死なず、立て続けに被弾すると死ぬ
  function hitsRun(interval, sec) {
    const C = quiet(); let hits = 0, since = 1e9; go(C, CFG.volcano.eruptDelay + 3);
    for (let i = 0, n = Math.round(sec / DT); i < n && C.M.phase === 'playing'; i++) {
      since += DT;
      if (C.P.state === 'run' && since >= interval) { C.P.invuln = 0; knockPlayer(C.P, C.P.x, C.P.z, 'mid'); hits++; since = 0; }
      stepGame(C, NOI, DT);
    }
    return { hits, dead: C.M.phase === 'dead', time: C.P.time };
  }
  const one = quiet(); go(one, CFG.volcano.eruptDelay + 3); knockPlayer(one.P, one.P.x, one.P.z, 'mid'); go(one, 60);
  check('1 回被弾しても（序盤は）すぐ死なない', one.M.phase === 'playing', 'gap ' + magmaGap(one.M, one.P));
  const burst = hitsRun(0, 120);
  check('立て続けに被弾し続けるとマグマに追いつかれる', burst.dead, 'hits ' + burst.hits + ' time ' + burst.time);
  window.__burst = burst;

  // 接触：吹き飛ばされて空中にいる間でも、先端が届けばゲームオーバー
  check('吹き飛ばされて空中にいる間に先端が届いてもゲームオーバー', (() => { const Y = quiet(); go(Y, 6); knockPlayer(Y.P, Y.P.x, Y.P.z, 'mid'); stepGame(Y, NOI, DT); const air = !Y.P.grounded && Y.P.y > 0; Y.M.front = Y.P.dist + 1; const ev = stepGame(Y, NOI, DT); return air && ev.died && Y.M.phase === 'dead'; })());
  check('接触でそのフレームの ev.died が true・状態が dead になる', (() => { const Y = quiet(); go(Y, 6); Y.M.front = Y.P.dist + 1; const ev = stepGame(Y, NOI, DT); return ev.died === true && Y.P.state === 'dead' && Y.M.phase === 'dead'; })());

  // dead 中は止まる
  const D = quiet(); go(D, 6); D.M.front = D.P.dist + 1; stepGame(D, NOI, DT);
  spawnRock(D.RS, 'small', 5, D.P.z - 30, lcg(1)); D.RS.timer = 0;
  const snap = { dist: D.P.dist, z: D.P.z, x: D.P.x, time: D.P.time, y: D.P.y };
  let spawned = 0; for (let i = 0; i < 600; i++) { const ev = stepGame(D, { left: true, right: false }, DT); spawned += ev.spawned.length; }
  check('dead 中は前進しない（dist・z・time が動かない）', D.P.dist === snap.dist && D.P.z === snap.z && D.P.time === snap.time);
  check('dead 中は操作を受け付けない（左入力・ジャンプでも x/y が動かない）', D.P.x === snap.x && D.P.y === snap.y && D.P.state === 'dead');
  check('dead 中は噴石が新しく出ない（タイマーが 0 でも）', spawned === 0 && D.RS.rocks.length === 0, 'spawned ' + spawned);
  check('dead 中の噴石の着弾で死亡状態は変わらない（噴石直撃では死なない・吹き飛ばない）', D.P.state === 'dead' && D.M.phase === 'dead');
  check('死亡演出の時計：P.stateT が進み、M.deadT と一致', Math.abs(D.P.stateT - D.M.deadT) < 0.05 && D.M.deadT > 9, 'deadT ' + D.M.deadT);
  check('死亡後、先端はプレイヤーを deathOvershoot だけ越えて止まる', Math.abs(D.M.front - (D.M.deathDist + MC.deathOvershoot)) < 1e-3, 'front ' + D.M.front + ' / ' + D.M.deathDist);

  // 噴石直撃では死なない（Phase 4）
  const K = quiet(); go(K, 6); spawnRock(K.RS, 'large', K.P.x, K.P.z, lcg(2), 0.05); go(K, 0.2);
  check('噴石の直撃は吹き飛びのみ・phase は playing のまま', K.M.phase === 'playing' && K.P.hits === 1);

  // リセット
  const R = quiet(); go(R, 7, { ...NOI, right: true }); spawnRock(R.RS, 'mid', 3, -300, lcg(4)); R.M.front = R.P.dist + 1; stepGame(R, NOI, DT); go(R, 2);
  const refP = R.P, refM = R.M, refRS = R.RS; resetGame(R);
  const fresh = newGame();
  check('リセットで全状態が新品と同じになる（P・M・RS）', JSON.stringify(R) === JSON.stringify(fresh), JSON.stringify(R.M));
  check('リセットでオブジェクトの参照は変わらない（二重管理しない）', R.P === refP && R.M === refM && R.RS === refRS);
  check('リセット後は playing・dist 0・噴石なし・マグマ未始動', R.M.phase === 'playing' && R.P.dist === 0 && R.P.time === 0 && R.P.state === 'run' && R.RS.rocks.length === 0 && !R.M.active && R.RS.nextId === 1);
  const deathTime = G0 => { const Q = G0; Q.RS.timer = 1e9; Q.OB.off = true; Q.P.slow = 1e9; Q.P.slowF = 0.55; let tt = 0; while (Q.M.phase === 'playing' && tt < 200) { stepGame(Q, NOI, DT); tt += DT; } return tt; };
  const d1 = deathTime(quiet()); resetGame(R); const d2 = deathTime(R); resetGame(R); const d3 = deathTime(R);
  check('リセットを繰り返しても同じ条件で同じ時刻に追いつかれる（状態の持ち越しなし）', Math.abs(d1 - d2) < 1e-6 && Math.abs(d1 - d3) < 1e-6, d1 + ' / ' + d2 + ' / ' + d3);
  resetGame(R); go(R, 3);
  check('リセット後は普通に前進を再開する', R.P.dist > 40 && R.M.phase === 'playing');
})();


// ===== Phase 5：障害物（配置・衝突・リセット）。ジャンプ廃止後：地上の障害物はレーンを変えて避け、アーチはくぐる =====
(() => {
  const O = CFG.obstacle, DT = 1 / 60, MX = CFG.move.maxX, LN = CFG.lane, g = O.gap;
  const NOI = { left: false, right: false, slide: false };
  const mkOb = (type, o) => Object.assign({
    rock: { type: 'rock', x: 0, z: -60, r: 1.2, h: 1.4, hw: 1.02, hd: 1.02 },
    log: { type: 'log', x: 0, z: -60, len: O.log.len, h: O.log.r * 2, hw: O.log.len / 2, hd: O.log.r, r: O.log.r },
    crater: { type: 'crater', x: 0, z: -60, r: 2, h: 0, hw: 2, hd: 2 },
    pool: { type: 'pool', x: 0, z: -60, r: 3, h: 0, hw: 3, hd: 3 },
    arch: { type: 'arch', x: 0, z: -60, hw: CFG.lane.width / 2 - O.arch.inset, hd: O.arch.hd, r: O.arch.hd, h: O.arch.clear, clear: O.arch.clear, top: O.arch.clear + O.arch.beamH } }[type], { id: 1, hit: false, lanes: [1] }, o);
  // 障害物 1 個だけを置いて走る（プレイヤーは中央レーン）。x0 = 障害物の左右のずれ / slideAtDz = あと何 u でくぐるか / laneAtDz = あと何 u で右のレーンへ移るか（null なら動かない）
  function trial(type, o, x0, slideAtDz, laneAtDz) {
    const P = newPlayer(), OB = newObstacles(); OB.genDist = 1e9; const ob = mkOb(type, o); if (x0 != null) ob.x = x0; OB.list.push(ob);
    let slid = false, moved = false; const hits = [];
    for (let i = 0; i < 900; i++) {
      const slide = !slid && slideAtDz != null && P.z - ob.z <= slideAtDz; if (slide) slid = true;
      const right = !moved && laneAtDz != null && P.z - ob.z <= laneAtDz; if (right) moved = true;
      stepPlayer(P, { left: false, right, slide }, DT); hits.push(...stepObstacles(OB, P, DT).hits);
      if (P.z < ob.z - 40 && P.state === 'run') break;
    }
    return { P, OB, hits, ob };
  }
  // 実際に触れるレーン（その中心に立った恐竜が触れるか）
  const touches = (ob, l) => { const dx = Math.abs(laneX(l) - ob.x); return ob.type === 'rock' || ob.type === 'log' ? dx < ob.hw + O.dinoR : ob.type === 'arch' ? dx < ob.hw + O.dinoR : dx < ob.r + (ob.type === 'pool' ? O.dinoR : O.dinoR * 0.3); };

  // --- 配置 ---
  const A = planObstacles(O.seed, 0, -2000, 0), B = planObstacles(O.seed, 0, -2000, 0), C2 = planObstacles(O.seed + 1, 0, -2000, 0);
  check('配置：同じ seed なら同じ結果（再現できる）', A.length > 10 && JSON.stringify(A) === JSON.stringify(B));
  check('配置：seed が違えば別の配置になる', JSON.stringify(A) !== JSON.stringify(C2));
  check('配置：チャンクに分けて作っても、先に遠くまで作っておいても、一括と同じ（chunk ごと）', (() => { const parts = []; for (let d = 0; d < 2000; d += O.chunk) parts.push(...planObstacles(O.seed, -d, -(d + O.chunk), 0)); obGen(O.seed + 5, 0); planObstacles(O.seed + 5, -3000, -3100, 0); const e1 = planObstacles(O.seed + 5, 0, -2000, 0); obGenClear(); const e2 = planObstacles(O.seed + 5, 0, -2000, 0); return JSON.stringify(parts) === JSON.stringify(A) && JSON.stringify(e1) === JSON.stringify(e2); })());
  check('配置：取り出した障害物を書き換えても次の取り出しに影響しない（コピーを返す）', (() => { const a = planObstacles(O.seed, 0, -400, 0); a.forEach(o => { o.hit = true; o.id = 99; o.lanes.push(7); }); return planObstacles(O.seed, 0, -400, 0).every(o => !o.hit && o.id === undefined && o.lanes.indexOf(7) < 0); })());
  check('配置：z は前方（負）で、距離順に並ぶ', A.every((o, i) => o.z < 0 && o.z === -o.dist && (i === 0 || o.dist >= A[i - 1].dist)));
  let nTot = 0, early = 0, craterEarly = 0, logEarly = 0, poolEarly = 0, archEarly = 0, pairEarly = 0, pairs = 0, rowsN = 0, noPass = 0, wrongLane = 0, wideLog = 0, tooMany = 0, gapBad = 0, archGapBad = 0, orderBad = 0, routeFail = 0, robustFail = 0, dpFail = 0, minSlack = 1e9;
  const counts = { rock: 0, log: 0, crater: 0, pool: 0, arch: 0 }, laneUse = [0, 0, 0], archLanes = { 1: 0, 2: 0 };
  let rowsEarly = 0, rowsLate = 0;
  const SEEDS = 400, LEN = 4000;
  for (let seed = 1; seed <= SEEDS; seed++) {
    const list = planObstacles(seed, 0, -LEN, 0), rows = obRows(seed, LEN, 0).filter(r => r.dist < LEN);
    // (a) 生成器の行の整合
    const rc = obRouteCheck(rows); if (!rc.ok) routeFail++; if (!rc.robust) robustFail++; minSlack = Math.min(minSlack, rc.minSlack);
    // (b) 取り出した障害物だけから、行を独立に作り直して確認する（生成器の内部表現を信用しない）
    const byDist = new Map(); for (const o of list) { if (!byDist.has(o.dist)) byDist.set(o.dist, []); byDist.get(o.dist).push(o); }
    const rs = [...byDist.entries()].sort((a, b) => a[0] - b[0]).map(([d, obs]) => {
      const ext = Math.max(...obs.map(obExtent)), pass = [0, 1, 2].filter(l => !obs.some(o => o.type !== 'arch' && touches(o, l)));
      return { d, obs, ext, start: d - ext, end: d + ext, pass, arch: obs.some(o => o.type === 'arch') };
    });
    let S = null;
    for (let i = 0; i < rs.length; i++) {
      const r = rs[i], prev = rs[i - 1]; rowsN++;
      if (!r.pass.length) noPass++;
      const grounds = r.obs.filter(o => o.type !== 'arch');
      if (grounds.length > LN.count - 1 || grounds.length > 2) tooMany++;
      if (r.arch && r.obs.length !== 1) tooMany++;
      if (r.d < 500) rowsEarly++; else if (r.d >= 3000) rowsLate++;
      if (grounds.length === 2) { pairs++; if (r.d < O.startDist + O.pair.from) pairEarly++; }
      if (!prev) S = r.pass.slice();
      else {
        if (r.start <= prev.end) orderBad++;
        const T = (r.start - prev.end) / obSpeedAt(r.start), need = (a, b) => a === b ? 0 : Math.abs(a - b) * LN.shiftSec + g.react;
        for (const a of prev.pass) { let ok = false; for (const b of r.pass) if (T >= need(a, b) - 1e-9) ok = true; if (!ok) gapBad++; }
        if (T < g.min - 1e-9) gapBad++;
        if ((r.arch || prev.arch) && T < g.archSec - 1e-9) archGapBad++;
        S = r.pass.filter(b => S.some(a => T >= need(a, b) - 1e-9));
        if (!S.length) dpFail++;
      }
    }
    for (const o of list) {
      nTot++; counts[o.type]++;
      if (o.dist < O.startDist) early++;
      if (o.type === 'crater' && o.dist < O.startDist + O.unlock.crater) craterEarly++;
      if (o.type === 'log' && o.dist < O.startDist + O.unlock.log) logEarly++;
      if (o.type === 'pool' && o.dist < O.startDist + O.unlock.pool) poolEarly++;
      if (o.type === 'arch') { archLanes[o.lanes.length]++; if (o.dist < O.startDist + O.unlock.arch) archEarly++; }
      else {
        const t = [0, 1, 2].filter(l => touches(o, l));
        if (o.lanes.length !== 1 || t.length !== 1 || t[0] !== o.lanes[0] || Math.abs(laneX(o.lanes[0]) - o.x) > 1e-9) wrongLane++;   // 地上の障害物は 1 レーンだけに触れる（倒木も）
        if (o.type === 'rock') laneUse[o.lanes[0]]++;
        if (o.type === 'log' && (o.len >= LN.width || o.hw + O.dinoR >= LN.width / 2 + 0.6)) wideLog++;
      }
    }
  }
  check('配置：' + SEEDS + ' seed × ' + LEN + 'u で多数生成される', nTot > 12000, 'n ' + nTot);
  check('配置：どの行にも、通れるレーン（地上の障害物が体に触れない、またはアーチだけのレーン）が 1 本以上残る（全 seed・取り出した障害物から独立に確認）', noPass === 0 && rowsN > 8000, 'noPass ' + noPass + ' rows ' + rowsN);
  check('配置：1 行で塞ぐ地上の障害物は最大 2 つ（3 レーンすべては塞がない）。アーチの行にはアーチ以外を置かない', tooMany === 0);
  check('配置：地上の障害物（岩・倒木・クレーター・溜まり）は 1 レーンだけに触れる（倒木も 1 レーン幅。隣のレーン中心に立っても触れない）', wrongLane === 0 && wideLog === 0 && O.log.len < LN.width, 'wrong ' + wrongLane + ' wide ' + wideLog);
  check('配置：【経路保証】全 seed で、各行の通れるレーンの集合から、レーン移動の時間（1 レーン shiftSec＋反応時間）を考えて最後まで到達できる経路が存在する', routeFail === 0 && dpFail === 0, 'routeFail ' + routeFail + ' dpFail ' + dpFail);
  check('配置：【行き止まり無し】どの通れるレーンにいても、次の行の通れるレーンへ間に合う（全 seed。1 レーン移動 ' + LN.shiftSec + ' 秒＋反応 ' + g.react + ' 秒、2 レーン先は倍の移動時間）', robustFail === 0 && gapBad === 0, 'robustFail ' + robustFail + ' gapBad ' + gapBad + ' minSlack ' + minSlack.toFixed(3));
  check('配置：行どうしの間隔は常に正で（窓が重ならない）、最低 g.min 秒', orderBad === 0 && g.min >= 0.4 && g.react >= 0.2);
  check('配置：アーチの前後 archSec 秒以内に他の行を置かない（滑走が終わる前に次を避けられる並びにする。全 seed）', archGapBad === 0 && g.archSec >= O.arch.hd * 2 / CFG.run.baseSpeed + CFG.slide.sec, 'bad ' + archGapBad);
  check('配置：2 レーン塞ぐ行（残り 1 レーン）が出る。出始めは pair.from より後', pairs > 300 && pairEarly === 0, 'pairs ' + pairs + ' early ' + pairEarly);
  check('配置：岩は 3 つのレーンすべてに置かれる', laneUse.every(n => n > 200), JSON.stringify(laneUse));
  check('配置：アーチは 1 レーン・2 レーン両方あり、解禁距離（90）より前には出ない', archLanes[1] > 100 && archLanes[2] > 100 && archEarly === 0 && O.startDist + O.unlock.arch >= 80 && O.startDist + O.unlock.arch <= 100, JSON.stringify(archLanes) + ' early ' + archEarly);
  check('配置：クレーター半径 1.5〜2.5、溜まり半径 2〜3.3（隣のレーン中心に当たり円が届かない）、倒木は短い丸太（1 レーン）、アーチの梁は幅 1〜2 レーン', A.every(o => o.type === 'crater' ? o.r >= 1.5 && o.r <= 2.5 : o.type === 'pool' ? o.r >= 2 && o.r <= 3.3 && o.r + O.dinoR < CFG.lane.width : o.type === 'log' ? o.len === O.log.len && o.lanes.length === 1 : o.type === 'arch' ? o.lanes.length >= 1 && o.lanes.length <= 2 && Math.abs(o.hw - (o.lanes.length * CFG.lane.width / 2 - O.arch.inset)) < 1e-9 : true));
  check('配置：どの障害物にも有効な種類（rock / log / crater / pool / arch）が付いている（全 seed の最初の行も）', A.every(o => counts[o.type] !== undefined) && Object.values(counts).every(Number.isFinite) && counts.rock > 0);
  check('配置：5 種類すべてが出る', counts.rock > 0 && counts.log > 0 && counts.crater > 0 && counts.pool > 0 && counts.arch > 0, JSON.stringify(counts));
  check('配置：開始から startDist までは何も置かない（全 seed）', early === 0 && O.startDist >= 40 && O.startDist <= 60);
  check('配置：クレーター・倒木・溜まりは unlock 距離より前に出ない（少しずつ増える）', craterEarly === 0 && logEarly === 0 && poolEarly === 0);
  check('配置：時間あたりの密度は終盤ほど高い（終盤の行の数 ÷ 走る時間 が序盤の 1.6 倍以上）', (rowsLate / SEEDS / (nominalTime(4000) - nominalTime(3000))) > 1.6 * (rowsEarly / SEEDS / (nominalTime(500) - nominalTime(0))), rowsEarly + ' / ' + rowsLate);
  check('配置：行の間隔（目安）は序盤 > 終盤で、終盤でも反応＋2 レーン移動の時間より長い', g.start > g.end * 1.8 && g.end * (1 - g.jitter) > 2 * (LN.shiftSec + g.moveExtra) + g.react, g.start + ' / ' + g.end);
  check('配置：level を上げると密度が上がる（時間あたりの行が増える＝同じ距離に多く入る）', planObstacles(7, 0, -1000, 1).length >= planObstacles(7, 0, -1000, 0).length);
  check('配置：行が速さに比例して広がる（高速でも「時間」の間隔は同じ）', [0, 500, 1000, 2000, 6000].every(d => { const rows = obRows(3, d + 800, 0).filter(r => r.dist > d); const p = rows.find((r, i) => i > 0 && !r.arch && !rows[i - 1].arch); if (!p) return true; const prev = rows[rows.indexOf(p) - 1]; return (p.start - prev.end) / obSpeedAt(p.start) >= g.min - 1e-9; }));

  // --- 衝突：岩・倒木（レーンを変えて避ける。そのまま当たると転倒）---
  for (const [type, name] of [['rock', '岩'], ['log', '倒木']]) {
    const t0 = trial(type);
    check(name + '：避けずに正面から当たると転倒する（trips=1・減速がかかる）', t0.hits.length === 1 && t0.hits[0].kind === 'trip' && t0.P.trips === 1 && t0.P.slowF < 1, '' + t0.hits.length);
    check(name + '：転倒後は起き上がって run に戻る・噴石の hits は増えない', t0.P.state === 'run' && t0.P.hits === 0, t0.P.state);
    const ok = []; for (let d = 6; d <= 30; d += 2) ok.push(trial(type, null, null, null, d).hits.length === 0);
    check(name + '：手前（6〜30u）で隣のレーンへ移れば当たらない。ぎりぎりまで引きつけると間に合わず当たる', ok.every(Boolean) && trial(type, null, null, null, 1).hits.length === 1, ok.join());
    const side = trial(type, null, 4.5);
    check(name + '：隣のレーンにあれば当たらない', side.hits.length === 0 && side.P.state === 'run');
  }
  (() => {
    const t = trial('rock'), T = O.trip;
    const knock = (() => { const P = newPlayer(); tripPlayer(P, T); return P; })(), k2 = (() => { const P = newPlayer(); knockPlayer(P, 0, 0, 'mid'); return P; })();
    check('転倒は噴石の吹き飛びより動きが小さい（滞空・前進の初速・跳ね上がりが小さく、横には飛ばない）', T.knock < CFG.hit.knockBase + CFG.hit.knockPer && knock.kvf < k2.kvf && knock.vy < k2.vy && knock.kvx === 0);
    check('転倒中は操作不能（knocked）→ recover → run の順に戻り、復帰後は無敵', (() => {
      const P = newPlayer(); tripPlayer(P, T); let order = [];
      for (let i = 0; i < 400; i++) { stepPlayer(P, { left: true, right: false }, DT); if (!order.length || order[order.length - 1] !== P.state) order.push(P.state); }
      return order.join('>') === 'knocked>recover>run'; })());
    check('転倒中は減速し、その後の速度は元に戻る', (() => {
      const P = newPlayer(); tripPlayer(P, T); let minS = 1e9; for (let i = 0; i < 60 * 8; i++) { stepPlayer(P, NOI, DT); if (i > 5) minS = Math.min(minS, P.speed); }
      return minS < speedAt(P.time) * 0.7 && Math.abs(P.speed - speedAt(P.time)) < 1e-6; })());
    check('同じ障害物では 1 回しか転倒しない（連続衝突ループなし。当たると hit=true）', t.hits.length === 1 && t.ob.hit === true);
  })();

  // --- クレーター：小さなつまずき ---
  (() => {
    const t = trial('crater');
    check('クレーター：踏むとつまずく（1 回・転倒せず run のまま・trips は増えない）', t.hits.length === 1 && t.hits[0].kind === 'stumble' && t.P.trips === 0 && t.P.state === 'run');
    check('クレーター：つまずき中は軽く減速（slowF = stumble.slowFactor）、stumbleT が立つ', (() => { const P = newPlayer(), OB = newObstacles(); OB.genDist = 1e9; OB.list.push(mkOb('crater', { z: -4 })); let tilt = 0, slow = 0, f = 1; const st = new Set(); for (let i = 0; i < 120; i++) { stepPlayer(P, NOI, DT); stepObstacles(OB, P, DT); st.add(P.state); tilt = Math.max(tilt, P.stumbleT); if (P.slow > 0) { slow = Math.max(slow, P.slow); f = P.slowF; } } return tilt > 0 && Math.abs(f - O.stumble.slowFactor) < 1e-9 && slow > 0 && st.size === 1; })());
    check('クレーターのつまずきは転倒より軽い（倍率が大きく、秒が短い）', O.stumble.slowFactor > O.trip.slowFactor && O.stumble.slowSec < O.trip.slowSec);
    check('クレーター：手前で隣のレーンへ移れば当たらない', [8, 14, 22].every(d => trial('crater', null, null, null, d).hits.length === 0));
    check('クレーター：端をかすめるだけなら当たらない', trial('crater', null, 2 + O.dinoR * 0.3 + 0.3).hits.length === 0);
  })();

  // --- マグマ溜まり ---
  (() => {
    const t = trial('pool');
    check('マグマ溜まり：触れると転倒し、減速は岩・倒木より強く長い。ゲームオーバーにはならない', t.hits.length === 1 && t.hits[0].kind === 'trip' && t.P.trips === 1 && O.poolTrip.slowFactor < O.trip.slowFactor && O.poolTrip.slowSec > O.trip.slowSec && t.P.state === 'run');
    check('マグマ溜まり：手前で隣のレーンへ移れば当たらない', [8, 14, 22].every(d => trial('pool', null, null, null, d).hits.length === 0));
    check('マグマ溜まり：左右に避ければ当たらない', trial('pool', null, 3 + O.dinoR + 0.2).hits.length === 0);
  })();

  // --- アーチ（頭上の障害物。くぐる）---
  (() => {
    const A = O.arch, S = CFG.slide, near = A.hd + O.depthPad;
    const t0 = trial('arch');
    check('アーチ：立ったまま走ると頭が当たって転倒する（trips=1）', t0.hits.length === 1 && t0.hits[0].kind === 'trip' && t0.P.trips === 1 && t0.ob.hit === true, '' + t0.hits.length);
    const sl = trial('arch', null, null, 6);
    check('アーチ：手前でくぐる（スライド）と当たらずに通れる', sl.hits.length === 0 && sl.P.trips === 0 && sl.P.state === 'run');
    const clearSlide = (() => { let n = 0; for (let d = 0; d <= 20; d += 0.25) if (!trial('arch', null, null, d).hits.length) n++; return n; })();
    check('アーチ：くぐるタイミングに余裕がある（20u のうち 7u 以上の幅で成功）', clearSlide * 0.25 >= 7, 'width ' + clearSlide * 0.25);
    check('アーチ：くぐるのが遅すぎる／早すぎる（滑走が終わってしまう）と当たる', trial('arch', null, null, 0.3).hits.length === 1 && trial('arch', null, null, S.sec * 16 + near + 5).hits.length === 1);
    check('アーチ：隣の空いたレーンなら立ったままでも通れる', trial('arch', null, 4.5).hits.length === 0 && trial('arch', null, -4.5).hits.length === 0);
    check('アーチ：手前で隣のレーンへ移っても通れる', trial('arch', null, null, null, 14).hits.length === 0 && trial('arch', null, null, null, 1).hits.length === 1);
    check('アーチ：自分のレーンのアーチ（幅 1 レーン）に触れる範囲は、梁の幅＋恐竜半径まで', trial('arch', null, A.hd + 0).hits.length === 1 && trial('arch', null, CFG.lane.width / 2 - A.inset + O.dinoR + 0.05).hits.length === 0);
    check('アーチ：ジャンプ入力は効かない（跳んでも潜れず当たる）', (() => { const P = newPlayer(), OB = newObstacles(); OB.genDist = 1e9; const ob = mkOb('arch', { z: -30 }); OB.list.push(ob); let hits = 0; for (let i = 0; i < 400; i++) { stepPlayer(P, { left: false, right: false, jump: i % 5 === 0 }, DT); hits += stepObstacles(OB, P, DT).hits.length; if (P.z < ob.z - 20) break; } return hits === 1 && P.trips === 1 && P.slowF < 1; })());
    check('アーチ：スコアのコンボに含まれる（くぐった/避けたアーチが連続回避として数えられる）', (() => {
      const G = newGame(), Sc = newScore(), obs = [1, 2, 3].map(i => Object.assign(mkOb('arch', { z: -20 * i }), { id: i }));
      for (const ob of obs) { G.OB.list = obs; G.P.z = ob.z - 4; scoreStep(Sc, G, { landed: [], obstacle: { hits: [] } }, DT); }
      return Sc.combo === 3 && Sc.bonus === CFG.score.comboMul * 3;
    })());
  })();

  // --- ゲーム全体との組み合わせ ---
  (() => {
    const quiet = () => { const G = newGame(); G.RS.timer = 1e9; return G; };
    const go = (G, sec, inp) => { for (let i = 0, n = Math.round(sec / DT); i < n; i++) stepGame(G, inp || NOI, DT); return G; };
    const G = quiet(); go(G, 1);
    check('開始直後から障害物が先の方に生成されている（startDist 内は空）', G.OB.list.length > 0 && G.OB.list.every(o => o.dist >= O.startDist) && G.OB.genDist >= G.P.dist + O.aheadDist);
    check('生成は前方 aheadDist まで、通り過ぎたものは破棄される（リストが増え続けない）', (() => { const Q = quiet(); Q.P.invuln = 1e9; let maxN = 0, bad = 0; for (let i = 0; i < 60 * 90; i++) { stepGame(Q, NOI, DT); maxN = Math.max(maxN, Q.OB.list.length); if (Q.OB.list.some(o => o.z > Q.P.z + O.behindDist + 1e-9)) bad++; } return maxN <= 30 && bad === 0 && Q.OB.list.length > 0 && Q.OB.nextId > maxN + 5; })());
    const H = quiet(); for (let i = 0; i < 60 * 40 && !H.OB.list.some(o => o.hit); i++) stepGame(H, NOI, DT);
    const hitOb = H.OB.list.find(o => o.hit);
    check('何もしないで走ると最初の障害物に当たる（岩・倒木・溜まりは転倒、クレーターはつまずき）', !!hitOb && hitOb.dist >= O.startDist && (hitOb.type === 'crater' ? H.P.stumbleT > 0 : H.P.state === 'knocked'), hitOb ? hitOb.type : 'none');
    go(H, 4);
    check('転倒してもゲームオーバーにならない（phase は playing）・起き上がって走る', H.M.phase === 'playing' && H.P.state === 'run');
    // 障害物だけを避けるボット（噴石なし）：地上の障害物は必ず隣のレーンへ。dodge 0 = アーチはくぐる / dodge 1 = アーチも隣の空いたレーンへ
    const runB = (seed, dodge) => botRun({ seed, rngSeed: seed, err: 0, quiet: true, maxDist: 1800, dodge });
    const botsA = [11, 22, 33, 44, 55].map(s => runB(s, 0)), botsB = [11, 22, 33, 44, 55].map(s => runB(s, 1));
    check('障害物を避け続ける（地上はレーン移動・アーチはくぐる）と転倒せず 1800u 走れる（5 seed）', botsA.every(r => r.trips === 0 && r.result === 'playing' && r.dist >= 1800) && botsA.reduce((s, r) => s + r.stats.laneMoves, 0) > 40 && botsA.reduce((s, r) => s + r.stats.slides, 0) > 5, botsA.map(r => r.trips + '/' + Math.round(r.dist) + '/m' + r.stats.laneMoves + 's' + r.stats.slides).join(' '));
    check('障害物を隣のレーンへ避け続けても（できるときは必ずレーン移動）転倒せず 1800u 走れる（5 seed）', botsB.every(r => r.trips === 0 && r.result === 'playing' && r.dist >= 1800) && botsB.reduce((s, r) => s + r.stats.laneMoves, 0) > 20, botsB.map(r => r.trips + '/' + Math.round(r.dist) + '/m' + r.stats.laneMoves).join(' '));
    check('障害物は噴石の着弾と重なってもよい（噴石の直撃判定は従来どおり）', (() => { const Q = quiet(); go(Q, 8); const ob = Q.OB.list.find(o => o.z < Q.P.z - 20); if (!ob) return true; spawnRock(Q.RS, 'mid', ob.x, ob.z, lcg(3), 0.05); go(Q, 0.2); return Q.RS.rocks.length === 0; })());

    // dead の間
    const D = quiet(); D.P.slow = 1e9; D.P.slowF = 0.55; let tt = 0; while (D.M.phase === 'playing' && tt < 200) { stepGame(D, NOI, DT); tt += DT; }
    const n0 = D.OB.list.length, id0 = D.OB.nextId, gd = D.OB.genDist; go(D, 10);
    check('dead の間は障害物が新しく生成されず、衝突も起きない', D.M.phase === 'dead' && D.OB.nextId === id0 && D.OB.genDist === gd && D.OB.list.length === n0 && D.P.state === 'dead');

    // リセット
    const R = quiet(); go(R, 12); R.OB.seed = 999; const refOB = R.OB;
    check('リセット前：障害物がある', R.OB.list.length > 0 && R.OB.nextId > 1 && R.OB.genDist > 0);
    resetGame(R);
    check('リセットで障害物が空になる（list・nextId・genDist・off が初期値）。参照は変わらず、全体も新品と同じ', R.OB === refOB && R.OB.list.length === 0 && R.OB.nextId === 1 && R.OB.genDist === 0 && R.OB.off === false && R.OB.seed === O.seed && JSON.stringify(R) === JSON.stringify(newGame()));
    resetGame(R, 777);
    check('リセットで seed を指定できる', R.OB.seed === 777 && R.OB.list.length === 0);
    const r1 = quiet(); r1.OB.seed = 5; go(r1, 5); const r2 = quiet(); r2.OB.seed = 5; go(r2, 5);
    check('同じ seed・同じ操作なら同じ進行（障害物込みで再現できる）', r1.OB.list.length > 0 && JSON.stringify(r1.OB.list.map(o => o.id + o.type + o.z)) === JSON.stringify(r2.OB.list.map(o => o.id + o.type + o.z)) && r1.P.dist === r2.P.dist);
    resetGame(r2, 5); r2.RS.timer = 1e9; go(r2, 5);
    check('リセット後に同じ seed で走り直しても同じ（状態の持ち越しなし）', r2.P.dist === r1.P.dist && JSON.stringify(r1.OB.list.map(o => o.id + o.z)) === JSON.stringify(r2.OB.list.map(o => o.id + o.z)));
  })();
})();

