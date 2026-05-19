import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { arrayMove } from '@dnd-kit/sortable';
import type { Task, List, Filter, Theme, LogEntry } from './types';

interface AppState {
  lists: List[];
  activeListId: number;
  filter: Filter;
  theme: Theme;
  notesWidth: number;
  logOpen: boolean;
  log: LogEntry[];
  confirmDeleteListId: number | null;
  importVersion: number;
}

interface AppActions {
  addTask: (text: string) => void;
  deleteTask: (taskId: number) => void;
  toggleTask: (taskId: number) => void;
  editTask: (taskId: number, text: string) => void;
  reorderTasks: (activeId: number, overId: number) => void;
  addList: (name: string) => void;
  renameList: (listId: number, name: string) => void;
  deleteList: (listId: number) => void;
  confirmDeleteList: () => void;
  cancelDeleteList: () => void;
  setActiveList: (listId: number) => void;
  setFilter: (filter: Filter) => void;
  setTheme: (theme: Theme) => void;
  updateNotes: (listId: number, notes: string) => void;
  setNotesWidth: (width: number) => void;
  setLogOpen: (open: boolean) => void;
  importData: (data: unknown) => void;
}

type Store = AppState & AppActions;

const DEFAULT_ID = 1;
const DEFAULT_LIST: List = { id: DEFAULT_ID, name: 'My Tasks', tasks: [], notes: '' };

function logEntry(message: string): LogEntry {
  return {
    id: Date.now() + Math.random(),
    message,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  };
}

function prependLog(entry: LogEntry, log: LogEntry[]): LogEntry[] {
  return [entry, ...log].slice(0, 50);
}

