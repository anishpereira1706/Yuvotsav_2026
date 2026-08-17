export default function RegistrationList({ rows }) {
  if (!rows.length) {
    return <p className="empty">No registrations match.</p>;
  }

  return (
    <div className="list">
      {rows.map((r, i) => (
        <PersonCard key={`${r.name}-${r.phone}-${i}`} row={r} />
      ))}
    </div>
  );
}

function PersonCard({ row }) {
  const name = (row.name || 'Unknown').trim();
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const attending = row.attending === 'yes';
  const unknown = row.attending !== 'yes' && row.attending !== 'no';

  const handleCopy = () => {
    const text = row.phone || '';
    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  };

  return (
    <div className="card">
      <div className="avatar">{initials || '?'}</div>
      <div className="card-body">
        <div className="card-name">{name}</div>
        <div className="card-meta">
          {row.ward && <span>{row.ward}</span>}
          <span className={`badge ${unknown ? 'unknown' : attending ? 'yes' : 'no'}`}>
            {unknown ? 'Unknown' : attending ? 'Attending' : 'Not attending'}
          </span>
        </div>
        {!attending && row.reason && <div className="reason">↳ {row.reason}</div>}
      </div>
      <div className="card-actions">
        {row.phone && (
          <>
            <a className="action-btn" href={`tel:${row.phone}`} title="Call">📞</a>
            <button className="action-btn" onClick={handleCopy} title="Copy number">⧉</button>
          </>
        )}
      </div>
    </div>
  );
}