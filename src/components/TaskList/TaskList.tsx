import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useStore } from '../../store/store';
import TaskItem from './TaskItem';
import styles from './TaskList.module.css';

export default function TaskList() {
  const lists = useStore((s) => s.lists);
  const activeListId = useStore((s) => s.activeListId);
  const filter = useStore((s) => s.filter);
  const reorderTasks = useStore((s) => s.reorderTasks);

  const allTasks = lists.find((l) => l.id === activeListId)?.tasks ?? [];

  const visibleTasks = allTasks.filter((t) => {
    if (filter === 'active') return !t.done;
    if (filter === 'done') return t.done;
    return true;
  });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      reorderTasks(Number(active.id), Number(over.id));
    }
  }

  if (visibleTasks.length === 0) {
    return (
      <div className={styles.empty}>
        <div className={styles.emptyIcon}>
          {filter === 'done' ? '✅' : filter === 'active' ? '🎉' : '📝'}
        </div>
        <p>
          {filter === 'done'
            ? 'No completed tasks yet.'
            : filter === 'active'
            ? 'All tasks done!'
            : 'No tasks yet. Add one above.'}
        </p>
      </div>
    );
  }

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={visibleTasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
        <ul className={styles.list}>
          {visibleTasks.map((task) => (
            <TaskItem key={task.id} task={task} />
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
