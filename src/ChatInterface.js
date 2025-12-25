import React, { useState, useEffect, useRef } from 'react';
import './Main.css';

// FIX: Hardcoded URL to guarantee connection
const API_BASE_URL = "https://reality-circuit-brain.onrender.com"; 

function ChatInterface({ roomId, username, onLeave }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  
  // CHANGED: Now stores an object { data, type, name } instead of just a string
  const [selectedFile, setSelectedFile] = useState(null); 
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  
  useEffect(() => { scrollToBottom(); }, [messages.length]);

  // RADAR SWEEP (AUTO-REFRESH)
  useEffect(() => {
    const fetchHistory = () => {
      fetch(`${API_BASE_URL}/api/chat/history?room_id=${roomId}`)
        .then(res => res.json())
        .then(data => {
          setMessages(prev => {
            if (JSON.stringify(prev) !== JSON.stringify(data)) {
              return data;
            }
            return prev;
          });
        })
        .catch(err => console.error("Radar Error:", err));
    };

    fetchHistory();
    const interval = setInterval(fetchHistory, 3000);
    return () => clearInterval(interval);
  }, [roomId]);

  // --- 1. UPDATED FILE HANDLER (Supports PDF/DOCS) ---
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        // Store file data, type, and name
        setSelectedFile({ 
            data: reader.result.split(',')[1], 
            type: file.type || 'application/octet-stream',
            name: file.name
        }); 
        setInputText(`[📎 READY: ${file.name}] `); 
      };
      reader.readAsDataURL(file);
    }
  };

  // --- 2. UPDATED SEND LOGIC (Sends File Type) ---
  const sendMessage = async () => {
    if (!inputText.trim() && !selectedFile) return;

    // Optimistic UI Update
    const newMsg = { sender_name: username, message: inputText, is_ai: false };
    setMessages(prev => [...prev, newMsg]);
    setLoading(true);
    
    const payload = {
      room_id: roomId,
      sender_name: username,
      message: inputText,
      file_data: selectedFile ? selectedFile.data : null, // Send the base64 data
      file_type: selectedFile ? selectedFile.type : null  // Send the MIME type (pdf/image/word)
    };

    setInputText(''); 
    setSelectedFile(null); // Clear file after sending

    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      
      if (data.error) {
         setMessages(prev => [...prev, { sender_name: "SYSTEM", message: `⚠️ ${data.error}`, is_ai: true }]);
      } else if (data.ai_reply) {
         setMessages(prev => [...prev, { sender_name: "Reality Circuit", message: data.ai_reply, is_ai: true }]);
      }
      
    } catch (err) {
      setMessages(prev => [...prev, { sender_name: "SYSTEM", message: "❌ CONNECTION LOST.", is_ai: true }]);
    }
    setLoading(false);
  };

  const handleQuickAction = (action) => {
    let prompt = "";
    if (action === "IDEAS") prompt = "@AI Brainstorm 3 innovative ideas for this project.";
    if (action === "RISKS") prompt = "@AI Analyze potential risks and pitfalls.";
    if (action === "PLAN") prompt = "@AI Create a step-by-step execution plan.";
    setInputText(prompt);
  };

  const copyInviteLink = () => {
    const link = `${window.location.origin}/?join=${roomId}`;
    navigator.clipboard.writeText(link);
    setCopyStatus('LINK COPIED!');
    setTimeout(() => setCopyStatus(''), 3000);
  };

  const handleSaveSession = () => {
    if (messages.length === 0) { alert("NO DATA TO SAVE."); return; }
    const timestamp = new Date().toLocaleString();
    let content = `REALITY CIRCUIT - MISSION LOG\nDATE: ${timestamp}\nROOM: ${roomId}\n-------------------\n\n`;
    messages.forEach(msg => {
      const cleanMsg = msg.message.replace(/\*\*/g, "").replace(/^\* /gm, "• ");
      content += `[${msg.sender_name}]:\n${cleanMsg}\n\n`;
    });
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MISSION_LOG_${roomId}_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleNuke = async () => {
    if (!window.confirm("⚠️ WARNING: DELETE ALL HISTORY?")) return;
    try {
      await fetch(`${API_BASE_URL}/api/chat/nuke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId })
      });
      setMessages([]); 
    } catch (err) { alert("NUKE FAILED: " + err.message); }
  };

  const formatLine = (text) => {
    const parts = text.split(/(\*\*.*?\*\*)/g); 
    return parts.map((part, index) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  const formatMessage = (text) => {
    if (!text) return "";
    return <div>{text.split('\n').map((line, i) => {
      if (line.trim().startsWith('* ')) {
        const cleanLine = line.replace('* ', ''); 
        return <li key={i}>{formatLine(cleanLine)}</li>;
      }
      return <div key={i}>{formatLine(line)}</div>;
    })}</div>;
  };

  return (
    <div className="chat-container">
      <header className="chat-header">
        <div>
          <h1>WAR ROOM: {roomId}</h1>
          <span className="online-status">OPERATIVE: {username}</span>
        </div>
        <div className="header-controls">
          <button className="control-btn" onClick={copyInviteLink} title="Invite Team">{copyStatus || "🔗 INVITE"}</button>
          <button className="control-btn" onClick={handleSaveSession} title="Save Transcript">💾</button>
          <button className="control-btn" onClick={handleNuke} title="Wipe Data">☢️</button>
          <button className="control-btn danger-btn" onClick={onLeave}>🔴 EXIT</button>
        </div>
      </header>

      <div className="chat-window">
        {messages.map((msg, index) => (
          <div key={index} className={`message-box ${msg.is_ai ? 'ai' : 'user'}`}>
            <span className="sender-label">{msg.sender_name}</span>
            <div className="message-content">{formatMessage(msg.message)}</div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        <div className="quick-actions">
          <button className="action-btn" onClick={() => handleQuickAction('IDEAS')}>💡 IDEAS</button>
          <button className="action-btn" onClick={() => handleQuickAction('RISKS')}>⚠️ RISKS</button>
          <button className="action-btn" onClick={() => handleQuickAction('PLAN')}>🚀 PLAN</button>
        </div>

        <div className="input-wrapper">
          {/* --- 3. UPDATED INPUT TAG (Supports PDF, DOC, IMAGES) --- */}
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{display: 'none'}} 
            onChange={handleFileSelect} 
            accept="image/*,.pdf,.doc,.docx" 
          />
          
          <button className="attach-btn" onClick={() => fileInputRef.current.click()}>📎</button>
          
          <input 
            className="chat-input" 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder="Type message... (Use @AI to summon)" 
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