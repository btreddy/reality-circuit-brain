import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import './Main.css';

// 🚀 POINTS TO YOUR LIVE RENDER BACKEND
const API_URL = "https://reality-circuit-brain.onrender.com";

function App() {
  // Input States
  const [userIdea, setUserIdea] = useState('');
  const [physicalState, setPhysicalState] = useState('neutral');
  const [socialFeedback, setSocialFeedback] = useState('none');
  const [emotionalState, setEmotionalState] = useState('neutral');
  const [motivation, setMotivation] = useState('intrinsic');

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const resultRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);

    try {
      // 1. Send the specific 5 fields your Backend expects
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

      if (!response.ok) {
        throw new Error('Server returned an error');
      }

      const data = await response.json();
      
      // 2. Safety Check to prevent crashes
      if (!data.verdict) {
         throw new Error("Received incomplete analysis from AI.");
      }

      setResult(data);
    } catch (err) {
      console.error(err);
      setError('Connection Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const downloadPDF = async () => {
    if (!resultRef.current) return;
    try {
      const canvas = await html2canvas(resultRef.current, { scale: 2 });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Reality_Check_${new Date().toISOString().slice(0, 10)}.pdf`);
    } catch (err) {
      console.error("PDF Error:", err);
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>REALITY CIRCUIT</h1>
        <p>The AI bullshit detector for your business ideas.</p>
      </header>

      <main className="main-content">
        <form onSubmit={handleSubmit} className="analysis-form">
          <div className="input-group">
            <label>YOUR IDEA / DECISION:</label>
            <textarea
              value={userIdea}
              onChange={(e) => setUserIdea(e.target.value)}
              placeholder="e.g., I want to start a coffee shop in Hyderabad..."
              rows="3"
              required
            />
          </div>

          {/* Context Inputs */}
          <div className="context-grid">
            <div className="input-group">
              <label>Physical State:</label>
              <select value={physicalState} onChange={(e) => setPhysicalState(e.target.value)}>
                <option value="neutral">Neutral / Normal</option>
                <option value="tired">Tired / Exhausted</option>
                <option value="energetic">High Energy</option>
                <option value="sick">Sick / Stressed</option>
              </select>
            </div>

            <div className="input-group">
              <label>Social Feedback:</label>
              <select value={socialFeedback} onChange={(e) => setSocialFeedback(e.target.value)}>
                <option value="none">No Feedback Yet</option>
                <option value="echo_chamber">Everyone Agrees (Echo Chamber)</option>
                <option value="mixed">Mixed Reviews</option>
                <option value="critical">Heavy Criticism</option>
              </select>
            </div>

            <div className="input-group">
              <label>Emotional State:</label>
              <select value={emotionalState} onChange={(e) => setEmotionalState(e.target.value)}>
                <option value="neutral">Calm / Rational</option>
                <option value="urgency">Urgency (Must do it NOW)</option>
                <option value="fear">Fear (FOMO)</option>
                <option value="excited">Over-Excited</option>
              </select>
            </div>

             <div className="input-group">
              <label>Motivation:</label>
              <select value={motivation} onChange={(e) => setMotivation(e.target.value)}>
                <option value="intrinsic">Passion / Learning</option>
                <option value="extrinsic">Money / Fame Only</option>
                <option value="desperation">Desperation / Need Cash</option>
              </select>
            </div>
          </div>

          <button type="submit" disabled={loading} className="cyber-button">
            {loading ? 'PROCESSING...' : 'RUN CIRCUIT ANALYSIS'}
          </button>
        </form>

        {error && <div className="error-message">{error}</div>}

        {result && (
          <div className="result-section" ref={resultRef} style={{ marginTop: '20px', padding: '20px', background: '#111', border: '1px solid #333', borderRadius: '10px' }}>
            
              <div className="verdict-box" style={{ 
                border: `2px solid ${result.verdict === 'GO' ? '#00ff00' : '#ff0055'}`, 
                padding: '20px', 
                borderRadius: '8px', 
                marginBottom: '20px',
                textAlign: 'center',
                backgroundColor: 'rgba(0,0,0,0.5)'
              }}>
                <h2 style={{ color: '#fff', margin: '0 0 10px 0' }}>
                  VERDICT: <span style={{ color: result.verdict === 'GO' ? '#00ff00' : '#ff0055', fontWeight: 'bold' }}>{result.verdict}</span>
                </h2>
                
                {/* FORCE VISIBLE TEXT HERE */}
                <h3 style={{ color: '#aaa', fontSize: '14px', marginTop: '15px' }}>AI ANALYSIS:</h3>
                <p style={{ 
                   color: '#ffffff', 
                   fontSize: '16px', 
                   lineHeight: '1.5', 
                   fontStyle: 'italic',
                   margin: '10px 0' 
                }}>
                  "{result.diagnosis || "Error: Diagnosis text is missing."}"
                </p>
              </div>

            <div className="diamond-container">
              {/* This draws the green diamond shape */}
              <div className="diamond-shape"></div>
            </div>

            <div className="scores-grid">
              <div className="score-card">
                <h3>LOGIC</h3>
                <div className="score-bar"><div style={{width: `${result.logic_score || 0}%`, background: '#00ff00'}}></div></div>
                <span>{result.logic_score || 0}/100</span>
              </div>
              <div className="score-card">
                <h3>DATA</h3>
                <div className="score-bar"><div style={{width: `${result.data_score || 0}%`, background: '#00ccff'}}></div></div>
                <span>{result.data_score || 0}/100</span>
              </div>
              <div className="score-card">
                <h3>MONEY</h3>
                <div className="score-bar"><div style={{width: `${result.money_score || 0}%`, background: '#ffaa00'}}></div></div>
                <span>{result.money_score || 0}/100</span>
              </div>
              <div className="score-card">
                <h3>ABILITY</h3>
                <div className="score-bar"><div style={{width: `${result.ability_score || 0}%`, background: '#ff0055'}}></div></div>
                <span>{result.ability_score || 0}/100</span>
              </div>
            </div>

            <button onClick={downloadPDF} className="download-btn">
              DOWNLOAD REPORT (PDF)
            </button>
            <p className="db-note">--- Result Saved to Database ---</p>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;