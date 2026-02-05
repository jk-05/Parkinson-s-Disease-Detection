import librosa
import soundfile as sf
import os

# Update this to the file we know exists
# voice_1770312159.672486_test_audio.wav
test_file = os.path.join("backend", "temp", "voice_1770312159.672486_test_audio.wav")
out_file = "debug_output.wav"

print(f"Testing conversion of {test_file}")

try:
    if not os.path.exists(test_file):
        print("File not found!")
        exit(1)

    print("Loading with librosa...")
    y, sr = librosa.load(test_file, sr=22050)
    print(f"Loaded! shape={y.shape}, sr={sr}")

    print("Writing with soundfile...")
    sf.write(out_file, y, sr)
    print("Success!")

except Exception as e:
    print(f"ERROR: {e}")
    import traceback
    traceback.print_exc()
