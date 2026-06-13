'use strict';

const {
  app, BrowserWindow, ipcMain, dialog,
  shell, clipboard, desktopCapturer, Menu,
} = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { exec, spawn } = require('child_process');
const { promisify } = require('util');
const _execBase = promisify(exec);
// Always hide the console window on Windows so no CMD popup appears
const execAsync = (cmd, opts = {}) => _execBase(cmd, { windowsHide: true, ...opts });

// ─── Settings ────────────────────────────────────────────────────────────────

const SETTINGS_FILE = path.join(app.getPath('userData'), 'zeus-settings.json');

// ─── Knowledge Base (local RAG) ───────────────────────────────────────────────
const { createIndex } = require('./knowledge/index.cjs');
let _knowledge = null;
function getKnowledge() {
  if (!_knowledge) {
    _knowledge = createIndex({ baseDir: path.join(app.getPath('userData'), 'knowledge') });
  }
  return _knowledge;
}

// ─── Auto-update ──────────────────────────────────────────────────────────────
const updater = require('./update/index.cjs');

const DEFAULT_SETTINGS = {
  providers: {
    anthropic: { apiKey: '', model: 'claude-opus-4-8',       enabled: true },
    openai:    { apiKey: '', model: 'gpt-4o',                enabled: true },
    gemini:    { apiKey: '', model: 'gemini-1.5-pro',        enabled: true },
    ollama:    { apiKey: '', model: 'llama3.2', baseURL: 'http://localhost:11434/v1', enabled: true },
  },
  activeProvider: 'anthropic',
  voice: { enabled: false, autoSpeak: false, rate: 1.0, pitch: 1.0 },
  requireToolConfirmation: false,
  userName: 'Sir',
  theme: 'zeus',
  memory: { enabled: true },
  integrations: {
    telegram: { enabled: false, botToken: '' },
    github:   { token: '' },
    spotify:  { accessToken: '' },
  },
  chat: {
    systemPromptExtra:  '',
    temperature:        0.7,
    maxTokens:          4096,
    maxContextMessages: 20,
    responseLanguage:   'auto',
    streamingEnabled:   true,
  },
  system: {
    shell:           'powershell',
    alwaysOnTop:     false,
    launchAtStartup: false,
    globalHotkey:    'CommandOrControl+Shift+Space',
    clearChatOnExit: false,
    requestTimeout:  60,
  },
  ui: {
    backgroundPattern: 'grid',
    animationSpeed:    'normal',
    hudCompact:        false,
    fontSize:          'medium',
    messageDensity:    'comfortable',
  },
};

function deepMerge(target, source) {
  const result = { ...target };
  for (const key in source) {
    if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
      result[key] = deepMerge(target[key] || {}, source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

function loadSettings() {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return deepMerge(DEFAULT_SETTINGS, JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8')));
    }
  } catch {}
  return { ...DEFAULT_SETTINGS };
}

function saveSettings(s) {
  try { fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2), 'utf-8'); } catch {}
}

let settings = loadSettings();

// ─── Memory System ────────────────────────────────────────────────────────────

const MEMORY_FILE = path.join(app.getPath('userData'), 'zeus-memory.json');

function loadMemory() {
  try {
    if (fs.existsSync(MEMORY_FILE)) return JSON.parse(fs.readFileSync(MEMORY_FILE, 'utf-8'));
  } catch {}
  return { facts: [], preferences: [], notes: [] };
}

function saveMemoryFile(m) {
  try {
    fs.mkdirSync(path.dirname(MEMORY_FILE), { recursive: true });
    fs.writeFileSync(MEMORY_FILE, JSON.stringify(m, null, 2), 'utf-8');
  } catch (e) {
    console.error('[Zeus Memory] Failed to save:', e.message);
  }
}

let memory = loadMemory();

function formatMemoryForPrompt() {
  if (settings?.memory?.enabled === false) return '';
  const parts = [];
  (memory.facts || []).slice(-15).forEach(f => parts.push(`• ${f.key || 'fact'}: ${f.value}`));
  (memory.preferences || []).slice(-10).forEach(p => parts.push(`• preference — ${p.key}: ${p.value}`));
  (memory.notes || []).slice(-10).forEach(n => parts.push(`• note: ${n.value}`));
  if (!parts.length) return '';
  return `\n\nPersistent Memory (what you remember about this user from past conversations):\n${parts.join('\n')}`;
}

// ─── Window ───────────────────────────────────────────────────────────────────

let mainWindow;
let miniHUDWindow = null;

function createMiniHUD() {
  if (miniHUDWindow && !miniHUDWindow.isDestroyed()) {
    miniHUDWindow.show();
    miniHUDWindow.focus();
    return;
  }
  miniHUDWindow = new BrowserWindow({
    width: 392, height: 64,
    frame: false, transparent: true, alwaysOnTop: true,
    resizable: false, skipTaskbar: true, hasShadow: false,
    webPreferences: {
      preload: path.join(__dirname, 'mini-preload.cjs'),
      contextIsolation: true, nodeIntegration: false,
    },
  });
  miniHUDWindow.loadFile(path.join(__dirname, 'mini-hud.html'));
  miniHUDWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
  miniHUDWindow.on('closed', () => { miniHUDWindow = null; });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    frame: false,
    backgroundColor: '#080c14',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  if (!app.isPackaged) {
    mainWindow.loadURL('http://localhost:5173');
  } else {
    mainWindow.loadFile(path.join(__dirname, '../dist/index.html'));
  }

  mainWindow.once('ready-to-show', () => mainWindow.show());
  Menu.setApplicationMenu(null);

  // One-time update check a few seconds after launch (non-intrusive).
  setTimeout(async () => {
    try {
      const r = await updater.checkForUpdate({ currentVersion: app.getVersion() });
      const { Notification } = require('electron');
      if (r && r.newer && Notification.isSupported()) {
        new Notification({
          title: '⚡ Zeus update available',
          body: `Version ${r.latest} is available. Open Settings → Updates to download.`,
        }).show();
      }
    } catch { /* ignore — never bother the user on a flaky network */ }
  }, 5000);
}

app.whenReady().then(() => {
  createWindow();

  // Apply persisted system settings
  if (settings.system?.alwaysOnTop) mainWindow?.setAlwaysOnTop(true);

  // Global hotkey to show/focus Zeus
  const hotkey = settings.system?.globalHotkey;
  if (hotkey) {
    try {
      const { globalShortcut } = require('electron');
      globalShortcut.register(hotkey, () => {
        if (!mainWindow) return;
        if (mainWindow.isMinimized()) mainWindow.restore();
        mainWindow.show();
        mainWindow.focus();
      });
    } catch {}
  }

  const tg = settings.integrations?.telegram;
  if (tg?.enabled && tg?.botToken) startTelegramBot(tg.botToken);
});
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });

// ─── Window IPC ──────────────────────────────────────────────────────────────

ipcMain.on('zeus:win-minimize', () => mainWindow?.minimize());
ipcMain.on('zeus:win-maximize', () => {
  if (mainWindow?.isMaximized()) mainWindow.unmaximize();
  else mainWindow?.maximize();
});
ipcMain.on('zeus:win-close', () => mainWindow?.close());

// ─── Settings IPC ────────────────────────────────────────────────────────────

ipcMain.handle('zeus:settings-get', () => settings);
ipcMain.handle('zeus:settings-set', (_, updates) => {
  const prev = settings;
  settings = deepMerge(settings, updates);
  saveSettings(settings);

  // Telegram bot
  const tg = settings.integrations?.telegram;
  if (tg?.botToken !== prev.integrations?.telegram?.botToken || tg?.enabled !== prev.integrations?.telegram?.enabled) {
    startTelegramBot(tg?.enabled && tg?.botToken ? tg.botToken : null);
  }

  // Always on top
  if (settings.system?.alwaysOnTop !== prev.system?.alwaysOnTop) {
    mainWindow?.setAlwaysOnTop(!!settings.system?.alwaysOnTop);
  }

  // Launch at startup
  if (settings.system?.launchAtStartup !== prev.system?.launchAtStartup) {
    app.setLoginItemSettings({ openAtLogin: !!settings.system?.launchAtStartup });
  }

  return settings;
});

// ─── Open External URL ────────────────────────────────────────────────────────

ipcMain.handle('zeus:open-external', (_, url) => shell.openExternal(url));

// ─── Screen Capture ───────────────────────────────────────────────────────────

ipcMain.handle('zeus:capture-screen', async () => {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: { width: 1280, height: 720 },
    });
    if (!sources.length) return null;
    return sources[0].thumbnail.toDataURL();
  } catch { return null; }
});

// ─── Mini-HUD ─────────────────────────────────────────────────────────────────

ipcMain.handle('zeus:toggle-mini-hud', () => {
  if (!miniHUDWindow || miniHUDWindow.isDestroyed()) {
    createMiniHUD();
  } else {
    miniHUDWindow.close();
  }
});

ipcMain.on('mini:focus-main', () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

ipcMain.on('mini:hide', () => {
  miniHUDWindow?.hide();
});

ipcMain.on('mini:send', (_, text) => {
  // Forward message from mini-HUD as if typed in main window
  mainWindow?.webContents?.send('zeus:mini-message', text);
});

// ─── Directory Picker ─────────────────────────────────────────────────────────

ipcMain.handle('zeus:pick-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory'],
    title: 'ZEUS — Select Project Directory',
  });
  return result.canceled ? null : result.filePaths[0];
});

// ─── Knowledge Base IPC ───────────────────────────────────────────────────────

ipcMain.handle('zeus:kb-pick-files', async () => {
  const r = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile', 'multiSelections'],
    title: 'ZEUS — Add files to Knowledge Base',
  });
  return r.canceled ? [] : r.filePaths;
});

ipcMain.handle('zeus:kb-add', async (e, paths) => {
  if (!Array.isArray(paths) || !paths.length) return { added: [], skipped: [] };
  const wc = e.sender;
  try {
    return await getKnowledge().ingest(paths, (p) => {
      if (!wc.isDestroyed()) wc.send('zeus:kb-progress', p);
    });
  } catch (err) {
    return { error: err.code || err.message, added: [], skipped: [] };
  }
});

ipcMain.handle('zeus:kb-list', () => getKnowledge().listSources());
ipcMain.handle('zeus:kb-remove', (_, id) => {
  getKnowledge().removeSource(id);
  return getKnowledge().listSources();
});
ipcMain.handle('zeus:kb-stats', () => getKnowledge().stats());

// ─── Auto-Update IPC ──────────────────────────────────────────────────────────
ipcMain.handle('zeus:app-version', () => app.getVersion());

ipcMain.handle('zeus:update-check', () => updater.checkForUpdate({ currentVersion: app.getVersion() }));

ipcMain.handle('zeus:update-download', async (e, url) => {
  if (!url) return { error: 'No download URL.' };
  const wc = e.sender;
  try {
    const file = await updater.downloadUpdate(url, app.getPath('downloads'), (p) => {
      if (!wc.isDestroyed()) wc.send('zeus:update-progress', p);
    });
    return { file };
  } catch (err) {
    return { error: 'Download failed — try again.' };
  }
});

ipcMain.handle('zeus:reveal-file', (_, filePath) => {
  if (filePath) shell.showItemInFolder(filePath);
  return true;
});

// ─── Memory IPC ───────────────────────────────────────────────────────────────

ipcMain.handle('zeus:memory-get', () => memory);
ipcMain.handle('zeus:memory-save', (_, m) => {
  memory = m;
  saveMemoryFile(memory);
  return memory;
});

// ─── Ollama Model Manager ─────────────────────────────────────────────────────

function ollamaRequest(method, path, body) {
  return new Promise((resolve, reject) => {
    const http = require('http');
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request({
      hostname: 'localhost', port: 11434, path, method,
      headers: payload ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) } : {},
    }, (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => { try { resolve(JSON.parse(data)); } catch { resolve({ raw: data }); } });
    });
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

// Find ollama binary — packaged Electron may not inherit the user's PATH on Windows
function getOllamaExe() {
  if (process.platform !== 'win32') return 'ollama';
  const candidates = [
    path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Ollama', 'ollama.exe'),
    path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'Programs', 'Ollama', 'ollama.exe'),
    'C:\\Program Files\\Ollama\\ollama.exe',
  ];
  for (const c of candidates) {
    try { if (fs.existsSync(c)) return c; } catch {}
  }
  return 'ollama'; // last-resort PATH fallback
}

ipcMain.handle('zeus:ollama-status', async () => {
  const ollamaExe = getOllamaExe();
  const isInstalled = await new Promise(resolve => {
    exec(`"${ollamaExe}" --version`, { windowsHide: true }, err => resolve(!err));
  });
  try {
    const res = await ollamaRequest('GET', '/api/version');
    return { running: true, installed: true, version: res.version || 'unknown' };
  } catch {
    return { running: false, installed: isInstalled, version: null };
  }
});

ipcMain.handle('zeus:ollama-models', async () => {
  try {
    const res = await ollamaRequest('GET', '/api/tags');
    return { models: res.models || [] };
  } catch {
    return { models: [], error: 'Ollama not running' };
  }
});

