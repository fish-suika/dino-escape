// ===== 火山：モデル・煙・火・火山灰・空の変化（three.js） =====
const VOL = {};

function makeSoftTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d'), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.45, 'rgba(255,255,255,0.55)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}

// 粒ごとにサイズ・透明度・色を持てる Points
function makeParticles(max, additive, tex) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(max * 3), size = new Float32Array(max), alpha = new Float32Array(max), col = new Float32Array(max * 3);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
  geo.setAttribute('aAlpha', new THREE.BufferAttribute(alpha, 1));
  geo.setAttribute('aColor', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.ShaderMaterial({
    uniforms: { map: { value: tex }, scaleU: VOL.scaleU },
    vertexShader: 'attribute float aSize;attribute float aAlpha;attribute vec3 aColor;uniform float scaleU;varying float vA;varying vec3 vC;' +
      'void main(){vec4 mv=modelViewMatrix*vec4(position,1.0);gl_PointSize=min(420.0,aSize*scaleU/max(0.1,-mv.z));gl_Position=projectionMatrix*mv;vA=aAlpha;vC=aColor;}',
    fragmentShader: 'uniform sampler2D map;varying float vA;varying vec3 vC;void main(){float a=texture2D(map,gl_PointCoord).a*vA;if(a<0.003)discard;gl_FragColor=vec4(vC,a);}',
    transparent: true, depthWrite: false, blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending
  });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false;
  return { pts, geo, pos, size, alpha, col, max, age: new Float32Array(max).fill(1e9), life: new Float32Array(max).fill(1), vel: new Float32Array(max * 3), a0: new Float32Array(max), s0: new Float32Array(max), seed: new Float32Array(max), budget: 0 };
}
function pflush(P) { ['position', 'aSize', 'aAlpha', 'aColor'].forEach(n => { P.geo.attributes[n].needsUpdate = true; }); }

