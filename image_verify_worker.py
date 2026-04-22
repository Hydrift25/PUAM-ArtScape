from shared import image_verify_queue
import os
import torch
import clip
from PIL import Image
from io import BytesIO
import requests
from app.database import db
import time
from flask_socketio import SocketIO
from pathlib import Path
import re

print("QUEUE ID (Worker):", id(image_verify_queue))

DEVICE = torch.device("cpu")

IMG_ACCEPTED = 1
IMG_FAILED_LOCATION = 2
IMG_FAILED_IMAGE = 3

VERIFY_MIN_DIST_M = 200
VERIFY_MIN_SIM_SCORE = 0.5

REF_EMBEDDINGS = {}

# Load all reference embeddings into memory
for file in Path('embeddings').iterdir():
    if file.is_file():
        match = re.search(r"(\d+)_emb\.pt", file.name)
        if match:
            object_id = int(match.group(1))
            REF_EMBEDDINGS[object_id] = torch.load(str(file))

def load_model():
    model, preprocess = clip.load("RN50", device=DEVICE)
    model.half()
    return model, preprocess

# Generate image embedding from image
def get_embedding(image, model, preprocess):
    image = preprocess(image).unsqueeze(0).to(DEVICE)
    with torch.no_grad():
        embedding = model.encode_image(image)
    return embedding / embedding.norm(dim=-1, keepdim=True)

# Simple cosine similarity of two image embeddings
def cosine_similarity(a, b):
    return (a @ b.T).item()

def process_verify_job(verify_job, model, preprocess):
    user_id, objectid, image_url, dist_to_object = verify_job

    if dist_to_object <= VERIFY_MIN_DIST_M:
        response = requests.get(image_url)
        user_image = Image.open(BytesIO(response.content))
        user_embedding = get_embedding(user_image, model, preprocess)

        if object_id in REF_EMBEDDINGS:
            sim_score = cosine_similarity(REF_EMBEDDINGS[object_id], user_embedding)

            if sim_score > VERIFY_MIN_SIM_SCORE:
                print(f"HOORAY: {verify_job[0]} {verify_job[1]} {verify_job[2]} {dist_to_object} OK IMG, sim score={sim_score}!!")
                db.update_verify_state(user_id, objectid, IMG_ACCEPTED)
            else:
                print(f"NOOOO IMG: {verify_job[0]} {verify_job[1]} {verify_job[2]} {dist_to_object} BAD IMG, sim score={sim_score}")
                db.update_verify_state(user_id, objectid, IMG_FAILED_IMAGE)
        else:
            print(f"NOOOO OBJECT ID NOT FOUND: {verify_job[0]} {verify_job[1]} {verify_job[2]} {dist_to_object}")
    else:
        print(f"NOOOO LOC: {verify_job[0]} {verify_job[1]} {verify_job[2]} {dist_to_object} TOO FAR")
        db.update_verify_state(user_id, objectid, IMG_FAILED_LOCATION)


def worker_loop(socketio):
    model, preprocess = load_model()

    while True:
        verify_job = image_verify_queue.get() # user_id, objectid, photo_url
        print(f"Got verify job: {verify_job[0]} {verify_job[1]} {verify_job[2]} {verify_job[3]}")

        process_verify_job(verify_job, model, preprocess)

        user_id, objectid, _, _ = verify_job

        socketio.emit(
            'image_processed',
            {'objectid': objectid},
            room=f"user_{user_id}"
        )