ipcMain.handle('zeus:ollama-delete', async (_, name) => {
  try {
    await ollamaRequest('DELETE', '/api/delete', { name });
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

const activePulls = new Map();

ipcMain.on('zeus:ollama-pull', (event, name) => {
  const sender = event.sender;

  function emit(payload) {
    if (!sender.isDestroyed()) sender.send('zeus:ollama-progress', { name, ...payload });
  }

  emit({ status: 'connecting' });

  const ollamaExe = getOllamaExe();
  const child = spawn(ollamaExe, ['pull', name], {
    shell: false,         // no CMD window
    windowsHide: true,    // suppress any console popup on Windows
  });
  activePulls.set(name, child);

  let buf = '';
  function parseBuf(data) {
    // ollama CLI uses \r to overwrite lines; split on both \n and \r
    buf += data.toString();
    const parts = buf.split(/[\r\n]/);
    buf = parts.pop(); // keep incomplete line
    for (const line of parts) {
      const trimmed = line.trim();
      if (!trimmed) continue;
      // Extract percentage if present: "pulling abc123... 42% ▕...▏ 1.6 GB/3.8 GB"
      const pctMatch = trimmed.match(/(\d+)%/);
      if (pctMatch) {
        emit({ status: 'downloading', completed: parseInt(pctMatch[1], 10), total: 100 });
      } else {
        emit({ status: trimmed.toLowerCase().slice(0, 40), completed: 0, total: 0 });
      }
    }
  }

  child.stdout.on('data', parseBuf);
  child.stderr.on('data', parseBuf);

  child.on('close', code => {
    activePulls.delete(name);
    if (code === 0) {
      emit({ status: 'done' });
    } else {
      emit({ status: 'error', error: `ollama pull exited with code ${code}` });
    }
  });

  child.on('error', err => {
    activePulls.delete(name);
    emit({ status: 'error', error: err.message });
  });
});

ipcMain.on('zeus:ollama-pull-cancel', (_, name) => {
  const child = activePulls.get(name);
  if (child) { child.kill(); activePulls.delete(name); }
});

// ─── System Stats ─────────────────────────────────────────────────────────────

let si;
try { si = require('systeminformation'); } catch {
  si = {
    currentLoad: async () => ({ currentLoad: 0 }),
    mem: async () => ({ total: 8 * 1024 ** 3, active: 4 * 1024 ** 3, available: 4 * 1024 ** 3 }),
    battery: async () => ({ hasBattery: false }),
    cpu: async () => ({ brand: 'Unknown', cores: 4 }),
    fsSize: async () => [],
    osInfo: async () => ({ platform: process.platform, distro: 'Unknown', release: '0', arch: process.arch, hostname: os.hostname() }),
    time: async () => ({ uptime: os.uptime() }),
    processes: async () => ({ all: 0, list: [] }),
  };
}

ipcMain.handle('zeus:system-stats', async () => {
  try {
    const [load, mem, battery] = await Promise.all([
      si.currentLoad(),
      si.mem(),
      si.battery(),
    ]);
    return {
      cpu: Math.round(load.currentLoad),
      ram: Math.round((mem.active / mem.total) * 100),
      ramUsed: (mem.active / 1024 ** 3).toFixed(1),
      ramTotal: (mem.total / 1024 ** 3).toFixed(0),
      battery: battery.hasBattery
        ? { level: battery.percent, charging: battery.isCharging }
        : null,
    };
  } catch {
    return { cpu: 0, ram: 0, ramUsed: '0', ramTotal: '0', battery: null };
  }
});

// ─── Embedded Terminal ────────────────────────────────────────────────────────

let terminalCwd = os.homedir();

ipcMain.handle('zeus:terminal-cwd', () => terminalCwd);

ipcMain.handle('zeus:terminal-exec', async (_, { command }) => {
  if (!command.trim()) return { stdout: '', stderr: '', exitCode: 0, cwd: terminalCwd };

  const shell = settings?.system?.shell || 'powershell';

  // Append a CWD probe so any cd/Set-Location command gets tracked
  let probeCommand;
  if (shell === 'powershell') {
    probeCommand = `${command}; Write-Output "##CWD##$((Get-Location).Path)##"`;
  } else if (shell === 'cmd') {
    probeCommand = `${command} & echo ##CWD##%CD%##`;
  } else {
    probeCommand = `${command}; echo "##CWD##$(pwd)##"`;
  }

  return new Promise(resolve => {
    let proc;
    const spawnOpts = { cwd: terminalCwd, windowsHide: true };
    if (shell === 'powershell') {
      proc = spawn('powershell', ['-NoProfile', '-NonInteractive', '-Command', probeCommand], spawnOpts);
    } else if (shell === 'cmd') {
      proc = spawn('cmd', ['/c', probeCommand], spawnOpts);
    } else if (shell === 'wsl') {
      proc = spawn('wsl', ['-e', 'bash', '-c', probeCommand], spawnOpts);
    } else {
      proc = spawn('bash', ['-c', probeCommand], spawnOpts);
    }

    let stdout = '', stderr = '';
    proc.stdout?.on('data', d => { stdout += d.toString(); });
    proc.stderr?.on('data', d => { stderr += d.toString(); });

    const timer = setTimeout(() => {
      try { proc.kill(); } catch {}
      resolve({ stdout, stderr: (stderr || '') + '\n[timed out after 30s]', exitCode: 124, cwd: terminalCwd });
    }, 30000);

    proc.on('close', code => {
      clearTimeout(timer);
      // Extract new cwd from probe output
      const cwdMatch = stdout.match(/##CWD##(.+?)##/);
      if (cwdMatch) {
        const newCwd = cwdMatch[1].trim();
        if (newCwd) terminalCwd = newCwd;
        stdout = stdout.replace(/##CWD##.+?##\r?\n?/, '').trimEnd();
      }
      resolve({ stdout, stderr, exitCode: code ?? 0, cwd: terminalCwd });
    });

    proc.on('error', err => {
      clearTimeout(timer);
      resolve({ stdout: '', stderr: err.message, exitCode: 1, cwd: terminalCwd });
    });
  });
});

// ─── Tool Definitions ─────────────────────────────────────────────────────────

// ─── Helpers for web-reader / download tools ──────────────────────────────────
function fetchPageHtml(url) {
  return new Promise((resolve, reject) => {
    const go = (u, redirects) => {
      let parsed;
      try { parsed = new URL(u); } catch { return reject(new Error('Invalid URL')); }
      const lib = parsed.protocol === 'http:' ? require('http') : require('https');
      const req = lib.get({
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'http:' ? 80 : 443),
        path: parsed.pathname + parsed.search,
        headers: { 'User-Agent': 'Mozilla/5.0 (ZeusAI)', Accept: 'text/html,*/*' },
      }, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 5) {
          res.resume();
          return go(new URL(res.headers.location, u).href, redirects + 1);
        }
        if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (c) => { data += c; if (data.length > 3000000) req.destroy(); });
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.setTimeout(15000, () => req.destroy(new Error('Request timed out')));
    };
    go(url, 0);
  });
}

function htmlToText(html) {
  return String(html)
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ')
    .replace(/<\/(p|div|h[1-6]|li|br|tr)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function downloadToFolder(url, dir, filename) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(dir, { recursive: true });
    const go = (u, redirects) => {
      const parsed = new URL(u);
      const lib = parsed.protocol === 'http:' ? require('http') : require('https');
      const req = lib.get({
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'http:' ? 80 : 443),
        path: parsed.pathname + parsed.search,
        headers: { 'User-Agent': 'ZeusAI' },
      }, (res) => {
        if ([301, 302, 303, 307, 308].includes(res.statusCode) && res.headers.location && redirects < 5) {
          res.resume();
          return go(new URL(res.headers.location, u).href, redirects + 1);
        }
        if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
        const raw = filename || decodeURIComponent(parsed.pathname.split('/').pop() || '') || 'download';
        const name = raw.replace(/[<>:"/\\|?*]/g, '_');
        const dest = path.join(dir, name);
        const out = fs.createWriteStream(dest);
        res.pipe(out);
        out.on('finish', () => out.close(() => resolve(dest)));
        out.on('error', (e) => { fs.unlink(dest, () => {}); reject(e); });
      });
      req.on('error', reject);
    };
    go(url, 0);
  });
}

const TOOLS = [
  {
    name: 'get_system_info',
    description: 'Get detailed system information: CPU brand/usage, RAM, disk, OS version, uptime, battery',
    schema: { type: 'object', properties: {} },
    dangerous: false,
  },
  {
    name: 'open_application',
    description: 'Open an application on the computer by name (e.g. notepad, chrome, spotify, calculator)',
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Application name or executable' },
      },
      required: ['name'],
    },
    dangerous: false,
  },
  {
    name: 'open_url',
    description: 'Open a URL in the default browser, or perform a web search if a query is given',
    schema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'URL to open or search query' },
      },
      required: ['url'],
    },
    dangerous: false,
  },
  {
    name: 'take_screenshot',
    description: 'Capture a screenshot of the current screen and return its data for viewing',
    schema: { type: 'object', properties: {} },
    dangerous: false,
  },
  {
    name: 'list_directory',
    description: 'List files and folders in a directory',
    schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path (defaults to home directory)' },
      },
    },
    dangerous: false,
  },
  {
    name: 'read_file',
    description: 'Read the text content of a file (max 1 MB)',
    schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute path to the file' },
      },
      required: ['path'],
    },
    dangerous: false,
  },
  {
    name: 'write_file',
    description: 'Create or overwrite a file with the given content',
    schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Absolute file path to write' },
        content: { type: 'string', description: 'Text content to write' },
      },
      required: ['path', 'content'],
    },
    dangerous: true,
  },
  {
    name: 'run_command',
    description: 'Execute a PowerShell or CMD command on the computer',
    schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'Command to run' },
        shell: { type: 'string', enum: ['powershell', 'cmd'], description: 'Shell (default: powershell)' },
      },
      required: ['command'],
    },
    dangerous: true,
  },
  {
    name: 'get_clipboard',
    description: 'Read the current clipboard text content',
    schema: { type: 'object', properties: {} },
    dangerous: false,
  },
  {
    name: 'set_clipboard',
    description: 'Copy text to the clipboard',
    schema: {
      type: 'object',
      properties: {
        text: { type: 'string', description: 'Text to copy' },
      },
      required: ['text'],
    },
    dangerous: false,
  },
  {
    name: 'get_running_processes',
    description: 'Get the top running processes sorted by CPU usage',
    schema: { type: 'object', properties: {} },
    dangerous: false,
  },
  {
    name: 'create_directory',
    description: 'Create a new directory (and any parent directories)',
    schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Directory path to create' },
      },
      required: ['path'],
    },
    dangerous: false,
  },
  {
    name: 'delete_path',
    description: 'Delete a file or empty directory',
    schema: {
      type: 'object',
      properties: {
        path: { type: 'string', description: 'Path to delete' },
      },
      required: ['path'],
    },
    dangerous: true,
  },
  {
    name: 'get_environment_variables',
    description: 'Get system and user environment variables',
    schema: { type: 'object', properties: {} },
    dangerous: false,
  },
  {
    name: 'move_file',
    description: 'Move or rename a file or directory',
    schema: {
      type: 'object',
      properties: {
        source: { type: 'string', description: 'Source path' },
        destination: { type: 'string', description: 'Destination path' },
      },
      required: ['source', 'destination'],
    },
    dangerous: true,
  },
  // ── Coding Agent Tools ────────────────────────────────────────────────────
  {
    name: 'get_directory_tree',
    description: 'Get a visual file tree of a project directory. Essential first step before any coding task — call this to understand the project structure.',
    schema: {
      type: 'object',
      properties: {
        path:   { type: 'string', description: 'Root directory path to map' },
        depth:  { type: 'number', description: 'Max depth to traverse (default: 4, max: 8)' },
        ignore: { type: 'string', description: 'Comma-separated folder/file names to ignore (default: node_modules,.git,dist,build)' },
      },
      required: ['path'],
    },
    dangerous: false,
  },
  {
    name: 'find_files',
    description: 'Find files by name pattern within a directory tree. Supports * wildcard. E.g. "*.js", "*.tsx", "config*", "index.*"',
    schema: {
      type: 'object',
      properties: {
        pattern:   { type: 'string', description: 'Filename pattern with * wildcard. E.g. "*.ts", "*.config.js"' },
        directory: { type: 'string', description: 'Root directory to search in recursively' },
      },
      required: ['pattern', 'directory'],
    },
    dangerous: false,
  },
  {
    name: 'search_in_files',
    description: 'Search for a text string across all files in a directory (like grep). Returns file paths and matching lines. Great for finding where something is defined or used.',
    schema: {
      type: 'object',
      properties: {
        query:          { type: 'string', description: 'Text to search for (case-insensitive)' },
        directory:      { type: 'string', description: 'Directory to search in recursively' },
        file_extension: { type: 'string', description: 'Only search files with this extension, e.g. ".js", ".py", ".ts" (optional — omit to search all text files)' },
      },
      required: ['query', 'directory'],
    },
    dangerous: false,
  },
  {
    name: 'patch_file',
    description: 'Make a surgical text replacement in a file without rewriting it. The original text must exist exactly once in the file. Prefer this over write_file when making small edits to existing code.',
    schema: {
      type: 'object',
      properties: {
        path:        { type: 'string', description: 'Absolute path to the file to edit' },
        original:    { type: 'string', description: 'Exact text to find and replace. Must match verbatim (whitespace, indentation). Must appear exactly once in the file.' },
        replacement: { type: 'string', description: 'New text to replace it with' },
      },
      required: ['path', 'original', 'replacement'],
    },
    dangerous: false,
  },
  // ── Memory Tools ─────────────────────────────────────────────────────────────
  {
    name: 'memory_store',
    description: 'Permanently remember a fact, preference, or note about the user. Persists across all conversations forever.',
    schema: {
      type: 'object',
      properties: {
        category: { type: 'string', enum: ['fact', 'preference', 'note'], description: 'fact = user attribute (name, job, location); preference = what they like/dislike; note = free-form observation' },
        key:      { type: 'string', description: 'Label for fact/preference e.g. "name", "job", "favorite_language"' },
        value:    { type: 'string', description: 'The value to remember' },
      },
      required: ['category', 'value'],
    },
    dangerous: false,
  },
  {
    name: 'memory_recall',
    description: 'Search persistent memories about the user by keyword',
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term to find in stored memories' },
      },
      required: ['query'],
    },
    dangerous: false,
  },
  {
    name: 'memory_list',
    description: 'List all stored memories about the user',
    schema: { type: 'object', properties: {} },
    dangerous: false,
  },
  {
    name: 'memory_delete',
    description: 'Delete a specific memory entry by its ID',
    schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'ID of the memory entry to delete' },
      },
      required: ['id'],
    },
    dangerous: false,
  },
  {
    name: 'knowledge_search',
    description: "Search the user's indexed personal documents / knowledge base for relevant passages. Use whenever the user asks about their own files, notes, manuals, PDFs, or documents they have added to Zeus.",
    schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: "What to look for in the user's documents" },
        k: { type: 'number', description: 'How many passages to return (default 5)' },
      },
      required: ['query'],
    },
    dangerous: false,
  },
  // ── Power Tools: web reader, PC power, media, process ─────────────────────────
  {
    name: 'read_webpage',
    description: 'Fetch a web page and return its readable text content (article body, stripped of HTML/scripts/navigation). Use to actually read an article, doc, or any URL — not just search for it.',
    schema: { type: 'object', properties: { url: { type: 'string', description: 'Full URL to read, e.g. https://example.com/article' } }, required: ['url'] },
    dangerous: false,
  },
  {
    name: 'download_file',
    description: "Download a file from a URL and save it to the user's Downloads folder. Returns the saved path.",
    schema: { type: 'object', properties: { url: { type: 'string', description: 'Direct file URL' }, filename: { type: 'string', description: 'Optional filename; defaults to the name in the URL' } }, required: ['url'] },
    dangerous: false,
  },
  {
    name: 'system_power',
    description: 'Control the PC power state. Destructive actions (restart, shutdown, signout) prompt the user to confirm first.',
    schema: { type: 'object', properties: { action: { type: 'string', enum: ['lock', 'sleep', 'restart', 'shutdown', 'signout'], description: 'lock the screen, sleep, restart, shutdown, or sign out' } }, required: ['action'] },
    dangerous: false,
  },
  {
    name: 'set_volume',
    description: 'Set the system master volume to a level (0-100), or toggle mute.',
    schema: { type: 'object', properties: { level: { type: 'number', description: 'Target volume 0-100' }, mute: { type: 'boolean', description: 'Pass true or false to toggle mute on/off' } } },
    dangerous: false,
  },
  {
    name: 'media_control',
    description: 'Control media playback in any player (Spotify, YouTube, etc.): play/pause, next track, previous track, or stop.',
    schema: { type: 'object', properties: { action: { type: 'string', enum: ['playpause', 'next', 'previous', 'stop'] } }, required: ['action'] },
    dangerous: false,
  },
  {
    name: 'kill_process',
    description: 'Forcefully terminate a running process by name or PID.',
    schema: { type: 'object', properties: { name: { type: 'string', description: 'Process/executable name, e.g. notepad.exe' }, pid: { type: 'number', description: 'Process ID (use instead of name)' } } },
    dangerous: true,
  },
  {
    name: 'open_path',
    description: 'Open a file, folder, or application in its default handler — like double-clicking it. Folders open in Explorer.',
    schema: { type: 'object', properties: { path: { type: 'string', description: 'Absolute path to a file or folder' } }, required: ['path'] },
    dangerous: false,
  },
  // ── Integration / Web Tools ───────────────────────────────────────────────────
  {
    name: 'web_search',
    description: 'Search the web for current information, news, facts, prices, or anything else. No API key required.',
    schema: {
      type: 'object',
      properties: {
        query:       { type: 'string', description: 'Search query' },
        num_results: { type: 'number', description: 'Max results to return (default 5)' },
      },
      required: ['query'],
    },
    dangerous: false,
  },
  {
    name: 'get_weather',
    description: 'Get current weather conditions and 3-day forecast for any city. No API key required.',
    schema: {
      type: 'object',
      properties: {
        location: { type: 'string', description: 'City name e.g. "London", "New York", "Tokyo"' },
      },
      required: ['location'],
    },
    dangerous: false,
  },
  {
    name: 'http_request',
    description: 'Make an HTTP/HTTPS request to any API endpoint. Use this to access GitHub, Spotify, Gmail, Home Assistant, or any other web service.',
    schema: {
      type: 'object',
      properties: {
        url:     { type: 'string', description: 'Full URL including query params' },
        method:  { type: 'string', description: 'HTTP method: GET, POST, PUT, DELETE, PATCH (default: GET)' },
        headers: { type: 'object', description: 'Request headers as a JSON object' },
        body:    { type: 'string', description: 'Request body as JSON string (for POST/PUT)' },
      },
      required: ['url'],
    },
    dangerous: false,
  },
  {
    name: 'send_notification',
    description: 'Show a desktop notification to the user immediately',
    schema: {
      type: 'object',
      properties: {
        title: { type: 'string', description: 'Notification title' },
        body:  { type: 'string', description: 'Notification body text' },
      },
      required: ['title', 'body'],
    },
    dangerous: false,
  },
  {
    name: 'set_reminder',
    description: 'Set a reminder that fires a desktop notification after a specified number of minutes',
    schema: {
      type: 'object',
      properties: {
        message: { type: 'string', description: 'Reminder message to show' },
        minutes: { type: 'number', description: 'Minutes until the reminder fires' },
      },
      required: ['message', 'minutes'],
    },
    dangerous: false,
  },
  {
    name: 'get_datetime',
    description: 'Get the current date, time, and timezone',
    schema: { type: 'object', properties: {} },
    dangerous: false,
  },
  {
    name: 'task_complete',
    description: 'Call this ONLY when you have fully finished the assigned coding task — all files have been created with write_file, dependencies installed, and the project is ready. This ends the agent session.',
    schema: {
      type: 'object',
      properties: {
        summary: {
          type: 'string',
          description: 'What was built: list every file created/modified and what each does',
        },
      },
      required: ['summary'],
    },
    dangerous: false,
  },
];

