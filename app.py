import os
import json
import re
from flask import Flask, request, jsonify, send_file, make_response
from flask_cors import CORS
import google.generativeai as genai
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from reportlab.lib import colors
from dotenv import load_dotenv

# Database Imports
from flask_sqlalchemy import SQLAlchemy
from datetime import datetime

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app)

# --- DATABASE CONFIGURATION ---
# This grabs the URL from Render. If running locally, it creates a file named 'local_reality.db'
db_url = os.environ.get('DATABASE_URL', 'sqlite:///local_reality.db')
if db_url.startswith("postgres://"):
    db_url = db_url.replace("postgres://", "postgresql://", 1)

app.config['SQLALCHEMY_DATABASE_URI'] = db_url
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db = SQLAlchemy(app)

# Define the "RealityCheck" Table
class RealityCheck(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    timestamp = db.Column(db.DateTime, default=datetime.utcnow)
    subject = db.Column(db.String(500))  # The user's input
    verdict = db.Column(db.String(50))   # GO / NO GO
    diagnosis = db.Column(db.Text)       # The full AI explanation
    
    # Scores
    logic_score = db.Column(db.Integer)
    data_score = db.Column(db.Integer)
    money_score = db.Column(db.Integer)
    ability_score = db.Column(db.Integer)

# Create the database tables
with app.app_context():
    db.create_all()

# --- AI CONFIGURATION ---
api_key = os.getenv("GOOGLE_API_KEY")
genai.configure(api_key=api_key)

generation_config = {
    "temperature": 1,
    "top_p": 0.95,
    "top_k": 40,
    "max_output_tokens": 8192,
    "response_mime_type": "text/plain",
}

model = genai.GenerativeModel(
    model_name="gemini-2.0-flash-exp",
    generation_config=generation_config,
)

@app.route('/')
def home():
    return "Reality Circuit Brain is Active (Database Connected)!"

@app.route('/calculate', methods=['POST'])
def calculate_reality():
    try:
        data = request.json
        user_input = data.get('statement') or data.get('text') or data.get('input') or ''

        if not user_input:
            return jsonify({"error": "No statement provided"}), 400

        # Prompt for Gemini
        prompt = f"""
        Analyze this business/life decision: "{user_input}"
        
        Provide a JSON response with exactly this structure:
        {{
            "logic_score": (0-100),
            "data_score": (0-100),
            "money_score": (0-100),
            "ability_score": (0-100),
            "verdict": "GO" or "NO GO",
            "diagnosis": "A short, sharp 2-sentence summary of why."
        }}
        """

        response = model.generate_content(prompt)
        ai_text = response.text

        # Clean up JSON formatting (remove markdown ```json if present)
        clean_text = re.sub(r"```json|```", "", ai_text).strip()
        result = json.loads(clean_text)

        # Extract values
        logic = result.get('logic_score', 0)
        data_val = result.get('data_score', 0)
        money = result.get('money_score', 0)
        ability = result.get('ability_score', 0)
        verdict = result.get('verdict', "UNKNOWN")
        diagnosis = result.get('diagnosis', "Analysis failed.")

        # --- SAVE TO DATABASE ---
        try:
            new_entry = RealityCheck(
                subject=user_input[:500], # Limit text to 500 chars for DB safety
                verdict=verdict,
                diagnosis=diagnosis,
                logic_score=logic,
                data_score=data_val,
                money_score=money,
                ability_score=ability
            )
            db.session.add(new_entry)
            db.session.commit()
            print("--- RESULT SAVED TO DATABASE ---")
        except Exception as e:
            print(f"Database Save Error: {e}")
        # ------------------------

        # Generate PDF (In-Memory)
        # Note: I'm returning the JSON + PDF link idea, or simple JSON for now.
        # Based on your frontend, you likely consume JSON.
        
        return jsonify(result)

    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)