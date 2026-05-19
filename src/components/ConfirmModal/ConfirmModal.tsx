import { useStore } from '../../store/store';
import styles from './ConfirmModal.module.css';

export default function ConfirmModal() {
  const confirmDeleteListId = useStore((s) => s.confirmDeleteListId);
  const lists = useStore((s) => s.lists);
  const confirmDeleteList = useStore((s) => s.confirmDeleteList);
  const cancelDeleteList = useStore((s) => s.cancelDeleteList);

  if (!confirmDeleteListId) return null;

  const list = lists.find((l) => l.id === confirmDeleteListId);

  return (
    <div className={styles.overlay} onClick={cancelDeleteList}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <p className={styles.message}>
          Delete <strong>"{list?.name}"</strong>? It contains{' '}
          <strong>{list?.tasks.length} task{list?.tasks.length !== 1 ? 's' : ''}</strong> that
          will be permanently removed.
        </p>
        <div className={styles.actions}>
          <button className={`${styles.btn} ${styles.cancel}`} onClick={cancelDeleteList}>
            Cancel
          </button>
          <button className={`${styles.btn} ${styles.confirm}`} onClick={confirmDeleteList}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
