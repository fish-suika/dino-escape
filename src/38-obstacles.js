// ===== 障害物の見た目：岩・倒木・クレーター・マグマ溜まり（three.js） =====
// 状態（どこに何があるか）は 28-obstacle-logic.js の OB.list が持つ。ここはメッシュを使い回して映すだけ。
// ジオメトリ・マテリアルは種類ごとに 1 つを共有し、プール（固定数のスロット）を貸し借りする。毎フレーム新しく作らない。
const OBS = { frame: 0, T: 0, byId: new Map(), pools: {} };

function buildObstacles() {
  const scene = WORLD.scene, N = Math.ceil((CFG.obstacle.aheadDist + CFG.obstacle.behindDist) / CFG.obstacle.minGapZ) + 2;

  // 共有ジオメトリ（岩：装飾の岩より少し角ばってゆがませ、明るい縁取りの殻を重ねる）
  const rockGeo = new THREE.DodecahedronGeometry(1, 1), rp = rockGeo.attributes.position;
  for (let i = 0; i < rp.count; i++) { const k = 1 + Math.sin(rp.getX(i) * 5.3 + rp.getY(i) * 8.1 + rp.getZ(i) * 3.7) * 0.1; rp.setXYZ(i, rp.getX(i) * k, rp.getY(i) * k, rp.getZ(i) * k); }
  rockGeo.computeVertexNormals();
  const rockMat = new THREE.MeshPhongMaterial({ color: 0x7c6d62, emissive: 0x1c0c06, specular: 0x222222, shininess: 6, flatShading: true });
  const rimMat = new THREE.MeshBasicMaterial({ color: 0xe9a468, side: THREE.BackSide });
  const logGeo = new THREE.CylinderGeometry(1, 1, 1, 7, 1).rotateZ(Math.PI / 2);   // 軸が x 方向の長さ 1 の幹
  const logMat = new THREE.MeshPhongMaterial({ color: 0x1f1612, emissive: 0x240a03, specular: 0x111111, shininess: 4, flatShading: true });
  const stubGeo = new THREE.ConeGeometry(0.16, 0.9, 5), stubMat = new THREE.MeshLambertMaterial({ color: 0x120d0a, emissive: 0x3a1004, flatShading: true });
  const capMat = new THREE.MeshLambertMaterial({ color: 0x5a2410, emissive: 0xc2410a, emissiveIntensity: 0.6, flatShading: true });
  const capGeo = new THREE.CircleGeometry(0.85, 7);
  const flat = (geo, mat, y, off) => {   // 地面に貼る面（XY で作って寝かせる）
    mat.transparent = true; mat.depthWrite = false; mat.side = THREE.DoubleSide; mat.polygonOffset = true; mat.polygonOffsetFactor = off; mat.polygonOffsetUnits = off;
    const m = new THREE.Mesh(geo, mat); m.rotation.x = -Math.PI / 2; m.position.y = y; return m;
  };
  const ringGeo = new THREE.RingGeometry(0.8, 1.12, 32), discGeo = new THREE.CircleGeometry(1, 36), crustGeo = new THREE.RingGeometry(0.96, 1.3, 36);
  const rimGroundMat = new THREE.MeshLambertMaterial({ color: 0x75604f });
  const holeMat = new THREE.MeshBasicMaterial({ color: 0x0b0605 });
  const holeMat2 = new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0.85 });
  const crustMat = new THREE.MeshBasicMaterial({ color: 0x2b130a });
  OBS.lavaTex = makeLavaTexture(); OBS.lavaTex.repeat.set(1.4, 1.4);
  const lavaMat = new THREE.MeshBasicMaterial({ map: OBS.lavaTex, color: 0xffffff });
  const glowMat = new THREE.SpriteMaterial({ map: makeSoftTexture(), color: 0xff6a1a, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0.55 });
  OBS.lavaMat = lavaMat; OBS.glowMat = glowMat;

  const mk = {
    rock() {
      const g = new THREE.Group(), body = new THREE.Mesh(rockGeo, rockMat), rim = new THREE.Mesh(rockGeo, rimMat);
      rim.scale.setScalar(1.06); g.add(rim, body); g.userData.body = body; g.userData.rim = rim; return g;
    },
    log() {
      const g = new THREE.Group(), trunk = new THREE.Mesh(logGeo, logMat); g.add(trunk);
      const stubs = [0, 1, 2].map(() => { const s = new THREE.Mesh(stubGeo, stubMat); g.add(s); return s; });
      const caps = [-1, 1].map(s => { const c = new THREE.Mesh(capGeo, capMat); c.rotation.y = s * Math.PI / 2; g.add(c); return c; });   // 切り口は赤くくすぶる
      g.userData = { trunk, stubs, caps }; return g;
    },
    crater() {
      const g = new THREE.Group(), fg = new THREE.Group();   // fg：半径倍に拡大する平面だけの入れ物
      fg.add(flat(ringGeo, rimGroundMat.clone(), 0.05, -2), flat(discGeo, holeMat.clone(), 0.06, -3));
      const inner = flat(discGeo, holeMat2.clone(), 0.07, -4); inner.scale.set(0.55, 0.55, 1); fg.add(inner); g.add(fg); g.userData.fg = fg; return g;
    },
    pool() {
      const g = new THREE.Group(), fg = new THREE.Group(), glow = new THREE.Sprite(glowMat);
      fg.add(flat(crustGeo, crustMat.clone(), 0.05, -2), flat(discGeo, lavaMat, 0.07, -4)); g.add(fg); glow.position.y = 0.9; g.add(glow);
      g.userData.fg = fg; g.userData.glow = glow; return g;
    }
  };
  for (const type of Object.keys(mk)) {
    OBS.pools[type] = [];
    for (let i = 0; i < N; i++) { const group = mk[type](); group.visible = false; scene.add(group); OBS.pools[type].push({ id: 0, seen: 0, group, type }); }
  }
}

