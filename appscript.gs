var CONFIG = {
  SHEET_NAME: null,
  SHEET_ID: null,
  DESK_SHEET: 'Desk Data',
  COLUMNS: {
    NAME: 'Name',
    PHONE: 'Mobile Number',
    WARD: 'Ward',
    ATTENDING: 'Will be attending',
    REASON: 'Reason if not attending'
  }
};

var DESK_HEADERS = [
  'Name', 'Mobile No', 'Ward', 'Attending', 'Reason if not attending',
  'Checked in', 'Payment status', 'Pay method'
];

function doGet(e) {
  var ss = getSheet();
  var data = ss.getDataRange().getValues();
  var headers = data[0].map(function (h) { return String(h).trim(); });

  var colIdx = mapColumns(headers);

  var rows = [];
  for (var i = 1; i < data.length; i++) {
    var r = data[i];
    var attending = clean(r[colIdx.ATTENDING]);
    var isAttending = isYes(attending);

    rows.push({
      name: clean(r[colIdx.NAME]),
      phone: cleanPhone(r[colIdx.PHONE]),
      ward: clean(r[colIdx.WARD]),
      attending: isAttending ? 'yes' : 'no',
      attendingRaw: attending,
      reason: clean(r[colIdx.REASON])
    });
  }

  var stats = buildStats(rows);
  var wards = getWardList();

  var payload = {
    success: true,
    updatedAt: new Date().toISOString(),
    sheetName: ss.getName(),
    total: rows.length,
    stats: stats,
    wards: wards,
    rows: rows
  };

  return jsonResponse(payload);
}

// Full ward list: first try the Google Form's Ward question (the single
// source of truth for all wards), then fall back to a "Wards" tab in the
// spreadsheet if one exists. Used to spot wards that haven't started yet.
// Every step is guarded so a failure here can never break the API.
function getWardList() {
  try {
    return getWardChoicesFromForm() || getWardsFromSheet() || [];
  } catch (e) {
    return [];
  }
}

function getWardChoicesFromForm() {
  try {
    var url = SpreadsheetApp.getActiveSpreadsheet().getFormUrl();
    if (!url) return null;
    var form = FormApp.openByUrl(url);

    var items = form.getItems();
    for (var i = 0; i < items.length; i++) {
      var item = items[i];
      var title = String(item.getTitle() || '').toLowerCase();
      if (title.indexOf('ward') === -1) continue;

      var choices = null;
      var type = item.getType();
      if (type === FormApp.ItemType.LIST) {
        choices = item.asListItem().getChoices();
      } else if (type === FormApp.ItemType.MULTIPLE_CHOICE) {
        choices = item.asChoiceItem().getChoices();
      }
      if (!choices || !choices.length) continue;

      var names = [];
      for (var j = 0; j < choices.length; j++) {
        names.push(choices[j].getValue());
      }
      return names;
    }
  } catch (e) {
    return null;
  }
  return null;
}

function getWardsFromSheet() {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var tabNames = ['Wards', 'Ward List', 'Ward'];
    for (var i = 0; i < tabNames.length; i++) {
      var sheet = ss.getSheetByName(tabNames[i]);
      if (!sheet) continue;
      var values = sheet.getDataRange().getValues();
      var out = [];
      for (var j = 0; j < values.length; j++) {
        var v = clean(values[j][0]);
        if (v) out.push(v);
      }
      return out;
    }
  } catch (e) {
    return null;
  }
  return null;
}

function getSheet() {
  if (CONFIG.SHEET_ID) {
    return SpreadsheetApp.openById(CONFIG.SHEET_ID);
  }
  if (CONFIG.SHEET_NAME) {
    var ss = SpreadsheetApp.getActiveSpreadsheet();
    var sheet = ss.getSheetByName(CONFIG.SHEET_NAME);
    if (sheet) return sheet;
    return ss.getSheets()[0];
  }
  return SpreadsheetApp.getActiveSpreadsheet().getSheets()[0];
}

function mapColumns(headers) {
  var result = {
    NAME: -1,
    PHONE: -1,
    WARD: -1,
    ATTENDING: -1,
    REASON: -1
  };
  var fields = {
    NAME: CONFIG.COLUMNS.NAME,
    PHONE: CONFIG.COLUMNS.PHONE,
    WARD: CONFIG.COLUMNS.WARD,
    ATTENDING: CONFIG.COLUMNS.ATTENDING,
    REASON: CONFIG.COLUMNS.REASON
  };

  for (var i = 0; i < headers.length; i++) {
    var lower = headers[i].toLowerCase();
    for (var key in fields) {
      if (result[key] !== -1) continue;
      var target = String(fields[key]).toLowerCase();
      if (lower === target) {
        result[key] = i;
      }
    }
  }

  var keywords = {
    NAME: ['name', 'full name', 'your name'],
    PHONE: ['phone', 'mobile', 'contact', 'whatsapp', 'number'],
    WARD: ['ward'],
    ATTENDING: ['attend', 'coming', 'participat', 'join', 'present'],
    REASON: ['reason', 'why']
  };

  for (var j = 0; j < headers.length; j++) {
    var h = headers[j].toLowerCase();
    for (var key2 in keywords) {
      if (result[key2] !== -1) continue;
      for (var k = 0; k < keywords[key2].length; k++) {
        var kw = keywords[key2][k];
        if (kw === 'attend' && h.indexOf('reason') !== -1) continue;
        if (h.indexOf(kw) !== -1) {
          result[key2] = j;
          break;
        }
      }
    }
  }
  return result;
}

