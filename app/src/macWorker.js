// 这个文件运行在独立的 Worker 线程里，专门负责在 macOS 上读取 Spotify 的播放信息。
//
// 为什么不用和 Windows 一样的 SMTC：SMTC 是 Windows 专属的系统媒体控制接口，
// macOS 上没有对等物。这里改用 macOS 自带、无需任何依赖的「AppleScript + Spotify」：
// 直接用 osascript 向 Spotify 应用询问当前曲目、歌手、进度、时长、播放状态。
// 好处是零原生模块、零额外安装；代价是依赖 Spotify 在 macOS 上响应 AppleScript
// （官方桌面版支持）。进度由主线程插值，所以这里 1 秒轮询一次即可。

const { parentPort } = require('worker_threads');
const { exec } = require('child_process');

// 让 Spotify 把关键信息用 "||" 拼成一行返回，方便解析
const SCRIPT = `
tell application "Spotify"
  if (player state is playing) or (player state is paused) then
    set pState to player state
    set pos to player position
    set dur to duration of current track
    set t to name of current track
    set ar to artist of current track
    set al to album of current track
    return (pState as text) & "||" & (pos as text) & "||" & (dur as text) & "||" & t & "||" & ar & "||" & al
  else
    return "stopped"
  end if
end tell
`;

let timer = null;

function poll() {
  exec(`osascript -e '${SCRIPT.replace(/'/g, "'\\''")}'`, { timeout: 4000 }, (err, stdout) => {
    if (err) {
      parentPort.postMessage({ found: false, error: err.message });
      return;
    }
    const out = (stdout || '').trim();
    if (out === 'stopped' || !out) {
      parentPort.postMessage({ found: false, isPlaying: false, lastUpdatedTime: Date.now() });
      return;
    }
    const parts = out.split('||');
    if (parts.length < 6) {
      parentPort.postMessage({ found: false, lastUpdatedTime: Date.now() });
      return;
    }
    const [state, pos, dur, title, artist, album] = parts;
    // Spotify AppleScript：player position 单位秒，duration 单位毫秒
    parentPort.postMessage({
      found: true,
      title: (title || '').trim(),
      artist: (artist || '').trim(),
      album: (album || '').trim(),
      positionSec: parseFloat(pos) || 0,
      durationSec: (parseFloat(dur) || 0) / 1000,
      isPlaying: (state || '').trim() === 'playing',
      lastUpdatedTime: Date.now(),
    });
  });
}

parentPort.on('message', (msg) => {
  if (msg === 'start') {
    poll();
    timer = setInterval(poll, 1000);
  } else if (msg === 'stop') {
    if (timer) clearInterval(timer);
    timer = null;
  }
});
