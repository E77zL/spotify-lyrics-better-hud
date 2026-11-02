'use strict';
const assert = require('assert/strict'), fs = require('fs'), path = require('path'), vm = require('vm');
const { EventEmitter } = require('events');
const { createPlaybackClock } = require('../app/src/playbackClock');
const { createOffsetStore } = require('../app/src/hud-offsets');

function fakeTime() {
  let time = 0, nextId = 0;
  const tasks = new Map();
  return { get now() { return time; }, get size() { return tasks.size; },
    setTimeout(fn, ms) { const id = ++nextId; tasks.set(id, { at: time + ms, fn }); return id; },
    clearTimeout(id) { tasks.delete(id); },
    async advance(ms) { const end = time + ms; while (tasks.size) { const [id, task] = [...tasks].sort((a,b)=>a[1].at-b[1].at)[0]; if (task.at > end) break; time=task.at;tasks.delete(id);task.fn();await new Promise(r=>setImmediate(r)); } time=end;await new Promise(r=>setImmediate(r)); },
  };
}
const snapshot = (positionSec, isPlaying = true, title = 'Song') => ({ found:true,title,artist:'Artist',durationSec:200,positionSec,isPlaying,lastUpdatedTime:0 });
function playbackFixture(store) {
  const time=fakeTime(), tracker=new EventEmitter(), messages=[];
  const clock=createPlaybackClock({now:()=>time.now,wallNow:()=>time.now});
  tracker.latest={found:false}; tracker.getInterpolatedPositionSec=clock.getPosition;tracker.destroy=()=>{};
  tracker.push=(position,playing=true,title='Song')=>{tracker.latest={...snapshot(position,playing,title),lastUpdatedTime:time.now};clock.update(tracker.latest);tracker.emit('update',tracker.latest);};
  const module={exports:{}};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../app/src/hud-playback.js'),'utf8'),{module,exports:module.exports,setTimeout:time.setTimeout,clearTimeout:time.clearTimeout,AbortController,console});
  const playback=module.exports.startPlayback({tracker,offsetStore:store,debounceMs:0,fetchLyrics:async()=>({found:true,lines:[{time:1,text:'First'},{time:2,text:'Second'},{time:3,text:'Third'}]}),send:(channel,data)=>messages.push({at:time.now,channel,data})});
  return {time,tracker,playback,messages,ticks:()=>messages.filter(m=>m.channel==='lyrics:tick')};
}