function buildStats(rows) {
  var stats = {
    total: rows.length,
    attending: 0,
    notAttending: 0,
    unknown: 0,
    wards: {}
  };
  rows.forEach(function (r) {
    if (r.attending === 'yes') stats.attending++;
    else if (r.attending === 'no') stats.notAttending++;
    else stats.unknown++;

    if (r.ward) {
      if (!stats.wards[r.ward]) stats.wards[r.ward] = { total: 0, attending: 0 };
      stats.wards[r.ward].total++;
      if (r.attending === 'yes') stats.wards[r.ward].attending++;
    }
  });
  return stats;
}

function isYes(v) {
  if (!v) return null;
  var s = String(v).toLowerCase();
  return s === 'yes' || s === 'y' || s === 'true' || s === 'attending' ||
         s === 'will attend' || s.indexOf('yes') === 0;
}

function clean(v) {
  if (v === null || v === undefined) return '';
  return String(v).trim();
}

function cleanPhone(v) {
  var s = clean(v);
  s = s.replace(/[^\d+]/g, '');
  return s;
}

// ---------- Desk Data sheet (Sheet 2) ----------

// Trigger: fires automatically when a new form response is submitted.
// Updates the sorted "Desk Data" sheet (keeps manual desk marks intact).
function onFormSubmit(e) {
  try {
    var values = e.values || [];
    if (!values.length) return;
    var headers = getSheet().getDataRange().getValues()[0];
    var col = mapColumns(headers);
    var row = {
      ward: clean(values[col.WARD]),
      name: clean(values[col.NAME]),
      phone: cleanPhone(values[col.PHONE]),
      attending: isYes(clean(values[col.ATTENDING])) ? 'Yes' : 'No',
      reason: clean(values[col.REASON])
    };
    if (!row.phone && !row.name) return;
    upsertDeskRow(row);
  } catch (err) {
    Logger.log('onFormSubmit error: ' + err);
  }
}

// Create the "Desk Data" sheet if it doesn't exist, with headers.
function ensureDeskSheet() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(CONFIG.DESK_SHEET);
  if (!sheet) {
    sheet = ss.insertSheet(CONFIG.DESK_SHEET);
    sheet.getRange(1, 1, 1, DESK_HEADERS.length).setValues([DESK_HEADERS]);
    sheet.setFrozenRows(1);
  } else if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, DESK_HEADERS.length).setValues([DESK_HEADERS]);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// Insert or update one person in the desk sheet (matched by phone), then re-sort.
function upsertDeskRow(row) {
  var sheet = ensureDeskSheet();
  var data = sheet.getDataRange().getValues();
  var idx = {};
  data[0].forEach(function (h, i) { idx[String(h).trim().toLowerCase()] = i; });

  var found = -1;
  for (var i = 1; i < data.length; i++) {
    if (cleanPhone(data[i][idx['phone']]) === row.phone) { found = i; break; }
  }

  if (found !== -1) {
    var existing = data[found].slice();
    existing[idx['ward']] = row.ward;
    existing[idx['name']] = row.name;
    existing[idx['attending']] = row.attending;
    existing[idx['reason']] = row.reason;
    sheet.getRange(found + 1, 1, 1, existing.length).setValues([existing]);
  } else {
    var newRow = [
      row.name, row.phone, row.ward, row.attending, row.reason,
      '', '', ''
    ];
    sheet.appendRow(newRow);
  }

  sortDeskSheet();
}

// Sort desk sheet by Ward, then Name (keeps header row fixed).
function sortDeskSheet() {
  var sheet = ensureDeskSheet();
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var wardCol = 1, nameCol = 2;
  headers.forEach(function (h, i) {
    var l = String(h).trim().toLowerCase();
    if (l === 'ward') wardCol = i + 1;
    if (l === 'name') nameCol = i + 1;
  });
  var lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn())
      .sort([{ column: wardCol, ascending: true }, { column: nameCol, ascending: true }]);
  }
}

// Manual one-time full rebuild of the desk sheet from all form responses.
// Preserves existing desk marks (paid / checked-in) by matching on phone.
function rebuildDeskSheet() {
  var sheet = ensureDeskSheet();
  var formData = getSheet().getDataRange().getValues();
  var col = mapColumns(formData[0]);

  var existing = {};
  var dData = sheet.getDataRange().getValues();
  var dIdx = {};
  dData[0].forEach(function (h, i) { dIdx[String(h).trim().toLowerCase()] = i; });
  for (var k = 1; k < dData.length; k++) {
    existing[cleanPhone(dData[k][dIdx['phone']])] = dData[k];
  }

  var rows = [];
  for (var i = 1; i < formData.length; i++) {
    var r = formData[i];
    var phone = cleanPhone(r[col.PHONE]);
    var prior = existing[phone] || null;
    rows.push([
      clean(r[col.NAME]),
      phone,
      clean(r[col.WARD]),
      isYes(clean(r[col.ATTENDING])) ? 'Yes' : 'No',
      clean(r[col.REASON]),
      prior ? prior[dIdx['checked in']] : '',
      prior ? prior[dIdx['payment status']] : '',
      prior ? prior[dIdx['pay method']] : ''
    ]);
  }

  sheet.getRange(1, 1, sheet.getMaxRows(), sheet.getMaxColumns()).clearContent();
  if (rows.length) {
    sheet.getRange(1, 1, 1, DESK_HEADERS.length).setValues([DESK_HEADERS]);
    sheet.getRange(2, 1, rows.length, DESK_HEADERS.length).setValues(rows);
  }
  sortDeskSheet();
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
