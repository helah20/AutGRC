/**
 * Rich text editor for document sections.
 *
 * Built on contentEditable with a formatting toolbar covering headings,
 * emphasis, lists, tables, callouts and links. The server sanitises whatever
 * is submitted, so the editor's job is producing sensible structure rather
 * than enforcing safety.
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import {
  IconSave, IconX, IconSparkles, IconRefresh, IconAlert
} from './Icons.jsx';

const BLOCKS = [
  { label: 'Paragraph', tag: 'p' },
  { label: 'Heading 2', tag: 'h2' },
  { label: 'Heading 3', tag: 'h3' },
  { label: 'Heading 4', tag: 'h4' }
];

function exec(command, value) {
  document.execCommand(command, false, value);
}

export default function RichTextEditor({
  value, onSave, onCancel, placeholder = 'Write the section content…',
  aiActions, busy
}) {
  const ref = useRef(null);
  const [dirty, setDirty] = useState(false);
  const [empty, setEmpty] = useState(!value);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== value) {
      ref.current.innerHTML = value || '';
      setEmpty(!ref.current.textContent.trim());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const sync = useCallback(() => {
    setDirty(true);
    setEmpty(!ref.current?.textContent.trim());
  }, []);

  const apply = useCallback((fn) => {
    ref.current?.focus();
    fn();
    sync();
  }, [sync]);

  /** Replace the current block with the chosen tag. */
  const setBlock = (tag) => apply(() => exec('formatBlock', `<${tag}>`));

  const insertHtml = (html) => apply(() => exec('insertHTML', html));

  const insertTable = () => {
    const cols = Math.max(2, Math.min(8, Number(window.prompt('Number of columns?', '3')) || 3));
    const rows = Math.max(1, Math.min(30, Number(window.prompt('Number of data rows?', '3')) || 3));
    const head = `<thead><tr>${Array.from({ length: cols }, (_, i) => `<th>Column ${i + 1}</th>`).join('')}</tr></thead>`;
    const body = `<tbody>${Array.from({ length: rows }, () => `<tr>${Array.from({ length: cols }, () => '<td>&nbsp;</td>').join('')}</tr>`).join('')}</tbody>`;
    insertHtml(`<table>${head}${body}</table><p><br></p>`);
  };

  const insertCallout = (kind) => {
    const title = window.prompt('Callout title', kind === 'warning' ? 'Important' : 'Note');
    if (title === null) return;
    insertHtml(`<div class="callout" data-callout="${kind}"><strong>${title}</strong><p>Write the callout text here.</p></div><p><br></p>`);
  };

  const insertLink = () => {
    const url = window.prompt('Link address (https://…)');
    if (!url) return;
    if (!/^(https?:\/\/|mailto:|\/|#)/i.test(url)) {
      window.alert('Only http, https, mailto and internal links are permitted.');
      return;
    }
    apply(() => exec('createLink', url));
  };

  async function save() {
    if (!ref.current) return;
    setSaving(true);
    try {
      await onSave(ref.current.innerHTML);
      setDirty(false);
    } finally {
      setSaving(false);
    }
  }

  /** Replace the whole body, used when an AI action returns new content. */
  const replaceContent = useCallback((html) => {
    if (!ref.current) return;
    ref.current.innerHTML = html;
    setDirty(true);
    setEmpty(!ref.current.textContent.trim());
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 's') { e.preventDefault(); save(); }
    };
    const node = ref.current;
    node?.addEventListener('keydown', onKey);
    return () => node?.removeEventListener('keydown', onKey);
  });

  return (
    <div>
      <div className="editor-toolbar">
        <select className="select" style={{ width: 118, height: 26, fontSize: 12, padding: '0 22px 0 7px' }}
          onChange={(e) => { setBlock(e.target.value); e.target.selectedIndex = 0; }} defaultValue="">
          <option value="" disabled>Style</option>
          {BLOCKS.map((b) => <option key={b.tag} value={b.tag}>{b.label}</option>)}
        </select>
        <span className="sep" />
        <button type="button" className="tool-btn" title="Bold (Ctrl+B)" onClick={() => apply(() => exec('bold'))}><strong>B</strong></button>
        <button type="button" className="tool-btn" title="Italic (Ctrl+I)" onClick={() => apply(() => exec('italic'))}><em>I</em></button>
        <button type="button" className="tool-btn" title="Underline" onClick={() => apply(() => exec('underline'))}><span style={{ textDecoration: 'underline' }}>U</span></button>
        <button type="button" className="tool-btn" title="Inline code" onClick={() => insertHtml('<code>code</code>')}>{'</>'}</button>
        <span className="sep" />
        <button type="button" className="tool-btn" title="Bullet list" onClick={() => apply(() => exec('insertUnorderedList'))}>• List</button>
        <button type="button" className="tool-btn" title="Numbered list" onClick={() => apply(() => exec('insertOrderedList'))}>1. List</button>
        <button type="button" className="tool-btn" title="Indent" onClick={() => apply(() => exec('indent'))}>→</button>
        <button type="button" className="tool-btn" title="Outdent" onClick={() => apply(() => exec('outdent'))}>←</button>
        <span className="sep" />
        <button type="button" className="tool-btn" title="Insert table" onClick={insertTable}>Table</button>
        <button type="button" className="tool-btn" title="Insert note callout" onClick={() => insertCallout('note')}>Note</button>
        <button type="button" className="tool-btn" title="Insert warning callout" onClick={() => insertCallout('warning')}>Warning</button>
        <button type="button" className="tool-btn" title="Insert link" onClick={insertLink}>Link</button>
        <button type="button" className="tool-btn" title="Horizontal rule" onClick={() => insertHtml('<hr><p><br></p>')}>Rule</button>
        <span className="sep" />
        <button type="button" className="tool-btn" title="Remove formatting" onClick={() => apply(() => exec('removeFormat'))}>Clear</button>

        {aiActions && (
          <>
            <span className="sep" />
            {aiActions.map((action) => (
              <button key={action.label} type="button" className="tool-btn" title={action.title}
                disabled={busy}
                onClick={async () => {
                  const html = await action.run(ref.current.innerHTML);
                  if (html) replaceContent(html);
                }}>
                <IconSparkles width={12} height={12} />{action.label}
              </button>
            ))}
          </>
        )}
      </div>

      <div
        ref={ref}
        className="editor-surface prose"
        contentEditable
        suppressContentEditableWarning
        role="textbox"
        aria-multiline="true"
        data-empty={empty}
        data-placeholder={placeholder}
        onInput={sync}
        onBlur={sync}
      />

      <div className="editor-status">
        {dirty ? <><span className="dirty-dot" />Unsaved changes</> : <span className="muted">No unsaved changes</span>}
        <span className="spacer" />
        <span className="faint tiny">Ctrl+S to save</span>
        <button className="btn btn-sm" onClick={onCancel} disabled={saving}><IconX width={13} height={13} />Cancel</button>
        <button className="btn btn-primary btn-sm" onClick={save} disabled={saving || !dirty}>
          {saving ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <IconSave width={13} height={13} />}
          Save section
        </button>
      </div>
    </div>
  );
}
