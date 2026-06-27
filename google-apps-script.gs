const SPREADSHEET_ID = '10qnYnO-JvhGks7LucXEzE-dgvaM6qSH27PukVp9-RVA';
const SHEET_HEADERS = {
  players: ['ID', 'الاسم'],
  matches: ['ID', 'الفريق الأول', 'الفريق الثاني', 'وقت المباراة', 'نتيجة الفريق الأول', 'نتيجة الفريق الثاني'],
  predictions: ['player ID', 'match ID', 'توقع الفريق الأول', 'توقع الفريق الثاني']
};

function doGet(e) {
  return handleRequest_(e);
}

function doPost(e) {
  return handleRequest_(e);
}

function handleRequest_(e) {
  const params = e && e.parameter ? e.parameter : {};
  const action = params.action || 'getData';

  try {
    ensureSheets_();

    if (action === 'getData') {
      return respond_({ ok: true, data: getData_() }, params.callback);
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(30000);

    try {
      const result = runMutation_(action, params);
      return respond_(result, params.callback);
    } finally {
      lock.releaseLock();
    }
  } catch (error) {
    return respond_({ ok: false, error: error.message || String(error) }, params.callback);
  }
}

function runMutation_(action, params) {
  switch (action) {
    case 'ensurePlayer':
      return ensurePlayer_(required_(params.name, 'name'));
    case 'addPlayer':
      return addPlayer_(required_(params.name, 'name'));
    case 'deletePlayer':
      return deletePlayer_(required_(params.playerId, 'playerId'));
    case 'addMatch':
      return addMatch_(required_(params.home, 'home'), required_(params.away, 'away'), required_(params.kickoff, 'kickoff'));
    case 'deleteMatch':
      return deleteMatch_(required_(params.matchId, 'matchId'));
    case 'setResult':
      return setResult_(required_(params.matchId, 'matchId'), params.homeScore, params.awayScore);
    case 'setPrediction':
      return setPrediction_(
        required_(params.playerId, 'playerId'),
        required_(params.matchId, 'matchId'),
        params.home,
        params.away
      );
    default:
      throw new Error('Unsupported action: ' + action);
  }
}

function ensureSheets_() {
  const spreadsheet = SpreadsheetApp.openById(SPREADSHEET_ID);
  Object.keys(SHEET_HEADERS).forEach(function(name) {
    let sheet = spreadsheet.getSheetByName(name);
    if (!sheet) {
      sheet = spreadsheet.insertSheet(name);
    }

    const headers = SHEET_HEADERS[name];
    const currentHeaders = sheet.getRange(1, 1, 1, headers.length).getValues()[0];
    const needsHeaders = headers.some(function(header, index) {
      return currentHeaders[index] !== header;
    });

    if (needsHeaders) {
      sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    }
  });
}

function getData_() {
  return {
    players: readPlayers_(),
    matches: readMatches_(),
    predictions: readPredictions_()
  };
}

function readPlayers_() {
  return readRows_('players', 2).map(function(row) {
    return {
      id: String(row[0] || '').trim(),
      name: String(row[1] || '').trim()
    };
  }).filter(function(player) {
    return player.id && player.name;
  });
}

function readMatches_() {
  return readRows_('matches', 6).map(function(row) {
    return {
      id: String(row[0] || '').trim(),
      home: String(row[1] || '').trim(),
      away: String(row[2] || '').trim(),
      kickoff: String(row[3] || '').trim(),
      homeScore: cellToNullableNumber_(row[4]),
      awayScore: cellToNullableNumber_(row[5])
    };
  }).filter(function(match) {
    return match.id;
  });
}

function readPredictions_() {
  return readRows_('predictions', 4).map(function(row) {
    return {
      playerId: String(row[0] || '').trim(),
      matchId: String(row[1] || '').trim(),
      home: row[2] === null || typeof row[2] === 'undefined' ? '' : String(row[2]),
      away: row[3] === null || typeof row[3] === 'undefined' ? '' : String(row[3])
    };
  }).filter(function(prediction) {
    return prediction.playerId && prediction.matchId;
  });
}

function ensurePlayer_(name) {
  const playersSheet = getSheet_('players');
  const players = readPlayers_();
  const existing = players.find(function(player) {
    return player.name === name;
  });

  if (existing) {
    return { ok: true, player: existing, data: getData_() };
  }

  const player = {
    id: newId_('p'),
    name: name
  };
  playersSheet.appendRow([player.id, player.name]);
  return { ok: true, player: player, data: getData_() };
}

function addPlayer_(name) {
  const existing = readPlayers_().find(function(player) {
    return player.name === name;
  });
  if (existing) {
    throw new Error('الاسم موجود');
  }

  getSheet_('players').appendRow([newId_('p'), name]);
  return { ok: true, data: getData_() };
}

function deletePlayer_(playerId) {
  deleteRowsByMatch_(getSheet_('players'), function(row) {
    return String(row[0] || '').trim() === playerId;
  }, 2);
  deleteRowsByMatch_(getSheet_('predictions'), function(row) {
    return String(row[0] || '').trim() === playerId;
  }, 4);
  return { ok: true, data: getData_() };
}

function addMatch_(home, away, kickoff) {
  getSheet_('matches').appendRow([newId_('m'), home, away, kickoff, '', '']);
  return { ok: true, data: getData_() };
}

function deleteMatch_(matchId) {
  deleteRowsByMatch_(getSheet_('matches'), function(row) {
    return String(row[0] || '').trim() === matchId;
  }, 6);
  deleteRowsByMatch_(getSheet_('predictions'), function(row) {
    return String(row[1] || '').trim() === matchId;
  }, 4);
  return { ok: true, data: getData_() };
}

function setResult_(matchId, homeScore, awayScore) {
  const sheet = getSheet_('matches');
  const rowIndex = findRowIndex_(sheet, 6, function(row) {
    return String(row[0] || '').trim() === matchId;
  });

  if (!rowIndex) {
    throw new Error('المباراة غير موجودة');
  }

  sheet.getRange(rowIndex, 5, 1, 2).setValues([[
    nullableNumberToCell_(homeScore),
    nullableNumberToCell_(awayScore)
  ]]);

  return { ok: true, data: getData_() };
}

function setPrediction_(playerId, matchId, home, away) {
  const sheet = getSheet_('predictions');
  const rowIndex = findRowIndex_(sheet, 4, function(row) {
    return String(row[0] || '').trim() === playerId && String(row[1] || '').trim() === matchId;
  });
  const values = [[playerId, matchId, valueOrEmpty_(home), valueOrEmpty_(away)]];

  if (rowIndex) {
    sheet.getRange(rowIndex, 1, 1, 4).setValues(values);
  } else {
    sheet.appendRow(values[0]);
  }

  return { ok: true, data: getData_() };
}

function readRows_(sheetName, width) {
  const sheet = getSheet_(sheetName);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return [];
  }
  return sheet.getRange(2, 1, lastRow - 1, width).getValues();
}

