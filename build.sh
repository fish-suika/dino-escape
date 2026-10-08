#!/bin/sh
# 分割ソースを1枚のHTMLに結合する
cd "$(dirname "$0")"

# --- 本体 ---
cat src/00-head.html \
    src/05-text.js \
    src/10-config.js \
    src/20-physics.js \
    src/25-volcano-logic.js \
    src/26-rock-logic.js \
    src/27-magma-logic.js \
    src/28-obstacle-logic.js \
    src/29-difficulty-logic.js \
    src/24-fx-logic.js \
    src/31-score-logic.js \
    src/32-flow-logic.js \
    src/30-world.js \
    src/34-cave.js \
    src/35-volcano.js \
    src/37-magma.js \
    src/36-rocks.js \
    src/38-obstacles.js \
    src/39-fx.js \
    src/40-dino.js \
    src/45-hud.js \
    src/50-input.js \
    src/60-sound.js \
    src/90-boot.js \
    src/99-tail.html > dino-escape.html
cp dino-escape.html index.html   # GitHub Pages はルートの index.html を配信する

# --- 検証ページ（three.js を使わない部分だけ） ---
cat src/verify-head.html \
    src/05-text.js \
    src/10-config.js \
    src/20-physics.js \
    src/25-volcano-logic.js \
    src/26-rock-logic.js \
    src/27-magma-logic.js \
    src/28-obstacle-logic.js \
    src/29-difficulty-logic.js \
    src/24-fx-logic.js \
    src/31-score-logic.js \
    src/32-flow-logic.js \
    src/verify-bot.js \
    src/verify-tests.js \
    src/verify-phase6.js \
    src/verify-fx.js \
    src/verify-phase8.js \
    src/verify-pause.js \
    src/verify-kaishuD.js \
    src/verify-tail.js \
    src/99-tail.html > verify.html

echo "built dino-escape.html + index.html ($(wc -c < dino-escape.html) bytes)"
echo "built verify.html ($(wc -c < verify.html) bytes)"
