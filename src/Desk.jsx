import { useEffect, useState } from 'react';
import CONFIG from './config';
import * as api from './api';
import SuccessOverlay from './SuccessOverlay';

const WARDS = CONFIG.WARDS;

export default function Desk({ user, onLogin, data, refresh, applyLocalPatch }) {
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [volunteers, setVolunteers] = useState([]);

  const [search, setSearch] = useState('');
  const [ward, setWard] = useState('');
  const [msg, setMsg] = useState('');
  const [selected, setSelected] = useState(null);
  const [selectedFrom, setSelectedFrom] = useState('find');
  const [success, setSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [tab, setTab] = useState('find');
  const [adminSection, setAdminSection] = useState('find');

  useEffect(() => {
    try {
      const cached = localStorage.getItem('yuvotsav_volunteers');
      if (cached) setVolunteers(JSON.parse(cached));
    } catch (e) {}
    loadVolunteers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadVolunteers() {
    try {
      const v = await api.volunteers();
      if (v && v.success === true) {
        setVolunteers(v.volunteers || []);
        try { localStorage.setItem('yuvotsav_volunteers', JSON.stringify(v.volunteers || [])); } catch (e) {}
      }
    } catch (e) {}
  }

  async function handleLogin(e) {
    e.preventDefault();
    setLoginErr('');
    try {
      const r = await api.login(name, password);
      onLogin({ ...r, password });
    } catch (err) {
      setLoginErr(err.message);
    }
  }

  function flash(m) {
    setMsg(m);
    setTimeout(() => setMsg(''), 2500);
  }

  async function doUndoCheckin(row) {
    if (applyLocalPatch) applyLocalPatch(row._id, { checkedIn: false, checkedInBy: '' });
    setSuccessMsg('Check-in undone');
    setSuccess(true);
    try {
      await api.undoCheckin({ id: row._id, phone: row.phone });
      refresh();
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
            <NameSelect value={name} options={volunteers} onChange={setName} />
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
        </div>
      </div>
    );
  }

  const rows = data?.rows || [];
  const attendingRows = rows.filter((r) => r.attending === 'yes');
  const stats = {
    total: attendingRows.length,
    checkedIn: attendingRows.filter((r) => r.checkedIn).length,
    paid: attendingRows.filter((r) => r.paid === 'yes').length,
  };

  const q = search.toLowerCase().trim();
  const searching = q.length >= 2;
  const active = Boolean(ward) || searching;
  const results = active
    ? rows.filter((r) => {
        if (r.checkedIn) return false;
        if (ward && (r.ward || '').trim() !== ward) return false;
        if (searching) {
          const tokens = q.split(/\s+/).filter(Boolean);
          const words = `${r.name || ''} ${r.ward || ''} ${r.phone || ''}`.toLowerCase().split(/\s+/).filter(Boolean);
          if (!tokens.every((t) => words.some((w) => w.startsWith(t)))) return false;
        }
        return true;
      })
    : [];

  const statsSection = (
    <section className="stats">
      <div className="stat-card primary"><div className="stat-num">{stats.total}</div><div className="stat-label">Attending</div></div>
      <div className="stat-card yes"><div className="stat-num">{stats.checkedIn}</div><div className="stat-label">Checked in</div></div>
      <div className="stat-card accent"><div className="stat-num">{stats.paid}</div><div className="stat-label">Paid</div></div>
      <div className="stat-card no"><div className="stat-num">{stats.total - stats.checkedIn}</div><div className="stat-label">Remaining</div></div>
    </section>
  );

  const findSection = (
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
            <DeskCard key={`${r.phone}-${i}`} row={r} onOpen={(row) => { setSelectedFrom('find'); setSelected(row); }} />
          ))}
        </div>
      ) : searching && rows.some((r) => {
          if (!r.checkedIn) return false;
          const tokens = q.split(/\s+/).filter(Boolean);
          const words = `${r.name || ''} ${r.ward || ''} ${r.phone || ''}`.toLowerCase().split(/\s+/).filter(Boolean);
          return tokens.every((t) => words.some((w) => w.startsWith(t)));
        }) ? (
        <div className="empty-hint">Already checked in. Update payment in the Payments list.</div>
      ) : (
        <Walkin user={user} ward={ward} flash={flash} onDone={refresh} />
      )}
    </section>
  );

  const deskModal = selected && (
    <DeskModal
      row={selected}
      volunteer={user.name}
      isAdmin={user.role === 'admin'}
      updateMode={selectedFrom === 'payments'}
      onUndo={doUndoCheckin}
      onClose={() => setSelected(null)}
      onSave={async (method, checkIn) => {
        const target = selected;
        const isPending = method === 'pending';
        const currentlyPaid = target.paid === 'yes';
        const willPay =
          (!isPending && (!currentlyPaid || target.paidMethod !== method)) ||
          (isPending && currentlyPaid);
        const willCheckin = checkIn && !target.checkedIn;

        setSelected(null);
        if (willCheckin) { setSuccessMsg('Checked in!'); setSuccess(true); }
        else if (selectedFrom === 'payments' && willPay) { setSuccessMsg('Payment updated!'); setSuccess(true); }
        else flash('Saved: ' + target.name);

        if (applyLocalPatch) {
          const patch = {};
          if (willPay) {
            patch.paid = isPending ? '' : 'yes';
            patch.paidMethod = isPending ? '' : method;
          }
          if (willCheckin) {
            patch.checkedIn = true;
            patch.checkedInBy = user.name;
          }
          applyLocalPatch(target._id, patch);
        }

        try {
          const jobs = [];
          if (!isPending && (!currentlyPaid || target.paidMethod !== method)) {
            jobs.push(api.pay(target._id, target.phone, method, user.name));
          } else if (isPending && currentlyPaid) {
            jobs.push(api.pay(target._id, target.phone, 'pending', user.name));
          }
          if (willCheckin) {
            jobs.push(api.checkin(target._id, target.phone, user.name));
          }
          await Promise.all(jobs);
          refresh();
        } catch (err) {
          flash('Error: ' + err.message);
        }
      }}
    />
  );

  if (user.role === 'admin') {
    const adminNav = [
      { id: 'find', label: 'Find person' },
      { id: 'checkedin', label: 'Checked in' },
      { id: 'payments', label: 'Payments' },
      { id: 'volunteers', label: 'Volunteers' },
      { id: 'data', label: 'Data & Backup' },
    ];
    return (
      <div className="desk">
        {msg && <div className="banner ok">{msg}</div>}
        <div className="admin-shell">
          <aside className="admin-sidebar">
            <div className="admin-sidebar-head">
              <span className="desk-user">{user.name}</span>
              <span className="badge yes">Admin</span>
            </div>
            <nav className="admin-nav">
              {adminNav.map((item) => (
                <button
                  key={item.id}
                  className={`admin-nav-item ${adminSection === item.id ? 'active' : ''}`}
                  onClick={() => setAdminSection(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </nav>
            <div className="admin-sidebar-foot">
              <button className="refresh-btn" onClick={refresh} title="Refresh">↻</button>
              <button className="logout-btn" onClick={() => onLogin(null)}>Sign out</button>
            </div>
          </aside>
          <main className="admin-main">
            {adminSection === 'find' && (
              <>
                {statsSection}
                {findSection}
              </>
            )}
            {adminSection === 'checkedin' && <CheckedInTab rows={rows} canUndo onUndo={doUndoCheckin} />}
            {adminSection === 'payments' && <PaymentsTab rows={rows} onOpen={(r) => { setSelectedFrom('payments'); setSelected(r); }} />}
            {adminSection === 'volunteers' && <AdminVolunteers user={user} volunteers={volunteers} onAdded={loadVolunteers} flash={flash} />}
            {adminSection === 'data' && <AdminData rows={rows} flash={flash} />}
          </main>
        </div>
        {deskModal}
<SuccessOverlay show={success} message={successMsg} onDone={() => setSuccess(false)} />
      </div>
    );
  }

  return (
    <div className="desk">
      {msg && <div className="banner ok">{msg}</div>}

      <div className="desk-top">
        <span className="desk-user">{user.name}</span>
        <div className="desk-top-actions">
          <button className="logout-btn" onClick={() => onLogin(null)}>Sign out</button>
          <button className="refresh-btn" onClick={refresh} title="Refresh">↻</button>
        </div>
      </div>

      {statsSection}

      <div className="desk-tabs">
        <button className={`desk-tab ${tab === 'find' ? 'active' : ''}`} onClick={() => setTab('find')}>Find person</button>
        <button className={`desk-tab ${tab === 'checkedin' ? 'active' : ''}`} onClick={() => setTab('checkedin')}>Checked in</button>
        <button className={`desk-tab ${tab === 'payments' ? 'active' : ''}`} onClick={() => setTab('payments')}>Payments</button>
      </div>

      {tab === 'find' && findSection}
      {tab === 'checkedin' && <CheckedInTab rows={rows} />}
      {tab === 'payments' && <PaymentsTab rows={rows} onOpen={(r) => { setSelectedFrom('payments'); setSelected(r); }} />}

      {deskModal}
      <SuccessOverlay show={success} onDone={() => setSuccess(false)} />
    </div>
  );
}

function DeskCard({ row, onOpen }) {
  const name = (row.name || 'Unknown').trim();
  const attending = row.attending === 'yes';
  return (
    <button className="card desk-card" onClick={() => onOpen(row)}>
      <div className="avatar">{getInitials(name)}</div>
      <div className="card-body">
        <div className="card-name">{name}</div>
        <div className="card-meta">
          {row.ward && <span className="ward-tag">{row.ward}</span>}
          {row.phone && <span className="card-phone">{row.phone}</span>}
        </div>
      </div>
      <div className="desk-status">
        {!attending ? <span className="badge no">Not attending</span> : <span className="badge yes">Attending</span>}
        <span className="chev" aria-hidden="true">›</span>
      </div>
    </button>
  );
}

function getInitials(name) {
  return (name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

function MiniTime(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  } catch (e) {
    return '';
  }
}

function CheckedInTab({ rows, canUndo, onUndo }) {
  const [q, setQ] = useState('');
  const query = q.toLowerCase().trim();
  const list = rows
    .filter((r) => r.checkedIn)
    .filter((r) => {
      if (!query) return true;
      const words = `${r.name || ''} ${r.ward || ''} ${r.phone || ''}`.toLowerCase().split(/\s+/).filter(Boolean);
      return query.split(/\s+/).filter(Boolean).every((t) => words.some((w) => w.startsWith(t)));
    })
    .sort((a, b) => new Date(b.checkedInAt || 0) - new Date(a.checkedInAt || 0));

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Checked in</h2>
        <span className="count-badge">{list.length}</span>
      </div>
      <div className="search-row">
        <input type="search" className="search-input" placeholder="Search name or phone…" value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      {list.length === 0 ? (
        <p className="empty-hint">No one checked in yet.</p>
      ) : (
        <div className="list">
          {list.map((r, i) => (
            <div key={`${r.phone}-${i}`} className="card mini-card">
              <div className="avatar">{getInitials(r.name)}</div>
              <div className="card-body">
                <div className="card-name">{r.name}</div>
                <div className="card-meta">
                  {r.ward && <span>{r.ward}</span>}
                  {r.phone && <span>{r.phone}</span>}
                </div>
              </div>
              <div className="mini-right">
                {r.paid === 'yes' ? <span className="badge yes">Paid</span> : <span className="badge unknown">Unpaid</span>}
                <span className="mini-time">{MiniTime(r.checkedInAt)}</span>
                {canUndo && <button className="undo-btn" onClick={() => onUndo(r)}>Undo</button>}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function PaymentsTab({ rows, onOpen }) {
  const [mode, setMode] = useState('pending');
  const [q, setQ] = useState('');
  const [wardF, setWardF] = useState('');
  const [methodF, setMethodF] = useState('');

  const paid = rows
    .filter((r) => r.paid === 'yes')
    .sort((a, b) => new Date(b.paidAt || 0) - new Date(a.paidAt || 0));
  const pending = rows.filter((r) => r.paid !== 'yes' && (r.attending === 'yes' || r.checkedIn));

  const base = mode === 'paid' ? paid : pending;
  const qq = q.toLowerCase().trim();
  const searching = qq.length >= 2;
  const list = base
    .filter((r) => {
      if (searching) {
        const tokens = qq.split(/\s+/).filter(Boolean);
        const words = `${r.name || ''} ${r.ward || ''} ${r.phone || ''}`.toLowerCase().split(/\s+/).filter(Boolean);
        if (!tokens.every((t) => words.some((w) => w.startsWith(t)))) return false;
      }
      if (wardF && (r.ward || '').trim() !== wardF) return false;
      if (mode === 'paid' && methodF && (r.paidMethod || '') !== methodF) return false;
      return true;
    });

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Payments</h2>
        <div className="seg">
          <button className={`seg-btn ${mode === 'paid' ? 'on' : ''}`} onClick={() => setMode('paid')}>Paid · {paid.length}</button>
          <button className={`seg-btn ${mode === 'pending' ? 'on' : ''}`} onClick={() => setMode('pending')}>Pending · {pending.length}</button>
        </div>
      </div>

      <div className="pay-filters">
        <input
          type="search"
          className="search-input"
          placeholder="Search name or phone…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="pay-filter-row">
          <span className="filter-label">Ward</span>
          <div className="chips">
            <button className={`chip ${wardF === '' ? 'active' : ''}`} onClick={() => setWardF('')}>All</button>
            {WARDS.map((w) => (
              <button key={w} className={`chip ${wardF === w ? 'active' : ''}`} onClick={() => setWardF(wardF === w ? '' : w)}>{w}</button>
            ))}
          </div>
        </div>
        {mode === 'paid' && (
          <div className="pay-filter-row">
            <span className="filter-label">Method</span>
            <div className="chips">
              <button className={`chip ${methodF === '' ? 'active' : ''}`} onClick={() => setMethodF('')}>All</button>
              <button className={`chip ${methodF === 'cash' ? 'active' : ''}`} onClick={() => setMethodF(methodF === 'cash' ? '' : 'cash')}>Cash</button>
              <button className={`chip ${methodF === 'gpay' ? 'active' : ''}`} onClick={() => setMethodF(methodF === 'gpay' ? '' : 'gpay')}>G-Pay</button>
            </div>
          </div>
        )}
      </div>

      {list.length === 0 ? (
        <p className="empty-hint">
          {searching || wardF || methodF
            ? 'No matches for these filters.'
            : mode === 'paid' ? 'No payments recorded yet.' : 'Everyone has paid!'}
        </p>
      ) : (
        <div className="list">
          {list.map((r, i) => (
            <button key={`${r.phone}-${i}`} className="card mini-card mini-tappable" onClick={() => onOpen(r)}>
              <div className="avatar">{getInitials(r.name)}</div>
              <div className="card-body">
                <div className="card-name">{r.name}</div>
                <div className="card-meta">
                  {r.ward && <span>{r.ward}</span>}
                  {r.phone && <span>{r.phone}</span>}
                </div>
              </div>
              <div className="mini-right">
                {mode === 'paid' ? (
                  <>
                    <span className="badge yes">{r.paidMethod || 'Paid'}</span>
                    <span className="mini-time">{MiniTime(r.paidAt)}</span>
                  </>
                ) : (
                  <span className="badge unknown">Not paid</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </section>
  );
}

function DeskModal({ row, volunteer, isAdmin, updateMode, onUndo, onClose, onSave }) {
  const [method, setMethod] = useState(row.paid === 'yes' ? row.paidMethod : 'pending');
  const checkedIn = row.checkedIn;
  const attending = row.attending === 'yes';
  const name = (row.name || '').trim();

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        <h3 className="modal-title">{name}</h3>
        <div className="modal-sub">
          {row.ward && <span>{row.ward}</span>}
          {row.phone && <span>{row.phone}</span>}
        </div>

        <div className="modal-section">
          <div className="modal-label">Registration fee</div>
          <div className="pay-opts">
            <button type="button" className={`pay-opt ${method === 'cash' ? 'on' : ''}`} onClick={() => setMethod('cash')}>
              <span className="po-ico">₹</span>
              <span>Cash</span>
            </button>
            <button type="button" className={`pay-opt ${method === 'gpay' ? 'on' : ''}`} onClick={() => setMethod('gpay')}>
              <span className="po-ico">GP</span>
              <span>G-Pay</span>
            </button>
            <button type="button" className={`pay-opt ${method === 'pending' ? 'on' : ''}`} onClick={() => setMethod('pending')}>
              <span className="po-ico">◌</span>
              <span>Pending</span>
            </button>
          </div>
        </div>

        {!attending && (
          <p className="modal-note">Marked "Not attending" — you can still check them in.</p>
        )}

        <button className="btn-primary" disabled={checkedIn && !updateMode} onClick={() => onSave(method, updateMode ? false : !checkedIn)}>
          {updateMode ? 'Update' : (checkedIn ? 'Checked in ✓' : 'Check in')}
        </button>
        {checkedIn && isAdmin && !updateMode && (
          <button className="btn-ghost" onClick={() => { onUndo(row); onClose(); }}>
            Undo check-in
          </button>
        )}
      </div>
    </div>
  );
}

function NameSelect({ value, options, onChange }) {
  const [open, setOpen] = useState(false);
  const selected = options.find((v) => v.name === value);

  return (
    <div className="ns">
      <button type="button" className={`ns-btn ${open ? 'open' : ''}`} onClick={() => setOpen(!open)}>
        <span className={selected ? 'ns-val' : 'ns-placeholder'}>{selected ? selected.name : 'Select your name…'}</span>
        <span className="ns-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <>
          <div className="ns-backdrop" onClick={() => setOpen(false)} />
          <div className="ns-menu">
            {options.length === 0 && <div className="ns-empty">No volunteers yet</div>}
            {options.map((v) => (
              <button
                type="button"
                key={v.name}
                className={`ns-item ${v.name === value ? 'active' : ''}`}
                onClick={() => {
                  onChange(v.name);
                  setOpen(false);
                }}
              >
                <span>{v.name}</span>
                {v.role === 'admin' && <span className="badge yes">Admin</span>}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function AdminVolunteers({ user, volunteers, onAdded, flash }) {
  const [f, setF] = useState({ name: '', password: '' });

  async function submit(e) {
    e.preventDefault();
    try {
      await api.addVolunteer({
        name: f.name,
        password: f.password,
      });
      flash('Volunteer added: ' + f.name);
      setF({ name: '', password: '' });
      onAdded();
    } catch (err) {
      flash('Error: ' + err.message);
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Volunteers</h2>
        <span className="count-badge">{volunteers.length}</span>
      </div>
      <div className="vol-list">
        {volunteers.map((v) => (
          <div key={v.name} className="vol-item">
            <span className="vol-name">{v.name}</span>
            {v.role === 'admin' && <span className="badge yes">Admin</span>}
          </div>
        ))}
      </div>
      <form className="walkin-form" onSubmit={submit}>
        <input className="search-input" placeholder="New volunteer name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
        <input className="search-input" placeholder="Password (default: yuvotsav2026)" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
        <button className="btn-primary" type="submit">Add volunteer</button>
      </form>
    </section>
  );
}

function AdminData({ rows, flash }) {
  function exportCsv() {
    const head = ['Name', 'Ward', 'Phone', 'Attending', 'Reason', 'Paid', 'Pay method', 'Checked in', 'Check-in time'];
    const lines = rows.map((r) => [
      r.name, r.ward, r.phone,
      r.attending === 'yes' ? 'Yes' : r.attending === 'no' ? 'No' : '',
      r.reason || '',
      r.paid === 'yes' ? 'Paid' : 'Pending',
      r.paidMethod || '',
      r.checkedIn ? 'Yes' : '',
      r.checkedInAt ? new Date(r.checkedInAt).toLocaleString() : '',
    ]);
    const csv = [head, ...lines]
      .map((row) => row.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'yuvotsav-registrations-' + new Date().toISOString().slice(0, 10) + '.csv';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function syncSheet() {
    const url = CONFIG.SHEET_SYNC_URL + '?sync=1';
    window.open(url, '_blank');
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Data & Backup</h2>
      </div>
      <div className="vol-list">
        <div className="vol-item">
          <span className="vol-name">Registrations</span>
          <span className="count-badge">{rows.length}</span>
        </div>
      </div>
      <div className="pay-options">
        <button type="button" className="action-btn on" onClick={() => { exportCsv(); flash('CSV downloaded'); }}>Download CSV</button>
        <button type="button" className="action-btn on" onClick={() => { syncSheet(); flash('Opening sync… check the new tab'); }}>Sync to Google Sheet</button>
      </div>
      <p className="panel-note">
        Sync copies check-in &amp; payment status to Sheet 2. If it opens a login/blank page, re-publish the Apps Script
        and update <code>config.js</code>.
      </p>
    </section>
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