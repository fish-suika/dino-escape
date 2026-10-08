// ===== 恐竜（基本 Geometry だけのコミカルな1種類）。頭は -z 向き =====
function buildDino() {
  const D = CFG.dino;
  const skin = new THREE.MeshLambertMaterial({ color: 0x6fbf4a, flatShading: true });
  const belly = new THREE.MeshLambertMaterial({ color: 0xd9e59a, flatShading: true });
  const dark = new THREE.MeshLambertMaterial({ color: 0x4a8f32, flatShading: true });
  const spike = new THREE.MeshLambertMaterial({ color: 0xf29a3a, flatShading: true });
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const black = new THREE.MeshBasicMaterial({ color: 0x111111 });

  const root = new THREE.Group();   // 位置（プレイヤー座標）と傾き
  const body = new THREE.Group(); root.add(body);   // 弾み・ピッチ

  const torso = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 10), skin); torso.scale.set(0.85, 0.8, 1.25); torso.position.set(0, 1.6, 0.1); body.add(torso);
  const tummy = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 8), belly); tummy.scale.set(0.6, 0.55, 1.0); tummy.position.set(0, 1.35, -0.15); body.add(tummy);
  for (let i = 0; i < 4; i++) {   // 背びれ
    const sp = new THREE.Mesh(new THREE.ConeGeometry(0.22 - i * 0.02, 0.5, 5), spike); sp.position.set(0, 2.4 - i * 0.06, 0.55 - i * 0.42); body.add(sp);
  }

  const head = new THREE.Group(); head.position.set(0, 2.2, -1.0); body.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.62, 12, 10), skin); head.add(skull);
  const snout = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.38, 0.6), skin); snout.position.set(0, -0.08, -0.55); head.add(snout);
  const jawPivot = new THREE.Group(); jawPivot.position.set(0, -0.3, -0.25); head.add(jawPivot);   // 口を開けるための蝶番（顎の付け根）
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.14, 0.56), belly); jaw.position.set(0, 0, -0.25); jawPivot.add(jaw);
  const eyes = [], pups = [];
  [-1, 1].forEach(s => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), white); eye.position.set(s * 0.3, 0.28, -0.32); head.add(eye); eyes.push(eye);
    const pup = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), black); pup.position.set(s * 0.31, 0.28, -0.48); head.add(pup); pups.push(pup); pup.userData.base = [s * 0.31, 0.28, -0.48];
    const nos = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 5), black); nos.position.set(s * 0.14, 0.02, -0.86); head.add(nos);
  });

  [-1, 1].forEach(s => {   // ちいさな腕
    const arm = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.14, 0.45), dark); arm.position.set(s * 0.72, 1.55, -0.65); arm.rotation.y = s * -0.3; body.add(arm);
  });

  const tail1 = new THREE.Group(); tail1.position.set(0, 1.6, 1.15); body.add(tail1);
  const t1 = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.5, 7).translate(0, 0.75, 0).rotateX(Math.PI / 2), skin); tail1.add(t1);
  const tail2 = new THREE.Group(); tail2.position.set(0, 0, 1.3); tail1.add(tail2);
  const t2 = new THREE.Mesh(new THREE.ConeGeometry(0.32, 1.4, 7).translate(0, 0.7, 0).rotateX(Math.PI / 2), dark); tail2.add(t2);

  const legs = [-1, 1].map(s => {   // 脚：股関節のピボットから下へ
    const hip = new THREE.Group(); hip.position.set(s * 0.5, 1.2, 0.3); root.add(hip);
    const thigh = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.85, 0.5), skin); thigh.position.y = -0.4; hip.add(thigh);
    const foot = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.2, 0.75), dark); foot.position.set(0, -0.88, -0.14); hip.add(foot);
    return hip;
  });

  const sweatMat = new THREE.MeshBasicMaterial({ color: 0x9fd8ff });   // 汗のしずく（息を切らす・ほっとするときだけ見える）
  const sweat = [0, 1, 2].map(i => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.09, 6, 5), sweatMat); s.scale.set(1, 1.5, 1); s.visible = false; head.add(s); return s; });

  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.3, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03; shadow.scale.set(0.9, 1.4, 1);

  const group = new THREE.Group(); group.add(root); group.add(shadow);
  return { group, root, body, head, tail1, tail2, legs, shadow, torso, eyes, pups, jawPivot, sweat, phase: 0, air: 0, fear: 0, panic: 0, squash: 1, clock: 0, idle: false, clr: null };
}

