using System.IO;
using UnityEditor;
using UnityEditor.SceneManagement;
using UnityEngine;
using UnityEngine.SceneManagement;

namespace Nokkare.Editor
{
    public static class NokkareSceneBuilder
    {
        [MenuItem("Tools/Nokkare/Create Prototype Scene")]
        public static void CreateScene()
        {
            const string sceneDir = "Assets/Nokkare/Scenes";
            const string path = sceneDir + "/Prototype.unity";
            Directory.CreateDirectory(sceneDir);
            EditorSceneManager.NewScene(NewSceneSetup.EmptyScene, NewSceneMode.Single);

            var camObject = new GameObject("Main Camera");
            camObject.tag = "MainCamera";
            var cam = camObject.AddComponent<Camera>();
            cam.orthographic = true;
            cam.orthographicSize = 6f;
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = new Color(0.12f, 0.18f, 0.22f);
            camObject.transform.position = new Vector3(0f, 13f, 0f);
            camObject.transform.rotation = Quaternion.Euler(90f, 0f, 0f);
            camObject.AddComponent<AudioListener>();

            var lightObject = new GameObject("Directional Light");
            var sun = lightObject.AddComponent<Light>();
            sun.type = LightType.Directional;
            sun.intensity = 1.25f;
            lightObject.transform.rotation = Quaternion.Euler(48f, -35f, 0f);

            var gameObject = new GameObject("Nokkare Prototype");
            var game = gameObject.AddComponent<NokkarePrototype>();
            const string models = "Assets/Nokkare/Models/Imported/";
            game.moguzoPrefab = AssetDatabase.LoadAssetAtPath<GameObject>(models + "moguzo.glb");
            game.pisukePrefab = AssetDatabase.LoadAssetAtPath<GameObject>(models + "pisuke.glb");
            EditorUtility.SetDirty(game);

            if (!EditorSceneManager.SaveScene(SceneManager.GetActiveScene(), path))
                throw new IOException("Unable to save prototype scene");
            EditorBuildSettings.scenes = new[] { new EditorBuildSettingsScene(path, true) };
            AssetDatabase.Refresh();
            if (game.moguzoPrefab == null || game.pisukePrefab == null)
                Debug.LogWarning("Nokkare: one or both original GLBs missing. Run model sync, wait for glTFast importer, then create the scene again. Only placeholders will show.");
            else
                Debug.Log("Nokkare: original GLB instances assigned. Verify model scale, materials, animation clips, and device behavior separately.");
            EditorSceneManager.OpenScene(path);
        }
    }
}
