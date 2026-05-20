import { useRef } from 'react';
import { useStore } from '../../store/store';
import type { Theme } from '../../store/types';
import styles from './SettingsPanel.module.css';

interface Props {
  onClose: () => void;
}

export default function SettingsPanel({ onClose }: Props) {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const importData = useStore((s) => s.importData);
  const lists = useStore((s) => s.lists);
  const activeListId = useStore((s) => s.activeListId);
  const filter = useStore((s) => s.filter);
  const fileInputRef = useRef<HTMLInputElement>(null);

  function buildExport() {
    return JSON.stringify({ lists, activeListId, filter }, null, 2);
  }

  async function handleSaveFile() {
    try {
      if ('showSaveFilePicker' in window) {
        const handle = await (window as Window & typeof globalThis & {
          showSaveFilePicker: (opts: object) => Promise<FileSystemFileHandle>;
        }).showSaveFilePicker({
          suggestedName: 'task-manager.json',
          types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }],
        });
        const writable = await handle.createWritable();
        await writable.write(buildExport());
        await writable.close();
      } else {
        const blob = new Blob([buildExport()], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'task-manager.json';
        a.click();
        URL.revokeObjectURL(url);
      }
      onClose();
    } catch {
      /* user cancelled */
    }
  }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        importData(parsed);
        onClose();
      } catch {
        alert('Invalid JSON file.');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  const THEMES: { value: Theme; label: string }[] = [
    { value: 'light', label: '☀️ Light' },
    { value: 'dark', label: '🌙 Dark' },
  ];

  return (
    <div className={styles.panel}>
      <p className={styles.label}>Theme</p>
      <div className={styles.group}>
        {THEMES.map((t) => (
          <button
            key={t.value}
            className={`${styles.btn} ${theme === t.value ? styles.active : ''}`}
            onClick={() => setTheme(t.value)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <p className={styles.label} style={{ marginTop: 12 }}>Export</p>
      <div className={styles.group}>
        <button className={styles.btn} onClick={handleSaveFile}>💾 Save file</button>
      </div>

      <p className={styles.label} style={{ marginTop: 12 }}>Import</p>
      <button className={styles.btn} onClick={() => fileInputRef.current?.click()}>
        📂 Open file
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={handleImport}
      />
    </div>
  );
}
