#!/usr/bin/env python3
"""Fetch unmodified Mamo-ken GLB assets at an immutable commit, verifying Git SHA1.

stdlib only; downloads are local build artifacts and must not be committed.
"""
import argparse
import hashlib
import json
from pathlib import Path
import struct
import urllib.request


ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "assets-manifest.json"
DESTINATION = ROOT / "Assets" / "Nokkare" / "Models" / "Imported"


def git_blob_sha(data: bytes) -> str:
    header = b"blob " + str(len(data)).encode("ascii") + b"\0"
    return hashlib.sha1(header + data).hexdigest()


def inspect_glb(data: bytes) -> tuple[int, tuple[str, ...]]:
    if len(data) < 20:
        raise ValueError("GLB too short")
    magic, version, total_length = struct.unpack_from("<4sII", data)
    if magic != b"glTF" or version != 2 or total_length != len(data):
        raise ValueError("Invalid GLB v2 header/length")
    json_len, chunk_type = struct.unpack_from("<I4s", data, 12)
    if chunk_type != b"JSON" or 20 + json_len > len(data):
        raise ValueError("Missing GLB JSON chunk")
    document = json.loads(data[20:20 + json_len].decode("utf-8"))
    clips = tuple(item.get("name", "") for item in document.get("animations", []))
    return len(clips), clips


def download(url: str) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "NokkareUnityAssetSync/1.0"})
    with urllib.request.urlopen(request, timeout=60) as response:
        return response.read()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--all", action="store_true", help="Fetch all 9 models")
    parser.add_argument("--character", nargs="+", metavar="ID", help="Fetch specific character IDs")
    parser.add_argument("--verify-only", action="store_true", help="Check files without network")
    args = parser.parse_args()
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    names = list(manifest["models"]) if args.all else (args.character or ["moguzo", "pisuke"])
    unknown = set(names) - set(manifest["models"])
    if unknown:
        parser.error("Unknown character(s): " + ", ".join(sorted(unknown)))
    DESTINATION.mkdir(parents=True, exist_ok=True)
    for name in names:
        target = DESTINATION / f"{name}.glb"
        expected = manifest["models"][name]["git_blob_sha"]
        if target.exists():
            data = target.read_bytes()
            if git_blob_sha(data) != expected:
                raise RuntimeError(f"{target}: source hash mismatch; won't overwrite local file")
            origin = "cached"
        elif args.verify_only:
            raise FileNotFoundError(f"Missing: {target}")
        else:
            path = f"{manifest['source_prefix']}/{name}/{name}.glb"
            url = f"https://raw.githubusercontent.com/{manifest['source_repo']}/{manifest['source_commit']}/{path}"
            data = download(url)
            if git_blob_sha(data) != expected:
                raise RuntimeError(f"{name}: downloaded content differs from pinned Git blob")
            target.write_bytes(data)
            origin = "downloaded"
        count, clips = inspect_glb(data)
        required = manifest["expected_animations_per_model"]
        if count != required or len(set(clips)) != count:
            raise RuntimeError(f"{name}: expected {required} uniquely named clips, found {count}")
        print(f"OK {name} ({origin}): {len(data):,} bytes; {count} animations; Git blob {expected}")
    print("Model files are byte-identical to the pinned Mamo-ken sources.")


if __name__ == "__main__":
    main()
