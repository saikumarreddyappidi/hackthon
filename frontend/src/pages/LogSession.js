import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import API from '../api';

export default function LogSession() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const subjects = user?.subjects ? user.subjects.split(',').map(s => s.trim()).filter(Boolean) : [];

  const [form, setForm] = useState({
    subject: subjects[0] || '',
    hours: '',
    minutes: '',
    time_of_day: 'Morning',
    focus_level: 3,
    notes: ''
  });
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [customSubject, setCustomSubject] = useState(false);

  const setFocus = (level) => setForm({ ...form, focus_level: level });
  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const focusEmoji = ['😴', '😶', '🙂', '😊', '🔥'];
  const focusLabel = ['Very Low', 'Low', 'Moderate', 'Good', 'Excellent'];

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    const h = parseFloat(form.hours || 0);
    const m = parseFloat(form.minutes || 0);
    const total_minutes = h * 60 + m;
    if (total_minutes <= 0) return setError('Please enter a valid study duration.');

    setLoading(true);
    try {
      await API.post('/log-session', {
        subject: form.subject,
        duration_minutes: total_minutes,
        time_of_day: form.time_of_day,
        focus_level: form.focus_level,
        notes: form.notes || null
      });
      setSuccess(true);
      setTimeout(() => navigate('/'), 1500);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to save session.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>📝 Log Study Session</h1>
        <p>Record what you studied today to track your progress</p>
      </div>

      <div style={{ maxWidth: 580 }}>
        <div className="card">
          {success && <div className="alert alert-success">✅ Session saved! Redirecting to dashboard...</div>}
          {error && <div className="alert alert-danger">⚠️ {error}</div>}

          <form onSubmit={handleSubmit}>
            {/* Subject */}
            <div className="form-group">
              <label className="form-label">Subject</label>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <button type="button" className={`btn ${!customSubject ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: 12 }} onClick={() => setCustomSubject(false)}>
                  From my list
                </button>
                <button type="button" className={`btn ${customSubject ? 'btn-primary' : 'btn-secondary'}`}
                  style={{ fontSize: 12 }} onClick={() => setCustomSubject(true)}>
                  Custom
                </button>
              </div>
              {customSubject ? (
                <input className="form-control" name="subject" value={form.subject}
                  onChange={handleChange} placeholder="e.g. Data Structures" required />
              ) : (
                <select className="form-control" name="subject" value={form.subject} onChange={handleChange} required>
                  {subjects.length === 0 && <option value="">Add subjects in profile</option>}
                  {subjects.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              )}
            </div>

            {/* Duration */}
            <div className="form-group">
              <label className="form-label">Study Duration</label>
              <div style={{ display: 'flex', gap: 12 }}>
                <div style={{ flex: 1 }}>
                  <input className="form-control" type="number" name="hours" value={form.hours}
                    onChange={handleChange} placeholder="Hours" min="0" max="24" />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, display: 'block' }}>Hours</span>
                </div>
                <div style={{ flex: 1 }}>
                  <input className="form-control" type="number" name="minutes" value={form.minutes}
                    onChange={handleChange} placeholder="Minutes" min="0" max="59" />
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3, display: 'block' }}>Minutes</span>
                </div>
              </div>
            </div>

            {/* Time of day */}
            <div className="form-group">
              <label className="form-label">Time of Day</label>
              <div style={{ display: 'flex', gap: 10 }}>
                {['Morning', 'Afternoon', 'Night'].map(t => (
                  <button key={t} type="button"
                    className={`btn ${form.time_of_day === t ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1 }}
                    onClick={() => setForm({ ...form, time_of_day: t })}>
                    {t === 'Morning' ? '🌅' : t === 'Afternoon' ? '☀️' : '🌙'} {t}
                  </button>
                ))}
              </div>
            </div>

            {/* Focus level */}
            <div className="form-group">
              <label className="form-label">Focus Level — {focusLabel[form.focus_level - 1]} {focusEmoji[form.focus_level - 1]}</label>
              <div className="focus-stars">
                {[1, 2, 3, 4, 5].map(n => (
                  <button key={n} type="button"
                    className={`focus-star ${form.focus_level >= n ? 'active' : ''}`}
                    onClick={() => setFocus(n)}>
                    ⭐
                  </button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <div className="form-group">
              <label className="form-label">Notes (Optional)</label>
              <textarea className="form-control" name="notes" value={form.notes} onChange={handleChange}
                placeholder="What topics did you cover? Any difficulties?" rows={3} style={{ resize: 'vertical' }} />
            </div>

            <button className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }}
              type="submit" disabled={loading}>
              {loading ? '⏳ Saving...' : '💾 Save Session'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
