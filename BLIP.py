from langgraph.graph import StateGraph, END, START
from langgraph.types import Send
from langchain_openai import ChatOpenAI
from langchain_core.prompts import ChatPromptTemplate
from transformers import BlipProcessor, BlipForConditionalGeneration
from typing import TypedDict, Annotated, List, Literal
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

load_dotenv()
api_key = os.getenv("OPENAI_API_KEY")
if not api_key:
    raise ValueError("OPENAI_API_KEY is not set. Add it to .env or environment variables.")

captions = []
model_names = ["Salesforce/blip-image-captioning-base", "Salesforce/blip-image-captioning-large"]

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

llm = ChatOpenAI(model="gpt-4.1-nano", temperature=0.7, openai_api_key=api_key)

litellm.ssl_verify = False

class CaptionSelection(BaseModel):
    selected_caption: str = Field(..., description="The single caption chosen as best")

caption_prompt = ChatPromptTemplate.from_messages([
    ("system", "You are a helpful assistant that compares two image captions and selects the best one in the context of the image."),
    (
        "user",
        "Image file: {image_file}\n"
        "Caption A: {caption_a}\n"
        "Caption B: {caption_b}\n"
        "Choose the more appropriate caption for the image. "
        "Choose exactly one caption from the two options. Return only the selected caption as selected_caption in JSON. "
        "Do not alter, combine, or paraphrase the caption text. Base your decision on which caption is more appropriate for the image. Do not prefix with 'Caption A' or 'Caption B'. Return only the caption text."
    )
])

critic_pipe = caption_prompt | llm.with_structured_output(CaptionSelection)
result = critic_pipe.invoke({
    "image_file": file,
    "caption_a": captions[0],
    "caption_b": captions[1]
})

result.selected_caption

caption = re.sub(r"arafted|arafed|araffe", "crafted", result.selected_caption)

print(caption)

