var CONFIG = {
  SHEET_NAME: null,
  SHEET_ID: null,
  COLUMNS: {
    NAME: 'Name',
    PHONE: 'Mobile Number',
    WARD: 'Ward',
    ATTENDING: 'Will be attending',
    REASON: 'Reason if not attending'
  }
};

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

  var payload = {
    success: true,
    updatedAt: new Date().toISOString(),
    sheetName: ss.getName(),
    total: rows.length,
    stats: stats,
    rows: rows
  };

  return jsonResponse(payload);
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

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}
