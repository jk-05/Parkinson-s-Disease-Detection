import React, { useState } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import "./App.css";

function Register() {
    const [formData, setFormData] = useState({
        name: "",
        username: "",
        password: "",
        age: "",
        contact: ""
    });
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            await axios.post("http://127.0.0.1:5000/register", formData);
            alert("Registration successful! Please login.");
            navigate("/");
        } catch (err) {
            setError(err.response?.data?.error || "Registration failed. Try again.");
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
                    <div className="brain-icon" style={{ fontSize: "2.5rem" }}>📝</div>
                    <h1>Patient Registration</h1>
                </div>

                {error && <div className="error-message" style={{ color: "#f87171", background: "rgba(255,0,0,0.1)", padding: "0.5rem", borderRadius: "4px", marginBottom: "1rem" }}>{error}</div>}

                <form onSubmit={handleRegister} className="login-form">
                    <div className="form-group">
                        <label>Full Name</label>
                        <input name="name" type="text" onChange={handleChange} required placeholder="John Doe" />
                    </div>

                    <div className="form-group">
                        <label>Age</label>
                        <input name="age" type="number" onChange={handleChange} required placeholder="e.g. 65" />
                    </div>

                    <div className="form-group">
                        <label>Contact Number</label>
                        <input name="contact" type="text" onChange={handleChange} required placeholder="+1 234..." />
                    </div>

                    <div className="form-group">
                        <label>Username</label>
                        <input name="username" type="text" onChange={handleChange} required placeholder="Choose a username" />
                    </div>

                    <div className="form-group">
                        <label>Password</label>
                        <input name="password" type="password" onChange={handleChange} required placeholder="Data is secure" />
                    </div>

                    <button type="submit" className="analyze-btn" disabled={loading}>
                        {loading ? "Registering..." : "Create Account"}
                    </button>
                </form>

                <p style={{ marginTop: "1rem", textAlign: "center" }}>
                    Already have an account? <Link to="/" style={{ color: "#89cff0", textDecoration: "none" }}>Login here</Link>
                </p>
            </div>
        </div>
    );
}

export default Register;
