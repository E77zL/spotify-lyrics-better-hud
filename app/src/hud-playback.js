'use strict';

// Playback owns the two short-lived timers and the current network request.
// CSS handles animation; the renderer only needs a tick when a line changes.
function startPlayback({ tracker, fetchLyrics, send, offsetStore = null, visible = true, debounceMs = 350 }) {
  const cache = new Map();
  let key, lines = [], request = null, fetchTimer = null, lineTimer = null;
  let lastIndex = null, lastPlaying = null, destroyed = false;
  let snapshot = null, delayMs = 0;

  function publishTiming(error = '') {
    const state = { offsetMs: delayMs, canAdjust: !!offsetStore && !!snapshot && lines.length > 0, error };
    send('lyrics:timing', state);
    return state;
  }

  function cancelTrack() {
    clearTimeout(fetchTimer); clearTimeout(lineTimer);
    fetchTimer = lineTimer = null;
    if (request) request.abort();
    request = null;
  }

  function tick(force = false) {
    clearTimeout(lineTimer); lineTimer = null;
    if (destroyed || !visible || !lines.length) return;
    const progress = tracker.getInterpolatedPositionSec() - delayMs / 1000;
    const playing = !!tracker.latest.isPlaying;
    let low = 0, high = lines.length;
    while (low < high) {
      const mid = (low + high) >>> 1;
      if (lines[mid].time <= progress) low = mid + 1;
      else high = mid;
    }
    const index = low - 1;
    if (force || index !== lastIndex || playing !== lastPlaying) {
      send('lyrics:tick', { progressMs: progress * 1000, index, isPlaying: playing });
      lastIndex = index; lastPlaying = playing;
    }
    if (playing && low < lines.length) {
      lineTimer = setTimeout(tick, Math.max(10, Math.ceil((lines[low].time - progress) * 1000)));
    }
  }

  function present(snapshot, result) {
    lines = result.lines || [];
    send('lyrics:update', { title: snapshot.title, artist: snapshot.artist || result.artist || '', found: result.found, lines });
    send('lyrics:status', { status: result.found ? 'ok' : 'no-lyrics', message: result.found ? '' : `没有找到《${snapshot.title}》的歌词` });
    publishTiming();
    tick(true);
  }

  async function lookup(snapshot, trackKey, controller) {
    try {
      const result = await fetchLyrics(snapshot.title, snapshot.artist, snapshot.durationSec, controller.signal);
      // Identity, rather than song name alone, also protects an A -> B -> A seek.
      if (destroyed || request !== controller) return;
      request = null;
      if (result.found) {
        cache.set(trackKey, result);
        if (cache.size > 8) cache.delete(cache.keys().next().value);
      }
      present(snapshot, result);
    } catch (error) {
      if (destroyed || request !== controller || controller.signal.aborted) return;
      request = null;
      console.error('Lyrics:', error.message);
      present(snapshot, { found: false, lines: [] });
    }
  }

  function update(nextSnapshot) {
    if (destroyed) return;
    snapshot = nextSnapshot;
    if (!snapshot.found) {
      if (key !== null) {
        cancelTrack(); key = null; lines = [];
        snapshot = null; delayMs = 0; publishTiming();
        send('lyrics:status', { status: 'idle', message: '没有检测到 Spotify 正在播放（请确认 Spotify 已打开并在播放歌曲）' });
      }
      return;
    }
    const trackKey = JSON.stringify([snapshot.title, snapshot.artist, Math.round(snapshot.durationSec || 0)]);
    if (trackKey === key) { tick(); return; }
    cancelTrack(); key = trackKey; lines = [];
    delayMs = offsetStore?.get(trackKey) || 0;
    publishTiming();
    const cached = cache.get(trackKey);
    if (cached) {
      cache.delete(trackKey); cache.set(trackKey, cached);
      present(snapshot, cached);
      return;
    }
    send('lyrics:status', { status: 'loading', message: `正在获取《${snapshot.title}》的歌词...` });
    const controller = request = new AbortController();
    fetchTimer = setTimeout(() => { fetchTimer = null; lookup(snapshot, trackKey, controller); }, debounceMs);
  }

  tracker.on('update', update);
  return {
    setVisible(value) { visible = !!value; tick(true); },
    adjustTiming(deltaMs) {
      if (destroyed || !snapshot || !lines.length || !offsetStore) return publishTiming();
      if (![0, -500, 500].includes(deltaMs)) return publishTiming('Invalid timing adjustment');
      try {
        delayMs = offsetStore.set(key, deltaMs === 0 ? 0 : delayMs + deltaMs, snapshot);
        tick(true);
        return publishTiming();
      } catch (error) {
        return publishTiming('Could not save lyric timing: ' + error.message);
      }
    },
    destroy() {
      destroyed = true; cancelTrack(); cache.clear();
      tracker.removeListener('update', update); tracker.destroy();
    },
  };
}

module.exports = { startPlayback };
