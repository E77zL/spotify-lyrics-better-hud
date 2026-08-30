// 公共 LRC 解析工具：被 lyrics.js（LRCLIB / QQ 音乐）共用，
// 单独抽出来避免模块之间互相 require 造成循环依赖。

// 把 LRC 文本解析成 [{ time: 12.34, text: "这一行歌词" }, ...]
// LRC 时间标签形如 [mm:ss.xx] 或 [mm:ss.xxx]
function parseLRC(lrcText) {
  const lines = [];
  if (!lrcText) return lines;
  const timeTagPattern = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;

  for (const rawLine of lrcText.split('\n')) {
    const tags = [...rawLine.matchAll(timeTagPattern)];
    if (tags.length === 0) continue;

    const text = rawLine.replace(timeTagPattern, '').trim();
    if (!text) continue; // 跳过纯时间戳、没有歌词内容的行

    for (const tag of tags) {
      const minutes = Number(tag[1]);
      const seconds = Number(tag[2]);
      const fraction = tag[3] ? Number(`0.${tag[3]}`) : 0;
      const time = minutes * 60 + seconds + fraction;
      lines.push({ time, text });
    }
  }

  lines.sort((a, b) => a.time - b.time);
  return lines;
}

// 各歌词源的歌词里常混有「作词 : xxx」「词：周杰伦」「OP: xxx」这类
// 制作信息行，它们不是歌词，应当过滤掉，否则会当成一句歌词高亮出来。
// 注意：中文与冒号之间没有 \b 词边界，所以用 \s*[:：] 而不是 \b。
function isMetadataLine(text) {
  if (!text) return true;
  const t = text.trim().replace(/\s+/g, '');
  return (
    /^(作词|作曲|编曲|制作人|监制|混音|母带|出品|发行|钢琴|吉他|贝斯|鼓|键盘|弦乐|录音|配唱|和声|合声|视觉|封面|策划|统筹|宣发|原唱|翻唱)(编写)?\s*[:：]/.test(t) ||
    /^(词|曲)\s*[:：]/.test(t) ||
    /^(OP|SP|Studio|Label|Published)\s*[:：]/i.test(t)
  );
}

module.exports = { parseLRC, isMetadataLine };
