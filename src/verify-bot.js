// ===== 自動プレイするボット（バランス確認用。純ロジックの上で動く。本体 HTML には入らない）=====
// botRun({ seed, rngSeed, err, reaction, maxSec, dodge }) → 1 回ぶんの結果。
//   err      = 各危険（噴石 1 個・障害物 1 個）を「見逃す」確率。0 = 完璧、1 = 何も避けない（動かない・ジャンプもしない）
//   reaction = 噴石が出てから避け始めるまでの反応時間（秒）。人間の反応を想定して 0.25 前後
//   dodge    = 岩・倒木・クレーター・アーチが自分のレーンにあるとき、隣の空いたレーンへ避ける割合（残りはジャンプ／くぐる）
// 避け方（3 レーン制）：噴石は着弾までに間に合う安全なレーンへ移る（間に合わなければ着弾の瞬間に空中にいるようジャンプ）。
//         マグマ溜まりは必ず隣のレーンへ。岩・倒木・クレーターはジャンプ、アーチはくぐる（または空いたレーンへ）。
function botRun(o) {
  o = Object.assign({ seed: 1, rngSeed: 1, err: 0, reaction: 0.25, maxSec: 400, margin: 0.1, dodge: 0.5 }, o || {});
  const DT = 1 / 60, L = CFG.lane, H = CFG.hit, O = CFG.obstacle, nL = L.count;
  const G = newGame(); G.OB.seed = o.seed; if (o.quiet) G.RS.timer = 1e9;
  const rockRng = obRng(o.rngSeed, 11), brng = obRng(o.rngSeed, 22), drng = obRng(o.rngSeed, 33), memo = new Map(), dmemo = new Map();
  const stats = { rocks: 0, big: 0, spawnedBySize: { small: 0, mid: 0, large: 0 }, maxActive: 0, log: [], threatR: 0, threatO: 0, jumps: 0, slides: 0, laneMoves: 0, dodges: 0 };
  const ignored = key => { if (!memo.has(key)) { memo.set(key, brng() < o.err); if (key[0] === 'r') stats.threatR++; else stats.threatO++; } return memo.get(key); };
  const wantsDodge = id => { if (!dmemo.has(id)) dmemo.set(id, drng() < o.dodge); return dmemo.get(id); };
  const P = G.P, M = G.M;
  let minGap = 1e9, t = 0, cleared = -1, prevLane = P.lane;
  while (t < o.maxSec && M.phase === 'playing' && !(o.maxDist && P.dist >= o.maxDist)) {
    const inp = { left: false, right: false, jump: false, slide: false };
    if (o.err < 1 && P.state === 'run') {
      const v = Math.max(P.speed, 1), cur = P.lane, rockRem = new Array(nL).fill(Infinity);
      let blastJump = false, act = null;
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
      // 障害物：レーンごとのコスト（溜まり=通れない / 岩・倒木・クレーター=ジャンプ / アーチ=くぐる）
      const cost = new Array(nL).fill(0), first = new Array(nL).fill(null), wins = [...Array(nL)].map(() => []);
      for (const ob of G.OB.list) {
        if (ob.hit) continue;
        const tz = (P.z - (ob.z + (ob.type === 'crater' || ob.type === 'pool' ? ob.r : ob.hd) + O.depthPad)) / v;
        if (tz < -0.3 || tz > 1.6) continue;
        for (let i = 0; i < nL; i++) {
          if (Math.abs(laneX(i) - ob.x) >= ob.hw + O.dinoR + 0.3) continue;
          cost[i] += ob.type === 'pool' ? 10 : 1;
          if (!first[i] || tz < first[i].tz) first[i] = { ob, tz };
          wins[i].push([tz, tz + 2 * ((ob.type === 'crater' || ob.type === 'pool' ? ob.r : ob.hd) + O.depthPad) / v]);
        }
      }
      // 自分のレーンの障害物を見逃す？（pool も含む。最初に自分のレーンに来たときに決める）
      let curCost = cost[cur], curFirst = first[cur];
      if (curFirst && ignored('o' + curFirst.ob.id)) { curCost = 0; curFirst = null; }
      // 隣へ移る途中で通り抜ける間のレーンに、ちょうど障害物が来ていないか（来ているなら、その道は通れない）
      const pathOk = i => { for (let j = cur + Math.sign(i - cur); j !== i; j += Math.sign(i - cur)) { const k = Math.abs(j - cur), a = (k - 0.6) * L.shiftSec, b = (k + 0.6) * L.shiftSec; if (wins[j].some(w => w[0] < b && w[1] > a)) return false; } return true; };
      let target = cur;
      if (rockRem[cur] < Infinity) {   // 噴石が来る：間に合う安全なレーンのうち、障害物コストが小さく近いもの
        const rem = rockRem[cur];
        let best = -1;
        for (let i = 0; i < nL; i++) {
          if (rockRem[i] < Infinity || cost[i] >= 10 || !pathOk(i)) continue;
          const n = Math.abs(i - cur) + (P.laneMove ? 0.5 : 0);
          if (n * L.shiftSec > rem - 0.04) continue;
          if (best < 0 || cost[i] + 0.3 * Math.abs(i - cur) < cost[best] + 0.3 * Math.abs(best - cur)) best = i;
        }
        if (best >= 0) target = best;
        else if (rem < 0.45 && rem > 0.25) blastJump = true;   // 逃げ切れない：着弾の瞬間に空中にいる
      } else if (curFirst && curCost > 0) {
        const f = curFirst, pool = f.ob.type === 'pool';
        let best = -1;
        for (let i = 0; i < nL; i++) {   // 隣の空いたレーン（噴石の来ないレーン）
          if (i === cur || cost[i] > 0 || rockRem[i] < Infinity || !pathOk(i)) continue;
          const n = Math.abs(i - cur) + (P.laneMove ? 0.5 : 0);
          if (n * L.shiftSec + 0.03 > f.tz) continue;
          if (best < 0 || Math.abs(i - cur) < Math.abs(best - cur)) best = i;
        }
        if (best >= 0 && (pool || wantsDodge(f.ob.id))) { target = best; if (!pool) stats.dodges++; }
        else if (!pool) {
          if (f.ob.type === 'arch') { if (f.tz <= 0.3 && f.tz > -0.05) act = 'slide'; }
          else if (f.tz <= 0.3 && f.tz > -0.1) act = 'jump';
        }
      }
      if (target !== cur && !P.laneMove) { if (target > cur) inp.right = true; else inp.left = true; }
      if ((act === 'jump' || blastJump) && P.grounded) { inp.jump = true; stats.jumps++; }
      else if (act === 'slide' && !P.sliding && P.grounded) { inp.slide = true; stats.slides++; }
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
