import React, { useState, useEffect, useRef } from 'react';
import './Main.css';

const API_URL = "https://reality-circuit-brain.onrender.com"; 

// 1. We now accept 'roomId' as a prop from App.js
function ChatInterface({ senderName, roomId }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [debugError, setDebugError] = useState(null); 
  
  // Scroll State
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const messagesEndRef = useRef(null);
  const chatWindowRef = useRef(null); 

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 5000); 
    return () => clearInterval(interval);
  }, [roomId]); // Refresh if room changes

  useEffect(() => {
    if (shouldAutoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, shouldAutoScroll]);

  const handleScroll = () => {
    if (chatWindowRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatWindowRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setShouldAutoScroll(isAtBottom);
    }
  };

  const fetchHistory = async () => {
    try {
      // 2. Use the dynamic roomId here!
      const res = await fetch(`${API_URL}/api/chat/history?room_id=${roomId}`);
      const data = await res.json();
      
      if (Array.isArray(data)) {
        setMessages(data);
        setDebugError(null);
      } else {
        console.error("Backend Error:", data);
        setDebugError(JSON.stringify(data)); 
      }
    } catch (err) {
      console.error("Network Error:", err);
      setDebugError(err.message);
    }
  };

  // --- NEW: CLEAR ROOM FUNCTION ---
  const clearRoom = async () => {
    if(!window.confirm("WARNING: This will delete all history for this room. Are you sure?")) return;
    
    try {
      await fetch(`${API_URL}/api/chat/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId })
      });
      setMessages([]); // Wipe screen immediately
    } catch (err) {
      alert("Failed to clear room");
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    setShouldAutoScroll(true);

    const tempMessage = { 
      sender: senderName, 
      text: inputText, 
      is_ai: false, 
      timestamp: new Date().toISOString() 
    };
    
    setMessages(prev => Array.isArray(prev) ? [...prev, tempMessage] : [tempMessage]);
    setInputText('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: roomId, // 3. Send the correct Room ID
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
      setShouldAutoScroll(true);
    }
  };

  return (
    <div className="chat-interface">
      <div className="chat-header">
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%'}}>
            <div>
                <h3 style={{margin:0}}>WAR ROOM: {roomId.toUpperCase()}</h3>
                <span className="live-indicator">● ONLINE | AGENT: {senderName}</span>
            </div>
            {/* 4. The Clear Button */}
            <button onClick={clearRoom} style={{
                background: '#330000', border: '1px solid red', color: 'red', 
                padding: '5px 10px', cursor: 'pointer', fontSize: '0.7rem'
            }}>
                ⚠ WIPE MEMORY
            </button>
        </div>
      </div>

      {debugError && (
        <div style={{padding: '15px', background: '#330000', borderBottom: '1px solid red', color: 'red', fontSize: '0.9rem', fontFamily: 'monospace'}}>
          ⚠️ <strong>SYSTEM ERROR:</strong> {debugError}
        </div>
      )}

      <div 
        className="chat-window" 
        ref={chatWindowRef} 
        onScroll={handleScroll}
      >
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