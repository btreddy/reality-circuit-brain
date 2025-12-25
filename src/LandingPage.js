import React from 'react';
import './Main.css';

function LandingPage({ onGetStarted, onLogin }) {
  return (
    <div className="landing-container">
      {/* HEADER */}
      <nav className="landing-nav">
        <div className="logo">REALITY CIRCUIT</div>
        <button className="login-link-btn" onClick={onLogin}>MEMBER LOGIN</button>
      </nav>

      {/* HERO SECTION */}
      <header className="hero-section">
        <h1 className="hero-title">
          <span className="neon-text">AI: IDEA BLOCK</span> <br />
          <span className="neon-flicker">GONE.</span>
        </h1>
        <p className="hero-subtitle">
          Generate breakthrough ideas in seconds. <br />
          The War Room for Entrepreneurs & Teams.
        </p>
        
        <div className="cta-wrapper">
          <button className="cta-btn primary" onClick={onGetStarted}>
            🚀 START 7-DAY FREE TRIAL
          </button>
          <p className="micro-copy">No credit card required. Instant Access.</p>
        </div>
      </header>

      {/* SOCIAL PROOF / FEATURES */}
      <section className="features-grid">
        <div className="feature-card">
          <h3>⚡ Speed</h3>
          <p>Turn 1 hour of brainstorming into 5 minutes of execution.</p>
        </div>
        <div className="feature-card">
          <h3>🧠 Collaboration</h3>
          <p>Invite your team. Analyze PDFs together. Crush goals.</p>
        </div>
        <div className="feature-card">
          <h3>🔒 Privacy</h3>
          <p>Your ideas are safe in your private encrypted War Room.</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="landing-footer">
        <p>© 2025 Reality Circuit. Operational.</p>
      </footer>
    </div>
  );
}

export default LandingPage;