/* カミの立ち絵モーション（7cd48c0 の仕組みを現行肖像へ移植）。
   2026-10-14：全顔のまばたき・被弾差分と動く背景・スサノオの風。
   他の反応用関数は将来用として残す。対戦のイベントはライフ減少のみ。
   見た目だけを定義する。カードの効果・勝敗判定・オンライン同期には関与しない。

   ■ 仕組み
   - 対戦画面のカミの丸い肖像（.kami-portrait）の中に <kami-motion> を重ね、パーツ画像を動かす。
   - KAMI_MOTION_SETS に登録したカミだけが動く。未登録のカミは従来どおり1枚絵のまま（何も変わらない）。
   - 反応のきっかけは対戦画面の表示の変化（ライフ・天力・封印の増減、神技、エモート、手番、勝敗）。
     オンライン対戦では同期された盤面から各端末が同じきっかけを検知するので、通信は増えない。

   ■ 画像の作り方（詳細は kami_motion/README.md）
   - 現行素材は原画と同じ1060×1484。cropで元の肖像と同一の背景サイズ・位置を使う。
   - layers：待機中に重ねるパーツ。下から順に描画する。idle で動き方を指定する（KAMI_MOTION_IDLE_PRESETS）。
   - blink：顔全体の表情差分（内側は不透明）。数秒おきに一瞬だけ置き換える。
   - poses：反応ごとの差分（全身1枚、または frames で連番）。無い反応は、近い反応の差分→待機の絵の順に代わりに使う。

   登録例：
     '1': {
       layers: [
         { src: 'kami_motion/susanoo-back-0123456789ab.webp', idle: 'sway' },      // 後ろ髪・衣のなびき
         { src: 'kami_motion/susanoo-body-0123456789ab.webp', idle: 'breathe' },   // 体（呼吸）
       ],
       blink: 'kami_motion/susanoo-blink-0123456789ab.webp',
       poses: {
         damage: 'kami_motion/susanoo-damage-0123456789ab.webp',
         tenryoku: { frames: ['kami_motion/susanoo-tenryoku-1-….webp', 'kami_motion/susanoo-tenryoku-2-….webp'], fps: 10 },
         pinch: 'kami_motion/susanoo-pinch-0123456789ab.webp',   // ライフが少ないときの待機（任意）
       },
     },
*/
"use strict";

// 待機中のパーツの動き方。値は kami_motion.css の .kami-motion-idle-○○ に対応する
const KAMI_MOTION_IDLE_PRESETS = Object.freeze(['none', 'breathe', 'sway', 'sway-slow', 'float', 'hair-left', 'hair-right', 'robe']);

/* 反応の種類。
   duration：差分を見せる時間（ミリ秒、標準速度）。hold：決着まで出し続ける。
   effect：差分に重ねる画面効果（kami_motion.css の .kami-motion-fx-○○）。
   priority：表示中の反応より低いものは割り込まない。fallback：差分が無いときに代わりに使う反応 */
const KAMI_MOTION_EVENTS = Object.freeze({
  damage:      Object.freeze({ label: 'ダメージを受けた', duration: 900, effect: 'shake', priority: 3 }),
  damageHeavy: Object.freeze({ label: '大ダメージ（3以上）', duration: 1200, effect: 'shake-heavy', priority: 4, fallback: 'damage' }),
  heal:        Object.freeze({ label: 'ライフ回復', duration: 1000, effect: 'heal', priority: 2 }),
  tenryoku:    Object.freeze({ label: '天力を獲得', duration: 1000, effect: 'tenryoku', priority: 2 }),
  sealBreak:   Object.freeze({ label: '封印が解ける（ヤマタノオロチ）', duration: 1200, effect: 'seal', priority: 3, fallback: 'tenryoku' }),
  skill1:      Object.freeze({ label: '神技', duration: 1400, effect: 'skill', priority: 4 }),
  skill2:      Object.freeze({ label: '創世神技', duration: 1600, effect: 'skill', priority: 5, fallback: 'skill1' }),
  turnStart:   Object.freeze({ label: '自分のターン開始', duration: 900, effect: 'nod', priority: 1 }),
  emote:       Object.freeze({ label: 'エモート', duration: 1600, effect: 'nod', priority: 1 }),
  win:         Object.freeze({ label: '勝利', hold: true, effect: 'skill', priority: 6 }),
  lose:        Object.freeze({ label: '敗北', hold: true, effect: 'none', priority: 6, fallback: 'damageHeavy' }),
});
// エモートは種類ごとの差分（poses['emote:greeting'] など）を優先し、無ければ poses.emote を使う
const KAMI_MOTION_EMOTE_KEYS = Object.freeze(['greeting', 'confusion', 'praise', 'surprise', 'taunt', 'boast']);

