import os
import psycopg2
from flask import Flask, request, jsonify
from flask_cors import CORS
from tavily import TavilyClient
import google.generativeai as genai
from datetime import datetime

# --- CONFIGURATION ---
app = Flask(__name__)
CORS(app)

# Load Environment Variables
DB_URI = os.environ.get("DATABASE_URL")
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")
TAVILY_API_KEY = os.environ.get("TAVILY_API_KEY")

# Initialize Clients
tavily = TavilyClient(api_key=TAVILY_API_KEY)
genai.configure(api_key=GOOGLE_API_KEY)

# --- HELPER: DATABASE CONNECTION ---
def get_db_connection():
    conn = psycopg2.connect(DB_URI)
    return conn

# --- HELPER: AI AGENT (GEMINI + TAVILY) ---
def generate_war_room_response(user_message, room_id):
    # 1. Decide if search is needed
    needs_search = any(keyword in user_message.lower() for keyword in ["current", "price", "news", "trend", "competitor", "market", "latest", "search"])
    
    context_data = ""
    
    if needs_search:
        print(f"Searching Tavily for: {user_message}")
        try:
            search_result = tavily.search(query=user_message, search_depth="basic")
            context_data = f"\n[REAL-TIME SEARCH DATA FOUND]:\n{search_result['results']}\n"
        except Exception as e:
            print(f"Search failed: {e}")
            context_data = "\n[Search unavailable, answering from general knowledge]\n"

    # 2. Construct Prompt for Gemini
    system_prompt = f"""
    You are a Strategic Consultant in 'The Innovation War Room'.
    You are collaborating with a team of business owners.
    
    Your Goal: Validate ideas, provide market data, and challenge assumptions.
    
    CONTEXT FROM INTERNET:
    {context_data}
    
    INSTRUCTIONS:
    - If search data is provided, use it to give specific, grounded answers.
    - Keep responses concise, professional, and actionable.
    - Do not mention 'I am an AI'. Act like a human consultant.
    """
    
    full_prompt = f"{system_prompt}\n\nUSER QUESTION: {user_message}"

    # 3. Generate Response using Gemini
    try:
        model = genai.GenerativeModel('gemini-1.5-flash')
        response = model.generate_content(full_prompt)
        return response.text
    except Exception as e:
        return f"System Alert: AI Consultant is offline temporarily. ({str(e)})"

# --- ROUTE 1: GET CHAT HISTORY ---
@app.route('/api/chat/history', methods=['GET'])
def get_chat_history():
    room_id = request.args.get('room_id', 'default_room')
    
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT sender_name, message, is_ai, created_at FROM room_chats WHERE room_id = %s ORDER BY created_at ASC", (room_id,))
        rows = cur.fetchall()
        cur.close()
        conn.close()
        
        history = []
        for row in rows:
            history.append({
                "sender": row[0],
                "text": row[1],
                "is_ai": row[2],
                "timestamp": row[3]
            })
        return jsonify(history)
    except Exception as e:
        return jsonify({"error": str(e)}), 500

# --- ROUTE 2: SEND MESSAGE ---
@app.route('/api/chat/send', methods=['POST'])
def send_message():
    data = request.json
    room_id = data.get('room_id', 'default_room')
    user_message = data.get('message')
    sender_name = data.get('sender_name', 'User')

    if not user_message:
        return jsonify({"error": "No message provided"}), 400

    try:
        conn = get_db_connection()
        cur = conn.cursor()

        # 1. Save User Message
        cur.execute(
            "INSERT INTO room_chats (room_id, sender_name, message, is_ai) VALUES (%s, %s, %s, %s)",
            (room_id, sender_name, user_message, False)
        )
        conn.commit()

        # 2. Trigger Gemini
        ai_reply = generate_war_room_response(user_message, room_id)

        # 3. Save AI Reply
        cur.execute(
            "INSERT INTO room_chats (room_id, sender_name, message, is_ai) VALUES (%s, %s, %s, %s)",
            (room_id, "AI Consultant", ai_reply, True)
        )
        conn.commit()

        cur.close()
        conn.close()

        return jsonify({"status": "success", "ai_reply": ai_reply})
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)