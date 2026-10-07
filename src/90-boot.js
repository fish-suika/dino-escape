// ===== 起動・メインループ =====
(function () {
  if (typeof THREE === 'undefined') { document.getElementById('hint').textContent = 'three.js を読み込めませんでした（ネット接続を確認してください）'; return; }
  buildWorld(); buildVolcano(); buildRocks(); buildMagma();
  const $boom = document.getElementById('boom'), $flash = document.getElementById('flash'), $scream = document.getElementById('scream');
  let erupted = false, fx = volcanoState(0);
  const dino = buildDino(); WORLD.scene.add(dino.group);
  const G = newGame(), P = G.P, M = G.M, RS = G.RS;   // 純ロジックの状態（リセット時も同じオブジェクトの中身を入れ替える）
  const $dist = document.getElementById('dist');
  let shown = -1;

  function showScream() { $scream.classList.remove('on'); void $scream.offsetWidth; $scream.classList.add('on'); }

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
    resetGame(G); erupted = false; fx = volcanoState(0); shown = -1;
    KEYS.left = KEYS.right = KEYS.jumpQ = false;
    resetRocks(); resetVolcano(); resetWorld(); resetMagmaView();
    dino.phase = 0; dino.air = 0; dino.group.visible = true;
    [$boom, $scream].forEach(el => el.classList.remove('on')); $flash.style.opacity = 0;
    sndMagmaUpdate(0);
  }

  function update(dt) {
    // 吹き飛び・起き上がり中は stepPlayer が入力を無視する。dead の間は stepGame が前進・操作・噴石の新規生成を止める
    const ev = stepGame(G, { left: KEYS.left, right: KEYS.right, jump: KEYS.jumpQ }, dt);
    KEYS.jumpQ = false;
    fx = volcanoState(P.time);
    syncRocks(RS, dt);
    ev.landed.forEach(l => { rockImpact(l.rock, l.hit); if (l.hit) { showScream(); sndScream(); } });
    if (ev.died) onDeath();
    updateRocksFx(dt);
    updateDino(dino, P, dt);
    updateWorld(P, dt);
    if (fx.state === 'erupting' && !erupted) { erupted = true; $boom.classList.add('on'); sndBoom(); }
    updateVolcano(P, dt, fx);
    updateMagma(P, M, dt);
    const gap = magmaGap(M, P), alive = M.phase === 'playing';
    sndUpdate(fx);
    sndMagmaUpdate(alive ? magmaProx(gap, CFG.magma.audibleRange) : Math.max(0, 0.6 - M.deadT * 0.3));
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
    if (alive && M.active) {   // マグマが近い：小刻みな地鳴りの揺れ（控えめ）
      const k = magmaProx(gap, CFG.magma.shakeRange), s = CFG.magma.shakeAmp * k * k;
      if (s > 0) { WORLD.camera.position.x += Math.sin(T * 97) * s; WORLD.camera.position.y += Math.cos(T * 89) * s * 0.8; }
    }
    const m = Math.floor(P.dist);
    if (m !== shown) { shown = m; $dist.textContent = '距離：' + m + 'm'; }
  }

  bindInput(); bindSound();
  addEventListener('keydown', e => { if (e.code === 'KeyR' && !e.repeat && M.phase === 'dead') restart(); });
  // 確認用：状態の読み取りと、1 フレーム進める口。dropRock(size, x, z, warn?) = 指定位置へ今すぐ噴石を落とす（warn は着弾までの秒の上書き）
  window.GAME = { G, P, M, KEYS, CFG, dino, WORLD, VOL, SND, RS, ROCKS, MAG, get fx() { return fx; },
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
