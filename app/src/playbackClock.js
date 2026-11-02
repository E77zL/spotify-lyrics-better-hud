'use strict';
const { performance } = require('perf_hooks');

function createPlaybackClock({ now = () => performance.now(), wallNow = Date.now } = {}) {
  let key, anchor = 0, position = 0, raw = 0, playing = false, duration = 0;
  function getPosition() {
    const seconds = position + (playing ? Math.max(0, now() - anchor) / 1000 : 0);
    return Math.max(0, duration > 0 ? Math.min(duration, seconds) : seconds);
  }
  return {
    getPosition,
    update(sample) {
      if (!sample.found) { key = null; position = raw = duration = 0; playing = false; return; }
      const nextKey = JSON.stringify([sample.title, sample.artist, Math.round(sample.durationSec || 0)]);
      const nextRaw = Math.max(0, Number(sample.positionSec) || 0);
      const nextPlaying = !!sample.isPlaying;
      const changed = nextKey !== key;
      if (sample.source === 'spotify' || changed || nextRaw !== raw || nextPlaying !== playing) {
        // Duplicate media/status events carry a fresh read timestamp with an OLD
        // position. Keep the existing anchor; otherwise every event rewinds time.
        const samePosition = sample.source !== 'spotify' && !changed && nextRaw === raw;
        position = samePosition ? getPosition() : nextRaw;
        const deliveryMs = nextPlaying && Number.isFinite(sample.lastUpdatedTime) ? Math.min(1000, Math.max(0, wallNow() - sample.lastUpdatedTime)) : 0;
        anchor = now() - (samePosition ? 0 : deliveryMs);
      }
      key = nextKey; raw = nextRaw; playing = nextPlaying;
      duration = Math.max(0, Number(sample.durationSec) || 0);
    },
  };
}

module.exports = { createPlaybackClock };
