// ===== 恐竜（外部素材なし。three.js の基本 Geometry を頂点編集して滑らかな 1 枚メッシュにしたコミカルな 1 種類）。頭は -z 向き =====
// 作り方：胴・頭・あご・首・脚・腕は球/円柱を変形して「頂点カラーで塗り分けた 1 つのなめらかなメッシュ」に。尻尾は輪（リング）を連ねた
// 先細りのチューブで、毎フレーム輪の位置だけを曲げる（継ぎ目なし・新規オブジェクトなし）。トゥーン風の段階影 + 縁のリムライト。
// 既存の API（buildDino / updateDino / dinoFace と、d.body / d.head / d.tail1 / d.tail2 / d.legs / d.eyes / d.pups / d.jawPivot / d.torso / d.sweat）は維持。

const DNC = {};   // 色（THREE.Color）。buildDino で CFG.dinoLook から作る
function dnSs(a, b, x) { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); }
function dnMixTo(o, c, t) { o.r += (c.r - o.r) * t; o.g += (c.g - o.g) * t; o.b += (c.b - o.b) * t; }

// 法線をなめらかに：同じ位置の頂点（球の継ぎ目・極）の法線を平均する
function dnWeld(geo) {
  geo.computeVertexNormals();
  const p = geo.attributes.position, n = geo.attributes.normal, map = new Map(), keys = [];
  for (let i = 0; i < p.count; i++) {
    const k = Math.round(p.getX(i) * 1500) + ',' + Math.round(p.getY(i) * 1500) + ',' + Math.round(p.getZ(i) * 1500); keys.push(k);
    let a = map.get(k); if (!a) { a = [0, 0, 0]; map.set(k, a); } a[0] += n.getX(i); a[1] += n.getY(i); a[2] += n.getZ(i);
  }
  for (let i = 0; i < p.count; i++) { const a = map.get(keys[i]), l = Math.hypot(a[0], a[1], a[2]) || 1; n.setXYZ(i, a[0] / l, a[1] / l, a[2] / l); }
  return geo;
}
// 頂点カラーを塗る。fn(x, y, z, nx, ny, nz, o) が o（THREE.Color）を書き換える
function dnPaint(geo, fn, base) {
  const p = geo.attributes.position, n = geo.attributes.normal, arr = new Float32Array(p.count * 3), o = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    o.copy(base || DNC.back); fn(p.getX(i), p.getY(i), p.getZ(i), n.getX(i), n.getY(i), n.getZ(i), o, i);
    arr[i * 3] = o.r; arr[i * 3 + 1] = o.g; arr[i * 3 + 2] = o.b;
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3)); return geo;
}
// 複数のジオメトリ（index・position・normal・color つき）を 1 つに結合
function dnMerge(list) {
  let nv = 0, ni = 0; list.forEach(g => { nv += g.attributes.position.count; ni += g.index.count; });
  const pos = new Float32Array(nv * 3), nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), idx = new Uint32Array(ni);
  let ov = 0, oi = 0;
  list.forEach(g => {
    pos.set(g.attributes.position.array, ov * 3); nor.set(g.attributes.normal.array, ov * 3); col.set(g.attributes.color.array, ov * 3);
    for (let i = 0; i < g.index.count; i++) idx[oi + i] = g.index.array[i] + ov;
    ov += g.attributes.position.count; oi += g.index.count;
  });
  const m = new THREE.BufferGeometry();
  m.setAttribute('position', new THREE.BufferAttribute(pos, 3)); m.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); m.setAttribute('color', new THREE.BufferAttribute(col, 3)); m.setIndex(new THREE.BufferAttribute(idx, 1));
  return m;
}
// 位置・向き・大きさを焼き込む（geometry を in-place で変換して返す）
function dnPlace(g, px, py, pz, sx, sy, sz, rx, ry, rz) {
  const m = new THREE.Matrix4().compose(new THREE.Vector3(px, py, pz), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx || 0, ry || 0, rz || 0)), new THREE.Vector3(sx, sy, sz));
  g.applyMatrix4(m); return g;
}
function dnTris(root) { let n = 0; root.traverse(o => { if (o.isMesh && o.geometry) n += (o.geometry.index ? o.geometry.index.count : o.geometry.attributes.position.count) / 3; }); return Math.round(n); }

