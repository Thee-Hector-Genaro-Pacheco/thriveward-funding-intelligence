import React from 'react';

interface UserHeaderBadgeProps {
  user: {
    id: string;
    email: string;
    displayName: string;
    role: 'ADMIN' | 'OPERATOR' | 'VIEWER';
  };
  onLogout: () => void;
  onChangePassword: () => void;
  onOpenAdminUsers?: () => void;
}

export const UserHeaderBadge: React.FC<UserHeaderBadgeProps> = ({
  user,
  onLogout,
  onChangePassword,
  onOpenAdminUsers,
}) => {
  const getRoleBadgeStyle = (role: string) => {
    switch (role) {
      case 'ADMIN':
        return { bg: '#7c3aed', color: '#ffffff', border: '#8b5cf6' };
      case 'OPERATOR':
        return { bg: '#0284c7', color: '#ffffff', border: '#0369a1' };
      case 'VIEWER':
      default:
        return { bg: '#475569', color: '#ffffff', border: '#64748b' };
    }
  };

  const roleStyle = getRoleBadgeStyle(user.role);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: '0.875rem',
      backgroundColor: '#1e293b',
      border: '1px solid #334155',
      borderRadius: '24px',
      padding: '0.375rem 0.5rem 0.375rem 1rem',
      fontSize: '0.875rem',
      color: '#f8fafc',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.625rem' }}>
        <div style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          backgroundColor: '#334155',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          fontSize: '0.75rem',
          color: '#38bdf8',
        }}>
          {user.displayName.charAt(0).toUpperCase()}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontWeight: 600, fontSize: '0.875rem', lineHeight: '1.2' }}>
            {user.displayName}
          </span>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: '1.2' }}>
            {user.email}
          </span>
        </div>

        <span style={{
          padding: '0.125rem 0.625rem',
          borderRadius: '12px',
          backgroundColor: roleStyle.bg,
          color: roleStyle.color,
          fontSize: '0.6875rem',
          fontWeight: 700,
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
        }}>
          {user.role}
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem', borderLeft: '1px solid #334155', paddingLeft: '0.5rem' }}>
        {user.role === 'ADMIN' && onOpenAdminUsers && (
          <button
            onClick={onOpenAdminUsers}
            title="User Management"
            style={{
              background: 'none',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              padding: '0.375rem 0.625rem',
              borderRadius: '6px',
              fontWeight: 500,
            }}
          >
            👥 Users
          </button>
        )}

        <button
          onClick={onChangePassword}
          title="Change Password"
          style={{
            background: 'none',
            border: 'none',
            color: '#94a3b8',
            cursor: 'pointer',
            fontSize: '0.8125rem',
            padding: '0.375rem 0.625rem',
            borderRadius: '6px',
            fontWeight: 500,
          }}
        >
          🔑 Password
        </button>

        <button
          onClick={onLogout}
          title="Sign Out"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#fca5a5',
            cursor: 'pointer',
            fontSize: '0.8125rem',
            padding: '0.375rem 0.625rem',
            borderRadius: '6px',
            fontWeight: 600,
          }}
        >
          Logout
        </button>
      </div>
    </div>
  );
};
