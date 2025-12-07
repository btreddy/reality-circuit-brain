import React, { useState } from 'react';
import './Main.css';

// 🚀 STANDALONE MODE: Points to your Render Backend
const API_URL = "https://reality-circuit-brain.onrender.com";

function App() {
  const [userIdea, setUserIdea] = useState('');
  const [physicalState, setPhysicalState] = useState('neutral');
  const [socialFeedback, setSocialFeedback] = useState('none');
  const [emotionalState, setEmotionalState] = useState('neutral');
  const [motivation, setMotivation] = useState('intrinsic');

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const payload = {
        user_idea: userIdea,
        physical_state: physicalState,
        social_feedback: socialFeedback,
        emotional_state: emotionalState,
        motivation: motivation
      };

      const response = await fetch(`${API_URL}/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      console.log("DATA RECEIVED:", data); // Check your browser console
      setResult(data);
    } catch (err) {
      console.error(err);
      setError('Error connecting to backend: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', fontFamily: 'Arial', color: 'white', background: '#111', minHeight: '100vh' }}>
      <h1>Reality Circuit - DEBUG MODE</h1>
      
      <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
        <textarea 
          value={userIdea} 
          onChange={e => setUserIdea(e.target.value)} 
          placeholder="Enter idea..."
          style={{ width: '100%', padding: '10px' }}
        />
        <br />
        <button type="submit" disabled={loading} style={{ padding: '10px 20px', marginTop: '10px' }}>
          {loading ? 'ANALYZING...' : 'RUN TEST'}
        </button>
      </form>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {/* RAW DATA DISPLAY - This cannot crash */}
      {result && (
        <div style={{ border: '1px solid #0f0', padding: '20px' }}>
          <h2 style={{ color: result.verdict === 'GO' ? '#0f0' : '#f00' }}>
            VERDICT: {result.verdict}
          </h2>
          <p><strong>Diagnosis:</strong> {result.diagnosis}</p>
          
          <h3>Scores:</h3>
          <ul>
            <li>Logic: {result.logic_score}</li>
            <li>Data: {result.data_score}</li>
            <li>Money: {result.money_score}</li>
            <li>Ability: {result.ability_score}</li>
          </ul>

          <h3>Raw JSON (For Debugging):</h3>
          <pre style={{ background: '#333', padding: '10px' }}>
            {JSON.stringify(result, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

export default App;