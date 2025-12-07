import os
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai

app = Flask(__name__)
CORS(app)

# 1. Get Key from Environment (Cloud) or use fallback (Local)
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "AIzaSyAgKIZt7FlD8kssKE98IHFlkmTG1_t84R0")
genai.configure(api_key=GOOGLE_API_KEY)

# 2. FORCE STABLE MODEL (Fixes the 404 error)
model = genai.GenerativeModel('gemini-1.5-flash')

# ... (Keep your calculate_human_score function exactly as is) ...
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
    Return JSON: logic_score, emotion_score, data_score, financial_score, diagnosis, financial_advice (list), verdict (GO/NO-GO).
    NO MARKDOWN. RAW JSON ONLY.
    """
    try:
        response = model.generate_content(prompt)
        text = response.text.replace('```json', '').replace('```', '').strip()
        return json.loads(text)
    except Exception as e:
        return {"verdict": "ERROR", "diagnosis": f"AI Error: {str(e)}", "financial_score": 0, "financial_advice": []}

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