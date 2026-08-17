# Yuvotsav 2026 — Complete Project Plan

> **Event:** Sunday, August 23, 2026 · Church Youth Day
> **Expected crowd:** 70–100 people
> **Prepared by:** Anish Pereira

---

## 1. Vision

A live registration & desk-management system for Yuvotsav 2026:

- **Volunteers** see live stats and registrations on their phones.
- A **Registration Desk** page handles check-in, payments (cash / GPay),
  and walk-in registrations on event day.
- **One responsive page** — compact on phones, full dashboard on the laptop.
- **Online-first** (no WiFi in the hall → volunteers use mobile data),
  with a **laptop backup server** as an offline safety net.

---

## 2. System Overview

```
Google Form
   └──► Google Sheet (cloud, source of truth)
            ├── Tab 1: Form Responses (raw, untouched)
            ├── Tab 2: Check-in / Payments (desk data)
            └── Tab 3: Volunteers (names + passwords)
                    ▲
Apps Script (backend / bridge)
   │  read + write, password-verified, audit trail
   ├──► Vercel web app (React + Vite)
   │        ├── 📊 Live Tracker      (public)
   │        └── 🗂️ Registration Desk (password)
   └──► Laptop server
            ├── Continuous backup (every 60s → local Excel)
            └── Offline hub (hotspot fallback, syncs back)
```

**Key principle:** Google Sheet stays the single source of truth.
The laptop is a live mirror + backup, never a replacement.

**Backend architecture:** ONE Apps Script web app (same URL, already deployed).
`doGet` serves reads (tracker + backup), `doPost` handles writes
(check-in, payment, walk-in, login verification). No second script.

---

## 3. Technology Stack

| Layer | Technology | Why |
|---|---|---|
| Frontend | React + Vite | Fast, component-based, mobile-first |
| Hosting | Vercel (via GitHub) | Free, auto-deploys from repo |
| Backend | Google Apps Script | Free, reads/writes the sheet, acts as secure API |
| Data | Google Sheets | Already in use, cloud-hosted, free |
| Offline backup | Node script on laptop | 60s refresh → local Excel file |
| Database (MongoDB) | ❌ NOT used | Offline-sync product was discontinued; overkill for this event |

---

## 4. Two Entry Points (Landing Page)

```
┌──────────────────────────────────┐
│          Yuvotsav 2026            │
│  ┌────────────┐  ┌─────────────┐ │
│  │ 📊 Live    │  │ 🗂️ Registration│ │
│  │ Tracker    │  │ Desk         │ │
│  │ (public)   │  │ (password)   │ │
│  └────────────┘  └─────────────┘ │
└──────────────────────────────────┘
```

- **Live Tracker** — the existing page (stats, ward progress, searchable list). Public.
- **Registration Desk** — the new page. Requires volunteer login.

---

## 5. Volunteer Login

- Volunteers are **pre-selected** by Anish (not random).
- Login flow:
  1. Select your **name from a dropdown**
  2. Enter **password** (simple; default `yuvotsav2026`)
  3. Sign in
- The password is **verified server-side by the Apps Script**
  (real security — not just hidden in the frontend).
- Every action is **tagged with the volunteer's name** for a full audit trail.

---

## 6. Registration Desk Page (One Responsive Page)

Same page, adapts by screen size:

### On Phone (compact)
- Large search bar (name / phone)
- One person card at a time, big tap buttons
- Sticky bottom action bar

### On Laptop (full dashboard)
Everything visible at once:
- Big totals: Registered · Checked in · Paid · Remaining
- Ward breakdown grid
- **Live check-in feed** (rolling: "12:34 · Rahul checked in by Aju · Cash ₹100")
- Cash vs GPay tally
- Full person list + search
- Backup status indicator ("✓ Backup saved 12:34:01")

### Search & selection flow
- **Live pattern matching** as you type — matches name *and* phone
  (partial typing: "rah" → Rahul, "9876" → that phone number)
- Each result shows **name + ward + phone** so duplicate names are distinguishable
- **Ward filter dropdown** to narrow results to one ward at a time
- Tap a result → person action card

### Person action card
- Name, ward, phone (call + copy buttons)
- **Check-in status:** tap to check in (guarded against double check-in)
- **Payment:** tap Cash or GPay to mark paid with method
- Shows audit trail of last action (who + when)

### Walk-in fallback
- If search finds no match → **auto walk-in** option appears, name pre-filled
- Fields: Name, Phone, Ward (dropdown), Paid? (no / cash / gpay)
- Optionally auto-check-in on save; appears in list instantly

### Person card
- Name, ward, phone (tap-to-call + copy)
- **Paid / Not paid** badge (with method: cash / GPay)
- **Checked in / Not yet** status
- Buttons: **✔ Check in** · **💰 Mark paid**

---

## 7. Desk Actions (Write Flow)

| Action | Apps Script does | Guard |
|---|---|---|
| **Check in** | Writes checked-in + timestamp + volunteer | No double check-in |
| **Mark paid** | Writes paid + method (cash/GPay) + timestamp + volunteer | Tally per volunteer possible |
| **Walk-in** | Appends new row (name, phone, ward, attending, paid) | Validates required fields |

