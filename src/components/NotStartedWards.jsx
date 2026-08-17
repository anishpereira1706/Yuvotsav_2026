export default function NotStartedWards({ pending }) {
  if (!pending.length) return null;

  const single = pending.length === 1;

  return (
    <div className="pending-card">
      <span className="pending-icon">⏳</span>
      <div className="pending-body">
        <div className="pending-title">
          {single ? (
            <>
              <strong>{pending[0]}</strong> — no registrations yet
            </>
          ) : (
            <>
              {pending.length} wards — no registrations yet
            </>
          )}
        </div>
        {!single && (
          <div className="pending-chips">
            {pending.map((w) => (
              <span key={w} className="pending-chip">{w}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
