// ===== 噴石の見た目：落下する燃える岩・危険マーカー・影・爆発・クレーター・画面揺れ（three.js） =====
// 状態（いつ・どこに落ちるか）は 26-rock-logic.js の S.rocks が持つ。ここは毎フレームそれを映すだけ。
const ROCKS = { shake: 0, frame: 0 };

function buildRocks() {
  const R = CFG.rock, scene = WORLD.scene, tex = makeSoftTexture();
  ROCKS.sparks = makeParticles(R.sparkMax, true, tex);
  ROCKS.dust = makeParticles(R.dustMax, false, tex);
  ROCKS.sparks.cursor = 0; ROCKS.dust.cursor = 0;
  scene.add(ROCKS.dust.pts, ROCKS.sparks.pts);

  // 共有ジオメトリ（半径1）。地面に貼るものは XY 平面で作り、親の回転で寝かせる
  const rockGeo = new THREE.DodecahedronGeometry(1, 1), rp = rockGeo.attributes.position;
  for (let i = 0; i < rp.count; i++) { const k = 1 + Math.sin(rp.getX(i) * 7.1 + rp.getY(i) * 3.3 + rp.getZ(i) * 5.7) * 0.13; rp.setXYZ(i, rp.getX(i) * k, rp.getY(i) * k, rp.getZ(i) * k); }
  rockGeo.computeVertexNormals();
  const ringGeo = new THREE.RingGeometry(0.9, 1, 48), discGeo = new THREE.CircleGeometry(1, 40);
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x2a1b17, emissive: 0xff4a10, emissiveIntensity: 0.65, flatShading: true });
  const glowMat = new THREE.SpriteMaterial({ map: tex, color: 0xff7a24, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0.85 });
  const flat = (geo, color, additive) => {
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
    m.rotation.x = -Math.PI / 2; m.visible = false; scene.add(m); return m;
  };
  ROCKS.flat = flat;

  ROCKS.slots = [];
  for (let i = 0; i < R.maxActive; i++) {
    const body = new THREE.Group(), mesh = new THREE.Mesh(rockGeo, rockMat), glow = new THREE.Sprite(glowMat);
    body.add(mesh, glow); body.visible = false; scene.add(body);
    ROCKS.slots.push({ id: 0, seen: 0, body, mesh, glow, acc: 0, acc2: 0,
      shadow: flat(discGeo, 0x000000), disc: flat(discGeo, 0xff1a0a), ring: flat(ringGeo, 0xff3a1a) });
  }
  ROCKS.byId = new Map();

  ROCKS.rings = []; for (let i = 0; i < R.ringMax; i++) ROCKS.rings.push({ t: 99, life: 0.5, R: 1, mesh: flat(ringGeo, 0xffc080, true) });
  ROCKS.craters = []; for (let i = 0; i < R.craterMax; i++) ROCKS.craters.push({ t: 99, R: 1, dark: flat(discGeo, 0x120a08), glow: flat(discGeo, 0xff5a14, true) });
  ROCKS.ringI = 0; ROCKS.craterI = 0;
}

// 粒を1つ出す（古いものから上書きするリングバッファ）。kind：火の粉＝無視 / 土煙＝0 茶 1 黒
function fxEmit(S, x, y, z, vx, vy, vz, life, size, alpha, kind) {
  const i = S.cursor = (S.cursor + 1) % S.max;
  S.age[i] = 0; S.life[i] = life; S.s0[i] = size; S.a0[i] = alpha; S.seed[i] = kind || 0;
  S.pos[i * 3] = x; S.pos[i * 3 + 1] = y; S.pos[i * 3 + 2] = z; S.vel[i * 3] = vx; S.vel[i * 3 + 1] = vy; S.vel[i * 3 + 2] = vz;
}

