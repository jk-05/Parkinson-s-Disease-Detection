import librosa
import numpy as np


def normalize_range(val, old_min, old_max, new_min, new_max):
    val = np.clip(val, old_min, old_max)
    return new_min + (val-old_min)*(new_max-new_min)/(old_max-old_min+1e-9)


def extract_voice_features(file_path):

    y, sr = librosa.load(file_path, sr=None)

    y, _ = librosa.effects.trim(y, top_db=20)
    y = librosa.util.normalize(y)

    features = []

    # ---------- Pitch ----------
    f0, _, _ = librosa.pyin(y, fmin=75, fmax=300)
    f0 = f0[~np.isnan(f0)]

    if len(f0) == 0:
        f0 = np.array([120])

    pitch_mean = np.mean(f0)
    pitch_std = np.std(f0)

    # map to dataset pitch ranges
    features.extend([
        normalize_range(np.median(f0), 75, 300, 80, 250),
        normalize_range(pitch_mean, 75, 300, 80, 250),
        normalize_range(pitch_std, 0, 80, 0, 40),
        normalize_range(np.min(f0), 75, 300, 70, 200),
        normalize_range(np.max(f0), 75, 300, 100, 300),
    ])

    # ---------- Jitter approximation ----------
    jitter = np.mean(np.abs(np.diff(f0)))
    jitter = normalize_range(jitter, 0, 20, 0.0005, 0.02)
    features.extend([jitter]*5)

    # ---------- Shimmer approximation ----------
    rms = librosa.feature.rms(y=y)[0]
    shimmer = np.mean(np.abs(np.diff(rms)))
    shimmer = normalize_range(shimmer, 0, 0.5, 0.01, 0.5)
    features.extend([shimmer]*6)

    # ---------- Spectral proxies ----------
    centroid = np.mean(librosa.feature.spectral_centroid(y=y, sr=sr))
    bandwidth = np.mean(librosa.feature.spectral_bandwidth(y=y, sr=sr))

    features.append(normalize_range(centroid, 500, 4000, 80, 250))
    features.append(normalize_range(bandwidth, 500, 4000, 80, 250))
    features.append(normalize_range(np.std(f0), 0, 80, 0, 40))

    # ---------- Voice breaks ----------
    zcr = librosa.feature.zero_crossing_rate(y)[0]
    silence_ratio = np.sum(np.abs(y) < 0.01) / len(y)

    features.extend([
        normalize_range(np.mean(zcr), 0, 0.3, 0, 0.2),
        normalize_range(silence_ratio, 0, 1, 0, 0.2),
        normalize_range(np.std(zcr), 0, 0.2, 0, 0.1),
    ])

    features = np.array(features)

    if len(features) < 28:
        features = np.pad(features, (0, 28-len(features)))

    features = np.nan_to_num(features)

    return features[:28].reshape(1, -1)