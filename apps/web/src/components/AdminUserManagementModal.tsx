import React, { useState, useEffect } from 'react';

interface AdminUserManagementModalProps {
  onClose: () => void;
}

export const AdminUserManagementModal: React.FC<AdminUserManagementModalProps> = ({ onClose }) => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New user form state
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<'ADMIN' | 'OPERATOR' | 'VIEWER'>('OPERATOR');
  const [createSubmitting, setCreateSubmitting] = useState(false);

  const fetchUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/users', {
        headers: { 'X-Thriveward-CSRF': '1' },
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to fetch users');
      }
      setUsers(data.users || []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);
    setCreateSubmitting(true);

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Thriveward-CSRF': '1',
        },
        credentials: 'same-origin',
        body: JSON.stringify({
          email: newEmail,
          displayName: newDisplayName,
          password: newPassword,
          role: newRole,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to create user');
      }

      setSuccessMsg(`✓ Successfully created user ${data.user.displayName} (${data.user.role})`);
      setNewEmail('');
      setNewDisplayName('');
      setNewPassword('');
      setShowCreateForm(false);
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setCreateSubmitting(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: string) => {
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/role`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Thriveward-CSRF': '1',
        },
        credentials: 'same-origin',
        body: JSON.stringify({ newRole }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update role');
      }
      setSuccessMsg(`✓ Role updated to ${newRole}`);
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleStateToggle = async (userId: string, currentState: string) => {
    setError(null);
    const newState = currentState === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    try {
      const res = await fetch(`/api/admin/users/${userId}/state`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'X-Thriveward-CSRF': '1',
        },
        credentials: 'same-origin',
        body: JSON.stringify({ newState }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to update user status');
      }
      setSuccessMsg(`✓ User status set to ${newState}`);
      fetchUsers();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleRevokeSessions = async (userId: string) => {
    if (!window.confirm('Revoke all active sessions for this user?')) return;
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/revoke-sessions`, {
        method: 'POST',
        headers: { 'X-Thriveward-CSRF': '1' },
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to revoke sessions');
      }
      setSuccessMsg(`✓ Revoked ${data.revokedCount} active sessions`);
    } catch (err: any) {
      setError(err.message);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.85)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 10000,
      padding: '1rem',
    }}>
      <div style={{
        backgroundColor: '#1e293b',
        borderRadius: '16px',
        border: '1px solid #334155',
        width: '100%',
        maxWidth: '840px',
        maxHeight: '90vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
        color: '#f8fafc',
      }}>
        {/* Header */}
        <div style={{
          padding: '1.5rem 2rem',
          borderBottom: '1px solid #334155',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
              User & Access Administration (ADMIN)
            </h2>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#94a3b8' }}>
              Provision users, enforce RBAC roles, and manage active session revocation.
            </p>
          </div>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: '1.5rem', cursor: 'pointer' }}
          >
            ×
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem 2rem', overflowY: 'auto', flex: 1 }}>
          {error && (
            <div style={{
              backgroundColor: 'rgba(239, 68, 68, 0.15)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              color: '#fca5a5',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              marginBottom: '1rem',
              fontSize: '0.875rem',
            }}>
              ⚠️ {error}
            </div>
          )}

          {successMsg && (
            <div style={{
              backgroundColor: 'rgba(16, 185, 129, 0.15)',
              border: '1px solid rgba(16, 185, 129, 0.3)',
              color: '#6ee7b7',
              padding: '0.75rem 1rem',
              borderRadius: '8px',
              marginBottom: '1rem',
              fontSize: '0.875rem',
            }}>
              {successMsg}
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>
              Internal Users ({users.length})
            </h3>
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              style={{
                backgroundColor: showCreateForm ? '#334155' : '#0284c7',
                color: '#ffffff',
                border: 'none',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                fontWeight: 600,
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              {showCreateForm ? 'Cancel' : '+ Provision New User'}
            </button>
          </div>

          {/* Provision Form */}
          {showCreateForm && (
            <form onSubmit={handleCreateUser} style={{
              backgroundColor: '#0f172a',
              border: '1px solid #334155',
              borderRadius: '12px',
              padding: '1.25rem',
              marginBottom: '1.5rem',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '1rem',
            }}>
              <div>
                <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.8125rem', color: '#cbd5e1' }}>
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="name@projectthriveward.org"
                  style={{
                    width: '100%',
                    padding: '0.625rem',
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#ffffff',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.8125rem', color: '#cbd5e1' }}>
                  Display Name
                </label>
                <input
                  type="text"
                  required
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  placeholder="Full Name (Role)"
                  style={{
                    width: '100%',
                    padding: '0.625rem',
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#ffffff',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.8125rem', color: '#cbd5e1' }}>
                  Initial Password (min 12 chars)
                </label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="••••••••••••"
                  style={{
                    width: '100%',
                    padding: '0.625rem',
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#ffffff',
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.8125rem', color: '#cbd5e1' }}>
                  Role Assignment
                </label>
                <select
                  value={newRole}
                  onChange={(e) => setNewRole(e.target.value as any)}
                  style={{
                    width: '100%',
                    padding: '0.625rem',
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '6px',
                    color: '#ffffff',
                    boxSizing: 'border-box',
                  }}
                >
                  <option value="OPERATOR">OPERATOR (Read/Write Operations)</option>
                  <option value="VIEWER">VIEWER (Read-Only Application Access)</option>
                  <option value="ADMIN">ADMIN (Full Admin & User Management)</option>
                </select>
              </div>

              <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end' }}>
                <button
                  type="submit"
                  disabled={createSubmitting}
                  style={{
                    padding: '0.625rem 1.25rem',
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: 600,
                    cursor: createSubmitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {createSubmitting ? 'Creating User...' : 'Provision User Account'}
                </button>
              </div>
            </form>
          )}

          {/* User List Table */}
          {loading ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: '#94a3b8' }}>Loading users...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #334155', textAlign: 'left', color: '#94a3b8' }}>
                  <th style={{ padding: '0.75rem' }}>User</th>
                  <th style={{ padding: '0.75rem' }}>Role</th>
                  <th style={{ padding: '0.75rem' }}>State</th>
                  <th style={{ padding: '0.75rem' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} style={{ borderBottom: '1px solid #1e293b' }}>
                    <td style={{ padding: '0.75rem' }}>
                      <div style={{ fontWeight: 600 }}>{u.displayName}</div>
                      <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>{u.email}</div>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        style={{
                          backgroundColor: '#0f172a',
                          border: '1px solid #334155',
                          color: '#ffffff',
                          padding: '0.25rem 0.5rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          fontWeight: 600,
                        }}
                      >
                        <option value="ADMIN">ADMIN</option>
                        <option value="OPERATOR">OPERATOR</option>
                        <option value="VIEWER">VIEWER</option>
                      </select>
                    </td>
                    <td style={{ padding: '0.75rem' }}>
                      <span style={{
                        padding: '0.125rem 0.5rem',
                        borderRadius: '12px',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        backgroundColor: u.accountState === 'ACTIVE' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        color: u.accountState === 'ACTIVE' ? '#6ee7b7' : '#fca5a5',
                      }}>
                        {u.accountState}
                      </span>
                    </td>
                    <td style={{ padding: '0.75rem', display: 'flex', gap: '0.5rem' }}>
                      <button
                        onClick={() => handleStateToggle(u.id, u.accountState)}
                        style={{
                          backgroundColor: '#334155',
                          color: '#ffffff',
                          border: 'none',
                          padding: '0.25rem 0.625rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        {u.accountState === 'ACTIVE' ? 'Disable' : 'Enable'}
                      </button>
                      <button
                        onClick={() => handleRevokeSessions(u.id)}
                        style={{
                          backgroundColor: 'rgba(239, 68, 68, 0.15)',
                          color: '#fca5a5',
                          border: '1px solid rgba(239, 68, 68, 0.3)',
                          padding: '0.25rem 0.625rem',
                          borderRadius: '6px',
                          fontSize: '0.75rem',
                          cursor: 'pointer',
                        }}
                      >
                        Revoke Sessions
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
