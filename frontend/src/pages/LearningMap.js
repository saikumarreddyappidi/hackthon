import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../AuthContext';
import { callClaude, LS_QUIZ_RESULTS, LS_STUDY_PLAN } from '../config';

function computeMastery(quizResults, topic) {
  const topicResults = quizResults.filter(
    r => r.topic?.toLowerCase() === topic.toLowerCase()
  );
  if (!topicResults.length) return null;
  const quizAccuracy = topicResults.reduce((s, r) => s + (r.accuracy || 0), 0) / topicResults.length;
  const consistency = Math.min(topicResults.length * 10, 100);
  const mastery = Math.round(quizAccuracy * 0.5 + 0 * 0.3 + consistency * 0.2);
  return { mastery: Math.min(mastery, 100), quizAccuracy: Math.round(quizAccuracy), studyConsistency: consistency, lastStudied: topicResults[topicResults.length - 1]?.timestamp };
}

function statusInfo(mastery) {
  if (mastery >= 80) return { label: 'Strong ✅', color: '#059669', bg: '#d1fae5', border: '#6ee7b7' };
  if (mastery >= 50) return { label: 'Needs Review ⚠️', color: '#d97706', bg: '#fef3c7', border: '#fcd34d' };
  return { label: 'Weak ❌', color: '#dc2626', bg: '#fee2e2', border: '#fca5a5' };
}

const STUDY_PLAN_SYSTEM = `You are an AI academic coach. Analyze student performance and return ONLY a valid JSON object. No markdown, no extra text.

{
  "study_plan": [
    {
      "day": 1,
      "date": "string",
      "daily_goal": "string",
      "sessions": [
        { "topic": "string", "duration_minutes": 0, "activity": "string", "goal": "string" }
      ],
      "total_minutes": 0
    }
  ],
  "recommendations": {
    "immediate_focus": ["string"],
    "study_tips": ["string"],
    "motivational_message": "string"
  },
  "projected_readiness": 0
}

Rules:
- Max 240 minutes study per day
- Sessions between 20-60 minutes each
- Prioritize weak topics (score below 50) first
- Never repeat same topic twice in one day
- Cover every day until exam date
- Return ONLY the JSON`;

function CircularProgress({ value, size = 120, stroke = 10 }) {
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (value / 100) * circ;
  const color = value >= 80 ? '#059669' : value >= 50 ? '#f59e0b' : '#ef4444';
  return (
    <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color}
        strokeWidth={stroke} strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.8s ease' }}
      />
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="middle"
        style={{ fill: color, fontSize: size * 0.22, fontWeight: 800, transform: 'rotate(90deg)', transformOrigin: `${size/2}px ${size/2}px` }}>
        {value}%
      </text>
    </svg>
  );
}