(async()=>{
  let mono=0, wall=100000;
  const clock=createPlaybackClock({now:()=>mono,wallNow:()=>wall});
  clock.update({...snapshot(10),lastUpdatedTime:wall});
  // The real SMTC probe shows a new read timestamp for identical positions.
  for(let i=0;i<8;i++){mono+=100;wall+=100;clock.update({...snapshot(10),lastUpdatedTime:wall});}
  assert.equal(clock.getPosition(),10.8);
  clock.update({...snapshot(10,false),lastUpdatedTime:wall});mono+=30000;wall-=20000;assert.equal(clock.getPosition(),10.8);
  clock.update({...snapshot(10,true),lastUpdatedTime:wall});mono+=500;assert.equal(clock.getPosition(),11.3);
  clock.update({...snapshot(70),lastUpdatedTime:wall});assert.equal(clock.getPosition(),70);
  clock.update({...snapshot(2),lastUpdatedTime:wall});assert.equal(clock.getPosition(),2);
  clock.update({...snapshot(0,true,'Other'),lastUpdatedTime:wall});assert.equal(clock.getPosition(),0);
  clock.update({...snapshot(199.9),lastUpdatedTime:wall});mono+=1000;assert.equal(clock.getPosition(),200);
  clock.update({found:false});assert.equal(clock.getPosition(),0);
  console.log('PASS monotonic playback clock: duplicate reads do not rewind, pause/resume, seeks, track changes, wall-clock shifts and duration clamp');

  const dir=fs.mkdtempSync(path.join(__dirname,'timing-store-test-')), file=path.join(dir,'Spotify','LyricsHUD','lyric-offsets.json');
  const store=createOffsetStore(file), a=JSON.stringify(['Song','Artist',200]), b=JSON.stringify(['Song','Other Artist',200]);
  assert.equal(store.set(a,-500,snapshot(0)),-500);assert.equal(store.get(b),0);
  assert.equal(createOffsetStore(file).get(a),-500);
  store.set(b,500,{...snapshot(0),artist:'Other Artist'});assert.equal(createOffsetStore(file).get(b),500);
  store.set(a,0,snapshot(0));assert.equal(createOffsetStore(file).get(a),0);assert.equal(createOffsetStore(file).get(b),500);
  store.set(a,90000,snapshot(0));assert.equal(store.get(a),60000);store.set(a,-90000,snapshot(0));assert.equal(store.get(a),-60000);store.set(a,0,snapshot(0));
  assert(!fs.existsSync(file+'.tmp'));
  console.log('PASS per-song and per-artist timing, disk reload, atomic replacement, reset and limits');

  const f=playbackFixture(store);f.tracker.push(0);await f.time.advance(0);
  assert.equal(f.ticks().at(-1).data.index,-1);assert.equal(f.playback.adjustTiming(-500).offsetMs,-500);
  await f.time.advance(499);assert.equal(f.ticks().at(-1).data.index,-1);await f.time.advance(1);assert.equal(f.ticks().at(-1).data.index,0);
  // Positive delay moves the next line deadline later and updates the current line immediately.
  f.playback.adjustTiming(500);assert.equal(f.ticks().at(-1).data.index,-1);
  f.playback.adjustTiming(500);await f.time.advance(999);assert.equal(f.ticks().at(-1).data.index,-1);await f.time.advance(1);assert.equal(f.ticks().at(-1).data.index,0);
  f.tracker.push(1.5,false);const pausedTicks=f.ticks().length;await f.time.advance(10000);assert.equal(f.ticks().length,pausedTicks);
  assert.equal(f.playback.adjustTiming(-500).offsetMs,0);
  assert.equal(f.playback.adjustTiming(-500).offsetMs,-500);
  f.tracker.push(0,false,'Other');await f.time.advance(0);assert.equal(f.messages.filter(m=>m.channel==='lyrics:timing').at(-1).data.offsetMs,0);
  f.tracker.push(0,false);await f.time.advance(0);assert.equal(f.messages.filter(m=>m.channel==='lyrics:timing').at(-1).data.offsetMs,-500);
  const reopened=playbackFixture(createOffsetStore(file));reopened.tracker.push(0,false);await reopened.time.advance(0);assert.equal(reopened.messages.filter(m=>m.channel==='lyrics:timing').at(-1).data.offsetMs,-500);reopened.playback.destroy();
  f.playback.setVisible(false);assert.equal(f.time.size,0);f.playback.adjustTiming(0);assert.equal(f.time.size,0);
  assert.equal(f.playback.adjustTiming('500').error,'Invalid timing adjustment');f.playback.destroy();
  console.log('PASS exact shifted line deadlines, immediate +/-0.5s effects, no paused/hidden timer, song switching and restart persistence');

  const failed=playbackFixture({get:()=>0,set(){throw Error('disk read-only');}});failed.tracker.push(0);await failed.time.advance(0);assert(failed.playback.adjustTiming(-500).error.includes('disk read-only'));assert.equal(failed.ticks().at(-1).data.progressMs,0);failed.playback.destroy();
  fs.writeFileSync(path.join(__dirname,'hud-timing-unit-result.json'),JSON.stringify({passed:true,fixtureFile:file,oldDuplicateReadPosition:10,newPosition:10.8,advanceBoundaryMs:500,delayBoundaryMs:1500},null,2));
  console.log('PASS failed persistence does not apply an unsaved adjustment');
})().catch(e=>{console.error(e);process.exitCode=1;});
