// ===== 起動・メインループ =====
(function () {
  if (typeof THREE === 'undefined') { document.getElementById('hint').textContent = 'three.js を読み込めませんでした（ネット接続を確認してください）'; return; }
  buildWorld(); buildVolcano();
  const $boom = document.getElementById('boom'), $flash = document.getElementById('flash');
  let erupted = false, fx = volcanoState(0);
  const dino = buildDino(); WORLD.scene.add(dino.group);
  const P = newPlayer();
  const $dist = document.getElementById('dist');
  let shown = -1;

  function update(dt) {
    stepPlayer(P, { left: KEYS.left, right: KEYS.right, jump: KEYS.jumpQ }, dt);
    KEYS.jumpQ = false;
    updateDino(dino, P, dt);
    updateWorld(P, dt);
    fx = volcanoState(P.time);
    if (fx.state === 'erupting' && !erupted) { erupted = true; $boom.classList.add('on'); sndBoom(); }
    updateVolcano(P, dt, fx);
    sndUpdate(fx);
    $flash.style.opacity = fx.flash;
    if (fx.shake > 0) {   // 控えめな画面揺れ（カメラ位置だけ。向きは変えない）
      WORLD.camera.position.x += Math.sin(P.time * 61) * fx.shake;
      WORLD.camera.position.y += Math.cos(P.time * 47) * fx.shake * 0.8;
    }
    const m = Math.floor(P.dist);
    if (m !== shown) { shown = m; $dist.textContent = '距離：' + m + 'm'; }
  }

  bindInput(); bindSound();
  // 確認用：状態の読み取りと、1 フレーム進める口
  window.GAME = { P, KEYS, CFG, dino, WORLD, VOL, SND, get fx() { return fx; }, step: dt => { update(dt); WORLD.renderer.render(WORLD.scene, WORLD.camera); } };
  let last = performance.now();
  (function loop(now) {
    const dt = Math.max(0, Math.min(CFG.dt.max, (now - last) / 1000)); last = now;
    update(dt); WORLD.renderer.render(WORLD.scene, WORLD.camera);
    requestAnimationFrame(loop);
  })(last);
})();
