import React from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';

const navItems = [
  { to: '/dashboard',      icon: '🏠', label: 'Dashboard' },
  { to: '/log',            icon: '📝', label: 'Log Session' },
  { to: '/heatmap',        icon: '🔥', label: 'Study Heatmap' },
  { to: '/analytics',      icon: '📊', label: 'Analytics' },
  { to: '/predictions',    icon: '🤖', label: 'AI Predictions' },
  { to: '/chatbot',        icon: '💬', label: 'AI Chatbot' },
  { to: '/recommendations',icon: '💡', label: 'Recommendations' },
  { to: '/studykit',       icon: '📚', label: 'Study Kit Generator' },
  { to: '/learningmap',    icon: '🗺️', label: 'Learning Map' },
  { to: '/timer',          icon: '⏱️', label: 'Focus Timer' },
  { to: '/profile',        icon: '👤', label: 'Profile' },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <aside className="sidebar">
      <div className="sidebar-logo">
        <h2>📚 Study<br />Analyzer <span className="bell-shake">🔔</span></h2>
        <span>Smart Habit Tracker</span>
      </div>

      {user && (
        <div style={{ padding: '0 24px 16px', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Logged in as</div>
          <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {user.name}
          </div>
          {user.semester && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Sem {user.semester} · {user.course || 'Student'}</div>
          )}
        </div>
      )}

      <nav className="sidebar-nav">
        {navItems.map(item => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/dashboard'}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <span className="icon">{item.icon}</span>
            {item.label}
          </NavLink>
        ))}

        <button type="button" className="nav-item nav-item-logout" onClick={handleLogout}>
          <span className="icon">🚪</span>
          Logout
        </button>
      </nav>

      <button type="button" className="logout-btn" onClick={handleLogout}>
        <span>🚪</span> Logout
      </button>
    </aside>
  );
}
