import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import ToolActivity from './ToolActivity.jsx';
import FileChanges from './FileChanges.jsx';
import useStore from '../store/useStore.js';
import { speak, stopSpeaking } from '../lib/speech.js';

const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };
  return (
    <button onClick={copy} className="btn-icon px-1.5 py-0.5 rounded text-xs" style={{ fontSize: '10px' }}>
      {copied ? '✓ Copied' : 'Copy'}
    </button>
  );
};

const CodeBlock = ({ language, children }) => {
  const code = String(children).replace(/\n$/, '');
  return (
    <div className="code-block my-2">
      <div className="code-block-header">
        <span>{language || 'code'}</span>
        <CopyButton text={code} />
      </div>
      <SyntaxHighlighter
        language={language || 'text'}
        style={vscDarkPlus}
        customStyle={{
          margin: 0, padding: '12px', background: '#080c14',
          fontSize: '12px', lineHeight: '1.6',
        }}
        codeTagProps={{ style: { fontFamily: '"JetBrains Mono", monospace' } }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
};

const mdComponents = {
  code({ node, inline, className, children, ...props }) {
    const match = /language-(\w+)/.exec(className || '');
    return !inline && match
      ? <CodeBlock language={match[1]}>{children}</CodeBlock>
      : <code className="md-content" style={{
          background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.15)',
          borderRadius: '4px', padding: '1px 5px',
          fontFamily: '"JetBrains Mono", monospace', fontSize: '0.88em', color: 'var(--c-accent)',
        }} {...props}>{children}</code>;
  },
  pre({ children }) { return <>{children}</>; },
  a({ href, children }) {
    return (
      <a href={href} style={{ color: 'var(--c-accent)', textDecoration: 'underline' }}
        onClick={e => { e.preventDefault(); if (href) window.zeus?.openExternal(href); }}>
        {children}
      </a>
    );
  },
};

const PROVIDER_LABELS = { anthropic: 'CLAUDE', openai: 'GPT-4o', gemini: 'GEMINI', ollama: 'OLLAMA' };

function parseAgentContent(content) {
  if (!content || !content.startsWith('[ZEUS CODING AGENT — ACTIVATED]')) return null;
  const taskMatch = content.match(/Task:\s*([\s\S]+?)(?:\nWorking Directory:|$)/);
  const dirMatch = content.match(/Working Directory:\s*(.+?)(?:\n|$)/);
  const langMatch = content.match(/Language\/Framework:\s*(.+?)(?:\n|$)/);
  return {
    task: taskMatch?.[1]?.trim() || '',
    directory: dirMatch?.[1]?.trim() || '',
    language: langMatch?.[1]?.trim() || null,
  };
}

const UserContent = ({ content }) => {
  const agentData = parseAgentContent(content);
  if (agentData) {
    return (
      <div>
        <div style={{ fontSize: '9px', fontFamily: 'Orbitron, sans-serif', color: 'var(--c-purple)', letterSpacing: '0.12em', marginBottom: 6, opacity: 0.85 }}>
          ⚡ AGENT TASK
        </div>
        <p style={{ color: 'var(--c-text)', fontSize: 'var(--c-chat-font)', lineHeight: '1.6', whiteSpace: 'pre-wrap', margin: 0 }}>
          {agentData.task}
        </p>
        {agentData.directory && (
          <p style={{ color: 'var(--c-muted)', fontSize: '10px', fontFamily: 'JetBrains Mono, monospace', marginTop: 6, marginBottom: 0 }}>
            📁 {agentData.directory}{agentData.language ? ` · ${agentData.language}` : ''}
          </p>
        )}
      </div>
    );
  }
  return (
    <p style={{ color: 'var(--c-text)', fontSize: 'var(--c-chat-font)', lineHeight: '1.6', whiteSpace: 'pre-wrap', margin: 0 }}>
      {content}
    </p>
  );
};

const TOOL_STATUS = {
  write_file:          'Writing file',
  read_file:           'Reading file',
  list_directory:      'Browsing directory',
  run_command:         'Running command',
  take_screenshot:     'Capturing screen',
  get_system_info:     'Reading system info',
  open_application:    'Opening application',
  get_clipboard:       'Reading clipboard',
  set_clipboard:       'Writing clipboard',
  delete_path:         'Deleting path',
  move_file:           'Moving file',
  create_directory:    'Creating directory',
  get_running_processes: 'Listing processes',
  get_environment_variables: 'Reading env vars',
  web_search:          'Searching the web',
  get_weather:         'Fetching weather',
  http_request:        'Calling API',
  send_notification:   'Sending notification',
  set_reminder:        'Setting reminder',
  get_datetime:        'Checking time',
  memory_store:        'Saving to memory',
  memory_recall:       'Recalling memory',
  memory_list:         'Listing memories',
  memory_delete:       'Deleting memory',
  get_directory_tree:  'Mapping project tree',
  find_files:          'Searching for files',
  search_in_files:     'Searching code',
  patch_file:          'Patching file',
};

function useElapsed(startIso, running) {
  const [elapsed, setElapsed] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    if (!running) { setElapsed(0); return; }
    const start = new Date(startIso).getTime();
    ref.current = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 250);
    return () => clearInterval(ref.current);
  }, [running, startIso]);
  return elapsed;
}

