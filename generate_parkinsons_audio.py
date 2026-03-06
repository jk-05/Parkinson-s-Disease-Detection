"""
Generate a realistic Parkinson's-like voice WAV file.
Parkinson's voice characteristics:
  - Pitch tremor (4-7 Hz modulation of fundamental frequency)
  - High jitter (cycle-to-cycle pitch perturbation)
  - High shimmer (cycle-to-cycle amplitude perturbation)
  - Breathy/hoarse quality (added noise)
  - Irregular pauses mid-speech
"""
import numpy as np
import soundfile as sf

sr = 22050
duration = 6.0  # seconds
t = np.linspace(0, duration, int(sr * duration), endpoint=False)

# --- Base pitch with Parkinson's tremor ---
# Normal pitch ~120 Hz, but with 5 Hz tremor modulation (±15 Hz)
base_f0 = 120.0
tremor_freq = 5.0  # Hz (typical Parkinson's tremor frequency)
tremor_depth = 15.0  # Hz deviation
f0 = base_f0 + tremor_depth * np.sin(2 * np.pi * tremor_freq * t)

# --- Add jitter (random pitch perturbation) ---
# Parkinson's jitter is ~2-5% of pitch period
jitter_amount = 0.04  # 4% jitter
jitter_noise = 1.0 + jitter_amount * np.random.randn(len(t))
f0 = f0 * jitter_noise

# --- Generate the voice signal ---
# Integrate frequency to get phase
phase = 2 * np.pi * np.cumsum(f0) / sr
voice = np.sin(phase)

# Add harmonics for more realistic voice
voice += 0.5 * np.sin(2 * phase)  # 2nd harmonic
voice += 0.25 * np.sin(3 * phase)  # 3rd harmonic
voice += 0.1 * np.sin(4 * phase)   # 4th harmonic

# --- Add shimmer (amplitude perturbation) ---
# Parkinson's shimmer is ~5-10%
shimmer_amount = 0.08
# Create slow amplitude modulation
amp_envelope = 1.0 + shimmer_amount * np.random.randn(len(t))
# Smooth the amplitude envelope slightly
from scipy.ndimage import uniform_filter1d
amp_envelope = uniform_filter1d(amp_envelope, size=100)
voice = voice * amp_envelope

# --- Add breathiness (aspiration noise) ---
# Parkinson's voices often have increased breathiness
breathiness = 0.15
noise = breathiness * np.random.randn(len(t))
voice = voice + noise

# --- Add irregular pauses (speech breaks) ---
# Parkinson's patients often have involuntary pauses
pause_positions = [1.2, 2.8, 4.3]  # seconds where pauses occur
pause_durations = [0.3, 0.4, 0.25]  # duration of each pause

for pos, dur in zip(pause_positions, pause_durations):
    start_idx = int(pos * sr)
    end_idx = int((pos + dur) * sr)
    if end_idx < len(voice):
        # Fade out and in around the pause
        fade_len = int(0.02 * sr)  # 20ms fade
        if start_idx + fade_len < end_idx:
            voice[start_idx:start_idx + fade_len] *= np.linspace(1, 0, fade_len)
            voice[start_idx + fade_len:end_idx - fade_len] = 0.01 * np.random.randn(end_idx - fade_len - start_idx - fade_len)
            voice[end_idx - fade_len:end_idx] *= np.linspace(0, 1, fade_len)

# --- Normalize ---
voice = voice / np.max(np.abs(voice)) * 0.8

# --- Save ---
output_path = "backend/temp/realistic_parkinsons_voice.wav"
sf.write(output_path, voice, sr)
print(f"Saved to {output_path}")
print(f"Duration: {duration}s, Sample rate: {sr}")

# Quick verification
print("\nVerifying with voice_analysis...")
import sys
sys.path.insert(0, 'backend')
from voice_analysis import analyze_voice
res = analyze_voice(output_path)
print(f"\nVoice Score: {res['voice_score']:.4f}")
print(f"Result: {'Parkinson Detected' if res['voice_score'] >= 0.5 else 'Healthy'}")
for k, v in res['metrics'].items():
    print(f"  {k}: {v:.4f}")
