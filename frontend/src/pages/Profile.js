import React, { useState, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import API from '../api';

export default function Profile() {
  const { user, refreshUser } = useAuth();
  const [form, setForm] = useState({ name: '', course: '', semester: '', subjects: '', exam_date: '' });
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        course: user.course || '',
        semester: user.semester || '',
        subjects: user.subjects || '',
        exam_date: user.exam_date || '',
      });
      API.get(`/analytics/${user.id}`).then(r => setAnalytics(r.data)).catch(() => {});
    }
  }, [user]);

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setLoading(true);
    try {
      await API.put('/me', form);
      await refreshUser();
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to update profile.');
    } finally {
      setLoading(false);
    }
  };

  const totalHours = analytics?.total_hours || 0;
  const getBadge = (hours) => {
    if (hours >= 200) return { label: 'Study Legend 🏆', color: 'var(--warning)' };
    if (hours >= 100) return { label: 'Dedicated Scholar 🎓', color: 'var(--primary)' };
    if (hours >= 50) return { label: 'Hard Worker 💪', color: 'var(--success)' };
    if (hours >= 20) return { label: 'Rising Star ⭐', color: 'var(--secondary)' };
    return { label: 'Getting Started 🌱', color: 'var(--text-muted)' };
  };
  const badge = getBadge(totalHours);

  return (
    <div>
      <div className="page-header">
        <h1>👤 Profile</h1>
        <p>Manage your account details and study preferences</p>
      </div>

      <div className="grid-2">
        {/* Edit form */}
        <div className="card">
          <div className="card-title">Edit Profile</div>
          {success && <div className="alert alert-success">✅ Profile updated successfully!</div>}
          {error && <div className="alert alert-danger">⚠️ {error}</div>}

          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-control" name="name" value={form.name}
                onChange={handleChange} required />
            </div>

            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Course / Branch</label>
                <input className="form-control" name="course" value={form.course}
                  onChange={handleChange} placeholder="e.g. Computer Science" />
              </div>
              <div className="form-group">
                <label className="form-label">Semester</label>
                <select className="form-control" name="semester" value={form.semester} onChange={handleChange}>
                  <option value="">Select</option>
                  {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Subjects (comma-separated)</label>
              <input className="form-control" name="subjects" value={form.subjects}
                onChange={handleChange} placeholder="e.g. Maths, Physics, CN, OS" />
              <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, display: 'block' }}>
                These will be used for predictions and recommendations.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label">Exam Date</label>
              <input className="form-control" type="date" name="exam_date" value={form.exam_date}
                onChange={handleChange} />
            </div>

            <button className="btn btn-primary" type="submit" disabled={loading}
              style={{ width: '100%', justifyContent: 'center' }}>
              {loading ? '⏳ Saving...' : '💾 Save Changes'}
            </button>
          </form>
        </div>

        {/* Stats panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Account info */}
          <div className="card">
            <div className="card-title">Account Info</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: 'var(--text-muted)' }}>Email</span>
                <span style={{ fontWeight: 600 }}>{user?.email}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: 'var(--text-muted)' }}>Semester</span>
                <span style={{ fontWeight: 600 }}>{user?.semester || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                <span style={{ color: 'var(--text-muted)' }}>Course</span>
                <span style={{ fontWeight: 600 }}>{user?.course || '—'}</span>
              </div>
              {user?.exam_date && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14 }}>
                  <span style={{ color: 'var(--text-muted)' }}>Exam Date</span>
                  <span style={{ fontWeight: 600 }}>
                    {new Date(user.exam_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Badge */}
          <div className="card" style={{ textAlign: 'center', padding: 28 }}>
            <div style={{ fontSize: 48, marginBottom: 10 }}>🏅</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
              Study Badge
            </div>
            <div style={{ fontSize: 20, fontWeight: 800, color: badge.color, marginBottom: 8 }}>
              {badge.label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--primary)', marginBottom: 4 }}>
              {totalHours} hrs
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>total study hours</div>

            <div style={{ marginTop: 16 }}>
              <div className="progress-bar">
                <div className="progress-fill" style={{
                  width: `${Math.min((totalHours / 200) * 100, 100)}%`,
                  background: 'linear-gradient(90deg, var(--primary), var(--secondary))'
                }} />
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 5 }}>
                {Math.max(0, 200 - totalHours).toFixed(0)} hrs to Study Legend
              </div>
            </div>
          </div>

          {/* Subject list */}
          {user?.subjects && (
            <div className="card">
              <div className="card-title">My Subjects</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 10 }}>
                {user.subjects.split(',').map(s => s.trim()).filter(Boolean).map(s => (
                  <span key={s} className="badge badge-primary" style={{ fontSize: 13, padding: '5px 12px' }}>
                    📖 {s}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
