// ===== キー入力（PC のみ） =====
// 左右・くぐるは「押した瞬間」だけを覚える（xxQ）。押しっぱなしでは繰り返さない（e.repeat は無視）。1 回の押下 = 1 レーン。ジャンプは廃止（Space はタイトル・メニュー・結果画面だけ）
const KEYS = { leftQ: false, rightQ: false, slideQ: false, locked: false };   // locked＝一時停止中。入力をためない
const KEYMAP = { ArrowLeft: 'leftQ', KeyA: 'leftQ', ArrowRight: 'rightQ', KeyD: 'rightQ', ArrowDown: 'slideQ', KeyS: 'slideQ' };
function keysClear() { KEYS.leftQ = KEYS.rightQ = KEYS.slideQ = false; }
function bindInput() {
  addEventListener('keydown', e => {
    const k = KEYMAP[e.code];
    if (k) { if (!e.repeat && !KEYS.locked) KEYS[k] = true; e.preventDefault(); }
    else if (e.code === 'Space') e.preventDefault();   // ページのスクロール・ボタンの二重押しを防ぐ（ゲーム中の Space は何もしない）
  });
  addEventListener('blur', keysClear);
}
