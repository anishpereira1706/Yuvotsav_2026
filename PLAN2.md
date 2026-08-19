# Yuvotsav 2026 — Plan 2 · Revised Architecture

> **Event:** Sunday, August 23, 2026 · Church Youth Day
> **Expected crowd:** 70–100 people · **Prepared by:** Anish Pereira
> **Status:** Updated plan (supersedes original `PLAN.md` approach)

---

## 1. Why this plan exists

The original plan used one Apps Script web app that every device polled. With
**5–6 desk volunteers + laptop** all hitting the same Apps Script every 15–30s,
the **Google Apps Script daily quota** (≈90 min runtime / day on a free account)
would be exhausted mid-event, causing errors.

**Fix:** make the flow **event-driven** and route all live reads/writes through
**MongoDB**. Apps Script now runs only when a form is filled (a trigger) and for
the occasional backup — not per-device polling.

---

## 2. System overview

```
  User fills Google Form
        │  onFormSubmit trigger (event-driven, no polling)
        ▼
  Google Sheet 1 (Form Responses, raw)
        │
        ▼  Apps Script rebuilds + pushes
  Google Sheet 2 (Desk Data, cleaned + sorted)  ──►  Vercel /api/form-submit  ──►  MongoDB
                                                                                      ▲
  Volunteers open Vercel site ──► /api/data (read) ──────────────────────────────────┤
  Volunteers check-in / pay / walk-in ──► /api (write) ───────────────────────────────┤
                                                                                      │
  Laptop ──► npm run backup (every 60s) ──► pulls data ──► Excel offline file          │
                                          └──► pushes MongoDB desk marks back to Sheet 2
```

**Key principle:** MongoDB is the **live source of truth** for the desk.
Google Sheets (Sheet 2) + the laptop Excel file are the **offline / backup copies**.

---

## 3. Data layers

| Layer | Role | Managed by |
|---|---|---|
| **Sheet 1 — Form Responses** | Raw intake, untouched | Google Form |
| **Sheet 2 — Desk Data** | Cleaned, sorted desk copy | Apps Script (onFormSubmit) + backup sync |
| **Sheet 3 — Volunteers** | Name + password for login | Anish (created once) |
| **MongoDB** | Live runtime store (all reads/writes) | Vercel /api functions |
| **Laptop Excel** | Offline backup copy | `npm run backup` |

---

## 4. Sheet 2 — Desk Data schema

| # | Column | Source | Example |
|---|---|---|---|
| 1 | Ward | Form | Carmel |
| 2 | Name | Form | Rahul |
| 3 | Phone | Form | 9876543210 |
| 4 | Attending | Form | Yes / No |
| 5 | Reason | Form (if not attending) | — |
| 6 | Paid | Desk | Yes / No / – |
| 7 | Method | Desk | Cash / GPay / – |
| 8 | Paid time | Desk | timestamp |
| 9 | Paid by | Desk | volunteer name |
| 10 | Checked-in | Desk | Yes / No / – |
| 11 | Checked-in time | Desk | timestamp |
| 12 | Checked-in by | Desk | volunteer name |

- **Sorted** by Ward, then Name.
- Rows matched to Sheet 1 **by phone number** so manual desk marks are **never wiped**
  when new form data arrives.

---

## 5. Event-driven data flow

1. **User fills form** → lands in Sheet 1.
2. **`onFormSubmit` trigger** (Apps Script) fires instantly and:
   - Rebuilds/inserts the row in **Sheet 2** (cleaned + sorted).
   - POSTs the new record to **Vercel `/api/form-submit`**, which upserts it into
     **MongoDB** (matched by phone).
3. **Volunteers** open the Vercel site:
   - Reads come from **MongoDB** via `/api/data` (never from Google).
   - Check-in / payment / walk-in go through `/api` writes into **MongoDB**.
4. **Laptop backup** (`npm run backup`, every 60s):
   - Pulls the full dataset → writes the **Excel offline file**.
   - Pushes MongoDB desk marks back into **Sheet 2** (matched by phone) so the sheet
     stays a complete offline copy.

---

## 6. Components to build

