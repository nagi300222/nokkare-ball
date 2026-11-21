using UnityEngine;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.EnhancedTouch;
using FingerTouch = UnityEngine.InputSystem.EnhancedTouch.Touch;
#endif

namespace Nokkare
{
    // P0 prototype: exact original GLB prefabs, separate from ball physics.
    // Numbers are experimental; they do not reproduce the 2D v0.2.4 feel yet.
    public sealed class NokkarePrototype : MonoBehaviour
    {
        public GameObject moguzoPrefab;
        public GameObject pisukePrefab;

        [Header("Unapproved P0 physics parameters")]
        public float arenaRadius = 4.05f;
        public float ballRadius = 0.58f;
        public float acceleration = 7.6f;
        public float topSpeed = 3.65f;
        [Range(0f, 1f)] public float movingRetentionPerFrame = 0.966f;
        [Range(0f, 1f)] public float idleRetentionPerFrame = 0.918f;
        [Range(0f, 1f)] public float restitution = 0.80f;
        public float roundSeconds = 60f;
        public int initialStocks = 3;

        private sealed class Rider
        {
            public GameObject root;
            public Transform ballVisual;
            public Transform modelAnchor;
            public Vector2 position;
            public Vector2 velocity;
            public int stocks;
            public float respawnTimer;
            public bool alive;
        }

        private readonly Rider[] riders = new Rider[2];
        private float remaining;
        private string endMessage = "";
        private bool roundActive;

        private void Awake()
        {
            Time.fixedDeltaTime = 1f / 60f;
#if ENABLE_INPUT_SYSTEM
            EnhancedTouchSupport.Enable();
#endif
        }

        private void OnDestroy()
        {
#if ENABLE_INPUT_SYSTEM
            EnhancedTouchSupport.Disable();
#endif
        }

        private void Start()
        {
            var stage = GameObject.CreatePrimitive(PrimitiveType.Cylinder);
            stage.name = "Circular Arena";
            stage.transform.SetParent(transform, false);
            stage.transform.position = new Vector3(0f, -0.20f, 0f);
            stage.transform.localScale = new Vector3(arenaRadius * 2f, 0.15f, arenaRadius * 2f);
            stage.GetComponent<Renderer>().material.color = new Color(0.28f, 0.45f, 0.37f);
            Destroy(stage.GetComponent<Collider>());
            riders[0] = CreateRider("Red / Moguzo", Color.red, moguzoPrefab);
            riders[1] = CreateRider("Blue / Pisuke", new Color(0.2f, 0.65f, 1f), pisukePrefab);
            StartRound();
        }

        private Rider CreateRider(string name, Color color, GameObject modelPrefab)
        {
            var rider = new Rider();
            rider.root = new GameObject(name);
            rider.root.transform.SetParent(transform, false);
            var ball = GameObject.CreatePrimitive(PrimitiveType.Sphere);
            ball.name = "Rolling Ball (separate from character)";
            ball.transform.SetParent(rider.root.transform, false);
            ball.transform.localScale = Vector3.one * (ballRadius * 2f);
            ball.GetComponent<Renderer>().material.color = color;
            Destroy(ball.GetComponent<Collider>());
            rider.ballVisual = ball.transform;

            var anchor = new GameObject("Character Mount");
            anchor.transform.SetParent(rider.root.transform, false);
            anchor.transform.localPosition = Vector3.up * ballRadius;
            rider.modelAnchor = anchor.transform;
            if (modelPrefab == null)
            {
                // Clearly labeled temporary placeholder, not a Mamo-ken model.
                var placeholder = GameObject.CreatePrimitive(PrimitiveType.Capsule);
                placeholder.name = "PLACEHOLDER - run model sync";
                placeholder.transform.SetParent(anchor.transform, false);
                placeholder.transform.localPosition = Vector3.up * 0.5f;
                placeholder.transform.localScale = new Vector3(0.45f, 0.5f, 0.45f);
                placeholder.GetComponent<Renderer>().material.color = color;
                Destroy(placeholder.GetComponent<Collider>());
            }
            else
            {
                var instance = Instantiate(modelPrefab, anchor.transform);
                instance.name = modelPrefab.name + " (original GLB instance)";
                FitInstance(instance, anchor.transform.position);
            }
            return rider;
        }

