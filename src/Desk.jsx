import { useEffect, useMemo, useState } from 'react';
import CONFIG from './config';
import * as api from './api';

const WARDS = CONFIG.WARDS;

export default function Desk() {
  const [user, setUser] = useState(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loginErr, setLoginErr] = useState('');

  const [data, setData] = useState(null);
  const [search, setSearch] = useState('');
  const [ward, setWard] = useState('');
  const [msg, setMsg] = useState('');

  const volunteerOptions = useMemo(() => {
    const set = new Set(['Anish Pereira']);
    (data?.rows || []).forEach((r) => r.name && set.add(r.name.trim()));
    return [...set].sort();
  }, [data]);

  useEffect(() => {
    load();
    const id = setInterval(load, CONFIG.REFRESH_SECONDS * 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function load() {
    try {
      const d = await api.fetchData();
      if (d && d.success === true) setData(d);
    } catch (e) {}
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLoginErr('');
    try {
      const r = await api.login(name, password);
      setUser(r);
    } catch (err) {
      setLoginErr(err.message);
    }
  }

  function flash(m) {
    setMsg(m);
    setTimeout(() => setMsg(''), 2500);
  }

  async function doCheckin(row) {
    try {
      await api.checkin(row.phone, user.name);
      flash('Checked in ' + row.name);
      load();
    } catch (err) {
      flash('Error: ' + err.message);
    }
  }

  async function doPay(row, method) {
    try {
      await api.pay(row.phone, method, user.name);
      flash('Marked paid (' + method + ') for ' + row.name);
      load();
    } catch (err) {
      flash('Error: ' + err.message);
    }
  }

  if (!user) {
    return (
      <div className="container desk-login">
        <div className="panel">
          <h2 className="panel-title">Volunteer Login</h2>
          <p className="login-sub">Sign in to manage check-ins and payments.</p>
          <form onSubmit={handleLogin}>
            <select className="search-input" value={name} onChange={(e) => setName(e.target.value)} required>
              <option value="">Select your name…</option>
              {volunteerOptions.map((v) => (
                <option key={v} value={v}>{v}</option>
              ))}
            </select>
            <input
              className="search-input"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            {loginErr && <div className="banner error">{loginErr}</div>}
            <button className="btn-primary" type="submit">Sign in</button>
          </form>
          <p className="login-hint">Default password for Anish: yuvotsav2026</p>
        </div>
      </div>
    );
  }

  const rows = data?.rows || [];
  const q = search.toLowerCase().trim();
  const searching = q.length >= 2;
  const results = rows.filter((r) => {
    if (ward && (r.ward || '').trim() !== ward) return false;
    if (searching) {
      const tokens = q.split(/\s+/).filter(Boolean);
      const words = `${r.name || ''} ${r.ward || ''} ${r.phone || ''}`.toLowerCase().split(/\s+/).filter(Boolean);
      return tokens.every((t) => words.some((w) => w.startsWith(t)));
    }
    return false;
  });

  const stats = {
    total: rows.length,
    checkedIn: rows.filter((r) => r.checkedIn).length,
    paid: rows.filter((r) => r.paid === 'yes').length,
  };

  return (
    <div className="desk">
      {msg && <div className="banner ok">{msg}</div>}

      <div className="desk-top">
        <span className="desk-user">{user.name}</span>
        <button className="refresh-btn" onClick={load} title="Refresh">↻</button>
      </div>

      <section className="stats">
        <div className="stat-card primary"><div className="stat-num">{stats.total}</div><div className="stat-label">Registered</div></div>
        <div className="stat-card yes"><div className="stat-num">{stats.checkedIn}</div><div className="stat-label">Checked in</div></div>
        <div className="stat-card accent"><div className="stat-num">{stats.paid}</div><div className="stat-label">Paid</div></div>
        <div className="stat-card no"><div className="stat-num">{stats.total - stats.checkedIn}</div><div className="stat-label">Remaining</div></div>
      </section>

      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Find person</h2>
        </div>
        <div className="search-row">
          <input
            type="search"
            className="search-input"
            placeholder="Search name or phone…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="chips">
          <button className={`chip ${ward === '' ? 'active' : ''}`} onClick={() => setWard('')}>All wards</button>
          {WARDS.map((w) => (
            <button key={w} className={`chip ${ward === w ? 'active' : ''}`} onClick={() => setWard(ward === w ? '' : w)}>{w}</button>
          ))}
        </div>

        {results.length > 0 ? (
          <div className="list">
            {results.map((r, i) => (
              <DeskCard key={`${r.phone}-${i}`} row={r} onCheckin={doCheckin} onPay={doPay} />
            ))}
          </div>
        ) : (
          <Walkin user={user} ward={ward} flash={flash} onDone={load} />
        )}
      </section>
    </div>
  );
}

function DeskCard({ row, onCheckin, onPay }) {
  const name = (row.name || 'Unknown').trim();
  const attending = row.attending === 'yes';
  return (
    <div className="card desk-card">
      <div className="card-body">
        <div className="card-name">{name}</div>
        <div className="card-meta">
          {row.ward && <span>{row.ward}</span>}
          {!attending && <span className="badge no">Not attending</span>}
        </div>
        <div className="desk-badges">
          <span className={`badge ${row.paid === 'yes' ? 'yes' : 'unknown'}`}>
            {row.paid === 'yes' ? `Paid · ${row.paidMethod}` : 'Not paid'}
          </span>
          <span className={`badge ${row.checkedIn ? 'yes' : 'unknown'}`}>
            {row.checkedIn ? 'Checked in' : 'Not checked in'}
          </span>
        </div>
      </div>
      <div className="desk-actions">
        <button className="action-btn big" disabled={row.checkedIn} onClick={() => onCheckin(row)}>
          {row.checkedIn ? '✓' : 'Check in'}
        </button>
        {row.paid !== 'yes' && (
          <>
            <button className="action-btn pay-cash" onClick={() => onPay(row, 'cash')}>Cash</button>
            <button className="action-btn pay-gpay" onClick={() => onPay(row, 'gpay')}>GPay</button>
          </>
        )}
      </div>
    </div>
  );
}

function Walkin({ user, ward, flash, onDone }) {
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({ name: '', phone: '', ward: ward, method: '', auto: false });

  async function submit(e) {
    e.preventDefault();
    try {
      await api.walkin({
        name: f.name,
        phone: f.phone,
        ward: f.ward,
        method: f.method,
        autoCheckin: f.auto,
        volunteer: user.name,
      });
      flash('Walk-in added: ' + f.name);
      setF({ name: '', phone: '', ward: ward, method: '', auto: false });
      setOpen(false);
      onDone();
    } catch (err) {
      flash('Error: ' + err.message);
    }
  }

  return (
    <div className="walkin">
      <button className="btn-primary" onClick={() => setOpen(!open)}>
        {open ? 'Cancel' : '+ Add walk-in'}
      </button>
      {open && (
        <form className="walkin-form" onSubmit={submit}>
          <input className="search-input" placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
          <input className="search-input" placeholder="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} required />
          <select className="search-input" value={f.ward} onChange={(e) => setF({ ...f, ward: e.target.value })} required>
            <option value="">Ward…</option>
            {WARDS.map((w) => <option key={w} value={w}>{w}</option>)}
          </select>
          <div className="pay-options">
            <button type="button" className={`action-btn ${f.method === 'cash' ? 'on' : ''}`} onClick={() => setF({ ...f, method: 'cash' })}>Cash</button>
            <button type="button" className={`action-btn ${f.method === 'gpay' ? 'on' : ''}`} onClick={() => setF({ ...f, method: 'gpay' })}>GPay</button>
          </div>
          <label className="check">
            <input type="checkbox" checked={f.auto} onChange={(e) => setF({ ...f, auto: e.target.checked })} />
            Auto check-in on save
          </label>
          <button className="btn-primary" type="submit">Save</button>
        </form>
      )}
    </div>
  );
}