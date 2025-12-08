import React, { useState, useEffect } from 'react';
import './Main.css';

// 🚀 LIVE BACKEND
const API_URL = "https://reality-circuit-brain.onrender.com";

function History({ onBack }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchHistory();
  }, []);

  const fetchHistory = async () => {
    try {
      const response = await fetch(`${API_URL}/history`);
      if (!response.ok) throw new Error('Failed to access archives');
      const data = await response.json();
      setHistory(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="history-container">
      <div className="header" style={{ borderBottom: '1px dashed #333' }}>
        <h2 style={{ color: 'var(--neon-blue)', margin: 0 }}>ARCHIVE_VAULT</h2>
        <button onClick={onBack} className="cyber-button" style={{ width: 'auto', padding: '10px 20px', marginTop: '10px' }}>
          ← RETURN TO SCANNER
        </button>
      </div>

      {loading && <div style={{ color: '#fff', textAlign: 'center', marginTop: '50px' }}>ACCESSING SECURE DATABASE...</div>}
      {error && <div style={{ color: '#ff0055', textAlign: 'center', marginTop: '20px' }}>ERROR: {error}</div>}

      <div className="history-list" style={{ marginTop: '20px' }}>
        {history.map((item) => (
          <div key={item.id} className="score-card" style={{ marginBottom: '15px', borderLeft: `4px solid ${item.verdict === 'GO' ? 'var(--neon-green)' : 'var(--neon-red)'}` }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
              <span style={{ color: '#555', fontSize: '0.8rem' }}>ID: #{item.id} | {item.date}</span>
              <span style={{ 
                color: item.verdict === 'GO' ? 'var(--neon-green)' : 'var(--neon-red)', 
                fontWeight: 'bold',
                border: `1px solid ${item.verdict === 'GO' ? 'var(--neon-green)' : 'var(--neon-red)'}`,
                padding: '2px 8px',
                fontSize: '0.8rem'
              }}>
                {item.verdict}
              </span>
            </div>

            <h3 style={{ color: '#fff', fontSize: '1.1rem', marginBottom: '10px' }}>"{item.subject}"</h3>
            
            <p style={{ color: '#aaa', fontStyle: 'italic', fontSize: '0.9rem' }}>
              {item.diagnosis}
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
               <div style={{ fontSize: '0.8rem', color: 'var(--neon-blue)' }}>LOGIC: {item.logic}%</div>
               <div style={{ fontSize: '0.8rem', color: '#ffaa00' }}>MONEY: {item.money}%</div>
            </div>

          </div>
        ))}

        {history.length === 0 && !loading && (
          <div style={{ textAlign: 'center', color: '#555', marginTop: '50px' }}>ARCHIVES EMPTY. NO RECORDS FOUND.</div>
        )}
      </div>
    </div>
  );
}

export default History;