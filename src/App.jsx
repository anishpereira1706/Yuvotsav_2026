import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CONFIG from './config';
import StatCards from './components/StatCards';
import WardProgress from './components/WardProgress';
import RegistrationList from './components/RegistrationList';

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [search, setSearch] = useState('');
  const [ward, setWard] = useState('');

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(CONFIG.SCRIPT_URL + '?cache=' + Date.now());
      if (!res.ok) throw new Error('Request failed (' + res.status + ')');
      const payload = await res.json();
      if (!payload || payload.success !== true) throw new Error('Unexpected server response.');
      setData(payload);
      setError('');
      setLastUpdated(new Date());
    } catch (err) {
      setError(err.message || 'Failed to load data.');
    }
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, CONFIG.REFRESH_SECONDS * 1000);
    return () => clearInterval(id);
  }, [fetchData]);

  const wards = useMemo(() => {
    const set = {};
    (data?.rows || []).forEach((r) => {
      const w = (r.ward || '').trim();
      if (w) set[w] = true;
    });
    return Object.keys(set).sort((a, b) => a.localeCompare(b));
  }, [data]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return (data?.rows || []).filter((r) => {
      if (ward && (r.ward || '').trim() !== ward) return false;
      if (q) {
        const hay = `${r.name || ''} ${r.phone || ''} ${r.ward || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [data, search, ward]);

  const handleRefresh = () => fetchData();

  return (
    <div className="page">
      <header className="topbar">
        <div className="topbar-inner">
          <div>
            <div className="brand-kicker">Yuvotsav</div>
            <div className="brand-name">2026 <span className="accent">·</span> Youth Day</div>
            <div className="brand-sub">Live Registration Tracker</div>
          </div>
          <div className={`live-pill ${error ? 'off' : ''}`}>
            <span className="dot" />
            {error ? 'OFFLINE' : 'LIVE'}
          </div>
        </div>
        <div className="topbar-inner sub">
          <div className="updated">{lastUpdated ? `Updated ${formatTime(lastUpdated)}` : 'Loading…'}</div>
          <button className="refresh-btn" onClick={handleRefresh} aria-label="Refresh now">↻</button>
        </div>
      </header>

      <main className="container">
        {error && (
          <div className="banner error">
            <strong>Could not load data:</strong> {error}
          </div>
        )}

        {data && (
          <>
            <StatCards stats={data.stats} total={data.total} />
            <WardProgress wards={data.stats.wards} />

            <section className="panel">
              <div className="panel-head">
                <h2 className="panel-title">Registrations</h2>
                <span className="count-badge">{filtered.length} shown</span>
              </div>

              <input
                type="search"
                className="search-input"
                placeholder="Search name, phone or ward…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />

              <div className="chips">
                <button className={`chip ${ward === '' ? 'active' : ''}`} onClick={() => setWard('')}>
                  All
                </button>
                {wards.map((w) => (
                  <button key={w} className={`chip ${ward === w ? 'active' : ''}`} onClick={() => setWard(w)}>
                    {w}
                  </button>
                ))}
              </div>

              <RegistrationList rows={filtered} />
            </section>
          </>
        )}
      </main>

      <footer className="footer">
        © {new Date().getFullYear()} Anish Pereira
      </footer>
    </div>
  );
}

function formatTime(d) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}