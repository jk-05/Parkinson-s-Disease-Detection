import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./App.css";

// ⚠️ SECURITY NOTE: Key is now in .env
const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";


// --- Utility Functions ---

const parseAdvice = (text) => {
    const sections = {
        summary: "",
        lifestyle: "",
        healthcare: "",
        prevention: ""
    };

    const getSectionContent = (key) => {
        const match = text.match(new RegExp(`\\[${key.toUpperCase()}\\]([\\s\\S]*?)(?=\\[|$)`));
        return match ? match[1].trim() : "";
    };

    sections.summary = getSectionContent("summary");
    sections.lifestyle = getSectionContent("lifestyle");
    sections.healthcare = getSectionContent("healthcare");
    sections.prevention = getSectionContent("prevention");

    return sections;
};

const AdviceList = ({ content }) => {
    if (!content) return null;
    const items = content
        .split('\n')
        .map(item => item.trim())
        .filter(item => item.length > 0)
        .map((item, index) => (
            <li key={index}>{item.replace(/^[•\-\*]\s*/, '')}</li>
        ));

    return <ul>{items}</ul>;
};


// --- Main Component ---

function PatientDashboard() {
    const [selectedFile, setSelectedFile] = useState(null);
    const [preview, setPreview] = useState(null);
    const [prediction, setPrediction] = useState("");
    const [confidence, setConfidence] = useState(0);
    const [advice, setAdvice] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    // --- Voice UI State ---
    const [step, setStep] = useState(1); // 1: Handwriting, 2: Voice
    const [voiceFile, setVoiceFile] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const [voicePrediction, setVoicePrediction] = useState(null);
    const [voiceConfidence, setVoiceConfidence] = useState(0);
    const [voiceLoading, setVoiceLoading] = useState(false);
    const [voiceError, setVoiceError] = useState(null);

    const timerRef = useRef(null);
    const navigate = useNavigate();

    const handleLogout = () => {
        localStorage.removeItem("userRole");
        navigate("/");
    };

    // Function to save result to DB
    const saveToDb = async (type, result, confidence) => {
        const patientId = localStorage.getItem("patientId");
        if (!patientId) {
            console.warn("No Patient ID found. Results may not save. Please relogin.");
            // Optional: alert("Session expired. Please re-login to save results.");
        }

        try {
            await axios.post("http://127.0.0.1:5000/save-result", {
                patient_id: patientId,
                type,
                result,
                confidence: confidence / 100
            });
        } catch (err) {
            console.error("Failed to save result:", err);
        }
    };

    // --- Voice Handlers ---

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const recorder = new MediaRecorder(stream);
            const chunks = [];

            recorder.ondataavailable = (e) => chunks.push(e.data);
            recorder.onstop = () => {
                const blob = new Blob(chunks, { type: 'audio/webm' });
                const filename = `recording_${Date.now()}.webm`;
                const file = new File([blob], filename, { type: 'audio/webm' });
                setVoiceFile(file);
            };

            recorder.start();
            setMediaRecorder(recorder);
            setIsRecording(true);
            setVoiceFile(null);
            setVoicePrediction(null);
            setVoiceError(null);

            // Timer
            let time = 0;
            setRecordingTime(0);
            if (timerRef.current) clearInterval(timerRef.current);
            timerRef.current = setInterval(() => {
                time++;
                setRecordingTime(time);
            }, 1000);

        } catch (err) {
            setVoiceError("Could not access microphone. Please allow permissions.");
            console.error(err);
        }
    };

    const stopRecording = () => {
        if (mediaRecorder) {
            mediaRecorder.stop();
            mediaRecorder.stream.getTracks().forEach(track => track.stop());
            if (timerRef.current) clearInterval(timerRef.current);
            setMediaRecorder(null);
            setIsRecording(false);
        }
    };

    const handleVoiceUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            setVoiceFile(file);
            setVoicePrediction(null);
            setVoiceError(null);
        }
    };

    const analyzeVoice = async () => {
        if (!voiceFile) return;

        setVoiceLoading(true);
        setVoiceError(null);

        const formData = new FormData();
        formData.append("file", voiceFile);
        if (prediction) {
            formData.append("previous_result", prediction);
        }

        try {
            const response = await axios.post("http://127.0.0.1:5000/predict-voice", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            const res = response.data.result;
            const conf = (response.data.confidence * 100).toFixed(2);

            setVoicePrediction(res);
            setVoiceConfidence(conf);

            // Save result
            saveToDb('voice', res, conf);

        } catch (err) {
            console.error(err);
            setVoiceError("Voice analysis failed. Please try again.");
        } finally {
            setVoiceLoading(false);
        }
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        setSelectedFile(file);
        setPrediction("");
        setConfidence(0);
        setAdvice("");
        setError(null);

        if (file) {
            const reader = new FileReader();
            reader.onloadend = () => setPreview(reader.result);
            reader.readAsDataURL(file);
        } else {
            setPreview(null);
        }
    };

    const handleSubmit = async () => {
        if (!selectedFile) {
            setError("Please upload a medical scan image to proceed.");
            return;
        }

        const formData = new FormData();
        formData.append("file", selectedFile);
        setLoading(true);
        setError(null);

        try {
            // 1️⃣ Predict using backend
            const predictionResponse = await axios.post("http://127.0.0.1:5000/predict", formData, {
                headers: { "Content-Type": "multipart/form-data" },
            });

            const { result, confidence: confidenceValue = 0.5 } = predictionResponse.data;
            const confidencePercent = (parseFloat(confidenceValue) * 100).toFixed(2);

            setPrediction(result);
            setConfidence(confidencePercent);

            // Save result
            saveToDb('spiral', result, confidencePercent);

            // 2️⃣ Generate advice from Gemini
            const prompt = `
You are an expert neurological health advisor. Provide a clear, empathetic, and supportive response.

Patient's AI scan result: "${result}" (Confidence: ${confidencePercent}%)

Provide advice using the following structure with clear section markers:

[SUMMARY]
One brief sentence overview and immediate recommended action.

[LIFESTYLE]
Provide ONLY 4 concise, actionable tips (one line each):
• One about diet (specific foods, e.g., Mediterranean diet)
• One about exercise (type and duration, e.g., 30 minutes of aerobic exercise daily)
• One about mental activity (e.g., engage in daily brain training like learning a language)
• One about sleep (e.g., maintain a consistent 7-9 hour sleep schedule)

[HEALTHCARE]
Provide ONLY 3 brief action items (one line each):
• When to see a doctor (e.g., schedule an appointment with a neurologist within 2 weeks)
• What to discuss (e.g., review current motor and non-motor symptoms like tremor and sleep changes)
• Recommended tests (e.g., discuss the need for a DaTscan or specific blood markers)

[PREVENTION]
Provide ONLY 3-4 key preventive measures (one line each) based on the prediction:
- If positive/high risk: Urgent neurologist consultation, medication management, commence physical therapy, establish support network.
- If negative/low risk: Maintain daily high-intensity aerobic exercise, consistent cognitive challenge (puzzles/reading), annual neurological wellness checkup, balanced anti-inflammatory diet.

Keep each bullet point to ONE line maximum. Be specific and actionable, not generic. Use a bullet point (•) for each tip.
`;

            const geminiResponse = await axios.post(
                `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
                { contents: [{ parts: [{ text: prompt }] }] },
                { headers: { "Content-Type": "application/json" } }
            );

            const aiText =
                geminiResponse.data.candidates?.[0]?.content?.parts?.[0]?.text ||
                "No detailed advice could be generated at this time.";
            setAdvice(aiText);

        } catch (err) {
            console.error("Analysis Error:", err);
            setError("Error: Could not complete analysis. Check network, backend server, and API key.");
        } finally {
            setLoading(false);
        }
    };

    const sections = advice ? parseAdvice(advice) : null;
    const isPositive = prediction.toLowerCase().includes("positive");
    const confidencePercent = parseFloat(confidence);

    return (
        <div className="app-container">
            {/* Header */}
            <div className="header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexDirection: "row" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <div className="brain-icon">🧠</div>
                    <div>
                        <h1 style={{ fontSize: "2rem", margin: 0 }}>NeuroScan AI</h1>
                        {/* <p className="subtitle" style={{margin: 0}}>Parkinson's Detection</p> */}
                    </div>
                </div>
                <button onClick={handleLogout} className="step-btn">Logout</button>
            </div>

            {/* Error Notification */}
            {error && (
                <div className="card" style={{
                    backgroundColor: 'rgba(255, 0, 0, 0.1)',
                    color: '#f87171',
                    padding: '1rem',
                    marginBottom: '1.5rem',
                    border: '1px solid rgba(255, 0, 0, 0.3)'
                }}>
                    {error}
                </div>
            )}

            <div className="main-grid">
                {/* Step Navigation */}
                <div style={{ gridColumn: "1 / -1" }}>
                    {prediction && (
                        <div className="step-navigation">
                            <button
                                className={`step-btn ${step === 1 ? 'active' : ''}`}
                                onClick={() => setStep(1)}
                            >
                                📝 Handwriting
                            </button>
                            <div style={{ width: "2rem", height: "2px", background: "rgba(255,255,255,0.2)", margin: "0 1rem" }}></div>
                            <button
                                className={`step-btn ${step === 2 ? 'active' : ''}`}
                                onClick={() => setStep(2)}
                            >
                                🎙️ Voice Analysis
                            </button>
                        </div>
                    )}
                </div>

                {step === 1 ? (
                    <>
                        {/* Upload Section */}
                        <div className="card upload-card">
                            <h2 className="card-title">
                                <span className="icon">📤</span>
                                Upload spiral image
                            </h2>

                            <label className="upload-area">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileChange}
                                    className="file-input"
                                />
                                {preview ? (
                                    <div className="preview-container">
                                        <img src={preview} alt="Scan Preview" className="preview-image" />
                                        <div className="preview-overlay">
                                            <span>Click to change scan</span>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="upload-placeholder">
                                        <div className="upload-icon">📤</div>
                                        <p className="upload-text">Click to upload spiral image</p>
                                        <p className="upload-subtext">PNG, JPG up to 10MB</p>
                                    </div>
                                )}
                            </label>

                            <button
                                onClick={handleSubmit}
                                disabled={loading || !selectedFile}
                                className="analyze-btn"
                            >
                                {loading ? (
                                    <>
                                        <span className="spinner"></span>
                                        Analyzing...
                                    </>
                                ) : (
                                    <>
                                        <span className="icon">🧠</span>
                                        Analyze Scan
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Results Section */}
                        <div className="card results-card">
                            <h2 className="card-title">
                                <span className="icon">📊</span>
                                Analysis Results
                            </h2>

                            {prediction ? (
                                <div className="results-content">
                                    {/* Prediction Card */}
                                    <div className={`prediction-card ${isPositive ? 'positive' : 'negative'}`}>
                                        <div className="prediction-header">
                                            <span className="status-icon">{isPositive ? '⚠️' : '✅'}</span>
                                            <div>
                                                <p className="prediction-label">Prediction</p>
                                                <p className="prediction-value">{prediction}</p>
                                            </div>
                                        </div>
                                        <div className="confidence-section">
                                            <div className="confidence-header">
                                                <span>Confidence Level</span>
                                                <span className="confidence-value">{confidencePercent.toFixed(2)}%</span>
                                            </div>
                                            <div className="progress-bar">
                                                <div
                                                    className={`progress-fill ${isPositive ? 'positive' : 'negative'}`}
                                                    style={{ width: `${confidencePercent}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Summary */}
                                    {sections?.summary && (
                                        <div className="summary-card">
                                            <h3 className="section-title">
                                                <span className="icon">💡</span>
                                                Summary
                                            </h3>
                                            <p className="summary-text">{sections.summary}</p>
                                        </div>
                                    )}

                                    <button
                                        className="analyze-btn"
                                        style={{ marginTop: "1rem", background: "linear-gradient(135deg, #10b981 0%, #059669 100%)" }}
                                        onClick={() => setStep(2)}
                                    >
                                        Proceed to Voice Analysis →
                                    </button>
                                </div>
                            ) : (
                                <div className="empty-state">
                                    <div className="empty-icon">🧠</div>
                                    <p>Upload and analyze a scan to see results</p>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    /* --- Voice Step --- */
                    <div className="card" style={{ gridColumn: "1 / -1" }}>
                        <h2 className="card-title" style={{ justifyContent: "center" }}>
                            <span className="icon">🎙️</span>
                            Voice Analysis
                        </h2>

                        <div className="voice-interface">
                            {voiceError && (
                                <div style={{ color: "#f87171", background: "rgba(255,0,0,0.1)", padding: "1rem", borderRadius: "0.5rem" }}>
                                    {voiceError}
                                </div>
                            )}

                            <div className={`recorder-status`}>
                                {isRecording && <div className="recording-visualizer"></div>}
                                <button
                                    className={`record-btn-large ${isRecording ? 'recording' : ''}`}
                                    onClick={isRecording ? stopRecording : startRecording}
                                    disabled={voiceLoading}
                                >
                                    {isRecording ? '⏹' : '🎙'}
                                </button>
                            </div>

                            {isRecording && <div className="timer">00:{recordingTime < 10 ? `0${recordingTime}` : recordingTime}</div>}

                            {!isRecording && !voiceFile && (
                                <p style={{ color: "rgba(255,255,255,0.7)" }}>Click microphone to record (5s recommended) or upload below</p>
                            )}

                            {!isRecording && voiceFile && (
                                <div style={{ textAlign: "center" }}>
                                    <p style={{ color: "#89cff0", marginBottom: "1rem" }}>
                                        ✅ Audio ready: {voiceFile.name}
                                    </p>
                                    <button
                                        onClick={analyzeVoice}
                                        disabled={voiceLoading}
                                        className="analyze-btn"
                                        style={{ maxWidth: "300px", margin: "0 auto" }}
                                    >
                                        {voiceLoading ? (
                                            <>
                                                <span className="spinner"></span>
                                                Analyzing Voice...
                                            </>
                                        ) : (
                                            <>
                                                Analyze Voice
                                            </>
                                        )}
                                    </button>
                                </div>
                            )}

                            <label className="voice-upload-label">
                                Input pre-recorded file
                                <input type="file" accept="audio/*" onChange={handleVoiceUpload} className="voice-file-input" />
                            </label>

                            {voicePrediction && (
                                <div className={`prediction-card ${voicePrediction.toLowerCase().includes("positive") || voicePrediction.toLowerCase().includes("parkinson") ? 'positive' : 'negative'}`} style={{ width: "100%", maxWidth: "500px" }}>
                                    <div className="prediction-header">
                                        <span className="status-icon">
                                            {voicePrediction.toLowerCase().includes("parkinson") ? '⚠️' : '✅'}
                                        </span>
                                        <div>
                                            <p className="prediction-label">Voice Prediction</p>
                                            <p className="prediction-value">{voicePrediction}</p>
                                        </div>
                                    </div>
                                    <div className="confidence-section">
                                        <div className="confidence-header">
                                            <span>Confidence Level</span>
                                            <span className="confidence-value">{voiceConfidence}%</span>
                                        </div>
                                        <div className="progress-bar">
                                            <div
                                                className={`progress-fill ${voicePrediction.toLowerCase().includes("parkinson") ? 'positive' : 'negative'}`}
                                                style={{ width: `${voiceConfidence}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                        </div>
                    </div>
                )}
            </div>

            {/* Recommendations Section - Only show in Step 1 for now or shared? Shared but below. */}
            {step === 1 && sections && (
                <div className="recommendations-grid">
                    {sections.lifestyle && (
                        <div className="card recommendation-card">
                            <h3 className="card-title">
                                <span className="icon">❤️</span>
                                Lifestyle Tips
                            </h3>
                            <div className="recommendation-content">
                                <AdviceList content={sections.lifestyle} />
                            </div>
                        </div>
                    )}

                    {sections.healthcare && (
                        <div className="card recommendation-card">
                            <h3 className="card-title">
                                <span className="icon">🏥</span>
                                Healthcare Steps
                            </h3>
                            <div className="recommendation-content">
                                <AdviceList content={sections.healthcare} />
                            </div>
                        </div>
                    )}

                    {sections.prevention && (
                        <div className="card recommendation-card">
                            <h3 className="card-title">
                                <span className="icon">🛡️</span>
                                Prevention
                            </h3>
                            <div className="recommendation-content">
                                <AdviceList content={sections.prevention} />
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default PatientDashboard;
