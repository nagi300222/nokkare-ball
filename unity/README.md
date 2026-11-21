# のっかれボールズ｜Unity 3D 試作（独立レーン）

> P0 / Unity Editor の実機・ビルド検証はまだ。既存の Web v0.2.4 は repo 直下で維持し、main へは自動マージしない。

## 目的

- **マモ拳本体はThree.js継続**。Unityに移植しない。
- `nagi300222/mamo-ken` の **既存9体のGLBをバイト単位で変更せず流用**。当面はモグゾー／ピスケの2人で確認し、9体へ拡張。
- のっかれボールズの「ボールに乗ったキャラが慣性と弾性衝突で押し合う」楽しさを、3Dで再構築。
- 旧Web版 `game.js` の物理感触を比較基準にする。Unityの初期物理は試作値であり、v0.2.4と同一挙動だと主張しない。

## 手順

1. Unity Hubで **Unity 6.3 LTS（6000.3系列）** を用意。Unityプロジェクトとしてこの `unity/` フォルダを開く。
2. プロジェクトの `Packages/manifest.json` にある **Unity glTFast** (`com.unity.cloud.gltfast`) と Input System (`com.unity.inputsystem`) を Unity が解決することを確認。
3. リポジトリの `unity/` に移動し、Python 3.10+ の標準ライブラリだけで次を実行：

   ```bash
   python tools/sync_mamoken_models.py
   # 全9体を取り込みたい場合
   python tools/sync_mamoken_models.py --all
   # 元データとの一致をオフラインで再チェック
   python tools/sync_mamoken_models.py --verify-only
   ```

4. Unityに戻り、再インポートが完了したらメニュー **Tools → Nokkare → Create Prototype Scene** で `Assets/Nokkare/Scenes/Prototype.unity` を生成。
5. Sceneを開いてPlay。PCは赤=WASD、青=矢印キー、スマホタッチは上半分/下半分からドラッグでそれぞれ操作する試作。
6. モデルが表示されない場合は、ImportエラーとPrefab参照を確認。未取り込みならプレースホルダーで対戦ロジックのみ動かせる。

## 既存モデルを「そのまま」扱うルール

- `assets-manifest.json` にマモ拳の **PR #161 HEAD: a67a90af...** と9体のGit blob SHA1を固定。ネット上の最新branchを追いかけない。
- `tools/sync_mamoken_models.py` はGLBヘッダー、37アニメーション、ユニークなクリップ名、Git blob SHAを検証してから保存。
- `Assets/Nokkare/Models/Imported/` はGit管理対象外。モデルの正本はマモ拳リポジトリ。
- Unityで使う位置・スケール・キャラ方向・アニメーションは、元GLBを変更せず **Prefab/外部コンポーネント** で調整。
- 37クリップがUnity Animatorで適切に動くことは **Editor上で別途実測**。GLB内クリップの存在 ≠ Unityでの再生品質の確認。

## 構成

```
unity/
  Packages/manifest.json
  ProjectSettings/ProjectVersion.txt
  assets-manifest.json
  tools/sync_mamoken_models.py
  Assets/Nokkare/Scripts/NokkarePrototype.cs
  Assets/Nokkare/Editor/NokkareSceneBuilder.cs
  Assets/Nokkare/Models/Imported/    ← 同期後に生成。Gitに含めない
  Assets/Nokkare/Scenes/Prototype.unity ← Editorで生成
  docs/ROLES_AND_ACCEPTANCE.md
```

## 未完了・受け入れゲート

- Unity Editorでの初回コンパイル、GLBの材質/リグ/クリップの表示は**未検証**。
- タッチ操作はまずプロトタイプ。旧版と同じ縦分割UI、スマホでの押しやすさは別ゲート。
- Unity 6.3 WebはiOS Safariも対象だが、ロード・メモリ・FPSはiPhone実機で必ず測定。ブラウザ向けに大幅な軽量化が必要かもしれない。
- 既存Web v0.2.4と比較して重さ・弾性・踏ん張り・場外判定の感触を修正する。初期実装を完成版扱いしない。

統括: [Issue #1](https://github.com/nagi300222/nokkare-ball/issues/1)
