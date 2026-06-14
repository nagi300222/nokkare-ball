# のっかれボールズ v0.2.4 係数メモ

## 方針

今回は、アップロードされた `N64 マリオパーティ ４にんようミニゲーム『のっかれボール』.mp4` を使って、N64版の操作感に寄せるための近似係数を作りました。

厳密な内部物理値ではなく、動画から見える動きに合わせたゲーム用チューニングです。動画は斜め視点かつN64の遠近表示が入っているため、数値は「完全な物理測定」ではなく「プレイ感再現のための推定値」です。

## 解析した内容

- 動画FPS: 約29.97fps
- 解析対象: ミニゲーム開始後のプレイ部分、約15.5秒〜62.5秒
- ステージ推定: 画面上の芝生円盤を楕円として検出
- ステージ中心の近似: screen `(322, 205)`
- ステージ半径の近似: screen `rx=250`, `ry=90`
- game.js上のステージ半径: `arenaRadius=405`
- 主な追跡対象: 茶色/赤系の大きいプレイヤー領域
- 有効検出フレーム: 1176フレーム

## 動画トラッキングから見た目安

```text
速度中央値: 約127 world units/sec
速度75%点:  約231 world units/sec
速度90%点:  約418 world units/sec
速度95%点:  約628 world units/sec ※衝突/検出ノイズ込み

正方向の加速中央値: 約370 world units/sec^2
正方向の加速75%点:  約658 world units/sec^2
正方向の加速95%点:  約1311 world units/sec^2

減速時のフレームごとの速度残存率中央値: 約0.921
減速時のフレームごとの速度残存率75%点:  約0.961
```

このため、通常移動の最高速度は動画90%点より少し低い `365`、衝突後だけ `485` まで許可する形にしました。

## v0.2.4 tuning

```js
const tuning = {
  accel: 760,
  activeFriction: 0.966,
  idleFriction: 0.918,
  reverseBrakeFriction: 0.808,
  maxSpeed: 365,
  postCollisionMaxSpeed: 485,
  playerRadius: 58,
  positionCorrection: 0.84,
  restitution: 0.80,
  inputRestitutionBonus: 0.12,
  inputImpulseBonus: 42,
  inputTangentImpulse: 18,
  braceOnImpact: 0.20,
  minBounceImpulse: 46,
  separatingNudge: 36,
  tangentDamping: 0.06,
  minImpact: 40,
  vectorBrakeDuration: 1.05,
  vectorBrakeThreshold: 0.14,
  vectorBrakeAccel: 1320,
  vectorBrakeDrag: 3.2,
  faceTurnRate: 13.0,
  faceVelocityTurnRate: 5.4,
  faceInputBias: 0.72,
  fallForgiveness: 0.78
};
```

## 衝突計算の考え方

### 1. 基本は円同士の弾性衝突

プレイヤー同士が重なったら、中心同士を結ぶ接触法線 `n` を使って反射します。

```text
relativeVelocity = b.velocity - a.velocity
velAlongNormal = dot(relativeVelocity, n)
baseImpulse = -(1 + restitution) * velAlongNormal / 2
```

### 2. 入力方向とキャラの向きで反射を補正

v0.2.4では、物理上の接触方向だけでなく、プレイヤーの入力とキャラの向きも見ます。

```text
aDrive = dot(a.input, n) と dot(a.face, n) の混合
bDrive = dot(b.input, -n) と dot(b.face, -n) の混合
```

相手に向かって入力していて、キャラの向きも合っているほど、相手に渡す反射が少し強くなります。

### 3. 逆入力で吹っ飛び慣性を削る

中央方向ではなく、最後に受けた衝突ベクトル `hitVector` を保存します。  
その `hitVector` の反対方向に入力している時だけ、吹っ飛び方向の速度成分を削ります。

```text
hitVector = 衝突で吹っ飛んだ方向
againstHit = dot(input, -hitVector)
againstHit が強いほど、hitVector方向の速度だけ減らす
```

これで、端にいる時でも「中央に向かっているか」ではなく、「実際に飛ばされた方向へ踏ん張っているか」で耐えられるようになります。

## 注意

動画には遠近感、カメラ角度、キャラの上下重なり、検出ノイズがあります。  
そのため、係数は一発確定ではなく、実機プレイ感に合わせて次のように微調整する想定です。

- 弾きが弱い: `restitution` または `inputImpulseBonus` を上げる
- 弾きが強すぎる: `postCollisionMaxSpeed` または `inputImpulseBonus` を下げる
- 滑りすぎる: `idleFriction` と `activeFriction` を下げる
- 止まりすぎる: `idleFriction` と `activeFriction` を上げる
- 逆入力で耐えすぎる: `vectorBrakeAccel` / `vectorBrakeDrag` を下げる
- 逆入力しても耐えない: `vectorBrakeAccel` / `vectorBrakeDrag` を上げる
