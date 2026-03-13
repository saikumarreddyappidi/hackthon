import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ResponsiveContainer, RadialBarChart, RadialBar, Tooltip } from 'recharts';
import { useAuth } from '../AuthContext';
import API from '../api';
import { exportReport } from '../utils/exportReport';

function Countdown({ examDate }) {
  const [time, setTime] = useState({});

  useEffect(() => {
    const calc = () => {
      if (!examDate) return setTime({});
      const diff = new Date(examDate) - new Date();
      if (diff <= 0) return setTime({ expired: true });
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const secs = Math.floor((diff % (1000 * 60)) / 1000);
      setTime({ days, hours, mins, secs });
    };
    calc();
    const t = setInterval(calc, 1000);
    return () => clearInterval(t);
  }, [examDate]);

  if (!examDate) return <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>No exam date set — <Link to="/profile" style={{ color: 'var(--primary)' }}>add one</Link></div>;
  if (time.expired) return <div className="badge badge-danger">Exam date passed</div>;

  return (
    <div className="countdown-wrapper">
      {[['days', time.days], ['hours', time.hours], ['mins', time.mins], ['secs', time.secs]].map(([label, val]) => (
        <div key={label} className="countdown-box">
          <div className="countdown-num">{String(val ?? 0).padStart(2, '0')}</div>
          <div className="countdown-label">{label}</div>
        </div>
      ))}
    </div>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [analytics, setAnalytics] = useState(null);
  const [predictions, setPredictions] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      API.get(`/analytics/${user.id}`),
      API.get(`/predict/${user.id}`)
    ]).then(([aRes, pRes]) => {
      setAnalytics(aRes.data);
      setPredictions(pRes.data);
    }).catch(console.error).finally(() => setLoading(false));
  }, [user]);

  const subjects = user?.subjects ? user.subjects.split(',').map(s => s.trim()).filter(Boolean) : [];

  const getReadiness = (subj) => {
    if (!predictions) return 0;
    const p = predictions.predictions.find(x => x.subject.toLowerCase() === subj.toLowerCase());
    return p ? p.readiness_score : 0;
  };

  const readinessColor = (score) => {
    if (score > 75) return '#059669';
    if (score >= 50) return '#f59e0b';
    return 'var(--danger)';
  };

  return (
    <div>
      <div className="page-header">
        <h1>👋 Welcome back, {user?.name?.split(' ')[0]}! <span className="fire-pulse">🔥</span></h1>
        <p>Here's your study overview for today — {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        <button
          className="btn btn-secondary"
          style={{ marginTop: 12 }}
          onClick={() => exportReport(user, analytics)}
        >📄 Export Report</button>
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner" /><span>Loading dashboard...</span></div>
      ) : (
        <>
          {/* Stats row */}
          <div className="grid-4" style={{ marginBottom: 24 }}>
            <div className="stat-card">
              <div className="stat-icon">⏱️</div>
              <div className="stat-label">Today's Study</div>
              <div className="stat-value">{Math.round((analytics?.today_minutes || 0) / 60 * 10) / 10}<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-muted)' }}> hrs</span></div>
              <div className="stat-sub">{analytics?.today_minutes || 0} minutes</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">📚</div>
              <div className="stat-label">Total Hours</div>
              <div className="stat-value">{analytics?.total_hours || 0}<span style={{ fontSize: 14, fontWeight: 400, color: 'var(--text-muted)' }}> hrs</span></div>
              <div className="stat-sub">All time</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">✅</div>
              <div className="stat-label">Productive</div>
              <div className="stat-value" style={{ color: 'var(--success)' }}>{analytics?.productive_hours || 0}<span style={{ fontSize: 14, fontWeight: 400 }}> hrs</span></div>
              <div className="stat-sub">Focus ≥ 3, not late night</div>
            </div>
            <div className="stat-card">
              <div className="stat-icon">⚠️</div>
              <div className="stat-label">Unproductive</div>
              <div className="stat-value" style={{ color: 'var(--warning)' }}>{analytics?.unproductive_hours || 0}<span style={{ fontSize: 14, fontWeight: 400 }}> hrs</span></div>
              <div className="stat-sub">Night + low focus</div>
            </div>
          </div>

          <div className="grid-3" style={{ marginBottom: 24 }}>
            {/* Productivity Score */}
            <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
              <div className="card-title" style={{ alignSelf: 'flex-start' }}>Productivity Score</div>
              <div style={{ width: 140, height: 140 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <RadialBarChart
                    cx="50%"
                    cy="50%"
                    innerRadius="65%"
                    outerRadius="100%"
                    barSize={12}
                    data={[{ name: 'Score', value: analytics?.productivity_score || 0, fill: '#6366f1' }]}
                    startAngle={90}
                    endAngle={-270}
                  >
                    <defs>
                      <linearGradient id="gaugeGradient" x1="0" y1="0" x2="1" y2="1">
                        <stop offset="0%" stopColor="#059669" />
                        <stop offset="100%" stopColor="#34d399" />
                      </linearGradient>
                    </defs>
                    <RadialBar dataKey="value" cornerRadius={12} fill="url(#gaugeGradient)" background={{ fill: '#f1f5f9' }} />
                    <Tooltip />
                  </RadialBarChart>
                </ResponsiveContainer>
              </div>
              <div style={{ marginTop: -18, fontSize: 24, fontWeight: 700 }}>{analytics?.productivity_score || 0}</div>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Based on last 7 days</span>
            </div>

            {/* Exam countdown */}
            <div className="card">
              <div className="card-title">⏰ Exam Countdown</div>
              <Countdown examDate={user?.exam_date} />
              {user?.exam_date && (
                <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-muted)' }}>
                  Exam: {new Date(user.exam_date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              )}
            </div>

            {/* Quick actions */}
            <div className="card">
              <div className="card-title">Quick Actions</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <Link to="/log" className="btn btn-primary" style={{ justifyContent: 'center' }}>
                  📝 Log Study Session
                </Link>
                <Link to="/analytics" className="btn btn-secondary" style={{ justifyContent: 'center' }}>
                  📊 View Analytics
                </Link>
                <Link to="/predictions" className="btn btn-secondary" style={{ justifyContent: 'center' }}>
                  🤖 AI Predictions
                </Link>
              </div>
            </div>
          </div>

          {/* Subject readiness */}
          {subjects.length > 0 && (
            <div className="card">
              <div className="card-title">📈 Exam Readiness by Subject</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 8 }}>
                {subjects.map(subj => {
                  const score = getReadiness(subj);
                  return (
                    <div key={subj}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontSize: 14, fontWeight: 600 }}>{subj}</span>
                        <span style={{ fontSize: 14, fontWeight: 700, color: readinessColor(score) }}>{score}%</span>
                      </div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${score}%`, background: readinessColor(score) }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
