from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
import os
import google.generativeai as genai
import time

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
    # The Hierarchy of Brains (Best to Backup)
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
            return response.text # Success! Return the answer.
        except Exception as e:
            print(f"⚠️ {model_name} Failed: {e}")
            # If it's a quota error (429) or not found (404), we continue to the next model.
            continue
    
    # If ALL models fail, then we return the error
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

    # DECIDE IF AI SHOULD REPLY
    should_reply = False
    ai_prompt = ""

    if sender_name == "SYSTEM_WELCOME":
        should_reply = True
        ai_prompt = f"You are an expert Strategic Consultant. The user '{message_text}' has just entered the 'War Room'. Give them a very short, professional, high-energy welcome message."

    elif sender_name == "SYSTEM_COMMAND":
        should_reply = True
        ai_prompt = message_text

    else:
        triggers = ["@ai", "ai consultant", "consultant", "hey ai"]
        is_command = "execute option" in message_text.lower()
        if any(t in message_text.lower() for t in triggers) or is_command:
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
            ai_prompt = f"Context: {context_str}\nUser: {message_text}\nAnswer strategically."

    if not should_reply:
        return jsonify({"status": "Stored"})

    # CALL THE UNSTOPPABLE BRAIN
    try:
        # Use our new smarter function that tries multiple models
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