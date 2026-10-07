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

document.getElementById('sum').textContent = nNg === 0 ? `ALL PASS (${nOk})` : `FAIL ${nNg} / PASS ${nOk}`;
document.getElementById('sum').style.color = nNg === 0 ? '#6bd07a' : '#ff6b6b';