function buildVolcano() {
  const V = CFG.volcano, scene = WORLD.scene;
  VOL.scaleU = { value: 360 };
  const tex = makeSoftTexture();
  const group = new THREE.Group(); scene.add(group);   // プレイヤーの z に追従するフレーム
  VOL.group = group;

  // 山本体：先を切った円錐。頂点をゆらして岩肌っぽく
  const cg = new THREE.CylinderGeometry(V.craterR, V.radius, V.height, 22, 4, true);
  const p = cg.attributes.position;
  for (let i = 0; i < p.count; i++) { if (p.getY(i) < V.height / 2 - 0.5) { p.setX(i, p.getX(i) * (1 + Math.sin(i * 12.9) * 0.06)); p.setZ(i, p.getZ(i) * (1 + Math.cos(i * 7.3) * 0.06)); } }
  cg.computeVertexNormals();
  const mountG = new THREE.Group(); mountG.position.y = V.height / 2;
  mountG.add(new THREE.Mesh(cg, new THREE.MeshLambertMaterial({ color: 0x2b1e1b, flatShading: true, fog: false })));
  // 溶岩の筋（火口縁から斜面に沿って流れる）
  const alpha = Math.atan((V.radius - V.craterR) / V.height), slant = Math.hypot(V.radius - V.craterR, V.height);
  const lavaMat = new THREE.MeshBasicMaterial({ color: 0xff5a14, fog: false, side: THREE.DoubleSide });
  for (let i = 0; i < 9; i++) {
    const g = new THREE.Group(); g.rotation.y = i / 9 * Math.PI * 2 + Math.sin(i * 3.1) * 0.2;
    const len = slant * (0.45 + 0.5 * Math.abs(Math.sin(i * 5.7)));
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.5 + 2 * Math.abs(Math.cos(i * 2.3)), len), lavaMat);
    m.position.set(0, V.height - Math.cos(alpha) * len / 2 - V.height / 2, V.craterR + Math.sin(alpha) * len / 2 + 0.4);
    m.rotation.x = -alpha; g.add(m); mountG.add(g);
  }
  // 火口の光
  const crater = new THREE.Mesh(new THREE.CircleGeometry(V.craterR, 20), new THREE.MeshBasicMaterial({ color: 0xff6a1a, fog: false }));
  crater.rotation.x = -Math.PI / 2; crater.position.y = V.height + 0.2;
  const vg = new THREE.Group(); vg.add(mountG, crater); group.add(vg); VOL.vg = vg;
  VOL.craterY = V.height;

  // パーティクル
  VOL.smoke = makeParticles(V.smokeMax, false, tex);
  VOL.fire = makeParticles(V.fireMax, true, tex);
  VOL.ash = makeParticles(V.ashMax, false, tex);
  VOL.ember = makeParticles(V.emberMax, true, tex);
  VOL.canopy = makeParticles(V.canopyMax, false, tex);   // 空に広がる噴煙の天井（カメラは後ろを向かないので、前方の空の高い所にかぶせる）
  [VOL.smoke, VOL.fire, VOL.ash, VOL.ember, VOL.canopy].forEach(s => group.add(s.pts));
  { const S = VOL.canopy; for (let i = 0; i < S.max; i++) {
    const d = rnd(70, 300), el = rnd(0.12, 0.46);   // 手前からの距離 / 仰角（ラジアン）
    S.pos[i * 3] = rnd(-1, 1) * d * 1.1; S.pos[i * 3 + 1] = 6 + d * Math.tan(el); S.pos[i * 3 + 2] = 11 - d;
    S.s0[i] = rnd(45, 100); S.a0[i] = rnd(0.4, 0.7); S.seed[i] = rnd(0, 6.28); S.vel[i * 3] = rnd(-3, 3); S.life[i] = (el - 0.12) / 0.34;
  } }
  // 灰・火の粉は最初から粒を撒いておく（位置は箱の中でランダム）
  const B = V.ashBox;
  [VOL.ash, VOL.ember].forEach(S => { for (let i = 0; i < S.max; i++) { S.pos[i * 3] = rnd(-B.x, B.x); S.pos[i * 3 + 1] = rnd(0, B.y); S.pos[i * 3 + 2] = rnd(-B.z, 10); S.seed[i] = rnd(0, 6.28); S.vel[i * 3 + 1] = -rnd(2.5, 6); S.s0[i] = rnd(0.7, 1.3); } });

  // 空の再描画用
  VOL.skyTex = scene.background; VOL.skyCanvas = scene.background.image; VOL.skyK = -1;
  VOL.fogA = new THREE.Color(CFG.world.fogColor); VOL.fogB = new THREE.Color(V.fogColor);
  VOL.skyA = ['#1c0e10', '#3d1c18', '#7a3d2a', '#9a5236'].map(c => new THREE.Color(c));
  VOL.skyB = [V.sky.top, V.sky.mid, V.sky.low, V.sky.bottom].map(c => new THREE.Color(c));
  VOL.hemiA = new THREE.Color(0xc9a392); VOL.hemiB = new THREE.Color(0xd2705a);
  VOL.hemi = scene.children.find(o => o.isHemisphereLight);
  VOL.tmp = new THREE.Color(); VOL.t = 0;
}

function spawnSmoke(S, i, k, level) {
  const V = CFG.volcano;
  S.age[i] = 0; S.life[i] = V.smokeLife * rnd(0.8, 1.2);
  const a = rnd(0, 6.28), r = Math.sqrt(Math.random()) * V.craterR * 0.9;
  S.pos[i * 3] = Math.cos(a) * r; S.pos[i * 3 + 1] = VOL.craterY; S.pos[i * 3 + 2] = V.dist + Math.sin(a) * r;
  // vel: x 横ばらつき / y = 立ちのぼる高さ / z = 手前への流れ
  S.vel[i * 3] = rnd(-7, 7) * (0.3 + k); S.vel[i * 3 + 1] = rnd(45, 75) + k * rnd(0, 70); S.vel[i * 3 + 2] = -V.windSpeed * rnd(0.55, 1.1) * (0.4 + 0.6 * k);
  S.s0[i] = rnd(22, 46) * (0.5 + 0.8 * level); S.a0[i] = rnd(0.5, 0.9); S.seed[i] = k;
}
function spawnFire(S, i) {
  const V = CFG.volcano; S.age[i] = 0;
  const col = Math.random() < 0.3;   // 火柱（大きくゆっくり）か、火花
  S.life[i] = col ? rnd(1.2, 2) : rnd(2, 3.6);
  const a = rnd(0, 6.28), r = Math.sqrt(Math.random()) * V.craterR * 0.8;
  S.pos[i * 3] = Math.cos(a) * r; S.pos[i * 3 + 1] = VOL.craterY; S.pos[i * 3 + 2] = V.dist + Math.sin(a) * r;
  S.vel[i * 3] = rnd(-1, 1) * (col ? 6 : 28); S.vel[i * 3 + 1] = col ? rnd(25, 45) : rnd(45, 90); S.vel[i * 3 + 2] = rnd(-1, 1) * (col ? 6 : 28) - 8;
  S.s0[i] = col ? rnd(12, 22) : rnd(2.5, 5.5); S.a0[i] = col ? 0.8 : 1; S.seed[i] = col ? 1 : 0;
}

