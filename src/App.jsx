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
import useWakeWord from './hooks/useWakeWord.js';

export default function App() {
  const {
    settings, setSettings,
    settingsOpen,
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

  const [agentLauncherOpen, setAgentLauncherOpen] = useState(false);

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

    // Animation speed
    const speeds = { fast: '0.1s', normal: '0.25s', slow: '0.5s', off: '0s' };
    root.style.setProperty('--c-anim-speed', speeds[ui.animationSpeed] || '0.25s');

    // Background pattern
    const pat = ui.backgroundPattern || 'grid';
    root.setAttribute('data-pattern', pat);
  }, [settings?.ui]);

  // Send a message to the AI
  const handleSend = useCallback(async (text, imageBase64 = null, agentMode = false) => {
    if (!text.trim() || streaming) return;

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
    let history;
    if (agentMsgIdx >= 0 && allFiltered.length - agentMsgIdx > maxCtx) {
      const recent = allFiltered.slice(-(maxCtx - 1));
      history = [allFiltered[agentMsgIdx], ...recent]
        .map(m => ({ role: m.role, content: m.content || '' }));
    } else {
      history = allFiltered.slice(-maxCtx)
        .map(m => ({ role: m.role, content: m.content || '' }));
    }

    const streamId = uuid();
    streamIdRef.current = streamId;

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
        updateMessage(convId, aiMsgId, {
          content: (useStore.getState().conversations
            .find(c => c.id === convId)?.messages
            .find(m => m.id === aiMsgId)?.content || '') + chunk.text,
        });
      }

      if (chunk.type === 'replace') {
        updateMessage(convId, aiMsgId, { content: chunk.text });
      }

      if (chunk.type === 'tool_start') {
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
        agentMode: agentMode || undefined,
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

  const handleStop = useCallback(() => {
    if (streamIdRef.current) {
      window.zeus?.cancelStream(streamIdRef.current);
      streamIdRef.current = null;
    }
    if (unsubRef.current) { unsubRef.current(); unsubRef.current = null; }
    const state = useStore.getState();
    if (state.streamingMsgId && state.activeId) {
      state.updateMessage(state.activeId, state.streamingMsgId, { isStreaming: false });
    }
    setStreaming(false, null);
  }, [setStreaming]);

  const handleAgentLaunch = useCallback((agentPrompt) => {
    // Always start a fresh conversation — mixing agent tasks with old chat history
    // confuses the model and breaks agent-mode detection.
    useStore.getState().newConversation();
    setTimeout(() => handleSend(agentPrompt, null, true), 50);
  }, [handleSend]);

  return (
    <div className="flex flex-col w-full h-full zeus-bg overflow-hidden">
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
            onLaunch={(prompt) => { setAgentLauncherOpen(false); handleAgentLaunch(prompt); }}
          />
        )}
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
