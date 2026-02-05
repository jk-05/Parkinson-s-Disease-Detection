import React, { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "./App.css";

function DoctorDashboard() {
    const [results, setResults] = useState([]);
    const [loading, setLoading] = useState(true);
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
                            </tr>
                        </thead>
                        <tbody>
                            {results.map((row) => (
                                <tr key={row.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.1)" }}>
                                    <td style={{ padding: "1rem" }}>#{row.id}</td>
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
        </div>
    );
}

export default DoctorDashboard;
