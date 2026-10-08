// ===== 障害物の見た目：岩・倒木・クレーター・マグマ溜まり・くぐるアーチ（three.js） =====
// 状態（どこに何があるか）は 28-obstacle-logic.js の OB.list が持つ。ここはメッシュを使い回して映すだけ。
// ジオメトリ・マテリアルは種類ごとに 1 つを共有し、プール（固定数のスロット）を貸し借りする。毎フレーム新しく作らない。
const OBS = { frame: 0, T: 0, byId: new Map(), pools: {} };
// ===== くぐるための頭上の障害物（アーチ）の形：噴火の荒野に合う 2 種類 =====
// 共通：下（足元〜梁の下端 clear）はぽっかり空いていて向こう側が見える。支えは「レーンの境目か、その外側」にだけ立つ（走るレーン中心から ±runHalf には入らない。柱自体に当たり判定は無い）。
// 梁の上と下の縁にだけ、赤熱した亀裂（発光）を入れて「頭上に危険がある」と分かるようにする。亀裂は別メッシュ（発光色）。
//   T「傾いた焦げた大木」: 道の外の根もとから斜めに伸びた幹が、道をまたぐ幹を支え、幹の反対の端は道の外の岩に寄りかかる。
//   R「溶岩の岩棚」     : 道の外の境目に冷え固まった黒い玄武岩の柱（柱状節理）が階段状に立ち、上に黒い岩の庇が道をまたぐ。2 レーン幅では真ん中の境目に柱は立てない。
// 幅は 1 レーン用 / 2 レーン用の 2 通り（hw = 通れる半幅）。ジオメトリは種類×幅ごとに 1 つを全アーチで共有する。
function archBuildGeos() {
  const A = CFG.obstacle.arch, cl = A.clear, hd = A.hd, out = { T: {}, R: {} };
  const ember = [0xff7a1c, 0xffa238, 0xe85a10], dark = [0x1d1613, 0x251a15, 0x16100d], basalt = [0x2a2326, 0x342b2e, 0x201a1d];
  const box = new THREE.BoxGeometry(1, 1, 1), hex = new THREE.CylinderGeometry(1, 1.06, 1, 6, 1), cone = new THREE.ConeGeometry(1, 1, 5), dodeca = new THREE.DodecahedronGeometry(1, 0);
  const crack = (x, y, z, w, h, d, rz) => ({ geo: box, pos: [x, y, z], rot: [0, 0, rz || 0], scl: [w, h, d], color: ember, shade: 0.3 });
  const scorch = (c, v) => { const t = Math.min(1, Math.max(0, v.y / 3)); c.multiplyScalar(0.75 + 0.35 * t); };   // 下ほど暗く（すすけた感じ）
  [1, 2].forEach(n => {
    // 柱は「通るレーンの外側の境目」(archPostSpec) だけに立つ。根もと・岩・がれきも含め、柱の中心から外へ reach 以内に収める（外のレーンの中心＝走る位置へ届かない）。
    const ps = archPostSpec(n), bx = ps.x, rc = A.post.reach, hw = n * CFG.lane.width / 2 - A.inset;   // bx = 柱の中心 / hw = 通れる半幅（当たり判定）
    // ---- T：傾いた大木（幹が道の外の根もとから斜めに立ち上がって道をまたぎ、反対側の岩に寄りかかる）----
    {
      const sx = 2 * bx + 1.5, yl = cl + 0.95, yr = cl + 0.48, tilt = Math.atan2(yl - yr, sx), cy = (yl + yr) / 2;   // 道をまたぐ幹：左が高く右が低い
      const trunk = new THREE.CylinderGeometry(0.6, 0.42, sx, 7, 3).rotateZ(Math.PI / 2);
      const B = [-(bx + rc - 0.4), 0], T = [-(bx - 0.3), yl - 0.15], dx = T[0] - B[0], dy = T[1] - B[1], len = Math.hypot(dx, dy), lean = -Math.atan2(dx, dy);   // 左：根もと（境目の外側）から斜めに伸びて幹を支える細めの斜め幹
      const body = [
        { geo: trunk, pos: [0, cy, 0], rot: [0, 0, -tilt], color: dark, jit: 0.14, paint: scorch },
        { geo: new THREE.CylinderGeometry(0.27, 0.4, len, 6, 3), pos: [(B[0] + T[0]) / 2, (B[1] + T[1]) / 2, 0.02], rot: [0, 0, lean], color: dark, jit: 0.1, paint: scorch },
        { geo: cone, pos: [B[0] + 0.08, 0.4, 0.3], scl: [0.55, 0.8, 0.4], rot: [0.4, 0, 0.3], color: dark, jit: 0.08 }, { geo: cone, pos: [B[0] - 0.05, 0.3, -0.3], scl: [0.5, 0.7, 0.35], rot: [-0.4, 0, 0.5], color: dark, jit: 0.08 },   // 根の張り出し
        { geo: dodeca, pos: [bx + 0.12, 0.5, 0], scl: [0.55, 0.55, 0.52], rot: [0.3, 0.5, 0.1], color: [0x5a4d46, 0x4a3f3a, 0x665850], jit: 0.12 },   // 右：寄りかかられる岩の積み重ね
        { geo: dodeca, pos: [bx + 0.18, 1.2, -0.04], scl: [0.46, 0.5, 0.45], rot: [0.2, 1.1, 0.6], color: [0x5a4d46, 0x665850], jit: 0.1 },
        { geo: dodeca, pos: [bx + 0.1, 1.82, 0], scl: [0.4, 0.32, 0.4], rot: [0.9, 0.2, 0.4], color: [0x4a3f3a, 0x5a4d46], jit: 0.1 },
        { geo: cone, pos: [-hw * 0.35, cy + 0.55 + 0.1, 0.05], scl: [0.16, 0.9, 0.16], rot: [0, 0, 0.35], color: dark, jit: 0.05 },   // 幹の上に突き出た折れ枝
        { geo: cone, pos: [hw * 0.25, cy + 0.15 + 0.5, -0.1], scl: [0.14, 0.7, 0.14], rot: [0, 0, -0.5], color: dark, jit: 0.05 },
        { geo: cone, pos: [hw * 0.75, cy - hw * 0.15 + 0.55, 0.1], scl: [0.12, 0.6, 0.12], rot: [0.3, 0, 0.2], color: dark, jit: 0.05 }
      ];
      const glow = [];   // 幹の割れ目：下面と側面に赤熱の亀裂（途切れ途切れ）、斜め幹にも
      for (let i = 0; i < 6 + n * 2; i++) {
        const t = -0.5 + (i + 0.5) / (6 + n * 2), x = t * sx * 0.92, y = cy - Math.tan(tilt) * x - 0.46 + 0.05 * Math.sin(i * 2.3);
        glow.push(crack(x, y, 0.12 * Math.sin(i), sx * 0.04 + 0.3 * Math.abs(Math.sin(i * 1.7)), 0.07, 0.36, -tilt));
        glow.push(crack(x + 0.2, y + 0.38, 0.52 + 0.05 * Math.cos(i), 0.45 + 0.4 * Math.abs(Math.sin(i * 0.9)), 0.06, 0.05, -tilt));
      }
      glow.push(crack(B[0] + 0.3, 1.0, 0.3, 0.05, 0.9, 0.05, lean), crack(B[0] + 0.42, 1.9, 0.28, 0.05, 0.6, 0.05, lean));
      out.T[n] = { body: gmParts(body, 11 + n), crack: gmParts(glow, 13 + n) };
    }
    // ---- R：溶岩の岩棚（柱状節理の細い岩の柱を道の外の境目に立て、黒い岩の庇が道をまたぐ。2 レーン幅でも真ん中の境目には柱を立てない）----
    {
      const body = [], glow = [], slabW = 2 * bx + 1.3, slabY = cl + 0.45;   // 庇は柱の少し外まで（外のレーンの恐竜の頭に届かない）
      body.push({ geo: new THREE.BoxGeometry(slabW, 0.9, 2 * hd + 0.5, 6, 1, 2), pos: [0, slabY, 0], color: basalt, jit: 0.2, shade: 0.3, paint: scorch });   // 庇（下端 = clear）
      body.push({ geo: new THREE.BoxGeometry(slabW * 0.78, 0.45, 2 * hd, 5, 1, 2), pos: [0.2, slabY + 0.6, 0.1], color: basalt, jit: 0.2, shade: 0.3 });    // 庇の上の段
      for (let k = 0; k < Math.round(slabW / 0.9); k++) {   // 庇の下の垂れ下がり（短い鍾乳状の岩）
        const x = -slabW / 2 + 0.5 + k * 0.9 + 0.2 * Math.sin(k * 2.1), len = 0.22 + 0.14 * Math.abs(Math.sin(k * 1.3));
        body.push({ geo: cone, pos: [x, cl - len / 2 + 0.02, 0.35 * Math.sin(k * 1.9)], scl: [0.17, len, 0.17], rot: [Math.PI, 0, 0], color: basalt, jit: 0.04 });
      }
      [-1, 1].forEach(s => {   // 柱状節理の柱：中心が bx（レーンの境目の外寄り）。いちばん内側の柱の上に庇が乗り、外側ほど高い階段状（reach 以内）
        const cols = [[0.0, cl + 0.05, 0.0, 0.34], [0.34, cl + 1.25, -0.22, 0.26], [0.48, cl + 0.6, 0.24, 0.2], [-0.24, cl + 1.55, 0.3, 0.22]];
        cols.forEach(([dx, h, z, r], i) => {
          const x = s * (bx + dx);
          body.push({ geo: hex, pos: [x, h / 2, z], scl: [r, h, r], rot: [0, i * 0.5, 0], color: basalt, jit: 0.04, shade: 0.35, paint: scorch });
          glow.push(crack(x + s * r * 0.5, h * 0.55, z + r * 0.8, 0.05, h * 0.5, 0.05));   // 柱の割れ目の赤熱
        });
        body.push({ geo: dodeca, pos: [s * (bx + 0.42), 0.18, 0.4], scl: [0.26, 0.2, 0.26], rot: [0.5, 0.5, 0.2], color: [0x3a3033, 0x2e2629], jit: 0.06 });   // 足もとのがれき（reach 以内）
      });
      for (let i = 0; i < 5 + n * 2; i++) {   // 庇の縁の赤熱の亀裂（前面と下面）
        const x = -slabW / 2 + 0.6 + (i + 0.4) * ((slabW - 1.2) / (5 + n * 2));
        glow.push(crack(x, slabY - 0.1 + 0.15 * Math.sin(i * 2), hd + 0.27, 0.5 + 0.5 * Math.abs(Math.sin(i * 1.1)), 0.07, 0.05));
        glow.push(crack(x + 0.3, cl + 0.03, 0.25 * Math.sin(i * 1.4), 0.6 * Math.abs(Math.cos(i * 0.8)) + 0.2, 0.05, 0.3));
      }
      out.R[n] = { body: gmParts(body, 21 + n), crack: gmParts(glow, 23 + n) };
    }
  });
  return out;
}


