import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import API from '../api';
import { useAuth } from '../AuthContext';
import { callClaude, LS_QUIZ_RESULTS, LS_POMODORO_SESSIONS, LS_STUDY_PLAN } from '../config';

// ─── Smart command definitions ───────────────────────────────────────────────
const SMART_COMMANDS = [
  { trigger: /^\/plan\b/i,   label: '/plan',   desc: 'Generate your AI study plan' },
  { trigger: /^\/quiz\b/i,   label: '/quiz',   desc: 'Show your quiz performance summary' },
  { trigger: /^\/timer\b/i,  label: '/timer',  desc: 'Go to Pomodoro Focus Timer' },
  { trigger: /^\/weak\b/i,   label: '/weak',   desc: 'Show your weak topics' },
  { trigger: /^\/report\b/i, label: '/report', desc: 'Download your PDF study report' },
];

function detectCommand(text) {
  for (const cmd of SMART_COMMANDS) {
    if (cmd.trigger.test(text.trim())) return cmd.label;
  }
  return null;
}

// ─── Smart card sub-components ───────────────────────────────────────────────
function PlanCard({ user }) {
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState(() => {
    try { return JSON.parse(localStorage.getItem(LS_STUDY_PLAN)); } catch { return null; }
  });

  const generate = async () => {
    setLoading(true);
    const quizResults = JSON.parse(localStorage.getItem(LS_QUIZ_RESULTS) || '[]');
    const payload = {
      studentName: user?.name || 'Student', examDate: user?.exam_date || 'unknown',
      subjects: [...new Set(quizResults.map(r => r.topic).filter(Boolean))].slice(0, 10)
    };
    try {
      const raw = await callClaude(
        `You are an AI academic coach. Return ONLY valid JSON with keys: study_plan (array of {day,date,daily_goal,sessions:[{topic,duration_minutes,activity,goal}],total_minutes}), recommendations ({immediate_focus:[string],study_tips:[string],motivational_message:string}), projected_readiness (number). No markdown.`,
        `Generate study plan for: ${JSON.stringify(payload)}`
      );
      const match = raw.match(/\{[\s\S]*\}/);
      const parsed = JSON.parse(match ? match[0] : raw);
      localStorage.setItem(LS_STUDY_PLAN, JSON.stringify(parsed));
      setPlan(parsed);
    } catch (e) { setPlan({ error: e.message }); }
    finally { setLoading(false); }
  };

  if (!plan) return (
    <div style={{ background: '#d1fae5', borderRadius: 10, padding: 14, marginTop: 10 }}>
      <p style={{ color: '#064e3b', fontWeight: 600, marginBottom: 8 }}>No study plan yet.</p>
      <button className="btn btn-primary" style={{ fontSize: 13 }} onClick={generate} disabled={loading}>
        {loading ? '⏳ Generating...' : '🤖 Generate Now'}
      </button>
    </div>
  );
  if (plan.error) return <div className="alert alert-danger" style={{ marginTop: 10, fontSize: 13 }}>Error: {plan.error}</div>;
  return (
    <div style={{ background: '#d1fae5', borderRadius: 10, padding: 14, marginTop: 10 }}>
      {plan.recommendations?.motivational_message && (
        <p style={{ color: '#064e3b', fontWeight: 600, marginBottom: 8 }}>💚 {plan.recommendations.motivational_message}</p>
      )}
      <p style={{ color: '#059669', fontSize: 13, marginBottom: 8 }}>Projected readiness: <strong>{plan.projected_readiness}%</strong></p>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <Link to="/learningmap" className="btn btn-primary" style={{ fontSize: 12, padding: '6px 12px' }}>View Full Plan →</Link>
        <button className="btn btn-secondary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={generate} disabled={loading}>
          {loading ? '⏳' : '🔄 Regenerate'}
        </button>
      </div>
    </div>
  );
}

