'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function offsetFile() {
  if (process.env.SPOTIFY_HUD_TIMING_FILE) return process.env.SPOTIFY_HUD_TIMING_FILE;
  let configured;
  try { configured = JSON.parse(fs.readFileSync(process.env.SPOTIFY_HUD_CONNECTION, 'utf8').replace(/^\uFEFF/, '')).spotifyPath; } catch { }
  const directories = [configured,
    process.env.APPDATA && path.join(process.env.APPDATA, 'Spotify'),
    process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Spotify'),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Spotify')];
  const root = directories.find(dir => dir && fs.existsSync(path.join(dir, 'Spotify.exe')));
  if (!root) throw new Error('Spotify installation directory not found');
  return path.join(root, 'LyricsHUD', 'lyric-offsets.json');
}

function createOffsetStore(file) {
  const entries = new Map();
  try {
    const saved = JSON.parse(fs.readFileSync(file, 'utf8'));
    for (const [id, entry] of Object.entries(saved.offsets || {})) {
      if (/^[a-f0-9]{64}$/.test(id) && Number.isInteger(entry?.delayMs) && Math.abs(entry.delayMs) <= 60000) entries.set(id, entry);
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const idFor = key => crypto.createHash('sha256').update(key).digest('hex');
  return {
    get: key => entries.get(idFor(key))?.delayMs || 0,
    set(key, delayMs, snapshot) {
      const id = idFor(key);
      const next = new Map(entries);
      delayMs = Math.max(-60000, Math.min(60000, Math.round(delayMs)));
      if (delayMs) next.set(id, { title: snapshot.title, artist: snapshot.artist || '', durationSec: snapshot.durationSec || 0, delayMs });
      else next.delete(id);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      const temporary = file + '.tmp';
      try {
        fs.writeFileSync(temporary, JSON.stringify({ version: 1, offsets: Object.fromEntries(next) }), 'utf8');
        fs.renameSync(temporary, file);
      } catch (error) {
        try { fs.unlinkSync(temporary); } catch { }
        throw error;
      }
      entries.clear();
      for (const [id, entry] of next) entries.set(id, entry);
      return delayMs;
    },
  };
}

module.exports = { offsetFile, createOffsetStore };
