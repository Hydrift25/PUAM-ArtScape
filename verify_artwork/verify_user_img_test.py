import torch
import clip
from PIL import Image
import sys

if torch.cuda.is_available():
    device = torch.device("cuda") # NVIDA GPU
elif torch.backends.mps.is_available():
    device = torch.device("mps") # Apple Silicon GPU
else:
    device = torch.device("cpu") # If neither, use CPU

# Load pre-trained model
model, preprocess = clip.load("ViT-B/32", device=device)

# Generate image embedding from image file
def get_embedding(image_path):
    image = preprocess(Image.open(image_path)).unsqueeze(0).to(device)
    with torch.no_grad():
        embedding = model.encode_image(image)
    return embedding / embedding.norm(dim=-1, keepdim=True)

# Simple cosine similarity of two image embeddings
def cosine_similarity(a, b):
    return (a @ b.T).item()

# Compare the reference and user uploaded images using cosine similarity
try:
    ref = get_embedding(sys.argv[1])
except FileNotFoundError:
    print(f"The specified ref image file {sys.argv[1]} was not found.")
    sys.exit()
except Exception as e:
    print(f"An unexpected error occurred for ref image: {e}")
    sys.exit()

try:
    user = get_embedding(sys.argv[2])
except FileNotFoundError:
    print(f"The specified user image file {sys.argv[2]} was not found.")
    sys.exit()
except Exception as e:
    print(f"An unexpected error occurred for user image: {e}")
    sys.exit()


sim = cosine_similarity(ref, user)

print(f"Reference image filepath: {sys.argv[1]}")
print(f"User uploaded image filepath: {sys.argv[2]}")
print(f"Similarity: {sim}")