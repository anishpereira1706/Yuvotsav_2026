import { useState } from 'react';

export default function WardProgress({ wards }) {
  const [collapsed, setCollapsed] = useState(false);
  const entries = Object.entries(wards || {});
  if (!entries.length) {
    return (
      <section className="panel ward-panel">
        <h2 className="panel-title">Ward-wise Progress</h2>
        <p className="empty">No ward data yet.</p>
      </section>
    );
  }

  const sorted = entries.sort((a, b) => b[1].total - a[1].total);
  const max = Math.max(...sorted.map(([, v]) => v.total), 1);

  return (
    <section className="panel ward-panel">
      <div className="panel-head collapse-head">
        <h2 className="panel-title">Ward-wise Progress</h2>
        <button
          className="collapse-btn"
          onClick={() => setCollapsed(!collapsed)}
          aria-expanded={!collapsed}
          aria-label={collapsed ? 'Expand ward progress' : 'Collapse ward progress'}
        >
          <span className="collapse-caret">{collapsed ? '▼' : '▲'}</span>
        </button>
      </div>
      {!collapsed && (
        <div className="ward-grid">
          {sorted.map(([name, info]) => {
            const notAttending = info.total - info.attending;
            return (
              <div key={name} className="ward-card">
                <div className="ward-card-head">
                  <div className="ward-card-name">{name}</div>
                  <div className="ward-card-total">{info.total} <span className="ward-total-label">registered</span></div>
                </div>
                <div className="ward-bar-track">
                  <div className={`ward-bar ${info.total === 0 ? 'zero' : ''}`} style={{ width: `${(info.total / max) * 100}%` }} />
                </div>
                <div className="ward-card-stats">
                  <span className="ws attending"><i className="dot yes" />{info.attending} attending</span>
                  <span className="ws not"><i className="dot no" />{notAttending} not attending</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
