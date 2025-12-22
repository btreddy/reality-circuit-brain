from flask import Flask, request, jsonify
from flask_cors import CORS
import psycopg2
from psycopg2.extras import RealDictCursor
import os
import google.generativeai as genai
from datetime import datetime

app = Flask(__name__)
CORS(app)

# --- CONFIGURATION ---
DB_URL = os.environ.get("DATABASE_URL", "postgresql://reality_db_user:KkS235789@dpg-ct1234.render.com/reality_db")
GEMINI_KEY = os.environ.get("GEMINI_API_KEY")

genai.configure(api_key=GEMINI_KEY)

# Use Flash (Fast & Supports Images)
model = genai.GenerativeModel('gemini-1.5-flash')

# --- DATABASE CONNECTION ---
def get_db_connection():
    return psycopg2.connect(DB_URL)

# --- SMART GENERATION (TEXT + VISION) ---
def generate_smart_content(prompt_text, image_data=None, mime_type=None):
    try:
        # Base System Prompt (The Persona)
        # --- UNIVERSAL STRATEGIST PERSONA ---
        system_instruction = """
        ROLE: You are 'Reality Circuit', a high-level Strategic Innovation Partner.
        
        YOUR MISSION:
        1. Help the user BRAINSTORM innovative ideas (Business, Tech, Life).
        2. Act as a "Second Brain" to clarify complex thoughts.
        3. If the user discusses Real Estate, switch to "Expert Consultant" mode (Analyze risks, ROI).
        4. If the user discusses App Dev, switch to "Tech Lead" mode.
        
        TONE:
        - Professional, sharp, and encouraging.
        - "War Room" aesthetic (Military-grade precision).
        - Fluent in Telugu and English (Answer in the language asked).
        
        FORMAT:
        - Use bullet points for clarity.
        - Keep answers actionable.
        """
        
        if image_data:
            # --- VISION MODE ---
            # We construct a list of parts: [Text Prompt, Image Data]
            content_parts = [
                system_instruction + "\n\nUSER QUERY: " + prompt_text,
                {"mime_type": mime_type, "data": image_data}
            ]
            response = model.generate_content(content_parts)
        else:
            # --- TEXT ONLY MODE ---
            response = model.generate_content(system_instruction + "\n\n" + prompt_text)
            
        return response.text.strip()
    except Exception as e:
        return f"STRATEGIC ERROR: {str(e)}"

# --- ROUTES ---

@app.route('/')
def home():
    return "WAR ROOM HQ ONLINE. SYSTEMS NOMINAL."

@app.route('/api/chat/history', methods=['GET'])
def get_history():
    room_id = request.args.get('room_id')
    conn = get_db_connection()
    cur = conn.cursor(cursor_factory=RealDictCursor)
    cur.execute("SELECT * FROM room_chats WHERE room_id = %s ORDER BY timestamp ASC", (room_id,))
    messages = cur.fetchall()
    cur.close()
    conn.close()
    return jsonify(messages)

@app.route('/api/chat/clear', methods=['POST'])
def clear_history():
    data = request.json
    room_id = data.get('room_id')
    conn = get_db_connection()
    cur = conn.cursor()
    cur.execute("DELETE FROM room_chats WHERE room_id = %s", (room_id,))
    conn.commit()
    cur.close()
    conn.close()
    return jsonify({"status": "CLEARED"})

@app.route('/api/chat/send', methods=['POST'])
def send_chat():
    data = request.json
    room_id = data.get('room_id')
    sender_name = data.get('sender_name')
    message_text = data.get('message', '')
    
    # NEW: Capture File Data
    file_data = data.get('file_data') # Base64 string
    mime_type = data.get('mime_type')

    # 1. Store the Human Message
    if sender_name not in ["SYSTEM_COMMAND", "SYSTEM_WELCOME"]:
        display_text = message_text
        if file_data:
            display_text = f"[ATTACHMENT ANALYZED] {message_text}"
            
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO room_chats (room_id, sender_name, message, is_ai) VALUES (%s, %s, %s, %s)", 
            (room_id, sender_name, display_text, False)
        )
        conn.commit()
        cur.close()
        conn.close()

    # 2. DECIDE: Should AI Reply?
    should_reply = False
    ai_prompt = ""
    
    # CASE A: User Uploaded a File (ALWAYS REPLY)
    if file_data:
        should_reply = True
        ai_prompt = f"Analyze this image attachment. User Note: {message_text}"
    
    # CASE B: System Welcome
    elif sender_name == "SYSTEM_WELCOME":
        should_reply = True
        ai_prompt = f"The user '{message_text}' has entered. Give a short, high-energy War Room welcome."
    
    # CASE C: Text Message (Check for Triggers)
    else:
        # Check context
        conn = get_db_connection()
        cur = conn.cursor(cursor_factory=RealDictCursor)
        # Fetch last 5 messages for context
        cur.execute("SELECT * FROM room_chats WHERE room_id = %s ORDER BY timestamp ASC LIMIT 10", (room_id,))
        rows = cur.fetchall()
        context_str = "\n".join([f"{r['sender_name']}: {r['message']}" for r in rows])
        cur.close()
        conn.close()

        triggers = ["@ai", "swot", "risks", "roi", "analyze", "identify", "help", "strategy"]
        is_addressed = any(t in message_text.lower() for t in triggers)
        
        # Auto-reply if it's the only conversation happening or triggered
        should_reply = True # (We can be aggressive now that we have the 'Exit' limit)

        if is_addressed or should_reply:
            ai_prompt = f"Context:\n{context_str}\n\nUser Query: {message_text}"

    if not should_reply:
        return jsonify({"status": "Stored (Silent Mode)"})

    # 3. Generate AI Reply (With Vision Support)
    try:
        # Pass file data if it exists
        ai_reply = generate_smart_content(ai_prompt, file_data if file_data else None, mime_type)
        
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("INSERT INTO room_chats (room_id, sender_name, message, is_ai) VALUES (%s, %s, %s, %s)", (room_id, "AI Consultant", ai_reply, True))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"ai_reply": ai_reply})
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)