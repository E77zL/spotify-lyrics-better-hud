'use strict';
const fs = require('fs');
const path = require('path');

// One writer per file. A crash during the write leaves the last complete JSON intact.
function writeJSON(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = file + '.tmp';
  try {
    fs.writeFileSync(temporary, JSON.stringify(value), 'utf8');
    fs.renameSync(temporary, file);
  } catch (error) {
    try { fs.unlinkSync(temporary); } catch { }
    throw error;
  }
}

module.exports = { writeJSON };
