def predict_progression(risk_score, age, symptom_score=0.0):
    progression = []

    if risk_score < 0.3:
        progression.append({"year": 1, "stage": "Minimal symptoms"})
        progression.append({"year": 3, "stage": "No significant progression"})
        progression.append({"year": 5, "stage": "Stable condition"})

    elif risk_score < 0.6:
        progression.append({"year": 1, "stage": "Mild tremor"})
        progression.append({"year": 3, "stage": "Motor coordination issues"})
        progression.append({"year": 5, "stage": "Speech difficulty possible"})

    else:
        progression.append({"year": 1, "stage": "Moderate tremor"})
        progression.append({"year": 3, "stage": "Motor impairment"})
        progression.append({"year": 5, "stage": "Balance issues and stiffness"})

    # age factor
    if age and age > 60:
        progression.append({"year": 7, "stage": "Possible mobility assistance required"})
    
    return progression

def estimate_stage(risk_score):
    if risk_score < 0.3:
        return "Stage 0 - No symptoms"
    elif risk_score < 0.5:
        return "Stage 1 - Mild symptoms"
    elif risk_score < 0.7:
        return "Stage 2 - Bilateral symptoms"
    else:
        return "Stage 3 - Balance impairment"
