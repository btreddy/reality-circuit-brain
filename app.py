import os
import sys
import json
import webbrowser
from threading import Timer
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import google.generativeai as genai

# --- 1. SETUP FLASK TO SERVE REACT ---
# This block checks if we are running as a normal script or a frozen .exe
if getattr(sys, 'frozen', False):
    # If running as .exe, look inside the temp folder (_MEIPASS)
    template_folder = os.path.join(sys._MEIPASS, 'build')
    static_folder = os.path.join(sys._MEIPASS, 'build/static')
    app = Flask(__name__, template_folder=template_folder, static_folder=static_folder, static_url_path='/static')
else:
    # If running locally in VS Code
    app = Flask(__name__, static_folder='build', static_url_path='/')

CORS(app)

# --- 2. CONFIGURATION ---
# NOTE: For a standalone .exe to give friends, you might want to hardcode the key here
# since your friends won't have your Environment Variables set up.
# Replace the string below with your actual key if sharing.
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "AIzaSyAgKIZt7FlD8kssKE98IHFlkmTG1_t84R0")

genai.configure(api_key=GOOGLE_API_KEY)

# Auto-select best model
preferred_models = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-pro']
model = None
try:
    available = [m.name for m in genai.list_models()]
    for pref in preferred_models:
        if any(pref in m for m in available):
            model = genai.GenerativeModel(pref)
            print(f"Selected Model: {pref}")
            break
    if not model: model = genai.GenerativeModel('gemini-1.5-flash')
except:
    model = genai.GenerativeModel('gemini-1.5-flash')

# --- 3. SERVE THE FRONTEND ---
@app.route('/')
def serve():
    # This serves your React 'index.html' when opening the app
    return send_from_directory(app.static_folder if not getattr(sys, 'frozen', False) else app.template_folder, 'index.html')

# --- 4. LOGIC ENGINE (Your Existing Code) ---
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
    You are 'The Reality Circuit'.
    USER IDEA: "{user_idea}"
    FLAGS: {flags}
    SCORE: {human_score}/100
    
    Return JSON with fields: logic_score, emotion_score, data_score, financial_score, diagnosis, financial_advice (list), verdict (GO/NO-GO).
    """
    try:
        response = model.generate_content(prompt)
        text = response.text.replace('```json', '').replace('```', '').strip()
        return json.loads(text)
    except:
        return {"verdict": "ERROR", "diagnosis": "AI Failed", "financial_advice": [], "logic_score": 0}

@app.route('/calculate', methods=['POST'])
def analyze():
    data = request.json
    human_score, flags = calculate_human_score(
        data.get('physical_state'), data.get('social_feedback'), 
        data.get('emotional_state'), data.get('motivation')
    )
    ai_analysis = generate_advanced_analysis(human_score, flags, data.get('user_idea'))
    return jsonify({"human_score": human_score, "flags": flags, "analysis": ai_analysis})

# --- 5. STARTUP SCRIPT ---
if __name__ == '__main__':
    # This automatically opens the browser when you double-click the .exe
    def open_browser():
        webbrowser.open_new('http://127.0.0.1:5000/')

    Timer(1, open_browser).start()
    app.run(port=5000)