        private static void FitInstance(GameObject model, Vector3 footTarget)
        {
            // This only changes the Unity instance; imported GLB bytes are untouched.
            var renderers = model.GetComponentsInChildren<Renderer>();
            if (renderers.Length == 0) return;
            Bounds bounds = renderers[0].bounds;
            for (int i = 1; i < renderers.Length; i++) bounds.Encapsulate(renderers[i].bounds);
            if (bounds.size.y <= 0.001f) return;
            model.transform.localScale *= Mathf.Clamp(1.2f / bounds.size.y, 0.01f, 100f);
            bounds = renderers[0].bounds;
            for (int i = 1; i < renderers.Length; i++) bounds.Encapsulate(renderers[i].bounds);
            model.transform.position += Vector3.up * (footTarget.y - bounds.min.y);
        }

        private void StartRound()
        {
            remaining = roundSeconds;
            endMessage = "";
            roundActive = true;
            for (int i = 0; i < riders.Length; i++)
            {
                riders[i].stocks = Mathf.Max(1, initialStocks);
                Respawn(i);
            }
        }

        private void Respawn(int index)
        {
            var p = riders[index];
            p.position = index == 0 ? new Vector2(0f, 1.5f) : new Vector2(0f, -1.5f);
            p.velocity = Vector2.zero;
            p.respawnTimer = 0f;
            p.alive = true;
            p.root.SetActive(true);
            UpdateVisual(p, Vector2.zero, 0f);
        }

        private void FixedUpdate()
        {
            if (!roundActive) return;
            float dt = Time.fixedDeltaTime;
            remaining -= dt;
            if (remaining <= 0f) { Finish("Time up"); return; }

            for (int i = 0; i < riders.Length; i++)
            {
                var p = riders[i];
                if (!p.alive)
                {
                    p.respawnTimer -= dt;
                    if (p.respawnTimer <= 0f && p.stocks > 0) Respawn(i);
                    continue;
                }
                Vector2 input = ReadInput(i);
                p.velocity += input * acceleration * dt;
                float retention = input.sqrMagnitude > 0.01f ? movingRetentionPerFrame : idleRetentionPerFrame;
                p.velocity *= Mathf.Pow(retention, dt * 60f);
                p.velocity = Vector2.ClampMagnitude(p.velocity, topSpeed);
                p.position += p.velocity * dt;
                UpdateVisual(p, input, dt);
            }

            ResolveCollision();
            for (int i = 0; i < riders.Length; i++)
            {
                var p = riders[i];
                if (!p.alive) continue;
                if (p.position.magnitude > arenaRadius + ballRadius * 0.78f)
                {
                    p.stocks--;
                    p.alive = false;
                    p.root.SetActive(false);
                    p.respawnTimer = 1f;
                    if (p.stocks <= 0) Finish("Ring out");
                }
                else UpdateVisual(p, Vector2.zero, 0f);
            }
        }

        private void ResolveCollision()
        {
            var a = riders[0];
            var b = riders[1];
            if (!a.alive || !b.alive) return;
            Vector2 delta = b.position - a.position;
            float dist = delta.magnitude;
            float diameter = ballRadius * 2f;
            if (dist >= diameter) return;
            Vector2 n = dist > 0.0001f ? delta / dist : Vector2.right;
            float overlap = (diameter - dist) * 0.5f;
            a.position -= n * overlap;
            b.position += n * overlap;
            float closing = Vector2.Dot(b.velocity - a.velocity, n);
            if (closing < 0f)
            {
                float impulse = -(1f + restitution) * closing * 0.5f;
                a.velocity -= n * impulse;
                b.velocity += n * impulse;
            }
        }

