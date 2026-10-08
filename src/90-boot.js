// ===== 起動・メインループ =====
(function () {
  if (typeof THREE === 'undefined') { document.getElementById('hint').textContent = 'three.js を読み込めませんでした（ネット接続を確認してください）'; return; }
  buildWorld(); buildVolcano(); buildRocks(); buildMagma(); buildObstacles();
  const $boom = document.getElementById('boom'), $flash = document.getElementById('flash'), $scream = document.getElementById('scream');
  const $oops = document.getElementById("oops");
  let erupted = false, fx = volcanoState(0);
  const dino = buildDino(); WORLD.scene.add(dino.group);
  const G = newGame(), P = G.P, M = G.M, RS = G.RS, OB = G.OB;
  const newSeed = () => (Math.random() * 2147483647) | 0;
  OB.seed = newSeed();   // 障害物の配置の種（毎回変わる。リセット時も新しくする）
  const $dist = document.getElementById('dist'), $danger = document.getElementById('danger'), $clear = document.getElementById('clear'), $clearDist = document.getElementById('clearDist');
  let shownDanger = -1;
  let shown = -1;

  function showScream() { $scream.classList.remove('on'); void $scream.offsetWidth; $scream.classList.add('on'); }

  function showOops() { $oops.style.animationDuration = CFG.obstacle.oopsSec + 's'; $oops.classList.remove('on'); void $oops.offsetWidth; $oops.classList.add('on'); }

  // 障害物にぶつかった：ドン！・うわっ！・土煙・軽い揺れ（クレーターは弱いつまずきなので文字なし・小さめ）
  function onObstacleHit(h) {
    const O = CFG.obstacle, ob = h.ob, trip = h.kind === 'trip', pool = ob.type === 'pool', T = pool ? O.poolTrip : O.trip;
    sndThud(trip ? (pool ? 1 : 0.8) : 0.35, pool);
    if (trip) { showOops(); ROCKS.shake = Math.max(ROCKS.shake, T.shake); }
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

  // R：全状態を初期化して最初から（噴火・噴石・マグマ・恐竜・揺れ・フラッシュ・音・粒子）。オブジェクトは作り直さない
  function restart() {
    resetGame(G, newSeed()); erupted = false; fx = volcanoState(0); shown = -1;
    KEYS.left = KEYS.right = KEYS.jumpQ = false;
    resetRocks(); resetObstaclesView(); resetVolcano(); resetWorld(); resetMagmaView();
    dino.phase = 0; dino.air = 0; dino.group.visible = true;
    [$boom, $scream, $oops].forEach(el => el.classList.remove('on')); $clear.classList.remove('on'); shownDanger = -1; $flash.style.opacity = 0;
    sndMagmaUpdate(0);
  }

  function update(dt) {
    // 吹き飛び・起き上がり中は stepPlayer が入力を無視する。dead の間は stepGame が前進・操作・噴石の新規生成を止める
    const ev = stepGame(G, { left: KEYS.left, right: KEYS.right, jump: KEYS.jumpQ }, dt);
    KEYS.jumpQ = false;
    fx = volcanoState(P.time);
    const dif = difficultyAt(P.time - CFG.volcano.eruptDelay), em = eruptionMul(dif.s);   // 難易度：噴火の迫力は強度とともに最大へ
    if (fx.state === 'erupting') { fx.k *= em; fx.smoke *= em; }
    syncRocks(RS, dt); syncObstacles(OB, dt);
    ev.obstacle.hits.forEach(onObstacleHit);
    ev.landed.forEach(l => { rockImpact(l.rock, l.hit); if (l.hit) { showScream(); sndScream(); } });
    if (ev.died) onDeath();
    updateRocksFx(dt);
    updateDino(dino, P, dt);
    updateWorld(P, dt);
    if (fx.state === 'erupting' && !erupted) { erupted = true; $boom.classList.add('on'); sndBoom(); }
    updateVolcano(P, dt, fx);
    updateMagma(P, M, dt);
    const gap = magmaGap(M, P), alive = M.phase === 'playing';
    if (dif.stage !== shownDanger) { shownDanger = dif.stage; $danger.textContent = '危険度：' + dif.label; $danger.className = 'd' + dif.stage; }
    if (M.phase === 'clear' && M.clearT > 0.8 && !$clear.classList.contains('on')) { $clearDist.textContent = '逃走距離：' + Math.floor(P.dist) + 'm'; $clear.classList.add('on'); }
    sndUpdate(fx);
    sndMagmaUpdate(alive ? magmaProx(gap, CFG.magma.audibleRange) : M.phase === 'clear' ? 0 : Math.max(0, 0.6 - M.deadT * 0.3));
    $flash.style.opacity = fx.flash;
    const T = VOL.t;   // 揺れの位相（P.time は死亡で止まるので別の時計を使う）
    if (fx.shake > 0) {   // 控えめな画面揺れ（カメラ位置だけ。向きは変えない）
      WORLD.camera.position.x += Math.sin(T * 61) * fx.shake;
      WORLD.camera.position.y += Math.cos(T * 47) * fx.shake * 0.8;
    }
    if (ROCKS.shake > 0) {   // 噴石着弾の揺れ（位置のみ。大型は強め・中型は弱め）
      WORLD.camera.position.x += Math.sin(T * 83) * ROCKS.shake;
      WORLD.camera.position.y += Math.cos(T * 71) * ROCKS.shake * 0.8;
    }
    if (alive && dif.e > CFG.difficulty.shake.from) {   // 最終逃走：画面全体の常時の小刻みな揺れ（位置のみ・控えめ）
      const fs = finalShake(dif.e);
      WORLD.camera.position.x += Math.sin(T * 53) * fs; WORLD.camera.position.y += Math.cos(T * 67) * fs * 0.8;
    }
    if (alive && M.active) {   // マグマが近い：小刻みな地鳴りの揺れ（控えめ）
      const k = magmaProx(gap, CFG.magma.shakeRange), s = CFG.magma.shakeAmp * k * k;
      if (s > 0) { WORLD.camera.position.x += Math.sin(T * 97) * s; WORLD.camera.position.y += Math.cos(T * 89) * s * 0.8; }
    }
    const m = Math.floor(P.dist);
    if (m !== shown) { shown = m; $dist.textContent = '距離：' + m + 'm'; }
  }

  bindInput(); bindSound();
  addEventListener('keydown', e => { if (e.code === 'KeyR' && !e.repeat && M.phase !== 'playing') restart(); });
  // 確認用：状態の読み取りと、1 フレーム進める口。dropRock(size, x, z, warn?) = 指定位置へ今すぐ噴石を落とす（warn は着弾までの秒の上書き）
  window.GAME = { G, P, M, KEYS, CFG, dino, WORLD, VOL, SND, RS, OB, OBS, ROCKS, MAG, get fx() { return fx; },
    step: dt => { update(dt); WORLD.renderer.render(WORLD.scene, WORLD.camera); },
    restart,
    dropRock: (size, x, z, warn) => spawnRock(RS, size, x, z, null, warn),
    dropRockOnDino: (size, warn) => { const w = warn || CFG.rock.sizes[size].warn; return spawnRock(RS, size, P.x, P.z - P.speed * w, null, warn); } };
  let last = performance.now();
  (function loop(now) {
    const dt = Math.max(0, Math.min(CFG.dt.max, (now - last) / 1000)); last = now;
    update(dt); WORLD.renderer.render(WORLD.scene, WORLD.camera);
    requestAnimationFrame(loop);
  })(last);
})();
