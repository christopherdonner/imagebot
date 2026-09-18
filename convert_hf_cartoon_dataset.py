"""Export a Hugging Face image-caption dataset to local BLIP manifests."""

import argparse
import hashlib
import json
from collections import Counter
from pathlib import Path

from datasets import load_dataset
from PIL import Image
from tqdm import tqdm


def split_for_index(index: int, seed: int) -> str:
    digest = hashlib.sha256(f"{seed}:{index}".encode("utf-8")).digest()
    value = int.from_bytes(digest[:8], "big") / float(2**64)
    if value < 0.8:
        return "train"
    if value < 0.9:
        return "validation"
    return "test"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path, help="Directory for exported images and JSONL manifests")
    parser.add_argument("--dataset", default="CasperLD/cartoons_with_blip_captions_512_full")
    parser.add_argument("--cache-dir", type=Path, default=Path("E:/imagebot/hf/datasets"))
    parser.add_argument("--max-images", type=int, default=5000)
    parser.add_argument("--seed", type=int, default=42)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    if args.max_images < 1:
        raise SystemExit("--max-images must be greater than zero")

    output_root = args.output.expanduser().resolve()
    image_root = output_root / "images"
    image_root.mkdir(parents=True, exist_ok=True)
    dataset = load_dataset(args.dataset, split="train", cache_dir=str(args.cache_dir.expanduser().resolve()))
    limit = min(args.max_images, len(dataset))
    records = []
    skipped = Counter()

    for index in tqdm(range(limit), desc="Exporting cartoon dataset"):
        row = dataset[index]
        caption = str(row.get("caption", "")).strip()
        image = row.get("image")
        if not caption or image is None:
            skipped["missing_caption_or_image"] += 1
            continue
        try:
            image = image.convert("RGB")
            filename = f"{index:08d}.jpg"
            image_path = image_root / filename
            image.save(image_path, format="JPEG", quality=95)
        except Exception:
            skipped["invalid_image"] += 1
            continue

        records.append({
            "image": str(image_path.resolve()),
            "text": caption,
            "source_index": index,
            "group": f"source-{index}",
            "split": split_for_index(index, args.seed),
        })

    if not records:
        raise SystemExit("No valid image-caption records found")

    split_counts = Counter(record["split"] for record in records)
    for split in ("train", "validation", "test"):
        with (output_root / f"{split}.jsonl").open("w", encoding="utf-8") as manifest:
            for record in records:
                if record["split"] == split:
                    manifest.write(json.dumps(record, ensure_ascii=True) + "\n")

    summary = {
        "dataset": args.dataset,
        "output": str(output_root),
        "requested_images": args.max_images,
        "exported_images": len(records),
        "splits": dict(split_counts),
        "skipped": dict(skipped),
    }
    (output_root / "summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(summary, indent=2))


if __name__ == "__main__":
    main()