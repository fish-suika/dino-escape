// ===== 検証（three.js を使わない純粋ロジック） =====
const $out = document.getElementById('out');
let nOk = 0, nNg = 0;
function check(name, cond, why) {
  const d = document.createElement('div'); d.className = 'r ' + (cond ? 'ok' : 'ng'); d.textContent = name;
  if (!cond) { nNg++; const w = document.createElement('div'); w.className = 'why'; w.textContent = why || ''; d.appendChild(w); } else nOk++;
  $out.appendChild(d);
}
const NONE = { left: false, right: false, jump: false };
function run(P, inp, sec, dt = 1 / 60) { const n = Math.round(sec / dt); for (let i = 0; i < n; i++) stepPlayer(P, i === 0 ? inp : { ...inp, jump: false }, dt); return P; }

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

// 横移動
(() => {
  const P = newPlayer(); run(P, { ...NONE, right: true }, 0.05);
  check('右入力で右へ動き始める（なめらか：最高速にはまだ達しない）', P.x > 0 && P.vx > 0 && P.vx < CFG.move.maxSpeed, 'vx ' + P.vx);
  run(P, { ...NONE, right: true }, 0.5);
  check('押し続けると最高横速度になる', Math.abs(P.vx - CFG.move.maxSpeed) < 1e-9 || P.x >= CFG.move.maxX, 'vx ' + P.vx);
  const P2 = newPlayer(); run(P2, { ...NONE, left: true }, 0.3);
  check('左入力で左へ動く', P2.x < 0 && P2.vx < 0);
  const P3 = newPlayer(); run(P3, { left: true, right: true, jump: false }, 0.5);
  check('左右同時押しは動かない', P3.x === 0);
  const P4 = newPlayer(); run(P4, { ...NONE, right: true }, 0.3); const vx = P4.vx; run(P4, NONE, 0.05);
  check('離すとなめらかに減速（即停止ではない）', P4.vx < vx && P4.vx > 0, vx + ' -> ' + P4.vx);
  run(P4, NONE, 1);
  check('離し続けると止まる', P4.vx === 0);
})();

// クランプ
(() => {
  const P = newPlayer(); run(P, { ...NONE, right: true }, 10);
  check('右端でクランプ（x = maxX を超えない）', P.x === CFG.move.maxX && P.vx === 0, 'x ' + P.x);
  const Q = newPlayer(); run(Q, { ...NONE, left: true }, 10);
  check('左端でクランプ', Q.x === -CFG.move.maxX && Q.vx === 0);
  let over = false; const R = newPlayer(); for (let i = 0; i < 2000; i++) { stepPlayer(R, { left: (i % 300) < 150, right: (i % 300) >= 150, jump: i % 97 === 0 }, 1 / 30); if (Math.abs(R.x) > CFG.move.maxX + 1e-9) over = true; }
  check('入力を切り替え続けても範囲外に出ない', !over);
  check('荒野の装飾を置かない半幅は maxX より広い', CFG.world.clearHalf > CFG.move.maxX);
})();

// ジャンプ
(() => {
  const P = newPlayer(); stepPlayer(P, { ...NONE, jump: true }, 1 / 60);
  check('地上で Space → 上昇開始', !P.grounded && P.y > 0 && P.vy > 0);
  const js = jumpStats(); let peak = 0, t = 0; while (!P.grounded && t < 5) { stepPlayer(P, NONE, 1 / 60); peak = Math.max(peak, P.y); t += 1 / 60; }
  check('必ず着地する', P.grounded && P.y === 0 && P.vy === 0);
  check('最高到達点が理論値に近い', Math.abs(peak - js.peak) < 0.3, 'peak ' + peak + ' / ' + js.peak);
  check('滞空時間が理論値に近い', Math.abs(t - js.air) < 0.1, 't ' + t + ' / ' + js.air);
  check('最高点は障害物を越えられそうな高さ（1.5〜5）', js.peak > 1.5 && js.peak < 5, 'peak ' + js.peak);
  const Q = newPlayer(); stepPlayer(Q, { ...NONE, jump: true }, 1 / 60); run(Q, NONE, 0.1); const vy = Q.vy; stepPlayer(Q, { ...NONE, jump: true }, 1 / 60);
  check('空中では二段ジャンプしない（vy は重力で減るだけ）', Q.vy < vy);
  const R = newPlayer(); run(R, NONE, 0.5);
  check('ジャンプしなければ y = 0 のまま', R.y === 0 && R.grounded);
  const S = newPlayer(); stepPlayer(S, { ...NONE, jump: true }, 1 / 60); run(S, { ...NONE, right: true }, 0.3);
  check('空中でも左右修正できる', S.x > 0 && S.vx > 0);
  const G = newPlayer(); run(G, { ...NONE, right: true }, 0.2); const A = newPlayer(); stepPlayer(A, { ...NONE, jump: true }, 1 / 60); run(A, { ...NONE, right: true }, 0.2);
  check('空中は地上より横の加速が鈍い（少しだけ修正できる程度）', A.vx < G.vx, A.vx + ' vs ' + G.vx);
  const T = newPlayer(); run(T, NONE, 1); const d1 = T.dist; const U = newPlayer(); stepPlayer(U, { ...NONE, jump: true }, 1 / 60); run(U, NONE, 1 - 1 / 60);
  check('ジャンプ中も前進速度は変わらない', Math.abs(U.dist - d1) < 1e-6);
})();

