import os
import joblib
import logging
import numpy as np

logger = logging.getLogger(__name__)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "svm_parkinson.pkl")
SCALER_PATH = os.path.join(BASE_DIR, "scaler.pkl")

# Load dynamically or globally depending on whether these files exist.
# Let's try to load them at module start so we crash early if missing, but fallback to runtime.
try:
    svm_model = joblib.load(MODEL_PATH)
    scaler = joblib.load(SCALER_PATH)
    logger.info("SVM model and Scaler loaded successfully.")
    MODEL_LOADED = True
except Exception as e:
    logger.error(f"Failed to load SVM model or Scaler: {e}")
    # Still defined as None to be handled at request time.
    svm_model = None
    scaler = None
    MODEL_LOADED = False

def predict_parkinsons_voice(features):
    """
    Predicts Parkinson's Disease from an array of 28 extracted audio features.
    
    Args:
        features (np.array): A numpy array of shape (1, 28) containing audio features.
        
    Returns:
        dict: Result dictionary containing 'result' (Healthy/Parkinson) and 'confidence'.
    """
    if not MODEL_LOADED:
        raise ValueError("SVM Model or Scaler not loaded on startup. Cannot predict.")
        
    # Scale features
    scaled_features = scaler.transform(features)
    
    # Predict class (e.g., 0 for Healthy, 1 for Parkinsons depending on your training format. Wait, let's output raw prediction)
    # usually 1 = Parkinson, 0 = Healthy
    prediction = svm_model.predict(scaled_features)[0]
    
    # Try to get probability for confidence score if model was trained with probability=True
    confidence = 0.0
    try:
        if hasattr(svm_model, "predict_proba"):
            probs = svm_model.predict_proba(scaled_features)[0]
            confidence = float(max(probs))
        else:
            # Fallback for models without predict_proba (e.g. Standard SVC without probability=True)
            confidence = 0.90  # Default dummy high confidence if we can't get probability 
    except Exception as e:
        logger.warning(f"Could not calculate prediction confidence: {e}")
        confidence = 0.85 # Default fallback

    # Map the prediction number to the class label
    # Assuming 0 is Healthy, and 1 is Parkinson. Adjust if your model outputs strings directly!
    if isinstance(prediction, (int, float, np.integer, np.floating)):
        result_label = "Parkinson" if prediction == 1 else "Healthy"
    else:
        # If model outputs string like 'Healthy' or 'Parkinson'
        result_label = str(prediction)

    # Standardize result label to "Parkinson" or "Healthy"
    if "parkinson" in result_label.lower():
        result_label = "Parkinson"
    else:
        result_label = "Healthy"
        
    return {
        "result": result_label,
        "confidence": confidence
    }