function ThinkingBar({ message }) {
  const elapsed = useElapsed(message.timestamp, message.isStreaming);

  // Find the current in-flight tool (last 'running' activity)
  const runningTool = message.toolActivities?.findLast?.(a => a.status === 'running')
    ?? [...(message.toolActivities || [])].reverse().find(a => a.status === 'running');

  const mins = Math.floor(elapsed / 60);
  const secs = elapsed % 60;
  const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;

  const statusLabel = runningTool
    ? (TOOL_STATUS[runningTool.tool] ?? runningTool.tool)
    : message.content
      ? 'Composing'
      : 'Thinking';

  return (
    <div
      className="flex items-center gap-2 mb-2 px-3 py-1.5 rounded-lg"
      style={{
        background: 'rgba(168,85,247,0.06)',
        border: '1px solid rgba(168,85,247,0.2)',
        minWidth: '160px',
      }}
    >
      {/* Pulsing dots */}
      <div className="flex items-center gap-0.5 flex-shrink-0">
        {[0, 1, 2].map(i => (
          <div
            key={i}
            style={{
              width: 4, height: 4, borderRadius: '50%',
              background: 'var(--c-purple)',
              animation: `blink 1.1s ${i * 0.18}s ease-in-out infinite`,
            }}
          />
        ))}
      </div>

      {/* Label */}
      <span style={{
        color: 'var(--c-purple)', fontSize: '10px',
        fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.08em',
        flex: 1,
      }}>
        {statusLabel.toUpperCase()}
      </span>

      {/* Timer */}
      <span style={{
        color: 'var(--c-muted)', fontSize: '10px',
        fontFamily: 'JetBrains Mono, monospace', flexShrink: 0,
      }}>
        {timeStr}
      </span>
    </div>
  );
}

