import React, { useState, useEffect, useRef } from 'react';
import './Main.css';

// FIX: Use relative path (empty string) so it works on any domain automatically
const API_BASE_URL = "https://careco-pilotai.com";

function ChatInterface({ roomId, username, onLeave }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // 1. Auto-Scroll to bottom
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => { scrollToBottom(); }, [messages]);

  // 2. Load History on Mount
  useEffect(() => {
    fetch(`${API_BASE_URL}/api/chat/history?room_id=${roomId}`)
      .then(res => res.json())
      .then(data => setMessages(data))
      .catch(err => console.error("History Error:", err));
  }, [roomId]);

  // 3. Send Message Function
  const sendMessage = async () => {
    if (!inputText.trim()) return;
    
    // Optimistic UI: Add User Message Instantly
    const newMsg = { sender_name: username, message: inputText, is_ai: false };
    setMessages(prev => [...prev, newMsg]);
    
    setLoading(true);
    const originalText = inputText;
    setInputText(''); // Clear Input

    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: roomId,
          sender_name: username,
          message: originalText
        })
      });
      
      const data = await res.json();
      if (data.error) {
         setMessages(prev => [...prev, { sender_name: "SYSTEM", message: `⚠️ ${data.error}`, is_ai: true }]);
      } else {
         setMessages(prev => [...prev, { sender_name: "Reality Circuit", message: data.ai_reply, is_ai: true }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, { sender_name: "SYSTEM", message: "❌ CONNECTION LOST. CHECK SERVER.", is_ai: true }]);
    }
    setLoading(false);
  };

  // 4. Quick Actions
  const handleQuickAction = (action) => {
    let prompt = "";
    if (action === "IDEAS") prompt = "Brainstorm 3 innovative ideas for this project.";
    if (action === "RISKS") prompt = "Analyze potential risks and pitfalls.";
    if (action === "PLAN") prompt = "Create a step-by-step execution plan.";
    setInputText(prompt);
  };

  return (
    <div className="chat-container">
      {/* --- HEADER --- */}
      <header className="chat-header">
        <div>
          <h1>WAR ROOM: {username.split('@')[0]}</h1>
          <span className="online-status">ONLINE | {username}</span>
        </div>
        <div className="header-controls">
          <button className="control-btn" title="Save Session">💾</button>
          <button className="control-btn danger-btn" onClick={onLeave}>🔴 EXIT</button>
        </div>
      </header>

      {/* --- CHAT WINDOW --- */}
      <div className="chat-window">
        {messages.map((msg, index) => (
          <div key={index} className={`message-box ${msg.is_ai ? 'ai' : 'user'}`}>
            <span className="sender-label">{msg.sender_name}</span>
            <div style={{ whiteSpace: 'pre-wrap' }}>{msg.message}</div>
          </div>
        ))}
        {loading && <div className="message-box ai">... ANALYZING DATA STREAM ...</div>}
        <div ref={messagesEndRef} />
      </div>

      {/* --- INPUT AREA --- */}
      <div className="input-area">
        <div className="quick-actions">
          <button className="action-btn" onClick={() => handleQuickAction('IDEAS')}>💡 IDEAS</button>
          <button className="action-btn" onClick={() => handleQuickAction('RISKS')}>⚠️ RISKS</button>
          <button className="action-btn" onClick={() => handleQuickAction('PLAN')}>🚀 PLAN</button>
        </div>

        <div className="input-wrapper">
          <button className="attach-btn">📎</button>
          <input 
            className="chat-input" 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type message..." 
            disabled={loading}
          />
          <button className="send-btn" onClick={sendMessage} disabled={loading}>
            {loading ? "..." : "SEND"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatInterface;