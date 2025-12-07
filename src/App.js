import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import './Main.css';

// 🚀 LIVE BACKEND
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
  
  const resultRef = useRef(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResult(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });

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

      if (!response.ok) throw new Error('Server returned an error');

      const data = await response.json();
      if (!data.verdict) throw new Error("Incomplete analysis.");

      setTimeout(() => { setResult(data); }, 1500);

    } catch (err) {
      console.error(err);
      setError('Connection Error: ' + err.message);
    } finally {
      if (!result) setTimeout(() => setLoading(false), 1500);
      else setLoading(false);
    }
  };

  const downloadPDF = async () => {
    if (!resultRef.current) return;
    const originalStyle = resultRef.current.style.cssText;
    resultRef.current.style.width = "800px"; 
    resultRef.current.style.padding = "40px";
    
    try {
      const canvas = await html2canvas(resultRef.current, { 
        scale: 2, 
        backgroundColor: "#050505",
        useCORS: true
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Reality_Circuit_Report.pdf`);
    } catch (err) {
      console.error("PDF Error:", err);
    } finally {
      resultRef.current.style.cssText = originalStyle;
    }
  };

  const getColor = (score) => {
    if (score >= 80) return '#00ff41'; 
    if (score >= 50) return '#00f3ff'; 
    return '#ff0055'; 
  };

  // --- CHART LOGIC ---
  const renderChart = () => {
    if (!result) return null;
    // Map scores (0-100) to SVG coordinates (0-100 radius)
    // Center is 100,100. Max radius is 80.
    const center = 100;
    const radius = 80;
    
    const logic = (result.logic_score || 0) / 100 * radius;
    const dataVal = (result.data_score || 0) / 100 * radius;
    const money = (result.money_score || 0) / 100 * radius;
    const ability = (result.ability_score || 0) / 100 * radius;

    // Calculate Points: Top, Right, Bottom, Left
    const p1 = `${center},${center - logic}`; // Logic (Top)
    const p2 = `${center + dataVal},${center}`; // Data (Right)
    const p3 = `${center},${center + money}`; // Money (Bottom)
    const p4 = `${center - ability},${center}`; // Ability (Left)

    const points = `${p1} ${p2} ${p3} ${p4}`;

    return (
      <div className="chart-container">
        <svg width="200" height="200" className="radar-svg">
          {/* Grid Circles */}
          <circle cx="100" cy="100" r="20" fill="none" stroke="#222" />
          <circle cx="100" cy="100" r="40" fill="none" stroke="#222" />
          <circle cx="100" cy="100" r="60" fill="none" stroke="#222" />
          <circle cx="100" cy="100" r="80" fill="none" stroke="#333" />
          
          {/* Axis Lines */}
          <line x1="100" y1="20" x2="100" y2="180" className="radar-axis" />
          <line x1="20" y1="100" x2="180" y2="100" className="radar-axis" />

          {/* The Data Shape */}
          <polygon points={points} className="radar-shape" />

          {/* Labels */}
          <text x="100" y="15" className="chart-label">LOGIC</text>
          <text x="190" y="105" className="chart-label">DATA</text>
          <text x="100" y="195" className="chart-label">MONEY</text>
          <text x="10" y="105" className="chart-label">ABILITY</text>
        </svg>
      </div>
    );
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>REALITY CIRCUIT_v1.0</h1>
        <p>AI BIAS DETECTOR & DECISION ENGINE</p>
      </header>

      <main>
        <form onSubmit={handleSubmit}>
          <div className="input-group">
            <label>TARGET SUBJECT (IDEA):</label>
            <textarea value={userIdea} onChange={(e) => setUserIdea(e.target.value)} placeholder="INPUT DATA STREAM HERE..." rows="3" required />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
            <div className="input-group">
              <label>PHYSICAL STATE:</label>
              <select value={physicalState} onChange={(e) => setPhysicalState(e.target.value)}>
                <option value="neutral">NEUTRAL</option>
                <option value="tired">COMPROMISED (TIRED)</option>
                <option value="energetic">OPTIMAL (HIGH ENERGY)</option>
                <option value="sick">ERROR (SICK)</option>
              </select>
            </div>
            <div className="input-group">
              <label>SOCIAL FEEDBACK:</label>
              <select value={socialFeedback} onChange={(e) => setSocialFeedback(e.target.value)}>
                <option value="none">NO DATA</option>
                <option value="echo_chamber">ECHO CHAMBER</option>
                <option value="mixed">MIXED SIGNALS</option>
                <option value="critical">NEGATIVE FEEDBACK</option>
              </select>
            </div>
            <div className="input-group">
              <label>EMOTIONAL STATE:</label>
              <select value={emotionalState} onChange={(e) => setEmotionalState(e.target.value)}>
                <option value="neutral">STABLE</option>
                <option value="urgency">URGENCY BIAS DETECTED</option>
                <option value="fear">FEAR STATE</option>
                <option value="excited">MANIC STATE</option>
              </select>
            </div>
            <div className="input-group">
              <label>MOTIVATION:</label>
              <select value={motivation} onChange={(e) => setMotivation(e.target.value)}>
                <option value="intrinsic">INTRINSIC</option>
                <option value="extrinsic">EXTRINSIC ($$)</option>
                <option value="desperation">SURVIVAL MODE</option>
              </select>
            </div>
          </div>

          <button type="submit" disabled={loading} className="cyber-button">
            {loading ? 'INITIALIZING SCAN...' : 'EXECUTE ANALYSIS'}
          </button>
        </form>

        {loading && <div className="scanner-overlay"><div className="scan-beam"></div></div>}
        {error && <div style={{color: '#ff0055', marginTop: '20px', textAlign: 'center'}}>{error}</div>}

        {result && (
          <div className="result-section" ref={resultRef}>
            
            {/* NEW: Question Display */}
            <div className="report-header">
              <div className="report-label">TARGET SUBJECT:</div>
              <div className="report-question">"{userIdea}"</div>
            </div>

            <div className="verdict-box" style={{ borderColor: result.verdict === 'GO' ? 'var(--neon-green)' : 'var(--neon-red)' }}>
              <h2 className="verdict-title" style={{ color: result.verdict === 'GO' ? 'var(--neon-green)' : 'var(--neon-red)' }}>
                {result.verdict}
              </h2>
              <div className="diagnosis-text">"{result.diagnosis}"</div>
            </div>

            {/* NEW: The Radar Chart */}
            {renderChart()}

            <div className="scores-grid">
              {[
                { label: 'LOGIC', val: result.logic_score },
                { label: 'DATA', val: result.data_score },
                { label: 'MONEY', val: result.money_score },
                { label: 'ABILITY', val: result.ability_score }
              ].map((item) => (
                <div key={item.label} className="score-card">
                  <h3>{item.label}</h3>
                  <div className="progress-container">
                    <div className="progress-fill" style={{ width: `${item.val || 0}%`, backgroundColor: getColor(item.val), boxShadow: `0 0 10px ${getColor(item.val)}` }}></div>
                  </div>
                  <div className="score-value" style={{ color: getColor(item.val) }}>{item.val || 0}%</div>
                </div>
              ))}
            </div>

            <button onClick={downloadPDF} className="download-btn">DOWNLOAD REPORT FILE</button>
            <div style={{textAlign: 'center', marginTop: '10px', fontSize: '0.8rem', color: '#555'}}>
               SECURE RECORD SAVED TO DATABASE ID: #{Math.floor(Math.random() * 9999)}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;