// カミごとの画像の登録。Codex が画像を作ったらここへ追加する（キーはカミの No.）
const KAMI_MOTION_SETS = Object.freeze({
  "1": {
    "rig": {
      "background": "kami_motion/susanoo-full-face-background-279710e9350d.webp",
      "breath": 4.8,
      "strength": 1.15,
      "wind": "kami_motion/susanoo-full-face-wind-1e07193c33c0.webp",
      "canvas": [
        1061,
        1482
      ],
      "actors": [],
      "effects": []
    },
    "layers": [
      {
        "src": "kami_motion/susanoo-seamless-hair-7b5657db857c.webp",
        "idle": "hair-right",
        "style": {
          "transformOrigin": "54.7% 12.8%"
        }
      },
      {
        "src": "kami_motion/susanoo-seamless-robe-b06974384c7d.webp",
        "idle": "robe",
        "style": {
          "transformOrigin": "67.3% 34.8%"
        }
      },
      {
        "src": "kami_motion/susanoo-seamless-body-766d6614f09c.webp",
        "idle": "none"
      }
    ],
    "poses": {
      "damage": {
        "frames": [
          "kami_motion/susanoo-seamless-light-full-face-damage-e7ef45df1886.webp",
          "kami_motion/susanoo-seamless-recovery-full-face-open-603599f90dc5.webp"
        ],
        "durations": [
          320,
          580
        ],
        "overlay": true,
        "fullFace": true
      },
      "damageHeavy": {
        "frames": [
          "kami_motion/susanoo-strong-pain-heavy-full-face-damage-23fceaa1eeed.webp",
          "kami_motion/susanoo-seamless-full-face-closed-0d046f5b22e4.webp",
          "kami_motion/susanoo-seamless-full-face-half-5ac42e6026de.webp"
        ],
        "durations": [
          800,
          240,
          160
        ],
        "overlay": true,
        "fullFace": true
      }
    },
    "blink": {
      "frames": [
        "kami_motion/susanoo-seamless-full-face-half-5ac42e6026de.webp",
        "kami_motion/susanoo-seamless-full-face-closed-0d046f5b22e4.webp",
        "kami_motion/susanoo-seamless-full-face-half-5ac42e6026de.webp"
      ],
      "durations": [
        55,
        90,
        65
      ],
      "fullFace": true
    }
  },
  "2": {
    "rig": {
      "background": "kami_motion/yamato-separated-background-b90f177ae414.webp",
      "breath": 5.6,
      "strength": 0.72,
      "petal": "kami_motion/shared-motion-sakura-petal-307cd6de5be0.webp",
      "canvas": [
        1061,
        1483
      ],
      "actors": [
        {
          "src": "kami_motion/yamato-separated-spirit-sword-1-e87dc99bebc7.webp",
          "idle": "sword",
          "box": [
            0,
            0.060687795010114634,
            0.17907634307257306,
            0.19554956169925827
          ],
          "stage": "back",
          "cycle": 5.2,
          "delay": -1.1
        },
        {
          "src": "kami_motion/yamato-separated-spirit-sword-2-3b4bae432f74.webp",
          "idle": "sword",
          "box": [
            0.706880301602262,
            0,
            0.292177191328935,
            0.24612272420768713
          ],
          "stage": "back",
          "cycle": 6.3,
          "delay": -3
        },
        {
          "src": "kami_motion/yamato-separated-spirit-sword-3-4f0176ac3b0b.webp",
          "idle": "sword",
          "box": [
            0.10367577756833177,
            0.39109912339851655,
            0.8388312912346843,
            0.5124747134187457
          ],
          "stage": "front",
          "cycle": 7.1,
          "delay": -2.2
        }
      ],
      "effects": [
        {
          "src": "kami_motion/yamato-separated-effect-498ae8b67d7b.webp",
          "kind": "flow",
          "stage": "back",
          "cycle": 10,
          "delay": -1.5
        },
        {
          "src": "kami_motion/yamato-separated-effect-498ae8b67d7b.webp",
          "kind": "flow",
          "stage": "back",
          "cycle": 10,
          "delay": -6.5
        }
      ]
    },
    "layers": [
      {
        "src": "kami_motion/yamato-separated-hair-f450408b7d76.webp",
        "idle": "hair-right",
        "style": {
          "transformOrigin": "53.3% 10.7%"
        }
      },
      {
        "src": "kami_motion/yamato-separated-robe-60b03067c400.webp",
        "idle": "robe",
        "style": {
          "transformOrigin": "54.4% 45.7%"
        }
      },
      {
        "src": "kami_motion/yamato-separated-body-652cbbf7bc15.webp",
        "idle": "none"
      }
    ],
    "poses": {
      "damage": {
        "frames": [
          "kami_motion/yamato-light-full-face-damage-99480692f360.webp",
          "kami_motion/yamato-recovery-full-face-open-ec02b5169feb.webp"
        ],
        "durations": [
          320,
          580
        ],
        "overlay": true,
        "fullFace": true
      },
      "damageHeavy": {
        "frames": [
          "kami_motion/yamato-separated-full-face-damage-cbba154ed5b0.webp",
          "kami_motion/yamato-separated-full-face-closed-7fb014b8d99b.webp",
          "kami_motion/yamato-separated-full-face-half-6f22f764b67e.webp"
        ],
        "durations": [
          800,
          240,
          160
        ],
        "overlay": true,
        "fullFace": true
      }
    },
    "blink": {
      "frames": [
        "kami_motion/yamato-separated-full-face-half-6f22f764b67e.webp",
        "kami_motion/yamato-separated-full-face-closed-7fb014b8d99b.webp",
        "kami_motion/yamato-separated-full-face-half-6f22f764b67e.webp"
      ],
      "durations": [
        55,
        90,
        65
      ],
      "fullFace": true
    }
  },
  "3": {
    "rig": {
      "background": "kami_motion/okuninushi-separated-background-2ad51a6e71d8.webp",
      "breath": 5.5,
      "strength": 0.85,
      "canvas": [
        1062,
        1480
      ],
      "actors": [
        {
          "src": "kami_motion/okuninushi-anchored-owl-4abf6c2bef72.webp",
          "idle": "owl",
          "box": [
            0.6847438794726931,
            0.07348851351351346,
            0.3069679849340866,
            0.22027027027027027
          ],
          "stage": "character",
          "cycle": 8.4,
          "delay": 0,
          "origin": "43% 84%",
          "frames": "owlAnchored",
          "grid": [
            3,
            1
          ],
          "blend": false,
          "breathSrc": "kami_motion/okuninushi-owl-chest-274c2b6bcab4.webp"
        },
        {
          "src": "kami_motion/okuninushi-anchored-fox-c98d792a792f.webp",
          "idle": "fox",
          "box": [
            -0.01883239171374762,
            0.33202702702702697,
            0.423728813559322,
            0.30405405405405406
          ],
          "stage": "front",
          "cycle": 6.9,
          "delay": -3.4,
          "origin": "50% 100%",
          "frames": "foxAnchored",
          "grid": [
            3,
            1
          ],
          "blend": false,
          "breathSrc": "kami_motion/okuninushi-fox-chest-ac6bb5bdbcfa.webp"
        }
      ],
      "effects": [
        {
          "src": "kami_motion/okuninushi-separated-effect-47389832cda3.webp",
          "kind": "flow",
          "stage": "back",
          "cycle": 10,
          "delay": -1.5
        },
        {
          "src": "kami_motion/okuninushi-separated-effect-47389832cda3.webp",
          "kind": "flow",
          "stage": "back",
          "cycle": 10,
          "delay": -6.5
        }
      ]
    },
    "layers": [
      {
        "src": "kami_motion/okuninushi-face-fixed-hair-b54f8ef648f4.webp",
        "idle": "hair-right"
      },
      {
        "src": "kami_motion/okuninushi-face-fixed-robe-0465b8d2c2f5.webp",
        "idle": "robe"
      },
      {
        "src": "kami_motion/okuninushi-face-fixed-body-8ab58e694c08.webp",
        "idle": "none"
      }
    ],
    "poses": {
      "damage": {
        "frames": [
          "kami_motion/okuninushi-light-full-face-damage-4193ab7d836e.webp",
          "kami_motion/okuninushi-recovery-full-face-open-d318871a3be6.webp"
        ],
        "durations": [
          320,
          580
        ],
        "overlay": true,
        "fullFace": true
      },
      "damageHeavy": {
        "frames": [
          "kami_motion/okuninushi-separated-full-face-damage-70c1ac638d14.webp",
          "kami_motion/okuninushi-anchored-full-face-closed-3f4dce92de5b.webp",
          "kami_motion/okuninushi-anchored-full-face-half-0a7a356ce2d0.webp"
        ],
        "durations": [
          800,
          240,
          160
        ],
        "overlay": true,
        "fullFace": true
      }
    },
    "blink": {
      "frames": [
        "kami_motion/okuninushi-anchored-full-face-half-0a7a356ce2d0.webp",
        "kami_motion/okuninushi-anchored-full-face-closed-3f4dce92de5b.webp",
        "kami_motion/okuninushi-anchored-full-face-half-0a7a356ce2d0.webp"
      ],
      "durations": [
        55,
        90,
        65
      ],
      "fullFace": true
    }
  },
  "4": {
    "rig": {
      "background": "kami_motion/takemikazuchi-separated-background-38508d01cc3d.webp",
      "breath": 4.7,
      "strength": 0.82,
      "canvas": [
        1061,
        1482
      ],
      "actors": [],
      "effects": [
        {
          "src": "kami_motion/takemikazuchi-branching-lightning-49d0f849bf45.webp",
          "kind": "lightning",
          "stage": "back",
          "cycle": 5.8,
          "delay": -1.4
        },
        {
          "src": "kami_motion/takemikazuchi-branching-lightning-49d0f849bf45.webp",
          "kind": "lightning",
          "stage": "back",
          "cycle": 8.2,
          "delay": -4.1,
          "mirror": true
        }
      ],
      "lightning": true,
      "weaponLightning": [
        {
          "points": "43,102 97,173 90,197 177,292 162,322 258,433 244,462 344,579 334,609 447,741 437,764 548,848",
          "cycle": 2.9,
          "delay": -0.6,
          "width": 3.4
        },
        {
          "points": "160,322 115,300 123,333 83,345 99,373 54,401",
          "cycle": 3.7,
          "delay": -1.9,
          "width": 2.4
        },
        {
          "points": "250,448 302,452 279,485 338,500 321,540 369,558",
          "cycle": 4.6,
          "delay": -3.1,
          "width": 2.5
        },
        {
          "points": "443,744 391,753 405,784 348,815 371,839",
          "cycle": 3.3,
          "delay": -0.8,
          "width": 2.2
        }
      ]
    },
    "layers": [
      {
        "src": "kami_motion/takemikazuchi-separated-hair-8015fff1f4d0.webp",
        "idle": "hair-right",
        "style": {
          "transformOrigin": "30.2% 1.4%"
        }
      },
      {
        "src": "kami_motion/takemikazuchi-separated-robe-e4502ad7392c.webp",
        "idle": "robe",
        "style": {
          "transformOrigin": "84.3% 27.7%"
        }
      },
      {
        "src": "kami_motion/takemikazuchi-separated-body-deb045caa633.webp",
        "idle": "none"
      }
    ],
    "poses": {
      "damage": {
        "frames": [
          "kami_motion/takemikazuchi-light-full-face-damage-807fe8e372fc.webp",
          "kami_motion/takemikazuchi-recovery-full-face-open-c02ad71a83b7.webp"
        ],
        "durations": [
          320,
          580
        ],
        "overlay": true,
        "fullFace": true
      },
      "damageHeavy": {
        "frames": [
          "kami_motion/takemikazuchi-separated-full-face-damage-501d286b46c1.webp",
          "kami_motion/takemikazuchi-separated-full-face-closed-742b2e3fdcde.webp",
          "kami_motion/takemikazuchi-separated-full-face-half-cee31b321c09.webp"
        ],
        "durations": [
          800,
          240,
          160
        ],
        "overlay": true,
        "fullFace": true
      }
    },
    "blink": {
      "frames": [
        "kami_motion/takemikazuchi-separated-full-face-half-cee31b321c09.webp",
        "kami_motion/takemikazuchi-separated-full-face-closed-742b2e3fdcde.webp",
        "kami_motion/takemikazuchi-separated-full-face-half-cee31b321c09.webp"
      ],
      "durations": [
        55,
        90,
        65
      ],
      "fullFace": true
    }
  },
  "5": {
    "rig": {
      "background": "kami_motion/omoikane-separated-background-12dcfa6b60ce.webp",
      "breath": 6.1,
      "strength": 0.78,
      "petal": "kami_motion/shared-motion-sakura-petal-307cd6de5be0.webp",
      "canvas": [
        1061,
        1482
      ],
      "actors": [
        {
          "src": "kami_motion/omoikane-separated-scroll-1-ac21d251823a.webp",
          "idle": "scroll",
          "box": [
            0.03298774740810556,
            0.0553306342780027,
            0.37134778510838834,
            0.1882591093117409
          ],
          "stage": "back",
          "cycle": 7.4,
          "delay": -2,
          "glyphs": [
            {
              "region": [
                0.15736040609137056,
                0.30824372759856633,
                0.08121827411167512,
                0.15770609318996415
              ],
              "cycle": 6.6,
              "delay": -1.518,
              "sway": -18
            },
            {
              "region": [
                0.17766497461928935,
                0.4551971326164875,
                0.08629441624365482,
                0.17562724014336917
              ],
              "cycle": 7.3999999999999995,
              "delay": -6.27545151675,
              "sway": -1
            },
            {
              "region": [
                0.20558375634517767,
                0.6344086021505376,
                0.08629441624365482,
                0.16487455197132617
              ],
              "cycle": 7.6499999999999995,
              "delay": -3.565420027875,
              "sway": 16
            },
            {
              "region": [
                0.27411167512690354,
                0.3010752688172043,
                0.09898477157360407,
                0.17204301075268819
              ],
              "cycle": 8.45,
              "delay": -0.7106616148124999,
              "sway": -8
            },
            {
              "region": [
                0.31725888324873097,
                0.45878136200716846,
                0.10406091370558376,
                0.16487455197132617
              ],
              "cycle": 8.700000000000001,
              "delay": -6.108582808500002,
              "sway": 9
            },
            {
              "region": [
                0.36548223350253806,
                0.6236559139784946,
                0.07868020304568528,
                0.14336917562724014
              ],
              "cycle": 8.95,
              "delay": -2.8655209965625024,
              "sway": -15
            },
            {
              "region": [
                0.5025380710659898,
                0.3763440860215054,
                0.07868020304568528,
                0.13620071684587814
              ],
              "cycle": 9.75,
              "delay": -9.147488341875,
              "sway": 2
            },
            {
              "region": [
                0.5279187817258884,
                0.5125448028673835,
                0.08883248730964467,
                0.12903225806451613
              ],
              "cycle": 6.71,
              "delay": -3.732356451587507,
              "sway": 19
            },
            {
              "region": [
                0.5583756345177665,
                0.5842293906810035,
                0.07868020304568528,
                0.11469534050179211
              ],
              "cycle": 7.51,
              "delay": -1.3087820441000055,
              "sway": -5
            },
            {
              "region": [
                0.7081218274111675,
                0.35125448028673834,
                0.09644670050761421,
                0.15412186379928317
              ],
              "cycle": 7.759999999999999,
              "delay": -6.148293774300003,
              "sway": 12
            }
          ]
        },
        {
          "src": "kami_motion/omoikane-separated-scroll-2-f08dd0a3a9d7.webp",
          "idle": "scroll",
          "box": [
            0,
            0.4352226720647773,
            1,
            0.5060728744939271
          ],
          "stage": "front",
          "cycle": 8.4,
          "delay": -3,
          "glyphs": [
            {
              "region": [
                0.061262959472196045,
                0.152,
                0.05089538171536286,
                0.06666666666666667
              ],
              "cycle": 8.01,
              "delay": -3.2868224988750083,
              "sway": -12
            },
            {
              "region": [
                0.04524033930254477,
                0.232,
                0.05089538171536286,
                0.06666666666666667
              ],
              "cycle": 8.81,
              "delay": -0.24997384976250672,
              "sway": 5
            },
            {
              "region": [
                0.13949104618284638,
                0.22666666666666666,
                0.05089538171536286,
                0.06666666666666667
              ],
              "cycle": 9.059999999999999,
              "delay": -5.856455256900003,
              "sway": 22
            },
            {
              "region": [
                0.1536286522148916,
                0.31333333333333335,
                0.05089538171536286,
                0.06666666666666667
              ],
              "cycle": 9.86,
              "delay": -2.6073966779750015,
              "sway": -2
            },
            {
              "region": [
                0.2412818096135721,
                0.30533333333333335,
                0.05089538171536286,
                0.06666666666666667
              ],
              "cycle": 6.819999999999999,
              "delay": -6.018485245850011,
              "sway": 15
            },
            {
              "region": [
                0.26013195098963243,
                0.396,
                0.05089538171536286,
                0.06666666666666667
              ],
              "cycle": 7.069999999999999,
              "delay": -3.538604506937509,
              "sway": -9
            },
            {
              "region": [
                0.3289349670122526,
                0.38133333333333336,
                0.05089538171536286,
                0.06666666666666667
              ],
              "cycle": 7.869999999999999,
              "delay": -0.9329398634000083,
              "sway": 8
            },
            {
              "region": [
                0.35061262959472195,
                0.476,
                0.05089538171536286,
                0.06666666666666667
              ],
              "cycle": 8.12,
              "delay": -5.981011807050006,
              "sway": -16
            },
            {
              "region": [
                0.43261074458058435,
                0.456,
                0.05089538171536286,
                0.06666666666666667
              ],
              "cycle": 8.92,
              "delay": -3.1631372337000045,
              "sway": 1
            },
            {
              "region": [
                0.45617342130065974,
                0.552,
                0.05089538171536286,
                0.06666666666666667
              ],
              "cycle": 9.17,
              "delay": -8.919161859912519,
              "sway": 18
            },
            {
              "region": [
                0.5409990574929312,
                0.5346666666666666,
                0.05089538171536286,
                0.06666666666666667
              ],
              "cycle": 9.42,
              "delay": -5.564203480500016,
              "sway": -6
            },
            {
              "region": [
                0.5655042412818096,
                0.636,
                0.05089538171536286,
                0.06666666666666667
              ],
              "cycle": 6.93,
              "delay": -1.4463863827875096,
              "sway": 11
            },
            {
              "region": [
                0.6399622997172478,
                0.6026666666666667,
                0.05089538171536286,
                0.06666666666666667
              ],
              "cycle": 7.18,
              "delay": -5.936048862950008,
              "sway": -13
            },
            {
              "region": [
                0.6710650329877474,
                0.7053333333333334,
                0.05089538171536286,
                0.06666666666666667
              ],
              "cycle": 7.9799999999999995,
              "delay": -3.549358295175006,
              "sway": 4
            },
            {
              "region": [
                0.7360980207351555,
                0.6693333333333333,
                0.05089538171536286,
                0.06666666666666667
              ],
              "cycle": 8.23,
              "delay": -0.5169734579000043,
              "sway": 21
            },
            {
              "region": [
                0.7681432610744581,
                0.7773333333333333,
                0.05089538171536286,
                0.06666666666666667
              ],
              "cycle": 8.48,
              "delay": -5.773605615000017,
              "sway": -3
            },
            {
              "region": [
                0.8331762488218661,
                0.7426666666666667,
                0.05089538171536286,
                0.06666666666666667
              ],
              "cycle": 9.28,
              "delay": -2.773640805599999,
              "sway": 14
            },
            {
              "region": [
                0.8444863336475024,
                0.8026666666666666,
                0.05089538171536286,
                0.06666666666666667
              ],
              "cycle": 9.53,
              "delay": -8.73822564526253,
              "sway": -10
            },
            {
              "region": [
                0.24599434495758718,
                0.35333333333333333,
                0.05089538171536286,
                0.06666666666666667
              ],
              "cycle": 7.04,
              "delay": -3.7660598624000206,
              "sway": 7
            },
            {
              "region": [
                0.44015080113100846,
                0.5106666666666667,
                0.05089538171536286,
                0.06666666666666667
              ],
              "cycle": 7.289999999999999,
              "delay": -1.1152655616375189,
              "sway": -17
            }
          ]
        }
      ],
      "effects": [
        {
          "src": "kami_motion/omoikane-separated-effect-8a1f867c73a6.webp",
          "kind": "flow",
          "stage": "back",
          "cycle": 10,
          "delay": -1.5
        },
        {
          "src": "kami_motion/omoikane-separated-effect-8a1f867c73a6.webp",
          "kind": "flow",
          "stage": "back",
          "cycle": 10,
          "delay": -6.5
        }
      ]
    },
    "layers": [
      {
        "src": "kami_motion/omoikane-face-fixed-hair-826024c0a6d7.webp",
        "idle": "hair-right"
      },
      {
        "src": "kami_motion/omoikane-face-fixed-robe-1ccbbc3e34dc.webp",
        "idle": "robe"
      },
      {
        "src": "kami_motion/omoikane-face-fixed-body-a9b6fa858240.webp",
        "idle": "none"
      }
    ],
    "poses": {
      "damage": {
        "frames": [
          "kami_motion/omoikane-clean-lids-light-full-face-damage-2be382d36fe6.webp",
          "kami_motion/omoikane-recovery-full-face-open-440e7c705170.webp"
        ],
        "durations": [
          320,
          580
        ],
        "overlay": true,
        "fullFace": true
      },
      "damageHeavy": {
        "frames": [
          "kami_motion/omoikane-natural-mouth-heavy-full-face-damage-d9d5918b28f5.webp",
          "kami_motion/omoikane-clean-lids-full-face-closed-3a9b3c47da6f.webp",
          "kami_motion/omoikane-clean-lids-full-face-half-cedfac7f2725.webp"
        ],
        "durations": [
          800,
          240,
          160
        ],
        "overlay": true,
        "fullFace": true
      }
    },
    "blink": {
      "frames": [
        "kami_motion/omoikane-clean-lids-full-face-half-cedfac7f2725.webp",
        "kami_motion/omoikane-clean-lids-full-face-closed-3a9b3c47da6f.webp",
        "kami_motion/omoikane-clean-lids-full-face-half-cedfac7f2725.webp"
      ],
      "durations": [
        55,
        90,
        65
      ],
      "fullFace": true
    }
  },
  "6": {
    "rig": {
      "background": "kami_motion/uzume-separated-background-43886adccdae.webp",
      "breath": 5.8,
      "strength": 1.05,
      "canvas": [
        1060,
        1484
      ],
      "actors": [],
      "effects": [
        {
          "src": "kami_motion/uzume-separated-effect-d4ca99e22754.webp",
          "kind": "flow",
          "stage": "back",
          "cycle": 10,
          "delay": -1.5
        },
        {
          "src": "kami_motion/uzume-separated-effect-d4ca99e22754.webp",
          "kind": "flow",
          "stage": "back",
          "cycle": 10,
          "delay": -6.5
        }
      ],
      "gust": {
        "petals": [
          "kami_motion/uzume-camellia-red-37d38d8d7ea4.webp",
          "kami_motion/uzume-camellia-white-61225eb4648e.webp"
        ],
        "cycle": 10
      }
    },
    "layers": [
      {
        "src": "kami_motion/uzume-face-fixed-seamless-hair-898787b75b18.webp",
        "idle": "hair-right",
        "style": {
          "transformOrigin": "0.0% 21.6%"
        }
      },
      {
        "src": "kami_motion/uzume-face-fixed-seamless-robe-761cc986063d.webp",
        "idle": "robe",
        "style": {
          "transformOrigin": "0.0% 38.1%"
        }
      },
      {
        "src": "kami_motion/uzume-face-fixed-seamless-body-b51e42b0f6ac.webp",
        "idle": "none"
      }
    ],
    "poses": {
      "damage": {
        "frames": [
          "kami_motion/uzume-one-eye-light-full-face-damage-404b06da9e12.webp",
          "kami_motion/uzume-recovery-full-face-open-4260606583dc.webp"
        ],
        "durations": [
          320,
          580
        ],
        "overlay": true,
        "fullFace": true
      },
      "damageHeavy": {
        "frames": [
          "kami_motion/uzume-separated-full-face-damage-d9750fe867f3.webp",
          "kami_motion/uzume-separated-full-face-closed-4a2b0314e0c5.webp",
          "kami_motion/uzume-separated-full-face-half-5d5df79107b3.webp"
        ],
        "durations": [
          800,
          240,
          160
        ],
        "overlay": true,
        "fullFace": true
      }
    },
    "blink": {
      "frames": [
        "kami_motion/uzume-separated-full-face-half-5d5df79107b3.webp",
        "kami_motion/uzume-separated-full-face-closed-4a2b0314e0c5.webp",
        "kami_motion/uzume-separated-full-face-half-5d5df79107b3.webp"
      ],
      "durations": [
        55,
        90,
        65
      ],
      "fullFace": true
    }
  },
  "7": {
    "rig": {
      "background": "kami_motion/hinokagutsuchi-separated-background-28b9dd5debc0.webp",
      "breath": 4.3,
      "strength": 1.12,
      "canvas": [
        1060,
        1484
      ],
      "actors": [],
      "effects": [
        {
          "src": "kami_motion/hinokagutsuchi-separated-effect-9f566cb8d8cc.webp",
          "kind": "flame",
          "stage": "back",
          "cycle": 5.9,
          "delay": -1.7
        },
        {
          "src": "kami_motion/hinokagutsuchi-separated-effect-9f566cb8d8cc.webp",
          "kind": "flame",
          "stage": "back",
          "cycle": 7.2,
          "delay": -4.1
        }
      ],
      "heatHaze": true
    },
    "layers": [
      {
        "src": "kami_motion/hinokagutsuchi-separated-hair-d82abed6f6ac.webp",
        "idle": "hair-right",
        "style": {
          "transformOrigin": "51.1% 13.4%"
        }
      },
      {
        "src": "kami_motion/hinokagutsuchi-separated-robe-ffff8e6ee074.webp",
        "idle": "robe",
        "style": {
          "transformOrigin": "0.0% 41.0%"
        }
      },
      {
        "src": "kami_motion/hinokagutsuchi-separated-body-9ce752df4625.webp",
        "idle": "none"
      }
    ],
    "poses": {
      "damage": {
        "frames": [
          "kami_motion/hinokagutsuchi-light-full-face-damage-31e3e25cc286.webp",
          "kami_motion/hinokagutsuchi-recovery-full-face-open-0dabccb0014c.webp"
        ],
        "durations": [
          320,
          580
        ],
        "overlay": true,
        "fullFace": true
      },
      "damageHeavy": {
        "frames": [
          "kami_motion/hinokagutsuchi-separated-full-face-damage-5813a80b9110.webp",
          "kami_motion/hinokagutsuchi-separated-full-face-closed-9284eeb14677.webp",
          "kami_motion/hinokagutsuchi-separated-full-face-half-9f8d9bf78fe7.webp"
        ],
        "durations": [
          800,
          240,
          160
        ],
        "overlay": true,
        "fullFace": true
      }
    },
    "blink": {
      "frames": [
        "kami_motion/hinokagutsuchi-separated-full-face-half-9f8d9bf78fe7.webp",
        "kami_motion/hinokagutsuchi-separated-full-face-closed-9284eeb14677.webp",
        "kami_motion/hinokagutsuchi-separated-full-face-half-9f8d9bf78fe7.webp"
      ],
      "durations": [
        55,
        90,
        65
      ],
      "fullFace": true
    }
  },
  "8": {
    "rig": {
      "background": "kami_motion/amaterasu-separated-background-cb624e48121a.webp",
      "petal": "kami_motion/shared-motion-sakura-petal-307cd6de5be0.webp",
      "breath": 5.2,
      "strength": 1,
      "canvas": [
        1060,
        1484
      ],
      "actors": [
        {
          "src": "kami_motion/amaterasu-separated-floating-mirror-cbd392531360.webp",
          "idle": "mirror",
          "box": [
            0.75,
            0.09973045822102426,
            0.24528301886792453,
            0.1752021563342318
          ],
          "stage": "back",
          "cycle": 7.7,
          "delay": -2.3
        }
      ],
      "effects": [],
      "lighting": "sunlight"
    },
    "layers": [
      {
        "src": "kami_motion/amaterasu-separated-hair-left-005e9ae72577.webp",
        "idle": "hair-left"
      },
      {
        "src": "kami_motion/amaterasu-separated-hair-right-a2168178df16.webp",
        "idle": "hair-right"
      },
      {
        "src": "kami_motion/amaterasu-separated-robe-a8c11d10db5c.webp",
        "idle": "robe"
      },
      {
        "src": "kami_motion/amaterasu-separated-body-5ce7d2af6d53.webp",
        "idle": "none"
      },
      {
        "src": "kami_motion/amaterasu-separated-body-5ce7d2af6d53.webp",
        "idle": "breathe"
      }
    ],
    "blink": {
      "frames": [
        "kami_motion/amaterasu-separated-full-face-half-5e87e207d6f5.webp",
        "kami_motion/amaterasu-separated-full-face-closed-0f6348fe9a7b.webp",
        "kami_motion/amaterasu-separated-full-face-half-5e87e207d6f5.webp"
      ],
      "durations": [
        55,
        90,
        65
      ],
      "fullFace": true
    },
    "poses": {
      "damage": {
        "frames": [
          "kami_motion/amaterasu-light-full-face-damage-7bfe2a4fca22.webp",
          "kami_motion/amaterasu-recovery-full-face-open-ebc945b59611.webp"
        ],
        "durations": [
          320,
          580
        ],
        "overlay": true,
        "fullFace": true
      },
      "damageHeavy": {
        "frames": [
          "kami_motion/amaterasu-separated-full-face-damage-b9c8092eb0ae.webp",
          "kami_motion/amaterasu-separated-full-face-closed-0f6348fe9a7b.webp",
          "kami_motion/amaterasu-separated-full-face-half-5e87e207d6f5.webp"
        ],
        "durations": [
          800,
          240,
          160
        ],
        "overlay": true,
        "fullFace": true
      }
    }
  },
  "9": {
    "rig": {
      "background": "kami_motion/tsukuyomi-separated-background-e0aeedb5e11f.webp",
      "breath": 6.2,
      "strength": 0.7,
      "petal": "kami_motion/shared-motion-sakura-petal-307cd6de5be0.webp",
      "canvas": [
        1061,
        1482
      ],
      "actors": [
        {
          "src": "kami_motion/tsukuyomi-butterfly-blue-12-aed1ff1e282c.webp",
          "idle": "butterfly",
          "box": [
            0.065,
            0.28,
            0.095,
            0.06801282051282051
          ],
          "stage": "front",
          "cycle": 9.1,
          "delay": -2,
          "grid": [
            4,
            3
          ],
          "frames": "butterfly12",
          "origin": "50% 54%",
          "wingCycle": 1.13,
          "wingDelay": -0.18
        },
        {
          "src": "kami_motion/tsukuyomi-butterfly-violet-12-5d6921bb5049.webp",
          "idle": "butterfly",
          "box": [
            0.81,
            0.44,
            0.09,
            0.0644331983805668
          ],
          "stage": "front",
          "cycle": 13.1,
          "delay": -4.7,
          "grid": [
            4,
            3
          ],
          "frames": "butterfly12",
          "origin": "50% 54%",
          "wingCycle": 0.97,
          "wingDelay": -0.57
        }
      ],
      "effects": [],
      "lighting": "moonlight"
    },
    "layers": [
      {
        "src": "kami_motion/tsukuyomi-stable-hair-ed8e8448b4f1.webp",
        "idle": "hair-right"
      },
      {
        "src": "kami_motion/tsukuyomi-stable-robe-974ae6d778b2.webp",
        "idle": "robe"
      },
      {
        "src": "kami_motion/tsukuyomi-stable-body-5adda80fdf4f.webp",
        "idle": "none"
      }
    ],
    "poses": {
      "damage": {
        "frames": [
          "kami_motion/tsukuyomi-light-full-face-damage-23ea5a712d99.webp",
          "kami_motion/tsukuyomi-recovery-full-face-open-5abdd710ff26.webp"
        ],
        "durations": [
          320,
          580
        ],
        "overlay": true,
        "fullFace": true
      },
      "damageHeavy": {
        "frames": [
          "kami_motion/tsukuyomi-separated-full-face-damage-9e3f654a9ff8.webp",
          "kami_motion/tsukuyomi-anchored-full-face-closed-2a9984a48990.webp",
          "kami_motion/tsukuyomi-anchored-full-face-half-23ea5a712d99.webp"
        ],
        "durations": [
          800,
          240,
          160
        ],
        "overlay": true,
        "fullFace": true
      }
    },
    "blink": {
      "frames": [
        "kami_motion/tsukuyomi-anchored-full-face-half-23ea5a712d99.webp",
        "kami_motion/tsukuyomi-anchored-full-face-closed-2a9984a48990.webp",
        "kami_motion/tsukuyomi-anchored-full-face-half-23ea5a712d99.webp"
      ],
      "durations": [
        55,
        90,
        65
      ],
      "fullFace": true
    }
  },
  "10": {
    "rig": {
      "background": "kami_motion/orochi-separated-background-e62b8fd6bbb1.webp",
      "breath": 6.6,
      "strength": 0.85,
      "canvas": [
        1060,
        1484
      ],
      "actors": [
        {
          "src": "kami_motion/orochi-original-scale-left-33d85de7d3bd.webp",
          "idle": "dragon",
          "box": [
            0,
            0.21900269541778974,
            0.34150943396226413,
            0.29649595687331537
          ],
          "stage": "back",
          "cycle": 7.8,
          "delay": 0,
          "origin": "50% 95%"
        },
        {
          "src": "kami_motion/orochi-original-scale-right-6cbe76b9dc0a.webp",
          "idle": "dragon",
          "box": [
            0.7169811320754716,
            0.24123989218328842,
            0.2830188679245283,
            0.3335579514824798
          ],
          "stage": "back",
          "cycle": 9.4,
          "delay": -2.1,
          "origin": "50% 95%"
        },
        {
          "src": "kami_motion/orochi-separated-floating-orb-785a6e4223a8.webp",
          "idle": "orb",
          "box": [
            0.30943396226415093,
            0.33153638814016173,
            0.22452830188679246,
            0.14690026954177898
          ],
          "stage": "character-front",
          "cycle": 4.3,
          "delay": 0
        }
      ],
      "effects": [
        {
          "src": "kami_motion/orochi-separated-effect-d515ef199b1c.webp",
          "kind": "shadow",
          "stage": "back",
          "cycle": 10,
          "delay": -1.5
        },
        {
          "src": "kami_motion/orochi-separated-effect-d515ef199b1c.webp",
          "kind": "shadow",
          "stage": "back",
          "cycle": 10,
          "delay": -6.5
        }
      ]
    },
    "layers": [
      {
        "src": "kami_motion/orochi-original-head-stable-hair-c934a972c33a.webp",
        "idle": "hair-right"
      },
      {
        "src": "kami_motion/orochi-original-head-stable-robe-e98e6cb61938.webp",
        "idle": "robe"
      },
      {
        "src": "kami_motion/orochi-original-head-stable-body-cb8b5094857b.webp",
        "idle": "none"
      }
    ],
    "poses": {},
    "awakened": {
      "layers": [
        {
          "src": "kami_motion/orochi-awakened-hair-c7fc6c5441ef.webp",
          "idle": "hair-right"
        },
        {
          "src": "kami_motion/orochi-awakened-robe-73bdddc651d2.webp",
          "idle": "robe"
        },
        {
          "src": "kami_motion/orochi-awakened-body-1858d1cedc04.webp",
          "idle": "none"
        }
      ],
      "rig": {
        "background": "kami_motion/orochi-separated-background-e62b8fd6bbb1.webp",
        "breath": 6.6,
        "strength": 0.85,
        "canvas": [
          1060,
          1484
        ],
        "actors": [
          {
            "src": "kami_motion/orochi-original-scale-left-33d85de7d3bd.webp",
            "idle": "dragon",
            "box": [
              0,
              0.21900269541778974,
              0.34150943396226413,
              0.29649595687331537
            ],
            "stage": "back",
            "cycle": 7.8,
            "delay": 0,
            "origin": "50% 95%"
          },
          {
            "src": "kami_motion/orochi-original-scale-right-6cbe76b9dc0a.webp",
            "idle": "dragon",
            "box": [
              0.7169811320754716,
              0.24123989218328842,
              0.2830188679245283,
              0.3335579514824798
            ],
            "stage": "back",
            "cycle": 9.4,
            "delay": -2.1,
            "origin": "50% 95%"
          },
          {
            "src": "kami_motion/orochi-awakened-orb-8208cec652bd.webp",
            "idle": "orb-awakened",
            "box": [
              0.2925943396226415,
              0.32051886792452833,
              0.2582075471698113,
              0.16893530997304582
            ],
            "stage": "character-front",
            "cycle": 4.3,
            "delay": 0
          }
        ],
        "effects": [
          {
            "src": "kami_motion/orochi-separated-effect-d515ef199b1c.webp",
            "kind": "shadow",
            "stage": "back",
            "cycle": 10,
            "delay": -1.5
          },
          {
            "src": "kami_motion/orochi-separated-effect-d515ef199b1c.webp",
            "kind": "shadow",
            "stage": "back",
            "cycle": 10,
            "delay": -6.5
          }
        ]
      },
      "poses": {
        "damage": {
          "frames": [
            "kami_motion/orochi-fixed-sockets-full-face-light-ca1fb907a61a.webp",
            "kami_motion/orochi-awakened-recovery-full-face-open-6a6501f0676f.webp"
          ],
          "durations": [
            320,
            580
          ],
          "overlay": true,
          "fullFace": true
        },
        "damageHeavy": {
          "frames": [
            "kami_motion/orochi-fixed-sockets-full-face-heavy-ec99c8149768.webp",
            "kami_motion/orochi-fixed-sockets-full-face-closed-80627bc40ef9.webp",
            "kami_motion/orochi-fixed-sockets-full-face-half-b6bc704bc751.webp"
          ],
          "durations": [
            800,
            240,
            160
          ],
          "overlay": true,
          "fullFace": true
        }
      },
      "blink": {
        "frames": [
          "kami_motion/orochi-fixed-sockets-full-face-half-b6bc704bc751.webp",
          "kami_motion/orochi-fixed-sockets-full-face-closed-80627bc40ef9.webp",
          "kami_motion/orochi-fixed-sockets-full-face-half-b6bc704bc751.webp"
        ],
        "durations": [
          55,
          90,
          65
        ],
        "fullFace": true
      }
    }
  }
});

