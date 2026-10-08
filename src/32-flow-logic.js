// ===== ゲーム全体の流れ（純ロジック。three.js 非依存。verify.html でテスト）=====
// mode：'title'（開始前。ゲームの時間は進まない）→ 'playing' → 'over'（マグマに飲まれた）/ 'clear'（クリア演出 → 結果）。R で 'playing' に戻る（タイトルは経由しない）。
// 既存の stepGame / newGame は変えない：開始前かどうかはここ（flow）が持ち、title の間は stepGame を呼ばないだけ。
function newFlow(store) {
  const F = { mode: 'title', t: 0, playT: 0, fromTitle: false, store: store || null, best: 0, newRecord: false, score: 0, dist: 0, overT: 0, S: newScore(), clear: null, paused: false, resumeT: 0, pauseSel: 0, pauseT: 0 };
  F.best = bestRead(F.store);
  return F;
}
function flowEmptyEv() { return { spawned: [], landed: [], died: false, cleared: false, obstacle: { hits: [], spawned: [], removed: 0 }, clear: [] }; }

// title → playing（Space）。title 以外では何もしない。戻り値＝開始したか
function flowStart(F) {
  if (F.mode !== 'title') return false;
  F.mode = 'playing'; F.playT = 0; F.fromTitle = true;
  return true;
}
// R が効く場面：マグマに飲まれたあと / クリアの結果画面になってから（演出中は効かない）
function flowCanRestart(F) { return F.mode === 'over' || (F.mode === 'clear' && !!F.clear && F.clear.stage === 'result'); }
// 全状態を初期化して playing へ（タイトルは経由しない）。G の中身を入れ替える
function flowRestart(F, G, seed) {
  resetGame(G, seed);
  F.mode = 'playing'; F.playT = 0; F.fromTitle = false; F.t = 0; F.overT = 0; F.newRecord = false; F.score = 0; F.dist = 0; F.S = newScore(); F.clear = null; flowPauseReset(F);
  return F;
}

// 終了（死亡 / クリア到達）の記録：スコア・ベスト更新
function flowFinish(F, P) {
  F.dist = Math.floor(P.dist); F.score = scoreTotal(F.S, P);
  F.newRecord = F.score > F.best;
  if (F.newRecord) { F.best = F.score; bestWrite(F.store, F.best); }
}

// 1 フレーム進める。title の間は G に一切触れない。戻り値は stepGame と同じ形の ev（＋ ev.clear = クリア演出の出来事 ['stage:breathe', 'boom', …]）
function stepFlow(F, G, inp, dt, rng) {
  const P = G.P;
  if (F.paused) { flowPauseStep(F, dt); return flowEmptyEv(); }   // 一時停止中・再開カウントダウン中は G に一切触れない
  if (F.mode === 'title') { F.t += dt; return flowEmptyEv(); }
  if (F.mode === 'playing') {
    const v0 = P.speed, ev = stepGame(G, inp, dt, rng); ev.clear = [];
    F.playT += dt;
    scoreStep(F.S, G, ev, dt);
    if (ev.died) { F.mode = 'over'; F.overT = 0; flowFinish(F, P); }
    else if (ev.cleared) { F.mode = 'clear'; F.clear = newClearSeq(v0, P); flowFinish(F, P); }
    return ev;
  }
  const ev = stepGame(G, { left: false, right: false, slide: false }, dt, rng); ev.clear = [];
  if (F.mode === 'over') F.overT += dt;
  else if (F.mode === 'clear') ev.clear = clearStep(F.clear, P, dt);
  return ev;
}

// カメラの回り込み角（0＝通常の後ろ追従、π＝正面）。タイトルはゆっくり揺れ、開始で通常へ戻る。クリア演出は振り返りで π へ
function flowCamAz(F) {
  const T = CFG.title;
  if (F.mode === 'title') return T.az + Math.sin(F.t * 0.35) * T.drift;
  if (F.mode === 'playing' && F.fromTitle) return (T.az + Math.sin(F.t * 0.35) * T.drift) * (1 - smooth01(F.playT / T.blend));
  if (F.mode === 'clear' && F.clear) return Math.PI * clearCam(F.clear);
  return 0;
}

