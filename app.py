import os
import psycopg2
from psycopg2.extras import RealDictCursor
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai

app = Flask(__name__)
CORS(app)

# --- 1. CONFIGURATION & AUTO-FIXES ---
raw_db_url = os.environ.get("DATABASE_URL")
if raw_db_url and raw_db_url.startswith("postgres://"):
    DB_URL = raw_db_url.replace("postgres://", "postgresql://", 1)
else:
    DB_URL = raw_db_url

GEMINI_KEY = os.environ.get("GEMINI_API_KEY")
genai.configure(api_key=GEMINI_KEY)

# --- 2. DATABASE CONNECTION ---
def get_db_connection():
    return psycopg2.connect(DB_URL)

# --- 3. THE SELF-HEALING SYSTEM (Critical Fix) ---
# This runs once when the app starts to create missing tables.
def init_db():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Create USERS Table (Fixes Login Crash)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                room_id TEXT NOT NULL
            );
        """)
        
        # Create CHATS Table (Fixes History)
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
        
        conn.commit()
        cur.close()
        conn.close()
        print("✅ DATABASE TABLES VERIFIED & READY.")
    except Exception as e:
        print(f"⚠️ DATABASE INIT FAILED: {e}")

# Run the fix immediately
with app.app_context():
    init_db()

# --- 4. INTELLIGENCE CORE (Gemini) ---
def generate_smart_content(prompt_text, file_data=None, mime_type=None):
    # Try Gemini 2.0 (The Genius), fallback to 1.5 (The Reliable)
    try:
        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        if file_data:
            response = model.generate_content([prompt_text, {"mime_type": mime_type, "data": file_data}])
        else:
            response = model.generate_content(prompt_text)
        return response.text.strip()
    except:
        # Fallback
        try:
            model = genai.GenerativeModel('gemini-1.5-flash')
            response = model.generate_content(prompt_text)
            return response.text.strip()
        except Exception as e:
            return f"SYSTEM FAILURE: {str(e)}"

# --- 5. ROUTES ---

@app.route('/')
def home():
    return "WAR ROOM HQ ONLINE. DATABASE ACTIVE."

@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    
    # Simple Logic: Room ID = Username
    room_id = username.split('@')[0]

    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("INSERT INTO users (username, password, room_id) VALUES (%s, %s, %s)", (username, password, room_id))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"username": username, "room_id": room_id})
    except Exception as e:
        return jsonify({"error": "User already exists"}), 400

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
        cur.close()
        conn.close()

        if user and user['password'] == password:
            return jsonify({"username": username, "room_id": user['room_id']})
        else:
            return jsonify({"error": "Invalid Credentials"}), 401
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/chat/send', methods=['POST'])
def send_chat():
    data = request.json
    room_id = data.get('room_id')
    sender_name = data.get('sender_name')
    message = data.get('message', '')
    file_data = data.get('file_data')
    mime_type = data.get('mime_type')

    # Save User Message
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("INSERT INTO room_chats (room_id, sender_name, message, is_ai) VALUES (%s, %s, %s, %s)", 
                (room_id, sender_name, message, False))
    conn.commit()
    
    # Generate AI Reply
    ai_reply = generate_smart_content(f"User: {message}", file_data, mime_type)
    
    # Save AI Reply
    cur.execute("INSERT INTO room_chats (room_id, sender_name, message, is_ai) VALUES (%s, %s, %s, %s)", 
                (room_id, "Reality Circuit", ai_reply, True))
    conn.commit()
    cur.close()
    conn.close()
    
    return jsonify({"ai_reply": ai_reply})

@app.route('/api/chat/history', methods=['GET'])
def get_history():
    room_id = request.args.get('room_id')
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT * FROM room_chats WHERE room_id = %s ORDER BY timestamp ASC", (room_id,))
    msgs = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify(msgs)

@app.route('/api/chat/clear', methods=['POST'])
def clear_history():
    room_id = request.json.get('room_id')
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM room_chats WHERE room_id = %s", (room_id,))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({"status": "CLEARED"})
# --- NUCLEAR RESET SWITCH (Run once to fix DB) ---
@app.route('/api/nuke_database', methods=['GET'])
def nuke_database():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        # 1. Destroy old tables
        cur.execute("DROP TABLE IF EXISTS users CASCADE;")
        cur.execute("DROP TABLE IF EXISTS room_chats CASCADE;")
        conn.commit()
        cur.close()
        conn.close()
        
        # 2. Rebuild fresh tables
        init_db()
        return "⚠️ SYSTEM ALERT: DATABASE WIPED AND REBUILT. YOU MAY NOW SIGN UP."
    except Exception as e:
        return f"RESET FAILED: {str(e)}"

if __name__ == '__main__':
    # Initialize DB locally if running directly
    init_db()
    app.run(debug=True)