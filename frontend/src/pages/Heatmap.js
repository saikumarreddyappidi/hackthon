import React, { useEffect, useState } from 'react';
import { useAuth } from '../AuthContext';
import API from '../api';

const COLORS = [
  '#f0fdf4',
  '#d1fae5',
  '#6ee7b7',
  '#10b981',
  '#059669',
];

function getColor(hours) {
  if (hours === 0) return '#f0fdf4';
  if (hours < 1) return COLORS[1];
  if (hours < 2) return COLORS[2];
  if (hours < 4) return COLORS[3];
  return COLORS[4];
}

function generateDateRange(days) {
  const dates = [];
  const today = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    dates.push(d.toISOString().split('T')[0]);
  }
  return dates;
}

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

export default function Heatmap() {
  const { user } = useAuth();
  const [data, setData] = useState([]);
  const [days, setDays] = useState(90);
  const [subject, setSubject] = useState('');
  const [loading, setLoading] = useState(true);
  const [tooltip, setTooltip] = useState(null);

  const subjects = user?.subjects ? user.subjects.split(',').map(s => s.trim()).filter(Boolean) : [];

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    const params = new URLSearchParams({ days });
    if (subject) params.append('subject', subject);
    API.get(`/heatmap/${user.id}?${params}`)
      .then(res => setData(res.data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [user, days, subject]);

  const dateRange = generateDateRange(days);
  const dataMap = {};
  data.forEach(d => { dataMap[d.date] = d.hours; });

  // Group by weeks
  const weeks = [];
  let week = new Array(dateRange[0] ? new Date(dateRange[0]).getDay() : 0).fill(null);
  const monthLabels = [];
  let lastMonth = -1;

  dateRange.forEach((date) => {
    const d = new Date(date);
    const month = d.getMonth();
    if (month !== lastMonth) {
      monthLabels.push({ weekIdx: weeks.length, label: MONTHS[month] });
      lastMonth = month;
    }
    week.push(date);
    if (week.length === 7) {
      weeks.push(week);
      week = [];
    }
  });
  if (week.length > 0) {
    while (week.length < 7) week.push(null);
    weeks.push(week);
  }

  const totalHours = data.reduce((a, b) => a + b.hours, 0);
  const activeDays = data.filter(d => d.hours > 0).length;

  return (
    <div>
      <div className="page-header">
        <h1>🔥 Study Heatmap</h1>
        <p>Visual overview of your study activity calendar</p>
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {[30, 60, 90].map(d => (
            <button key={d} className={`btn ${days === d ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: 13 }} onClick={() => setDays(d)}>
              {d} days
            </button>
          ))}
        </div>
        <select className="form-control" value={subject} onChange={e => setSubject(e.target.value)}
          style={{ width: 'auto', minWidth: 160 }}>
          <option value="">All Subjects</option>
          {subjects.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Summary */}
      <div className="grid-3" style={{ marginBottom: 24 }}>
        <div className="stat-card">
          <div className="stat-label">Total Hours</div>
          <div className="stat-value">{totalHours.toFixed(1)}</div>
          <div className="stat-sub">in last {days} days</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Active Days</div>
          <div className="stat-value">{activeDays}</div>
          <div className="stat-sub">days with study sessions</div>
        </div>
        <div className="stat-card">
          <div className="stat-label">Daily Average</div>
          <div className="stat-value">{activeDays > 0 ? (totalHours / activeDays).toFixed(1) : 0}</div>
          <div className="stat-sub">hrs on active days</div>
        </div>
      </div>

      {loading ? (
        <div className="loading-screen"><div className="spinner" /></div>
      ) : (
        <div className="card" style={{ overflowX: 'auto' }}>
          {/* Month labels */}
          <div style={{ display: 'flex', paddingLeft: 36, marginBottom: 4 }}>
            <div style={{ display: 'flex', position: 'relative', height: 16 }}>
              {monthLabels.map((ml, i) => (
                <div key={i} style={{
                  position: 'absolute',
                  left: ml.weekIdx * 17,
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  whiteSpace: 'nowrap'
                }}>
                  {ml.label}
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 3, paddingTop: 18 }}>
            {/* Day labels */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginRight: 4 }}>
              {['S','M','T','W','T','F','S'].map((d, i) => (
                <div key={i} style={{ height: 14, fontSize: 9, color: 'var(--text-muted)', lineHeight: '14px' }}>{d}</div>
              ))}
            </div>

            {/* Heatmap grid */}
            {weeks.map((week, wi) => (
              <div key={wi} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {week.map((date, di) => {
                  const hours = date ? (dataMap[date] || 0) : 0;
                  return (
                    <div
                      key={di}
                      className="heatmap-cell"
                      style={{ background: date ? getColor(hours) : 'transparent', border: date ? '1px solid #ffffff' : 'none', borderRadius: 3 }}
                      title={date ? `${date}: ${hours.toFixed(1)} hrs` : ''}
                      onMouseEnter={() => date && setTooltip({ date, hours })}
                      onMouseLeave={() => setTooltip(null)}
                    />
                  );
                })}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 16, fontSize: 11, color: 'var(--text-muted)' }}>
            <span>Less</span>
            {['#f0fdf4', COLORS[1], COLORS[2], COLORS[3], COLORS[4]].map((c, i) => (
              <div key={i} style={{ width: 12, height: 12, background: c, borderRadius: 3, border: '1px solid #ffffff' }} />
            ))}
            <span>More</span>
          </div>

          {tooltip && (
            <div style={{ marginTop: 10, fontSize: 13, color: 'var(--text-muted)' }}>
              📅 <strong style={{ color: 'var(--text)' }}>{tooltip.date}</strong> — {tooltip.hours.toFixed(1)} hours studied
            </div>
          )}
        </div>
      )}
    </div>
  );
}
