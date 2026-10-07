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
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.58, 0.14, 0.56), belly); jaw.position.set(0, -0.3, -0.5); head.add(jaw);
  [-1, 1].forEach(s => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.2, 10, 8), white); eye.position.set(s * 0.3, 0.28, -0.32); head.add(eye);
    const pup = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 6), black); pup.position.set(s * 0.31, 0.28, -0.48); head.add(pup);
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

  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.3, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03; shadow.scale.set(0.9, 1.4, 1);

  const group = new THREE.Group(); group.add(root); group.add(shadow);
  return { group, root, body, head, tail1, tail2, legs, shadow, phase: 0, air: 0 };
}

function updateDino(d, P, dt) {
  const D = CFG.dino;
  d.phase += P.speed * dt * D.runFreq;
  d.air += ((P.grounded ? 0 : 1) - d.air) * (1 - Math.exp(-14 * dt));   // 空中ポーズへのなめらかな切り替え
  const sw = Math.sin(d.phase), a = d.air, g = 1 - a;
  d.group.position.set(P.x, 0, P.z);
  d.group.visible = !(P.invuln > 0 && Math.floor(P.time * 14) % 2 === 0);   // 復帰後の無敵中は点滅
  if (P.state === 'dead') { updateDinoDead(d, P); return; }
  if (P.state !== 'run') { updateDinoHit(d, P); return; }
  d.root.position.z = 0; d.root.rotation.x = 0; d.body.scale.y = 1;
  d.root.position.y = P.y;
  d.root.rotation.z = -P.vx * D.lean; d.root.rotation.y = -P.vx * D.lean * 0.7;
  const st = P.stumbleT > 0 ? Math.sin(P.stumbleT / CFG.obstacle.stumble.tiltSec * Math.PI) : 0;   // クレーターでつまずく：前のめりにガクッ
  d.body.position.y = g * Math.abs(sw) * D.bob - st * 0.18;
  d.body.rotation.x = g * Math.sin(d.phase * 2) * 0.04 + a * Math.max(-0.5, Math.min(0.5, P.vy * 0.03)) - st * 0.45;   // 上昇で鼻先が上、下降で下
  d.legs[0].rotation.x = g * sw * D.legSwing + a * D.tuck * 0.9;
  d.legs[1].rotation.x = g * -sw * D.legSwing + a * D.tuck * 0.5;
  d.tail1.rotation.y = g * Math.sin(d.phase) * D.tailSwing;
  d.tail2.rotation.y = g * Math.sin(d.phase - 1.0) * D.tailSwing * 1.2;
  d.tail1.rotation.x = -a * 0.35 + g * Math.sin(d.phase * 2) * 0.05;
  d.tail2.rotation.x = -a * 0.25;
  d.head.rotation.x = g * -Math.sin(d.phase * 2) * 0.05 - a * 0.15;
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
    d.head.rotation.x = -0.35;
  } else {   // recover：うずくまりから、ふらつきながら立ち上がる
    const f = Math.min(1, t / CFG.hit.recoverSec), e = f * f * (3 - 2 * f);
    d.body.position.y = 0; d.body.rotation.x = (1 - e) * 0.25; d.body.scale.y = 0.7 + 0.3 * e;
    d.legs[0].rotation.x = Math.sin(t * 9) * 0.35 * e; d.legs[1].rotation.x = -Math.sin(t * 9) * 0.35 * e;
    d.tail1.rotation.y = Math.sin(t * 8) * 0.3; d.tail2.rotation.y = Math.sin(t * 8 - 1) * 0.4; d.tail1.rotation.x = d.tail2.rotation.x = 0;
    d.head.rotation.x = 0.35 * (1 - e);
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
  d.head.rotation.x = -0.5 * (1 - e * 0.5);
  d.shadow.position.set(0, 0.03, 0); d.shadow.material.opacity = 0.35 * (1 - e);
}