function MessageBubble({ message }) {
  const isUser = message.role === 'user';
  const [msgCopied, setMsgCopied] = useState(false);
  const [finishedAt, setFinishedAt] = useState(null);

  // Subscribe to narrow slices (not the whole store) so a bubble only re-renders when
  // its own data changes — otherwise every bubble re-rendered on every streamed token.
  const speakingMsgId = useStore(s => s.speakingMsgId);
  const setSpeaking = useStore(s => s.setSpeaking);
  const settings = useStore(s => s.settings);
  const isThisSpeaking = speakingMsgId === message.id;
  const speakThis = () => {
    if (isThisSpeaking) { stopSpeaking(); setSpeaking(false, null); return; }
    const v = settings?.voice || {};
    setSpeaking(true, message.id);
    speak(message.content, { rate: v.rate, pitch: v.pitch }, {
      onEnd: () => useStore.getState().setSpeaking(false, null),
    });
  };

  // Capture the elapsed time the moment streaming ends
  const wasStreaming = useRef(false);
  useEffect(() => {
    if (wasStreaming.current && !message.isStreaming && message.timestamp) {
      setFinishedAt(Math.floor((Date.now() - new Date(message.timestamp).getTime()) / 1000));
    }
    wasStreaming.current = !!message.isStreaming;
  }, [message.isStreaming]);

  const copyMsg = () => {
    navigator.clipboard.writeText(message.content);
    setMsgCopied(true);
    setTimeout(() => setMsgCopied(false), 1500);
  };

  const timeStr = message.timestamp
    ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : '';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4 anim-fade-up`}>
      {/* Avatar — AI only */}
      {!isUser && (
        <div
          className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center mr-2 mt-1"
          style={{
            background: 'linear-gradient(135deg, #0066cc, #00d4ff)',
            boxShadow: '0 0 10px rgba(0,212,255,0.3)',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M13 2L4.5 13.5H11L10 22L20.5 10H14L13 2Z" fill="white" />
          </svg>
        </div>
      )}

      <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} max-w-[78%]`}>
        {/* Meta row */}
        <div className={`flex items-center gap-2 mb-1 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
          {isUser ? (
            <span style={{ color: 'var(--c-muted)', fontSize: '10px', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.05em' }}>
              YOU
            </span>
          ) : (
            <span style={{ color: 'var(--c-accent)', fontSize: '10px', fontFamily: 'Orbitron, sans-serif', letterSpacing: '0.05em' }}>
              ZEUS
            </span>
          )}
          {message.provider && !isUser && (
            <span className={`provider-badge provider-${message.provider}`} style={{ fontSize: '8px' }}>
              {PROVIDER_LABELS[message.provider] || message.provider}
            </span>
          )}
          <span style={{ color: 'var(--c-muted)', fontSize: '10px' }}>{timeStr}</span>
          {!isUser && finishedAt !== null && (
            <span style={{
              color: 'var(--c-muted)', fontSize: '9px',
              fontFamily: 'JetBrains Mono, monospace',
              background: 'var(--c-card)', border: '1px solid var(--c-border)',
              borderRadius: '4px', padding: '1px 5px',
            }}>
              {finishedAt < 60 ? `${finishedAt}s` : `${Math.floor(finishedAt/60)}m${finishedAt%60}s`}
            </span>
          )}
          {/* Read aloud */}
          {!isUser && message.content && !message.isStreaming && (
            <button
              onClick={speakThis}
              className="btn-icon"
              style={{ padding: '1px 4px', color: isThisSpeaking ? '#10de96' : 'var(--c-muted)' }}
              title={isThisSpeaking ? 'Stop speaking' : 'Read aloud'}
            >
              {isThisSpeaking ? (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><rect x="5" y="5" width="14" height="14" rx="2" /></svg>
              ) : (
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" /><path d="M15.5 8.5a5 5 0 0 1 0 7" />
                </svg>
              )}
            </button>
          )}
        </div>

        {/* Thinking bar — shows while streaming */}
        {!isUser && message.isStreaming && (
          <ThinkingBar message={message} />
        )}

        {/* Tool activities (AI messages only) */}
        {!isUser && message.toolActivities?.length > 0 && (
          <div className="w-full mb-1">
            <ToolActivity activities={message.toolActivities} />
          </div>
        )}

        {/* File changes with diffs + undo (agent edits) */}
        {!isUser && message.fileChanges?.length > 0 && (
          <div className="w-full mb-1">
            <FileChanges changes={message.fileChanges} />
          </div>
        )}

        {/* Screenshot */}
        {message.screenshot && (
          <div className="mb-2 rounded-lg overflow-hidden" style={{ border: '1px solid var(--c-border)', maxWidth: '100%' }}>
            <div className="code-block-header" style={{ padding: '4px 10px' }}>
              <span>Screenshot</span>
              <a
                href={message.screenshot}
                download="zeus-screenshot.png"
                style={{ color: 'var(--c-accent)', fontSize: '10px' }}
              >
                Save
              </a>
            </div>
            <img
              src={message.screenshot}
              alt="Screenshot"
              style={{ maxWidth: '100%', maxHeight: '300px', display: 'block' }}
            />
          </div>
        )}

        {/* Bubble */}
        {(message.content || message.isStreaming) && (
          <div
            className={`relative group ${isUser ? 'msg-user' : 'msg-assistant'} selectable`}
            style={{ minWidth: '60px', padding: 'var(--c-msg-padding)' }}
          >
            {isUser ? (
              <UserContent content={message.content} />
            ) : (
              <div className="md-content" style={{ fontSize: 'var(--c-chat-font)' }}>
                <ReactMarkdown remarkPlugins={[remarkGfm]} components={mdComponents}>
                  {message.content || ''}
                </ReactMarkdown>
              </div>
            )}

            {/* Streaming cursor */}
            {message.isStreaming && (
              <span
                className="inline-block ml-0.5 anim-blink"
                style={{
                  width: '2px', height: '14px', verticalAlign: 'middle',
                  background: 'var(--c-accent)',
                  boxShadow: '0 0 6px var(--c-accent)',
                  borderRadius: '1px',
                }}
              />
            )}

            {/* Copy button (hover) */}
            {!message.isStreaming && message.content && (
              <button
                onClick={copyMsg}
                className="absolute top-1.5 right-2 opacity-0 group-hover:opacity-100 transition-opacity btn-icon"
                style={{ fontSize: '10px', padding: '2px 5px' }}
                title="Copy"
              >
                {msgCopied
                  ? <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="var(--c-green)" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  : <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                }
              </button>
            )}
          </div>
        )}
      </div>

      {/* Avatar — user */}
      {isUser && (
        <div
          className="flex-shrink-0 w-7 h-7 rounded-lg flex items-center justify-center ml-2 mt-1"
          style={{ background: 'linear-gradient(135deg, #1a2a4a, #1e3a6e)', border: '1px solid var(--c-border-hi)' }}
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="var(--c-dim)" strokeWidth="2">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>
          </svg>
        </div>
      )}
    </div>
  );
}

// Memoized: ChatWindow maps every message through this. Without memo, appending a token
// to the streaming bubble re-rendered all bubbles. Now only the bubble whose `message`
// object actually changed re-renders.
export default React.memo(MessageBubble);
