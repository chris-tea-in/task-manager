import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { arrayMove } from '@dnd-kit/sortable';
import type { Task, List, NoteTab, Filter, Theme, LogEntry } from './types';

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
  updateNoteTabContent: (listId: number, tabId: string, content: string) => void;
  addNoteTab: (listId: number) => void;
  deleteNoteTab: (listId: number, tabId: string) => void;
  renameNoteTab: (listId: number, tabId: string, title: string) => void;
  setActiveNoteTab: (listId: number, tabId: string) => void;
  setNotesWidth: (width: number) => void;
  setLogOpen: (open: boolean) => void;
  importData: (data: unknown) => void;
}

type Store = AppState & AppActions;

const DEFAULT_ID = 1;

function makeDefaultTab(content = ''): NoteTab {
  return { id: String(Date.now() + Math.random()), title: 'Notes', content };
}

function makeDefaultList(id: number, name: string): List {
  const tab = makeDefaultTab();
  return { id, name, tasks: [], noteTabs: [tab], activeNoteTabId: tab.id };
}

// Converts a raw list object (old or new format) to the current List shape.
// Used by both the Zustand migrate function and importData.
function migrateRawList(raw: Record<string, unknown>): List {
  let noteTabs: NoteTab[];
  let activeNoteTabId: string;

  if (Array.isArray(raw.noteTabs) && raw.noteTabs.length > 0) {
    noteTabs = (raw.noteTabs as Record<string, unknown>[]).map((t) => ({
      id: String(t.id || Date.now() + Math.random()),
      title: String(t.title || 'Notes'),
      content: typeof t.content === 'string' ? t.content : '',
    }));
    activeNoteTabId =
      noteTabs.find((t) => t.id === String(raw.activeNoteTabId))?.id ?? noteTabs[0].id;
  } else {
    const tab = makeDefaultTab(typeof raw.notes === 'string' ? raw.notes : '');
    noteTabs = [tab];
    activeNoteTabId = tab.id;
  }

  return {
    id: Number(raw.id) || Date.now(),
    name: String(raw.name || 'Imported List'),
    tasks: Array.isArray(raw.tasks)
      ? (raw.tasks as Record<string, unknown>[]).map((t) => ({
          id: Number(t.id) || Date.now(),
          text: String(t.text || ''),
          done: Boolean(t.done),
        }))
      : [],
    noteTabs,
    activeNoteTabId,
  };
}

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

const DEFAULT_LIST = makeDefaultList(DEFAULT_ID, 'My Tasks');

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
        const newList = makeDefaultList(Date.now(), trimmed);
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

      updateNoteTabContent: (listId, tabId, content) => {
        set((s) => ({
          lists: s.lists.map((l) =>
            l.id === listId
              ? { ...l, noteTabs: l.noteTabs.map((t) => (t.id === tabId ? { ...t, content } : t)) }
              : l
          ),
        }));
      },

      addNoteTab: (listId) => {
        const tab: NoteTab = { id: String(Date.now() + Math.random()), title: 'New tab', content: '' };
        set((s) => ({
          lists: s.lists.map((l) =>
            l.id === listId
              ? { ...l, noteTabs: [...l.noteTabs, tab], activeNoteTabId: tab.id }
              : l
          ),
        }));
      },

      deleteNoteTab: (listId, tabId) => {
        set((s) => ({
          lists: s.lists.map((l) => {
            if (l.id !== listId) return l;
            const remaining = l.noteTabs.filter((t) => t.id !== tabId);
            const newActiveId =
              l.activeNoteTabId === tabId ? (remaining[0]?.id ?? '') : l.activeNoteTabId;
            return { ...l, noteTabs: remaining, activeNoteTabId: newActiveId };
          }),
        }));
      },

      renameNoteTab: (listId, tabId, title) => {
        const trimmed = title.trim();
        if (!trimmed) return;
        set((s) => ({
          lists: s.lists.map((l) =>
            l.id === listId
              ? { ...l, noteTabs: l.noteTabs.map((t) => (t.id === tabId ? { ...t, title: trimmed } : t)) }
              : l
          ),
        }));
      },

      setActiveNoteTab: (listId, tabId) => {
        set((s) => ({
          lists: s.lists.map((l) => (l.id === listId ? { ...l, activeNoteTabId: tabId } : l)),
        }));
      },

      setNotesWidth: (width) => set({ notesWidth: Math.max(200, Math.min(600, width)) }),

      setLogOpen: (open) => set({ logOpen: open }),

      importData: (data) => {
        try {
          const raw = data as Record<string, unknown>;
          if (!Array.isArray(raw.lists)) throw new Error('Unrecognized format');

          let filter: Filter = 'all';
          const lists = (raw.lists as Record<string, unknown>[]).map(migrateRawList);

          if (lists.length === 0) throw new Error('Empty lists');

          let activeListId = Number(raw.activeListId) || lists[0].id;
          if (!lists.find((l) => l.id === activeListId)) activeListId = lists[0].id;
          if (['all', 'active', 'done'].includes(String(raw.filter))) filter = raw.filter as Filter;

          const { log, importVersion } = get();
          set({
            lists,
            activeListId,
            filter,
            importVersion: importVersion + 1,
            log: prependLog(logEntry('Data imported'), log),
          });
        } catch {
          /* invalid file — do nothing */
        }
      },
    }),
    {
      name: 'task-manager-v2',
      version: 1,
      migrate: (persistedState, version) => {
        if (version === 0) {
          const old = persistedState as Record<string, unknown>;
          const lists = Array.isArray(old.lists)
            ? (old.lists as Record<string, unknown>[]).map(migrateRawList)
            : [DEFAULT_LIST];
          return { ...old, lists };
        }
        return persistedState as Store;
      },
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

function _performDelete(listId: number, listName: string) {
  useStore.setState((s) => {
    const remaining = s.lists.filter((l) => l.id !== listId);
    const finalLists = remaining.length > 0 ? remaining : [makeDefaultList(Date.now(), 'My Tasks')];
    const newActiveId = s.activeListId === listId ? finalLists[0].id : s.activeListId;
    return {
      lists: finalLists,
      activeListId: newActiveId,
      log: prependLog(logEntry(`List deleted: "${listName}"`), s.log),
    };
  });
}
