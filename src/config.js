export default {
  // Same-origin API. Locally, `vercel dev` serves both the app and /api functions
  // (localhost:3000). In production, Vercel serves both on the same domain.
  API_BASE: '',

  // Google Apps Script URL — kept as a legacy fallback / reference only.
  SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwNG41AUrAob2B3o6A3tI0KwkvBZSnUZM96XDUZmtdyMiOPfqOJmeKcCtcTMajHu1PiDw/exec',

  // Apps Script web app used for Sheet 2 sync (?sync=1). Must match the
  // deployment you re-publish after editing appscript.gs.
  SHEET_SYNC_URL: 'https://script.google.com/macros/s/AKfycbwNG41AUrAob2B3o6A3tI0KwkvBZSnUZM96XDUZmtdyMiOPfqOJmeKcCtcTMajHu1PiDw/exec',

  REFRESH_SECONDS: 10,

  // Fallback ward list, used only if the Apps Script doesn't return the
  // ward list in its response. The backend now reads all wards straight
  // from the Google Form's Ward question, so this rarely needs updating.
  WARDS: [
    'Carmel',
    'Christ King',
    'Holy Cross',
    'Immaculate Conception',
    'Infant Jesus',
    'Infant Mary',
    'MRPL',
    'Nithyadar',
    'Sacred Heart',
    'St Anthony',
    'St Francis Xavier',
    'St Joseph',
    'St Jude',
    'St Lawrence',
    'St Sebastian',
    'Holy Family',
  ],
};