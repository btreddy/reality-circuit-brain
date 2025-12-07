import os
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai

app = Flask(__name__)
CORS(app)

# --- 1. CONFIGURATION ---
# Get Key from Render Environment, or use your fallback for local testing
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY", "AIzaSyATBjqTkf7yxvwZS8B6-0B1E16DOgAtXg4")

genai.configure(api_key=GOOGLE_API_KEY)

# --- 2. FORCE STABLE MODEL ---
# We removed the complex "try/except" block. 
# We are forcing 'gemini-1.5-flash' because we know it works.
model = genai.GenerativeModel('gemini-1.5-flash')

# --- 3. LOGIC ENGINE ---
def calculate_human_score(physical, social, emotional, motivation):
    score = 100
    flags = []
    
    # Penalties based on your PDF logic
    if physical in ['tired', 'hungry', 'sick']: 
        score -= 25
        flags.append("Biological Risk: Physical State")
    if social == 'none': 
        score -= 20
        flags.append("Cognitive Risk: Echo Chamber")
    if emotional == 'urgency': 
        score -= 20
        flags.append("Emotional Risk: Urgency Bias")
    if motivation == 'extrinsic': 
        score -= 10
        flags.append("Motivation Risk: Extrinsic Drivers")

    return max(score, 0), flags

# --- 4. INTELLIGENCE LAYER ---
def generate_advanced_analysis(human_score, flags, user_idea):
    prompt = f"""
    You are 'The Reality Circuit', a strategic AI consultant.
    
    USER IDEA: "{user_idea}"
    FLAGS: {flags}. SCORE: {human_score}/100.
    
    Return a JSON object with these exact fields: 
    logic_score (0-100), emotion_score (0-100), data_score (0-100), financial_score (0-100), 
    diagnosis (string), financial_advice (list of strings), verdict (GO/NO-GO).
    
    IMPORTANT: Return ONLY raw JSON. Do not use Markdown blocks.
    """
    try:
        response = model.generate_content(prompt)
        # Clean up text to ensure it's valid JSON
        text = response.text.replace('```json', '').replace('```', '').strip()
        return json.loads(text)
    except Exception as e:
        print(f"AI Error: {e}")
        return {
            "verdict": "ERROR", 
            "diagnosis": f"AI Connection Failed. Error: {str(e)}", 
            "financial_score": 0, 
            "financial_advice": ["Check API Key", "Check Model Name"]
        }

# --- 5. API ENDPOINT ---
@app.route('/calculate', methods=['POST'])
def analyze():
    data = request.json
    
    human_score, flags = calculate_human_score(
        data.get('physical_state'), 
        data.get('social_feedback'), 
        data.get('emotional_state'), 
        data.get('motivation')
    )

    ai_analysis = generate_advanced_analysis(human_score, flags, data.get('user_idea'))

    return jsonify({
        "human_score": human_score,
        "flags": flags,
        "analysis": ai_analysis
    })

if __name__ == '__main__':
    port = int(os.environ.get("PORT", 10000))
    app.run(host='0.0.0.0', port=port)