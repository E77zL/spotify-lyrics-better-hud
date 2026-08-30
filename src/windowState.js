// 记住悬浮歌词窗口上次关闭时的位置和大小，下次打开程序时恢复到原位，
// 而不是每次都弹在屏幕正中间。

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function getStateFilePath() {
  return path.join(app.getPath('userData'), 'window-state.json');
}

const DEFAULT_STATE = { x: undefined, y: undefined, width: 420, height: 260 };

function loadWindowState() {
  try {
    const raw = fs.readFileSync(getStateFilePath(), 'utf-8');
    return { ...DEFAULT_STATE, ...JSON.parse(raw) };
  } catch (err) {
    return DEFAULT_STATE;
  }
}

function saveWindowState(win) {
  if (!win || win.isDestroyed()) return;
  const bounds = win.getBounds();
  try {
    fs.writeFileSync(getStateFilePath(), JSON.stringify(bounds, null, 2), 'utf-8');
  } catch (err) {
    console.error('保存窗口位置失败:', err);
  }
}

module.exports = { loadWindowState, saveWindowState };