// 表情：widen=目の見開き 0〜1 / jaw=口の開き 0〜1 / dizzy=目が回る時計（0 なら回らない）。小さな変化だけで「焦り」を出す
function dinoFace(d, widen, jaw, dizzy) {
  const k = fxInt(), w = widen * k;
  d.eyes.forEach(e => e.scale.setScalar(1 + 0.4 * w));
  d.pups.forEach((p, i) => {
    const b = p.userData.base;
    p.scale.setScalar(1 - 0.35 * w);
    if (dizzy > 0) { const a = dizzy * 13 + i * 2.1; p.position.set(b[0] * 0.8 + Math.cos(a) * 0.1, b[1] + Math.sin(a) * 0.1, b[2] + 0.1); }   // 目がぐるぐる
    else p.position.set(b[0], b[1], b[2]);
  });
  d.jawPivot.rotation.x = -0.55 * jaw * k;
}

function updateDino(d, P, dt) {
  const D = CFG.dino, k = fxInt(), fear = d.fear || 0, panic = d.panic || 0;
  d.phase += P.speed * dt * D.runFreq * (1 + 0.45 * panic * k);   // マグマが近いと脚の回転が速い（必死な走り）
  d.air += ((P.grounded ? 0 : 1) - d.air) * (1 - Math.exp(-14 * dt));   // 空中ポーズへのなめらかな切り替え
  const sw = Math.sin(d.phase), a = d.air, g = 1 - a;
  d.group.position.set(P.x, 0, P.z);
  d.group.visible = !(P.invuln > 0 && Math.floor(P.time * 14) % 2 === 0);   // 復帰後の無敵中は点滅
  d.body.scale.set(1, 1, 1); d.head.position.y = 2.2; d.torso.scale.y = 0.8; d.root.rotation.z = 0;
  d.clock += dt; d.root.rotation.y = 0; d.head.rotation.y = 0; d.sweat.forEach(s => { s.visible = false; });
  if (d.idle) { updateDinoStand(d, P, dt, 0.25, 0); return; }                  // タイトル画面：立って呼吸する
  if (d.clr && d.clr.stage !== 'runin') { updateDinoClear(d, P, dt, d.clr); return; }   // クリア演出（走り込みの間は通常の走り）
  if (P.state === 'dead') { updateDinoDead(d, P); return; }
  if (P.state !== 'run') { updateDinoHit(d, P); return; }
  d.root.position.z = 0; d.root.rotation.x = 0;
  const sq = d.squash == null ? 1 : d.squash;   // 離陸前の溜め・着地のつぶれ（縦に縮めて横に広げる）
  d.body.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
  d.root.position.y = P.y;
  const H = CFG.hit, dz = P.invuln > H.invulnSec - 0.6 ? (P.invuln - (H.invulnSec - 0.6)) / 0.6 : 0;   // 起き上がった直後：目が回ってよろめく
  d.root.rotation.z = -P.vx * D.lean + Math.sin(P.time * 15) * 0.12 * dz;
  d.root.rotation.y = -P.vx * D.lean * 0.7;
  const st = P.stumbleT > 0 ? Math.sin(P.stumbleT / CFG.obstacle.stumble.tiltSec * Math.PI) : 0;   // クレーターでつまずく：前のめりにガクッ
  d.body.position.y = g * Math.abs(sw) * D.bob - st * 0.18;
  d.body.rotation.x = g * Math.sin(d.phase * 2) * 0.04 + a * Math.max(-0.5, Math.min(0.5, P.vy * 0.03)) - st * 0.45;   // 上昇で鼻先が上、下降で下
  const lg = 1 + 0.25 * panic * k;   // 必死なときは脚の振れも大きい
  d.legs[0].rotation.x = g * sw * D.legSwing * lg + a * D.tuck * 0.9;
  d.legs[1].rotation.x = g * -sw * D.legSwing * lg + a * D.tuck * 0.5;
  d.tail1.rotation.y = g * Math.sin(d.phase) * D.tailSwing;
  d.tail2.rotation.y = g * Math.sin(d.phase - 1.0) * D.tailSwing * 1.2;
  d.tail1.rotation.x = -a * 0.35 + g * Math.sin(d.phase * 2) * 0.05 - fear * 0.32 * k + Math.sin(P.time * 38) * 0.03 * fear * k;   // 危険が近いと尻尾が逆立つ（細かく震える）
  d.tail2.rotation.x = -a * 0.25 - fear * 0.25 * k;
  d.head.rotation.x = g * -Math.sin(d.phase * 2) * 0.05 - a * 0.15;
  d.head.position.y = 2.2 + g * Math.sin(d.phase * 2 + 0.6) * 0.05 * (1 + panic * k);   // 走りで頭が上下に揺れる
  d.torso.scale.y = 0.8 * (1 + 0.025 * Math.sin(P.time * (9 + 6 * panic)) * k);   // 呼吸
  dinoFace(d, Math.max(fear, panic * 0.7, dz * 0.5), Math.max(panic * 0.9, fear * 0.35) + 0.1 * Math.max(0, Math.sin(P.time * (10 + 6 * panic))) * panic, dz > 0 ? P.time : 0);
  d.shadow.position.set(0, 0.03, 0); d.shadow.material.opacity = 0.35 * (1 - Math.min(1, P.y / 6) * 0.6);
  const ss = 1 - Math.min(0.5, P.y * 0.07); d.shadow.scale.set(0.9 * ss, 1.4 * ss, 1);
}

