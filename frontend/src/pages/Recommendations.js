import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import API from '../api';

const timeEmoji = { Morning: '🌅', Afternoon: '☀️', Night: '🌙', Evening: '🌆' };

export default function Recommendations() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    API.get(`/recommendations/${user.id}`)
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <div className="loading-screen"><div className="spinner" /><span>Generating recommendations...</span></div>;

  return (
    <div>
      <div className="page-header">
        <h1>💡 Personalized Recommendations</h1>
        <p>AI-generated study plan based on your patterns and weak areas</p>
      </div>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        {/* Best study time */}
        <div className="card">
          <div className="card-title">⏰ Best Study Time</div>
          <div style={{ display: 'flex', align: 'center', gap: 16, padding: '12px 0' }}>
            <div style={{ fontSize: 48 }}>{timeEmoji[data?.best_study_time] || '🌅'}</div>
            <div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{data?.best_study_time || 'Morning'}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 4 }}>
                Your highest focus sessions happen in the {data?.best_study_time}
              </div>
            </div>
          </div>
        </div>

        {/* Weak subjects */}
        <div className="card">
          <div className="card-title">⚠️ Subjects Needing Attention</div>
          {(data?.weak_subjects || []).length === 0 ? (
            <div style={{ color: 'var(--success)', fontSize: 14, padding: '12px 0' }}>
              ✅ All subjects are well balanced!
            </div>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
              {data.weak_subjects.map(s => (
                <span key={s} className="badge badge-warning" style={{ fontSize: 13, padding: '6px 12px' }}>
                  ⚠️ {s}
                </span>
              ))}
            </div>
          )}
          <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text-muted)' }}>
            These subjects have less study time than your average.
          </div>
        </div>
      </div>

      {/* Suggested Daily Schedule */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title">📅 Suggested Study Schedule for Tomorrow</div>
        {(data?.suggested_schedule || []).length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontSize: 14, padding: '16px 0' }}>
            Add subjects in your profile to get a personalized schedule.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {data.suggested_schedule.map((item, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 16,
                background: 'var(--bg-card2)', borderRadius: 10, padding: '14px 16px',
                borderLeft: `4px solid ${item.priority === 'High' ? 'var(--warning)' : 'var(--primary)'}`
              }}>
                <div style={{ fontSize: 24 }}>{timeEmoji[item.time_of_day] || '📖'}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 16 }}>{item.subject}</div>
                  <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
                    {item.time_of_day} · {item.suggested_hours} hours
                  </div>
                </div>
                <div>
                  <span className={`badge ${item.priority === 'High' ? 'badge-warning' : 'badge-primary'}`}>
                    {item.priority} Priority
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tips */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div className="card-title">💡 Study Tips Based on Your Patterns</div>
        <div style={{ marginTop: 12 }}>
          {(data?.tips || ['Keep up the great work! Consistency is key.']).map((tip, i) => (
            <div key={i} className="tip-card">
              <span style={{ fontSize: 20 }}>
                {i === 0 ? '🧠' : i === 1 ? '📌' : i === 2 ? '🌙' : '⏱️'}
              </span>
              <span>{tip}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Hours per subject insight */}
      {(data?.subject_hours || []).length > 0 && (
        <div className="card">
          <div className="card-title">📊 Time Invested per Subject</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
            {(() => {
              const maxH = Math.max(...data.subject_hours.map(s => s.hours), 1);
              return data.subject_hours.sort((a, b) => b.hours - a.hours).map(s => (
                <div key={s.subject}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontSize: 14, fontWeight: 600 }}>{s.subject}</span>
                    <span style={{ fontSize: 14, color: 'var(--primary)', fontWeight: 700 }}>{s.hours} hrs</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill" style={{
                      width: `${(s.hours / maxH) * 100}%`,
                      background: data.weak_subjects?.includes(s.subject) ? 'var(--warning)' : 'var(--primary)'
                    }} />
                  </div>
                </div>
              ));
            })()}
          </div>
        </div>
      )}
    </div>
  );
}
