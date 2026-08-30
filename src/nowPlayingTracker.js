// 主进程这边用来跟 smtcWorker.js 打交道的封装。
//
// 关键技巧：Worker 线程只在"有变化"的时候才发消息过来（省资源），
// 但悬浮窗需要每秒好多次刷新进度条才能让高亮显得平滑。
// 解决办法是"插值"：我们记住最后一次收到的 { 进度, 更新时间, 是否在播放 }，
// 之后本地按时间差自己算"现在大概播放到哪了"，不需要每次都问 Windows 要新数据。

const path = require('path');
const { Worker } = require('worker_threads');
const EventEmitter = require('events');

// 不同系统用不同的"读取播放信息"实现：
//   - Windows：SMTC 系统媒体控制（原生模块，进度/暂停最准）
//   - macOS：AppleScript 直连 Spotify（零依赖）
//   - 其它（如 Linux）：暂不支持，给出友好提示
function pickWorkerFile() {
  if (process.platform === 'win32') return 'smtcWorker.js';
  if (process.platform === 'darwin') return 'macWorker.js';
  return null;
}

class NowPlayingTracker extends EventEmitter {
  constructor() {
    super();
    this.latest = { found: false };
    this.worker = null;
    this._unsupported = false;
    this._startWorker();
  }

  _startWorker() {
    const workerFile = pickWorkerFile();
    if (!workerFile) {
      this._unsupported = true;
      // 延后到监听器挂好之后再报错，否则构造时抛出的事件会丢失
      setImmediate(() =>
        this.emit(
          'fatal-error',
          new Error('当前系统暂不支持读取播放信息（目前仅支持 Windows 与 macOS）')
        )
      );
      return;
    }

    this.worker = new Worker(path.join(__dirname, workerFile));
    if (process.platform === 'darwin') this.worker.postMessage('start');

    this.worker.on('message', (snapshot) => {
      this.latest = snapshot;
      this.emit('update', snapshot);
    });

    this.worker.on('error', (err) => {
      this.emit('fatal-error', err);
    });

    this.worker.on('exit', (code) => {
      if (code !== 0) {
        this.emit(
          'fatal-error',
          new Error(`SMTC 监听线程异常退出 (code ${code})`)
        );
      }
    });
  }

  // 根据"最后一次系统汇报的进度 + 到现在经过的时间"，估算当前实际播放到第几秒。
  // 暂停时不需要插值，直接用汇报的值即可。
  getInterpolatedPositionSec() {
    if (!this.latest || !this.latest.found) return 0;

    const { positionSec, isPlaying, lastUpdatedTime } = this.latest;
    if (!isPlaying) return positionSec;

    const elapsedSec = (Date.now() - lastUpdatedTime) / 1000;
    return positionSec + Math.max(0, elapsedSec);
  }

  destroy() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
    }
  }
}

module.exports = NowPlayingTracker;
