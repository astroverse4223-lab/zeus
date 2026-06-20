import emmet, { extract } from 'emmet';

// Languages Emmet should activate for, and which Emmet "syntax" + abbreviation
// type (markup vs stylesheet) each one maps to.
const LANG_CONFIG = {
  html: { syntax: 'html', type: 'markup' },
  xml: { syntax: 'xml', type: 'markup' },
  css: { syntax: 'css', type: 'stylesheet' },
  scss: { syntax: 'scss', type: 'stylesheet' },
  less: { syntax: 'less', type: 'stylesheet' },
};

// Plain words ("hello", "world") parse as valid Emmet tag abbreviations too —
// only auto-expand on Tab when the text looks deliberately Emmet-flavored, so
// normal prose/Tab-to-indent in HTML files isn't hijacked.
function looksIntentional(abbr) {
  return abbr === '!' || /[.#>+*^(){}\[\]:$@]/.test(abbr);
}

function findCaret(lines) {
  for (let i = 0; i < lines.length; i++) {
    if (lines.length > 1 && lines[i].trim() === '') return { line: i, col: lines[i].length };
  }
  for (let i = 0; i < lines.length; i++) {
    const idx = lines[i].indexOf('><');
    if (idx !== -1) return { line: i, col: idx + 1 };
  }
  const last = lines.length - 1;
  return { line: last, col: lines[last].length };
}

// Wire Emmet's Tab-to-expand behavior into a Monaco editor instance for
// whichever language is currently active in `getLang()`.
export function registerEmmet(editor, monaco, getLang) {
  return editor.addCommand(monaco.KeyCode.Tab, () => {
    const fallbackToTab = () => editor.trigger('keyboard', 'tab', null);

    const cfg = LANG_CONFIG[getLang()];
    if (!cfg || editor.getSelection()?.isEmpty() === false) { fallbackToTab(); return; }

    const model = editor.getModel();
    const pos = editor.getPosition();
    const lineText = model.getLineContent(pos.lineNumber);
    const extracted = extract(lineText, pos.column - 1, { type: cfg.type });
    if (!extracted || !looksIntentional(extracted.abbreviation)) { fallbackToTab(); return; }

    const indentUnit = model.getOptions().insertSpaces ? ' '.repeat(model.getOptions().tabSize) : '\t';
    let expanded;
    try {
      expanded = emmet(extracted.abbreviation, { syntax: cfg.syntax, type: cfg.type, options: { 'output.indent': indentUnit } });
    } catch {
      fallbackToTab();
      return;
    }

    const range = new monaco.Range(pos.lineNumber, extracted.start + 1, pos.lineNumber, extracted.end + 1);
    editor.executeEdits('emmet', [{ range, text: expanded }]);

    const lines = expanded.split('\n');
    const caret = findCaret(lines);
    const lineNumber = pos.lineNumber + caret.line;
    const column = (caret.line === 0 ? extracted.start : 0) + caret.col + 1;
    editor.setPosition({ lineNumber, column });
    editor.revealPositionInCenterIfOutsideViewport({ lineNumber, column });
    editor.focus();
  }, 'editorTextFocus');
}
