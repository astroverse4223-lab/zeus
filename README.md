<div align="center">

<img src="build/icon.png" alt="Zeus AI" width="120" height="120" />

# ⚡ ZEUS AI

### *Your Personal JARVIS-Style Desktop Assistant*

[![Platform](https://img.shields.io/badge/platform-Windows-blue?style=for-the-badge&logo=windows)](https://github.com)
[![Electron](https://img.shields.io/badge/Electron-32-47848f?style=for-the-badge&logo=electron)](https://www.electronjs.org/)
[![React](https://img.shields.io/badge/React-18-61dafb?style=for-the-badge&logo=react)](https://react.dev/)
[![License](https://img.shields.io/badge/license-MIT-green?style=for-the-badge)](LICENSE)

**Zeus is a powerful, JARVIS-inspired AI desktop assistant that runs natively on Windows.**
Talk to it in plain English. It controls your PC, writes code, manages files, searches the web, calls any API, and remembers everything about you — across every conversation.

[🚀 Download](#-installation) · [✨ Features](#-features) · [🛠 Setup](#️-setup) · [📸 Screenshots](#-screenshots)

---

</div>

## 🌟 What Is Zeus?

Zeus is not a chatbot. It's a **full-control AI agent** that lives on your desktop. Give it a task — build a website, reorganize your project files, check the weather, send a message — and it executes it using a suite of 30+ built-in tools. It's powered by the best AI models in the world (Claude, GPT-4o, Gemini) **or runs completely offline** using local models via Ollama.

> 💡 **Think Iron Man's JARVIS** — it knows your name, remembers your projects, controls your PC, and gets smarter the more you use it.

---

## ✨ Features

### 🤖 Multi-Provider AI Engine

Zeus supports four AI backends you can switch between instantly:

| Provider | Models | Notes |
|----------|--------|-------|
| 🧠 **Anthropic Claude** | claude-opus-4-8, claude-sonnet-4-5, claude-haiku | Best for complex reasoning & coding |
| 🤖 **OpenAI GPT** | gpt-4o, gpt-4o-mini, gpt-4-turbo | Industry-standard performance |
| ✨ **Google Gemini** | gemini-1.5-pro, gemini-1.5-flash | Great multimodal & long context |
| 🦙 **Ollama (Local)** | llama3.2, mistral, qwen2.5, deepseek-r1 + more | 100% offline, fully private, no API cost |

---

### 🛠️ 30+ Built-In PC Control Tools

Zeus can actually *do things* on your computer — not just talk about them.

#### 📁 File System
- Read, write, create, delete, and move files
- List directories and browse folder trees
- Search for files by name or pattern
- Search inside files for code or text
- Patch files with surgical find-and-replace

#### 💻 Terminal & Commands
- Run shell commands (PowerShell, CMD, Bash, WSL)
- Execute scripts and programs
- Get real-time stdout/stderr output
- Built-in embedded terminal panel

#### 🖥️ PC Control
- Open any application by name
- Open URLs in the default browser
- Take screenshots and view them inline
- Read and write clipboard contents
- Get system info (CPU, RAM, OS, disk, GPU)
- List running processes
- Read environment variables
- Create directories

#### 🌐 Web & Internet
- Web search (DuckDuckGo — no API key needed)
- Fetch current weather for any city
- Make HTTP requests to **any REST API** (GitHub, Spotify, Home Assistant, Philips Hue, Slack, Discord, Notion, and more)

#### 🔔 Productivity
- Send Windows desktop notifications
- Set time-based reminders
- Get current date and time

#### 🧠 Memory
- Store facts, preferences, and notes that persist **across all conversations**
- Recall any stored information by keyword
- Zeus remembers your name, job, projects, and preferences automatically

---

### 📚 Knowledge Base (Local RAG)

Drag files or whole folders into Zeus and ask questions over your own documents — fully local and private.

- **Drag-and-drop** files/folders anywhere on the window, or add them from **Settings → Knowledge**
- Indexes **text, Markdown, code, and PDF** files (folders are scanned recursively, skipping junk like `node_modules`)
- Embeddings run **locally via Ollama** (`nomic-embed-text`) — your documents never leave your machine
- Zeus retrieves relevant passages on demand through the **`knowledge_search`** tool
- Stored in `%APPDATA%\zeus-ai\knowledge\` (chunk metadata in `index.json`, vectors in a `vectors.bin` sidecar)

> Requires Ollama running with the embedding model: `ollama pull nomic-embed-text`

---

### 🦙 In-App Ollama Model Manager

No need to use the command line to manage local AI models. Zeus has a full model browser built in:

- 🔍 **Auto-detects** if Ollama is installed or running
- 📥 **One-click download** for any model from a curated catalog of 13 models
- 📊 **Real-time progress bar** showing download speed and completion percentage
- 🧮 **RAM compatibility filter** — detects your PC's RAM and highlights which models will actually run
- 🗑️ **Delete models** to free up disk space
- ⚡ **Instant model switching** — click USE to set any installed model as active

**Included model catalog:**

| Model | Size | Best For |
|-------|------|---------|
| Llama 3.2 1B | 1.3 GB | Ultra-fast, minimal RAM |
| Llama 3.2 3B | 2.0 GB | Balanced with tool calling |
| Llama 3.1 8B | 4.7 GB | Best all-rounder ⭐ |
| Mistral 7B | 4.1 GB | Fast, great for coding |
| Mistral Nemo 12B | 7.1 GB | Smart + tool calling |
| Qwen 2.5 7B | 4.4 GB | Strong coder, multilingual |
| Qwen 2.5 14B | 8.9 GB | Complex tasks |
| Phi-4 14B | 9.1 GB | Microsoft's efficient model |
| Gemma 2 9B | 5.5 GB | Google's instruction model |
| DeepSeek R1 7B | 4.7 GB | Reasoning & math |
| DeepSeek R1 14B | 9.0 GB | Deep reasoning |
| Code Llama 7B | 3.8 GB | Dedicated code generation |
| Llama 3.1 70B | 39 GB | Near GPT-4 quality |

---

### 💾 Persistent Memory

Zeus remembers things about you **between conversations and app restarts**:

- 🧠 Stores facts (your name, role, location, tech stack)
- ❤️ Remembers preferences (coding style, response format, language)
- 📝 Keeps notes on ongoing projects
- Memories are injected into every conversation automatically
- View and manage all stored memories in Settings → Memory

---

### 🎨 Themes & Customization

Zeus ships with multiple carefully crafted themes:

| Theme | Vibe |
|-------|------|
| ⚡ **Zeus** | Electric blue — the classic JARVIS look |
| 🩸 **Blood Moon** | Deep red with crimson glow |
| 🌿 **Matrix** | Green terminal on black |
| 🌸 **Sakura** | Soft pink neon |
| 🌙 **Midnight** | Dark purple void |

**Fully customizable:**
- Font size (Small / Medium / Large / XL)
- Message density (Compact / Comfortable / Spacious)
- Animation speed (Fast / Normal / Slow / Off)
- Background pattern (Grid / Dots / Lines / Circuit / None)
- Compact HUD mode

---

### ✈️ Telegram Integration

Message Zeus from your phone, anywhere in the world:

1. Create a bot with [@BotFather](https://t.me/BotFather)
2. Paste the token in Settings → Links → Telegram
3. Toggle it on — Zeus will respond to your Telegram messages using the same AI and tools

---

### 🔌 API Integrations

Zeus has a universal `http_request` tool that can call any REST API without any extra setup:

- **GitHub** — repos, issues, PRs, commits, gists
- **Spotify** — playback control, search, now playing
- **Home Assistant** — smart home control
- **Philips Hue** — lights on/off, brightness, color
- **Gmail / Slack / Discord / Notion** — anything with an API

Just tell Zeus what you want — it figures out the endpoint.

---

### 🗣️ Voice

- 🎤 Speech-to-text input (browser Web Speech API)
- 🔊 Text-to-speech output (auto-speaks AI responses)
- Adjustable speech rate
- Toggle auto-speak on/off

---

### 🖥️ System HUD

A sleek heads-up display in the title bar shows live system stats:

- 🔥 CPU usage %
- 💾 RAM used / total
- 🔋 Battery level + charging status (laptops)

---

### ⌨️ Agent Launcher

A quick-access panel to launch pre-configured AI agents for common tasks:
- Code review
- File organizer
- Web researcher
- System auditor
- And more

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| **Shell** | [Electron 32](https://www.electronjs.org/) |
| **UI** | [React 18](https://react.dev/) + [Vite 5](https://vitejs.dev/) |
| **Styling** | [Tailwind CSS 3](https://tailwindcss.com/) |
| **Animations** | [Framer Motion 11](https://www.framer.com/motion/) |
| **State** | [Zustand 4](https://github.com/pmndrs/zustand) |
| **Markdown** | react-markdown + remark-gfm |
| **Code Highlighting** | react-syntax-highlighter (VS Code Dark+) |
| **System Info** | systeminformation |
| **AI — Anthropic** | @anthropic-ai/sdk |
| **AI — OpenAI** | openai |
| **AI — Gemini** | @google/generative-ai |
| **AI — Ollama** | OpenAI-compatible REST API |

---

## 🚀 Installation

### Option 1 — Download the Pre-Built Release (Easiest)

1. Go to the [Releases](https://github.com/your-username/zeus-ai/releases) page
2. Download `Zeus-AI-win-x64.zip`
3. Extract and run `Zeus AI.exe`
4. Open Settings (⚙️) and add your API key

### Option 2 — Run from Source

**Requirements:** Node.js 18+, npm

```bash
# Clone the repo
git clone https://github.com/your-username/zeus-ai.git
cd zeus-ai

# Install dependencies
npm install

# Start in development mode
npm run dev
```

---

## ⚙️ Setup

### 1. Get an API Key

Zeus works with any of these providers. You only need **one**:

| Provider | Where to get a key | Cost |
|----------|--------------------|------|
| **Anthropic** | [console.anthropic.com](https://console.anthropic.com) | Pay-per-use |
| **OpenAI** | [platform.openai.com](https://platform.openai.com) | Pay-per-use |
| **Google Gemini** | [aistudio.google.com](https://aistudio.google.com) | Free tier available |
| **Ollama** | [ollama.com](https://ollama.com) | **Free — runs locally** |

### 2. Add Your Key

1. Open Zeus
2. Click ⚙️ Settings
3. Go to **Providers** tab
4. Paste your API key and select your preferred provider
5. Click **Save Settings**

### 3. (Optional) Set Up Ollama for Local AI

For fully offline, free AI:

1. In Settings → **Models** tab, click **Download Ollama**
2. Install Ollama and run `ollama serve`
3. Come back to the Models tab, find a model that fits your RAM, and click **Download**
4. Once downloaded, click **USE** — Zeus switches to local AI instantly

> 💡 **Recommended starting model:** Llama 3.1 8B (needs ~8 GB RAM) — great all-around performance with tool calling support.

---

## 🎮 Usage

### Basic Chat

Just type anything. Zeus responds with streaming text and shows a live thinking indicator while it works.

### Give Zeus Tasks

Zeus understands natural language instructions. Examples:

```
"Build me a landing page for my SaaS app and save it to C:\Projects\landing"

"Search for the latest news about AI and summarize the top 5 stories"

"Organize my Downloads folder — move all images to an Images subfolder and docs to Docs"

"Check my GitHub repo for open issues and create a summary"

"Write a Python script that converts all JPGs in a folder to WebP"

"What's the weather in Miami this week?"
```

### Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `Enter` | Send message |
| `Shift + Enter` | New line |
| `Ctrl + Shift + Space` | Focus Zeus from anywhere (global hotkey) |
| `Esc` | Close settings / panels |

---

## 📁 Project Structure

```
zeus-ai/
├── electron/
│   ├── main.cjs          # Main process — IPC handlers, AI providers, all tools
│   └── preload.cjs       # Context bridge — exposes zeus API to renderer
├── src/
│   ├── App.jsx           # Root component, message handling, stream logic
│   ├── components/
│   │   ├── ChatWindow.jsx      # Message list
│   │   ├── MessageBubble.jsx   # Individual message with markdown, code blocks
│   │   ├── InputBar.jsx        # Text input + voice + send
│   │   ├── Settings.jsx        # Full settings panel (7 tabs)
│   │   ├── OllamaManager.jsx   # Local model browser & downloader
│   │   ├── Sidebar.jsx         # Conversation history
│   │   ├── HUD.jsx             # System stats display
│   │   ├── Terminal.jsx        # Embedded terminal
│   │   ├── ToolActivity.jsx    # Live tool call feed
│   │   └── AgentLauncher.jsx   # Quick-launch AI agents
│   ├── store/
│   │   └── useStore.js         # Zustand global state
│   └── themes.js               # Theme definitions & CSS vars
├── scripts/
│   └── package-app.cjs   # Custom packager script
└── package.json
```

---

## 🔒 Privacy & Security

- **Local AI (Ollama)**: All processing happens on your machine. Nothing leaves your PC.
- **Cloud AI (Claude/GPT/Gemini)**: Conversations go to the respective provider's API. Only the messages you send are transmitted — no telemetry.
- **API keys** are stored locally in `%APPDATA%\zeus-ai\zeus-settings.json` and never leave your machine.
- **Memory** is stored locally in `%APPDATA%\zeus-ai\zeus-memory.json`.

---

## 🛠️ Building from Source

```bash
# Development (hot reload)
npm run dev

# Production build (creates exe in /release)
npm run dist
```

The packager produces:
- `release/Zeus AI-win32-x64/Zeus AI.exe` — portable executable
- `release/Zeus-AI-win-x64.zip` — zipped distribution

---

## 🤝 Contributing

Contributions are welcome! Here's how to get started:

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Make your changes
4. Commit: `git commit -m 'Add amazing feature'`
5. Push: `git push origin feature/amazing-feature`
6. Open a Pull Request

### Ideas for Contributions
- 🌐 New language support
- 🔌 Additional API integrations
- 🎨 New themes
- 🛠️ New PC control tools
- 📱 Mobile companion app (React Native)
- 🐧 Linux / macOS polish

---

## 📋 Requirements

| Requirement | Minimum |
|-------------|---------|
| OS | Windows 10 x64 or newer |
| RAM | 4 GB (8 GB recommended) |
| Storage | 200 MB (+ model size for Ollama) |
| Internet | Required for cloud AI providers |

> For local AI with Ollama: 8 GB RAM recommended for 7B models, 16 GB for 14B models.

---

## ❓ FAQ

**Q: Do I need an API key?**
A: You need one for cloud providers (Anthropic, OpenAI, Gemini). For local AI via Ollama, no key is needed at all.

**Q: Is there a free option?**
A: Yes — install Ollama and download a local model. It's completely free and runs offline.

**Q: Where are my settings stored?**
A: `%APPDATA%\zeus-ai\zeus-settings.json` — you can back this up or transfer it to another machine.

**Q: Can Zeus access the internet?**
A: Yes — it has `web_search` (DuckDuckGo), `get_weather` (wttr.in), and `http_request` (any URL). You control what it does.

**Q: Is Zeus open source?**
A: Yes, licensed under MIT. Use it, fork it, build on it.

---

## 📄 License

MIT License — see [LICENSE](LICENSE) for details.

---

<div align="center">

**Built with ⚡ — Inspired by JARVIS**

*If Zeus helped you, give it a ⭐ on GitHub!*

</div>
