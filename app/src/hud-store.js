'use strict';
const fs = require('fs');

// Small scalar settings/bounds only. Coalesce slider/drag bursts and flush on quit.
function createStore(file, defaults, delayMs = 250) {
  let value = { ...defaults }, timer = null;
  try {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) Object.assign(value, saved);
  } catch { /* First launch or an interrupted old settings file. */ }
  function flush() {
    if (timer === null) return;
    clearTimeout(timer); timer = null;
    try { fs.writeFileSync(file, JSON.stringify(value), 'utf8'); }
    catch (error) { console.error('Save settings:', error.message); }
  }
  return {
    get: () => ({ ...value }),
    update(patch) {
      if (!Object.keys(patch).some(key => value[key] !== patch[key])) return false;
      Object.assign(value, patch);
      clearTimeout(timer); timer = setTimeout(flush, delayMs);
      return true;
    },
    flush,
  };
}

module.exports = { createStore };
