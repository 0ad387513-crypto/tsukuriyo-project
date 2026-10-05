# カミの立ち絵モーション（画像の作り方と登録方法）

対戦画面のカミの丸い肖像を、シャドウバースのキャラクターのように「待機中は呼吸・まばたき・なびき」「ダメージや天力獲得のときは表情や姿勢が変わる」ように動かす仕組みです。
動かす処理は `kami_motion.js` / `kami_motion.css` に実装済みで、**画像を作って登録するだけで動きます**。登録していないカミは今までどおり1枚絵のままです。

- 確認ページ：`kami_motion_preview.html`（`npm run preview` 中なら http://localhost:8765/kami_motion_preview.html ）
  - 登録前の画像も「画像を選んで試す」で読み込んで、拡大表示と対戦画面に近い大きさの両方で動きを確かめられる
  - 各反応のボタン、ライフ残りわずか・動きを減らす・演出速度の切り替えあり

## 1. 画像の共通ルール

| 項目 | 決まり |
|---|---|
| 大きさ | すべての部品を **同じ大きさの正方形**（推奨 1024×1024）。保存時は `sprite` か `scene` の上限に合わせて縮小 |
| 構図 | 今の肖像（`kami_illustrations/`）と同じく、**丸枠の中に顔と上半身が収まる** 構図。丸枠の外側（四隅）は見えない |
| 位置合わせ | 部品どうしは **同じキャンバス上の同じ位置** に描く（重ねたときにずれない）。顔の位置は全差分で同じにする |
| 背景 | 体の部品は背景込みでよい（一番下の部品が背景を持つ）。上に重ねる部品（前髪・まばたき）は **透過** |
| 余白 | 呼吸・揺れでわずかに拡大・回転するので、丸枠の縁ぎりぎりに大事なものを置かない |
| 形式 | WebP。ファイル名に内容ハッシュ（sha256 先頭12桁）を付ける（CLAUDE.md の「画像を追加・差し替えるとき」の手順） |
| 置き場所 | `kami_motion/` 。例：`kami_motion/susanoo-body-0123456789ab.webp` |

## 2. 部品の種類

### 待機（常に表示）

| 部品 | 必須 | 内容 | 動き（idle） |
|---|---|---|---|
| 体 | ○ | 待機の立ち絵本体（背景込み可） | `breathe`：下を支点にわずかに伸び縮みして呼吸 |
| 後ろ髪・衣 | 任意 | 体より奥にある、なびく部分だけ（透過） | `sway`：上を支点に左右へ揺れる |
| 前髪・袖 | 任意 | 体より手前にある、なびく部分だけ（透過） | `sway-slow`：ゆっくり揺れる |
| まばたき | 任意 | **目を閉じた顔の部分だけ**（透過）。体の目の位置に重なる | 2.5〜6秒おきに0.14秒だけ表示 |
| ライフが少ないときの待機 | 任意 | 苦しそう・追い詰められた姿の全身1枚 | ライフ警告中は体の代わりに表示し、呼吸を速める |

呼吸だけなら「体」1枚で動きます。なびく部品を分けるほど立体的に見えます。
動き方の種類は `KAMI_MOTION_IDLE_PRESETS`（`none` / `breathe` / `sway` / `sway-slow` / `float`）から選びます。

### 反応（きっかけがあったときだけ表示）

全身の差分1枚、または連番（`frames`）で作ります。表示中は待機の絵と入れ替わり、時間が来たら待機に戻ります。
差分が無い反応は、代わりの差分（下表の「無いとき」）→ 待機の絵の順に使い、揺れや光の画面効果だけは必ず付きます。

