// ===== 起動・メインループ =====
(function () {
  if (typeof THREE === 'undefined') { document.getElementById('hint').textContent = 'three.js を読み込めませんでした（ネット接続を確認してください）'; return; }
  buildWorld(); buildVolcano(); buildRocks();
  const $boom = document.getElementById('boom'), $flash = document.getElementById('flash'), $scream = document.getElementById('scream');
  let erupted = false, fx = volcanoState(0);
  const dino = buildDino(); WORLD.scene.add(dino.group);
  const P = newPlayer(), RS = newRockSched();
  const $dist = document.getElementById('dist');
  let shown = -1;

  function showScream() { $scream.classList.remove('on'); void $scream.offsetWidth; $scream.classList.add('on'); }

  function update(dt) {
    // 吹き飛び・起き上がり中は stepPlayer が入力を無視する
    stepPlayer(P, { left: KEYS.left, right: KEYS.right, jump: KEYS.jumpQ }, dt);
    KEYS.jumpQ = false;
    fx = volcanoState(P.time);
    const ev = stepRocks(RS, P, dt, fx.state === 'erupting');   // 噴火後だけ噴石が降る。着弾で直撃判定
    syncRocks(RS, dt);
    ev.landed.forEach(l => { rockImpact(l.rock, l.hit); if (l.hit) { showScream(); sndScream(); } });
    updateRocksFx(dt);
    updateDino(dino, P, dt);
    updateWorld(P, dt);
    if (fx.state === 'erupting' && !erupted) { erupted = true; $boom.classList.add('on'); sndBoom(); }
    updateVolcano(P, dt, fx);
    sndUpdate(fx);
    $flash.style.opacity = fx.flash;
    if (fx.shake > 0) {   // 控えめな画面揺れ（カメラ位置だけ。向きは変えない）
      WORLD.camera.position.x += Math.sin(P.time * 61) * fx.shake;
      WORLD.camera.position.y += Math.cos(P.time * 47) * fx.shake * 0.8;
    }
    if (ROCKS.shake > 0) {   // 噴石着弾の揺れ（位置のみ。大型は強め・中型は弱め）
      WORLD.camera.position.x += Math.sin(P.time * 83) * ROCKS.shake;
      WORLD.camera.position.y += Math.cos(P.time * 71) * ROCKS.shake * 0.8;
    }
    const m = Math.floor(P.dist);
    if (m !== shown) { shown = m; $dist.textContent = '距離：' + m + 'm'; }
  }

  bindInput(); bindSound();
  // 確認用：状態の読み取りと、1 フレーム進める口。dropRock(size, x, z, warn?) = 指定位置へ今すぐ噴石を落とす（warn は着弾までの秒の上書き）
  window.GAME = { P, KEYS, CFG, dino, WORLD, VOL, SND, RS, ROCKS, get fx() { return fx; },
    step: dt => { update(dt); WORLD.renderer.render(WORLD.scene, WORLD.camera); },
    dropRock: (size, x, z, warn) => spawnRock(RS, size, x, z, null, warn),
    dropRockOnDino: (size, warn) => { const w = warn || CFG.rock.sizes[size].warn; return spawnRock(RS, size, P.x, P.z - P.speed * w, null, warn); } };
  let last = performance.now();
  (function loop(now) {
    const dt = Math.max(0, Math.min(CFG.dt.max, (now - last) / 1000)); last = now;
    update(dt); WORLD.renderer.render(WORLD.scene, WORLD.camera);
    requestAnimationFrame(loop);
  })(last);
})();
