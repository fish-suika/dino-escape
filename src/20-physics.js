// ===== 純ロジック（three.js 非依存。verify.html でテスト） =====
function speedAt(t) { return Math.min(CFG.run.maxSpeed, CFG.run.baseSpeed + CFG.run.accel * t); }

// state: run（操作可）/ knocked（吹き飛び中・操作不能）/ recover（起き上がり中・操作不能）
function newPlayer() {
  return { x: 0, y: 0, z: 0, vx: 0, vy: 0, grounded: true, speed: CFG.run.baseSpeed, time: 0, dist: 0,
           state: 'run', stateT: 0, knockT: 0, kvx: 0, kvf: 0, tumble: 0, spinRate: 0, power: 0, slow: 0, invuln: 0, hits: 0 };
}

function approach(v, target, amount) { return v < target ? Math.min(target, v + amount) : Math.max(target, v - amount); }

// 噴石が地面に着弾したとき、恐竜に当たるか（地上付近にいて、無敵でなく、操作可能な状態のときだけ）
function rockHitsPlayer(P, rx, rz, radius) {
  const H = CFG.hit;
  return P.state === 'run' && P.invuln <= 0 && P.y < H.maxY && Math.hypot(P.x - rx, P.z - rz) < radius + H.dinoR;
}

// 直撃：着弾中心から外向き＋上向き＋前方へ吹き飛ばす。size は 'small' | 'mid' | 'large'
function knockPlayer(P, rx, rz, size) {
  const H = CFG.hit, pw = CFG.rock.sizes[size].power, dx = P.x - rx;
  const dir = Math.abs(dx) > 0.25 ? Math.sign(dx) : (P.x > 0 ? -1 : 1);   // ほぼ真下なら、広く空いている側へ
  P.state = 'knocked'; P.stateT = 0; P.knockT = H.knockBase + H.knockPer * pw; P.power = pw;
  P.kvx = dir * H.kickSide * pw; P.kvf = H.kickFwd * pw;
  P.vx = 0; P.vy = H.kickUp * (0.6 + 0.4 * pw); P.y = Math.max(P.y, 0) + 0.01; P.grounded = false;
  P.tumble = 0; P.spinRate = -H.spin * (0.7 + 0.3 * pw);
  P.slow = H.slowSec * (0.5 + 0.5 * pw); P.hits++;
  return true;
}

function stepKnocked(P, dt) {
  const H = CFG.hit, M = CFG.move;
  P.stateT += dt;
  P.x += P.kvx * dt;
  if (P.x > M.maxX) { P.x = M.maxX; P.kvx = -Math.abs(P.kvx) * 0.4; }
  if (P.x < -M.maxX) { P.x = -M.maxX; P.kvx = Math.abs(P.kvx) * 0.4; }
  P.vy -= CFG.jump.gravity * dt; P.y += P.vy * dt;
  if (P.y <= 0) {
    P.y = 0;
    if (P.vy < -H.bounceMin) { P.vy = -P.vy * H.bounce; P.grounded = false; } else { P.vy = 0; P.grounded = true; }
  }
  const drag = Math.exp(-(P.grounded ? H.friction : 0.5) * dt);
  P.kvx *= drag; P.kvf *= drag;
  P.tumble += P.spinRate * dt * (P.grounded ? 0.3 : 1);
  if (P.stateT >= P.knockT && (P.grounded || P.stateT >= P.knockT + 0.5)) {   // 吹き飛び終わり → 起き上がり
    P.y = 0; P.vy = 0; P.grounded = true; P.kvx = 0; P.kvf = 0; P.vx = 0;
    const TAU = Math.PI * 2; P.tumble -= TAU * Math.round(P.tumble / TAU);   // 一番近い「立ち姿」へ（見た目の巻き戻りを最小に）
    P.state = 'recover'; P.stateT = 0;
  }
  return H.knockMul;
}

// inp = { left, right, jump }（jump は「押した瞬間」の 1 回分）。P を直接更新する
function stepPlayer(P, inp, dt) {
  const M = CFG.move, J = CFG.jump, H = CFG.hit;
  if (P.invuln > 0) P.invuln = Math.max(0, P.invuln - dt);
  let mul = 1;
  if (P.state === 'run') {
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
    if (P.slow > 0) {   // 直撃のあとしばらく遅い。最後の slowRamp 秒でなめらかに元の速さへ
      P.slow = Math.max(0, P.slow - dt);
      mul = H.slowFactor + (1 - H.slowFactor) * (1 - Math.min(1, P.slow / H.slowRamp));
    }
  } else if (P.state === 'knocked') {
    mul = stepKnocked(P, dt);
  } else {   // recover：立ち上がるまで操作不能
    P.stateT += dt; P.tumble *= Math.exp(-10 * dt); P.vx = 0; P.y = 0; P.vy = 0; P.grounded = true;
    mul = H.recoverMul;
    if (P.stateT >= H.recoverSec) { P.state = 'run'; P.stateT = 0; P.tumble = 0; P.invuln = H.invulnSec; }
  }
  P.time += dt;
  P.speed = speedAt(P.time) * mul;
  P.dist += (P.speed + P.kvf) * dt;
  P.z = -P.dist;   // 前方は -z
}

// ジャンプの滞空時間と最高到達点（調整の目安）
function jumpStats() { const J = CFG.jump; return { air: 2 * J.velocity / J.gravity, peak: J.velocity * J.velocity / (2 * J.gravity) }; }
