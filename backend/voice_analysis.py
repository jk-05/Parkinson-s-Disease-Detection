import librosa
import numpy as np


def analyze_voice(file_path):

    print("Processing file:", file_path)

    # ---------------- LOAD AUDIO ----------------
    y, sr = librosa.load(file_path, sr=None)

    print("Audio length (seconds):", len(y) / sr)
    print("Mean amplitude:", np.mean(np.abs(y)))

    # ---------------- VOICE ACTIVITY DETECTION ----------------
    # Detect speaking region using energy
    rms_full = librosa.feature.rms(y=y)[0]
    threshold = np.mean(rms_full) * 0.6

    speech_idx = np.where(rms_full > threshold)[0]

    # fallback if no speech detected
    if len(speech_idx) < 5:
        return {
            "voice_score": 0.3,
            "metrics": {
                "pitch_instability": 0.0,
                "tremor_index": 0.0,
                "pause_ratio": 1.0,
                "energy_variation": 0.0
            }
        }

    # convert frame index → samples
    frame_len = 512
    start = speech_idx[0] * frame_len
    end = speech_idx[-1] * frame_len

    y = y[start:end]

    # normalize speech segment
    y = librosa.util.normalize(y)

    # ---------------- PITCH EXTRACTION ----------------
    f0, _, _ = librosa.pyin(
        y,
        fmin=75,
        fmax=300
    )

    f0 = f0[~np.isnan(f0)]

    if len(f0) < 10:
        return {
            "voice_score": 0.35,
            "metrics": {
                "pitch_instability": 1.0,
                "tremor_index": 0.0,
                "pause_ratio": 1.0,
                "energy_variation": 0.0
            }
        }

    # ---------------- METRICS ----------------

    # 1️⃣ Pitch instability
    pitch_instability = np.std(f0) / (np.mean(f0) + 1e-6)
    pitch_score = np.clip(pitch_instability * 3, 0, 1)

    # 2️⃣ Tremor index
    tremor = np.mean(np.abs(np.diff(f0)))
    tremor_score = np.clip(
        tremor / (np.mean(f0) + 1e-6) * 60,
        0,
        1
    )

    # ---------------- IMPORTANT FIX ----------------
    # recompute RMS AFTER trimming speech
    rms = librosa.feature.rms(y=y)[0]

    # 3️⃣ Pause ratio
    speech_threshold = np.mean(rms) * 0.5
    silence_ratio = np.sum(rms < speech_threshold) / len(rms)
    pause_score = np.clip(silence_ratio, 0, 1)

    # 4️⃣ Energy variation
    energy_var = np.std(rms)
    energy_score = 1 - np.clip(energy_var * 8, 0, 1)

    # ---------------- FINAL SCORE ----------------
    voice_score = (
        0.35 * pitch_score +
        0.30 * tremor_score +
        0.20 * pause_score +
        0.15 * energy_score
    )

    voice_score = np.clip(voice_score, 0, 1)

    print(
        "Scores:",
        pitch_score,
        tremor_score,
        pause_score,
        energy_score
    )

    return {
        "voice_score": float(voice_score),
        "metrics": {
            "pitch_instability": float(pitch_score),
            "tremor_index": float(tremor_score),
            "pause_ratio": float(pause_score),
            "energy_variation": float(energy_score)
        }
    }