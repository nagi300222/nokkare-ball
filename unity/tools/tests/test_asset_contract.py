"""Small offline checks; do not claim to validate Unity or download the original GLBs."""
import hashlib
import importlib.util
import json
from pathlib import Path
import struct
import unittest

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location("sync_mamoken_models", ROOT / "tools" / "sync_mamoken_models.py")
sync = importlib.util.module_from_spec(spec)
spec.loader.exec_module(sync)


class ModelSourceContractTests(unittest.TestCase):
    def test_manifest_is_immutable_and_complete(self):
        manifest = json.loads((ROOT / "assets-manifest.json").read_text(encoding="utf-8"))
        self.assertEqual(len(manifest["source_commit"]), 40)
        self.assertEqual(manifest["source_repo"], "nagi300222/mamo-ken")
        self.assertEqual(manifest["expected_animations_per_model"], 37)
        expected = {
            "moguzo", "pisuke", "godan", "hakuma", "chirka",
            "takimaru", "yomikage", "bullet", "dark_moguzo"
        }
        self.assertEqual(set(manifest["models"]), expected)
        for value in manifest["models"].values():
            sha = value["git_blob_sha"]
            self.assertEqual(len(sha), 40)
            self.assertTrue(all(c in "0123456789abcdef" for c in sha))

    def test_git_blob_hasher_matches_standard_formula(self):
        data = b"hello world"
        header = b"blob " + str(len(data)).encode() + b"\0"
        self.assertEqual(sync.git_blob_sha(data), hashlib.sha1(header + data).hexdigest())

    def test_glb_requires_37_distinct_named_clips(self):
        payload = json.dumps({"animations": [{"name": "motion_" + str(i)} for i in range(37)]}).encode()
        payload += b" " * ((-len(payload)) % 4)
        size = 20 + len(payload)
        glb = struct.pack("<4sII", b"glTF", 2, size)
        glb += struct.pack("<I4s", len(payload), b"JSON") + payload
        count, names = sync.inspect_glb(glb)
        self.assertEqual(count, 37)
        self.assertEqual(len(set(names)), 37)
        with self.assertRaises(ValueError):
            sync.inspect_glb(glb[:-1])
        with self.assertRaises(ValueError):
            sync.inspect_glb(b"not-a-glb")


if __name__ == "__main__":
    unittest.main()
