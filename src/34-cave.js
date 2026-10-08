// ===== 安全地帯：岩山と洞窟（three.js）。ゴール（goal.distance）の少し先に置く。動かない・毎フレームの処理なし =====
// 作り：不規則な岩肌の山（高さの格子＋前面の岩壁）を、頂点カラー（下ほど暗く・上は少し明るく・苔・焦げ跡）で 1 メッシュに。
// 洞窟の入口は左右非対称のゆがんだ楕円で、そのふちを不規則な岩塊（ゆがませた二十面体）と上から垂れる鍾乳石で縁取る。
// 入口の奥は暗く、うっすら光る（奥の淡い光とランプ）。入口まわりには岩の破片、背後には岩山の連なり。ジオメトリは全部まとめて 1 つ。
// 局所座標：入口の面が z=0、奥は -z。中の空間は x∈[-halfW, halfW]・y∈[0, height]・z∈[-length, 0]。
const CAVE = {};

// 入口の形：中心 (cx, cy)、左右で半幅が違う（rxL / rxR）ゆがんだ楕円。θ の方向の「ふちまでの倍率」
const CAVE_OPEN = { cx: 0.6, cy: 5.6, rxL: 9.8, rxR: 8.2, ry: 6.4 };
function caveEdgeScale(t) { return 1 + 0.07 * Math.sin(3 * t + 1.1) + 0.05 * Math.sin(5 * t + 2.3) + 0.03 * Math.sin(8 * t); }
function caveEdgePoint(t, k) { const O = CAVE_OPEN, r = caveEdgeScale(t) * (k || 1); return [O.cx + (Math.cos(t) < 0 ? O.rxL : O.rxR) * Math.cos(t) * r, O.cy + O.ry * Math.sin(t) * r]; }
function caveInside(x, y, k) {   // 点 (x, y) が入口（k 倍に広げたもの）の中か
  const O = CAVE_OPEN, u = (x - O.cx) / (x < O.cx ? O.rxL : O.rxR), v = (y - O.cy) / O.ry, t = Math.atan2(v, u);
  return Math.hypot(u, v) < caveEdgeScale(t) * (k || 1);
}
// 山の高さ H(x, z)：中央は高い台地（洞窟の上を厚く覆う）、左右と奥へなだらかに下る。いくつかの峰とノイズで不規則に
function cvHash(i, j) { const s = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return s - Math.floor(s); }
function cvNoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), fx = x - xi, fz = z - zi, a = fx * fx * (3 - 2 * fx), b = fz * fz * (3 - 2 * fz);
  return cvHash(xi, zi) * (1 - a) * (1 - b) + cvHash(xi + 1, zi) * a * (1 - b) + cvHash(xi, zi + 1) * (1 - a) * b + cvHash(xi + 1, zi + 1) * a * b;
}
function caveHeight(x, z, roof) {
  const ss = (a, b, v) => { const t = Math.max(0, Math.min(1, (v - a) / (b - a))); return t * t * (3 - 2 * t); };
  const ax = Math.abs(x), fx = ss(54, 22, ax), fz = ss(-100, -52, z), base = (roof + 10) * fx * fz;
  const bump = (cx, cz, sx, sz, h) => h * Math.exp(-((x - cx) * (x - cx) / (sx * sx) + (z - cz) * (z - cz) / (sz * sz)));
  const peaks = bump(-6, -26, 14, 16, 15) + bump(14, -36, 12, 14, 11) + bump(-27, -14, 10, 12, 8) + bump(29, -10, 9, 10, 6) + bump(2, -60, 18, 14, 9);
  return Math.max(0, base + peaks * fz * ss(60, 30, ax) + (cvNoise(x * 0.09, z * 0.09) - 0.5) * 7 * fx + (cvNoise(x * 0.31 + 5, z * 0.31) - 0.5) * 2.2 * fx);
}

