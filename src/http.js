// 带超时控制的 fetch：Electron 内置的 fetch 默认不超时，
// 弱网/被墙时会一直挂起，导致"点了翻译半天没反应"。这里统一加 8 秒超时。

async function fetchWithTimeout(url, options = {}, timeoutMs = 8000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

module.exports = { fetchWithTimeout };
