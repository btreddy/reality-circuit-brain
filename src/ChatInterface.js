import React, { useState, useEffect, useRef } from 'react';
import './Main.css';

// FIX: Hardcoded URL to guarantee connection
const API_BASE_URL = "https://reality-circuit-brain.onrender.com"; 

function ChatInterface({ roomId, username, onLeave }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const [selectedImage, setSelectedImage] = useState(null); 
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => { scrollToBottom(); }, [messages]);

  useEffect(() => {
    fetch(`${API_BASE_URL}/api/chat/history?room_id=${roomId}`)
      .then(res => res.json())
      .then(data => setMessages(data))
      .catch(err => console.error("History Error:", err));
  }, [roomId]);

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedImage(reader.result.split(',')[1]); 
        setInputText(`[📎 ATTACHED: ${file.name}] `); 
      };
      reader.readAsDataURL(file);
    }
  };

  const sendMessage = async () => {
    if (!inputText.trim() && !selectedImage) return;

    const newMsg = { sender_name: username, message: inputText, is_ai: false };
    setMessages(prev => [...prev, newMsg]);
    setLoading(true);
    
    const payload = {
      room_id: roomId,
      sender_name: username,
      message: inputText,
      image: selectedImage
    };

    setInputText(''); 
    setSelectedImage(null);

    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
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

  const handleQuickAction = (action) => {
    let prompt = "";
    if (action === "IDEAS") prompt = "Brainstorm 3 innovative ideas for this project.";
    if (action === "RISKS") prompt = "Analyze potential risks and pitfalls.";
    if (action === "PLAN") prompt = "Create a step-by-step execution plan.";
    setInputText(prompt);
  };

  const copyInviteLink = () => {
    const link = `${window.location.origin}/?join=${roomId}`;
    navigator.clipboard.writeText(link);
    setCopyStatus('LINK COPIED!');
    setTimeout(() => setCopyStatus(''), 3000);
  };

  const handleNuke = async () => {
    if (!window.confirm("⚠️ WARNING: This will permanently delete all chat history for this room. Confirm?")) return;
    try {
      await fetch(`${API_BASE_URL}/api/chat/nuke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId })
      });
      setMessages([]); 
    } catch (err) { alert("NUKE FAILED: " + err.message); }
  };

  // --- NEW: SAVE SESSION (DOWNLOAD TRANSCRIPT) ---
  const handleSaveSession = () => {
    if (messages.length === 0) {
      alert("NO INTELLIGENCE DATA TO SAVE.");
      return;
    }

    const timestamp = new Date().toLocaleString();
    let content = `REALITY CIRCUIT - STRATEGIC LOG\n`;
    content += `DATE: ${timestamp}\n`;
    content += `ROOM: ${roomId}\n`;
    content += `OPERATIVE: ${username}\n`;
    content += `----------------------------------------\n\n`;

    messages.forEach(msg => {
      const role = msg.sender_name.toUpperCase();
      // Clean up markdown stars for the text file
      const cleanMsg = msg.message.replace(/\*\*/g, "").replace(/^\* /gm, "• ");
      content += `[${role}]:\n${cleanMsg}\n\n`;
    });

    // Create and trigger download
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `MISSION_LOG_${roomId}_${Date.now()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
          
          {/* SAVE BUTTON ACTIVATED */}
          <button className="control-btn" onClick={handleSaveSession} title="Save Transcript">💾</button>
          
          <button className="control-btn" onClick={handleNuke} title="Wipe Data (Nuke)">☢️</button>
          <button className="control-btn danger-btn" onClick={onLeave}>🔴 EXIT</button>
        </div>
      </header>

      <div className="chat-window">
        {messages.length === 0 && (
            <div style={{textAlign: 'center', marginTop: '50px', color: '#005500'}}>
                [ SYSTEM CLEAN. NO ACTIVE DATA. ]
            </div>
        )}
        {messages.map((msg, index) => (
          <div key={index} className={`message-box ${msg.is_ai ? 'ai' : 'user'}`}>
            <span className="sender-label">{msg.sender_name}</span>
            <div className="message-content">{formatMessage(msg.message)}</div>
          </div>
        ))}
        {loading && <div className="message-box ai">... ANALYZING DATA STREAM ...</div>}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        <div className="quick-actions">
          <button className="action-btn" onClick={() => handleQuickAction('IDEAS')}>💡 IDEAS</button>
          <button className="action-btn" onClick={() => handleQuickAction('RISKS')}>⚠️ RISKS</button>
          <button className="action-btn" onClick={() => handleQuickAction('PLAN')}>🚀 PLAN</button>
        </div>

        <div className="input-wrapper">
          <input type="file" ref={fileInputRef} style={{display: 'none'}} onChange={handleFileSelect} accept="image/*" />
          <button className="attach-btn" onClick={() => fileInputRef.current.click()}>📎</button>
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