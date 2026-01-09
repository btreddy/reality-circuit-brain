import React, { useState, useEffect } from 'react';
import ChatInterface from './ChatInterface';
import './Main.css';

const API_BASE_URL = "https://reality-circuit-brain.onrender.com";

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [roomId, setRoomId] = useState('');
  const [deviceId] = useState('browser_' + Math.random().toString(36).substr(2, 9));
  const [isRegistering, setIsRegistering] = useState(false);
  const [error, setError] = useState('');

  // --- GUEST MODE LOGIC (The Fix) ---
  useEffect(() => {
    // Check if the URL has a "?room=..." parameter
    const params = new URLSearchParams(window.location.search);
    const sharedRoom = params.get('room');

    if (sharedRoom) {
      // BYPASS LOGIN
      setRoomId(sharedRoom);
      setUsername(`Guest_${Math.floor(Math.random() * 1000)}`); // Temporary Guest Name
      setIsLoggedIn(true);
    }
  }, []);
  // ----------------------------------

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    const endpoint = isRegistering ? '/api/signup' : '/api/login';
    
    try {
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, device_id: deviceId })
      });
      const data = await res.json();
      
      if (res.ok) {
        setIsLoggedIn(true);
        setRoomId(data.room_id);
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError("Server Offline or Connection Error");
    }
  };

  if (isLoggedIn) {
    return <ChatInterface roomId={roomId} username={username} onLeave={() => setIsLoggedIn(false)} />;
  }

  return (
    <div className="login-container">
      <div className="login-box">
        <h1 className="login-title">WAR ROOM <span className="highlight">ACCESS</span></h1>
        
        {error && <div className="error-msg">⚠️ {error}</div>}
        
        <form onSubmit={handleAuth}>
          <div className="input-group">
            <input 
              type="text" 
              placeholder="Username / Email" 
              value={username} 
              onChange={(e) => setUsername(e.target.value)} 
              required 
            />
          </div>
          <div className="input-group">
            <input 
              type="password" 
              placeholder="Password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
          </div>
          
          <button type="submit" className="login-btn">
            {isRegistering ? 'INITIALIZE NEW PROTOCOL' : 'AUTHENTICATE'}
          </button>
        </form>

        <button className="toggle-btn" onClick={() => setIsRegistering(!isRegistering)}>
          {isRegistering ? 'Back to Login' : 'Create Secure ID'}
        </button>
      </div>
    </div>
  );
}

export default App;