function kamiMotionSet(kamiNo, sets = KAMI_MOTION_SETS, variant = 'sealed') {
  const base = sets && sets[String(parseInt(kamiNo, 10))];
  const set = variant === 'awakened' ? base && base.awakened : base;
  return set && Array.isArray(set.layers) && set.layers.length ? set : null;
}

// 差分の指定を { frames, fps, loop } にそろえる（1枚の文字列も1コマとして扱う）
function kamiMotionNormalizePose(pose) {
  if (!pose) return null;
  if (typeof pose === 'string') return { frames: [pose], fps: 0, loop: false };
  const frames = Array.isArray(pose.frames) ? pose.frames.filter(Boolean) : (pose.src ? [pose.src] : []);
  if (!frames.length) return null;
  const normalized = { frames, fps: Math.max(0, Number(pose.fps) || 12), loop: !!pose.loop };
  if (pose.overlay) normalized.overlay = true;
  if (pose.fullFace) normalized.fullFace = true;
  if (Array.isArray(pose.durations) && pose.durations.length === frames.length && pose.durations.every(t => Number.isFinite(t) && t > 0)) normalized.durations = pose.durations.slice();
  return normalized;
}

/* 反応に使う差分を探す。emote は種類別→共通、それ以外は fallback をたどる。
   見つからなければ null（待機の絵のまま画面効果だけを出す） */
