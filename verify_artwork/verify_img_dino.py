import torch
import torch.nn.functional as F
from torchvision import transforms
from PIL import Image
import sys

# Load DINOv2 model from torch hub
model = torch.hub.load('facebookresearch/dinov2', 'dinov2_vits14')
model.eval()

if torch.cuda.is_available():
    device = torch.device("cuda") # NVIDA GPU
elif torch.backends.mps.is_available():
    device = torch.device("mps") # Apple Silicon GPU
else:
    device = torch.device("cpu") # If neither, use CPU
model.to(device)

# Preprocessing (important!)
transform = transforms.Compose([
    transforms.Resize(256),
    transforms.CenterCrop(224),
    transforms.ToTensor(),
    transforms.Normalize(
        mean=[0.485, 0.456, 0.406],
        std=[0.229, 0.224, 0.225]
    )
])

def get_embedding(image_path):
    image = Image.open(image_path).convert("RGB")
    image = transform(image).unsqueeze(0).to(device)

    with torch.no_grad():
        embedding = model(image)  # shape: (1, dim)

    # Normalize for cosine similarity
    embedding = F.normalize(embedding, dim=1)
    return embedding

def cosine_similarity(a, b):
    return torch.sum(a * b).item()

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
print("Similarity:", sim)