// 頭の形：単位球の方向 (ux,uy,uz) → 頭ローカルの位置。前（-z）へ伸ばして細く、鼻先を少し下げた丸い鼻づら
function dnHeadShape(ux, uy, uz, out) {
  const R = 0.74, fz = Math.max(0, -uz);
  out[0] = ux * (1 - 0.30 * fz) * R;
  out[1] = (uy * (uy > 0 ? 0.92 : 1) * (1 - 0.22 * fz) - 0.10 * fz) * R * 0.95;
  out[2] = uz * (1 + 0.52 * fz) * R;
  return out;
}
function dnSurf(ux, uy, uz, out) { const l = Math.hypot(ux, uy, uz) || 1; return dnHeadShape(ux / l, uy / l, uz / l, out); }   // 向きを正規化して頭の表面の点を得る
function dnMouthY(z) { return -0.2 + 0.13 * dnSs(-0.5, 0.2, z); }   // 口の切れ目の高さ（奥＝口角ほど上がる＝にっこり）

// 頭の上半分（lower=false）/ 下あご（lower=true）。同じ形を口の面で切り分ける。閉じていれば元の丸い頭に戻る
function dnHeadHalf(lower, ws, hs) {
  const g = new THREE.SphereGeometry(1, ws, hs), p = g.attributes.position, t = [0, 0, 0], rho = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) {
    rho[i] = Math.hypot(p.getX(i), p.getZ(i)); dnHeadShape(p.getX(i), p.getY(i), p.getZ(i), t);
    const ym = dnMouthY(t[2]); t[1] = lower ? Math.min(t[1], ym) : Math.max(t[1], ym);
    p.setXYZ(i, t[0], t[1], t[2]);
  }
  dnWeld(g);
  const L = CFG.dinoLook;
  return dnPaint(g, (x, y, z, nx, ny, nz, o, i) => {
    const ym = dnMouthY(z), flat = Math.abs(y - ym) < 1e-5, fw = flat ? dnSs(0.95, 0.72, rho[i]) : 0;   // fw：口の内側の面（上あごの天井 / 下あごの床）の度合い
    if (lower) {
      dnMixTo(o, DNC.belly, 0.92);
      if (flat) { dnMixTo(o, DNC.lip, 0.85 * (1 - fw)); dnMixTo(o, DNC.tongue, fw); dnMixTo(o, DNC.mouth, fw * 0.55 * dnSs(0.25, 0.5, Math.abs(x))); }
      else dnMixTo(o, DNC.lip, 0.85 * (1 - dnSs(0, 0.07, ym - y)));
    } else {
      dnMixTo(o, DNC.backDark, 0.5 * dnSs(0.0, 0.7, y));
      dnMixTo(o, DNC.blush, 0.8 * Math.exp(-(Math.pow(Math.abs(x) - 0.52, 2) * 26 + Math.pow(y + 0.02, 2) * 30 + Math.pow(z + 0.28, 2) * 14)));
      if (flat) { dnMixTo(o, DNC.lip, 0.85 * (1 - fw)); dnMixTo(o, DNC.mouth, fw); } else dnMixTo(o, DNC.lip, 0.85 * (1 - dnSs(0, 0.07, y - ym)));
    }
  });
}

// 胴：球をゆがめた卵形（後ろが大きい）。背中は濃く、腹はクリーム、背に縞
function dnTorso() {
  const g = new THREE.SphereGeometry(1, 28, 18), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = z > 0 ? 1 + 0.06 * z : 1 - 0.14 * -z;
    p.setXYZ(i, x * k, y * (y < 0 ? 1.08 : 1) * (0.94 + 0.06 * k), z);
  }
  dnWeld(g);
  return dnPaint(g, (x, y, z, nx, ny, nz, o) => {
    dnMixTo(o, DNC.backDark, 0.75 * dnSs(0.1, 0.95, y));
    const s = Math.sin(z * 10 + 0.5); dnMixTo(o, DNC.stripe, 0.8 * dnSs(0.2, 0.6, s) * dnSs(0.15, 0.5, y));
    dnMixTo(o, DNC.belly, dnSs(-0.12, -0.6, y));
    dnMixTo(o, DNC.belly, 0.9 * dnSs(-0.55, -0.9, z) * dnSs(0.4, -0.2, y));   // 胸もクリーム
  });
}

