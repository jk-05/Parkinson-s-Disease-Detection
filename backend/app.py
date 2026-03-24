import os
# ---- OPTIONAL: Silence TensorFlow oneDNN logs ----
os.environ["TF_ENABLE_ONEDNN_OPTS"] = "0"

from flask import Flask, request, jsonify
from tensorflow.keras.models import load_model
from progression_predictor import predict_progression, estimate_stage
import numpy as np
from PIL import Image
from io import BytesIO
from flask_cors import CORS
import logging
import traceback
from datetime import datetime
import librosa
import soundfile as sf
from flask_sqlalchemy import SQLAlchemy
import cv2
import base64
import subprocess
from voice_analysis import analyze_voice
# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("app_crash.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

# --- FFmpeg Configuration for Windows ---
try:
    import imageio_ffmpeg
    ffmpeg_path = imageio_ffmpeg.get_ffmpeg_exe()
    os.environ["PATH"] += os.pathsep + os.path.dirname(ffmpeg_path)
    logger.info(f"FFmpeg configured via imageio-ffmpeg: {ffmpeg_path}")
except ImportError:
    logger.warning("imageio-ffmpeg not found. Audio conversion may fail if system ffmpeg is missing.")
except Exception as e:
    logger.error(f"Error configuring FFmpeg: {e}")

app = Flask(__name__)
CORS(app)

