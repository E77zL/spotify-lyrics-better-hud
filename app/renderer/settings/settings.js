const bgColorInput = document.getElementById('bgColor');
const lyricColorInput = document.getElementById('lyricColor');
const transparencyInput = document.getElementById('transparency');
const transparencyVal = document.getElementById('transparencyVal');
const presets = document.getElementById('presets');
const doneBtn = document.getElementById('doneBtn');

const DEFAULT_TRANSPARENCY = 0.55;
const DEFAULT_BG = '#121214';
const DEFAULT_LYRIC = '#f5f5f0';

let current = {
  transparency: DEFAULT_TRANSPARENCY,
  bgColor: DEFAULT_BG,
  lyricColor: DEFAULT_LYRIC,
};

function patchAndSave(patch) {
  current = { ...current, ...patch };
  renderSettings();
  window.lyricsAPI.saveSettings(patch);
}

function renderSettings() {
  bgColorInput.value = current.bgColor;
  lyricColorInput.value = current.lyricColor || DEFAULT_LYRIC;
  transparencyInput.value = String(Math.round(current.transparency * 100));
  transparencyVal.textContent = `${Math.round(current.transparency * 100)}%`;
  for (const swatch of presets.querySelectorAll('.swatch')) {
    swatch.setAttribute('aria-pressed', String(swatch.dataset.color === current.bgColor));
  }
}

window.lyricsAPI.getSettings().then((settings) => {
  if (settings) current = { ...current, ...settings };
  renderSettings();
});

bgColorInput.addEventListener('input', () => patchAndSave({ bgColor: bgColorInput.value }));
lyricColorInput.addEventListener('input', () => patchAndSave({ lyricColor: lyricColorInput.value }));
transparencyInput.addEventListener('input', () => {
  const v = Number(transparencyInput.value) / 100;
  transparencyVal.textContent = `${Math.round(v * 100)}%`;
  patchAndSave({ transparency: v });
});

presets.addEventListener('click', (e) => {
  const btn = e.target.closest('.swatch');
  if (!btn) return;
  patchAndSave({ bgColor: btn.dataset.color });
});

doneBtn.addEventListener('click', () => window.close());
