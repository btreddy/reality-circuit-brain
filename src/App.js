import React, { useState, useEffect } from 'react';
import ChatInterface from './ChatInterface';
import LandingPage from './LandingPage'; 
import './Main.css';

// FIX: Hardcoded URL to guarantee connection
const API_BASE_URL = "https://reality-circuit-brain.onrender.com"; 

function App() {
  const [session, setSession] = useState(null);
  const [view, setView] = useState('LANDING'); // Options: 'LANDING', 'LOGIN', 'CHAT'
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Check if user is already logged in (Session persistence)
  useEffect(() => {
    const savedSession = localStorage.getItem('chat_session');
    if (savedSession) {
      setSession(JSON.parse(savedSession));
      setView('CHAT');
    }
  }, []);

  const handleLogin = async () => {
    if (!username || !password) { setError("IDENTIFICATION REQUIRED"); return; }
    setLoading(true);
    
    // Quick Fix for local/cloud matching: Ensure .com is present if needed, 
    // or just pass raw input if user is confident.
    
    try {
      const res = await fetch(`${API_BASE_URL}/api/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      const data = await res.json();

      if (data.error) {
        setError("INVALID CREDENTIALS");
      } else {
        const sessionData = { username, room_id: data.room_id };
        localStorage.setItem('chat_session', JSON.stringify(sessionData));
        setSession(sessionData);
        setView('CHAT');
      }
    } catch (err) {
      setError("CONNECTION FAILED");
    }
    setLoading(false);
  };

  const handleLogout = () => {
    localStorage.removeItem('chat_session');
    setSession(null);
    setView('LANDING'); // Go back to Landing Page on logout
    setUsername('');
    setPassword('');
    setError('');
  };

  // --- RENDER LOGIC ---

  // 1. If Logged In -> Show War Room
  if (session) {
    return <ChatInterface roomId={session.room_id} username={session.username} onLeave={handleLogout} />;
  }

  // 2. If View is 'LOGIN' -> Show the Green/Black Access Screen
  if (view === 'LOGIN') {
    return (
      <div className="login-container">
        <div className="login-box">
          <h1 className="glitch-text">WAR ROOM ACCESS</h1>
          <p className="subtitle">IDENTIFICATION REQUIRED</p>
          
          <div className="input-group">
            <label>STRATEGIC ID (EMAIL)</label>
            <input 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              placeholder="operative@sld.com" 
            />
          </div>
          
          <div className="input-group">
            <label>ACCESS CODE</label>
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              placeholder="••••••" 
            />
          </div>

          {error && <div className="error-msg">⚠️ {error}</div>}

          <button className="login-btn" onClick={handleLogin} disabled={loading}>
            {loading ? "AUTHENTICATING..." : "AUTHENTICATE"}
          </button>
          
          <div className="login-footer">
            <button className="text-link" onClick={() => setView('LANDING')}>{'<< BACK TO HOME'}</button>
          </div>
        </div>
      </div>
    );
  }

  // 3. Default -> Show the New Landing Page
  return (
    <LandingPage 
      onGetStarted={() => setView('LOGIN')} 
      onLogin={() => setView('LOGIN')} 
    />
  );
}

export default App;