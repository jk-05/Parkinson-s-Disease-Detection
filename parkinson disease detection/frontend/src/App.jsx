import React, { useState } from "react";
import axios from "axios";
import "./App.css";

// ⚠️ SECURITY NOTE: In a real application, replace this with an environment variable 
// (e.g., process.env.REACT_APP_GEMINI_API_KEY).
const GEMINI_API_KEY = "AIzaSyCcyCnH7XNcGYIUk2iG2WE0a1K0hahvuEE";
const GEMINI_API_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";


// --- Utility Functions ---

/**
 * Parses the raw advice text from the Gemini API into structured sections.
 */
const parseAdvice = (text) => {
  const sections = {
    summary: "",
    lifestyle: "",
    healthcare: "",
    prevention: ""
  };

  // Robust regex to capture content between section markers
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

/**
 * Component to render bulleted text as a proper HTML list, 
 * correcting the issue of displaying raw text inside the list containers.
 */
const AdviceList = ({ content }) => {
  if (!content) return null;

  // Split by newline, filter empty lines, and clean up leading bullet points (•, -, *)
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

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [prediction, setPrediction] = useState("");
  const [confidence, setConfidence] = useState(0); // Changed to a number for calculation safety
  const [advice, setAdvice] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setSelectedFile(file);
    setPrediction("");
    setConfidence(0);
    setAdvice("");
    setError(null); // Clear previous errors

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

      // Use destructuring with default values for safety
      const { result, confidence: confidenceValue = 0.5 } = predictionResponse.data;
      const confidencePercent = (parseFloat(confidenceValue) * 100).toFixed(2);

      setPrediction(result);
      setConfidence(confidencePercent);

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
      <div className="header">
        <div className="header-content">
          <div className="brain-icon">🧠</div>
          <h1>NeuroScan AI</h1>
        </div>
        <p className="subtitle">Advanced Parkinson's Disease Detection System</p>
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
                {/* FIX: Image now uses object-fit: contain in CSS */}
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
            </div>
          ) : (
            <div className="empty-state">
              <div className="empty-icon">🧠</div>
              <p>Upload and analyze a scan to see results</p>
            </div>
          )}
        </div>
      </div>

      {/* Recommendations Section */}
      {sections && (
        <div className="recommendations-grid">
          {sections.lifestyle && (
            <div className="card recommendation-card">
              <h3 className="card-title">
                <span className="icon">❤️</span>
                Lifestyle Tips
              </h3>
              <div className="recommendation-content">
                <AdviceList content={sections.lifestyle} /> {/* Use new helper */}
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
                <AdviceList content={sections.healthcare} /> {/* Use new helper */}
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
                <AdviceList content={sections.prevention} /> {/* Use new helper */}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Disclaimer */}
      <div className="disclaimer">
        <p>
          <strong>Disclaimer:</strong> This AI-powered tool is for screening purposes only and does not constitute medical diagnosis.
          Please consult with a qualified healthcare professional for proper medical evaluation and treatment.
        </p>
      </div>
    </div>
  );
}

export default App;