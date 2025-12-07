import os
import json
from flask import Flask, request, jsonify
from flask_cors import CORS
from openai import OpenAI

app = Flask(__name__)
CORS(app)

# --- 1. CONFIGURATION (DEEPSEEK) ---
# Get Key from Environment or use fallback for local testing
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "sk-7c2559622e9b4819b5b91b47df200588")

# Initialize the Client pointing to DeepSeek's URL
client = OpenAI(
    api_key= DEEPSEEK_API_KEY,
    base_url="https://api.deepseek.com"
)

# --- 2. LOGIC ENGINE (Human Filters) ---
def calculate_human_score(physical, social, emotional, motivation):
    score = 100
    flags = []
    
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

# --- 3. INTELLIGENCE LAYER (DeepSeek V3) ---
def generate_advanced_analysis(human_score, flags, user_idea):
    
    # System prompt defines the persona
    system_instruction = """
    You are 'The Reality Circuit', a strategic AI consultant.
    Analyze the user's idea based on the provided risk flags and score.
    
    Return a JSON object with these exact fields: 
    logic_score (0-100), emotion_score (0-100), data_score (0-100), financial_score (0-100), 
    diagnosis (string), financial_advice (list of strings), verdict (GO/NO-GO).
    
    IMPORTANT: Return ONLY raw JSON. Do not use Markdown blocks (```json).
    """

    user_message = f"""
    USER IDEA: "{user_idea}"
    FLAGS: {flags}. SCORE: {human_score}/100.
    """

    try:
        response = client.chat.completions.create(
            model="deepseek-chat",  # This is DeepSeek V3
            messages=[
                {"role": "system", "content": system_instruction},
                {"role": "user", "content": user_message},
            ],
            stream=False,
            temperature=1.3  # DeepSeek recommends slightly higher temp for V3 creative tasks
        )
        
        # Extract and clean the JSON
        content = response.choices[0].message.content
        cleaned_text = content.replace('```json', '').replace('```', '').strip()
        return json.loads(cleaned_text)

    except Exception as e:
        print(f"DeepSeek Error: {e}")
        return {
            "verdict": "ERROR", 
            "diagnosis": f"DeepSeek Connection Failed. Error: {str(e)}", 
            "financial_score": 0, 
            "financial_advice": ["Check API Key Balance", "Check Server Logs"]
        }

# --- 4. API ENDPOINT ---
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