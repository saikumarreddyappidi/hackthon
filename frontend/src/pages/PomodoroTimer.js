import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '../AuthContext';
import { LS_POMODORO_SESSIONS } from '../config';

const DURATION_OPTIONS = [15, 25, 30, 45, 50];
const SHORT_BREAK = 5;
const LONG_BREAK = 15;

function playBell() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    gain.gain.setValueAtTime(0.5, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 1.5);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 1.5);
  } catch (e) {
    console.warn('Web Audio not available:', e);
  }
}

function sendNotification(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification(title, { body, icon: '🍅' });
  }
}

function requestNotificationPermission() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function SvgRing({ seconds, totalSeconds, mode }) {
  const size = 220;
  const stroke = 14;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const progress = totalSeconds > 0 ? seconds / totalSeconds : 1;
  const offset = circ * (1 - progress);
  const color = mode === 'focus' ? '#059669' : '#f59e0b';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;

  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e5e7eb" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color}
          strokeWidth={stroke} strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.4s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center'
      }}>
        <div style={{ fontSize: 48, fontWeight: 800, color: '#064e3b', letterSpacing: -2 }}>
          {String(mins).padStart(2, '0')}:{String(secs).padStart(2, '0')}
        </div>
        <div style={{ fontSize: 14, color: 'var(--text-muted)', marginTop: 4 }}>
          {mode === 'focus' ? '🍅 Focus Time' : '☕ Break Time'}
        </div>
      </div>
    </div>
  );
}

