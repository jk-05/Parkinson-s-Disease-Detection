import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./App.css";

const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";

function DoctorDashboard() {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
    const [analyzingId, setAnalyzingId] = useState(null);
    const [analysisResult, setAnalysisResult] = useState(null);

    const navigate = useNavigate();

    useEffect(() => {
        fetchResults();
    }, []);

    const fetchResults = async () => {
        try {
            const response = await axios.get("http://127.0.0.1:5000/results");
            setResults(response.data);
        } catch (err) {
            console.error("Error fetching results:", err);
        } finally {
            setLoading(false);
        }
    };

    const handleLogout = () => {
        localStorage.removeItem("userRole");
        navigate("/");
    };

    const analyzeCase = async (row) => {
        setAnalyzingId(row.id);
        const prompt = `
You are an expert neurological AI assistant for a doctor. Analyze this patient's Parkinson's Disease case based on the following singular test result and give a quick clinical assessment.

Patient Case:
- Age: ${row.patient_age || "Unknown"}
- Test Performed: ${row.type === 'voice' ? 'Voice Analysis' : 'Spiral Handwriting Scan'}
- Result: ${row.result}
- AI Confidence: ${(row.confidence * 100).toFixed(1)}%

Provide your analysis in EXACTLY this format, nothing else:

[Summary about symptoms based strictly on the test and result]
Recommendation:
• [Action item 1]
• [Action item 2]
• [Action item 3]
`;
        try {
            const geminiResponse = await axios.post(
                `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
                { contents: [{ parts: [{ text: prompt }] }] },
                { headers: { "Content-Type": "application/json" } }
            );

            const aiText = geminiResponse.data.candidates?.[0]?.content?.parts?.[0]?.text || "No analysis generated.";

            // Parse out the recommendations explicitly
            const parts = aiText.split("Recommendation:");
            setAnalysisResult({
                summary: parts[0]?.trim(),
                recommendations: parts[1] ? parts[1].split('\n').filter(r => r.trim() && r.includes('•')).map(r => r.replace(/^[•\-\*]\s*/, '')) : [],
                patientName: row.patient_name || "Unknown"
            });
        } catch (err) {
            console.error("Analysis Error:", err);
            alert("Error: Could not generate AI analysis.");
        } finally {
            setAnalyzingId(null);
        }
    };

    return (
        <div className="app-container">
            <div className="header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexDirection: "row" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
                    <div className="brain-icon" style={{ fontSize: "2rem" }}>🧠</div>
                    <h1 style={{ fontSize: "1.5rem", margin: 0 }}>Doctor Portal</h1>
                </div>
                <button onClick={handleLogout} className="step-btn">Logout</button>
            </div>

            <div className="card" style={{ padding: "1rem", overflowX: "auto" }}>
                <h2 className="card-title">Patient Analysis History</h2>

                {loading ? (
                    <div style={{ textAlign: "center", padding: "2rem" }}>Loading records...</div>
                ) : (
                    <table className="results-table" style={{ width: "100%", borderCollapse: "collapse", color: "white" }}>
                        <thead>
                            <tr style={{ textAlign: "left", borderBottom: "1px solid rgba(255,255,255,0.2)" }}>
                                <th style={{ padding: "1rem" }}>Test #</th>
                                <th style={{ padding: "1rem" }}>Patient Name</th>
                                <th style={{ padding: "1rem" }}>Age</th>
                                <th style={{ padding: "1rem" }}>Contact</th>
                                <th style={{ padding: "1rem" }}>Test Type</th>
                                <th style={{ padding: "1rem" }}>Result</th>
                                <th style={{ padding: "1rem" }}>Confidence</th>
                                <th style={{ padding: "1rem" }}>Date</th>
                                <th style={{ padding: "1rem", textAlign: "center" }}>AI Assistant</th>
                            </tr>
                        </thead>
                        <tbody>
                            {results.map((row, index) => (
                                <tr key={row.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                                    <td style={{ padding: "1rem" }}>#{index + 1}</td>
                                    <td style={{ padding: "1rem" }}>{row.patient_name || "Anonymous"}</td>
                                    <td style={{ padding: "1rem" }}>{row.patient_age || "N/A"}</td>
                                    <td style={{ padding: "1rem" }}>{row.patient_contact || "N/A"}</td>
                                    <td style={{ padding: "1rem" }}>
                                        <span style={{
                                            padding: "0.3rem 0.8rem",
                                            borderRadius: "1rem",
                                            background: row.type === 'voice' ? 'rgba(139, 92, 246, 0.2)' : 'rgba(59, 130, 246, 0.2)',
                                            color: row.type === 'voice' ? '#a78bfa' : '#60a5fa',
                                            fontSize: "0.85rem"
                                        }}>
                                            {row.type === 'voice' ? '🎙️ Voice' : '📝 Spiral'}
                                        </span>
                                    </td>
                                    <td style={{ padding: "1rem" }}>
                                        <span style={{ color: row.result === 'Parkinson' ? '#ef4444' : '#10b981', fontWeight: "bold" }}>
                                            {row.result}
                                        </span>
                                    </td>
                                    <td style={{ padding: "1rem" }}>{(row.confidence * 100).toFixed(1)}%</td>
                                    <td style={{ padding: "1rem", fontSize: "0.9rem", color: "rgba(255,255,255,0.6)" }}>
                                        {new Date(row.timestamp).toLocaleString()}
                                    </td>
                                    <td style={{ padding: "1rem", textAlign: "center" }}>
                                        <button
                                            onClick={() => analyzeCase(row)}
                                            disabled={analyzingId === row.id}
                                            style={{
                                                background: "rgba(74, 222, 128, 0.2)",
                                                border: "1px solid #4ade80",
                                                color: "#4ade80",
                                                padding: "0.4rem 0.8rem",
                                                borderRadius: "4px",
                                                cursor: analyzingId === row.id ? 'not-allowed' : 'pointer',
                                                fontSize: "0.85rem",
                                                display: "flex",
                                                alignItems: "center",
                                                gap: "0.5rem",
                                                margin: "0 auto"
                                            }}
                                        >
                                            {analyzingId === row.id ? <span className="spinner" style={{ width: "12px", height: "12px", borderWidth: "2px" }}></span> : '🤖'}
                                            {analyzingId === row.id ? 'Analyzing...' : 'Analyze Patient Case'}
                                        </button>
                                    </td>
                                </tr>
                            ))}
                            {results.length === 0 && (
                                <tr>
                                    <td colSpan="6" style={{ textAlign: "center", padding: "2rem", color: "rgba(255,255,255,0.4)" }}>
                                        No records found.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                )}
            </div>

            {/* AI Analysis Modal */}
            {analysisResult && (
                <div style={{
                    position: 'fixed',
                    top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.7)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    zIndex: 1000
                }}>
                    <div className="card" style={{ width: '90%', maxWidth: '600px', background: '#1e293b', border: '1px solid #334155' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
                            <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '1.5rem' }}>🤖</span>
                                AI Case Analysis: {analysisResult.patientName}
                            </h3>
                            <button onClick={() => setAnalysisResult(null)} style={{ background: 'none', border: 'none', color: '#f87171', fontSize: '1.5rem', cursor: 'pointer' }}>×</button>
                        </div>

                        <div style={{ background: 'rgba(0,0,0,0.2)', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem' }}>
                            <p style={{ color: 'rgba(255,255,255,0.9)', lineHeight: '1.6', fontSize: '1.05rem', margin: 0 }}>
                                {analysisResult.summary}
                            </p>
                        </div>

                        <div style={{ background: 'rgba(74, 222, 128, 0.05)', border: '1px solid rgba(74, 222, 128, 0.2)', padding: '1.5rem', borderRadius: '8px' }}>
                            <h4 style={{ color: '#4ade80', marginTop: 0, marginBottom: '1rem' }}>Clinical Recommendation:</h4>
                            <ul style={{ margin: 0, paddingLeft: '1.2rem', color: 'rgba(255,255,255,0.85)', lineHeight: '1.8' }}>
                                {analysisResult.recommendations.map((rec, idx) => (
                                    <li key={idx} style={{ marginBottom: "0.5rem" }}>{rec}</li>
                                ))}
                                {analysisResult.recommendations.length === 0 && <li>No specific recommendations generated.</li>}
                            </ul>
                        </div>

                        <div style={{ textAlign: 'right', marginTop: '1.5rem' }}>
                            <button onClick={() => setAnalysisResult(null)} className="analyze-btn" style={{ width: 'auto', padding: '0.5rem 1.5rem' }}>Close</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DoctorDashboard;
