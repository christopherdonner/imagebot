from transformers import BlipProcessor, BlipForConditionalGeneration
from PIL import Image
import sys

model_name = "Salesforce/blip-image-captioning-large"
# Initialize the processor and model from Hugging Face
processor = BlipProcessor.from_pretrained(model_name)
model = BlipForConditionalGeneration.from_pretrained(model_name)
file = sys.argv[1]
# Load an image
image = Image.open(file)
# Prepare the image
inputs = processor(image, return_tensors="pt")
# Generate captions
outputs = model.generate(**inputs)
caption = processor.decode(outputs[0],skip_special_tokens=True)
 
print(caption)