const TOOL_MAP = Object.fromEntries(TOOLS.map(t => [t.name, t]));

// In agent mode, only expose coding-relevant tools so the model can't waste turns
// calling memory_recall or get_system_info to satisfy tool_choice.
const AGENT_TOOL_NAMES = new Set([
  'write_file', 'read_file', 'run_command', 'get_directory_tree',
  'patch_file', 'find_files', 'search_in_files', 'create_directory', 'task_complete',
]);
const AGENT_TOOLS = TOOLS.filter(t => AGENT_TOOL_NAMES.has(t.name));

function buildToolSummary(name, input, result) {
  switch (name) {
    case 'write_file':        return `[write] ${input.path} (${result.bytesWritten ?? '?'} bytes)`;
    case 'patch_file':        return `[patch] ${input.path}`;
    case 'read_file':         return `[read]  ${input.path} (${result.sizeKB ?? '?'} KB)`;
    case 'list_directory':    return `[ls]    ${input.path || '~'} (${result.totalItems ?? '?'} items)`;
    case 'create_directory':  return `[mkdir] ${input.path}`;
    case 'delete_path':       return `[del]   ${input.path}`;
    case 'move_file':         return `[move]  ${input.source} → ${input.destination}`;
    case 'find_files':        return `[find]  ${input.pattern} in ${input.directory} (${result.count ?? '?'} found)`;
    case 'search_in_files':   return `[grep]  "${input.query}" in ${input.directory} (${result.resultsCount ?? '?'} matches)`;
    case 'get_directory_tree':return `[tree]  ${input.path}`;
    case 'web_search':        return `[web]   ${input.query}`;
    case 'http_request':      return `[http]  ${(input.method || 'GET').toUpperCase()} ${input.url}`;
    case 'take_screenshot':   return `[shot]  ${result.path || 'captured'}`;
    case 'open_application':  return `[open]  ${input.name}`;
    case 'open_url':          return `[url]   ${input.url}`;
    case 'memory_store':      return `[mem+]  [${input.category || 'note'}] ${String(input.value || '').slice(0, 60)}`;
    case 'memory_recall':     return `[mem?]  "${input.query}" (${result.count ?? '?'} results)`;
    case 'memory_list':       return `[mem]   listing memory`;
    case 'knowledge_search':  return `[kb?]   "${input.query}" (${result.count ?? 0} hits)`;
    case 'memory_delete':     return `[mem-]  id:${input.id}`;
    case 'send_notification': return `[notify] ${input.title}: ${input.body}`;
    case 'set_reminder':      return `[remind] ${input.message} in ${input.minutes}m`;
    case 'get_system_info':   return `[sysinfo] fetched`;
    case 'get_weather':       return `[weather] ${input.location}`;
    case 'get_clipboard':     return `[clip]  read clipboard`;
    case 'set_clipboard':     return `[clip]  wrote clipboard`;
    case 'get_running_processes': return `[ps]  listed processes`;
    case 'get_environment_variables': return `[env] fetched env vars`;
    case 'get_datetime':      return `[time]  ${(result.date || '')} ${(result.time || '')}`.trim();
    default:                  return `[${name}]`;
  }
}

function emitToolLog(name, input, result) {
  if (!mainWindow?.webContents) return;
  const lines = [];
  if (name === 'run_command') {
    lines.push({ type: 'zeus-cmd', text: input.command });
    if (result.stdout) result.stdout.split('\n').forEach(l => lines.push({ type: 'stdout', text: l }));
    if (result.stderr) result.stderr.split('\n').filter(Boolean).forEach(l => lines.push({ type: 'stderr', text: l }));
    if (result.error)  lines.push({ type: 'stderr', text: result.error });
  } else {
    lines.push({ type: 'zeus-tool', tool: name, text: buildToolSummary(name, input, result) });
    if (result?.error) lines.push({ type: 'stderr', text: `  → ${result.error}` });
  }
  if (lines.length) mainWindow.webContents.send('zeus:terminal-log', { lines });
}

// ─── Agent File-Change Tracking ───────────────────────────────────────────────
// Records every file mutation an agent makes so the UI can show diffs and offer undo.
const agentFileChanges = [];
let fileChangeSeq = 0;

function recordFileChange(change) {
  const entry = { id: `fc-${Date.now()}-${++fileChangeSeq}`, ts: Date.now(), undone: false, ...change };
  agentFileChanges.push(entry);
  if (agentFileChanges.length > 300) agentFileChanges.shift();
  // Send only lightweight metadata to the renderer; full before/after stays in main
  // and is fetched on demand when the user expands a diff.
  if (mainWindow?.webContents && !mainWindow.webContents.isDestroyed()) {
    mainWindow.webContents.send('zeus:file-change', {
      id: entry.id, kind: entry.kind, path: entry.path, from: entry.from, to: entry.to, ts: entry.ts,
      beforeBytes: entry.before != null ? Buffer.byteLength(entry.before) : 0,
      afterBytes:  entry.after  != null ? Buffer.byteLength(entry.after)  : 0,
    });
  }
  return entry;
}

ipcMain.handle('zeus:file-change-diff', (_, id) => {
  const c = agentFileChanges.find(x => x.id === id);
  if (!c) return null;
  return { kind: c.kind, path: c.path, from: c.from, to: c.to, before: c.before ?? null, after: c.after ?? null, undone: c.undone };
});

