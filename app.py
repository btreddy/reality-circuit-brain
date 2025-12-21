import os
import psycopg2
from flask import Flask, request, jsonify
from flask_cors import CORS
from tavily import TavilyClient
import google.generativeai as genai
from datetime import datetime
from supabase import create_client, Client
from werkzeug.utils import secure_filename
# --- CONFIGURATION ---
app = Flask(__name__)
CORS(app)

# Load Environment Variables
DB_URI = os.environ.get("DATABASE_URL")
GOOGLE_API_KEY = os.environ.get("GOOGLE_API_KEY")
TAVILY_API_KEY = os.environ.get("TAVILY_API_KEY")
# Initialize Supabase Client (For File Uploads)
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY") # This is the "anon" public key
supabase_client: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
# Initialize Clients
tavily = TavilyClient(api_key=TAVILY_API_KEY)
genai.configure(api_key=GOOGLE_API_KEY)

# --- HELPER: DATABASE CONNECTION ---
def get_db_connection():
    conn = psycopg2.connect(DB_URI)
    return conn

# --- HELPER: AUTO-DETECT AI MODEL ---
# --- HELPER: AUTO-DETECT AI MODEL ---
def get_working_model_name():
    """
    Connects to Google and asks for a list of available models.
    Returns the best one found (preferring 2.5 Flash), or a safe default.
    """
    try:
        print("--- CHECKING AVAILABLE MODELS ---")
        available_models = []
        
        # list_models() gets everything your API key can access
        for m in genai.list_models():
            if 'generateContent' in m.supported_generation_methods:
                available_models.append(m.name)
        
        print(f"Found models: {available_models}")

        # Priority 1: Try the newest 2.5 Flash (from your dashboard)
        for model in available_models:
            if "gemini-2.5-flash" in model:
                return model

        # Priority 2: Try 2.0 Flash Experimental
        for model in available_models:
            if "gemini-2.0-flash" in model:
                return model

        # Priority 3: Try 1.5 Flash
        for model in available_models:
            if "gemini-1.5-flash" in model:
                return model
                
        # Priority 4: If none match, grab the first valid text model
        if available_models:
            return available_models[0]

    except Exception as e:
        print(f"Error listing models: {e}")
    
    # CRITICAL CHANGE: Fallback to the one you see in your dashboard
    return 'gemini-2.5-flash'
    
    # 4. Absolute fallback if everything fails
    return 'gemini-1.5-flash'

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
    
    LANGUAGE & TONE RULES:
    - Detect the language of the USER QUESTION.
    - If the user asks in Telugu, reply in Telugu (using natural, conversational Telugu).
    - If the user asks in Hindi, reply in Hindi.
    - If the user uses "Hinglish" or "Teluglish" (mixed English), reply in the same mixed style.
    - ALWAYS maintain the professional "Consultant" persona, even in local languages.
    """
    
    full_prompt = f"{system_prompt}\n\nUSER QUESTION: {user_message}"

    # 3. Generate Response using Gemini
    try:
        # Dynamically get the working model name
        best_model_name = get_working_model_name()
        print(f"Selected AI Model: {best_model_name}")

        model = genai.GenerativeModel(best_model_name)
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
        # Ensure we select from public.room_chats just in case
        cur.execute("SELECT sender_name, message, is_ai, created_at FROM public.room_chats WHERE room_id = %s ORDER BY created_at ASC", (room_id,))
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
# --- REPLACE THE 'send_chat' FUNCTION WITH THIS ---

@app.route('/api/chat/send', methods=['POST'])
def send_chat():
    data = request.json
    room_id = data.get('room_id')
    sender_name = data.get('sender_name')
    message_text = data.get('message', '')

    # 1. Save the HUMAN's message to the database (Unless it's a hidden system trigger)
    # We don't save "User entered room" messages to keep the chat clean
    if sender_name != "SYSTEM_WELCOME":
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

    # 2. DECIDE: Should the AI reply?
    # RULE A: Reply if it's the Welcome Trigger
    # RULE B: Reply if it's the "AI Assist" Button (SYSTEM_COMMAND)
    # RULE C: Reply ONLY if the user explicitly types "@AI", "AI Consultant", or "Consultant"
    
    triggers = ["@ai", "ai consultant", "consultant", "hey ai"]
    is_addressed = any(t in message_text.lower() for t in triggers)
    
    should_reply = False
    ai_prompt = ""

    if sender_name == "SYSTEM_WELCOME":
        should_reply = True
        ai_prompt = f"You are an expert Strategic Consultant. The user '{message_text}' has just entered the 'War Room'. Give them a very short, professional, high-energy welcome message. Confirm you are ready to assist with data or strategy."
    
    elif sender_name == "SYSTEM_COMMAND":
        should_reply = True
        ai_prompt = message_text # Use the prompt from the button directly
        
    elif is_addressed:
        should_reply = True
        # Fetch history for context
        history = get_chat_history(room_id)
        context_str = "\n".join([f"{msg['sender']}: {msg['text']}" for msg in history[-10:]])
        ai_prompt = f"""
        Context of conversation:
        {context_str}
        
        User Query: {message_text}
        
        You are an expert Real Estate & Business Strategy Consultant. 
        Answer the user's query specifically. Be professional, concise, and strategic.
        """

    # 3. IF NO TRIGGER, RETURN SILENTLY (Stop here)
    if not should_reply:
        return jsonify({"status": "stored_silent"})

    # 4. IF TRIGGERED, CALL GEMINI
    try:
        response = genai.GenerativeModel('gemini-pro').generate_content(ai_prompt)
        ai_reply = response.text
        
        # Save AI Reply to DB
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute(
            "INSERT INTO room_chats (room_id, sender_name, message, is_ai) VALUES (%s, %s, %s, %s)",
            (room_id, sender_name, ai_reply, True) # Storing AI reply
        )
        conn.commit()
        cur.close()
        conn.close()
        
        return jsonify({"ai_reply": ai_reply})

    except Exception as e:
        print(f"AI Error: {e}")
        return jsonify({"error": str(e)}), 500

        # 1. Save User Message
        cur.execute(
            "INSERT INTO public.room_chats (room_id, sender_name, message, is_ai) VALUES (%s, %s, %s, %s)",
            (room_id, sender_name, user_message, False)
        )
        conn.commit()

        # 2. Trigger Gemini
        ai_reply = generate_war_room_response(user_message, room_id)

        # 3. Save AI Reply
        cur.execute(
            "INSERT INTO public.room_chats (room_id, sender_name, message, is_ai) VALUES (%s, %s, %s, %s)",
            (room_id, "AI Consultant", ai_reply, True)
        )
        conn.commit()

        cur.close()
        conn.close()

        return jsonify({"status": "success", "ai_reply": ai_reply})
    
    except Exception as e:
        return jsonify({"error": str(e)}), 500
# --- ROUTE 3: CLEAR CHAT HISTORY ---
@app.route('/api/chat/clear', methods=['POST'])
def clear_chat_history():
    data = request.json
    room_id = data.get('room_id')
    
    if not room_id:
        return jsonify({"error": "Room ID required"}), 400

    try:
        conn = get_db_connection()
        cur = conn.cursor()
        # Delete chats ONLY for this specific room
        cur.execute("DELETE FROM public.room_chats WHERE room_id = %s", (room_id,))
        conn.commit()
        cur.close()
        conn.close()
        return jsonify({"status": "success", "message": "Room cleared"})
    except Exception as e:
        return jsonify({"error": str(e)}), 500
# --- ROUTE 4: FILE UPLOAD ---
@app.route('/api/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({"error": "No file part"}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    # Secure the filename and add a timestamp to prevent duplicates
    filename = secure_filename(file.filename)
    unique_name = f"{datetime.now().timestamp()}_{filename}"

    try:
        # Read file data
        file_content = file.read()

        # Upload to Supabase Bucket 'war-room-uploads'
        res = supabase_client.storage.from_("war-room-uploads").upload(
            path=unique_name, 
            file=file_content,
            file_options={"content-type": file.content_type}
        )

        # Get the Public Link
        public_url = supabase_client.storage.from_("war-room-uploads").get_public_url(unique_name)

        return jsonify({"url": public_url})

    except Exception as e:
        print(f"Upload Error: {e}")
        return jsonify({"error": str(e)}), 500
if __name__ == '__main__':
    app.run(debug=True)