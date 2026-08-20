import { useCallback, useEffect, useMemo, useState } from 'react';
import CONFIG from './config';
import { APP_KEY } from './api';
import StatCards from './components/StatCards';
import WardProgress from './components/WardProgress';
import RegistrationList from './components/RegistrationList';
import NotStartedWards from './components/NotStartedWards';
import Landing from './Landing';
import Desk from './Desk';

const VIEWS = {
  landing: 'landing',
  tracker: 'tracker',
  desk: 'desk',
};

export default function App() {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [search, setSearch] = useState('');
  const [ward, setWard] = useState('');
  const [attendFilter, setAttendFilter] = useState(null);
  const [view, setView] = useState(() => {
    try {
      const v = sessionStorage.getItem('yuvotsav_view');
      return v === 'tracker' || v === 'desk' ? v : VIEWS.landing;
    } catch (e) {
      return VIEWS.landing;
    }
  });
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(sessionStorage.getItem('yuvotsav_user')) || null;
    } catch (e) {
      return null;
    }
  });

  const handleLogin = (u) => {
    setUser(u);
    try {
      if (u) sessionStorage.setItem('yuvotsav_user', JSON.stringify(u));
      else sessionStorage.removeItem('yuvotsav_user');
    } catch (e) {}
  };

  useEffect(() => {
    try {
      sessionStorage.setItem('yuvotsav_view', view);
    } catch (e) {}
  }, [view]);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(CONFIG.API_BASE + '/api/data?cache=' + Date.now(), {
        headers: { 'x-app-key': APP_KEY },
      });
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
    const onFocus = () => {
      if (document.visibilityState === 'visible') fetchData();
    };
    document.addEventListener('visibilitychange', onFocus);
    window.addEventListener('focus', onFocus);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onFocus);
      window.removeEventListener('focus', onFocus);
    };
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

  // Optimistically apply a desk mutation to local data so the UI updates
  // instantly; the next server refresh reconciles any drift.
  const applyLocalPatch = useCallback((rowId, patch) => {
    setData((prev) => {
      if (!prev || !Array.isArray(prev.rows)) return prev;
      const rows = prev.rows.map((r) => (r._id === rowId ? { ...r, ...patch } : r));
      return { ...prev, rows, total: rows.length, stats: computeStats(rows) };
    });
  }, []);

  const brandSub = view === VIEWS.landing ? 'Choose a view' : view === VIEWS.desk ? 'Registration Desk' : 'Live Registration Tracker';

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
            <div className="brand-sub">{brandSub}</div>
          </div>
          {view === VIEWS.tracker && (
            <div className={`live-pill ${error ? 'off' : ''}`}>
              <span className="dot" />
              {error ? 'OFFLINE' : 'LIVE'}
            </div>
          )}
        </div>
        <div className="topbar-inner sub">
          <div className="nav">
            <button className={`nav-btn ${view === VIEWS.landing ? 'active' : ''}`} onClick={() => setView(VIEWS.landing)}>Home</button>
            <button className={`nav-btn ${view === VIEWS.tracker ? 'active' : ''}`} onClick={() => setView(VIEWS.tracker)}>Tracker</button>
            <button className={`nav-btn ${view === VIEWS.desk ? 'active' : ''}`} onClick={() => setView(VIEWS.desk)}>Desk</button>
          </div>
          {view === VIEWS.tracker && (
            <>
              <div className="updated">{lastUpdated ? `Updated ${formatTime(lastUpdated)}` : 'Loading…'}</div>
              <button className="refresh-btn" onClick={handleRefresh} aria-label="Refresh now">↻</button>
            </>
          )}
        </div>
      </header>

      <div className="page">
        <main className="container">
          {view === VIEWS.landing && <Landing onSelect={setView} />}

          {view === VIEWS.tracker && (
            <>
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
            </>
          )}

          {view === VIEWS.desk && <Desk user={user} onLogin={handleLogin} data={data} refresh={fetchData} applyLocalPatch={applyLocalPatch} />}
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

function computeStats(rows) {
  const stats = { total: rows.length, attending: 0, notAttending: 0, unknown: 0, wards: {} };
  rows.forEach((r) => {
    const a = r.attending;
    if (a === 'yes') stats.attending++;
    else if (a === 'no') stats.notAttending++;
    else stats.unknown++;
    if (r.ward) {
      if (!stats.wards[r.ward]) stats.wards[r.ward] = { total: 0, attending: 0 };
      stats.wards[r.ward].total++;
      if (a === 'yes') stats.wards[r.ward].attending++;
    }
  });
  return stats;
}