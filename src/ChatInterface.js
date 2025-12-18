import React, { useState, useEffect, useRef } from 'react';
import './Main.css'; // We will add chat styles here later

const API_URL = "https://reality-circuit-brain.onrender.com"; // Your Render Backend

function ChatInterface({ senderName }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // 1. Load History on Mount
  useEffect(() => {
    fetchHistory();
    // Optional: Set up a polling interval to get new messages every 5 seconds
    const interval = setInterval(fetchHistory, 5000); 
    return () => clearInterval(interval);
  }, []);

  // 2. Scroll to bottom when messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/api/chat/history?room_id=war_room_1`);
      const data = await res.json();
      setMessages(data);
    } catch (err) {
      console.error("Failed to load chat:", err);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    const tempMessage = { 
      sender: senderName, 
      text: inputText, 
      is_ai: false, 
      timestamp: new Date().toISOString() 
    };
    
    // Optimistic UI update (show message immediately)
    setMessages(prev => [...prev, tempMessage]);
    setInputText('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: 'war_room_1',
          sender_name: senderName,
          message: tempMessage.text
        })
      });

      const data = await res.json();
      
      // Add AI Response to chat
      if (data.ai_reply) {
        setMessages(prev => [...prev, {
          sender: "AI Consultant",
          text: data.ai_reply,
          is_ai: true,
          timestamp: new Date().toISOString()
        }]);
      }
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="chat-interface">
      <div className="chat-header">
        <h3>THE WAR ROOM // LIVE STRATEGY</h3>
        <span className="live-indicator">● ONLINE</span>
      </div>

      <div className="chat-window">
        {messages.map((msg, index) => (
          <div key={index} className={`message-row ${msg.is_ai ? 'ai-row' : 'user-row'}`}>
            <div className={`message-bubble ${msg.is_ai ? 'ai-bubble' : 'user-bubble'}`}>
              <div className="msg-sender">{msg.sender}</div>
              <div className="msg-text">{msg.text}</div>
              <div className="msg-time">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
            </div>
          </div>
        ))}
        {loading && <div className="typing-indicator">AI Consultant is researching market data...</div>}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-area" onSubmit={sendMessage}>
        <input 
          type="text" 
          value={inputText} 
          onChange={(e) => setInputText(e.target.value)} 
          placeholder="Ask for strategy, competitor prices, or trends..." 
        />
        <button type="submit" disabled={loading}>SEND</button>
      </form>
    </div>
  );
}

export default ChatInterface;