ipcMain.handle('zeus:undo-file-change', (_, id) => {
  const c = agentFileChanges.find(x => x.id === id);
  if (!c) return { ok: false, error: 'Change not found' };
  if (c.undone) return { ok: false, error: 'Already undone' };
  try {
    switch (c.kind) {
      case 'create': if (fs.existsSync(c.path)) fs.unlinkSync(c.path); break;
      case 'modify': fs.writeFileSync(c.path, c.before ?? '', 'utf-8'); break;
      case 'delete': fs.mkdirSync(path.dirname(c.path), { recursive: true }); fs.writeFileSync(c.path, c.before ?? '', 'utf-8'); break;
      case 'mkdir':  try { fs.rmdirSync(c.path); } catch {} break;
      case 'rmdir':  fs.mkdirSync(c.path, { recursive: true }); break;
      case 'move':   fs.renameSync(c.to, c.from); break;
      default: return { ok: false, error: `Cannot undo: ${c.kind}` };
    }
    c.undone = true;
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
});

async function executeTool(name, input, requireConfirm) {
  if (input?.__parse_error) {
    return { error: 'Tool call was truncated — the response was cut off before the arguments were complete. Please retry this tool call with the full arguments.' };
  }
  const toolDef = TOOL_MAP[name];

  if (toolDef?.dangerous && settings.requireToolConfirmation) {
    const choice = dialog.showMessageBoxSync(mainWindow, {
      type: 'question',
      title: '⚡ ZEUS — Confirmation Required',
      message: `Allow ZEUS to execute: ${name}`,
      detail: `Parameters:\n${JSON.stringify(input, null, 2)}`,
      buttons: ['Allow', 'Deny'],
      defaultId: 0,
      cancelId: 1,
      icon: undefined,
    });
    if (choice === 1) return { denied: true, message: 'User denied this action.' };
  }

  let _r;
  try {
    _r = await (async () => {
    switch (name) {
      case 'get_system_info': {
        const [cpu, mem, disk, osInfo, battery] = await Promise.all([
          si.cpu(), si.mem(), si.fsSize(), si.osInfo(), si.battery(),
        ]);
        const load = await si.currentLoad();
        return {
          cpu: { brand: cpu.brand, cores: cpu.cores, usage: `${Math.round(load.currentLoad)}%` },
          memory: {
            total: `${(mem.total / 1024 ** 3).toFixed(1)} GB`,
            used: `${(mem.active / 1024 ** 3).toFixed(1)} GB`,
            free: `${(mem.available / 1024 ** 3).toFixed(1)} GB`,
            usagePercent: `${Math.round((mem.active / mem.total) * 100)}%`,
          },
          disks: disk.slice(0, 4).map(d => ({
            mount: d.mount,
            size: `${(d.size / 1024 ** 3).toFixed(0)} GB`,
            used: `${(d.used / 1024 ** 3).toFixed(0)} GB`,
            usagePercent: `${Math.round(d.use)}%`,
          })),
          os: {
            platform: osInfo.platform,
            distro: osInfo.distro,
            release: osInfo.release,
            arch: osInfo.arch,
            hostname: osInfo.hostname,
          },
          uptime: `${Math.floor(os.uptime() / 3600)}h ${Math.floor((os.uptime() % 3600) / 60)}m`,
          battery: battery.hasBattery
            ? { level: `${battery.percent}%`, charging: battery.isCharging }
            : 'No battery (desktop)',
        };
      }

      case 'open_application': {
        const appName = input.name.toLowerCase().trim();
        const WIN_APPS = {
          notepad: 'notepad.exe', calculator: 'calc.exe', paint: 'mspaint.exe',
          explorer: 'explorer.exe', 'file explorer': 'explorer.exe',
          chrome: 'chrome.exe', firefox: 'firefox.exe',
          edge: 'msedge.exe', 'microsoft edge': 'msedge.exe',
          code: 'code', 'vs code': 'code', 'visual studio code': 'code',
          terminal: 'wt.exe', 'windows terminal': 'wt.exe',
          cmd: 'cmd.exe', powershell: 'powershell.exe',
          spotify: 'spotify.exe', discord: 'discord.exe', steam: 'steam.exe',
          'task manager': 'taskmgr.exe', taskmgr: 'taskmgr.exe',
          'control panel': 'control.exe', settings: 'ms-settings:',
          word: 'winword.exe', excel: 'excel.exe', powerpoint: 'powerpnt.exe',
          outlook: 'outlook.exe', onenote: 'onenote.exe',
          vlc: 'vlc.exe', obs: 'obs64.exe', slack: 'slack.exe',
          zoom: 'zoom.exe', teams: 'teams.exe',
          snip: 'snippingtool.exe', 'snipping tool': 'snippingtool.exe',
          clock: 'ms-clock:', calendar: 'ms-calendar:', mail: 'ms-mail:',
        };
        const exe = WIN_APPS[appName] || input.name;
        if (exe.startsWith('ms-')) {
          await shell.openExternal(exe);
        } else {
          await execAsync(`start "" "${exe}"`);
        }
        return { success: true, opened: input.name };
      }

      case 'open_url': {
        let url = input.url.trim();
        if (!url.startsWith('http://') && !url.startsWith('https://') && !url.includes('://')) {
          url = `https://www.google.com/search?q=${encodeURIComponent(url)}`;
        }
        await shell.openExternal(url);
        return { success: true, opened: url };
      }

      case 'take_screenshot': {
        const sources = await desktopCapturer.getSources({
          types: ['screen'],
          thumbnailSize: { width: 1920, height: 1080 },
        });
        if (!sources.length) return { error: 'No screen sources found' };
        const dir = path.join(os.homedir(), 'Pictures', 'Zeus Screenshots');
        fs.mkdirSync(dir, { recursive: true });
        const file = path.join(dir, `zeus-${Date.now()}.png`);
        fs.writeFileSync(file, sources[0].thumbnail.toPNG());
        return {
          success: true,
          path: file,
          dataUrl: sources[0].thumbnail.toDataURL(),
          message: `Screenshot saved to ${file}`,
        };
      }

      case 'list_directory': {
        const dir = input.path || os.homedir();
        if (!fs.existsSync(dir)) return { error: `Path not found: ${dir}` };
        const items = fs.readdirSync(dir);
        return {
          path: dir,
          totalItems: items.length,
          items: items.slice(0, 100).map(item => {
            try {
              const stat = fs.statSync(path.join(dir, item));
              return {
                name: item,
                type: stat.isDirectory() ? 'folder' : 'file',
                size: stat.isDirectory() ? null : `${(stat.size / 1024).toFixed(1)} KB`,
                modified: stat.mtime.toLocaleDateString(),
              };
            } catch {
              return { name: item, type: 'unknown' };
            }
          }),
        };
      }

      case 'read_file': {
        if (!fs.existsSync(input.path)) return { error: `File not found: ${input.path}` };
        const stat = fs.statSync(input.path);
        if (stat.size > 1024 * 1024) return { error: 'File too large (max 1 MB)' };
        return {
          path: input.path,
          content: fs.readFileSync(input.path, 'utf-8'),
          sizeKB: (stat.size / 1024).toFixed(1),
        };
      }

      case 'write_file': {
        if (input.content === undefined || input.content === null) {
          return { error: 'write_file: content is required. You must provide the COMPLETE file content as the "content" parameter — never omit it, never leave it empty.' };
        }
        const dir = path.dirname(input.path);
        const existed = fs.existsSync(input.path);
        let before = null;
        if (existed) { try { before = fs.readFileSync(input.path, 'utf-8'); } catch {} }
        fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(input.path, input.content, 'utf-8');
        recordFileChange({ kind: existed ? 'modify' : 'create', path: input.path, before, after: input.content });
        return { success: true, path: input.path, bytesWritten: Buffer.byteLength(input.content) };
      }

      case 'run_command': {
        const shell = input.shell || settings?.system?.shell || 'powershell';
        // In agent mode npm install / builds can take several minutes — use a 5 min floor.
        const baseSecs = settings?.system?.requestTimeout || 60;
        const timeout = currentAgentMode ? Math.max(baseSecs * 1000, 300000) : baseSecs * 1000;
        // Default cwd to the agent's project directory so `npx create-react-app .`,
        // `npm install`, etc. all run inside the right folder, not the Electron app dir.
        const cmdCwd = (currentAgentMode && agentWorkingDir) ? agentWorkingDir : undefined;
        let cmd;
        if (shell === 'cmd') {
          cmd = `cmd /c "${input.command.replace(/"/g, '\\"')}"`;
        } else if (shell === 'bash') {
          cmd = `bash -c "${input.command.replace(/"/g, '\\"')}"`;
        } else if (shell === 'wsl') {
          cmd = `wsl bash -c "${input.command.replace(/"/g, '\\"')}"`;
        } else {
          // -EncodedCommand avoids ALL quoting/escaping issues with complex PS commands
          // (npm scripts, $variables, strings with quotes, etc.)
          const encoded = Buffer.from(input.command, 'utf16le').toString('base64');
          cmd = `powershell -WindowStyle Hidden -NoProfile -NonInteractive -EncodedCommand ${encoded}`;
        }
        const execOpts = { timeout, windowsHide: true, ...(cmdCwd ? { cwd: cmdCwd } : {}) };
        const cap = 4000;
        let stdout = '', stderr = '';
        try {
          ({ stdout, stderr } = await execAsync(cmd, execOpts));
        } catch (execErr) {
          // exec throws on non-zero exit — recover stdout/stderr so the agent can see the output
          stdout = execErr.stdout || '';
          stderr = execErr.stderr || execErr.message || '';
        }
        const trimOut = stdout.trim();
        const trimErr = stderr.trim();
        return {
          stdout: trimOut.length > cap ? trimOut.slice(0, cap) + '\n...[truncated]' : trimOut,
          stderr: trimErr.length > cap ? trimErr.slice(0, cap) + '\n...[truncated]' : trimErr,
          shell,
        };
      }

      case 'get_clipboard':
        return { content: clipboard.readText() || '(empty)' };

      case 'set_clipboard':
        clipboard.writeText(input.text);
        return { success: true };

      case 'get_running_processes': {
        const procs = await si.processes();
        return {
          totalProcesses: procs.all,
          topByCPU: procs.list
            .sort((a, b) => b.cpu - a.cpu)
            .slice(0, 20)
            .map(p => ({
              name: p.name,
              pid: p.pid,
              cpu: `${p.cpu.toFixed(1)}%`,
              mem: `${(p.memRss / 1024 / 1024).toFixed(0)} MB`,
            })),
        };
      }

      case 'create_directory': {
        const existed = fs.existsSync(input.path);
        fs.mkdirSync(input.path, { recursive: true });
        if (!existed) recordFileChange({ kind: 'mkdir', path: input.path });
        return { success: true, path: input.path };
      }

      case 'delete_path': {
        if (!fs.existsSync(input.path)) return { error: `Not found: ${input.path}` };
        const stat = fs.statSync(input.path);
        if (stat.isDirectory()) {
          const contents = fs.readdirSync(input.path);
          if (contents.length > 0) return { error: `Directory is not empty (${contents.length} items). List its contents first if you want to confirm deletion.` };
          fs.rmdirSync(input.path);
          recordFileChange({ kind: 'rmdir', path: input.path });
        } else {
          let before = null;
          try { before = fs.readFileSync(input.path, 'utf-8'); } catch {}
          fs.unlinkSync(input.path);
          recordFileChange({ kind: 'delete', path: input.path, before });
        }
        return { success: true, deleted: input.path };
      }

      case 'get_environment_variables': {
        const env = process.env;
        const safe = {};
        const SKIP = ['path', 'temp', 'tmp', 'appdata', 'localappdata', 'systemroot', 'windir',
          'psmodulepath', 'commonprogramfiles', 'commonprogramw6432', 'programdata',
          'programfiles', 'programw6432', 'ntuser'];
        for (const [k, v] of Object.entries(env)) {
          if (SKIP.includes(k.toLowerCase())) continue;
          // Skip long opaque values (GUIDs, machine-generated IDs, etc.)
          if (v && v.length > 200) continue;
          safe[k] = v;
        }
        return { variables: safe };
      }

      case 'move_file':
        if (!fs.existsSync(input.source)) return { error: `Source not found: ${input.source}` };
        fs.renameSync(input.source, input.destination);
        recordFileChange({ kind: 'move', path: input.destination, from: input.source, to: input.destination });
        return { success: true, from: input.source, to: input.destination };

      // ── Coding Agent Tools ───────────────────────────────────────────────────

      case 'get_directory_tree': {
        const root = input.path;
        const maxDepth = Math.min(Number(input.depth) || 4, 8);
        const ignoreSet = new Set(
          (input.ignore || 'node_modules,.git,dist,build,.next,__pycache__,venv,.venv,coverage,.cache,.turbo,out')
            .split(',').map(s => s.trim())
        );
        if (!fs.existsSync(root)) return { error: `Path not found: ${root}` };
        let count = 0;

        function buildTree(dir, depth, prefix) {
          if (depth > maxDepth || count > 600) return '';
          let out = '';
          let entries;
          try { entries = fs.readdirSync(dir); } catch { return ''; }
          entries = entries.filter(e => !ignoreSet.has(e));
          entries.sort((a, b) => {
            try {
              const aD = fs.statSync(path.join(dir, a)).isDirectory();
              const bD = fs.statSync(path.join(dir, b)).isDirectory();
              if (aD !== bD) return aD ? -1 : 1;
            } catch {}
            return a.localeCompare(b);
          });
          entries.forEach((entry, i) => {
            if (count > 600) return;
            const fp = path.join(dir, entry);
            const isLast = i === entries.length - 1;
            let isDir = false;
            try { isDir = fs.statSync(fp).isDirectory(); } catch { return; }
            out += `${prefix}${isLast ? '└── ' : '├── '}${entry}${isDir ? '/' : ''}\n`;
            count++;
            if (isDir) out += buildTree(fp, depth + 1, prefix + (isLast ? '    ' : '│   '));
          });
          return out;
        }

        const tree = path.basename(root) + '/\n' + buildTree(root, 1, '');
        return { path: root, tree, entriesShown: count, truncated: count >= 600 };
      }

      case 'find_files': {
        const { pattern, directory } = input;
        if (!fs.existsSync(directory)) return { error: `Directory not found: ${directory}` };
        const ignoreList = ['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'venv', '.venv'];
        const rx = new RegExp(
          '^' + pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*').replace(/\?/g, '.') + '$',
          'i'
        );
        const results = [];
        function walkFind(dir, depth) {
          if (depth > 10 || results.length > 300) return;
          try {
            for (const entry of fs.readdirSync(dir)) {
              if (ignoreList.includes(entry)) continue;
              const fp = path.join(dir, entry);
              let isDir = false;
              try { isDir = fs.statSync(fp).isDirectory(); } catch { continue; }
              if (!isDir && rx.test(entry)) results.push(fp);
              if (isDir) walkFind(fp, depth + 1);
            }
          } catch {}
        }
        walkFind(directory, 0);
        return { pattern, directory, count: results.length, files: results };
      }

      case 'search_in_files': {
        const { query, directory, file_extension } = input;
        if (!fs.existsSync(directory)) return { error: `Directory not found: ${directory}` };
        const ignoreList = ['node_modules', '.git', 'dist', 'build', '.next', '__pycache__', 'venv', '.venv'];
        const results = [];
        let filesSearched = 0;

        function searchFile(fp) {
          try {
            if (fs.statSync(fp).size > 512 * 1024) return;
            const content = fs.readFileSync(fp, 'utf-8');
            const matches = [];
            content.split('\n').forEach((line, i) => {
              if (line.toLowerCase().includes(query.toLowerCase())) {
                matches.push({ line: i + 1, text: line.trim().slice(0, 150) });
              }
            });
            if (matches.length > 0) results.push({ file: fp, matches: matches.slice(0, 15) });
          } catch {}
        }

        function walkSearch(dir, depth) {
          if (depth > 10 || filesSearched > 400) return;
          try {
            for (const entry of fs.readdirSync(dir)) {
              if (ignoreList.includes(entry)) continue;
              const fp = path.join(dir, entry);
              let isDir = false;
              try { isDir = fs.statSync(fp).isDirectory(); } catch { continue; }
              if (!isDir) {
                if (!file_extension || fp.endsWith(file_extension)) {
                  filesSearched++;
                  searchFile(fp);
                }
              } else {
                walkSearch(fp, depth + 1);
              }
            }
          } catch {}
        }

        walkSearch(directory, 0);
        return { query, directory, filesSearched, resultsCount: results.length, results: results.slice(0, 30) };
      }

      case 'patch_file': {
        const { path: filePath, original, replacement } = input;
        if (!fs.existsSync(filePath)) return { error: `File not found: ${filePath}` };
        const content = fs.readFileSync(filePath, 'utf-8');
        if (!content.includes(original)) {
          return { error: 'Original text not found. Ensure exact match including whitespace and indentation.' };
        }
        const occurrences = content.split(original).length - 1;
        if (occurrences > 1) {
          return { error: `Text appears ${occurrences} times — add more surrounding context to make it unique.` };
        }
        const patched = content.replace(original, replacement);
        fs.writeFileSync(filePath, patched, 'utf-8');
        recordFileChange({ kind: 'modify', path: filePath, before: content, after: patched });
        return { success: true, path: filePath, linesAffected: original.split('\n').length };
      }

      // ── Memory Tools ────────────────────────────────────────────────────────

      case 'memory_store': {
        const { category = 'note', key, value } = input;
        const id = `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
        const entry = { id, value, timestamp: new Date().toISOString() };
        if (key) entry.key = key;
        if (!memory[category]) memory[category] = [];
        memory[category].push(entry);
        saveMemoryFile(memory);
        return { success: true, id, category, stored: entry };
      }

      case 'memory_recall': {
        const q = (input.query || '').toLowerCase();
        const results = [];
        for (const [cat, entries] of Object.entries(memory)) {
          if (!Array.isArray(entries)) continue;
          for (const e of entries) {
            if (JSON.stringify(e).toLowerCase().includes(q)) {
              results.push({ category: cat, ...e });
            }
          }
        }
        return { query: input.query, count: results.length, results };
      }

      case 'memory_list': {
        const counts = {};
        for (const [k, v] of Object.entries(memory)) {
          if (Array.isArray(v)) counts[k] = v.length;
        }
        return { counts, memory };
      }

      case 'memory_delete': {
        let found = false;
        for (const [cat, entries] of Object.entries(memory)) {
          if (!Array.isArray(entries)) continue;
          const idx = entries.findIndex(e => e.id === input.id);
          if (idx >= 0) { memory[cat].splice(idx, 1); found = true; break; }
        }
        if (found) saveMemoryFile(memory);
        return found ? { success: true } : { error: 'Memory entry not found' };
      }

      case 'knowledge_search': {
        try {
          const hits = await getKnowledge().search(input.query, input.k || 5);
          if (!hits.length) {
            return { results: [], message: 'Knowledge base is empty or no relevant passages found. Ask the user to add documents in the Knowledge panel.' };
          }
          return {
            count: hits.length,
            results: hits.map((h) => ({ source: h.sourceName, score: Number(h.score.toFixed(3)), text: h.text })),
          };
        } catch (err) {
          if (err.code === 'OLLAMA_DOWN') return { error: 'Ollama is not running. Start Ollama to search the knowledge base.' };
          if (err.code === 'MODEL_MISSING') return { error: 'Embedding model missing. Run: ollama pull nomic-embed-text' };
          return { error: err.message };
        }
      }

      // ── Power Tools ──────────────────────────────────────────────────────────

      case 'read_webpage': {
        try {
          const html = await fetchPageHtml(input.url);
          const text = htmlToText(html);
          const max = 8000;
          return { url: input.url, chars: text.length, text: text.length > max ? text.slice(0, max) + '\n…[truncated]' : text };
        } catch (e) { return { error: e.message }; }
      }

      case 'download_file': {
        try {
          const dest = await downloadToFolder(input.url, app.getPath('downloads'), input.filename);
          return { success: true, saved: dest };
        } catch (e) { return { error: e.message }; }
      }

      case 'system_power': {
        const cmds = {
          lock:     'rundll32.exe user32.dll,LockWorkStation',
          sleep:    'rundll32.exe powrprof.dll,SetSuspendState 0,1,0',
          restart:  'shutdown /r /t 0',
          shutdown: 'shutdown /s /t 0',
          signout:  'shutdown /l',
        };
        const cmd = cmds[input.action];
        if (!cmd) return { error: 'Unknown action. Use lock, sleep, restart, shutdown, or signout.' };
        if (['restart', 'shutdown', 'signout'].includes(input.action)) {
          const choice = dialog.showMessageBoxSync(mainWindow, {
            type: 'warning', buttons: ['Cancel', `Yes, ${input.action}`], defaultId: 0, cancelId: 0,
            title: '⚡ ZEUS — Confirm', message: `Zeus wants to ${input.action} your PC. Continue?`,
          });
          if (choice !== 1) return { denied: true, message: 'User cancelled.' };
        }
        execAsync(cmd).catch(() => {});
        return { success: true, action: input.action };
      }

      case 'set_volume': {
        const sk = (keys) => execAsync(`powershell -NoProfile -Command "$w = New-Object -ComObject WScript.Shell; ${keys}"`);
        try {
          if (typeof input.mute === 'boolean') {
            await sk('$w.SendKeys([char]173)'); // toggle mute
            return { success: true, mute: 'toggled' };
          }
          if (typeof input.level === 'number') {
            const lvl = Math.max(0, Math.min(100, Math.round(input.level)));
            await sk('1..50 | ForEach-Object { $w.SendKeys([char]174) }'); // floor to 0
            const ups = Math.round(lvl / 2);
            if (ups > 0) await sk(`1..${ups} | ForEach-Object { $w.SendKeys([char]175) }`);
            return { success: true, level: lvl };
          }
          return { error: 'Specify level (0-100) or mute (true/false).' };
        } catch (e) { return { error: e.message }; }
      }

      case 'media_control': {
        const keys = { playpause: 179, next: 176, previous: 177, stop: 178 };
        const code = keys[input.action];
        if (!code) return { error: 'Unknown action. Use playpause, next, previous, or stop.' };
        try {
          await execAsync(`powershell -NoProfile -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]${code})"`);
          return { success: true, action: input.action };
        } catch (e) { return { error: e.message }; }
      }

      case 'kill_process': {
        let cmd;
        if (input.pid) cmd = `taskkill /F /PID ${parseInt(input.pid, 10)}`;
        else if (input.name) { const n = /\.exe$/i.test(input.name) ? input.name : input.name + '.exe'; cmd = `taskkill /F /IM "${n}"`; }
        else return { error: 'Provide a process name or pid.' };
        try { const { stdout } = await execAsync(cmd); return { success: true, output: stdout.trim() }; }
        catch (e) { return { error: (e.stderr || e.message || '').trim() }; }
      }

      case 'open_path': {
        try {
          const err = await shell.openPath(input.path);
          if (err) return { error: err };
          return { success: true, opened: input.path };
        } catch (e) { return { error: e.message }; }
      }

      // ── Web / Integration Tools ──────────────────────────────────────────────

      case 'web_search': {
        const { query, num_results = 5 } = input;
        const https = require('https');
        const enc = encodeURIComponent(query);
        const data = await new Promise((res, rej) => {
          https.get(`https://api.duckduckgo.com/?q=${enc}&format=json&no_html=1&skip_disambig=1`, r => {
            let body = '';
            r.on('data', d => body += d);
            r.on('end', () => { try { res(JSON.parse(body)); } catch { rej(new Error('Parse error')); } });
          }).on('error', rej);
        });
        const results = [];
        if (data.Abstract) results.push({ title: data.Heading, snippet: data.Abstract, url: data.AbstractURL, source: data.AbstractSource });
        for (const t of (data.RelatedTopics || []).slice(0, num_results)) {
          if (t.Text && t.FirstURL) results.push({ title: t.Text.slice(0, 80), snippet: t.Text, url: t.FirstURL });
        }
        return { query, answer: data.Answer || null, results: results.slice(0, num_results) };
      }

      case 'get_weather': {
        const https = require('https');
        const loc = encodeURIComponent(input.location);
        const data = await new Promise((res, rej) => {
          https.get(`https://wttr.in/${loc}?format=j1`, r => {
            let body = '';
            r.on('data', d => body += d);
            r.on('end', () => { try { res(JSON.parse(body)); } catch { rej(new Error('Weather unavailable')); } });
          }).on('error', rej);
        });
        const c = data.current_condition?.[0];
        const area = data.nearest_area?.[0];
        return {
          location: area ? `${area.areaName[0].value}, ${area.country[0].value}` : input.location,
          temperature: { celsius: c?.temp_C + '°C', fahrenheit: c?.temp_F + '°F' },
          feelsLike:   { celsius: c?.FeelsLikeC + '°C', fahrenheit: c?.FeelsLikeF + '°F' },
          humidity: c?.humidity + '%',
          description: c?.weatherDesc?.[0]?.value,
          windSpeed: c?.windspeedKmph + ' km/h',
          visibility: c?.visibility + ' km',
          uvIndex: c?.uvIndex,
          forecast: data.weather?.slice(0, 3).map(d => ({
            date: d.date,
            maxTemp: d.maxtempC + '°C',
            minTemp: d.mintempC + '°C',
            description: d.hourly?.[4]?.weatherDesc?.[0]?.value,
          })),
        };
      }

      case 'http_request': {
        const { url, method = 'GET', headers: reqHeaders = {}, body: reqBody } = input;
        const https = require('https');
        const http = require('http');
        const { URL: NODEURL } = require('url');
        const parsed = new NODEURL(url);
        const lib = parsed.protocol === 'https:' ? https : http;
        const bodyData = reqBody ? (typeof reqBody === 'string' ? reqBody : JSON.stringify(reqBody)) : undefined;
        const hdrs = { 'User-Agent': 'ZEUS-AI/1.0', ...reqHeaders };
        if (bodyData) { hdrs['Content-Type'] = hdrs['Content-Type'] || 'application/json'; hdrs['Content-Length'] = Buffer.byteLength(bodyData); }
        const result = await new Promise((res, rej) => {
          const req = lib.request({
            hostname: parsed.hostname, port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
            path: parsed.pathname + parsed.search, method: method.toUpperCase(), headers: hdrs,
          }, r => {
            let body = '';
            r.on('data', d => body += d);
            r.on('end', () => {
              let parsed2;
              try { parsed2 = JSON.parse(body); } catch { parsed2 = body.slice(0, 4000); }
              res({ status: r.statusCode, body: parsed2 });
            });
          });
          req.on('error', rej);
          if (bodyData) req.write(bodyData);
          req.end();
        });
        return result;
      }

      case 'send_notification': {
        const { Notification } = require('electron');
        if (Notification.isSupported()) {
          new Notification({ title: input.title, body: input.body }).show();
          return { success: true };
        }
        return { error: 'Notifications not supported on this platform' };
      }

      case 'set_reminder': {
        const ms = Math.min(Math.max((input.minutes || 1) * 60000, 5000), 24 * 60 * 60 * 1000);
        const fireAt = new Date(Date.now() + ms).toLocaleTimeString();
        setTimeout(() => {
          const { Notification } = require('electron');
          if (Notification.isSupported()) new Notification({ title: '⚡ ZEUS Reminder', body: input.message }).show();
        }, ms);
        return { success: true, message: input.message, firesAt: fireAt };
      }

      case 'get_datetime': {
        const now = new Date();
        return {
          iso: now.toISOString(),
          date: now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
          time: now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        };
      }

      case 'task_complete':
        return { __task_complete: true, summary: input.summary || 'Task complete.' };

      default:
        return { error: `Unknown tool: ${name}` };
    }
    })();
  } catch (err) {
    _r = { error: err.message };
  }
  emitToolLog(name, input, _r ?? {});
  return _r;
}

