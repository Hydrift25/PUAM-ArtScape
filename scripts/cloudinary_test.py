from dotenv import load_dotenv
load_dotenv()

import cloudinary
import cloudinary.uploader

import os
print(os.getenv("CLOUDINARY_URL"))

response = cloudinary.uploader.upload("ref_tigers.jpg")

print(response)
print(response["secure_url"])
