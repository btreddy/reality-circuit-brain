import os
import psycopg2
from psycopg2.extras import RealDictCursor
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import google.generativeai as genai
import base64
from io import BytesIO
from PIL import Image
# NEW IMPORTS FOR DOCS
from pypdf import PdfReader
from docx import Document

# --- CONFIGURATION ---
app = Flask(__name__, static_folder='build', static_url_path='/')

# 1. ENABLE CORS FOR EVERYTHING
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
        cur.execute("CREATE TABLE IF NOT EXISTS users (id SERIAL PRIMARY KEY, username TEXT UNIQUE NOT NULL, password TEXT NOT NULL, room_id TEXT NOT NULL, device_id TEXT, message_count INTEGER DEFAULT 0);")
        cur.execute("CREATE TABLE IF NOT EXISTS room_chats (id SERIAL PRIMARY KEY, room_id TEXT NOT NULL, sender_name TEXT NOT NULL, message TEXT NOT NULL, is_ai BOOLEAN DEFAULT FALSE, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP);")
        cur.execute("CREATE TABLE IF NOT EXISTS leads (id SERIAL PRIMARY KEY, name TEXT NOT NULL, email TEXT NOT NULL, message TEXT NOT NULL, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP);")
        conn.commit(); cur.close(); conn.close()
        print("✅ DATABASE TABLES READY.")
    except Exception as e:
        print(f"⚠️ DB INIT ERROR: {e}")

def generate_smart_content(prompt_text, file_data=None, file_type=None):
    try:
        model = genai.GenerativeModel('gemini-2.0-flash-exp')
        content_parts = [prompt_text]

        if file_data and file_type:
            file_bytes = base64.b64decode(file_data)
            file_stream = BytesIO(file_bytes)

            if "image" in file_type:
                # Handle Images (Vision)
                image = Image.open(file_stream)
                content_parts.append(image)

            elif "pdf" in file_type:
                # Handle PDF (Extract Text)
                try:
                    reader = PdfReader(file_stream)
                    pdf_text = "\n".join([page.extract_text() for page in reader.pages])
                    content_parts.append(f"\n[DOCUMENT CONTENT]:\n{pdf_text}")
                except:
                    return "ERROR: Could not read PDF file."

            elif "word" in file_type or "officedocument" in file_type:
                # Handle Word Docs (Extract Text)
                try:
                    doc = Document(file_stream)
                    doc_text = "\n".join([para.text for para in doc.paragraphs])
                    content_parts.append(f"\n[DOCUMENT CONTENT]:\n{doc_text}")
                except:
                    return "ERROR: Could not read Word file."

        response = model.generate_content(content_parts)
        return response.text.strip()
    except Exception as e:
        return f"AI ANALYST ERROR: {str(e)}"
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
    
    cur.execute("SELECT * FROM users WHERE username = %s", (username,))
    if cur.fetchone():
        cur.close(); conn.close()
        return jsonify({"error": "USER ALREADY EXISTS"}), 400
        
    cur.execute("SELECT * FROM users WHERE device_id = %s", (device_id,))
    if cur.fetchone():
        cur.close(); conn.close()
        return jsonify({"error": "DEVICE ALREADY REGISTERED"}), 403

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
    file_data = data.get('file_data', None)
    file_type = data.get('file_type', None)

    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    
    # 1. Save User Message
    display_message = message
    if file_data:
        display_message += f" \n[📎 ATTACHMENT: {file_type.split('/')[-1] if file_type else 'FILE'}]"

    cur.execute("INSERT INTO room_chats (room_id, sender_name, message, is_ai) VALUES (%s, %s, %s, %s)", 
                (room_id, sender_name, display_message, False))
    conn.commit()
    
    # --- 2. THE NEW TRIGGER LIST (WAKE WORDS) 🔫 ---
    # The AI will respond if ANY of these words are in the message:
    triggers = ["@ai", "radar", "system", "computer", "btr", "jarvis"]
    
    msg_lower = message.lower()
    is_triggered = any(t in msg_lower for t in triggers)
    
    should_reply = is_triggered or file_data is not None
    ai_reply = None
    
    if should_reply:
        # Clean the prompt: Remove the trigger word so the AI doesn't get confused
        clean_prompt = message
        for t in triggers:
            clean_prompt = clean_prompt.replace(t, "").replace(t.upper(), "").replace(t.capitalize(), "")
            
        clean_prompt = clean_prompt.strip()
        
        # If prompt became empty (e.g. user just said "Radar"), add a default prompt
        if not clean_prompt and not file_data:
            clean_prompt = "Hello, I am listening. What is the status?"

        ai_reply = generate_smart_content(clean_prompt, file_data, file_type)

        cur.execute("INSERT INTO room_chats (room_id, sender_name, message, is_ai) VALUES (%s, %s, %s, %s)", 
                    (room_id, "Reality Circuit", ai_reply, True))
        conn.commit()

    cur.close(); conn.close()
    return jsonify({"status": "SENT", "ai_reply": ai_reply})

@app.route('/api/chat/history', methods=['GET'])
def get_history():
    room_id = request.args.get('room_id')
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT sender_name, message, is_ai FROM room_chats WHERE room_id = %s ORDER BY timestamp ASC", (room_id,))
    messages = cur.fetchall()
    cur.close(); conn.close()
    return jsonify(messages)

@app.route('/api/chat/nuke', methods=['POST'])
def nuke_chat():
    data = request.json
    room_id = data.get('room_id')
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM room_chats WHERE room_id = %s", (room_id,))
        conn.commit(); cur.close(); conn.close()
        return jsonify({"status": "CLEARED"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/contact', methods=['POST'])
def save_contact():
    data = request.json
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("INSERT INTO leads (name, email, message) VALUES (%s, %s, %s)", (data['name'], data['email'], data['message']))
        conn.commit(); cur.close(); conn.close()
        return jsonify({"status": "OK"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

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
    
    # FIX: Use the PORT provided by Render, or default to 5000 for local testing
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port)