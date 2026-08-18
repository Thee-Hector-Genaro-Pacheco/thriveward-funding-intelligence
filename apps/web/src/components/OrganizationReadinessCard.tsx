import React, { useState, useEffect } from 'react';
import { MatchImpactPreviewModal, MatchImpactItem } from './MatchImpactPreviewModal';

interface OrganizationReadinessCardProps {
  currentUser: any;
  apiFetch: (url: string, options?: RequestInit) => Promise<Response>;
}

export const OrganizationReadinessCard: React.FC<OrganizationReadinessCardProps> = ({
  currentUser,
  apiFetch,
}) => {
  const [readiness, setReadiness] = useState<any>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Reconciliation Confirmation Modal State
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);
  const [inputEntityNumber, setInputEntityNumber] = useState<string>('');
  const [reconciling, setReconciling] = useState<boolean>(false);

  // Match Impact Preview Modal State
  const [showImpactModal, setShowImpactModal] = useState<boolean>(false);
  const [impactItems, setImpactItems] = useState<MatchImpactItem[]>([]);
  const [impactLoading, setImpactLoading] = useState<boolean>(false);
  const [impactError, setImpactError] = useState<string | null>(null);

  const isAdmin = currentUser?.role === 'ADMIN';

  const fetchReadiness = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch('/api/organization/readiness');
      if (res.ok) {
        const json = await res.json();
        setReadiness(json.data);
      } else {
        const json = await res.json();
        setError(json.error || 'Failed to load readiness status');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load readiness status');
    } finally {
      setLoading(false);
    }
  };

  const fetchMatchImpactPreview = async () => {
    setImpactLoading(true);
    setImpactError(null);
    try {
      const res = await apiFetch('/api/organization/match-impact-preview');
      if (res.ok) {
        const json = await res.json();
        setImpactItems(json.data?.previewResults || []);
      } else {
        const json = await res.json();
        setImpactError(json.error || 'Failed to load match impact preview');
      }
    } catch (err: any) {
      setImpactError(err.message || 'Failed to load match impact preview');
    } finally {
      setImpactLoading(false);
    }
  };

  useEffect(() => {
    fetchReadiness();
  }, []);

  const handleOpenImpactModal = () => {
    setShowImpactModal(true);
    fetchMatchImpactPreview();
  };

  const handleReconcileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;

    if (inputEntityNumber.trim().toUpperCase() !== 'B20260372748') {
      setError('Confirmation failed: You must enter the exact California entity number B20260372748.');
      return;
    }

    setReconciling(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const res = await apiFetch('/api/organization/reconcile-formation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ entityNumber: inputEntityNumber.trim() }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Reconciliation failed');
      }

      setSuccessMessage('✓ Project Thriveward formation evidence successfully reconciled. Entity status updated to INCORPORATED.');
      setShowConfirmModal(false);
      setInputEntityNumber('');
      await fetchReadiness();
    } catch (err: any) {
      setError(err.message || 'Reconciliation failed');
    } finally {
      setReconciling(false);
    }
  };

  const isIncorporated = readiness?.status === 'INCORPORATED' || readiness?.californiaIncorporation === 'VERIFIED';

  return (
    <div className="card" style={{ marginTop: '1.5rem', background: 'rgba(15, 23, 42, 0.85)', border: '1px solid var(--border-color)', borderRadius: '0.75rem', padding: '1.25rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem', marginBottom: '1rem' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ background: '#0284c7', color: '#e0f2fe', fontWeight: 800, fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '0.25rem', letterSpacing: '0.05em' }}>
              ORG-1 • FORMATION EVIDENCE & READINESS
            </span>
            <span style={{ background: isIncorporated ? '#15803d' : '#854d0e', color: isIncorporated ? '#bbf7d0' : '#fef08a', fontWeight: 700, fontSize: '0.7rem', padding: '0.15rem 0.4rem', borderRadius: '0.2rem' }}>
              Incorporation: {isIncorporated ? 'VERIFIED' : 'PRE_INCORPORATION'}
            </span>
          </div>
          <h3 style={{ fontSize: '1.15rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.35rem' }}>
            🏛️ Project Thriveward Organizational Readiness & Formation Profile
          </h3>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button
            onClick={handleOpenImpactModal}
            style={{
              background: '#334155',
              color: '#38bdf8',
              border: '1px solid #38bdf8',
              padding: '0.4rem 0.85rem',
              borderRadius: '0.375rem',
              fontWeight: 700,
              fontSize: '0.8rem',
              cursor: 'pointer',
            }}
          >
            📊 Match Impact Preview (14 Opps)
          </button>

          {isAdmin && (
            <button
              onClick={() => setShowConfirmModal(true)}
              style={{
                background: isIncorporated ? '#1e293b' : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#ffffff',
                border: isIncorporated ? '1px solid #38bdf8' : 'none',
                padding: '0.4rem 0.85rem',
                borderRadius: '0.375rem',
                fontWeight: 700,
                fontSize: '0.8rem',
                cursor: 'pointer',
              }}
            >
              {isIncorporated ? '✓ Formation Evidence Reconciled' : '🏛️ Reconcile Formation Evidence'}
            </button>
          )}
        </div>
      </div>

      {/* Notice Box */}
      <div style={{ padding: '0.75rem 1rem', background: 'rgba(30, 41, 59, 0.7)', border: '1px solid rgba(56, 189, 248, 0.25)', borderRadius: '0.5rem', marginBottom: '1.25rem', fontSize: '0.82rem', color: '#94a3b8', lineHeight: 1.5 }}>
        ℹ️ <strong>Legal Readiness Notice:</strong> California incorporation has been verified. Incorporation does not establish federal 501(c)(3) status, California tax exemption, SAM.gov registration, or direct eligibility for every funding opportunity.
      </div>

      {error && (
        <div style={{ padding: '0.75rem', marginBottom: '1rem', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '0.375rem', color: '#fca5a5', fontSize: '0.85rem' }}>
          ❌ {error}
        </div>
      )}

      {successMessage && (
        <div style={{ padding: '0.75rem', marginBottom: '1rem', background: 'rgba(34,197,94,0.15)', border: '1px solid rgba(34,197,94,0.3)', borderRadius: '0.375rem', color: '#86efac', fontSize: '0.85rem' }}>
          {successMessage}
        </div>
      )}

      {/* Grid Status Summary */}
      {loading ? (
        <div style={{ padding: '1.5rem', textAlign: 'center', color: '#94a3b8', fontSize: '0.85rem' }}>Loading readiness profile...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
          <div style={{ background: '#1e293b', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>California Incorporation</div>
            <div style={{ fontSize: '1rem', fontWeight: 800, color: isIncorporated ? '#86efac' : '#fef08a', marginTop: '0.2rem' }}>
              {isIncorporated ? 'VERIFIED' : 'PRE_INCORPORATION'}
            </div>
            {isIncorporated && (
              <div style={{ fontSize: '0.7rem', color: '#cbd5e1', marginTop: '0.25rem', fontFamily: 'monospace' }}>
                CA Entity #: B20260372748
              </div>
            )}
          </div>

          <div style={{ background: '#1e293b', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Entity Type</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#f8fafc', marginTop: '0.2rem' }}>
              {readiness?.entityType || 'Nonprofit Public Benefit Corporation'}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#cbd5e1', marginTop: '0.25rem' }}>
              Jurisdiction: California
            </div>
          </div>

          <div style={{ background: '#1e293b', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>IRS 501(c)(3) Status</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#cbd5e1', marginTop: '0.2rem' }}>
              NOT VERIFIED
            </div>
            <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '0.25rem' }}>
              Tax Status: NOT_OBTAINED
            </div>
          </div>

          <div style={{ background: '#1e293b', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>California FTB Exemption</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#cbd5e1', marginTop: '0.2rem' }}>
              NOT VERIFIED
            </div>
          </div>

          <div style={{ background: '#1e293b', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>IRS EIN</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#cbd5e1', marginTop: '0.2rem' }}>
              NOT OBTAINED
            </div>
          </div>

          <div style={{ background: '#1e293b', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Initial SI-100 Filing</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#cbd5e1', marginTop: '0.2rem' }}>
              NOT FILED
            </div>
          </div>

          <div style={{ background: '#1e293b', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>SAM.gov / UEI</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#cbd5e1', marginTop: '0.2rem' }}>
              NOT REGISTERED
            </div>
          </div>

          <div style={{ background: '#1e293b', padding: '0.75rem 1rem', borderRadius: '0.5rem', border: '1px solid var(--border-color)' }}>
            <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Grants.gov Organization</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 700, color: '#cbd5e1', marginTop: '0.2rem' }}>
              NOT REGISTERED
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal */}
      {showConfirmModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(4px)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1200, padding: '1rem' }}>
          <div style={{ background: '#0f172a', border: '1px solid #38bdf8', borderRadius: '0.75rem', maxWidth: '550px', width: '100%', padding: '1.5rem', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5)' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700, color: '#f8fafc', marginBottom: '0.75rem' }}>
              🏛️ Confirm Formation Evidence Reconciliation
            </h3>

            <p style={{ fontSize: '0.85rem', color: '#cbd5e1', lineHeight: 1.5, marginBottom: '1rem' }}>
              Reconciling official California Secretary of State formation evidence updates Project Thriveward's profile to <code style={{ color: '#34d399' }}>INCORPORATED</code>.
            </p>

            <form onSubmit={handleReconcileSubmit}>
              <div style={{ marginBottom: '1.25rem' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', color: '#94a3b8', marginBottom: '0.4rem' }}>
                  Enter exact California Entity Number to confirm (<code>B20260372748</code>):
                </label>
                <input
                  type="text"
                  placeholder="B20260372748"
                  value={inputEntityNumber}
                  onChange={(e) => setInputEntityNumber(e.target.value)}
                  required
                  style={{
                    width: '100%',
                    background: '#0f172a',
                    color: '#f8fafc',
                    border: '1px solid var(--border-color)',
                    padding: '0.5rem',
                    borderRadius: '0.375rem',
                    fontSize: '0.85rem',
                    fontFamily: 'monospace',
                  }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button
                  type="button"
                  onClick={() => setShowConfirmModal(false)}
                  disabled={reconciling}
                  style={{ background: '#334155', color: '#f8fafc', border: 'none', padding: '0.5rem 1rem', borderRadius: '0.375rem', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={reconciling || inputEntityNumber.trim().toUpperCase() !== 'B20260372748'}
                  style={{
                    background: (reconciling || inputEntityNumber.trim().toUpperCase() !== 'B20260372748') ? '#475569' : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                    color: '#ffffff',
                    border: 'none',
                    padding: '0.5rem 1.25rem',
                    borderRadius: '0.375rem',
                    fontWeight: 700,
                    fontSize: '0.85rem',
                    cursor: (reconciling || inputEntityNumber.trim().toUpperCase() !== 'B20260372748') ? 'not-allowed' : 'pointer',
                  }}
                >
                  {reconciling ? '⏳ Reconciling...' : '🚀 Reconcile Formation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Match Impact Modal */}
      <MatchImpactPreviewModal
        isOpen={showImpactModal}
        onClose={() => setShowImpactModal(false)}
        items={impactItems}
        loading={impactLoading}
        error={impactError}
      />
    </div>
  );
};
