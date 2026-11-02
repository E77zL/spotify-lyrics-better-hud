'use strict';
const path = require('path');
const { Worker } = require('worker_threads');
const EventEmitter = require('events');
const { createPlaybackClock } = require('./playbackClock');

class NowPlayingTracker extends EventEmitter {
  constructor() {
    super();
    this.latest = { found: false };
    this.nativeSnapshot = this.latest;
    this.directTimer = null;
    this.clock = createPlaybackClock();
    const file = { win32: 'smtcWorker.js', darwin: 'macWorker.js' }[process.platform];
    if (!file) {
      setImmediate(() => this.emit('fatal-error', new Error('当前系统暂不支持读取播放信息')));
      return;
    }
    this.worker = new Worker(path.join(__dirname, file));
    this.worker.on('message', snapshot => {
      this.nativeSnapshot = snapshot;
      if (!this.directTimer) this.publish(snapshot);
    });
    this.worker.on('error', error => this.emit('fatal-error', error));
    this.worker.on('exit', code => { if (code) this.emit('fatal-error', new Error('SMTC worker exited: ' + code)); });
    if (process.platform === 'darwin') this.worker.postMessage('start');
  }

  getInterpolatedPositionSec() {
    return this.clock.getPosition();
  }

  getTimingState() {
    return { source: this.latest.source || 'smtc', positionSec: this.clock.getPosition(),
      nativePositionSec: this.nativeSnapshot.positionSec || 0, isPlaying: !!this.latest.isPlaying };
  }

  publish(snapshot) {
    this.clock.update(snapshot);
    this.latest = snapshot;
    this.emit('update', snapshot);
  }

  acceptSpotify(snapshot) {
    clearTimeout(this.directTimer);
    this.directTimer = null;
    if (!snapshot) { this.publish(this.nativeSnapshot); return; }
    this.directTimer = setTimeout(() => {
      this.directTimer = null;
      this.publish(this.nativeSnapshot);
    }, 3500);
    this.publish(snapshot);
  }

  destroy() {
    clearTimeout(this.directTimer);
    this.directTimer = null;
    if (!this.worker) return;
    this.worker.removeAllListeners();
    this.worker.terminate();
    this.worker = null;
  }
}

module.exports = NowPlayingTracker;
