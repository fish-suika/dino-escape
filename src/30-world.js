// ===== 3D ステージ：空・フォグ・地面・道（足跡と轍）・装飾・カメラ =====
const WORLD = {};
const ROAD = { w: 17, len: 400, period: 32, ahead: 140 };   // 地面に貼る「踏み固められた道」の板：幅 / 長さ / 模様 1 周の長さ / 先へ伸ばす中心のずれ
const PEBBLE = { period: 100, copies: 3 };                  // 仕切りの小石・灰の盛り上がり：1 かたまりの長さ / 使い回す数（手前に来たら先へ送る）

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

// 道の模様：区切り線は使わず、3 本の「踏み固められた灰の筋」（ふちは細かい点のノイズでぼかす）・浅い轍・足跡、レーンの間の灰の盛り上がりと小石、外側の荒れた地面を描く。
// 上下（走る向き）はつなぎ目なく繰り返す。x は -w/2〜w/2（レーン中心は -4.5 / 0 / +4.5）
function makeRoadTexture() {
  const W = 512, H = 1024, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  let sd = 20231; const R = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  const gauss = () => (R() + R() + R() + R() - 2) * 1.2;
  const ux = x => (x + ROAD.w / 2) * W / ROAD.w, TAU = Math.PI * 2;
  const dab = (x, y, rx, ry, col, a) => {
    for (const yy of [y, y + H, y - H]) {
      if (yy < -ry - 2 || yy > H + ry + 2) continue;
      g.fillStyle = 'rgba(' + col + ',' + a + ')'; g.beginPath(); g.ellipse(x, yy, rx, ry, 0, 0, 7); g.fill();
    }
  };
  const pebble = (x, y, s) => {
    const cols = ['120,110,102', '92,82,76', '146,136,126', '104,92,84'];
    dab(x + 1.2, y + 1.4, s * 1.1, s * 0.8, '28,22,18', 0.35);
    dab(x, y, s, s * (0.7 + R() * 0.25), cols[(R() * cols.length) | 0], 0.9);
    dab(x - s * 0.3, y - s * 0.3, s * 0.45, s * 0.3, '205,195,182', 0.35);
  };
  const lanes = [-CFG.lane.width, 0, CFG.lane.width];
  for (const cx of lanes) {   // 踏み固められた灰の筋（中心が濃く、ふちは細かい点でぼやける）
    for (let i = 0; i < 2600; i++) dab(ux(cx + gauss() * 1.05), R() * H, 2 + R() * 6, (2 + R() * 6) * 0.9, '152,138,126', 0.04 + R() * 0.07);
    for (let i = 0; i < 70; i++) dab(ux(cx + gauss() * 0.9), R() * H, 16 + R() * 26, 20 + R() * 30, '140,128,118', 0.03 + R() * 0.02);
    for (let i = 0; i < 520; i++) dab(ux(cx + gauss() * 1.15), R() * H, 2 + R() * 3, 2 + R() * 3, '66,54,48', 0.05 + R() * 0.05);
    const ph = cx * 1.7;
    for (const side of [-1, 1]) {   // 浅い轍（とぎれとぎれ・ゆるくゆれる。完全には平行にならない）
      const xr = cx + side * 0.85;
      for (let y = 0; y < H; y += 5) {
        const n = Math.sin(TAU * 3 * y / H + ph + side) * 0.16 + Math.sin(TAU * 13 * y / H + ph) * 0.05;
        const on = Math.sin(TAU * 5 * y / H + ph * 3 + side * 2) + Math.sin(TAU * 17 * y / H + side * 3 + ph) > -0.75;
        if (!on) continue;
        dab(ux(xr + n), y, 3 + R() * 2.6, 5.5, '46,36,32', 0.14 + R() * 0.08);
        dab(ux(xr + n + side * 0.3), y, 2 + R() * 2, 5, '176,162,148', 0.05 + R() * 0.04);
      }
    }
    for (let i = 0; i < 14; i++) {   // 足跡（3 本指）
      const x = ux(cx + (R() - 0.5) * 2.4), y = R() * H;
      dab(x, y, 3.4, 4.4, '44,34,30', 0.24);
      for (const dx of [-3.4, 0, 3.4]) dab(x + dx, y - 7.5, 1.7, 2.8, '44,34,30', 0.22);
    }
  }
  for (const bx of [-CFG.lane.width / 2, CFG.lane.width / 2]) {   // レーンの間：低い灰の盛り上がりと小石の列
    for (let i = 0; i < 900; i++) dab(ux(bx + gauss() * 0.2), R() * H, 2 + R() * 4, 2 + R() * 5, '172,159,146', 0.05 + R() * 0.07);
    for (let i = 0; i < 70; i++) pebble(ux(bx + gauss() * 0.28), R() * H, 2 + R() * 3.6);
  }
  for (const ex of [-CFG.move.maxX, CFG.move.maxX]) {   // 外側：荒れた地面（暗い土のこすれと大きめの石）
    for (let i = 0; i < 900; i++) dab(ux(ex + gauss() * 0.5), R() * H, 2 + R() * 6, 2 + R() * 7, '58,47,42', 0.04 + R() * 0.06);
    for (let i = 0; i < 90; i++) pebble(ux(ex + gauss() * 0.7), R() * H, 2.5 + R() * 5);
    for (let i = 0; i < 40; i++) dab(ux(ex + Math.sign(ex) * (0.9 + R() * 1.4)), R() * H, 4 + R() * 12, 6 + R() * 14, '150,138,128', 0.03 + R() * 0.03);
  }
  g.globalCompositeOperation = 'destination-in';   // 左右のはしは透明へ溶かす
  const fade = g.createLinearGradient(0, 0, W, 0);
  fade.addColorStop(0, 'rgba(0,0,0,0)'); fade.addColorStop(ux(-7.2) / W, 'rgba(0,0,0,1)'); fade.addColorStop(ux(7.2) / W, 'rgba(0,0,0,1)'); fade.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = fade; g.fillRect(0, 0, W, H);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(1, ROAD.len / ROAD.period);
  t.anisotropy = 8; return t;
}