function stepSmoke(S, dt, fx) {
  S.budget += S.max / CFG.volcano.smokeLife * fx.smoke * dt;
  for (let i = 0; i < S.max; i++) {
    if (S.age[i] >= S.life[i]) { if (S.budget >= 1) { S.budget -= 1; spawnSmoke(S, i, fx.k, fx.smoke); } else { S.alpha[i] = 0; continue; } }
    S.age[i] += dt; const f = S.age[i] / S.life[i], ymax = S.vel[i * 3 + 1];
    S.pos[i * 3] += S.vel[i * 3] * dt;
    S.pos[i * 3 + 1] = CFG.volcano.height + ymax * (1 - Math.exp(-S.age[i] / 2.6)) * 0.9;   // 立ちのぼって頭打ち→横へ広がる
    S.pos[i * 3 + 2] += S.vel[i * 3 + 2] * dt * (0.25 + Math.min(1, f * 2.2));              // 上空に出たら風で手前へ流れる
    S.size[i] = S.s0[i] * (0.6 + f * 2.4);
    S.alpha[i] = S.a0[i] * Math.min(1, f * 6) * (1 - f) * (0.55 + 0.45 * S.seed[i]);
    // 色：噴火前は灰色、噴火後は黒煙。火口に近いほど下から赤く照らされる
    const dark = 0.5 - 0.42 * S.seed[i], glow = Math.max(0, 1 - f * 2.2) * S.seed[i] * 0.9, hi = 0.18 * S.seed[i] * Math.min(1, f * 1.5);
    S.col[i * 3] = dark + glow * 0.75 + hi; S.col[i * 3 + 1] = dark + glow * 0.28 + hi * 0.25; S.col[i * 3 + 2] = dark + glow * 0.08;
  }
}
function stepFire(S, dt, fx) {
  S.budget += S.max / 2.6 * fx.k * dt;
  for (let i = 0; i < S.max; i++) {
    if (S.age[i] >= S.life[i]) { if (S.budget >= 1) { S.budget -= 1; spawnFire(S, i); } else { S.alpha[i] = 0; continue; } }
    S.age[i] += dt; const f = S.age[i] / S.life[i], col = S.seed[i] > 0.5;
    if (!col) S.vel[i * 3 + 1] -= 32 * dt;
    S.pos[i * 3] += S.vel[i * 3] * dt; S.pos[i * 3 + 1] += S.vel[i * 3 + 1] * dt; S.pos[i * 3 + 2] += S.vel[i * 3 + 2] * dt;
    S.size[i] = S.s0[i] * (col ? 0.6 + f : 1 - f * 0.5);
    S.alpha[i] = S.a0[i] * (1 - f) * (1 - f);
    S.col[i * 3] = 1; S.col[i * 3 + 1] = 0.75 - 0.55 * f; S.col[i * 3 + 2] = 0.25 - 0.22 * f;
  }
}
// プレイヤー周辺に降る粒（箱の中で上から下へ、下に着いたら上に戻す）。灰は gray、火の粉は ember
function stepRain(S, dt, fx, ember, P) {
  const B = CFG.volcano.ashBox, T = VOL.t;
  const lvl = ember ? fx.k : Math.max(fx.k, fx.smoke * 0.12);
  const n = Math.floor(S.max * lvl);
  for (let i = 0; i < S.max; i++) {
    if (i >= n) { S.alpha[i] = 0; continue; }
    S.pos[i * 3 + 1] += S.vel[i * 3 + 1] * dt * (ember ? 0.5 : 1);
    S.pos[i * 3] += (Math.sin(T * 0.8 + S.seed[i]) * 1.2 - 2.5) * dt;   // 風でゆれて横へ流れる
    S.pos[i * 3 + 2] += (3 + Math.cos(T * 0.6 + S.seed[i])) * dt;
    if (S.pos[i * 3 + 1] < 0) { S.pos[i * 3 + 1] = B.y; S.pos[i * 3] = rnd(-B.x, B.x); S.pos[i * 3 + 2] = rnd(-B.z, 6); }
    if (S.pos[i * 3 + 2] > 14) S.pos[i * 3 + 2] -= B.z;
    S.size[i] = (ember ? 0.5 : 0.38) * S.s0[i];
    const fadeIn = Math.min(1, S.pos[i * 3 + 1] / 3);
    if (ember) { S.alpha[i] = 0.9 * fadeIn * (0.6 + 0.4 * Math.sin(T * 7 + S.seed[i] * 9)); S.col[i * 3] = 1; S.col[i * 3 + 1] = 0.25 + 0.25 * S.s0[i]; S.col[i * 3 + 2] = 0.1; }
    else { S.alpha[i] = 0.75 * fadeIn * Math.min(1, lvl * 1.5 + 0.2); const g = 0.12 + 0.2 * S.s0[i]; S.col[i * 3] = g + 0.04; S.col[i * 3 + 1] = g; S.col[i * 3 + 2] = g - 0.03; }
  }
}

