// ===== キー入力（PC のみ） =====
// 左右・ジャンプ・くぐるは「押した瞬間」だけを覚える（xxQ）。押しっぱなしでは繰り返さない（e.repeat は無視）。1 回の押下 = 1 レーン
const KEYS = { leftQ: false, rightQ: false, jumpQ: false, slideQ: false, locked: false };   // locked＝一時停止中。入力をためない
const KEYMAP = { ArrowLeft: 'leftQ', KeyA: 'leftQ', ArrowRight: 'rightQ', KeyD: 'rightQ', ArrowDown: 'slideQ', KeyS: 'slideQ', Space: 'jumpQ' };
function keysClear() { KEYS.leftQ = KEYS.rightQ = KEYS.jumpQ = KEYS.slideQ = false; }
function bindInput() {
  addEventListener('keydown', e => {
    const k = KEYMAP[e.code];
    if (k) { if (!e.repeat && !KEYS.locked) KEYS[k] = true; e.preventDefault(); }
  });
  addEventListener('blur', keysClear);
}