function getSheet_(name) {
  const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(name);
  if (!sheet) {
    throw new Error('Missing sheet: ' + name);
  }
  return sheet;
}

function findRowIndex_(sheet, width, matcher) {
  const rows = readRows_(sheet.getName(), width);
  for (var index = 0; index < rows.length; index += 1) {
    if (matcher(rows[index])) {
      return index + 2;
    }
  }
  return 0;
}

function deleteRowsByMatch_(sheet, matcher, width) {
  const rows = readRows_(sheet.getName(), width);
  for (var index = rows.length - 1; index >= 0; index -= 1) {
    if (matcher(rows[index])) {
      sheet.deleteRow(index + 2);
    }
  }
}

function required_(value, name) {
  const normalized = String(value || '').trim();
  if (!normalized) {
    throw new Error('Missing parameter: ' + name);
  }
  return normalized;
}

function valueOrEmpty_(value) {
  return value === null || typeof value === 'undefined' ? '' : String(value);
}

function nullableNumberToCell_(value) {
  if (value === '' || value === null || typeof value === 'undefined') {
    return '';
  }
  const parsed = Number(value);
  if (!isFinite(parsed)) {
    throw new Error('القيمة الرقمية غير صالحة');
  }
  return parsed;
}

function cellToNullableNumber_(value) {
  if (value === '' || value === null || typeof value === 'undefined') {
    return null;
  }
  const parsed = Number(value);
  return isFinite(parsed) ? parsed : null;
}

function newId_(prefix) {
  return prefix + '_' + new Date().getTime() + '_' + Math.floor(Math.random() * 1000000);
}

function respond_(payload, callback) {
  const hasCallback = callback && /^[A-Za-z_$][0-9A-Za-z_$\.]*$/.test(callback);
  const body = hasCallback
    ? callback + '(' + JSON.stringify(payload) + ');'
    : JSON.stringify(payload);

  return ContentService
    .createTextOutput(body)
    .setMimeType(hasCallback ? ContentService.MimeType.JAVASCRIPT : ContentService.MimeType.JSON);
}
