import React, { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import "./App.css";

function Login() {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [role, setRole] = useState("patient"); // Default role
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const response = await axios.post("http://127.0.0.1:5000/login", {
                username,
                password,
                role
            });

            if (response.data.message === "Login successful") {
                localStorage.setItem("userRole", role);
                localStorage.setItem("username", response.data.name); // Using real name
                localStorage.setItem("patientId", response.data.id); // Save ID for saving results

                if (role === "doctor") {
                    navigate("/doctor");
                } else {
                    navigate("/patient");
                }
            }
        } catch (err) {
            setError("Invalid credentials or role selected.");
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container" style={{
            backgroundImage: `linear-gradient(rgba(0,0,0,0.6), rgba(0,0,0,0.7)), url('/login_bg.png')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
        }}>
            <div className="card login-card">
                <div className="login-header">
                    <div className="brain-icon" style={{ fontSize: "3rem", marginBottom: "0.5rem" }}>🧠</div>
                    <h1>NeuroScan Login</h1>
                    <p>Parkinson's Disease Detection System</p>
                </div>

                {error && <div className="error-message">{error}</div>}

                <form onSubmit={handleLogin} className="login-form">
                    <div className="form-group">
                        <label>Role</label>
                        <div className="role-selector">
                            <button
                                type="button"
                                className={`role-btn ${role === 'patient' ? 'active' : ''}`}
                                onClick={() => setRole('patient')}
                            >
                                Patient
                            </button>
                            <button
                                type="button"
                                className={`role-btn ${role === 'doctor' ? 'active' : ''}`}
                                onClick={() => setRole('doctor')}
                            >
                                Doctor
                            </button>
                        </div>
                    </div>

                    <div className="form-group">
                        <label>Username</label>
                        <input
                            type="text"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            placeholder="Enter username"
                            required
                        />
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <input
                            type="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter password"
                            required
                        />
                    </div>

                    <button type="submit" className="analyze-btn" disabled={loading}>
                        {loading ? "Logging in..." : "Login"}
                    </button>
                </form>

                {role === 'patient' && (
                    <p style={{ marginTop: "1rem", textAlign: "center" }}>
                        New Patient? <Link to="/register" style={{ color: "#89cff0", textDecoration: "none" }}>Register Here</Link>
                    </p>
                )}

                <p style={{ marginTop: "1rem", fontSize: "0.8rem", color: "rgba(255,255,255,0.5)", textAlign: "center" }}>
                    Doctor: <b>doctor / password</b>
                </p>
            </div>
        </div>
    );
}

export default Login;
