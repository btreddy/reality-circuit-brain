import React, { useState, useEffect } from 'react';
import ChatInterface from './ChatInterface';
import LandingPage from './LandingPage';
import FingerprintJS from '@fingerprintjs/fingerprintjs';
import './Main.css';

// FIX: Hardcoded to the LIVE Render Backend
const API_BASE_URL = "https://reality-circuit-brain.onrender.com"; 

function Login({ onLogin, onBack, targetRoom }) {
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
    
    const endpoint = isRegistering ? '/api/signup' : '/api/login';
    try {
      const payload = { username: email, password };
      if (isRegistering) payload.device_id = deviceId;

      const res = await fetch(`${API_BASE_URL}${endpoint}`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (res.ok) { 
        // CRITICAL CHANGE: If a targetRoom (Invite) exists, use that. Otherwise use their own room.
        const finalRoom = targetRoom || data.room_id;
        onLogin(data.username, finalRoom); 
      } 
      else { setError(`⚠️ ${data.error || 'ACCESS DENIED'}`); }
    } catch (err) { setError("⚠️ CONNECTION FAILED"); }
    setIsLoading(false);
  };

  import LandingPage from './LandingPage'; // Import the new page

function App() {
  const [session, setSession] = useState(null);
  const [view, setView] = useState('LANDING'); // New State: 'LANDING', 'LOGIN', 'CHAT'

  // ... (keep your existing checkSession logic)

  // UPDATE THE RENDER LOGIC:
  if (session) {
    return <ChatInterface ... />;
  }

  if (view === 'LOGIN') {
    return <Login onLogin={handleLogin} onBack={() => setView('LANDING')} />;
  }

  // Default: Show Landing Page
  return (
    <LandingPage 
      onGetStarted={() => setView('LOGIN')} 
      onLogin={() => setView('LOGIN')} 
    />
  );
}

function App() {
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const [roomId, setRoomId] = useState(null);
  const [username, setUsername] = useState('');
  const [inviteRoom, setInviteRoom] = useState(null); // New State for Invite

  useEffect(() => {
    // 1. Check for ?join=xyz in URL
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('join');
    if (joinCode) {
      setInviteRoom(joinCode);
      setHasEntered(true); // Skip Landing Page if invited
    }

    // 2. Check LocalStorage
    const storedUser = localStorage.getItem('war_room_user');
    const storedRoom = localStorage.getItem('war_room_id');
    if (storedUser && storedRoom) {
      // If invited, ignore stored room and ask to login/confirm
      if (!joinCode) {
        setUsername(storedUser); 
        setRoomId(storedRoom); 
        setIsLoggedIn(true);
      }
    }
  }, []);

  const handleLogin = (user, room) => {
    localStorage.setItem('war_room_user', user);
    localStorage.setItem('war_room_id', room);
    setUsername(user); 
    setRoomId(room); 
    setIsLoggedIn(true);
    
    // Clear the URL to make it clean
    window.history.replaceState({}, document.title, "/");
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

  return <Login onLogin={handleLogin} onBack={() => setHasEntered(false)} targetRoom={inviteRoom} />;
}

export default App;