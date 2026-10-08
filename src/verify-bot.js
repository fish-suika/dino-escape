// ===== 自動プレイするボット（バランス確認用。純ロジックの上で動く。本体 HTML には入らない）=====
// botRun({ seed, rngSeed, err, reaction, maxSec }) → 1 回ぶんの結果。
//   err      = 各危険（噴石 1 個・障害物 1 個）を「見逃す」確率。0 = 完璧、1 = 何も避けない（立ち止まったまま、ジャンプもしない）
//   reaction = 噴石が出てから避け始めるまでの反応時間（秒）。人間の反応を想定して 0.25 前後
// 避け方：噴石は着弾時に自分が円の外にいるよう、いちばん近い安全な x へ横移動（間に合わなければ着弾の瞬間に空中にいるようジャンプ）。
//         岩・倒木・クレーターは手前でジャンプ。マグマ溜まりは横に避ける。
function botRun(o) {
  o = Object.assign({ seed: 1, rngSeed: 1, err: 0, reaction: 0.25, maxSec: 400, margin: 0.4 }, o || {});
  const DT = 1 / 60, M0 = CFG.move, H = CFG.hit, O = CFG.obstacle;
  const G = newGame(); G.OB.seed = o.seed;
  const rockRng = obRng(o.rngSeed, 11), brng = obRng(o.rngSeed, 22), memo = new Map();
  const stats = { rocks: 0, big: 0, spawnedBySize: { small: 0, mid: 0, large: 0 }, maxActive: 0, log: [], threatR: 0, threatO: 0 };
  const ignored = key => { if (!memo.has(key)) { memo.set(key, brng() < o.err); if (key[0] === 'r') stats.threatR++; else stats.threatO++; } return memo.get(key); };
  const P = G.P, M = G.M;
  let minGap = 1e9, t = 0, cleared = -1;
  while (t < o.maxSec && M.phase === 'playing') {
    const inp = { left: false, right: false, jump: false };
    if (o.err < 1 && P.state === 'run') {
      const v = Math.max(P.speed, 1), air = !P.grounded, forb = [];   // forb = 通れない x の範囲 [lo, hi]（着弾までに間に合うか rem 付き）
      let blastJump = false, wantJump = false;
      for (const r of G.RS.rocks) {
        if (r.t < o.reaction || memo.get('r' + r.id) === true) continue;
        const rem = r.warn - r.t, zl = P.z - v * rem, dz = Math.abs(zl - r.z), R = r.radius + H.dinoR + o.margin;
        if (dz >= R) continue;
        const dx = Math.sqrt(R * R - dz * dz);
        forb.push({ lo: r.x - dx, hi: r.x + dx, rem, key: 'r' + r.id });
      }
      for (const ob of G.OB.list) {
        if (ob.hit || memo.get('o' + ob.id) === true) continue;
        const tz = (P.z - (ob.z + (ob.type === 'crater' || ob.type === 'pool' ? ob.r : ob.hd) + O.depthPad)) / v;
        if (tz < -0.3 || tz > 1.6) continue;
        if (ob.type === 'pool') { const R = ob.r + O.dinoR + 0.6; forb.push({ lo: ob.x - R, hi: ob.x + R, rem: Math.max(0.05, tz + 0.2), key: 'o' + ob.id }); continue; }
        if (tz <= 0.3 && tz > -0.1 && Math.abs(P.x + P.vx * Math.max(tz, 0) - ob.x) < ob.hw + O.dinoR + 0.6 && !ignored('o' + ob.id)) wantJump = true;
      }
      // いまの x から、安全でかつ間に合う(最高横速度 × 残り秒 - 助走) いちばん近い x を探す
      const inForb = (x, fb) => x > fb.lo && x < fb.hi;
      for (let i = forb.length - 1; i >= 0; i--) if (inForb(P.x, forb[i]) && ignored(forb[i].key)) forb.splice(i, 1);   // 見逃し（err）は、その危険がいま自分に当たりそうになった最初の瞬間に決める
      let target = P.x;
      const here = forb.filter(fb => inForb(P.x, fb)), danger = here.length > 0;
      if (danger) {
        let best = null, feasible = false;
        for (let x = -M0.maxX; x <= M0.maxX + 1e-9; x += 0.25) {
          if (forb.some(fb => inForb(x, fb))) continue;
          const need = Math.abs(x - P.x), rem = Math.min(...here.map(fb => fb.rem));
          if (best === null || need < Math.abs(best - P.x)) best = x;
          feasible = feasible || need <= M0.maxSpeed * rem * (air ? 0.7 : 1) - 1.2;
        }
        if (best !== null) target = best;
        if (!feasible) {   // 横には逃げ切れない：着弾の瞬間に空中(y>=maxY)にいる。いちばん近い噴石の着弾 0.35 秒前に跳ぶ
          const soon = Math.min(...here.map(fb => fb.rem));
          if (soon < 0.45 && soon > 0.25) blastJump = true;
        }
      }
      const dxT = target - P.x, toward = P.vx * Math.sign(dxT) > 0, stop = toward ? P.vx * P.vx / (2 * M0.decel) + 0.05 : 0.05;
      if (Math.abs(dxT) > stop && Math.abs(dxT) > 0.15) { if (dxT > 0) inp.right = true; else inp.left = true; }
      else if (Math.abs(P.vx) > 0.5 && toward && Math.abs(dxT) < stop) { if (P.vx > 0) inp.left = true; else inp.right = true; }
      if ((wantJump || blastJump) && P.grounded) inp.jump = true;
    }
    if (o.onFrame) o.onFrame(G, inp, t);
    const ev = stepGame(G, inp, DT, rockRng); t += DT;
    for (const r of ev.spawned) { stats.rocks++; stats.spawnedBySize[r.size]++; if (r.size === 'large') stats.big++; }
    for (const l of ev.landed) if (l.hit) stats.log.push({ t: +P.time.toFixed(1), what: l.rock.size + ' rock', x: +P.x.toFixed(1), rx: +l.rock.x.toFixed(1), y: +P.y.toFixed(2) });
    for (const h of ev.obstacle.hits) stats.log.push({ t: +P.time.toFixed(1), what: h.ob.type, x: +P.x.toFixed(1), ox: +h.ob.x.toFixed(1), y: +P.y.toFixed(2) });
    stats.maxActive = Math.max(stats.maxActive, G.RS.rocks.length);
    if (M.active) minGap = Math.min(minGap, magmaGap(M, P));
    if (ev.cleared) cleared = P.time;
  }
  return { result: M.phase, t: P.time, dist: P.dist, hits: P.hits, trips: P.trips, minGap, gap: magmaGap(M, P), clearT: cleared, stats, G };
}

// n 回（seed を変えて）走らせた集計。base は seed の起点
function botSummary(o, n, base) {
  const rs = []; for (let i = 1; i <= n; i++) rs.push(botRun(Object.assign({ seed: (base || 0) + i * 7 + 3, rngSeed: (base || 0) + i }, o)));
  const cl = rs.filter(r => r.result === 'clear'), dead = rs.filter(r => r.result !== 'clear');
  const avg = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : NaN;
  return { n, clear: cl.length, clearRate: cl.length / n, clearT: avg(cl.map(r => r.t)), deadT: avg(dead.map(r => r.t)), deadTs: dead.map(r => r.t), hits: avg(rs.map(r => r.hits)),
           minGapClear: avg(cl.map(r => r.minGap)), dist: avg(rs.map(r => r.dist)), runs: rs };
}
function botLine(s) { const f = (v, d) => isNaN(v) ? '-' : v.toFixed(d || 0); return `clear ${s.clear}/${s.n} clearT ${f(s.clearT)}s | deadT ${f(s.deadT)}s | hits ${f(s.hits, 1)} | minGap(clear) ${f(s.minGapClear)}`; }
