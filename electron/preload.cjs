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
  runCustomCommand: (kind, value) => ipcRenderer.invoke('zeus:run-custom-command', { kind, value }),

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

  // Plugins (skill packs)
  pluginList:    ()        => ipcRenderer.invoke('zeus:plugin-list'),
  pluginInstall: (url)     => ipcRenderer.invoke('zeus:plugin-install', url),
  pluginRemove:  (slug)    => ipcRenderer.invoke('zeus:plugin-remove', slug),
  pluginToggle:  (slug, on) => ipcRenderer.invoke('zeus:plugin-toggle', { slug, on }),

  // Code editor: filesystem access
  editorListDir:   (dirPath)         => ipcRenderer.invoke('zeus:editor-list-dir', dirPath),
  editorReadFile:  (filePath)        => ipcRenderer.invoke('zeus:editor-read-file', filePath),
  editorWriteFile: (filePath, content) => ipcRenderer.invoke('zeus:editor-write-file', { path: filePath, content }),
  editorOpenImage: ()                  => ipcRenderer.invoke('zeus:editor-open-image'),
  editorSaveImage: (dataUrl, defaultName) => ipcRenderer.invoke('zeus:editor-save-image', { dataUrl, defaultName }),
  editorCreateFile: (dirPath, name) => ipcRenderer.invoke('zeus:editor-create-file', { dirPath, name }),
  editorCreateDir:  (dirPath, name) => ipcRenderer.invoke('zeus:editor-create-dir', { dirPath, name }),
  editorRename:     (oldPath, newName) => ipcRenderer.invoke('zeus:editor-rename', { oldPath, newName }),
  editorDelete:     (targetPath) => ipcRenderer.invoke('zeus:editor-delete', targetPath),

  // Code editor: new project scaffolding
  projectNew: (parentDir, name, initGit) => ipcRenderer.invoke('zeus:project-new', { parentDir, name, initGit }),

  // Code editor: git integration
  gitStatus:  (dir)               => ipcRenderer.invoke('zeus:git-status', dir),
  gitStage:   (dir, paths)        => ipcRenderer.invoke('zeus:git-stage', { dir, paths }),
  gitUnstage: (dir, paths)        => ipcRenderer.invoke('zeus:git-unstage', { dir, paths }),
  gitDiscard: (dir, paths)        => ipcRenderer.invoke('zeus:git-discard', { dir, paths }),
  gitCommit:  (dir, message)      => ipcRenderer.invoke('zeus:git-commit', { dir, message }),
  gitDiff:    (dir, file, staged) => ipcRenderer.invoke('zeus:git-diff', { dir, file, staged }),

  // Code editor: Live Server
  liveserverStart: (dir) => ipcRenderer.invoke('zeus:liveserver-start', dir),
  liveserverStop:  ()    => ipcRenderer.invoke('zeus:liveserver-stop'),

  // Image generation (ComfyUI)
  imagegenStatus:   ()       => ipcRenderer.invoke('zeus:imagegen-status'),
  imagegenGenerate: (params) => ipcRenderer.invoke('zeus:imagegen-generate', params),
  imagegenGenerateHosted: (params) => ipcRenderer.invoke('zeus:imagegen-generate-hosted', params),
  imagegenGenerateReplicate: (params) => ipcRenderer.invoke('zeus:imagegen-generate-replicate', params),

  // Video generation (ComfyUI / Replicate)
  videogenStatus:   ()       => ipcRenderer.invoke('zeus:videogen-status'),
  videogenGenerate: (params) => ipcRenderer.invoke('zeus:videogen-generate', params),
  videogenGenerateHosted: (params) => ipcRenderer.invoke('zeus:videogen-generate-hosted', params),
  videogenSave: (dataUrl, defaultName) => ipcRenderer.invoke('zeus:videogen-save', { dataUrl, defaultName }),

  // Content Factory: niche → trending topic → script → voice → subtitles → MP4 → TikTok
  cfTrending:    (niche, source) => ipcRenderer.invoke('zeus:contentfactory-trending', { niche, source }),
  cfScript:      (params) => ipcRenderer.invoke('zeus:contentfactory-script', params),
  cfVideoPrompt: (params) => ipcRenderer.invoke('zeus:contentfactory-video-prompt', params),
  cfVoices:      ()       => ipcRenderer.invoke('zeus:contentfactory-voices'),
  cfVoice:       (params) => ipcRenderer.invoke('zeus:contentfactory-voice', params),
  cfSaveVoice:   (dataUrl, defaultName) => ipcRenderer.invoke('zeus:contentfactory-save-voice', { dataUrl, defaultName }),
  cfSubtitles:   (params) => ipcRenderer.invoke('zeus:contentfactory-subtitles', params),
  cfExport:      (params) => ipcRenderer.invoke('zeus:contentfactory-export', params),
  tiktokRedirectUri: ()       => ipcRenderer.invoke('zeus:tiktok-redirect-uri'),
  tiktokConnect:     (params) => ipcRenderer.invoke('zeus:tiktok-connect', params),
  tiktokStatus:      ()       => ipcRenderer.invoke('zeus:tiktok-status'),
  tiktokDisconnect:  ()       => ipcRenderer.invoke('zeus:tiktok-disconnect'),
  tiktokSchedule:    (params) => ipcRenderer.invoke('zeus:tiktok-schedule', params),
  tiktokQueue:       ()       => ipcRenderer.invoke('zeus:tiktok-queue'),
  tiktokCancel:      (id)     => ipcRenderer.invoke('zeus:tiktok-cancel', id),

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

  // Password vault
  vaultExists:      ()        => ipcRenderer.invoke('zeus:vault-exists'),
  vaultIsUnlocked:  ()        => ipcRenderer.invoke('zeus:vault-is-unlocked'),
  vaultSetup:       (pw)      => ipcRenderer.invoke('zeus:vault-setup', pw),
  vaultUnlock:      (pw)      => ipcRenderer.invoke('zeus:vault-unlock', pw),
  vaultLock:        ()        => ipcRenderer.invoke('zeus:vault-lock'),
  vaultList:        ()        => ipcRenderer.invoke('zeus:vault-list'),
  vaultAdd:         (entry)   => ipcRenderer.invoke('zeus:vault-add', entry),
  vaultUpdate:      (id, patch) => ipcRenderer.invoke('zeus:vault-update', { id, patch }),
  vaultRemove:      (id)      => ipcRenderer.invoke('zeus:vault-remove', id),
  vaultReset:       ()        => ipcRenderer.invoke('zeus:vault-reset'),
  vaultGeneratePassword: (opts) => ipcRenderer.invoke('zeus:vault-generate-password', opts),
  vaultPasswordStrength: (pw)   => ipcRenderer.invoke('zeus:vault-password-strength', pw),
});
