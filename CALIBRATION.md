# のっかれボールズ v0.2.3 係数メモ

## 方針
YouTube参考映像をもとに、N64版の重めの操作感と、スーパースターズ版の分かりやすい衝突反射の中間に寄せた近似チューニングです。

この環境ではYouTube動画をフレーム単位で直接トラッキングできないため、厳密なピクセル計測ではなく、見た目の挙動を再現するための初期係数です。MP4や画面録画ファイルを直接渡せる場合は、次にフレーム解析で再調整できます。

## v0.2.3 tuning

```js
const tuning = {
  accel: 720,
  activeFriction: 0.964,
  idleFriction: 0.912,
  reverseBrakeFriction: 0.835,
  maxSpeed: 350,
  postCollisionMaxSpeed: 455,
  playerRadius: 58,
  positionCorrection: 0.82,
  restitution: 0.88,
  minBounceImpulse: 50,
  separatingNudge: 32,
  tangentDamping: 0.075,
  minImpact: 42,
  vectorBrakeDuration: 0.95,
  vectorBrakeThreshold: 0.18,
  vectorBrakeAccel: 1240,
  vectorBrakeDrag: 2.85,
  fallForgiveness: 0.76
};
```

## 調整意図

- `accel` / `activeFriction` / `maxSpeed`: 常時キビキビしすぎないが、押し合いには参加しやすい速度。
- `idleFriction`: 入力を離すと止まりやすいが、完全にカチッとは止まらない。
- `restitution`: 衝突時には「はじいた」感が出るよう強め。
- `postCollisionMaxSpeed`: 弾かれすぎて即死しすぎない上限。
- `vectorBrake*`: ぶつかった方向の逆へ入力した時だけ、吹っ飛び方向の速度成分を削る。
- `fallForgiveness`: 端の判定を少し緩め、反射後に粘れる余地を残す。

## 次に本格計測するなら

画面録画MP4から、各フレームのボール中心座標を追跡します。

1. ステージ円の中心と半径を検出
2. ボール中心の座標を正規化
3. 位置差分から速度・加速度を推定
4. 衝突前後の法線方向速度から反発係数を推定
5. 逆入力時の減速曲線から `vectorBrakeAccel` / `vectorBrakeDrag` を再推定

