#!/usr/bin/env python3
"""Generate voice clips from manifest.json using Kokoro (Python).

Run in parts if downloads or generation time out:

  py -3.12 scripts/generate-kokoro-clips.py --part 1 --parts 4
  py -3.12 scripts/generate-kokoro-clips.py --part 2 --parts 4
  ...

Or: npm run voice:generate:1  (through voice:generate:4)
"""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path

import numpy as np
import soundfile as sf
from kokoro import KPipeline

ROOT = Path(__file__).resolve().parent.parent / "public" / "audio" / "voice"
MANIFEST = ROOT / "manifest.json"


def load_clips() -> list[dict]:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    seen: set[str] = set()
    clips = []
    for clip in manifest["clips"]:
        file_name = clip["file"].replace(".mp3", ".wav")
        if file_name in seen:
            continue
        seen.add(file_name)
        clips.append({**clip, "file": file_name})
    return clips, manifest


def slice_part(clips: list[dict], part: int, parts: int) -> list[dict]:
    if part < 1 or part > parts:
        raise SystemExit(f"--part must be 1..{parts}")
    chunk = (len(clips) + parts - 1) // parts
    start = (part - 1) * chunk
    end = min(start + chunk, len(clips))
    return clips[start:end]


def finalize_manifest(manifest: dict) -> None:
    next_manifest = {
        **manifest,
        "clipFormat": "wav",
        "generatedAt": datetime.now().isoformat(),
        "clips": [
            {**c, "file": c["file"].replace(".mp3", ".wav")} for c in manifest["clips"]
        ],
    }
    MANIFEST.write_text(json.dumps(next_manifest, indent=2) + "\n", encoding="utf-8")


def generate_clips(clips: list[dict], voice: str, speed: float) -> None:
    print("Loading Kokoro pipeline (first run downloads model from HuggingFace)...")
    pipeline = KPipeline(lang_code="a")
    ROOT.mkdir(parents=True, exist_ok=True)

    for i, clip in enumerate(clips, 1):
        out = ROOT / clip["file"]
        label = f"[{i:02d}/{len(clips)}] {clip['id']}"
        if out.exists() and out.stat().st_size > 1000:
            print(f"{label} skip (exists)")
            continue

        samples = None
        try:
            for result in pipeline(clip["text"], voice=voice, speed=speed):
                chunk = result.audio
                if chunk is None:
                    continue
                samples = chunk if samples is None else np.concatenate([samples, chunk])
        except Exception as err:
            print(f"{label} FAILED: {err}")
            continue

        if samples is None or len(samples) == 0:
            print(f"{label} FAILED: no audio")
            continue

        sf.write(out, samples, 24000)
        kb = out.stat().st_size // 1024
        print(f"{label} {kb} KB")


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate Kokoro voice clips from manifest.json")
    parser.add_argument("--part", type=int, default=0, help="1-based part index (use with --parts)")
    parser.add_argument("--parts", type=int, default=4, help="Split clips into this many parts (default 4)")
    parser.add_argument("--finalize", action="store_true", help="Rewrite manifest.json to .wav paths only")
    args = parser.parse_args()

    all_clips, manifest = load_clips()
    voice = manifest.get("recommendedVoice", "af_heart")
    speed = float(manifest.get("recommendedSpeed", 0.92))

    if args.part:
        batch = slice_part(all_clips, args.part, args.parts)
        print(f"Part {args.part}/{args.parts}: {len(batch)} clips | voice={voice} speed={speed}")
    else:
        batch = all_clips
        print(f"Generating all {len(batch)} clips | voice={voice} speed={speed}")

    generate_clips(batch, voice, speed)

    if args.finalize or (args.part and args.part == args.parts) or not args.part:
        finalize_manifest(manifest)
        print(f"\nManifest updated. WAV files in {ROOT}")
    else:
        print(f"\nPart {args.part} done. Run part {args.part + 1} next, or --finalize when finished.")

    return 0


if __name__ == "__main__":
    sys.exit(main())