// ─── Tool Result Safety ───────────────────────────────────────────────────────

// Serialize a tool result to a string, capping at maxLen characters.
// This prevents large outputs (npm install, env vars, file contents) from
// bloating the messages array and triggering Anthropic 400 errors.
function safeToolResult(result, maxLen = 12000) {
  try {
    if (result === null || result === undefined) return '{"error":"No result returned"}';
    // Strip heavy binary fields (e.g. screenshot dataUrls) before serializing.
    // The raw base64 would bloat the context by ~12 KB and get truncated anyway —
    // the model can't read truncated base64, and the image is shown to the user separately.
    let toSerialize = result;
    if (result && typeof result === 'object' && typeof result.dataUrl === 'string') {
      toSerialize = { ...result, dataUrl: '[image captured and shown to the user]' };
    }
    const str = JSON.stringify(toSerialize);
    if (!str || str === 'undefined') return '{"error":"Result could not be serialized"}';
    if (str.length <= maxLen) return str;
    return str.slice(0, maxLen) + '... [truncated — output too large]';
  } catch {
    return '{"error":"Result serialization failed"}';
  }
}

// Prune the in-session messages array so it never grows unbounded during
// long coding tasks. Keeps the original user request + last `keep` messages.
// CRITICAL: the slice must start at an assistant message. If it starts on a
// user(tool_result) message, those results reference tool_use IDs from the
// assistant message that was trimmed — Anthropic returns 400 <nil> for that.
function pruneMsgs(msgs, keep = currentAgentMode ? 60 : 16) {
  if (msgs.length <= keep + 1) return msgs;
  let start = msgs.length - keep;
  // Walk forward until we land on an assistant message
  while (start < msgs.length - 1 && msgs[start]?.role !== 'assistant') start++;
  if (start >= msgs.length) return [msgs[0]];
  return [msgs[0], ...msgs.slice(start)];
}

