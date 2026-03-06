import requests
import json
import glob
import os

url = 'http://127.0.0.1:5000/predict-voice'
# Find a real uploaded webm file from the temp dir
webm_files = glob.glob('backend/temp/*.webm')
if not webm_files:
    print("No webm files found to test.")
    exit(1)

test_file = webm_files[-1] # take the most recent
print(f"Testing with actual file: {test_file}")

try:
    with open(test_file, 'rb') as f:
        files = {'file': ('recording.webm', f, 'audio/webm')}
        print("Sending POST request to Flask `/predict-voice`...")
        response = requests.post(url, files=files, timeout=30)
        print("Status Code:", response.status_code)
        print("Response Text:", response.text)
except requests.exceptions.RequestException as e:
    print("Network error / Connection Reset observed:", e)
except Exception as e:
    print("Exception occurred:", type(e))
    import traceback
    traceback.print_exc()
