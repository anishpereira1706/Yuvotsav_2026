export default function Landing({ onSelect }) {
  return (
    <div className="landing">
      <div className="hero">
        <h1 className="hero-title">Yuvotsav <span className="accent">2026</span></h1>
        <p className="hero-sub">Youth Day · Live registration &amp; check-in portal</p>
        <div className="landing-cards">
          <button className="landing-card" onClick={() => onSelect('tracker')}>
            <span className="lc-title">Live Tracker</span>
            <span className="lc-desc">Live registrations, ward-wise progress</span>
          </button>
          <button className="landing-card" onClick={() => onSelect('desk')}>
            <span className="lc-title">Registration Desk</span>
            <span className="lc-desc">Check-in &amp; payments (volunteers only)</span>
          </button>
        </div>
      </div>
    </div>
  );
}