// 直撃中・起き上がり中のポーズ。体の中心（高さ 1.5）を軸に回転させる
function updateDinoHit(d, P) {
  const th = P.tumble, t = P.stateT, C = 1.5;
  d.air += (1 - d.air) * 0.5;
  d.root.rotation.set(th, 0, 0);
  d.root.position.set(0, P.y + C * (1 - Math.cos(th)), -C * Math.sin(th));
  d.shadow.position.set(0, 0.03, 0); d.shadow.material.opacity = 0.35 * (1 - Math.min(1, P.y / 6) * 0.6);
  const ss = 1 - Math.min(0.5, P.y * 0.07); d.shadow.scale.set(0.9 * ss, 1.4 * ss, 1);
  if (P.state === 'knocked') {   // 手足をばたつかせ、目を回して吹っ飛ぶ
    d.body.position.y = 0; d.body.rotation.x = 0; d.body.scale.y = 1;
    d.legs[0].rotation.x = Math.sin(t * 19) * 1.0; d.legs[1].rotation.x = Math.sin(t * 19 + 2.2) * 1.0;
    d.tail1.rotation.y = Math.sin(t * 13) * 0.5; d.tail2.rotation.y = Math.sin(t * 13 - 1) * 0.6; d.tail1.rotation.x = d.tail2.rotation.x = 0;
    d.head.rotation.x = -0.35; dinoFace(d, 1, 0.8, P.time);   // 目を見開いて口をあけ、ぐるぐる目
  } else {   // recover：うずくまりから、ふらつきながら立ち上がる
    const f = Math.min(1, t / CFG.hit.recoverSec), e = f * f * (3 - 2 * f);
    d.body.position.y = 0; d.body.rotation.x = (1 - e) * 0.25; d.body.scale.y = 0.7 + 0.3 * e;
    d.legs[0].rotation.x = Math.sin(t * 9) * 0.35 * e; d.legs[1].rotation.x = -Math.sin(t * 9) * 0.35 * e;
    d.tail1.rotation.y = Math.sin(t * 8) * 0.3; d.tail2.rotation.y = Math.sin(t * 8 - 1) * 0.4; d.tail1.rotation.x = d.tail2.rotation.x = 0;
    d.head.rotation.x = 0.35 * (1 - e); dinoFace(d, 0.6 * (1 - e) + 0.3, 0.2 * (1 - e), P.time);   // うずくまって目を回す
  }
}

// マグマに飲まれる：一瞬もがいて（手足・尻尾をばたつかせ、のけぞり）、溶岩の中へ沈む。P.stateT = 死亡からの秒
function updateDinoDead(d, P) {
  const C = CFG.magma, t = P.stateT, f = Math.min(1, t / C.deathSec), e = f * f * (3 - 2 * f), fl = Math.max(0, 1 - t / (C.deathSec * 0.85));
  d.air += (1 - d.air) * 0.3;
  d.group.visible = true;
  d.root.position.set(0, P.y * (1 - Math.min(1, t * 5)) - C.deathSink * e, 0);
  d.root.rotation.set(-0.75 * e + Math.sin(t * 17) * 0.08 * fl, 0, Math.sin(t * 13) * 0.25 * fl);
  d.body.position.y = Math.abs(Math.sin(t * 15)) * 0.25 * fl; d.body.rotation.x = 0; d.body.scale.y = 1;
  d.legs[0].rotation.x = Math.sin(t * 24) * 1.1 * fl; d.legs[1].rotation.x = Math.sin(t * 24 + 2.4) * 1.1 * fl;
  d.tail1.rotation.y = Math.sin(t * 16) * 0.5 * fl; d.tail2.rotation.y = Math.sin(t * 16 - 1) * 0.6 * fl; d.tail1.rotation.x = d.tail2.rotation.x = 0;
  d.head.rotation.x = -0.5 * (1 - e * 0.5); dinoFace(d, 1, 1, 0);
  d.shadow.position.set(0, 0.03, 0); d.shadow.material.opacity = 0.35 * (1 - e);
}

