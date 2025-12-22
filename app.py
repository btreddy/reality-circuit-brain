from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
import os
import google.generativeai as genai
from werkzeug.security import generate_password_hash, check_password_hash

app = Flask(__name__)
CORS(app)

# 1. CONFIGURATION
def get_db_connection():
    return psycopg2.connect(os.environ['DATABASE_URL'])

genai.configure(api_key=os.environ['GOOGLE_API_KEY'])

# --- NUCLEAR REPAIR FOR USERS (RUN THIS LINK ONCE) ---
@app.route('/api/setup_users', methods=['GET'])
def setup_user_table():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # 1. DESTROY OLD TABLE
        cur.execute("DROP TABLE IF EXISTS users CASCADE;")
        
        # 2. CREATE FRESH TABLE (With Password Column)
        cur.execute("""
            CREATE TABLE users (
                id SERIAL PRIMARY KEY,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                sessions_used INTEGER DEFAULT 0,
                is_subscribed BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
        """)
        
        conn.commit()
        cur.close()
        conn.close()
        return "<h1>✅ USER TABLE REBUILT!</h1> <p>Old data wiped. New Schema with 'password' column active. Go Register!</p>"
    except Exception as e:
        return f"<h1>❌ ERROR:</h1> <p>{str(e)}</p>"

# --- AUTHENTICATION ---
@app.route('/api/auth/signup', methods=['POST'])
def signup():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        cur.execute("SELECT id FROM users WHERE email = %s", (email,))
        if cur.fetchone():
            cur.close()
            conn.close()
            return jsonify({"error": "User already exists."}), 400
            
        hashed_pw = generate_password_hash(password)
        cur.execute(
            "INSERT INTO users (email, password) VALUES (%s, %s) RETURNING id",
            (email, hashed_pw)
        )
        user_id = cur.fetchone()[0]
        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({"user_id": user_id, "message": "Registered!"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/auth/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')
    
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM users WHERE email = %s", (email,))
        user = cur.fetchone()
        cur.close()
        conn.close()
        
        if user and check_password_hash(user['password'], password):
            return jsonify({
                "user_id": user['id'], 
                "sessions_used": user['sessions_used'],
                "is_subscribed": user['is_subscribed'],
                "email": user['email']
            })
        else:
            return jsonify({"error": "Invalid email or password"}), 401
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/user/start_session', methods=['POST'])
def start_session():
    data = request.json
    user_id = data.get('user_id')
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT sessions_used, is_subscribed FROM users WHERE id = %s", (user_id,))
        user = cur.fetchone()
        
        if not user: return jsonify({"error": "User not found"}), 404
            
        if user['sessions_used'] >= 3 and not user['is_subscribed']:
            return jsonify({"status": "LOCKED", "message": "Limit Reached"})
        
        cur.execute("UPDATE users SET sessions_used = sessions_used + 1 WHERE id = %s", (user_id,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "ALLOWED", "sessions_used": user['sessions_used'] + 1})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- AI & CHAT LOGIC (Optimized) ---
def generate_smart_content(prompt):
    models = ['gemini-2.0-flash-exp', 'gemini-1.5-flash', 'gemini-1.5-pro']
    for m in models:
        try:
            model = genai.GenerativeModel(m)
            return model.generate_content(prompt).text
        except: continue
    raise Exception("AI Busy")

def nuclear_fix_db():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DROP TABLE IF EXISTS room_chats;")
        cur.execute("CREATE TABLE room_chats (id SERIAL PRIMARY KEY, room_id TEXT NOT NULL, sender_name TEXT NOT NULL, message TEXT NOT NULL, is_ai BOOLEAN DEFAULT FALSE, timestamp TIMESTAMP DEFAULT CURRENT_TIMESTAMP);")
        conn.commit()
        conn.close()
    except: pass

@app.route('/api/chat/history', methods=['GET'])
def get_chat_history():
    room_id = request.args.get('room_id')
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM room_chats WHERE room_id = %s ORDER BY timestamp ASC", (room_id,))
        rows = cur.fetchall()
        conn.close()
        return jsonify([{"sender": r['sender_name'], "text": r['message'], "is_ai": r['is_ai'], "timestamp": r['timestamp']} for r in rows])
    except Exception as e:
        if "does not exist" in str(e): nuclear_fix_db()
        return jsonify([])

@app.route('/api/chat/send', methods=['POST'])
def send_chat():
    data = request.json
    room_id = data.get('room_id')
    sender_name = data.get('sender_name')
    message_text = data.get('message', '')

    # 1. Store the Human Message
    if sender_name not in ["SYSTEM_COMMAND", "SYSTEM_WELCOME"]:
        try:
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("INSERT INTO room_chats (room_id, sender_name, message, is_ai) VALUES (%s, %s, %s, %s)", (room_id, sender_name, message_text, False))
            conn.commit()
            cur.close()
            conn.close()
        except Exception as e:
            if "does not exist" in str(e): nuclear_fix_db()

    # 2. DECIDE: Should AI Reply?
    should_reply = False
    ai_prompt = ""
    
    if sender_name == "SYSTEM_WELCOME":
        should_reply = True
        ai_prompt = f"You are an expert Strategic Consultant. The user '{message_text}' has just entered the 'War Room'. Give them a very short, professional, high-energy welcome message."
    elif sender_name == "SYSTEM_COMMAND":
        should_reply = True
        ai_prompt = message_text
    else:
        # Check if room is "Crowded" (More than 1 human)
        try:
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute("SELECT COUNT(DISTINCT sender_name) FROM room_chats WHERE room_id = %s AND is_ai = FALSE AND sender_name NOT LIKE 'SYSTEM_%%'", (room_id,))
            human_count = cur.fetchone()[0]
            cur.close()
            conn.close()
        except: human_count = 1 

        # --- THE FIX IS HERE ---
        # We add the Button Keywords to the Trigger List
        triggers = ["@ai", "ai consultant", "hey ai", "swot", "risks", "roi", "calculate", "analyze", "identify"]
        
        is_addressed = any(t in message_text.lower() for t in triggers)
        
        # Also reply if user is alone
        if human_count <= 1: is_addressed = True 

        if is_addressed:
            should_reply = True
            try:
                conn = get_db_connection()
                cur = conn.cursor(cursor_factory=RealDictCursor)
                cur.execute("SELECT * FROM room_chats WHERE room_id = %s ORDER BY timestamp ASC LIMIT 15", (room_id,))
                rows = cur.fetchall()
                context_str = "\n".join([f"{r['sender_name']}: {r['message']}" for r in rows])
                cur.close()
                conn.close()
            except: context_str = ""
            
            ai_prompt = f"""
            Context: {context_str}
            User Query: {message_text}
            ROLE: You are an expert Real Estate Strategy Consultant for the Hyderabad/Telangana market.
            LANGUAGE RULES:
            1. You are FLUENT in Telugu and English.
            2. If the user asks in Telugu, ANSWER IN TELUGU.
            3. Keep answers concise, strategic, and actionable (Bullet points preferred).
            TASK: Answer the user's query strategically.
            """

    if not should_reply: return jsonify({"status": "Stored (Silent Mode)"})

    # 3. Generate AI Reply
    try:
        ai_reply = generate_smart_content(ai_prompt)
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("INSERT INTO room_chats (room_id, sender_name, message, is_ai) VALUES (%s, %s, %s, %s)", (room_id, "AI Consultant", ai_reply, True))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"ai_reply": ai_reply})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/chat/clear', methods=['POST'])
def clear_room():
    # ... clear logic ...
    return jsonify({"status": "cleared"})

if __name__ == '__main__':
    app.run(debug=True)