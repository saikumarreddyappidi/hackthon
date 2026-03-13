import React, { useEffect, useState } from 'react';
import { RadialBarChart, RadialBar, Legend, ResponsiveContainer, Tooltip } from 'recharts';
import { useAuth } from '../AuthContext';
import API from '../api';

function ReadinessCard({ pred }) {
  const color = pred.readiness_score >= 70 ? 'var(--success)'
    : pred.readiness_score >= 45 ? 'var(--warning)'
    : 'var(--danger)';

  return (
    <div className="pred-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
        <div className="pred-subject">{pred.subject}</div>
        {pred.risk_alert && (
          <div className="badge badge-danger">⚠ At Risk</div>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 12 }}>
        <div className="pred-score" style={{ color }}>{pred.readiness_score}%</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', paddingBottom: 6 }}>readiness</div>
      </div>

      <div className="progress-bar" style={{ marginBottom: 12 }}>
        <div className="progress-fill" style={{ width: `${pred.readiness_score}%`, background: color }} />
      </div>

      <div style={{ background: 'var(--bg-card2)', borderRadius: 8, padding: '10px 14px', marginBottom: 10 }}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 2 }}>Predicted Grade</div>
        <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)' }}>{pred.grade_range}</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8 }}>
        <div style={{ background: 'var(--bg-card2)', borderRadius: 6, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>HOURS STUDIED</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{pred.total_hours}</div>
        </div>
        <div style={{ background: 'var(--bg-card2)', borderRadius: 6, padding: '8px 10px' }}>
          <div style={{ fontSize: 10, color: 'var(--text-muted)' }}>AVG FOCUS</div>
          <div style={{ fontSize: 16, fontWeight: 700 }}>{pred.avg_focus}/5</div>
        </div>
      </div>

      {pred.risk_alert && (
        <div className="risk-alert" style={{ marginTop: 12 }}>
          ⚠️ Readiness below 50% — increase study hours and focus for this subject!
        </div>
      )}
    </div>
  );
}

export default function Predictions() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    API.get(`/predict/${user.id}`)
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <div className="loading-screen"><div className="spinner" /><span>Running AI predictions...</span></div>;

  const preds = data?.predictions || [];
  const avgReadiness = preds.length > 0
    ? Math.round(preds.reduce((a, b) => a + b.readiness_score, 0) / preds.length)
    : 0;
  const atRisk = preds.filter(p => p.risk_alert).length;

  const chartData = preds.map(p => ({
    name: p.subject,
    readiness: p.readiness_score,
    fill: p.readiness_score >= 70 ? '#10b981' : p.readiness_score >= 45 ? '#f59e0b' : '#ef4444'
  }));

  return (
    <div>
      <div className="page-header">
        <h1>🤖 AI Predictions</h1>
        <p>Machine learning powered exam readiness analysis (Random Forest)</p>
      </div>

      {/* Summary */}
      <div className="grid-3" style={{ marginBottom: 28 }}>
        <div className="stat-card">
          <div className="stat-icon">🎯</div>
          <div className="stat-label">Overall Readiness</div>
          <div className="stat-value" style={{ color: avgReadiness >= 70 ? 'var(--success)' : avgReadiness >= 45 ? 'var(--warning)' : 'var(--danger)' }}>
            {avgReadiness}%
          </div>
          <div className="stat-sub">across all subjects</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">📅</div>
          <div className="stat-label">Days Until Exam</div>
          <div className="stat-value" style={{ color: (data?.days_until_exam || 30) < 7 ? 'var(--danger)' : 'var(--primary)' }}>
            {data?.days_until_exam || 'N/A'}
          </div>
          <div className="stat-sub">days remaining</div>
        </div>
        <div className="stat-card">
          <div className="stat-icon">⚠️</div>
          <div className="stat-label">At Risk Subjects</div>
          <div className="stat-value" style={{ color: atRisk > 0 ? 'var(--danger)' : 'var(--success)' }}>
            {atRisk}
          </div>
          <div className="stat-sub">need immediate attention</div>
        </div>
      </div>

      {preds.length === 0 ? (
        <div className="card" style={{ textAlign: 'center', padding: '48px 24px' }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🤖</div>
          <h3 style={{ marginBottom: 8 }}>No subjects configured</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>Add your subjects in Profile to see AI predictions.</p>
        </div>
      ) : (
        <>
          {/* Radial chart */}
          {chartData.length > 0 && (
            <div className="card" style={{ marginBottom: 24 }}>
              <div className="card-title">Readiness Overview</div>
              <ResponsiveContainer width="100%" height={280}>
                <RadialBarChart cx="50%" cy="50%" innerRadius="20%" outerRadius="90%"
                  data={chartData} startAngle={180} endAngle={0}>
                  <RadialBar minAngle={15} dataKey="readiness" label={{ fill: 'var(--text)', fontSize: 12 }} />
                  <Legend iconSize={10} formatter={(value, entry) => entry.payload.name} />
                  <Tooltip formatter={(v) => [`${v}%`, 'Readiness']} />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Per subject cards */}
          <div className="grid-3">
            {preds.map(pred => (
              <ReadinessCard key={pred.subject} pred={pred} />
            ))}
          </div>

          {/* Model info */}
          <div className="card" style={{ marginTop: 24 }}>
            <div className="card-title">🔬 About the ML Model</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginTop: 8 }}>
              {[
                ['Algorithm', 'Random Forest Regressor'],
                ['Features', 'Total hours, sessions/week, avg focus, days until exam, difficulty'],
                ['Output', 'Readiness score (0–100)'],
                ['Training Data', '2000 synthetic student records'],
              ].map(([label, val]) => (
                <div key={label} style={{ background: 'var(--bg-card2)', borderRadius: 8, padding: '12px 14px' }}>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 3 }}>{label}</div>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{val}</div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
