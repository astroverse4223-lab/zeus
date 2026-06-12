'use strict';

const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('zeus', {
  // Window controls
  minimize: () => ipcRenderer.send('zeus:win-minimize'),
  maximize: () => ipcRenderer.send('zeus:win-maximize'),
  close:    () => ipcRenderer.send('zeus:win-close'),

  // Settings
  getSettings: ()   => ipcRenderer.invoke('zeus:settings-get'),
  saveSettings: (s) => ipcRenderer.invoke('zeus:settings-set', s),

  // System stats
  getStats: () => ipcRenderer.invoke('zeus:system-stats'),

  // AI messaging
  sendMessage: (params) => ipcRenderer.invoke('zeus:ai-message', params),
  cancelStream: (id)    => ipcRenderer.send('zeus:cancel-stream', id),
  generateTitle: (params) => ipcRenderer.invoke('zeus:generate-title', params),

  // Stream chunk listener — returns an unsubscribe fn
  onChunk: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('zeus:chunk', handler);
    return () => ipcRenderer.removeListener('zeus:chunk', handler);
  },

  // Open OS directory picker dialog
  pickDirectory: () => ipcRenderer.invoke('zeus:pick-directory'),

  // Persistent memory
  getMemory:  ()  => ipcRenderer.invoke('zeus:memory-get'),
  saveMemory: (m) => ipcRenderer.invoke('zeus:memory-save', m),

  // Open a URL in the default system browser
  openExternal: (url) => ipcRenderer.invoke('zeus:open-external', url),

  // Ollama model management
  ollamaStatus:     ()     => ipcRenderer.invoke('zeus:ollama-status'),
  ollamaModels:     ()     => ipcRenderer.invoke('zeus:ollama-models'),
  ollamaDelete:     (name) => ipcRenderer.invoke('zeus:ollama-delete', name),
  ollamaPull:       (name) => ipcRenderer.send('zeus:ollama-pull', name),
  ollamaCancelPull: (name) => ipcRenderer.send('zeus:ollama-pull-cancel', name),
  onOllamaProgress: (cb)   => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('zeus:ollama-progress', handler);
    return () => ipcRenderer.removeListener('zeus:ollama-progress', handler);
  },

  // Embedded terminal
  terminalExec: (cmd) => ipcRenderer.invoke('zeus:terminal-exec', { command: cmd }),
  terminalCwd:  ()    => ipcRenderer.invoke('zeus:terminal-cwd'),
  onTerminalLog: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('zeus:terminal-log', handler);
    return () => ipcRenderer.removeListener('zeus:terminal-log', handler);
  },

  // Agent file-change tracking (diffs + undo)
  onFileChange: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('zeus:file-change', handler);
    return () => ipcRenderer.removeListener('zeus:file-change', handler);
  },
  getFileChangeDiff: (id) => ipcRenderer.invoke('zeus:file-change-diff', id),
  undoFileChange:    (id) => ipcRenderer.invoke('zeus:undo-file-change', id),

  // Screen capture (vision / screen awareness)
  captureScreen: () => ipcRenderer.invoke('zeus:capture-screen'),

  // Floating mini-HUD overlay
  toggleMiniHUD: () => ipcRenderer.invoke('zeus:toggle-mini-hud'),

  // Receive messages typed in the mini-HUD
  onMiniMessage: (cb) => {
    const handler = (_, text) => cb(text);
    ipcRenderer.on('zeus:mini-message', handler);
    return () => ipcRenderer.removeListener('zeus:mini-message', handler);
  },

  // Knowledge base
  kbAdd:       (paths) => ipcRenderer.invoke('zeus:kb-add', paths),
  kbPickFiles: ()      => ipcRenderer.invoke('zeus:kb-pick-files'),
  kbList:      ()      => ipcRenderer.invoke('zeus:kb-list'),
  kbRemove:    (id)    => ipcRenderer.invoke('zeus:kb-remove', id),
  kbStats:     ()      => ipcRenderer.invoke('zeus:kb-stats'),
  onKbProgress: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('zeus:kb-progress', handler);
    return () => ipcRenderer.removeListener('zeus:kb-progress', handler);
  },

  // Auto-update
  appVersion:     ()    => ipcRenderer.invoke('zeus:app-version'),
  updateCheck:    ()    => ipcRenderer.invoke('zeus:update-check'),
  updateDownload: (url) => ipcRenderer.invoke('zeus:update-download', url),
  revealFile:     (p)   => ipcRenderer.invoke('zeus:reveal-file', p),
  onUpdateProgress: (cb) => {
    const handler = (_, data) => cb(data);
    ipcRenderer.on('zeus:update-progress', handler);
    return () => ipcRenderer.removeListener('zeus:update-progress', handler);
  },
});
