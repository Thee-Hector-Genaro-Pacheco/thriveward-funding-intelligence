import { useEffect, useState } from 'react';
import { BRIDGE_FORWARD_PROFILE } from '@bridge-ai/shared';

interface SystemHealth {
  apiStatus: string;
  pythonAgentStatus: string;
  dbStatus: string;
  lastChecked: string;
}

export default function App() {
  const [health, setHealth] = useState<SystemHealth>({
    apiStatus: 'CHECKING',
    pythonAgentStatus: 'CHECKING',
    dbStatus: 'CONFIGURED',
    lastChecked: new Date().toLocaleTimeString(),
  });

  useEffect(() => {
    async function checkHealth() {
      try {
        const res = await fetch('http://localhost:4000/health');
        if (res.ok) {
          const data = await res.json();
          setHealth({
            apiStatus: data.status || 'UP',
            pythonAgentStatus: data.integrations?.fundingAgent?.status || 'UNKNOWN',
            dbStatus: data.integrations?.database?.status || 'CONFIGURED',
            lastChecked: new Date().toLocaleTimeString(),
          });
        } else {
          setHealth((prev) => ({ ...prev, apiStatus: 'OFFLINE' }));
        }
      } catch {
        setHealth((prev) => ({ ...prev, apiStatus: 'STANDBY (API Offline)' }));
      }
    }

    checkHealth();
    const interval = setInterval(checkHealth, 10000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="container">
      {/* Header */}
      <header>
        <div className="header-badge">Phase 0 • Foundation Active</div>
        <h1 className="brand-title">Bridge AI</h1>
        <p className="brand-subtitle">
          Funding Intelligence for Bridge Forward Foundation
        </p>
      </header>

      {/* Core Principle Banner */}
      <div className="principle-banner">
        <div className="principle-title">
          <span>🛡️</span> PRODUCT PRINCIPLE: Human-Led, AI-Enabled
        </div>
        <p className="principle-text">
          AI assists authorized humans with research, extraction, organization, and drafting. AI must <strong>never</strong> autonomously submit grant applications, fabricate organizational facts, fabricate citations, represent uncertain eligibility as confirmed, or make final organizational decisions. Every conclusion is subject to human review.
        </p>
      </div>

      {/* System Health Grid */}
      <div className="grid-3">
        <div className="card">
          <div className="section-title">
            <span
              className={`status-indicator ${
                health.apiStatus === 'UP' ? 'status-active' : 'status-warning'
              }`}
            ></span>
            Node.js REST API
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Port 4000 • Express + TypeScript
          </p>
          <div style={{ marginTop: '0.75rem' }}>
            <span className="badge badge-blue">{health.apiStatus}</span>
          </div>
        </div>

        <div className="card">
          <div className="section-title">
            <span
              className={`status-indicator ${
                health.pythonAgentStatus.includes('UP') ? 'status-active' : 'status-warning'
              }`}
            ></span>
            Python Funding Agent
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Port 8000 • FastAPI / Python Service
          </p>
          <div style={{ marginTop: '0.75rem' }}>
            <span className="badge badge-purple">{health.pythonAgentStatus}</span>
          </div>
        </div>

        <div className="card">
          <div className="section-title">
            <span className="status-indicator status-active"></span>
            Database Engine
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            Port 5432 • PostgreSQL + Prisma Schema
          </p>
          <div style={{ marginTop: '0.75rem' }}>
            <span className="badge badge-amber">{health.dbStatus}</span>
          </div>
        </div>
      </div>

      {/* Main Content Split */}
      <div className="grid-2">
        {/* Profile Card */}
        <div className="card">
          <h2 className="section-title">🏢 Ground-Truth Organization Profile</h2>
          <p style={{ color: '#e2e8f0', fontWeight: 600, fontSize: '1.05rem' }}>
            {BRIDGE_FORWARD_PROFILE.name}
          </p>
          <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem', marginBottom: '1rem' }}>
            <span className="badge badge-rose">{BRIDGE_FORWARD_PROFILE.status}</span>
            <span className="badge badge-amber">501(c)(3) {BRIDGE_FORWARD_PROFILE.taxStatus}</span>
          </div>

          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
            <strong>Primary Outcome:</strong> {BRIDGE_FORWARD_PROFILE.primaryOutcome}
          </p>

          <h3 style={{ fontSize: '0.95rem', color: '#cbd5e1', marginTop: '1rem' }}>
            Program Pillars & Core Pathways
          </h3>
          <div className="pill-list">
            {BRIDGE_FORWARD_PROFILE.programs.map((prog, idx) => (
              <span
                key={idx}
                className="pill"
                style={{
                  borderLeft: prog.isOperational ? '3px solid #3b82f6' : '3px solid #64748b',
                }}
              >
                {prog.name} {!prog.isOperational && '(Planned)'}
              </span>
            ))}
          </div>

          <h3 style={{ fontSize: '0.95rem', color: '#f87171', marginTop: '1.25rem' }}>
            Honest Constraint Enforcement Rules
          </h3>
          <ul style={{ paddingLeft: '1.2rem', marginTop: '0.5rem', fontSize: '0.85rem', color: '#94a3b8' }}>
            {BRIDGE_FORWARD_PROFILE.knownLimitations.map((lim, idx) => (
              <li key={idx} style={{ marginBottom: '0.3rem' }}>{lim}</li>
            ))}
          </ul>
        </div>

        {/* Fit Engine & Schema Visualizer */}
        <div className="card">
          <h2 className="section-title">📊 Bridge Fit Scoring Engine</h2>
          <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Transparent 0–100 scoring across 12 dimensions. Disqualifying eligibility failures override fit scores to yield <code>NOT ELIGIBLE</code> status.
          </p>

          <h3 style={{ fontSize: '0.95rem', color: '#cbd5e1', marginBottom: '0.5rem' }}>
            Classification Status Taxonomy
          </h3>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1.25rem' }}>
            <span className="badge badge-blue">HIGH PRIORITY</span>
            <span className="badge badge-purple">INVESTIGATE</span>
            <span className="badge badge-amber">FUTURE OPPORTUNITY</span>
            <span className="badge badge-rose">NOT ELIGIBLE</span>
          </div>

          <h3 style={{ fontSize: '0.95rem', color: '#cbd5e1', marginBottom: '0.5rem' }}>
            Participant Support Allowability Matrix (15 Fields)
          </h3>
          <div className="pill-list">
            <span className="pill">Training Stipends</span>
            <span className="pill">Needs-Related Payments</span>
            <span className="pill">Transportation</span>
            <span className="pill">Meals</span>
            <span className="pill">Childcare</span>
            <span className="pill">Tools & PPE</span>
            <span className="pill">Work Clothing</span>
            <span className="pill">Laptops & Hardware</span>
            <span className="pill">Training Equipment</span>
            <span className="pill">Certifications</span>
            <span className="pill">Paid Work Experience</span>
            <span className="pill">Subsidized Employment</span>
            <span className="pill">OJT</span>
            <span className="pill">Emergency Assistance</span>
          </div>

          <h3 style={{ fontSize: '0.95rem', color: '#cbd5e1', marginTop: '1.25rem', marginBottom: '0.5rem' }}>
            Controls to Code Technical Identity Focus
          </h3>
          <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            PLC Fundamentals • Ladder Logic • Sensors & Transmitters • 4–20 mA • Industrial Automation • HMI/SCADA • Raspberry Pi • Physical Computing • Python • IoT • Databases • Cloud & Edge AI
          </p>
        </div>
      </div>

      {/* Footer */}
      <footer>
        <p>Bridge AI Foundation Platform • Phase 0 Production Foundation • Bridge Forward Foundation</p>
      </footer>
    </div>
  );
}