// ---- クリア演出の状態機械：runin（安全地帯へ走り込んで減速・停止）→ breathe（息を切らす）→ lookback（振り返る）→ eruption（火山が大爆発）→ relief（……危なかった）→ result ----
const CLEAR_STAGES = ['runin', 'breathe', 'lookback', 'eruption', 'relief', 'result'];
function clearDur(i) { const C = CFG.clear; return [C.runIn, C.breathe, C.lookBack, C.eruption, C.relief, Infinity][i]; }
function newClearSeq(v0, P) { return { i: 0, stage: 'runin', t: 0, T: 0, v0: Math.max(0, v0 || 0), d0: P.dist, x0: P.x, textShown: false, skipped: false }; }

// 走り込み：時刻 t（0〜runIn）の位置 s と速さ。初速 v0 から始まり、runIn 秒でちょうど stopDist 進んで速さ 0 で止まる（3 次のなめらかな減速）
function clearRunAt(C, t) {
  const K = CFG.clear, T = K.runIn, D = K.stopDist, v0 = C.v0;
  if (t >= T) return { s: D, v: 0 };
  const b = (v0 - 2 * D / T) / (T * T), a = (D - v0 * T) / (T * T) - b * T;
  return { s: Math.max(0, Math.min(D, v0 * t + a * t * t + b * t * t * t)), v: Math.max(0, v0 + 2 * a * t + 3 * b * t * t) };
}
function clearPlace(C, P, t) {   // 走り込みの位置を P へ書く（クリア後の P.dist は演出で動く。ゲームの結果は flowFinish で記録済み）
  const r = clearRunAt(C, t), K = CFG.clear;
  P.speed = r.v; P.dist = C.d0 + r.s; P.z = -P.dist;
  const x = C.x0 * (1 - smooth01(t / K.runIn)); P.vx = 0; P.x = x;   // 洞窟の中央へ寄る
}

// 1 フレーム進める。起きた出来事の名前の配列を返す：'stage:◯◯' / 'boom'（大爆発の瞬間）/ 'relief-text'（「……危なかった」）
function clearStep(C, P, dt) {
  const ev = [];
  if (C.stage === 'result') return ev;
  C.T += dt; C.t += dt;
  while (C.i < CLEAR_STAGES.length - 1 && C.t >= clearDur(C.i)) {
    C.t -= clearDur(C.i); C.i++; C.stage = CLEAR_STAGES[C.i]; ev.push('stage:' + C.stage);
    if (C.stage === 'eruption') ev.push('boom');
  }
  if (C.stage === 'relief' && !C.textShown && C.t >= CFG.clear.reliefText) { C.textShown = true; ev.push('relief-text'); }
  clearPlace(C, P, C.i === 0 ? C.t : CFG.clear.runIn);
  return ev;
}

// Space で結果画面へ飛ばす（クリアから skipFrom 秒たってから）。飛ばしたら 'skip' ほかの出来事を返す
function clearSkip(C, P) {
  if (C.stage === 'result' || C.T < CFG.clear.skipFrom) return [];
  C.i = CLEAR_STAGES.length - 1; C.stage = 'result'; C.t = 0; C.skipped = true; C.textShown = true;
  clearPlace(C, P, CFG.clear.runIn);
  return ['stage:result', 'skip'];
}

// 見た目に使う値（0〜1）
function clearTurn(C) { return C.i < 2 ? 0 : C.i === 2 ? smooth01(C.t / CFG.clear.lookTurn) : 1; }                 // 恐竜が回る
function clearCam(C) { return C.i < 2 ? 0 : C.i === 2 ? smooth01(C.t / CFG.clear.lookBack) : 1; }                  // カメラの回り込み
function clearShock(C) { return C.i === 3 ? Math.max(0, 1 - C.t / 1.6) : C.i === 4 ? Math.max(0, 0.15 * (1 - C.t / 0.8)) : 0; }   // 驚き（大爆発の直後が最大）
function clearRelief(C) { return C.i === 4 ? smooth01((C.t - 0.5) / 1.2) : C.i >= 5 ? 1 : 0; }                         // ほっと
function clearMega(C) { return C.i === 3 ? Math.min(1, C.t / 0.3) : C.i === 4 ? Math.max(0.25, 1 - C.t / 2.6) : C.i >= 5 ? 0.25 : 0; }   // 噴火の増し（噴煙・火）
function clearFlash(C) { const K = CFG.clear.flash; return C.i === 3 ? K.max * Math.pow(Math.max(0, 1 - C.t / K.sec), 2) : 0; }   // 巨大な閃光
function clearShakeAmp(C) {   // 画面揺れ（二乗和で他と合成される）
  const K = CFG.clear.shake;
  if (C.i === 3) return K.amp * Math.exp(-C.t / (K.sec * 0.5)) + K.rumble;
  if (C.i === 4) return K.rumble * Math.max(0, 1 - C.t / 1.5);
  return 0;
}
function clearVolMul(C) {   // 火山の音の倍率：安全地帯で小さく → 大爆発で大きく → あとは小さく
  const V = CFG.clear.vol;
  if (C.i === 0) return 1 + (V.safe - 1) * smooth01(C.t / CFG.clear.runIn);
  if (C.i < 3) return V.safe;
  if (C.i === 3) return V.safe + (V.boom - V.safe) * Math.min(1, C.t / 0.25);
  if (C.i === 4) return V.after + (V.boom - V.after) * Math.max(0, 1 - C.t / 1.5);
  return V.after;
}
// マグマが沈む深さ（0〜lavaSink）：クリアしてからの秒で
function clearLavaSink(C) { return CFG.clear.lavaSink * smooth01(C.T / CFG.clear.lavaSinkSec); }
// 大爆発を見上げる：爆発の瞬間から視線が上へ（噴煙が見えるように）。0〜1
function clearTilt(C) { return C.i < 3 ? 0 : C.i === 3 ? smooth01(C.t / 0.7) : 1; }

