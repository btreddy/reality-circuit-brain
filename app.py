import os
import psycopg2
from psycopg2.extras import RealDictCursor
from flask import Flask, request, jsonify, send_from_directory, make_response
from flask_cors import CORS
import google.generativeai as genai

# --- CONFIGURATION ---
app = Flask(__name__, static_folder='build', static_url_path='/')

# 1. ENABLE CORS FOR EVERYTHING (The "Open Border" Policy)
CORS(app, resources={r"/*": {"origins": "*"}})

# Database Setup
raw_db_url = os.environ.get("DATABASE_URL")
if raw_db_url and raw_db_url.startswith("postgres://"):
    DB_URL = raw_db_url.replace("postgres://", "postgresql://", 1)
else:
    DB_URL = raw_db_url

# Gemini API
GEMINI_KEY = os.environ.get("GEMINI_API_KEY")
if GEMINI_KEY: genai.configure(api_key=GEMINI_KEY)

def get_db_connection():
    return psycopg2.connect(DB_URL)

def init_db():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        # Create Tables
        cur.execute("CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, room_id TEXT NOT NULL, device_id TEXT, message_count INTEGER DEFAULT 0);")
        cur.execute("CREATE TABLE IF NOT EXISTS room_chats (id SERIAL PRIMARY KEY, room_id TEXT NOT NULL, sender_name TEXT NOT NULL, message TEXT NOT NULL, is_ai BOOLEAN DEFAULT FALSE, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP);")
        cur.execute("CREATE TABLE IF NOT EXISTS leads (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, message TEXT NOT NULL, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP);")
        conn.commit(); cur.close(); conn.close()
        print("✅ DATABASE TABLES READY.")
    except Exception as e:
        print(f"⚠️ DB INIT ERROR: {e}")

def generate_smart_content(prompt_text):
    try:
        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        return model.generate_content(prompt_text).text.strip()
    except:
        return "AI Offline. (Check API Key)"

# --- MANUAL CORS FIX (Extra Layer of Safety) ---
@app.after_request
def after_request(response):
    response.headers.add('Access-Control-Allow-Origin', '*')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type,Authorization')
    response.headers.add('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS')
    return response

# --- API ROUTES ---

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ONLINE", "brain": "ACTIVE"})

@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    device_id = data.get('device_id')
    
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # Check if user exists
    cur.execute("SELECT * FROM users WHERE username = %s", (username,))
    if cur.fetchone():
        cur.close(); conn.close()
        return jsonify({"error": "USER ALREADY EXISTS"}), 400
        
    # Check device
    cur.execute("SELECT * FROM users WHERE device_id = %s", (device_id,))
    if cur.fetchone():
        cur.close(); conn.close()
        return jsonify({"error": "DEVICE ALREADY REGISTERED"}), 403

    # Create User
    room_id = username.split('@')[0]
    try:
        cur.execute("INSERT INTO users (username, password, room_id, device_id) VALUES (%s, %s, %s, %s)", (username, password, room_id, device_id))
        conn.commit(); cur.close(); conn.close()
        return jsonify({"username": username, "room_id": room_id})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM users WHERE username = %s", (username,))
        user = cur.fetchone()
        cur.close(); conn.close()

        if user and user['password'] == password:
            return jsonify({"username": username, "room_id": user['room_id']})
        else:
            return jsonify({"error": "INVALID CREDENTIALS"}), 401
    except Exception as e:
        return jsonify({"error": f"DB ERROR: {str(e)}"}), 500

@app.route('/api/chat/send', methods=['POST'])
def send_chat():
    data = request.json
    # ... (simplified for brevity, your chat logic works) ...
    return jsonify({"ai_reply": "System Online."}) # Placeholder if needed, but keep your logic

@app.route('/api/chat/history', methods=['GET'])
def get_history():
    # ... (Your history logic) ...
    return jsonify([])

@app.route('/api/contact', methods=['POST'])
def save_contact():
    # ... (Your contact logic) ...
    return jsonify({"status": "OK"})

# --- FRONTEND SERVING (Must be LAST) ---
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(app.static_folder + '/' + path):
        return send_from_directory(app.static_folder, path)
    else:
        if os.path.exists(app.static_folder + '/index.html'):
            return send_from_directory(app.static_folder, 'index.html')
        else:
            return "⚠️ SYSTEM LOADING...", 200

if __name__ == '__main__':
    with app.app_context():
        init_db()
    app.run(host='0.0.0.0', port=5000)