function QuizSummaryCard() {
  const quizResults = JSON.parse(localStorage.getItem(LS_QUIZ_RESULTS) || '[]');
  if (!quizResults.length) return (
    <div style={{ background: '#f0fdf4', borderRadius: 10, padding: 12, marginTop: 10, color: '#6b7280', fontSize: 13 }}>
      No quiz results yet. Try <Link to="/studykit" style={{ color: '#059669' }}>Study Kit</Link>!
    </div>
  );
  const avg = Math.round(quizResults.reduce((s, r) => s + (r.accuracy || 0), 0) / quizResults.length);
  const byTopic = [...new Set(quizResults.map(r => r.topic).filter(Boolean))].map(t => {
    const rel = quizResults.filter(r => r.topic === t);
    return { topic: t, acc: Math.round(rel.reduce((s, r) => s + (r.accuracy || 0), 0) / rel.length) };
  }).sort((a, b) => a.acc - b.acc);

  return (
    <div style={{ background: '#f0fdf4', borderRadius: 10, padding: 14, marginTop: 10 }}>
      <p style={{ fontWeight: 700, color: '#064e3b', marginBottom: 10, fontSize: 14 }}>
        📊 {quizResults.length} attempts · avg {avg}%
      </p>
      {byTopic.slice(0, 5).map(t => (
        <div key={t.topic} style={{ marginBottom: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 3 }}>
            <span>{t.topic}</span>
            <span style={{ fontWeight: 700, color: t.acc >= 70 ? '#059669' : t.acc >= 50 ? '#d97706' : '#dc2626' }}>{t.acc}%</span>
          </div>
          <div className="progress-bar" style={{ height: 6 }}>
            <div className="progress-fill" style={{ width: `${t.acc}%`, background: t.acc >= 70 ? '#059669' : t.acc >= 50 ? '#f59e0b' : '#ef4444' }} />
          </div>
        </div>
      ))}
      <Link to="/learningmap" className="btn btn-secondary" style={{ marginTop: 8, fontSize: 12, padding: '6px 12px' }}>Learning Map →</Link>
    </div>
  );
}

function TimerCard() {
  const pom = JSON.parse(localStorage.getItem(LS_POMODORO_SESSIONS) || '[]');
  const today = new Date().toLocaleDateString();
  const todaySessions = pom.filter(s => s.date === today && s.completed);
  return (
    <div style={{ background: '#f0fdf4', borderRadius: 10, padding: 14, marginTop: 10 }}>
      <p style={{ fontWeight: 700, color: '#064e3b', marginBottom: 6, fontSize: 14 }}>
        ⏱️ Today: {todaySessions.length} sessions · {todaySessions.reduce((s, x) => s + x.duration_minutes, 0)} min
      </p>
      <Link to="/timer" className="btn btn-primary" style={{ fontSize: 12, padding: '6px 12px' }}>🍅 Open Timer</Link>
    </div>
  );
}

function WeakTopicsCard() {
  const quizResults = JSON.parse(localStorage.getItem(LS_QUIZ_RESULTS) || '[]');
  const weak = [...new Set(quizResults.map(r => r.topic).filter(Boolean))].filter(t => {
    const rel = quizResults.filter(r => r.topic === t);
    return rel.reduce((s, r) => s + (r.accuracy || 0), 0) / rel.length < 50;
  });
  if (!weak.length) return (
    <div style={{ background: '#d1fae5', borderRadius: 10, padding: 12, marginTop: 10, color: '#059669', fontWeight: 600, fontSize: 14 }}>
      🎉 No weak topics found!
    </div>
  );
  return (
    <div style={{ background: '#fee2e2', borderRadius: 10, padding: 14, marginTop: 10 }}>
      <p style={{ fontWeight: 700, color: '#7f1d1d', marginBottom: 8, fontSize: 14 }}>⚠️ Weak Topics ({weak.length})</p>
      {weak.map(t => <div key={t} style={{ color: '#dc2626', fontSize: 13, marginBottom: 4 }}>❌ {t}</div>)}
      <Link to="/studykit" className="btn btn-danger" style={{ marginTop: 8, fontSize: 12, padding: '6px 12px' }}>📚 Study These</Link>
    </div>
  );
}

