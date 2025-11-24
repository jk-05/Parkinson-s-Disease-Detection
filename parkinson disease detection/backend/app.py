from flask import Flask, request, jsonify
from tensorflow.keras.models import load_model
import numpy as np
from PIL import Image
from io import BytesIO
from flask_cors import CORS
import logging
import os
import traceback
from datetime import datetime
import json

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Configuration
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB
MODEL_PATH = r"D:\Parkinson Disease Detection\parkinson disease detection\backend\parkinson_mobilenet_augmented.keras"
CLASS_NAMES = ["Healthy", "Parkinson"]

# Load model with error handling
try:
    if os.path.exists(MODEL_PATH):
        model = load_model(MODEL_PATH)
        logger.info("Model loaded successfully")
    else:
        logger.error(f"Model file not found at {MODEL_PATH}")
        model = None
except Exception as e:
    logger.error(f"Error loading model: {str(e)}")
    model = None

def allowed_file(filename):
    """Check if file extension is allowed"""
    return '.' in filename and \
           filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def validate_image(file):
    """Validate uploaded image file"""
    try:
        # Check file size
        file.seek(0, 2)  # Seek to end
        file_size = file.tell()
        file.seek(0)  # Reset to beginning
        
        if file_size > MAX_FILE_SIZE:
            return False, f"File size ({file_size / (1024*1024):.1f}MB) exceeds maximum allowed size (10MB)"
        
        # Try to open and validate image
        img = Image.open(BytesIO(file.read()))
        file.seek(0)  # Reset to beginning
        
        # Check image dimensions
        width, height = img.size
        if width < 50 or height < 50:
            return False, "Image dimensions too small (minimum 50x50 pixels)"
        
        if width > 5000 or height > 5000:
            return False, "Image dimensions too large (maximum 5000x5000 pixels)"
        
        return True, "Valid image"
        
    except Exception as e:
        return False, f"Invalid image file: {str(e)}"

# Health check route
@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint"""
    status = {
        "status": "healthy" if model is not None else "unhealthy",
        "model_loaded": model is not None,
        "timestamp": datetime.now().isoformat(),
        "version": "1.0.0"
    }
    return jsonify(status), 200 if model is not None else 503

# Test route
@app.route("/predict-test", methods=["GET"])
def test():
    return jsonify({
        "message": "Backend is working",
        "model_status": "loaded" if model is not None else "not loaded",
        "timestamp": datetime.now().isoformat()
    })

# Prediction route
@app.route("/predict", methods=["POST"])
def predict():
    """Main prediction endpoint with comprehensive error handling"""
    start_time = datetime.now()
    
    # Check if model is loaded
    if model is None:
        logger.error("Model not loaded")
        return jsonify({
            "error": "Model not available",
            "message": "The AI model is not loaded. Please check server configuration.",
            "timestamp": start_time.isoformat()
        }), 503

    # Check if file is present
    if 'file' not in request.files:
        logger.warning("No file in request")
        return jsonify({
            "error": "No file uploaded",
            "message": "Please select an image file to analyze.",
            "timestamp": start_time.isoformat()
        }), 400

    file = request.files['file']
    
    # Check if file is selected
    if file.filename == '':
        logger.warning("Empty filename")
        return jsonify({
            "error": "No file selected",
            "message": "Please select a valid image file.",
            "timestamp": start_time.isoformat()
        }), 400

    # Validate file extension
    if not allowed_file(file.filename):
        logger.warning(f"Invalid file extension: {file.filename}")
        return jsonify({
            "error": "Invalid file type",
            "message": f"File type not supported. Allowed types: {', '.join(ALLOWED_EXTENSIONS)}",
            "timestamp": start_time.isoformat()
        }), 400

    # Validate image file
    is_valid, validation_message = validate_image(file)
    if not is_valid:
        logger.warning(f"Image validation failed: {validation_message}")
        return jsonify({
            "error": "Invalid image",
            "message": validation_message,
            "timestamp": start_time.isoformat()
        }), 400

    try:
        # Process image
        logger.info(f"Processing image: {file.filename}")
        
        # Read and preprocess image
        img = Image.open(BytesIO(file.read())).convert('RGB')
        original_size = img.size
        
        # Resize for model input
        img = img.resize((224, 224))
        img_array = np.array(img, dtype=np.float32) / 255.0
        img_array = np.expand_dims(img_array, axis=0)

        # Make prediction
        logger.info("Making prediction...")
        preds = model.predict(img_array, verbose=0)
        
        # Process results
        class_index = np.argmax(preds, axis=1)[0]
        confidence = float(preds[0][class_index])
        predicted_class = CLASS_NAMES[class_index]
        
        # Calculate processing time
        processing_time = (datetime.now() - start_time).total_seconds()
        
        # Prepare detailed response
        response = {
            "result": predicted_class,
            "confidence": confidence,
            "metadata": {
                "filename": file.filename,
                "original_size": {"width": original_size[0], "height": original_size[1]},
                "processing_time_seconds": round(processing_time, 3),
                "model_input_size": "224x224x3",
                "timestamp": start_time.isoformat()
            },
            "all_predictions": {
                CLASS_NAMES[i]: float(preds[0][i]) for i in range(len(CLASS_NAMES))
            }
        }
        
        logger.info(f"Prediction completed: {predicted_class} (confidence: {confidence:.3f})")
        return jsonify(response)

    except Exception as e:
        logger.error(f"Prediction error: {str(e)}")
        logger.error(traceback.format_exc())
        
        return jsonify({
            "error": "Prediction failed",
            "message": "An error occurred while processing the image. Please try again.",
            "details": str(e) if app.debug else "Internal server error",
            "timestamp": start_time.isoformat()
        }), 500

# Error handlers
@app.errorhandler(413)
def too_large(e):
    return jsonify({
        "error": "File too large",
        "message": f"File size exceeds maximum allowed size of {MAX_FILE_SIZE / (1024*1024):.0f}MB",
        "timestamp": datetime.now().isoformat()
    }), 413

@app.errorhandler(404)
def not_found(e):
    return jsonify({
        "error": "Endpoint not found",
        "message": "The requested endpoint does not exist",
        "timestamp": datetime.now().isoformat()
    }), 404

@app.errorhandler(500)
def internal_error(e):
    return jsonify({
        "error": "Internal server error",
        "message": "An unexpected error occurred",
        "timestamp": datetime.now().isoformat()
    }), 500

if __name__ == "__main__":
    logger.info("Starting Parkinson Disease Detection API...")
    logger.info(f"Model path: {MODEL_PATH}")
    logger.info(f"Model loaded: {model is not None}")
    app.run(debug=True, host="0.0.0.0", port=5000)
