'use strict';
const assert = require('assert/strict');
const { EventEmitter } = require('events');
const vm = require('vm'), fs = require('fs'), path = require('path');
const moduleUnderTest = { exports: {} }, timers = new Map();
let nextTimer = 0;
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../app/src/hud-fullscreen.js'), 'utf8'), {
  module: moduleUnderTest, __dirname: path.join(__dirname, '../app/src'), process,
  require, console: { error() {} },
  setTimeout(fn) { timers.set(++nextTimer, fn); return nextTimer; },
  clearTimeout(id) { timers.delete(id); },
});
const { startFullscreenGuard } = moduleUnderTest.exports;
function fixture(platform = 'win32') {
  const app = new EventEmitter(), window = new EventEmitter(), actions = [], children = [];
  window.isDestroyed = () => false;
  window.setIgnoreMouseEvents = (...args) => actions.push(['mouse', ...args]);
  window.setFocusable = () => { throw Error('Never change overlay focusability during fullscreen transitions'); };
  window.setSkipTaskbar = value => actions.push(['taskbar', value]);
  window.webContents = { send: (channel, state) => actions.push([channel, state]) };
  const guard = startFullscreenGuard({ app, window, platform, launch(file, args, options) {
    assert(file.endsWith('FullscreenObserver.exe')); assert.equal(args[0], String(process.pid));
    assert.equal(options.windowsHide, true);
    const child = new EventEmitter(); child.stdout = new EventEmitter();
    child.kill = () => { child.killed = true; child.emit('exit', 0); };
    children.push(child); return child;
  } });
  return { app, window, guard, actions, children };
}
const f = fixture();
const input = text => f.children.at(-1).stdout.emit('data', Buffer.from(text));
input('0\n1'); assert.equal(f.guard.isLocked(), false);
input('\n'); assert.equal(f.guard.isLocked(), true);
assert.deepEqual(f.actions.slice(0, 2), [['mouse', true], ['taskbar', true]]);
assert.equal(f.actions[0].length, 2, 'Do not forward hover/mousemove to Chromium');
const count = f.actions.length; input('1\n1\n'); assert.equal(f.actions.length, count);
input('0\n'); assert.equal(f.guard.isLocked(), false);
assert.deepEqual(f.actions.slice(-3, -1), [['mouse', false], ['taskbar', true]]);
input('1\n'); f.children[0].emit('exit', 1);
assert.equal(f.guard.isLocked(), false); assert.equal(timers.size, 1);
assert(f.children[0].killed);
for (let i = 0; i < 3; i++) {
  const [id, retry] = timers.entries().next().value; timers.delete(id); retry();
  f.children.at(-1).emit('error', Error('observer failed'));
}
assert.equal(timers.size, 0, 'Recovery is bounded, not a permanent crash loop');
f.guard.stop(); assert.equal(f.app.listenerCount('before-quit'), 0);
console.log('PASS fullscreen locks input without forwarding mouse moves, restores interaction, handles fragmented messages, deduplicates events and bounds failure recovery');

const quit = fixture(); quit.children[0].stdout.emit('data', Buffer.from('1\n'));
quit.app.emit('before-quit'); assert(quit.children[0].killed); assert.equal(timers.size, 0);
assert.equal(quit.guard.isLocked(), false);
const closed = fixture(); closed.window.emit('closed'); assert(closed.children[0].killed);
const unsupported = fixture('darwin'); assert.equal(unsupported.children.length, 0);
const malformed = fixture(); malformed.children[0].stdout.emit('data', Buffer.from('1\ninvalid\n'));
assert.equal(malformed.guard.isLocked(), false); malformed.guard.stop(); assert.equal(timers.size, 0);
console.log('PASS quit/window close kills observer, malformed input unlocks safely, unsupported OS does not spawn Windows processes');
