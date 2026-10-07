// ===== 起動・メインループ =====
(function () {
  if (typeof THREE === 'undefined') { document.getElementById('hint').textContent = 'three.js を読み込めませんでした（ネット接続を確認してください）'; return; }
  buildWorld();
  const dino = buildDino(); WORLD.scene.add(dino.group);
  const P = newPlayer();
  const $dist = document.getElementById('dist');
  let shown = -1;

  function update(dt) {
    stepPlayer(P, { left: KEYS.left, right: KEYS.right, jump: KEYS.jumpQ }, dt);
    KEYS.jumpQ = false;
    updateDino(dino, P, dt);
    updateWorld(P, dt);
    const m = Math.floor(P.dist);
    if (m !== shown) { shown = m; $dist.textContent = '距離：' + m + 'm'; }
  }

  bindInput();
  // 確認用：状態の読み取りと、1 フレーム進める口
  window.GAME = { P, KEYS, CFG, dino, WORLD, step: dt => { update(dt); WORLD.renderer.render(WORLD.scene, WORLD.camera); } };
  let last = performance.now();
  (function loop(now) {
    const dt = Math.max(0, Math.min(CFG.dt.max, (now - last) / 1000)); last = now;
    update(dt); WORLD.renderer.render(WORLD.scene, WORLD.camera);
    requestAnimationFrame(loop);
  })(last);
})();
