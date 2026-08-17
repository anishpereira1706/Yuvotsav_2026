# Yuvotsav 2026 - Live Registration Tracker

A mobile-first **React** web app that shows live registration stats and the full
list of registrations from your Google Form (linked to a Google Sheet).

## How it works

```
Google Form → Google Sheet → Apps Script (JSON API) → This React app
```

Volunteers open the website on their phone, and it auto-refreshes every 15
seconds, showing live totals, ward-wise progress, and every registration
(searchable + filterable by ward).

## Project structure

| Path | Purpose |
|------|---------|
| `src/App.jsx` | Main page (stats, ward progress, search, filters) |
| `src/components/` | StatCards, WardProgress, RegistrationList |
| `src/config.js` | **Your Apps Script URL** and refresh interval |
| `src/index.css` | Styling (mobile-first, clean white theme) |
| `appscript.gs` | Google Apps Script code (paste into Google Sheets) |

## Step 1 - Deploy the Apps Script (the data source)

1. Open the Google Sheet that your registration form is linked to.
2. Click **Extensions → Apps Script**.
3. Delete any code in the editor, paste the entire contents of `appscript.gs`.
4. Click **Deploy → New deployment**.
5. Click the gear icon, select type **Web app**.
6. Set:
   - **Execute as:** Me
   - **Who has access:** Anyone
7. Click **Deploy**, then **Allow** permissions when asked.
8. Copy the **Web app URL** (looks like `https://script.google.com/macros/s/.../exec`).

The script auto-detects these columns: Name, Mobile Number, Ward,
Will be attending, Reason if not attending. Timestamp and Score are ignored.

## Step 2 - Add the URL to the app

1. Open `src/config.js`.
2. Paste the URL:

```js
export default {
  SCRIPT_URL: 'https://script.google.com/macros/s/YOUR_ID/exec',
  REFRESH_SECONDS: 15,
};
```

## Step 3 - Run locally

```bash
npm install
npm run dev
```

Open the printed URL (usually `http://localhost:5173`).

## Step 4 - Host on Vercel

1. Push this folder to a GitHub repository.
2. Go to [vercel.com](https://vercel.com), click **Add New → Project**, and import the repo.
3. Vercel detects it as a Vite project and builds/deploys automatically.
4. Share the Vercel URL with your volunteers.

## Notes

- No password protection - anyone with the link can see the data.
  Add protection later if needed.
- Refresh interval is controlled by `REFRESH_SECONDS` in `src/config.js`.