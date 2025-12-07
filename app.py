import os
import sys
import json
import webbrowser
from threading import Timer
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import google.generativeai as genai

# Setup Flask for EXE environment
if getattr(sys, 'frozen', False):
    template_folder = os.path.join(sys._MEIPASS, 'build')
    static_folder = os.path.join(sys._MEIPASS, 'build/static')
    app = Flask(__name__, template_folder=template_folder, static_folder=static_folder, static_url_path='/static')
else:
    app = Flask(__name__, static_folder='build', static_url_path='/')

CORS(app)

# --- HARDCODED CONFIGURATION FOR EXE ---
GOOGLE_API_KEY = "AIzaSyDbOz5XrF4XlKfXWetgdDjpbqIYpEiKQ_U"
genai.configure(api_key=GOOGLE_API_KEY)

# Force the stable model
try:
    model = genai.GenerativeModel('gemini-1.5-flash')
except:
    model = genai.GenerativeModel('gemini-pro')

@app.route('/')
def serve():
    return send_from_directory(app.static_folder if not getattr(sys, 'frozen', False) else app.template_folder, 'index.html')

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
    Return JSON: logic_score, emotion_score, data_score, financial_score, diagnosis, financial_advice (list), verdict (GO/NO-GO).
    RAW JSON ONLY.
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
    def open_browser():
        webbrowser.open_new('http://127.0.0.1:5000/')
    Timer(1, open_browser).start()
    app.run(port=5000)