function kamiMotionResolvePose(set, type, detail = null) {
  const poses = (set && set.poses) || {};
  const tried = new Set();
  let current = type;
  if (type === 'emote' && detail && poses['emote:' + detail]) return kamiMotionNormalizePose(poses['emote:' + detail]);
  while (current && !tried.has(current)) {
    tried.add(current);
    const pose = kamiMotionNormalizePose(poses[current]);
    if (pose) return pose;
    current = KAMI_MOTION_EVENTS[current] && KAMI_MOTION_EVENTS[current].fallback;
  }
  return null;
}

// ライフ・天力・封印の増減から反応の種類を決める（マナの増減では動かない）
function kamiMotionEventForStat(key, delta) {
  const d = Number(delta) || 0;
  if (!d) return null;
  if (key === 'life') return d < 0 ? (d <= -3 ? 'damageHeavy' : 'damage') : 'heal';
  if (key === 'tenryoku') return d > 0 ? 'tenryoku' : null;
  if (key === 'seal') return d < 0 ? 'sealBreak' : null;
  return null;
}

// 演出速度・動きを減らす設定に合わせた表示時間（hold の反応は 0＝出し続ける）
function kamiMotionDuration(type, speed = 'normal', reduced = false) {
  const ev = KAMI_MOTION_EVENTS[type];
  if (!ev || ev.hold) return 0;
  if (speed === 'minimal') return 0;
  const scale = speed === 'fast' || reduced ? 0.6 : 1;
  return Math.max(250, Math.round(ev.duration * scale));
}

