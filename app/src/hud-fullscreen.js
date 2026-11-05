'use strict';
const path = require('path');
const { spawn } = require('child_process');

// Do not forward mouse moves while locked: Chromium must not show hover controls
// or a cursor over a game that normally captures/hides it.
function startFullscreenGuard({ app, window, platform = process.platform, launch = spawn }) {
  if (platform !== 'win32') return { stop() {}, isLocked: () => false };
  let child = null, retry = null, stopped = false, locked = false, failures = 0;
  function apply(next) {
    if (window.isDestroyed() || next === locked) return;
    locked = next;
    // The overlay stays non-activating even on the desktop. Only mouse input
    // changes; toggling focusability can restore Windows taskbar/Alt+Tab styles.
    window.setIgnoreMouseEvents(locked);
    window.setSkipTaskbar(true);
    window.webContents.send('fullscreen:locked', locked);
  }
  function start() {
    if (stopped) return;
    let current;
    try {
      current = launch(path.join(__dirname, 'FullscreenObserver.exe'), [String(process.pid)], {
        windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'],
      });
    } catch (error) { failed(error); return; }
    child = current;
    let pending = '', ended = false;
    function finish(error) {
      if (ended) return;
      ended = true;
      if (child === current) child = null;
      current.kill();
      failed(error);
    }
    current.once('error', finish);
    current.once('exit', () => finish());
    current.stdout.on('error', finish);
    current.stdout.on('data', chunk => {
      if (stopped || ended) return;
      pending += chunk.toString('ascii');
      if (pending.length > 128) { finish(new Error('Invalid fullscreen observer response')); return; }
      let split;
      while ((split = pending.indexOf('\n')) !== -1) {
        const line = pending.slice(0, split); pending = pending.slice(split + 1);
        if (line !== '0' && line !== '1') { finish(new Error('Invalid fullscreen observer state')); return; }
        apply(line === '1');
      }
    });
  }
  function failed(error) {
    if (stopped) return;
    apply(false); // Never leave the user's overlay permanently inaccessible.
    if (error) console.error('Fullscreen observer:', error.message);
    if (++failures <= 3) retry = setTimeout(start, 2000);
  }
  function stop() {
    if (stopped) return;
    stopped = true;
    clearTimeout(retry);
    if (child) { child.kill(); child = null; }
    apply(false);
    app.removeListener('before-quit', stop);
    window.removeListener('closed', stop);
  }
  app.once('before-quit', stop);
  window.once('closed', stop);
  start();
  return { stop, isLocked: () => locked };
}

module.exports = { startFullscreenGuard };
