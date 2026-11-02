'use strict';
const assert = require('assert/strict'), net = require('net'), { EventEmitter, once } = require('events');
const { followSpotify } = require('../app/src/hud-lifetime');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function fixture(drop) {
  const pipePath = '\\\\.\\pipe\\SpotifyLyricsHUD.Lifetime.' + require('crypto').randomBytes(16).toString('hex');
  const server = net.createServer();
  await new Promise(resolve => server.listen(pipePath, resolve));
  const connected = once(server, 'connection');
  const app = new EventEmitter(), order = [];
  let visible = true;
  const window = { isDestroyed: () => false, isVisible: () => visible, hide: () => { visible = false; order.push('hide'); } };
  const destroyed = { isDestroyed: () => true, isVisible: () => { throw Error('Used destroyed window'); } };
  app.quit = () => { order.push('quit'); app.emit('before-quit'); };
  const quit = followSpotify({ app, BrowserWindow: { getAllWindows: () => [destroyed, window] }, pipePath });
  const [socket] = await connected;
  if (drop) socket.destroy(); else app.quit();
  for (let i = 0; i < 50 && !order.includes('hide'); i++) await wait(10);
  if (drop) assert.deepEqual(order, ['hide', 'quit']);
  else assert.deepEqual(order, ['quit', 'hide']);
  quit(); await wait(20);
  assert.equal(order.filter(x => x === 'quit').length, 1);
  socket.destroy(); await new Promise(resolve => server.close(resolve));
}
(async () => {
  await fixture(true); await fixture(false);
  assert.throws(() => followSpotify({ pipePath: 'unexpected pipe' }), /Invalid HUD lifetime pipe/);
  console.log('PASS real pipe disconnect hides before quit; explicit quit closes pipe; duplicate EOF/close is harmless');
})().catch(error => { console.error(error); process.exitCode = 1; });
