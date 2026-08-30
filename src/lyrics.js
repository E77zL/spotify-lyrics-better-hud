// 从歌词库获取带时间戳的歌词。
//
// 策略：
//   1) LRCLIB 优先（免费、无需 Key、社区维护、外文歌时间轴最准）；
//   2) 找不到时回退 QQ 音乐（中文曲库覆盖极好）。
//
// 返回值统一为 { found, lines }：lines 为 [{ time, text }]

const { parseLRC, isMetadataLine } = require('./lrc');
const { fetchQQ } = require('./qqmusic');
const { fetchWithTimeout } = require('./http');

const LRCLIB_GET_URL = 'https://lrclib.net/api/get';
const LRCLIB_SEARCH_URL = 'https://lrclib.net/api/search';

const LRCLIB_HEADERS = {
  'User-Agent': 'spotify-lyrics-hud/5.0 (https://github.com/example/spotify-lyrics-hud)',
};

async function tryExactMatch(trackName, artistName, durationSec) {
  const url = new URL(LRCLIB_GET_URL);
  url.searchParams.set('track_name', trackName);
  url.searchParams.set('artist_name', artistName);
  if (durationSec) url.searchParams.set('duration', String(Math.round(durationSec)));

  const res = await fetchWithTimeout(url.toString(), { headers: LRCLIB_HEADERS });
  if (!res.ok) return null;
  const data = await res.json();
  if (data && data.syncedLyrics) return data.syncedLyrics;
  return null;
}

async function trySearch(trackName, artistName, durationSec) {
  const url = new URL(LRCLIB_SEARCH_URL);
  url.searchParams.set('track_name', trackName);
  url.searchParams.set('artist_name', artistName);

  const res = await fetchWithTimeout(url.toString(), { headers: LRCLIB_HEADERS });
  if (!res.ok) return null;
  const results = await res.json();
  if (!Array.isArray(results) || results.length === 0) return null;

  const withLyrics = results.filter((r) => r.syncedLyrics);
  if (withLyrics.length === 0) return null;

  // 知道时长时，优先选时长最接近的结果（同名翻唱/live 版时长不同）
  if (durationSec) {
    withLyrics.sort(
      (a, b) => Math.abs(a.duration - durationSec) - Math.abs(b.duration - durationSec)
    );
  }
  return withLyrics[0].syncedLyrics;
}

async function fetchLyrics(trackName, artistName, durationSec) {
  try {
    // 1) LRCLIB 优先
    let lrcText = await tryExactMatch(trackName, artistName, durationSec);
    if (!lrcText) lrcText = await trySearch(trackName, artistName, durationSec);

    if (lrcText) {
      const lines = parseLRC(lrcText).filter((l) => !isMetadataLine(l.text));
      if (lines.length) {
        return { found: true, lines, source: 'lrclib' };
      }
    }

    // 2) 回退 QQ 音乐（中文覆盖好）
    const qq = await fetchQQ(trackName, artistName);
    if (qq && qq.lines.length) {
      return { found: true, lines: qq.lines, source: 'qq' };
    }

    return { found: false, lines: [] };
  } catch (err) {
    console.error('获取歌词失败:', err);
    return { found: false, lines: [], error: err.message };
  }
}

module.exports = { fetchLyrics, parseLRC };
