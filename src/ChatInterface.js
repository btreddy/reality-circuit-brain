import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import './Main.css';

const API_BASE_URL = "https://reality-circuit-brain.onrender.com";

function ChatInterface({ roomId, username, onLeave }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  
  const messagesEndRef = useRef(null);
  const prevMessageCount = useRef(0);

  // 1. SMART SCROLL
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (messages.length > prevMessageCount.current) {
      scrollToBottom();
      prevMessageCount.current = messages.length;
    }
  }, [messages]);

  // 2. LOAD HISTORY
  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 5000);
    return () => clearInterval(interval);
  }, [roomId]);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/history?room_id=${roomId}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        const formatted = data.map(msg => ({
          id: msg.timestamp,
          text: msg.text,
          sender: msg.sender,
          isUser: !msg.is_ai
        }));
        
        setMessages(prev => {
            if (prev.length === formatted.length) return prev;
            return formatted;
        });
      }
    } catch (err) {
      console.error("History Error:", err);
    }
  };

  // 3. SEND MESSAGE
  const handleSend = async (textOverride) => {
    const textToSend = textOverride || inputText;
    if (!textToSend.trim()) return;

    const tempMsg = { id: Date.now(), text: textToSend, sender: username, isUser: true };
    setMessages(prev => [...prev, tempMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      await fetch(`${API_BASE_URL}/api/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: roomId,
          sender_name: username,
          message: textToSend
        }),
      });
    } catch (err) {
      console.error("Send Failed:", err);
    }
    setIsLoading(false);
  };

  // 4. NEW: WIPE DATA (Clear Chat)
  const handleWipe = async () => {
    if (!window.confirm("☢️ WARNING: This will permanently delete all room data. Proceed?")) return;
    
    try {
      await fetch(`${API_BASE_URL}/api/chat/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId }),
      });
      setMessages([]); // Clear locally immediately
      prevMessageCount.current = 0;
    } catch (err) {
      alert("Wipe Failed");
    }
  };

  // 5. NEW: SAVE INTEL (Download Text)
  const handleSave = () => {
    const content = messages.map(m => `[${m.sender}]: ${m.text}`).join('\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `WAR_ROOM_REPORT_${roomId}.txt`;
    a.click();
  };

  return (
    <div className="chat-container">
      {/* --- HEADER --- */}
      <div className="chat-header">
        <div className="header-info">
          <h1>WAR ROOM: {roomId}</h1>
          <div className="status-dot"></div>
          <span>ONLINE | WARRIOR: {username}</span>
        </div>
        
        <div className="header-actions">
           <button onClick={handleSave} className="tool-btn">💾 SAVE</button>
           <button onClick={handleWipe} className="tool-btn">☢️ WIPE</button>
           <button onClick={onLeave} className="exit-btn">🛑 EXIT</button>
        </div>
      </div>

      {/* --- MESSAGES --- */}
      <div className="messages-area">
        {messages.map((msg, index) => (
          <div key={index} className={`message-row ${msg.isUser ? 'user-row' : 'ai-row'}`}>
            <div className={`message-bubble ${msg.isUser ? 'user-bubble' : 'ai-bubble'}`}>
              <div className="message-sender">{msg.sender}</div>
              <ReactMarkdown>{msg.text}</ReactMarkdown>
            </div>
          </div>
        ))}
        {isLoading && <div className="loading-indicator">AI STRATEGIZING...</div>}
        <div ref={messagesEndRef} />
      </div>

      {/* --- INPUT --- */}
      <div className="input-area">
        <div className="quick-actions">
           <button onClick={() => handleSend("Analyze SWOT for this deal")}>⚡ SWOT</button>
           <button onClick={() => handleSend("Identify hidden risks")}>⚠️ RISKS</button>
           <button onClick={() => handleSend("Calculate ROI potential")}>💰 ROI</button>
        </div>
        <div className="input-wrapper">
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type message or click an option above..."
          />
          <button onClick={() => handleSend()} className="send-btn">SEND</button>
        </div>
      </div>
    </div>
  );
}

export default ChatInterface;