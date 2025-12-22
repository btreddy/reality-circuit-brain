import React, { useState } from 'react';
import ChatInterface from './ChatInterface';
import './Main.css';

// 🔗 CONNECT TO YOUR LIVE BRAIN
const API_BASE_URL = "https://reality-circuit-brain.onrender.com";

function App() {
  // --- STATES ---
  const [user, setUser] = useState(null); // Stores: { user_id, email, sessions_used }
  const [view, setView] = useState('login'); // 'login', 'signup', 'room_entry', 'war_room', 'locked'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roomId, setRoomId] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // --- AUTH FUNCTIONS ---

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/signup`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        alert("REGISTRATION SUCCESSFUL! Please Login.");
        setView('login');
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError("CONNECTION FAILED");
    }
    setLoading(false);
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE_URL}/api/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setUser(data); // Store user info
        setView('room_entry'); // Move to Room Selection
      } else {
        setError(data.error);
      }
    } catch (err) {
      setError("CONNECTION FAILED");
    }
    setLoading(false);
  };

  // --- THE LOCKING LOGIC 🔒 ---
  const handleEnterRoom = async (e) => {
    e.preventDefault();
    if (!roomId) return;
    setLoading(true);

    try {
      // 1. Ask Backend: "Can this user enter?"
      const res = await fetch(`${API_BASE_URL}/api/user/start_session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: user.user_id }),
      });
      const data = await res.json();

      if (data.status === "LOCKED") {
        setView('locked'); // ❌ STOP!
      } else {
        // ✅ ALLOWED!
        // Update local usage count just for display
        setUser({ ...user, sessions_used: data.sessions_used });
        setView('war_room'); 
      }
    } catch (err) {
      setError("SYSTEM ERROR: Could not verify clearance.");
    }
    setLoading(false);
  };

  // --- RENDER HELPERS ---
  const handleLogout = () => {
    setUser(null);
    setEmail('');
    setPassword('');
    setView('login');
  };

  // --- VIEWS ---

  // 1. LOGIN SCREEN
  if (view === 'login') {
    return (
      <div className="app-container">
        <div className="auth-box">
          <h1 className="glitch-text">WAR ROOM ACCESS</h1>
          <p className="status-line">IDENTIFICATION REQUIRED</p>
          
          <form onSubmit={handleLogin}>
            <input 
              type="email" 
              placeholder="OPERATIVE EMAIL" 
              value={email} onChange={(e) => setEmail(e.target.value)} 
              required 
            />
            <input 
              type="password" 
              placeholder="ACCESS CODE" 
              value={password} onChange={(e) => setPassword(e.target.value)} 
              required 
            />
            {error && <div className="error-message">⚠️ {error}</div>}
            <button type="submit" disabled={loading} className="cyber-btn">
              {loading ? "VERIFYING..." : "AUTHENTICATE"}
            </button>
          </form>
          
          <p className="link-text" onClick={() => setView('signup')}>
            [ NEW WARRIOR REGISTRATION ]
          </p>
        </div>
      </div>
    );
  }

  // 2. SIGNUP SCREEN
  if (view === 'signup') {
    return (
      <div className="app-container">
        <div className="auth-box">
          <h1 className="glitch-text">NEW RECRUIT</h1>
          <p className="status-line">CREATE CREDENTIALS</p>
          
          <form onSubmit={handleSignup}>
            <input 
              type="email" 
              placeholder="OPERATIVE EMAIL" 
              value={email} onChange={(e) => setEmail(e.target.value)} 
              required 
            />
            <input 
              type="password" 
              placeholder="SET ACCESS CODE" 
              value={password} onChange={(e) => setPassword(e.target.value)} 
              required 
            />
            {error && <div className="error-message">⚠️ {error}</div>}
            <button type="submit" disabled={loading} className="cyber-btn">
              {loading ? "REGISTERING..." : "CREATE ID"}
            </button>
          </form>
          
          <p className="link-text" onClick={() => setView('login')}>
            [ RETURN TO LOGIN ]
          </p>
        </div>
      </div>
    );
  }

  // 3. ROOM ENTRY (DASHBOARD)
  if (view === 'room_entry') {
    return (
      <div className="app-container">
        <div className="auth-box">
          <h1 className="glitch-text">WELCOME, WARRIOR</h1>
          <p className="status-line">ID: {user.email}</p>
          
          <div className="stats-panel">
            <p>SESSIONS USED: <span className="highlight">{user.sessions_used} / 3</span></p>
            <p>STATUS: <span className={user.is_subscribed ? "green" : "orange"}>
              {user.is_subscribed ? "UNLIMITED ACCESS" : "FREE TIER"}
            </span></p>
          </div>

          <form onSubmit={handleEnterRoom}>
            <input 
              type="text" 
              placeholder="ENTER ROOM ID" 
              value={roomId} 
              onChange={(e) => setRoomId(e.target.value)} 
              required 
            />
            <button type="submit" disabled={loading} className="cyber-btn">
              {loading ? "CHECKING CLEARANCE..." : "INITIATE SESSION"}
            </button>
          </form>
          
          <button onClick={handleLogout} className="logout-btn">[ LOGOUT ]</button>
        </div>
      </div>
    );
  }

  // 4. LOCKED SCREEN (The Money Maker 💰)
  if (view === 'locked') {
    return (
      <div className="app-container locked-mode">
        <div className="auth-box">
          <h1 className="red-text">⛔ ACCESS DENIED</h1>
          <p className="status-line">DEMO LIMIT REACHED</p>
          
          <div className="lock-message">
            <p>You have exhausted your 3 Free Strategic Sessions.</p>
            <p>To continue using the War Room intelligence, upgrade to a Pro License.</p>
          </div>

          <button className="cyber-btn subscribe-btn">SUBSCRIBE NOW (₹999/mo)</button>
          <button onClick={handleLogout} className="logout-btn">[ LOGOUT ]</button>
        </div>
      </div>
    );
  }

  // 5. THE WAR ROOM (Success!)
  return (
    <div className="app-container">
      <ChatInterface 
        roomId={roomId} 
        username={user.email} // We use email as the Warrior Name now
        onLeave={() => setView('room_entry')} 
      />
    </div>
  );
}

export default App;