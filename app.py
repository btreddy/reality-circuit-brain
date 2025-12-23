import os
import psycopg2
from psycopg2.extras import RealDictCursor
from flask import Flask, request, jsonify
from flask_cors import CORS
import google.generativeai as genai

app = Flask(__name__)
CORS(app)

# --- 1. CONFIGURATION ---
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

# --- 3. DATABASE AUTO-INIT ---
def init_db():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Create USERS Table
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
        
        # Create CHATS Table
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
        print("✅ DATABASE & TABLES READY.")
    except Exception as e:
        print(f"⚠️ DB INIT ERROR: {e}")

# --- 4. INTELLIGENCE CORE ---
def generate_smart_content(prompt_text, file_data=None, mime_type=None):
    try:
        # Try Primary Model
        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        if file_data:
            response = model.generate_content([prompt_text, {"mime_type": mime_type, "data": file_data}])
        else:
            response = model.generate_content(prompt_text)
        return response.text.strip()
    except:
        try:
            # Fallback to Backup Model
            model = genai.GenerativeModel('gemini-1.5-flash')
            response = model.generate_content(prompt_text)
            return response.text.strip()
        except Exception as e:
            return f"SYSTEM FAILURE: {str(e)}"

# --- 5. ROUTES ---

@app.route('/')
def home():
    return "WAR ROOM HQ: ONLINE"

@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    device_id = data.get('device_id')

    # Security: Require Device ID
    if not device_id:
        return jsonify({"error": "Security Check Failed (No Device ID)"}), 400

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # 1. Check if Device is Banned (Already Registered)
    cur.execute("SELECT * FROM users WHERE device_id = %s", (device_id,))
    existing_device = cur.fetchone()
    
    if existing_device:
        cur.close(); conn.close()
        return jsonify({"error": "DEVICE ALREADY REGISTERED. PLEASE LOG IN."}), 403

    # 2. Check if Email Exists
    cur.execute("SELECT * FROM users WHERE username = %s", (username,))
    if cur.fetchone():
        cur.close(); conn.close()
        return jsonify({"error": "User already exists"}), 400
        
    # 3. Create User
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

# --- CHAT ROUTE (WITH VIP LIST) ---
@app.route('/api/chat/send', methods=['POST'])
def send_chat():
    data = request.json
    room_id = data.get('room_id')
    sender_name = data.get('sender_name')
    message = data.get('message', '')
    file_data = data.get('file_data')
    mime_type = data.get('mime_type')

    # ⚠️ VIP LIST: Add your emails here for UNLIMITED ACCESS
    ADMIN_USERS = ["admin@warroom.com", "btr@sld.com", "btr3@gmail.com", "testing2@gmail.com"]

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)

    # 1. CHECK CREDIT LIMIT
    cur.execute("SELECT message_count FROM users WHERE username = %s", (sender_name,))
    user_record = cur.fetchone()
    
    # If user is NOT in Admin list AND has >= 3 messages -> BLOCK
    if user_record and user_record['message_count'] >= 3 and sender_name not in ADMIN_USERS:
        cur.close(); conn.close()
        return jsonify({"error": "LIMIT_REACHED"}), 402

    # 2. INCREMENT COUNT
    cur.execute("UPDATE users SET message_count = message_count + 1 WHERE username = %s", (sender_name,))
    conn.commit()

    # 3. SAVE USER MESSAGE
    cur.execute("INSERT INTO room_chats (room_id, sender_name, message, is_ai) VALUES (%s, %s, %s, %s)", 
                (room_id, sender_name, message if not file_data else f"[FILE] {message}", False))
    conn.commit()
    
    # 4. GENERATE AI REPLY (The Brain)
    try:
        ai_reply = generate_smart_content(f"User: {message}", file_data, mime_type)
    except Exception as e:
        ai_reply = "System Malfunction: AI Core Unresponsive."

    # 5. SAVE AI REPLY
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

@app.route('/api/chat/clear', methods=['POST'])
def clear_history():
    room_id = request.json.get('room_id')
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM room_chats WHERE room_id = %s", (room_id,))
    conn.commit()
    cur.close(); conn.close()
    return jsonify({"status": "CLEARED"})

# --- DATABASE RESET TOOL ---
@app.route('/api/nuke_database', methods=['GET'])
def nuke_database():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DROP TABLE IF EXISTS users CASCADE;")
        cur.execute("DROP TABLE IF EXISTS room_chats CASCADE;")
        conn.commit()
        cur.close(); conn.close()
        init_db()
        return "⚠️ SYSTEM ALERT: DATABASE WIPED. NEW SECURITY PROTOCOLS INSTALLED."
    except Exception as e:
        return f"RESET FAILED: {str(e)}"

# --- BACKDOOR ADMIN CREATION ---
@app.route('/api/force_create_admin', methods=['GET'])
def force_create_admin():
    new_admin_email = "admin@warroom.com"
    new_admin_pass = "admin123"
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("""
            INSERT INTO users (username, password, room_id, device_id, message_count) 
            VALUES (%s, %s, 'admin_hq', 'ADMIN_CONSOLE', 0)
        """, (new_admin_email, new_admin_pass))
        conn.commit(); cur.close(); conn.close()
        return f"✅ SUCCESS: Created {new_admin_email}"
    except Exception as e:
        return f"❌ FAILED: {str(e)}"

if __name__ == '__main__':
    with app.app_context():
        init_db()
    app.run(debug=True)