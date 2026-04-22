import os
import csv
import requests
from PIL import Image
from io import BytesIO
import torch
import clip

# ----------------------------
# Setup
# ----------------------------
DEVICE = torch.device("cpu")

# Load model
model, preprocess = clip.load("ViT-B/32", device=DEVICE)

# Output directory
OUTPUT_DIR = "embeddings"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# ----------------------------
# Embedding function
# ----------------------------
def get_embedding_from_pil(image):
    image_input = preprocess(image).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        embedding = model.encode_image(image_input)
    return embedding / embedding.norm(dim=-1, keepdim=True)

# ----------------------------
# Download image
# ----------------------------
def download_image(url):
    response = requests.get(url, timeout=10)
    response.raise_for_status()
    return Image.open(BytesIO(response.content)).convert("RGB")

# ----------------------------
# Main processing
# ----------------------------
def process_csv(csv_path):
    with open(csv_path, newline="") as f:
        reader = csv.DictReader(f)

        for row in reader:
            object_id = row["objectid"]
            base_url = row["image_url"]

            image_url = base_url.rstrip("/") + "/full/600,/0/default.jpg"
            output_path = os.path.join(OUTPUT_DIR, f"{object_id}_emb.pt")

            # Skip if already processed
            if os.path.exists(output_path):
                print(f"Skipping {object_id}, already exists.")
                continue

            try:
                print(f"Processing {object_id}...")

                # Download image
                image = download_image(image_url)

                # Generate embedding
                embedding = get_embedding_from_pil(image)

                # Save embedding
                torch.save(embedding.cpu(), output_path)

            except Exception as e:
                print(f"Failed for {object_id}: {e}")

# ----------------------------
# Run
# ----------------------------
if __name__ == "__main__":
    process_csv("object_details_full.csv")