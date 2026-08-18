import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import CONFIG from './config';
import StatCards from './components/StatCards';
import WardProgress from './components/WardProgress';
import RegistrationList from './components/RegistrationList';
import NotStartedWards from './components/NotStartedWards';

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [search, setSearch] = useState('');
  const [ward, setWard] = useState('');
  const [attendFilter, setAttendFilter] = useState(null);

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

  const wardsWithData = useMemo(() => {
    const set = new Set();
    (data?.rows || []).forEach((r) => {
      const w = (r.ward || '').trim();
      if (w) set.add(w.toLowerCase());
    });
    return set;
  }, [data]);

  const pendingWards = useMemo(() => {
    const known = (data?.wards && data.wards.length ? data.wards : CONFIG.WARDS) || [];
    return known.filter((w) => !wardsWithData.has(String(w).trim().toLowerCase()));
  }, [data, wardsWithData]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    const searching = q.length >= 2;
    return (data?.rows || []).filter((r) => {
      if ((attendFilter === null || attendFilter === undefined) && !searching) return false;
      if (ward && (r.ward || '').trim() !== ward) return false;
      if ((attendFilter === 'yes' || attendFilter === 'no') && r.attending !== attendFilter) return false;
      if (searching) {
        const tokens = q.toLowerCase().split(/\s+/).filter(Boolean);
        const words = `${r.name || ''} ${r.ward || ''} ${r.phone || ''}`
          .toLowerCase()
          .split(/\s+/)
          .filter(Boolean);
        const match = tokens.every((t) => words.some((w) => w.startsWith(t)));
        if (!match) return false;
      }
      return true;
    });
  }, [data, search, ward, attendFilter]);

  const handleRefresh = () => fetchData();

  return (
    <>
      <div className="wave-bg" aria-hidden="true">
        <svg className="wave wave-1" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <g className="wave-group">
            <path d="M0,224C120,160,240,160,360,224C480,288,600,288,720,224C840,160,960,160,1080,224C1200,288,1320,288,1440,224L1440,320L0,320Z" fill="rgba(124,58,237,0.10)"/>
            <path transform="translate(1440 0)" d="M0,224C120,160,240,160,360,224C480,288,600,288,720,224C840,160,960,160,1080,224C1200,288,1320,288,1440,224L1440,320L0,320Z" fill="rgba(124,58,237,0.10)"/>
          </g>
        </svg>
        <svg className="wave wave-2" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <g className="wave-group">
            <path d="M0,192C120,128,240,128,360,192C480,256,600,256,720,192C840,128,960,128,1080,192C1200,256,1320,256,1440,192L1440,320L0,320Z" fill="rgba(139,92,246,0.12)"/>
            <path transform="translate(1440 0)" d="M0,192C120,128,240,128,360,192C480,256,600,256,720,192C840,128,960,128,1080,192C1200,256,1320,256,1440,192L1440,320L0,320Z" fill="rgba(139,92,246,0.12)"/>
          </g>
        </svg>
        <svg className="wave wave-3" viewBox="0 0 1440 320" preserveAspectRatio="none">
          <g className="wave-group">
            <path d="M0,208C150,160,250,160,400,208C550,256,650,256,800,208C950,160,1050,160,1200,208C1300,240,1380,240,1440,208L1440,320L0,320Z" fill="rgba(109,40,217,0.14)"/>
            <path transform="translate(1440 0)" d="M0,208C150,160,250,160,400,208C550,256,650,256,800,208C950,160,1050,160,1200,208C1300,240,1380,240,1440,208L1440,320L0,320Z" fill="rgba(109,40,217,0.14)"/>
          </g>
        </svg>
      </div>

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

      <div className="page">
        <main className="container">
        {error && (
          <div className="banner error">
            <strong>Could not load data:</strong> {error}
          </div>
        )}

        {data && (
          <>
            <StatCards stats={data.stats} total={data.total} />
            <NotStartedWards pending={pendingWards} />
            <WardProgress wards={data.stats.wards} />

            <section className="panel list-panel">
              <div className="panel-head">
                <h2 className="panel-title">Registrations</h2>
                <span className="count-badge">{filtered.length} shown</span>
              </div>

              <div className="search-row">
                <input
                  type="search"
                  className="search-input"
                  placeholder="Search name, phone or ward…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>

              <div className="attend-toggle">
                <button className={`attend-btn ${attendFilter === 'all' ? 'active' : ''}`} onClick={() => setAttendFilter(attendFilter === 'all' ? null : 'all')}>
                  All
                </button>
                <button className={`attend-btn yes ${attendFilter === 'yes' ? 'active' : ''}`} onClick={() => setAttendFilter(attendFilter === 'yes' ? null : 'yes')}>
                  Attending
                </button>
                <button className={`attend-btn no ${attendFilter === 'no' ? 'active' : ''}`} onClick={() => setAttendFilter(attendFilter === 'no' ? null : 'no')}>
                  Not attending
                </button>
              </div>

              <div className="chips">
{wards.map((w) => (
                      <button
                        key={w}
                        className={`chip ${ward === w ? 'active' : ''}`}
                        onClick={() => {
                          const next = ward === w ? '' : w;
                          setWard(next);
                          if (next) setAttendFilter('all');
                        }}
                      >
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
          <div className="foot-brand">Yuvotsav <span className="foot-accent">2026</span></div>
          <div className="foot-copy">© {new Date().getFullYear()} Anish Pereira</div>
        </footer>
      </div>
    </>
  );
}

function formatTime(d) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}