// いくつかのパーツ（Geometry）を 1 つの頂点カラーつきジオメトリにまとめる（面ごとに色を少し変えて角ばった岩肌に）。
// parts = [{ geo, pos, rot, scl, color: 0xRRGGBB か その配列, jit: 頂点のゆがみ(u・変形後の大きさ), shade: 色のむら, paint: (color, 世界座標 v) => void }]。同じ位置の頂点は同じだけずらす（割れない）
function gmParts(parts, seed) {
  const pos = [], col = [], c = new THREE.Color(), m = new THREE.Matrix4(), e = new THREE.Euler(), q = new THREE.Quaternion(), v = new THREE.Vector3();
  let sd = seed || 7; const R = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  for (const p of parts) {
    const g = p.geo.index ? p.geo.toNonIndexed() : p.geo.clone(), pa = g.attributes.position, jit = p.jit || 0, cache = new Map(), cols = Array.isArray(p.color) ? p.color : [p.color];
    m.compose(new THREE.Vector3().fromArray(p.pos || [0, 0, 0]), q.setFromEuler(e.set(...(p.rot || [0, 0, 0]))), new THREE.Vector3().fromArray(p.scl || [1, 1, 1]));
    for (let i = 0; i < pa.count; i += 3) {
      c.setHex(cols[(R() * cols.length) | 0]); const sh = 1 + (R() - 0.5) * (p.shade == null ? 0.2 : p.shade);
      for (let j = 0; j < 3; j++) {
        v.set(pa.getX(i + j), pa.getY(i + j), pa.getZ(i + j));
        const key = Math.round(v.x * 500) + ',' + Math.round(v.y * 500) + ',' + Math.round(v.z * 500);   // 同じ位置の頂点は同じだけずらす（変形前の座標で判定）
        v.applyMatrix4(m);
        if (jit) {
          let o = cache.get(key); if (!o) { o = [(R() - 0.5) * jit, (R() - 0.5) * jit, (R() - 0.5) * jit]; cache.set(key, o); }
          v.x += o[0]; v.y += o[1]; v.z += o[2];   // ゆがみは変形後の大きさ（u）で与える
        }
        pos.push(v.x, v.y, v.z);
        const cc = c.clone().multiplyScalar(sh); if (p.paint) p.paint(cc, v); col.push(cc.r, cc.g, cc.b);
      }
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  geo.computeVertexNormals(); return geo;
}

// 道のふちの枯れ木（焦げた幹と折れた枝）。横の張り出し（半径）も返す
function buildTreeGeo() {
  const dark = [0x1d1613, 0x251a15, 0x16100d];
  const geo = gmParts([
    { geo: new THREE.CylinderGeometry(0.1, 0.28, 4.4, 5, 2), pos: [0, 2.2, 0], color: dark, jit: 0.1 },
    { geo: new THREE.CylinderGeometry(0.03, 0.11, 2.0, 4, 1), pos: [0.55, 3.2, 0], rot: [0, 0, -0.95], color: dark, jit: 0.05 },
    { geo: new THREE.CylinderGeometry(0.03, 0.09, 1.7, 4, 1), pos: [-0.5, 2.6, 0.25], rot: [0.3, 0, 0.85], color: dark, jit: 0.05 },
    { geo: new THREE.CylinderGeometry(0.02, 0.07, 1.2, 4, 1), pos: [0.15, 4.3, -0.2], rot: [-0.4, 0, -0.35], color: dark, jit: 0.04 },
    { geo: new THREE.ConeGeometry(0.34, 0.7, 5), pos: [0, 0.15, 0], color: [0x2b1d16, 0x33231a], jit: 0.08 }   // 根もとの広がり
  ], 41);
  geo.computeBoundingBox(); const b = geo.boundingBox;
  return { geo, ext: Math.hypot(Math.max(Math.abs(b.min.x), Math.abs(b.max.x)), Math.max(Math.abs(b.min.z), Math.abs(b.max.z))) };   // 水平の最大の張り出し（どの向きに回しても、回した箱の外にも出ない保守的な値）
}

// レーンの間・外側に置く小石（1 かたまり = PEBBLE.period の長さ。使い回す。灰の盛り上がりは道のテクスチャ側）
function buildPebbleGeo() {
  let sd = 99; const R = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  const gz = () => (R() + R() + R() - 1.5) * 0.9, parts = [], ico = new THREE.IcosahedronGeometry(1, 0);
  const lines = [[-CFG.lane.width / 2, 30, 0.9], [CFG.lane.width / 2, 30, 0.9], [-CFG.move.maxX - 0.3, 24, 1.3], [CFG.move.maxX + 0.3, 24, 1.3]];
  for (const [bx, n, sz] of lines) {
    for (let i = 0; i < n; i++) {   // 小石
      const s = (0.07 + R() * 0.2) * sz, x = bx + gz() * 0.45, z = -R() * PEBBLE.period;
      parts.push({ geo: ico, pos: [x, s * 0.3, z], rot: [R() * 3, R() * 3, R() * 3], scl: [s * (0.8 + R() * 0.7), s * 0.7, s * (0.8 + R() * 0.7)], color: [0x7d726a, 0x5c524c, 0x948a80, 0x6a5e56], jit: s * 0.3 });
    }
  }
  return gmParts(parts, 5);
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

  // 道：区切り線は使わない。灰の筋・轍・足跡を地面に貼った板（地面と同じ速さで流れる）と、レーンの間・外側の小石と灰の盛り上がり
  const rtex = makeRoadTexture();
  const road = new THREE.Mesh(new THREE.PlaneGeometry(ROAD.w, ROAD.len), new THREE.MeshLambertMaterial({ map: rtex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  road.rotation.x = -Math.PI / 2; road.position.y = 0.02; scene.add(road);
  const pebMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), pebGeo = buildPebbleGeo();
  const pebbles = [];
  for (let i = 0; i < PEBBLE.copies; i++) { const m = new THREE.Mesh(pebGeo, pebMat); scene.add(m); pebbles.push(m); }

  // 装飾（岩・丘・道のふちの小岩・枯れ木・灰の吹き溜まり）。障害物ではなく見た目だけ。
  // どれも「道側のふち」が走れる範囲（move.maxX）の外にくるように中心を決める（place）。大きさ ext は横の半幅（高さ方向の張り出しも含む保守的な値）
  const rockMat = new THREE.MeshLambertMaterial({ color: 0x4d4440, flatShading: true });
  const rockMat2 = new THREE.MeshLambertMaterial({ color: 0x5f524b, flatShading: true });
  const hillMat = new THREE.MeshLambertMaterial({ color: 0x564a45, flatShading: true });
  const driftMat = new THREE.MeshLambertMaterial({ color: 0x796d65, flatShading: true });
  const treeMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), TR = buildTreeGeo();
  const decor = [], dodeca = new THREE.DodecahedronGeometry(1, 0), sphereGeo = new THREE.SphereGeometry(1, 7, 4, 0, Math.PI * 2, 0, Math.PI / 2);
  function place(d, initial, pz) {
    const side = Math.random() < 0.5 ? -1 : 1;
    d.mesh.position.x = side * (decorMinX(d.ext, d.gap) + rnd(0, d.range));
    d.mesh.position.z = initial ? pz + rnd(W.spawnBehind, -W.spawnAhead) : pz - W.spawnAhead - rnd(0, 30);
  }
  const addDecor = (m, ext, gap, range) => { scene.add(m); decor.push({ mesh: m, ext, gap, range }); };
  for (let i = 0; i < W.rocks; i++) {   // 大きめの岩（道から離れた外側）
    const s = rnd(0.8, 3.2), m = new THREE.Mesh(dodeca, Math.random() < 0.5 ? rockMat : rockMat2);
    m.scale.set(s * rnd(0.8, 1.4), s * rnd(0.6, 1.1), s * rnd(0.8, 1.4)); m.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3)); m.position.y = s * 0.35;
    addDecor(m, Math.hypot(m.scale.x, m.scale.y, m.scale.z), W.decorGap, W.spread * 0.5);
  }
  for (let i = 0; i < W.hills; i++) {   // 遠い低い丘（横に広いので、ふちがレーンにかからないよう中心を遠くへ）
    const s = rnd(7, 15), m = new THREE.Mesh(sphereGeo, hillMat);
    m.scale.set(s * rnd(1.2, 2), s * rnd(0.25, 0.5), s * rnd(1, 1.6)); m.rotation.y = rnd(0, 3);
    addDecor(m, Math.hypot(m.scale.x, m.scale.z), W.decorGap, W.spread);
  }
  for (let i = 0; i < W.verge; i++) {   // 道のふちの小岩（道の縁を自然に区切る）
    const s = rnd(0.35, 1.15), m = new THREE.Mesh(dodeca, Math.random() < 0.5 ? rockMat : rockMat2);
    m.scale.set(s * rnd(0.8, 1.5), s * rnd(0.5, 1.0), s * rnd(0.8, 1.5)); m.rotation.set(rnd(0, 3), rnd(0, 3), rnd(0, 3)); m.position.y = s * 0.3;
    addDecor(m, Math.hypot(m.scale.x, m.scale.y, m.scale.z), W.vergeGap, 5);
  }
  for (let i = 0; i < W.trees; i++) {   // 道のふちの枯れ木
    const k = rnd(0.7, 1.4), m = new THREE.Mesh(TR.geo, treeMat);
    m.scale.setScalar(k); m.rotation.y = rnd(0, 6.28);
    addDecor(m, TR.ext * k, W.vergeGap, 7);
  }
  for (let i = 0; i < 14; i++) {   // 灰の吹き溜まり
    const m = new THREE.Mesh(sphereGeo, driftMat);
    m.scale.set(rnd(2.2, 4.5), rnd(0.3, 0.55), rnd(1.5, 3)); m.rotation.y = rnd(0, 3);
    addDecor(m, Math.hypot(m.scale.x, m.scale.z), W.vergeGap, 6);
  }
  decor.forEach(d => place(d, true, 0));

  Object.assign(WORLD, { renderer, scene, camera, ground, gtex, road, rtex, pebbles, decor, place, camX: 0, lookX: 0, camReady: false });
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
  WORLD.road.position.z = P.z - ROAD.ahead; WORLD.rtex.offset.y = P.dist / ROAD.period;   // 道の模様も地面と同じ向き・同じ速さ（先の方まで伸ばす）
  const base = Math.floor(P.z / PEBBLE.period) * PEBBLE.period;   // 小石の列は動かず、手前を過ぎたものを先へ送る
  WORLD.pebbles.forEach((m, i) => { m.position.z = base + (1 - i) * PEBBLE.period; });
  WORLD.decor.forEach(d => { if (d.mesh.position.z > P.z + W.spawnBehind) WORLD.place(d, false, P.z); });

  // カメラ：後方上から見下ろす。横と高さはなめらかに追従、前後は一定距離
  const k = 1 - Math.exp(-C.follow * dt), kx = 1 - Math.exp(-C.followXSpeed * dt);   // 横はゆっくり（レーン移動で画面が揺れすぎない）
  if (!WORLD.camReady) { WORLD.camX = P.x * C.followX; WORLD.lookX = P.x * C.lookFollowX; WORLD.camY = C.height; WORLD.camReady = true; }
  WORLD.camX += (P.x * C.followX - WORLD.camX) * kx;
  WORLD.lookX += (P.x * C.lookFollowX - WORLD.lookX) * kx;
  WORLD.camY += (C.height + P.y * 0.2 - WORLD.camY) * k;   // 吹き飛ばされて浮いたときだけ、わずかに追う
  let px = WORLD.camX, py = WORLD.camY, pz = P.z + C.back, lx = WORLD.lookX, ly = C.lookY, lz = P.z - C.lookAhead;
  const a = WORLD.viewAz || 0;   // 回り込み角（タイトル画面・クリアの振り返り）。0 なら通常。恐竜のまわりを回り、a が大きいほど火山（後ろ）側から見る
  if (a > 0.001) {
    const O = WORLD.viewClear ? CFG.clear.cam : CFG.orbit, w = smooth01(a / 0.6), u = smooth01((a - 1.2) / 1.7), v = smooth01(a / 0.5);
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
  WORLD.viewAz = 0; WORLD.viewUp = 0; WORLD.viewClear = false; WORLD.camReady = false; WORLD.camera.fov = CFG.cam.fov; WORLD.camera.updateProjectionMatrix();
}
