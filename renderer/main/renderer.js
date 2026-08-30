const lyricsList = document.getElementById('lyricsList');
const lyricsViewport = document.getElementById('lyricsViewport');
const trackInfo = document.getElementById('trackInfo');
const closeBtn = document.getElementById('closeBtn');
const fontSmallerBtn = document.getElementById('fontSmaller');
const fontBiggerBtn = document.getElementById('fontBigger');

let currentLines = []; // [{ time, text }]
let currentIndex = -1;
let lineElements = []; // 每句歌词的 <p>

// 字体大小可以被用户调整，记在 localStorage 里，下次打开窗口还是上次的大小
const FONT_STEP = 2;
const FONT_MIN = 14;
const FONT_MAX = 40;

function loadFontSize() {
  const saved = Number(localStorage.getItem('lyrics-font-size'));
  return saved && saved >= FONT_MIN && saved <= FONT_MAX ? saved : 22;
}

function applyFontSize(size) {
  document.documentElement.style.setProperty('--font-size-active', `${size}px`);
  document.documentElement.style.setProperty(
    '--font-size-dim',
    `${Math.max(FONT_MIN - 2, Math.round(size * 0.68))}px`
  );
  localStorage.setItem('lyrics-font-size', String(size));
}

applyFontSize(loadFontSize());

fontSmallerBtn.addEventListener('click', () => {
  applyFontSize(Math.max(FONT_MIN, loadFontSize() - FONT_STEP));
});

fontBiggerBtn.addEventListener('click', () => {
  applyFontSize(Math.min(FONT_MAX, loadFontSize() + FONT_STEP));
});

closeBtn.addEventListener('click', () => {
  window.lyricsAPI.closeWindow();
});

function renderStatusMessage(message) {
  currentLines = [];
  currentIndex = -1;
  lineElements = [];
  lyricsList.innerHTML = `<p class="status-message">${message}</p>`;
}

function renderLyricsLines(lines) {
  currentLines = lines;
  currentIndex = -1;
  lyricsList.innerHTML = '';
  lineElements = [];

  lines.forEach((line) => {
    const p = document.createElement('p');
    p.className = 'lyric-line';
    p.textContent = line.text;
    lyricsList.appendChild(p);
    lineElements.push(p);
  });
}

// 把当前播放行滚动/居中到窗口中间
function centerActiveLine() {
  if (currentIndex < 0 || !lineElements[currentIndex]) return;

  const activeEl = lineElements[currentIndex];
  const viewportHeight = lyricsViewport.clientHeight;
  const offset = activeEl.offsetTop + activeEl.offsetHeight / 2 - viewportHeight / 2;

  lyricsList.style.transform = `translateY(${-offset}px)`;
}

function setActiveIndex(index) {
  if (index === currentIndex) return;

  if (lineElements[currentIndex]) {
    lineElements[currentIndex].classList.remove('active');
  }
  currentIndex = index;
  if (lineElements[currentIndex]) {
    lineElements[currentIndex].classList.add('active');
  }
  centerActiveLine();
}

// 根据当前播放进度（毫秒），查找应该高亮哪一行
function findActiveIndex(progressMs) {
  if (currentLines.length === 0) return -1;
  const progressSec = progressMs / 1000;

  let idx = -1;
  for (let i = 0; i < currentLines.length; i++) {
    if (currentLines[i].time <= progressSec) {
      idx = i;
    } else {
      break;
    }
  }
  return idx;
}

window.lyricsAPI.onLyricsUpdate(({ title, artist, found, lines }) => {
  trackInfo.textContent = `${title} · ${artist}`;

  if (!found || lines.length === 0) {
    renderStatusMessage('暂无歌词');
  } else {
    renderLyricsLines(lines);
  }
});

window.lyricsAPI.onProgressTick(({ progressMs, isPlaying }) => {
  if (currentLines.length === 0) return;
  const idx = findActiveIndex(progressMs);
  setActiveIndex(idx);
});

window.lyricsAPI.onStatusChange(({ status, message }) => {
  if (status === 'idle') {
    trackInfo.textContent = '';
    renderStatusMessage(message || '当前没有正在播放的歌曲');
  } else if (status === 'error') {
    trackInfo.textContent = '';
    renderStatusMessage(message || '出错了');
  } else if (status === 'loading') {
    renderStatusMessage(message || '正在获取歌词...');
  } else if (status === 'no-lyrics') {
    renderStatusMessage(message || '暂无歌词');
  }
  // status === 'ok' 时不需要额外处理，歌词已经通过 lyrics:update 渲染好了
});

// 应用背景颜色 + 透明度 + 歌词颜色
window.lyricsAPI.onSettingsApply(({ transparency, bgColor, lyricColor }) => {
  if (bgColor) {
    const { r, g, b } = hexToRgb(bgColor);
    const alpha = typeof transparency === 'number' ? transparency : 0.55;
    document.documentElement.style.setProperty('--panel-bg', `rgba(${r}, ${g}, ${b}, ${alpha})`);
    document.documentElement.style.setProperty('--panel-alpha', String(alpha));
  }
  if (lyricColor) applyLyricColor(lyricColor);
});

// 歌词文字颜色：当前句用满色，其余用半透明——都从同一个色值派生，保持协调
function applyLyricColor(hex) {
  if (!hex) return;
  const { r, g, b } = hexToRgb(hex);
  document.documentElement.style.setProperty('--text-dim', `rgba(${r}, ${g}, ${b}, 0.4)`);
  document.documentElement.style.setProperty('--text-active', `rgb(${r}, ${g}, ${b})`);
}

function hexToRgb(hex) {
  let h = String(hex).replace('#', '');
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const num = parseInt(h, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

window.addEventListener('resize', centerActiveLine);
