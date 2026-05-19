import { useStore } from '../../store/store';
import ActivityLog from '../ActivityLog/ActivityLog';
import ListTabs from '../ListTabs/ListTabs';
import AddTaskForm from '../AddTaskForm/AddTaskForm';
import FilterBar from '../FilterBar/FilterBar';
import TaskList from '../TaskList/TaskList';
import NotesPanel from '../NotesPanel/NotesPanel';
import styles from './Layout.module.css';

export default function Layout() {
  const logOpen = useStore((s) => s.logOpen);

  return (
    <div className={`${styles.layout} ${logOpen ? styles.logOpen : ''}`}>
      <ActivityLog />

      <main className={styles.main}>
        <header className={styles.header}>
          <div>
            <h1>Task Manager</h1>
            <p className={styles.subtitle}>Stay organised, stay focused.</p>
          </div>
        </header>

        <ListTabs />
        <AddTaskForm />
        <FilterBar />
        <TaskList />
      </main>

      <NotesPanel />
    </div>
  );
}
