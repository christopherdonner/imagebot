"""Fine-tune BLIP image captioning with a small LoRA adapter."""

import argparse
import json
from pathlib import Path

import torch
from PIL import Image
from peft import LoraConfig, get_peft_model
from torch.utils.data import Dataset
from tqdm import tqdm
from transformers import (
    BlipForConditionalGeneration,
    BlipProcessor,
    Trainer,
    TrainingArguments,
)


class CaptionDataset(Dataset):
    def __init__(self, manifest: Path, processor: BlipProcessor, max_length: int) -> None:
        lines = manifest.read_text(encoding="utf-8").splitlines()
        self.records = [
            json.loads(line)
            for line in tqdm(lines, desc=f"Loading {manifest.name}")
            if line.strip()
        ]
        self.processor = processor
        self.max_length = max_length

    def __len__(self) -> int:
        return len(self.records)

    def __getitem__(self, index: int) -> dict:
        record = self.records[index]
        with Image.open(record["image"]) as image:
            image = image.convert("RGB")
            inputs = self.processor(
                images=image,
                text=record["text"],
                padding="max_length",
                truncation=True,
                max_length=self.max_length,
                return_tensors="pt",
            )
        item = {key: value.squeeze(0) for key, value in inputs.items()}
        item["labels"] = item["input_ids"].clone()
        item["labels"][item["attention_mask"] == 0] = -100
        return item


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("manifest_dir", type=Path, help="Directory containing train.jsonl and validation.jsonl")
    parser.add_argument("output_dir", type=Path)
    parser.add_argument("--model", default="Salesforce/blip-image-captioning-base")
    parser.add_argument("--epochs", type=float, default=3)
    parser.add_argument("--batch-size", type=int, default=1)
    parser.add_argument("--gradient-accumulation", type=int, default=16)
    parser.add_argument("--learning-rate", type=float, default=1e-4)
    parser.add_argument("--max-length", type=int, default=64)
    parser.add_argument("--max-steps", type=int, default=-1)
    return parser.parse_args()


def main() -> None:
    args = parse_args()
    manifest_dir = args.manifest_dir.expanduser().resolve()
    output_dir = args.output_dir.expanduser().resolve()
    train_manifest = manifest_dir / "train.jsonl"
    validation_manifest = manifest_dir / "validation.jsonl"
    if not train_manifest.is_file() or not validation_manifest.is_file():
        raise SystemExit(f"Expected train.jsonl and validation.jsonl in {manifest_dir}")

    processor = BlipProcessor.from_pretrained(args.model)
    model = BlipForConditionalGeneration.from_pretrained(args.model)
    lora_config = LoraConfig(
        r=8,
        lora_alpha=16,
        lora_dropout=0.05,
        target_modules=["query", "key", "value"],
        bias="none",
    )
    model = get_peft_model(model, lora_config)
    model.print_trainable_parameters()

    train_dataset = CaptionDataset(train_manifest, processor, args.max_length)
    validation_dataset = CaptionDataset(validation_manifest, processor, args.max_length)
    use_bf16 = torch.cuda.is_available() and torch.cuda.is_bf16_supported()
    training_args = TrainingArguments(
        output_dir=str(output_dir),
        num_train_epochs=args.epochs,
        max_steps=args.max_steps,
        per_device_train_batch_size=args.batch_size,
        per_device_eval_batch_size=args.batch_size,
        gradient_accumulation_steps=args.gradient_accumulation,
        learning_rate=args.learning_rate,
        logging_steps=10,
        eval_strategy="epoch",
        save_strategy="epoch",
        save_total_limit=2,
        load_best_model_at_end=True,
        metric_for_best_model="eval_loss",
        greater_is_better=False,
        fp16=torch.cuda.is_available() and not use_bf16,
        bf16=use_bf16,
        remove_unused_columns=False,
        dataloader_pin_memory=torch.cuda.is_available(),
        disable_tqdm=False,
        report_to="none",
    )
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=validation_dataset,
    )
    trainer.train()
    trainer.save_model(str(output_dir))
    processor.save_pretrained(str(output_dir))
    print(f"Saved BLIP LoRA adapter to {output_dir}")


if __name__ == "__main__":
    main()