import React, { useEffect, useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell
} from 'recharts';
import { useAuth } from '../AuthContext';
import API from '../api';
import { exportReport } from '../utils/exportReport';

const COLORS = ['#059669', '#6366f1', '#f59e0b', '#10b981', '#6366f1', '#f59e0b'];

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div style={{ background: '#ffffff', border: '1px solid #d1fae5', borderRadius: 10, padding: '10px 14px', fontSize: 13, boxShadow: '0 4px 12px rgba(5,150,105,0.1)' }}>
        <div style={{ fontWeight: 600, marginBottom: 4 }}>{label}</div>
        {payload.map((p, i) => (
          <div key={i} style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' ? p.value.toFixed(2) : p.value}</div>
        ))}
      </div>
    );
  }
  return null;
};

export default function Analytics() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    API.get(`/analytics/${user.id}`)
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user]);

  if (loading) return <div className="loading-screen"><div className="spinner" /><span>Loading analytics...</span></div>;

  const totalTracked = (data?.productive_hours || 0) + (data?.unproductive_hours || 0);
  const productivePerc = totalTracked > 0 ? Math.round((data.productive_hours / totalTracked) * 100) : 0;

  return (
    <div>
      <div className="page-header">
        <h1>📊 Analytics</h1>
        <p>Deep insights into your study patterns and habits</p>
        <button className="btn btn-secondary" style={{ marginTop: 12 }} onClick={() => exportReport(user, data)}>📄 Export Report</button>
      </div>

      {/* Summary stats */}
      <div className="grid-4" style={{ marginBottom: 28 }}>
        <div className="stat-card">
          <div className="stat-label">Total Hours</div>
          <div className="stat-value" style={{ color: 'var(--primary)' }}>{data?.total_hours || 0}</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Today</div>
          <div className="stat-value">{Math.round((data?.today_minutes || 0) / 60 * 10) / 10}</div>
          <div className="stat-sub">hours</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Productivity</div>
          <div className="stat-value" style={{ color: productivePerc >= 70 ? 'var(--success)' : 'var(--warning)' }}>
            {productivePerc}%
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Productivity Score</div>
          <div className="stat-value" style={{ color: 'var(--secondary)' }}>{data?.productivity_score || 0}</div>
          <div className="stat-sub">/ 100 this week</div>
        </div>
      </div>

      <div className="grid-2" style={{ marginBottom: 24 }}>
        {/* Weekly Hours per Subject */}
        <div className="card">
          <div className="card-title">📚 Weekly Hours per Subject</div>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data?.subject_hours_weekly || []} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" />
              <XAxis dataKey="subject" tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
              <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="hours" name="Hours" radius={[4, 4, 0, 0]}>
                {(data?.subject_hours_weekly || []).map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Daily Trend */}
        <div className="card">
          <div className="card-title">📈 Daily Study Trend (14 days)</div>
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={data?.daily_trend || []} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0fdf4" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-muted)' }}
                tickFormatter={d => d.slice(5)} />
              <YAxis tick={{ fontSize: 12, fill: 'var(--text-muted)' }} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="hours" name="Hours" stroke="#059669"
                strokeWidth={2} dot={{ r: 4, fill: '#059669' }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid-2">
        {/* Subject distribution pie */}
        <div className="card">
          <div className="card-title">🥧 Subject-wise Time Distribution</div>
          {(data?.subject_distribution || []).length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '40px 0', fontSize: 14 }}>
              No data yet. Start logging sessions!
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie
                  data={data?.subject_distribution || []}
                  dataKey="hours"
                  nameKey="subject"
                  cx="50%" cy="50%"
                  outerRadius={90}
                  label={({ subject, percent }) => `${subject} ${(percent * 100).toFixed(0)}%`}
                  labelLine={{ stroke: 'var(--text-muted)' }}
                >
                  {(data?.subject_distribution || []).map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v) => [`${v.toFixed(2)} hrs`, 'Hours']} />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Productive vs Unproductive */}
        <div className="card">
          <div className="card-title">⚡ Productive vs Unproductive</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 16 }}>
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 14 }}>✅ Productive Study</span>
                <span style={{ fontWeight: 700, color: 'var(--success)' }}>{data?.productive_hours || 0} hrs</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{
                  width: `${totalTracked > 0 ? (data.productive_hours / totalTracked) * 100 : 0}%`,
                  background: 'var(--success)'
                }} />
              </div>
            </div>

            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontSize: 14 }}>⚠️ Unproductive (Night + Low Focus)</span>
                <span style={{ fontWeight: 700, color: 'var(--warning)' }}>{data?.unproductive_hours || 0} hrs</span>
              </div>
              <div className="progress-bar">
                <div className="progress-fill" style={{
                  width: `${totalTracked > 0 ? (data.unproductive_hours / totalTracked) * 100 : 0}%`,
                  background: 'var(--warning)'
                }} />
              </div>
            </div>

            <div style={{ background: 'var(--bg-card2)', borderRadius: 10, padding: 16, marginTop: 8 }}>
              <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8 }}>
                Definition: Night study sessions with focus level &lt; 3 are marked as unproductive.
              </div>
              <div style={{ fontSize: 16, fontWeight: 700 }}>
                Overall Efficiency: <span style={{ color: productivePerc >= 70 ? 'var(--success)' : 'var(--warning)' }}>
                  {productivePerc}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
