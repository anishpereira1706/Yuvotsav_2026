export default {
  // Base URL for the Vercel serverless API. '' = same origin, so on Vercel the
  // app calls /api/... on its own domain. Swap to an absolute URL for local dev.
  API_BASE: '',

  // Google Apps Script URL — kept as a legacy fallback / reference only.
  SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwNG41AUrAob2B3o6A3tI0KwkvBZSnUZM96XDUZmtdyMiOPfqOJmeKcCtcTMajHu1PiDw/exec',

  REFRESH_SECONDS: 30,

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