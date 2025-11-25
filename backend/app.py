from flask import Flask, request, jsonify
from tensorflow.keras.models import load_model
import numpy as np
from PIL import Image
from io import BytesIO
from flask_cors import CORS

app = Flask(__name__)
CORS(app)  # Enable CORS for all routes

# Load your model
MODEL_PATH = r"D:\Parkinson Disease Detection\parkinson disease detection\backend\parkinson_mobilenet_augmented.keras"
model = load_model(MODEL_PATH)

CLASS_NAMES = ["Healthy", "Parkinson"]

# Test route
@app.route("/predict-test", methods=["GET"])
def test():
    return jsonify({"message": "Backend is working"})

# Prediction route
@app.route("/predict", methods=["POST"])
def predict():
    if 'file' not in request.files:
        return jsonify({"error": "No file uploaded"}), 400

    file = request.files['file']

    try:
        # Read image directly from memory
        img = Image.open(BytesIO(file.read())).convert('RGB')
        img = img.resize((224, 224))  # MobileNet expects 224x224x3
        img_array = np.array(img) / 255.0
        img_array = np.expand_dims(img_array, axis=0)

        # Predict
        preds = model.predict(img_array)
        class_index = np.argmax(preds, axis=1)[0]
        confidence = float(preds[0][class_index])
        predicted_class = CLASS_NAMES[class_index]

        return jsonify({
            "result": predicted_class,
            "confidence": confidence
        })

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    app.run(debug=True, host="0.0.0.0", port=5000)
