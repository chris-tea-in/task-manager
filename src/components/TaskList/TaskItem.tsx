import { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useStore } from '../../store/store';
import type { Task } from '../../store/types';
import styles from './TaskItem.module.css';

interface Props {
  task: Task;
}

export default function TaskItem({ task }: Props) {
  const toggleTask = useStore((s) => s.toggleTask);
  const deleteTask = useStore((s) => s.deleteTask);
  const editTask = useStore((s) => s.editTask);

  const [editing, setEditing] = useState(false);
  const [editValue, setEditValue] = useState(task.text);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  function saveEdit() {
    if (editValue.trim()) editTask(task.id, editValue);
    else setEditValue(task.text);
    setEditing(false);
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={`${styles.item} ${isDragging ? styles.dragging : ''} ${editing ? styles.isEditing : ''}`}
    >
      <span className={styles.dragHandle} {...attributes} {...listeners}>⠿</span>

      <input
        type="checkbox"
        className={styles.checkbox}
        checked={task.done}
        onChange={() => toggleTask(task.id)}
      />

      {editing ? (
        <input
          className={styles.editInput}
          value={editValue}
          autoFocus
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={saveEdit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') saveEdit();
            if (e.key === 'Escape') { setEditValue(task.text); setEditing(false); }
          }}
        />
      ) : (
        <span className={`${styles.text} ${task.done ? styles.done : ''}`}>
          {task.text}
        </span>
      )}

      <div className={styles.actions}>
        {editing ? (
          <button className={`${styles.btnIcon} ${styles.btnSave}`} title="Save" onClick={saveEdit}>✓</button>
        ) : (
          <button className={`${styles.btnIcon} ${styles.btnEdit}`} title="Edit" onClick={() => { setEditValue(task.text); setEditing(true); }}>✎</button>
        )}
        <button
          className={`${styles.btnIcon} ${styles.btnDelete}`}
          title="Delete"
          onClick={() => deleteTask(task.id)}
        >
          🗑
        </button>
      </div>
    </li>
  );
}
