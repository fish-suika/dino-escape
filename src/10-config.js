// ===== 調整値（ここに集約） =====
const CFG = {
  run: { baseSpeed: 16, accel: 0.04, maxSpeed: 34 },                  // 前進：基準速度 / 経過秒あたりの加速（u/s²）/ 上限（単位 u = 1m）
  move: { maxX: 13, maxSpeed: 10, accel: 55, decel: 45, airAccelMul: 0.55, airDecelMul: 0.35 },   // 左右：荒野の左右限界 / 最高横速度 / 加速 / 減速 / 空中での加減速倍率
  jump: { velocity: 11.5, gravity: 32 },                              // ジャンプ初速 / 重力
  cam: { back: 11, height: 6.2, lookAhead: 14, lookY: 1.2, follow: 5, followX: 0.7, lookFollowX: 0.85, fov: 60, fovSpeed: 0.35, fovMax: 78, jumpLift: 0.35 },   // 後方距離 / 高さ / 先を見る距離 / 注視点の高さ / 追従の速さ / 横追従率 / 画角と速度による広がり
  world: { groundSize: 600, texRepeat: 40, fogColor: 0x5a2f26, fogNear: 50, fogFar: 260, clearHalf: 18,
           rocks: 46, hills: 14, spawnAhead: 220, spawnBehind: 30, spread: 110 },   // 地面の大きさ / テクスチャ繰り返し / フォグ / 装飾を置かない中央の半幅（遊べる範囲の外側）/ 装飾の数 / 先に出す距離・消す距離 / 左右の散らばり幅
  dino: { runFreq: 0.55, legSwing: 0.95, tailSwing: 0.35, bob: 0.09, tuck: 1.0, lean: 0.03 },   // 脚ふりの速さ（距離あたり）/ 脚の振れ幅 / 尻尾の揺れ / 上下の弾み / ジャンプ時の足たたみ / 横移動の傾き
  volcano: { eruptDelay: 4, rampTime: 6, idleSmoke: 0.25, dist: 300, recede: 0.04, radius: 120, height: 130, craterR: 18,   // 大噴火までの秒 / 噴火が最大強度になるまでの秒 / 噴火前の煙の量 / 後方の距離 / 遠ざかる率 / 山の大きさ
             boomDur: 2.2, shakeAmp: 0.32, shakeDur: 1.6, flashDur: 0.9, flashMax: 0.6,                                    // 「ドゴォォォン」表示秒 / 画面揺れの大きさ・秒 / 閃光の秒・最大濃さ
             smokeMax: 450, fireMax: 380, ashMax: 650, emberMax: 200, canopyMax: 170,                                                    // パーティクル上限（煙 / 火花 / 火山灰 / 降る火の粉）
             windSpeed: 70, smokeLife: 9, ashBox: { x: 45, y: 32, z: 80 },                                                // 煙が手前へ流れる速さ / 煙の寿命 / 灰が降る範囲
             sky: { top: '#0a0203', mid: '#3a0a08', low: '#7a1c0e', bottom: '#a8300f' }, fogColor: 0x3a0e0a },             // 噴火後の空と霧の色
  rock: { interval: 2.0, jitter: 0.35, firstDelay: 1.5, maxActive: 8,                                                       // 噴石：出現間隔（秒）/ ばらつき / 噴火してから最初の1個までの秒 / 同時に存在できる数
          weights: { small: 0.58, mid: 0.37, large: 0.05 },                                                                 // 出現の重み（大型は Phase 6 で増やす）
          aimChance: 0.5, aimJitterX: 2.5, aimJitterZ: 3, spreadX: 14, aheadExtra: 30, edgeMargin: 1, backDist: 22, sideOff: 6,   // 恐竜を狙う確率と誤差 / 狙わない時の左右幅と前方の余裕 / 落下の出発点（後方・横）
          sizes: {   // radius=着弾の当たり半径（危険マーカー）/ vis=見た目の岩の半径 / warn=警告から着弾までの秒 / fallH=出発の高さ / power=吹き飛びの強さ / shake=画面揺れ
            small: { radius: 2.2, vis: 0.75, warn: 0.9, fallH: 12, power: 0.55, shake: 0 },
            mid:   { radius: 3.4, vis: 1.3,  warn: 1.2, fallH: 15, power: 1.0,  shake: 0.2 },
            large: { radius: 6.2, vis: 2.8,  warn: 1.6, fallH: 19, power: 1.8,  shake: 0.55 } },
          sparkMax: 600, dustMax: 360, craterMax: 10, craterLife: 4.5, ringMax: 8, shakeDecay: 6 },                          // 火の粉・土煙の粒数 / クレーター跡の数と残る秒 / 衝撃波リング数 / 揺れの収まる速さ
  hit: { dinoR: 0.9, maxY: 1.5,                                                                                             // 恐竜の当たり半径 / これより高く跳んでいれば爆風の上を越える
         knockBase: 0.75, knockPer: 0.5, kickSide: 9, kickUp: 12, kickFwd: 12, spin: 9,                                       // 吹き飛び：秒（基本＋強さ×）/ 横・上・前方への初速（×強さ）/ 回転（rad/s）
         bounce: 0.42, bounceMin: 2.5, friction: 2.2, knockMul: 0.15,                                                        // バウンドの反発 / 止まる最小の落下速度 / 地面での減速 / 吹き飛び中の前進倍率
         recoverSec: 0.7, recoverMul: 0.4, slowSec: 2.6, slowFactor: 0.55, slowRamp: 0.7,                                    // 起き上がりの秒と前進倍率 / 減速の続く秒と倍率 / 戻るまでにかける秒
         invulnSec: 1.8, screamSec: 1.2 },                                                                                   // 復帰後の無敵（点滅）秒 / 「ギャーー」表示秒
  sound: { master: 0.5, rumbleIdle: 0.35, rumbleErupt: 0.85 },                                                              // 全体音量 / 待機中・噴火中のゴゴゴ音量
  dt: { max: 0.05 }                                                   // 1 フレームの最大秒（タブ復帰時の飛び防止）
};
