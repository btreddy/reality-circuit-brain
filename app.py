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

# --- NEW: THE REPAIR KIT (RUN THIS ONCE) ---
@app.route('/api/fix_db', methods=['GET'])
def fix_database_schema():
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        
        # 1. Nuclear Option: Drop the old table that is missing columns
        cur.execute("DROP TABLE IF EXISTS room_chats;")
        
        # 2. Re-create it with the correct "timestamp" column
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
        return "<h1>✅ DATABASE REPAIRED!</h1> <p>The 'timestamp' column has been added. You can close this tab and return to the War Room.</p>"
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

# 4. SEND MESSAGE (Smart & Clean)
@app.route('/api/chat/send', methods=['POST'])
def send_chat():
    data = request.json
    room_id = data.get('room_id')
    sender_name = data.get('sender_name')
    message_text = data.get('message', '')

    # SAVE HUMAN MESSAGE (Ignore System Commands)
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

    # AI LOGIC
    should_reply = False
    ai_prompt = ""

    if sender_name == "SYSTEM_WELCOME":
        should_reply = True
        ai_prompt = f"You are an expert Strategic Consultant. The user '{message_text}' has just entered the 'War Room'. Give them a very short, professional, high-energy welcome message."

    elif sender_name == "SYSTEM_COMMAND":
        should_reply = True
        ai_prompt = message_text

    else:
        # Check for Triggers
        triggers = ["@ai", "ai consultant", "consultant", "hey ai"]
        is_command = "execute option" in message_text.lower()
        is_addressed = any(t in message_text.lower() for t in triggers) or is_command
        
        if is_addressed:
            should_reply = True
            try:
                # Fetch context
                conn = get_db_connection()
                cur = conn.cursor(cursor_factory=RealDictCursor)
                cur.execute("SELECT * FROM room_chats WHERE room_id = %s ORDER BY timestamp ASC LIMIT 15", (room_id,))
                rows = cur.fetchall()
                cur.close()
                conn.close()
                context_str = "\n".join([f"{r['sender_name']}: {r['message']}" for r in rows])
            except:
                context_str = ""

            ai_prompt = f"""
            Context: {context_str}
            User: {message_text}
            You are a Strategy Consultant. If the user says "EXECUTE OPTION", perform the analysis. Otherwise, answer the question.
            """

    if not should_reply:
        return jsonify({"status": "Stored"})

    try:
        model = genai.GenerativeModel('gemini-pro')
        response = model.generate_content(ai_prompt)
        ai_reply = response.text
        
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

# 5. CLEAR ROOM
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