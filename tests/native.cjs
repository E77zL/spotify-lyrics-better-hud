'use strict';
const fs = require('fs'), path = require('path'), assert = require('assert/strict');
const { spawn } = require('child_process');
const binaries = path.resolve(__dirname, '../.build/native-qa');
const base = fs.mkdtempSync(path.join(binaries, 'cases-'));
const children = [];
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
async function until(check, message, timeout = 5000) {
  const end = Date.now() + timeout;
  do { if (check()) return; await wait(20); } while (Date.now() < end);
  throw Error(message);
}
function fixture(name, options = {}) {
  const dir = path.join(base, name), root = path.join(dir, '用户 HUD');
  fs.mkdirSync(path.join(dir, 'LyricsHUD'), { recursive: true });
  fs.mkdirSync(path.join(root, 'HUD'), { recursive: true });
  for (const file of ['version.dll', 'SpotifyBridgeTest.exe']) fs.copyFileSync(path.join(binaries, file), path.join(dir, file));
  if (!options.missing) fs.copyFileSync(path.join(binaries, 'SpotifyBridgeTest.exe'), path.join(root, 'HUD/Spotify悬浮歌词.exe'));
  fs.writeFileSync(path.join(root, 'connection.json'), '{}');
  fs.writeFileSync(path.join(dir, 'LyricsHUD/bridge.ini'), '\ufeff[LyricsHUD]\r\nInstallRoot=' + root + '\r\nEnabled=' + (options.disabled ? '0' : '1') + '\r\n', 'utf16le');
  const host = spawn(path.join(dir, 'SpotifyBridgeTest.exe'), options.helper ? ['--type=renderer'] : [], {
    windowsHide: true, stdio: 'ignore', env: { ...process.env, HUD_TEST_ROOT: root, HUD_TEST_DIR: dir,
      ELECTRON_RUN_AS_NODE: '1', NODE_OPTIONS: '--invalid-fixture-option', HUD_TEST_CLEAN_EXIT: options.clean ? '1' : '0',
      SPOTIFY_HUD_PARENT_PID: 'invalid', SPOTIFY_HUD_CONNECTION: 'invalid', SPOTIFY_HUD_LIFETIME_PIPE: 'invalid' },
  });
  children.push(host);
  host.on('error', error => { host.failure = error; });
  const read = file => JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  const exists = file => fs.existsSync(path.join(dir, file));
  return { host, dir, read, exists };
}
(async () => {
  const f = fixture('attached');
  await until(() => f.exists('host.json') && f.exists('child.json'), 'Native module did not launch child or forward version APIs');
  assert.equal(f.read('host.json').forwarding, true);
  assert.equal(f.read('child.json').parent, f.host.pid);
  const started = Date.now(); f.host.kill();
  await until(() => f.exists('closed.json'), 'Pipe stayed open after host crash');
  assert(Date.now() - started < 1000);
  console.log('PASS native local-DLL imports forward real version data; Unicode child path, direct parent, clean Electron environment; crash-to-pipe EOF <1s');
  for (const [name, option] of [['helper', { helper: true }], ['disabled', { disabled: true }], ['missing', { missing: true }]]) {
    const f = fixture(name, option);
    await until(() => f.exists('host.json'), name + ': forwarding failed');
    await wait(400);
    assert(!f.exists('child.json'), name + ': unexpectedly launched child');
    assert.equal(f.host.exitCode, null, name + ': host stopped');
    f.host.kill();
  }
  console.log('PASS Chromium helpers, disabled integration and missing runtime leave host functioning without a HUD');
  const clean = fixture('intentional-quit', { clean: true });
  await until(() => clean.exists('clean-exit.json'), 'Clean-exit fixture did not finish');
  const cleanPid = clean.read('child.json').pid;
  const retry = fixture('retry');
  await until(() => retry.exists('child.json'), 'Retry fixture did not start');
  const firstPid = retry.read('child.json').pid;
  process.kill(firstPid);
  await until(() => retry.read('child.json').pid !== firstPid, 'Child exit did not recover', 14000);
  assert.equal(clean.read('child.json').pid, cleanPid, 'Intentional quit unexpectedly relaunched the HUD');
  clean.host.kill();
  retry.host.kill();
  await until(() => retry.exists('closed.json'), 'Recovered child did not follow host exit');
  console.log('PASS HUD crash retries after backoff; recovered child follows the same Spotify lifetime');
  console.log('PASS intentional clean exit stays closed while the Spotify host keeps running');
})().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  for (const child of children) { if (child.exitCode === null) child.kill(); }
  await wait(150);
});
