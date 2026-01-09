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
  const [availableVoices, setAvailableVoices] = useState([]); 
  
  const messagesEndRef = useRef(null);

  // --- VOICE LOADER ---
  useEffect(() => {
    const loadVoices = () => {
      const voices = window.speechSynthesis.getVoices();
      setAvailableVoices(voices);
    };
    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;
  }, []);

  // --- HISTORY SYNC ---
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

  // --- SEND LOGIC ---
  const sendToBackend = async (msg, fData, fType) => {
    setLoading(true);
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

  const handleSend = async () => {
    if (!input.trim() && !file) return;
    const userMsg = input;
    setInput('');
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

  const handleQuickAction = (type) => {
    let text = "";
    if (type === 'PLAN') text = "@ai Create a detailed Strategic Plan (with Flowchart).";
    if (type === 'RISKS') text = "@ai Analyze Risks and Pitfalls for this plan.";
    if (type === 'IDEAS') text = "@ai Brainstorm 5 innovative Ideas.";
    setInput(text); 
  };

  const handleSpeak = (text) => {
    window.speechSynthesis.cancel();
    const cleanText = text.replace(/[*#`]/g, ''); 
    const utterance = new SpeechSynthesisUtterance(cleanText);
    let selectedVoice = null;

    if (language === 'Telugu') {
        selectedVoice = availableVoices.find(v => v.lang.includes('te'));
        if (!selectedVoice) selectedVoice = availableVoices.find(v => v.lang.includes('hi'));
    } else if (language === 'Hinglish') {
        selectedVoice = availableVoices.find(v => v.lang.includes('hi'));
    }

    if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.lang = selectedVoice.lang;
    } 
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
  };

  const toggleMic = () => {
    setIsRecording(!isRecording);
    if (!isRecording) alert("Microphone Active");
  };
  
  // --- SHARE LINK FIX (GUEST MODE) ---
  const handleInvite = () => {
    // Generates a link like: https://careco-pilotai.com/?room=btr
    const guestLink = `${window.location.origin}/?room=${roomId}`;
    navigator.clipboard.writeText(guestLink);
    alert(`GUEST LINK COPIED:\n${guestLink}\n\nAnyone with this link can view the War Room.`);
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

  const handleBackup = () => {
    const jsonString = JSON.stringify(messages, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `WAR_ROOM_BACKUP_${new Date().toISOString().slice(0,10)}.json`;
    a.click();
  };

  const handleRestore = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const history = JSON.parse(e.target.result);
        await fetch(`${API_BASE_URL}/api/chat/import`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ room_id: roomId, history: history })
        });
        alert("Session Restored Successfully!");
        fetchHistory(); 
      } catch (err) { alert("Invalid Backup File."); }
    };
    reader.readAsText(file);
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
        <div className="header-title">WAR ROOM: <span className="highlight">{roomId}</span></div>
        <select value={language} onChange={(e) => setLanguage(e.target.value)} className="lang-select">
            <option value="English">English</option>
            <option value="Telugu">Telugu (తెలుగు)</option>
            <option value="Hinglish">Hinglish</option>
        </select>
        <div className="header-controls">
           <label className="nav-btn" style={{cursor: 'pointer'}} title="Restore Session">📂<input type="file" hidden accept=".json" onChange={handleRestore} /></label>
           <button className="nav-btn" onClick={handleBackup} title="Backup System (JSON)">📥</button>
           <button className="nav-btn" onClick={handleInvite} title="Share Secure Link">🔗</button>
           <button className="nav-btn" onClick={handlePrintPDF} title="PDF Report">📄</button>
           <button className="nav-btn" onClick={handleSaveTxt} title="Save Text">💾</button>
           <button className="nav-btn" onClick={handleNuke} title="Nuke">☢️</button>
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
        <div className="toolbar">
           {file ? <span className="file-badge">📎 {file.name}</span> : null}
           <label className="tool-btn">📎 <input type="file" hidden onChange={(e) => setFile(e.target.files[0])} /></label>
           <button className={`tool-btn ${isRecording ? 'active-mic' : ''}`} onClick={toggleMic}>🎙️</button>
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