import React, { useState, useEffect, useRef } from 'react';
import './Main.css';

// FIX: Hardcoded URL to guarantee connection
const API_BASE_URL = "https://reality-circuit-brain.onrender.com"; 

function ChatInterface({ roomId, username, onLeave }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  
  // File & Voice State
  const [selectedFile, setSelectedFile] = useState(null); 
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false); // Track if AI is talking
  
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);
  const silenceTimerRef = useRef(null); // Timer for Auto-Send
  const inputTextRef = useRef(''); // Ref to track text inside the timer

  // Keep the Ref in sync with State (Crucial for Auto-Send)
  useEffect(() => {
    inputTextRef.current = inputText;
  }, [inputText]);

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

  // --- TEXT TO SPEECH (THE NARRATOR) 🔈 ---
  const speakText = (text) => {
    if ('speechSynthesis' in window) {
      if (isSpeaking) {
        window.speechSynthesis.cancel(); // Stop if already talking
        setIsSpeaking(false);
        return;
      }

      // Clean text (remove formatting like ** and *)
      const cleanText = text.replace(/\*\*/g, '').replace(/\*/g, '');
      const utterance = new SpeechSynthesisUtterance(cleanText);
      
      // Select a good voice (optional, defaults to system voice)
      const voices = window.speechSynthesis.getVoices();
      // Try to find a "Google US English" or similar if available
      const preferredVoice = voices.find(v => v.name.includes("Google US English")) || voices[0];
      if (preferredVoice) utterance.voice = preferredVoice;

      utterance.onend = () => setIsSpeaking(false);
      
      setIsSpeaking(true);
      window.speechSynthesis.speak(utterance);
    } else {
      alert("Text-to-Speech not supported on this browser.");
    }
  };

  // --- VOICE COMMAND (AUTO-SEND VERSION) 🎙️ ---
  const toggleMic = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("VOICE MODULE NOT SUPPORTED. USE CHROME.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true; // Keep listening until silence
    recognition.interimResults = true; // Need interim to detect "activity"
    recognition.lang = 'en-US';

    recognition.onstart = () => setIsListening(true);
    
    recognition.onresult = (event) => {
      // 1. Get the latest transcript
      let finalTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        }
      }

      if (finalTranscript) {
         setInputText(prev => prev + (prev ? ' ' : '') + finalTranscript);
      }

      // 2. RESET SILENCE TIMER (The "Auto-Send" Logic) ⏱️
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      
      // Set new timer: If 5 seconds pass with NO result, we send.
      silenceTimerRef.current = setTimeout(() => {
        console.log("Auto-Send Triggered due to Silence...");
        stopListening(); // This stops the mic
        // We use a slight delay to ensure state updates, then send
        setTimeout(() => triggerAutoSend(), 500); 
      }, 5000); 
    };

    recognition.onend = () => {
        // If it stopped naturally, just clear state
        setIsListening(false);
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    };

    recognition.onerror = (event) => {
      console.error("Voice Error:", event.error);
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const stopListening = () => {
    if (recognitionRef.current) recognitionRef.current.stop();
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
    setIsListening(false);
  };

  // Helper to bypass the "event" requirement of sendMessage
  const triggerAutoSend = () => {
    // Check the REF (Current Value) not the State (Stale Value)
    if (inputTextRef.current && inputTextRef.current.trim().length > 0) {
        sendMessage(null, inputTextRef.current); 
    }
  };

  // --- FILE HANDLING ---
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
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

  // --- SEND MESSAGE ---
  // Updated to accept optional textOverride for the Auto-Send feature
  const sendMessage = async (e, textOverride = null) => {
    const textToSend = textOverride !== null ? textOverride : inputText;
    
    if (!textToSend.trim() && !selectedFile) return;

    const newMsg = { sender_name: username, message: textToSend, is_ai: false };
    setMessages(prev => [...prev, newMsg]);
    setLoading(true);
    
    const payload = {
      room_id: roomId,
      sender_name: username,
      message: textToSend,
      file_data: selectedFile ? selectedFile.data : null,
      file_type: selectedFile ? selectedFile.type : null
    };

    setInputText(''); 
    setSelectedFile(null); 

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

  // --- UI FORMATTING ---
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
            <span className="sender-label">
              {msg.sender_name} 
              {/* SPEAKER BUTTON FOR ALL MESSAGES */}
              <button 
                className="speak-btn" 
                onClick={() => speakText(msg.message)}
                title="Read Aloud"
              >
                 🔈
              </button>
            </span>
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
          <input 
            type="file" 
            ref={fileInputRef} 
            style={{display: 'none'}} 
            onChange={handleFileSelect} 
            accept="image/*,.pdf,.doc,.docx" 
          />
          <button className="attach-btn" onClick={() => fileInputRef.current.click()}>📎</button>
          
          <button 
            className="attach-btn" 
            onClick={toggleMic} 
            style={{ 
              color: isListening ? '#ff0000' : '#00ff41', 
              borderColor: isListening ? '#ff0000' : '#00ff41',
              animation: isListening ? 'pulse 1s infinite' : 'none' 
            }}
            title="Push to Talk"
          >
            {isListening ? '🛑' : '🎙️'}
          </button>
          
          <input 
            className="chat-input" 
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
            placeholder={isListening ? "Listening... (Auto-send in 5s)" : "Type or use Mic"}
            disabled={loading}
          />
          <button className="send-btn" onClick={() => sendMessage(null)} disabled={loading}>
            {loading ? "..." : "SEND"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default ChatInterface;