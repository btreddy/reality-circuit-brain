import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import './Main.css';

const API_BASE_URL = "https://reality-circuit-brain.onrender.com";

function ChatInterface({ roomId, username, onLeave }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null); // <--- NEW: File State
  
  const messagesEndRef = useRef(null);
  const prevMessageCount = useRef(0);
  const fileInputRef = useRef(null); // <--- NEW: Ref for hidden input

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
    } catch (err) { console.error("History Error:", err); }
  };

  // --- NEW: FILE HANDLING HELPER ---
  const convertFileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result.split(',')[1]); // Get just the binary part
      reader.onerror = error => reject(error);
    });
  };

  // 3. SEND MESSAGE (Now with Binary Support)
  const handleSend = async (textOverride) => {
    const textToSend = textOverride || inputText;
    if (!textToSend.trim() && !selectedFile) return; // Allow sending just a file

    // 1. Optimistic UI Update
    const displayMsg = selectedFile 
        ? `[UPLOADING FILE: ${selectedFile.name}] ${textToSend}` 
        : textToSend;
        
    const tempMsg = { id: Date.now(), text: displayMsg, sender: username, isUser: true };
    setMessages(prev => [...prev, tempMsg]);
    setInputText('');
    setIsLoading(true);

    try {
      // 2. Prepare Payload
      let payload = {
        room_id: roomId,
        sender_name: username,
        message: textToSend
      };

      // 3. Attach Binary if file exists
      if (selectedFile) {
        const base64Data = await convertFileToBase64(selectedFile);
        payload.file_data = base64Data;
        payload.mime_type = selectedFile.type;
        setSelectedFile(null); // Reset after sending
      }

      await fetch(`${API_BASE_URL}/api/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

    } catch (err) {
      console.error("Send Failed:", err);
      alert("Transmission Failed. Check connection.");
    }
    setIsLoading(false);
  };

  // NEW: Save & Wipe Handlers
  const handleWipe = async () => {
    if (!window.confirm("☢️ WARNING: Wipe all data?")) return;
    await fetch(`${API_BASE_URL}/api/chat/clear`, { method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ room_id: roomId }) });
    setMessages([]);
  };

  const handleSave = () => {
    const content = messages.map(m => `[${m.sender}]: ${m.text}`).join('\n\n');
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `WAR_ROOM_${roomId}.txt`; a.click();
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="header-info">
          <h1>WAR ROOM: {roomId}</h1>
          <div className="status-dot"></div>
          <span>ONLINE | {username}</span>
        </div>
        <div className="header-actions">
           <button onClick={handleSave} className="tool-btn">💾</button>
           <button onClick={handleWipe} className="tool-btn">☢️</button>
           <button onClick={onLeave} className="exit-btn">🛑 EXIT</button>
        </div>
      </div>

      <div className="messages-area">
        {messages.map((msg, index) => (
          <div key={index} className={`message-row ${msg.isUser ? 'user-row' : 'ai-row'}`}>
            <div className={`message-bubble ${msg.isUser ? 'user-bubble' : 'ai-bubble'}`}>
              <div className="message-sender">{msg.sender}</div>
              <ReactMarkdown>{msg.text}</ReactMarkdown>
            </div>
          </div>
        ))}
        {isLoading && <div className="loading-indicator">ANALYZING DOCUMENT...</div>}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        <div className="quick-actions">
           <button onClick={() => handleSend("Analyze SWOT")}>⚡ SWOT</button>
           <button onClick={() => handleSend("Identify Risks")}>⚠️ RISKS</button>
           {/* --- NEW: FILE PREVIEW --- */}
           {selectedFile && <span className="file-tag">📎 {selectedFile.name} <button onClick={()=>setSelectedFile(null)}>x</button></span>}
        </div>
        
        <div className="input-wrapper">
          {/* --- NEW: HIDDEN INPUT + BUTTON --- */}
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={(e) => setSelectedFile(e.target.files[0])} 
            style={{display: 'none'}} 
            accept="image/*,application/pdf"
          />
          <button onClick={() => fileInputRef.current.click()} className="attach-btn">📎</button>
          
          <input
            type="text"
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSend()}
            placeholder={selectedFile ? "Type instructions for this file..." : "Type message..."}
          />
          <button onClick={() => handleSend()} className="send-btn">SEND</button>
        </div>
      </div>
    </div>
  );
}

export default ChatInterface;