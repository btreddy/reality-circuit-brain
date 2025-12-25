import os
import psycopg2
from psycopg2.extras import RealDictCursor
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import google.generativeai as genai
import base64
from io import BytesIO
from PIL import Image  # You might need to add 'Pillow' to requirements.txt later

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
if GEMINI_KEY:
    genai.configure(api_key=GEMINI_KEY)

# --- DATABASE HELPERS ---
def get_db_connection():
    return psycopg2.connect(DB_URL)

def init_db():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        # Create Tables
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                room_id TEXT NOT NULL,
                device_id TEXT,
                message_count INTEGER DEFAULT 0,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS room_chats (
                id SERIAL PRIMARY KEY,
                room_id TEXT NOT NULL,
                sender_name TEXT NOT NULL,
                message TEXT NOT NULL,
                is_ai BOOLEAN DEFAULT FALSE,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS leads (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT NOT NULL,
                message TEXT NOT NULL,
                timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        conn.commit()
        cur.close()
        conn.close()
        print("✅ DATABASE TABLES READY.")
    except Exception as e:
        print(f"⚠️ DB INIT ERROR: {e}")

def generate_smart_content(prompt_text, image_data=None):
    try:
        model = genai.GenerativeModel('gemini-2.0-flash-exp')

        if image_data:
            # Convert base64 string to Image
            image_bytes = base64.b64decode(image_data)
            image = Image.open(BytesIO(image_bytes))
            # Send Text + Image to AI
            response = model.generate_content([prompt_text, image])
        else:
            # Text only
            response = model.generate_content(prompt_text)

        return response.text.strip()
    except Exception as e:
        return f"AI VISUAL SYSTEM ERROR: {str(e)}"

# --- MANUAL CORS FIX (Extra Safety) ---
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
    room_id = data.get('room_id')
    sender_name = data.get('sender_name')
    message = data.get('message', '')
    image_data = data.get('image', None)

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # 1. Save User Message (Always save what the human said)
    display_message = message
    if image_data:
        display_message += " \n[📎 IMAGE ATTACHED]"

    cur.execute("INSERT INTO room_chats (room_id, sender_name, message, is_ai) VALUES (%s, %s, %s, %s)", 
                (room_id, sender_name, display_message, False))
    conn.commit()
    
    # 2. THE SMART GATEKEEPER CHECK 🛡️
    # logic: Only reply if message contains "@AI" (case insensitive) OR if an image is attached (assume they want analysis)
    should_reply = "@ai" in message.lower() or image_data is not None
    
    ai_reply = None
    
    if should_reply:
        # Remove the trigger word "@AI" from the prompt so the AI doesn't get confused
        clean_prompt = message.replace("@ai", "").replace("@AI", "").strip()
        
        # Generate Reply
        ai_reply = generate_smart_content(clean_prompt, image_data)

        # Save AI Reply
        cur.execute("INSERT INTO room_chats (room_id, sender_name, message, is_ai) VALUES (%s, %s, %s, %s)", 
                    (room_id, "Reality Circuit", ai_reply, True))
        conn.commit()

    cur.close(); conn.close()
    
    # Return result (ai_reply might be None now, which is fine)
    return jsonify({"status": "SENT", "ai_reply": ai_reply})

@app.route('/api/chat/history', methods=['GET'])
def get_history():
    room_id = request.args.get('room_id')
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT * FROM room_chats WHERE room_id = %s ORDER BY timestamp ASC", (room_id,))
    msgs = cur.fetchall()
    cur.close(); conn.close()
    return jsonify(msgs)

@app.route('/api/contact', methods=['POST'])
def save_contact():
    data = request.json
    name = data.get('name')
    email = data.get('email')
    message = data.get('message')
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("INSERT INTO leads (name, email, message) VALUES (%s, %s, %s)", (name, email, message))
        conn.commit(); cur.close(); conn.close()
        return jsonify({"status": "Message Received"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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
            return "⚠️ SYSTEM LOADING... (Frontend building)", 200

@app.route('/api/chat/nuke', methods=['POST'])
def nuke_chat():
    data = request.json
    room_id = data.get('room_id')
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        # DELETE all messages for this room
        cur.execute("DELETE FROM room_chats WHERE room_id = %s", (room_id,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "CLEARED"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
if __name__ == '__main__':
    with app.app_context():
        init_db()
    app.run(host='0.0.0.0', port=5000)