'use strict';
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), os = require('os'), vm = require('vm');
const { writeJSON } = require('../app/src/json-file');
const { createStore } = require('../app/src/hud-store');
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'hud-storage-'));
const file = path.join(root, 'nested/settings.json');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
(async () => {
  writeJSON(file, { saved: true });
  const rename = fs.renameSync;
  try {
    fs.renameSync = () => { throw Object.assign(Error('locked file'), { code: 'EACCES' }); };
    assert.throws(() => writeJSON(file, { saved: false }), /locked file/);
  } finally { fs.renameSync = rename; }
  assert.deepEqual(JSON.parse(fs.readFileSync(file, 'utf8')), { saved: true });
  assert(!fs.existsSync(file + '.tmp'));
  console.log('PASS failed atomic replacement preserves old JSON and removes staging file');

  let attempts = 0;
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../app/src/hud-store.js'), 'utf8'), {
    module, require: name => name === 'fs' ? fs : { writeJSON: (file, value) => {
      if (++attempts === 1) throw Error('temporary write failure');
      writeJSON(file, value);
    } }, setTimeout, clearTimeout, console: { error() {} },
  });
  const store = module.exports.createStore(file, {}, 5);
  store.update({ saved: false });
  await wait(30);
  assert.equal(attempts, 1);
  assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).saved, true);
  store.flush();
  assert.equal(attempts, 2);
  assert.equal(createStore(file, {}).get().saved, false);
  store.flush(); assert.equal(attempts, 2);
  console.log('PASS failed debounced save remains dirty, quit flush retries, successful flush is idempotent');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => fs.rmSync(root, { recursive: true, force: true }));
