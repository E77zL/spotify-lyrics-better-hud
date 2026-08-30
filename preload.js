// preload 脚本运行在渲染进程里，但拥有访问 Node.js API 的权限。
// 出于安全考虑，我们不直接把 ipcRenderer 整个暴露出去，
// 而是只暴露"歌词窗口 / 设置窗口真正需要用到"的那几个具体方法。

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('lyricsAPI', {
  // 主进程 -> 渲染进程：切歌了，推送新的歌词全文
  onLyricsUpdate: (callback) => {
    ipcRenderer.on('lyrics:update', (_event, payload) => callback(payload));
  },
  // 主进程 -> 渲染进程：每秒推送一次当前播放进度，用来决定高亮哪一行
  onProgressTick: (callback) => {
    ipcRenderer.on('lyrics:tick', (_event, payload) => callback(payload));
  },
  // 主进程 -> 渲染进程：连接状态变化（比如没登录、Spotify没在播放等）
  onStatusChange: (callback) => {
    ipcRenderer.on('lyrics:status', (_event, payload) => callback(payload));
  },
  // 主进程 -> 渲染进程：设置变化（背景色 / 透明度 / 歌词颜色）
  onSettingsApply: (callback) => {
    ipcRenderer.on('settings:apply', (_event, payload) => callback(payload));
  },
  // 渲染进程 -> 主进程：用户点了关闭按钮，隐藏悬浮窗（不是退出整个程序）
  closeWindow: () => ipcRenderer.send('window:hide'),
  // 渲染进程 -> 主进程：用户拖动了缩放，重新对齐位置用（预留）
  requestResize: (size) => ipcRenderer.send('window:resize', size),
  // 渲染进程 -> 主进程：打开设置窗
  openSettings: () => ipcRenderer.send('window:open-settings'),
  // 设置窗口：读取当前设置
  getSettings: () => ipcRenderer.invoke('settings:get'),
  // 设置窗口：保存设置（实时生效）
  saveSettings: (patch) => ipcRenderer.invoke('settings:save', patch),
});
