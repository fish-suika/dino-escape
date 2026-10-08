// ===== 純ロジック（three.js 非依存。verify.html でテスト） =====
function speedAt(t) { return Math.min(CFG.run.maxSpeed, CFG.run.baseSpeed + CFG.run.accel * t); }

// ---- レーン（3 本）：index 0 = 左 / 1 = 中 / 2 = 右 ----
function laneX(i) { const L = CFG.lane; return (i - (L.count - 1) / 2) * L.width; }
function laneNearest(x) { const L = CFG.lane; return Math.max(0, Math.min(L.count - 1, Math.round(x / L.width + (L.count - 1) / 2))); }

// state: run（操作可）/ knocked（吹き飛び中・操作不能）/ recover（起き上がり中・操作不能）
// lane = 目標のレーン（移動中は行き先）/ laneMove = 移動中か / laneFrom・laneT = 移動の出発 x と経過秒 / laneBuf = 移動中に来た入力 [{ dir, t }]
// sliding = 滑走中 / slideT = 滑走の残り秒 / slideCd = 次を出せるまでの秒 / slideBuf = 早押しの覚え秒 / dive = 空中で急降下中
function newPlayer() {
  return { x: 0, y: 0, z: 0, vx: 0, vy: 0, grounded: true, speed: CFG.run.baseSpeed, time: 0, dist: 0,
           lane: (CFG.lane.count - 1) >> 1, laneMove: false, laneFrom: 0, laneT: 0, laneBuf: [], sliding: false, slideT: 0, slideCd: 0, slideBuf: 0, dive: false,
           state: 'run', stateT: 0, knockT: 0, kvx: 0, kvf: 0, tumble: 0, spinRate: 0, power: 0, slow: 0, slowF: 1, invuln: 0, hits: 0, trips: 0, stumbleT: 0 };
}

function approach(v, target, amount) { return v < target ? Math.min(target, v + amount) : Math.max(target, v - amount); }

// 噴石が地面に着弾したとき、恐竜に当たるか（地上付近にいて、無敵でなく、操作可能な状態のときだけ）
function rockHitsPlayer(P, rx, rz, radius) {
  const H = CFG.hit;
  return P.state === 'run' && P.invuln <= 0 && P.y < H.maxY && Math.hypot(P.x - rx, P.z - rz) < radius + H.dinoR;
}

// 直撃：着弾中心から外向き＋上向き＋前方へ吹き飛ばす。size は 'small' | 'mid' | 'large'
function knockPlayer(P, rx, rz, size) {
  const H = CFG.hit, C = CFG.rock.sizes[size], pw = C.power, dx = P.x - rx;
  const dir = Math.abs(dx) > 0.25 ? Math.sign(dx) : (P.x > 0 ? -1 : 1);   // ほぼ真下なら、広く空いている側へ
  P.state = 'knocked'; P.stateT = 0; P.knockT = H.knockBase + H.knockPer * pw; P.power = pw;
  P.kvx = dir * H.kickSide * pw; P.kvf = H.kickFwd * pw;
  P.vx = 0; P.vy = H.kickUp * (0.6 + 0.4 * pw); P.y = Math.max(P.y, 0) + 0.01; P.grounded = false;
  P.tumble = 0; P.spinRate = -H.spin * (0.7 + 0.3 * pw);
  P.slow = C.slowSec; P.slowF = C.slowF; P.hits++;
  lanePlayerCancel(P);
  return true;
}

// 操作不能になるとき：レーン移動・入力の覚え・滑走をやめる（起き上がりで一番近いレーンへ戻る）
function lanePlayerCancel(P) {
  P.laneMove = false; P.laneBuf.length = 0; P.sliding = false; P.slideT = 0; P.slideBuf = 0; P.dive = false;
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
    P.state = 'recover'; P.stateT = 0; P.lane = laneNearest(P.x);
  }
  return H.knockMul;
}

// レーン移動を始める（dir = -1 左 / +1 右。目標のレーンから数える）。端で動けないなら false
function laneStart(P, dir) {
  const L = CFG.lane, to = P.lane + dir;
  if (to < 0 || to > L.count - 1) return false;
  P.laneFrom = P.x; P.lane = to; P.laneT = 0; P.laneMove = true;
  return true;
}
// レーン移動を 1 フレーム進める：入力（左右の「押した瞬間」）の受付・移動中の入力のバッファ・なめらかな補間
function stepLane(P, inp, dt) {
  const L = CFG.lane, dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0), x0 = P.x;
  for (let i = P.laneBuf.length - 1; i >= 0; i--) { P.laneBuf[i].t += dt; if (P.laneBuf[i].t > L.bufferSec) P.laneBuf.splice(i, 1); }
  if (dir !== 0) {
    if (P.laneMove) { P.laneBuf.push({ dir, t: 0 }); while (P.laneBuf.length > L.bufferMax) P.laneBuf.shift(); }
    else laneStart(P, dir);
  }
  if (P.laneMove) {
    P.laneT += dt;
    const to = laneX(P.lane), u = P.laneT / L.shiftSec;
    if (u >= 1) {
      P.x = to; P.laneMove = false;
      while (P.laneBuf.length && !P.laneMove) { const b = P.laneBuf.shift(); laneStart(P, b.dir); }   // 覚えていた入力を順に実行（端で動けないものは捨てる）
    } else P.x = P.laneFrom + (to - P.laneFrom) * smooth01(u);
  } else P.x = laneX(P.lane);
  P.vx = dt > 0 ? (P.x - x0) / dt : 0;
}