// 首：頭の中心から胴の中へ伸びる太い円筒（両端は頭と胴に埋まる）。のど側がクリーム
function dnNeck() {
  const g = new THREE.CylinderGeometry(0.50, 0.70, 1.3, 18, 4, true).translate(0, -0.65, 0);
  const d = new THREE.Vector3(0, -0.55, 0.84).normalize(), q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), d);
  g.applyMatrix4(new THREE.Matrix4().makeRotationFromQuaternion(q)); dnWeld(g);
  return dnPaint(g, (x, y, z, nx, ny, nz, o) => {
    dnMixTo(o, DNC.backDark, 0.5 * dnSs(0.0, 0.7, ny));
    dnMixTo(o, DNC.belly, dnSs(0.0, -0.55, ny) * 0.95);
  });
}

// 脚 1 本（股関節が原点。下へ伸びる）：卵形の太もも → すね → 足首 → 丸い足 → 爪。ひとつながりの 1 メッシュ
function dnLeg(s) {
  const parts = [];
  const thigh = dnPlace(new THREE.SphereGeometry(1, 16, 12), 0, -0.36, 0.04, 0.42, 0.58, 0.5); parts.push(dnWeld(thigh));
  const shin = new THREE.CylinderGeometry(0.2, 0.15, 0.45, 12, 2).translate(0, -0.225, 0); dnPlace(shin, 0, -0.58, -0.04, 1, 1, 1, -0.08, 0, 0); parts.push(dnWeld(shin));
  const ankle = dnPlace(new THREE.SphereGeometry(1, 10, 8), 0, -0.99, -0.07, 0.17, 0.17, 0.17); parts.push(dnWeld(ankle));
  const foot = dnPlace(new THREE.SphereGeometry(1, 14, 10), 0, -1.02, -0.2, 0.28, 0.15, 0.44); parts.push(dnWeld(foot));
  for (let i = -1; i <= 1; i++) {   // 爪
    const c = new THREE.ConeGeometry(0.075, 0.26, 7).rotateX(-Math.PI / 2 - 0.0); dnPlace(c, i * 0.13, -1.05, -0.6, 1, 1, 1, 0, -i * 0.22, 0); parts.push(dnWeld(c));
  }
  const geo = dnMerge(parts.map((g, k) => dnPaint(g, (x, y, z, nx, ny, nz, o) => {
    if (k === 0) { dnMixTo(o, DNC.backDark, 0.3 * dnSs(-0.2, 0.2, y)); }
    else if (k === 1 || k === 2) { dnMixTo(o, DNC.foot, 0.5); }
    else if (k === 3) { o.copy(DNC.foot); dnMixTo(o, DNC.belly, 0.55 * dnSs(-1.06, -1.14, y)); }
    else o.copy(DNC.claw);
  })));
  return geo;
}

// 背のトゲ・角などの円すい（根もとが濃い橙 → 先が黄色）。単位：高さ 1・底の半径 0.5、底が y=0
function dnSpikeGeo() {
  const g = new THREE.ConeGeometry(0.5, 1, 8, 2).translate(0, 0.5, 0); dnWeld(g);
  return dnPaint(g, (x, y, z, nx, ny, nz, o) => { o.copy(DNC.spikeBase); dnMixTo(o, DNC.spikeTip, dnSs(0.1, 0.95, y)); });
}

// トゥーン風の素材：頂点カラー + 3 段階の影 + 縁のリムライト
function dnToon(map, opt) {
  const L = CFG.dinoLook;
  const m = new THREE.MeshToonMaterial(Object.assign({ color: 0xffffff, vertexColors: true, gradientMap: map, emissive: 0x16240e }, opt || {}));
  m.onBeforeCompile = sh => {
    sh.uniforms.rimColor = { value: new THREE.Color(L.rim) };
    sh.fragmentShader = 'uniform vec3 rimColor;\n' + sh.fragmentShader.replace('#include <emissivemap_fragment>',
      '#include <emissivemap_fragment>\n float dnRim = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), ' + L.rimPower.toFixed(2) + ');\n totalEmissiveRadiance += rimColor * dnRim * ' + L.rimGain.toFixed(2) + ';');
  };
  return m;
}

