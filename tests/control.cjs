'use strict';
const assert = require('assert/strict');
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const { EventEmitter, once } = require('events');
process.env.NODE_PATH = path.join(__dirname, '../.build/HUD/resources/app/node_modules');
require('module').Module._initPaths();
const { WebSocket } = require('ws');
const { startHudControl } = require('../app/src/hud-control');
const port = 27947; // Keep the running desktop HUD on its installed port untouched.
const root = fs.mkdtempSync(path.join(__dirname, 'control-qa-'));
const token = require('crypto').randomBytes(32).toString('hex');
const connectionFile = path.join(root, 'connection.json');
const settingsFile = path.join(root, 'settings.json');
fs.writeFileSync(connectionFile, JSON.stringify({ token, port }));
fs.writeFileSync(settingsFile, JSON.stringify({ hudEnabled: true }));
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, label) { for (let i = 0; i < 100; i++) { if (await check()) return; await wait(50); } throw Error(label); }
class TestWindow extends EventEmitter {
  constructor() { super(); this.visible = false; this.destroyed = false; this.opacity = 1; this.samples = []; }
  isVisible() { assert(!this.destroyed); return this.visible; }
  isDestroyed() { return this.destroyed; }
  getOpacity() { return this.opacity; }
  setOpacity(value) { assert(value >= 0 && value <= 1); this.opacity = value; this.samples.push(value); }
  showInactive() { this.visible = true; this.emit('show'); }
  hide() { this.hideOpacity = this.opacity; this.visible = false; this.emit('hide'); }
}
let app, win, control, quitCount = 0, browser, observer, saves = 0;
const receivedPlayback = [];
function start() {
  app = new EventEmitter(); app.quit = () => { quitCount++; app.emit('before-quit'); };
  win = new TestWindow();
  control = startHudControl({ app, window: win, connectionFile,
    loadEnabled: () => JSON.parse(fs.readFileSync(settingsFile)).hudEnabled,
    saveEnabled: enabled => { saves++; fs.writeFileSync(settingsFile, JSON.stringify({ hudEnabled: enabled })); },
    refreshTray() {},
    onPlayback: snapshot => receivedPlayback.push(snapshot),
  });
}
async function health() {
  try { const res = await fetch(`http://127.0.0.1:${port}/health`, { headers: { 'X-Hud-Token': token }, signal: AbortSignal.timeout(500) }); return res.ok ? res.json() : null; } catch { return null; }
}
async function denied(url, origin) {
  const ws = new WebSocket(url, { origin });
  ws.on('error', () => {});
  const [, res] = await once(ws, 'unexpected-response');
  assert.equal(res.statusCode, 403);
  res.resume(); ws.terminate();
}
(async () => {
  start(); await until(health, 'Control did not listen');
  await until(() => win.opacity === 1, 'Initial fade did not complete');
  assert.equal((await health()).visible, true);
  assert.equal((await fetch(`http://127.0.0.1:${port}/health`)).status, 403);
  assert.equal((await fetch(`http://127.0.0.1:${port}/shutdown`, { method: 'POST' })).status, 403);
  assert.equal(quitCount, 0);
  await denied(`ws://127.0.0.1:${port}/control?token=invalid`, 'https://xpui.app.spotify.com');
  await denied(`ws://127.0.0.1:${port}/control?token=` + token, 'https://example.com');
  console.log('PASS HTTP/WS authentication and browser origin checks');

  win.samples = []; control.setEnabled(false);
  assert.equal(control.isEnabled(), false); assert.equal(win.visible, true);
  await until(() => !win.visible, 'Fade-out did not hide window');
  assert.equal(win.hideOpacity, 0); assert(win.samples.some(value => value > 0 && value < 1));
  win.samples = []; control.setEnabled(true);
  assert.equal(win.visible, true); assert(win.opacity < 1);
  await until(() => win.opacity === 1, 'Fade-in did not finish');
  assert(win.samples.some(value => value > 0 && value < 1));
  control.setEnabled(false); await wait(25); const interrupted = win.opacity;
  control.setEnabled(true); assert(win.opacity >= interrupted);
  await wait(180); assert.equal(win.visible, true); assert.equal(win.opacity, 1);
  console.log('PASS intermediate opacity frames, fade-out before hide, and rapid reversal without a delayed hide');

  let microphone = { previousElementSibling: null, isConnected: true }, insertionCount = 0, button, queries = 0;
  const parent = { insertBefore(element, target) { assert.equal(target, microphone); target.previousElementSibling = element; insertionCount++; } };
  microphone.parentElement = parent;
  const events = new EventEmitter();
  const notifications = [];
  const context = {
    WebSocket: class SpotifySocket extends WebSocket { constructor(url) { super(url, { origin: 'https://xpui.app.spotify.com' }); } },
    document: { body: {}, querySelector: selector => { queries++; assert.equal(selector, '[data-testid="lyrics-button"]'); return microphone; } },
    MutationObserver: class { constructor(fn) { this.fn = fn; observer = this; } observe() {} disconnect() { this.disconnected = true; } },
    setTimeout, clearTimeout,
    Spicetify: { Player: { data:{item:{uri:'spotify:track:test',metadata:{title:'Bridge Song',artist_name:'Artist'}}},
      getProgress:()=>12345,getDuration:()=>200000,isPlaying:()=>false,addEventListener(){},removeEventListener(){} },
      Playbar: { Button: class { constructor(label, icon, onClick) { this.label = label; this.icon = icon; this.onClick = onClick; this.element = { isConnected: true }; button = this; } } }, showNotification: message => notifications.push(message) },
    addEventListener: (name, fn) => events.on(name, fn),
  };
  context.window = context;
  browser = context;
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../extension/spotify-lyrics-hud.js'), 'utf8').replace('__HUD_CONNECTION_TOKEN__', token).replace('127.0.0.1:27946', `127.0.0.1:${port}`), context);
  await until(() => button.active === true, 'Icon did not receive initial state');
  await until(() => receivedPlayback.some(s => s?.source === 'spotify'), 'Extension did not transmit its clock');
  assert.equal(receivedPlayback.at(-1).positionSec,12.345);
  assert.equal(receivedPlayback.at(-1).artist,'Artist');
  const initialPackets=receivedPlayback.length;
  await until(()=>receivedPlayback.length>initialPackets,'Main-process sampling did not wake the extension');
  console.log('PASS playback heartbeat without any extension polling timer');
  const peer = new WebSocket(`ws://127.0.0.1:${port}/control?token=`+token);
  await once(peer,'open');
  const count = receivedPlayback.length;
  peer.send(JSON.stringify({type:'playback',snapshot:{found:true,sentAt:Date.now()-4000}}));
  await wait(50);assert.equal(receivedPlayback.length,count);peer.close();await wait(50);
  assert.equal(receivedPlayback.length,count,'An unrelated socket close reset the active clock');
  console.log('PASS real extension playback packets, stale-packet rejection and producer ownership');
  assert.equal(microphone.previousElementSibling, button.element);
  const queryCount = queries;
  for (let i = 0; i < 100; i++) observer.fn();
  assert.equal(insertionCount, 1); assert.equal(queries, queryCount, 'Unrelated Spotify mutations queried the whole document');
  microphone.isConnected = false;
  microphone = { parentElement: parent, previousElementSibling: null, isConnected: true }; observer.fn();
  assert.equal(microphone.previousElementSibling, button.element);
  button.onClick(); await until(() => button.active === false && !win.visible, 'Hide failed');
  button.onClick(); await until(() => button.active === true && win.visible, 'Show failed');
  const beforeRepeat = saves;
  control.setEnabled(true); control.setEnabled(true); assert.equal(win.visible, true); assert.equal(saves, beforeRepeat);
  control.setEnabled(false); await until(() => !button.active, 'Tray/toolbar hide did not sync icon');
  assert.equal(JSON.parse(fs.readFileSync(settingsFile)).hudEnabled, false);
  console.log('PASS real extension-to-server WS toggles, idempotence, tray synchronization, microphone adjacency');

  app.quit(); await until(async () => !(await health()), 'Server did not stop');
  await wait(100); start(); await until(health, 'Restart failed');
  assert.equal(win.visible, false);
  await wait(1800); button.onClick();
  await until(() => win.visible && button.active, 'Extension did not reconnect');
  console.log('PASS persistent hidden state and extension reconnection after HUD restart');
  events.emit('beforeunload'); assert.equal(observer.disconnected, true);
  const savedEnabled = control.isEnabled();
  const shutdownStart = Date.now();
  await fetch(`http://127.0.0.1:${port}/shutdown`, { method: 'POST', headers: { 'X-Hud-Token': token } });
  assert.equal(win.visible,false,'Shutdown did not hide synchronously');
  assert(Date.now()-shutdownStart<100);
  assert.equal(JSON.parse(fs.readFileSync(settingsFile)).hudEnabled,savedEnabled,'Shutdown changed the remembered toggle');
  await wait(30); start(); await until(health,'Second restart failed');
  win.destroyed = true; win.emit('hide');
  assert.equal((await health()).visible, false);
  const result = await fetch(`http://127.0.0.1:${port}/shutdown`, { method: 'POST', headers: { 'X-Hud-Token': token } });
  assert.equal(result.status, 200);
  await until(async () => !(await health()), 'Shutdown failed');
  console.log('PASS authenticated shutdown, destroyed-window handling, extension cleanup');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => { if (browser) browser.__unused = true; if (app) app.quit(); });
