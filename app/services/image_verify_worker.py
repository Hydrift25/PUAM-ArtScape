from app.services.shared import image_verify_queue
from app.database import db
from app.database.db import (
    VERIFY_STATE_ACCEPTED,
    VERIFY_STATE_FAILED_LOCATION,
    VERIFY_STATE_FAILED_IMAGE,
)
import torch
from PIL import Image
from io import BytesIO
import requests
from pathlib import Path
import re
from dotenv import load_dotenv
import os
from torchvision import transforms
import torch.nn.functional as F

load_dotenv()

DEVICE = torch.device("cpu")
DTYPE = torch.float16

VERIFY_MIN_DIST_M = os.getenv("VERIFY_MIN_DIST_M", 1000)
VERIFY_MIN_SIM_SCORE = os.getenv("VERIFY_MIN_SIM_SCORE", 0.5)

REF_EMBEDDINGS = {}


for file in Path("embeddings").iterdir():
    if file.is_file():
        match = re.search(r"(\d+)_emb\.pt", file.name)
        if match:
            objectid = int(match.group(1))
            REF_EMBEDDINGS[objectid] = torch.load(str(file))


def load_model():
    model = torch.hub.load("facebookresearch/dinov2", "dinov2_vits14")
    model.eval()
    model = model.to(DEVICE).to(DTYPE)
    torch.set_grad_enabled(False)

    preprocess = transforms.Compose(
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

    return model, preprocess


def get_embedding(image, model, preprocess):
    image = preprocess(image).unsqueeze(0).to(DEVICE).to(DTYPE)
    with torch.no_grad():
        embedding = model(image)
    return F.normalize(embedding, dim=-1)


def cosine_similarity(emb1, emb2):
    return F.cosine_similarity(emb1, emb2).item()


def process_verify_job(verify_job, model, preprocess):
    user_id, objectid, image_url, dist_to_object = verify_job

    if dist_to_object <= VERIFY_MIN_DIST_M:
        response = requests.get(image_url)
        user_image = Image.open(BytesIO(response.content))
        user_embedding = get_embedding(user_image, model, preprocess)

        if objectid in REF_EMBEDDINGS:
            sim_score = cosine_similarity(REF_EMBEDDINGS[objectid], user_embedding)
            if sim_score > VERIFY_MIN_SIM_SCORE:
                db.update_verify_state(user_id, objectid, VERIFY_STATE_ACCEPTED)
            else:
                db.update_verify_state(user_id, objectid, VERIFY_STATE_FAILED_IMAGE)
        else:
            # No embedding on file — can't verify; treat as failed image match
            db.update_verify_state(user_id, objectid, VERIFY_STATE_FAILED_IMAGE)
    else:
        db.update_verify_state(user_id, objectid, VERIFY_STATE_FAILED_LOCATION)


def worker_loop(socketio):
    model, preprocess = load_model()

    while True:
        verify_job = image_verify_queue.get()
        user_id, objectid, _, _ = verify_job

        process_verify_job(verify_job, model, preprocess)

        socketio.emit("image_processed", {"objectid": objectid}, room=f"user_{user_id}")
