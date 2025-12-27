import React, { useState, useEffect, useRef } from 'react';
import Mermaid from './Mermaid'; // <--- IMPORT THE VISUAL ENGINE
import './Main.css';

const API_BASE_URL = "https://reality-circuit-brain.onrender.com"; // Hardcoded for safety

function ChatInterface({ roomId, username, onLeave }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState(null);
  
  const messagesEndRef = useRef(null);

  // 1. Fetch History on Load
  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 10000); // Poll every 5s for sync
    return () => clearInterval(interval);
  }, []);

  // 2. Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/history?room_id=${roomId}`);
      const data = await res.json();
      setMessages(data);
    } catch (err) {
      console.error("History fetch error:", err);
    }
  };

  const handleSend = async () => {
    if (!input.trim() && !file) return;

    const userMsg = input;
    setInput(''); // Clear input immediately for UX
    setLoading(true);

    // Prepare File Data if exists
    let fileData = null;
    let fileType = null;

    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        fileData = reader.result.split(',')[1]; // Base64 clean
        fileType = file.type;
        await sendToBackend(userMsg, fileData, fileType);
      };
      reader.readAsDataURL(file);
      setFile(null); // Clear file
    } else {
      await sendToBackend(userMsg, null, null);
    }
  };

  const sendToBackend = async (msg, fData, fType) => {
    try {
      const payload = {
        room_id: roomId,
        sender_name: username,
        message: msg,
        file_data: fData,
        file_type: fType
      };

      // Optimistic Update (Show user message immediately)
      // Note: The backend will save it and we will fetch it back, but this feels faster.
      
      const res = await fetch(`${API_BASE_URL}/api/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      await res.json();
      fetchHistory(); // Force refresh to see AI reply
    } catch (err) {
      console.error("Send error:", err);
    }
    setLoading(false);
  };

  // --- VOICE LOGIC (Placeholder for now) ---
  const toggleMic = () => {
    setIsRecording(!isRecording);
    if (!isRecording) {
        alert("Microphone Logic: Connect your Speech-to-Text API here in v4.0");
    }
  };

  // --- RENDER HELPERS ---
  const renderMessageContent = (msgContent) => {
    // CHECK: Does this message contain a Mermaid Diagram code block?
    if (msgContent.includes('```mermaid')) {
      const parts = msgContent.split('```mermaid');
      const introText = parts[0];
      // Extract code between ```mermaid and the closing ```
      const chartCode = parts[1].split('```')[0];
      
      return (
        <div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{introText}</div>
          <div className="diagram-container">
            <Mermaid chart={chartCode} />
          </div>
        </div>
      );
    }
    
    // Default: Just text
    return <div style={{ whiteSpace: 'pre-wrap' }}>{msgContent}</div>;
  };

  return (
    <div className="chat-container">
      {/* HEADER */}
      <div className="chat-header">
        <div className="header-title">
          <span className="status-dot"></span> WAR ROOM: <span className="highlight">{username.split('@')[0]}</span>
        </div>
        <div className="header-controls">
           <button className="nav-btn" onClick={onLeave}>🔴 EXIT</button>
        </div>
      </div>

      {/* CHAT WINDOW */}
      <div className="chat-window">
        {messages.map((msg, index) => (
          <div key={index} className={`message-row ${msg.is_ai || msg.sender_name === 'Reality Circuit' ? 'ai-row' : 'user-row'}`}>
            
            <div className={`message-bubble ${msg.is_ai || msg.sender_name === 'Reality Circuit' ? 'ai-bubble' : 'user-bubble'}`}>
              <div className="msg-sender">
                {msg.sender_name} 
                {msg.is_ai && " ⚡"}
              </div>
              
              {/* THE NEW VISUAL RENDERER */}
              <div className="msg-content">
                {renderMessageContent(msg.message)}
              </div>

              <div className="msg-time">
                {msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}
              </div>
            </div>

          </div>
        ))}
        {loading && <div className="loading-indicator">⚡ PROCESSING STRATEGY...</div>}
        <div ref={messagesEndRef} />
      </div>

      {/* INPUT AREA */}
      <div className="input-area">
        <div className="toolbar">
           {file ? <span className="file-badge">📎 {file.name}</span> : null}
           <label className="tool-btn">
             📎 <input type="file" hidden onChange={(e) => setFile(e.target.files[0])} />
           </label>
           <button className={`tool-btn ${isRecording ? 'active-mic' : ''}`} onClick={toggleMic}>
             🎙️
           </button>
        </div>
        
        <div className="input-wrapper">
          <input 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type command or use Mic..."
          />
          <button className="send-btn" onClick={handleSend}>SEND</button>
        </div>
      </div>
    </div>
  );
}

export default ChatInterface;