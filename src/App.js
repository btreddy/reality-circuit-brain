import React, { useState } from 'react';
import ChatInterface from './ChatInterface'; // Ensure this path matches your file structure
import './Main.css'; // Your CSS file

function App() {
  const [roomId, setRoomId] = useState(null);
  const [username, setUsername] = useState('');
  const [tempRoom, setTempRoom] = useState('');

  const handleLogin = (e) => {
    e.preventDefault();
    if (!tempRoom.trim() || !username.trim()) return;
    // Simple "Validation" - minimal security for now
    setRoomId(tempRoom.trim().replace(/\s+/g, '_').toLowerCase()); 
  };

  const handleLogout = () => {
    setRoomId(null);
    setTempRoom('');
  };

  if (!roomId) {
    return (
      <div className="login-container" style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', 
        justifyContent: 'center', height: '100vh', background: '#000', color: '#fff'
      }}>
        <h1 style={{color: 'var(--neon-blue)', marginBottom: '2rem'}}>SECURITY CHECK</h1>
        <form onSubmit={handleLogin} style={{display: 'flex', flexDirection: 'column', gap: '1rem', width: '300px'}}>
          <input 
            type="text" 
            placeholder="Enter Agent Name" 
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            style={{padding: '10px', background: '#111', border: '1px solid #333', color: '#fff'}}
          />
          <input 
            type="text" 
            placeholder="Enter Room/Secret Code" 
            value={tempRoom}
            onChange={(e) => setTempRoom(e.target.value)}
            style={{padding: '10px', background: '#111', border: '1px solid #333', color: '#fff'}}
          />
          <button type="submit" className="cyber-button" style={{padding: '10px', background: 'var(--neon-blue)', border: 'none', cursor: 'pointer', fontWeight: 'bold'}}>
            ENTER WAR ROOM
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="app-container">
       <button 
         onClick={handleLogout} 
         style={{position: 'absolute', top: '10px', right: '10px', zIndex: 1000, background: 'red', color: 'white', border: 'none', padding: '5px 10px', cursor: 'pointer'}}
       >
         EXIT ROOM
       </button>
       <ChatInterface senderName={username} roomId={roomId} />
    </div>
  );
}

export default App;