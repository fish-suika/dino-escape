// ===== Phase 7 演出のつなぎ（画面揺れの統合・被弾の演出・足元の土煙・音の発火・HUD の動き） =====
// 計算の核（合成・上限・ヒットストップ・ダッキング・足音の数え方）は 24-fx-logic.js。ここは three.js / DOM / 音へ流すだけ。
// 調整値は CFG.fx。CFG.fx.intensity（0〜1）で全体をまとめて弱められる。
const FXS = fxNew();   // ヒットストップ・ダッキング・音の間隔の状態
const FXV = { G: null, dino: null, t: 0, prevRun: true, prevSliding: false, prevLane: 1, prevLaneMove: false, slideAcc: 0, runAcc: 0, prevPhase: 0, fear: 0, panic: 0, stage: -1 };

function fxBuild(G, dino) {
  FXV.G = G; FXV.dino = dino;
  FXV.$vig = document.getElementById('hitVig'); FXV.$edge = document.getElementById('edge'); FXV.$hint = document.getElementById('hint'); FXV.$danger = document.getElementById('danger');
  fxResetView();
}

// 再スタート用
function fxResetView() {
  fxReset(FXS);
  Object.assign(FXV, { t: 0, prevRun: true, prevSliding: false, prevLane: 1, prevLaneMove: false, slideAcc: 0, runAcc: 0, prevPhase: 0, fear: 0, panic: 0, stage: -1 });
  if (FXV.dino) { FXV.dino.fear = 0; FXV.dino.panic = 0; }
  if (FXV.$vig) FXV.$vig.classList.remove('on');
  if (FXV.$edge) FXV.$edge.style.opacity = 0;
  fxRestartHint();
  sndSetDuck(1);
}

// 操作ヒント：数秒たったらフェードアウト（再スタートでまた出す）
function fxRestartHint() {
  const h = FXV.$hint; if (!h) return;
  h.classList.remove('on'); void h.offsetWidth;
  h.style.animationDelay = CFG.fx.hintSec + 's'; h.classList.add('on');
}

// 被弾の赤い縁
function fxVignette(alpha) {
  const v = FXV.$vig; if (!v) return;
  const a = alpha * fxInt(); if (a <= 0.01) return;
  v.style.setProperty('--vigA', a.toFixed(2)); v.style.setProperty('--vigSec', CFG.fx.vignette.sec + 's');
  v.classList.remove('on'); void v.offsetWidth; v.classList.add('on');
}

// 噴石の直撃（size）/ 障害物で転倒（'trip'）：ヒットストップ・赤い縁・揺れ・ダッキング・ドン！＋鳴き声
function fxOnHit(kind, size) {
  const F = CFG.fx;
  if (kind === 'rock') {
    const big = size === 'large', pw = CFG.rock.sizes[size].power;
    fxHitstop(FXS, big ? F.hitstop.big : F.hitstop.rock);
    fxVignette(F.vignette.alpha * (0.6 + 0.4 * Math.min(1, pw / 1.8)));
    ROCKS.shake = Math.max(ROCKS.shake, F.shake.hitAmp * (big ? 1.2 : 1) * fxInt());
    fxDuck(FXS, F.duck.hit, 0.1);
    sndHit(pw);
  } else {
    fxHitstop(FXS, F.hitstop.trip);
    fxVignette(F.vignette.alpha * 0.45);
  }
}

// 危険マーカーが近くに出たとき「ピッ」
function fxMarkerAppear(r) {
  const G = FXV.G; if (!G) return;
  const B = CFG.fx.beep, P = G.P, d = Math.hypot(r.x - P.x, r.z - P.z) - r.radius;
  if (d < B.range && P.state === 'run' && fxCooldown(FXS, 'beep', FXV.t, B.gap)) sndBeep(r.size);
}

// 危険度（0〜3）が上がったとき：スティンガーと HUD の拡大
function fxStage(stage) {
  if (stage > FXV.stage && FXV.stage >= 0) {
    sndStinger(stage); fxDuck(FXS, 0.2, 0.2);
    const d = FXV.$danger; if (d) { d.classList.remove('pop'); void d.offsetWidth; d.classList.add('pop'); }
  }
  FXV.stage = stage;
}