// ===== クレーターのジオメトリ（共有）。縁の形は角度の関数 craterRim(a) で窪みと縁の山が同じにつながる =====
function craterRim(a) { return 1 + 0.07 * Math.sin(a * 3 + 1) + 0.045 * Math.sin(a * 7 + 2); }          // 縁のゆがみ（半径の倍率）
function craterH(a) { return 0.8 + 0.3 * Math.sin(a * 2 + 0.5) + 0.15 * Math.sin(a * 5 + 2.2); }        // 縁の山の高さのむら
function craterGrid(rings, segs, fn) {   // 極座標のメッシュ。fn(s, a) → [x, y, z, r, g, b]。s=0 が中心側
  const pos = [], col = [], idx = [], c = new THREE.Color();
  for (let i = 0; i <= rings; i++) for (let j = 0; j < segs; j++) {
    const v = fn(i / rings, j / segs * Math.PI * 2); pos.push(v[0], v[1], v[2]); col.push(v[3], v[4], v[5]);
  }
  for (let i = 0; i < rings; i++) for (let j = 0; j < segs; j++) {
    const a = i * segs + j, b = i * segs + (j + 1) % segs, d = (i + 1) * segs + j, e = (i + 1) * segs + (j + 1) % segs;
    idx.push(a, b, d, b, e, d);   // 上向きが表
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setIndex(idx);
  g.computeVertexNormals(); return g;
}
function craterBuildGeos() {
  const K = CFG.craterLook, rim = new THREE.Color(K.rim), slope = new THREE.Color(K.rimSlope), wall = new THREE.Color(K.wall), floor = new THREE.Color(K.floor), t = new THREE.Color();
  // 窪み：中心ほど深い碗。底は暗い赤茶、壁は縁へ向かって少し明るく（縁のすぐ内側だけ光が当たる）
  const bowl = craterGrid(9, 36, (s, a) => {
    const R = craterRim(a) * 0.97, y = -K.depth * (1 - Math.pow(s, 2.2));
    t.copy(floor).lerp(wall, Math.min(1, s * 1.15)); t.lerp(slope, Math.pow(s, 5) * 0.5);
    return [Math.cos(a) * R * s, y, Math.sin(a) * R * s, t.r, t.g, t.b];
  });
  // 縁の山：窪みの縁（s=0.85）から外へ盛り上がって、また地面へ戻る。頂点が明るい灰
  const mound = craterGrid(8, 36, (s, a) => {
    const u = s, sr = 0.85 + u * 0.7, h = K.rimH * craterH(a) * Math.sin(Math.PI * Math.pow(u, 0.62)), R = craterRim(a) * sr;
    const crest = Math.exp(-Math.pow((u - 0.33) / 0.15, 2));
    t.copy(wall).lerp(slope, dnSs(0.0, 0.3, u)); t.lerp(rim, crest * 1.0); t.lerp(slope, dnSs(0.5, 1, u) * 0.7);
    return [Math.cos(a) * R, h, Math.sin(a) * R, t.r, t.g, t.b];
  });
  // 飛び散った岩・土塊（3 種類。それぞれ 1 メッシュ・面ごとに角ばった形）
  const dgeo = [0, 1, 2].map(v => {
    const pos = [], col = [], q = new THREE.Color(), cols = [0x8f877f, 0x5e4538, 0x3d2b24, 0xa39a90]; let seed = 17 + v * 31;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let n = 0; n < K.debris; n++) {
      const a = rnd() * 6.283 + n * 0.3, rr = 1.2 + rnd() * 0.6, sz = 0.07 + rnd() * 0.13, g = new THREE.DodecahedronGeometry(1, 0);
      g.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(Math.cos(a) * rr, sz * 0.35, Math.sin(a) * rr), new THREE.Quaternion().setFromEuler(new THREE.Euler(rnd() * 3, rnd() * 6, rnd() * 3)), new THREE.Vector3(sz * (0.8 + rnd() * 0.5), sz * 0.7, sz * (0.8 + rnd() * 0.5))));
      g.computeVertexNormals(); q.setHex(cols[(rnd() * cols.length) | 0]);
      const p = g.attributes.position; for (let i = 0; i < p.count; i++) { pos.push(p.getX(i), p.getY(i), p.getZ(i)); col.push(q.r, q.g, q.b); }
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals(); return g;
  });
  // 焦げた放射状の筋（着弾跡）：縁から外へ伸びる黒い筋と、縁のまわりのすす
  const S = 256, cv = document.createElement('canvas'); cv.width = cv.height = S; const cx = cv.getContext('2d'); cx.translate(S / 2, S / 2);
  const halo = cx.createRadialGradient(0, 0, S * 0.15, 0, 0, S * 0.5); halo.addColorStop(0.0, 'rgba(25,10,6,0)'); halo.addColorStop(0.42, 'rgba(25,10,6,' + (0.55 * K.scorch) + ')'); halo.addColorStop(1, 'rgba(25,10,6,0)');
  cx.fillStyle = halo; cx.beginPath(); cx.arc(0, 0, S / 2, 0, 7); cx.fill();
  let sd = 5; const rd = () => { sd = (sd * 16807) % 2147483647; return sd / 2147483647; };
  for (let i = 0; i < 34; i++) {
    const a = rd() * 6.283, len = S * (0.2 + rd() * 0.28), w = 1.5 + rd() * 4, r0 = S * 0.22, ca = Math.cos(a), sa = Math.sin(a), px = -sa, py = ca;
    const gr = cx.createLinearGradient(ca * r0, sa * r0, ca * (r0 + len), sa * (r0 + len)); gr.addColorStop(0, 'rgba(18,7,4,' + (0.8 * K.scorch + 0.2) + ')'); gr.addColorStop(1, 'rgba(18,7,4,0)');
    cx.fillStyle = gr; cx.beginPath(); cx.moveTo(ca * r0 + px * w, sa * r0 + py * w); cx.lineTo(ca * (r0 + len), sa * (r0 + len)); cx.lineTo(ca * r0 - px * w, sa * r0 - py * w); cx.closePath(); cx.fill();
  }
  const tex = new THREE.CanvasTexture(cv);
  return { bowl, mound, dgeo, tex };
}