// ─── AI Provider Helpers ──────────────────────────────────────────────────────

let currentAgentMode = false;
let agentWorkingDir = null;

function extractWorkingDir(messages) {
  for (const m of messages) {
    if (m.role !== 'user' || typeof m.content !== 'string') continue;
    const match = m.content.match(/Working Directory:\s*(.+?)(?:\n|$)/);
    if (match) return match[1].trim();
  }
  return null;
}

function getZeusSystem() {
  if (currentAgentMode) return getAgentSystem(agentWorkingDir);
  const lang = settings?.chat?.responseLanguage;
  const langLine = lang && lang !== 'auto'
    ? `\n\nAlways respond in ${lang} unless the user writes to you in a different language.`
    : '';
  const extra = settings?.chat?.systemPromptExtra?.trim()
    ? `\n\nAdditional instructions from the user:\n${settings.chat.systemPromptExtra.trim()}`
    : '';
  return `You are ZEUS, an advanced AI desktop assistant inspired by JARVIS. You combine intelligence, personality, and full PC control.

Personality: Efficient, confident, slightly formal, occasionally witty. Address the user as "${settings.userName}" unless told otherwise. Be direct and concise — no filler. When using tools, briefly narrate what you're doing.

Capabilities: PC control (files, apps, commands, clipboard, screenshots), web search, weather, HTTP requests to any API (GitHub, Spotify, Home Assistant, etc.), desktop notifications, reminders, and persistent memory across all conversations.

MEMORY RULES:
1. Use memory_store ONLY when the user explicitly asks you to remember something, or when they share information they clearly want saved (name, job, city, project path, API keys). Do NOT call it on casual greetings or small talk.
2. Use memory_recall at the start of coding or project tasks to check for saved context.
3. Never say "I'll remember that" without immediately calling memory_store.
4. Never call memory tools during simple conversation — only when there is clear information worth saving.

Current date/time available via get_datetime. Use web_search for any current information. Use http_request for any external API.

For long coding tasks: work methodically, write complete files, confirm each major step. Never stop mid-task — if you hit a problem, debug and keep going.

Important: Always explain what you're about to do. For destructive actions, confirm intent first.${formatMemoryForPrompt()}${extra}${langLine}`;
}

function getAgentSystem(workingDir) {
  return `You are a coding agent. Your job is to read the project structure if needed, write all required files completely, run install/build commands, and call task_complete.

Working directory: ${workingDir || 'see task message'}

ABSOLUTE RULES:
1. Your very first action MUST be a tool call — zero text output before calling a tool.
2. For new projects: call write_file immediately for the first file.
   For existing projects or bug fixes: call get_directory_tree or read_file first to understand the code, then write_file or patch_file.
3. One write_file call per file. Content must be COMPLETE working code — no TODOs, no placeholders, no ellipsis ("...").
4. Use absolute Windows paths: C:\\Users\\...\\project\\src\\index.js
5. TEXT OUTPUT DOES NOTHING. Writing file content as text, in code blocks, or in JSON does NOT create files. Only write_file and patch_file create/modify files.
6. After reading existing code, immediately write or patch it — do not narrate what you found.
7. Run installs and builds with run_command after writing all files. Check exit codes via stderr.
8. Call task_complete when every file is written/patched and the project is ready.
9. Never stop mid-task. Never ask questions. Never output file contents as text. Keep calling tools.

Valid patterns:
  New project:     write_file → write_file → run_command → task_complete
  Existing/fix:    get_directory_tree → read_file → patch_file/write_file → run_command → task_complete`;
}

function toAnthropicTools(tools) {
  return tools.map(t => ({ name: t.name, description: t.description, input_schema: t.schema }));
}

function toOpenAITools(tools) {
  return tools.map(t => ({
    type: 'function',
    function: { name: t.name, description: t.description, parameters: t.schema },
  }));
}

function toGeminiTools(tools) {
  const decls = tools.map(t => {
    const params = JSON.parse(JSON.stringify(t.schema));
    if (params.type) params.type = params.type.toUpperCase();
    if (params.properties) {
      for (const k in params.properties) {
        const p = params.properties[k];
        if (p.type) p.type = p.type.toUpperCase();
        if (p.enum) { p.type = 'STRING'; delete p.enum; }
      }
    }
    return { name: t.name, description: t.description, parameters: params };
  });
  return [{ functionDeclarations: decls }];
}

// ─── Conversation Title Generation ────────────────────────────────────────────

ipcMain.handle('zeus:generate-title', async (_, { provider, model, apiKey, baseURL, prompt }) => {
  const sys = 'You write ultra-short chat titles. Reply with ONLY a 3 to 5 word title in Title Case that captures the topic. No quotes, no trailing punctuation, no preamble.';
  try {
    if (provider === 'anthropic' && apiKey) {
      const { Anthropic } = require('@anthropic-ai/sdk');
      const r = await new Anthropic({ apiKey }).messages.create({
        model: model || 'claude-haiku-4-5-20251001', max_tokens: 20,
        system: sys, messages: [{ role: 'user', content: prompt }],
      });
      return (r.content?.[0]?.text || '').trim();
    }
    if (provider === 'openai' && apiKey) {
      const { OpenAI } = require('openai');
      const r = await new OpenAI({ apiKey }).chat.completions.create({
        model: model || 'gpt-4o-mini', max_tokens: 20,
        messages: [{ role: 'system', content: sys }, { role: 'user', content: prompt }],
      });
      return (r.choices?.[0]?.message?.content || '').trim();
    }
    if (provider === 'gemini' && apiKey) {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const m = new GoogleGenerativeAI(apiKey).getGenerativeModel({ model: model || 'gemini-2.0-flash', systemInstruction: sys });
      return ((await m.generateContent(prompt)).response.text() || '').trim();
    }
    if (provider === 'ollama') {
      const { OpenAI } = require('openai');
      const r = await new OpenAI({ apiKey: 'ollama', baseURL: baseURL || 'http://localhost:11434/v1' }).chat.completions.create({
        model: model || 'llama3.2', max_tokens: 20,
        messages: [{ role: 'system', content: sys }, { role: 'user', content: prompt }],
      });
      return (r.choices?.[0]?.message?.content || '').trim();
    }
  } catch (e) {
    console.error('[Zeus Title]', e.message);
  }
  return null;
});

// ─── Active Streams ───────────────────────────────────────────────────────────

const activeStreams = new Map();

ipcMain.on('zeus:cancel-stream', (_, streamId) => {
  const s = activeStreams.get(streamId);
  if (s) s.cancelled = true;
});

// ─── Main AI Handler ──────────────────────────────────────────────────────────

ipcMain.handle('zeus:ai-message', async (event, params) => {
  const { streamId, messages, provider, model, apiKey, baseURL, imageBase64, agentMode, agentDir } = params;

  // Agent mode is a sticky toggle owned by the UI. When the frontend sends an explicit
  // boolean we trust it (so the user can freely switch between chat and agent). Only when
  // it's absent do we fall back to detecting the activation message in history.
  const isAgentConv = typeof agentMode === 'boolean'
    ? agentMode
    : messages.some(m =>
        m.role === 'user' && typeof m.content === 'string' &&
        m.content.includes('[ZEUS CODING AGENT — ACTIVATED]')
      );
  currentAgentMode = isAgentConv;
  // Prefer the directory the UI is bound to; fall back to scraping it from history.
  agentWorkingDir = isAgentConv ? ((agentDir && agentDir.trim()) || extractWorkingDir(messages)) : null;

  const rawSender = event.sender;

  // For the first agent message, pre-fetch the directory tree and append it so the model
  // immediately has the project context. System prompt (getAgentSystem) handles all rules.
  let effectiveMsgs = messages;
  if (isAgentConv && agentWorkingDir && messages.length > 0) {
    const lastUserIdx = [...messages].findLastIndex(m => m.role === 'user');
    if (lastUserIdx >= 0) {
      const originalContent = typeof messages[lastUserIdx].content === 'string'
        ? messages[lastUserIdx].content : '';
      if (originalContent.includes('[ZEUS CODING AGENT — ACTIVATED]')) {
        try {
          const treeResult = await executeTool('get_directory_tree', { path: agentWorkingDir });
          const treeText = treeResult.tree || JSON.stringify(treeResult, null, 2);
          effectiveMsgs = [...messages];
          effectiveMsgs[lastUserIdx] = {
            ...effectiveMsgs[lastUserIdx],
            content: originalContent + '\n\n[Working directory snapshot]\n' + treeText,
          };
        } catch {}
      }
    }
  }

  // Proxy sender: forwards to main window AND updates mini-HUD with streaming state
  let accText = '';
  const sender = {
    send(channel, data) {
      rawSender.send(channel, data);
      if (channel === 'zeus:chunk' && data.streamId === streamId) {
        if (data.type === 'text') accText += data.text;
        if (data.type === 'replace') accText = data.text;
      }
    },
    isDestroyed: () => rawSender.isDestroyed(),
  };

  // Notify mini-HUD that streaming started
  miniHUDWindow?.webContents?.send('mini:state', { streaming: true });

  // Cancel existing stream with same id
  const existing = activeStreams.get(streamId);
  if (existing) existing.cancelled = true;

  const state = { cancelled: false };
  activeStreams.set(streamId, state);

  try {
    if (provider === 'anthropic') {
      await runAnthropic(sender, streamId, state, effectiveMsgs, model, apiKey, imageBase64);
    } else if (provider === 'openai') {
      await runOpenAI(sender, streamId, state, effectiveMsgs, model, apiKey, imageBase64);
    } else if (provider === 'gemini') {
      await runGemini(sender, streamId, state, effectiveMsgs, model, apiKey, imageBase64);
    } else if (provider === 'ollama') {
      await runOllama(sender, streamId, state, effectiveMsgs, model, baseURL || 'http://localhost:11434/v1', imageBase64);
    } else {
      sender.send('zeus:chunk', { streamId, type: 'error', error: 'Unknown provider: ' + provider });
    }
  } catch (err) {
    console.error('[Zeus AI Error]', err.message);
    sender.send('zeus:chunk', { streamId, type: 'error', error: err.message });
  } finally {
    activeStreams.delete(streamId);
    if (!rawSender.isDestroyed()) rawSender.send('zeus:chunk', { streamId, type: 'done' });
    // Update mini-HUD with final response text
    miniHUDWindow?.webContents?.send('mini:state', {
      streaming: false,
      lastMessage: accText.replace(/\n/g, ' ').trim().slice(0, 120),
    });
  }
});

// ─── Anthropic ────────────────────────────────────────────────────────────────

const AGENT_CONTINUE_MSG = '[AGENT CONTINUE] The task is not finished. Call get_directory_tree on the working directory to see what exists, then call write_file for each remaining file with its COMPLETE content. Do not output code as text. Do not ask questions. Keep building.';

// Rebuild prior tool calls (carried on assistant messages as `toolActivities`)
// into real Anthropic tool_use/tool_result turns, so the model can see that a
// tool already ran and succeeded — and won't repeat it when the user just says
// "thanks". Each assistant-with-tools message becomes three turns:
//   assistant[tool_use…] → user[tool_result…] → assistant[summary text].
function expandHistoryForAnthropic(messages) {
  const out = [];
  for (const m of messages) {
    const acts = (m.role === 'assistant' && Array.isArray(m.toolActivities))
      ? m.toolActivities.filter(a => a && a.tool && a.tool !== 'task_complete')
      : [];
    if (acts.length) {
      const toolUse = [];
      const toolResults = [];
      acts.forEach((a, i) => {
        const id = `hist-${out.length}-${i}`;
        toolUse.push({ type: 'tool_use', id, name: a.tool, input: a.input || {} });
        toolResults.push({ type: 'tool_result', tool_use_id: id, content: safeToolResult(a.result ?? {}) });
      });
      out.push({ role: 'assistant', content: toolUse });
      out.push({ role: 'user', content: toolResults });
      const text = typeof m.content === 'string' ? m.content.trim() : '';
      out.push({ role: 'assistant', content: text || '(done)' });
    } else {
      out.push({ role: m.role, content: m.content });
    }
  }
  return out;
}