// 先読み用：そのカミの全画像
function kamiMotionUrls(kamiNo, sets = KAMI_MOTION_SETS, variant = 'sealed') {
  const set = kamiMotionSet(kamiNo, sets, variant);
  if (!set) return [];
  const urls = set.layers.map(layer => layer && layer.src);
  if (set.rig && set.rig.background) urls.push(set.rig.background);
  if (set.rig && set.rig.petal) urls.push(set.rig.petal);
  if (set.rig && set.rig.wind) urls.push(set.rig.wind);
  if (set.rig && set.rig.gust) urls.push(...set.rig.gust.petals);
  for (const item of [...(set.rig?.actors || []), ...(set.rig?.effects || [])]) {
    if (item.src) urls.push(item.src);
    if (item.breathSrc) urls.push(item.breathSrc);
  }
  if (set.blink) urls.push(...kamiMotionNormalizePose(set.blink).frames);
  for (const pose of Object.values(set.poses || {})) {
    const normalized = kamiMotionNormalizePose(pose);
    if (normalized) urls.push(...normalized.frames);
  }
  return Array.from(new Set(urls.filter(Boolean)));
}

// 背景と同じ切り出し位置に、独立した剣/動物/巻物等の原画座標を置く。
// topとtranslateYはそれぞれ窓と原画の高さを基準にするため、レスポンシブでもずれない。
function kamiMotionCanvasStyle(crop = {}, size = [1060,1484]) {
  const zoom = /%/.test(crop.backgroundSize || '') ? parseFloat(crop.backgroundSize) / 100 : 1;
  const p = (crop.backgroundPosition || '50% 50%').split(/\s+/).map(parseFloat);
  const x = Number.isFinite(p[0]) ? p[0] : 50, y = Number.isFinite(p[1]) ? p[1] : 50;
  return {width:(zoom*100)+'%',aspectRatio:size[0]+' / '+size[1],left:((1-zoom)*x)+'%',top:y+'%',transform:'translateY(-'+y+'%)'};
}