function fxStep(S, dt, spark) {
  const drag = Math.exp(-1.8 * dt);
  for (let i = 0; i < S.max; i++) {
    if (S.age[i] >= S.life[i]) { S.alpha[i] = 0; continue; }
    S.age[i] += dt; const f = Math.min(1, S.age[i] / S.life[i]), j = i * 3;
    if (spark) {
      S.vel[j + 1] -= 22 * dt;
      S.pos[j] += S.vel[j] * dt; S.pos[j + 1] += S.vel[j + 1] * dt; S.pos[j + 2] += S.vel[j + 2] * dt;
      if (S.pos[j + 1] < 0.05) { S.pos[j + 1] = 0.05; S.vel[j + 1] *= -0.3; S.vel[j] *= 0.6; S.vel[j + 2] *= 0.6; }
      S.size[i] = S.s0[i] * (1 - 0.6 * f); S.alpha[i] = S.a0[i] * (1 - f) * (1 - f);
      S.col[j] = 1; S.col[j + 1] = 0.8 - 0.55 * f; S.col[j + 2] = 0.3 - 0.25 * f;
    } else {
      S.vel[j] *= drag; S.vel[j + 1] = S.vel[j + 1] * drag + 1.5 * dt; S.vel[j + 2] *= drag;
      S.pos[j] += S.vel[j] * dt; S.pos[j + 1] += S.vel[j + 1] * dt; S.pos[j + 2] += S.vel[j + 2] * dt;
      S.size[i] = S.s0[i] * (0.5 + f * 1.6); S.alpha[i] = S.a0[i] * Math.min(1, f * 10) * (1 - f);
      const dark = S.seed[i] > 0.5; S.col[j] = dark ? 0.13 : 0.36; S.col[j + 1] = dark ? 0.11 : 0.28; S.col[j + 2] = dark ? 0.1 : 0.22;
    }
  }
}

function rockSlotFor(r) {
  let sl = ROCKS.byId.get(r.id);
  if (sl) return sl;
  sl = ROCKS.slots.find(s => !s.id); if (!sl) return null;
  sl.id = r.id; ROCKS.byId.set(r.id, sl);
  const v = r.vis; sl.body.scale.setScalar(v); sl.glow.scale.setScalar(4.2);
  sl.mesh.rotation.set(Math.random() * 6, Math.random() * 6, Math.random() * 6); sl.spin = [rnd(-4, 4), rnd(-4, 4), rnd(-3, 3)];
  sl.body.visible = true; sl.shadow.visible = sl.disc.visible = sl.ring.visible = true;
  sndRockFall(r.warn - r.t, r.size);
  return sl;
}

function rockRelease(sl) {
  ROCKS.byId.delete(sl.id); sl.id = 0;
  sl.body.visible = sl.shadow.visible = sl.disc.visible = sl.ring.visible = false;
}

// 飛行中の噴石・危険マーカー・影を映す。毎フレーム呼ぶ
function syncRocks(S, dt) {
  ROCKS.frame++; const T = VOL.t;
  for (const r of S.rocks) {
    const sl = rockSlotFor(r); if (!sl) continue;
    sl.seen = ROCKS.frame;
    const p = rockPos(r), u = p.u, big = r.size === 'large', rad = r.radius;
    sl.body.position.set(p.x, p.y + r.vis * 0.9, p.z);
    sl.mesh.rotation.x += sl.spin[0] * dt; sl.mesh.rotation.y += sl.spin[1] * dt; sl.mesh.rotation.z += sl.spin[2] * dt;
    // 危険マーカー：内側の赤い円が時間とともに濃くなり、脈動も速くなる
    const pulse = 0.5 + 0.5 * Math.sin(T * (9 + 16 * u));
    sl.ring.position.set(r.x, 0.07, r.z); sl.ring.scale.set(rad * (1 + 0.025 * pulse), rad * (1 + 0.025 * pulse), 1); sl.ring.material.opacity = 0.65 + 0.35 * pulse;
    sl.disc.position.set(r.x, 0.06, r.z); sl.disc.scale.set(rad, rad, 1); sl.disc.material.opacity = 0.1 + 0.3 * u + 0.1 * pulse * u;
    // 影：高い所では小さく薄く、落ちてくるほど広がって濃くなる（大型は着弾範囲いっぱいに覆いかぶさる）
    const sMax = big ? rad * 1.15 : r.vis * 2.2, sg = 0.2 + 0.8 * u;
    sl.shadow.position.set(r.x, 0.05, r.z); sl.shadow.scale.set(sMax * sg, sMax * sg, 1); sl.shadow.material.opacity = (big ? 0.2 + 0.4 * u : 0.1 + 0.25 * u);
    // 尾を引く火の粉と煙
    sl.acc += dt * (70 + 30 * r.vis); sl.acc2 += dt * 28;
    const px = p.x, py = p.y + r.vis * 0.9, pz = p.z, spread = 2 + r.vis * 2;
    while (sl.acc >= 1) { sl.acc -= 1; fxEmit(ROCKS.sparks, px + rnd(-1, 1) * r.vis * 0.6, py + rnd(-1, 1) * r.vis * 0.6, pz + rnd(-1, 1) * r.vis * 0.6, rnd(-spread, spread) + r.ox * 0.25, rnd(2, 8), rnd(-spread, spread) + r.oz * 0.25, rnd(0.35, 0.7), rnd(0.9, 1.7) * (0.6 + r.vis * 0.5), 1, 0); }
    while (sl.acc2 >= 1) { sl.acc2 -= 1; fxEmit(ROCKS.dust, px, py, pz, rnd(-1.5, 1.5), rnd(0, 3), rnd(-1.5, 1.5), rnd(0.8, 1.3), (2 + r.vis * 2.2), 0.55, 1); }
  }
  for (const sl of ROCKS.slots) if (sl.id && sl.seen !== ROCKS.frame) rockRelease(sl);
}