// dt 非依存（フレームレートが違っても距離がほぼ同じ）
(() => {
  const A = newPlayer(); run(A, { ...NONE, right: true }, 3, 1 / 60); const B = newPlayer(); run(B, { ...NONE, right: true }, 3, 1 / 30);
  check('60fps と 30fps で 3 秒後の距離がほぼ同じ', Math.abs(A.dist - B.dist) < 0.5, A.dist + ' vs ' + B.dist);
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
  const J = newPlayer(); stepPlayer(J, { ...NONE, jump: true }, STEP); run(J, NONE, 0.3);
  check('高く跳んでいれば爆風の上を越える（y ≥ maxY）', J.y >= H.maxY && !rockHitsPlayer(J, J.x, J.z, RK.sizes.large.radius), 'y ' + J.y);
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
  for (let i = 0; i < 30; i++) { stepPlayer(A, { left: true, right: false, jump: i === 3 }, STEP); stepPlayer(B, NONE, STEP); }
  check('knocked 中は左右入力・ジャンプを無視（入力ありでも結果が同じ）', Math.abs(A.x - B.x) < 1e-9 && Math.abs(A.y - B.y) < 1e-9 && A.state === 'knocked');
  const seq = []; let prev = ''; const C = newPlayer(); run(C, NONE, 1); knockPlayer(C, C.x, C.z, 'mid');
  let maxY = 0, bounced = false, tt = 0, wasAir = false, minX = 9, maxXv = -9, nan = false;
  while (tt < 8 && !(C.state === 'run' && C.invuln > 0)) { stepPlayer(C, NONE, STEP); tt += STEP; if (C.state !== prev) { seq.push(C.state); prev = C.state; }
    maxY = Math.max(maxY, C.y); if (!C.grounded) wasAir = true; if (wasAir && C.grounded && C.state === 'knocked' && C.stateT < C.knockT) bounced = true;
    minX = Math.min(minX, C.x); maxXv = Math.max(maxXv, C.x); if (!isFinite(C.x + C.y + C.z)) nan = true; }
  check('流れは knocked → recover → run', seq.join('>') === 'knocked>recover>run', seq.join('>'));
  check('吹き飛び中に高さ1u以上まで舞い上がる', maxY > 1, 'maxY ' + maxY);
  check('地面に落ちてバウンド／転がる（着地後も knocked が続く）', bounced);
  check('吹き飛び中は荒野の左右限界を超えない・NaN にならない', minX >= -CFG.move.maxX - 1e-9 && maxXv <= CFG.move.maxX + 1e-9 && !nan);
  check('直撃から操作復帰までが短すぎず長すぎない（1〜3.5秒）', tt > 1 && tt < 3.5, 'tt ' + tt);
  check('復帰時は地上・y=0・回転が戻っている', C.y === 0 && C.grounded && C.tumble === 0);
  check('復帰後すぐ無敵時間（invuln = invulnSec）', Math.abs(C.invuln - H.invulnSec) < 0.05);
  const x1 = C.x; run(C, { ...NONE, right: true }, 0.3);
  check('起き上がり後は再び左右入力が効く', C.x > x1 + 0.1 && C.state === 'run');
  const D = newPlayer(); knockPlayer(D, 0, 0, 'mid'); runUntil(D, NONE, p => p.state === 'run', 6); stepPlayer(D, { ...NONE, jump: true }, STEP);
  check('起き上がり後は再びジャンプできる', !D.grounded && D.vy > 0);
  const E = newPlayer(), F = newPlayer(); run(E, NONE, 1); run(F, NONE, 1); knockPlayer(F, F.x, F.z, 'mid'); const d0 = F.dist, e0 = E.dist; run(E, NONE, 1); run(F, NONE, 1);
  check('吹き飛び中も前には進むが、通常より遅い', F.dist - d0 > 0 && (F.dist - d0) < (E.dist - e0) - 1, (F.dist - d0) + ' vs ' + (E.dist - e0));
  check('P.z = -dist は吹き飛び中も保たれる', Math.abs(F.z + F.dist) < 1e-9);
})();