async function runAnthropic(sender, streamId, state, messages, model, apiKey, imageBase64) {
  const { Anthropic } = require('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });

  let msgs = expandHistoryForAnthropic(messages);
  let toolCallCount = 0;
  let agentContinues = 0;
  const AGENT_MAX_ITERS = 300; // large React/full-stack projects need 100+ tool calls

  // Inject screenshot into last user message if provided
  if (imageBase64) {
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'user') {
        const base64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
        msgs[i] = { role: 'user', content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/png', data: base64 } },
          { type: 'text', text: typeof msgs[i].content === 'string' ? msgs[i].content : '' },
        ]};
        break;
      }
    }
  }

  while (!state.cancelled && toolCallCount < AGENT_MAX_ITERS) {
    const reqOpts = {
      model: model || 'claude-opus-4-8',
      max_tokens: currentAgentMode ? 32768 : (settings?.chat?.maxTokens || 4096),
      temperature: settings?.chat?.temperature ?? 0.7,
      system: getZeusSystem(),
      messages: msgs,
      tools: toAnthropicTools(currentAgentMode ? AGENT_TOOLS : TOOLS),
    };
    if (currentAgentMode) reqOpts.tool_choice = { type: 'any' };

    const stream = client.messages.stream(reqOpts);

    let currentBlock = null;
    let inputBuf = '';

    for await (const ev of stream) {
      if (state.cancelled) break;

      if (ev.type === 'content_block_start') {
        if (ev.content_block.type === 'text') {
          currentBlock = { type: 'text', text: '' };
        } else if (ev.content_block.type === 'tool_use') {
          currentBlock = { type: 'tool_use', id: ev.content_block.id, name: ev.content_block.name, input: {} };
          inputBuf = '';
          if (ev.content_block.name !== 'task_complete') {
            sender.send('zeus:chunk', { streamId, type: 'tool_start', tool: ev.content_block.name });
          }
        }
      }

      if (ev.type === 'content_block_delta') {
        if (ev.delta.type === 'text_delta' && currentBlock?.type === 'text') {
          currentBlock.text += ev.delta.text;
          sender.send('zeus:chunk', { streamId, type: 'text', text: ev.delta.text });
        }
        if (ev.delta.type === 'input_json_delta') inputBuf += ev.delta.partial_json;
      }

      if (ev.type === 'content_block_stop') {
        if (currentBlock?.type === 'tool_use') {
          try {
            currentBlock.input = JSON.parse(inputBuf);
          } catch {
            currentBlock.input = { __parse_error: true };
          }
        }
        currentBlock = null;
        inputBuf = '';
      }
    }

    if (state.cancelled) break;

    const finalMsg = await stream.finalMessage();

    if (finalMsg.stop_reason === 'max_tokens') {
      const assistantContent = finalMsg.content.length
        ? finalMsg.content
        : [{ type: 'text', text: '(response truncated)' }];
      msgs = pruneMsgs([
        ...msgs,
        { role: 'assistant', content: assistantContent },
        { role: 'user', content: 'continue' },
      ]);
    } else if (finalMsg.stop_reason === 'tool_use' || finalMsg.stop_reason === 'end_turn') {
      const toolResults = [];
      let taskDone = false;

      for (const block of finalMsg.content) {
        if (block.type !== 'tool_use') continue;
        toolCallCount++;

        if (block.name === 'task_complete') {
          const summary = block.input?.summary || 'Task complete.';
          sender.send('zeus:chunk', { streamId, type: 'text', text: '\n\n✅ ' + summary });
          taskDone = true;
          break;
        }

        sender.send('zeus:chunk', { streamId, type: 'tool_exec', tool: block.name, input: block.input });
        const result = await executeTool(block.name, block.input);
        sender.send('zeus:chunk', { streamId, type: 'tool_result', tool: block.name, result });

        if (result.dataUrl) {
          sender.send('zeus:chunk', { streamId, type: 'screenshot', dataUrl: result.dataUrl });
        }

        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: safeToolResult(result),
        });
      }

      if (taskDone) break;
      if (toolResults.length === 0) {
        // end_turn with no tools in agent mode — model ignored tool_choice:any.
        // Nudge it to keep going rather than silently dropping the task.
        if (currentAgentMode && agentContinues < 3 && !state.cancelled) {
          agentContinues++;
          const assistantContent = finalMsg.content.length
            ? finalMsg.content
            : [{ type: 'text', text: '(working...)' }];
          msgs = pruneMsgs([
            ...msgs,
            { role: 'assistant', content: assistantContent },
            { role: 'user', content: AGENT_CONTINUE_MSG },
          ]);
          continue;
        }
        break;
      }
      msgs = pruneMsgs([...msgs, { role: 'assistant', content: finalMsg.content }, { role: 'user', content: toolResults }]);
    } else {
      // Text-only stop — model wasn't forced (non-agent) or tool_choice wasn't respected
      const shouldContinue = currentAgentMode && agentContinues < 10 && !state.cancelled &&
        (agentContinues === 0 || toolCallCount > 0);
      if (shouldContinue) {
        agentContinues++;
        const assistantContent = finalMsg.content.length
          ? finalMsg.content
          : [{ type: 'text', text: '(working...)' }];
        msgs = pruneMsgs([
          ...msgs,
          { role: 'assistant', content: assistantContent },
          { role: 'user', content: AGENT_CONTINUE_MSG },
        ]);
        continue;
      }
      break;
    }
  }
}

// ─── OpenAI ───────────────────────────────────────────────────────────────────

async function runOpenAI(sender, streamId, state, messages, model, apiKey, imageBase64) {
  const { OpenAI } = require('openai');
  const client = new OpenAI({ apiKey });

  let msgs = [
    { role: 'system', content: getZeusSystem() },
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ];
  let toolCallCount = 0;
  let agentContinues = 0;

  // Inject screenshot into last user message if provided
  if (imageBase64) {
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'user') {
        const text = typeof msgs[i].content === 'string' ? msgs[i].content : '';
        msgs[i] = { role: 'user', content: [
          { type: 'image_url', image_url: { url: imageBase64 } },
          { type: 'text', text },
        ]};
        break;
      }
    }
  }

  const AGENT_MAX_ITERS_OAI = 300;

  // Reasoning models (o1, o3, o4…) reject `temperature` and use `max_completion_tokens`
  // instead of `max_tokens`. Sending the chat-model params returns a 400 and breaks the call.
  const isReasoningModel = /^o\d/i.test(model || '');
  const tokenBudget = currentAgentMode ? 16384 : (settings?.chat?.maxTokens || 4096);

  while (!state.cancelled && toolCallCount < AGENT_MAX_ITERS_OAI) {
    const streamParams = {
      model: model || 'gpt-4o',
      messages: msgs,
      tools: toOpenAITools(currentAgentMode ? AGENT_TOOLS : TOOLS),
      stream: true,
      ...(isReasoningModel
        ? { max_completion_tokens: tokenBudget }
        : { temperature: settings?.chat?.temperature ?? 0.7, max_tokens: tokenBudget }),
    };
    if (currentAgentMode) streamParams.tool_choice = 'required';

    const stream = await client.chat.completions.create(streamParams);

    const tcAcc = {};
    let fullContent = '';
    let stopReason = null;

    for await (const chunk of stream) {
      if (state.cancelled) break;
      const delta = chunk.choices[0]?.delta;
      stopReason = chunk.choices[0]?.finish_reason || stopReason;

      if (delta?.content) {
        fullContent += delta.content;
        sender.send('zeus:chunk', { streamId, type: 'text', text: delta.content });
      }

      if (delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (!tcAcc[tc.index]) {
            tcAcc[tc.index] = { id: '', name: '', args: '' };
            if (tc.function?.name && tc.function.name !== 'task_complete') {
              sender.send('zeus:chunk', { streamId, type: 'tool_start', tool: tc.function.name });
            }
          }
          if (tc.id) tcAcc[tc.index].id = tc.id;
          if (tc.function?.name) tcAcc[tc.index].name += tc.function.name;
          if (tc.function?.arguments) tcAcc[tc.index].args += tc.function.arguments;
        }
      }
    }

    if (state.cancelled) break;

    if (stopReason === 'length') {
      msgs.push({ role: 'assistant', content: fullContent || '(truncated)' });
      msgs.push({ role: 'user', content: 'continue' });
      msgs = pruneMsgs(msgs);
    } else if (stopReason === 'tool_calls' || stopReason === 'stop') {
      const toolCalls = Object.values(tcAcc);
      if (toolCalls.length === 0) {
        if (currentAgentMode && agentContinues < 3 && !state.cancelled) {
          agentContinues++;
          msgs.push({ role: 'assistant', content: fullContent || '(working...)' });
          msgs.push({ role: 'user', content: AGENT_CONTINUE_MSG });
          msgs = pruneMsgs(msgs);
          continue;
        }
        break;
      }

      msgs.push({
        role: 'assistant',
        content: fullContent || null,
        tool_calls: toolCalls.map(tc => ({
          id: tc.id, type: 'function',
          function: { name: tc.name, arguments: tc.args },
        })),
      });

      let taskDone = false;
      for (const tc of toolCalls) {
        let input = {};
        try { input = JSON.parse(tc.args); } catch { input = { __parse_error: true }; }
        toolCallCount++;

        if (tc.name === 'task_complete') {
          const summary = input.summary || 'Task complete.';
          sender.send('zeus:chunk', { streamId, type: 'text', text: '\n\n✅ ' + summary });
          taskDone = true;
          break;
        }

        sender.send('zeus:chunk', { streamId, type: 'tool_exec', tool: tc.name, input });
        const result = await executeTool(tc.name, input);
        sender.send('zeus:chunk', { streamId, type: 'tool_result', tool: tc.name, result });
        if (result.dataUrl) sender.send('zeus:chunk', { streamId, type: 'screenshot', dataUrl: result.dataUrl });
        msgs.push({ role: 'tool', tool_call_id: tc.id, content: safeToolResult(result) });
      }
      if (taskDone) break;
      msgs = pruneMsgs(msgs);
    } else {
      if (currentAgentMode && agentContinues < 3 && !state.cancelled) {
        agentContinues++;
        msgs.push({ role: 'assistant', content: fullContent || '(working...)' });
        msgs.push({ role: 'user', content: AGENT_CONTINUE_MSG });
        msgs = pruneMsgs(msgs);
        continue;
      }
      break;
    }
  }
}

// ─── Gemini ───────────────────────────────────────────────────────────────────

async function runGemini(sender, streamId, state, messages, model, apiKey, imageBase64) {
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);

  const gemModel = genAI.getGenerativeModel({
    model: model || 'gemini-1.5-pro',
    tools: toGeminiTools(currentAgentMode ? AGENT_TOOLS : TOOLS),
    // In agent mode force a function call each turn so Gemini behaves like the
    // other providers (which use tool_choice:any / 'required') instead of replying with text.
    toolConfig: currentAgentMode ? { functionCallingConfig: { mode: 'ANY' } } : undefined,
    systemInstruction: getZeusSystem(),
    generationConfig: {
      temperature: settings?.chat?.temperature ?? 0.7,
      maxOutputTokens: currentAgentMode ? 8192 : (settings?.chat?.maxTokens || 4096),
    },
  });
  let toolCallCount = 0;
  let agentContinues = 0;

  const history = messages.slice(0, -1).map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  const chat = gemModel.startChat({ history });
  const lastText = messages[messages.length - 1].content;

  // Build prompt parts — include screenshot if provided
  let prompt;
  if (imageBase64) {
    const base64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    prompt = [
      { inlineData: { mimeType: 'image/png', data: base64 } },
      { text: lastText },
    ];
  } else {
    prompt = lastText;
  }

  while (!state.cancelled) {
    const result = await chat.sendMessageStream(prompt);
    prompt = undefined; // only use imageBase64 on first turn
    let funcCalls = [];

    for await (const chunk of result.stream) {
      if (state.cancelled) break;
      try {
        const text = chunk.text();
        if (text) sender.send('zeus:chunk', { streamId, type: 'text', text });
      } catch {}

      for (const cand of (chunk.candidates || [])) {
        for (const part of (cand.content?.parts || [])) {
          if (part.functionCall) {
            sender.send('zeus:chunk', { streamId, type: 'tool_start', tool: part.functionCall.name });
            funcCalls.push(part.functionCall);
          }
        }
      }
    }

    if (state.cancelled) break;

    if (funcCalls.length > 0) {
      const responses = [];
      for (const fc of funcCalls) {
        const input = fc.args || {};
        toolCallCount++;
        sender.send('zeus:chunk', { streamId, type: 'tool_exec', tool: fc.name, input });
        const res = await executeTool(fc.name, input);
        sender.send('zeus:chunk', { streamId, type: 'tool_result', tool: fc.name, result: res });
        if (res.dataUrl) sender.send('zeus:chunk', { streamId, type: 'screenshot', dataUrl: res.dataUrl });
        // Cap the result size before sending back to Gemini
        let safeRes;
        try { safeRes = JSON.parse(safeToolResult(res)); } catch { safeRes = { truncated: safeToolResult(res) }; }
        responses.push({ functionResponse: { name: fc.name, response: { result: safeRes } } });
      }
      prompt = responses;
    } else {
      // Check if Gemini hit the token limit
      try {
        const resp = await result.response;
        if (resp.candidates?.[0]?.finishReason === 'MAX_TOKENS') {
          prompt = 'continue';
          continue;
        }
      } catch {}
      // Agent mode auto-continue
      const shouldContinueGemini = currentAgentMode && agentContinues < 5 && !state.cancelled &&
        (agentContinues === 0 || toolCallCount > 0);
      if (shouldContinueGemini) {
        agentContinues++;
        prompt = AGENT_CONTINUE_MSG;
        continue;
      }
      break;
    }
  }
}