// 着弾：爆発（火花・土煙・衝撃波）・クレーター跡・画面揺れ・音
function rockImpact(r, hit) {
  const R = CFG.rock, C = R.sizes[r.size], v = r.vis;
  const nS = Math.round(24 + v * 16), nD = Math.round(14 + v * 10);
  for (let i = 0; i < nS; i++) {
    const a = rnd(0, 6.283), up = rnd(0.35, 1), sp = rnd(6, 18) * (0.6 + v * 0.3);
    fxEmit(ROCKS.sparks, r.x, 0.3, r.z, Math.cos(a) * sp * (1 - up * 0.4), up * sp * 1.1, Math.sin(a) * sp * (1 - up * 0.4), rnd(0.6, 1.2), rnd(1.4, 3) * (0.6 + v * 0.4), 1, 0);
  }
  for (let i = 0; i < nD; i++) {
    const a = rnd(0, 6.283), sp = rnd(4, 10) * (0.7 + v * 0.2);
    fxEmit(ROCKS.dust, r.x + Math.cos(a) * v, 0.4, r.z + Math.sin(a) * v, Math.cos(a) * sp, rnd(0.5, 3.5), Math.sin(a) * sp, rnd(1.1, 2), (2.5 + v * 2.2) * rnd(0.8, 1.3), 0.7, i % 3 === 0 ? 1 : 0);
  }
  const rg = ROCKS.rings[ROCKS.ringI]; ROCKS.ringI = (ROCKS.ringI + 1) % ROCKS.rings.length;
  rg.t = 0; rg.life = 0.35 + v * 0.1; rg.R = C.radius * 1.5; rg.mesh.position.set(r.x, 0.1, r.z); rg.mesh.visible = true;
  const cr = ROCKS.craters[ROCKS.craterI]; ROCKS.craterI = (ROCKS.craterI + 1) % ROCKS.craters.length;
  cr.t = 0; cr.R = v * 1.25; cr.dark.position.set(r.x, 0.045, r.z); cr.glow.position.set(r.x, 0.055, r.z); cr.dark.visible = cr.glow.visible = true;
  ROCKS.shake = Math.max(ROCKS.shake, C.shake);
  sndRockImpact(r.size);
}

function updateRocksFx(dt) {
  const R = CFG.rock;
  fxStep(ROCKS.sparks, dt, true); fxStep(ROCKS.dust, dt, false); pflush(ROCKS.sparks); pflush(ROCKS.dust);
  for (const g of ROCKS.rings) {
    if (g.t > g.life) { g.mesh.visible = false; continue; }
    g.t += dt; const f = Math.min(1, g.t / g.life), s = g.R * (0.25 + 0.75 * (1 - (1 - f) * (1 - f)));
    g.mesh.scale.set(s, s, 1); g.mesh.material.opacity = 0.9 * (1 - f);
  }
  for (const c of ROCKS.craters) {
    if (c.t > R.craterLife) { c.dark.visible = c.glow.visible = false; continue; }
    c.t += dt; const f = c.t / R.craterLife;
    c.dark.scale.set(c.R, c.R, 1); c.dark.material.opacity = 0.6 * Math.min(1, (1 - f) * 3.5);
    const gf = Math.max(0, 1 - c.t / 1.0); c.glow.scale.set(c.R * 0.8, c.R * 0.8, 1); c.glow.material.opacity = 0.7 * gf * gf;
    if (gf <= 0) c.glow.visible = false;
  }
  ROCKS.shake *= Math.exp(-R.shakeDecay * dt); if (ROCKS.shake < 0.004) ROCKS.shake = 0;
}

// 再スタート用：飛行中の噴石・火の粉・土煙・衝撃波・クレーター跡・揺れをすべて消す
function resetRocks() {
  for (const sl of ROCKS.slots) if (sl.id) rockRelease(sl);
  ROCKS.byId.clear(); ROCKS.shake = 0; ROCKS.frame = 0;
  [ROCKS.sparks, ROCKS.dust].forEach(S => { S.age.fill(1e9); S.alpha.fill(0); S.cursor = 0; pflush(S); });
  ROCKS.rings.forEach(g => { g.t = 99; g.mesh.visible = false; });
  ROCKS.craters.forEach(c => { c.t = 99; c.dark.visible = c.glow.visible = false; });
}
