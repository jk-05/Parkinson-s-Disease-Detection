# 🧠 Parkinson’s Disease Detection System  

![Python](https://img.shields.io/badge/Python-3.9-blue?logo=python)  
![React](https://img.shields.io/badge/Frontend-React-blue?logo=react)  
![Flask](https://img.shields.io/badge/Backend-Flask-black?logo=flask)  
![TensorFlow](https://img.shields.io/badge/AI-TensorFlow-orange?logo=tensorflow)  
![License](https://img.shields.io/badge/License-MIT-green)  

> 🚀 A multi-modal AI-powered healthcare application for early detection of Parkinson’s Disease using spiral handwriting analysis and voice signal processing.

---

## 🌟 Demo Preview  

👉 Add your demo link here  
Live Demo: https://your-demo-link.com  

---

## 📸 Project Screenshots  

### 🏠 Home Interface  
![Home UI](https://via.placeholder.com/800x400?text=Home+UI)

### ✍️ Spiral Analysis  
![Spiral Analysis](https://via.placeholder.com/800x400?text=Spiral+Analysis)

### 🎤 Voice Analysis  
![Voice Analysis](https://via.placeholder.com/800x400?text=Voice+Analysis)

---

## 🚀 Features  

### ✍️ Spiral Wave Test  
- Upload spiral drawings  
- Detect motor symptoms using CNN  
- Image preprocessing (noise reduction, contour enhancement)  

### 🎤 Voice Analysis  
- Record/upload voice samples  
- Extract features: Jitter, Shimmer, Pitch, MFCC  
- Classification using SVM  

### 🤖 AI Health Assistant  
- Personalized recommendations using Gemini AI  
- Smart insights based on prediction results  

---

## 🧠 System Architecture  

```mermaid
graph TD
A[Spiral Image] --> B[CNN Model]
C[Voice Input] --> D[Feature Extraction]
D --> E[SVM Model]
B --> F[Feature Fusion]
E --> F
F --> G[Final Prediction]
G --> H[AI Health Advice]
🛠️ Tech Stack
Category	Technologies Used
Frontend	React (Vite)
Backend	Flask (Python)
AI Models	CNN, SVM
Libraries	TensorFlow, Scikit-learn
Image Processing	OpenCV
Audio Processing	Librosa
⚙️ Installation & Setup
🔹 Backend (Flask)
cd backend
pip install -r requirements.txt
python app.py

📍 Runs on: http://127.0.0.1:5000

🔹 Frontend (React + Vite)
cd frontend
npm install
npm run dev

📍 Runs on: http://localhost:5173

🔐 Environment Variables

Create a .env file inside frontend/:

VITE_GEMINI_API_KEY=your_api_key_here
📌 Usage
Upload a spiral drawing
View analysis results
Proceed to voice analysis
Record/upload voice sample
Get prediction and AI recommendations
📊 Workflow
Spiral → CNN → Motor Analysis
Voice → Feature Extraction → SVM
Combined → Final Prediction
🔮 Future Enhancements
Mobile app integration
Cloud deployment
Larger dataset training
Advanced deep learning models
🏆 Highlights
Multi-modal AI system (Vision + Audio)
Real-world healthcare application
Full-stack implementation
Scalable architecture
🤝 Contributing

Pull requests are welcome!

📜 License

This project is licensed under the MIT License.

💡 Author

👨‍💻 Dev
Engineering Student | AI Enthusiast

⭐ Support

If you like this project, give it a ⭐ on GitHub!


---

✅ Just:
1. Open GitHub  
2. Edit `README.md`  
3. Paste this  
4. Click **Commit**

---

If you want next level 🔥  
I can turn this into:
- **Top-tier resume project (FAANG style)**
- **Portfolio website project section**
- **Viva explanation script**