function kamiMotionActorBox(actor) {
  const [x,y,w,h] = actor.box || [0,0,1,1];
  return {left:x*100+'%',top:y*100+'%',width:w*100+'%',height:h*100+'%',
    transformOrigin:actor.origin || '50% 50%',
    '--actor-cycle':(actor.cycle || 6)+'s','--actor-delay':(actor.delay || 0)+'s',
    '--wing-cycle':(actor.wingCycle || 1.15)+'s','--wing-delay':(actor.wingDelay || 0)+'s'};
}

// 呼吸が元の位置に近づく終端にだけまばたきする（3コマ計210ms）。
function kamiMotionBlinkDelay(elapsed, breath = 5.2) {
  const cycle = Math.max(2000, (Number(breath) || 5.2) * 1000);
  const phase = ((elapsed % cycle) + cycle) % cycle;
  const start = cycle * .9, end = cycle - 230;
  return phase >= start && phase <= end ? 0 : Math.ceil(phase < start ? start - phase : cycle - phase + start);
}

/* 表示部品。親（.kami-portrait）の大きさいっぱいに重ねる。
   event：{ id, type, detail }。id が変わるたびに1回反応する */
if (typeof Vue !== 'undefined') {
  Vue.component('kami-motion', {
    props: {
      kamiNo: { type: [String, Number], required: true },
      variant: { type: String, default: 'sealed' },
      crop: { type: Object, default: () => ({}) },
      idleOnly: { type: Boolean, default: true },
      loadImage: { type: Function, default: null }, // 対戦では既存の読み込み係を使う。
      event: { type: Object, default: null },
      pinch: { type: Boolean, default: false },
      speed: { type: String, default: 'normal' },
      reduced: { type: Boolean, default: false },
      sets: { type: Object, default: null }, // 演出確認ページ用。通常は KAMI_MOTION_SETS
      inspection: { type: String, default: '' }, // 確認ページで顔全体の差分を静止表示
      characterOnly: { type: Boolean, default: false }, // 確認ページで人物素材の混入を点検
      previewCue: { type: Number, default: 0 }, // 確認ページだけ、背景の発生タイミングを再開
    },
    data() {
      return { blinking: false, blinkIndex: 0, rigReady: false, systemReduced: false, pageHidden: false, active: null, frame: 0 };
    },
    computed: {
      hasLayeredRig() { return !!(this.set && this.set.rig && this.rigReady); },
      motionStopped() { return this.reduced || this.speed === 'minimal' || this.systemReduced || this.pageHidden; },
      blinkPose() { return this.set && kamiMotionNormalizePose(this.set.blink); },
      blinkSrc() { return this.blinkPose ? this.blinkPose.frames[this.blinkIndex] || '' : ''; },
      set() { return kamiMotionSet(this.kamiNo, this.sets || KAMI_MOTION_SETS, this.variant); },
      glyphFilterId() { return 'kami-motion-ink-' + this._uid; },
      heatFilterId() { return this.glyphFilterId+'-heat'; },
      heatEnabled() { return this.hasLayeredRig && !!this.set?.rig?.heatHaze && !this.motionStopped && !this.characterOnly; },
      layers() {
        return (this.set ? this.set.layers : []).map(layer => ({
          src: layer.src,
          idle: KAMI_MOTION_IDLE_PRESETS.includes(layer.idle) ? layer.idle : 'none',
          style: layer.style || {},
        }));
      },
      pinchPose() {
        return this.pinch && this.set ? kamiMotionNormalizePose(this.set.poses && this.set.poses.pinch) : null;
      },
      // 反応中の差分（無ければ待機の絵に画面効果だけ）
      poseSrc() {
        const pose = this.active && this.active.pose;
        return pose ? pose.frames[Math.min(this.frame, pose.frames.length - 1)] : '';
      },
      expressionOverlay() { return !!(this.active && this.active.pose && this.active.pose.overlay); },
      inspectionSrc() {
        if (!this.inspection || !this.set || this.motionStopped) return '';
        if (/^damage(?:Heavy)?$/.test(this.inspection)) return (kamiMotionResolvePose(this.set, this.inspection) || {}).frames?.[0] || '';
        return this.blinkPose ? this.blinkPose.frames[this.inspection === 'closed' ? 1 : 0] || '' : '';
      },
      damageActive() { return !!(this.active && /^damage(?:Heavy)?$/.test(this.active.type)); },
      windStyle() { const src = this.set && this.set.rig && this.set.rig.wind; return { backgroundImage: src ? "url('" + src + "')" : 'none' }; },
      environmentCanvasStyle() { return kamiMotionCanvasStyle(this.crop, this.set?.rig?.canvas); },
      rootStyle() {
        const rig = this.set && this.set.rig || {};
        return Object.assign({ '--kami-breath-cycle': (rig.breath || 5.2) + 's', '--kami-rise': (-1.25 * (rig.strength || 1)) + '%', '--kami-hair-cycle': ((rig.breath || 5.2) + 1.5) + 's', '--kami-cloth-cycle': ((rig.breath || 5.2) + .6) + 's', '--kami-petal-image': rig.petal ? "url('" + rig.petal + "')" : 'none' }, this.active ? { '--kami-hit-ms': kamiMotionDuration(this.active.type, this.speed, this.motionStopped) + 'ms' } : {});
      },
      petals() {
        const rig = this.set && this.set.rig;
        if (!rig || !rig.petal) return [];
        return Array.from({length:8}, (_,i)=>({id:i,style:{left:(7+i*13)%100+'%',top:(i*19)%100+'%',width:(i%3===0?5:3.5)+'%',height:(i%3===0?7:5)+'%',animationDelay:(-i*1.43)+'s',animationDuration:(8+i*.7)+'s'}}));
      },
      burstPetals() {
        const rig = this.set && this.set.rig;
        if (!rig || !(rig.petal || rig.gust) || !this.active || this.active.type !== 'damageHeavy') return [];
        return Array.from({length:18}, (_,i)=>({id:i,style:{left:((i*37)%94+3)+'%',top:((i*23)%80+10)+'%','--petal-x':((i%2?1:-1)*(45+(i*17)%85))+'px','--petal-y':(-40-(i*19)%110)+'px','--petal-spin':((i%2?1:-1)*(150+i*27))+'deg',width:(4+(i%4))+'%',height:(5+(i%3)*2)+'%',...(rig.gust?{backgroundImage:"url('"+rig.gust.petals[i%2]+"')"}:{})}}));
      },
      gustPetals() {
        const gust = this.set?.rig?.gust;
        if (!gust) return [];
        return this.fallingPetals(0,22,false);
      },
      gustFrontPetals() { return this.set?.rig?.gust ? this.fallingPetals(22,8,true) : []; },
      rootClass() {
        const ev = this.active && KAMI_MOTION_EVENTS[this.active.type];
        return {
          'has-layered-rig': this.hasLayeredRig,
          'rig-pending': !!(this.set && this.set.rig && !this.rigReady),
          'is-pinch': this.pinch,
          'is-posing': !!this.poseSrc && !this.expressionOverlay,
          'is-damage': this.damageActive,
          'is-heavy': !!(this.active && this.active.type === 'damageHeavy'),
          'is-blinking': this.blinking,
          'inspect-character': this.characterOnly,
          reduced: this.motionStopped,
          ['kami-motion-fx-' + (ev && !this.motionStopped ? (this.damageActive && this.hasLayeredRig ? 'recoil' : ev.effect) : 'none')]: !!this.active,
        };
      },
    },
    watch: {
      event(next, previous) {
        if (!next) { this.stop(); return; } // 対戦のやり直し・決着の取り消し
        if (next.id && (!previous || next.id !== previous.id)) this.play(next.type, next.detail);
      },
      kamiNo() { this.stop(); this._clearBlink(); this._loadRig(); this._scheduleBlink(); },
      variant() { this.stop(); this._clearBlink(); this._loadRig(); this._scheduleBlink(); },
      inspection() { this.stop(); this._clearBlink(); this._scheduleBlink(); },
      motionStopped(v) { this._clearBlink(); if (v) this.stop(); else { this._rigStartedAt = Date.now(); this._scheduleBlink(); } },
    },
    mounted() {
      this._motionAlive = true; this._loadRig();
      this._motionMedia = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)');
      this._motionMediaChange = () => { this.systemReduced = !!(this._motionMedia && this._motionMedia.matches); };
      this._motionVisibility = () => { this.pageHidden = document.hidden; };
      if (this._motionMedia) this._motionMedia.addEventListener ? this._motionMedia.addEventListener('change', this._motionMediaChange) : this._motionMedia.addListener(this._motionMediaChange);
      document.addEventListener('visibilitychange', this._motionVisibility);
      this._motionMediaChange(); this._motionVisibility(); this._scheduleBlink();
    },
    beforeDestroy() {
      this._motionAlive = false; this._rigEpoch = (this._rigEpoch || 0) + 1;
      this.stop(); this._clearBlink();
      if (this._motionMedia) this._motionMedia.removeEventListener ? this._motionMedia.removeEventListener('change', this._motionMediaChange) : this._motionMedia.removeListener(this._motionMediaChange);
      document.removeEventListener('visibilitychange', this._motionVisibility);
    },
    methods: {
      async _loadRig() {
        this.rigReady = false;
        const epoch = this._rigEpoch = (this._rigEpoch || 0) + 1;
        if (!this.set || !this.set.rig || typeof Image === 'undefined') return;
        try {
          for (const src of kamiMotionUrls(this.kamiNo, this.sets || KAMI_MOTION_SETS, this.variant)) {
            if (!this._motionAlive || epoch !== this._rigEpoch) return;
            if (this.loadImage) await this.loadImage(src);
            if (!this._motionAlive || epoch !== this._rigEpoch) return;
            // 読み込み係はエラー時も完了するため、キャッシュ済み画像の成否を確かめる。
            await new Promise((resolve, reject) => {
              const image = new Image(); image.onload = resolve; image.onerror = reject; image.src = src;
            });
          }
          if (this._motionAlive && epoch === this._rigEpoch) { this._rigStartedAt = Date.now(); this.rigReady = true; }
        } catch (_) {} // 読めない場合は親の元絵を残す。確認ページも1枚ずつ読む。
      },
      imageStyle(src, extra = {}) { return Object.assign({ backgroundImage: "url('" + src + "')" }, this.crop, extra); },
      actorsFor(stage) { return (this.set?.rig?.actors || []).filter(a => (a.stage || 'back') === stage); },
      effectsFor(stage) { return (this.set?.rig?.effects || []).filter(a => (a.stage || 'back') === stage); },
      actorBox(actor) { return kamiMotionActorBox(actor); },
      actorImageStyle(actor) {
        const [cols,rows] = actor.grid || [1,1];
        return {backgroundImage:"url('"+actor.src+"')",backgroundSize:(cols*100)+'% '+(rows*100)+'%',backgroundPosition:'0% 0%'};
      },
      fallingPetals(start,count,front) {
        const gust=this.set.rig.gust;
        // Independent repeatable samples: positions, speeds and phases are unrelated.
        const sample=(i,salt)=>{const v=Math.sin((i+1)*127.1+salt*311.7)*43758.5453;return v-Math.floor(v);};
        return Array.from({length:count},(_,k)=>{
          const i=start+k,cycle=9+sample(i,2)*9,size=(front?2.8:1.7)+sample(i,4)*1.8;
          return {id:i,style:{backgroundImage:"url('"+gust.petals[i%2]+"')",left:(4+sample(i,1)*89)+'%',top:'-12%',width:size+'%',height:(size*1.25)+'%','--gust-cycle':cycle+'s','--gust-delay':(-sample(i,3)*cycle)+'s','--gust-sway':((sample(i,5)-.5)*110)+'px','--gust-spin':((sample(i,6)-.5)*600)+'deg','--gust-start':(sample(i,7)*180)+'deg'}};
        });
      },
      effectStyle(effect) { return {backgroundImage:"url('"+effect.src+"')",'--env-cycle':(effect.cycle||8)+'s','--env-delay':(this.previewCue?-(effect.cycle||8)*.735:effect.delay||0)+'s','--env-mirror':effect.mirror?-1:1}; },
      glyphBox(glyph) { const [x,y,w,h]=glyph.region,cycle= glyph.cycle||7.2;return {left:x*100+'%',top:y*100+'%',width:w*100+'%',height:h*100+'%',animationDuration:cycle+'s',animationDelay:(this.previewCue?-cycle*.57+(glyph.delay||0)*.1:glyph.delay||0)+'s','--glyph-sway':(glyph.sway||0)+'px'}; },
      weaponArcStyle(arc) {return {'--arc-cycle':arc.cycle+'s','--arc-delay':arc.delay+'s','--arc-width':arc.width||3};},
      glyphImageStyle(actor,glyph) { const [x,y,w,h]=glyph.region;return {backgroundImage:"url('"+actor.src+"')",backgroundSize:(100/w)+'% '+(100/h)+'%',backgroundPosition:(x/(1-w)*100)+'% '+(y/(1-h)*100)+'%',filter:'url(#'+this.glyphFilterId+') drop-shadow(0 0 3px #bd98ff)'}; },
      play(type, detail = null) {
        if (this.idleOnly) return;
        if (this.inspection) return;
        const ev = KAMI_MOTION_EVENTS[type];
        if (!ev || !this.set) return;
        if (this.motionStopped || !this._motionAlive || (this.set.rig && !this.rigReady)) return;
        const current = this.active && KAMI_MOTION_EVENTS[this.active.type];
        if (current && current.priority > ev.priority && !(this.damageActive && /^damage(?:Heavy)?$/.test(type))) return;
        this.stop();
        this._clearBlink();
        const pose = kamiMotionResolvePose(this.set, type, detail);
        this.active = { id: this._reactionSeq = (this._reactionSeq || 0) + 1, type, detail, pose };
        this._rigStartedAt = Date.now();
        this.frame = 0;
        const duration = kamiMotionDuration(type, this.speed, this.reduced);
        if (pose && pose.durations && duration > 0) {
          const total = pose.durations.reduce((a, b) => a + b, 0);
          let at = 0;
          this._poseTimers = pose.durations.slice(0, -1).map((time, i) => {
            at += time;
            return setTimeout(() => { if (this._motionAlive && !this.motionStopped) this.frame = i + 1; }, Math.round(at / total * duration));
          });
        } else if (pose && pose.frames.length > 1 && pose.fps > 0 && !this.reduced) {
          this._frameTimer = setInterval(() => {
            if (this.frame + 1 < pose.frames.length) this.frame++;
            else if (pose.loop) this.frame = 0;
            else clearInterval(this._frameTimer);
          }, Math.round(1000 / pose.fps));
        }
        if (duration > 0) this._endTimer = setTimeout(() => this.stop(), duration);
        this.$emit('motion', type);
      },
      stop() {
        if (this.active) this._rigStartedAt = Date.now();
        clearTimeout(this._endTimer);
        clearInterval(this._frameTimer);
        (this._poseTimers || []).forEach(clearTimeout); this._poseTimers = [];
        this.active = null;
        this.frame = 0;
        if (this._motionAlive) this._scheduleBlink();
      },
      _clearBlink() {
        clearTimeout(this._blinkTimer);
        clearTimeout(this._blinkQueued);
        (this._blinkFrames || []).forEach(clearTimeout);
        this._blinkFrames = []; this.blinking = false; this.blinkIndex = 0;
      },
      _requestBlink() {
        if (!this._motionAlive || this.motionStopped || this.inspection || !this.blinkPose || this.active || this.blinking || (this.set?.rig && !this.rigReady)) return;
        this._clearBlink();
        const delay = this.hasLayeredRig ? kamiMotionBlinkDelay(Date.now() - (this._rigStartedAt ?? Date.now()), this.set.rig.breath) : 0;
        if (!delay) this._playBlink();
        else this._blinkQueued = setTimeout(() => this._playBlink(), delay);
      },
      _playBlink() {
        if (!this._motionAlive || this.motionStopped || (this.set && this.set.rig && !this.rigReady) || this.inspection || !this.blinkPose || this.active) return;
        this._clearBlink(); this.blinking = true;
        const frames = this.blinkPose.frames;
        const times = this.set.blink.durations || frames.map(() => 140 / frames.length);
        let at = 0;
        for (let i = 0; i < frames.length; i++) {
          at += times[i] || 65;
          this._blinkFrames.push(setTimeout(() => {
            if (!this._motionAlive || this.motionStopped) return;
            if (i + 1 < frames.length) this.blinkIndex = i + 1;
            else { this.blinking = false; this.blinkIndex = 0; this._scheduleBlink(); }
          }, at));
        }
      },
      _scheduleBlink() {
        clearTimeout(this._blinkTimer);
        if (!this._motionAlive || this.motionStopped || this.inspection || !this.blinkPose) return;
        this._blinkTimer = setTimeout(() => {
          if (!this.active) this._requestBlink(); else this._scheduleBlink();
        }, 3500 + Math.random() * 2500);
      },
    },
    template: `
      <div class="kami-motion" :class="rootClass" :style="rootStyle" aria-hidden="true">
        <svg class="kami-motion-filter-defs" width="0" height="0"><defs><filter :id="glyphFilterId" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB"><feColorMatrix type="matrix" values="0 0 0 0 1 0 0 0 0 1 0 0 0 0 1 -0.5 -3.5 2.2 0 0.6" result="ink"></feColorMatrix><feComposite in="ink" in2="SourceAlpha" operator="in" result="maskedInk"></feComposite><feFlood flood-color="#d5b5ff" result="color"></feFlood><feComposite in="color" in2="maskedInk" operator="in"></feComposite></filter></defs></svg>
        <div class="kami-motion-scene" :key="active && active.type === 'damageHeavy' ? 'heavy-'+active.id : 'scene'">
        <div v-if="hasLayeredRig" class="kami-motion-layer kami-motion-background" :style="imageStyle(set.rig.background)"></div>
        <svg v-if="heatEnabled" class="kami-motion-filter-defs" width="0" height="0"><defs><filter :id="heatFilterId" x="-5%" y="-5%" width="110%" height="110%" color-interpolation-filters="sRGB"><feTurbulence type="fractalNoise" baseFrequency="0.012 0.032" numOctaves="1" seed="7" result="heat"><animate attributeName="baseFrequency" values="0.012 0.032;0.016 0.041;0.012 0.032" dur="7s" repeatCount="indefinite"></animate></feTurbulence><feDisplacementMap in="SourceGraphic" in2="heat" scale="5" xChannelSelector="R" yChannelSelector="G"></feDisplacementMap></filter></defs></svg>
        <div v-if="heatEnabled" class="kami-motion-layer kami-motion-heat-haze" :style="imageStyle(set.rig.background,{filter:'url(#'+heatFilterId+')'})"></div>
        <div v-if="heatEnabled" class="kami-motion-layer kami-motion-fire-glow"></div>
        <template v-if="hasLayeredRig">
          <div v-if="set.rig.lighting" class="kami-motion-layer kami-motion-rays" :class="'kami-motion-rays-'+set.rig.lighting"></div>
          <div v-if="set.rig.lighting==='sunlight'" class="kami-motion-layer kami-motion-sunlight-glow"></div>
          <div v-if="set.rig.lightning" class="kami-motion-layer kami-motion-thunder-glow"></div>
          <span v-for="petal in gustPetals" :key="'gust'+previewCue+'-'+petal.id" class="kami-motion-camellia-gust" :style="petal.style"></span>
          <div v-for="(effect,i) in effectsFor('back')" :key="'back-fx'+previewCue+'-'+i" class="kami-motion-layer kami-motion-environment-effect" :class="'kami-motion-env-'+effect.kind" :style="effectStyle(effect)"></div>
          <div class="kami-motion-art-canvas" :style="environmentCanvasStyle">
            <div v-for="(actor,i) in actorsFor('back')" :key="'back-actor'+i" class="kami-motion-actor" :class="'kami-motion-actor-'+actor.idle" :style="actorBox(actor)">
              <div class="kami-motion-actor-image" :class="actor.frames ? 'kami-motion-atlas-'+actor.frames : ''" :style="actorImageStyle(actor)"></div>
              <div v-if="actor.blend" class="kami-motion-actor-image kami-motion-frame-next" :class="'kami-motion-atlas-'+actor.frames+'-next'" :style="actorImageStyle(actor)"></div>
              <div v-if="actor.breathSrc" class="kami-motion-actor-image kami-motion-animal-chest" :style="actorImageStyle({src:actor.breathSrc})"></div>
              <span v-for="(glyph,g) in actor.glyphs || []" :key="'glyph'+previewCue+'-'+g" class="kami-motion-scroll-glyph" :style="glyphBox(glyph)"><span class="kami-motion-glyph-ink" :style="glyphImageStyle(actor,glyph)"></span></span>
            </div>
          </div>
        </template>
        <div v-if="hasLayeredRig && set.rig.wind" class="kami-motion-layer kami-motion-wind kami-motion-wind-back" :style="windStyle"></div>
        <div v-if="hasLayeredRig && set.rig.wind" class="kami-motion-layer kami-motion-wind kami-motion-wind-trail" :style="windStyle"></div>
        <span v-for="petal in petals" :key="'ambient'+petal.id" class="kami-motion-petal" :style="petal.style"></span>
        <div class="kami-motion-recoil" :key="active ? active.id : 'idle'">
        <div v-if="!set || !set.rig || hasLayeredRig" class="kami-motion-base" :class="{'kami-motion-character':hasLayeredRig}">
          <template v-if="pinchPose">
            <div class="kami-motion-layer kami-motion-idle-breathe" :style="imageStyle(pinchPose.frames[0])"></div>
          </template>
          <template v-else>
            <div v-for="(layer, i) in layers" :key="i" class="kami-motion-layer" :class="'kami-motion-idle-' + layer.idle" :style="imageStyle(layer.src,layer.style)"></div>
          </template>
          <div v-if="hasLayeredRig" class="kami-motion-art-canvas" :style="environmentCanvasStyle">
            <div v-for="(actor,i) in actorsFor('character')" :key="'attached'+i" class="kami-motion-actor" :class="'kami-motion-actor-'+actor.idle" :style="actorBox(actor)">
              <div class="kami-motion-actor-image" :class="actor.frames ? 'kami-motion-atlas-'+actor.frames : ''" :style="actorImageStyle(actor)"></div>
              <div v-if="actor.blend" class="kami-motion-actor-image kami-motion-frame-next" :class="'kami-motion-atlas-'+actor.frames+'-next'" :style="actorImageStyle(actor)"></div>
              <div v-if="actor.breathSrc" class="kami-motion-actor-image kami-motion-animal-chest" :style="actorImageStyle({src:actor.breathSrc})"></div>
            </div>
          </div>
          <div v-if="blinkSrc && !pinchPose && !inspection" v-show="blinking" class="kami-motion-layer kami-motion-blink" :class="{'kami-motion-full-face':blinkPose.fullFace}" :style="imageStyle(blinkSrc)"></div>
          <div v-if="poseSrc && expressionOverlay" class="kami-motion-layer kami-motion-expression" :class="{'kami-motion-full-face':active.pose.fullFace}" :style="imageStyle(poseSrc)"></div>
          <div v-if="inspectionSrc" class="kami-motion-layer kami-motion-full-face" :style="imageStyle(inspectionSrc)"></div>
          <!-- 顔差分より手前、人物と同じ親。玉・電撃が呼吸や被弾から離れない。 -->
          <div v-if="hasLayeredRig" class="kami-motion-art-canvas kami-motion-attached-front" :style="environmentCanvasStyle">
            <div v-for="(actor,i) in actorsFor('character-front')" :key="'attached-front'+i" class="kami-motion-actor" :class="'kami-motion-actor-'+actor.idle" :style="actorBox(actor)"><div class="kami-motion-actor-image" :style="actorImageStyle(actor)"></div></div>
            <svg v-if="set.rig.weaponLightning" class="kami-motion-weapon-lightning" :viewBox="'0 0 '+set.rig.canvas[0]+' '+set.rig.canvas[1]" preserveAspectRatio="none"><g v-for="(arc,i) in set.rig.weaponLightning" :key="'arc'+i" class="kami-motion-weapon-arc" :style="weaponArcStyle(arc)"><polyline class="kami-motion-weapon-halo" :points="arc.points"></polyline><polyline class="kami-motion-weapon-core" :points="arc.points"></polyline></g></svg>
          </div>
        </div>
        <div v-if="poseSrc && !expressionOverlay" class="kami-motion-layer kami-motion-pose" :style="imageStyle(poseSrc)"></div>
        </div>
        <template v-if="hasLayeredRig">
          <div v-for="(effect,i) in effectsFor('front')" :key="'front-fx'+i" class="kami-motion-layer kami-motion-environment-effect kami-motion-env-front" :class="'kami-motion-env-'+effect.kind" :style="effectStyle(effect)"></div>
          <div class="kami-motion-art-canvas" :style="environmentCanvasStyle">
            <div v-for="(actor,i) in actorsFor('front')" :key="'front-actor'+i" class="kami-motion-actor" :class="'kami-motion-actor-'+actor.idle" :style="actorBox(actor)">
              <div class="kami-motion-actor-image" :class="actor.frames ? 'kami-motion-atlas-'+actor.frames : ''" :style="actorImageStyle(actor)"></div>
              <div v-if="actor.blend" class="kami-motion-actor-image kami-motion-frame-next" :class="'kami-motion-atlas-'+actor.frames+'-next'" :style="actorImageStyle(actor)"></div>
              <div v-if="actor.breathSrc" class="kami-motion-actor-image kami-motion-animal-chest" :style="actorImageStyle({src:actor.breathSrc})"></div>
              <span v-for="(glyph,g) in actor.glyphs || []" :key="'glyph'+previewCue+'-'+g" class="kami-motion-scroll-glyph" :style="glyphBox(glyph)"><span class="kami-motion-glyph-ink" :style="glyphImageStyle(actor,glyph)"></span></span>
            </div>
          </div>
        </template>
        <div v-if="hasLayeredRig && set.rig.gust" class="kami-motion-gust-foreground"><span v-for="petal in gustFrontPetals" :key="'front-gust'+previewCue+'-'+petal.id" class="kami-motion-camellia-gust" :style="petal.style"></span></div>
        <div v-if="hasLayeredRig && set.rig.wind" class="kami-motion-layer kami-motion-wind kami-motion-wind-front" :style="windStyle"></div>
        <span v-for="petal in burstPetals" :key="'burst'+active.id+'-'+petal.id" class="kami-motion-petal kami-motion-petal-burst" :style="petal.style"></span>
        </div>
        <span class="kami-motion-fx" aria-hidden="true"></span>
      </div>`,
  });
}

if (typeof module !== 'undefined') {
  module.exports = {
    KAMI_MOTION_IDLE_PRESETS, KAMI_MOTION_EVENTS, KAMI_MOTION_EMOTE_KEYS, KAMI_MOTION_SETS,
    kamiMotionSet, kamiMotionNormalizePose, kamiMotionResolvePose, kamiMotionEventForStat, kamiMotionDuration, kamiMotionUrls, kamiMotionCanvasStyle, kamiMotionActorBox, kamiMotionBlinkDelay,
  };
}
