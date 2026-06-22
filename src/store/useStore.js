import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { v4 as uuid } from 'uuid';

// Debounced persistence. zustand's default storage serializes + writes the ENTIRE
// conversation array to localStorage on every state change — i.e. on every streamed
// token. With a long agent conversation that's a multi-MB synchronous JSON.stringify
// per token, which froze (and sometimes crashed) the renderer on big models. This
// custom PersistStorage defers both the stringify and the write to at most once per
// window, and flushes on page unload so nothing is lost.
const PERSIST_DEBOUNCE_MS = 600;
const debouncedStorage = (() => {
  let timer = null;
  let pendingName = null;
  let pendingValue = null;
  const write = () => {
    timer = null;
    if (pendingName == null) return;
    try { localStorage.setItem(pendingName, JSON.stringify(pendingValue)); } catch {}
    pendingName = null;
    pendingValue = null;
  };
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', write); // never lose the last change
  }
  return {
    getItem: (name) => {
      const str = localStorage.getItem(name);
      return str ? JSON.parse(str) : null;
    },
    setItem: (name, value) => {
      pendingName = name;
      pendingValue = value;
      if (!timer) timer = setTimeout(write, PERSIST_DEBOUNCE_MS);
    },
    removeItem: (name) => {
      if (timer) { clearTimeout(timer); timer = null; }
      pendingName = null;
      pendingValue = null;
      localStorage.removeItem(name);
    },
  };
})();

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

      editorOpen: false,
      setEditorOpen(v) { set({ editorOpen: v }); },

      compareOpen: false,
      setCompareOpen(v) { set({ compareOpen: v }); },

      imageEditorOpen: false,
      setImageEditorOpen(v) { set({ imageEditorOpen: v }); },
      imageEditorSource: null, // optional dataUrl to load instead of the file dialog
      setImageEditorSource(v) { set({ imageEditorSource: v }); },

      imageGenOpen: false,
      setImageGenOpen(v) { set({ imageGenOpen: v }); },

      videoGenOpen: false,
      setVideoGenOpen(v) { set({ videoGenOpen: v }); },

      contentFactoryOpen: false,
      setContentFactoryOpen(v) { set({ contentFactoryOpen: v }); },

      // One-shot handoff: Content Factory writes a generated prompt here, then opens
      // Image/Video Gen, which reads it once on mount and clears it.
      genPromptPrefill: null,
      setGenPromptPrefill(v) { set({ genPromptPrefill: v }); },

      // ── Floating panel registry ────────────────────────────────────────────────
      // Every panel (Image Gen, Notepad, Code Editor, etc.) renders inside a shared
      // FloatingPanel chrome. Minimized state lives here (not in the panel's own
      // local state) so a dock rendered elsewhere in the tree can restore it, and
      // z-index lives here so clicking any panel brings it in front of the others.
      floatingPanels: {}, // { [id]: { title, minimized, z } }
      _nextPanelZ: 100,
      registerFloatingPanel(id, title) {
        set(s => ({
          floatingPanels: { ...s.floatingPanels, [id]: { title, minimized: false, z: s._nextPanelZ } },
          _nextPanelZ: s._nextPanelZ + 1,
        }));
      },
      unregisterFloatingPanel(id) {
        set(s => {
          const next = { ...s.floatingPanels };
          delete next[id];
          return { floatingPanels: next };
        });
      },
      setPanelMinimized(id, v) {
        set(s => ({
          floatingPanels: { ...s.floatingPanels, [id]: { ...(s.floatingPanels[id] || {}), minimized: v } },
        }));
      },
      bringPanelToFront(id) {
        set(s => ({
          floatingPanels: { ...s.floatingPanels, [id]: { ...(s.floatingPanels[id] || {}), z: s._nextPanelZ } },
          _nextPanelZ: s._nextPanelZ + 1,
        }));
      },

      vaultOpen: false,
      setVaultOpen(v) { set({ vaultOpen: v }); },

      // ── Hidden Snake easter egg ───────────────────────────────────────────────
      snakeOpen: false,
      setSnakeOpen(v) { set({ snakeOpen: v }); },

      // ── Arcade ───────────────────────────────────────────────────────────────
      arcadeOpen: false,
      setArcadeOpen(v) { set({ arcadeOpen: v }); },

      // ── Notepad ────────────────────────────────────────────────────────────────
      notepadOpen: false,
      setNotepadOpen(v) { set({ notepadOpen: v }); },
      notes: [], // { id, title, body, updatedAt }
      addNote() {
        const note = { id: uuid(), title: 'Untitled', body: '', updatedAt: Date.now() };
        set(s => ({ notes: [note, ...s.notes] }));
        return note.id;
      },
      updateNote(id, patch) {
        set(s => ({ notes: s.notes.map(n => n.id === id ? { ...n, ...patch, updatedAt: Date.now() } : n) }));
      },
      deleteNote(id) {
        set(s => ({ notes: s.notes.filter(n => n.id !== id) }));
      },

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
      storage: debouncedStorage,
      partialize: s => ({
        conversations: s.conversations,
        sidebarOpen: s.sidebarOpen,
        agentDir: s.agentDir,
        soundEnabled: s.soundEnabled,
        notes: s.notes,
      }),
    }
  )
);

export default useStore;
