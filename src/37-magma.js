// ===== マグマの見た目：溶岩の壁・波頭・火の粉・蒸気・照り返し・熱ゆらぎ・HUD（three.js / DOM） =====
// 状態（先端の位置）は 27-magma-logic.js の M が持つ。先端は z = -M.front で、そこから後方（+z）へ溶岩面が広がる
const MAG = { t: 0, hs: 1, hudGap: -1, hudN: -1, overlayOn: false };

// 溶岩のテクスチャ：橙の地に黒い冷えた殻のまだらと明るいひび。端でつながるように折り返して描く
function makeLavaTexture() {
  const S = 256, c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  g.fillStyle = '#e8620f'; g.fillRect(0, 0, S, S);
  const wrap = (x, y, r, fill) => { g.fillStyle = fill; for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { g.beginPath(); g.arc(x + ox, y + oy, r, 0, 7); g.fill(); } };
  for (let i = 0; i < 70; i++) wrap(Math.random() * S, Math.random() * S, 6 + Math.random() * 20, `rgba(255,${170 + Math.floor(Math.random() * 60)},50,${0.25 + Math.random() * 0.3})`);   // 明るい高温部
  for (let i = 0; i < 46; i++) wrap(Math.random() * S, Math.random() * S, 8 + Math.random() * 22, `rgba(${40 + Math.floor(Math.random() * 30)},12,6,${0.55 + Math.random() * 0.3})`);   // 冷えた黒い殻
  for (let i = 0; i < 90; i++) wrap(Math.random() * S, Math.random() * S, 1 + Math.random() * 3, 'rgba(255,225,110,0.9)');   // ひびの白熱
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; return t;
}

// 先端からの距離 lz と高さ（波頭の高さ 1 に対する比）。手前が切り立った壁、波頭、すぐ低い溶岩面へ
const MAG_PROFILE = [[0, 0.03], [0.4, 0.3], [1.0, 0.68], [1.8, 1.0], [2.6, 0.92], [3.6, 0.7], [5, 0.5], [7, 0.34], [10, 0.25], [14, 0.2], [22, 0.19], [40, 0.19], [80, 0.19], [140, 0.19], [1e9, 0.19]];

