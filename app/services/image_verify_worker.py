from app.services.shared import image_verify_queue
from app.database import db
from app.database.db import VERIFY_STATE_ACCEPTED, VERIFY_STATE_FAILED_LOCATION, VERIFY_STATE_FAILED_IMAGE
import torch
import clip
from PIL import Image
from io import BytesIO
import requests
from pathlib import Path
import re

DEVICE = torch.device("cpu")

VERIFY_MIN_DIST_M = 200
VERIFY_MIN_SIM_SCORE = 0.5

REF_EMBEDDINGS = {}

for file in Path('embeddings').iterdir():
    if file.is_file():
        match = re.search(r"(\d+)_emb\.pt", file.name)
        if match:
            objectid = int(match.group(1))
            REF_EMBEDDINGS[objectid] = torch.load(str(file))


def load_model():
    model, preprocess = clip.load("RN50", device=DEVICE)
    model.half()
    return model, preprocess


def get_embedding(image, model, preprocess):
    image = preprocess(image).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        embedding = model.encode_image(image)
    return embedding / embedding.norm(dim=-1, keepdim=True)


def cosine_similarity(a, b):
    return (a @ b.T).item()


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
        user_id, objectid, image_url, dist_to_object = verify_job

        process_verify_job(verify_job, model, preprocess)

        socketio.emit(
            'image_processed',
            {'objectid': objectid},
            room=f"user_{user_id}"
        )
