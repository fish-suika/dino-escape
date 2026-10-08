// ===== Phase 8 の画面表示（DOM）：スコア・「+100」・GREAT ESCAPE!・タイトル・結果画面 =====
// 要素は最初に見つけて使い回す（イベントのたびに作らない）。アニメーションは class を付け直して再生する。
const HUD = { mode: '', score: -1, popI: 0 };

function hudBuild() {
  const $ = id => document.getElementById(id);
  Object.assign(HUD, {
    $score: $('score'), $scoreTxt: $('scoreTxt'), pops: [...document.querySelectorAll('#score .pop')], $great: $('great'), $titleBest: $('titleBest'),
    $boom2: $('boom2'), $relief: $('relief'), $flash: $('flash'),
    $overDist: $('overDist'), $overScore: $('overScore'), $overBest: $('overBest'), $overBestN: $('overBestN'), $over: $('gameover'),
    $clearDist: $('clearDist'), $clearScore: $('clearScore'), $clearBest: $('clearBest'), $clearBestN: $('clearBestN'), $clear: $('clear')
  });
  HUD.$score.style.setProperty('--popSec', CFG.score.popSec + 's'); HUD.$great.style.setProperty('--greatSec', CFG.score.greatSec + 's'); hudPauseBuild();
}

function hudRestartAnim(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

// 画面全体の状態（title / playing / over / clear）。body の class で出し分ける
function hudMode(mode) {
  if (HUD.mode === mode) return;
  HUD.mode = mode; const b = document.body; [...b.classList].forEach(c => { if (c.startsWith('mode-')) b.classList.remove(c); }); b.classList.add('mode-' + mode);
}

// SCORE の表示。bump=ボーナスで増えたとき（ポンと弾ませる）
function hudScore(total, bump) {
  if (total !== HUD.score) { HUD.score = total; HUD.$scoreTxt.textContent = TEXT.score + ' ' + total; }
  if (bump) hudRestartAnim(HUD.$score, 'bump');
}
function hudPop(text) {
  const el = HUD.pops[HUD.popI++ % HUD.pops.length];
  el.textContent = text; hudRestartAnim(el, 'on');
}
function hudGreat(text, big) {
  HUD.$great.textContent = text; HUD.$great.classList.toggle('big', !!big); hudRestartAnim(HUD.$great, 'on');
}
function hudTitleBest(best) { HUD.$titleBest.textContent = TEXT.titleBest + ' ' + best; }

// GAME OVER / CLEAR の結果（距離・スコア・ベスト・NEW RECORD!）。F は flow
function hudResult(kind, F) {
  const over = kind === 'over';
  (over ? HUD.$overDist : HUD.$clearDist).textContent = TEXT.escDist + F.dist + 'm';
  (over ? HUD.$overScore : HUD.$clearScore).textContent = F.score;
  (over ? HUD.$overBestN : HUD.$clearBestN).textContent = F.best;
  (over ? HUD.$overBest : HUD.$clearBest).classList.toggle('rec', F.newRecord);
  (over ? HUD.$over : HUD.$clear).classList.add('on');
}

// 再スタート：文字・結果画面をすべて消す
function hudReset() {
  HUD.score = -1;
  [HUD.$great, HUD.$boom2, HUD.$relief, HUD.$over, HUD.$clear, ...HUD.pops].forEach(el => el.classList.remove('on'));
  HUD.$flash.classList.remove('mega'); HUD.$score.classList.remove('bump');
}

// ---- 一時停止メニュー / 再開カウントダウン ----
function hudPauseBuild() {
  const $ = id => document.getElementById(id);
  HUD.$pause = $('pauseUI'); HUD.$pcount = $('pcount'); HUD.$pauseMute = $('pauseMute'); HUD.pbtn = [...document.querySelectorAll('#pauseUI .pitems button')]; HUD.pshown = ''; HUD.pcnum = 0;
  HUD.$pcount.style.animationDuration = CFG.pause.stepSec + 's';
}
// 毎フレーム：F の一時停止状態を画面へ。変わったときだけ DOM を触る
function hudPause(F, muted) {
  const key = F.paused ? (F.resumeT > 0 ? 'count' : 'menu' + F.pauseSel + (muted ? 'm' : '')) : '';
  if (key !== HUD.pshown) {
    HUD.pshown = key; document.body.classList.toggle('paused', F.paused);
    HUD.$pause.classList.toggle('on', F.paused); HUD.$pause.classList.toggle('count', F.resumeT > 0);
    HUD.pbtn.forEach((b, i) => b.classList.toggle('sel', F.paused && F.resumeT <= 0 && i === F.pauseSel));
    HUD.$pauseMute.textContent = muted ? TEXT.soundOn : TEXT.soundOff;
  }
  const n = flowCountNum(F);
  if (n !== HUD.pcnum) { HUD.pcnum = n; if (n > 0) { HUD.$pcount.textContent = n; hudRestartAnim(HUD.$pcount, 'on'); } else HUD.$pcount.classList.remove('on'); }
}
