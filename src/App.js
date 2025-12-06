import React, { useState, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import './Main.css'; 

// 🚀 STANDALONE MODE: If running as EXE, this usually points to localhost
// If you are testing the EXE, ensure app.py is running on port 5000
//const API_URL = "http://127.0.0.1:5000"; 
const API_URL = "https://reality-circuit-brain.onrender.com";

// --- RADAR CHART COMPONENT ---
const RadarChart = ({ data }) => {
  const stats = [
    { label: "LOGIC", value: data.logic_score || 0 },
    { label: "DATA", value: data.data_score || 0 },
    { label: "MONEY", value: data.financial_score || 0 },
    { label: "EMOTION", value: 100 - (data.emotion_score || 0) } 
  ];

  const size = 250;
  const center = size / 2;
  const radius = 90;
  
  const getPoint = (i, value) => {
    const angle = (Math.PI * 2 * i) / 4 - Math.PI / 2;
    const valueR = (value / 100) * radius;
    const x = center + valueR * Math.cos(angle);
    const y = center + valueR * Math.sin(angle);
    return { x, y };
  };

  const polygonPoints = stats.map((stat, i) => {
    const { x, y } = getPoint(i, stat.value);
    return `${x},${y}`;
  }).join(" ");

  const diamondPoints = stats.map((_, i) => {
    const { x, y } = getPoint(i, 100); 
    return `${x},${y}`;
  }).join(" ");

  return (
    <div style={{ width: size, height: size, margin: '0 auto', position: 'relative' }}>
      <svg width={size} height={size} style={{ overflow: 'visible' }}>
        <polygon points={diamondPoints} fill="none" stroke="#333" strokeWidth="1" />
        <polygon points={polygonPoints} fill="rgba(10, 255, 10, 0.2)" stroke="#0aff0a" strokeWidth="2" />
        {stats.map((stat, i) => {
           const { x, y } = getPoint(i, stat.value);
           return <circle key={i} cx={x} cy={y} r="3" fill="#0aff0a" />
        })}
        {/* Adjusted X positions to prevent PDF text cutoff */}
        <text x="50%" y="15" textAnchor="middle" fill="#0aff0a" fontSize="12" fontWeight="bold">LOGIC</text>
        <text x="85%" y="50%" textAnchor="start" fill="#0acaff" fontSize="12" fontWeight="bold">DATA</text>
        <text x="50%" y="98%" textAnchor="middle" fill="#ffd700" fontSize="12" fontWeight="bold">MONEY</text>
        <text x="15%" y="50%" textAnchor="end" fill="#ff2a2a" fontSize="12" fontWeight="bold">STABILITY</text>
      </svg>
    </div>
  );
};

export default function App() {
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  
  // Reference for the section we want to print
  const printRef = useRef(); 
  
  const [formData, setFormData] = useState({
    user_idea: '', physical_state: '', social_feedback: '', emotional_state: '', motivation: ''
  });

  const questions = [
    { text: "STEP 1: ENTER BUSINESS IDEA / DECISION", type: "text_input", field: "user_idea", placeholder: "e.g. Open a Coffee Shop..." },
    { text: "STEP 2: BIOLOGICAL STATUS", options: [{ label: "Fresh/Focused", value: "good" }, { label: "Tired/Hungry", value: "tired" }], field: "physical_state" },
    { text: "STEP 3: EXTERNAL FEEDBACK", options: [{ label: "Critics Exist", value: "present" }, { label: "Echo Chamber", value: "none" }], field: "social_feedback" },
    { text: "STEP 4: PRIMARY DRIVER", options: [{ label: "Long-term Value", value: "intrinsic" }, { label: "Quick Money/Hype", value: "extrinsic" }], field: "motivation" },
    { text: "STEP 5: URGENCY LEVEL", options: [{ label: "Can Wait", value: "calm" }, { label: "Now or Never", value: "urgency" }], field: "emotional_state" }
  ];

  const handleAnswer = (field, value) => {
    const updatedData = { ...formData, [field]: value };
    setFormData(updatedData);
    if (step < questions.length - 1) setStep(step + 1);
    else submitData(updatedData);
  };

  const submitData = async (data) => {
    setLoading(true);
    try {
      // NOTE: Ensure your python app.py serves /calculate
      const response = await fetch(`${API_URL}/calculate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      const resultData = await response.json();
      if (resultData.verdict === "ERROR") {
         alert("AI Analysis Failed. Please try again.");
         setLoading(false);
         return;
      }
      setResult(resultData);
    } catch (error) {
      console.error(error);
      alert("System Offline. If running EXE, wait 10s for server boot.");
    }
    setLoading(false);
  };

  // --- PDF DOWNLOAD FUNCTION ---
  const downloadReport = async () => {
    const element = printRef.current;
    if(!element) return;

    // 1. Capture the visual element
    const canvas = await html2canvas(element, {
        backgroundColor: "#050505", // Keep the dark theme
        scale: 2 // High resolution
    });

    // 2. Convert to PDF
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    
    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`Reality_Check_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  // --- RESULT SCREEN ---
  if (result) {
    const { analysis, human_score } = result;
    let verdictColor = '#ffd700'; 
    if(analysis.verdict === 'GO') verdictColor = '#0aff0a'; 
    if(analysis.verdict === 'NO-GO') verdictColor = '#ff2a2a'; 

    return (
      <div className="scanner-frame" style={{textAlign: 'center'}}>
        
        {/* THIS SECTION WILL BE PRINTED */}
        <div ref={printRef} style={{padding: '20px', background: '#050505'}}> 
            <div className="scan-line"></div>
            
            {/* --- NEW: IDEA ON TOP --- */}
            <div style={{borderBottom: '1px dashed #333', paddingBottom: '15px', marginBottom: '20px'}}>
                <p style={{color: '#555', fontSize: '0.8rem', margin: 0}}>TARGET SUBJECT:</p>
                <h2 style={{color: '#fff', margin: '5px 0', fontSize: '1.2rem', textTransform: 'none', border: 'none'}}>
                    "{formData.user_idea}"
                </h2>
            </div>

            <h1 style={{ color: verdictColor, fontSize: '2.5rem', margin: '10px 0' }}>
            VERDICT: {analysis.verdict}
            </h1>

            <div style={{ margin: '30px 0' }}>
                <RadarChart data={analysis} />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-around', borderBottom: '1px dashed #333', paddingBottom: '20px' }}>
                <div>
                    <div style={{ fontSize: '2rem', color: '#0aff0a' }}>{human_score}</div>
                    <div style={{ fontSize: '0.8rem', color: '#555' }}>OPERATOR SCORE</div>
                </div>
                <div>
                    <div style={{ fontSize: '2rem', color: '#ffd700' }}>{analysis.financial_score}</div>
                    <div style={{ fontSize: '0.8rem', color: '#555' }}>PROFIT SCORE</div>
                </div>
            </div>

            <div className="result-box" style={{ textAlign: 'left', marginTop: '20px' }}>
                <h3 style={{ color: '#0acaff', borderBottom: '1px solid #0acaff' }}>🧬 DIAGNOSIS</h3>
                <p style={{ fontSize: '1.1rem' }}>{analysis.diagnosis}</p>
                
                <h3 style={{ color: '#ffd700', borderBottom: '1px solid #ffd700', marginTop: '20px' }}>💰 MONEY MOVES</h3>
                <ul style={{ paddingLeft: '20px', lineHeight: '1.6' }}>
                    {analysis.financial_advice && analysis.financial_advice.map((tip, i) => (
                    <li key={i} style={{ marginBottom: '10px' }}>{tip}</li>
                    ))}
                </ul>
            </div>
        </div>

        {/* BUTTONS (These won't be in the PDF) */}
        <div style={{display: 'flex', gap: '10px', marginTop: '20px'}}>
            <button className="neon-btn" onClick={downloadReport} style={{borderColor: '#ffd700', color: '#ffd700'}}>
            📥 SAVE REPORT PDF
            </button>
            <button className="neon-btn" onClick={() => window.location.reload()}>
            NEW SCAN
            </button>
        </div>
      </div>
    );
  }

  // ... (Question UI remains the same) ...
  const currentQ = questions[step];
  return (
    <div className="scanner-frame">
      <div className="scan-line"></div>
      <h2>{currentQ.text}</h2>
      {loading ? <p className="blink">ANALYZING FINANCIAL VECTORS...</p> : 
        currentQ.type === 'text_input' ? (
          <form onSubmit={(e) => { e.preventDefault(); if(formData.user_idea) handleAnswer('user_idea', formData.user_idea); }}>
            <input autoFocus type="text" onChange={(e) => setFormData({...formData, user_idea: e.target.value})} placeholder={currentQ.placeholder} />
            <button className="neon-btn">ENTER >></button>
          </form>
        ) : (
          <div>{currentQ.options.map(opt => <button key={opt.value} onClick={() => handleAnswer(currentQ.field, opt.value)} className="neon-btn">{opt.label}</button>)}</div>
        )
      }
    </div>
  );
}