// ===== Phase 8：立ち姿（タイトル画面）と、クリア演出のポーズ =====
// 立ち姿：呼吸。pant が大きいほど荒く、口をあけてハァハァ。lean は前かがみ（負）/ のけぞり（正）
function updateDinoStand(d, P, dt, pant, lean) {
  const t = d.clock, k = 1 - Math.exp(-10 * dt), rate = 2.2 + 11 * pant, br = Math.sin(t * rate);
  d.air += (0 - d.air) * k;
  d.root.position.set(0, 0, 0); d.root.rotation.x = 0; d.root.rotation.z = 0;
  d.body.position.y = Math.max(0, br) * (0.01 + 0.05 * pant);
  d.body.rotation.x += (lean * 0.25 - d.body.rotation.x) * k;
  const s = 1 + br * (0.015 + 0.05 * pant);
  d.body.scale.set(1 + (1 - s) * 0.5, s, 1 + (1 - s) * 0.5);
  d.legs.forEach(l => { l.rotation.x += (0 - l.rotation.x) * k; });
  d.tail1.rotation.y = Math.sin(t * 1.2) * 0.25; d.tail2.rotation.y = Math.sin(t * 1.2 - 1) * 0.35;
  d.tail1.rotation.x += (0 - d.tail1.rotation.x) * k; d.tail2.rotation.x += (0 - d.tail2.rotation.x) * k;
  d.head.rotation.x += (lean * 0.9 * 0.25 - d.head.rotation.x) * k;
  d.head.rotation.y = Math.sin(t * 0.6) * (0.5 - 0.45 * pant);
  d.head.position.y = 2.2 + br * 0.03 * (1 + pant * 2);
  dinoFace(d, 0.1 + 0.25 * pant, 0.08 + 0.6 * pant * (0.5 + 0.5 * br), 0);
  d.shadow.position.set(0, 0.03, 0); d.shadow.material.opacity = 0.35; d.shadow.scale.set(0.9, 1.4, 1);
}

// クリア演出：c = { stage, t（段階の経過秒）, turn（回った割合 0〜1）, shock（驚き 0〜1）, relief（ほっと 0〜1） }。runin 以外のとき
function updateDinoClear(d, P, dt, c) {
  const st = c.stage, t = d.clock;
  const pant = st === 'breathe' ? 1 : st === 'lookback' ? 0.55 : st === 'eruption' ? 0.2 : st === 'relief' ? 0.1 + 0.35 * (1 - c.relief) : 0.1;
  updateDinoStand(d, P, dt, pant, st === 'breathe' ? -1 : st === 'lookback' ? -0.4 : 0);
  d.root.rotation.y = Math.PI * c.turn;
  if (st === 'lookback' && c.turn > 0.02 && c.turn < 0.98) {   // 回るあいだ、足をちょこちょこ動かす
    d.legs[0].rotation.x = Math.sin(t * 11) * 0.5; d.legs[1].rotation.x = -Math.sin(t * 11) * 0.5;
  }
  const sh = c.shock;
  if (sh > 0) {   // 大爆発にびっくり：のけぞって小さく跳ね、目を見開いて口をあける
    const tt = st === 'eruption' ? c.t : 9, hop = tt < 0.55 ? 1.4 * 4 * (tt / 0.55) * (1 - tt / 0.55) : 0;
    d.root.position.y = hop;
    d.body.rotation.x = 0.4 * sh; d.head.rotation.x = 0.35 * sh; d.tail1.rotation.x = -0.5 * sh; d.tail2.rotation.x = -0.35 * sh;
    d.legs[0].rotation.x = -0.5 * sh; d.legs[1].rotation.x = 0.5 * sh;
    d.head.rotation.y = 0;
    dinoFace(d, 0.2 + 0.8 * sh, 0.9 * sh, 0);
    d.tail1.rotation.y = Math.sin(t * 40) * 0.08 * sh;   // 尻尾がふるえる
  }
  const rl = c.relief;
  if (rl > 0) {   // ほっとする：肩（体）が落ち、頭を下げ、目を細める
    d.body.scale.y *= 1 - 0.05 * rl; d.head.rotation.x = -0.4 * rl; d.body.rotation.x = -0.12 * rl;
    d.eyes.forEach(e => { e.scale.y *= 1 - 0.75 * rl; }); d.pups.forEach(p => { p.scale.y *= 1 - 0.8 * rl; });
  }
  const sw = st === 'breathe' || st === 'lookback' || st === 'eruption' || (st === 'relief' && rl < 0.9);   // 汗のしずく
  d.sweat.forEach((s, i) => { s.visible = sw; const f = (t * 0.9 + i / 3) % 1; s.position.set((i === 1 ? -1 : 1) * (0.5 + 0.05 * i), 0.55 - f * 0.9, -0.15 - i * 0.1); });
}
