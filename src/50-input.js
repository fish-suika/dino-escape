// ===== キー入力（PC のみ） =====
const KEYS = { left: false, right: false, jumpQ: false };
const KEYMAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right' };
function bindInput() {
  addEventListener('keydown', e => {
    if (KEYMAP[e.code]) { KEYS[KEYMAP[e.code]] = true; e.preventDefault(); }
    else if (e.code === 'Space') { if (!e.repeat) KEYS.jumpQ = true; e.preventDefault(); }
  });
  addEventListener('keyup', e => { if (KEYMAP[e.code]) { KEYS[KEYMAP[e.code]] = false; e.preventDefault(); } });
  addEventListener('blur', () => { KEYS.left = KEYS.right = KEYS.jumpQ = false; });
}
