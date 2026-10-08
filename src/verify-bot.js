// ===== 自動プレイするボット（バランス確認用。純ロジックの上で動く。本体 HTML には入らない）=====
// botRun({ seed, rngSeed, err, reaction, maxSec, dodge }) → 1 回ぶんの結果。
//   err      = 各危険（噴石 1 個・障害物 1 個）を「見逃す」確率。0 = 完璧、1 = 何も避けない（動かない・くぐらない）
//   reaction = 噴石が出てから避け始めるまでの反応時間（秒）。人間の反応を想定して 0.25 前後
//   dodge    = アーチが自分のレーンにあるとき、隣の空いたレーンへ避ける割合（残りはくぐる）
// 避け方（ジャンプ廃止後・3 レーン制）：噴石は着弾までに間に合う安全なレーンへ移る（間に合わなければ何もできない）。
//         地上の障害物（岩・倒木・クレーター・マグマ溜まり）は必ず隣のレーンへ。アーチはくぐる（または空いたレーンへ）。
function botRun(o) {
  o = Object.assign({ seed: 1, rngSeed: 1, err: 0, reaction: 0.25, maxSec: 400, margin: 0.1, dodge: 0.5 }, o || {});
  const DT = 1 / 60, L = CFG.lane, H = CFG.hit, O = CFG.obstacle, nL = L.count;
  const G = newGame(); G.OB.seed = o.seed; if (o.quiet) G.RS.timer = 1e9;
  const rockRng = obRng(o.rngSeed, 11), brng = obRng(o.rngSeed, 22), drng = obRng(o.rngSeed, 33), memo = new Map(), dmemo = new Map();
  const stats = { rocks: 0, big: 0, spawnedBySize: { small: 0, mid: 0, large: 0 }, maxActive: 0, log: [], threatR: 0, threatO: 0, slides: 0, laneMoves: 0, dodges: 0 };
  const ignored = key => { if (!memo.has(key)) { memo.set(key, brng() < o.err); if (key[0] === 'r') stats.threatR++; else stats.threatO++; } return memo.get(key); };
  const wantsDodge = id => { if (!dmemo.has(id)) dmemo.set(id, drng() < o.dodge); return dmemo.get(id); };
  const P = G.P, M = G.M;
  let minGap = 1e9, t = 0, cleared = -1, prevLane = P.lane;
  while (t < o.maxSec && M.phase === 'playing' && !(o.maxDist && P.dist >= o.maxDist)) {
    const inp = { left: false, right: false, slide: false };
    if (o.err < 1 && P.state === 'run') {
      const v = Math.max(P.speed, 1), cur = P.lane, rockRem = new Array(nL).fill(Infinity);
      let act = null;
      // 噴石：各レーンが危険になる着弾までの残り秒（いちばん近いもの）。自分のレーンに来る噴石は、最初に気づいた瞬間に見逃すか決める
      for (const r of G.RS.rocks) {
        if (r.t < o.reaction || memo.get('r' + r.id) === true) continue;
        const rem = r.warn - r.t, zl = P.z - v * rem, dz = Math.abs(zl - r.z), R = r.radius + H.dinoR + o.margin;
        if (dz >= R) continue;
        const dx = Math.sqrt(R * R - dz * dz), cov = [];
        for (let i = 0; i < nL; i++) if (Math.abs(laneX(i) - r.x) < dx) cov.push(i);
        if (cov.indexOf(cur) >= 0 && ignored('r' + r.id)) continue;
        for (const i of cov) rockRem[i] = Math.min(rockRem[i], rem);
      }
      // 障害物：これから通る行（同じ位置の組）を手前から。各行 = { tz: 窓に入るまでの秒, end: 窓を出るまでの秒, blk: レーンごとに塞がれているか }。アーチは afirst（レーンごと）
      const byD = new Map(), afirst = new Array(nL).fill(null);
      for (const ob of G.OB.list) {
        if (ob.hit) continue;
        const ext = obExtent(ob), tz = (P.z - (ob.z + ext)) / v;
        if (tz + 2 * ext / v < -0.05 || tz > 3.2) continue;   // 窓（前後の範囲）を抜けたものは無視
        if (ob.type === 'arch') { for (let i = 0; i < nL; i++) if (Math.abs(laneX(i) - ob.x) < ob.hw + O.dinoR + 0.3 && (!afirst[i] || tz < afirst[i].tz)) afirst[i] = { ob, tz }; continue; }
        let row = byD.get(ob.dist); if (!row) { row = { tz, end: tz + 2 * ext / v, blk: new Array(nL).fill(false), obs: [] }; byD.set(ob.dist, row); }
        row.tz = Math.min(row.tz, tz); row.end = Math.max(row.end, tz + 2 * ext / v); row.obs.push(ob);
        for (let i = 0; i < nL; i++) if (botTouch(ob, i)) row.blk[i] = true;
      }
      const rows = [...byD.values()].sort((a, b) => a.tz - b.tz), R1 = rows[0], R2 = rows[1];
      // 自分のレーンの障害物を見逃す？（最初に自分のレーンに来たときに決める）
      let curA = afirst[cur];
      if (curA && ignored('o' + curA.ob.id)) curA = null;
      let curBlocked = !!(R1 && R1.blk[cur]);
      if (curBlocked) { const key = R1.obs.filter(o => botTouch(o, cur)).map(o => o.id).join('/'); if (ignored('o' + key)) curBlocked = false; }
      const laneFree = (i, ta) => !rows.some(r => r.blk[i] && r.tz < ta + 0.1 && r.end > ta - 0.08);   // ta 秒後（到着の少し前から）にそのレーンが障害物の窓の中か
      const pathOk = i => { for (let j = cur + Math.sign(i - cur); j !== i; j += Math.sign(i - cur)) { const k = Math.abs(j - cur); if (!laneFree(j, k * L.shiftSec)) return false; } return true; };
      let target = cur;
      const pick = (limit, ok) => {   // 間に合う隣のレーンのうち、近く、次の行でも塞がれていないもの
        let best = -1, bs = 1e9;
        for (let i = 0; i < nL; i++) {
          if (i === cur || !ok(i) || !pathOk(i)) continue;
          const n = Math.abs(i - cur) + (P.laneMove ? 0.5 : 0), ta = n * L.shiftSec;
          if (ta + 0.03 > limit || !laneFree(i, ta)) continue;
          const s = Math.abs(i - cur) + (R2 && R2.blk[i] ? 1.6 : 0) + (R1 && R1.tz > ta && R1.blk[i] ? 9 : 0);
          if (s < bs) { bs = s; best = i; }
        }
        return best;
      };
      if (rockRem[cur] < Infinity) {   // 噴石が来る：間に合う安全なレーン（障害物にも塞がれていない）へ。間に合わなければ何もできない
        const best = pick(rockRem[cur] - 0.04, i => rockRem[i] === Infinity && !(R1 && R1.blk[i] && R1.tz < rockRem[cur] + 0.4));
        if (best >= 0) target = best;
      } else if (curBlocked && R1.tz < 1.6) {
        const best = pick(R1.tz, i => rockRem[i] === Infinity);
        if (best >= 0) target = best;
      } else if (curA) {
        const best = wantsDodge(curA.ob.id) ? pick(curA.tz, i => rockRem[i] === Infinity && !afirst[i] && !(R1 && R1.blk[i])) : -1;
        if (best >= 0) { target = best; stats.dodges++; }
        else if (curA.tz <= 0.3 && curA.tz > -0.05) act = 'slide';
      }
      if (target !== cur && !P.laneMove) { if (target > cur) inp.right = true; else inp.left = true; }
      if (act === 'slide' && !P.sliding) { inp.slide = true; stats.slides++; }
    }
    if (o.onFrame) o.onFrame(G, inp, t);
    const ev = stepGame(G, inp, DT, rockRng); t += DT;
    if (P.lane !== prevLane) { stats.laneMoves++; prevLane = P.lane; }
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
  return { n, clear: cl.length, clearRate: cl.length / n, clearT: avg(cl.map(r => r.t)), deadT: avg(dead.map(r => r.t)), deadTs: dead.map(r => r.t), hits: avg(rs.map(r => r.hits)), trips: avg(rs.map(r => r.trips)),
           minGapClear: avg(cl.map(r => r.minGap)), dist: avg(rs.map(r => r.dist)), runs: rs };
}
function botLine(s) { const f = (v, d) => isNaN(v) ? '-' : v.toFixed(d || 0); return `clear ${s.clear}/${s.n} clearT ${f(s.clearT)}s | deadT ${f(s.deadT)}s | hits ${f(s.hits, 1)} trips ${f(s.trips, 1)} | minGap(clear) ${f(s.minGapClear)}`; }

// ボットが「そのレーンの中心に立つと触れる」とみなす判定（少し余裕をみる）
function botTouch(ob, l) {
  const O = CFG.obstacle, dx = Math.abs(laneX(l) - ob.x);
  return ob.type === 'rock' || ob.type === 'log' ? dx < ob.hw + O.dinoR + 0.3 : dx < ob.r + (ob.type === 'pool' ? O.dinoR : O.dinoR * 0.3) + 0.3;
}
