import os
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai

app = Flask(__name__)
CORS(app)

# --- CONFIGURATION ---
# Pull the API key from the environment only. DO NOT hardcode API keys in source.
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "AIzaSyDbOz5XrF4XlKfXWetgdDjpbqIYpEiKQ_U")
genai.configure(api_key=GOOGLE_API_KEY)
if not GOOGLE_API_KEY:
    print("WARNING: GOOGLE_API_KEY is not set in the environment. Model calls will fail until a valid key is configured in the host (Render environment variables). Remove any hardcoded keys from source and the repo history.")

# Attempt to detect available models and pick the best-supported Gemini model.
# This avoids deploying code that requests an unavailable model name (causing 404s).
preferred_models = [
    'gemini-2.0-flash',
    'gemini-2.0',
    'gemini-1.5-flash',
    'gemini-1.5-pro'
]
model = None
chosen = None
try:
    available = genai.list_models()
    model_names = []
    for m in available:
        # accommodate different return shapes
        if isinstance(m, dict):
            name = m.get('name') or m.get('id')
        else:
            name = getattr(m, 'name', None) or str(m)
        model_names.append(name)

    print(f"Available models: {model_names}")
    for pref in preferred_models:
        if any(pref in (n or '') for n in model_names):
            model = genai.GenerativeModel(pref)
            chosen = pref
            break
    if model is None:
        # fallback to preferred first choice; may still error but we will catch later
        chosen = preferred_models[0]
        model = genai.GenerativeModel(chosen)
except Exception as e:
    print(f"Could not list models (will try default). Error: {e}")
    chosen = preferred_models[0]
    model = genai.GenerativeModel(chosen)

print(f"Configured model: {chosen} (GOOGLE_API_KEY set: {'YES' if GOOGLE_API_KEY else 'NO'})")

# --- LOGIC ENGINE (Human Filters) ---
def calculate_human_score(physical, social, emotional, motivation):
    score = 100
    flags = []
    
    if physical in ['tired', 'hungry', 'sick']:
        score -= 25
        flags.append("Biological Risk: Physical State (Fatigue/Hunger)")
    if social == 'none':
        score -= 20
        flags.append("Cognitive Risk: Echo Chamber (No Feedback)")
    if emotional == 'urgency':
        score -= 20
        flags.append("Emotional Risk: Urgency Bias")
    if motivation == 'extrinsic':
        score -= 10
        flags.append("Motivation Risk: Extrinsic Drivers")

    return max(score, 0), flags

# --- INTELLIGENCE LAYER (The Financial Analyst) ---
def generate_advanced_analysis(human_score, flags, user_idea):
    
    prompt = f"""
    You are 'The Reality Circuit', a strategic AI consultant.
    
    USER IDEA: "{user_idea}"
    USER STATE FLAGS: {flags}
    HUMAN READINESS SCORE: {human_score}/100
    
    YOUR TASK:
    Analyze this idea objectively and return a JSON object with these exact fields:
    
    1. "logic_score": (0-100) How logical/feasible is the idea itself?
    2. "emotion_score": (0-100) How much is this driven by emotion? (High is bad).
    3. "data_score": (0-100) How likely is this supported by real-world data?
    4. "financial_score": (0-100) What is the money-making potential?
    5. "diagnosis": A 1-sentence summary of the biggest risk.
    6. "financial_advice": 2 specific ways to monetize or optimize this idea for profit.
    7. "verdict": "GO", "NO-GO", or "PIVOT".

    Return ONLY raw JSON. No markdown formatting.
    """

    try:
        response = model.generate_content(prompt)
        # Clean up text to ensure it's valid JSON
        text = response.text.replace('```json', '').replace('```', '').strip()
        return json.loads(text)
    except Exception as e:
        print(f"AI Error: {e}")
        print(f"AI Error Type: {type(e).__name__}")
        import traceback
        print("Full traceback:")
        traceback.print_exc()
        # Fallback if AI fails
        return {
            "logic_score": 50, "emotion_score": 50, "data_score": 50, "financial_score": 50,
            "diagnosis": "AI Analysis Failed. Please try again.",
            "financial_advice": ["Check internet connection"],
            "verdict": "ERROR"
        }

@app.route('/calculate', methods=['POST'])
def analyze():
    data = request.json
    
    # 1. Calculate Human Readiness (The "Operator")
    human_score, flags = calculate_human_score(
        data.get('physical_state'), 
        data.get('social_feedback'), 
        data.get('emotional_state'), 
        data.get('motivation')
    )

    # 2. Calculate Business Viability (The "Idea")
    ai_analysis = generate_advanced_analysis(human_score, flags, data.get('user_idea'))

    # 3. Combine Data
    response = {
        "human_score": human_score,
        "flags": flags,
        "analysis": ai_analysis
    }

    return jsonify(response)


@app.route('/health', methods=['GET'])
def health():
    # Lightweight health check to verify running code and configured model
    return jsonify({
        "status": "ok",
        "model": "gemini-2.0-flash",
        "has_api_key": bool(GOOGLE_API_KEY)
    })

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8080))
    app.run(host='0.0.0.0', port=port)