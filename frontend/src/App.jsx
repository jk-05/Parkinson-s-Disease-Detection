import React, { useState } from "react";
import { BrowserRouter as Router, Routes, Route, Navigate } from "react-router-dom";
import Login from "./Login";
import DoctorDashboard from "./DoctorDashboard";
import PatientDashboard from "./PatientDashboard";
import Register from "./Register";
import "./App.css";

// Protected Route Component
const ProtectedRoute = ({ children, role }) => {
    const userRole = localStorage.getItem("userRole");

    if (!userRole) {
        return <Navigate to="/" replace />;
    }

    if (role && userRole !== role) {
        return <Navigate to="/" replace />;
    }

    return children;
};

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Login />} />
                <Route path="/register" element={<Register />} />

                <Route
                    path="/patient"
                    element={
                        <ProtectedRoute role="patient">
                            <PatientDashboard />
                        </ProtectedRoute>
                    }
                />

                <Route
                    path="/doctor"
                    element={
                        <ProtectedRoute role="doctor">
                            <DoctorDashboard />
                        </ProtectedRoute>
                    }
                />

                {/* Fallback */}
                <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
        </Router>
    );
}

export default App;