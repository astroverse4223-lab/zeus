import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useStore from '../store/useStore.js';

const PROVIDER_LABELS = { anthropic: 'CLAUDE', openai: 'GPT', gemini: 'GEMINI', ollama: 'OLLAMA' };

function ConvItem({ conv, active, onSelect, onDelete }) {
  const [hovered, setHovered] = useState(false);
  const timeStr = new Date(conv.updatedAt || conv.createdAt).toLocaleDateString([], {
    month: 'short', day: 'numeric',
  });

  return (
    <div
      className={`sidebar-item px-3 py-2.5 ${active ? 'active' : ''}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => onSelect(conv.id)}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium truncate" style={{ color: active ? 'var(--c-text)' : 'var(--c-dim)' }}>
            {conv.title}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <span style={{ color: 'var(--c-muted)', fontSize: '10px' }}>
              {conv.messages.length} msg{conv.messages.length !== 1 ? 's' : ''}
            </span>
            {conv.provider && (
              <span className={`provider-badge provider-${conv.provider}`} style={{ fontSize: '8px', padding: '1px 4px' }}>
                {PROVIDER_LABELS[conv.provider] || conv.provider}
              </span>
            )}
            <span style={{ color: 'var(--c-muted)', fontSize: '10px', marginLeft: 'auto' }}>{timeStr}</span>
          </div>
        </div>
        <AnimatePresence>
          {hovered && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              className="btn-icon w-5 h-5 flex-shrink-0"
              style={{ color: 'var(--c-muted)', fontSize: '12px' }}
              onClick={e => { e.stopPropagation(); onDelete(conv.id); }}
              title="Delete"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

export default function Sidebar() {
  const {
    conversations, activeId,
    newConversation, selectConversation, deleteConversation,
    streaming,
  } = useStore();

  const [search, setSearch] = useState('');

  const filtered = conversations.filter(c =>
    c.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div
      className="flex flex-col h-full border-r"
      style={{ background: 'var(--c-surface)', borderColor: 'var(--c-border)', width: '260px' }}
    >
      {/* Header */}
      <div className="p-3 border-b flex flex-col gap-2" style={{ borderColor: 'var(--c-border)' }}>
        <button
          className="w-full btn-primary rounded-lg py-2 text-sm font-orbitron tracking-wider flex items-center justify-center gap-2"
          style={{ fontSize: '11px' }}
          onClick={() => newConversation()}
          disabled={streaming}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          NEW CONVERSATION
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b" style={{ borderColor: 'var(--c-border)' }}>
        <div className="flex items-center gap-2 rounded-lg px-2.5 py-1.5" style={{ background: 'var(--c-card)', border: '1px solid var(--c-border)' }}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--c-muted)', flexShrink: 0 }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>
          <input
            className="flex-1 text-xs bg-transparent outline-none"
            placeholder="Search conversations..."
            style={{ color: 'var(--c-text)', fontFamily: 'Inter, sans-serif' }}
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Conversation list */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-2">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"
              style={{ color: 'var(--c-muted)' }}>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <span style={{ color: 'var(--c-muted)', fontSize: '12px' }}>
              {search ? 'No matches' : 'No conversations yet'}
            </span>
          </div>
        ) : (
          filtered.map(conv => (
            <ConvItem
              key={conv.id}
              conv={conv}
              active={conv.id === activeId}
              onSelect={selectConversation}
              onDelete={deleteConversation}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="p-3 border-t" style={{ borderColor: 'var(--c-border)' }}>
        <div className="flex items-center gap-2">
          <div className="status-dot online" />
          <span style={{ color: 'var(--c-muted)', fontSize: '10px', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.1em' }}>
            ZEUS ONLINE
          </span>
          <span style={{ color: 'var(--c-muted)', fontSize: '10px', marginLeft: 'auto' }}>
            {conversations.length} conv{conversations.length !== 1 ? 's' : ''}
          </span>
        </div>
      </div>
    </div>
  );
}
