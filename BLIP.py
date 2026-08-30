from langgraph.graph import StateGraph, END, START
from langgraph.types import Send
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from transformers import BlipProcessor, BlipForConditionalGeneration
from typing import TypedDict, Annotated, List, Literal, Optional
from pydantic import BaseModel, Field
from IPython.display import display
import operator
from pprint import pprint
from PIL import Image
import litellm
import sys
import re
import os
from dotenv import load_dotenv
import json
from datetime import datetime

load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise ValueError("OPENAI_API_KEY is not set. Add it to .env or environment variables.")


def log_caption_selection(image_file: str, captions: list, 
                          model_names: Optional[list] = None,
                          selected_caption: Optional[str] = None,
                          llm_model_name: Optional[str] = None,
                          log_path: str = "./caption_selection.log") -> None:
    """Append a JSON line recording the caption options and (optionally) the LLM selection.

    Fields:
    - timestamp: ISO UTC
    - image_file: path string
    - captions: list of caption strings (as returned by BLIP models)
    - model_names: list of model names corresponding to captions (may be None)
    - selected_caption: the caption text chosen by the LLM, or None
    """
    if not captions:
        return
    entry = {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "image_file": image_file,
        "selected_caption": selected_caption,
        "captions": captions,
        "model_names": model_names,
        "llm_model_name": llm_model_name
    }
    try:
        with open(log_path, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except Exception as e:
        sys.stderr.write(f"Failed to write caption log: {e}\n")

llm_model_name = "gpt-5.6-sol"
captions = []
# model_names = ["Salesforce/blip-image-captioning-large"]
model_names = ["zhao-liying/blip-image-captioning-base", "Huiaaa/flickr30k-blip-caption", "trannytrashneedsurcocknherass/blip-image-captioning-base", "Salesforce/blip-image-captioning-base", "Salesforce/blip-image-captioning-large"]

for model_name in model_names:
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
    captions.append(caption)


llm = ChatOpenAI(model="gpt-5.6-luna", temperature=0.7, openai_api_key=api_key)

litellm.ssl_verify = False

class CaptionSelection(BaseModel):
    selected_caption: str = Field(..., description="The single caption chosen as best")
    selected_index: int = Field(..., description="1-based index of chosen caption")

# create enumerated list string
captions_list = "\n".join(f"{i+1}. {c}" for i, c in enumerate(captions))

caption_prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant that compares three image captions and selects the best one in the context of the image, or generates a new caption."),
    (
        "user",
        "Image file: {image_file}\n\n"
        "Captions:\n{captions_list}\n\n"
        "Image: {image}\n\n"
        "Choose the most appropriate caption for the image {image}. "
        "Choose exactly one caption from the three options. Return only the selected caption as selected_caption in JSON. "
        "Using a combination of the available captions and the image itself, create a single caption that is more appropriate for the image. "
        "Return the index of the selected caption as selected_index in JSON. ")
])

critic_pipe = caption_prompt | llm.with_structured_output(CaptionSelection)
result = critic_pipe.invoke({
    "captions_list": captions_list,
    "image_file": file,
    "image": Image.open(file)
})

result.selected_caption

# Log the raw caption options returned from the BLIP models
log_caption_selection(file, captions, model_names, result.selected_caption, llm_model_name=llm_model_name)

caption = re.sub(r"arafted|arafed|araffe", "", result.selected_caption)

print(caption)

