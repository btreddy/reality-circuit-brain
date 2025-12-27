import React, { useState, useEffect, useRef, useCallback } from 'react';
import Mermaid from './Mermaid';
import './Main.css';

const API_BASE_URL = "https://reality-circuit-brain.onrender.com";

function ChatInterface({ roomId, username, onLeave }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [file, setFile] = useState(null);
  const [language, setLanguage] = useState('English');
  const [isRecording, setIsRecording] = useState(false);
  
  const messagesEndRef = useRef(null);

  // --- CORE FUNCTIONS ---
  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE_URL}/api/chat/history?room_id=${roomId}`);
      const data = await res.json();
      setMessages(prev => {
        if (prev.length !== data.length) return data;
        return prev; 
      });
    } catch (err) { console.error(err); }
  }, [roomId]);

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 5000); 
    return () => clearInterval(interval);
  }, [fetchHistory]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  // --- VOICE & ACTIONS ---
  const handleSpeak = (text) => {
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#]/g, '');
    const utterance = new SpeechSynthesisUtterance(cleanText);
    if (language === 'Telugu') utterance.lang = 'te-IN';
    else if (language === 'Hinglish') utterance.lang = 'hi-IN';
    else utterance.lang = 'en-US';
    window.speechSynthesis.speak(utterance);
  };

  // ⚡ QUICK ACTIONS (RESTORED)
  const handleQuickAction = (type) => {
    let prompt = "";
    if (type === 'PLAN') prompt = "Create a detailed Strategic Plan (Flowchart included) for the current topic.";
    if (type === 'RISKS') prompt = "Analyze the Risks, Pitfalls, and potential Failure Points.";
    if (type === 'IDEAS') prompt = "Brainstorm 5 innovative Ideas and alternative approaches.";
    
    sendToBackend(prompt, null, null);
  };

  // --- SEND LOGIC ---
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
        file_type: fType,
        language: language
      };
      await fetch(`${API_BASE_URL}/api/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      fetchHistory(); 
    } catch (err) { console.error(err); }
    setLoading(false);
  };

  const toggleMic = () => {
    setIsRecording(!isRecording);
    if (!isRecording) alert("Microphone Activated");
  };

  const handlePrintPDF = () => window.print();
  
  const handleSaveTxt = () => {
    const text = messages.map(m => `[${m.sender_name}]: ${m.message}`).join('\n\n');
    const blob = new Blob(['\uFEFF' + text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `WAR_ROOM_LOG.txt`;
    a.click();
  };

  const handleNuke = async () => {
    if (!window.confirm("WARNING: RADIOLOGICAL HAZARD.\nErase all memory?")) return;
    try {
      await fetch(`${API_BASE_URL}/api/chat/nuke`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId })
      });
      setMessages([]); 
    } catch (err) { alert("NUKE FAILED"); }
  };

  const renderMessageContent = (msgContent) => {
    if (msgContent.includes('```mermaid')) {
      const parts = msgContent.split('```mermaid');
      return (
        <div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{parts[0]}</div>
          <div className="diagram-container"><Mermaid chart={parts[1].split('```')[0]} /></div>
        </div>
      );
    }
    return <div style={{ whiteSpace: 'pre-wrap' }}>{msgContent}</div>;
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="header-title">WAR ROOM: <span className="highlight">{username.split('@')[0]}</span></div>
        <select value={language} onChange={(e) => setLanguage(e.target.value)} className="lang-select">
            <option value="English">English</option>
            <option value="Telugu">Telugu</option>
            <option value="Hinglish">Hinglish</option>
        </select>
        <div className="header-controls">
           <button className="nav-btn" onClick={handlePrintPDF}>📄</button>
           <button className="nav-btn" onClick={handleSaveTxt}>💾</button>
           <button className="nav-btn" onClick={handleNuke}>☢️</button>
           <button className="nav-btn" onClick={onLeave} style={{marginLeft: '10px'}}>🔴</button>
        </div>
      </div>

      <div className="chat-window">
        {messages.map((msg, index) => (
          <div key={index} className={`message-row ${msg.is_ai || msg.sender_name === 'Reality Circuit' ? 'ai-row' : 'user-row'}`}>
            <div className={`message-bubble ${msg.is_ai || msg.sender_name === 'Reality Circuit' ? 'ai-bubble' : 'user-bubble'}`}>
              <div className="msg-sender">
                {msg.sender_name} {msg.is_ai && " ⚡"}
                <button className="speak-btn" onClick={() => handleSpeak(msg.message)}>🔊</button>
              </div>
              <div className="msg-content">{renderMessageContent(msg.message)}</div>
              <div className="msg-time">{msg.timestamp ? new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'}) : ''}</div>
            </div>
          </div>
        ))}
        {loading && <div className="loading-indicator">⚡ STRATEGY GENERATING...</div>}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        {/* TOOLBAR with Quick Actions */}
        <div className="toolbar">
           {file ? <span className="file-badge">📎 {file.name}</span> : null}
           <label className="tool-btn">📎 <input type="file" hidden onChange={(e) => setFile(e.target.files[0])} /></label>
           <button className={`tool-btn ${isRecording ? 'active-mic' : ''}`} onClick={toggleMic}>🎙️</button>
           
           {/* THE 3 MISSING BUTTONS */}
           <div className="quick-actions">
              <button className="action-btn" onClick={() => handleQuickAction('PLAN')}>📋 PLAN</button>
              <button className="action-btn" onClick={() => handleQuickAction('RISKS')}>⚠️ RISKS</button>
              <button className="action-btn" onClick={() => handleQuickAction('IDEAS')}>💡 IDEAS</button>
           </div>
        </div>
        
        <div className="input-wrapper">
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && handleSend()} placeholder={`Command in ${language}...`} />
          <button className="send-btn" onClick={handleSend}>SEND</button>
        </div>
      </div>
    </div>
  );
}

export default ChatInterface;