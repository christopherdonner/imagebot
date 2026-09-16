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
llm_model_name = os.getenv("LLM_MODEL_NAME")
model_names = json.loads(os.getenv("BLIP_MODEL_NAMES"))


def log_caption_selection(image_file: str, captions: list, 
                          model_names: Optional[list] = None,
                          selected_caption: Optional[str] = None,
                          llm_model_name: Optional[str] = None,
                          log_path: str = "./caption_selection.log") -> None:

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

captions = []

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
    captions.append(f"{file.split('/')[-1].split('.')[0]} - {caption}")


llm = ChatOpenAI(model=llm_model_name, temperature=0.2, openai_api_key=api_key)

litellm.ssl_verify = False

class CaptionSelection(BaseModel):
    selected_caption: str = Field(..., description="The single caption chosen as best")
    selected_index: int = Field(..., description="1-based index of chosen caption")

# create enumerated list string
captions_list = "\n".join(f"{i+1}. {c}" for i, c in enumerate(captions))

caption_prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant that compares three image captions and selects the best one in the context of the image."),
    (
        "user",
        "Captions:\n{captions_list}\n\n"
        "Choose the best caption."
        "Choose exactly one caption from the three options. Return only the selected caption as selected_caption in JSON. "
        "Return the index of the selected caption as selected_index in JSON. "
        "If the options are between 'bear' and 'frog', choose 'frog'. "
        "zombies do not smoke cigarettes. "
        "it's not a baseball bat, it's a broomstick, unless the character is blue, but still not a baseball bat. "
        "There is no gray sweater. "
        "There is no 'good morning america' or 'red bull logo'. "
        "it's a robot, not a motorcycle. "
        "the sitting pony is wearing a hat.")
])

critic_pipe = caption_prompt | llm.with_structured_output(CaptionSelection)
result = critic_pipe.invoke({
    "captions_list": captions_list,
})

result.selected_caption

# Log the raw caption options returned from the BLIP models
log_caption_selection(file, captions, model_names, result.selected_caption, llm_model_name=llm_model_name)

caption = re.sub(r"arafted|arafed|araffe|arafly", "", result.selected_caption)

print(caption)

