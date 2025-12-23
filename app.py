import os
import psycopg2
from psycopg2.extras import RealDictCursor
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import google.generativeai as genai

# --- CONFIGURATION ---
app = Flask(__name__, static_folder='build', static_url_path='/')
CORS(app)

# Database URL Fix for Render
raw_db_url = os.environ.get("DATABASE_URL")
if raw_db_url and raw_db_url.startswith("postgres://"):
    DB_URL = raw_db_url.replace("postgres://", "postgresql://", 1)
else:
    DB_URL = raw_db_url

# Gemini API Key
GEMINI_KEY = os.environ.get("GEMINI_API_KEY")
genai.configure(api_key=GEMINI_KEY)

# --- DATABASE CONNECTION ---
def get_db_connection():
    return psycopg2.connect(DB_URL)

# --- DATABASE AUTO-INIT (Runs on Startup) ---
def init_db():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # 1. Users Table
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
        
        # 2. Chats Table
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

        # 3. Leads Table
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
        print("✅ DATABASE & TABLES READY.")
    except Exception as e:
        print(f"⚠️ DB INIT ERROR: {e}")

# --- AI GENERATION CORE ---
def generate_smart_content(prompt_text):
    try:
        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        response = model.generate_content(prompt_text)
        return response.text.strip()
    except:
        try:
            model = genai.GenerativeModel('gemini-1.5-flash')
            response = model.generate_content(prompt_text)
            return response.text.strip()
        except Exception as e:
            return "System Malfunction: AI Core Unresponsive."

# --- API ROUTES (THE BRAIN) ---

@app.route('/api/health', methods=['GET'])
def health_check():
    return jsonify({"status": "ONLINE", "brain": "ACTIVE"})

@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    device_id = data.get('device_id')

    if not device_id:
        return jsonify({"error": "Security Check Failed (No Device ID)"}), 400

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    cur.execute("SELECT * FROM users WHERE device_id = %s", (device_id,))
    if cur.fetchone():
        cur.close(); conn.close()
        return jsonify({"error": "DEVICE ALREADY REGISTERED. PLEASE LOG IN."}), 403

    cur.execute("SELECT * FROM users WHERE username = %s", (username,))
    if cur.fetchone():
        cur.close(); conn.close()
        return jsonify({"error": "User already exists"}), 400
        
    room_id = username.split('@')[0]
    try:
        cur.execute(
            "INSERT INTO users (username, password, room_id, device_id, message_count) VALUES (%s, %s, %s, %s, 0)", 
            (username, password, room_id, device_id)
        )
        conn.commit()
        cur.close(); conn.close()
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
            return jsonify({"error": "Invalid Credentials"}), 401
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/chat/send', methods=['POST'])
def send_chat():
    data = request.json
    room_id = data.get('room_id')
    sender_name = data.get('sender_name')
    message = data.get('message', '')

    # VIP LIST
    ADMIN_USERS = ["admin@warroom.com", "btr@sld.com", "admin@safelanddeal.com", "info@safelanddeal.com"]

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    cur.execute("SELECT message_count FROM users WHERE username = %s", (sender_name,))
    user_record = cur.fetchone()
    
    if user_record and user_record['message_count'] >= 3 and sender_name not in ADMIN_USERS:
        cur.close(); conn.close()
        return jsonify({"error": "LIMIT_REACHED"}), 402

    cur.execute("UPDATE users SET message_count = message_count + 1 WHERE username = %s", (sender_name,))
    cur.execute("INSERT INTO room_chats (room_id, sender_name, message, is_ai) VALUES (%s, %s, %s, %s)", 
                (room_id, sender_name, message, False))
    conn.commit()
    
    ai_reply = generate_smart_content(f"User: {message}")

    cur.execute("INSERT INTO room_chats (room_id, sender_name, message, is_ai) VALUES (%s, %s, %s, %s)", 
                (room_id, "Reality Circuit", ai_reply, True))
    conn.commit()
    cur.close(); conn.close()
    
    return jsonify({"ai_reply": ai_reply})

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
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "Message Received"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- FRONTEND SERVING (The Face) ---
# This MUST come last to avoid swallowing API routes
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(app.static_folder + '/' + path):
        return send_from_directory(app.static_folder, path)
    else:
        return send_from_directory(app.static_folder, 'index.html')

if __name__ == '__main__':
    with app.app_context():
        init_db()
    app.run(host='0.0.0.0', port=5000)