function buildMagma() {
  const C = CFG.magma, scene = WORLD.scene, N = 140;
  const rows = MAG_PROFILE.map(p => [Math.min(p[0], C.length), p[1] * C.crestH]).filter((p, i, a) => i === 0 || p[0] > a[i - 1][0]);
  const R = rows.length, pos = new Float32Array((N + 1) * R * 3), idx = [];
  for (let j = 0; j < R; j++) for (let i = 0; i <= N; i++) { const k = (j * (N + 1) + i) * 3; pos[k] = (i / N - 0.5) * C.width; pos[k + 1] = rows[j][1]; pos[k + 2] = rows[j][0]; }
  for (let j = 0; j < R - 1; j++) for (let i = 0; i < N; i++) { const a = j * (N + 1) + i, b = a + 1, c = a + N + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.setIndex(idx);
  MAG.uni = { time: { value: 0 }, hs: { value: 1 }, map: { value: makeLavaTexture() } };
  const mat = new THREE.ShaderMaterial({
    uniforms: MAG.uni, side: THREE.DoubleSide,
    vertexShader: 'uniform float time,hs;varying vec2 vP;' +
      'void main(){vec3 p=position;float lz=p.z;float w=smoothstep(0.,7.,lz);float crest=exp(-pow(lz-1.8,2.)/3.5);' +
      'p.y+=(sin(p.x*0.33+time*1.7+lz*0.45)*0.22+sin(p.x*0.85-time*2.3)*0.1)*w+crest*sin(p.x*0.5+time*2.6)*0.55;' +
      'p.z+=(0.5+0.5*sin(p.x*0.7+time*1.3))*0.9*(1.-smoothstep(0.,3.,lz));p.y=max(p.y,0.1);p.y=0.1+(p.y-0.1)*hs;' +
      'vP=vec2(position.x,position.z);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}',
    fragmentShader: 'uniform sampler2D map;uniform float time;varying vec2 vP;' +
      'void main(){vec2 a=vec2(vP.x*0.05+time*0.015,vP.y*0.05-time*0.05),b=vec2(vP.x*0.11-time*0.02,vP.y*0.11-time*0.09);' +
      'vec3 c1=texture2D(map,a).rgb,c2=texture2D(map,b).rgb;vec3 col=c1*c2*1.9+c1*0.4;float lz=vP.y;' +
      'col+=vec3(1.,0.55,0.12)*0.6*exp(-pow(lz-1.6,2.)/5.);col+=vec3(1.,0.8,0.35)*0.5*exp(-lz*0.9);' +
      'col*=0.92+0.08*sin(time*3.+vP.x*0.2);gl_FragColor=vec4(col,1.);}'
  });
  MAG.mesh = new THREE.Mesh(geo, mat); MAG.mesh.frustumCulled = false; scene.add(MAG.mesh);

  const tex = makeSoftTexture();
  MAG.sparks = makeParticles(C.sparkMax, true, tex); MAG.steam = makeParticles(C.steamMax, false, tex);
  MAG.sparks.cursor = 0; MAG.steam.cursor = 0; MAG.sparks.acc = 0; MAG.steam.acc = 0;
  scene.add(MAG.steam.pts, MAG.sparks.pts);
  MAG.light = new THREE.PointLight(0xff6a20, 0, 55); scene.add(MAG.light);   // 恐竜の背中を橙に照らす照り返し

  MAG.$glow = document.getElementById('lavaGlow'); MAG.$heat = document.getElementById('heat'); MAG.$view = document.getElementById('view');
  MAG.$gauge = document.getElementById('magma'); MAG.$dots = [...document.querySelectorAll('#magma .dot')]; MAG.$gap = document.getElementById('magmaGap');
  MAG.$over = document.getElementById('gameover'); MAG.$overDist = document.getElementById('overDist');
  resetMagmaView();
}

// 再スタート用：見た目の状態を初期化（オブジェクトは作り直さない）
function resetMagmaView() {
  MAG.t = 0; MAG.hs = 1; MAG.hudGap = -1; MAG.hudN = -1; MAG.overlayOn = false; MAG.calm = false;
  [MAG.sparks, MAG.steam].forEach(S => { S.age.fill(1e9); S.alpha.fill(0); S.cursor = 0; S.acc = 0; pflush(S); });
  MAG.$over.classList.remove('on'); MAG.$glow.style.opacity = 0; MAG.$heat.style.opacity = 0; MAG.$view.style.transform = '';
  MAG.mesh.position.z = 1e5; MAG.light.intensity = 0;
}

function magEmit(S, x, y, z, vx, vy, vz, life, size, alpha) {
  const i = S.cursor = (S.cursor + 1) % S.max;
  S.age[i] = 0; S.life[i] = life; S.s0[i] = size; S.a0[i] = alpha;
  S.pos[i * 3] = x; S.pos[i * 3 + 1] = y; S.pos[i * 3 + 2] = z; S.vel[i * 3] = vx; S.vel[i * 3 + 1] = vy; S.vel[i * 3 + 2] = vz;
}

function stepMagmaFx(S, dt, spark) {
  for (let i = 0; i < S.max; i++) {
    if (S.age[i] >= S.life[i]) { S.alpha[i] = 0; continue; }
    S.age[i] += dt; const f = Math.min(1, S.age[i] / S.life[i]), j = i * 3;
    if (spark) S.vel[j + 1] -= 16 * dt;
    S.pos[j] += S.vel[j] * dt; S.pos[j + 1] += S.vel[j + 1] * dt; S.pos[j + 2] += S.vel[j + 2] * dt;
    if (spark) {
      S.size[i] = S.s0[i] * (1 - 0.6 * f); S.alpha[i] = S.a0[i] * (1 - f) * (1 - f);
      S.col[j] = 1; S.col[j + 1] = 0.75 - 0.5 * f; S.col[j + 2] = 0.25 - 0.2 * f;
    } else {   // 蒸気：もくもく広がる、橙に照らされた灰白色
      S.size[i] = S.s0[i] * (0.6 + f * 1.8); S.alpha[i] = S.a0[i] * Math.min(1, f * 6) * (1 - f);
      S.col[j] = 0.6 - 0.15 * f; S.col[j + 1] = 0.42 - 0.07 * f; S.col[j + 2] = 0.33 - 0.05 * f;
    }
  }
}

function updateMagma(P, M, dt) {
  const C = CFG.magma, gap = magmaGap(M, P), dead = M.phase === 'dead';
  MAG.t += dt; MAG.uni.time.value = MAG.t;
  const zf = -M.front;
  const hsT = magmaViewScale(gap, dead);   // 先端が近いほど溶岩を低くして、恐竜が隠れないようにする（死亡のときだけ元の高さへ戻って恐竜を覆う）
  MAG.hs = dead ? MAG.hs + (hsT - MAG.hs) * (1 - Math.exp(-C.view.ease * dt)) : hsT; MAG.uni.hs.value = MAG.hs;
  MAG.mesh.position.set(0, 0, zf); MAG.mesh.visible = M.active;   // 噴火して動き出すまでは見せない（タイトル画面やクリアの振り返りで、待機中の溶岩が後ろに見えてしまうのを防ぐ）
  const prox = dead ? 1 : MAG.calm ? 0 : magmaProx(gap, C.heatRange);

  // 火の粉と蒸気：先端の波頭から、画面に見える範囲（プレイヤーの左右）に出す。遠い間は出さない
  if ((gap < 160 || dead) && !MAG.calm) {   // クリア後（calm）はマグマが静まる：火の粉も蒸気も出さない
    const F = CFG.fx.magma, k = fxInt();   // 近いほど・演出が強いほど増える（intensity 0 なら従来の量）
    MAG.sparks.acc += (45 + (F.spark - 45) * k) * (1 + (0.6 * prox) * k) * dt; MAG.steam.acc += (18 + (F.steam - 18) * k) * (1 + (0.5 * prox) * k) * dt;
    while (MAG.sparks.acc >= 1) { MAG.sparks.acc -= 1; magEmit(MAG.sparks, P.x * 0.9 + rnd(-26, 26), 0.4 + rnd(1.6, C.crestH) * MAG.hs, zf + rnd(0.5, 3), rnd(-3, 3), rnd(4, 14), rnd(-7, 3), rnd(0.7, 1.6), rnd(1.2, 2.8), 1); }
    while (MAG.steam.acc >= 1) { MAG.steam.acc -= 1; magEmit(MAG.steam, P.x * 0.9 + rnd(-26, 26), rnd(1, 3) * MAG.hs, zf + rnd(0, 3), rnd(-1, 1), rnd(2, 5), rnd(-3, 1), rnd(1.6, 2.8), rnd(4, 8), 0.35 * (0.3 + 0.7 * MAG.hs)); }
  }
  stepMagmaFx(MAG.sparks, dt, true); stepMagmaFx(MAG.steam, dt, false); pflush(MAG.sparks); pflush(MAG.steam);
  MAG.light.position.set(P.x, 3, zf + 4); MAG.light.intensity = C.lightMax * prox * prox * (0.9 + 0.1 * Math.sin(MAG.t * 9));

  // 画面の赤み：下端の照り返し（噴火後は常に少し）・全体の赤い縁・熱ゆらぎ
  const glow = Math.min(1, (M.active && !MAG.calm ? C.glowBase : 0) + 0.95 * prox), pulse = 0.85 + 0.15 * Math.sin(MAG.t * 6);
  MAG.$glow.style.opacity = (glow * pulse).toFixed(3);
  MAG.$heat.style.opacity = (prox * prox * 0.9).toFixed(3);
  const wb = C.wobble * prox * prox;
  MAG.$view.style.transform = wb > 0.05 ? `translate(${(Math.sin(MAG.t * 23) * wb).toFixed(2)}px,${(Math.cos(MAG.t * 31) * wb * 0.7).toFixed(2)}px) scale(${(1 + wb * 0.003).toFixed(4)})` : '';

  // HUD：距離と点灯ゲージ
  const gm = Math.max(0, Math.round(gap)), n = dead ? 5 : magmaDanger(gap);
  if (gm !== MAG.hudGap) { MAG.hudGap = gm; MAG.$gap.textContent = gm + 'm'; }
  if (n !== MAG.hudN) { MAG.hudN = n; MAG.$dots.forEach((d, i) => d.classList.toggle('lit', i < n)); MAG.$gauge.classList.toggle('hot', n >= 4); }
}
