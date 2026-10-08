// ===== 画面に出る文言（すべてここ。ゲーム用語は日本語に統一。キー名の R / M / Esc / P は一般的な表記のまま） =====
// HTML 側は data-t="キー名" の要素に hudBuild() がここから流し込む。ロジック（スコアの文字・危険度）もここを参照する。
const TEXT = {
  docTitle: '恐竜大脱走 - 火山から逃げろ！',
  logo: '恐竜大脱走', tag: '火山から逃げろ！',
  score: 'スコア', best: 'ベスト', titleBest: 'ベストスコア', newRecord: '新記録！',
  dist: '距離：', escDist: '逃走距離：', magma: 'マグマ', danger: '危険度：', dangerLabels: ['安全', '注意', '危険', '最終'],
  gameOver: 'ゲームオーバー', gameOverSub: '火山から逃げ切れなかった……', clear: 'クリア！', clearSub: '火山から逃げ切った！', again: '[R] もう一度逃げる',
  great: 'ギリギリセーフ！', big: '大回避！！', magmaRun: 'マグマすれすれ', combo: 'コンボ ×',
  boom: 'ドゴォォォン！！！', boom2: 'ドゴォォォォォン！！！', relief: '……危なかった', scream: 'ギャーー！！', oops: 'うわっ！',
  start: '[スペース] でスタート',
  keyMove: 'レーン移動', keyJump: 'ジャンプ', keySlide: 'くぐる', keySpace: 'スペース', keyMute: '音 入／切', keyRestart: 'リスタート', keyPause: '一時停止',
  hint: '← → / A D レーン移動 ・ スペース ジャンプ ・ ↓ / S くぐる ・ Esc 一時停止 ・ M 音',
  muteOn: '♪ 音あり (M)', muteOff: '♪ 音なし (M)',
  pause: '一時停止', resume: '再開', restart: '最初からやり直す', toTitle: 'タイトルに戻る', soundOff: '音を切る', soundOn: '音を出す',
  pauseHint: '↑ ↓ で選ぶ ・ スペース / Enter で決定 ・ Esc で再開',
  noThree: 'three.js を読み込めませんでした（ネット接続を確認してください）'
};

// data-t="キー" の要素へ文言を流し込む（起動時に 1 回。three.js の読み込みに失敗しても出る）
function textApply() {
  if (typeof document === 'undefined') return;
  document.title = TEXT.docTitle;
  document.querySelectorAll('[data-t]').forEach(el => { const s = TEXT[el.getAttribute('data-t')]; if (typeof s === 'string') el.textContent = s; });
}
