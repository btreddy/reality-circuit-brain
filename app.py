import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai

app = Flask(__name__)
CORS(app)

# ==========================================
# 🔑 PRODUCTION CONFIGURATION (Google Gemini)
# ==========================================
# 1. Tries to get key from Server Environment (Best Practice)
# 2. Falls back to your specific key for local testing
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "AIzaSyDbOz5XrF4XlKfXWetgdDjpbqIYpEiKQ_U")

genai.configure(api_key=GOOGLE_API_KEY)

# Use "gemini-1.5-pro" for best reasoning logic
model = genai.GenerativeModel('gemini-1.5-pro')

# ==========================================
# 🧠 THE SCIENTIFIC FRAMEWORK (Your PDF Logic)
# ==========================================
THINKING_FRAMEWORK = """
REFERENCE DOCUMENT: 'The Thinking Processes in Humans and AI'

PHASE 1: HUMAN THINKING FACTORS
1. Biological: Neuroplasticity, age, and physical state (fatigue/hunger) impact focus (Ego Depletion).
2. Cognitive: Memory, attention, and BIASES (confirmation bias) skew judgment.
3. Emotional: Mood (stress/urgency) alters risk assessment.
4. Social: Social interactions and peer feedback are required for grounded thinking.

PHASE 2: AI/FEASIBILITY FACTORS
1. Data Quality: Biased or incomplete data leads to flawed outputs (GIGO).
2. Resource/Computational: Limited by hardware (money/energy) and efficiency.
3. Environmental Context: Static datasets (plans on paper) fail in dynamic real-world environments.

KEY TAKEAWAY:
A Grounded Idea must pass BOTH filters.
"""

# ==========================================
# ⚙️ LOGIC ENGINE (Calculates Score)
# ==========================================
def calculate_grounded_score(physical, social, emotional, motivation):
    score = 100
    flags = []
    
    if physical in ['tired', 'hungry', 'sick']:
        score -= 25
        flags.append("Biological Risk: Physical State (Fatigue/Hunger)")

    if social == 'none':
        score -= 20
        flags.append("Cognitive Risk: Lack of Peer Feedback (Echo Chamber)")

    if emotional == 'urgency':
        score -= 20
        flags.append("Emotional Risk: Urgency/Stress State")

    if motivation == 'extrinsic':
        score -= 10
        flags.append("Motivation Risk: Extrinsic Drivers (Money/Hype)")

    return {'score': max(score, 0), 'flags': flags}

# ==========================================
# 🤖 INTELLIGENCE LAYER (Gemini Analysis)
# ==========================================
def generate_scientific_analysis(score, flags, user_idea):
    
    full_prompt = f"""
    SYSTEM INSTRUCTION:
    You are 'The Reality Circuit', a scientific decision-support engine.
    You analyze ideas based STRICTLY on the provided 'Thinking Framework'.
    
    FRAMEWORK DATA:
    {THINKING_FRAMEWORK}
    
    YOUR TASK:
    1. Review the User's Idea and their 'Human State' (Flags).
    2. Cross-reference this with the 'Reference Document' rules.
    3. Generate a 'Reality Prescription' in 3 distinct parts:
       - THE DIAGNOSIS: Identify which specific factor (Biological/Cognitive/Data) is the biggest threat.
       - THE PREDICTION: Predict how this idea will fail if they execute it NOW.
       - THE PRESCRIPTION: One scientific action to take.
    
    Keep it professional, direct, and under 100 words.

    USER INPUT:
    - IDEA: "{user_idea}"
    - CURRENT STATE FLAGS: {", ".join(flags) if flags else "None. State is Optimal."}
    - REALITY SCORE: {score}/100.
    """

    try:
        response = model.generate_content(full_prompt)
        return response.text
    except Exception as e:
        print(f"API Error: {e}")
        return "System Overload. The Reality Engine is currently offline."

# ==========================================
# 🚀 API ENDPOINT
# ==========================================
@app.route('/calculate', methods=['POST'])
def analyze():
    data = request.json
    
    idea = data.get('user_idea', 'No idea provided')
    physical = data.get('physical_state')
    social = data.get('social_feedback')
    emotional = data.get('emotional_state')
    motivation = data.get('motivation')

    result = calculate_grounded_score(physical, social, emotional, motivation)

    # Scientific Analysis
    result['prescription'] = generate_scientific_analysis(result['score'], result['flags'], idea)

    return jsonify(result)

if __name__ == '__main__':
    # Use the PORT provided by Render/Cloud, default to 8080 locally
    port = int(os.environ.get("PORT", 8080))
    app.run(host='0.0.0.0', port=port)