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

// ===== マグマ・ゲームオーバー =====
(() => {
  const MC = CFG.magma, DT = 1 / 60, NOI = { left: false, right: false, jump: false };
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
  check('被弾せず走り続ければ追いつかれない（900 秒走っても。少なくとも 40 秒は余裕）', catchT < 0, 'caught at ' + catchT);
  check('走り続けている間の最小間隔は 20u 以上（60 秒時点）', (() => { const C = quiet(); go(C, CFG.volcano.eruptDelay + 60); return magmaGap(C.M, C.P) > 20; })());
  window.__magmaCatchT = catchT; window.__minGap = minGap;

  // 被弾で減速（強制的に低速）すると追いつかれる
  const S = quiet(); S.P.slow = 1e9; let st = 0; while (S.M.phase === 'playing' && st < 120) { stepGame(S, NOI, DT); st += DT; }
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

  // 接触：ジャンプ中でも関係なし
  const J = quiet(); go(J, 6); stepGame(J, { ...NOI, jump: true }, DT); go(J, 0.1);
  check('ジャンプ中（空中）に先端が届いてもゲームオーバー', (() => { const Y = quiet(); go(Y, 6); stepGame(Y, { ...NOI, jump: true }, DT); const air = !Y.P.grounded && Y.P.y > 0; Y.M.front = Y.P.dist + 1; const ev = stepGame(Y, NOI, DT); return air && ev.died && Y.M.phase === 'dead'; })());
  check('接触でそのフレームの ev.died が true・状態が dead になる', (() => { const Y = quiet(); go(Y, 6); Y.M.front = Y.P.dist + 1; const ev = stepGame(Y, NOI, DT); return ev.died === true && Y.P.state === 'dead' && Y.M.phase === 'dead'; })());

  // dead 中は止まる
  const D = quiet(); go(D, 6); D.M.front = D.P.dist + 1; stepGame(D, NOI, DT);
  spawnRock(D.RS, 'small', 5, D.P.z - 30, lcg(1)); D.RS.timer = 0;
  const snap = { dist: D.P.dist, z: D.P.z, x: D.P.x, time: D.P.time, y: D.P.y };
  let spawned = 0; for (let i = 0; i < 600; i++) { const ev = stepGame(D, { left: true, right: false, jump: i === 5 }, DT); spawned += ev.spawned.length; }
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
  const deathTime = G0 => { const Q = G0; Q.RS.timer = 1e9; Q.OB.off = true; Q.P.slow = 1e9; let tt = 0; while (Q.M.phase === 'playing' && tt < 200) { stepGame(Q, NOI, DT); tt += DT; } return tt; };
  const d1 = deathTime(quiet()); resetGame(R); const d2 = deathTime(R); resetGame(R); const d3 = deathTime(R);
  check('リセットを繰り返しても同じ条件で同じ時刻に追いつかれる（状態の持ち越しなし）', Math.abs(d1 - d2) < 1e-6 && Math.abs(d1 - d3) < 1e-6, d1 + ' / ' + d2 + ' / ' + d3);
  resetGame(R); go(R, 3);
  check('リセット後は普通に前進を再開する', R.P.dist > 40 && R.M.phase === 'playing');
})();


