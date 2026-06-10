import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const TOOL_ICONS = {
  get_system_info:           '🖥',
  open_application:          '📂',
  open_url:                  '🌐',
  take_screenshot:           '📸',
  list_directory:            '📁',
  read_file:                 '📄',
  write_file:                '✏️',
  run_command:               '⚡',
  get_clipboard:             '📋',
  set_clipboard:             '📋',
  get_running_processes:     '⚙',
  create_directory:          '📁',
  delete_path:               '🗑',
  get_environment_variables: '🔑',
  move_file:                 '↔️',
  get_directory_tree:        '🌲',
  find_files:                '🔍',
  search_in_files:           '🔎',
  patch_file:                '🩹',
  memory_store:              '🧠',
  memory_recall:             '🔮',
  memory_list:               '🧠',
  memory_delete:             '🗑',
  web_search:                '🌐',
  get_weather:               '🌤',
  http_request:              '🔌',
  send_notification:         '🔔',
  set_reminder:              '⏰',
  get_datetime:              '🕐',
};

const TOOL_LABELS = {
  get_system_info:           'System Info',
  open_application:          'Opening App',
  open_url:                  'Opening URL',
  take_screenshot:           'Screenshot',
  list_directory:            'Listing Files',
  read_file:                 'Reading File',
  write_file:                'Writing File',
  run_command:               'Running Command',
  get_clipboard:             'Clipboard',
  set_clipboard:             'Clipboard',
  get_running_processes:     'Processes',
  create_directory:          'Creating Dir',
  delete_path:               'Deleting',
  get_environment_variables: 'Environment',
  move_file:                 'Moving File',
  get_directory_tree:        'Mapping Project',
  find_files:                'Finding Files',
  search_in_files:           'Searching Code',
  patch_file:                'Patching File',
  memory_store:              'Remembering',
  memory_recall:             'Recalling Memory',
  memory_list:               'Listing Memory',
  memory_delete:             'Forgetting',
  web_search:                'Searching Web',
  get_weather:               'Getting Weather',
  http_request:              'API Request',
  send_notification:         'Notification',
  set_reminder:              'Setting Reminder',
  get_datetime:              'Getting Time',
};

function ToolCard({ activity }) {
  const [expanded, setExpanded] = useState(false);
  const icon = TOOL_ICONS[activity.tool] || '⚙';
  const label = TOOL_LABELS[activity.tool] || activity.tool;
  const running = activity.status === 'running';
  const hasResult = activity.result && Object.keys(activity.result).length > 0;

  const resultText = activity.result
    ? (activity.result.error
        ? `Error: ${activity.result.error}`
        : activity.result.message || activity.result.success && 'Done'
            || JSON.stringify(activity.result, null, 2).slice(0, 200))
    : null;

  return (
    <motion.div
      className="tool-card px-3 py-2 my-1 anim-tool-pop"
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-center gap-2 cursor-pointer" onClick={() => hasResult && setExpanded(!expanded)}>
        <span style={{ fontSize: '14px' }}>{icon}</span>

        {running ? (
          <div className="flex items-center gap-2">
            <div className="anim-spin" style={{ width: 12, height: 12 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="var(--c-accent)" strokeWidth="2.5">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            </div>
            <span className="font-mono" style={{ color: 'var(--c-accent)', fontSize: '11px' }}>
              {label}
            </span>
            {activity.input && (
              <span style={{ color: 'var(--c-muted)', fontSize: '10px' }} className="truncate max-w-xs">
                {Object.values(activity.input)[0]?.toString().slice(0, 40) || ''}
              </span>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
              stroke={activity.result?.error ? 'var(--c-red)' : 'var(--c-green)'} strokeWidth="2.5">
              {activity.result?.error
                ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
                : <polyline points="20 6 9 17 4 12" />}
            </svg>
            <span className="font-mono" style={{ color: activity.result?.error ? 'var(--c-red)' : 'var(--c-green)', fontSize: '11px' }}>
              {label}
            </span>
            {resultText && (
              <span style={{ color: 'var(--c-muted)', fontSize: '10px' }} className="truncate max-w-xs">
                {resultText.slice(0, 60)}
              </span>
            )}
            {hasResult && (
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
                style={{ color: 'var(--c-muted)', marginLeft: 'auto', transform: expanded ? 'rotate(180deg)' : '' }}>
                <polyline points="6 9 12 15 18 9" />
              </svg>
            )}
          </div>
        )}
      </div>

      <AnimatePresence>
        {expanded && hasResult && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <pre
              className="mt-2 text-xs rounded p-2 overflow-x-auto selectable"
              style={{
                background: 'rgba(0,0,0,0.3)',
                color: 'var(--c-dim)',
                fontFamily: 'JetBrains Mono, monospace',
                border: '1px solid var(--c-border)',
                maxHeight: '200px',
              }}
            >
              {JSON.stringify(activity.result, null, 2)}
            </pre>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default function ToolActivity({ activities }) {
  if (!activities?.length) return null;
  return (
    <div className="my-1">
      {activities.map(a => <ToolCard key={a.id} activity={a} />)}
    </div>
  );
}
