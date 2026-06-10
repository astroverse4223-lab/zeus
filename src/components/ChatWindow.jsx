import React, { useEffect, useRef, useState, useCallback } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import useStore from '../store/useStore.js';
import MessageBubble from './MessageBubble.jsx';
import InputBar from './InputBar.jsx';
import Terminal from './Terminal.jsx';
import Orb from './Orb.jsx';

const QUICK_ACTIONS = [
  { label: 'System Info',    icon: '🖥', prompt: 'Get my full system information — CPU, RAM, disk, and OS details.' },
  { label: 'Take Screenshot', icon: '📸', prompt: 'Take a screenshot of my screen right now.' },
  { label: 'Open Files',     icon: '📁', prompt: 'List the files in my home directory.' },
  { label: 'Top Processes',  icon: '⚡', prompt: 'Show me the top running processes by CPU usage.' },
  { label: 'Open Browser',   icon: '🌐', prompt: 'Open my default web browser.' },
  { label: 'Clipboard',      icon: '📋', prompt: 'What is currently in my clipboard?' },
];

function WelcomeScreen({ onSend }) {
  const { streaming } = useStore();
  return (
    <div className="flex flex-col items-center justify-center h-full px-8 hex-bg">
      {/* Orb + Logo */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="flex flex-col items-center mb-8"
      >
        <div className="mb-3">
          <Orb size={110} active={streaming} />
        </div>

        <h1
          className="font-orbitron font-bold tracking-[0.3em] glow-text mb-2"
          style={{ color: 'var(--c-accent)', fontSize: '32px' }}
        >
          ZEUS
        </h1>
        <p style={{ color: 'var(--c-muted)', fontSize: '12px', letterSpacing: '0.2em', fontFamily: 'Orbitron, sans-serif' }}>
          AI COMPUTER ASSISTANT
        </p>
      </motion.div>

      {/* Subtitle */}
      <motion.p
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        style={{ color: 'var(--c-dim)', fontSize: '14px', marginBottom: '32px', textAlign: 'center', maxWidth: '420px' }}
      >
        I can control your PC, browse the web, manage files, run commands, and answer any question. What shall we do today?
      </motion.p>

      {/* Quick actions */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35 }}
        className="grid grid-cols-3 gap-2 w-full max-w-lg"
      >
        {QUICK_ACTIONS.map((action, i) => (
          <motion.button
            key={action.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 + i * 0.05 }}
            className="flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl cursor-pointer transition-all"
            style={{
              background: 'var(--c-card)',
              border: '1px solid var(--c-border)',
              fontSize: '12px', color: 'var(--c-dim)',
            }}
            onClick={() => onSend(action.prompt)}
            onMouseEnter={e => {
              e.currentTarget.style.borderColor = 'var(--c-accent)';
              e.currentTarget.style.color = 'var(--c-text)';
              e.currentTarget.style.boxShadow = '0 0 12px rgba(0,212,255,0.15)';
            }}
            onMouseLeave={e => {
              e.currentTarget.style.borderColor = 'var(--c-border)';
              e.currentTarget.style.color = 'var(--c-dim)';
              e.currentTarget.style.boxShadow = 'none';
            }}
          >
            <span style={{ fontSize: '20px' }}>{action.icon}</span>
            <span style={{ fontFamily: 'Orbitron, sans-serif', fontSize: '9px', letterSpacing: '0.1em' }}>
              {action.label.toUpperCase()}
            </span>
          </motion.button>
        ))}
      </motion.div>

    </div>
  );
}

export default function ChatWindow({ onSend, onStop, onAgent }) {
  const { getActive, streaming, streamingMsgId } = useStore();
  const conversation = getActive();
  const messages = conversation?.messages || [];
  const bottomRef = useRef(null);
  const scrollRef = useRef(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [terminalOpen, setTerminalOpen] = useState(false);

  // Auto-open terminal when Zeus uses a tool
  useEffect(() => {
    if (!window.zeus?.onTerminalLog) return;
    const unsub = window.zeus.onTerminalLog(() => setTerminalOpen(true));
    return unsub;
  }, []);

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    bottomRef.current?.scrollIntoView({ behavior });
  }, []);

  // Auto-scroll when streaming
  useEffect(() => {
    if (streaming) scrollToBottom();
  }, [messages, streaming]);

  // Scroll button visibility
  const handleScroll = () => {
    const el = scrollRef.current;
    if (!el) return;
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    setShowScrollBtn(distFromBottom > 200);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {messages.length === 0 ? (
        <div className="flex-1 overflow-hidden">
          <WelcomeScreen onSend={onSend} />
        </div>
      ) : (
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-6 py-4"
          onScroll={handleScroll}
          style={{ scrollBehavior: 'smooth' }}
        >
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                layout
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
              >
                <MessageBubble message={msg} />
              </motion.div>
            ))}
          </AnimatePresence>
          <div ref={bottomRef} className="h-2" />
        </div>
      )}

      {/* Jump to bottom button */}
      <AnimatePresence>
        {showScrollBtn && messages.length > 0 && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="absolute bottom-32 right-6 btn-ghost rounded-full p-2"
            style={{ border: '1px solid var(--c-border)', background: 'var(--c-card)', zIndex: 10 }}
            onClick={() => scrollToBottom()}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Separator */}
      {messages.length > 0 && (
        <div style={{ height: '1px', background: 'var(--c-border)', margin: '0 16px', flexShrink: 0 }} />
      )}

      {/* Embedded terminal panel */}
      <AnimatePresence>
        {terminalOpen && (
          <Terminal onClose={() => setTerminalOpen(false)} />
        )}
      </AnimatePresence>

      <InputBar onSend={onSend} onStop={onStop} onAgent={onAgent} terminalOpen={terminalOpen} onToggleTerminal={() => setTerminalOpen(v => !v)} />
    </div>
  );
}
