// ===== 純ロジック（three.js 非依存。verify.html でテスト） =====
function speedAt(t) { return Math.min(CFG.run.maxSpeed, CFG.run.baseSpeed + CFG.run.accel * t); }

function newPlayer() { return { x: 0, y: 0, z: 0, vx: 0, vy: 0, grounded: true, speed: CFG.run.baseSpeed, time: 0, dist: 0 }; }

function approach(v, target, amount) { return v < target ? Math.min(target, v + amount) : Math.max(target, v - amount); }

// inp = { left, right, jump }（jump は「押した瞬間」の 1 回分）。P を直接更新する
function stepPlayer(P, inp, dt) {
  const M = CFG.move, J = CFG.jump;
  const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
  const air = !P.grounded;
  if (dir !== 0) P.vx = approach(P.vx, dir * M.maxSpeed, M.accel * (air ? M.airAccelMul : 1) * dt);
  else P.vx = approach(P.vx, 0, M.decel * (air ? M.airDecelMul : 1) * dt);
  P.x += P.vx * dt;
  if (P.x > M.maxX) { P.x = M.maxX; if (P.vx > 0) P.vx = 0; }
  if (P.x < -M.maxX) { P.x = -M.maxX; if (P.vx < 0) P.vx = 0; }
  if (inp.jump && P.grounded) { P.vy = J.velocity; P.grounded = false; }
  if (!P.grounded) {
    P.vy -= J.gravity * dt; P.y += P.vy * dt;
    if (P.y <= 0) { P.y = 0; P.vy = 0; P.grounded = true; }
  }
  P.time += dt;
  P.speed = speedAt(P.time);
  P.dist += P.speed * dt;
  P.z = -P.dist;   // 前方は -z
}

// ジャンプの滞空時間と最高到達点（調整の目安）
function jumpStats() { const J = CFG.jump; return { air: 2 * J.velocity / J.gravity, peak: J.velocity * J.velocity / (2 * J.gravity) }; }
