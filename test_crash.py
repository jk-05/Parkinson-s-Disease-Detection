import os
import sys

# Test basic imports first to catch immediate segfaults
print("Importing numpy...")
import numpy as np
print("NumPy version:", np.__version__)

print("Importing numba...")
import numba
print("Numba version:", numba.__version__)

print("Importing librosa...")
import librosa
print("Librosa version:", librosa.__version__)

print("Testing voice analysis function...")
from voice_analysis import analyze_voice

try:
    print("Creating dummy wav file for analysis...")
    with open('dummy_audio2.wav', 'wb') as f:
        # A minimal but valid 44-byte WAV header + small data block
        # to ensure librosa tries to read it.
        f.write(b'RIFF$\x00\x00\x00WAVEfmt \x10\x00\x00\x00\x01\x00\x01\x00D\xac\x00\x00\x88X\x01\x00\x02\x00\x10\x00data\x00\x00\x00\x00')
    
    # Try calling the function
    print("Calling analyze_voice()...")
    res = analyze_voice('dummy_audio2.wav')
    print("Result:", res)
    print("SUCCESS")
except Exception as e:
    print("Caught Exception:", type(e))
    import traceback
    traceback.print_exc()