export default function LearningMap() {
  const { user } = useAuth();
  const [topics, setTopics] = useState([]);
  const [expanded, setExpanded] = useState({});
  const [studyPlan, setStudyPlan] = useState(null);
  const [planLoading, setPlanLoading] = useState(false);
  const [planError, setPlanError] = useState('');
  const [expandedDay, setExpandedDay] = useState({});

  useEffect(() => {
    const raw = JSON.parse(localStorage.getItem(LS_QUIZ_RESULTS) || '[]');
    const allTopics = [...new Set(raw.map(r => r.topic).filter(Boolean))];
    const userSubjects = user?.subjects ? user.subjects.split(',').map(s => s.trim()).filter(Boolean) : [];
    const combined = [...new Set([...userSubjects, ...allTopics])];

    setTopics(combined.map(topic => {
      const m = computeMastery(raw, topic);
      return {
        topic,
        mastery: m?.mastery ?? 40,
        quizAccuracy: m?.quizAccuracy ?? 0,
        studyConsistency: m?.studyConsistency ?? 0,
        lastStudied: m?.lastStudied,
        hasData: !!m,
      };
    }));

    const saved = localStorage.getItem(LS_STUDY_PLAN);
    if (saved) { try { setStudyPlan(JSON.parse(saved)); } catch {} }
  }, [user]);

  const handleToggle = (topic) => setExpanded(p => ({ ...p, [topic]: !p[topic] }));

  const generatePlan = useCallback(async () => {
    setPlanError('');
    setPlanLoading(true);
    try {
      const payload = {
        studentName: user?.name || 'Student',
        examDate: user?.exam_date || 'unknown',
        subjects: topics.map(t => ({ topic: t.topic, mastery: t.mastery, quizAccuracy: t.quizAccuracy }))
      };
      const raw = await callClaude(
        STUDY_PLAN_SYSTEM,
        `Generate study plan for: ${JSON.stringify(payload)}`,
        2000,
        { responseFormat: 'json' }
      );
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
      setStudyPlan(parsed);
      localStorage.setItem(LS_STUDY_PLAN, JSON.stringify(parsed));
    } catch (err) {
      setPlanError(err.message || 'Failed to generate plan');
    } finally {
      setPlanLoading(false);
    }
  }, [topics, user]);

  const weakTopics = topics.filter(t => t.mastery < 50);
  const strongCount = topics.filter(t => t.mastery >= 80).length;
  const reviewCount = topics.filter(t => t.mastery >= 50 && t.mastery < 80).length;
  const overallReadiness = topics.length
    ? Math.round(topics.reduce((s, t) => s + t.mastery, 0) / topics.length)
    : 0;

  return (
    <div>
      <div className="page-header">
        <h1>🗺️ Learning Map</h1>
        <p>Visualise your mastery across all topics and detect weak areas before your exam.</p>
      </div>

      {/* Summary cards */}
      <div className="grid-4" style={{ marginBottom: 24 }}>
        {[
          { icon: '📚', label: 'Total Topics', value: topics.length },
          { icon: '✅', label: 'Strong', value: strongCount, color: '#059669' },
          { icon: '⚠️', label: 'Needs Review', value: reviewCount, color: '#d97706' },
          { icon: '❌', label: 'Weak', value: weakTopics.length, color: '#dc2626' },
        ].map(s => (
          <div key={s.label} className="stat-card">
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-label">{s.label}</div>
            <div className="stat-value" style={{ color: s.color || '#064e3b' }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Overall readiness */}
      <div className="card" style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 32, flexWrap: 'wrap' }}>
        <CircularProgress value={overallReadiness} size={130} />
        <div>
          <div className="card-title">Overall Readiness</div>
          <div style={{ fontSize: 28, fontWeight: 800, color: '#064e3b' }}>{overallReadiness}%</div>
          <p style={{ color: 'var(--text-muted)', fontSize: 14, marginTop: 6 }}>
            {overallReadiness >= 80 ? 'You\'re in great shape! 🚀' : overallReadiness >= 50 ? 'Good progress — keep going! 💪' : 'Focus on the weak topics below ⬇️'}
          </p>
        </div>
      </div>

      {/* Knowledge Map grid */}
      {topics.length > 0 ? (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-title">Knowledge Map</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 14, marginTop: 12 }}>
            {topics.map(t => {
              const s = statusInfo(t.mastery);
              return (
                <div key={t.topic} style={{
                  border: `2px solid ${s.border}`, borderRadius: 12, padding: 16,
                  background: expanded[t.topic] ? s.bg : '#fff', cursor: 'pointer',
                  transition: 'all 0.2s'
                }} onClick={() => handleToggle(t.topic)}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, fontSize: 14, color: '#064e3b' }}>{t.topic}</span>
                    <span className="badge" style={{ background: s.bg, color: s.color, fontSize: 11 }}>{s.label}</span>
                  </div>
                  <div className="progress-bar" style={{ marginBottom: 8 }}>
                    <div className="progress-fill" style={{ width: `${t.mastery}%`, background: s.color }} />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: s.color }}>{t.mastery}% mastery</div>
                  {expanded[t.topic] && (
                    <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${s.border}`, fontSize: 13, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Quiz Accuracy</span>
                        <span style={{ fontWeight: 600, color: '#064e3b' }}>{t.quizAccuracy}%</span>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span style={{ color: 'var(--text-muted)' }}>Study Consistency</span>
                        <span style={{ fontWeight: 600, color: '#064e3b' }}>{t.studyConsistency}%</span>
                      </div>
                      {t.lastStudied && (
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text-muted)' }}>Last Studied</span>
                          <span style={{ fontWeight: 600, color: '#064e3b' }}>
                            {new Date(t.lastStudied).toLocaleDateString()}
                          </span>
                        </div>
                      )}
                      {!t.hasData && <p style={{ color: 'var(--text-muted)', fontSize: 12, marginTop: 4 }}>No quiz data yet — take a quiz to update.</p>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="card" style={{ textAlign: 'center', padding: '32px', marginBottom: 24, color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📭</div>
          <p>No topics found. Take quizzes in Study Kit or add subjects in Profile.</p>
        </div>
      )}

      {/* Weak topic alerts */}
      {weakTopics.length > 0 && (
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-title" style={{ color: '#dc2626' }}>⚠️ Weak Topic Alerts</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 12 }}>
            {weakTopics.map(t => (
              <div key={t.topic} style={{
                background: '#fee2e2', border: '1px solid #fca5a5', borderRadius: 10,
                padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center'
              }}>
                <div>
                  <div style={{ fontWeight: 700, color: '#7f1d1d', fontSize: 15 }}>{t.topic}</div>
                  <div style={{ color: '#dc2626', fontSize: 13 }}>Mastery: {t.mastery}%</div>
                </div>
                <a href="/studykit" className="btn btn-danger" style={{ fontSize: 13, padding: '8px 14px' }}>
                  Start Reviewing →
                </a>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* AI Study Plan */}
      <div className="card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <div className="card-title">🤖 AI Study Plan</div>
          <button className="btn btn-primary" onClick={generatePlan} disabled={planLoading || topics.length === 0}>
            {planLoading
              ? <><span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Generating...</>
              : '🤖 Generate My Study Plan'}
          </button>
        </div>
        {planError && <div className="alert alert-danger">{planError}</div>}

        {studyPlan?.recommendations?.motivational_message && (
          <div style={{
            background: '#d1fae5', border: '1px solid #6ee7b7', borderRadius: 10,
            padding: '14px 18px', marginBottom: 16, fontSize: 15, color: '#064e3b', fontWeight: 600
          }}>
            💚 {studyPlan.recommendations.motivational_message}
          </div>
        )}

        {studyPlan?.projected_readiness !== undefined && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 20, flexWrap: 'wrap' }}>
            <CircularProgress value={studyPlan.projected_readiness} size={100} />
            <div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Projected Readiness</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#064e3b' }}>{studyPlan.projected_readiness}%</div>
            </div>
          </div>
        )}

        {studyPlan?.study_plan?.length > 0 && (
          <div>
            <div style={{ fontWeight: 700, color: '#064e3b', marginBottom: 10 }}>📅 Daily Plan</div>
            {studyPlan.study_plan.map((day) => (
              <div key={day.day} style={{
                border: '1px solid #d1fae5', borderRadius: 10, marginBottom: 8, overflow: 'hidden'
              }}>
                <button onClick={() => setExpandedDay(p => ({ ...p, [day.day]: !p[day.day] }))} style={{
                  width: '100%', textAlign: 'left', padding: '12px 16px', fontFamily: 'inherit',
                  background: expandedDay[day.day] ? '#d1fae5' : '#f0fdf4', border: 'none', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center'
                }}>
                  <span style={{ fontWeight: 700, color: '#064e3b' }}>Day {day.day} — {day.date}</span>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{day.total_minutes} min · {expandedDay[day.day] ? '▲' : '▼'}</span>
                </button>
                {expandedDay[day.day] && (
                  <div style={{ padding: '12px 16px' }}>
                    <p style={{ color: '#059669', fontWeight: 600, marginBottom: 12, fontSize: 14 }}>{day.daily_goal}</p>
                    <div style={{ position: 'relative', paddingLeft: 20 }}>
                      {day.sessions?.map((sess, i) => (
                        <div key={i} style={{
                          position: 'relative', paddingLeft: 24, paddingBottom: 16,
                          borderLeft: i < day.sessions.length - 1 ? '2px solid #6ee7b7' : 'none',
                        }}>
                          <div style={{
                            width: 10, height: 10, borderRadius: '50%', background: '#059669',
                            position: 'absolute', left: -6, top: 3
                          }} />
                          <div style={{ fontWeight: 700, color: '#064e3b', fontSize: 14 }}>{sess.topic}</div>
                          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{sess.activity} · {sess.duration_minutes} min</div>
                          <div style={{ fontSize: 12, color: '#059669' }}>{sess.goal}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
