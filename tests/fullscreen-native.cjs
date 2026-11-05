'use strict';
const assert = require('assert/strict'), path = require('path');
const { spawn } = require('child_process');
const { once } = require('events');
const observer = path.resolve(__dirname, '../.build/native-qa/FullscreenObserver.exe');
const withTimeout = (promise, ms) => {
  let timer;
  return Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Observer did not terminate')), ms); })])
    .finally(() => clearTimeout(timer));
};
(async () => {
  const bad = spawn(observer, ['invalid'], { windowsHide: true });
  assert.equal((await once(bad, 'exit'))[0], 2);
  const parent = spawn(process.execPath, ['-e', `
    const child = require('child_process').spawn(process.argv[1], [String(process.pid)], { windowsHide: true, stdio: ['ignore', 'inherit', 'ignore'] });
    setInterval(() => {}, 1000);
  `, observer], { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
  const output = [];
  parent.stdout.on('data', chunk => output.push(chunk));
  try {
    await withTimeout(once(parent.stdout, 'data'), 5000);
    assert(/^[01]\n/.test(Buffer.concat(output).toString()), 'Initial real foreground state is required');
    const closed = once(parent.stdout, 'end');
    parent.kill();
    await withTimeout(closed, 2000);
    console.log('PASS real native observer reports initial state and exits when its Electron parent crashes (no orphan observer)');
  } finally { parent.kill(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
