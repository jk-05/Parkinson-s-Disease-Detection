import requests
import os
import time

# Create a dummy WAV file to upload (valid header is enough for some, but let's make a tiny silent wav)
import wave
import struct

def create_dummy_wav(filename):
    with wave.open(filename, 'w') as f:
        f.setnchannels(1)
        f.setsampwidth(2)
        f.setframerate(44100)
        f.writeframes(b'\x00\x00' * 1000) # Silence
    return filename

dummy_file = "test_audio.wav"
create_dummy_wav(dummy_file)

url = "http://localhost:5000/predict-voice"

try:
    with open(dummy_file, 'rb') as f:
        files = {'file': (dummy_file, f, 'audio/wav')}
        response = requests.post(url, files=files)

    print(f"Status Code: {response.status_code}")
    print(f"Response: {response.json()}")

    # Check if a new file was created in backend/temp
    temp_dir = os.path.join("backend", "temp")
    if os.path.exists(temp_dir):
        files = sorted(os.listdir(temp_dir))
        print(f"Files in {temp_dir}:")
        for file in files:
            print(f" - {file}")
            
        # We expect a .wav file with a recent timestamp
        wav_files = [f for f in files if f.endswith('.wav') and 'voice_' in f]
        if wav_files:
            print("SUCCESS: WAV file found.")
        else:
            print("FAILURE: No WAV file found.")
    else:
        print("FAILURE: Temp directory not found.")

except Exception as e:
    print(f"Error: {e}")
finally:
    if os.path.exists(dummy_file):
        os.remove(dummy_file)
