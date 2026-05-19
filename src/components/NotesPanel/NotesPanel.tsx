import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useStore } from '../../store/store';
import { useResizable } from '../../hooks/useResizable';
import styles from './NotesPanel.module.css';

export default function NotesPanel() {
  const lists        = useStore((s) => s.lists);
  const activeListId = useStore((s) => s.activeListId);
  const updateNotes  = useStore((s) => s.updateNotes);
  const { panelRef, notesWidth, onDragHandleMouseDown } = useResizable();

  const importVersion = useStore((s) => s.importVersion);
  const activeList = lists.find((l) => l.id === activeListId);
  const [saveIndicator, setSaveIndicator] = useState(false);

  const saveTimer      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const indicatorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // These refs mean the update handler always reads the current list ID and
  // action without being recreated on every render.
  const activeListIdRef = useRef(activeListId);
  const updateNotesRef  = useRef(updateNotes);
  // Suppresses the save that fires when we programmatically load a new list's
  // content into the editor on list switch.
  const suppressRef = useRef(false);

  useEffect(() => { activeListIdRef.current = activeListId; },  [activeListId]);
  useEffect(() => { updateNotesRef.current  = updateNotes;  },  [updateNotes]);

  const editor = useEditor({
    extensions: [StarterKit],
    content: activeList?.notes ?? '',
    // onUpdate is intentionally omitted here — using useEditor options creates
    // a stale closure that captures activeListId once and never updates.
    // Instead we subscribe via editor.on('update') in the effect below.
  });

  // Subscribe to editor updates. Re-runs only when editor instance changes.
  // Reads activeListId and updateNotes through refs so they are always current.
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      if (suppressRef.current) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        updateNotesRef.current(activeListIdRef.current, editor.getHTML());
        setSaveIndicator(true);
        if (indicatorTimer.current) clearTimeout(indicatorTimer.current);
        indicatorTimer.current = setTimeout(() => setSaveIndicator(false), 1500);
      }, 700);
    };

    editor.on('update', handleUpdate);
    return () => { editor.off('update', handleUpdate); };
  }, [editor]);

  // Load the active list's notes into the editor whenever the list changes.
  useEffect(() => {
    if (!editor) return;
    suppressRef.current = true;
    editor.commands.setContent(activeList?.notes ?? '');
    requestAnimationFrame(() => { suppressRef.current = false; });
  }, [activeListId, importVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={panelRef}
      className={styles.panel}
      style={{ width: notesWidth }}
    >
      <div className={styles.dragHandle} onMouseDown={onDragHandleMouseDown} />

      <div className={styles.header}>
        <h2 className={styles.heading}>Quick Notes</h2>
        {saveIndicator && <span className={styles.savedBadge}>Saved</span>}
      </div>

      <p className={styles.listLabel}>{activeList?.name}</p>

      {editor && (
        <div className={styles.toolbar}>
          <button
            className={`${styles.toolBtn} ${editor.isActive('bold') ? styles.toolActive : ''}`}
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBold().run(); }}
            title="Bold"
          >
            <b>B</b>
          </button>
          <button
            className={`${styles.toolBtn} ${editor.isActive('italic') ? styles.toolActive : ''}`}
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleItalic().run(); }}
            title="Italic"
          >
            <i>I</i>
          </button>
          <button
            className={`${styles.toolBtn} ${editor.isActive('bulletList') ? styles.toolActive : ''}`}
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleBulletList().run(); }}
            title="Bullet list"
          >
            •—
          </button>
          <button
            className={`${styles.toolBtn} ${editor.isActive('orderedList') ? styles.toolActive : ''}`}
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().toggleOrderedList().run(); }}
            title="Ordered list"
          >
            1.
          </button>
          <button
            className={styles.toolBtn}
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().undo().run(); }}
            title="Undo"
          >
            ↩
          </button>
          <button
            className={styles.toolBtn}
            onMouseDown={(e) => { e.preventDefault(); editor.chain().focus().redo().run(); }}
            title="Redo"
          >
            ↪
          </button>
        </div>
      )}

      <div className={styles.editorWrap}>
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