### A. Google Apps Script (`appscript.gs` — update existing)
- `onFormSubmit(e)` — rebuild Sheet 2 + POST webhook to Vercel `/api/form-submit`.
- `doGet` — serve Sheet 2 full data (used **only** by the laptop backup).
- `doPost` — optional; desk writes go through Vercel/MongoDB instead.

### B. Vercel serverless backend (`/api/*`)
- `GET /api/data` — read MongoDB → serve tracker + desk.
- `POST /api/form-submit` — webhook from onFormSubmit → upsert MongoDB.
- `POST /api/checkin` — mark checked-in (+ who/when).
- `POST /api/pay` — mark paid with method (+ who/when).
- `POST /api/walkin` — add walk-in registration.
- `POST /api/login` — verify volunteer password (server-side).
- `POST /api/sync-back` — push MongoDB → Sheet 2 (called by laptop backup).

### C. MongoDB Atlas (free M0)
- Collection `registrations`, keyed/upserted by **phone**.

### D. Laptop backup (`npm run backup`)
- Node script: fetch data → write **Excel** (`.xlsx`) every 60s.
- Calls `/api/sync-back` to keep Sheet 2 in sync.

### E. React app (`src/config.js`)
- Point `SCRIPT_URL` (and new desk endpoints) at the **Vercel `/api`** routes instead of
  the Apps Script URL.

---

## 7. Volunteer login

- Pre-selected volunteers (Sheet 3: name + password).
- Login: pick name from dropdown → password → verified **server-side** by `/api/login`
  against Sheet 3 / MongoDB.
- Every action tagged with the volunteer's name (audit trail).

---

## 8. Desk actions (write flow)

| Action | Vercel endpoint | Notes |
|---|---|---|
| Check-in | `/api/checkin` | Guarded against double check-in |
| Mark paid (Cash/GPay) | `/api/pay` | Records method + who/when |
| Walk-in | `/api/walkin` | Appends new row, optional auto check-in |

---

## 9. Offline / backup

- **Laptop Excel** refreshed every 60s — always a recent full copy on disk.
- **Sheet 2** mirrors live state via `/api/sync-back`.
- If internet drops: volunteers can open the laptop's local copy; sync returns when
  internet is back. (No separate hotspot hub required.)

---

## 10. Quota impact

| Component | Execution frequency |
|---|---|
| `onFormSubmit` | Once per form fill (~100/day) |
| `doGet` (backup) | Every 60s from the laptop (1 device only) |
| `/api/*` (Vercel) | Serves all 6 volunteers — hits **MongoDB**, not Google |
| MongoDB | No per-request quota; handles concurrent clients fine |

Apps Script load drops from "6–7 devices × 30s" to **~1 logical poller + ~100 form
events/day** → safely under quota.

---

## 11. Prerequisites / setup needed from Anish

1. Create a **free MongoDB Atlas** M0 cluster → add a DB user → whitelist IPs →
   copy the connection string into a `.env` file.
2. Add the `onFormSubmit` trigger to the Apps Script project.
3. Deploy the Vercel `/api` functions.
4. Migrate existing Sheet 1 rows into Sheet 2 + MongoDB (initial seed).

---

## 12. Build order

1. **Data layer:** Sheet 2 auto-build + sorting (Apps Script).
2. **MongoDB:** Atlas cluster + connection + migration of existing data.
3. **Vercel backend:** `/api` read/write functions.
4. **Apps Script triggers:** `onFormSubmit` webhook → MongoDB.
5. **React app:** point tracker + desk at `/api`.
6. **Laptop backup:** `npm run backup` → Excel + Sheet 2 sync.
7. **Desk UI:** login, check-in, pay, walk-in (responsive).
8. **Rehearsal:** full dry run before event day.

---

## 13. Open decisions (defaults chosen, change if needed)

- Excel backup cadence: **every 60s**.
- Form intake: **onFormSubmit event-driven** (no polling).
- Desk marks written back to **Sheet 2** during backup sync.
- Sort order: **Ward, then Name**.
- Sheet 2 columns: the **12 fields** listed in §4.