(() => {
  const res = ['small', 'mid', 'large'].map(s => { const P = newPlayer(); run(P, NONE, 1); P.x = 0; const x0 = P.x; knockPlayer(P, -1, P.z, s); let t = 0, peak = 0;
    while (P.state === 'knocked') { stepPlayer(P, NONE, STEP); peak = Math.max(peak, P.y); t += STEP; } return { x: Math.abs(P.x - x0), t, peak, slow: P.slow }; });
  check('大型ほど遠くへ吹き飛ぶ（small < mid < large）', res[0].x < res[1].x && res[1].x < res[2].x, JSON.stringify(res.map(r => r.x)));
  check('大型ほど高く舞い上がる', res[0].peak < res[1].peak && res[1].peak < res[2].peak);
  check('大型ほど吹き飛び時間が長い', res[0].t < res[1].t && res[1].t < res[2].t);
  check('大型ほど減速が長引く', res[0].slow < res[1].slow && res[1].slow < res[2].slow);
  check('小型でも最低限は吹き飛ぶ（上方向に 1u 以上）', res[0].peak > 1, 'peak ' + res[0].peak);
})();

(() => {
  const P = newPlayer(); run(P, NONE, 1); knockPlayer(P, P.x, P.z, 'mid'); runUntil(P, NONE, p => p.state === 'run', 6);
  stepPlayer(P, NONE, STEP);
  const s0 = P.speed, base = speedAt(P.time);
  check('復帰直後は移動速度が低下している（slowFactor 付近）', s0 < base * 0.7 && s0 > base * 0.4, s0 + ' / ' + base);
  check('slow タイマーが残っている', P.slow > 1);
  const sp = []; let t = 0;
  while (t < H.slowSec + 1.5) { stepPlayer(P, NONE, STEP); t += STEP; sp.push(P.speed / speedAt(P.time)); }
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
  const P = newPlayer(); run(P, NONE, 3); let bad = 0, aimedN = 0, aimedNear = 0, n = 0; const rng = lcg(5);
  const lim = CFG.move.maxX + RK.edgeMargin;
  for (let i = 0; i < 2000; i++) {
    const size = pickRockSize(rng()), tg = pickRockTarget(P, size, rng), warn = RK.sizes[size].warn, pred = P.z - P.speed * warn;
    if (Math.abs(tg.x) > lim + 1e-9) bad++;
    if (tg.z > pred + RK.aimJitterZ + 1e-9) bad++;
    if (tg.aimed) { aimedN++; if (Math.abs(tg.x - P.x) <= RK.aimJitterX + 1e-9 && Math.abs(tg.z - pred) <= RK.aimJitterZ + 1e-9) aimedNear++; }
    n++;
  }
  check('落下地点は荒野の幅内（|x| ≤ maxX+余白）で、恐竜の予想位置より前方', bad === 0, 'bad ' + bad);
  check('狙いの噴石は、着弾時の恐竜の予想位置の近くに落ちる', aimedN > 0 && aimedNear === aimedN, aimedNear + '/' + aimedN);
  check('狙う確率は aimChance 付近', Math.abs(aimedN / n - RK.aimChance) < 0.05, aimedN / n);
  const slowP = newPlayer(); run(slowP, NONE, 3); slowP.speed *= 0.5; const fast = pickRockTarget(P, 'mid', () => 0.0), slw = pickRockTarget(slowP, 'mid', () => 0.0);
  check('減速中は着弾点が手前にずれる（速度を考慮している）', slw.z > fast.z, slw.z + ' vs ' + fast.z);
  const P3 = newPlayer(); P3.x = CFG.move.maxX; const tg3 = pickRockTarget(P3, 'mid', () => 0.0);
  check('端にいる恐竜を狙っても荒野の外には落ちない', Math.abs(tg3.x) <= lim);
})();

(() => {
  const S = newRockSched(), P = newPlayer(); run(P, NONE, 1);
  const w = ['small', 'mid', 'large'].map(s => RK.sizes[s]);
  check('警告時間は小 < 中 < 大で、どれも十分な猶予（0.8秒以上）', w[0].warn < w[1].warn && w[1].warn < w[2].warn && w[0].warn >= 0.8);
  check('着弾範囲は小 < 中 < 大・大型は非常に大きい', w[0].radius < w[1].radius && w[1].radius < w[2].radius && w[2].radius >= 1.5 * w[1].radius);
  check('吹き飛びの強さは 小 < 中 < 大・画面揺れは小なし/中弱/大強', w[0].power < w[1].power && w[1].power < w[2].power && w[0].shake === 0 && w[1].shake > 0 && w[2].shake > w[1].shake);
  check('警告時間内に横へ逃げ切れる（最高横速度×猶予 > 着弾半径＋恐竜半径）', w.every(c => c.warn * CFG.move.maxSpeed > c.radius + H.dinoR + 1));
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

document.getElementById('sum').textContent = nNg === 0 ? `ALL PASS (${nOk})` : `FAIL ${nNg} / PASS ${nOk}`;
document.getElementById('sum').style.color = nNg === 0 ? '#6bd07a' : '#ff6b6b';
