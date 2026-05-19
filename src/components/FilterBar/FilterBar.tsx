import { useStore } from '../../store/store';
import type { Filter } from '../../store/types';
import styles from './FilterBar.module.css';

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'done', label: 'Done' },
];

export default function FilterBar() {
  const filter = useStore((s) => s.filter);
  const setFilter = useStore((s) => s.setFilter);
  const lists = useStore((s) => s.lists);
  const activeListId = useStore((s) => s.activeListId);

  const tasks = lists.find((l) => l.id === activeListId)?.tasks ?? [];
  const doneCount = tasks.filter((t) => t.done).length;

  return (
    <div className={styles.wrapper}>
      <div className={styles.filters}>
        {FILTERS.map((f) => (
          <button
            key={f.value}
            className={`${styles.btn} ${filter === f.value ? styles.active : ''}`}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>
      <p className={styles.stats}>
        <span>{doneCount}</span> of <span>{tasks.length}</span> completed
      </p>
    </div>
  );
}
