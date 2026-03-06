import librosa
import numpy as np


def analyze_voice(file_path):

    print("Processing file:", file_path)

    # ---------------- LOAD AUDIO ----------------
    y, sr = librosa.load(file_path, sr=None)

    print("Audio length (seconds):", len(y) / sr)
    print("Mean amplitude:", np.mean(np.abs(y)))

    # ---------------- VOICE ACTIVITY DETECTION ----------------
    rms_full = librosa.feature.rms(y=y)[0]

    threshold = np.mean(rms_full) * 0.5
    speech_idx = np.where(rms_full > threshold)[0]

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

    frame_len = 512
    start = speech_idx[0] * frame_len
    end = speech_idx[-1] * frame_len

    y = y[start:end]

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

    mean_f0 = np.mean(f0)

    # ---------------- FEATURE EXTRACTION ----------------
    # Calibrated for browser-recorded audio.
    # Healthy range → score 0.1-0.3  |  Parkinson's range → score 0.5-1.0

    # 1️⃣ Pitch Instability (coefficient of variation of f0)
    pitch_instability = np.std(f0) / (mean_f0 + 1e-6)
    # Healthy: ~0.05-0.15, Parkinson's: ~0.20-0.50+
    pitch_score = np.clip(pitch_instability / 0.35, 0, 1)

    # 2️⃣ Tremor Index (mean pitch change between frames)
    tremor = np.mean(np.abs(np.diff(f0)))
    tremor_ratio = tremor / (mean_f0 + 1e-6)
    # Healthy: ~0.01-0.03, Parkinson's: ~0.04-0.10+
    tremor_score = np.clip(tremor_ratio / 0.06, 0, 1)

    # ---------------- ENERGY ANALYSIS ----------------
    rms = librosa.feature.rms(y=y)[0]

    # 3️⃣ Pause Ratio
    speech_threshold = np.mean(rms) * 0.5
    silence_ratio = np.sum(rms < speech_threshold) / len(rms)
    # Healthy: ~0.15-0.30, Parkinson's: ~0.40-0.70+
    pause_score = np.clip(silence_ratio / 0.60, 0, 1)

    # 4️⃣ Energy Variation
    energy_var = np.std(rms)
    # Healthy: ~0.03-0.10, Parkinson's: ~0.15-0.30+
    energy_score = np.clip(energy_var / 0.15, 0, 1)

    # 5️⃣ Jitter (cycle-to-cycle period perturbation)
    periods = 1.0 / (f0 + 1e-6)
    period_diffs = np.abs(np.diff(periods))
    jitter = np.mean(period_diffs) / (np.mean(periods) + 1e-6)
    # Healthy: ~0.01-0.04, Parkinson's: ~0.06-0.15+
    jitter_score = np.clip(jitter / 0.08, 0, 1)

    # 6️⃣ Shimmer (cycle-to-cycle amplitude variation)
    rms_diffs = np.abs(np.diff(rms))
    shimmer = np.mean(rms_diffs) / (np.mean(rms) + 1e-6)
    # Healthy: ~0.10-0.25, Parkinson's: ~0.35-0.60+
    shimmer_score = np.clip(shimmer / 0.50, 0, 1)

    # ---------------- DEBUG PRINTS ----------------
    print("RAW FEATURES")
    print("pitch_instability:", pitch_instability)
    print("tremor_ratio:", tremor_ratio)
    print("silence_ratio:", silence_ratio)
    print("energy_std:", energy_var)

    # ---------------- FINAL SCORE ----------------
    # Weighted average of all metrics
    weighted_avg = (
        0.20 * pitch_score +
        0.20 * tremor_score +
        0.20 * jitter_score +
        0.15 * shimmer_score +
        0.10 * pause_score +
        0.15 * energy_score
    )

    # Boost: if the top 3 metrics are high, the voice is likely Parkinson's
    # even if other metrics are low (common in early-stage)
    all_scores = [pitch_score, tremor_score, jitter_score, shimmer_score, pause_score, energy_score]
    top3_avg = np.mean(sorted(all_scores, reverse=True)[:3])

    # Blend: 60% weighted average + 40% top-3 average
    voice_score = 0.60 * weighted_avg + 0.40 * top3_avg

    voice_score = np.clip(voice_score, 0, 1)

    print(
        "Scores:",
        pitch_score,
        tremor_score,
        pause_score,
        energy_score,
        jitter_score,
        shimmer_score
    )

    return {
        "voice_score": float(voice_score),
        "metrics": {
            "pitch_instability": float(pitch_score),
            "tremor_index": float(tremor_score),
            "pause_ratio": float(pause_score),
            "energy_variation": float(energy_score),
            "jitter": float(jitter_score),
            "shimmer": float(shimmer_score)
        }
    }