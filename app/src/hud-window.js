'use strict';

// Windows can restore a taskbar entry when focusability or visibility changes.
// Keep this policy on both the overlay and its owned settings window.
const toolWindowOptions = { type: 'toolbar', skipTaskbar: true };

function keepOffTaskbar(window) {
  const hide = () => { if (!window.isDestroyed()) window.setSkipTaskbar(true); };
  hide();
  window.on('show', hide);
  window.on('focus', hide);
  window.once('closed', () => {
    window.removeListener('show', hide);
    window.removeListener('focus', hide);
  });
  return window;
}

module.exports = { toolWindowOptions, keepOffTaskbar };
