'use strict';
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm');
const { EventEmitter } = require('events');
const { spotifySnapshot } = require('../app/src/hud-snapshot');
const { createPlaybackClock } = require('../app/src/playbackClock');
let mono = 0, wall = 100000;
const direct = (p, playing = true) => ({found:true,title:'Song',artist:'Artist',durationSec:200,positionSec:p,isPlaying:playing,sentAt:wall});
const clock = createPlaybackClock({now:()=>mono,wallNow:()=>wall});
clock.update(spotifySnapshot(direct(10), wall));
mono += 1000; wall += 1000;
clock.update(spotifySnapshot(direct(11), wall)); assert.equal(clock.getPosition(),11);
// An authoritative repeated position is a seek/restart, not an old SMTC event.
mono += 500; wall += 500;
clock.update(spotifySnapshot(direct(11,false),wall)); assert.equal(clock.getPosition(),11);
mono += 30000; wall += 30000; assert.equal(clock.getPosition(),11);
clock.update(spotifySnapshot(direct(11),wall)); mono+=500;wall+=500;assert.equal(clock.getPosition(),11.5);
assert.equal(spotifySnapshot({...direct(1),sentAt:wall-4000},wall),null);
for(const patch of [{positionSec:NaN},{positionSec:-1},{durationSec:0},{title:123},{isPlaying:'true'}]) assert.equal(spotifySnapshot({...direct(1),...patch},wall),null);
console.log('PASS authoritative clock: repeats, exact pause/resume/seek, invalid/stale input');

// The source selector must ignore delayed Windows events, then fall back if the
// client disappears. Use the real tracker with a worker/time boundary fixture.
let worker, deadline;
class Worker extends EventEmitter { constructor(){super();worker=this;} terminate(){} }
const mod={exports:{}};
vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../app/src/nowPlayingTracker.js'),'utf8'),{
  module:mod,exports:mod.exports,require:name=> name==='worker_threads'?{Worker}:name==='./playbackClock'?{createPlaybackClock}:require(name),
  __dirname,process:{platform:'win32'},setTimeout:fn=>{deadline=fn;return 1;},clearTimeout(){deadline=null;},setImmediate,
});
const tracker=new mod.exports();
worker.emit('message',{found:true,title:'Old',artist:'Artist',durationSec:200,positionSec:9,isPlaying:true});
tracker.acceptSpotify(spotifySnapshot(direct(10),wall));
worker.emit('message',{found:true,title:'Old',artist:'Artist',durationSec:200,positionSec:9.5,isPlaying:true});
assert.equal(tracker.latest.source,'spotify');assert.equal(tracker.latest.positionSec,10);
deadline();assert.equal(tracker.latest.positionSec,9.5);
tracker.acceptSpotify(spotifySnapshot(direct(15),wall));tracker.acceptSpotify(null);assert.equal(tracker.latest.positionSec,9.5);
tracker.destroy();assert.equal(deadline,null);
console.log('PASS direct Spotify priority over delayed SMTC, expiry/disconnect fallback, timer cleanup');