// 空にかぶさる噴煙の天井：噴火の強さに応じて濃くなる。低い縁ほど火口の光で赤く染まる
function stepCanopy(S, dt, fx) {
  const lvl = fx.k + (1 - fx.k) * CFG.volcano.idleSmoke * 0.3, T = VOL.t;
  for (let i = 0; i < S.max; i++) {
    S.pos[i * 3] += S.vel[i * 3] * dt; if (Math.abs(S.pos[i * 3]) > 340) S.pos[i * 3] *= -0.95;
    const low = 1 - S.life[i];   // 0=高い 1=低い
    S.size[i] = S.s0[i]; S.alpha[i] = S.a0[i] * lvl * (0.8 + 0.2 * Math.sin(T * 0.7 + S.seed[i]));
    S.col[i * 3] = 0.1 + 0.4 * low * fx.k; S.col[i * 3 + 1] = 0.07 + 0.1 * low * fx.k; S.col[i * 3 + 2] = 0.07;
  }
}

function redrawSky(k) {
  const c = VOL.skyCanvas, g = c.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, c.height), st = [0, 0.45, 0.8, 1];
  for (let j = 0; j < 4; j++) grd.addColorStop(st[j], '#' + VOL.tmp.copy(VOL.skyA[j]).lerp(VOL.skyB[j], k).getHexString());
  g.fillStyle = grd; g.fillRect(0, 0, c.width, c.height); VOL.skyTex.needsUpdate = true;
}

function updateVolcano(P, dt, fx) {
  const V = CFG.volcano;
  VOL.t += dt;
  VOL.scaleU.value = WORLD.renderer.domElement.height / 2;
  VOL.group.position.z = P.z;
  const back = P.dist * V.recede;   // 少しずつ遠ざかる（山・煙・火の発生元が一緒に動く）
  VOL.vg.position.z = VOL.smoke.pts.position.z = VOL.fire.pts.position.z = back;
  stepSmoke(VOL.smoke, dt, fx); stepFire(VOL.fire, dt, fx);
  stepRain(VOL.ash, dt, fx, false, P); stepRain(VOL.ember, dt, fx, true, P);
  VOL.ash.pts.position.x = VOL.ember.pts.position.x = P.x * 0.5;
  stepCanopy(VOL.canopy, dt, fx); VOL.canopy.pts.position.x = P.x * 0.8;
  [VOL.smoke, VOL.fire, VOL.ash, VOL.ember, VOL.canopy].forEach(pflush);
  // 空・霧・光の遷移
  if (Math.abs(fx.k - VOL.skyK) > 0.01) {
    VOL.skyK = fx.k; redrawSky(fx.k);
    WORLD.scene.fog.color.copy(VOL.fogA).lerp(VOL.fogB, fx.k);
    if (VOL.hemi) VOL.hemi.color.copy(VOL.hemiA).lerp(VOL.hemiB, fx.k);
  }
}

// 再スタート用：噴火前の状態へ（煙・火の粒を消し、空と霧を元の色に戻す）
function resetVolcano() {
  VOL.t = 0; VOL.skyK = -1;
  [VOL.smoke, VOL.fire].forEach(S => { S.age.fill(1e9); S.alpha.fill(0); S.budget = 0; });
}
