'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const subscribe = channel => callback => ipcRenderer.on(channel, (_event, payload) => callback(payload));

contextBridge.exposeInMainWorld('lyricsAPI', {
  onLyricsUpdate: subscribe('lyrics:update'),
  onProgressTick: subscribe('lyrics:tick'),
  onStatusChange: subscribe('lyrics:status'),
  onSettingsApply: subscribe('settings:apply'),
  onTimingChange: subscribe('lyrics:timing'),
  adjustTiming: deltaMs => ipcRenderer.invoke('lyrics:adjust-timing', deltaMs),
  closeWindow: () => ipcRenderer.send('window:hide'),
  requestResize: size => ipcRenderer.send('window:resize', size),
  openSettings: () => ipcRenderer.send('window:open-settings'),
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: patch => ipcRenderer.invoke('settings:save', patch),
});
