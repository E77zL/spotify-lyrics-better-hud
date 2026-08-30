// QQ 音乐歌词源（非官方接口，无需登录、无需 API Key）。
//
// 为什么用它：中文曲库覆盖极好，正好补上 LRCLIB 中文歌"经常找不到"的短板。
//
// 实现要点：
//   - 搜索用 client_search_cp（免签名）拿到 songmid；
//   - 取歌词用 musicu.fcg（POST），需要本地算一个 sign：
//       sign = md5("zza" + JSON.stringify(req) + SECURITY_KEY)
//     SECURITY_KEY 是 QQ 音乐 web 端公开的反爬密钥，社区长期可用。
//   - 返回的 lyric 是 base64 编码的 LRC 文本。

const crypto = require('crypto');
const { parseLRC, isMetadataLine } = require('./lrc');
const { fetchWithTimeout } = require('./http');

const QQ_SEARCH = 'https://c.y.qq.com/soso/fcgi-bin/client_search_cp';
const QQ_LYRIC = 'https://u.y.qq.com/cgi-bin/musicu.fcg';
// QQ 音乐 web 端公开的反爬密钥（社区通用，非私密凭证）
const SECURITY_KEY = 'eJ5l4tJN3NysFOW4n9Q0kXivNaHfY';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36';

// 计算 musicu 接口签名：先对"尚未带 sign 的请求体"做 JSON，再拼接密钥取 MD5
function signRequest(req) {
  const sign = crypto
    .createHash('md5')
    .update('zza' + JSON.stringify(req) + SECURITY_KEY)
    .digest('hex');
  req.comm.sign = sign;
  return req;
}

async function searchSongMid(title, artist) {
  const keyword = artist ? `${title} ${artist}` : title;
  const url = `${QQ_SEARCH}?w=${encodeURIComponent(keyword)}&format=json&platform=yqq&p=1&n=8`;
  try {
    const res = await fetchWithTimeout(url, {
      headers: { Referer: 'https://y.qq.com/', 'User-Agent': UA },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const list = data && data.data && data.data.song && data.data.song.list;
    if (!Array.isArray(list) || !list.length) return null;

    // 优先挑歌手能对上的（避免同名翻唱/其他艺人）
    if (artist) {
      const lower = artist.toLowerCase();
      const hit = list.find((s) =>
        (s.singer || []).some((sg) => sg.name && lower.includes(sg.name.toLowerCase()))
      );
      if (hit) return hit.songmid;
    }
    return list[0].songmid;
  } catch (err) {
    console.error('QQ 搜索失败:', err.message);
    return null;
  }
}

async function getRawLyric(mid) {
  const req = signRequest({
    comm: {
      cv: 4747474,
      ct: 24,
      format: 'json',
      inCharset: 'utf-8',
      outCharset: 'utf-8',
      notice: 0,
      platform: 'yqq.json',
      needNewCode: 1,
      uin: 0,
      g_tk: 0,
    },
    req_1: {
      module: 'music.musichallSong.PlayLyricInfo',
      method: 'GetPlayLyricInfo',
      param: { songMID: mid, songType: 0 },
    },
  });

  try {
    const res = await fetchWithTimeout(QQ_LYRIC, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Referer: 'https://y.qq.com/',
        'User-Agent': UA,
      },
      body: JSON.stringify(req),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const d = data && data.req_1 && data.req_1.data;
    if (!d) return null;
    const decode = (b64) => (b64 ? Buffer.from(b64, 'base64').toString('utf-8') : null);
    return { lyric: decode(d.lyric) };
  } catch (err) {
    console.error('QQ 歌词获取失败:', err.message);
    return null;
  }
}

// 主入口：返回 { lines } 或 null（没找到）
async function fetchQQ(title, artist) {
  const mid = await searchSongMid(title, artist);
  if (!mid) return null;
  const raw = await getRawLyric(mid);
  if (!raw || !raw.lyric) return null;

  const lines = parseLRC(raw.lyric).filter((l) => !isMetadataLine(l.text));
  if (!lines.length) return null;

  return { lines };
}

module.exports = { fetchQQ };
