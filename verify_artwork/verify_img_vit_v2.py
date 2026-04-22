import torch
from transformers import CLIPProcessor, CLIPModel
from PIL import Image
import os
import numpy as np

# 1. Load the model and processor
model = CLIPModel.from_pretrained("openai/clip-vit-base-patch32")
processor = CLIPProcessor.from_pretrained("openai/clip-vit-base-patch32")

def get_image_embedding(image_path):
    """Generates an embedding for an image."""
    image = Image.open(image_path)
    inputs = processor(images=image, return_tensors="pt", padding=True)
    with torch.no_grad():
        image_features = model.get_image_features(**inputs)
    # Normalize the embedding
    return image_features / image_features.norm(dim=-1, keepdim=True)

# 2. Precompute reference embeddings
reference_dir = "path/to/reference_statue_images"
reference_embeddings = []
for filename in os.listdir(reference_dir):
    if filename.endswith((".jpg", ".png", ".jpeg")):
        ref_path = os.path.join(reference_dir, filename)
        reference_embeddings.append(get_image_embedding(ref_path))

# 3. Process User Uploaded Image
user_image_path = "path/to/user_uploaded_image.jpg"
user_embedding = get_image_embedding(user_image_path)

# 4. Calculate Similarity
highest_similarity = 0
for ref_embed in reference_embeddings:
    similarity = torch.matmul(user_embedding, ref_embed.T).item()
    if similarity > highest_similarity:
        highest_similarity = similarity

# 5. Threshold Verification
threshold = 0.85 # Adjust based on testing
if highest_similarity > threshold:
    print(f"Statue Verified! (Score: {highest_similarity:.2f})")
else:
    print(f"Statue Not Recognized. (Highest Score: {highest_similarity:.2f})")