// ---- 一時停止（ポーズ）：playing のときだけ。paused の間は stepFlow が G に触れない。再開は 3→2→1 のカウントダウン（resumeT）を挟む ----
// 項目：resume=再開 / restart=最初からやり直す / title=タイトルに戻る / mute=音の切り替え
const PAUSE_ITEMS = ['resume', 'restart', 'title', 'mute'];
function flowPauseReset(F) { F.paused = false; F.resumeT = 0; F.pauseSel = 0; F.pauseT = 0; }
function flowMenuShown(F) { return F.paused && F.resumeT <= 0; }                 // メニューが出ている（カウントダウン中ではない）
function flowCounting(F) { return F.paused && F.resumeT > 0; }
function flowCountNum(F) { return F.resumeT > 0 ? Math.max(1, Math.min(CFG.pause.steps, Math.ceil(F.resumeT / CFG.pause.stepSec - 1e-9))) : 0; }   // 表示する数字（3,2,1）。0 ならなし
// 一時停止する。playing 以外（タイトル・結果・クリア演出）では効かない。メニュー表示中の連打は何もしない（二重にならない）。カウントダウン中ならメニューへ戻す
function flowPause(F) {
  if (F.mode !== 'playing' || flowMenuShown(F)) return false;
  F.paused = true; F.resumeT = 0; F.pauseSel = 0; return true;
}
// 再開のカウントダウンを始める（メニュー表示中だけ。連打しても 1 回）
function flowResume(F) {
  if (!flowMenuShown(F)) return false;
  F.resumeT = CFG.pause.stepSec * CFG.pause.steps; return true;
}
function flowMenuMove(F, d) {
  if (!flowMenuShown(F)) return false;
  const n = PAUSE_ITEMS.length; F.pauseSel = ((F.pauseSel + d) % n + n) % n; return true;
}
function flowMenuSet(F, i) { if (!flowMenuShown(F) || i < 0 || i >= PAUSE_ITEMS.length) return false; F.pauseSel = i; return true; }
// 選択中の項目を決定。resume はここで始める。それ以外は項目名を返し、呼び出し側（boot）が実行する（restart は flowRestart、title は flowToTitle）
function flowMenuChoose(F, i) {
  if (!flowMenuShown(F)) return null;
  const item = PAUSE_ITEMS[i == null ? F.pauseSel : i]; if (!item) return null;
  if (item === 'resume') flowResume(F);
  return item;
}
function flowPauseStep(F, dt) {
  F.pauseT += dt;
  if (F.resumeT > 0) { F.resumeT -= dt; if (F.resumeT <= 0) { F.resumeT = 0; F.paused = false; } }
}
// タイトルに戻る：全状態を初期化して title へ（ベストは持ち越す）。Space でまた開始できる
function flowToTitle(F, G, seed) {
  resetGame(G, seed);
  F.mode = 'title'; F.t = 0; F.playT = 0; F.fromTitle = false; F.overT = 0; F.newRecord = false; F.score = 0; F.dist = 0; F.S = newScore(); F.clear = null; flowPauseReset(F);
  return F;
}
