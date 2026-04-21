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

print("QUEUE ID (Worker):", id(image_verify_queue))

IMG_ACCEPTED = 1
IMG_FAILED_LOCATION = 2
IMG_FAILED_IMAGE = 3

VERIFY_MIN_DIST_M = 200

SCRIPT_DIR = os.path.dirname(__file__)

DEVICE = torch.device("cpu")
# oval with points ref image, for now

rel_ref_path = "ref.pt"
abs_ref_path = os.path.join(SCRIPT_DIR, rel_ref_path)

REF_EMBEDDING = torch.load(abs_ref_path)

def load_model():
    model, preprocess = clip.load("ViT-B/32", device=DEVICE)
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

    if dist_to_object > VERIFY_MIN_DIST_M:
        print(f"NOOOO LOC: {verify_job[0]} {verify_job[1]} {verify_job[2]} TOO FAR", flush=True)
        db.update_verify_state(user_id, objectid, IMG_FAILED_LOCATION)
    else:
        response = requests.get(image_url)
        user_image = Image.open(BytesIO(response.content))
        user_embedding = get_embedding(user_image, model, preprocess)

        # only works for oval with points!!
        sim_score = cosine_similarity(REF_EMBEDDING, user_embedding)

        if sim_score > 0.5:
            print(f"HOORAY: {verify_job[0]} {verify_job[1]} {verify_job[2]} OK IMG!!", flush=True)
            db.update_verify_state(user_id, objectid, IMG_ACCEPTED)
        else:
            print(f"NOOOO IMG: {verify_job[0]} {verify_job[1]} {verify_job[2]} BAD IMG", flush=True)
            db.update_verify_state(user_id, objectid, IMG_FAILED_IMAGE)

def worker_loop(socketio):
    model, preprocess = load_model()

    while True:
        print(f"Hello {id(image_verify_queue)}")
        verify_job = image_verify_queue.get() # user_id, objectid, photo_url
        print(f"Got verify job: {verify_job[0]} {verify_job[1]} {verify_job[2]} {verify_job[3]}", flush=True)

        process_verify_job(verify_job, model, preprocess)

        user_id, objectid, _, _ = verify_job

        socketio.emit(
            'image_processed',
            {'objectid': objectid},
            room=f"user_{user_id}"
        )