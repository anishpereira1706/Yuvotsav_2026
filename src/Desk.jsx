import { useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx-js-style';
import CONFIG from './config';
import * as api from './api';
import SuccessOverlay from './SuccessOverlay';

const WARDS = CONFIG.WARDS;

const SUPER_ADMIN = 'Anish Pereira';

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
  const [confirm, setConfirm] = useState(null);
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
      { id: 'duplicates', label: 'Duplicates' },
      { id: 'volunteers', label: 'Volunteers' },
      { id: 'data', label: 'Data & Backup' },
    ];
    return (
      <div className="desk">
        {msg && <div className="toast-top-right">{msg}</div>}
        <div className="admin-shell">
          <aside className="admin-sidebar">
            <div className="admin-sidebar-head">
              <span className="admin-avatar">{getInitials(user.name)}</span>
              <div className="admin-head-meta">
                <span className="admin-head-name">{user.name}</span>
                <span className="admin-head-role">Administrator</span>
              </div>
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
            {adminSection === 'duplicates' && (
              <AdminDuplicates
                rows={rows}
                refresh={refresh}
                flash={flash}
                askConfirm={setConfirm}
                onSuccess={(m) => { setSuccessMsg(m); setSuccess(true); }}
              />
            )}
            {adminSection === 'volunteers' && (
              <AdminVolunteers
                user={user}
                volunteers={volunteers}
                onAdded={loadVolunteers}
                onPatch={(name, patch) => setVolunteers((prev) => prev.map((v) => (v.name === name ? { ...v, ...patch } : v)))}
                onAdd={(v) => setVolunteers((prev) => [...prev, v])}
                flash={flash}
                onSuccess={(m) => { setSuccessMsg(m); setSuccess(true); }}
              />
            )}
            {adminSection === 'data' && <AdminData rows={rows} flash={flash} />}
          </main>
        </div>
        {deskModal}
        <ConfirmDialog confirm={confirm} onClose={() => setConfirm(null)} />
        <SuccessOverlay show={success} message={successMsg} onDone={() => setSuccess(false)} />
      </div>
    );
  }    return (
    <div className="desk">
      {msg && <div className="toast-top-right">{msg}</div>}

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
  const [mode, setMode] = useState('checkedin');
  const [q, setQ] = useState('');
  const [wardF, setWardF] = useState('');
  const query = q.toLowerCase().trim();

  const checkedIn = rows.filter((r) => r.checkedIn);
  const notChecked = rows.filter((r) => !r.checkedIn && r.attending === 'yes');
  const base = mode === 'checkedin' ? checkedIn : notChecked;

  const list = base
    .filter((r) => {
      if (!query) return true;
      const words = `${r.name || ''} ${r.ward || ''} ${r.phone || ''}`.toLowerCase().split(/\s+/).filter(Boolean);
      return query.split(/\s+/).filter(Boolean).every((t) => words.some((w) => w.startsWith(t)));
    })
    .filter((r) => !wardF || (r.ward || '').trim() === wardF)
    .sort((a, b) => new Date(b.checkedInAt || 0) - new Date(a.checkedInAt || 0));

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Check-ins</h2>
        <div className="seg">
          <button className={`seg-btn ${mode === 'checkedin' ? 'on' : ''}`} onClick={() => setMode('checkedin')}>Checked in · {checkedIn.length}</button>
          <button className={`seg-btn ${mode === 'pending' ? 'on' : ''}`} onClick={() => setMode('pending')}>Not checked in · {notChecked.length}</button>
        </div>
      </div>
      <div className="pay-filters">
        <input type="search" className="search-input" placeholder="Search name or phone…" value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="pay-filter-row">
          <span className="filter-label">Ward</span>
          <div className="chips">
            <button className={`chip ${wardF === '' ? 'active' : ''}`} onClick={() => setWardF('')}>All</button>
            {WARDS.map((w) => (
              <button key={w} className={`chip ${wardF === w ? 'active' : ''}`} onClick={() => setWardF(wardF === w ? '' : w)}>{w}</button>
            ))}
          </div>
        </div>
      </div>
      {list.length === 0 ? (
        <p className="empty-hint">
          {query || wardF ? 'No matches for these filters.' : mode === 'checkedin' ? 'No one checked in yet.' : 'Everyone is checked in!'}
        </p>
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
                {r.checkedIn ? <span className="mini-time">{MiniTime(r.checkedInAt)}</span> : null}
                {canUndo && r.checkedIn && <button className="undo-btn" onClick={() => onUndo(r)}>Undo</button>}
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

function WardSelect({ value, options, onChange }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="ns">
      <button type="button" className={`ns-btn ${open ? 'open' : ''}`} onClick={() => setOpen(!open)}>
        <span className={value ? 'ns-val' : 'ns-placeholder'}>{value || 'Ward…'}</span>
        <span className="ns-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <>
          <div className="ns-backdrop" onClick={() => setOpen(false)} />
          <div className="ns-menu">
            {options.map((w) => (
              <button
                type="button"
                key={w}
                className={`ns-item ${w === value ? 'active' : ''}`}
                onClick={() => {
                  onChange(w);
                  setOpen(false);
                }}
              >
                <span>{w}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function ConfirmDialog({ confirm, onClose }) {
  if (!confirm) return null;
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal confirm-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>&times;</button>
        <h3 className="modal-title">{confirm.title}</h3>
        <p className="modal-sub confirm-msg">{confirm.message}</p>
        <div className="confirm-actions">
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button
            className={confirm.danger ? 'undo-btn confirm-btn' : 'btn-primary confirm-btn'}
            onClick={() => { onClose(); confirm.onConfirm(); }}
          >
            {confirm.label || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

function normalizePhone(p) {
  const digits = String(p || '').replace(/\D/g, '');
  // Strip leading country-code 91 (India) to match +91 and bare 91 variants
  return digits.replace(/^91/, '');
}

function AdminDuplicates({ rows, refresh, flash, onSuccess, askConfirm }) {
  const [keeper, setKeeper] = useState({});

  const groups = useMemo(() => {
    const map = {};
    rows.forEach((r) => {
      const norm = normalizePhone(r.phone);
      const key = norm || '(no phone)';
      (map[key] = map[key] || []).push(r);
    });
    return Object.values(map).filter((g) => g.length > 1);
  }, [rows]);

  async function doDelete(row) {
    askConfirm({
      title: 'Delete entry',
      message: 'Delete "' + row.name + '" (' + row.phone + ')? This cannot be undone.',
      label: 'Delete',
      danger: true,
      onConfirm: async () => {
        try {
          await api.deleteDuplicate(row._id);
          onSuccess('Duplicate deleted');
          refresh();
        } catch (err) {
          flash('Error: ' + err.message);
        }
      },
    });
  }

  async function doMerge(group) {
    const key = normalizePhone(group[0].phone) || '(no phone)';
    const keeperId = keeper[key];
    if (!keeperId) {
      flash('Select the row to keep first');
      return;
    }
    const removeIds = group.filter((r) => r._id !== keeperId).map((r) => r._id);
    if (!removeIds.length) {
      flash('Nothing to merge');
      return;
    }
    askConfirm({
      title: 'Merge duplicates',
      message:
        'Merge ' + removeIds.length + ' row(s) into the selected one? The other rows will be deleted and check-in/payment status combined.',
      label: 'Merge',
      danger: true,
      onConfirm: async () => {
        try {
          await api.mergeDuplicates(keeperId, removeIds);
          onSuccess('Merged ' + removeIds.length + ' duplicate(s)');
          refresh();
        } catch (err) {
          flash('Error: ' + err.message);
        }
      },
    });
  }

  if (!groups.length) {
    return (
      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Duplicates</h2>
        </div>
        <p className="empty-hint">No duplicate phones found.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Duplicate entries</h2>
        <span className="count-badge">{groups.length} groups</span>
      </div>
      <p className="panel-note">
        Rows sharing the same phone number. Tap the row to keep, then merge — check-in and payment status are combined into it.
      </p>
{groups.map((group) => {
        const key = normalizePhone(group[0].phone) || '(no phone)';

        return (
          <div key={key} className="dup-group">
            <div className="dup-group-head">
              <span className="dup-phone">{key}</span>
              <span className="count-badge">{group.length} entries</span>
            </div>
            {group.map((r) => (
              <div
                key={r._id}
                className={`card mini-card dup-row ${keeper[key] === r._id ? 'keeper' : ''}`}
                onClick={() => setKeeper({ ...keeper, [key]: r._id })}
              >
                <div className="avatar">{getInitials(r.name)}</div>
                <div className="card-body">
                  <div className="card-name">{r.name}</div>
                  <div className="card-meta">
                    {r.ward && <span>{r.ward}</span>}
                    <span className={`badge ${r.attending === 'yes' ? 'yes' : 'no'}`}>{r.attending === 'yes' ? 'Attending' : 'Not attending'}</span>
                    {r.checkedIn && <span className="badge yes">Checked in</span>}
                    {r.paid === 'yes' && <span className="badge yes">{r.paidMethod || 'Paid'}</span>}
                  </div>
                </div>
                <div className="mini-right">
                  {keeper[key] === r._id && <span className="badge yes">Keep</span>}
                  <button className="undo-btn" onClick={(e) => { e.stopPropagation(); doDelete(r); }}>Delete</button>
                </div>
              </div>
            ))}
            <button className="btn-primary dup-merge" onClick={() => doMerge(group)}>Merge into selected</button>
          </div>
        );
      })}
    </section>
  );
}

function AdminVolunteers({ user, volunteers, onAdded, onPatch, onAdd, flash, onSuccess }) {
  const [f, setF] = useState({ name: '', password: '', role: 'volunteer' });

  async function submit(e) {
    e.preventDefault();
    const role = f.role;
    onAdd({ name: f.name, role, active: true });
    onSuccess('Volunteer added: ' + f.name);
    setF({ name: '', password: '', role: 'volunteer' });
    try {
      await api.addVolunteer({
        name: f.name,
        password: f.password,
        role,
      });
      onAdded();
    } catch (err) {
      onAdded();
      flash('Error: ' + err.message);
    }
  }

  async function toggle(payload) {
    const patch = {};
    if (payload.role) patch.role = payload.role;
    if (payload.active !== undefined) patch.active = payload.active;
    const label = payload.role ? (payload.role === 'admin' ? 'promoted to admin' : 'demoted to volunteer') : payload.active === false ? 'deactivated' : 'activated';
    onPatch(payload.name, patch);
    onSuccess(payload.name + ' ' + label);
    try {
      await api.updateVolunteer(payload);
      onAdded();
    } catch (err) {
      onAdded();
      flash('Error: ' + err.message);
    }
  }

  return (
    <div className="admin-column">
      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Add volunteer</h2>
        </div>
        <form className="walkin-form" onSubmit={submit}>
          <input className="search-input" placeholder="New volunteer name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
          <input className="search-input" placeholder="Password (default: yuvotsav2026)" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          <label className="role-check">
            <input type="checkbox" checked={f.role === 'admin'} onChange={(e) => setF({ ...f, role: e.target.checked ? 'admin' : 'volunteer' })} />
            Make this person an admin
          </label>
          <button className="btn-primary" type="submit">Add volunteer</button>
        </form>
      </section>
      <section className="panel">
        <div className="panel-head">
          <h2 className="panel-title">Volunteers</h2>
          <span className="count-badge">{volunteers.length}</span>
        </div>
        <div className="vol-list">
          {volunteers.map((v) => (
            <div key={v.name} className="vol-card">
              <div className="avatar">{getInitials(v.name)}</div>
              <div className="vol-meta">
                <span className="vol-name">{v.name}</span>
                <span className="vol-sub">
                  <span className={`dot ${v.active === false ? 'off' : ''}`} />
                  {v.active === false ? 'Inactive' : 'Active'}
                  <span className="vol-sep">•</span>
                  {v.role === 'admin' ? 'Admin' : 'Volunteer'}
                </span>
              </div>
              <div className="vol-actions">
                {v.name !== user.name && user.name === SUPER_ADMIN && (
                  <button
                    className="vol-toggle"
                    onClick={() => toggle({ name: v.name, role: v.role === 'admin' ? 'volunteer' : 'admin' })}
                    title={v.role === 'admin' ? 'Demote to volunteer' : 'Promote to admin'}
                  >
                    {v.role === 'admin' ? 'Make volunteer' : 'Make admin'}
                  </button>
                )}
                {v.name !== user.name && !(v.name === SUPER_ADMIN && user.name !== SUPER_ADMIN) && (
                  <button
                    className="vol-toggle"
                    onClick={() => toggle({ name: v.name, active: v.active === false })}
                  >
                    {v.active === false ? 'Activate' : 'Deactivate'}
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function AdminData({ rows, flash }) {
  function buildSheet(data, sheetName, columns) {
    if (!data || data.length === 0) {
      flash('No data to export for this filter');
      return;
    }
    const sorted = [...data].sort((a, b) =>
      String(a.ward || '').localeCompare(String(b.ward || '')) || String(a.name || '').localeCompare(String(b.name || ''))
    );
    const allCols = [
      { key: 'Sl No', fn: (r, i) => i + 1 },
      { key: 'Name', fn: (r) => r.name || '' },
      { key: 'Ward', fn: (r) => r.ward || '' },
      { key: 'Phone', fn: (r) => r.phone || '' },
      { key: 'Attending', fn: (r) => r.attending === 'yes' ? 'Yes' : r.attending === 'no' ? 'No' : '' },
      { key: 'Not Attended', fn: (r) => !r.checkedIn && r.attending === 'yes' ? 'Not Attended' : '' },
      { key: 'Reason', fn: (r) => r.reason || '' },
      { key: 'Paid', fn: (r) => r.paid === 'yes' ? 'Paid' : 'Pending' },
      { key: 'Pay method', fn: (r) => r.paidMethod || '' },
      { key: 'Checked in', fn: (r) => r.checkedIn ? 'Yes' : '' },
    ];
    const cols = columns ? allCols.filter((c) => columns.includes(c.key)) : allCols;
    const wsRows = sorted.map((r, i) => {
      const row = {};
      cols.forEach((c) => { row[c.key] = c.fn(r, i); });
      return row;
    });
    const ws = XLSX.utils.json_to_sheet(wsRows);
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellRef = XLSX.utils.encode_cell({ r: range.s.r, c: C });
      if (ws[cellRef]) {
        ws[cellRef].s = {
          font: { bold: true, color: { rgb: 'FFFFFF' }, sz: 11 },
          fill: { fgColor: { rgb: '7C3AED' } },
          alignment: { horizontal: 'center' },
        };
      }
    }
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const header = ws[XLSX.utils.encode_cell({ r: range.s.r, c: C })];
      if (header && header.v === 'Phone') {
        for (let R = range.s.r + 1; R <= range.e.r; ++R) {
          const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
          if (cell) { cell.t = 's'; cell.z = '@'; }
        }
      }
    }
    const colWidths = Object.keys(wsRows[0] || {}).map((key) => {
      const maxLen = Math.max(key.length, ...wsRows.map((r) => String(r[key] || '').length));
      return { wch: Math.min(maxLen + 2, 30) };
    });
    ws['!cols'] = colWidths;
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);
    const date = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `yuvotsav-${sheetName.toLowerCase().replace(/\s+/g, '-')}-${date}.xlsx`);
  }

  function exportAll() {
    buildSheet(rows, 'All Registrations');
    flash('Excel downloaded');
  }

  function exportAttending() {
    const data = rows.filter((r) => r.attending === 'yes');
    buildSheet(data, 'Attending', ['Sl No', 'Name', 'Ward', 'Phone', 'Attending']);
    flash('Attending list downloaded (' + data.length + ' entries)');
  }

  function exportNotAttending() {
    const data = rows.filter((r) => r.attending === 'no');
    buildSheet(data, 'Not Attending', ['Sl No', 'Name', 'Ward', 'Phone', 'Attending', 'Reason']);
    flash('Not attending list downloaded (' + data.length + ' entries)');
  }

  function exportCheckedIn() {
    const data = rows.filter((r) => r.checkedIn);
    buildSheet(data, 'Event Day Attended');
    flash('Event day attended list downloaded (' + data.length + ' entries)');
  }

  function exportRegisteredNotAttended() {
    const data = rows.filter((r) => r.attending === 'yes' && !r.checkedIn);
    buildSheet(data, 'Registered Not Attended', ['Sl No', 'Name', 'Ward', 'Phone', 'Attending', 'Not Attended']);
    flash('Registered but not attended list downloaded (' + data.length + ' entries)');
  }

  async function syncSheet() {
    const url = CONFIG.SHEET_SYNC_URL + '?sync=1';
    await fetch(url);
  }

  return (
    <>
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
        <button type="button" className="action-btn on" onClick={exportAttending}>✓ Attending</button>
        <button type="button" className="action-btn on" onClick={exportNotAttending}>✗ Not Attending</button>
        <button type="button" className="action-btn on" onClick={exportCheckedIn}>📋 Event Day Attended</button>
        <button type="button" className="action-btn on" onClick={exportRegisteredNotAttended}>⏳ Not Attended</button>
      </div>
      <div className="pay-options" style={{ marginTop: 10 }}>
        <button type="button" className="action-btn on" onClick={exportAll}>Download All (Excel)</button>
      </div>
    </section>
    <section className="panel">
      <div className="panel-head">
        <h2 className="panel-title">Google Sheet Sync</h2>
      </div>
      <div className="pay-options">
        <button type="button" className="action-btn on" onClick={async () => { await syncSheet(); flash('Sync complete!'); }}>Sync to Google Sheet</button>
      </div>
      <p className="panel-note">
        Sync copies check-in &amp; payment status to Sheet 2.
      </p>
    </section>
    </>
  );
}

function Walkin({ user, ward, flash, onDone }) {
  const [open, setOpen] = useState(false);
  const [success, setSuccess] = useState(false);
  const [f, setF] = useState({ name: '', phone: '', ward: ward, method: '' });

  async function submit(e) {
    e.preventDefault();
    try {
      await api.walkin({
        name: f.name,
        phone: f.phone,
        ward: f.ward,
        method: f.method,
        autoCheckin: true,
        volunteer: user.name,
      });
      setF({ name: '', phone: '', ward: ward, method: '' });
      setOpen(false);
      setSuccess(true);
      onDone();
    } catch (err) {
      flash('Error: ' + err.message);
    }
  }

  return (
    <div className="walkin">
      <button className="btn-primary" onClick={() => setOpen(true)}>
        + Add walk-in
      </button>
      <SuccessOverlay show={success} message="Walk-in added!" onDone={() => setSuccess(false)} />
      {open && (
        <div className="modal-backdrop" onClick={() => setOpen(false)}>
          <div className="modal walkin-modal" onClick={(e) => e.stopPropagation()}>
            <button className="modal-close" onClick={() => setOpen(false)}>&times;</button>
            <h3 className="modal-title">Add walk-in</h3>
            <form className="walkin-form" onSubmit={submit}>
          <input className="search-input" placeholder="Name" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} required />
          <input className="search-input" placeholder="Phone" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} required />
          <WardSelect value={f.ward} options={WARDS} onChange={(w) => setF({ ...f, ward: w })} />
          <div className="pay-options">
            <button type="button" className={`action-btn ${f.method === 'cash' ? 'on' : ''}`} onClick={() => setF({ ...f, method: 'cash' })}>Cash</button>
            <button type="button" className={`action-btn ${f.method === 'gpay' ? 'on' : ''}`} onClick={() => setF({ ...f, method: 'gpay' })}>GPay</button>
            <button type="button" className={`action-btn ${f.method === '' ? 'on' : ''}`} onClick={() => setF({ ...f, method: '' })}>Pending</button>
          </div>
          <button className="btn-primary" type="submit">Save</button>
          </form>
          </div>
        </div>
      )}
    </div>
  );
}