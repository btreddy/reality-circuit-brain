import React, { useState, useEffect, useRef, useCallback } from 'react';
import Mermaid from './Mermaid';
import './Main.css';

const API_BASE_URL = "https://reality-circuit-brain.onrender.com";

function ChatInterface({ roomId, username, onLeave }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState(null);
  
  const messagesEndRef = useRef(null);

  // --- CORE FUNCTIONS ---

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/history?room_id=${roomId}`);
      const data = await res.json();
      setMessages(data);
    } catch (err) {
      console.error("History fetch error:", err);
    }
  }, [roomId]);

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 10000); // 10s Heartbeat
    return () => clearInterval(interval);
  }, [fetchHistory]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // --- BUTTON HANDLERS (RESTORED) ---

  const handleSend = async () => {
    if (!input.trim() && !file) return;

    const userMsg = input;
    setInput('');
    setLoading(true);

    let fileData = null;
    let fileType = null;

    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        fileData = reader.result.split(',')[1];
        fileType = file.type;
        await sendToBackend(userMsg, fileData, fileType);
      };
      reader.readAsDataURL(file);
      setFile(null);
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

      await fetch(`${API_BASE_URL}/api/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      fetchHistory(); 
    } catch (err) {
      console.error("Send error:", err);
    }
    setLoading(false);
  };

  // ☢️ NUKE FUNCTION (Clear Chat)
  const handleNuke = async () => {
    if (!window.confirm("WARNING: RADIOLOGICAL HAZARD.\nThis will permanently erase all War Room memory.\n\nProceed?")) return;
    
    try {
      await fetch(`${API_BASE_URL}/api/chat/nuke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId })
      });
      setMessages([]); // Clear locally immediately
    } catch (err) {
      alert("NUKE FAILED: " + err.message);
    }
  };

  // 💾 SAVE FUNCTION (Download Transcript)
  const handleSave = () => {
    const text = messages.map(m => `[${m.sender_name}]: ${m.message}`).join('\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `WAR_ROOM_LOG_${new Date().toISOString().slice(0,10)}.txt`;
    a.click();
  };

  // 🔗 INVITE FUNCTION (Copy Link)
  const handleInvite = () => {
    const url = window.location.href; // Copies current URL
    navigator.clipboard.writeText(url);
    alert("SECURE LINK COPIED TO CLIPBOARD.\nSend this to your operatives.");
  };

  const toggleMic = () => {
    setIsRecording(!isRecording);
    if (!isRecording) alert("Microphone active (Simulation Mode)");
  };

  // --- RENDER VISUALS ---
  const renderMessageContent = (msgContent) => {
    if (msgContent.includes('```mermaid')) {
      const parts = msgContent.split('```mermaid');
      const introText = parts[0];
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
    return <div style={{ whiteSpace: 'pre-wrap' }}>{msgContent}</div>;
  };

  return (
    <div className="chat-container">
      {/* HEADER RESTORED */}
      <div className="chat-header">
        <div className="header-title">
          <span className="status-dot"></span> WAR ROOM: <span className="highlight">{username.split('@')[0]}</span>
        </div>
        <div className="header-controls">
           <button className="nav-btn" onClick={handleInvite} title="Invite Operative">🔗 INVITE</button>
           <button className="nav-btn" onClick={handleSave} title="Save Log">💾</button>
           <button className="nav-btn" onClick={handleNuke} title="Wipe Memory">☢️</button>
           <button className="nav-btn" onClick={onLeave} style={{marginLeft: '15px'}}>🔴 EXIT</button>
        </div>
      </div>

      <div className="chat-window">
        {messages.map((msg, index) => (
          <div key={index} className={`message-row ${msg.is_ai || msg.sender_name === 'Reality Circuit' ? 'ai-row' : 'user-row'}`}>
            <div className={`message-bubble ${msg.is_ai || msg.sender_name === 'Reality Circuit' ? 'ai-bubble' : 'user-bubble'}`}>
              <div className="msg-sender">
                {msg.sender_name} 
                {msg.is_ai && " ⚡"}
              </div>
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