export const useStore = create<Store>()(
  persist(
    (set, get) => ({
      lists: [DEFAULT_LIST],
      activeListId: DEFAULT_ID,
      filter: 'all',
      theme: 'light',
      notesWidth: 300,
      logOpen: false,
      log: [],
      confirmDeleteListId: null,
      importVersion: 0,

      addTask: (text) => {
        const trimmed = text.trim();
        if (!trimmed) return;
        const task: Task = { id: Date.now(), text: trimmed, done: false };
        set((s) => ({
          lists: s.lists.map((l) =>
            l.id === s.activeListId ? { ...l, tasks: [...l.tasks, task] } : l
          ),
          log: prependLog(logEntry(`Task added: "${trimmed}"`), s.log),
        }));
      },

      deleteTask: (taskId) => {
        const { lists, activeListId, log } = get();
        const task = lists.find((l) => l.id === activeListId)?.tasks.find((t) => t.id === taskId);
        set((s) => ({
          lists: s.lists.map((l) =>
            l.id === s.activeListId ? { ...l, tasks: l.tasks.filter((t) => t.id !== taskId) } : l
          ),
          log: prependLog(logEntry(`Task deleted: "${task?.text ?? ''}"`), log),
        }));
      },

      toggleTask: (taskId) => {
        set((s) => {
          let msg = '';
          const lists = s.lists.map((l) => {
            if (l.id !== s.activeListId) return l;
            return {
              ...l,
              tasks: l.tasks.map((t) => {
                if (t.id !== taskId) return t;
                const done = !t.done;
                msg = done ? `Task done: "${t.text}"` : `Task undone: "${t.text}"`;
                return { ...t, done };
              }),
            };
          });
          return { lists, log: prependLog(logEntry(msg), s.log) };
        });
      },

      editTask: (taskId, text) => {
        const trimmed = text.trim();
        set((s) => ({
          lists: s.lists.map((l) =>
            l.id === s.activeListId
              ? { ...l, tasks: l.tasks.map((t) => (t.id === taskId ? { ...t, text: trimmed } : t)) }
              : l
          ),
          log: prependLog(logEntry(`Task edited: "${trimmed}"`), s.log),
        }));
      },

      reorderTasks: (activeId, overId) => {
        set((s) => {
          const list = s.lists.find((l) => l.id === s.activeListId);
          if (!list) return s;
          const from = list.tasks.findIndex((t) => t.id === activeId);
          const to = list.tasks.findIndex((t) => t.id === overId);
          if (from === -1 || to === -1) return s;
          return {
            lists: s.lists.map((l) =>
              l.id === s.activeListId ? { ...l, tasks: arrayMove(l.tasks, from, to) } : l
            ),
          };
        });
      },

      addList: (name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        const newList: List = { id: Date.now(), name: trimmed, tasks: [], notes: '' };
        set((s) => ({
          lists: [...s.lists, newList],
          activeListId: newList.id,
          filter: 'all',
          log: prependLog(logEntry(`List created: "${trimmed}"`), s.log),
        }));
      },

      renameList: (listId, name) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((s) => ({
          lists: s.lists.map((l) => (l.id === listId ? { ...l, name: trimmed } : l)),
          log: prependLog(logEntry(`List renamed to "${trimmed}"`), s.log),
        }));
      },

      deleteList: (listId) => {
        const { lists } = get();
        const list = lists.find((l) => l.id === listId);
        if (!list) return;
        if (list.tasks.length > 0) {
          set({ confirmDeleteListId: listId });
          return;
        }
        _performDelete(listId, list.name);
      },

      confirmDeleteList: () => {
        const { confirmDeleteListId, lists } = get();
        if (!confirmDeleteListId) return;
        const list = lists.find((l) => l.id === confirmDeleteListId);
        set({ confirmDeleteListId: null });
        _performDelete(confirmDeleteListId, list?.name ?? '');
      },

      cancelDeleteList: () => set({ confirmDeleteListId: null }),

      setActiveList: (listId) => set({ activeListId: listId, filter: 'all' }),

      setFilter: (filter) => set({ filter }),

      setTheme: (theme) => {
        document.documentElement.setAttribute('data-theme', theme);
        set({ theme });
      },

      updateNotes: (listId, notes) => {
        set((s) => ({
          lists: s.lists.map((l) => (l.id === listId ? { ...l, notes } : l)),
        }));
      },

      setNotesWidth: (width) => set({ notesWidth: Math.max(200, Math.min(600, width)) }),

      setLogOpen: (open) => set({ logOpen: open }),

      importData: (data) => {
        try {
          const raw = data as Record<string, unknown>;
          if (!Array.isArray(raw.lists)) throw new Error('Unrecognized format');

          let filter: Filter = 'all';
          const lists: List[] = (raw.lists as Record<string, unknown>[]).map((l) => ({
            id: Number(l.id) || Date.now(),
            name: String(l.name || 'Imported List'),
            tasks: Array.isArray(l.tasks)
              ? (l.tasks as Record<string, unknown>[]).map((t) => ({
                  id: Number(t.id) || Date.now(),
                  text: String(t.text || ''),
                  done: Boolean(t.done),
                }))
              : [],
            notes: typeof l.notes === 'string' ? l.notes : '',
          }));

          if (lists.length === 0) throw new Error('Empty lists');

          let activeListId = Number(raw.activeListId) || lists[0].id;
          if (!lists.find((l) => l.id === activeListId)) activeListId = lists[0].id;
          if (['all', 'active', 'done'].includes(String(raw.filter))) filter = raw.filter as Filter;

          const { log, importVersion } = get();
          set({ lists, activeListId, filter, importVersion: importVersion + 1, log: prependLog(logEntry('Data imported'), log) });
        } catch {
          /* invalid file — do nothing */
        }
      },
    }),
    {
      name: 'task-manager-v2',
      partialize: (s) => ({
        lists: s.lists,
        activeListId: s.activeListId,
        filter: s.filter,
        theme: s.theme,
        notesWidth: s.notesWidth,
        logOpen: s.logOpen,
        log: s.log,
      }),
    }
  )
);

// Helper called by both deleteList and confirmDeleteList
function _performDelete(listId: number, listName: string) {
  useStore.setState((s) => {
    const remaining = s.lists.filter((l) => l.id !== listId);
    const finalLists =
      remaining.length > 0
        ? remaining
        : [{ id: Date.now(), name: 'My Tasks', tasks: [], notes: '' }];
    const newActiveId =
      s.activeListId === listId ? finalLists[0].id : s.activeListId;
    return {
      lists: finalLists,
      activeListId: newActiveId,
      log: prependLog(logEntry(`List deleted: "${listName}"`), s.log),
    };
  });
}
