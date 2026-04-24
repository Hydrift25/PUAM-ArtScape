import torch
import torch.nn.functional as F
from PIL import Image
from torchvision import transforms

DEVICE = "cpu"
DTYPE = torch.float16

model = torch.hub.load("facebookresearch/dinov2", "dinov2_vits14")
model.eval()

model = model.to(DEVICE).to(DTYPE)

torch.set_grad_enabled(False)

transform = transforms.Compose(
    [
        transforms.Resize(256),
        transforms.CenterCrop(224),
        transforms.ToTensor(),
        transforms.Normalize(
            mean=(0.485, 0.456, 0.406),
            std=(0.229, 0.224, 0.225),
        ),
    ]
)


def embed_image(path):
    img = Image.open(path).convert("RGB")
    x = transform(img).unsqueeze(0).to(DEVICE).to(DTYPE)

    with torch.no_grad():
        feat = model(x)  # shape: [1, dim]

    # normalize for cosine similarity
    feat = F.normalize(feat, dim=-1)
    return feat


emb1 = embed_image("ref.jpg")
emb2 = embed_image("query.jpg")

similarity = F.cosine_similarity(emb1, emb2).item()
print("cosine similarity:", similarity)