// 毎フレーム（updateDino の前）：恐竜の表情の入力・足音・土煙・ダッキングの反映・噴火の縁
function fxFrame(dt, c) {
  const G = FXV.G, P = G.P, d = FXV.dino, k = fxInt(), F = CFG.fx;
  FXV.t += dt;
  const run = P.state === 'run' && (c.running != null ? c.running : c.alive);   // running：クリアの走り込み中も足音・土煙は出す
  // 恐竜の表情：近い危険マーカー / 近いマグマ
  const near = fxNearRock(G.RS.rocks, P, F.fear.range);
  FXV.fear += ((run ? near.nearness : 0) - FXV.fear) * (1 - Math.exp(-10 * dt));
  FXV.panic += ((c.alive && G.M.active ? magmaProx(c.gap, F.panic.range) : 0) - FXV.panic) * (1 - Math.exp(-6 * dt));
  d.fear = FXV.fear; d.panic = FXV.panic;
  // レーン移動：踏み出す瞬間に「ザッ」と、移動と反対側の足もとから小さな砂煙
  if (run && P.laneMove && (!FXV.prevLaneMove || P.lane !== FXV.prevLane)) {
    const dir = Math.sign(laneX(P.lane) - P.laneFrom) || 1;
    sndLane();
    for (let i = 0; i < Math.round(F.laneDust * k); i++) fxEmit(ROCKS.dust, P.x - dir * rnd(0.3, 0.9), 0.15, P.z + rnd(0.2, 1.0), -dir * rnd(1.5, 4.5), rnd(0.4, 1.6), rnd(0.5, 2.5), rnd(0.35, 0.65), rnd(0.8, 1.4), 0.45, 0);
  }
  FXV.prevLaneMove = !!(run && P.laneMove); FXV.prevLane = P.lane;
  // くぐる：始まりで「ズサッ」と砂煙。滑っている間は足もとから砂煙が後ろへ流れる
  if (run && P.sliding && !FXV.prevSliding) {
    sndSlide(); FXV.slideAcc = 0;
    for (let i = 0; i < Math.round(10 * k); i++) fxEmit(ROCKS.dust, P.x + rnd(-0.6, 0.6), 0.15, P.z + rnd(0, 1.2), rnd(-2, 2), rnd(0.5, 2), rnd(2, 6), rnd(0.5, 0.9), rnd(1.6, 2.6), 0.5, 0);
  }
  if (run && P.sliding) {
    FXV.slideAcc += dt * 70 * k;
    while (FXV.slideAcc >= 1) { FXV.slideAcc -= 1; fxEmit(ROCKS.dust, P.x + rnd(-0.7, 0.7), 0.15, P.z + rnd(0, 1.6), rnd(-2.5, 2.5), rnd(0.4, 1.8), rnd(3, 7), rnd(0.4, 0.8), rnd(1.2, 2.2), 0.45, 0); }
  }
  FXV.prevSliding = !!(run && P.sliding);
  FXV.prevRun = run;
  // 足音（速度連動：速いほど歩数が増え、少し強くなる）と走りの土煙
  const steps = fxStepCount(FXV.prevPhase, d.phase); FXV.prevPhase = d.phase;
  if (run && P.grounded && P.speed > 2 && !P.sliding) {
    for (let i = 0; i < steps; i++) sndStep(P.speed / CFG.run.maxSpeed);
    FXV.runAcc += P.speed * dt * F.runDust.perUnit * k;
    while (FXV.runAcc >= 1) {
      FXV.runAcc -= 1;
      fxEmit(ROCKS.dust, P.x + rnd(-0.5, 0.5), 0.15, P.z + 0.9, rnd(-1, 1) - P.vx * 0.2, rnd(0.5, 1.6), rnd(3, 6), rnd(0.45, 0.8), F.runDust.size * rnd(0.8, 1.3) * (0.7 + 0.6 * P.speed / CFG.run.maxSpeed), 0.4, 0);
    }
  }
  sndSetDuck(fxDuckStep(FXS, dt));
  // 噴火中の画面端の赤い縁（強度 s が上がるほど濃く、最終局面は脈打つ）
  if (FXV.$edge) {
    const e = c.fx.state === 'erupting' && c.alive ? c.fx.k * (F.edge.base + F.edge.perS * c.dif.s) * (c.dif.s > 0.85 ? 0.85 + 0.15 * Math.sin(FXV.t * 5) : 1) * k : 0;
    FXV.$edge.style.opacity = e.toFixed(3);
  }
}

// 画面揺れ（位置のみ）：火山の噴火 / 噴石の着弾・被弾 / 最終逃走の常時 / マグマ接近 を二乗和の平方根で合成し、cap で頭打ち
function fxCamera(T, amps) {
  const a = fxShakeTotal(amps); if (a <= 0) return;
  const cam = WORLD.camera;
  cam.position.x += (Math.sin(T * 83) * 0.6 + Math.sin(T * 53) * 0.4) * a;
  cam.position.y += (Math.cos(T * 71) * 0.6 + Math.cos(T * 61) * 0.4) * a * 0.8;
}
