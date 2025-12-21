import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import './Main.css';

const API_URL = "https://reality-circuit-brain.onrender.com"; 

function ChatInterface({ senderName, roomId }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false); // NEW: Upload state
  const [debugError, setDebugError] = useState(null); 
  
  // Scroll & Ref Config
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const messagesEndRef = useRef(null);
  const chatWindowRef = useRef(null); 
  const fileInputRef = useRef(null); // NEW: Reference to hidden file input

  useEffect(() => {
    fetchHistory();
    const interval = setInterval(fetchHistory, 5000); 
    return () => clearInterval(interval);
  }, [roomId]); 

  useEffect(() => {
    if (shouldAutoScroll) {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, shouldAutoScroll]);

  const handleScroll = () => {
    if (chatWindowRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatWindowRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
      setShouldAutoScroll(isAtBottom);
    }
  };

  const fetchHistory = async () => {
    try {
      const res = await fetch(`${API_URL}/api/chat/history?room_id=${roomId}`);
      const data = await res.json();
      
      if (Array.isArray(data)) {
        setMessages(data);
        setDebugError(null);
      } else {
        setDebugError(JSON.stringify(data)); 
      }
    } catch (err) {
      setDebugError(err.message);
    }
  };

  const clearRoom = async () => {
    if(!window.confirm("WARNING: This will delete all history for this room. Are you sure?")) return;
    try {
      await fetch(`${API_URL}/api/chat/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId })
      });
      setMessages([]); 
    } catch (err) {
      alert("Failed to clear room");
    }
  };
  // --- NEW: EXPORT CHAT TO CSV ---
  const exportChat = () => {
    if (messages.length === 0) {
      alert("No messages to export!");
      return;
    }
    // --- NEW: ASK AI FOR CONTEXTUAL SUGGESTIONS ---
  const askAiForHelp = async () => {
    // 1. Force the scroll to bottom
    setShouldAutoScroll(true);
    setLoading(true);

    // 2. Define the "Meta-Prompt"
    // We don't save this to 'messages' because we don't need to see the user asking for it.
    // We just want to see the AI's reply.
    const prompt = "Analyze the conversation history above. Suggest 3 distinct, high-value ways you can organize, synthesize, or analyze this information right now (e.g., SWOT, Cost Table, Action Plan, Risk Assessment, etc.). List them clearly as Option 1, 2, and 3. Keep it brief.";

    try {
      const res = await fetch(`${API_URL}/api/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: roomId,
          sender_name: "SYSTEM_COMMAND", // Special name so we know it's a system request
          message: prompt
        })
      });

      const data = await res.json();
      if (data.ai_reply) {
        setMessages(prev => Array.isArray(prev) ? [...prev, {
          sender: "AI Consultant",
          text: data.ai_reply,
          is_ai: true,
          timestamp: new Date().toISOString()
        }] : []);
      }
    } catch (err) {
      console.error("Error asking AI:", err);
    } finally {
      setLoading(false);
    }
  };

    // 1. Setup Headers
    const headers = ["Timestamp", "Sender", "Message Type", "Content"];
    
    // 2. Format Data
    const rows = messages.map(msg => {
      // Clean up text to prevent CSV errors (replace commas and quotes)
      const cleanText = `"${msg.text.replace(/"/g, '""')}"`; 
      const time = new Date(msg.timestamp).toLocaleString();
      const type = msg.is_ai ? "AI Consultant" : "Human Agent";
      
      return [time, msg.sender, type, cleanText].join(",");
    });

    // 3. Create File
    const csvContent = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    
    // 4. Trigger Download
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", `WarRoom_Log_${roomId}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- NEW: HANDLE FILE UPLOAD ---
  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await fetch(`${API_URL}/api/upload`, {
        method: 'POST',
        body: formData
      });
      const data = await res.json();
      
      if (data.url) {
        // Automatically put the URL in the input box so user can send it
        // We wrap it in [IMAGE] tag so we know how to render it later if we want
        setInputText(prev => prev + " " + data.url);
      }
    } catch (err) {
      alert("Upload failed. Check console.");
      console.error(err);
    } finally {
      setIsUploading(false);
      // Reset file input so you can upload the same file again if needed
      if(fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    setShouldAutoScroll(true);

    const tempMessage = { 
      sender: senderName, 
      text: inputText, 
      is_ai: false, 
      timestamp: new Date().toISOString() 
    };
    
    setMessages(prev => Array.isArray(prev) ? [...prev, tempMessage] : [tempMessage]);
    setInputText('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          room_id: roomId,
          sender_name: senderName,
          message: tempMessage.text
        })
      });

      const data = await res.json();
      if (data.ai_reply) {
        setMessages(prev => Array.isArray(prev) ? [...prev, {
          sender: "AI Consultant",
          text: data.ai_reply,
          is_ai: true,
          timestamp: new Date().toISOString()
        }] : []);
      }
    } catch (err) {
      console.error("Error sending message:", err);
    } finally {
      setLoading(false);
      setShouldAutoScroll(true);
    }
  };

  // --- HELPER: RENDER MESSAGE CONTENT (DETECT IMAGES) ---
  const renderMessageContent = (text) => {
    // Check if the text contains a Supabase Storage URL
    if (text.includes("supabase") && (text.includes(".jpg") || text.includes(".png") || text.includes(".jpeg"))) {
      return (
        <div>
          <img 
            src={text.trim()} 
            alt="Upload" 
            style={{maxWidth: '100%', borderRadius: '10px', marginTop: '10px', border: '1px solid #444'}} 
          />
        </div>
      );
    }
    return text;
  };

  return (
    <div className="chat-interface">
      <div className="chat-header">
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%'}}>
            <div>
                <h3 style={{margin:0}}>WAR ROOM: {roomId.toUpperCase()}</h3>
                <span className="live-indicator">● ONLINE | AGENT: {senderName}</span>
            </div>
            {/* EXPORT BUTTON */}
            <button onClick={exportChat} style={{
                background: '#004400', border: '1px solid #00ff00', color: '#00ff00', 
                padding: '5px 10px', cursor: 'pointer', fontSize: '0.7rem', marginRight: '10px'
            }}>
                ⬇ SAVE REPORT
            </button>
            <button onClick={clearRoom} style={{
                background: '#330000', border: '1px solid red', color: 'red', 
                padding: '5px 10px', cursor: 'pointer', fontSize: '0.7rem'
            }}>
              {/* AI ASSIST BUTTON */}
            <button onClick={askAiForHelp} style={{
                background: '#4B0082', border: '1px solid #9370DB', color: '#E6E6FA', 
                padding: '5px 10px', cursor: 'pointer', fontSize: '0.7rem', marginRight: '10px'
            }}>
                ✨ AI ASSIST
            </button>
            
            {/* Existing Save Report Button */}
            <button onClick={exportChat} ... >
                ⚠ WIPE MEMORY
            </button>
        </div>
      </div>

      {debugError && (
        <div style={{padding: '15px', background: '#330000', borderBottom: '1px solid red', color: 'red'}}>
          ⚠️ <strong>SYSTEM ERROR:</strong> {debugError}
        </div>
      )}

      <div className="chat-window" ref={chatWindowRef} onScroll={handleScroll}>
        {Array.isArray(messages) && messages.map((msg, index) => (
          <div key={index} className={`message-row ${msg.is_ai ? 'ai-row' : 'user-row'}`}>
            <div className={`message-bubble ${msg.is_ai ? 'ai-bubble' : 'user-bubble'}`}>
              <div className="msg-sender">{msg.sender}</div>
              
             <div className={`message-bubble ${msg.is_ai ? 'ai-bubble' : 'user-bubble'}`}>
              <div className="msg-sender">{msg.sender}</div>
              
              {/* --- THIS IS THE PART TO REPLACE --- */}
              <div className="msg-text">
                {msg.text.includes("supabase") && (msg.text.includes(".jpg") || msg.text.includes(".png")) ? (
                    renderMessageContent(msg.text)
                ) : (
                    <ReactMarkdown>{msg.text}</ReactMarkdown>
                )}
              </div>
              {/* ---------------------------------- */}
              
              <div className="msg-time">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
            </div>
              
              <div className="msg-time">{new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</div>
            </div>
          </div>
        ))}
        {loading && <div className="typing-indicator">AI Consultant is researching...</div>}
        <div ref={messagesEndRef} />
      </div>

      <form className="chat-input-area" onSubmit={sendMessage}>
        {/* HIDDEN FILE INPUT */}
        <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            style={{display: 'none'}} 
            accept="image/*,.pdf"
        />
        
        {/* PAPERCLIP BUTTON */}
        <button 
            type="button" 
            onClick={() => fileInputRef.current.click()}
            disabled={isUploading}
            style={{marginRight: '10px', background: '#333', border: '1px solid #555', color: '#fff'}}
        >
            {isUploading ? '⏳' : '📎'}
        </button>

        <input 
          type="text" 
          value={inputText} 
          onChange={(e) => setInputText(e.target.value)} 
          placeholder="Type message or upload file..." 
        />
        <button type="submit" disabled={loading}>SEND</button>
      </form>
    </div>
  );
}

export default ChatInterface;