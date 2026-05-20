import { useEffect, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { useStore } from '../../store/store';
import { useResizable } from '../../hooks/useResizable';
import styles from './NotesPanel.module.css';

export default function NotesPanel() {
  const lists                = useStore((s) => s.lists);
  const activeListId         = useStore((s) => s.activeListId);
  const updateNoteTabContent = useStore((s) => s.updateNoteTabContent);
  const addNoteTab           = useStore((s) => s.addNoteTab);
  const deleteNoteTab        = useStore((s) => s.deleteNoteTab);
  const renameNoteTab        = useStore((s) => s.renameNoteTab);
  const setActiveNoteTab     = useStore((s) => s.setActiveNoteTab);
  const importVersion        = useStore((s) => s.importVersion);
  const { panelRef, notesWidth, onDragHandleMouseDown } = useResizable();

  const activeList      = lists.find((l) => l.id === activeListId);
  const activeNoteTabId = activeList?.activeNoteTabId ?? '';
  const activeTab       = activeList?.noteTabs.find((t) => t.id === activeNoteTabId);

  const [saveIndicator, setSaveIndicator] = useState(false);
  const [renamingTabId, setRenamingTabId] = useState<string | null>(null);
  const [renameValue, setRenameValue]     = useState('');

  const saveTimer      = useRef<ReturnType<typeof setTimeout> | null>(null);
  const indicatorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const activeListIdRef          = useRef(activeListId);
  const activeNoteTabIdRef       = useRef(activeNoteTabId);
  const updateNoteTabContentRef  = useRef(updateNoteTabContent);
  const suppressRef              = useRef(false);

  useEffect(() => { activeListIdRef.current         = activeListId;         }, [activeListId]);
  useEffect(() => { activeNoteTabIdRef.current      = activeNoteTabId;      }, [activeNoteTabId]);
  useEffect(() => { updateNoteTabContentRef.current = updateNoteTabContent; }, [updateNoteTabContent]);

  const editor = useEditor({
    extensions: [StarterKit],
    content: activeTab?.content ?? '',
  });

  // Subscribe to editor updates via ref to avoid stale closures.
  useEffect(() => {
    if (!editor) return;

    const handleUpdate = () => {
      if (suppressRef.current) return;
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        updateNoteTabContentRef.current(
          activeListIdRef.current,
          activeNoteTabIdRef.current,
          editor.getHTML()
        );
        setSaveIndicator(true);
        if (indicatorTimer.current) clearTimeout(indicatorTimer.current);
        indicatorTimer.current = setTimeout(() => setSaveIndicator(false), 1500);
      }, 700);
    };

    editor.on('update', handleUpdate);
    return () => { editor.off('update', handleUpdate); };
  }, [editor]);

  // Reload editor content on list switch, tab switch, or import.
  // Also cancels any pending save so stale content can't overwrite the new tab.
  useEffect(() => {
    if (!editor) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    suppressRef.current = true;
    editor.commands.setContent(activeTab?.content ?? '');
    requestAnimationFrame(() => { suppressRef.current = false; });
  }, [activeListId, activeNoteTabId, importVersion]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleTabRenameCommit(tabId: string) {
    const trimmed = renameValue.trim();
    if (trimmed) renameNoteTab(activeListId, tabId, trimmed);
    setRenamingTabId(null);
  }

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

      <div className={styles.tabBar}>
        {activeList?.noteTabs.map((tab) => (
          <div
            key={tab.id}
            className={`${styles.noteTab} ${tab.id === activeNoteTabId ? styles.activeTab : ''}`}
            onClick={() => { if (renamingTabId !== tab.id) setActiveNoteTab(activeListId, tab.id); }}
            onDoubleClick={() => { setRenamingTabId(tab.id); setRenameValue(tab.title); }}
          >
            {renamingTabId === tab.id ? (
              <input
                className={styles.tabRenameInput}
                value={renameValue}
                autoFocus
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={() => handleTabRenameCommit(tab.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleTabRenameCommit(tab.id);
                  if (e.key === 'Escape') setRenamingTabId(null);
                }}
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <span>{tab.title}</span>
            )}
            {(activeList.noteTabs.length) > 1 && (
              <button
                className={styles.tabDeleteBtn}
                title="Delete tab"
                onClick={(e) => { e.stopPropagation(); deleteNoteTab(activeListId, tab.id); }}
              >
                ×
              </button>
            )}
          </div>
        ))}
        <button className={styles.addTabBtn} onClick={() => addNoteTab(activeListId)}>+</button>
      </div>

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
