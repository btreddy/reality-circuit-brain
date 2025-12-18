import os
import psycopg2
from flask import Flask, request, jsonify
from flask_cors import CORS
from tavily import TavilyClient
from openai import OpenAI
from datetime import datetime

# --- CONFIGURATION ---
app = Flask(__name__)
CORS(app)  # Allow React Frontend to talk to this Backend

# Load Environment Variables (Set these in Render/Vercel)
DB_URI = os.environ.get("DATABASE_URL")
OPENAI_API_KEY = os.environ.get("OPENAI_API_KEY")
TAVILY_API_KEY = os.environ.get("TAVILY_API_KEY")

# Initialize Clients
tavily = TavilyClient(api_key=TAVILY_API_KEY)
client = OpenAI(api_key=OPENAI_API_KEY)

# --- HELPER: DATABASE CONNECTION ---
def get_db_connection():
    conn = psycopg2.connect(DB_URI)
    return conn

# --- HELPER: AI AGENT WITH SEARCH ---
def generate_war_room_response(user_message, room_id):
    """
    The AI acts as a consultant. It decides if it needs to search the web 
    before answering.
    """
    
    # 1. Decide if search is needed (Simple keyword check or LLM decision)
    # For this version, we will perform a search if the prompt asks for "current", "price", "news", or "competitor"
    needs_search = any(keyword in user_message.lower() for keyword in ["current", "price", "news", "trend", "competitor", "market", "latest"])
    
    context_data = ""
    
    if needs_search:
        print(f"Searching Tavily for: {user_message}")
        try:
            search_result = tavily.search(query=user_message, search_depth="basic")
            # Compress results for the AI
            context_data = f"\n[REAL-TIME SEARCH DATA]: {search_result['results']}\n"
        except Exception as e:
            print(f"Search failed: {e}")
            context_data = "\n[Search unavailable, answering from general knowledge]\n"

    # 2. Generate AI Response
    system_prompt = f"""
    You are a Strategic Consultant in 'The Innovation War Room'.
    You are collaborating with a team of business owners.
    
    Your Goal: Validate ideas, provide market data, and challenge assumptions.
    
    {context_data}
    
    If search data is provided above, use it to give specific, grounded answers. 
    Keep responses concise, professional, and actionable.
    """

    response = client.chat.completions.create(
        model="gpt-4o", # Or gpt-3.5-turbo
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message}
        ]
    )
    
    return response.choices[0].message.content

# --- ROUTE 1: GET CHAT HISTORY ---
@app.route('/api/chat/history', methods=['GET'])
def get_chat_history():
    room_id = request.args.get('room_id', 'default_room')
    
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

# --- ROUTE 2: SEND MESSAGE ---
@app.route('/api/chat/send', methods=['POST'])
def send_message():
    data = request.json
    room_id = data.get('room_id', 'default_room')
    user_message = data.get('message')
    sender_name = data.get('sender_name', 'User')

    if not user_message:
        return jsonify({"error": "No message provided"}), 400

    conn = get_db_connection()
    cur = conn.cursor()

    # 1. Save User Message to DB
    cur.execute(
        "INSERT INTO room_chats (room_id, sender_name, message, is_ai) VALUES (%s, %s, %s, %s)",
        (room_id, sender_name, user_message, False)
    )
    conn.commit()

    # 2. Trigger AI Agent
    ai_reply = generate_war_room_response(user_message, room_id)

    # 3. Save AI Reply to DB
    cur.execute(
        "INSERT INTO room_chats (room_id, sender_name, message, is_ai) VALUES (%s, %s, %s, %s)",
        (room_id, "AI Consultant", ai_reply, True)
    )
    conn.commit()

    cur.close()
    conn.close()

    return jsonify({"status": "success", "ai_reply": ai_reply})

if __name__ == '__main__':
    app.run(debug=True)