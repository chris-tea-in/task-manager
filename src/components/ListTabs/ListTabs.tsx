import { useState, useRef } from 'react';
import { useStore } from '../../store/store';
import styles from './ListTabs.module.css';

export default function ListTabs() {
  const lists = useStore((s) => s.lists);
  const activeListId = useStore((s) => s.activeListId);
  const addList = useStore((s) => s.addList);
  const renameList = useStore((s) => s.renameList);
  const deleteList = useStore((s) => s.deleteList);
  const setActiveList = useStore((s) => s.setActiveList);

  const [addingNew, setAddingNew] = useState(false);
  const [newName, setNewName] = useState('');
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const newInputRef = useRef<HTMLInputElement>(null);

  function submitNew() {
    if (newName.trim()) addList(newName.trim());
    setAddingNew(false);
    setNewName('');
  }

  function startRename(id: number, currentName: string) {
    setRenamingId(id);
    setRenameValue(currentName);
  }

  function submitRename(id: number) {
    if (renameValue.trim()) renameList(id, renameValue.trim());
    setRenamingId(null);
  }

  return (
    <div className={styles.bar}>
      {lists.map((list) => (
        <div
          key={list.id}
          className={`${styles.tab} ${list.id === activeListId ? styles.active : ''}`}
          onClick={() => renamingId !== list.id && setActiveList(list.id)}
        >
          {renamingId === list.id ? (
            <input
              className={styles.renameInput}
              value={renameValue}
              autoFocus
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={() => submitRename(list.id)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitRename(list.id);
                if (e.key === 'Escape') setRenamingId(null);
              }}
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            <span
              className={styles.tabName}
              onDoubleClick={(e) => { e.stopPropagation(); startRename(list.id, list.name); }}
            >
              {list.name}
            </span>
          )}
          <button
            className={styles.deleteBtn}
            title="Delete list"
            onClick={(e) => { e.stopPropagation(); deleteList(list.id); }}
          >
            ×
          </button>
        </div>
      ))}

      {addingNew ? (
        <div className={styles.newRow}>
          <input
            ref={newInputRef}
            className={styles.newInput}
            placeholder="List name…"
            value={newName}
            autoFocus
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submitNew();
              if (e.key === 'Escape') { setAddingNew(false); setNewName(''); }
            }}
          />
          <button className={styles.addSubmit} onClick={submitNew}>Add</button>
        </div>
      ) : (
        <button className={styles.addBtn} onClick={() => setAddingNew(true)}>
          + New list
        </button>
      )}
    </div>
  );
}
