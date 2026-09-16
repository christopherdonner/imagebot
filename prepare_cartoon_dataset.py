"""Create BLIP image-caption manifests from labeled character folders."""

import argparse
import hashlib
import json
import random
import re
from collections import Counter
from pathlib import Path

from PIL import Image
from tqdm import tqdm


IMAGE_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


def humanize_label(label: str) -> str:
    label = re.sub(r"[_-]+", " ", label).strip()
    return re.sub(r"\s+", " ", label).title()


def stable_group(path: Path, source_root: Path) -> str:
    relative = path.relative_to(source_root).as_posix()
    parts = relative.split("/")
    if len(parts) > 2:
        return "/".join(parts[:-1])
    stem = path.stem
    match = re.match(r"(.+?)(?:[_-](?:\d+|\d{4,}))$", stem)
    return match.group(1) if match else stem


def split_for_group(group: str, seed: int) -> str:
    digest = hashlib.sha256(f"{seed}:{group}".encode("utf-8")).digest()
    value = int.from_bytes(digest[:8], "big") / float(2**64)
    if value < 0.8:
        return "train"
    if value < 0.9:
        return "validation"
    return "test"


def build_record(path: Path, source_root: Path, show_name: str, seed: int) -> dict:
    character_name = humanize_label(path.parent.name)
    group = stable_group(path, source_root)
    return {
        "image": str(path.resolve()),
        "text": f"A frame from {show_name} showing {character_name}.",
        "show": show_name,
        "character": character_name,
        "group": group,
        "split": split_for_group(group, seed),
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("source", type=Path, help="Labeled folder containing one folder per character")
    parser.add_argument("output", type=Path, help="Directory for JSONL manifests")
    parser.add_argument("--show", required=True, help="Show name used in every caption")
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--max-per-character", type=int, default=0)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    source_root = args.source.expanduser().resolve()
    output_root = args.output.expanduser().resolve()
    if not source_root.is_dir():
        raise SystemExit(f"Source directory does not exist: {source_root}")

    records = []
    skipped = Counter()
    per_character = Counter()
    paths = sorted(
        path for path in source_root.rglob("*")
        if path.is_file() and path.suffix.lower() in IMAGE_SUFFIXES
    )
    random.Random(args.seed).shuffle(paths)

    for path in tqdm(paths, desc="Validating images"):
        character = path.parent.name
        if args.max_per_character and per_character[character] >= args.max_per_character:
            skipped["max_per_character"] += 1
            continue
        try:
            with Image.open(path) as image:
                image.verify()
        except Exception:
            skipped["invalid_image"] += 1
            continue
        records.append(build_record(path, source_root, args.show, args.seed))
        per_character[character] += 1

    if not records:
        raise SystemExit("No valid images found")

    output_root.mkdir(parents=True, exist_ok=True)
    split_counts = Counter(record["split"] for record in records)
    for split in ("train", "validation", "test"):
        with (output_root / f"{split}.jsonl").open("w", encoding="utf-8") as manifest:
            for record in records:
                if record["split"] == split:
                    manifest.write(json.dumps(record, ensure_ascii=True) + "\n")

    summary = {
        "source": str(source_root),
        "show": args.show,
        "records": len(records),
        "splits": dict(split_counts),
        "characters": dict(sorted(Counter(record["character"] for record in records).items())),
        "skipped": dict(skipped),
    }
    (output_root / "summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()