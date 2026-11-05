'use strict';
// Local control and short native-window fades. The renderer keeps its own colors.
const http = require('http');
const fs = require('fs');
const path = require('path');
const { WebSocketServer, WebSocket } = require('ws');
const { performance } = require('perf_hooks');
const { spotifySnapshot } = require('./hud-snapshot');
const { version } = require('../package.json');

function startHudControl({ app, window, loadEnabled, saveEnabled, refreshTray, connectionFile, onPlayback = () => {}, getTiming = () => null, getFullscreenLocked = () => false }) {
  const connection = JSON.parse(fs.readFileSync(connectionFile, 'utf8').replace(/^\uFEFF/, ''));
  if (!/^[a-f0-9]{64}$/.test(connection.token) || !Number.isInteger(connection.port) || connection.port < 1024 || connection.port > 65535) throw new Error('Invalid HUD connection');
  let enabled = loadEnabled() !== false;
  let quitting = false;
  let fadeTimer = null;
  let playbackClient = null;
  const state = () => ({ type: 'state', enabled, visible: !window.isDestroyed() && window.isVisible(), opacity: window.isDestroyed() ? 0 : window.getOpacity(), version, hud: '5.1.0', integration: 'spotify-process', hostPid: Number(process.env.SPOTIFY_HUD_PARENT_PID) || null, timing: getTiming(), fullscreenLocked: getFullscreenLocked() });
  const broadcast = () => {
    const message = JSON.stringify(state());
    for (const client of sockets.clients) if (client.readyState === WebSocket.OPEN) client.send(message);
    if (!quitting) refreshTray();
  };
  function cancelFade() { clearInterval(fadeTimer); fadeTimer = null; }
  function animateVisibility(show) {
    cancelFade();
    if (!window.isVisible()) {
      if (!show) return;
      window.setOpacity(0);
      window.showInactive();
    }
    const from = window.getOpacity();
    const target = show ? 1 : 0;
    const duration = (show ? 140 : 110) * Math.abs(target - from);
    const started = performance.now();
    function frame() {
      if (quitting || window.isDestroyed()) { cancelFade(); return; }
      const progress = duration ? Math.min(1, (performance.now() - started) / duration) : 1;
      window.setOpacity(from + (target - from) * (1 - Math.pow(1 - progress, 3)));
      if (progress === 1) {
        cancelFade();
        if (!show) { window.hide(); window.setOpacity(1); }
        broadcast();
      }
    }
    fadeTimer = setInterval(frame, 16);
    frame();
  }
  function setEnabled(value) {
    if (quitting || window.isDestroyed()) return;
    const next = !!value;
    const unchanged = next === enabled && (fadeTimer !== null || window.isVisible() === next);
    if (next !== enabled) { enabled = next; saveEnabled(enabled); }
    if (unchanged) return;
    animateVisibility(enabled);
    broadcast();
  }
  const server = http.createServer((request, response) => {
    if (request.headers['x-hud-token'] !== connection.token) { response.writeHead(403); response.end(); return; }
    if (request.method === 'POST' && request.url === '/shutdown') {
      quitting = true;
      cancelFade();
      if (!window.isDestroyed()) window.hide();
      response.end('ok');
      setImmediate(() => { app.isQuitting = true; app.quit(); });
    } else if (request.method === 'GET' && request.url === '/health') {
      response.setHeader('Content-Type', 'application/json'); response.end(JSON.stringify(state()));
    } else { response.writeHead(404); response.end(); }
  });
  const sockets = new WebSocketServer({ noServer: true, maxPayload: 8192 });
  server.on('upgrade', (request, socket, head) => {
    let url;
    try { url = new URL(request.url, 'http://127.0.0.1'); } catch { socket.destroy(); return; }
    const origin = request.headers.origin;
    const allowedOrigin = !origin || /^https:\/\/(?:xpui\.app\.spotify\.com|open\.spotify\.com|zlink\.app\.spotify\.com)$/.test(origin);
    if (url.pathname !== '/control' || url.searchParams.get('token') !== connection.token || !allowedOrigin) {
      socket.end('HTTP/1.1 403 Forbidden\r\n\r\n'); return;
    }
    sockets.handleUpgrade(request, socket, head, ws => sockets.emit('connection', ws, request));
  });
  sockets.on('connection', client => {
    client.send(JSON.stringify(state()));
    // Drive sampling from Electron: Spotify's page timers may be throttled
    // when minimized. WebSocket messages still wake the extension promptly.
    function requestPlayback() {
      if (client.readyState !== WebSocket.OPEN) return;
      client.send(JSON.stringify({ type: 'getPlayback' }));
      client.sampleTimer = setTimeout(requestPlayback, client.playing ? 1000 : 2500);
    }
    client.sampleTimer = setTimeout(requestPlayback, 1000);
    client.on('error', () => {});
    client.on('close', () => { clearTimeout(client.sampleTimer); if (playbackClient === client) { playbackClient = null; onPlayback(null); } });
    client.on('message', raw => {
      try {
        const command = JSON.parse(raw.toString());
        if (command.type === 'setEnabled' && typeof command.enabled === 'boolean') setEnabled(command.enabled);
        else if (command.type === 'getState') client.send(JSON.stringify(state()));
        else if (command.type === 'playback') {
          const snapshot = spotifySnapshot(command.snapshot);
          if (snapshot) { playbackClient = client; client.playing = snapshot.isPlaying; onPlayback(snapshot); }
        }
      } catch { /* Ignore malformed controls. */ }
    });
  });
  server.on('error', error => {
    try { fs.appendFileSync(path.join(path.dirname(connectionFile), 'hud-error.log'), new Date().toISOString() + ' ' + error.message + '\n'); } catch (_) { }
    app.quit();
  });
  server.listen(connection.port, '127.0.0.1');
  window.on('show', broadcast);
  window.on('hide', broadcast);
  window.on('closed', cancelFade);
  app.on('before-quit', () => { quitting = true; cancelFade(); for (const client of sockets.clients) { clearTimeout(client.sampleTimer); client.terminate(); } sockets.close(); server.close(); });
  setEnabled(enabled);
  return { setEnabled, isEnabled: () => enabled };
}

module.exports = { startHudControl };
