#!/bin/sh
# 分割ソースを1枚のHTMLに結合する
cd "$(dirname "$0")"

# --- 本体 ---
cat src/00-head.html \
    src/10-config.js \
    src/20-physics.js \
    src/30-world.js \
    src/40-dino.js \
    src/50-input.js \
    src/90-boot.js \
    src/99-tail.html > dino-escape.html
cp dino-escape.html index.html   # GitHub Pages はルートの index.html を配信する

# --- 検証ページ（three.js を使わない部分だけ） ---
cat src/verify-head.html \
    src/10-config.js \
    src/20-physics.js \
    src/verify-tests.js \
    src/99-tail.html > verify.html

echo "built dino-escape.html + index.html ($(wc -c < dino-escape.html) bytes)"
echo "built verify.html ($(wc -c < verify.html) bytes)"
