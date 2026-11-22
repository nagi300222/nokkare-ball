# P1: actual GLB integrity and Unity Editor import audit

This branch adds checks only. **It is not proof that Unity has compiled or played the models**.

## Two separate gates

1. **Source gate (GitHub Actions):** downloads all nine existing `.glb` files from the exact Mamo-ken Git commit pinned in `unity/assets-manifest.json`. The Python tool checks Git blob SHA-1 (same algorithm used by GitHub), glTF binary header/length, and unique animation clip names. No model binary is committed or published as a CI artifact.
2. **Unity gate (Unity 6.3 Editor required):** glTFast imports the files as GameObject prefabs. `Tools > Nokkare > Audit Imported Models (2 riders)` verifies renderer presence and AnimationClip subassets with required `idle`, `walk_f`, and `walk_b` names. Use the *all 9* variant later.

## Editor gate steps

- In repository root, run `python unity/tools/sync_mamoken_models.py`.
- Open the `unity/` project in Unity 6.3 LTS and allow Package Manager to import the `.glb` assets via glTFast.
- Select **Tools > Nokkare > Audit Imported Models (2 riders)**.
- Read `unity/BuildReports/nokkare-model-audit-initial-two.json` and inspect any importer warnings.
- Generate the scene with **Tools > Nokkare > Create Prototype Scene**, then inspect material fidelity and animation playback manually.

Optional batchmode:

```shell
Unity -batchmode -nographics -quit -projectPath /ABSOLUTE/PATH/TO/unity -executeMethod Nokkare.Editor.NokkareModelAudit.RunBatchmodeAudit -logFile /ABSOLUTE/PATH/TO/unity.log
```

**Limitations:** The Editor audit verifies clip presence; it does **not** automatically prove playable deformation, animator bindings, source-pose fidelity, correct ball mounting, FPS, or touch compatibility. Those remain in [Issue #3](https://github.com/nagi300222/nokkare-ball/issues/3) and [Issue #2](https://github.com/nagi300222/nokkare-ball/issues/2). Model files must stay immutable; scale/offset/animations should be configured on Unity instances/prefabs.

## Sources and permissions

- Original source: `nagi300222/mamo-ken`, pinned commit `a67a90af2c0774335f6a3aa95ed87a4ee9716cd4`.
- Unity glTFast editor importer documents: https://github.com/Unity-Technologies/com.unity.cloud.gltfast/blob/main/Packages/com.unity.cloud.gltfast/Documentation~/ImportEditor.md
- No changes to the original Mamo-ken repo, `nokkare-ball/main`, or the old playable v0.2.4.
