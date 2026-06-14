# のっかれボールズ v0.2.4

スマホブラウザで遊べる、押し出し対戦ミニゲームのプロトタイプです。  
マリオパーティのミニゲームをそのまま再現するのではなく、オリジナルの「ボールに乗って押し合うゲーム」として作っています。

## 現在できること

- スマホ1台で2人対戦
- スマホ縦画面で 1P スティックを上、2P スティックを下に配置
- PCでは 1P: WASD / 2P: 矢印キー
- 円形ステージ
- 慣性移動
- ボール同士の弾性衝突
- TIME 30 / 60 / 90 / ∞ 設定
- STOCK 1 / 2 / 3 / 5 設定
- ストック制の復帰
- 勝敗表示

## v0.2.4の修正

- アップロードされたN64版参考動画から、速度・加速・減速を簡易トラッキングして再調整
- 最高速度、加速、入力なし減速、逆入力ブレーキを更新
- 衝突を「ただ押し合う」から、円同士の弾性衝突＋入力補正に変更
- キャラの向き `faceAngle` を追加
- 入力方向とキャラの向きから、衝突時の反射を変える処理を追加
- ぶつかった方向のベクトルに対して、逆方向入力している時だけ吹っ飛び慣性を削る
- 中央方向補助は使わず、衝突ベクトル基準のブレーキに統一
- 画面上に白い矢印でキャラの向きを表示

## 遊び方

`index.html` をブラウザで開くだけで遊べます。  
GitHub Pages / Cloudflare Pages にもそのまま置けます。

## ファイル構成

```text
index.html        画面構造
styles.css        スマホ向けUI
game.js           ゲーム本体
README.md         この説明
CALIBRATION.md    動画解析と係数メモ
ONLINE_PLAN.md    通信対戦化の設計メモ
```

## v0.2.4の主な係数

```js
accel: 760,
activeFriction: 0.966,
idleFriction: 0.918,
reverseBrakeFriction: 0.808,
maxSpeed: 365,
postCollisionMaxSpeed: 485,
restitution: 0.80,
inputRestitutionBonus: 0.12,
inputImpulseBonus: 42,
vectorBrakeAccel: 1320,
vectorBrakeDrag: 3.2,
faceTurnRate: 13.0,
faceInputBias: 0.72
```

## 次に足す候補

1. 4人対戦
2. ステージ選択
3. CPU
4. アイテム
5. スマホ通信対戦
6. ルームコード
