const lyricsList = document.getElementById('lyricsList');
const lyricsViewport = document.getElementById('lyricsViewport');
const trackInfo = document.getElementById('trackInfo');
const closeBtn = document.getElementById('closeBtn');
const fontSmallerBtn = document.getElementById('fontSmaller');
const fontBiggerBtn = document.getElementById('fontBigger');
const timingEarlierBtn = document.getElementById('timingEarlier');
const timingLaterBtn = document.getElementById('timingLater');
const timingValue = document.getElementById('timingValue');

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
  const dimSize = Math.max(FONT_MIN - 2, Math.round(size * 0.68));
  document.documentElement.style.setProperty('--font-size-active', `${size}px`);
  document.documentElement.style.setProperty(
    '--font-size-dim',
    `${dimSize}px`
  );
  document.documentElement.style.setProperty('--lyric-dim-scale', String(dimSize / size));
  localStorage.setItem('lyrics-font-size', String(size));
  centerActiveLine();
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

function applyTiming(state) {
  if (!state) return;
  timingValue.textContent = `${state.offsetMs > 0 ? '+' : ''}${(state.offsetMs / 1000).toFixed(1)}s`;
  timingValue.title = state.error || 'Lyric delay. Click to reset. Negative: earlier; positive: later.';
  for (const button of [timingEarlierBtn, timingLaterBtn, timingValue]) button.disabled = !state.canAdjust;
}

for (const [button, delta] of [[timingEarlierBtn, -500], [timingLaterBtn, 500], [timingValue, 0]]) {
  button.addEventListener('click', () => window.lyricsAPI.adjustTiming(delta).then(applyTiming).catch(() => {}));
}
window.lyricsAPI.onTimingChange?.(applyTiming);

function renderStatusMessage(message) {
  currentLines = [];
  currentIndex = -1;
  lineElements = [];
  const status = document.createElement('p');
  status.className = 'status-message';
  status.textContent = message;
  lyricsList.replaceChildren(status);
  lyricsList.style.transform = 'translateY(0px)';
}

function renderLyricsLines(lines) {
  currentLines = lines;
  currentIndex = -1;
  lyricsList.innerHTML = '';
  lineElements = [];

  const fragment = document.createDocumentFragment();
  lines.forEach((line) => {
    const p = document.createElement('p');
    p.className = 'lyric-line';
    // Reserve the final text metrics; animate only the inner visual layer.
    // Changing font-size/weight on .active used to reflow and re-wrap the list
    // after centerActiveLine had measured it, causing the upstream jump.
    const text = document.createElement('span');
    text.className = 'lyric-text';
    text.textContent = line.text;
    p.appendChild(text);
    fragment.appendChild(p);
    lineElements.push(p);
  });
  lyricsList.appendChild(fragment);
  centerActiveLine();
}

// 把当前播放行滚动/居中到窗口中间
function centerActiveLine() {
  // Before the first timestamp, show the first line without highlighting it.
  const activeEl = lineElements[Math.max(0, currentIndex)];
  if (!activeEl) return;
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

  let low = 0, high = currentLines.length;
  while (low < high) {
    const mid = (low + high) >>> 1;
    if (currentLines[mid].time <= progressSec) low = mid + 1;
    else high = mid;
  }
  return low - 1;
}

window.lyricsAPI.onLyricsUpdate(({ title, artist, found, lines }) => {
  trackInfo.textContent = `${title} · ${artist}`;

  if (!found || lines.length === 0) {
    renderStatusMessage('暂无歌词');
  } else {
    renderLyricsLines(lines);
  }
});

window.lyricsAPI.onProgressTick(({ progressMs, index, isPlaying }) => {
  document.documentElement.dataset.playing = String(!!isPlaying);
  if (currentLines.length === 0) return;
  const idx = Number.isInteger(index) ? Math.max(-1, Math.min(currentLines.length - 1, index)) : findActiveIndex(progressMs);
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
// Font controls and wrapping on resize must also update the scroll target.
new ResizeObserver(centerActiveLine).observe(lyricsViewport);
document.fonts.ready.then(centerActiveLine);
