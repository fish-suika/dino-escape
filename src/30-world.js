// ===== 3D ステージ：空・フォグ・地面・装飾・カメラ =====
const WORLD = {};
const LANE_LINE = { len: 320, period: 6, ahead: 140 };   // レーンの区切り線：長さ / 破線 1 周期の長さ / 手前から先へ伸ばす中心のずれ

function rnd(a, b) { return a + Math.random() * (b - a); }

function makeSkyTexture() {
  const c = document.createElement('canvas'); c.width = 4; c.height = 256;
  const g = c.getContext('2d'), grd = g.createLinearGradient(0, 0, 0, 256);
  grd.addColorStop(0, '#1c0e10'); grd.addColorStop(0.45, '#3d1c18'); grd.addColorStop(0.8, '#7a3d2a'); grd.addColorStop(1, '#9a5236');
  g.fillStyle = grd; g.fillRect(0, 0, 4, 256);
  const t = new THREE.CanvasTexture(c); return t;
}

function makeGroundTexture() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#6b5f5a'; g.fillRect(0, 0, S, S);
  for (let i = 0; i < 1400; i++) {   // 灰のまだら
    const v = 70 + Math.floor(Math.random() * 60);
    g.fillStyle = `rgba(${v + 14},${v + 4},${v},${0.25 + Math.random() * 0.3})`;
    const r = 1 + Math.random() * 5; g.beginPath(); g.arc(Math.random() * S, Math.random() * S, r, 0, 7); g.fill();
  }
  for (let i = 0; i < 40; i++) {   // 焼けた赤茶の斑点
    g.fillStyle = `rgba(110,48,34,${0.25 + Math.random() * 0.25})`;
    g.beginPath(); g.arc(Math.random() * S, Math.random() * S, 2 + Math.random() * 6, 0, 7); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(CFG.world.texRepeat, CFG.world.texRepeat); return t;
}

function buildWorld() {
  const W = CFG.world, host = document.getElementById('view');
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  host.appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  scene.background = makeSkyTexture();
  scene.fog = new THREE.Fog(W.fogColor, W.fogNear, W.fogFar);
  const camera = new THREE.PerspectiveCamera(CFG.cam.fov, 16 / 9, 0.1, 600);

  scene.add(new THREE.HemisphereLight(0xc9a392, 0x3a2420, 0.9));
  const sun = new THREE.DirectionalLight(0xffb27a, 0.8); sun.position.set(-30, 40, 20); scene.add(sun);

  // 地面：プレイヤーの z に追従させ、テクスチャだけ流して「前へ進む」見た目にする
  const gtex = makeGroundTexture();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(W.groundSize, W.groundSize), new THREE.MeshLambertMaterial({ map: gtex }));
  ground.rotation.x = -Math.PI / 2; scene.add(ground);

  // レーンの区切り線：走る道が 3 本あることが分かる、うっすらした破線（地面と一緒に手前へ流れる）。左右の端の線は道の縁
  const lc = document.createElement('canvas'); lc.width = 8; lc.height = 64;
  const lg = lc.getContext('2d'); lg.fillStyle = '#fff'; lg.fillRect(0, 0, 8, 38);
  const ltex = new THREE.CanvasTexture(lc); ltex.wrapS = ltex.wrapT = THREE.RepeatWrapping; ltex.repeat.set(1, LANE_LINE.len / LANE_LINE.period);
  const lmat = new THREE.MeshBasicMaterial({ map: ltex, color: 0xe0b890, transparent: true, opacity: 0.32, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const laneLines = [];
  for (let i = 0; i <= CFG.lane.count; i++) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(i === 0 || i === CFG.lane.count ? 0.3 : 0.18, LANE_LINE.len), lmat);
    m.rotation.x = -Math.PI / 2; m.position.set((i - CFG.lane.count / 2) * CFG.lane.width, 0.02, 0); scene.add(m); laneLines.push(m);
  }

  // 装飾（岩・丘）。障害物ではなく見た目だけ。遊べる範囲（±clearHalf）の外側に置く
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x4d4440, flatShading: true });
  const rockMat2 = new THREE.MeshLambertMaterial({ color: 0x5f524b, flatShading: true });
  const hillMat = new THREE.MeshLambertMaterial({ color: 0x564a45, flatShading: true });
  const decor = [];
  function place(d, initial, pz) {
    const side = Math.random() < 0.5 ? -1 : 1;
    const off = d.isHill ? rnd(W.clearHalf + 14, W.clearHalf + W.spread) : rnd(W.clearHalf, W.clearHalf + W.spread * 0.7);
    d.mesh.position.x = side * off;
    d.mesh.position.z = initial ? pz + rnd(W.spawnBehind, -W.spawnAhead) : pz - W.spawnAhead - rnd(0, 30);
  }
  for (let i = 0; i < W.rocks; i++) {
    const s = rnd(0.8, 3.2), m = new THREE.Mesh(new THREE.DodecahedronGeometry(1, 0), Math.random() < 0.5 ? rockMat : rockMat2);
    m.scale.set(s * rnd(0.8, 1.4), s * rnd(0.6, 1.1), s * rnd(0.8, 1.4)); m.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3)); m.position.y = s * 0.35;
    scene.add(m); decor.push({ mesh: m, isHill: false });
  }
  for (let i = 0; i < W.hills; i++) {
    const s = rnd(9, 22), m = new THREE.Mesh(new THREE.SphereGeometry(1, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2), hillMat);
    m.scale.set(s * rnd(1.2, 2), s * rnd(0.25, 0.5), s * rnd(1, 1.6)); m.rotation.y = rnd(0, 3);
    scene.add(m); decor.push({ mesh: m, isHill: true });
  }
  decor.forEach(d => place(d, true, 0));

  Object.assign(WORLD, { renderer, scene, camera, ground, gtex, decor, place, laneLines, ltex, camX: 0, lookX: 0, camReady: false });
  fit();
  addEventListener('resize', fit);
}

