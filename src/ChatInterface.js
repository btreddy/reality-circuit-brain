import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown'; 
import './Main.css';

const API_URL = "https://reality-circuit-brain.onrender.com"; 

function ChatInterface({ senderName, roomId }) {
  const [messages, setMessages] = useState([]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [debugError, setDebugError] = useState(null);
  
  // Safety Lock to stop screen wipes
  const [blockRefresh, setBlockRefresh] = useState(false);
  
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  const messagesEndRef = useRef(null);
  const chatWindowRef = useRef(null); 
  const fileInputRef = useRef(null); 

  // --- 1. WELCOME TRIGGER ---
  useEffect(() => {
    if (!senderName || !roomId) return;
    const triggerWelcome = async () => {
      const sessionKey = `welcomed_${roomId}_${senderName}`;
      if (sessionStorage.getItem(sessionKey)) return;

      try {
        sessionStorage.setItem(sessionKey, 'true');
        setBlockRefresh(true); // Lock
        
        const res = await fetch(`${API_URL}/api/chat/send`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ room_id: roomId, sender_name: "SYSTEM_WELCOME", message: senderName })
        });

        const data = await res.json();
        if (data.ai_reply) {
            setMessages(prev => [...prev, { sender: "AI Consultant", text: data.ai_reply, is_ai: true, timestamp: new Date().toISOString() }]);
        }
        
        setTimeout(() => setBlockRefresh(false), 5000); // Unlock
      } catch (err) {
        console.error("Welcome failed", err);
        setBlockRefresh(false);
      }
    };
    triggerWelcome();
  }, [senderName, roomId]); 

  // --- 2. FETCH HISTORY ---
  useEffect(() => {
    if (blockRefresh) return;
    fetchHistory();
    const interval = setInterval(() => { if (!blockRefresh) fetchHistory(); }, 5000); 
    return () => clearInterval(interval);
  }, [roomId, blockRefresh]); 

  useEffect(() => {
    if (shouldAutoScroll) messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, shouldAutoScroll]);

  const handleScroll = () => {
    if (chatWindowRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatWindowRef.current;
      setShouldAutoScroll(scrollHeight - scrollTop - clientHeight < 50);
    }
  };

  const fetchHistory = async () => {
    if (blockRefresh) return;
    try {
      const res = await fetch(`${API_URL}/api/chat/history?room_id=${roomId}`);
      const data = await res.json();
      if (Array.isArray(data)) { setMessages(data); setDebugError(null); }
      else { setDebugError(JSON.stringify(data)); }
    } catch (err) { setDebugError(err.message); }
  };

  const clearRoom = async () => {
    if(!window.confirm("WARNING: Wipe memory?")) return;
    try {
      await fetch(`${API_URL}/api/chat/clear`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId })
      });
      setMessages([]); 
      sessionStorage.removeItem(`welcomed_${roomId}_${senderName}`);
    } catch (err) { alert("Failed"); }
  };

  const exportChat = () => {
    if (messages.length === 0) { alert("No data!"); return; }
    const headers = ["Timestamp", "Sender", "Message Type", "Content"];
    const rows = messages.map(msg => {
      const cleanText = `"${msg.text.replace(/"/g, '""')}"`; 
      const time = new Date(msg.timestamp).toLocaleString();
      const type = msg.is_ai ? "AI Consultant" : "Human Warrior";
      return [time, msg.sender, type, cleanText].join(",");
    });
    const blob = new Blob([[headers.join(","), ...rows].join("\n")], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.setAttribute("download", `WarRoom_Log_${roomId}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // --- NEW: SMART AI PROMPT ---
  const askAiForHelp = async () => {
    setShouldAutoScroll(true);
    setLoading(true);
    
    // SMART PROMPT: Checks context before answering
    const prompt = `
      Analyze the conversation history above.
      
      CRITICAL INSTRUCTION:
      1. IF the conversation is empty or only contains greetings (like "Hi", "Hello"), DO NOT offer complex analysis. Instead, reply EXACTLY: "I need tactical data to assist. Shall we discuss: Option 1) Market Trends, Option 2) Competitor Pricing, or Option 3) New Venture Layouts?"
      
      2. IF there is actual business data, suggest 3 high-value ways to organize it (e.g., SWOT, Cost Table, Action Plan). List them clearly as Option 1, Option 2, and Option 3.
    `;

    try {
      const res = await fetch(`${API_URL}/api/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId, sender_name: "SYSTEM_COMMAND", message: prompt })
      });
      
      setBlockRefresh(true); // Pause refresh to read AI reply
      setTimeout(() => setBlockRefresh(false), 3000);

      const data = await res.json();
      if (data.ai_reply) {
        setMessages(prev => [...prev, { sender: "AI Consultant", text: data.ai_reply, is_ai: true, timestamp: new Date().toISOString() }]);
      }
    } catch (err) { console.error(err); } 
    finally { setLoading(false); }
  };

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setIsUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch(`${API_URL}/api/upload`, { method: 'POST', body: formData });
      const data = await res.json();
      if (data.url) setInputText(prev => prev + " " + data.url);
    } catch (err) { console.error(err); } 
    finally { setIsUploading(false); if(fileInputRef.current) fileInputRef.current.value = ''; }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;
    setShouldAutoScroll(true);
    
    // If user clicked a button, the text is "## EXECUTE OPTION X ##"
    const finalMsg = inputText; 

    const tempMessage = { sender: senderName, text: finalMsg, is_ai: false, timestamp: new Date().toISOString() };
    setMessages(prev => [...prev, tempMessage]);
    setInputText('');
    setLoading(true);

    try {
      const res = await fetch(`${API_URL}/api/chat/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ room_id: roomId, sender_name: senderName, message: finalMsg })
      });
      
      setBlockRefresh(true);
      setTimeout(() => setBlockRefresh(false), 2000);

      const data = await res.json();
      if (data.ai_reply) {
        setMessages(prev => [...prev, { sender: "AI Consultant", text: data.ai_reply, is_ai: true, timestamp: new Date().toISOString() }]);
      }
    } catch (err) { console.error(err); } 
    finally { setLoading(false); setShouldAutoScroll(true); }
  };

  const renderMessageContent = (text) => {
    if (text.includes("supabase") && (text.includes(".jpg") || text.includes(".png"))) {
      return <div><img src={text.trim()} alt="Upload" style={{maxWidth:'100%', borderRadius:'10px', marginTop:'10px', border:'1px solid #444'}} /></div>;
    }
    return text;
  };

  // --- LOGIC: Should we show buttons? ---
  const lastMsg = messages.length > 0 ? messages[messages.length - 1] : null;
  // Show buttons ONLY if AI spoke last AND mentioned "Option 1"
  const showOptions = lastMsg && lastMsg.is_ai && lastMsg.text.includes("Option 1");

  return (
    <div className="chat-interface">
      <div className="chat-header">
        <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', width:'100%'}}>
            <div>
                <h3 style={{margin:0}}>WAR ROOM: {roomId.toUpperCase()}</h3>
                <span className="live-indicator">● ONLINE | WARRIOR: {senderName}</span>
            </div>
            <div>
              <button onClick={askAiForHelp} style={{background: '#4B0082', border: '1px solid #9370DB', color: '#E6E6FA', padding: '5px 10px', cursor: 'pointer', fontSize: '0.7rem', marginRight: '10px'}}>✨ AI ASSIST</button>
              <button onClick={exportChat} style={{background: '#004400', border: '1px solid #00ff00', color: '#00ff00', padding: '5px 10px', cursor: 'pointer', fontSize: '0.7rem', marginRight: '10px'}}>⬇ SAVE REPORT</button>
              <button onClick={clearRoom} style={{background: '#330000', border: '1px solid red', color: 'red', padding: '5px 10px', cursor: 'pointer', fontSize: '0.7rem'}}>⚠ WIPE MEMORY</button>
            </div>
        </div>
      </div>

      {debugError && <div style={{padding:'15px', background:'#330000', color:'red'}}>⚠️ <strong>SYSTEM ERROR:</strong> {debugError}</div>}

      <div className="chat-window" ref={chatWindowRef} onScroll={handleScroll}>
        {Array.isArray(messages) && messages.map((msg, index) => (
          <div key={index} className={`message-row ${msg.is_ai ? 'ai-row' : 'user-row'}`}>
            <div className={`message-bubble ${msg.is_ai ? 'ai-bubble' : 'user-bubble'}`}>
              <div className="msg-sender">{msg.sender}</div>
              <div className="msg-text">
                {msg.text.includes("supabase") && (msg.text.includes(".jpg") || msg.text.includes(".png")) ? renderMessageContent(msg.text) : <ReactMarkdown>{msg.text}</ReactMarkdown>}
              </div>
              <div className="msg-time">{new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</div>
            </div>
          </div>
        ))}
        {loading && <div className="typing-indicator">AI Consultant is researching...</div>}
        <div ref={messagesEndRef} />
      </div>

      {/* --- NEW: TACTICAL ACTION BUTTONS (Only appear when needed) --- */}
      {showOptions && (
        <div style={{padding: '10px', display: 'flex', gap: '10px', justifyContent: 'center', background: '#001100', borderTop: '1px solid #004400'}}>
            <button onClick={() => setInputText("## EXECUTE OPTION 1 ##")} style={{background:'#004400', color:'#fff', border:'1px solid #00ff00', padding:'8px 15px', cursor:'pointer', borderRadius:'5px'}}>
                🚀 RUN OPTION 1
            </button>
            <button onClick={() => setInputText("## EXECUTE OPTION 2 ##")} style={{background:'#004400', color:'#fff', border:'1px solid #00ff00', padding:'8px 15px', cursor:'pointer', borderRadius:'5px'}}>
                🚀 RUN OPTION 2
            </button>
            <button onClick={() => setInputText("## EXECUTE OPTION 3 ##")} style={{background:'#004400', color:'#fff', border:'1px solid #00ff00', padding:'8px 15px', cursor:'pointer', borderRadius:'5px'}}>
                🚀 RUN OPTION 3
            </button>
        </div>
      )}

      <form className="chat-input-area" onSubmit={sendMessage}>
        <input type="file" ref={fileInputRef} onChange={handleFileUpload} style={{display:'none'}} accept="image/*,.pdf"/>
        <button type="button" onClick={() => fileInputRef.current.click()} disabled={isUploading} style={{marginRight:'10px', background:'#333', border:'1px solid #555', color:'#fff'}}>
            {isUploading ? '⏳' : '📎'}
        </button>
        <input type="text" value={inputText} onChange={(e) => setInputText(e.target.value)} placeholder="Type message or click an option above..." />
        <button type="submit" disabled={loading}>SEND</button>
      </form>
    </div>
  );
}

export default ChatInterface;