export default function PomodoroTimer() {
  const { user } = useAuth();
  const [focusDuration, setFocusDuration] = useState(25);
  const [mode, setMode] = useState('focus'); // 'focus' | 'short_break' | 'long_break'
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [sessionCount, setSessionCount] = useState(0);
  const [task, setTask] = useState('');
  const [subject, setSubject] = useState('');
  const [sessions, setSessions] = useState([]);

  const intervalRef = useRef(null);
  const totalSeconds = useRef(focusDuration * 60);

  const subjects = user?.subjects ? user.subjects.split(',').map(s => s.trim()).filter(Boolean) : [];

  // Load from localStorage
  useEffect(() => {
    requestNotificationPermission();
    const raw = JSON.parse(localStorage.getItem(LS_POMODORO_SESSIONS) || '[]');
    setSessions(raw);
  }, []);

  const getModeSeconds = useCallback((m, fd) => {
    if (m === 'focus') return fd * 60;
    if (m === 'short_break') return SHORT_BREAK * 60;
    return LONG_BREAK * 60;
  }, []);

  const saveSession = useCallback((completed) => {
    if (mode !== 'focus') return;
    const entry = {
      date: new Date().toLocaleDateString(),
      subject: subject || 'General',
      task: task || 'Study session',
      duration_minutes: focusDuration,
      completed,
      timestamp: new Date().toISOString(),
    };
    setSessions(prev => {
      const next = [entry, ...prev];
      localStorage.setItem(LS_POMODORO_SESSIONS, JSON.stringify(next));
      return next;
    });
  }, [mode, subject, task, focusDuration]);

  const switchMode = useCallback((nextMode, fd) => {
    setMode(nextMode);
    const secs = getModeSeconds(nextMode, fd || focusDuration);
    totalSeconds.current = secs;
    setSecondsLeft(secs);
    setIsRunning(false);
  }, [focusDuration, getModeSeconds]);

  // Tick
  useEffect(() => {
    if (!isRunning) { clearInterval(intervalRef.current); return; }
    intervalRef.current = setInterval(() => {
      setSecondsLeft(s => {
        if (s <= 1) {
          clearInterval(intervalRef.current);
          playBell();
          if (mode === 'focus') {
            const newCount = sessionCount + 1;
            setSessionCount(newCount);
            saveSession(true);
            sendNotification('Focus session complete! 🎉', 'Time for a break.');
            const nextMode = newCount % 4 === 0 ? 'long_break' : 'short_break';
            switchMode(nextMode);
          } else {
            sendNotification('Break time over! 🍅', 'Ready to focus?');
            switchMode('focus');
          }
          return 0;
        }
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(intervalRef.current);
  }, [isRunning, mode, sessionCount, saveSession, switchMode]);

  const handleStart = () => setIsRunning(true);
  const handlePause = () => { setIsRunning(false); saveSession(false); };
  const handleReset = () => { setIsRunning(false); const secs = getModeSeconds(mode, focusDuration); totalSeconds.current = secs; setSecondsLeft(secs); };

  const handleDurationChange = (d) => {
    if (isRunning) return;
    setFocusDuration(d);
    if (mode === 'focus') { totalSeconds.current = d * 60; setSecondsLeft(d * 60); }
  };

  // Stats
  const today = new Date().toLocaleDateString();
  const todaySessions = sessions.filter(s => s.date === today && s.completed);
  const todayMinutes = todaySessions.reduce((a, s) => a + s.duration_minutes, 0);
  const allDays = [...new Set(sessions.filter(s => s.completed).map(s => s.date))];
  const streak = (() => {
    let s = 0;
    let d = new Date();
    while (true) {
      const key = d.toLocaleDateString();
      if (allDays.includes(key)) { s++; d.setDate(d.getDate() - 1); }
      else break;
    }
    return s;
  })();

  return (
    <div>
      <div className="page-header">
        <h1>⏱️ Focus Timer</h1>
        <p>Use the Pomodoro technique to stay focused. Sessions auto-save to your study log.</p>
      </div>

      <div className="grid-2" style={{ alignItems: 'start', gap: 24 }}>
        {/* Timer card */}
        <div className="card" style={{ textAlign: 'center' }}>
          {/* Duration picker */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
            {DURATION_OPTIONS.map(d => (
              <button key={d} onClick={() => handleDurationChange(d)} style={{
                padding: '6px 14px', borderRadius: 20, border: `2px solid ${focusDuration === d ? '#059669' : '#d1fae5'}`,
                background: focusDuration === d ? '#d1fae5' : '#fff', color: focusDuration === d ? '#059669' : '#6b7280',
                fontWeight: 700, fontSize: 13, cursor: isRunning ? 'not-allowed' : 'pointer', fontFamily: 'inherit'
              }}>{d} min</button>
            ))}
          </div>

          {/* SVG Ring */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <SvgRing seconds={secondsLeft} totalSeconds={totalSeconds.current} mode={mode} />
          </div>

          {/* Mode tabs */}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 20 }}>
            {[['focus','🍅 Focus'],['short_break','☕ Short Break'],['long_break','🛌 Long Break']].map(([m, lbl]) => (
              <button key={m} onClick={() => { if (!isRunning) switchMode(m); }} style={{
                padding: '6px 14px', borderRadius: 20,
                border: `2px solid ${mode === m ? '#059669' : '#d1fae5'}`,
                background: mode === m ? '#d1fae5' : '#fff',
                color: mode === m ? '#059669' : '#6b7280',
                fontWeight: 600, fontSize: 12, cursor: isRunning ? 'not-allowed' : 'pointer', fontFamily: 'inherit'
              }}>{lbl}</button>
            ))}
          </div>

          {/* Session counter */}
          <div style={{ marginBottom: 16, color: 'var(--text-muted)', fontSize: 14 }}>
            Session {sessionCount + 1} of {Math.ceil(sessionCount / 4) * 4 + 4}
          </div>

          {/* Task input */}
          <div style={{ marginBottom: 12, textAlign: 'left' }}>
            <label className="form-label">What are you studying?</label>
            <input className="form-control" value={task}
              onChange={e => setTask(e.target.value)} placeholder="e.g. Chapter 4 — Thermodynamics" />
          </div>
          {subjects.length > 0 && (
            <div style={{ marginBottom: 20, textAlign: 'left' }}>
              <label className="form-label">Subject</label>
              <select className="form-control" value={subject} onChange={e => setSubject(e.target.value)}>
                <option value="">— Select subject —</option>
                {subjects.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          )}

          {/* Controls */}
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center' }}>
            {!isRunning
              ? <button className="btn btn-primary btn-lg" onClick={handleStart}>▶ Start</button>
              : <button className="btn btn-secondary btn-lg" onClick={handlePause}>⏸ Pause</button>}
            <button className="btn btn-outline btn-lg" onClick={handleReset}>🔄 Reset</button>
          </div>
        </div>

        {/* Stats */}
        <div>
          <div className="grid-2" style={{ marginBottom: 16 }}>
            {[
              { icon: '🍅', label: "Today's Sessions", value: todaySessions.length },
              { icon: '⏱️', label: "Today's Focus", value: `${Math.floor(todayMinutes / 60)}h ${todayMinutes % 60}m` },
              { icon: '🔥', label: 'Current Streak', value: `${streak} days` },
              { icon: '🏆', label: 'All-time Sessions', value: sessions.filter(s => s.completed).length },
            ].map(s => (
              <div key={s.label} className="stat-card" style={{ marginBottom: 0 }}>
                <div className="stat-icon">{s.icon}</div>
                <div className="stat-label">{s.label}</div>
                <div className="stat-value">{s.value}</div>
              </div>
            ))}
          </div>

          {/* Recent sessions */}
          <div className="card">
            <div className="card-title">Recent Sessions</div>
            {sessions.length === 0
              ? <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No sessions yet. Start your first Pomodoro!</p>
              : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxHeight: 360, overflowY: 'auto' }}>
                  {sessions.slice(0, 20).map((s, i) => (
                    <div key={i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '10px 14px', borderRadius: 8,
                      background: s.completed ? '#f0fdf4' : '#fef3c7',
                      border: `1px solid ${s.completed ? '#6ee7b7' : '#fcd34d'}`
                    }}>
                      <div>
                        <div style={{ fontWeight: 600, fontSize: 13, color: '#064e3b' }}>{s.task}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.subject} · {s.date}</div>
                      </div>
                      <span className={`badge ${s.completed ? 'badge-success' : 'badge-warning'}`}>
                        {s.completed ? `${s.duration_minutes}m ✅` : 'Incomplete'}
                      </span>
                    </div>
                  ))}
                </div>
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
