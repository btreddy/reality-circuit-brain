from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
import os
import google.generativeai as genai

app = Flask(__name__)
CORS(app)

# 1. CONFIGURATION
def get_db_connection():
    return psycopg2.connect(os.environ['DATABASE_URL'])

genai.configure(api_key=os.environ['GOOGLE_API_KEY'])

# --- THE UNSTOPPABLE BRAIN FUNCTION ---
def generate_smart_content(prompt):
    """
    Tries multiple models in order. If one fails (quota/error), 
    it automatically switches to the next one.
    """
    models_to_try = [
        'gemini-2.0-flash-exp',  # 1. Newest & Fastest
        'gemini-1.5-flash',      # 2. Reliable Standard
        'gemini-1.5-pro'         # 3. Heavy Duty Fallback
    ]

    for model_name in models_to_try:
        try:
            print(f"🧠 Trying Brain: {model_name}...")
            model = genai.GenerativeModel(model_name)
            response = model.generate_content(prompt)
            return response.text 
        except Exception as e:
            print(f"⚠️ {model_name} Failed: {e}")
            continue
    
    raise Exception("All AI Brains are currently busy or offline. Please try again in 1 minute.")

# 2. AUTO-REPAIR (DB Health)
def nuclear_fix_db():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        print("⚠️ DETECTED BROKEN DB. RUNNING NUCLEAR REPAIR...")
        cur.execute("DROP TABLE IF EXISTS room_chats;")
        cur.execute("""
            CREATE TABLE room_chats (
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
        print("✅ DATABASE REPAIRED SUCCESSFULLY.")
    except Exception as e:
        print(f"❌ REPAIR FAILED: {e}")
        # --- NEW: USER DATABASE SETUP ---
@app.route('/api/setup_users', methods=['GET'])
def setup_user_table():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # Create Users Table
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
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
        return "<h1>✅ USER TABLE CREATED!</h1> <p>The foundation for the Locking System is ready.</p>"
    except Exception as e:
        return f"<h1>❌ ERROR:</h1> <p>{str(e)}</p>"

# 3. HISTORY ENDPOINT
@app.route('/api/chat/history', methods=['GET'])
def get_chat_history():
    room_id = request.args.get('room_id')
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        cur.execute("SELECT * FROM room_chats WHERE room_id = %s ORDER BY timestamp ASC", (room_id,))
        rows = cur.fetchall()
        cur.close()
        conn.close()
        
        messages = [{
            "sender": row['sender_name'], 
            "text": row['message'], 
            "is_ai": row['is_ai'], 
            "timestamp": row['timestamp']
        } for row in rows]
        return jsonify(messages)

    except Exception as e:
        if "does not exist" in str(e):
            nuclear_fix_db()
            return jsonify([])
        return jsonify({"error": str(e)}), 500

# 4. SEND MESSAGE ENDPOINT
@app.route('/api/chat/send', methods=['POST'])
def send_chat():
    data = request.json
    room_id = data.get('room_id')
    sender_name = data.get('sender_name')
    message_text = data.get('message', '')

    # SAVE HUMAN MESSAGE
    if sender_name not in ["SYSTEM_COMMAND", "SYSTEM_WELCOME"]:
        try:
            conn = get_db_connection()
            cur = conn.cursor()
            cur.execute(
                "INSERT INTO room_chats (room_id, sender_name, message, is_ai) VALUES (%s, %s, %s, %s)",
                (room_id, sender_name, message_text, False)
            )
            conn.commit()
            cur.close()
            conn.close()
        except Exception as e:
            if "does not exist" in str(e): nuclear_fix_db()
            return jsonify({"error": str(e)}), 500

    # --- DECISION LOGIC ---
    should_reply = False
    ai_prompt = ""

    if sender_name == "SYSTEM_WELCOME":
        should_reply = True
        ai_prompt = f"You are an expert Strategic Consultant. The user '{message_text}' has just entered the 'War Room'. Give them a very short, professional, high-energy welcome message."

    elif sender_name == "SYSTEM_COMMAND":
        should_reply = True
        ai_prompt = message_text

    else:
        # 1. CHECK HOW MANY HUMANS ARE IN THE ROOM
        try:
            conn = get_db_connection()
            cur = conn.cursor()
            # Count distinct senders
            cur.execute("""
                SELECT COUNT(DISTINCT sender_name) 
                FROM room_chats 
                WHERE room_id = %s 
                AND is_ai = FALSE 
                AND sender_name NOT LIKE 'SYSTEM_%'
            """, (room_id,))
            human_count = cur.fetchone()[0]
            cur.close()
            conn.close()
        except:
            human_count = 1 

        # 2. DEFINE TRIGGERS
        triggers = ["@ai", "ai consultant", "consultant", "hey ai"]
        is_command = "execute option" in message_text.lower()
        is_addressed = any(t in message_text.lower() for t in triggers)
        
        # 3. SOLO MODE: If 1 human, AI talks automatically.
        if human_count <= 1:
            is_addressed = True 

        if is_addressed or is_command:
            should_reply = True
            try:
                # Fetch Context
                conn = get_db_connection()
                cur = conn.cursor(cursor_factory=RealDictCursor)
                cur.execute("SELECT * FROM room_chats WHERE room_id = %s ORDER BY timestamp ASC LIMIT 15", (room_id,))
                rows = cur.fetchall()
                cur.close()
                conn.close()
                context_str = "\n".join([f"{r['sender_name']}: {r['message']}" for r in rows])
            except:
                context_str = ""
            
            # --- THE FIX: FORCED LANGUAGE INSTRUCTION ---
            ai_prompt = f"""
            Context: {context_str}
            User Query: {message_text}
            
            ROLE: You are an expert Real Estate Strategy Consultant for the Hyderabad/Telangana market.
            
            LANGUAGE RULES:
            1. You are FLUENT in Telugu and English.
            2. If the user asks in Telugu, ANSWER IN TELUGU. Do not apologize. Do not say you cannot translate. Just do it.
            3. If the user asks for English, answer in English.
            
            TASK: Answer the user's query strategically.
            """

    if not should_reply:
        return jsonify({"status": "Stored"})

    # CALL THE BRAIN
    try:
        ai_reply = generate_smart_content(ai_prompt)
    except Exception as e:
        print(f"ALL AI FAILED: {e}")
        ai_reply = f"⚠️ SYSTEM ERROR: All AI circuits busy. {str(e)}"

    # SAVE AI REPLY
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO room_chats (room_id, sender_name, message, is_ai) VALUES (%s, %s, %s, %s)",
            (room_id, "AI Consultant", ai_reply, True)
        )
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"ai_reply": ai_reply})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/chat/clear', methods=['POST'])
def clear_room():
    data = request.json
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM room_chats WHERE room_id = %s", (data.get('room_id'),))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "cleared"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

@app.route('/api/upload', methods=['POST'])
def upload_file():
    return jsonify({"url": "[FILE UPLOADED]"})

if __name__ == '__main__':
    app.run(debug=True)