import React, { useState } from 'react';
import './Main.css';

function LandingPage({ onEnter }) {
  const [formData, setFormData] = useState({ name: '', email: '', message: '' });
  const [status, setStatus] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);

  const handleContact = async () => {
    if (!formData.name || !formData.email) {
      setStatus('⚠️ FIELDS REQUIRED');
      return;
    }
    setStatus('TRANSMITTING...');
    
    try {
      // FIX: Using relative path to prevent connection errors
      const res = await fetch('/api/contact', { 
        method: 'POST', 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      if (res.ok) {
        setStatus('✅ TRANSMISSION RECEIVED.');
        setFormData({ name: '', email: '', message: '' });
      } else {
        setStatus('❌ ERROR.');
      }
    } catch (e) {
      setStatus('❌ CONNECTION FAILED.');
    }
  };

  return (
    <div className="landing-container">
      
      {/* --- COMMAND STACK BUTTON --- */}
      <div className="command-stack">
        <div className={`stack-options ${menuOpen ? 'visible' : ''}`}>
          <a href="https://wa.me/919876543210" target="_blank" rel="noreferrer" className="stack-btn wa-btn">
            💬 <span className="tooltip">WHATSAPP</span>
          </a>
          <a href="tel:+919876543210" className="stack-btn call-btn">
            📞 <span className="tooltip">SECURE LINE</span>
          </a>
        </div>
        
        <button className={`stack-main-btn ${menuOpen ? 'active' : ''}`} onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? '✖' : '📡'} 
        </button>
      </div>

      <header className="landing-hero">
        <h1 className="glitch" data-text="REALITY CIRCUIT">REALITY CIRCUIT</h1>
        <p className="subtitle">INTELLIGENCE. ACCELERATED. SECURED.</p>
        <p className="hero-desc">
          We don't just write code. We partner with visionaries to turn 
          complex ideas into deployed software. AI Care Co-Pilot.
        </p>
        <button className="login-btn hero-btn" onClick={onEnter}>
          ENTER THE WAR ROOM &gt;&gt;
        </button>
      </header>

      <section className="services-grid">
        <div className="service-card"><h3>🧠 AI CONSULTING</h3><p>Brainstorm strategies with our custom "War Room" AI.</p></div>
        <div className="service-card"><h3>💻 CUSTOM S.A.A.S.</h3><p>Secure apps with device fingerprinting and payment gates.</p></div>
        <div className="service-card"><h3>🚀 RAPID DEPLOYMENT</h3><p>From concept to cloud in record time.</p></div>
      </section>

      <section className="contact-section">
        <h2>INITIATE PARTNERSHIP</h2>
        <div className="contact-form">
          <input type="text" placeholder="OPERATIVE NAME" value={formData.name} onChange={e=>setFormData({...formData, name: e.target.value})} />
          <input type="email" placeholder="CONTACT FREQUENCY (EMAIL)" value={formData.email} onChange={e=>setFormData({...formData, email: e.target.value})} />
          <textarea placeholder="MISSION BRIEFING (MESSAGE)" value={formData.message} onChange={e=>setFormData({...formData, message: e.target.value})} rows="4"></textarea>
          <button className="login-btn" onClick={handleContact}>TRANSMIT DATA</button>
          {status && <p className="status-msg">{status}</p>}
        </div>
      </section>

      <footer className="landing-footer">
        <p>HYDERABAD • TELANGANA • GLOBAL</p>
        <p className="contact-info">admin@careco-pilotai.com</p>
      </footer>
    </div>
  );
}

export default LandingPage;