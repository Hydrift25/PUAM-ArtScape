import torch
import clip
from PIL import Image
import sys
import os
import numpy as np

script_dir = os.path.dirname(__file__)
rel_model_path = "ViT-B-32.pt"
abs_model_path = os.path.join(script_dir, rel_model_path)

device = torch.device("cpu")

model, preprocess = clip.load(abs_model_path, device=device)


def get_embedding(image_path):
    image = preprocess(Image.open(image_path)).unsqueeze(0).to(device)
    with torch.no_grad():
        embedding = model.encode_image(image)
    return embedding / embedding.norm(dim=-1, keepdim=True)


def cosine_similarity(a, b):
    return (a @ b.T).item()


ref = torch.load("ref.pt")
user = torch.load("user.pt")

sim = cosine_similarity(ref, user)

print(f"Reference image filepath: {sys.argv[1]}")
print(f"User uploaded image filepath: {sys.argv[2]}")
print(f"Similarity: {sim}")
