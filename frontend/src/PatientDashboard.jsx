import React, { useState, useRef, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import html2pdf from "html2pdf.js";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
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
        .filter(item => item.length > 0 && !item.startsWith('###'))
        // Filter out lines that are just a single bullet/asterisk or empty bold tags
        .filter(item => item.replace(/^[•\-\*]+\s*$/, '').length > 0)
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
    const [heatmapBase64, setHeatmapBase64] = useState(null);
    const [advice, setAdvice] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const [finalRiskScore, setFinalRiskScore] = useState(0);
    const [progressionData, setProgressionData] = useState(null);
    const [estimatedStage, setEstimatedStage] = useState("");

    // --- Voice UI State ---
    const [step, setStep] = useState(1); // 1: Handwriting, 2: Voice
    const [voiceFile, setVoiceFile] = useState(null);
    const [isRecording, setIsRecording] = useState(false);
    const [recordingTime, setRecordingTime] = useState(0);
    const [mediaRecorder, setMediaRecorder] = useState(null);
    const [voicePrediction, setVoicePrediction] = useState(null);
    const [voiceConfidence, setVoiceConfidence] = useState(0);
    const [voiceMetrics, setVoiceMetrics] = useState(null);
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
            setVoiceMetrics(null);
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
            setVoiceMetrics(null);
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
            const metrics = response.data.metrics;
            const risk = response.data.final_risk || (response.data.voice_score || 0);

            setFinalRiskScore(risk);
            setVoicePrediction(res);
            setVoiceConfidence(conf);
            setVoiceMetrics(metrics);

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

            const { result, confidence: confidenceValue = 0.5, heatmap } = predictionResponse.data;
            const confidencePercent = (parseFloat(confidenceValue) * 100).toFixed(2);

            setPrediction(result);
            setConfidence(confidencePercent);
            if (heatmap && !heatmap.startsWith('ERROR')) {
                setHeatmapBase64(heatmap);
            }

            // Save result
            saveToDb('spiral', result, confidencePercent);

            // Transition directly to Voice Analysis
            setStep(2);

        } catch (err) {
            console.error("Analysis Error:", err);
            setError("Error: Could not complete analysis. Check network, backend server, and API key.");
        } finally {
            setLoading(false);
        }
    };

    const generateFinalReport = async () => {
        if (!prediction || !voicePrediction) {
            setError("Both Handwriting and Voice tests must be completed to generate the final report.");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const patientAge = localStorage.getItem("patientAge") || "Unknown";

            // Generate advice from Gemini using COMBINED results
            const prompt = `
You are an expert neurological health advisor. Provide a clear, empathetic, and supportive response analyzing a patient's Parkinson's Disease risk profile based on two distinct AI diagnostic tests.

Patient's Results:
- Age: ${patientAge}
1. Spiral Handwriting Analysis Scan Result: "${prediction}" (Confidence: ${confidence}%)
2. Voice Analysis Result: "${voicePrediction}" (Confidence: ${voiceConfidence}%)
   - Pitch Instability: ${voiceMetrics?.pitch_instability?.toFixed(2)} (Normal: < 0.5)
   - Tremor Index: ${voiceMetrics?.tremor_index?.toFixed(2)} (Normal: < 0.5)
   - Pause Ratio: ${voiceMetrics?.pause_ratio?.toFixed(2)} (Normal: < 0.5)
   - Energy Variation: ${voiceMetrics?.energy_variation?.toFixed(2)} (Normal: < 0.5)

Considering BOTH of these sets of inputs and metrics (along with the patient's age), provide advice using the following structure with clear section markers:

[SUMMARY]
One brief sentence combined overview and immediate recommended action based on the overall risk.

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
Provide ONLY 3-4 key preventive measures/next steps (one line each) based on the combined final prediction:
- If high risk in either test: Urgent neurologist consultation, medication management, commence physical therapy, establish support network.
- If negative/low risk in both: Maintain daily high-intensity aerobic exercise, consistent cognitive challenge (puzzles/reading), annual neurological wellness checkup, balanced anti-inflammatory diet.

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

            // Fetch Progression Data
            try {
                // Calculate true risk score for progression
                let spiralRisk = prediction.toLowerCase().includes("parkinson") || prediction.toLowerCase().includes("positive")
                    ? parseFloat(confidence) / 100
                    : 1 - (parseFloat(confidence) / 100);

                let voiceRisk = finalRiskScore;
                if (voiceRisk === 0 || !voiceRisk) {
                    voiceRisk = voicePrediction.toLowerCase().includes("parkinson") || voicePrediction.toLowerCase().includes("positive")
                        ? parseFloat(voiceConfidence) / 100
                        : 1 - (parseFloat(voiceConfidence) / 100);
                }

                const combinedRiskScore = (spiralRisk + voiceRisk) / 2;

                const age = parseInt(localStorage.getItem("patientAge")) || 65;
                const progRes = await axios.post("http://127.0.0.1:5000/predict-progression", {
                    risk_score: combinedRiskScore,
                    age: age,
                    symptom_score: voiceMetrics?.tremor_index || 0
                });
                setProgressionData(progRes.data.progression);
                setEstimatedStage(progRes.data.estimated_stage);
            } catch (pErr) {
                console.error("Progression Error:", pErr);
            }

        } catch (err) {
            console.error("AI Generation Error:", err);
            setError("Error: Could not generate AI report. Check API key and network.");
        } finally {
            setLoading(false);
        }
    };

    const downloadPDF = () => {
        const element = document.getElementById('report-content');
        if (!element) return;

        const opt = {
            margin: 0.5,
            filename: 'NeuroScan_AI_Report.pdf',
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2 },
            jsPDF: { unit: 'in', format: 'letter', orientation: 'portrait' }
        };

        html2pdf().set(opt).from(element).save();
    };

    const sections = advice ? parseAdvice(advice) : null;
    const isPositive = prediction.toLowerCase().includes("positive") || prediction.toLowerCase().includes("parkinson");
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
                <div style={{ gridColumn: "1 / -1", marginBottom: "1rem", display: "flex", justifyContent: "center" }}>
                    <div className="step-navigation" style={{ display: "flex", alignItems: "center" }}>
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
                        <div style={{ width: "2rem", height: "2px", background: "rgba(255,255,255,0.2)", margin: "0 1rem" }}></div>
                        <button
                            className={`step-btn ${step === 3 ? 'active' : ''}`}
                            onClick={() => setStep(3)}
                        >
                            📄 Final Report
                        </button>
                    </div>
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

                                    {/* Spiral Deviation & Heatmap Section */}
                                    <div style={{ marginTop: "1.5rem", background: "rgba(0,0,0,0.2)", padding: "1rem", borderRadius: "8px" }}>
                                        <h4 style={{ marginBottom: "1rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                            <span className="icon">🔍</span> Spiral Deviation Visualizer
                                        </h4>

                                        {heatmapBase64 && heatmapBase64 !== "null" && !heatmapBase64.startsWith('ERROR') ? (
                                            <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", justifyContent: "center" }}>
                                                <div style={{ textAlign: "center", flex: "1 1 auto" }}>
                                                    <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.6)", marginBottom: "0.5rem" }}>Original Scan</p>
                                                    <img src={preview} alt="Original" style={{ maxWidth: "200px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)" }} />
                                                </div>
                                                <div style={{ textAlign: "center", flex: "1 1 auto" }}>
                                                    <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.6)", marginBottom: "0.5rem" }}>Grad-CAM Heatmap</p>
                                                    <img src={`data:image/jpeg;base64,${heatmapBase64}`} alt="Heatmap" style={{ maxWidth: "200px", borderRadius: "8px", border: "1px solid rgba(239, 68, 68, 0.4)" }} />
                                                    <p style={{ fontSize: "0.75rem", color: "#f87171", marginTop: "0.5rem", maxWidth: "200px", margin: "0.5rem auto 0 auto", lineHeight: "1.4" }}>* Red highlighted regions indicate specific deviations (micrographia, tremors) triggering the AI detection.</p>
                                                </div>
                                            </div>
                                        ) : (
                                            <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.5)", textAlign: "center", padding: "1rem 0" }}>
                                                {heatmapBase64?.startsWith('ERROR') ? "The AI was not able to generate a deviation map for this scan structure." : "Heatmap visualization loading or not available."}
                                            </p>
                                        )}
                                    </div>

                                    {/* Algorithm Parameters Box */}
                                    <div style={{ marginTop: "1rem", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px", padding: "1rem" }}>
                                        <details>
                                            <summary style={{ cursor: "pointer", fontWeight: "600", color: "#60a5fa", display: "flex", alignItems: "center", gap: "0.5rem", userSelect: "none" }}>
                                                <span>⚙️ Algorithm Parameters & Details</span>
                                            </summary>
                                            <div style={{ marginTop: "1rem", fontSize: "0.85rem", color: "rgba(255,255,255,0.8)", lineHeight: "1.6" }}>
                                                <ul style={{ paddingLeft: "1.2rem", margin: 0 }}>
                                                    <li><strong>Model Architecture:</strong> MobileNetV2 Transfer Learning (CNN)</li>
                                                    <li><strong>Input Resolution:</strong> 224x224 RGB</li>
                                                    <li><strong>Visual Mapping:</strong> Grad-CAM (Gradient-weighted Class Activation Mapping)</li>
                                                    <li><strong>Detection Parameters:</strong>
                                                        <ul style={{ paddingLeft: "1.2rem", marginTop: "0.25rem", color: "rgba(255,255,255,0.6)" }}>
                                                            <li>Line fluctuations / Kinematic tremors</li>
                                                            <li>Micrographia (abnormally small, cramped handwriting)</li>
                                                            <li>Spiral velocity anomalies and pen-lifts</li>
                                                        </ul>
                                                    </li>
                                                </ul>
                                            </div>
                                        </details>
                                    </div>

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
                ) : step === 2 ? (
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
                                    {voiceMetrics && (
                                        <div className="metrics-table-container" style={{ marginTop: "1rem", background: "rgba(0,0,0,0.2)", borderRadius: "8px", overflow: "hidden" }}>
                                            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "0.9rem", color: "rgba(255,255,255,0.9)" }}>
                                                <thead>
                                                    <tr style={{ background: "rgba(255,255,255,0.1)", borderBottom: "1px solid rgba(255,255,255,0.2)" }}>
                                                        <th style={{ padding: "0.75rem", fontWeight: "600" }}>Metric</th>
                                                        <th style={{ padding: "0.75rem", fontWeight: "600" }}>Your Score</th>
                                                        <th style={{ padding: "0.75rem", fontWeight: "600" }}>Normal Limit</th>
                                                        <th style={{ padding: "0.75rem", fontWeight: "600" }}>Parkinson's Indication</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                                        <td style={{ padding: "0.75rem" }}>Pitch Instability</td>
                                                        <td style={{ padding: "0.75rem", fontWeight: "bold", color: voiceMetrics.pitch_instability > 0.5 ? "#f87171" : "#4ade80" }}>{voiceMetrics.pitch_instability.toFixed(2)}</td>
                                                        <td style={{ padding: "0.75rem", color: "rgba(255,255,255,0.6)" }}>&lt; 0.50</td>
                                                        <td style={{ padding: "0.75rem", color: "rgba(255,255,255,0.6)" }}>&gt; 0.50</td>
                                                    </tr>
                                                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                                        <td style={{ padding: "0.75rem" }}>Tremor Index</td>
                                                        <td style={{ padding: "0.75rem", fontWeight: "bold", color: voiceMetrics.tremor_index > 0.5 ? "#f87171" : "#4ade80" }}>{voiceMetrics.tremor_index.toFixed(2)}</td>
                                                        <td style={{ padding: "0.75rem", color: "rgba(255,255,255,0.6)" }}>&lt; 0.50</td>
                                                        <td style={{ padding: "0.75rem", color: "rgba(255,255,255,0.6)" }}>&gt; 0.50</td>
                                                    </tr>
                                                    <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                                                        <td style={{ padding: "0.75rem" }}>Pause Ratio</td>
                                                        <td style={{ padding: "0.75rem", fontWeight: "bold", color: voiceMetrics.pause_ratio > 0.5 ? "#f87171" : "#4ade80" }}>{voiceMetrics.pause_ratio.toFixed(2)}</td>
                                                        <td style={{ padding: "0.75rem", color: "rgba(255,255,255,0.6)" }}>&lt; 0.50</td>
                                                        <td style={{ padding: "0.75rem", color: "rgba(255,255,255,0.6)" }}>&gt; 0.50</td>
                                                    </tr>
                                                    <tr>
                                                        <td style={{ padding: "0.75rem" }}>Energy Variation</td>
                                                        <td style={{ padding: "0.75rem", fontWeight: "bold", color: voiceMetrics.energy_variation > 0.5 ? "#f87171" : "#4ade80" }}>{voiceMetrics.energy_variation.toFixed(2)}</td>
                                                        <td style={{ padding: "0.75rem", color: "rgba(255,255,255,0.6)" }}>&lt; 0.50</td>
                                                        <td style={{ padding: "0.75rem", color: "rgba(255,255,255,0.6)" }}>&gt; 0.50</td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>
                                    )}
                                </div>
                            )}

                        </div>
                    </div>
                ) : (
                    <div className="card" style={{ gridColumn: "1 / -1" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <h2 className="card-title" style={{ margin: 0 }}>
                                <span className="icon">📄</span>
                                Comprehensive Final Report
                            </h2>
                            {sections && (
                                <button className="analyze-btn" style={{ width: "auto", margin: 0, padding: "0.5rem 1rem", fontSize: "0.9rem" }} onClick={downloadPDF}>
                                    📥 Download PDF
                                </button>
                            )}
                        </div>

                        {prediction && voicePrediction ? (
                            <div style={{ marginTop: "1.5rem" }} id="report-content">
                                <p style={{ color: "rgba(255,255,255,0.8)", marginBottom: "1rem" }}>
                                    This report synthesizes the inputs from both your handwriting analysis and voice tests to give you personalized AI-driven healthcare and lifestyle recommendations.
                                </p>

                                <div style={{ display: "flex", gap: "1rem", marginBottom: "1.5rem" }}>
                                    <div style={{ flex: 1, background: "rgba(255,255,255,0.05)", padding: "1rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)" }}>
                                        <strong>📝 Handwriting Result:</strong>
                                        <div style={{ color: prediction.toLowerCase().includes("positive") || prediction.toLowerCase().includes("parkinson") ? "#f87171" : "#4ade80", fontWeight: "bold", marginTop: "0.5rem" }}>{prediction}</div>
                                        <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.6)", marginTop: "0.25rem" }}>Confidence: {confidence}%</div>
                                    </div>
                                    <div style={{ flex: 1, background: "rgba(255,255,255,0.05)", padding: "1rem", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.1)" }}>
                                        <strong>🎙️ Voice Result:</strong>
                                        <div style={{ color: voicePrediction.toLowerCase().includes("positive") || voicePrediction.toLowerCase().includes("parkinson") ? "#f87171" : "#4ade80", fontWeight: "bold", marginTop: "0.5rem" }}>{voicePrediction}</div>
                                        <div style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.6)", marginTop: "0.25rem" }}>Confidence: {voiceConfidence}%</div>
                                    </div>
                                </div>

                                {!sections ? (
                                    <div style={{ textAlign: "center", padding: "2rem" }}>
                                        <button className="analyze-btn" disabled={loading} onClick={generateFinalReport}>
                                            {loading ? (
                                                <><span className="spinner"></span> Generating Combined Recommendations...</>
                                            ) : (
                                                "🤖 Generate AI Report"
                                            )}
                                        </button>
                                    </div>
                                ) : (
                                    <>
                                        {sections.summary && (
                                            <div className="summary-card" style={{ marginBottom: "1.5rem" }}>
                                                <h3 className="section-title">
                                                    <span className="icon">💡</span>
                                                    Executive Summary
                                                </h3>
                                                <p className="summary-text" style={{ fontSize: "1.1rem" }}>{sections.summary}</p>
                                            </div>
                                        )}

                                        <div className="recommendations-grid" style={{ gridTemplateColumns: "1fr" }}>
                                            {sections.lifestyle && (
                                                <div className="card recommendation-card" style={{ background: "rgba(0,0,0,0.2)" }}>
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
                                                <div className="card recommendation-card" style={{ background: "rgba(0,0,0,0.2)" }}>
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
                                                <div className="card recommendation-card" style={{ background: "rgba(0,0,0,0.2)" }}>
                                                    <h3 className="card-title">
                                                        <span className="icon">🛡️</span>
                                                        Prevention & Next Steps
                                                    </h3>
                                                    <div className="recommendation-content">
                                                        <AdviceList content={sections.prevention} />
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Progression Timeline Simulator */}
                                        {progressionData && (
                                            <div className="card" style={{ marginTop: "1.5rem", background: "rgba(0,0,0,0.25)" }}>
                                                <h3 className="card-title" style={{ justifyContent: "center", marginBottom: "1rem" }}>
                                                    <span className="icon">📈</span>
                                                    Parkinson Progression Simulator
                                                </h3>
                                                <div style={{ textAlign: "center", marginBottom: "1rem" }}>
                                                    <p style={{ fontSize: "1.1rem", marginBottom: "0.25rem" }}><strong>Estimated Status:</strong> <span style={{ color: "#f87171" }}>{estimatedStage}</span></p>
                                                    <p style={{ fontSize: "0.85rem", color: "rgba(255,255,255,0.5)", marginBottom: "1rem" }}>(Algorithm: Clinical Rule-Based Heuristic using Hoehn & Yahr Staging)</p>
                                                    <p style={{ fontSize: "0.9rem", color: "rgba(255,255,255,0.7)" }}>Predicted progression trajectory based on your current assessment scores:</p>
                                                </div>

                                                <div style={{ width: "100%", height: 300, background: "rgba(255,255,255,0.05)", borderRadius: "8px", padding: "1rem" }}>
                                                    <ResponsiveContainer width="100%" height="100%">
                                                        <LineChart data={progressionData.map(d => ({ year: new Date().getFullYear() + d.year, stageDesc: d.stage, stageVal: d.year }))} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
                                                            <XAxis dataKey="year" stroke="rgba(255,255,255,0.5)" />
                                                            <YAxis stroke="rgba(255,255,255,0.5)" hide={true} />
                                                            <Tooltip
                                                                contentStyle={{ backgroundColor: "#1f2937", border: "1px solid rgba(255,255,255,0.1)", borderRadius: "8px" }}
                                                                itemStyle={{ color: "#4ade80" }}
                                                                labelStyle={{ color: "rgba(255,255,255,0.8)", fontWeight: "bold", marginBottom: "5px" }}
                                                                formatter={(value, name, props) => [props.payload.stageDesc, "Predicted Phase"]}
                                                            />
                                                            <Line type="monotone" dataKey="stageVal" stroke="#3b82f6" strokeWidth={3} dot={{ fill: '#60a5fa', stroke: '#2563eb', strokeWidth: 2, r: 5 }} activeDot={{ r: 8 }} />
                                                        </LineChart>
                                                    </ResponsiveContainer>
                                                </div>

                                                <div style={{ marginTop: "1.5rem", padding: "1rem", background: "rgba(255,255,255,0.05)", borderRadius: "8px" }}>
                                                    <h4 style={{ marginBottom: "0.75rem", color: "rgba(255,255,255,0.9)" }}>Timeline Details</h4>
                                                    <ul style={{ listStyleType: "none", padding: 0, margin: 0 }}>
                                                        {progressionData.map((d, i) => (
                                                            <li key={i} style={{ marginBottom: "0.5rem", display: "flex", alignItems: "center", gap: "10px" }}>
                                                                <span style={{ background: "rgba(59, 130, 246, 0.2)", color: "#93c5fd", padding: "2px 8px", borderRadius: "12px", fontSize: "0.85rem", fontWeight: "bold" }}>Year {new Date().getFullYear() + d.year}</span>
                                                                <span style={{ color: "rgba(255,255,255,0.8)" }}>→ {d.stage}</span>
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                )}
                            </div>
                        ) : (
                            <div className="empty-state">
                                <div className="empty-icon">⏳</div>
                                <p style={{ marginBottom: "1rem" }}>Please complete both the Handwriting and Voice Analysis tests first.</p>
                                <div style={{ display: "flex", gap: "1rem", justifyContent: "center" }}>
                                    <button className={`step-btn ${!prediction ? 'active' : ''}`} style={{ borderColor: prediction ? "#4ade80" : "rgba(255,255,255,0.2)" }} onClick={() => setStep(1)}>
                                        {prediction ? '✅ Handwriting Done' : '1. Do Handwriting'}
                                    </button>
                                    <button className={`step-btn ${!voicePrediction ? 'active' : ''}`} style={{ borderColor: voicePrediction ? "#4ade80" : "rgba(255,255,255,0.2)" }} onClick={() => setStep(2)}>
                                        {voicePrediction ? '✅ Voice Done' : '2. Do Voice'}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default PatientDashboard;
