import os
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai

app = Flask(__name__)
CORS(app)

# --- CONFIGURATION ---
# Get Key from Render Environment
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")

# Fallback for testing (Remove this before sharing code publicly if you want)
if not GOOGLE_API_KEY:
    GOOGLE_API_KEY = "AIzaSyAgKIZt7FlD8kssKE98IHFlkmTG1_t84R0"

genai.configure(api_key=GOOGLE_API_KEY)

# --- FORCE STABLE MODEL ---
# We use 'gemini-1.5-flash' because it is the fastest and most reliable free model.
# No auto-detect. No experimental versions.
model = genai.GenerativeModel('gemini-1.5-flash')

# --- LOGIC ENGINE ---
def calculate_human_score(physical, social, emotional, motivation):
    score = 100
    flags = []
    if physical in ['tired', 'hungry', 'sick']: score -= 25; flags.append("Biological Risk: Physical State")
    if social == 'none': score -= 20; flags.append("Cognitive Risk: Echo Chamber")
    if emotional == 'urgency': score -= 20; flags.append("Emotional Risk: Urgency Bias")
    if motivation == 'extrinsic': score -= 10; flags.append("Motivation Risk: Extrinsic Drivers")
    return max(score, 0), flags

def generate_advanced_analysis(human_score, flags, user_idea):
    prompt = f"""
    You are 'The Reality Circuit'. USER IDEA: "{user_idea}"
    FLAGS: {flags}. SCORE: {human_score}/100.
    
    Return JSON with fields: logic_score, emotion_score, data_score, financial_score, diagnosis, financial_advice (list), verdict (GO/NO-GO).
    DO NOT use Markdown code blocks. Just raw JSON.
    """
    try:
        response = model.generate_content(prompt)
        # heavy cleaning to prevent JSON errors
        text = response.text.replace('```json', '').replace('```', '').strip()
        return json.loads(text)
    except Exception as e:
        print(f"AI Error: {e}")
        return {
            "verdict": "ERROR", 
            "diagnosis": f"AI Brain Connection Failed. Error: {str(e)}", 
            "financial_score": 0, 
            "financial_advice": []
        }

@app.route('/calculate', methods=['POST'])
def analyze():
    data = request.json
    human_score, flags = calculate_human_score(
        data.get('physical_state'), data.get('social_feedback'), 
        data.get('emotional_state'), data.get('motivation')
    )
    ai_analysis = generate_advanced_analysis(human_score, flags, data.get('user_idea'))
    return jsonify({"human_score": human_score, "flags": flags, "analysis": ai_analysis})

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port)