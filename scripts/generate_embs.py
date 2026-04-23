import os
import csv
import requests
from PIL import Image
from io import BytesIO
import torch
import clip

DEVICE = torch.device("cpu")

model, preprocess = clip.load("RN50", device=DEVICE)

model.half()

OUTPUT_DIR = "embeddings"
os.makedirs(OUTPUT_DIR, exist_ok=True)


def get_embedding_from_pil(image):
    image_input = preprocess(image).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        embedding = model.encode_image(image_input)
    return embedding / embedding.norm(dim=-1, keepdim=True)


def download_image(url):
    response = requests.get(url, timeout=10)
    response.raise_for_status()
    return Image.open(BytesIO(response.content)).convert("RGB")


def process_csv(csv_path):
    with open(csv_path, newline="") as f:
        reader = csv.DictReader(f)

        for row in reader:
            object_id = row["objectid"]
            base_url = row["image_url"]

            image_url = base_url.rstrip("/") + "/full/600,/0/default.jpg"
            output_path = os.path.join(OUTPUT_DIR, f"{object_id}_emb.pt")

            if os.path.exists(output_path):
                print(f"Skipping {object_id}, already exists.")
                continue

            try:
                print(f"Processing {object_id}...")
                image = download_image(image_url)
                embedding = get_embedding_from_pil(image)
                torch.save(embedding.cpu(), output_path)
            except Exception as e:
                print(f"Failed for {object_id}: {e}")


if __name__ == "__main__":
    process_csv("object_details_full.csv")
