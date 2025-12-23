import React, { useState, useEffect } from 'react';
import ChatInterface from './ChatInterface';
import FingerprintJS from '@fingerprintjs/fingerprintjs'; // <--- The Scanner
import './Main.css';

const API_BASE_URL = "https://reality-circuit-brain.onrender.com";

function Login({ onLogin }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [deviceId, setDeviceId] = useState(null);

  // --- 1. CAPTURE FINGERPRINT ON LOAD ---
  useEffect(() => {
    const getFingerprint = async () => {
      const fp = await FingerprintJS.load();
      const result = await fp.get();
      setDeviceId(result.visitorId); // This is the unique Device ID
      console.log("Device ID Secured:", result.visitorId);
    };
    getFingerprint();
  }, []);

  const handleSubmit = async () => {
    if (!email || !password) {
      setError("⚠️ CREDENTIALS REQUIRED");
      return;
    }
    if (!deviceId) {
      setError("⚠️ SCANNING DEVICE... PLEASE WAIT");
      return;
    }

    setIsLoading(true);
    setError('');
    const endpoint = isRegistering ? '/api/signup' : '/api/login';

    try {
      const payload = { username: email, password };
      
      // If Registering, attach the Fingerprint!
      if (isRegistering) {
        payload.device_id = deviceId; 
      }

      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        onLogin(data.username, data.room_id);
      } else {
        // Show the backend error (e.g., "DEVICE ALREADY REGISTERED")
        setError(`⚠️ ${data.error || 'ACCESS DENIED'}`);
      }
    } catch (err) {
      console.error("Login Error:", err);
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
        
        <p className="subtitle">
          {isRegistering ? "INITIATE PROTOCOL" : "IDENTIFICATION REQUIRED"}
        </p>

        <div className="input-group">
          <label>STRATEGIC ID (EMAIL)</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="operative@command.com" />
        </div>

        <div className="input-group">
          <label>ACCESS CODE</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••" />
        </div>

        {error && <div className="error-msg">{error}</div>}

        <button onClick={handleSubmit} disabled={isLoading} className="login-btn">
          {isLoading ? "AUTHENTICATING..." : (isRegistering ? "CREATE ID" : "AUTHENTICATE")}
        </button>

        <div className="toggle-link" onClick={() => setIsRegistering(!isRegistering)}>
          [ {isRegistering ? "RETURN TO LOGIN" : "NEW WARRIOR REGISTRATION"} ]
        </div>
      </div>
    </div>
  );
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [roomId, setRoomId] = useState(null);
  const [username, setUsername] = useState('');

  useEffect(() => {
    const storedUser = localStorage.getItem('war_room_user');
    const storedRoom = localStorage.getItem('war_room_id');
    if (storedUser && storedRoom) {
      setUsername(storedUser);
      setRoomId(storedRoom);
      setIsLoggedIn(true);
    }
  }, []);

  const handleLogin = (user, room) => {
    localStorage.setItem('war_room_user', user);
    localStorage.setItem('war_room_id', room);
    setUsername(user);
    setRoomId(room);
    setIsLoggedIn(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('war_room_user');
    localStorage.removeItem('war_room_id');
    setIsLoggedIn(false);
    setRoomId(null);
    setUsername('');
  };

  return (
    <div className="App">
      {!isLoggedIn ? <Login onLogin={handleLogin} /> : <ChatInterface roomId={roomId} username={username} onLeave={handleLogout} />}
    </div>
  );
}

export default App;