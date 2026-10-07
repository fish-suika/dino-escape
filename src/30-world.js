// ===== 3D ステージ：空・フォグ・地面・装飾・カメラ =====
const WORLD = {};

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

  Object.assign(WORLD, { renderer, scene, camera, ground, gtex, decor, place, camX: 0, lookX: 0, camReady: false });
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
  WORLD.decor.forEach(d => { if (d.mesh.position.z > P.z + W.spawnBehind) WORLD.place(d, false, P.z); });

  // カメラ：後方上から見下ろす。横と高さはなめらかに追従、前後は一定距離
  const k = 1 - Math.exp(-C.follow * dt);
  if (!WORLD.camReady) { WORLD.camX = P.x * C.followX; WORLD.lookX = P.x * C.lookFollowX; WORLD.camY = C.height; WORLD.camReady = true; }
  WORLD.camX += (P.x * C.followX - WORLD.camX) * k;
  WORLD.lookX += (P.x * C.lookFollowX - WORLD.lookX) * k;
  WORLD.camY += (C.height + P.y * C.jumpLift - WORLD.camY) * k;
  cam.position.set(WORLD.camX, WORLD.camY, P.z + C.back);
  cam.lookAt(WORLD.lookX, C.lookY, P.z - C.lookAhead);
  const fov = Math.min(C.fovMax, C.fov + (P.speed - CFG.run.baseSpeed) * C.fovSpeed);
  if (Math.abs(cam.fov - fov) > 0.01) { cam.fov = fov; cam.updateProjectionMatrix(); }
}

// 再スタート用：装飾を初期配置へ、カメラを最初の位置へ
function resetWorld() {
  WORLD.decor.forEach(d => WORLD.place(d, true, 0));
  WORLD.camReady = false; WORLD.camera.fov = CFG.cam.fov; WORLD.camera.updateProjectionMatrix();
}
