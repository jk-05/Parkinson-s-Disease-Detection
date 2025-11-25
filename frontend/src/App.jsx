import React, { useState } from "react";
import axios from "axios";
import "./App.css"; // Make sure CSS file is imported

function App() {
  const [selectedFile, setSelectedFile] = useState(null);
  const [prediction, setPrediction] = useState("");
  const [preview, setPreview] = useState(null); 
  const [loading, setLoading] = useState(false);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    setSelectedFile(e.target.files[0]);
    setPrediction("");

     if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
      };
      reader.readAsDataURL(file);
    } else {
      setPreview(null);
    }

  };


  const handleSubmit = async () => {
    if (!selectedFile) {
      alert("Please upload an image!");
      return;
    }

    const formData = new FormData();
    formData.append("file", selectedFile);

    setLoading(true);
    try {
      const response = await axios.post(
        "http://127.0.0.1:5000/predict",
        formData,
        {
          headers: { "Content-Type": "multipart/form-data" },
        }
      );
      const confidence = response.data.confidence || 1; // Default 1 if not provided
      setPrediction(
        `${response.data.result} (Confidence: ${(confidence * 100).toFixed(2)}%)`
      );
    } catch (error) {
      console.error(error);
      alert("Error predicting the image. Make sure the backend is running.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <div className="card">
        <h1>🧠 Parkinson Disease Detection</h1>
        <input type="file" accept="image/*" onChange={handleFileChange} />
        {preview && (
          <div className="image-preview">
            <img src={preview} alt="Uploaded Preview" />
          </div>
        )}
        <button onClick={handleSubmit} disabled={loading}>
          {loading ? "Predicting..." : "Predict"}
        </button>

        {prediction && <h2 className="prediction">{prediction}</h2>}
      </div>
    </div>
  );
}

export default App;
