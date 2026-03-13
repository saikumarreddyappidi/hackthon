import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../AuthContext';
import FloatingBackground from '../components/FloatingBackground';
import PublicNavbar from '../components/PublicNavbar';

export default function Signup() {
  const { signup } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '', email: '', password: '',
    course: '', semester: ''
  });
  const [subjectRows, setSubjectRows] = useState([{ subject: '', exam_date: '' }]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleChange = e => setForm({ ...form, [e.target.name]: e.target.value });

  const handleSubjectRowChange = (index, field, value) => {
    setSubjectRows(prev => prev.map((row, rowIndex) => (
      rowIndex === index ? { ...row, [field]: value } : row
    )));
  };

  const addSubjectRow = () => {
    setSubjectRows(prev => [...prev, { subject: '', exam_date: '' }]);
  };

  const removeSubjectRow = (index) => {
    setSubjectRows(prev => prev.length === 1 ? prev : prev.filter((_, rowIndex) => rowIndex !== index));
  };

  const handleSubmit = async e => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const cleanedRows = subjectRows
        .map(row => ({
          subject: (row.subject || '').trim(),
          exam_date: row.exam_date || ''
        }))
        .filter(row => row.subject);

      if (cleanedRows.length === 0) {
        throw new Error('Please add at least one subject.');
      }

      const subjects = cleanedRows.map(row => row.subject).join(', ');
      const subjectExamDatesObject = {};
      cleanedRows.forEach(row => {
        if (row.exam_date) {
          subjectExamDatesObject[row.subject] = row.exam_date;
        }
      });

      const allDates = cleanedRows
        .map(row => row.exam_date)
        .filter(Boolean)
        .sort((first, second) => new Date(first) - new Date(second));

      const payload = {
        ...form,
        subjects,
        exam_date: allDates[0] || null,
        subject_exam_dates: JSON.stringify(subjectExamDatesObject)
      };

      await signup(payload);
      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || err.message || 'Signup failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="public-page auth-page">
      <FloatingBackground />
      <PublicNavbar />
      <div className="auth-wrapper page-fade">
        <div className="auth-card" style={{ maxWidth: 560 }}>
          <p className="hero-kicker" style={{ marginBottom: 10 }}>🌿 MLNeurothon-2K26</p>
          <div className="auth-logo">🎓</div>
          <h1>Create Account</h1>
          <p className="subtitle">Start tracking your study habits today</p>

          {error && <div className="alert alert-danger">⚠️ {error}</div>}

          <form onSubmit={handleSubmit}>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input className="form-control" name="name" value={form.name}
                onChange={handleChange} placeholder="John Doe" required />
            </div>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input className="form-control" type="email" name="email" value={form.email}
                onChange={handleChange} placeholder="you@example.com" required />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-control" type="password" name="password" value={form.password}
              onChange={handleChange} placeholder="Min 6 characters" required minLength={6} />
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
                <option value="">Select Semester</option>
                {[1,2,3,4,5,6,7,8].map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>

          <div className="form-group">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <label className="form-label" style={{ marginBottom: 0 }}>Subjects & Exam Dates</label>
              <button type="button" className="btn btn-outline" onClick={addSubjectRow} style={{ padding: '6px 12px', fontSize: 12 }}>
                + Add Subject
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {subjectRows.map((row, index) => (
                <div key={index} style={{ display: 'grid', gridTemplateColumns: '1fr 180px 60px', gap: 10 }}>
                  <input
                    className="form-control"
                    value={row.subject}
                    onChange={(event) => handleSubjectRowChange(index, 'subject', event.target.value)}
                    placeholder="Subject name (e.g. Maths)"
                  />
                  <input
                    className="form-control"
                    type="date"
                    value={row.exam_date}
                    onChange={(event) => handleSubjectRowChange(index, 'exam_date', event.target.value)}
                  />
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => removeSubjectRow(index)}
                    title="Remove subject"
                    style={{ padding: '10px 0' }}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6, display: 'block' }}>
              Add each subject with its own exam date.
            </span>
          </div>

            <button className="btn btn-primary btn-lg" style={{ width: '100%', justifyContent: 'center' }}
              type="submit" disabled={loading}>
              {loading ? '⏳ Creating account...' : '✨ Create Account'}
            </button>
          </form>

          <hr className="divider" />
          <p style={{ textAlign: 'center', fontSize: 14, color: 'var(--text-muted)', fontWeight: 300 }}>
            Already have an account?{' '}
            <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 600 }}>Login</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
