// Editor-only validation. This does not change or re-export Mamo-ken's .glb files.
// Requires com.unity.cloud.gltfast (the default .glb ScriptedImporter).
using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using UnityEditor;
using UnityEngine;

namespace Nokkare.Editor
{
    public static class NokkareModelAudit
    {
        private const string ModelFolder = "Assets/Nokkare/Models/Imported";
        private const int ExpectedClips = 37;
        private static readonly string[] InitialRiders = { "moguzo", "pisuke" };
        private static readonly string[] AllRiders =
        {
            "moguzo", "pisuke", "godan", "hakuma", "chirka",
            "takimaru", "yomikage", "bullet", "dark_moguzo"
        };
        private static readonly string[] EssentialClips = { "idle", "walk_f", "walk_b" };

        [Serializable]
        public sealed class ModelRecord
        {
            public string id;
            public string sourceAssetPath;
            public bool prefabImported;
            public int rendererCount;
            public int skinnedRendererCount;
            public int animationClipCount;
            public string[] animationNames;
            public string[] errors;
            public string[] warnings;
        }

        [Serializable]
        public sealed class ModelReport
        {
            public string generatedAtUtc;
            public string unityVersion;
            public string scope;
            public bool passed;
            public ModelRecord[] models;
        }

        [MenuItem("Tools/Nokkare/Audit Imported Models (2 riders)")]
        public static void AuditInitialTwo()
        {
            Audit(InitialRiders, "initial-two");
        }

        [MenuItem("Tools/Nokkare/Audit Imported Models (all 9)")]
        public static void AuditAllNine()
        {
            Audit(AllRiders, "all-nine");
        }

        // Unity CLI:
        // -batchmode -nographics -quit -projectPath <unity-dir>
        // -executeMethod Nokkare.Editor.NokkareModelAudit.RunBatchmodeAudit
        public static void RunBatchmodeAudit()
        {
            AuditInitialTwo();
        }

        public static void RunBatchmodeAuditAll()
        {
            AuditAllNine();
        }

        private static void Audit(IEnumerable<string> ids, string scope)
        {
            AssetDatabase.Refresh(ImportAssetOptions.ForceSynchronousImport);
            var records = ids.Select(InspectModel).ToArray();
            var report = new ModelReport
            {
                generatedAtUtc = DateTime.UtcNow.ToString("o"),
                unityVersion = Application.unityVersion,
                scope = scope,
                passed = records.All(model => model.errors.Length == 0),
                models = records
            };

            var reportDir = Path.GetFullPath("BuildReports");
            Directory.CreateDirectory(reportDir);
            var reportPath = Path.Combine(reportDir, "nokkare-model-audit-" + scope + ".json");
            File.WriteAllText(reportPath, JsonUtility.ToJson(report, true));

            foreach (var record in records)
            {
                var status = record.errors.Length == 0 ? "PASS" : "FAIL";
                var summary = string.Format(
                    "{0} {1}: pref={2} renderers={3} skinned={4} clips={5}",
                    status, record.id, record.prefabImported,
                    record.rendererCount, record.skinnedRendererCount, record.animationClipCount);
                if (record.errors.Length > 0)
                    Debug.LogError(summary + "\n" + string.Join("\n", record.errors));
                else
                    Debug.Log(summary);
                foreach (string warning in record.warnings)
                    Debug.LogWarning(record.id + ": " + warning);
            }
            Debug.Log("Nokkare model audit report: " + reportPath);
            if (!report.passed)
                throw new InvalidOperationException("Nokkare model audit failed. Review " + reportPath);
        }

        private static ModelRecord InspectModel(string id)
        {
            var errors = new List<string>();
            var warnings = new List<string>();
            var path = ModelFolder + "/" + id + ".glb";
            var result = new ModelRecord
            {
                id = id,
                sourceAssetPath = path,
                animationNames = Array.Empty<string>()
            };

            // The Python source sync tool separately verifies Git blob SHA and GLB JSON.
            // Editor audit checks whether Unity/glTFast can actually import prefab + clips.
            var model = AssetDatabase.LoadAssetAtPath<GameObject>(path);
            result.prefabImported = model != null;
            if (model == null)
            {
                errors.Add("GLB is absent or Unity/glTFast did not import a GameObject prefab: " + path);
            }
            else
            {
                var renderers = model.GetComponentsInChildren<Renderer>(true);
                result.rendererCount = renderers.Length;
                result.skinnedRendererCount = model.GetComponentsInChildren<SkinnedMeshRenderer>(true).Length;
                if (renderers.Length == 0)
                    errors.Add("Imported GameObject has no Renderer children");
                if (result.skinnedRendererCount == 0)
                    warnings.Add("No SkinnedMeshRenderer found; verify rig/animation deformation visually");
            }

            var clips = AssetDatabase.LoadAllAssetsAtPath(path)
                .OfType<AnimationClip>()
                .Where(clip => clip != null)
                .ToArray();
            var clipNames = clips.Select(clip => clip.name).ToArray();
            result.animationNames = clipNames;
            result.animationClipCount = clips.Length;
            if (clipNames.Length != ExpectedClips)
                errors.Add(string.Format("Expected {0} imported clips but saw {1}. Inspect glTFast importer settings.", ExpectedClips, clipNames.Length));
            if (clipNames.Distinct(StringComparer.Ordinal).Count() != clipNames.Length)
                errors.Add("Imported AnimationClip names are duplicated");
            foreach (string name in EssentialClips)
                if (!clipNames.Contains(name, StringComparer.Ordinal))
                    errors.Add("Missing required rider animation: " + name);
            if (model != null && model.GetComponentInChildren<Animator>(true) == null)
                warnings.Add("No Animator found in prefab; playback will need a separate Unity component");

            result.errors = errors.ToArray();
            result.warnings = warnings.ToArray();
            return result;
        }
    }
}
