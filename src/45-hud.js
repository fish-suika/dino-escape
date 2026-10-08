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
  HUD.$score.style.setProperty('--popSec', CFG.score.popSec + 's'); HUD.$great.style.setProperty('--greatSec', CFG.score.greatSec + 's');
}

function hudRestartAnim(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }

// 画面全体の状態（title / playing / over / clear）。body の class で出し分ける
function hudMode(mode) {
  if (HUD.mode === mode) return;
  HUD.mode = mode; document.body.className = 'mode-' + mode;
}

// SCORE の表示。bump=ボーナスで増えたとき（ポンと弾ませる）
function hudScore(total, bump) {
  if (total !== HUD.score) { HUD.score = total; HUD.$scoreTxt.textContent = 'SCORE ' + total; }
  if (bump) hudRestartAnim(HUD.$score, 'bump');
}
function hudPop(text) {
  const el = HUD.pops[HUD.popI++ % HUD.pops.length];
  el.textContent = text; hudRestartAnim(el, 'on');
}
function hudGreat(text, big) {
  HUD.$great.textContent = text; HUD.$great.classList.toggle('big', !!big); hudRestartAnim(HUD.$great, 'on');
}
function hudTitleBest(best) { HUD.$titleBest.textContent = 'BEST SCORE ' + best; }

// GAME OVER / CLEAR の結果（距離・スコア・ベスト・NEW RECORD!）。F は flow
function hudResult(kind, F) {
  const over = kind === 'over';
  (over ? HUD.$overDist : HUD.$clearDist).textContent = '逃走距離：' + F.dist + 'm';
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
