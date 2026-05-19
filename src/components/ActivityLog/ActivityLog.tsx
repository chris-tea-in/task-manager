import { useStore } from '../../store/store';
import styles from './ActivityLog.module.css';

export default function ActivityLog() {
  const logOpen = useStore((s) => s.logOpen);
  const log = useStore((s) => s.log);
  const setLogOpen = useStore((s) => s.setLogOpen);

  if (!logOpen) return null;

  return (
    <aside className={styles.panel}>
      <div className={styles.header}>
        <h2 className={styles.heading}>Activity Log</h2>
        <button className={styles.closeBtn} onClick={() => setLogOpen(false)} title="Close log">
          ×
        </button>
      </div>
      <ul className={styles.list}>
        {log.length === 0 ? (
          <li className={styles.empty}>No activity yet.</li>
        ) : (
          log.map((entry) => (
            <li key={entry.id} className={styles.entry}>
              <span className={styles.time}>{entry.timestamp}</span>
              <span className={styles.msg}>{entry.message}</span>
            </li>
          ))
        )}
      </ul>
    </aside>
  );
}
