'use strict';
const fs = require('fs'), path = require('path'), vm = require('vm'), assert = require('assert/strict');
const { EventEmitter } = require('events');
const { fetchJSON } = require('../app/src/http');
const settle = () => new Promise(resolve => setImmediate(resolve));
function clock() {
  let now = 0, id = 0;
  const jobs = new Map();
  return {
    get now() { return now; }, get size() { return jobs.size; },
    setTimeout(fn, ms) { const key = ++id; jobs.set(key, { at: now + ms, fn }); return key; },
    clearTimeout(key) { jobs.delete(key); },
    async advance(ms) {
      const end = now + ms;
      while (jobs.size) {
        const [key, job] = [...jobs].sort((a, b) => a[1].at - b[1].at)[0];
        if (job.at > end) break;
        now = job.at; jobs.delete(key); job.fn(); await settle();
      }
      now = end; await settle();
    },
  };
}
function load(file, deps = {}, timer = clock()) {
  deps = { './matching': require('../app/src/matching'), ...deps };
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, '../app/src', file), 'utf8'), {
    module, exports: module.exports, require: name => { assert(name in deps, name); return deps[name]; },
    setTimeout: timer.setTimeout, clearTimeout: timer.clearTimeout, AbortController, console, Buffer, URL,
  });
  return module.exports;
}
function fixture(fetchLyrics, visible = true) {
  const time = clock(), messages = [];
  const tracker = new EventEmitter();
  tracker.latest = { found: false };
  tracker.getInterpolatedPositionSec = () => tracker.latest.positionSec + (tracker.latest.isPlaying ? (time.now - tracker.anchor) / 1000 : 0);
  tracker.push = (title, playing = true, position = 0, duration = 200) => {
    tracker.anchor = time.now;
    tracker.latest = { found: !!title, title, artist: 'Artist', durationSec: duration, positionSec: position, isPlaying: playing };
    tracker.emit('update', tracker.latest);
  };
  tracker.destroy = () => { tracker.destroyed = true; };
  const playback = load('hud-playback.js', {}, time).startPlayback({ tracker, fetchLyrics, send: (channel, data) => messages.push({ channel, data, at: time.now }), visible });
  return { time, tracker, playback, messages, ticks: () => messages.filter(m => m.channel === 'lyrics:tick') };
}
const result = text => ({ found: true, lines: [0, 0.5, 1, 2].map(time => ({ time, text })) });
(async () => {
  const report = {};
  let calls = 0;
  const f = fixture(async title => { calls++; return result(title); }, false);
  f.tracker.push('A'); await f.time.advance(350);
  await f.time.advance(15000);
  assert.equal(f.ticks().length, 0); assert.equal(f.time.size, 0);
  f.playback.setVisible(true); assert.equal(f.ticks().length, 1);
  f.tracker.push('A', false, 0.2); const paused = f.ticks().length;
  await f.time.advance(15000); assert.equal(f.ticks().length, paused); assert.equal(f.time.size, 0);
  f.tracker.push('A', true, 0.2); await f.time.advance(300);
  assert.equal(f.ticks().at(-1).data.progressMs, 500);
  f.tracker.push('A', true, 0.5); assert.equal(f.ticks().at(-1).data.progressMs, 500);
  f.tracker.push('A', false, 0); assert.equal(f.ticks().at(-1).data.progressMs, 0);
  f.tracker.push('B', false); await f.time.advance(350);
  f.tracker.push('A', false); assert.equal(calls, 2, 'Recent-track replay refetched lyrics');
  f.playback.destroy(); assert(f.tracker.destroyed); assert.equal(f.time.size, 0);
  report.idleProgressIpcPer15Seconds = 0;
  console.log('PASS hidden/paused idle has no progress timer/IPC; exact line boundary, resume/seek and recent-track cache');

  const local = fixture(async () => ({ ...result('Local lyric'), artist: 'Westwood' }));
  local.tracker.latest = { found: true, title: 'wait 4 u [prod. pxiqzes]', artist: '', durationSec: 162, positionSec: 0, isPlaying: false };
  local.tracker.emit('update', local.tracker.latest); await local.time.advance(350);
  const localUpdate = local.messages.find(m => m.channel === 'lyrics:update').data;
  assert.equal(localUpdate.artist, 'Westwood'); assert.equal(localUpdate.title, 'wait 4 u [prod. pxiqzes]');
  assert.equal(local.tracker.latest.artist, '', 'Keep inferred metadata separate from native playback metadata');
  local.playback.destroy();
  console.log('PASS missing local artist is filled from the matched source without changing native playback state');

  const pending = [];
  const race = fixture((title, artist, duration, signal) => new Promise(resolve => pending.push({ title, signal, resolve })));
  for (const title of ['A', 'B', 'A']) { race.tracker.push(title); await race.time.advance(350); }
  assert(pending[0].signal.aborted); assert(pending[1].signal.aborted);
  pending[0].resolve(result('stale A')); pending[1].resolve(result('stale B')); await settle();
  assert.equal(race.messages.filter(m => m.channel === 'lyrics:update').length, 0);
  pending[2].resolve(result('current A')); await settle();
  assert.equal(race.messages.find(m => m.channel === 'lyrics:update').data.lines[0].text, 'current A');
  for (let i = 0; i < 9; i++) { race.tracker.push('Track ' + i); await race.time.advance(350); pending.at(-1).resolve(result('cached')); await settle(); }
  const prior = pending.length;
  race.tracker.push('A'); await race.time.advance(350); assert.equal(pending.length, prior + 1, 'Cache grew beyond its bound');
  race.playback.destroy(); assert(pending.at(-1).signal.aborted); assert.equal(race.time.size, 0);
  pending.at(-1).resolve(result('after destroy')); await settle();
  console.log('PASS abort on track change/quit, A -> B -> A race rejection, bounded cache eviction');

  const timer = clock(), writes = [];
  const store = load('hud-store.js', { fs: { readFileSync() { throw Error('first run'); }, writeFileSync(file, data) { writes.push(JSON.parse(data)); } } }, timer).createStore('fixture.json', { width: 420, height: 260 });
  for (let i = 0; i < 120; i++) { store.update({ width: 421 + i }); await timer.advance(10); }
  assert.equal(writes.length, 0); await timer.advance(250); assert.equal(writes.length, 1); assert.equal(writes[0].width, 540);
  assert.equal(store.update({ width: 540 }), false); assert.equal(timer.size, 0);
  store.update({ height: 300 }); store.flush(); assert.equal(writes.length, 2); assert.equal(writes[1].height, 300); assert.equal(timer.size, 0);
  store.flush(); assert.equal(writes.length, 2);
  report.continuousDragWrites = { events: 120, writes: 1 };
  console.log('PASS drag/slider write coalescing, unchanged-state suppression, final quit flush');

  const server = require('http').createServer((req, res) => {
    if (req.url === '/ok') res.end('{"ok":true}');
    else { res.writeHead(200, { 'Content-Type': 'application/json' }); res.write('{'); }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const base = 'http://127.0.0.1:' + server.address().port;
  try {
    const started = Date.now(); await assert.rejects(fetchJSON(base + '/stall', {}, 80)); assert(Date.now() - started < 1000);
    const controller = new AbortController();
    const request = fetchJSON(base + '/stall', { signal: controller.signal });
    setTimeout(() => controller.abort(), 20); await assert.rejects(request);
    assert.deepEqual(await fetchJSON(base + '/ok'), { ok: true });
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
  console.log('PASS deadline includes stalled JSON body, parent cancellation and recovery');

  const controller = new AbortController(), chainCalls = [];
  const chain = load('lyrics.js', {
    './lrc': { parseLRC: () => [], isMetadataLine: () => false },
    './http': { fetchJSON: async () => { chainCalls.push('lrclib'); controller.abort(); return null; } },
    './qqmusic': { fetchQQ: async () => { chainCalls.push('qq'); } },
    './netease': { fetchNetEase: async () => { chainCalls.push('netease'); } },
  });
  await assert.rejects(chain.fetchLyrics('A', 'Artist', 200, controller.signal)); assert.deepEqual(chainCalls, ['lrclib']);
  const qqCalls = [];
  const qq = load('qqmusic.js', {
    crypto: require('crypto'), './lrc': require('../app/src/lrc'),
    './http': { fetchJSON: async (url, options) => {
      qqCalls.push({ url, options });
      return options.method === 'POST' ? { req_1: { data: { lyric: Buffer.from('[00:01.00]Original').toString('base64') } } } : { data: { song: { list: [{ songmid: 'wrong', songname: 'A', singer: [{ name: 'Other' }] }, { songmid: 'correct', songname: 'A', singer: [{ name: 'Artist' }] }] } } };
    } },
  });
  assert.equal((await qq.fetchQQ('A', 'Artist')).lines[0].text, 'Original');
  const body = JSON.parse(qqCalls[1].options.body), sign = body.comm.sign; delete body.comm.sign;
  assert.equal(body.req_1.param.songMID, 'correct');
  assert.equal(sign, require('crypto').createHash('md5').update('zza' + JSON.stringify(body) + 'eJ5l4tJN3NysFOW4n9Q0kXivNaHfY').digest('hex'));
  console.log('PASS cancellation prevents later providers; QQ matching/signature retained');
  fs.writeFileSync(path.join(__dirname, 'hud-efficiency-result.json'), JSON.stringify({ passed: true, ...report }, null, 2));
})().catch(error => { console.error(error); process.exitCode = 1; });
