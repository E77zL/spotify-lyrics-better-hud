'use strict';
const fs = require('fs');
const { writeJSON } = require('./json-file');

// Small scalar settings/bounds only. Coalesce slider/drag bursts and flush on quit.
function createStore(file, defaults, delayMs = 250) {
  let value = { ...defaults }, timer = null, dirty = false;
  try {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) Object.assign(value, saved);
  } catch { /* First launch or an interrupted old settings file. */ }
  function flush() {
    clearTimeout(timer); timer = null;
    if (!dirty) return;
    try { writeJSON(file, value); dirty = false; }
    catch (error) { console.error('Save settings:', error.message); }
  }
  return {
    get: () => ({ ...value }),
    update(patch) {
      if (!Object.keys(patch).some(key => value[key] !== patch[key])) return false;
      Object.assign(value, patch);
      dirty = true;
      clearTimeout(timer); timer = setTimeout(flush, delayMs);
      return true;
    },
    flush,
  };
}

module.exports = { createStore };