        private void UpdateVisual(Rider p, Vector2 input, float dt)
        {
            p.root.transform.position = new Vector3(p.position.x, ballRadius, p.position.y);
            if (dt > 0f && p.velocity.sqrMagnitude > 0.001f)
            {
                Vector3 axis = new Vector3(p.velocity.y, 0f, -p.velocity.x).normalized;
                p.ballVisual.Rotate(axis, p.velocity.magnitude * dt / ballRadius * Mathf.Rad2Deg, Space.World);
            }
            Vector2 face = input.sqrMagnitude > 0.02f ? input : p.velocity;
            if (dt > 0f && face.sqrMagnitude > 0.01f)
            {
                Quaternion rotation = Quaternion.LookRotation(new Vector3(face.x, 0f, face.y));
                p.modelAnchor.rotation = Quaternion.Slerp(p.modelAnchor.rotation, rotation, Mathf.Clamp01(12f * dt));
            }
        }

        private static Vector2 ReadInput(int index)
        {
            Vector2 v = Vector2.zero;
#if ENABLE_INPUT_SYSTEM
            var keyboard = Keyboard.current;
            if (keyboard != null)
            {
                if (index == 0)
                {
                    if (keyboard.aKey.isPressed) v.x -= 1f;
                    if (keyboard.dKey.isPressed) v.x += 1f;
                    if (keyboard.wKey.isPressed) v.y += 1f;
                    if (keyboard.sKey.isPressed) v.y -= 1f;
                }
                else
                {
                    if (keyboard.leftArrowKey.isPressed) v.x -= 1f;
                    if (keyboard.rightArrowKey.isPressed) v.x += 1f;
                    if (keyboard.upArrowKey.isPressed) v.y += 1f;
                    if (keyboard.downArrowKey.isPressed) v.y -= 1f;
                }
            }
            foreach (var t in FingerTouch.activeTouches)
            {
                if (t.phase == UnityEngine.InputSystem.TouchPhase.Ended ||
                    t.phase == UnityEngine.InputSystem.TouchPhase.Canceled) continue;
                bool topHalf = t.startScreenPosition.y >= Screen.height * 0.5f;
                if (topHalf != (index == 0)) continue;
                v += Vector2.ClampMagnitude((t.screenPosition - t.startScreenPosition) / 75f, 1f);
                break;
            }
#else
            if (index == 0)
            {
                if (Input.GetKey(KeyCode.A)) v.x -= 1f;
                if (Input.GetKey(KeyCode.D)) v.x += 1f;
                if (Input.GetKey(KeyCode.W)) v.y += 1f;
                if (Input.GetKey(KeyCode.S)) v.y -= 1f;
            }
            else
            {
                if (Input.GetKey(KeyCode.LeftArrow)) v.x -= 1f;
                if (Input.GetKey(KeyCode.RightArrow)) v.x += 1f;
                if (Input.GetKey(KeyCode.UpArrow)) v.y += 1f;
                if (Input.GetKey(KeyCode.DownArrow)) v.y -= 1f;
            }
#endif
            return Vector2.ClampMagnitude(v, 1f);
        }

        private void Finish(string reason)
        {
            roundActive = false;
            int red = riders[0].stocks, blue = riders[1].stocks;
            endMessage = (red == blue ? "DRAW" : red > blue ? "RED WINS" : "BLUE WINS") + " / " + reason;
        }

        private void LateUpdate()
        {
            var camera = Camera.main;
            if (camera != null && camera.orthographic)
                camera.orthographicSize = Mathf.Max(arenaRadius + 1f,
                    (arenaRadius + 1f) / Mathf.Max(0.25f, camera.aspect));
        }

        private void OnGUI()
        {
            GUILayout.BeginArea(new Rect(10f, 10f, Mathf.Min(340f, Screen.width - 20f), 125f), GUI.skin.box);
            GUILayout.Label("のっかれボールズ | Unity P0");
            GUILayout.Label($"{Mathf.CeilToInt(Mathf.Max(0f, remaining))}s RED {riders[0]?.stocks ?? 0} : {riders[1]?.stocks ?? 0} BLUE");
            GUILayout.Label(roundActive ? "WASD / arrows | Mobile: drag top / bottom half" : endMessage);
            if (GUILayout.Button("Restart / 再戦") && riders[0] != null && riders[1] != null) StartRound();
            GUILayout.EndArea();
        }
    }
}
