import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import './Main.css'; // Make sure you have your styles

// 🔗 CONNECT TO YOUR LIVE BRAIN
const API_BASE_URL = "https://reality-circuit-brain.onrender.com";

function ChatInterface({ roomId, username, onLeave }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // 1. AUTO-SCROLL TO BOTTOM
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // 2. LOAD HISTORY ON START
  useEffect(() => {
    fetchHistory();
    // Refresh history every 5 seconds (Live Chat feel)
    const interval = setInterval(fetchHistory, 5000);
    return () => clearInterval(interval);
  }, [roomId]);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/history?room_id=${roomId}`);
      const data = await res.json();
      if (Array.isArray(data)) {
        // Transform DB format to UI format
        const formatted = data.map(msg => ({
          id: msg.timestamp,
          text: msg.text,
          sender: msg.sender,
          isUser: !msg.is_ai
        }));
        setMessages(formatted);
      }
    } catch (err) {
      console.error("History Load Failed:", err);
    }
  };

  // 3. SEND MESSAGE
  const handleSend = async (textOverride) => {
    const textToSend = textOverride || inputText;
    if (!textToSend.trim()) return;

    // Optimistic UI Update (Show immediately)
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
      // We don't manually add the AI reply here. 
      // The polling (setInterval) will pick it up automatically in 5 seconds.
    } catch (err) {
      console.error("Send Failed:", err);
      setMessages(prev => [...prev, { id: Date.now(), text: "⚠️ Transmission Error", sender: "SYSTEM", isUser: false }]);
    }
    setIsLoading(false);
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
        
        {/* --- THE MISSING EXIT BUTTON --- */}
        <div className="header-actions">
           <button onClick={onLeave} className="exit-btn">🛑 EXIT MISSION</button>
        </div>
      </div>

      {/* --- MESSAGES AREA --- */}
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

      {/* --- INPUT AREA --- */}
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