// ─── Ollama (OpenAI-compatible local endpoint) ────────────────────────────────

// Models confirmed to support OpenAI-format tool calling via Ollama.
// Any model NOT in this list runs in chat-only mode — no tools passed to the API —
// so it can never output raw JSON tool-call text by mistake.
const OLLAMA_TOOL_CAPABLE = new Set([
  'llama3.1', 'llama3.2',
  'mistral-nemo',
  'qwen2.5', 'qwen2.5:7b', 'qwen2.5:14b', 'qwen2.5:32b', 'qwen2.5:72b',
  'qwen2.5-coder', 'qwen2.5-coder:7b', 'qwen2.5-coder:14b',
  'firefunction-v2',
  'command-r', 'command-r-plus',
  'smollm2',
  'hermes3',
]);

function ollamaModelSupportsTools(model) {
  if (!model) return false;
  // Match by base name (strip :tag) so llama3.2:latest, llama3.2:3b, etc. all match
  const base = model.split(':')[0].toLowerCase();
  return OLLAMA_TOOL_CAPABLE.has(base) || OLLAMA_TOOL_CAPABLE.has(model.toLowerCase());
}

// Strip raw tool-call JSON that some Ollama models leak into plain text output.
function stripRawToolJson(text) {
  if (!text) return text;
  return text
    .replace(/\{"name"\s*:\s*"[^"]+"\s*,\s*"param(?:eters)?"\s*:\s*\{[^}]*(?:\{[^}]*\}[^}]*)?\}\s*\}/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Session-level overrides: if a model passes the whitelist but still outputs raw tool text,
// add it here so future calls skip tools for the rest of the session.
const ollamaNoToolsModels = new Set();

async function runOllama(sender, streamId, state, messages, model, baseURL, imageBase64) {
  const { OpenAI } = require('openai');
  const client = new OpenAI({ apiKey: 'ollama', baseURL });

  let msgs = [
    { role: 'system', content: getZeusSystem() },
    ...messages.map(m => ({ role: m.role, content: m.content })),
  ];
  let toolCallCount = 0;
  let agentContinues = 0;

  // Inject screenshot — Ollama vision models use 'images' field on user messages
  if (imageBase64) {
    const base64 = imageBase64.replace(/^data:image\/\w+;base64,/, '');
    for (let i = msgs.length - 1; i >= 0; i--) {
      if (msgs[i].role === 'user') {
        msgs[i] = { ...msgs[i], images: [base64] };
        break;
      }
    }
  }

  // Track the active model — may change mid-session if fast-mode model isn't installed
  let activeModel = model || 'llama3.2';

  // Only attempt tool calling for whitelisted models AND if not session-blacklisted
  let supportsTools = ollamaModelSupportsTools(activeModel) && !ollamaNoToolsModels.has(activeModel);
  const AGENT_MAX_ITERS_OLLAMA = 300;

  while (!state.cancelled && toolCallCount < AGENT_MAX_ITERS_OLLAMA) {
    let stream;
    try {
      const reqParams = {
        model: activeModel,
        messages: msgs,
        stream: true,
        temperature: settings?.chat?.temperature ?? 0.7,
        ...(settings?.chat?.unlimitedTokens ? {} : { max_tokens: currentAgentMode ? 32768 : (settings?.chat?.maxTokens || 4096) }),
        ...(supportsTools ? { tools: toOpenAITools(currentAgentMode ? AGENT_TOOLS : TOOLS) } : {}),
        ...(supportsTools && currentAgentMode ? { tool_choice: 'required' } : {}),
      };
      stream = await client.chat.completions.create(reqParams);
    } catch (err) {
      // Fast-mode (or any) model not installed — fall back to configured model
      if (err.status === 404) {
        const fallback = settings?.providers?.ollama?.model || 'llama3.2';
        if (activeModel !== fallback) {
          sender.send('zeus:chunk', {
            streamId, type: 'text',
            text: `\n> *(Model \`${activeModel}\` not installed — falling back to \`${fallback}\`)*\n\n`,
          });
          activeModel = fallback;
          supportsTools = !ollamaNoToolsModels.has(activeModel);
          continue;
        }
        sender.send('zeus:chunk', {
          streamId, type: 'error',
          error: `Model '${activeModel}' not found. Go to Settings → Models to download it.`,
        });
        break;
      }
      if (supportsTools && (err.status === 400 || err.status === 422 || err.message?.toLowerCase().includes('tool'))) {
        supportsTools = false;
        ollamaNoToolsModels.add(activeModel);
        sender.send('zeus:chunk', {
          streamId, type: 'text',
          text: '\n> *(Tool calling not supported by this model — running in chat-only mode. Try llama3.2, mistral-nemo, or qwen2.5 for tool support.)*\n\n',
        });
        continue;
      }
      throw err;
    }

    const tcAcc = {};
    let fullContent = '';
    let stopReason = null;

    for await (const chunk of stream) {
      if (state.cancelled) break;
      const delta = chunk.choices[0]?.delta;
      stopReason = chunk.choices[0]?.finish_reason || stopReason;

      if (delta?.content) {
        fullContent += delta.content;
        sender.send('zeus:chunk', { streamId, type: 'text', text: delta.content });
      }

      if (supportsTools && delta?.tool_calls) {
        for (const tc of delta.tool_calls) {
          if (!tcAcc[tc.index]) {
            tcAcc[tc.index] = { id: '', name: '', args: '' };
            if (tc.function?.name && tc.function.name !== 'task_complete') {
              sender.send('zeus:chunk', { streamId, type: 'tool_start', tool: tc.function.name });
            }
          }
          if (tc.id) tcAcc[tc.index].id = tc.id;
          if (tc.function?.name) tcAcc[tc.index].name += tc.function.name;
          if (tc.function?.arguments) tcAcc[tc.index].args += tc.function.arguments;
        }
      }
    }

    if (state.cancelled) break;

    if (stopReason === 'length') {
      msgs.push({ role: 'assistant', content: fullContent || '(truncated)' });
      msgs.push({ role: 'user', content: 'continue' });
      msgs = pruneMsgs(msgs);
    } else if (supportsTools && (stopReason === 'tool_calls' || stopReason === 'stop')) {
      const toolCalls = Object.values(tcAcc);
      if (toolCalls.length === 0) break;

      msgs.push({
        role: 'assistant',
        content: fullContent || null,
        tool_calls: toolCalls.map(tc => ({
          id: tc.id, type: 'function',
          function: { name: tc.name, arguments: tc.args },
        })),
      });
      let taskDone = false;
      for (const tc of toolCalls) {
        let input = {};
        try { input = JSON.parse(tc.args); } catch { input = { __parse_error: true }; }
        toolCallCount++;

        if (tc.name === 'task_complete') {
          const summary = input.summary || 'Task complete.';
          sender.send('zeus:chunk', { streamId, type: 'text', text: '\n\n✅ ' + summary });
          taskDone = true;
          break;
        }

        sender.send('zeus:chunk', { streamId, type: 'tool_exec', tool: tc.name, input });
        const result = await executeTool(tc.name, input);
        sender.send('zeus:chunk', { streamId, type: 'tool_result', tool: tc.name, result });
        if (result.dataUrl) sender.send('zeus:chunk', { streamId, type: 'screenshot', dataUrl: result.dataUrl });
        msgs.push({ role: 'tool', tool_call_id: tc.id, content: safeToolResult(result) });
      }
      if (taskDone) break;
      msgs = pruneMsgs(msgs);
    } else {
      // Clean any leaked raw tool-call JSON from the visible text before finishing
      const cleaned = stripRawToolJson(fullContent);
      if (cleaned !== fullContent) {
        sender.send('zeus:chunk', { streamId, type: 'replace', text: cleaned });
      }
      // Agent mode auto-continue
      const shouldContinueOllama = currentAgentMode && agentContinues < 5 && !state.cancelled &&
        (agentContinues === 0 || toolCallCount > 0);
      if (shouldContinueOllama) {
        agentContinues++;
        msgs.push({ role: 'assistant', content: cleaned || fullContent || '(working...)' });
        msgs.push({ role: 'user', content: AGENT_CONTINUE_MSG });
        msgs = pruneMsgs(msgs);
        continue;
      }
      break;
    }
  }
}


// ─── Telegram Bot ─────────────────────────────────────────────────────────────

let telegramInterval = null;
let telegramOffset   = 0;

async function telegramApi(token, endpoint, body) {
  const https = require('https');
  const data  = body ? JSON.stringify(body) : undefined;
  const hdrs  = { 'User-Agent': 'ZEUS-AI/1.0' };
  if (data) { hdrs['Content-Type'] = 'application/json'; hdrs['Content-Length'] = Buffer.byteLength(data); }
  return new Promise((res, rej) => {
    const req = https.request({
      hostname: 'api.telegram.org',
      path: `/bot${token}${endpoint}`,
      method: data ? 'POST' : 'GET',
      headers: hdrs,
    }, r => {
      let buf = '';
      r.on('data', d => buf += d);
      r.on('end', () => { try { res(JSON.parse(buf)); } catch { rej(new Error('Telegram parse error')); } });
    });
    req.on('error', rej);
    if (data) req.write(data);
    req.end();
  });
}

async function handleTelegramMessage(token, chatId, from, text) {
  const provider = settings?.activeProvider || 'anthropic';
  const cfg = settings?.providers?.[provider] || {};
  try {
    let response = '';
    const userMsg = `[Telegram from ${from}]: ${text}`;
    if (provider === 'anthropic' && cfg.apiKey) {
      const { Anthropic } = require('@anthropic-ai/sdk');
      const r = await new Anthropic({ apiKey: cfg.apiKey }).messages.create({
        model: cfg.model || 'claude-opus-4-8', max_tokens: 1024,
        system: getZeusSystem(), messages: [{ role: 'user', content: userMsg }],
      });
      response = r.content[0]?.text || '';
    } else if (provider === 'openai' && cfg.apiKey) {
      const { OpenAI } = require('openai');
      const r = await new OpenAI({ apiKey: cfg.apiKey }).chat.completions.create({
        model: cfg.model || 'gpt-4o',
        messages: [{ role: 'system', content: getZeusSystem() }, { role: 'user', content: userMsg }],
      });
      response = r.choices[0]?.message?.content || '';
    } else if (provider === 'gemini' && cfg.apiKey) {
      const { GoogleGenerativeAI } = require('@google/generative-ai');
      const m = new GoogleGenerativeAI(cfg.apiKey).getGenerativeModel({ model: cfg.model || 'gemini-1.5-pro', systemInstruction: getZeusSystem() });
      response = (await m.generateContent(userMsg)).response.text() || '';
    } else if (provider === 'ollama') {
      const { OpenAI } = require('openai');
      const r = await new OpenAI({ apiKey: 'ollama', baseURL: cfg.baseURL || 'http://localhost:11434/v1' }).chat.completions.create({
        model: cfg.model || 'llama3.2',
        messages: [{ role: 'system', content: getZeusSystem() }, { role: 'user', content: userMsg }],
      });
      response = r.choices[0]?.message?.content || '';
    } else {
      response = '⚡ ZEUS: No AI provider configured. Open the desktop app and add an API key in Settings.';
    }
    if (response.trim()) {
      for (const chunk of (response.match(/.{1,4000}/gs) || [response])) {
        await telegramApi(token, '/sendMessage', { chat_id: chatId, text: chunk });
      }
    }
  } catch (err) {
    await telegramApi(token, '/sendMessage', { chat_id: chatId, text: `⚠ Error: ${err.message}` }).catch(() => {});
  }
}

function startTelegramBot(token) {
  if (telegramInterval) { clearInterval(telegramInterval); telegramInterval = null; }
  if (!token) return;
  telegramOffset = 0;
  console.log('[Zeus] Telegram bot active.');
  async function poll() {
    try {
      const r = await telegramApi(token, `/getUpdates?offset=${telegramOffset}&timeout=1`);
      if (!r.ok || !r.result?.length) return;
      for (const upd of r.result) {
        telegramOffset = upd.update_id + 1;
        if (upd.message?.text) {
          handleTelegramMessage(token, upd.message.chat.id, upd.message.from?.first_name || 'User', upd.message.text).catch(console.error);
        }
      }
    } catch {}
  }
  poll();
  telegramInterval = setInterval(poll, 3000);
}