function buildCave() {
  const K = CFG.clear.cave, L = K.length, HW = K.halfW, HT = K.height, scene = WORLD.scene, c = new THREE.Color();
  const g = new THREE.Group(); g.position.set(0, 0, -(CFG.goal.distance + K.mouth)); scene.add(g);
  let sd = 4242; const R = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; }, RR = (a, b) => a + R() * (b - a);
  // 岩肌の色：下ほど暗く（すすけた茶）、上へ少し明るい灰褐色。ところどころ苔（緑がかった）と焦げ跡（黒・赤茶）
  const paintRock = (col, p, ny) => {
    const h = Math.max(0, Math.min(1, p.y / 30)), n = cvNoise(p.x * 0.22 + 9, p.z * 0.22 + p.y * 0.2);
    col.setHex(0x2c2420).lerp(c.setHex(0x6c5f57), 0.15 + 0.85 * h);
    if (ny > 0.35 && p.y < 15 && n > 0.56) col.lerp(c.setHex(0x44502c), Math.min(0.75, (n - 0.56) * 4));   // 上向きの面にだけ苔
    const soot = cvNoise(p.x * 0.5 + 40, p.y * 0.35 + p.z * 0.3);
    if (soot > 0.66) col.lerp(c.setHex(0x120c0a), Math.min(0.7, (soot - 0.66) * 5));                          // 焦げ跡
    else if (soot < 0.2 && p.y < 10) col.lerp(c.setHex(0x5a3524), (0.2 - soot) * 2.5);                       // 焼けた赤茶
  };

  // 1) 山の上面（高さの格子）
  const ROOF = HT, X0 = -80, X1 = 80, Z0 = 0, Z1 = -112, NX = 80, NZ = 28, pos = [], col = [], idx = [], P = new THREE.Vector3(), tmpC = new THREE.Color();
  for (let j = 0; j <= NZ; j++) for (let i = 0; i <= NX; i++) {
    const x = X0 + (X1 - X0) * i / NX, z = Z0 + (Z1 - Z0) * j / NZ, y = caveHeight(x, z, ROOF);
    pos.push(x, y, z); P.set(x, y, z); paintRock(tmpC, P, 0.6); col.push(tmpC.r, tmpC.g, tmpC.b);
  }
  for (let j = 0; j < NZ; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + 1, d = a + NX + 1, e = d + 1; idx.push(a, b, d, b, e, d); }
  // 2) 前面の岩壁（入口のある面）：地面から山の高さまでの縦の格子。入口にかかるところは取り除く。壁は凸凹に前後にゆがめる
  const WS = 2, wx0 = -56, wx1 = 56, ROWS = 13, wbase = pos.length / 3, wcols = (wx1 - wx0) / WS;
  for (let i = 0; i <= wcols; i++) {
    const x = wx0 + i * WS, H = caveHeight(x, 0, ROOF);
    for (let r = 0; r <= ROWS; r++) {
      const y = H * r / ROWS, z = r === ROWS ? 0 : (cvNoise(x * 0.35, y * 0.35) - 0.5) * 3.2 + (cvNoise(x * 1.3 + 8, y * 1.3) - 0.5) * 0.8;
      pos.push(x, y, z); P.set(x, y, z); paintRock(tmpC, P, 0); col.push(tmpC.r, tmpC.g, tmpC.b);
    }
  }
  for (let i = 0; i < wcols; i++) {
    const H = caveHeight(wx0 + i * WS, 0, ROOF), H2 = caveHeight(wx0 + (i + 1) * WS, 0, ROOF);
    if (H < 0.4 && H2 < 0.4) continue;
    for (let r = 0; r < ROWS; r++) {
      const a = wbase + i * (ROWS + 1) + r, b = a + 1, d = a + ROWS + 1, e = d + 1, y = pos[a * 3 + 1], x = pos[a * 3];
      const ys = [pos[a * 3 + 1], pos[b * 3 + 1], pos[d * 3 + 1], pos[e * 3 + 1]], xs = [pos[a * 3], pos[b * 3], pos[d * 3], pos[e * 3]];
      let cut = false; for (let q = 0; q < 4; q++) if (caveInside(xs[q], ys[q], 1.04)) cut = true;
      if (cut || (y < 0.01 && pos[b * 3 + 1] < 0.01)) continue;
      idx.push(a, d, b, d, e, b);   // 壁は +z（外）向きが表
    }
  }
  const main = new THREE.BufferGeometry();
  main.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); main.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); main.setIndex(idx); main.computeVertexNormals();

  // 3) 入口のふちの岩塊・上から垂れる鍾乳石・まわりの岩の破片・背後の岩山の連なり（ゆがませた二十面体や円すいを、頂点カラーで 1 つにまとめる）
  const ico = new THREE.IcosahedronGeometry(1, 1), cone = new THREE.ConeGeometry(1, 1, 5), parts = [], O = CAVE_OPEN;
  const rockCols = [0x4a3f39, 0x57493f, 0x3a312d, 0x625448];
  const darkIn = (cc, v) => { if (v.z < 0.5) cc.multiplyScalar(0.55 + 0.45 * Math.max(0, Math.min(1, (v.z + 6) / 6.5))); };   // 入口の内側へ入るほど暗く
  const N = 26;
  for (let i = 0; i < N; i++) {   // ふちの岩塊（不規則な大きさ。ふちの外側へ少しずらし、一部は内側へ張り出す）
    const t = (i + RR(-0.3, 0.3)) / N * Math.PI * 2, pt = caveEdgePoint(t), nx = (pt[0] - O.cx) / O.rxR, ny = (pt[1] - O.cy) / O.ry, nl = Math.hypot(nx, ny) || 1;
    if (pt[1] < 0.3 && Math.sin(t) < -0.2) continue;   // 地面より下
    const top = Math.sin(t) > 0.35, s = RR(1.7, 3.0) * (top ? 1.25 : 1), out = s * 0.4;
    let bx = pt[0] + nx / nl * out; const by = Math.max(s * 0.35, pt[1] + ny / nl * out);
    if (by < s * 1.6 + 3.5) { const need = CFG.move.maxX + 0.3 + s * 1.6; if (Math.abs(bx) < need) bx = (bx < 0 ? -1 : 1) * need; }   // 低い岩塊は、走れる範囲（move.maxX）の外へ寄せる（入口の足もとを塞がない）
    parts.push({ geo: ico, pos: [bx, by, RR(-0.8, 1.6)], rot: [R() * 3, R() * 3, R() * 3], scl: [s * RR(0.9, 1.3), s * RR(0.8, 1.1), s * RR(1.0, 1.5)], color: rockCols, jit: s * 0.45, shade: 0.35, paint: darkIn });
  }
  for (let i = 0; i < 5; i++) {   // 入口の上の岩の庇（ひさし）：手前へ張り出す大きめの岩
    const t = (0.28 + i * 0.12) * Math.PI + RR(-0.05, 0.05), pt = caveEdgePoint(t), s = RR(2.8, 3.8);
    parts.push({ geo: ico, pos: [pt[0] + RR(-0.5, 0.5), pt[1] + s * 0.55, RR(0.8, 2.4)], rot: [R() * 3, R() * 3, R() * 3], scl: [s * 1.3, s * 0.8, s * 1.2], color: rockCols, jit: s * 0.5, shade: 0.35, paint: darkIn });
  }
  for (let i = 0; i < 11; i++) {   // 鍾乳石（入口の上のふちから垂れ下がる）
    const t = (0.16 + (i + RR(0.1, 0.9)) / 11 * 0.68) * Math.PI, pt = caveEdgePoint(t, 0.97), len = RR(0.8, 2.6), r = RR(0.22, 0.5);
    parts.push({ geo: cone, pos: [pt[0], pt[1] - len / 2 + 0.2, RR(-0.2, 0.9)], rot: [Math.PI + RR(-0.1, 0.1), 0, RR(-0.1, 0.1)], scl: [r, len, r], color: [0x8a7c6e, 0x756a5e, 0x9a8c7c], jit: 0.05, shade: 0.2 });
  }
  for (let i = 0; i < 16; i++) {   // 入口まわりに転がった大小の岩（コースの外側だけ）
    const side = i % 2 ? 1 : -1, s = RR(0.5, 2.1), x = side * (CFG.move.maxX + 1.8 + s * 1.2 + RR(0, 12)), z = RR(2.5, 20);
    parts.push({ geo: ico, pos: [x, s * 0.4, z], rot: [R() * 3, R() * 3, R() * 3], scl: [s * RR(0.9, 1.4), s * RR(0.6, 1.0), s * RR(0.9, 1.4)], color: rockCols, jit: s * 0.35, shade: 0.35 });
  }
  for (let i = 0; i < 34; i++) {   // 岩の破片
    const side = i % 2 ? 1 : -1, s = RR(0.15, 0.5), x = side * (CFG.move.maxX + 1.2 + s + RR(0, 15)), z = RR(1.5, 24);
    parts.push({ geo: ico, pos: [x, s * 0.3, z], rot: [R() * 3, R() * 3, R() * 3], scl: [s * RR(0.9, 1.5), s * RR(0.5, 0.9), s * RR(0.9, 1.5)], color: rockCols, jit: s * 0.3, shade: 0.4 });
  }
  for (let i = 0; i < 9; i++) {   // 背後の岩山の連なり（霧で青白くかすむ遠景）
    const s = RR(16, 30), x = -110 + i * 27 + RR(-8, 8), z = RR(-150, -125);
    parts.push({ geo: ico, pos: [x, s * 0.3, z], rot: [R() * 3, R() * 3, R() * 3], scl: [s * RR(1.2, 1.8), s * RR(0.9, 1.5), s * RR(1.0, 1.5)], color: [0x4a3f3c, 0x554842], jit: s * 0.4, shade: 0.2 });
  }
  const props = gmParts(parts, 77);
  const rockMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true });
  g.add(new THREE.Mesh(main, rockMat), new THREE.Mesh(props, rockMat));

  // 4) 中の空間：暗い岩の殻（内側だけ見える）。前の面は入口の形に穴をあけ、地面側の面は使わない（ground が床）
  const inner = new THREE.MeshLambertMaterial({ color: 0x241a16, side: THREE.BackSide, flatShading: true }), none = new THREE.MeshBasicMaterial({ visible: false });
  const hallGeo = new THREE.BoxGeometry(2 * HW, HT, L, 6, 2, 8), hp = hallGeo.attributes.position;
  for (let i = 0; i < hp.count; i++) {   // 奥・天井・壁を少しでこぼこに（入口の面は触らない）
    const x = hp.getX(i), y = hp.getY(i), z = hp.getZ(i);
    if (z > L / 2 - 0.01 || y < -HT / 2 + 0.01) continue;
    const d = (cvNoise(x * 0.4 + 3, y * 0.4 + z * 0.3) - 0.5) * 2.4; hp.setXYZ(i, x - Math.sign(x) * (Math.abs(x) > HW - 0.1 ? Math.abs(d) : 0), y - (y > HT / 2 - 0.1 ? Math.abs(d) : 0), z + (z < -L / 2 + 0.1 ? Math.abs(d) : 0));
  }
  hallGeo.computeVertexNormals();
  const hall = new THREE.Mesh(hallGeo, [inner, inner, inner, none, none, inner]);   // +x, -x, +y, -y(床), +z(入口の面), -z
  hall.position.set(0, HT / 2, -L / 2 - 1.5); g.add(hall);
  const sh = new THREE.Shape(); sh.moveTo(-HW, 0); sh.lineTo(HW, 0); sh.lineTo(HW, HT); sh.lineTo(-HW, HT); sh.lineTo(-HW, 0);
  const hole = new THREE.Path(); for (let i = 0; i <= 28; i++) { const pt = caveEdgePoint(i / 28 * Math.PI * 2, 0.96); if (i) hole.lineTo(Math.max(-HW + 0.3, Math.min(HW - 0.3, pt[0])), Math.max(0.01, Math.min(HT - 0.3, pt[1]))); else hole.moveTo(pt[0], Math.max(0.01, pt[1])); }
  sh.holes.push(hole);
  const face = new THREE.Mesh(new THREE.ShapeGeometry(sh), inner); face.position.set(0, 0, -1.5); g.add(face);   // 入口の内側の壁（穴つき）

  // 5) 奥の淡い光とランプ：出口の方向のような、うっすらした暖色の光
  const soft = makeSoftTexture();
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, color: 0xffa860, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0.38 }));
  glow.position.set(0, 4.5, -L + 3); glow.scale.set(22, 12, 1); g.add(glow);
  const lampMat = new THREE.MeshBasicMaterial({ color: 0xffd9a0 }), lampGeo = new THREE.IcosahedronGeometry(0.32, 0), lampSpr = new THREE.SpriteMaterial({ map: soft, color: 0xffb060, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0.55 });
  [[-12.5, 7.2, -10], [13, 6.2, -24], [-8, 5.4, -36]].forEach(p => {
    const l = new THREE.Mesh(lampGeo, lampMat); l.position.set(p[0], p[1], p[2]); g.add(l);
    const s = new THREE.Sprite(lampSpr); s.position.copy(l.position); s.scale.set(6, 6, 1); g.add(s);
  });
  // 中の地面は少し暗く（外は明るい荒野、中は日陰）
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(2 * HW, L), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  shade.rotation.x = -Math.PI / 2; shade.position.set(0, 0.04, -L / 2 - 1.5); g.add(shade);
  CAVE.group = g; CAVE.tris = (main.index.count + props.attributes.position.count) / 3;
}
