'use strict';

// Treat the authenticated client as input, not as an arbitrary object to merge.
function spotifySnapshot(value, now = Date.now()) {
  if (!value || typeof value.found !== 'boolean') return null;
  if (!Number.isFinite(value.sentAt) || Math.abs(now - value.sentAt) > 3000) return null;
  if (!value.found) return { found: false, source: 'spotify' };
  if (typeof value.title !== 'string' || !value.title.trim() || value.title.length > 512 ||
      typeof value.artist !== 'string' || value.artist.length > 512 ||
      typeof value.isPlaying !== 'boolean' ||
      !Number.isFinite(value.positionSec) || value.positionSec < 0 ||
      !Number.isFinite(value.durationSec) || value.durationSec <= 0 || value.durationSec > 86400 ||
      value.positionSec > value.durationSec + 2) return null;
  return { found: true, title: value.title, artist: value.artist,
    durationSec: value.durationSec, positionSec: Math.min(value.durationSec, value.positionSec),
    isPlaying: value.isPlaying, lastUpdatedTime: Math.min(now, value.sentAt), source: 'spotify' };
}

module.exports = { spotifySnapshot };
