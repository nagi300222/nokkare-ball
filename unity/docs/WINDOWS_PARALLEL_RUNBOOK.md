# マモ拳（Three.js）× のっかれボールズ（Unity）並行開発｜Windows手順（2026-11-22）

## 0. 固定ルール
- **マモ拳はThree.jsの現行ゲームを維持**。旧v0.6ステップ＋v0.5バランスに新v0.7入力を別Draftで試す。
- **のっかれボールズはUnity 3Dを別リポジトリで試作**。既存Web v0.2.4は残す。
- 同じ9体のGLBが元データ。のっかれUnity側は**元GLBを編集・再生成しない**。モデルの位置・大きさ・動きはUnityのPrefab/Componentで変更する。
- それぞれPRで独立して試し、実機受け入れ前にmainへマージしない。別案件の失敗で進行中の作業を止めない。

## 1. マモ拳（スマホ向け操作 v0.7）の進め方
**GitHub:** https://github.com/nagi300222/mamo-ken/pull/164

すぐ試すにはPRのCloudflareプレビュー**デプロイ成功を確認してから**iPhone Safariで `/dojo/` を開く。古いv0.6プレビューとURLが別なので注意。

ローカルPCで確認する場合（Node.js 20+ / Gitが必要）：

```powershell
git clone https://github.com/nagi300222/mamo-ken.git
cd mamo-ken
git switch feat/mamoken-direction-special-v07
cd exp/fable-3d/dojo
npm test
npm start
```

表示先：`http://127.0.0.1:4173/exp/fable-3d/dojo/`

- 左スティックと前後ステップ2ボタンは従来どおり。
- 右は弱／強／掴み／ギュイーン／必殺／奥義（6個）。
- 必殺のみ＝s1／上＋必殺＝対空s2／前＋必殺＝s3／下＋必殺＝咆哮。奥義はゲージ100で専用ボタン。
- B：必殺／M：奥義（キーボード）。旧236等の弱強コマンドは比較用に保持。
- **実機ゲート**：横画面の押しやすさ、同時タッチ、ジャンプ誤爆、咆哮のカウンター、ゴダンの強さとCPUの難しさ。

### マモ拳 AIの担当
- ミオ：入力と既存バランス・カメラの整合、CI確認、スマホテスト案。
- Codex：別[Issue #163](https://github.com/nagi300222/mamo-ken/issues/163)でCPU反応・ゴダン・9体相性・テストと調整。入力PoC PR #164は勝手に上書きしない。
- Claude（ヨル）：必要時にアニメーション/当たり判定との整合や表現強化を別レビュー。GLBの変更は個別提案。
- ナギ：スマホで技を出してみて体感を評価。

## 2. のっかれボールズ Unity側の準備
**GitHub:** https://github.com/nagi300222/nokkare-ball/pull/4
**モデル監査子PR:** https://github.com/nagi300222/nokkare-ball/pull/5

Windows PCにGit、Python 3.10以上、Unity Hubを用意し、Unity Hubから**Unity 6.3 LTS**のプロジェクト指定バージョン`6000.3.17f1`を優先して導入。WebでiPhoneから試すには **Web Build Support** モジュールも必要。新しい6.3パッチへ変える場合は別PRで事前検証する。

PowerShell:

```powershell
git clone https://github.com/nagi300222/nokkare-ball.git
cd nokkare-ball
git switch feat/unity-p1-real-glb-audit
cd unity
py -3 tools/sync_mamoken_models.py
py -3 tools/sync_mamoken_models.py --verify-only
```

初回はモグゾー／ピスケ2体を同期。9体すべて取得したい場合は`py -3 tools/sync_mamoken_models.py --all`。データは固定commitからダウンロードし、Git blob SHAと37アニメーション名を自動照合する。

Unity Hubから**プロジェクトを追加**→ `nokkare-ball\unity`（repo rootではない）を開く。

1. Package Managerで`com.unity.cloud.gltfast`と`com.unity.inputsystem`が解決されているか確認。エラーがあればバージョン・Unity Console内容を保存。
2. Project Settings → Player → Active Input Handling を `Input System Package (New)` か `Both` にする。
3. `Tools → Nokkare → Audit Imported Models (2 riders)`。結果は`unity/BuildReports/nokkare-model-audit-initial-two.json`。
4. `Tools → Nokkare → Create Prototype Scene`。プロジェクト内の`Assets/Nokkare/Scenes/Prototype.unity`を開いて **Play**。赤WASD、青矢印で2Pを確認する。モデルが表示されずPLACEHOLDERのときはインポートエラー／欠けたPrefabを調べる。
5. 旧Web版v0.2.4と、押し合った感触（加速・減速・逆入力・衝突・場外KO）を比較。Unity初期物理は旧版と同じではなく調整が必要。
6. Playとクリップ再生を確認したら、File → Build Profiles → Web プラットフォームのビルドを試す。**Unity WebはiOS Safari 15以上が要件に入るが、iPhone実機でのメモリ/FPS・画質は未検証**。

**注意:** 実機確認/Editorビルドはこれから。GLBの構造検査が通っただけで「Unity上で37クリップが綺麗に再生できた」と扱わない。

### のっかれボールズ AIの担当
- Codex：[Issue #2](https://github.com/nagi300222/nokkare-ball/issues/2)：`feat/unity-mamoken-3d-poc`を起点にゲームロジック・2P多点タッチ・物理feel・Unity Webビルド、別Draft PR。
- Claude（ヨル）：[Issue #3](https://github.com/nagi300222/nokkare-ball/issues/3)：`feat/unity-p1-real-glb-audit`を起点にモデルのPrefab/リグ/37モーション・乗車の見た目、別Draft PR。
- ミオ：2つのPRを比較し、先にコンパイル・GLB取り込み・テストを通すための統合案を設計。ナギが操作した結果で採否を決める。
- ナギ：実機で見た目と押し合い体験を判定。認証やUnity Hubの必要操作以外はAI側が進める。

## 3. 現状の手続き上の注意
- Claude/ヨルやCodexへの外部AI実行依頼は、Issueを作成しただけでは開始されない。各AIが対応するIssueを読んで実行し、別ブランチとDraft PRを作る必要がある。
- GitHub ActionsのNode/Python検証と、Unity EditorのC#コンパイル・実機動作は**別ゲート**。
- 最終段階でマモ拳PR #164と、のっかれUnity PR #4/#5を**それぞれ独立して確認**する。
