const { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');

const NowPlayingTracker = require('./src/nowPlayingTracker');
const { fetchLyrics } = require('./src/lyrics');
const { loadWindowState, saveWindowState } = require('./src/windowState');
const { loadSettings, saveSettings } = require('./src/settingsStore');

let mainWindow = null;
let settingsWin = null;
let tray = null;
let tracker = null;
let tickTimer = null;
let config = null;
let settings = loadSettings();

// 当前已加载歌词的歌曲信息
let loadedTrackKey = null;
let currentLines = [];

function loadConfig() {
  const configPath = path.join(__dirname, 'config.json');
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(raw);
  } catch (err) {
    return { tickIntervalMs: 200 };
  }
}

function applyAutostart() {
  // 仅在打包后生效（开发模式下设了也没意义）
  if (app.isPackaged) {
    app.setLoginItemSettings({
      openAtLogin: !!settings.autostart,
      path: process.execPath,
    });
  }
}

// 把设置实时应用到悬浮歌词窗（背景色 + 透明度 + 歌词颜色）
function applySettingsToLyrics() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('settings:apply', {
      transparency: settings.transparency,
      bgColor: settings.bgColor,
      lyricColor: settings.lyricColor,
    });
  }
}

function createWindow() {
  const state = loadWindowState();

  mainWindow = new BrowserWindow({
    x: state.x,
    y: state.y,
    width: state.width,
    height: state.height,
    minWidth: 260,
    minHeight: 120,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    skipTaskbar: true,
    icon: path.join(__dirname, 'assets', 'app-icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.setAlwaysOnTop(true, 'screen-saver');
  mainWindow.loadFile(path.join(__dirname, 'renderer', 'main', 'index.html'));

  mainWindow.on('resize', () => saveWindowState(mainWindow));
  mainWindow.on('move', () => saveWindowState(mainWindow));
}

function createSettingsWindow() {
  if (settingsWin && !settingsWin.isDestroyed()) {
    settingsWin.focus();
    return;
  }
  settingsWin = new BrowserWindow({
    width: 380,
    height: 360,
    resizable: false,
    minimizable: false,
    maximizable: false,
    alwaysOnTop: true,
    frame: true,
    icon: path.join(__dirname, 'assets', 'app-icon.png'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });
  settingsWin.loadFile(path.join(__dirname, 'renderer', 'settings', 'index.html'));
  settingsWin.on('closed', () => {
    settingsWin = null;
  });
}

function createTray() {
  const trayIcon = nativeImage.createFromPath(
    path.join(__dirname, 'assets', 'tray-icon.png')
  );
  tray = new Tray(trayIcon.resize({ width: 16, height: 16 }));
  tray.setToolTip('Spotify 悬浮歌词');
  updateTrayMenu();
}

function updateTrayMenu() {
  const isVisible = mainWindow && mainWindow.isVisible();
  const menu = Menu.buildFromTemplate([
    {
      label: isVisible ? '隐藏歌词窗' : '显示歌词窗',
      click: () => {
        if (!mainWindow) return;
        if (mainWindow.isVisible()) mainWindow.hide();
        else mainWindow.show();
        updateTrayMenu();
      },
    },
    {
      label: '设置',
      click: () => createSettingsWindow(),
    },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        app.isQuitting = true;
        app.quit();
      },
    },
  ]);
  tray.setContextMenu(menu);
}

function sendStatus(status, message) {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('lyrics:status', { status, message });
  }
}

// 每次系统汇报"播放有变化"时调用：判断是不是换歌了，换了就重新拉一次歌词。
//
// 这里有两个关键保护，专门解决"快速手动切歌时歌词长时间空白/显示错乱"的问题：
//   1）防抖：连续快速切歌（比如 2 → 3）时，中间划过的那些不会真的去发网络请求，
//      只有用户"停下来"的最后一首才会真正拉取歌词，避免同时挂着好几个慢请求。
//   2）过期结果丢弃：网络请求是异步的，返回时间不可控。如果一首歌的请求还没
//      回来、用户已经又切了别的歌，那么这次"迟到"的结果会被直接丢弃，
//      不会去覆盖当前正在显示的、属于另一首歌的歌词。
//   没有这两个保护时会发生什么：切到歌 2 后歌 2 的请求很慢，用户不耐烦切到歌 3
//   （歌 3 请求更快，正常显示），但歌 2 那个迟到的请求随后终于返回，直接把
//   歌 3 的歌词覆盖掉——表现出来就是"莫名其妙空白/显示对不上"。
let pendingFetchTimer = null;
const SKIP_DEBOUNCE_MS = 350;

async function handleNowPlayingUpdate(snapshot) {
  if (!snapshot.found) {
    loadedTrackKey = null;
    currentLines = [];
    if (pendingFetchTimer) {
      clearTimeout(pendingFetchTimer);
      pendingFetchTimer = null;
    }
    sendStatus('idle', '没有检测到 Spotify 正在播放（请确认 Spotify 已打开并在播放歌曲）');
    return;
  }

  const trackKey = `${snapshot.title}::${snapshot.artist}`;
  if (trackKey === loadedTrackKey) {
    return; // 还是同一首歌，不用重新拉歌词
  }

  // 立即记下"现在选中的是这首"，即使还没真正开始请求歌词，
  // 后面的过期结果判断都靠这个值来对比。
  loadedTrackKey = trackKey;

  sendStatus('loading', `正在获取《${snapshot.title}》的歌词...`);

  if (pendingFetchTimer) clearTimeout(pendingFetchTimer);
  pendingFetchTimer = setTimeout(() => {
    pendingFetchTimer = null;
    loadLyricsForTrack(trackKey, snapshot.title, snapshot.artist, snapshot.durationSec).catch(
      (err) => console.error('加载歌词失败:', err)
    );
  }, SKIP_DEBOUNCE_MS);
}

async function loadLyricsForTrack(trackKey, title, artist, durationSec) {
  const lyricsResult = await fetchLyrics(title, artist, durationSec);

  // 这次请求花了一段时间，这段时间里用户可能已经又切歌了——
  // 如果当前选中的歌已经不是这次请求对应的那首，直接丢弃，不去覆盖界面。
  if (trackKey !== loadedTrackKey) return;

  if (mainWindow && !mainWindow.isDestroyed()) {
    currentLines = lyricsResult.lines || [];

    mainWindow.webContents.send('lyrics:update', {
      title,
      artist,
      found: lyricsResult.found,
      lines: currentLines,
    });
  }

  sendStatus(
    lyricsResult.found ? 'ok' : 'no-lyrics',
    lyricsResult.found ? '' : `没有找到《${title}》的歌词`
  );
}

function startTracking() {
  tracker = new NowPlayingTracker();

  tracker.on('update', (snapshot) => {
    handleNowPlayingUpdate(snapshot).catch((err) => {
      console.error('处理播放状态更新失败:', err);
    });
  });

  tracker.on('fatal-error', (err) => {
    console.error('播放信息追踪出错:', err);
    const tip =
      process.platform === 'darwin'
        ? 'macOS 下请确保使用的是 Spotify 官方桌面版，并在弹窗中允许"控制 Spotify"的辅助功能权限'
        : process.platform === 'win32'
        ? '读取系统播放信息失败，请确认系统是 Windows 10 1809 及以上版本'
        : '当前系统暂不支持读取播放信息（仅支持 Windows 与 macOS）';
    sendStatus('error', tip);
  });

  // 本地按固定频率插值计算播放进度，驱动歌词高亮的平滑更新，
  // 不需要每次都重新问系统要数据。
  tickTimer = setInterval(() => {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    const positionSec = tracker.getInterpolatedPositionSec();
    const isPlaying = tracker.latest && tracker.latest.isPlaying;
    mainWindow.webContents.send('lyrics:tick', {
      progressMs: positionSec * 1000,
      isPlaying: !!isPlaying,
    });
  }, config.tickIntervalMs || 200);
}

// ---- IPC ----

ipcMain.on('window:hide', () => {
  if (mainWindow) mainWindow.hide();
  updateTrayMenu();
});

ipcMain.on('window:open-settings', () => createSettingsWindow());

// 设置窗读写设置
ipcMain.handle('settings:get', () => settings);

ipcMain.handle('settings:save', (event, patch) => {
  settings = { ...settings, ...patch };
  saveSettings(settings);
  applyAutostart();
  applySettingsToLyrics();
  return settings;
});

app.whenReady().then(() => {
  config = loadConfig();
  applyAutostart();
  createWindow();
  createTray();
  mainWindow.webContents.once('did-finish-load', () => {
    applySettingsToLyrics(); // 启动即按保存的设置渲染背景/透明度
    startTracking();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && app.isQuitting) {
    app.quit();
  }
});

app.on('before-quit', () => {
  if (tickTimer) clearInterval(tickTimer);
  if (pendingFetchTimer) clearTimeout(pendingFetchTimer);
  if (tracker) tracker.destroy();
});
