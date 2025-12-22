import React, { useState, useEffect } from 'react';
import ChatInterface from './ChatInterface';
import './Main.css';

// ⚠️ IMPORTANT: Verify this URL matches your Render Dashboard exactly
const API_BASE_URL = "https://reality-circuit-brain.onrender.com";

/* --- 1. INTERNAL LOGIN COMPONENT (Since you couldn't find the file) --- */
function Login({ onLogin }) {
  const [isRegistering, setIsRegistering] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async () => {
    if (!email || !password) {
      setError("⚠️ CREDENTIALS REQUIRED");
      return;
    }

    setIsLoading(true);
    setError('');
    const endpoint = isRegistering ? '/api/signup' : '/api/login';

    try {
      console.log(`Connecting to: ${API_BASE_URL}${endpoint}`); // Debug Log
      
      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: email, password }),
      });

      const data = await res.json();

      if (res.ok) {
        onLogin(data.username, data.room_id);
      } else {
        setError(`⚠️ ${data.error || 'ACCESS DENIED'}`);
      }
    } catch (err) {
      console.error("Login Error:", err);
      setError("⚠️ CONNECTION FAILED (Check Backend/Database)"); 
    }
    setIsLoading(false);
  };

  return (
    <div className="login-container">
      <div className="login-box">
        {/* --- FIXED TEXT: "WAR ROOM ACCESS" / "NEW WARRIOR" --- */}
        <h1 className="glitch" data-text={isRegistering ? "NEW WARRIOR" : "WAR ROOM ACCESS"}>
          {isRegistering ? "NEW WARRIOR" : "WAR ROOM ACCESS"}
        </h1>
        
        <p className="subtitle">
          {isRegistering ? "INITIATE PROTOCOL" : "IDENTIFICATION REQUIRED"}
        </p>

        <div className="input-group">
          <label>STRATEGIC ID (EMAIL)</label>
          <input 
            type="email" 
            value={email} 
            onChange={(e) => setEmail(e.target.value)} 
            placeholder="operative@command.com"
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

/* --- 2. MAIN APP COMPONENT --- */
function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [roomId, setRoomId] = useState(null);
  const [username, setUsername] = useState('');
  const [showAccessDenied, setShowAccessDenied] = useState(false);

  // Check Local Storage on Load
  useEffect(() => {
    const storedUser = localStorage.getItem('war_room_user');
    const storedRoom = localStorage.getItem('war_room_id');
    if (storedUser && storedRoom) {
      setUsername(storedUser);
      setRoomId(storedRoom);
      setIsLoggedIn(true);
    }
  }, []);

  // Handle Login Success
  const handleLogin = (user, room) => {
    localStorage.setItem('war_room_user', user);
    localStorage.setItem('war_room_id', room);
    setUsername(user);
    setRoomId(room);
    setIsLoggedIn(true);
  };

  // Handle Logout / Exit
  const handleLogout = () => {
    localStorage.removeItem('war_room_user');
    localStorage.removeItem('war_room_id');
    setIsLoggedIn(false);
    setRoomId(null);
    setUsername('');
    setShowAccessDenied(false); // Reset flags
  };

  return (
    <div className="App">
      {!isLoggedIn ? (
        <Login onLogin={handleLogin} />
      ) : showAccessDenied ? (
         // "The Trap" Screen
        <div className="access-denied-screen">
          <div className="lock-icon">⛔</div>
          <h1>ACCESS DENIED</h1>
          <p>DEMO LIMIT REACHED</p>
          <p>You have exhausted your 3 Free Strategic Sessions.</p>
          <p>To continue using the War Room intelligence, upgrade to a Pro License.</p>
          <button className="subscribe-btn">SUBSCRIBE NOW (₹999/mo)</button>
          <button onClick={handleLogout} className="logout-btn">[ LOGOUT ]</button>
        </div>
      ) : (
        // The Main Chat Interface
        <ChatInterface 
          roomId={roomId} 
          username={username} 
          onLeave={handleLogout} 
        />
      )}
    </div>
  );
}

export default App;