function fit() {
  const host = document.getElementById('view'), w = host.clientWidth || innerWidth, h = host.clientHeight || innerHeight;
  WORLD.renderer.setSize(w, h, false);
  WORLD.camera.aspect = w / h; WORLD.camera.updateProjectionMatrix();
}

function updateWorld(P, dt) {
  const W = CFG.world, C = CFG.cam, cam = WORLD.camera;
  WORLD.ground.position.z = P.z;
  const tile = W.groundSize / W.texRepeat;
  WORLD.gtex.offset.y = P.dist / tile;   // 地面が手前へ流れる（前方は -z）
  WORLD.ltex.offset.y = (P.dist + LANE_LINE.ahead) / LANE_LINE.period; WORLD.laneLines.forEach(m => { m.position.z = P.z - LANE_LINE.ahead; });   // 区切り線は先の方まで伸ばし、破線は地面と同じ向きに流す
  WORLD.decor.forEach(d => { if (d.mesh.position.z > P.z + W.spawnBehind) WORLD.place(d, false, P.z); });

  // カメラ：後方上から見下ろす。横と高さはなめらかに追従、前後は一定距離
  const k = 1 - Math.exp(-C.follow * dt), kx = 1 - Math.exp(-C.followXSpeed * dt);   // 横はゆっくり（レーン移動で画面が揺れすぎない）
  if (!WORLD.camReady) { WORLD.camX = P.x * C.followX; WORLD.lookX = P.x * C.lookFollowX; WORLD.camY = C.height; WORLD.camReady = true; }
  WORLD.camX += (P.x * C.followX - WORLD.camX) * kx;
  WORLD.lookX += (P.x * C.lookFollowX - WORLD.lookX) * kx;
  WORLD.camY += (C.height + P.y * C.jumpLift - WORLD.camY) * k;
  let px = WORLD.camX, py = WORLD.camY, pz = P.z + C.back, lx = WORLD.lookX, ly = C.lookY, lz = P.z - C.lookAhead;
  const a = WORLD.viewAz || 0;   // 回り込み角（タイトル画面・クリアの振り返り）。0 なら通常。恐竜のまわりを回り、a が大きいほど火山（後ろ）側から見る
  if (a > 0.001) {
    const O = CFG.orbit, w = smooth01(a / 0.6), u = smooth01((a - 1.2) / 1.7), v = smooth01(a / 0.5);
    px += (P.x + Math.sin(a) * O.R - px) * w; py += (O.h - py) * w; pz += (P.z + Math.cos(a) * O.R - pz) * w;
    const hx = P.x - px, hz = P.z - pz, hl = Math.hypot(hx, hz) || 1;   // カメラから恐竜への向き（横向きに見るときも恐竜を画面の中央に保つ）
    const oy = 2.4 + (O.lookY - 2.4) * u + (WORLD.viewUp || 0) * O.tilt * u, ox = P.x + hx / hl * O.lookAhead * u, oz = P.z + hz / hl * O.lookAhead * u;   // 真横では恐竜を見て、正面に回るほど（その延長の）遠く＝火山を見る
    lx += (ox - lx) * v; ly += (oy - ly) * v; lz += (oz - lz) * v;
  }
  cam.position.set(px, py, pz);
  cam.lookAt(lx, ly, lz);
  const fov = Math.min(C.fovMax, C.fov + (P.speed - CFG.run.baseSpeed) * C.fovSpeed);
  if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
}

// 再スタート用：装飾を初期配置へ、カメラを最初の位置へ
function resetWorld() {
  WORLD.decor.forEach(d => WORLD.place(d, true, 0));
  WORLD.viewAz = 0; WORLD.viewUp = 0; WORLD.camReady = false; WORLD.camera.fov = CFG.cam.fov; WORLD.camera.updateProjectionMatrix();
}
