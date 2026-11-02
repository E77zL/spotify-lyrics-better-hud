// 这个文件运行在一个独立的 Worker 线程里（不是 Electron 主进程，也不是页面），
// 专门负责调用 Windows 的原生 SMTC 接口。
//
// 为什么要单独开一个线程：SMTC 底层是同步的原生调用，如果直接在 Electron
// 主进程里调用，会短暂"卡住"主线程，导致悬浮窗跟着卡顿。丢到 Worker 线程里，
// 卡的只是这个后台线程，不影响界面流畅度。
//
// 工作方式：监听 SMTC 抛出的各种"有变化了"事件（换歌、进度变化、播放/暂停），
// 每次变化都重新扫一遍当前所有的播放会话，找到 Spotify 对应的那一个，
// 把关键信息（歌名、歌手、时长、当前进度、是否在播放）发送给主线程。

const { parentPort } = require('worker_threads');
const { SMTCMonitor } = require('@coooookies/windows-smtc-monitor');

// SMTC 的 playbackStatus 是系统定义的数字状态码：
// 0=Closed 1=Opened 2=Changing 3=Stopped 4=Playing 5=Paused
const PLAYBACK_STATUS_PLAYING = 4;

// 保持一个实例存活，用来注册事件监听（内部会启动系统会话管理器）
const monitor = new SMTCMonitor();

function findSpotifySession(sessions) {
  if (!Array.isArray(sessions) || sessions.length === 0) return null;

  // 优先找 sourceAppId 里包含 "spotify" 的会话（不区分大小写）。
  // 无论是官网安装版（通常是 Spotify.exe）还是 Microsoft Store 版，
  // appId 里一般都会带 "spotify" 字样。
  const spotifySession = sessions.find(
    (s) => s.sourceAppId && s.sourceAppId.toLowerCase().includes('spotify')
  );
  if (spotifySession) return spotifySession;

  return null;
}

function buildSnapshot(session) {
  if (!session) {
    return { found: false };
  }

  const { media, playback, timeline, lastUpdatedTime } = session;

  return {
    found: true,
    title: media.title || '',
    artist: media.artist || '',
    durationSec: timeline ? timeline.duration : 0,
    positionSec: timeline ? timeline.position : 0,
    isPlaying: playback ? playback.playbackStatus === PLAYBACK_STATUS_PLAYING : false,
    lastUpdatedTime: lastUpdatedTime || Date.now()
  };
}

function refreshAndSend() {
  try {
    const sessions = SMTCMonitor.getMediaSessions();
    const spotifySession = findSpotifySession(sessions);
    parentPort.postMessage(buildSnapshot(spotifySession));
  } catch (err) {
    parentPort.postMessage({ found: false, error: err.message });
  }
}

// 任何一种变化都触发重新扫描：换歌、进度变化、播放状态变化、
// 会话新增/移除（比如打开/关闭了 Spotify）、系统认为的"当前会话"变化
monitor.on('session-media-changed', refreshAndSend);
monitor.on('session-timeline-changed', refreshAndSend);
monitor.on('session-playback-changed', refreshAndSend);
monitor.on('session-added', refreshAndSend);
monitor.on('session-removed', refreshAndSend);
monitor.on('current-session-changed', refreshAndSend);

// 启动时先主动发一次当前状态，不用等第一个事件触发
refreshAndSend();
