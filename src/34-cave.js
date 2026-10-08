// ===== 安全地帯：大きな岩山と洞窟（three.js）。ゴール（goal.distance）の少し先に置く。動かない・毎フレームの処理なし =====
// 局所座標：入口の面が z=0、奥は -z。中の空間は x∈[-halfW, halfW]・y∈[0, height]・z∈[-length, 0]。左右・天井・奥の岩のかたまりが囲み、その上に山をのせる。
const CAVE = {};

function buildCave() {
  const K = CFG.clear.cave, L = K.length, HW = K.halfW, HT = K.height, MS = K.mass, RH = 22, SH = HT + RH, scene = WORLD.scene;
  const outer = new THREE.MeshLambertMaterial({ color: 0x4d4440, flatShading: true });
  const outer2 = new THREE.MeshLambertMaterial({ color: 0x5f524b, flatShading: true });
  const inner = new THREE.MeshLambertMaterial({ color: 0x1f1613, flatShading: true });
  const black = new THREE.MeshBasicMaterial({ color: 0x050202 });
  const g = new THREE.Group(); g.position.set(0, 0, -(CFG.goal.distance + K.mouth)); scene.add(g);
  const box = (w, h, d, x, y, z, mats) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mats); m.position.set(x, y, z); g.add(m); return m; };
  const o = outer;   // 面の順：+x, -x, +y, -y, +z, -z。中に向く面だけ暗くする
  box(MS, SH, L + 12, -(HW + MS / 2), SH / 2, -(L + 12) / 2 + 6, [inner, o, o, o, o, o]);     // 左の岩山（中に向く面は +x）
  box(MS, SH, L + 12, HW + MS / 2, SH / 2, -(L + 12) / 2 + 6, [o, inner, o, o, o, o]);        // 右の岩山（中に向く面は -x）
  box(2 * (HW + MS), RH, L + 12, 0, HT + RH / 2, -(L + 12) / 2 + 6, [o, o, o, inner, o, o]);   // 天井（中に向く面は -y）
  box(2 * (HW + MS), SH, 10, 0, SH / 2, -(L + 5), [o, o, o, o, black, o]);                    // 奥の壁（中に向く面は +z）
  // 山：平たい円すいを重ねて、岩山らしいシルエットに
  const peak = new THREE.Mesh(new THREE.ConeGeometry(52, 48, 9, 1), outer2); peak.scale.z = 0.62; peak.position.set(0, HT + RH + 24 - 1, -L / 2 - 6); peak.rotation.y = 0.3; g.add(peak);
  const peak2 = new THREE.Mesh(new THREE.ConeGeometry(30, 62, 7, 1), outer); peak2.scale.z = 0.7; peak2.position.set(-12, HT + RH + 30, -L / 2 - 14); peak2.rotation.y = 1.1; g.add(peak2);
  const rockGeo = new THREE.DodecahedronGeometry(1, 0);
  const boulder = (x, y, z, sx, sy, sz, r, m) => { const b = new THREE.Mesh(rockGeo, m || outer); b.position.set(x, y, z); b.scale.set(sx, sy, sz); b.rotation.set(r, r * 1.7, r * 0.6); g.add(b); };
  boulder(-10, HT + 1.2, 1, 8, 3.4, 6, 1.1); boulder(1, HT + 2.2, 0, 9, 3.2, 5, 2.3, outer2); boulder(11, HT + 1, 1, 8, 3.4, 6, 0.4);   // 入口の上の岩（アーチ）
  boulder(-(HW + 4), 3, 4, 7, 6, 7, 0.7, outer2); boulder(-(HW + 14), 4.5, 10, 9, 8, 8, 1.9); boulder(HW + 4, 3, 4, 7, 6, 7, 2.9); boulder(HW + 15, 4, 9, 8, 7, 8, 1.2, outer2);   // 入口の両脇の大岩
  boulder(-(HW + 24), 3, -4, 9, 5, 9, 0.2); boulder(HW + 24, 3, -2, 9, 5, 9, 1.6, outer2);
  // 中の地面は少し暗く（外は明るい荒野、中は日陰）
  const shade = new THREE.Mesh(new THREE.PlaneGeometry(2 * HW, L), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.5, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 }));
  shade.rotation.x = -Math.PI / 2; shade.position.set(0, 0.04, -L / 2); g.add(shade);
  CAVE.group = g;
}
