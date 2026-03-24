# Parkinson's Disease Detection System

A multi-modal AI-powered application for detecting Parkinson's Disease using **Spiral Drawing Analysis** and **Voice Signal Processing**.

This system combines **Deep Learning (CNN)** and **Machine Learning (SVM/Hybrid Models)** to identify early symptoms and provide **AI-based health recommendations**.

---

## Features

- **Spiral Wave Test**: Upload a spiral drawing image to detect motor impairments such as tremors and irregular movements using CNN.
- **Voice Analysis**: Record or upload voice samples to analyze speech abnormalities using features like jitter, shimmer, pitch variation, and MFCC.
- **Multi-Modal Detection**: Combines both image and voice analysis for improved prediction accuracy.
- **AI Health Advice**: Personalized recommendations powered by Gemini AI.
- **Real-Time Results**: Fast and efficient prediction with confidence scores.

---

## System Architecture

```text
User Input
├── Spiral Image → CNN Model → Prediction
├── Voice Sample → Feature Extraction → ML Model → Prediction
└── Combined Result → AI Recommendation System
```

---

## Tech Stack

**Backend:**
- Python
- Flask
- TensorFlow / Keras
- Scikit-learn
- Librosa (audio processing)

**Frontend:**
- React (Vite)
- HTML, CSS, JavaScript

**AI Models:**
- CNN for spiral image analysis
- SVM / Hybrid models for voice classification
- Gemini AI for recommendations

---

## Setup Instructions

### Backend (Python/Flask)
1. Navigate to the `backend` folder:
   ```bash
   cd backend
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
   *Note: You may need to install `ffmpeg` for audio processing if using `librosa`.*

3. Run the server:
   ```bash
   python app.py
   ```
   *Server will start at `http://127.0.0.1:5000`.*

### Frontend (React/Vite)
1. Navigate to the `frontend` folder:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Set up environment variables:
   - Create `.env` file in `frontend` root.
   - Add: `VITE_GEMINI_API_KEY=your_key_here`

4. Run the development server:
   ```bash
   npm run dev
   ```
   *Frontend will run at `http://localhost:5173`.*

---

## Usage
1. Open the frontend URL (usually `http://localhost:5173`).
2. **Step 1**: Upload a spiral image for motor symptom analysis.
3. **Step 2**: If analysis is successful, proceed to Voice Analysis.
4. Record audio using the microphone or upload a `.wav` file.
5. View prediction results along with confidence score and recommendations.

---

## Output
- ✅ **Parkinson’s Detection Result** (Positive / Negative)
- 📈 **Confidence Score**
- 📋 **Voice Feature Analysis** (Jitter, Shimmer, Pitch, MFCC)
- 🧠 **AI-Based Health Recommendations**

---

## Future Enhancements
- 📱 Mobile app integration
- ☁️ Cloud deployment
- 🧬 Wearable sensor data integration
- 📊 Advanced analytics dashboard
- 🏥 Improved dataset for higher accuracy

---

## Disclaimer

⚠️ **This project is intended for educational and research purposes only.**  
It is not a substitute for professional medical diagnosis.

---

## Author

👨‍💻 **Devanand**  
*Engineering Student | AI Enthusiast*
