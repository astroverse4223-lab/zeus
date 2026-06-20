import React, { useEffect, useRef, useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { v4 as uuid } from 'uuid';
import useStore from './store/useStore.js';
import { applyTheme } from './themes.js';
import HUD, { FAST_MODELS } from './components/HUD.jsx';
import Sidebar from './components/Sidebar.jsx';
import ChatWindow from './components/ChatWindow.jsx';
import Settings from './components/Settings.jsx';
import AgentLauncher from './components/AgentLauncher.jsx';
import CodeEditor from './components/CodeEditor.jsx';
import Notepad from './components/Notepad.jsx';
import ModelCompare from './components/ModelCompare.jsx';
import ImageEditor from './components/ImageEditor.jsx';
import ImageGen from './components/ImageGen.jsx';
import BootSequence from './components/BootSequence.jsx';
import useWakeWord from './hooks/useWakeWord.js';
import { speak, stopSpeaking } from './lib/speech.js';
import { playSfx } from './lib/sfx.js';

export default function App() {
  const {
    settings, setSettings,
    settingsOpen,
    editorOpen, setEditorOpen,
    notepadOpen, setNotepadOpen,
    compareOpen, setCompareOpen,
    imageEditorOpen, setImageEditorOpen,
    imageGenOpen, setImageGenOpen,
    sidebarOpen,
    activeId, getActive,
    newConversation,
    addMessage, updateMessage,
    streaming, setStreaming, streamingMsgId,
    wakeWordEnabled,
  } = useStore();

  const unsubRef = useRef(null);
  const streamIdRef = useRef(null);
  const handleSendRef = useRef(null);
  const streamTextRef = useRef(''); // accumulates streamed reply text without re-scanning the store per chunk

  const [agentLauncherOpen, setAgentLauncherOpen] = useState(false);
  const [booting, setBooting] = useState(true);

  // Load settings on mount — window.zeus only exists inside Electron
  useEffect(() => {
    if (window.zeus) {
      window.zeus.getSettings().then(s => {
        setSettings(s);
        if (s?.theme) applyTheme(s.theme);
      });
    }
  }, []);

  // Live-apply theme whenever it changes (e.g. from Settings picker)
  useEffect(() => {
    if (settings?.theme) applyTheme(settings.theme);
  }, [settings?.theme]);

  // Apply UI settings to CSS
  useEffect(() => {
    const root = document.documentElement;
    const ui = settings?.ui || {};

    // Font size
    const fontSizes = { small: '12px', medium: '14px', large: '16px', xl: '18px' };
    root.style.setProperty('--c-chat-font', fontSizes[ui.fontSize] || '14px');

    // Message density padding
    const densities = { compact: '8px 12px', comfortable: '12px 16px', spacious: '18px 20px' };
    root.style.setProperty('--c-msg-padding', densities[ui.messageDensity] || '12px 16px');

    // Animation speed — drives both short UI transitions and the
    // continuous background-pattern drift.
    const speed = ui.animationSpeed || 'normal';
    const speeds = { fast: '0.1s', normal: '0.25s', slow: '0.5s', off: '0s' };
    root.style.setProperty('--c-anim-speed', speeds[speed] || '0.25s');

    // Background drift: longer durations so the pattern glides rather than
    // snaps. "off" parks the animation at frame 0 (static, like before).
    const bgSpeeds = { fast: '14s', normal: '34s', slow: '70s', off: '34s' };
    root.style.setProperty('--c-bg-anim-speed', bgSpeeds[speed] || '34s');
    root.style.setProperty('--c-bg-anim-play', speed === 'off' ? 'paused' : 'running');

    // Background pattern
    const pat = ui.backgroundPattern || 'grid';
    root.setAttribute('data-pattern', pat);
  }, [settings?.ui]);

  // Global drag-drop → add dropped files/folders to the knowledge base
  useEffect(() => {
    const onDragOver = (e) => { e.preventDefault(); };
    const onDrop = (e) => {
      e.preventDefault();
      const paths = Array.from(e.dataTransfer?.files || []).map((f) => f.path).filter(Boolean);
      if (paths.length && window.zeus?.kbAdd) window.zeus.kbAdd(paths);
    };
    window.addEventListener('dragover', onDragOver);
    window.addEventListener('drop', onDrop);
    return () => {
      window.removeEventListener('dragover', onDragOver);
      window.removeEventListener('drop', onDrop);
    };
  }, []);

  // Send a message to the AI
  const handleSend = useCallback(async (text, imageBase64 = null, agentMode = false, agentDir = '') => {
    if (!text.trim() || streaming) return;

    // Stop any in-progress speech the moment the user sends something new
    stopSpeaking();
    useStore.getState().setSpeaking(false, null);
    playSfx('send');

    const s = useStore.getState().settings;
    const { fastMode } = useStore.getState();
    const provider = s?.activeProvider || 'anthropic';
    const providerCfg = s?.providers?.[provider] || {};
    const apiKey  = providerCfg.apiKey  || '';
    const baseURL = providerCfg.baseURL || '';
    // In fast mode, override the model with the fastest option for the active provider
    const model = fastMode ? (FAST_MODELS[provider] || providerCfg.model || '') : (providerCfg.model || '');

    // Ollama is local — no API key needed
    if (!apiKey && provider !== 'ollama') {
      alert(`⚡ ZEUS: No API key set for ${provider}. Open Settings to add one.`);
      useStore.getState().setSettingsOpen(true);
      return;
    }

    // Ensure there's an active conversation
    let convId = useStore.getState().activeId;
    if (!convId) convId = useStore.getState().newConversation();

    // Add user message
    const userMsg = {
      id: uuid(),
      role: 'user',
      content: text,
      timestamp: new Date().toISOString(),
    };
    addMessage(convId, userMsg);

    // Add placeholder AI message
    const aiMsgId = uuid();
    const aiMsg = {
      id: aiMsgId,
      role: 'assistant',
      content: '',
      timestamp: new Date().toISOString(),
      model,
      provider,
      toolActivities: [],
      screenshot: null,
      isStreaming: true,
    };
    addMessage(convId, aiMsg);
    setStreaming(true, aiMsgId);

    // Build history for API (trim to maxContextMessages to control cost/context)
    const conv = useStore.getState().getActive();
    const maxCtx = useStore.getState().settings?.chat?.maxContextMessages || 20;
    const allFiltered = (conv?.messages || [])
      .filter(m => m.id !== aiMsgId && !m.isStreaming);

    // If this is an agent conversation, ensure the activation message is always included
    // even if the history window is too small to reach it — otherwise the backend loses
    // agent mode detection and switches to wrong tools/system prompt mid-task.
    const agentMsgIdx = allFiltered.findIndex(m =>
      m.role === 'user' && typeof m.content === 'string' &&
      m.content.includes('[ZEUS CODING AGENT — ACTIVATED]')
    );
    // Carry tool calls/results so the backend can replay them as real tool turns —
    // otherwise the model loses track that a tool already ran and may repeat it
    // on the next message (e.g. when you just say "thanks").
    const toHist = (m) => (
      m.role === 'assistant' && m.toolActivities?.length
        ? { role: m.role, content: m.content || '', toolActivities: m.toolActivities }
        : { role: m.role, content: m.content || '' }
    );
    let history;
    if (agentMsgIdx >= 0 && allFiltered.length - agentMsgIdx > maxCtx) {
      const recent = allFiltered.slice(-(maxCtx - 1));
      history = [allFiltered[agentMsgIdx], ...recent].map(toHist);
    } else {
      history = allFiltered.slice(-maxCtx).map(toHist);
    }

    const streamId = uuid();
    streamIdRef.current = streamId;
    streamTextRef.current = '';

    if (!window.zeus) {
      updateMessage(convId, aiMsgId, {
        content: '⚠ Zeus is not running inside Electron. Launch with `npm run dev`.',
        isStreaming: false,
      });
      setStreaming(false, null);
      return;
    }

    // Subscribe to stream chunks
    if (unsubRef.current) unsubRef.current();
    unsubRef.current = window.zeus.onChunk((chunk) => {
      if (chunk.streamId !== streamId) return;

      if (chunk.type === 'text') {
        streamTextRef.current += chunk.text;
        updateMessage(convId, aiMsgId, { content: streamTextRef.current });
      }

      if (chunk.type === 'replace') {
        streamTextRef.current = chunk.text;
        updateMessage(convId, aiMsgId, { content: chunk.text });
      }

      if (chunk.type === 'tool_start') {
        playSfx('tool');
        updateMessage(convId, aiMsgId, {
          toolActivities: [
            ...(useStore.getState().conversations
              .find(c => c.id === convId)?.messages
              .find(m => m.id === aiMsgId)?.toolActivities || []),
            { id: uuid(), tool: chunk.tool, status: 'running', input: null, result: null },
          ],
        });
      }

      if (chunk.type === 'tool_exec') {
        const msgs = useStore.getState().conversations.find(c => c.id === convId)?.messages || [];
        const aiM = msgs.find(m => m.id === aiMsgId);
        if (!aiM) return;
        const acts = [...(aiM.toolActivities || [])];
        const idx = acts.findLastIndex(a => a.tool === chunk.tool && a.status === 'running');
        if (idx >= 0) acts[idx] = { ...acts[idx], input: chunk.input };
        updateMessage(convId, aiMsgId, { toolActivities: acts });
      }

      if (chunk.type === 'tool_result') {
        const msgs = useStore.getState().conversations.find(c => c.id === convId)?.messages || [];
        const aiM = msgs.find(m => m.id === aiMsgId);
        if (!aiM) return;
        const acts = [...(aiM.toolActivities || [])];
        const idx = acts.findLastIndex(a => a.tool === chunk.tool && a.status === 'running');
        // Drop heavy screenshot base64 — it's shown via the dedicated `screenshot` chunk
        // and stored on message.screenshot, so keeping it here just bloats persisted storage.
        let result = chunk.result;
        if (result && typeof result === 'object' && result.dataUrl) {
          const { dataUrl, ...rest } = result;
          result = rest;
        }
        if (idx >= 0) acts[idx] = { ...acts[idx], status: 'done', result };
        updateMessage(convId, aiMsgId, { toolActivities: acts });
      }

      if (chunk.type === 'screenshot') {
        updateMessage(convId, aiMsgId, { screenshot: chunk.dataUrl });
      }

      if (chunk.type === 'error') {
        playSfx('error');
        updateMessage(convId, aiMsgId, {
          content: `⚠ Error: ${chunk.error}`,
          isStreaming: false,
        });
        setStreaming(false, null);
      }

      if (chunk.type === 'done') {
        streamIdRef.current = null;
        updateMessage(convId, aiMsgId, { isStreaming: false });
        setStreaming(false, null);
        useStore.getState().setConvMeta(convId, { provider, model });

        const st = useStore.getState();
        const conv = st.conversations.find(c => c.id === convId);
        const content = conv?.messages.find(m => m.id === aiMsgId)?.content || '';
        if (content.trim()) playSfx('receive');

        // Read the reply aloud if auto-speak is enabled
        const voice = st.settings?.voice;
        if (voice?.autoSpeak && content.trim()) {
          st.setSpeaking(true, aiMsgId);
          speak(content, { rate: voice.rate, pitch: voice.pitch }, {
            onEnd: () => useStore.getState().setSpeaking(false, null),
          });
        }

        // Auto-name the conversation from its first exchange (one-time, via a cheap model call)
        if (conv && !conv.autoTitled && window.zeus?.generateTitle) {
          const userMsg = conv.messages.find(m => m.role === 'user');
          if (userMsg && content.trim()) {
            const sNow = st.settings;
            const prov = sNow?.activeProvider || 'anthropic';
            const cfg = sNow?.providers?.[prov] || {};
            window.zeus.generateTitle({
              provider: prov,
              model: FAST_MODELS[prov] || cfg.model || '',
              apiKey: cfg.apiKey || '',
              baseURL: cfg.baseURL || '',
              prompt: `User: ${String(userMsg.content).slice(0, 300)}\nAssistant: ${content.slice(0, 300)}`,
            }).then(title => {
              const clean = (title || '').replace(/^["']|["']$/g, '').trim();
              useStore.getState().setConvMeta(convId, clean ? { title: clean.slice(0, 60), autoTitled: true } : { autoTitled: true });
            }).catch(() => {});
          }
        }
      }
    });

    // Fire the request
    try {
      await window.zeus?.sendMessage({
        streamId,
        messages: history,
        provider,
        model,
        apiKey,
        baseURL,
        imageBase64: imageBase64 || undefined,
        agentMode: !!agentMode, // explicit boolean — backend trusts the UI's sticky toggle
        agentDir: agentDir || undefined,
      });
    } catch (err) {
      updateMessage(convId, aiMsgId, {
        content: `⚠ Failed to connect: ${err.message}`,
        isStreaming: false,
      });
      setStreaming(false, null);
    }
  }, [streaming, addMessage, updateMessage, setStreaming]);

  // Keep handleSendRef current so wake word + mini-HUD can call it
  useEffect(() => { handleSendRef.current = handleSend; }, [handleSend]);

  // Wake word — "Hey Zeus" activates voice or focuses window
  useWakeWord({
    enabled: wakeWordEnabled,
    onWake: () => {
      document.querySelector('textarea')?.focus();
      if (!streaming) window.focus?.();
    },
  });

  // Messages typed in the floating mini-HUD get forwarded here
  useEffect(() => {
    if (!window.zeus?.onMiniMessage) return;
    const unsub = window.zeus.onMiniMessage((text) => {
      handleSendRef.current?.(text);
    });
    return unsub;
  }, []);

  // File changes (agent writes/patches/deletes) get attached to the active reply so
  // MessageBubble can show diffs + an undo button per file.
  useEffect(() => {
    if (!window.zeus?.onFileChange) return;
    const unsub = window.zeus.onFileChange((fc) => {
      const st = useStore.getState();
      const convId = st.activeId;
      const msgId = st.streamingMsgId;
      if (!convId || !msgId) return;
      const msg = st.conversations.find(c => c.id === convId)?.messages.find(m => m.id === msgId);
      if (!msg) return;
      st.updateMessage(convId, msgId, { fileChanges: [...(msg.fileChanges || []), fc] });
    });
    return unsub;
  }, []);

  const handleStop = useCallback(() => {
    if (streamIdRef.current) {
      window.zeus?.cancelStream(streamIdRef.current);
      streamIdRef.current = null;
    }
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
    stopSpeaking();
    const state = useStore.getState();
    if (state.streamingMsgId && state.activeId) {
      state.updateMessage(state.activeId, state.streamingMsgId, { isStreaming: false });
    }
    state.setSpeaking(false, null);
    setStreaming(false, null);
  }, [setStreaming]);

  const handleAgentLaunch = useCallback((agentPrompt) => {
    // Always start a fresh conversation — mixing agent tasks with old chat history
    // confuses the model and breaks agent-mode detection.
    const dir = useStore.getState().agentDir;
    useStore.getState().newConversation();
    setTimeout(() => handleSend(agentPrompt, null, true, dir), 50);
  }, [handleSend]);

  return (
    <div className="flex flex-col w-full h-full zeus-bg overflow-hidden">
      <AnimatePresence>
        {booting && <BootSequence key="boot" onDone={() => setBooting(false)} />}
      </AnimatePresence>

      <HUD />

      <div className="flex flex-1 overflow-hidden">
        <AnimatePresence initial={false}>
          {sidebarOpen && (
            <motion.div
              key="sidebar"
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 260, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: 'easeInOut' }}
              className="overflow-hidden flex-shrink-0"
            >
              <Sidebar />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 flex flex-col overflow-hidden relative">
          <ChatWindow onSend={handleSend} onStop={handleStop} onOpenAgent={() => setAgentLauncherOpen(true)} />
        </div>
      </div>

      {/* Coding Agent launcher modal */}
      <AnimatePresence>
        {agentLauncherOpen && (
          <AgentLauncher
            key="agent-launcher"
            onClose={() => setAgentLauncherOpen(false)}
            onLaunch={({ directory, prompt }) => {
              setAgentLauncherOpen(false);
              // Bind the UI to this directory and turn the sticky agent toggle ON so
              // every following message keeps working on the same project.
              useStore.getState().setAgentDir(directory);
              useStore.getState().setAgentMode(true);
              if (prompt) handleAgentLaunch(prompt);
            }}
          />
        )}
      </AnimatePresence>

      {/* Code editor — full-screen overlay */}
      <AnimatePresence>
        {editorOpen && <CodeEditor key="code-editor" onClose={() => setEditorOpen(false)} />}
      </AnimatePresence>

      {/* Notepad — full-screen overlay */}
      <AnimatePresence>
        {notepadOpen && <Notepad key="notepad" onClose={() => setNotepadOpen(false)} />}
      </AnimatePresence>

      {/* Model compare — full-screen overlay */}
      <AnimatePresence>
        {compareOpen && <ModelCompare key="model-compare" onClose={() => setCompareOpen(false)} />}
      </AnimatePresence>

      {/* Image editor — full-screen overlay */}
      <AnimatePresence>
        {imageEditorOpen && <ImageEditor key="image-editor" onClose={() => setImageEditorOpen(false)} />}
      </AnimatePresence>

      {/* Image generator — full-screen overlay */}
      <AnimatePresence>
        {imageGenOpen && <ImageGen key="image-gen" onClose={() => setImageGenOpen(false)} />}
      </AnimatePresence>

      <AnimatePresence>
        {settingsOpen && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0, pointerEvents: 'auto' }}
            exit={{ opacity: 0, x: 40, pointerEvents: 'none' }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="absolute inset-y-0 right-0 w-[480px] z-50 settings-panel"
          >
            <Settings />
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
