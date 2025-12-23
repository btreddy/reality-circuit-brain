import React from 'react';
import './Main.css';

function LandingPage({ onEnter }) {
  return (
    <div className="landing-container">
      {/* HERO SECTION */}
      <header className="landing-hero">
        <h1 className="glitch" data-text="REALITY CIRCUIT">REALITY CIRCUIT</h1>
        <p className="subtitle">INTELLIGENCE. ACCELERATED. SECURED.</p>
        <p className="hero-desc">
          We don't just write code. We partner with visionaries to turn 
          complex ideas into deployed software AI Care co-Pilot .
        </p>
        <button className="login-btn hero-btn" onClick={onEnter}>
          ENTER THE WAR ROOM &gt;&gt;
        </button>
      </header>

      {/* SERVICES SECTION */}
      <section className="services-grid">
        <div className="service-card">
          <h3>🧠 AI CONSULTING</h3>
          <p>Brainstorm strategies with our custom "War Room" AI. We analyze documents, assess risks, and generate roadmaps instantly.</p>
        </div>

        <div className="service-card">
          <h3>💻 CUSTOM S.A.A.S.</h3>
          <p>Need a secure app? We build full-stack solutions with authentication, device fingerprinting, and payment gates.</p>
        </div>

        <div className="service-card">
          <h3>🚀 RAPID DEPLOYMENT</h3>
          <p>From concept to cloud in record time. We use advanced AI coding agents to accelerate development cycles.</p>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="landing-footer">
        <p>HYDERABAD • TELANGANA • GLOBAL</p>
        <p className="contact-info">Partner with us: btr@safelandddeal.com</p>
      </footer>
    </div>
  );
}

export default LandingPage;