| キー | きっかけ | 表示時間 | 画面効果 | 無いとき |
|---|---|---|---|---|
| `damage` | ライフが1〜2減った | 0.9秒 | 揺れ＋赤い光 | 待機の絵 |
| `damageHeavy` | ライフが3以上減った | 1.2秒 | 強い揺れ＋赤い光 | `damage` |
| `heal` | ライフが増えた | 1.0秒 | 緑の光 | 待機の絵 |
| `tenryoku` | 天力が増えた | 1.0秒 | 金の光 | 待機の絵 |
| `sealBreak` | 封印が減った（ヤマタノオロチ） | 1.2秒 | 赤紫の光 | `tenryoku` |
| `skill1` | 神技のカットインが閉じた直後 | 1.4秒 | 白い光 | 待機の絵 |
| `skill2` | 創世神技のカットインが閉じた直後 | 1.6秒 | 白い光 | `skill1` |
| `turnStart` | そのカミの手番が始まった | 0.9秒 | うなずき | 待機の絵 |
| `emote` / `emote:greeting` など | エモートを送った・受け取った | 1.6秒 | うなずき | 種類別 → `emote` → 待機の絵 |
| `win` | 勝った | 決着後ずっと | 白い光 | 待機の絵 |
| `lose` | 負けた | 決着後ずっと | なし | `damageHeavy` |

エモートの種類：`greeting`（あいさつ）・`confusion`（困惑）・`praise`（称賛）・`surprise`（驚き）・`taunt`（挑発）・`boast`（自信）。
表示時間は演出速度「高速」と「動きを減らす」で0.6倍、「最小」では反応しません（勝敗だけは表示）。

## 3. 登録のしかた

`kami_motion.js` の `KAMI_MOTION_SETS` にカミの No. をキーにして追加します。

```js
const KAMI_MOTION_SETS = Object.freeze({
  '1': {
    layers: [                                                               // 下から順に重ねる
      { src: 'kami_motion/susanoo-back-0123456789ab.webp', idle: 'sway' },
      { src: 'kami_motion/susanoo-body-0123456789ab.webp', idle: 'breathe' },
      { src: 'kami_motion/susanoo-front-0123456789ab.webp', idle: 'sway-slow' },
    ],
    blink: 'kami_motion/susanoo-blink-0123456789ab.webp',
    poses: {
      damage: 'kami_motion/susanoo-damage-0123456789ab.webp',               // 1枚
      tenryoku: { frames: ['kami_motion/susanoo-tenryoku-1-….webp',        // 連番（fps：1秒あたりのコマ数、既定12）
                           'kami_motion/susanoo-tenryoku-2-….webp'], fps: 10 },
      'emote:taunt': 'kami_motion/susanoo-taunt-0123456789ab.webp',
      pinch: 'kami_motion/susanoo-pinch-0123456789ab.webp',
      win: 'kami_motion/susanoo-win-0123456789ab.webp',
    },
  },
});
```

登録したら：

1. `kami_motion_preview.html` で全反応のボタンを押して確認する
2. `npm test` を実行する（登録した画像が実在するか・設定の形が正しいかを検証する）
3. `version.js` を上げる

## 4. 作る順番のおすすめ

1. **体**（呼吸）と **まばたき** … これだけで「生きている」感じが出る
2. **damage** と **tenryoku** … 対戦中に最も多く起きる反応
3. **後ろ髪・衣**（なびき）
4. **skill1 / skill2**、**win / lose**
5. エモート別の差分、**pinch**、連番化

## 5. 動きの仕組み（参考）

- 対戦画面の `.kami-portrait` の中に `<kami-motion>` を重ね、肖像の背景の1枚絵は隠す（`.has-kami-motion`）
- きっかけは表示の変化から各端末で検知する（ライフ等の増減：`_battleWatchStat`、エモート：`_battleShowEmoteBubble`、神技：`battleSkillCloseup` の終了、手番：`activeSide`、勝敗：`result.outcome`）。オンライン対戦でも通信は増えない
- 重要度（priority）が高い反応の途中には、低い反応は割り込まない（例：神技の反応中にターン開始のうなずきは出ない）
- 設定の「動きを減らす」と端末の「視差効果を減らす」では、待機の動きと揺れを止め、差分の切り替えだけを見せる