function buildDino() {
  const D = CFG.dino, L = CFG.dinoLook, TR = L.tailRings;
  ['back', 'backDark', 'stripe', 'belly', 'foot', 'claw', 'spikeBase', 'spikeTip', 'blush', 'mouth', 'tongue', 'lip'].forEach(k => { DNC[k] = new THREE.Color(L[k]); });
  const grad = new THREE.DataTexture(new Uint8Array([].concat(...L.toon.map(v => { const b = Math.round(v * 255); return [b, b, b, 255]; }))), L.toon.length, 1, THREE.RGBAFormat);
  grad.minFilter = grad.magFilter = THREE.NearestFilter; grad.needsUpdate = true;
  const skin = dnToon(grad);
  const lidMat = dnToon(grad, { vertexColors: false, color: 0x56a83e });
  const white = new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x9a9a9a });
  const black = new THREE.MeshBasicMaterial({ color: 0x151515 });
  const glint = new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false });

  const root = new THREE.Group();   // 位置（プレイヤー座標）と傾き
  const body = new THREE.Group(); root.add(body);   // 弾み・ピッチ

  const torso = new THREE.Mesh(dnTorso(), skin); torso.scale.set(0.85, 0.8, 1.25); torso.position.set(0, 1.6, 0.1); body.add(torso);

  // 背びれ：首の付け根から腰まで、大小をなめらかに並べる（1 メッシュ）
  const spikes = [], N_SP = 8;
  for (let i = 0; i < N_SP; i++) {
    const zw = -0.5 + i * 0.2, zu = (zw - 0.1) / 1.25, kf = zu > 0 ? 1 + 0.06 * zu : 1 + 0.14 * zu, top = 1.6 + 0.8 * Math.sqrt(Math.max(0, 1 - zu * zu)) * (0.94 + 0.06 * kf);
    const h = 0.26 + 0.36 * Math.sin(Math.PI * (i + 0.6) / (N_SP + 0.2)), w = h * 0.62;
    spikes.push(dnPlace(dnSpikeGeo(), 0, top - 0.08, zw, w, h, w * 0.9, 0.38, 0, 0));
  }
  const spineMesh = new THREE.Mesh(dnMerge(spikes), skin); body.add(spineMesh);

  // 頭（首・上半分・角・目・まぶた・鼻の穴）と、あご（蝶番で開く）
  const head = new THREE.Group(); head.position.set(0, 2.2, -1.0); body.add(head);
  head.add(new THREE.Mesh(dnNeck(), skin));
  const skull = new THREE.Mesh(dnHeadHalf(false, 26, 18), skin); head.add(skull);
  const H0 = [0, dnMouthY(0.3), 0.3];
  const jawPivot = new THREE.Group(); jawPivot.position.set(H0[0], H0[1], H0[2]); head.add(jawPivot);   // 口を開けるための蝶番（口の奥）
  const jaw = new THREE.Mesh(dnHeadHalf(true, 20, 12), skin); jaw.position.set(-H0[0], -H0[1], -H0[2]); jawPivot.add(jaw);
  const horns = [[-0.28, 0.82, 0.42, 0.2], [0, 0.9, 0.3, 0.26], [0.28, 0.82, 0.42, 0.2]].map(h => {   // 頭のうしろの小さな角（3 本）
    const t = [0, 0, 0]; dnSurf(h[0], h[1], h[2], t);
    return dnPlace(dnSpikeGeo(), t[0] * 0.95, t[1] * 0.95, t[2] * 0.95, h[3] * 0.7, h[3], h[3] * 0.7, 0.55, 0, h[0] * -0.5);
  });
  head.add(new THREE.Mesh(dnMerge(horns), skin));
  const eyes = [], pups = [], lids = [], tmp = [0, 0, 0];
  [-1, 1].forEach(s => {
    dnSurf(s * 0.5, 0.42, -0.6, tmp); const ex = tmp[0] * 0.9, ey = tmp[1] * 0.9, ez = tmp[2] * 0.9;   // 目の中心（頭の表面より少し内側 → 半分とび出す）
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.23, 16, 12), white); eye.position.set(ex, ey, ez); head.add(eye); eyes.push(eye);
    const pup = new THREE.Mesh(new THREE.SphereGeometry(0.115, 12, 8), black); const pb = [ex + s * 0.01, ey, ez - 0.145]; pup.position.set(pb[0], pb[1], pb[2]); head.add(pup); pups.push(pup); pup.userData.base = pb;
    const gl = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), glint); gl.position.set(-s * 0.035, 0.05, -0.085); pup.add(gl);   // 瞳のハイライト
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.245, 14, 6, 0, Math.PI * 2, 0, Math.PI / 2), lidMat); lid.position.set(ex, ey, ez); lid.rotation.x = 1.45; head.add(lid); lids.push(lid);
    dnSurf(s * 0.2, 0.3, -0.93, tmp); const nos = new THREE.Mesh(new THREE.SphereGeometry(0.05, 8, 6), black); nos.position.set(tmp[0], tmp[1] + 0.02, tmp[2] + 0.02); nos.scale.set(1, 0.7, 1); head.add(nos);   // 鼻の穴
  });

  [-1, 1].forEach(s => {   // ちいさな腕（爪つき）
    const arm = new THREE.Mesh(dnMerge([
      dnPaint(dnWeld(dnPlace(new THREE.SphereGeometry(1, 12, 8), 0, 0, -0.1, 0.12, 0.12, 0.3)), (x, y, z, nx, ny, nz, o) => { dnMixTo(o, DNC.backDark, 0.2); }),
      dnPaint(dnWeld(dnPlace(new THREE.ConeGeometry(0.045, 0.16, 6).rotateX(-Math.PI / 2), -0.04, -0.02, -0.46, 1, 1, 1, 0, 0.15, 0)), (x, y, z, nx, ny, nz, o) => { o.copy(DNC.claw); }),
      dnPaint(dnWeld(dnPlace(new THREE.ConeGeometry(0.045, 0.16, 6).rotateX(-Math.PI / 2), 0.04, -0.02, -0.46, 1, 1, 1, 0, -0.15, 0)), (x, y, z, nx, ny, nz, o) => { o.copy(DNC.claw); })
    ]), skin);
    arm.position.set(s * 0.7, 1.5, -0.55); arm.rotation.y = s * -0.3; body.add(arm);
  });

  // 尻尾：胴から先細りになって伸びるひとつながりのチューブ。tail1 / tail2 は回転値を持つだけの入れ物（updateDino がこれを読んで曲げる）
  const tail1 = new THREE.Group(); tail1.position.set(0, 1.6, 1.15); body.add(tail1);
  const tail2 = new THREE.Group(); tail2.position.set(0, 0, 1.3); tail1.add(tail2);
  const M = 12, nv = TR * M, tpos = new Float32Array(nv * 3), tnor = new Float32Array(nv * 3), tcol = new Float32Array(nv * 3), tidx = new Uint16Array((TR - 1) * M * 6), rad = new Float32Array(TR);
  const cc = new THREE.Color();
  for (let i = 0; i < TR; i++) {
    const u = i / (TR - 1); rad[i] = i === TR - 1 ? 0.005 : 0.47 * Math.pow(1 - u, 0.9) + 0.05 * (1 - u);
    for (let j = 0; j < M; j++) {
      const a = j / M * Math.PI * 2, ny = Math.sin(a), k = i * M + j;
      cc.copy(DNC.back); dnMixTo(cc, DNC.backDark, 0.7 * dnSs(0.0, 0.8, ny));
      const band = Math.sin(u * 26) * dnSs(0.12, 0.3, u); dnMixTo(cc, DNC.stripe, 0.75 * dnSs(0.15, 0.55, band) * dnSs(-0.2, 0.4, ny));
      dnMixTo(cc, DNC.belly, dnSs(-0.1, -0.7, ny) * 0.95);
      dnMixTo(cc, DNC.spikeTip, 0.85 * dnSs(0.9, 0.99, u));   // 先っぽは黄色
      tcol[k * 3] = cc.r; tcol[k * 3 + 1] = cc.g; tcol[k * 3 + 2] = cc.b;
    }
  }
  let ti = 0;
  for (let i = 0; i < TR - 1; i++) for (let j = 0; j < M; j++) {
    const a = i * M + j, b = i * M + (j + 1) % M, c = (i + 1) * M + j, e = (i + 1) * M + (j + 1) % M;
    tidx[ti++] = a; tidx[ti++] = b; tidx[ti++] = c; tidx[ti++] = b; tidx[ti++] = e; tidx[ti++] = c;
  }
  const tgeo = new THREE.BufferGeometry();
  tgeo.setAttribute('position', new THREE.BufferAttribute(tpos, 3)); tgeo.setAttribute('normal', new THREE.BufferAttribute(tnor, 3)); tgeo.setAttribute('color', new THREE.BufferAttribute(tcol, 3)); tgeo.setIndex(new THREE.BufferAttribute(tidx, 1));
  const tailMesh = new THREE.Mesh(tgeo, skin); tailMesh.frustumCulled = false; body.add(tailMesh);
  const tspikeGeo = dnSpikeGeo(), tailSp = [3, 7, 11, 15, 19].map((ri, i) => {   // 尻尾のトゲ：輪の位置に毎フレーム置く
    const m = new THREE.Mesh(tspikeGeo, skin); m.matrixAutoUpdate = false; m.frustumCulled = false; m.userData = { ri, h: 0.3 - i * 0.04 }; body.add(m); return m;
  });
  const tail = { geo: tgeo, pos: tpos, nor: tnor, rad, spikes: tailSp, M, R: TR };

  const legs = [-1, 1].map(s => {   // 脚：股関節のピボットから下へ
    const hip = new THREE.Group(); hip.position.set(s * 0.5, 1.2, 0.3); root.add(hip);
    hip.add(new THREE.Mesh(dnLeg(s), skin));
    return hip;
  });

  const sweatMat = new THREE.MeshBasicMaterial({ color: 0x9fd8ff });   // 汗のしずく（息を切らす・ほっとするときだけ見える）
  const sweat = [0, 1, 2].map(i => { const s = new THREE.Mesh(new THREE.SphereGeometry(0.09, 8, 6), sweatMat); s.scale.set(1, 1.5, 1); s.visible = false; head.add(s); return s; });

  const shadow = new THREE.Mesh(new THREE.CircleGeometry(1.3, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.35 }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.03; shadow.scale.set(0.9, 1.4, 1);

  const group = new THREE.Group(); group.add(root); group.add(shadow);
  const d = { group, root, body, head, tail1, tail2, legs, shadow, torso, eyes, pups, lids, jawPivot, sweat, tail, phase: 0, air: 0, slide: 0, fear: 0, panic: 0, squash: 1, clock: 0, idle: false, clr: null };
  dinoTailUpdate(d);
  d.tris = dnTris(group) - 20;   // 影の円（20 角形）を除いた三角形数
  return d;
}

