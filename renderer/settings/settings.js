const bgColorInput = document.getElementById('bgColor');
const lyricColorInput = document.getElementById('lyricColor');
const transparencyInput = document.getElementById('transparency');
const transparencyVal = document.getElementById('transparencyVal');
const autostartInput = document.getElementById('autostart');
const presets = document.getElementById('presets');
const doneBtn = document.getElementById('doneBtn');

const DEFAULT_TRANSPARENCY = 0.55;
const DEFAULT_BG = '#121214';
const DEFAULT_LYRIC = '#f5f5f0';

let current = {
  transparency: DEFAULT_TRANSPARENCY,
  bgColor: DEFAULT_BG,
  lyricColor: DEFAULT_LYRIC,
  autostart: false,
};

function patchAndSave(patch) {
  current = { ...current, ...patch };
  window.lyricsAPI.saveSettings(patch);
}

window.lyricsAPI.getSettings().then((settings) => {
  if (settings) current = { ...current, ...settings };
  bgColorInput.value = current.bgColor;
  lyricColorInput.value = current.lyricColor || DEFAULT_LYRIC;
  transparencyInput.value = String(Math.round(current.transparency * 100));
  autostartInput.checked = !!current.autostart;
  transparencyVal.textContent = `${Math.round(current.transparency * 100)}%`;
});

bgColorInput.addEventListener('input', () => patchAndSave({ bgColor: bgColorInput.value }));
lyricColorInput.addEventListener('input', () => patchAndSave({ lyricColor: lyricColorInput.value }));
transparencyInput.addEventListener('input', () => {
  const v = Number(transparencyInput.value) / 100;
  transparencyVal.textContent = `${Math.round(v * 100)}%`;
  patchAndSave({ transparency: v });
});
autostartInput.addEventListener('change', () =>
  patchAndSave({ autostart: autostartInput.checked })
);

presets.addEventListener('click', (e) => {
  const btn = e.target.closest('.swatch');
  if (!btn) return;
  patchAndSave({ bgColor: btn.dataset.color });
});

doneBtn.addEventListener('click', () => window.close());