function buildObstacles() {
  const scene = WORLD.scene, COUNT = { rock: 26, log: 26, crater: 26, pool: 16, arch: 16 };   // 種類ごとのスロット数（行の間隔の下限から見積もった最大 + 余裕。足りなくても落ちないが、そのぶん表示されない）

  // 共有ジオメトリ（岩：装飾の岩より少し角ばってゆがませ、明るい縁取りの殻を重ねる）
  const rockGeo = new THREE.DodecahedronGeometry(1, 1), rp = rockGeo.attributes.position;
  for (let i = 0; i < rp.count; i++) { const k = 1 + Math.sin(rp.getX(i) * 5.3 + rp.getY(i) * 8.1 + rp.getZ(i) * 3.7) * 0.1; rp.setXYZ(i, rp.getX(i) * k, rp.getY(i) * k, rp.getZ(i) * k); }
  rockGeo.computeVertexNormals();
  const rockMat = new THREE.MeshPhongMaterial({ color: 0x5e4f47, emissive: 0x24100a, specular: 0x222222, shininess: 6, flatShading: true });
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
  const ARCHG = archBuildGeos(), archBodyMat = new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), archGlowMat = new THREE.MeshBasicMaterial({ vertexColors: true }); OBS.archGlowMat = archGlowMat; OBS.archGeos = ARCHG;   // くぐる障害物の形（種類×幅で共有）/ 岩・木の本体 / 赤熱の亀裂（発光）
  const archShadeGeo = new THREE.PlaneGeometry(1, 1), archShadeMat = new THREE.MeshBasicMaterial({ color: 0x000000, opacity: 0.26 });
  const CR = craterBuildGeos(), KL = CFG.craterLook;
  const scorchGeo = new THREE.RingGeometry(0.7, 2.1, 40, 1), scorchMat = new THREE.MeshBasicMaterial({ map: CR.tex, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  const bowlMat = new THREE.MeshLambertMaterial({ vertexColors: true, depthTest: false, depthWrite: false, emissive: 0x1c0604 }), moundMat = new THREE.MeshLambertMaterial({ vertexColors: true }), debrisMat = new THREE.MeshLambertMaterial({ vertexColors: true });
  WORLD.ground.renderOrder = -10;   // 窪み（renderOrder -9）は地面の直後に描く
  const floorGeo = new THREE.CircleGeometry(0.2, 16), craterGlowMat = new THREE.SpriteMaterial({ map: makeSoftTexture(), color: 0xff5a14, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false, opacity: 0.3 });
  const smokeMat = new THREE.SpriteMaterial({ map: makeSoftTexture(), color: 0x6a5a52, depthWrite: false, transparent: true, opacity: 0 });
  OBS.craterGlowMat = craterGlowMat; OBS.debrisGeos = CR.dgeo;
  const discGeo = new THREE.CircleGeometry(1, 36), crustGeo = new THREE.RingGeometry(0.96, 1.3, 36);
  const crustMat = new THREE.MeshBasicMaterial({ color: 0x2b130a });
  OBS.lavaTex = makeLavaTexture(); OBS.lavaTex.repeat.set(1.4, 1.4);
  const lavaMat = new THREE.MeshBasicMaterial({ map: OBS.lavaTex, color: 0xffffff });
  const floorMat = new THREE.MeshBasicMaterial({ map: OBS.lavaTex, color: 0xffffff, depthTest: false, depthWrite: false }); OBS.floorMat = floorMat;   // 窪みの底の赤熱（窪みと同じく深度テストなし）
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
    crater() {   // 窪み（碗）＋縁の山＋飛び散った岩＋焦げ跡＋底の溶岩の赤熱＋煙。fg は半径 r 倍に拡大する入れ物
      const g = new THREE.Group(), fg = new THREE.Group();
      const scorch = new THREE.Mesh(scorchGeo, scorchMat); scorch.rotation.x = -Math.PI / 2; scorch.position.y = 0.035;
      const bowl = new THREE.Mesh(CR.bowl, bowlMat); bowl.renderOrder = -9;   // 地面より下なので、深度テストなしで地面の上に重ねる（地面の直後に描く）
      const floor = new THREE.Mesh(floorGeo, floorMat); floor.rotation.x = -Math.PI / 2; floor.position.y = -CFG.craterLook.depth + 0.03; floor.renderOrder = -8;
      const mound = new THREE.Mesh(CR.mound, moundMat), debris = new THREE.Mesh(CR.dgeo[0], debrisMat);
      fg.add(scorch, bowl, floor, mound, debris); g.add(fg);
      const glow = new THREE.Sprite(craterGlowMat); glow.position.y = 0.3; g.add(glow);
      const smoke = [0, 1].map(() => { const s = new THREE.Sprite(smokeMat.clone()); s.visible = true; g.add(s); return s; });
      g.userData = { fg, bowl, debris, glow, smoke }; return g;
    },
    arch() {   // 頭上の障害物。2 種類（傾いた焦げた大木 / 溶岩の岩棚）の形を id で選んで差し替える。下はぽっかり空いていて、くぐれると一目で分かる
      const g = new THREE.Group(), shade = flat(archShadeGeo, archShadeMat.clone(), 0.04, -1);   // 足もとのうっすらした影（地面は見える）
      const body = new THREE.Mesh(ARCHG.T[1].body, archBodyMat), glow = new THREE.Mesh(ARCHG.T[1].crack, archGlowMat);
      g.add(shade, body, glow); g.userData = { shade, body, glow }; return g;
    },
    pool() {
      const g = new THREE.Group(), fg = new THREE.Group(), glow = new THREE.Sprite(glowMat);
      fg.add(flat(crustGeo, crustMat.clone(), 0.05, -2), flat(discGeo, lavaMat, 0.07, -4)); g.add(fg); glow.position.y = 0.9; g.add(glow);
      g.userData.fg = fg; g.userData.glow = glow; return g;
    }
  };
  for (const type of Object.keys(mk)) {
    OBS.pools[type] = [];
    for (let i = 0; i < COUNT[type]; i++) { const group = mk[type](); group.visible = false; scene.add(group); OBS.pools[type].push({ id: 0, seen: 0, group, type }); }
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
    u.body.scale.set(ob.r, ob.h * 0.72, ob.r * 0.9); u.body.position.y = ob.h * 0.6; u.body.rotation.set(0, (ob.id * 1.7) % 6.28, 0);
    u.rim.scale.copy(u.body.scale).multiplyScalar(1.06); u.rim.position.copy(u.body.position); u.rim.rotation.copy(u.body.rotation);
  } else if (ob.type === 'log') {
    u.trunk.scale.set(ob.len, ob.r, ob.r); u.trunk.position.y = ob.r;
    u.stubs.forEach((s, i) => { s.position.set(ob.len * (-0.3 + 0.3 * i + ((ob.id * 0.37 + i) % 1) * 0.1), ob.r * 1.5, ((i + ob.id) % 2 ? 0.2 : -0.2)); s.rotation.set((i + ob.id) % 2 ? 0.5 : -0.5, 0, ((i + ob.id) % 3 - 1) * 0.25); });
    u.caps.forEach((c, i) => { c.position.set((i ? 1 : -1) * ob.len / 2, ob.r, 0); c.scale.setScalar(ob.r / 0.85 * 0.95); });
    g.rotation.y = ((ob.id * 0.61) % 1 - 0.5) * 0.14;   // ほんの少し斜め（当たり判定は軸平行のまま。見た目の誤差は ±0.7u 以内）
  } else if (ob.type === 'arch') {
    const n = ob.lanes.length, design = ob.id % 2 === 0 ? 'T' : 'R', G = OBS.archGeos[design][n];
    u.body.geometry = G.body; u.glow.geometry = G.crack; u.shade.scale.set(2 * ob.hw + 0.8, 2 * ob.hd + 2.4, 1);
    g.scale.x = ob.id % 4 < 2 ? 1 : -1;   // 左右反転でも同じ形にならないよう変化をつける（当たり判定は左右対称）
    u.design = design;
  } else {
    u.fg.scale.set(ob.r, 1, ob.r);   // 平らな円なので半径倍
    if (ob.type === 'pool') { u.glow.scale.set(ob.r * 2.6, ob.r * 2.6, 1); u.glow.userData.s = ob.r * 2.6; }
    if (ob.type === 'crater') {   // 窪み：半径倍。深さは大きいほど少し深く。飛び散った岩の並びは id で 3 通りから選ぶ
      u.bowl.scale.y = 0.85 + 0.12 * ob.r; u.debris.geometry = OBS.debrisGeos[ob.id % 3]; u.glow.scale.set(ob.r * 1.5, ob.r * 1.5, 1);
    }
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
  OBS.archGlowMat.color.setScalar(0.82 + 0.18 * Math.sin(T * 3.1) * Math.sin(T * 1.7 + 0.5));   // アーチの亀裂の赤熱がゆっくり脈打つ
  const flick = 0.85 + 0.15 * Math.sin(T * 5.3) * Math.sin(T * 3.1 + 1);
  OBS.lavaMat.color.setRGB(flick, flick * 0.92, flick * 0.9);
  OBS.glowMat.opacity = 0.42 + 0.16 * Math.sin(T * 4.1 + 0.6);
  OBS.floorMat.color.copy(OBS.lavaMat.color); OBS.craterGlowMat.opacity = CFG.craterLook.smoke + 0.1 * Math.sin(T * 3.7 + 1.1) * Math.sin(T * 2.3);
  for (const sl of OBS.pools.crater) if (sl.id) {   // 底の赤熱のゆらぎと、立ちのぼる煙（2 つが位相をずらして上昇・拡大・薄れる）
    const sm = sl.group.userData.smoke, r = sl.group.userData.fg.scale.x;
    for (let i = 0; i < 2; i++) {
      const ph = (T * 0.32 + i * 0.5 + sl.id * 0.37) % 1, s = sm[i]; s.position.set(Math.sin(sl.id + i * 3 + ph * 2) * 0.12 * r, 0.3 + ph * 1.7, 0);
      s.scale.setScalar(r * (0.55 + ph * 0.9)); s.material.opacity = CFG.craterLook.smoke * Math.sin(Math.PI * ph) * 1.1;
    }
  }
  for (const sl of OBS.pools.pool) if (sl.id) { const gl = sl.group.userData.glow, s = gl.userData.s * (1 + 0.05 * Math.sin(T * 6 + sl.id)); gl.scale.set(s, s, 1); }
}

// 再スタート用：すべてのスロットを返す
function resetObstaclesView() {
  for (const type in OBS.pools) for (const sl of OBS.pools[type]) if (sl.id) obstacleRelease(sl);
  OBS.byId.clear(); OBS.frame = 0; OBS.T = 0;
}