// 尻尾の曲げ：tail1 / tail2 の回転値を、根もとから先へゆるやかに増える角度として輪に配る（根もとは胴にそろい、先ほど大きく曲がる）。毎フレーム呼ぶ
function dinoTailUpdate(d) {
  const T = d.tail, R = T.R, M = T.M, L = CFG.dinoLook, ds = L.tailLen / (R - 1), K = L.tailBend, pos = T.pos, nor = T.nor;
  const y1 = d.tail1.rotation.y * K, x1 = d.tail1.rotation.x * K, y2 = d.tail2.rotation.y * K, x2 = d.tail2.rotation.x * K;
  let px = 0, py = 1.6, pz = 1.15 - 0.4;   // 根もと（胴の中に埋める）
  for (let i = 0; i < R; i++) {
    const u = i / (R - 1), w1 = dnSs(0, 0.5, u), w2 = dnSs(0.2, 1, u), psi = y1 * w1 + y2 * w2, phi = x1 * w1 + x2 * w2;
    const cp = Math.cos(psi), dx = Math.sin(psi), dy = -cp * Math.sin(phi), dz = cp * Math.cos(phi);   // 進行方向（初期は +z＝うしろ）
    let rx = dz, rz = -dx; const rl = Math.hypot(rx, rz) || 1; rx /= rl; rz /= rl;   // 右（上方向 × 進行方向）
    const ux = dy * rz, uy = dz * rx - dx * rz, uz = -dy * rx;                            // 上（進行方向 × 右）
    const r = T.rad[i];
    for (let j = 0; j < M; j++) {
      const a = j / M * 6.283185, c = Math.cos(a), s = Math.sin(a), k = (i * M + j) * 3;
      const nx = c * rx + s * ux, ny = s * uy, nz = c * rz + s * uz;
      pos[k] = px + nx * r; pos[k + 1] = py + ny * r; pos[k + 2] = pz + nz * r; nor[k] = nx; nor[k + 1] = ny; nor[k + 2] = nz;
    }
    for (let q = 0; q < T.spikes.length; q++) {
      const sp = T.spikes[q]; if (sp.userData.ri !== i) continue;
      const h = sp.userData.h, w = h * 0.55, m = sp.matrix.elements, tx = ux * 0.85 + dx * 0.5, ty = uy * 0.85 + dy * 0.5, tz = uz * 0.85 + dz * 0.5;
      m[0] = rx * w; m[1] = 0; m[2] = rz * w; m[3] = 0;
      m[4] = tx * h; m[5] = ty * h; m[6] = tz * h; m[7] = 0;
      m[8] = dx * w; m[9] = dy * w; m[10] = dz * w; m[11] = 0;
      m[12] = px + ux * r * 0.8; m[13] = py + uy * r * 0.8 - 0.02; m[14] = pz + uz * r * 0.8; m[15] = 1; sp.matrixWorldNeedsUpdate = true;
    }
    px += dx * ds; py += dy * ds; pz += dz * ds;
  }
  T.geo.attributes.position.needsUpdate = true; T.geo.attributes.normal.needsUpdate = true;
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
  const ph = d.clock % 3.4, bl = Math.max(0, 1 - Math.abs(ph - 0.07) / 0.07);   // ときどきまばたき
  d.lids.forEach(l => { l.scale.setScalar(1 + 0.4 * w); l.rotation.x = 1.45 - 2.0 * bl + 0.3 * w; });
}