- All writes **require the password** — fakes rejected by the server.
- Google Sheet updates → all devices see it within ~15s (auto-refresh).

---

## 8. Payment Model

- Fee collected via **common GPay QR code** (displayed at desk) **or cash**.
- **All volunteers** may mark payments.
- Flow:
  - GPay: person scans QR → pays → volunteer marks **Paid ✓ GPay**
  - Cash: volunteer collects → marks **Paid ✓ Cash**
- Payment status shown on every registration card.

---

## 9. Walk-in Registration

- Allowed. Big **"+ Add walk-in"** button on the desk page.
- Fields: Name, Phone, Ward (dropdown), Paid? (yes/no + method).
- Auto check-in on creation + saved to sheet instantly.
- Appears in the live list immediately.

---

## 10. Data Layer (Sheets)

| Tab | Contents | Managed by |
|---|---|---|
| **Sheet 1** | Form responses (raw) | Google Form — untouched |
| **Sheet 2** | Desk data: Ward, Name, Phone, Attending, Paid?, Method, Checked-in, timestamps | Apps Script auto-builds + volunteers update |
| **Sheet 3** | Volunteers: name, password, role | Anish — created once |

**Critical rule:** When Sheet 2 is auto-refreshed, rows are matched **by phone
number** so manual marks (paid / checked-in) are **never wiped**.

---

## 11. Continuous Backup (Laptop)

- A Node script (`npm run backup`) runs on the laptop.
- Every **60 seconds** it fetches all data from the Apps Script and writes a
  **local Excel file** (form data + check-ins + payments).
- Laptop always holds a recent complete offline copy.
- If internet dies → open the Excel file, you have everything up to the last minute.

---

## 12. Offline Fallback (Safety Net)

### What "offline" means here
No WiFi in the hall. Volunteers use **mobile data** for the online path.
If data/internet drops, the desk must keep working — the **laptop** is the fallback.

### Three offline features
1. **Live local backup** — laptop writes a fresh Excel copy every 60s
   (always have the latest data on disk, even with no internet).
2. **Laptop as offline hub** — laptop runs a local server + hosts a
   **WiFi hotspot**. If internet dies, volunteers connect to the laptop's
   WiFi instead of mobile data, open the laptop's local URL, and
   **check-ins / payments / walk-ins keep working** — all saved locally.
3. **One-button sync back** — when internet returns, offline changes are
   pushed up to the Google Sheet, so the cloud is whole again.

### What works when offline
| Feature | Online | Offline (laptop hub) |
|---|---|---|
| View stats & list | ✅ | ✅ (laptop mirror) |
| Check-in | ✅ | ✅ saved locally |
| Payment (cash/GPay) | ✅ | ✅ saved locally |
| Walk-in | ✅ | ✅ saved locally |
| Live cross-device sync | ✅ (~15s) | ✅ on laptop's local network |

### Sync rule
Phone or laptop writes → if internet OK → straight to Google Sheet.
If no internet → saved to laptop's local store → synced up later by button.
No data loss; laptop is always the fallback recorder.

---

## 13. Team Roles on Event Day

| Role | Device | Can do |
|---|---|---|
| Anish | Laptop | Full dashboard, monitoring, backup, all actions |
| Volunteers (2–3) | Phones | Check-in, payments (cash/GPay), walk-ins |

- Payments by all volunteers (QR + cash), per the decision above.

---

## 14. Build Order (Phases)

### Phase 1 — Get online
1. Deploy to Vercel → live URL
2. Landing page (2 entries: Tracker / Desk)

### Phase 2 — Data + backend
3. Sheet 2 auto-build (sorted by ward, preserves manual marks)
4. Volunteers tab (names + passwords)
5. Apps Script writes: check-in, payment (cash/GPay), walk-in
   — password + volunteer verified, no double check-in

### Phase 3 — Desk experience
6. Volunteer login (name dropdown + password)
7. Responsive desk page: search → check-in / pay / walk-in, live desk stats
8. Walk-in button

### Phase 4 — Laptop hub (offline)
9. Laptop server: 60s **continuous backup** → local Excel file
10. Laptop **offline hub**: local server + WiFi hotspot for fallback
11. **One-button sync** of offline changes back to the Google Sheet
12. Monitoring dashboard (live feed, ward grid, cash/GPay tally, backup status)

### Phase 5 — Test
13. Full rehearsal before event day (real phones, same-day dry run)

---

## 15. Open Decisions / Notes

- Default desk password: `yuvotsav2026` (changeable in config).
- Backup interval: 60 seconds.
- MongoDB: not used (offline sync discontinued; cloud DB doesn't help offline).
- No WiFi in the hall → volunteers use mobile data for the online path.

---

## 16. Timeline

| When | What |
|---|---|
| Now – Thu | Phase 1 + 2 (Vercel, data layer, Apps Script writes) |
| Fri | Phase 3 (desk experience) |
| Sat | Phase 4 (laptop hub + offline) + full rehearsal |
| Sun, Aug 23 | GO live 🎉 |
