// ===== 調整値（ここに集約） =====
const CFG = {
  run: { baseSpeed: 16, accel: 0.04, maxSpeed: 34 },                  // 前進：基準速度 / 経過秒あたりの加速（u/s²）/ 上限（単位 u = 1m）
  move: { maxX: 13, maxSpeed: 10, accel: 55, decel: 45, airAccelMul: 0.55, airDecelMul: 0.35 },   // 左右：荒野の左右限界 / 最高横速度 / 加速 / 減速 / 空中での加減速倍率
  jump: { velocity: 11.5, gravity: 32 },                              // ジャンプ初速 / 重力
  cam: { back: 11, height: 6.2, lookAhead: 14, lookY: 1.2, follow: 5, followX: 0.7, lookFollowX: 0.85, fov: 60, fovSpeed: 0.35, fovMax: 78, jumpLift: 0.35 },   // 後方距離 / 高さ / 先を見る距離 / 注視点の高さ / 追従の速さ / 横追従率 / 画角と速度による広がり
  world: { groundSize: 600, texRepeat: 40, fogColor: 0x5a2f26, fogNear: 50, fogFar: 260, clearHalf: 18,
           rocks: 46, hills: 14, spawnAhead: 220, spawnBehind: 30, spread: 110 },   // 地面の大きさ / テクスチャ繰り返し / フォグ / 装飾を置かない中央の半幅（遊べる範囲の外側）/ 装飾の数 / 先に出す距離・消す距離 / 左右の散らばり幅
  dino: { runFreq: 0.55, legSwing: 0.95, tailSwing: 0.35, bob: 0.09, tuck: 1.0, lean: 0.03 },   // 脚ふりの速さ（距離あたり）/ 脚の振れ幅 / 尻尾の揺れ / 上下の弾み / ジャンプ時の足たたみ / 横移動の傾き
  dt: { max: 0.05 }                                                   // 1 フレームの最大秒（タブ復帰時の飛び防止）
};
