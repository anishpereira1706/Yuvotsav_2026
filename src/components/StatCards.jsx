const ICONS = {};

export default function StatCards({ stats, total }) {
  const wardCount = stats ? Object.keys(stats.wards || {}).length : 0;
  const cards = [
    { label: 'Total Registered', value: total ?? 0, tone: 'primary' },
    { label: 'Attending', value: stats?.attending ?? 0, tone: 'yes' },
    { label: 'Not Attending', value: stats?.notAttending ?? 0, tone: 'no' },
    { label: 'Wards', value: wardCount, tone: 'accent' },
  ];

  return (
    <section className="stats">
      {cards.map((c) => (
        <div key={c.label} className={`stat-card ${c.tone}`}>
          <div className="stat-num">{c.value}</div>
          <div className="stat-label">{c.label}</div>
        </div>
      ))}
    </section>
  );
}