import React, { useEffect, useRef, useCallback, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { v4 as uuid } from 'uuid';
import useStore from './store/useStore.js';
import { applyTheme } from './themes.js';
import HUD from './components/HUD.jsx';
import Sidebar from './components/Sidebar.jsx';
import ChatWindow from './components/ChatWindow.jsx';
import Settings from './components/Settings.jsx';
import AgentLauncher from './components/AgentLauncher.jsx';

export default function App() {
  const {
    settings, setSettings,
    settingsOpen,
    sidebarOpen,
    activeId, getActive,
    newConversation,
    addMessage, updateMessage,
    streaming, setStreaming, streamingMsgId,
  } = useStore();

  const [agentOpen, setAgentOpen] = useState(false);
  const unsubRef = useRef(null);
  const streamIdRef = useRef(null);

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
  const handleSend = useCallback(async (text) => {
    if (!text.trim() || streaming) return;

    const s = useStore.getState().settings;
    const provider = s?.activeProvider || 'anthropic';
    const providerCfg = s?.providers?.[provider] || {};
    const apiKey  = providerCfg.apiKey  || '';
    const model   = providerCfg.model   || '';
    const baseURL = providerCfg.baseURL || '';

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
    const history = (conv?.messages || [])
      .filter(m => m.id !== aiMsgId && !m.isStreaming)
      .slice(-maxCtx)
      .map(m => ({ role: m.role, content: m.content || '' }));

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
        if (idx >= 0) acts[idx] = { ...acts[idx], status: 'done', result: chunk.result };
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
      });
    } catch (err) {
      updateMessage(convId, aiMsgId, {
        content: `⚠ Failed to connect: ${err.message}`,
        isStreaming: false,
      });
      setStreaming(false, null);
    }
  }, [streaming, addMessage, updateMessage, setStreaming]);

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
    setAgentOpen(false);
    const state = useStore.getState();
    const hasMessages = (state.getActive()?.messages?.length || 0) > 0;
    // Only start a fresh conversation when there isn't already one in progress
    if (!state.activeId || !hasMessages) {
      state.newConversation();
    }
    setTimeout(() => handleSend(agentPrompt), 50);
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
              <Sidebar onOpenAgent={() => setAgentOpen(true)} />
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex-1 flex flex-col overflow-hidden relative">
          <ChatWindow onSend={handleSend} onStop={handleStop} onOpenAgent={() => setAgentOpen(true)} onAgent={handleAgentLaunch} />
        </div>
      </div>

      <AnimatePresence>
        {settingsOpen && (
          <motion.div
            key="settings"
            initial={{ opacity: 0, x: 40 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 40 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="absolute inset-y-0 right-0 w-[480px] z-50 settings-panel"
          >
            <Settings />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {agentOpen && (
          <AgentLauncher
            key="agent-launcher"
            onLaunch={handleAgentLaunch}
            onClose={() => setAgentOpen(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