function ReportCard({ user, analyticsData }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const download = async () => {
    setBusy(true); setErr('');
    try {
      const { exportReport } = await import('../utils/exportReport');
      exportReport(user, analyticsData);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  };
  return (
    <div style={{ background: '#f0fdf4', borderRadius: 10, padding: 14, marginTop: 10 }}>
      <p style={{ fontWeight: 700, color: '#064e3b', marginBottom: 6, fontSize: 14 }}>📄 Export Study Report</p>
      {err && <div className="alert alert-danger" style={{ marginBottom: 8, fontSize: 12 }}>{err}</div>}
      <button className="btn btn-primary" style={{ fontSize: 12, padding: '6px 12px' }} onClick={download} disabled={busy}>
        {busy ? '⏳ Generating...' : '📥 Download PDF'}
      </button>
    </div>
  );
}

function MessageBubble({ msg, user, analyticsData }) {
  const isUser = msg.role === 'user';
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start', marginBottom: 14 }}>
      {!isUser && (
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, marginRight: 10, flexShrink: 0 }}>🤖</div>
      )}
      <div style={{
        maxWidth: '80%', padding: '12px 16px',
        borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
        background: isUser ? 'linear-gradient(135deg,#059669,#10b981)' : '#f0fdf4',
        color: isUser ? '#fff' : '#064e3b', fontSize: 14, lineHeight: 1.6,
        boxShadow: '0 2px 8px rgba(5,150,105,0.1)',
      }}>
        <span style={{ whiteSpace: 'pre-wrap' }}>{msg.content}</span>
        {msg.smartCard === '/plan'   && <PlanCard user={user} />}
        {msg.smartCard === '/quiz'   && <QuizSummaryCard />}
        {msg.smartCard === '/timer'  && <TimerCard />}
        {msg.smartCard === '/weak'   && <WeakTopicsCard />}
        {msg.smartCard === '/report' && <ReportCard user={user} analyticsData={analyticsData} />}
      </div>
      {isUser && (
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, marginLeft: 10, flexShrink: 0 }}>👤</div>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function Chatbot() {
  const { user } = useAuth();
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState([
    { role: 'bot', content: `Hey ${user?.name?.split(' ')[0] || 'there'}! 👋 I'm your SmartStudy AI.\n\nTry a smart command:\n• /plan — AI study plan\n• /quiz — quiz performance\n• /timer — Pomodoro timer\n• /weak — weak topics\n• /report — PDF report\n\nOr just ask me any study question!` }
  ]);
  const [loading, setLoading] = useState(false);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [suggestions, setSuggestions] = useState([]);
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);

  const loadSuggestions = useCallback(async () => {
    if (!user) return;
    try {
      const response = await API.get(`/chatbot/${user.id}`);
      setSuggestions(response.data.suggested_questions || []);
      const ar = await API.get(`/analytics/${user.id}`);
      setAnalyticsData(ar.data);
    } catch {}
  }, [user]);

  useEffect(() => { loadSuggestions(); }, [loadSuggestions]);

  const sendMessage = useCallback(async (text) => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setMessages(prev => [...prev, { role: 'user', content: trimmed }]);
    setInput('');
    setLoading(true);

    const cmd = detectCommand(trimmed);
    if (cmd) {
      const labels = { '/plan': '🤖 Here\'s your study plan:', '/quiz': '📊 Your quiz performance:', '/timer': '⏱️ Your focus timer:', '/weak': '🔍 Weak topics analysis:', '/report': '📄 Export your report:' };
      setTimeout(() => {
        setMessages(prev => [...prev, { role: 'bot', content: labels[cmd] || 'Here you go!', smartCard: cmd }]);
        setLoading(false);
      }, 400);
      return;
    }

    try {
      const res = await API.get(`/chatbot/${user.id}`, { params: { question: trimmed } });
      setMessages(prev => [...prev, { role: 'bot', content: res.data.answer || 'No answer generated.' }]);
      setSuggestions(res.data.suggested_questions || suggestions);
    } catch {
      setMessages(prev => [...prev, { role: 'bot', content: 'I could not answer that right now. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  }, [user, suggestions]);

  const handleSubmit = (e) => { e.preventDefault(); sendMessage(input); };

  return (
    <div>
      <div className="page-header">
        <h1>💬 AI Chatbot</h1>
        <p>Ask questions or use smart commands: <span style={{ color: '#059669', fontWeight: 600 }}>/plan /quiz /timer /weak /report</span></p>
      </div>

      <div className="grid-2" style={{ alignItems: 'start' }}>
        {/* Chat window */}
        <div className="card" style={{ display: 'flex', flexDirection: 'column', height: 520 }}>
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
            {messages.map((m, i) => (
              <MessageBubble key={i} msg={m} user={user} analyticsData={analyticsData} />
            ))}
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-muted)', fontSize: 14, marginBottom: 14 }}>
                <span className="spinner" style={{ width: 18, height: 18, borderWidth: 2 }} />
                AI is thinking...
              </div>
            )}
            <div ref={bottomRef} />
          </div>
          <form onSubmit={handleSubmit} style={{ display: 'flex', gap: 10, marginTop: 14, borderTop: '1px solid #d1fae5', paddingTop: 14 }}>
            <input
              className="form-control"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="Ask a question or type /plan, /quiz, /timer, /weak, /report…"
              style={{ flex: 1 }}
            />
            <button className="btn btn-primary" type="submit" disabled={loading || !input.trim()}>Send</button>
          </form>
        </div>

        {/* Sidebar */}
        <div>
          <div className="card" style={{ marginBottom: 16 }}>
            <div className="card-title">⚡ Smart Commands</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {SMART_COMMANDS.map(cmd => (
                <button key={cmd.label} className="btn btn-outline" style={{ justifyContent: 'flex-start', textAlign: 'left' }}
                  onClick={() => sendMessage(cmd.label)}>
                  <strong style={{ color: '#059669', fontFamily: 'monospace' }}>{cmd.label}</strong>
                  <span style={{ color: '#6b7280', marginLeft: 8 }}>{cmd.desc}</span>
                </button>
              ))}
            </div>
          </div>
          {suggestions.length > 0 && (
            <div className="card">
              <div className="card-title">💡 Suggested Questions</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                {suggestions.map(s => (
                  <button key={s} className="btn btn-outline"
                    style={{ justifyContent: 'flex-start', textAlign: 'left', whiteSpace: 'normal', lineHeight: 1.4 }}
                    onClick={() => sendMessage(s)}>{s}</button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
