'use strict';
const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } = require('electron');
const path = require('path');
const NowPlayingTracker = require('./src/nowPlayingTracker');
const { fetchLyrics } = require('./src/lyrics');
const { startPlayback } = require('./src/hud-playback');
const { createStore } = require('./src/hud-store');
const { offsetFile, createOffsetStore } = require('./src/hud-offsets');
const { toolWindowOptions, keepOffTaskbar } = require('./src/hud-window');

if (process.env.SPOTIFY_HUD_USER_DATA) app.setPath('userData', process.env.SPOTIFY_HUD_USER_DATA);
const settingsStore = createStore(path.join(app.getPath('userData'), 'settings.json'), {
  transparency: 0.55, bgColor: '#121214', lyricColor: '#f5f5f0',
});
const boundsStore = createStore(path.join(app.getPath('userData'), 'window-state.json'), { width: 420, height: 260 });
const managed = process.argv.includes('--managed-by-spotify');
const singleInstance = app.requestSingleInstanceLock();
let mainWindow, settingsWindow, tray, trayMenu, playback, control, fullscreenGuard;
let settings = settingsStore.get();
let offsets;
try { offsets = createOffsetStore(offsetFile()); }
catch (error) { console.error('Lyric timing:', error.message); }

function send(channel, payload) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send(channel, payload);
}

function applySettings() {
  send('settings:apply', settings);
}

function refreshTray() {
  if (!trayMenu) return;
  const enabled = control ? control.isEnabled() : mainWindow.isVisible();
  const item = trayMenu.getMenuItemById('visibility');
  const label = enabled ? '隐藏歌词窗' : '显示歌词窗';
  if (item.label !== label) { item.label = label; tray.setContextMenu(trayMenu); }
}

function toggleWindow(enabled) {
  if (control) control.setEnabled(enabled);
  else if (enabled) mainWindow.showInactive();
  else mainWindow.hide();
  refreshTray();
}

function openSettings() {
  if (settingsWindow && !settingsWindow.isDestroyed()) { settingsWindow.focus(); return; }
  settingsWindow = keepOffTaskbar(new BrowserWindow({
    ...toolWindowOptions, parent: mainWindow, show: false,
    width: 380, height: 470, useContentSize: true, resizable: false, minimizable: false, maximizable: false,
    alwaysOnTop: true, icon: path.join(__dirname, 'assets/app-icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  }));
  settingsWindow.once('ready-to-show', () => { if (settingsWindow && !settingsWindow.isDestroyed()) settingsWindow.show(); });
  settingsWindow.loadFile(path.join(__dirname, 'renderer/settings/index.html'));
  settingsWindow.on('closed', () => { settingsWindow = null; });
}

function createWindow() {
  mainWindow = keepOffTaskbar(new BrowserWindow({
    ...boundsStore.get(), show: false, minWidth: 260, minHeight: 120,
    ...toolWindowOptions,
    frame: false, transparent: true, alwaysOnTop: true, resizable: true, focusable: false,
    icon: path.join(__dirname, 'assets/app-icon.png'),
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false },
  }));
  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  const saveBounds = () => { if (!mainWindow.isDestroyed()) boundsStore.update(mainWindow.getBounds()); };
  mainWindow.on('resize', saveBounds);
  mainWindow.on('move', saveBounds);
  mainWindow.on('show', () => { if (playback) playback.setVisible(true); });
  mainWindow.on('hide', () => { if (playback) playback.setVisible(false); });
  mainWindow.webContents.once('did-finish-load', () => {
    fullscreenGuard = require('./src/hud-fullscreen').startFullscreenGuard({ app, window: mainWindow });
    applySettings();
    const tracker = new NowPlayingTracker();
    tracker.on('fatal-error', error => {
      console.error('Playback:', error.message);
      send('lyrics:status', { status: 'error', message: '读取系统播放信息失败，请确认系统是 Windows 10 1809 及以上版本' });
    });
    playback = startPlayback({ tracker, fetchLyrics, send, offsetStore: offsets, visible: false });
    if (managed) {
      control = require('./src/hud-control').startHudControl({
        app, window: mainWindow, connectionFile: process.env.SPOTIFY_HUD_CONNECTION,
        loadEnabled: () => settings.hudEnabled,
        saveEnabled: hudEnabled => { settings.hudEnabled = hudEnabled; settingsStore.update({ hudEnabled }); },
        refreshTray,
        onPlayback: snapshot => tracker.acceptSpotify(snapshot),
        getTiming: () => tracker.getTimingState(),
        getFullscreenLocked: () => fullscreenGuard.isLocked(),
      });
    } else mainWindow.showInactive();
    refreshTray();
  });
  mainWindow.loadFile(path.join(__dirname, 'renderer/main/index.html'));
}

function createTray() {
  tray = new Tray(nativeImage.createFromPath(path.join(__dirname, 'assets/tray-icon.png')).resize({ width: 16, height: 16 }));
  tray.setToolTip('Spotify 悬浮歌词');
  trayMenu = Menu.buildFromTemplate([
    { id: 'visibility', label: '显示歌词窗', click: () => toggleWindow(control ? !control.isEnabled() : !mainWindow.isVisible()) },
    { label: '设置', click: openSettings },
    { type: 'separator' },
    { label: '退出', click: () => { app.isQuitting = true; app.quit(); } },
  ]);
  tray.setContextMenu(trayMenu);
}

ipcMain.on('window:hide', () => toggleWindow(false));
ipcMain.on('window:open-settings', openSettings);
ipcMain.handle('lyrics:adjust-timing', (event, deltaMs) => {
  if (mainWindow?.isDestroyed() || event.sender !== mainWindow?.webContents) return null;
  return playback?.adjustTiming(deltaMs);
});
ipcMain.handle('settings:get', () => settings);
ipcMain.handle('settings:save', (_event, patch) => {
  if (settingsStore.update(patch)) {
    settings = settingsStore.get();
    applySettings();
  }
  return settings;
});

if (singleInstance) {
  if (managed) require('./src/hud-lifetime').followSpotify({ app, BrowserWindow });
  app.whenReady().then(() => { createWindow(); createTray(); });
} else app.quit();

app.on('window-all-closed', () => { if (app.isQuitting) app.quit(); });
app.on('before-quit', () => {
  if (playback) playback.destroy();
  if (mainWindow && !mainWindow.isDestroyed()) boundsStore.update(mainWindow.getBounds());
  boundsStore.flush(); settingsStore.flush();
});
