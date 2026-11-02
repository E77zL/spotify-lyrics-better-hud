'use strict';

const net = require('net');
// A dedicated named pipe works for Windows GUI executables where Electron's
// stdin can be NUL even when the parent redirects it. EOF also covers crashes.
function followLauncher({ app, BrowserWindow, pipePath = process.env.SPOTIFY_HUD_LIFETIME_PIPE }) {
  if (typeof pipePath !== 'string' || !/^\\\\\.\\pipe\\SpotifyLyricsHUD\.Lifetime\.[a-f0-9]{32}$/.test(pipePath)) throw new Error('Invalid HUD lifetime pipe');
  let closing = false;
  function hideWindows() {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed() && win.isVisible()) win.hide();
    }
  }
  function quit() {
    if (closing) return;
    closing = true;
    hideWindows();
    app.isQuitting = true;
    app.quit();
  }
  const socket = net.createConnection(pipePath);
  socket.once('end', quit);
  socket.once('close', quit);
  socket.once('error', quit);
  socket.resume();
  app.prependListener('before-quit', () => { closing = true; hideWindows(); socket.destroy(); });
  return quit;
}

module.exports = { followLauncher };
