# imagebot
art gallery/css sandbox

create a subfolder of /public/ named /img/ and populate it with png or jpg files, server will build and serve webpage of those images.

sub-folers of /img/ will generate elements in the header using the folder names with routes to pages populated with the contents of said folder.

takes a directory listing of /public/img, creates thumbnail files, and uses the resulting array of filenames to build a web page of img tags pointing to the files in the /public/img directory.
On hover, the SRC property for the IMG tag is set to the original, high quality image. Each image is passed to a variety of local BLIP transformers, after which, a sub-agent evaluates the captions against the image and selects the best one. 

Instructions:
Clone repo
Browse to root. Run: npm install
cd public
mkdir img
Place images in the ./public/img/ directory
Run: npm start
browse to: localhost on the port specified 

Environment Variables:
- `VISITORS_LOG` — filename for visitor log output (default: `visitors.log`)
- `SKIP_IPS` — comma-separated list of IP addresses to exclude from visitor logging

Create a local `.env` file from `.env.example` before starting the server.

## BLIP cartoon caption training

The training tools are separate from `BLIP.py`, which remains the site's inference entry point.

Create a local manifest from a labeled dataset whose subfolders are character names:

```powershell
py prepare_cartoon_dataset.py C:\path\to\characters data\simpsons --show "The Simpsons" --max-per-character 500
```

Run a LoRA pilot with `Salesforce/blip-image-captioning-base`:

```powershell
py train_blip_lora.py data\simpsons models\simpsons-blip-lora --epochs 3
```

For the Hugging Face cartoon dataset, export a capped local copy first:

```powershell
py convert_hf_cartoon_dataset.py E:\imagebot\data\cartoons --max-images 5000
py train_blip_lora.py E:\imagebot\data\cartoons E:\imagebot\models\cartoons-blip-lora --max-steps 20
```

The manifest stores absolute local image paths and generates captions from the folder labels. Keep the source frames and adapter private unless you have permission to redistribute them. The Simpsons pilot dataset is derived from copyrighted TV episodes; its dataset license does not grant the underlying show rights.
