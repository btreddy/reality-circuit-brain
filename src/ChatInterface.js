import React, { useState, useEffect, useRef } from 'react';
import './Main.css';

const API_URL = "https://reality-circuit-brain.onrender.com"; 

function ChatInterface({ senderName }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugError, setDebugError] = useState(null); 
  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 5000); 
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/api/chat/history?room_id=war_room_1`);
      const data = await res.json();
      
      // --- CRASH PROTECTION IS HERE ---
      if (Array.isArray(data)) {
        setMessages(data);
        setDebugError(null);
      } else {
        // If the backend sends an error, we catch it here instead of crashing
        console.error("Backend Error:", data);
        setDebugError(JSON.stringify(data)); 
      }
    } catch (err) {
      console.error("Network Error:", err);
      setDebugError(err.message);
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
    
    // Optimistic Update
    setMessages(prev => Array.isArray(prev) ? [...prev, tempMessage] : [tempMessage]);
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
      if (data.ai_reply) {
        setMessages(prev => Array.isArray(prev) ? [...prev, {
          sender: "AI Consultant",
          text: data.ai_reply,
          is_ai: true,
          timestamp: new Date().toISOString()
        }] : []);
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

      {/* ERROR MESSAGE PANEL */}
      {debugError && (
        <div style={{padding: '15px', background: '#330000', borderBottom: '1px solid red', color: 'red', fontSize: '0.9rem', fontFamily: 'monospace'}}>
          ⚠️ <strong>SYSTEM ERROR:</strong> {debugError}
          <br/><br/>
          <em>(Tell your developer: "The backend returned this error instead of a chat list")</em>
        </div>
      )}

      <div className="chat-window">
        {/* SAFE RENDER LOOP */}
        {Array.isArray(messages) && messages.map((msg, index) => (
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