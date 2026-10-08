// ===== 調整値（ここに集約） =====
const CFG = {
  run: { baseSpeed: 16, accel: 0.04, maxSpeed: 34 },                  // 前進：基準速度 / 経過秒あたりの加速（u/s²）/ 上限（単位 u = 1m）
  lane: { count: 3, width: 4.5, shiftSec: 0.13, bufferSec: 0.15, bufferMax: 2 },   // 3 レーン制：レーン数 / レーン幅(u) / 隣のレーンへ移る秒 / 移動中に来た入力を覚えておく秒と個数（左右キーは押すたび 1 レーン。押しっぱなしでは動かない）
  move: { maxX: 6.75 },                                               // 吹き飛び中に出られる左右限界（= lane.width × 1.5。端のレーン中心 ±4.5 の外側に少し余白）
  slide: { sec: 0.7, cooldown: 0.2, buffer: 0.15, dive: 24, standH: 2.9, slideH: 1.0 },   // くぐる（S / ↓）：滑走の秒 / 終わってから次を出せるまで / 押すのが早すぎたとき覚えておく秒 / 空中で押したときの急降下の速さ / 当たり判定の高さ（立ち / 滑走中）
  jump: { velocity: 11.5, gravity: 32 },                              // ジャンプ初速 / 重力
  cam: { back: 11, height: 6.2, lookAhead: 14, lookY: 1.2, follow: 5, followXSpeed: 3.2, followX: 0.6, lookFollowX: 0.7, fov: 60, fovSpeed: 0.35, fovMax: 78, jumpLift: 0.35 },   // 後方距離 / 高さ / 先を見る距離 / 注視点の高さ / 追従の速さ / 横追従率 / 画角と速度による広がり
  world: { groundSize: 600, texRepeat: 40, fogColor: 0x5a2f26, fogNear: 50, fogFar: 260, clearHalf: 11,
           rocks: 46, hills: 14, spawnAhead: 220, spawnBehind: 30, spread: 110 },   // 地面の大きさ / テクスチャ繰り返し / フォグ / 装飾を置かない中央の半幅（遊べる範囲の外側）/ 装飾の数 / 先に出す距離・消す距離 / 左右の散らばり幅
  dino: { runFreq: 0.55, legSwing: 0.95, tailSwing: 0.35, bob: 0.09, tuck: 1.0, lean: 0.008, leanMax: 0.35 },   // 脚ふりの速さ（距離あたり）/ 脚の振れ幅 / 尻尾の揺れ / 上下の弾み / ジャンプ時の足たたみ / 横移動の傾き（横速度あたり）と上限
  volcano: { eruptDelay: 4, rampTime: 6, idleSmoke: 0.25, dist: 300, recede: 0.04, radius: 120, height: 130, craterR: 18,   // 大噴火までの秒 / 噴火が最大強度になるまでの秒 / 噴火前の煙の量 / 後方の距離 / 遠ざかる率 / 山の大きさ
             boomDur: 2.2, shakeAmp: 0.32, shakeDur: 1.6, flashDur: 0.9, flashMax: 0.6,                                    // 「ドゴォォォン」表示秒 / 画面揺れの大きさ・秒 / 閃光の秒・最大濃さ
             smokeMax: 450, fireMax: 380, ashMax: 650, emberMax: 200, canopyMax: 170,                                                    // パーティクル上限（煙 / 火花 / 火山灰 / 降る火の粉）
             windSpeed: 70, smokeLife: 9, ashBox: { x: 45, y: 32, z: 80 },                                                // 煙が手前へ流れる速さ / 煙の寿命 / 灰が降る範囲
             sky: { top: '#0a0203', mid: '#3a0a08', low: '#7a1c0e', bottom: '#a8300f' }, fogColor: 0x3a0e0a },             // 噴火後の空と霧の色
  rock: { interval: 2.0, jitter: 0.35, firstDelay: 1.5, maxActive: 12,                                                      // 噴石：（interval と weights は難易度を使わない時の固定値。実際は difficulty.rock が決める）出現間隔 / ばらつき / 噴火してから最初の1個までの秒 / 同時に存在できる数の上限（描画の枠数）
          weights: { small: 0.58, mid: 0.37, large: 0.05 },                                                                 // 出現の重み（固定値の時のみ）
          aimChance: 0.5, aimJitterZ: 3, aheadExtra: 30, backDist: 22, sideOff: 6,   // 恐竜のいるレーンを狙う確率 / 前後の誤差 / 狙わない時の前方の余裕 / 落下の出発点（後方・横）。落下地点の x はレーン中心（小）・レーン中心かレーンの間（中）・端のレーン中心かレーンの間（大）に吸着
          sizes: {   // radius=着弾の当たり半径（危険マーカー。小=1 レーン / 中=1〜2 レーン / 大=2 レーン、中央のレーン中心では 3 レーンになるので置かない）/ vis=見た目の岩の半径 / warn=警告から着弾までの秒 / fallH=出発の高さ / power=吹き飛びの強さ / shake=画面揺れ / slowSec・slowF=直撃後の減速の秒と倍率
            small: { radius: 2.2, vis: 0.75, warn: 0.9, fallH: 12, power: 0.55, shake: 0,    slowSec: 0.8, slowF: 0.85 },
            mid:   { radius: 3.4, vis: 1.3,  warn: 1.2, fallH: 15, power: 1.0,  shake: 0.2,  slowSec: 1.2, slowF: 0.75 },
            large: { radius: 4.8, vis: 2.8,  warn: 1.6, fallH: 19, power: 1.8,  shake: 0.55, slowSec: 1.7, slowF: 0.65 } },
          fair: { react: 0.3, margin: 0.1, moveExtra: 0.05, tries: 6, retry: 0.2 },   // 公平性（避けようがない噴石を出さない）：人間の反応時間 / 円の外に出る余裕 / レーン移動 1 回ごとに足す余裕の秒 / 場所の選び直し回数 / だめなら待つ秒
          sparkMax: 850, dustMax: 640, craterMax: 10, craterLife: 4.5, ringMax: 8, shakeDecay: 6 },                          // 火の粉・土煙の粒数 / クレーター跡の数と残る秒 / 衝撃波リング数 / 揺れの収まる速さ
  hit: { dinoR: 0.9, maxY: 1.5,                                                                                             // 恐竜の当たり半径 / これより高く跳んでいれば爆風の上を越える
         knockBase: 0.4, knockPer: 0.3, kickSide: 7, kickUp: 10.5, kickFwd: 12, spin: 9,                                       // 吹き飛び：秒（基本＋強さ×）/ 横・上・前方への初速（×強さ）/ 回転（rad/s）
         bounce: 0.42, bounceMin: 2.5, friction: 2.2, knockMul: 0.15,                                                        // バウンドの反発 / 止まる最小の落下速度 / 地面での減速 / 吹き飛び中の前進倍率
         recoverSec: 0.4, recoverMul: 0.5, slowRamp: 0.7,                                                              // 起き上がりの秒と前進倍率 / 減速から戻るまでにかける秒（減速の秒と倍率は rock.sizes の slowSec / slowF）
         invulnSec: 1.8, screamSec: 1.2 },                                                                                   // 復帰後の無敵（点滅）秒 / 「ギャーー」表示秒
  magma: { startGap: 60, speed0: 15.5, speedMax: 23.5, rubberMin: 0.7, rubberRange: 50,                                                                          // 噴火時の先端との距離(u) / 噴火直後の速さ / 最終局面の速さ（途中の速さは難易度の強度 s で補間。プレイヤーは 16→約 21 付近でクリア）
           deathOvershoot: 6, deathSec: 1.5, deathSink: 3.2, overlayDelay: 1.6,                                              // 死亡時に先端がプレイヤーを越えて止まる距離 / 沈む秒 / 沈む深さ / GAME OVER 表示までの秒
           width: 560, length: 260, crestH: 4.3,                                                                              // 溶岩の幅（左右の外まで）/ 奥行き / 波頭の高さ（3.8→4.3：先端のチラ見えを 6〜7m 付近から。Phase 6）
           heatRange: 55, glowBase: 0.1, wobble: 3, shakeRange: 26, shakeAmp: 0.16, audibleRange: 140,                        // 熱ゆらぎ・赤みが出始める距離 / 噴火後の下端の照り返し最小値 / 熱ゆらぎ(px) / 揺れが出る距離・大きさ / 音が聞こえ始める距離
           view: { far: 15, near: 4, min: 0.22, ease: 7 },                                                                    // 先端が近いとき恐竜が溶岩に隠れないよう、溶岩の高さを低くする：低くし始める距離 / 最も低くなる距離 / そのときの高さの倍率 / 死亡で元の高さへ戻る速さ
           dangerGaps: [110, 75, 50, 28, 14],                                                                                 // HUD ゲージの点灯しきい値（この距離より近いと点が1つずつ点く）
           sparkMax: 360, steamMax: 200, lightMax: 2.4 },                                                                    // 火の粉・蒸気の粒数 / 照り返し光の強さ
  obstacle: { seed: 1234, startDist: 50, slotStep: 20, minGapZ: 14, logClearZ: 30, aheadDist: 150, behindDist: 12, chunk: 40,   // 乱数の種 / 最初の障害物までの距離(u) / 配置の枠の間隔 / 前後の障害物の最低間隔（枠内のばらつきは slotStep-minGapZ）/ 倒木の前後に他を置かない距離 / 先に出す距離・消す距離 / まとめて作る長さ
              density: { start: 0.45, end: 0.9 },                                                                           // 枠が埋まる確率：難易度の強度 s（0〜1）で 序盤→終盤の値へ（その距離を「ふつうに走ったときの噴火後の秒」に直して使う）
              unlock: { rock: 0, crater: 70, log: 110, pool: 200, arch: 40 },                                               // 各障害物が出始める走行距離（startDist からの増分。arch=40 は距離 90 から）
              weights: { rock: 0.30, log: 0.22, crater: 0.18, pool: 0.12, arch: 0.18 },                                     // 出現の重み
              rock: { rMin: 1.0, rMax: 1.5, hMin: 1.0, hMax: 1.4, shrink: 0.85 },                                           // 岩（1 レーン・レーン中心）：半径 / 高さ（ジャンプ頂点は約2.07）/ 当たりの縮小率
              log: { r: 0.6, h: 1.2, trim: 0.5, oneLane: 0.35 },                                                            // 倒木（1〜2 レーン分の長さ）：幹の半径 / 高さ / レーン幅の合計から削る長さ / 1 レーン分の短い倒木になる割合（残りは 2 レーン分）
              crater: { rMin: 1.5, rMax: 2.5, clearY: 0.5 },                                                                // クレーター（1 レーン）：半径 / これより高く跳んでいれば越える
              pool: { rMin: 2.0, rMax: 3.3, clearY: 1.4 },                                                                  // マグマ溜まり（1 レーン。半径 +恐竜半径が隣のレーン中心に届かない）：半径 / これより高く跳んでいれば上を越える（実質は隣のレーンへ避ける）
              arch: { clear: 1.7, beamH: 1.0, hd: 0.9, inset: 0.2, oneLane: 0.5, gapZ: 20 },                                // 頭上の障害物（くぐる）：下をくぐれる高さ / 梁の厚み / 前後の半分の長さ / レーン端からの引っ込み / 1 レーン幅になる割合（残りは 2 レーン）/ 他の障害物との最低間隔（基準速度。速いほど広がる）。梁の下端 clear > slideH なので立ったままだと頭が当たり、梁の上端 clear+beamH > ジャンプ頂点なのでジャンプでは越えられない
              dinoR: 0.6, depthPad: 0.7, footMargin: 0.2,                                                                                 // 障害物に対する恐竜の当たり半径 / 前後方向の余裕 / 岩・倒木は足がこの分だけ上に出ていれば越えたことにする（甘め）
              trip: { knock: 0.6, up: 6.5, fwd: 7, spin: 7, slowSec: 2.2, slowFactor: 0.6, shake: 0.14 },                   // 岩・倒木で転倒：転がる秒 / 跳ね上がり / 前へ転がる初速 / 回転 / 減速の秒と倍率 / 画面揺れ
              poolTrip: { knock: 0.8, up: 8, fwd: 5, spin: 8, slowSec: 3.0, slowFactor: 0.42, shake: 0.2 },                 // マグマ溜まりに触れた：転倒＋強めの減速
              stumble: { slowSec: 1.0, slowFactor: 0.7, tiltSec: 0.5 },                                                     // クレーター：つまずき（転倒しない・軽い減速）
              oopsSec: 0.9 },                                                                                               // 「うわっ！」表示秒
  // 難易度（Phase 6）。時間の基準は「噴火が始まってからの秒 e」（ゲーム開始から eruptDelay=4 秒後が e=0）。強度 s は 0〜1
  difficulty: {
    knots: [[0, 0], [20, 0.2], [40, 0.5], [60, 0.85], [78, 1]],     // [e 秒, 強度 s]：折れ線でつなぐ（境目で急に変わらない）。60 秒以降は最大へ向かい 78 秒で 1
    stageFrom: [0, 20, 40, 60], labels: ['LOW', 'MID', 'HIGH', 'MAX'],   // チュートリアル / 通常 / 危険ゾーン / 最終逃走 の開始秒と、HUD の危険度の表記
    rock: { interval0: 3.0, interval1: 0.5, curve: 1.0,               // 噴石の落下間隔（秒）：s=0 で 3.0 → s=1 で 0.5（ばらつき ±jitter は別）
            aim0: 0.3, aim1: 0.5,                                    // 恐竜を狙う噴石の割合（rock.aimChance の代わり）：序盤 0.3 → 終盤 0.5（レーン制では「恐竜のいるレーンを覆う」噴石）
            active0: 3, active1: 12,                                  // 同時に落ちている数の上限：3 → 12（描画の枠 rock.maxActive が頭打ち）
            largeFrom: 0.5,                                           // 大型噴石は強度がこの値（= 40 秒時点）を超えるまで出ない。そこから最終までに weights1.large へ増える
            weights0: { small: 0.7, mid: 0.3, large: 0 }, weights1: { small: 0.5, mid: 0.5, large: 0.3 } },   // 序盤 / 終盤の重み（大型を除いた小:中の比と、終盤の大型の割合）
    magmaCurve: 1.5,                                                  // マグマの速さ = speed0 → speedMax を s^magmaCurve で補間
    eruptMul: 0.8,                                                    // 噴火の迫力（煙・火の量）の倍率：s=0 で 0.8 → s=1 で 1.0
    shake: { from: 52, over: 10, amp: 0.07 }                          // 画面全体の常時の小刻みな揺れ：e=52 秒から 10 秒かけて amp（位置のみ・控えめ）まで
  },
  // クリア（安全地帯）。プレイヤーの速さは 16 + 0.04t（t は開始からの秒）なので、距離 = 16t + 0.02t²。
  // distance=2200 → 約 119.5 秒（被弾なし）。被弾の減速（1 回で約 1.5〜2 秒ぶんの遅れ）を数回受けても 2 分台前半、1〜3 分に収まる
  goal: { distance: 2200 },
  // スコア（Phase 8）：基本＝走った距離(m)。ボーナスは 噴石のギリギリ回避 / 大型噴石の回避 / 障害物の連続回避 / マグマが近いまま走り続ける
  score: {
    bestKey: 'dino-escape-best',                                      // localStorage のキー
    near: { lo: 1.0, hi: 1.8 },                                      // 着弾点からの距離が（着弾半径＋恐竜半径）のこの倍率の範囲なら「ギリギリ回避」（ジャンプで爆風の上を越えたときは lo 未満でも可）
    rock: 100, rockLarge: 300,                                       // ギリギリ回避のボーナス（大型は 300）。1 つの噴石につき 1 回だけ（大型の警告円から逃げ切ったときも同じ額）
    comboFrom: 3, comboMul: 50, comboCap: 10, comboLateral: 3.0,     // 障害物の連続回避：3 連続以上で 50×連続数（連続数は cap まで）/ 「回避した」と数える左右の近さ（障害物の幅＋恐竜半径にこの余裕）
    magmaGap: 20, magmaPerSec: 40,                                   // マグマとの距離がこれ以内の状態で走り続けると、1 秒ごとにボーナス
    popSec: 1.1, greatSec: 0.9                                       // 「+100」が浮かぶ秒 / GREAT ESCAPE! の表示秒
  },
  // クリア演出（Phase 8）：段階 runin → breathe → lookback → eruption → relief → result。秒数はここ
  clear: {
    stopDist: 26, runIn: 2.8,                                        // 安全地帯へ走り込む距離(u) と その秒（自動で減速して止まる）
    breathe: 2.0, lookBack: 2.2, lookTurn: 1.5,                      // 息を切らす秒 / 振り返りの段階の秒（そのうち回る秒。残りは火山を見つめる間）
    eruption: 3.4, relief: 3.8, reliefText: 1.1,                     // 大爆発の秒 / ホッとする段階の秒 / 「……危なかった」が出るまでの秒
    skipFrom: 3.0,                                                   // Space で結果画面へ飛ばせるようになる秒（クリアから。連打のジャンプで誤って飛ばさない）
    safeZone: 12,                                                    // ゴールの手前この距離から先には障害物を置かない
    cave: { mouth: 12, length: 48, halfW: 17, height: 30, mass: 34 }, // 洞窟：入口の位置(ゴールから) / 奥行き / 中の半幅 / 高さ / 左右の岩山の厚み
    vol: { safe: 0.25, boom: 1.5, after: 0.4 },                       // 火山の音量の倍率：安全地帯の中 / 大爆発 / そのあと
    flash: { sec: 1.4, max: 1 }, shake: { amp: 0.7, sec: 1.8, rumble: 0.14 }, mega: { burst: 220, smokeMul: 0.8, fireMul: 2.5 },   // 巨大な閃光 / 画面揺れ / 噴煙の増やし方
    lavaSink: 9, lavaSinkSec: 3                                      // クリア後、マグマが引いて沈む（深さと秒）
  },
  // カメラの回り込み（タイトル画面の斜め前からの眺め / クリアの振り返り）。a=0 が通常の後ろ追従、π が真正面（火山側を向く）
  orbit: { R: 14, h: 4.6, lookY: 3.0, lookAhead: 24, tilt: 5 },
  title: { az: 2.85, drift: 0.12, blend: 1.0 },                      // タイトルの視点の角度 / ゆっくり揺れる幅 / 開始時に通常カメラへ戻る秒
  // 演出（Phase 7）。intensity=0〜1 で演出全体の強さを一括で弱められる（0 でシェイク・ヒットストップ・フラッシュ・追加の粒子が無くなる）。ゲームの難易度・物理は一切変えない
  fx: {
    intensity: 1,
    shake: { cap: 0.7, hitAmp: 0.5, bigAmp: 0.7 },                     // 揺れ（位置のみ）の合計上限 / 噴石の直撃時の揺れ / 大型着弾時の揺れ（複数の揺れは二乗和の平方根で合成してから上限）
    hitstop: { rock: 0.065, big: 0.08, trip: 0.04, max: 0.1 },         // ヒットストップの秒（直撃 / 大型の直撃 / 障害物で転倒 / 上限）。ゲーム時間だけが止まり、描画・演出は続く
    vignette: { sec: 0.55, alpha: 0.85 },                              // 被弾時の赤い縁（フラッシュ）の秒 / 濃さ
    duck: { big: 0.5, hit: 0.3, boom: 0.55, hold: 0.12, release: 0.55 },   // 大きな音のときに他の音を一瞬下げる深さ（0〜1）/ 下げたままの秒 / 戻る秒
    blast: { fireLarge: 7, fireMid: 3, smokeLarge: 16, smokeMid: 5, debrisLarge: 18, debrisMid: 7, debrisSmall: 3 },   // 噴石着弾：火球 / 黒煙の柱 / 飛び散る破片 の粒数
    tail: { spark: 1.6, smoke: 1.35 },                                 // 落下中の噴石の尾（火の粉・煙）の量の倍率
    runDust: { perUnit: 0.32, size: 1.3 },                             // 走りの土煙：距離 1u あたりの粒数（速度連動）/ 大きさ
    landDust: 12,                                                      // ジャンプ着地の砂煙の粒数（強く着地するほど増える）
    magma: { spark: 70, steam: 26 },                                   // マグマ先端の火の粉・蒸気の毎秒の量（近いほど増える）
    fear: { range: 11 },                                               // 噴石の危険マーカーがこの距離(u)以内に近づくと恐竜が焦る
    panic: { range: 34 },                                              // マグマとの距離(u)がこれ以内だと必死な走り（脚が速い・口を開ける）
    squash: { land: 0.3, crouch: 0.16 },                               // 着地のつぶれの最大 / 離陸前の溜めの深さ
    beep: { range: 10, gap: 0.14 },                                    // 危険マーカーが近くに出たとき「ピッ」と鳴る距離 / 連続で鳴らさない間隔(秒)
    edge: { base: 0.08, perS: 0.27 },                                   // 噴火中の画面端の赤い縁：基本の濃さ / 難易度の強度 s ごとの上乗せ
    hintSec: 7                                                         // 操作ヒントを出しておく秒（その後フェードアウト）
  },
  sound: { vol: { fall: 0.8, impact: 1.0, scream: 0.8, step: 0.55, jump: 0.6, slide: 0.7, land: 0.7, stinger: 0.7, beep: 0.4, hit: 1.0 }, master: 0.5, rumbleIdle: 0.35, rumbleErupt: 0.85, magmaRumble: 1.0, magmaSizzle: 0.3 },                           // 全体音量 / 待機中・噴火中のゴゴゴ音量 / マグマの低音・ジュワジュワの最大音量
  dt: { max: 0.05 }                                                   // 1 フレームの最大秒（タブ復帰時の飛び防止）
};
