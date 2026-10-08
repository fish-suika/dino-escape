// ===== 起動・メインループ =====
(function () {
  textApply();
  if (typeof THREE === 'undefined') { document.getElementById('hint').textContent = TEXT.noThree; return; }
  buildWorld(); buildVolcano(); buildRocks(); buildMagma(); buildObstacles(); buildCave(); hudBuild();
  const $boom = document.getElementById('boom'), $flash = document.getElementById('flash'), $scream = document.getElementById('scream');
  const $oops = document.getElementById("oops");
  let erupted = false, fx = volcanoState(0);
  const dino = buildDino(); WORLD.scene.add(dino.group);
  const G = newGame(), P = G.P, M = G.M, RS = G.RS, OB = G.OB;
  const F = newFlow(bestStorage());   // ゲーム全体の流れ（title → playing → over / clear）。localStorage が使えなくても動く
  fxBuild(G, dino);
  const newSeed = () => (Math.random() * 2147483647) | 0;
  OB.seed = newSeed();   // 障害物の配置の種（毎回変わる。リセット時も新しくする）
  const $dist = document.getElementById('dist'), $danger = document.getElementById('danger');
  let shownDanger = -1;
  let shown = -1, overShown = false, sighT = 0;
  const headPos = new THREE.Vector3();
  hudTitleBest(F.best); sndMuteLabel();

  function showScream() { $scream.classList.remove('on'); void $scream.offsetWidth; $scream.classList.add('on'); }

  function showOops() { $oops.style.animationDuration = CFG.obstacle.oopsSec + 's'; $oops.classList.remove('on'); void $oops.offsetWidth; $oops.classList.add('on'); }

  // 障害物にぶつかった：ドン！・うわっ！・土煙・軽い揺れ（クレーターは弱いつまずきなので文字なし・小さめ）
  function onObstacleHit(h) {
    const O = CFG.obstacle, ob = h.ob, trip = h.kind === 'trip', pool = ob.type === 'pool', T = pool ? O.poolTrip : O.trip;
    sndThud(trip ? (pool ? 1 : 0.8) : 0.35, pool);
    if (trip) { showOops(); ROCKS.shake = Math.max(ROCKS.shake, T.shake); fxOnHit('trip'); }
    const n = trip ? 16 : 6;
    for (let i = 0; i < n; i++) {
      const a = rnd(0, 6.283), sp = rnd(3, 9);
      fxEmit(ROCKS.dust, P.x + Math.cos(a) * 0.8, 0.3, P.z + Math.sin(a) * 0.8 - 1, Math.cos(a) * sp, rnd(0.5, 3), Math.sin(a) * sp - 4, rnd(0.8, 1.4), rnd(2, 3.4), 0.7, i % 3 === 0 ? 1 : 0);
    }
    if (pool) for (let i = 0; i < 14; i++) fxEmit(ROCKS.sparks, P.x, 0.5, P.z, rnd(-5, 5), rnd(6, 14), rnd(-5, 5), rnd(0.6, 1.1), rnd(1.2, 2.2), 1, 0);
  }

  // マグマに飲まれた瞬間：音・揺れ・溶岩のしぶき
  function onDeath() {
    sndMagmaDeath(); sndDinoDie();
    ROCKS.shake = Math.max(ROCKS.shake, 0.55);
    for (let i = 0; i < 46; i++) {
      const a = rnd(0, 6.283), sp = rnd(5, 16);
      fxEmit(ROCKS.sparks, P.x + Math.cos(a) * 0.8, 0.6, P.z + Math.sin(a) * 0.8, Math.cos(a) * sp * 0.6, rnd(8, 20), Math.sin(a) * sp * 0.6, rnd(0.7, 1.4), rnd(1.5, 3.2), 1, 0);
    }
    $scream.classList.remove('on');
  }

  // ギリギリ回避：キラッとした火花（金色の粒を恐竜のまわりから）
  function sparkle(big) {
    const n = big ? 46 : 26;
    for (let i = 0; i < n; i++) {
      const a = rnd(0, 6.283), sp = rnd(3, 9) * (big ? 1.3 : 1);
      fxEmit(ROCKS.sparks, P.x + Math.cos(a) * 0.8, rnd(0.8, 2.6), P.z + Math.sin(a) * 0.8, Math.cos(a) * sp, rnd(2, 8), Math.sin(a) * sp, rnd(0.5, 0.9), rnd(1.0, 2.0), 1, 0);
    }
  }
  function onScoreEvent(e) {
    if (e.kind === 'great' || e.kind === 'big') { hudGreat(e.text, e.kind === 'big'); sndGreat(e.kind === 'big'); sparkle(e.kind === 'big'); }
    hudPop('+' + e.pts + (e.kind === 'combo' || e.kind === 'magma' ? ' ' + e.text : ''));
  }

  // クリア演出の出来事（clearStep が名前を返す）
  function onClearEvent(e) {
    if (e === 'boom') {   // 火山が最大の大爆発：閃光・文字・揺れ（update で毎フレーム）・音・噴煙と火柱の一斉噴出
      sndMegaBoom(); fxDuck(FXS, 0.75, 0.8); volcanoMegaBurst(); $flash.classList.add('mega'); hudRestartAnim(HUD.$boom2, 'on');
      setTimeout(sndSurprise, 120);
    } else if (e === 'relief-text') {   // 「……危なかった」＋ため息
      hudRestartAnim(HUD.$relief, 'on'); sndSigh(); sighT = 1.0;
    } else if (e === 'stage:result') {
      hudResult('clear', F); sndFanfare();
    } else if (e === 'skip') {   // Space で飛ばした：途中の文字を消す
      HUD.$boom2.classList.remove('on'); HUD.$relief.classList.remove('on'); $flash.classList.remove('mega'); sighT = 0;
    }
  }

  // R：全状態を初期化して最初から（噴火・噴石・マグマ・恐竜・揺れ・フラッシュ・音・粒子）。タイトルは経由しない。オブジェクトは作り直さない
  function restart() {
    flowRestart(F, G, newSeed()); erupted = false; fx = volcanoState(0); shown = -1; overShown = false; sighT = 0;
    keysClear();
    resetRocks(); resetObstaclesView(); resetVolcano(); resetWorld(); resetMagmaView();
    dino.phase = 0; dino.air = 0; dino.slide = 0; dino.group.visible = true; dino.clr = null; dino.idle = false;
    [$boom, $scream, $oops].forEach(el => el.classList.remove('on')); hudReset(); shownDanger = -1; $flash.style.opacity = 0;
    sndMagmaUpdate(0); sndSetVolcanoMul(1); fxResetView(); syncPause();
  }

  // Space：タイトルから開始。このキー入力で WebAudio も resume される（bindSound が先に呼ぶ）
  function startGame() {
    if (!flowStart(F)) return false;
    keysClear(); hudMode('playing'); fxRestartHint();
    return true;
  }

  // 最初のタイトルへ：restart と同じ全初期化に加えて、タイトルの見た目（立ち姿・カメラ・ベスト表示）へ。ベストは残す
  function toTitle() {
    flowToTitle(F, G, newSeed()); erupted = false; fx = volcanoState(0); shown = -1; overShown = false; sighT = 0;
    keysClear();
    resetRocks(); resetObstaclesView(); resetVolcano(); resetWorld(); resetMagmaView();
    dino.phase = 0; dino.air = 0; dino.slide = 0; dino.group.visible = true; dino.clr = null; dino.idle = true;
    [$boom, $scream, $oops].forEach(el => el.classList.remove('on')); hudReset(); shownDanger = -1; $flash.style.opacity = 0;
    sndMagmaUpdate(0); sndSetVolcanoMul(0.7); fxResetView(); hudMode('title'); hudTitleBest(F.best); syncPause();
  }

  // ---- 一時停止：F.paused の変化に合わせて、入力のロック・音の停止/再開・メニュー表示をそろえる ----
  let prevPaused = false;
  function syncPause() {
    if (F.paused !== prevPaused) { prevPaused = F.paused; KEYS.locked = F.paused; keysClear(); sndSetPaused(F.paused); }
    hudPause(F, SND.muted);
  }
  function doPause() { if (flowPause(F)) { syncPause(); return true; } return false; }
  function pauseChoose(i) {   // メニューの決定（キーでもマウスでも）
    const a = flowMenuChoose(F, i);
    if (a === 'restart') restart(); else if (a === 'title') toTitle(); else if (a === 'mute') sndToggleMute();
    syncPause();
  }
  function pauseToggle() {   // Esc / P：プレイ中は一時停止、メニューなら再開（カウントダウン開始）、カウントダウン中ならメニューへ戻る
    if (!F.paused) doPause(); else if (flowMenuShown(F)) { flowResume(F); syncPause(); } else doPause();
  }
  function pauseFrame(dt) { stepFlow(F, G, { left: false, right: false, jump: false, slide: false }, dt); keysClear(); syncPause(); }
  document.querySelectorAll('#pauseUI .pitems button').forEach(b => {
    const i = +b.dataset.i;
    b.addEventListener('mousedown', e => e.preventDefault());                 // ボタンにフォーカスを残さない（Space で二重に押されない）
    b.addEventListener('pointerenter', () => { if (flowMenuSet(F, i)) syncPause(); });
    b.addEventListener('click', () => pauseChoose(i));
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) doPause(); });   // タブを離れたら自動で一時停止（戻るとメニュー → 再開はカウントダウンつき）

  function update(dt) {
    // 吹き飛び・起き上がり中は stepPlayer が入力を無視する。dead の間は stepGame が前進・操作・噴石の新規生成を止める。title の間は何も進めない
    const ev = stepFlow(F, G, { left: KEYS.leftQ, right: KEYS.rightQ, jump: KEYS.jumpQ, slide: KEYS.slideQ }, dt);
    keysClear();
    const mode = F.mode, C = F.clear, title = mode === 'title', playing = mode === 'playing', clearing = mode === 'clear';
    hudMode(mode);
    fx = volcanoState(P.time);
    const dif = difficultyAt(P.time - CFG.volcano.eruptDelay), em = eruptionMul(dif.s);   // 難易度：噴火の迫力は強度とともに最大へ
    if (fx.state === 'erupting') { fx.k *= em; fx.smoke *= em; }
    syncRocks(RS, dt); syncObstacles(OB, dt);
    ev.obstacle.hits.forEach(onObstacleHit);
    ev.landed.forEach(l => { rockImpact(l.rock, l.hit); if (l.hit) { showScream(); sndScream(); fxOnHit('rock', l.rock.size); } });
    if (ev.died) onDeath();
    ev.clear.forEach(onClearEvent);
    const se = scoreTake(F.S); se.forEach(onScoreEvent);
    const gap = magmaGap(M, P), alive = playing && M.phase === 'playing';
    // クリア演出の見た目：恐竜のポーズ・火山の増し・火山の音量・マグマが静まる
    dino.idle = title;
    dino.clr = clearing ? { stage: C.stage, t: C.t, turn: clearTurn(C), shock: clearShock(C), relief: clearRelief(C) } : null;
    VOL.mega = clearing ? clearMega(C) : 0; MAG.calm = clearing;
    sndSetVolcanoMul(clearing ? clearVolMul(C) : title ? 0.7 : 1);
    WORLD.viewAz = flowCamAz(F); WORLD.viewUp = clearing ? clearTilt(C) : 0;
    if (sighT > 0) {   // ため息：口もとから白っぽい息
      sighT -= dt; dino.head.getWorldPosition(headPos);
      if (Math.random() < dt * 40) fxEmit(ROCKS.dust, headPos.x + rnd(-0.2, 0.2), headPos.y - 0.2, headPos.z + 0.9, rnd(-0.4, 0.4), rnd(0.2, 0.8), rnd(1.2, 2.4), rnd(0.9, 1.4), rnd(0.7, 1.2), 0.45, 0);
    }
    updateRocksFx(dt);
    fxFrame(dt, { alive, gap, dif, fx, running: alive || (clearing && C.stage === 'runin') });
    updateDino(dino, P, dt);
    updateWorld(P, dt);
    if (fx.state === 'erupting' && !erupted) { erupted = true; if (playing) { $boom.classList.add('on'); sndBoom(); fxDuck(FXS, CFG.fx.duck.boom, 0.3); } }
    updateVolcano(P, dt, fx);
    updateMagma(P, M, dt);
    MAG.mesh.position.y = clearing ? -clearLavaSink(C) : 0;   // クリア後、マグマは引いて沈む
    if (playing && dif.stage !== shownDanger) { shownDanger = dif.stage; fxStage(dif.stage); $danger.textContent = TEXT.danger + dif.label; $danger.className = 'd' + dif.stage; }
    if (mode === 'over' && !overShown && M.deadT >= CFG.magma.overlayDelay) { overShown = true; hudResult('over', F); }
    sndUpdate(fx);
    sndMagmaUpdate(alive ? magmaProx(gap, CFG.magma.audibleRange) : M.phase === 'dead' ? Math.max(0, 0.6 - M.deadT * 0.3) : 0);
    $flash.style.opacity = Math.max(fx.flash, clearing ? clearFlash(C) : 0);
    const T = VOL.t;   // 揺れの位相（P.time は死亡で止まるので別の時計を使う）
    // 画面揺れは全要因を fxCamera でまとめて合成（位置のみ・二乗和の平方根で合成し上限あり）：噴火 / 噴石の着弾・被弾 / 最終逃走の常時 / マグマ接近 / クリアの大爆発
    const finalS = alive && dif.e > CFG.difficulty.shake.from ? finalShake(dif.e) : 0;
    const magS = alive && M.active ? CFG.magma.shakeAmp * Math.pow(magmaProx(gap, CFG.magma.shakeRange), 2) : 0;
    fxCamera(T, [fx.shake, ROCKS.shake, finalS, magS, clearing ? clearShakeAmp(C) : 0]);
    const m = Math.floor(clearing || mode === 'over' ? F.dist || P.dist : P.dist);
    if (m !== shown) { shown = m; $dist.textContent = TEXT.dist + m + 'm'; }
    hudScore(scoreTotal(F.S, P, clearing || mode === 'over' ? F.dist : null), se.length > 0);
  }

  bindInput(); bindSound();
  addEventListener('keydown', e => {
    if (e.repeat) return;
    if (e.code === 'Escape' || e.code === 'KeyP') { if (F.mode === 'playing') pauseToggle(); return; }
    if (F.paused) {   // 一時停止メニューの操作（↑↓ / W S で選択、Space / Enter で決定）
      if (!flowMenuShown(F)) return;
      if (e.code === 'ArrowUp' || e.code === 'KeyW') { flowMenuMove(F, -1); syncPause(); }
      else if (e.code === 'ArrowDown' || e.code === 'KeyS') { flowMenuMove(F, 1); syncPause(); }
      else if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); pauseChoose(); }
      return;
    }
    if (e.code === 'Space') { if (F.mode === 'title') startGame(); else if (F.mode === 'clear') clearSkip(F.clear, P).forEach(onClearEvent); }
    else if (e.code === 'KeyR' && flowCanRestart(F)) restart();
  });
  // 確認用：状態の読み取りと、1 フレーム進める口。dropRock(size, x, z, warn?) = 指定位置へ今すぐ噴石を落とす（warn は着弾までの秒の上書き）。start() = タイトルから開始
  window.GAME = { G, P, M, F, KEYS, CFG, FXS, FXV, dino, WORLD, VOL, SND, RS, OB, OBS, ROCKS, MAG, HUD, CAVE, get fx() { return fx; },
    step: dt => { if (F.paused) pauseFrame(dt); else update(dt); WORLD.renderer.render(WORLD.scene, WORLD.camera); },
    restart, start: startGame, pause: doPause, toTitle, choose: pauseChoose, toggle: pauseToggle,
    dropRock: (size, x, z, warn) => spawnRock(RS, size, x, z, null, warn),
    dropRockOnDino: (size, warn) => { const w = warn || CFG.rock.sizes[size].warn; return spawnRock(RS, size, P.x, P.z - P.speed * w, null, warn); } };
  let last = performance.now();
  document.addEventListener('visibilitychange', () => { last = performance.now(); });   // タブに戻ったとき、離れていた時間ぶんの dt にならない
  (function loop(now) {
    const dt = Math.max(0, Math.min(CFG.dt.max, (now - last) / 1000)); last = now;   // 1 フレームの最大秒（タブ復帰時の飛び防止）
    if (F.paused) pauseFrame(dt);   // 一時停止中：ゲームは進めず、描画だけ続ける
    else if (fxHitstopStep(FXS, dt)) { /* hitstop: game time paused, rendering continues */ }
    else update(dt);
    WORLD.renderer.render(WORLD.scene, WORLD.camera);
    requestAnimationFrame(loop);
  })(last);
})();