// 障害物 ob にスロットを割り当てて、形・向き・位置を一度だけ決める（動かないのでその後は触らない）
function obstacleSlotFor(ob) {
  let sl = OBS.byId.get(ob.id);
  if (sl) return sl;
  sl = OBS.pools[ob.type].find(s => !s.id); if (!sl) return null;
  sl.id = ob.id; OBS.byId.set(ob.id, sl);
  const g = sl.group, u = g.userData;
  g.position.set(ob.x, 0, ob.z); g.rotation.set(0, 0, 0); g.scale.set(1, 1, 1);
  if (ob.type === 'rock') {
    u.body.scale.set(ob.r, ob.h * 0.52, ob.r * 0.9); u.body.position.y = ob.h * 0.46; u.body.rotation.set(0, (ob.id * 1.7) % 6.28, 0);
    u.rim.scale.copy(u.body.scale).multiplyScalar(1.06); u.rim.position.copy(u.body.position); u.rim.rotation.copy(u.body.rotation);
  } else if (ob.type === 'log') {
    u.trunk.scale.set(ob.len, ob.r, ob.r); u.trunk.position.y = ob.r;
    u.stubs.forEach((s, i) => { s.position.set(ob.len * (-0.3 + 0.3 * i + ((ob.id * 0.37 + i) % 1) * 0.1), ob.r * 1.5, ((i + ob.id) % 2 ? 0.2 : -0.2)); s.rotation.set((i + ob.id) % 2 ? 0.5 : -0.5, 0, ((i + ob.id) % 3 - 1) * 0.25); });
    u.caps.forEach((c, i) => { c.position.set((i ? 1 : -1) * ob.len / 2, ob.r, 0); c.scale.setScalar(ob.r / 0.85 * 0.95); });
    g.rotation.y = ((ob.id * 0.61) % 1 - 0.5) * 0.14;   // ほんの少し斜め（当たり判定は軸平行のまま。見た目の誤差は ±0.7u 以内）
  } else {
    u.fg.scale.set(ob.r, 1, ob.r);   // 平らな円なので半径倍
    if (ob.type === 'pool') { u.glow.scale.set(ob.r * 2.6, ob.r * 2.6, 1); u.glow.userData.s = ob.r * 2.6; }
    u.fg.rotation.y = ob.id;
  }
  g.visible = true;
  return sl;
}

function obstacleRelease(sl) { OBS.byId.delete(sl.id); sl.id = 0; sl.group.visible = false; }

// 毎フレーム：リストにある障害物を映し、消えたものはスロットを返す。マグマ溜まりだけゆらぐ
function syncObstacles(OB, dt) {
  OBS.frame++; OBS.T += dt; const T = OBS.T;
  for (const ob of OB.list) { const sl = obstacleSlotFor(ob); if (sl) sl.seen = OBS.frame; }
  for (const type in OBS.pools) for (const sl of OBS.pools[type]) if (sl.id && sl.seen !== OBS.frame) obstacleRelease(sl);
  OBS.lavaTex.offset.set(T * 0.03, T * 0.02);
  const flick = 0.85 + 0.15 * Math.sin(T * 5.3) * Math.sin(T * 3.1 + 1);
  OBS.lavaMat.color.setRGB(flick, flick * 0.92, flick * 0.9);
  OBS.glowMat.opacity = 0.42 + 0.16 * Math.sin(T * 4.1 + 0.6);
  for (const sl of OBS.pools.pool) if (sl.id) { const gl = sl.group.userData.glow, s = gl.userData.s * (1 + 0.05 * Math.sin(T * 6 + sl.id)); gl.scale.set(s, s, 1); }
}

// 再スタート用：すべてのスロットを返す
function resetObstaclesView() {
  for (const type in OBS.pools) for (const sl of OBS.pools[type]) if (sl.id) obstacleRelease(sl);
  OBS.byId.clear(); OBS.frame = 0; OBS.T = 0;
}