# Configuration
ALLOWED_EXTENSIONS = {'png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(BASE_DIR, "parkinson_mobilenet_augmented.keras")
CLASS_NAMES = ["Healthy", "Parkinson"]

# =========================
# Database Configuration (FIXED)
# =========================
DB_USER = "root"
DB_PASSWORD = "root"
DB_HOST = "localhost"
DB_NAME = "parkinson_db"   # ✅ REAL database name

app.config['SQLALCHEMY_DATABASE_URI'] = (
    f"mysql+mysqlconnector://{DB_USER}:{DB_PASSWORD}@{DB_HOST}/{DB_NAME}"
)
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# --- Models ---
# --- Models ---
class Doctor(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    specialization = db.Column(db.String(100), default="Neurologist")

class Patient(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(80), unique=True, nullable=False)
    password = db.Column(db.String(120), nullable=False)
    name = db.Column(db.String(100), nullable=False)
    age = db.Column(db.Integer, nullable=True)
    contact = db.Column(db.String(20), nullable=True)

class Prediction(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    patient_id = db.Column(db.Integer, db.ForeignKey('patient.id'), nullable=False)
    type = db.Column(db.String(20), nullable=False)
    result = db.Column(db.String(50), nullable=False)
    confidence = db.Column(db.Float, nullable=False)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)

    # Relationship
    patient = db.relationship('Patient', backref=db.backref('predictions', lazy=True))

# Initialize DB
with app.app_context():
    try:
        db.create_all()
        
        # Seed Doctor
        if not Doctor.query.filter_by(username='doctor').first():
            db.session.add(Doctor(username='doctor', password='password', name="Dr. Strange"))
            db.session.commit()
            print("Doctor seeded.")

        # Seed Patient
        if not Patient.query.filter_by(username='patient').first():
            db.session.add(Patient(username='patient', password='password', name="John Doe", age=65, contact="1234567890"))
            db.session.commit()
            print("Patient seeded.")
            
        logger.info("Database initialized successfully")
    except Exception as e:
        logger.error(f"Database initialization failed: {e}")

# Load model
try:
    if os.path.exists(MODEL_PATH):
        model = load_model(MODEL_PATH)
        logger.info("Model loaded successfully")
    else:
        logger.error(f"Model file not found at {MODEL_PATH}")
        model = None
except Exception as e:
    logger.error(f"Error loading model: {e}")
    model = None

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def validate_image(file):
    try:
        file.seek(0, 2)
        file_size = file.tell()
        file.seek(0)

        if file_size > MAX_FILE_SIZE:
            return False, "File too large"

        img = Image.open(BytesIO(file.read()))
        file.seek(0)

        w, h = img.size
        if w < 50 or h < 50:
            return False, "Image too small"
        if w > 5000 or h > 5000:
            return False, "Image too large"

        return True, "Valid image"
    except Exception as e:
        return False, str(e)

@app.route("/health", methods=["GET"])
def health_check():
    return jsonify({
        "status": "healthy" if model else "unhealthy",
        "model_loaded": model is not None,
        "timestamp": datetime.utcnow().isoformat()
    })

@app.route("/predict-test", methods=["GET"])
def test():
    return jsonify({"message": "Backend is working"})

@app.route("/predict", methods=["POST"])
def predict():
    try:
        if model is None:
            return jsonify({"error": "Model not loaded"}), 503

        if 'file' not in request.files:
            return jsonify({"error": "No file uploaded"}), 400

        file = request.files['file']

        if not allowed_file(file.filename):
            return jsonify({"error": "Invalid file type"}), 400

        valid, msg = validate_image(file)
        if not valid:
            return jsonify({"error": msg}), 400

        # Read image
        img_bytes = file.read()
        img = Image.open(BytesIO(img_bytes)).convert("RGB")
        img_resized = img.resize((224, 224))
        arr = np.expand_dims(np.array(img_resized) / 255.0, axis=0)

        # Predict
        preds = model.predict(arr, verbose=0)
        idx = np.argmax(preds[0])
        result_class = CLASS_NAMES[idx]
        confidence = float(preds[0][idx])

        # Generate Grad-CAM Heatmap
        heatmap_base64 = None
        try:
            import tensorflow as tf
            
            # Step 1: Ensure the model is trainable so gradients can flow
            # If the model or its base was frozen, tape.gradient will return None
            for layer in model.layers:
                layer.trainable = True
                if hasattr(layer, 'layers'):
                    for inner_layer in layer.layers:
                        inner_layer.trainable = True

            # Step 2: Find the base model (MobileNetV2 is usually the first layer)
            base_model = None
            for layer in model.layers:
                if isinstance(layer, tf.keras.Model):
                    base_model = layer
                    break
            
            # Step 3: Find the last convolutional layer in the base model (or main model)
            target_model = base_model if base_model else model
            last_conv_layer_name = None
            
            # Use layer.output.shape which is more reliable in TF 2.x than layer.output_shape
            for layer in reversed(target_model.layers):
                try:
                    if len(layer.output.shape) == 4:
                        last_conv_layer_name = layer.name
                        break
                except Exception:
                    pass

            if not last_conv_layer_name:
                logger.warning("Could not find a 4D convolutional layer for Grad-CAM.")

            if last_conv_layer_name:
                last_conv_layer = target_model.get_layer(last_conv_layer_name)
                
                # Step 4: Construct a single model that outputs BOTH the conv output and the final prediction.
                # Since we might be dealing with a nested model (Sequential(MobileNetV2, Dense)), 
                # we need to create a custom Model that passes the input through the whole chain.
                
                # To trace the gradient properly:
                inputs = tf.keras.Input(shape=(224, 224, 3))
                
                if base_model:
                    # Input -> MobileNetV2(up to Conv)
                    base_conv_model = tf.keras.Model(target_model.inputs, last_conv_layer.output)
                    conv_outputs = base_conv_model(inputs)
                    
                    # Input -> Overall Model (Prediction)
                    predictions = model(inputs)
                    
                    grad_model = tf.keras.Model(inputs, [conv_outputs, predictions])
                else:
                    grad_model = tf.keras.Model(model.inputs, [last_conv_layer.output, model.output])

                # Step 5: Taping and Gradients
                with tf.GradientTape() as tape:
                    # Cast our image array explicitly for the tape
                    img_tensor = tf.cast(arr, tf.float32)
                    tape.watch(img_tensor)
                    
                    last_conv_layer_output, model_preds = grad_model(img_tensor)
                    
                    if isinstance(model_preds, list):
                        model_preds = model_preds[0]
                        
                    class_channel = model_preds[:, idx]

                grads = tape.gradient(class_channel, last_conv_layer_output)
                
                if grads is not None:
                    # Debug prints for Grad-CAM
                    print(f"last_conv_layer_output shape: {last_conv_layer_output.shape}")
                    print(f"grads shape: {grads.shape}")
                    
                    # Ensure we are reducing over the correct axes.
                    # If shape is 4D (batch, H, W, channels), we reduce (0, 1, 2).
                    # If 3D, reduce (0, 1) etc.
                    ndims = len(grads.shape)
                    reduce_axes = tuple(range(ndims - 1))
                    
                    pooled_grads = tf.reduce_mean(grads, axis=reduce_axes)

                    # Weight the channels by the pooled gradients
                    # last_conv_layer_output[0] is (H, W, C), pooled_grads is (C,)
                    weighted_conv = tf.multiply(last_conv_layer_output[0], pooled_grads)
                    heatmap = tf.reduce_sum(weighted_conv, axis=-1)
                    
                    # Apply ReLU
                    heatmap = tf.maximum(heatmap, 0)
                    
                    # Normalize to 0-1
                    max_val = tf.math.reduce_max(heatmap)
                    if max_val > 0:
                        heatmap = heatmap / max_val
                        
                    heatmap = heatmap.numpy()

                    # Overlay heatmap on original image
                    img_cv = np.array(img_resized)
                    img_cv = img_cv[:, :, ::-1] # RGB to BGR

                    heatmap_resized = cv2.resize(heatmap, (img_cv.shape[1], img_cv.shape[0]))
                    heatmap_resized = np.uint8(255 * heatmap_resized)
                    heatmap_color = cv2.applyColorMap(heatmap_resized, cv2.COLORMAP_JET)

                    superimposed_img = heatmap_color * 0.4 + img_cv * 0.6
                    superimposed_img = np.uint8(superimposed_img)

                    _, buffer = cv2.imencode('.jpg', superimposed_img)
                    heatmap_base64 = base64.b64encode(buffer).decode('utf-8')
                else:
                    logger.warning(f"Gradients returned None. Check if {last_conv_layer_name} is differentiable.")
                    heatmap_base64 = f"ERROR: Gradients returned None for layer {last_conv_layer_name}"
        except Exception as e:
            logger.error(f"Grad-CAM Error: {e}")
            import traceback
            logger.error(traceback.format_exc())
            heatmap_base64 = f"ERROR: Exception {str(e)}"

        return jsonify({
            "result": result_class,
            "confidence": confidence,
            "heatmap": heatmap_base64
        })
    except Exception as e:
        logger.error(f"Predict Error: {e}")
        import traceback
        logger.error(traceback.format_exc())
        return jsonify({"error": str(e)}), 500

@app.route("/predict-voice", methods=["POST"])
def predict_voice():
    import random
    
    if 'file' not in request.files:
        return jsonify({"error": "No voice file uploaded"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    try:
        # Create temp directory if not exists
        temp_dir = os.path.join(BASE_DIR, "temp")
        os.makedirs(temp_dir, exist_ok=True)

        # Save original file (likely .webm or .ogg from browser)
        timestamp = datetime.now().timestamp()
        original_filename = f"voice_{timestamp}_{file.filename}"
        original_path = os.path.join(temp_dir, original_filename)
        file.save(original_path)
        logger.info(f"Saved original voice file to: {original_path}")
        
        # Convert to strict WAV format to prevent librosa/audioread from crashing Windows
        wav_filename = f"voice_{timestamp}_converted.wav"
        wav_path = os.path.join(temp_dir, wav_filename)
        
        try:
            ffmpeg_exe = imageio_ffmpeg.get_ffmpeg_exe()
            
            # Use subprocess to reliably call ffmpeg and convert the webm audio blob to standard wav
            # -y overwrites if exists. -i is input.
            cmd = [ffmpeg_exe, "-y", "-i", original_path, wav_path]
            
            # Run the command, capturing output to avoid locking up
            process = subprocess.run(cmd, stdout=subprocess.PIPE, stderr=subprocess.PIPE)
            
            if process.returncode != 0:
                logger.error(f"FFmpeg conversion failed: {process.stderr.decode('utf-8')}")
                return jsonify({"error": "Failed to convert audio file format via FFmpeg."}), 500
                
            logger.info(f"Successfully converted audio to WAV format: {wav_path}")
            
        except Exception as e:
            logger.error(f"Error executing FFmpeg conversion: {e}")
            return jsonify({"error": f"Server missing dependencies for audio conversion: {str(e)}"}), 500

        # Extract features and calculate score using new voice_analysis.py
        try:
            voice_data = analyze_voice(wav_path)
            voice_score = voice_data["voice_score"]
            metrics = voice_data["metrics"]
            logger.info("Voice analysis successfully completed.")
        except Exception as e:
            logger.error(f"Error during voice analysis: {e}")
            return jsonify({"error": f"Failed to analyze audio: {str(e)}"}), 500
            
        final_risk = voice_score
        
        result = "Parkinson Detected" if final_risk >= 0.5 else "Healthy"
        # Confidence is the probability of the predicted class
        confidence = float(final_risk) if final_risk >= 0.5 else float(1.0 - final_risk)

        logger.info(f"Final Risk: {final_risk}, Result: {result}, Confidence: {confidence}")

        return jsonify({
            "result": result,
            "confidence": confidence,
            "voice_score": voice_score,
            "metrics": metrics,
            "final_risk": final_risk,
            "message": "Voice file processed successfully"
        })

    except Exception as e:
        logger.error(f"Error processing voice file: {e}")
        # traceback.print_exc()
        return jsonify({"error": f"Failed to process audio: {str(e)}"}), 500

@app.route("/login", methods=["POST"])
def login():
    data = request.json
    role = data.get("role")
    username = data.get("username")
    password = data.get("password")

    if role == 'doctor':
        user = Doctor.query.filter_by(username=username).first()
    else:
        user = Patient.query.filter_by(username=username).first()

    if user and user.password == password:
        # Return user ID for session storage
        # Check if user has a name attribute (Doctor/Patient have it)
        name = getattr(user, 'name', username)
        age = getattr(user, 'age', None) if role == 'patient' else None
        return jsonify({"message": "Login successful", "id": user.id, "name": name, "age": age})
    return jsonify({"error": "Invalid credentials"}), 401

@app.route("/register", methods=["POST"])
def register():
    data = request.json
    try:
        # Check if username exists in Patient table
        if Patient.query.filter_by(username=data['username']).first():
            return jsonify({"error": "Username already exists"}), 400
            
        new_patient = Patient(
            username=data['username'],
            password=data['password'],
            name=data['name'],
            age=data.get('age'),
            contact=data.get('contact')
        )
        db.session.add(new_patient)
        db.session.commit()
        return jsonify({"message": "Registration successful"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route("/save-result", methods=["POST"])
def save_result():
    data = request.json
    try:
        patient_id = data.get('patient_id')
        
        if not patient_id:
             # Try to find by name if ID missing (legacy support)
             name = data.get('patient_name')
             p = Patient.query.filter_by(username=name).first() # Assuming username matches
             if p:
                 patient_id = p.id
        
        if not patient_id:
            return jsonify({"error": "Patient identity unknown"}), 400

        pred = Prediction(
            patient_id=int(patient_id),
            type=data.get("type"),
            result=data.get("result"),
            confidence=float(data.get("confidence"))
        )
        db.session.add(pred)
        db.session.commit()
        return jsonify({"message": "Saved"})
    except Exception as e:
        logger.error(f"Save error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/results", methods=["GET"])
def get_results():
    try:
        # Join Prediction with Patient table
        results = db.session.query(Prediction, Patient)\
            .join(Patient, Prediction.patient_id == Patient.id)\
            .order_by(Prediction.timestamp.desc())\
            .limit(50).all()

        return jsonify([
            {
                "id": p.id,
                "patient_id": pt.id,
                "patient_name": pt.name, 
                "patient_age": pt.age,
                "patient_contact": pt.contact,
                "type": p.type,
                "result": p.result,
                "confidence": p.confidence,
                "timestamp": p.timestamp.isoformat()
            } for p, pt in results
        ])
    except Exception as e:
        logger.error(f"Fetch results error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/predict-progression", methods=["POST"])
def progression():
    try:
        data = request.json
        risk_score = float(data.get("risk_score", 0.0))
        age = int(data.get("age", 50))
        symptom_score = float(data.get("symptom_score", 0.0))

        progression_timeline = predict_progression(risk_score, age, symptom_score)
        stage = estimate_stage(risk_score)

        return jsonify({
            "progression": progression_timeline,
            "estimated_stage": stage
        })
    except Exception as e:
        logger.error(f"Progression prediction error: {e}")
        return jsonify({"error": str(e)}), 500

if __name__ == "__main__":
    logger.info("Starting Parkinson Disease Detection API...")
    logger.info(f"Model path: {MODEL_PATH}")
    logger.info(f"Model loaded: {model is not None}")

    # Warmup Numba JIT to prevent thread crashing
    try:
        logger.info("Starting Numba JIT warmup...")
        import librosa
        import numpy as np
        dummy = np.zeros(22050, dtype=np.float32)
        librosa.feature.mfcc(y=dummy, sr=22050, n_mfcc=13)
        logger.info("Numba JIT warmup completed successfully.")
    except Exception as e:
        logger.error(f"Numba JIT warmup failed: {e}")

    # Run without threading to prevent librosa/numba segfaults on Windows
    app.run()
