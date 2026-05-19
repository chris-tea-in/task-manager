import { useState, useRef } from 'react';
import { useStore } from '../../store/store';
import SettingsPanel from '../SettingsPanel/SettingsPanel';
import styles from './AddTaskForm.module.css';

export default function AddTaskForm() {
  const addTask = useStore((s) => s.addTask);
  const logOpen = useStore((s) => s.logOpen);
  const setLogOpen = useStore((s) => s.setLogOpen);

  const [value, setValue] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const settingsRef = useRef<HTMLDivElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!value.trim()) return;
    addTask(value);
    setValue('');
  }

  return (
    <div className={styles.row}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <input
          className={styles.input}
          placeholder="Add a new task…"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button className={styles.addBtn} type="submit">Add</button>
      </form>

      <button
        className={styles.logBtn}
        title="Toggle activity log"
        onClick={() => setLogOpen(!logOpen)}
      >
        📋
      </button>

      <div className={styles.settingsWrap} ref={settingsRef}>
        <button
          className={`${styles.cogBtn} ${settingsOpen ? styles.open : ''}`}
          title="Settings"
          onClick={() => setSettingsOpen((o) => !o)}
        >
          ⚙️
        </button>
        {settingsOpen && <SettingsPanel onClose={() => setSettingsOpen(false)} />}
      </div>
    </div>
  );
}