// 1 フレームの更新：ポーズを決めてから、尻尾の曲げを反映する（どのポーズでも最後に必ず通る）
function updateDino(d, P, dt) { updateDinoPose(d, P, dt); dinoTailUpdate(d); }
function updateDinoPose(d, P, dt) {
  const D = CFG.dino, k = fxInt(), fear = d.fear || 0, panic = d.panic || 0;
  d.phase += P.speed * dt * D.runFreq * (1 + 0.45 * panic * k);   // マグマが近いと脚の回転が速い（必死な走り）
  d.air += ((P.grounded ? 0 : 1) - d.air) * (1 - Math.exp(-14 * dt));   // 空中ポーズへのなめらかな切り替え
  d.slide += ((P.state === 'run' && P.sliding && !d.idle ? 1 : 0) - d.slide) * (1 - Math.exp(-18 * dt));   // くぐる（スライド）ポーズへのなめらかな切り替え
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
  const lean = Math.max(-D.leanMax, Math.min(D.leanMax, P.vx * D.lean));   // レーン移動の間だけ横へ傾く
  d.root.rotation.z = -lean + Math.sin(P.time * 15) * 0.12 * dz;
  d.root.rotation.y = -lean * 0.7;
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
  // くぐる：頭と体を低くして、足を前に投げ出す（背の高さが 1u ほどになる）。スライド中は走りの揺れを抑える
  const sl = d.slide;
  if (sl > 0.01) {
    d.root.position.y = P.y - 0.45 * sl;
    d.body.scale.y *= 1 - 0.45 * sl; d.body.scale.x *= 1 + 0.08 * sl; d.body.scale.z *= 1 + 0.08 * sl;
    d.body.rotation.x += 0.32 * sl; d.body.position.y *= 1 - sl;
    d.legs[0].rotation.x += (1.15 - d.legs[0].rotation.x) * sl; d.legs[1].rotation.x += (0.85 - d.legs[1].rotation.x) * sl;
    d.tail1.rotation.x += -0.25 * sl; d.head.rotation.x += -0.2 * sl; d.head.position.y -= 0.12 * sl;
  }
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
