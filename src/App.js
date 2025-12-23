import React, { useState, useEffect } from 'react';
import ChatInterface from './ChatInterface';
import LandingPage from './LandingPage';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import './Main.css';

// FIX: Hardcoded Domain to guarantee connection
const API_BASE_URL = "https://careco-pilotai.com"; 

function Login({ onLogin, onBack }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [deviceId, setDeviceId] = useState(null);

  useEffect(() => {
    const getFingerprint = async () => {
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      setDeviceId(result.visitorId);
    };
    getFingerprint();
  }, []);

  const handleSubmit = async () => {
    if (!email || !password) { setError("⚠️ CREDENTIALS REQUIRED"); return; }
    if (!deviceId) { setError("⚠️ SCANNING DEVICE... PLEASE WAIT"); return; }
    setIsLoading(true); setError('');
    
    // FIX: Use relative path. The backend CORS fix should handle it now.
    const endpoint = isRegistering ? '/api/signup' : '/api/login';
    
    try {
      const payload = { username: email, password };
      if (isRegistering) payload.device_id = deviceId;

      const res = await fetch(endpoint, { // Use relative path
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      // DEBUG: If it's not JSON, we want to know why!
      const contentType = res.headers.get("content-type");
      if (!contentType || !contentType.includes("application/json")) {
        const text = await res.text();
        alert("SERVER ERROR (Not JSON): " + text.substring(0, 100)); // Show first 100 chars
        throw new Error("Server returned HTML instead of JSON");
      }

      const data = await res.json();

      if (res.ok) { 
        onLogin(data.username, data.room_id); 
      } else { 
        setError(`⚠️ ${data.error || 'ACCESS DENIED'}`); 
        // alert("LOGIN FAILED: " + data.error); // Optional: Uncomment to see backend error
      }
    } catch (err) { 
      // THE SPY: Show the exact error on your screen
      alert("CONNECTION ERROR DETAILS: " + err.message);
      setError("⚠️ CONNECTION FAILED"); 
    }
    setIsLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-box">
        <h1 className="glitch" data-text={isRegistering ? "NEW WARRIOR" : "WAR ROOM ACCESS"}>
          {isRegistering ? "NEW WARRIOR" : "WAR ROOM ACCESS"}
        </h1>
        <p className="subtitle">{isRegistering ? "INITIATE PROTOCOL" : "IDENTIFICATION REQUIRED"}</p>
        
        <div className="input-group">
          <label>STRATEGIC ID (EMAIL)</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="input-group">
          <label>ACCESS CODE</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        {error && <div className="error-msg">{error}</div>}

        <button onClick={handleSubmit} disabled={isLoading} className="login-btn">
          {isLoading ? "AUTHENTICATING..." : (isRegistering ? "CREATE ID" : "AUTHENTICATE")}
        </button>

        <div className="toggle-link" onClick={() => setIsRegistering(!isRegistering)}>
          [ {isRegistering ? "RETURN TO LOGIN" : "NEW WARRIOR REGISTRATION"} ]
        </div>
        
        <div className="toggle-link" style={{marginTop: '10px', color: '#555'}} onClick={onBack}>
          &lt;&lt; BACK TO HOME
        </div>
      </div>
    </div>
  );
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const [roomId, setRoomId] = useState(null);
  const [username, setUsername] = useState('');

  useEffect(() => {
    const storedUser = localStorage.getItem('war_room_user');
    const storedRoom = localStorage.getItem('war_room_id');
    if (storedUser && storedRoom) {
      setUsername(storedUser); setRoomId(storedRoom); setIsLoggedIn(true);
    }
  }, []);

  const handleLogin = (user, room) => {
    localStorage.setItem('war_room_user', user);
    localStorage.setItem('war_room_id', room);
    setUsername(user); setRoomId(room); setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('war_room_user');
    localStorage.removeItem('war_room_id');
    setIsLoggedIn(false); setRoomId(null); setUsername(''); setHasEntered(false);
  };

  if (!hasEntered) {
    return <LandingPage onEnter={() => setHasEntered(true)} />;
  }

  if (isLoggedIn) {
    return <ChatInterface roomId={roomId} username={username} onLeave={handleLogout} />;
  }

  return <Login onLogin={handleLogin} onBack={() => setHasEntered(false)} />;
}

export default App;