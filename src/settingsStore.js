// 设置的本地持久化：透明度、背景颜色、歌词颜色、开机自启。
// 存在用户数据目录（userData）下，和歌词窗口状态分开存，重装/升级都不丢。

const fs = require('fs');
const path = require('path');
const { app } = require('electron');

function getSettingsPath() {
  return path.join(app.getPath('userData'), 'settings.json');
}

const DEFAULTS = {
  transparency: 0.55, // 面板背景不透明度（0.1 ~ 1.0）
  bgColor: '#121214', // 面板背景颜色（十六进制）
  lyricColor: '#f5f5f0', // 歌词文字颜色（十六进制）
  autostart: false, // 是否开机自启
};

function loadSettings() {
  try {
    const raw = fs.readFileSync(getSettingsPath(), 'utf-8');
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch (err) {
    return { ...DEFAULTS };
  }
}

function saveSettings(settings) {
  try {
    fs.writeFileSync(getSettingsPath(), JSON.stringify(settings, null, 2), 'utf-8');
  } catch (err) {
    console.error('保存设置失败:', err);
  }
}

module.exports = { DEFAULTS, loadSettings, saveSettings, getSettingsPath };