// くぐる（滑走）：地上で S / ↓。空中なら急降下して、着地したらすぐ滑走
function slideStart(P) { P.sliding = true; P.slideT = CFG.slide.sec; P.slideBuf = 0; }
function stepSlide(P, inp, dt) {
  const S = CFG.slide;
  if (P.slideCd > 0) P.slideCd = Math.max(0, P.slideCd - dt);
  if (P.slideBuf > 0) P.slideBuf = Math.max(0, P.slideBuf - dt);
  if (inp.slide) {
    if (!P.grounded) { if (P.y > 0.15) { P.dive = true; P.vy = Math.min(P.vy, -S.dive); } }
    else if (!P.sliding && P.slideCd <= 0) slideStart(P);
    else if (!P.sliding) P.slideBuf = S.buffer;   // クールダウン中に押した：終わったらすぐ出す
  }
  if (P.sliding) {
    P.slideT -= dt;
    if (P.slideT <= 0) { P.sliding = false; P.slideT = 0; P.slideCd = S.cooldown; }
  } else if (P.slideBuf > 0 && P.grounded && P.slideCd <= 0) slideStart(P);
}
// 当たり判定の高さ（滑走中は低い）
function playerHeight(P) { return P.sliding ? CFG.slide.slideH : CFG.slide.standH; }

// inp = { left, right, jump, slide }（すべて「押した瞬間」の 1 回分。押しっぱなしは無視）。P を直接更新する
function stepPlayer(P, inp, dt) {
  const J = CFG.jump, H = CFG.hit;
  if (P.invuln > 0) P.invuln = Math.max(0, P.invuln - dt);
  if (P.stumbleT > 0) P.stumbleT = Math.max(0, P.stumbleT - dt);
  let mul = 1;
  if (P.state === 'run') {
    stepLane(P, inp, dt);
    if (inp.jump && P.grounded) { P.vy = J.velocity; P.grounded = false; if (P.sliding) { P.sliding = false; P.slideT = 0; P.slideCd = CFG.slide.cooldown; } }   // ジャンプは滑走を打ち切る
    stepSlide(P, inp, dt);
    if (!P.grounded) {
      P.vy -= J.gravity * dt; P.y += P.vy * dt;
      if (P.y <= 0) { P.y = 0; P.vy = 0; P.grounded = true; if (P.dive) { P.dive = false; slideStart(P); } }   // 急降下で着地したら、すぐ滑走
    }
    if (P.slow > 0) {   // 直撃のあとしばらく遅い。最後の slowRamp 秒でなめらかに元の速さへ
      P.slow = Math.max(0, P.slow - dt);
      mul = P.slowF + (1 - P.slowF) * (1 - Math.min(1, P.slow / H.slowRamp));
    }
  } else if (P.state === 'knocked') {
    mul = stepKnocked(P, dt);
  } else {   // recover：立ち上がるまで操作不能。一番近いレーンの中心へ寄る
    P.stateT += dt; P.tumble *= Math.exp(-10 * dt); P.y = 0; P.vy = 0; P.grounded = true;
    const x0 = P.x; P.x += (laneX(P.lane) - P.x) * (1 - Math.exp(-14 * dt)); P.vx = dt > 0 ? (P.x - x0) / dt : 0;
    mul = H.recoverMul;
    if (P.stateT >= H.recoverSec) { P.state = 'run'; P.stateT = 0; P.tumble = 0; P.invuln = H.invulnSec; P.x = laneX(P.lane); P.vx = 0; P.laneMove = false; }
  }
  P.time += dt;
  P.speed = speedAt(P.time) * mul;
  P.dist += (P.speed + P.kvf) * dt;
  P.z = -P.dist;   // 前方は -z
}

// ジャンプの滞空時間と最高到達点（調整の目安）
function jumpStats() { const J = CFG.jump; return { air: 2 * J.velocity / J.gravity, peak: J.velocity * J.velocity / (2 * J.gravity) }; }
