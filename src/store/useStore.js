import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuid } from 'uuid';

const useStore = create(
  persist(
    (set, get) => ({
      // ── Conversations ────────────────────────────────────────────────────────
      conversations: [],
      activeId: null,

      getActive() {
        const { conversations, activeId } = get();
        return conversations.find(c => c.id === activeId) || null;
      },

      newConversation() {
        const id = uuid();
        const conv = {
          id,
          title: 'New Conversation',
          messages: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          provider: null,
          model: null,
        };
        set(s => ({ conversations: [conv, ...s.conversations], activeId: id }));
        return id;
      },

      selectConversation(id) {
        set({ activeId: id });
      },

      deleteConversation(id) {
        set(s => {
          const filtered = s.conversations.filter(c => c.id !== id);
          return {
            conversations: filtered,
            activeId: s.activeId === id ? (filtered[0]?.id || null) : s.activeId,
          };
        });
      },

      clearAllConversations() {
        set({ conversations: [], activeId: null });
      },

      addMessage(convId, msg) {
        set(s => ({
          conversations: s.conversations.map(c => {
            if (c.id !== convId) return c;
            const messages = [...c.messages, msg];
            const title =
              c.messages.length === 0 && msg.role === 'user'
                ? msg.content.slice(0, 52) + (msg.content.length > 52 ? '…' : '')
                : c.title;
            return { ...c, messages, title, updatedAt: new Date().toISOString() };
          }),
        }));
      },

      updateMessage(convId, msgId, patch) {
        set(s => ({
          conversations: s.conversations.map(c =>
            c.id !== convId
              ? c
              : { ...c, messages: c.messages.map(m => m.id === msgId ? { ...m, ...patch } : m) }
          ),
        }));
      },

      setConvMeta(convId, meta) {
        set(s => ({
          conversations: s.conversations.map(c => c.id !== convId ? c : { ...c, ...meta }),
        }));
      },

      // ── Settings ─────────────────────────────────────────────────────────────
      settings: null,

      setSettings(settings) { set({ settings }); },

      updateSettings(patch) {
        set(s => ({ settings: s.settings ? { ...s.settings, ...patch } : patch }));
      },

      // ── UI ───────────────────────────────────────────────────────────────────
      settingsOpen: false,
      setSettingsOpen(v) { set({ settingsOpen: v }); },

      sidebarOpen: true,
      setSidebarOpen(v) { set({ sidebarOpen: v }); },

      fastMode: false,
      setFastMode(v) { set({ fastMode: v }); },

      wakeWordEnabled: false,
      setWakeWordEnabled(v) { set({ wakeWordEnabled: v }); },

      // ── Agent mode (sticky, like VSCode's chat/agent switch) ───────────────────
      // When agentMode is on, every message is sent as a coding-agent task bound to
      // agentDir, and it stays on until the user switches back to chat.
      agentMode: false,
      setAgentMode(v) { set({ agentMode: v }); },

      agentDir: '',
      setAgentDir(v) { set({ agentDir: v }); },

      // ── Streaming ────────────────────────────────────────────────────────────
      streaming: false,
      streamingMsgId: null,
      setStreaming(v, msgId = null) { set({ streaming: v, streamingMsgId: msgId }); },

      // ── Voice output (Zeus speaking) ───────────────────────────────────────────
      speaking: false,
      speakingMsgId: null,
      setSpeaking(v, msgId = null) { set({ speaking: v, speakingMsgId: msgId }); },

      // ── Composer (lifted so drag-and-drop can land anywhere in the window) ──────
      draft: '',
      setDraft(v) { set({ draft: typeof v === 'function' ? v(get().draft) : v }); },
      pendingImage: null,
      setPendingImage(v) { set({ pendingImage: v }); },

      // ── UI sound effects ───────────────────────────────────────────────────────
      soundEnabled: true,
      setSoundEnabled(v) { set({ soundEnabled: v }); },
    }),
    {
      name: 'zeus-store-v1',
      partialize: s => ({
        conversations: s.conversations,
        sidebarOpen: s.sidebarOpen,
        agentDir: s.agentDir,
        soundEnabled: s.soundEnabled,
      }),
    }
  )
);

export default useStore;
