from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
import os
import google.generativeai as genai

app = Flask(__name__)
CORS(app)

# 1. DATABASE CONNECTION
def get_db_connection():
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    return conn

# 2. GEMINI CONFIGURATION
genai.configure(api_key=os.environ['GOOGLE_API_KEY'])

# 3. SETUP DATABASE TABLE (Run this once if needed)
@app.route('/api/setup', methods=['GET'])
def setup_db():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
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
        return jsonify({"status": "Database Ready!"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# 4. HISTORY ENDPOINT
@app.route('/api/chat/history', methods=['GET'])
def get_chat_history():
    room_id = request.args.get('room_id')
    try:
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        # Order by timestamp so older messages come first
        cur.execute("SELECT * FROM room_chats WHERE room_id = %s ORDER BY timestamp ASC", (room_id,))
        rows = cur.fetchall()
        cur.close()
        conn.close()
        
        # Format for Frontend
        messages = []
        for row in rows:
            messages.append({
                "sender": row['sender_name'],
                "text": row['message'],
                "is_ai": row['is_ai'],
                "timestamp": row['timestamp']
            })
        return jsonify(messages)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# 5. SEND MESSAGE & AI BRAIN (THE CRITICAL FIX)
@app.route('/api/chat/send', methods=['POST'])
def send_chat():
    data = request.json
    room_id = data.get('room_id')
    sender_name = data.get('sender_name')
    message_text = data.get('message', '')

    # --- CRITICAL FIX: DO NOT SAVE SYSTEM COMMANDS TO DB ---
    # We only save "Real" human messages. 
    # We IGNORE "SYSTEM_COMMAND" (Hidden prompts) and "SYSTEM_WELCOME" (Hidden triggers)
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
            return jsonify({"error": str(e)}), 500

    # --- AI LOGIC ---
    should_reply = False
    ai_prompt = ""

    # 1. Welcome Trigger
    if sender_name == "SYSTEM_WELCOME":
        should_reply = True
        ai_prompt = f"You are an expert Strategic Consultant. The user '{message_text}' has just entered the 'War Room'. Give them a very short, professional, high-energy welcome message."

    # 2. System Command (The "AI Assist" Button)
    elif sender_name == "SYSTEM_COMMAND":
        should_reply = True
        ai_prompt = message_text  # Use the hidden prompt exactly as sent

    # 3. Human Chat Trigger (Mentions @AI or uses "EXECUTE OPTION")
    else:
        triggers = ["@ai", "ai consultant", "consultant", "hey ai"]
        is_addressed = any(t in message_text.lower() for t in triggers)
        
        # Check for the secret button code
        is_command = "execute option" in message_text.lower()
        
        if is_addressed or is_command:
            should_reply = True
            
            # Fetch Context (Last 15 messages)
            try:
                conn = get_db_connection()
                cur = conn.cursor(cursor_factory=RealDictCursor)
                cur.execute("SELECT * FROM room_chats WHERE room_id = %s ORDER BY timestamp ASC LIMIT 15", (room_id,))
                history_rows = cur.fetchall()
                cur.close()
                conn.close()
                
                context_str = "\n".join([f"{row['sender_name']}: {row['message']}" for row in history_rows])
            except:
                context_str = "No history available."

            ai_prompt = f"""
            You are a Real Estate Strategy Consultant.
            
            CONTEXT OF CONVERSATION:
            {context_str}
            
            USER MESSAGE: {message_text}
            
            INSTRUCTIONS:
            - If the user said "EXECUTE OPTION X", look at the history, find that option, and perform the analysis in detail.
            - If the user asked a question, answer it strategically.
            - Keep formatting clean (Use Bullet points).
            """

    # --- IF NO AI TRIGGER, STOP HERE ---
    if not should_reply:
        return jsonify({"status": "Message stored (Silent)"})

    # --- IF TRIGGERED, CALL GEMINI ---
    try:
        model = genai.GenerativeModel('gemini-pro')
        response = model.generate_content(ai_prompt)
        ai_reply = response.text
        
        # Save AI Reply to DB
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
        print(f"AI Error: {e}")
        return jsonify({"error": str(e)}), 500

# 6. CLEAR MEMORY
@app.route('/api/chat/clear', methods=['POST'])
def clear_room():
    data = request.json
    room_id = data.get('room_id')
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("DELETE FROM room_chats WHERE room_id = %s", (room_id,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "cleared"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# 7. UPLOAD (Simple Version)
@app.route('/api/upload', methods=['POST'])
def upload_file():
    # You are using Supabase storage in frontend, or if you need a placeholder:
    return jsonify({"url": "[FILE UPLOADED]"})

if __name__ == '__main__':
    app.run(debug=True)