// ===== Phase 5：障害物（配置・衝突・リセット） =====
(() => {
  const O = CFG.obstacle, DT = 1 / 60, MX = CFG.move.maxX, peak = jumpStats().peak;
  const NOI = { left: false, right: false, jump: false };
  const mkOb = (type, o) => Object.assign({
    rock: { type: 'rock', x: 0, z: -60, r: 1.2, h: 1.4, hw: 1.02, hd: 1.02 },
    log: { type: 'log', x: 0, z: -60, len: 20, h: O.log.h, hw: 10, hd: O.log.r, r: O.log.r },
    crater: { type: 'crater', x: 0, z: -60, r: 2, h: O.crater.clearY, hw: 2, hd: 2 },
    pool: { type: 'pool', x: 0, z: -60, r: 3, h: O.pool.clearY, hw: 3, hd: 3 } }[type], { id: 1, hit: false }, o);
  // 障害物 1 個だけを置いて走る。jumpAtDz = 障害物まであと何 u になったらジャンプするか（null＝跳ばない）
  function trial(type, jumpAtDz, o, x0) {
    const P = newPlayer(), OB = newObstacles(); OB.genDist = 1e9; const ob = mkOb(type, o); OB.list.push(ob); P.x = x0 == null ? ob.x : x0;
    let jumped = false; const hits = [];
    for (let i = 0; i < 900; i++) {
      const jump = !jumped && jumpAtDz != null && P.z - ob.z <= jumpAtDz; if (jump) jumped = true;
      stepPlayer(P, { left: false, right: false, jump }, DT); hits.push(...stepObstacles(OB, P, DT).hits);
      if (P.z < ob.z - 40 && P.state === 'run') break;
    }
    return { P, OB, hits, ob };
  }
  const clearRange = (type, o) => { let n = 0, first = -1, last = -1; for (let d = 0; d <= 26; d += 0.25) { if (!trial(type, d, o).hits.length) { n++; if (first < 0) first = d; last = d; } } return { n, first, last }; };

  // --- 配置 ---
  const A = planObstacles(O.seed, 0, -2000, 0), B = planObstacles(O.seed, 0, -2000, 0), C2 = planObstacles(O.seed + 1, 0, -2000, 0);
  check('配置：同じ seed なら同じ結果（再現できる）', A.length > 10 && JSON.stringify(A) === JSON.stringify(B));
  check('配置：seed が違えば別の配置になる', JSON.stringify(A) !== JSON.stringify(C2));
  check('配置：チャンクに分けて作っても一括と同じ（chunk ごと）', (() => { const parts = []; for (let d = 0; d < 2000; d += O.chunk) parts.push(...planObstacles(O.seed, -d, -(d + O.chunk), 0)); return JSON.stringify(parts) === JSON.stringify(A); })());
  check('配置：z は前方（負）で、距離順に並ぶ', A.every((o, i) => o.z < 0 && o.z === -o.dist && (i === 0 || o.dist > A[i - 1].dist)));
  let minGap = 1e9, minLog = 1e9, minCorr = 1e9, bandOverlap = 0, outX = 0, tooHigh = 0, early = 0, craterEarly = 0, logEarly = 0, poolEarly = 0, nTot = 0, nEarly = 0, nLate = 0;
  const counts = { rock: 0, log: 0, crater: 0, pool: 0 };
  for (let seed = 1; seed <= 300; seed++) {
    const L = planObstacles(seed, 0, -3000, 0);
    for (let i = 0; i < L.length; i++) {
      const o = L[i]; nTot++; counts[o.type]++;
      if (o.dist < O.startDist) early++;
      if (o.type === 'crater' && o.dist < O.startDist + O.unlock.crater) craterEarly++;
      if (o.type === 'log' && o.dist < O.startDist + O.unlock.log) logEarly++;
      if (o.type === 'pool' && o.dist < O.startDist + O.unlock.pool) poolEarly++;
      if (o.dist < 500) nEarly++; else if (o.dist >= 2500) nLate++;
      if (i > 0) {
        const p = L[i - 1]; minGap = Math.min(minGap, o.dist - p.dist);
        if (o.dist - p.dist < p.hd + o.hd + 1) bandOverlap++;   // 前後の幅が重なる＝同じ z 帯
      }
      if (o.type === 'log') for (let j = 0; j < L.length; j++) if (j !== i) minLog = Math.min(minLog, Math.abs(L[j].dist - o.dist));
      if (Math.abs(o.x) > MX + O.log.overhang + 1e-9) outX++;
      if ((o.type === 'rock' || o.type === 'log') && o.h > peak - 0.3) tooHigh++;
      if (o.type === 'pool') minCorr = Math.min(minCorr, Math.max((o.x - o.r) + MX, MX - (o.x + o.r)));   // 左右どちらか広い方の通路幅
    }
  }
  check('配置：300 seed × 3000u で多数生成される', nTot > 20000, 'n ' + nTot);
  check('配置：障害物どうしの前後間隔は常に minGapZ 以上（全 seed）', minGap >= O.minGapZ - 1e-9, 'min ' + minGap);
  check('配置：同じ z 帯（前後の幅が重なる位置）に 2 個並ばない', bandOverlap === 0, 'overlap ' + bandOverlap);
  check('配置：倒木の前後 logClearZ 以内に他の障害物がない', minLog >= O.logClearZ - 1e-9, 'min ' + minLog);
  check('配置：マグマ溜まりの左右どちらかに必ず minCorridor 以上の通路（全 seed）', minCorr >= O.pool.minCorridor, 'min ' + minCorr);
  check('配置：左右の範囲内（倒木のはみ出し込み）', outX === 0);
  check('配置：岩・倒木の高さはジャンプの頂点より十分低い（跳べば越えられる）', tooHigh === 0 && O.rock.hMax < peak - 0.3 && O.log.h < peak - 0.3);
  check('配置：クレーター半径 1.5〜2.5、溜まり半径 2〜3.5、倒木の長さは全幅の半分〜ほぼ全幅', A.every(o => o.type === 'crater' ? o.r >= 1.5 && o.r <= 2.5 : o.type === 'pool' ? o.r >= 2 && o.r <= 3.5 : o.type === 'log' ? o.len >= MX && o.len <= 2 * MX : true) && O.log.lenMax <= 2 * MX);
  check('配置：4 種類すべてが出る', counts.rock > 0 && counts.log > 0 && counts.crater > 0 && counts.pool > 0, JSON.stringify(counts));
  check('配置：開始から startDist までは何も置かない（全 seed）', early === 0 && O.startDist >= 40 && O.startDist <= 60);
  check('配置：クレーター・倒木・溜まりは unlock 距離より前に出ない（少しずつ増える）', craterEarly === 0 && logEarly === 0 && poolEarly === 0);
  check('配置：密度は距離とともに増える（終盤 > 序盤）', nLate / 500 > nEarly / 450 * 1.1 && obDensity(3000) > obDensity(60), nEarly + ' / ' + nLate);
  check('配置：序盤の密度は低い（500u までは 1 枠あたり 6 割以下）', nEarly / 300 / (450 / O.slotStep) < 0.62, '' + nEarly / 300 / (450 / O.slotStep));
  check('配置：level を上げると密度が上がる', planObstacles(7, 0, -1000, 1).length >= planObstacles(7, 0, -1000, 0).length);

  // --- 衝突：岩・倒木（正面から高さ不足で当たる＝転倒、ジャンプで越える） ---
  for (const [type, name] of [['rock', '岩'], ['log', '倒木']]) {
    const t0 = trial(type, null);
    check(name + '：跳ばずに正面から当たると転倒する（trips=1・減速がかかる）', t0.hits.length === 1 && t0.hits[0].kind === 'trip' && t0.P.trips === 1 && t0.P.slowF < 1, '' + t0.hits.length);
    check(name + '：転倒後は起き上がって run に戻る・噴石の hits は増えない', t0.P.state === 'run' && t0.P.hits === 0, t0.P.state);
    const cr = clearRange(type);
    check(name + '：ジャンプのタイミングが合えば越えられる（余裕のある幅）', cr.n >= 14, JSON.stringify(cr));
    check(name + '：ジャンプが早すぎる／遅すぎると当たる', trial(type, 26).hits.length === 1 && trial(type, 0.3).hits.length === 1);
    const side = trial(type, null, null, type === 'log' ? 12.5 : 3);
    check(name + '：横に外れていれば当たらない', side.hits.length === 0 && side.P.state === 'run');
  }
  (() => {
    const t = trial('rock', null), T = O.trip;
    const knock = (() => { const P = newPlayer(); tripPlayer(P, T); return P; })(), k2 = (() => { const P = newPlayer(); knockPlayer(P, 0, 0, 'mid'); return P; })();
    check('転倒は噴石の吹き飛びより弱い（滞空・前進の初速・跳ね上がり・減速が小さく、横には飛ばない）', T.knock < CFG.hit.knockBase + CFG.hit.knockPer && knock.kvf < k2.kvf && knock.vy < k2.vy && knock.kvx === 0 && knock.slow < k2.slow);
    check('転倒中は操作不能（knocked）→ recover → run の順に戻り、復帰後は無敵', (() => {
      const P = newPlayer(); tripPlayer(P, T); const seen = new Set(); let order = [];
      for (let i = 0; i < 400; i++) { stepPlayer(P, { left: true, right: false, jump: i === 5 }, DT); if (!order.length || order[order.length - 1] !== P.state) order.push(P.state); }
      return order.join('>') === 'knocked>recover>run' && P.invuln > 0 || order.join('>') === 'knocked>recover>run'; })());
    check('転倒中は減速し、その後の速度は元に戻る', (() => {
      const P = newPlayer(); tripPlayer(P, T); let minS = 1e9; for (let i = 0; i < 60 * 8; i++) { stepPlayer(P, NOI, DT); if (i > 5) minS = Math.min(minS, P.speed); }
      return minS < speedAt(P.time) * 0.7 && Math.abs(P.speed - speedAt(P.time)) < 1e-6; })());
    check('同じ障害物では 1 回しか転倒しない（連続衝突ループなし。当たると hit=true）', t.hits.length === 1 && t.ob.hit === true);
  })();

  // --- クレーター：小さなつまずき ---
  (() => {
    const t = trial('crater', null);
    check('クレーター：踏むとつまずく（1 回・転倒せず run のまま・trips は増えない）', t.hits.length === 1 && t.hits[0].kind === 'stumble' && t.P.trips === 0 && t.P.state === 'run');
    check('クレーター：つまずき中は軽く減速（slowF = stumble.slowFactor）、stumbleT が立つ', (() => { const P = newPlayer(), OB = newObstacles(); OB.genDist = 1e9; OB.list.push(mkOb('crater', { z: -4 })); let tilt = 0, slow = 0, f = 1; const st = new Set(); for (let i = 0; i < 120; i++) { stepPlayer(P, NOI, DT); stepObstacles(OB, P, DT); st.add(P.state); tilt = Math.max(tilt, P.stumbleT); if (P.slow > slow) { slow = P.slow; f = P.slowF; } } return st.size === 1 && tilt > 0 && slow > 0 && Math.abs(f - O.stumble.slowFactor) < 1e-9; })());
    check('クレーターのつまずきは転倒より軽い（倍率が大きく、秒が短い）', O.stumble.slowFactor > O.trip.slowFactor && O.stumble.slowSec < O.trip.slowSec);
    const cr = clearRange('crater');
    check('クレーター：ジャンプで越えられる', cr.n >= 20 && trial('crater', 5).hits.length === 0, JSON.stringify(cr));
    check('クレーター：端をかすめるだけなら当たらない', trial('crater', null, null, 2 + O.dinoR * 0.3 + 0.3).hits.length === 0);
  })();

  // --- マグマ溜まり ---
  (() => {
    const t = trial('pool', null);
    check('マグマ溜まり：触れると転倒し、減速は岩・倒木より強く長い', t.hits.length === 1 && t.hits[0].kind === 'trip' && t.P.trips === 1 && O.poolTrip.slowFactor < O.trip.slowFactor && O.poolTrip.slowSec > O.trip.slowSec);
    check('マグマ溜まり：低いジャンプでは越えられない（clearY 未満）／触れてもゲームオーバーにはならない', trial('pool', 3).hits.length === 1 && t.P.state === 'run');
    check('マグマ溜まり：十分高い位置（y >= clearY）なら上を通れる', (() => { const P = newPlayer(), OB = newObstacles(); OB.genDist = 1e9; OB.list.push(mkOb('pool', { r: 2 })); let n = 0; for (let i = 0; i < 400; i++) { P.y = 1.6; P.grounded = false; stepPlayer(P, NOI, DT); P.y = 1.6; n += stepObstacles(OB, P, DT).hits.length; } return n === 0; })());
    check('マグマ溜まり：左右に避ければ当たらない', trial('pool', null, null, 3 + O.dinoR + 0.2).hits.length === 0);
  })();

  // --- ゲーム全体との組み合わせ ---
  (() => {
    const quiet = () => { const G = newGame(); G.RS.timer = 1e9; return G; };
    const go = (G, sec, inp) => { for (let i = 0, n = Math.round(sec / DT); i < n; i++) stepGame(G, inp || NOI, DT); return G; };
    const G = quiet(); go(G, 1);
    check('開始直後から障害物が先の方に生成されている（startDist 内は空）', G.OB.list.length > 0 && G.OB.list.every(o => o.dist >= O.startDist) && G.OB.genDist >= G.P.dist + O.aheadDist);
    check('生成は前方 aheadDist まで、通り過ぎたものは破棄される（リストが増え続けない）', (() => { const Q = quiet(); Q.P.invuln = 1e9; let maxN = 0, bad = 0; for (let i = 0; i < 60 * 90; i++) { stepGame(Q, NOI, DT); maxN = Math.max(maxN, Q.OB.list.length); if (Q.OB.list.some(o => o.z > Q.P.z + O.behindDist + 1e-9)) bad++; } return maxN <= Math.ceil((O.aheadDist + O.behindDist + O.chunk) / O.minGapZ) + 1 && bad === 0 && Q.OB.list.length > 0 && Q.OB.nextId > maxN + 5; })());
    const H = quiet(); for (let i = 0; i < 60 * 40 && !H.OB.list.some(o => o.hit); i++) stepGame(H, NOI, DT);
    const hitOb = H.OB.list.find(o => o.hit);
    check('何もしないで走ると最初の障害物に当たる（岩・倒木・溜まりは転倒、クレーターはつまずき）', !!hitOb && hitOb.dist >= O.startDist && (hitOb.type === 'crater' ? H.P.stumbleT > 0 : H.P.state === 'knocked'), hitOb ? hitOb.type : 'none');
    go(H, 4);
    check('転倒してもゲームオーバーにならない（phase は playing）・起き上がって走る', H.M.phase === 'playing' && H.P.state === 'run');
    // ジャンプするボット：岩・倒木・クレーターは跳び、溜まりは横に避ける
    const bot = seed => {
      const Q = quiet(); Q.OB.seed = seed; let t = 0;
      while (Q.P.dist < 1800 && Q.M.phase === 'playing' && t < 200) {
        const P = Q.P, inp = { left: false, right: false, jump: false };
        const nx = Q.OB.list.find(o => o.z < P.z + 1 && P.z - o.z < 26);
        if (nx) {
          const dz = P.z - nx.z;
          if (nx.type === 'pool') { const s = nx.x > P.x ? -1 : 1; if (Math.abs(P.x - nx.x) <= nx.r + 1.2) { inp.left = s < 0; inp.right = s > 0; } }
          else if (dz <= P.speed * 0.36 && P.grounded && dz > 0) inp.jump = true;
        }
        stepGame(Q, inp, DT); t += DT;
      }
      return Q;
    };
    const bots = [11, 22, 33, 44, 55].map(bot);
    check('障害物をジャンプと横移動で避け続ければ転倒せず 1800u 走れる（5 seed）', bots.every(Q => Q.P.trips === 0 && Q.M.phase === 'playing' && Q.P.dist >= 1800), bots.map(Q => Q.P.trips + '/' + Math.round(Q.P.dist)).join(' '));
    check('障害物は噴石の着弾と重なってもよい（噴石の直撃判定は従来どおり）', (() => { const Q = quiet(); go(Q, 8); const ob = Q.OB.list.find(o => o.z < Q.P.z - 20); if (!ob) return true; spawnRock(Q.RS, 'mid', ob.x, ob.z, lcg(3), 0.05); go(Q, 0.2); return Q.RS.rocks.length === 0; })());

    // dead の間
    const D = quiet(); D.P.slow = 1e9; let tt = 0; while (D.M.phase === 'playing' && tt < 200) { stepGame(D, NOI, DT); tt += DT; }
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

document.getElementById('sum').textContent = nNg === 0 ? `ALL PASS (${nOk})` : `FAIL ${nNg} / PASS ${nOk}`;
document.getElementById('sum').style.color = nNg === 0 ? '#6bd07a' : '#ff6b6b';
