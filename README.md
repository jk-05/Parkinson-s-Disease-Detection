# Parkinson's Disease Detection System

A multi-modal AI application for detecting Parkinson's disease using Spiral Drawings and Voice Analysis.

## Features
- **Spiral Wave Test**: Upload an image of a spiral drawing to detect motor symptoms.
- **Voice Analysis**: Record or upload voice samples to detect speech anomalies.
- **AI Health Advice**: Personalized recommendations via Gemini AI.

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
    *Note: You may need to install `ffmpeg` for audio processing if using `librosa` on Windows.*
3. Run the server:
   ```bash
   python app.py
   ```
   Server will start at `http://127.0.0.1:5000`.

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

## Usage
1. Open the frontend URL (usually `http://localhost:5173`).
2. **Step 1**: Upload a spiral image.
3. **Step 2**: If analysis is successful, proceed to Voice Analysis.
4. Use the "Microphone" button to record audio or upload a file.
