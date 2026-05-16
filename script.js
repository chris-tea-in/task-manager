// ─── Events catalog ───────────────────────────────────────────────────────────
// Single source of truth for every event name in the app.
// Publishers and subscribers always reference these constants — string literals
// never appear in module code. Adding a feature means adding a new entry here;
// existing entries are never renamed or removed.

const Events = Object.freeze({
  // ── Commands (intent — exactly one handler each) ───────────────────────────
  TASK_ADD:              'task:add',
  TASK_DELETE:           'task:delete',
  TASK_TOGGLE:           'task:toggle',
  TASK_EDIT:             'task:edit',
  TASK_REORDER:          'task:reorder',
  FILTER_CHANGE:         'filter:change',
  LIST_CREATE:           'list:create',
  LIST_SELECT:           'list:select',
  LIST_RENAME:           'list:rename',
  LIST_DELETE:           'list:delete',
  LIST_DELETE_CONFIRMED: 'list:delete:confirmed',
  DATA_IMPORT:           'data:import',
  THEME_CHANGE:          'theme:change',
  NOTES_RESTORE:         'notes:restore',
  UI_EDIT_TASK:          'ui:edit-task',
  UI_DISCARD_EDIT:       'ui:discard-edit',

  // ── Domain events (facts — any number of subscribers) ─────────────────────
  TASK_ADDED:            'task:added',
  TASK_DELETED:          'task:deleted',
  TASK_TOGGLED:          'task:toggled',
  TASK_EDITED:           'task:edited',
  TASK_REORDERED:        'task:reordered',
  FILTER_CHANGED:        'filter:changed',
  LIST_CREATED:          'list:created',
  LIST_SELECTED:         'list:selected',
  LIST_RENAMED:          'list:renamed',
  LIST_DELETED:          'list:deleted',
  DATA_IMPORTED:         'data:imported',
  APP_READY:             'app:ready',
  THEME_LOADED:          'theme:loaded',
  THEME_CHANGED:         'theme:changed',
  NOTES_CHANGED:         'notes:changed',
});

// ─── EventBus ────────────────────────────────────────────────────────────────
const EventBus = (() => {
  const listeners  = {};
  const middleware = [];

  return {
    use(fn) {
      middleware.push(fn);
    },
    subscribe(event, handler) {
      (listeners[event] ??= []).push(handler);
    },
    unsubscribe(event, handler) {
      if (listeners[event]) {
        listeners[event] = listeners[event].filter(fn => fn !== handler);
      }
    },
    publish(event, data) {
      const deliver = () => {
        (listeners[event] ?? []).forEach(fn => fn(data));
      };
      const run = middleware.reduceRight(
        (next, mw) => () => mw(event, data, next),
        deliver
      );
      run();
    }
  };
})();

// ─── Debug middleware ─────────────────────────────────────────────────────────
const DEBUG = true;
if (DEBUG) {
  EventBus.use((event, data, next) => {
    console.log(`[EventBus] ${event}`, data);
    next();
  });
}

// ─── Store ────────────────────────────────────────────────────────────────────
// The aggregate. Owns and mutates domain state; publishes minimal delta payloads
// (only what changed) rather than full state snapshots. Every subscriber
// maintains its own cache and applies deltas independently.

(() => {
  function loadState() {
    try {
      const raw = localStorage.getItem('lists');
      if (raw) {
        const lists    = JSON.parse(raw);
        const savedId  = Number(localStorage.getItem('activeListId'));
        const activeListId = lists.some(l => l.id === savedId) ? savedId : lists[0]?.id;
        return { lists, activeListId };
      }
      // Migrate old single-list 'tasks' key
      const oldTasks   = JSON.parse(localStorage.getItem('tasks')) || [];
      const defaultList = { id: Date.now(), name: 'My Tasks', tasks: oldTasks };
      return { lists: [defaultList], activeListId: defaultList.id };
    } catch {
      const defaultList = { id: Date.now(), name: 'My Tasks', tasks: [] };
      return { lists: [defaultList], activeListId: defaultList.id };
    }
  }

  let { lists, activeListId } = loadState();
  let filter = 'all';

  function activeList() {
    return lists.find(l => l.id === activeListId) || lists[0];
  }

  // ── Task commands ──────────────────────────────────────────────────────────

  EventBus.subscribe(Events.TASK_ADD, ({ text }) => {
    const list = activeList();
    const task = { id: Date.now(), text: text.trim(), done: false };
    list.tasks.push(task);
    EventBus.publish(Events.TASK_ADDED, { listId: activeListId, task: { ...task } });
  });

  EventBus.subscribe(Events.TASK_DELETE, ({ id }) => {
    const list    = activeList();
    const deleted = list.tasks.find(t => t.id === id);
    list.tasks    = list.tasks.filter(t => t.id !== id);
    EventBus.publish(Events.TASK_DELETED, {
      listId:  activeListId,
      taskId:  id,
      deleted: deleted ? { ...deleted } : null
    });
  });

  EventBus.subscribe(Events.TASK_TOGGLE, ({ id }) => {
    const list = activeList();
    const task = list.tasks.find(t => t.id === id);
    if (!task) return;
    task.done = !task.done;
    EventBus.publish(Events.TASK_TOGGLED, {
      listId:   activeListId,
      taskId:   id,
      done:     task.done,
      taskText: task.text
    });
  });

  EventBus.subscribe(Events.TASK_EDIT, ({ id, text }) => {
    const list = activeList();
    const task = list.tasks.find(t => t.id === id);
    if (!task || !text.trim()) return;
    task.text = text.trim();
    EventBus.publish(Events.TASK_EDITED, { listId: activeListId, taskId: id, text: task.text });
  });

  EventBus.subscribe(Events.TASK_REORDER, ({ srcId, dstId, position }) => {
    const list   = activeList();
    const srcIdx = list.tasks.findIndex(t => t.id === srcId);
    const [moved] = list.tasks.splice(srcIdx, 1);
    let dstIdx   = list.tasks.findIndex(t => t.id === dstId);
    if (position === 'after') dstIdx += 1;
    list.tasks.splice(dstIdx, 0, moved);
    EventBus.publish(Events.TASK_REORDERED, {
      listId:         activeListId,
      orderedTaskIds: list.tasks.map(t => t.id)
    });
  });

  EventBus.subscribe(Events.FILTER_CHANGE, ({ filter: f }) => {
    filter = f;
    EventBus.publish(Events.FILTER_CHANGED, { filter });
  });

  // ── List commands ──────────────────────────────────────────────────────────

  EventBus.subscribe(Events.LIST_CREATE, ({ name } = {}) => {
    const listName = (typeof name === 'string' && name.trim()) ? name.trim() : 'New List';
    const newList  = { id: Date.now(), name: listName, tasks: [] };
    lists.push(newList);
    activeListId = newList.id;
    filter       = 'all';
    EventBus.publish(Events.LIST_CREATED, { list: { ...newList } });
  });

  EventBus.subscribe(Events.LIST_SELECT, ({ id }) => {
    if (!lists.some(l => l.id === id)) return;
    activeListId = id;
    filter       = 'all';
    const list   = lists.find(l => l.id === id);
    EventBus.publish(Events.LIST_SELECTED, { listId: id, name: list.name });
  });

  EventBus.subscribe(Events.LIST_RENAME, ({ id, name }) => {
    const list = lists.find(l => l.id === id);
    if (!list || !name.trim()) return;
    list.name = name.trim();
    EventBus.publish(Events.LIST_RENAMED, { listId: id, name: list.name });
  });

  // ConfirmModal saga intercepts LIST_DELETE and only dispatches this command
  // after user approval (or immediately when the list is empty).
  EventBus.subscribe(Events.LIST_DELETE_CONFIRMED, ({ id }) => {
    const deletedList = lists.find(l => l.id === id);
    lists  = lists.filter(l => l.id !== id);
    filter = 'all';

    let replacementList = null;
    if (lists.length === 0) {
      replacementList = { id: Date.now(), name: 'New List', tasks: [] };
      lists           = [replacementList];
      activeListId    = replacementList.id;
    } else if (activeListId === id) {
      activeListId = lists[0].id;
    }

    EventBus.publish(Events.LIST_DELETED, {
      listId:          id,
      newActiveListId: activeListId,
      deletedList:     deletedList ? { id: deletedList.id, name: deletedList.name } : null,
      replacementList: replacementList ? { ...replacementList } : null
    });
  });

  EventBus.subscribe(Events.DATA_IMPORT, ({ lists: imported, activeListId: importedActiveId }) => {
    lists        = imported;
    activeListId = imported.some(l => l.id === importedActiveId) ? importedActiveId : imported[0]?.id;
    filter       = 'all';
    // Full replacement — subscribers receive the complete new state.
    EventBus.publish(Events.DATA_IMPORTED, {
      lists: lists.map(l => ({ ...l, tasks: l.tasks.map(t => ({ ...t })) })),
      activeListId
    });
  });

  // Capture initial state before any subscriber has run, then defer the publish
  // until after all modules below have subscribed (queueMicrotask fires after
  // this script finishes but before any user events).
  const _initLists    = lists.map(l => ({ ...l, tasks: l.tasks.map(t => ({ ...t })) }));
  const _initActiveId = activeListId;
  const _initFilter   = filter;
  queueMicrotask(() => EventBus.publish(Events.APP_READY, {
    lists:        _initLists,
    activeListId: _initActiveId,
    filter:       _initFilter
  }));
})();

// ─── Persistence ─────────────────────────────────────────────────────────────
// Maintains its own delta-based cache of lists state. Each domain event carries
// only the change — Persistence applies the delta and saves the result.
// Subscribes to THEME_CHANGED and NOTES_CHANGED (domain events), never to
// the commands THEME_CHANGE or NOTES_RESTORE.

(() => {
  let _lists        = [];
  let _activeListId = null;

  function save() {
    localStorage.setItem('lists',        JSON.stringify(_lists));
    localStorage.setItem('activeListId', String(_activeListId));
  }

  EventBus.subscribe(Events.APP_READY, ({ lists, activeListId }) => {
    _lists        = lists.map(l => ({ ...l, tasks: l.tasks.map(t => ({ ...t })) }));
    _activeListId = activeListId;
    // No save — data was just loaded from localStorage.
  });

  EventBus.subscribe(Events.TASK_ADDED, ({ listId, task }) => {
    const list = _lists.find(l => l.id === listId);
    if (list) list.tasks.push({ ...task });
    save();
  });

  EventBus.subscribe(Events.TASK_DELETED, ({ listId, taskId }) => {
    const list = _lists.find(l => l.id === listId);
    if (list) list.tasks = list.tasks.filter(t => t.id !== taskId);
    save();
  });

  EventBus.subscribe(Events.TASK_TOGGLED, ({ listId, taskId, done }) => {
    const list = _lists.find(l => l.id === listId);
    const task = list?.tasks.find(t => t.id === taskId);
    if (task) task.done = done;
    save();
  });

  EventBus.subscribe(Events.TASK_EDITED, ({ listId, taskId, text }) => {
    const list = _lists.find(l => l.id === listId);
    const task = list?.tasks.find(t => t.id === taskId);
    if (task) task.text = text;
    save();
  });

  EventBus.subscribe(Events.TASK_REORDERED, ({ listId, orderedTaskIds }) => {
    const list = _lists.find(l => l.id === listId);
    if (list) list.tasks = orderedTaskIds.map(id => list.tasks.find(t => t.id === id)).filter(Boolean);
    save();
  });

  EventBus.subscribe(Events.LIST_CREATED, ({ list }) => {
    _lists.push({ ...list, tasks: [] });
    _activeListId = list.id;
    save();
  });

  EventBus.subscribe(Events.LIST_SELECTED, ({ listId }) => {
    _activeListId = listId;
    save();
  });

  EventBus.subscribe(Events.LIST_RENAMED, ({ listId, name }) => {
    const list = _lists.find(l => l.id === listId);
    if (list) list.name = name;
    save();
  });

  EventBus.subscribe(Events.LIST_DELETED, ({ listId, newActiveListId, replacementList }) => {
    _lists        = _lists.filter(l => l.id !== listId);
    _activeListId = newActiveListId;
    if (replacementList) _lists.push({ ...replacementList, tasks: [] });
    save();
  });

  EventBus.subscribe(Events.DATA_IMPORTED, ({ lists, activeListId }) => {
    _lists        = lists.map(l => ({ ...l, tasks: l.tasks.map(t => ({ ...t })) }));
    _activeListId = activeListId;
    save();
  });

  // Domain events — not the commands that caused them.
  EventBus.subscribe(Events.THEME_CHANGED, ({ theme }) => localStorage.setItem('theme', theme));
  EventBus.subscribe(Events.NOTES_CHANGED, ({ content }) => localStorage.setItem('notes', content));
})();

// ─── ThemeManager ────────────────────────────────────────────────────────────
// Proper command/event separation:
//   THEME_CHANGE (command)  → ThemeManager is the sole handler; applies the
//                             theme and publishes THEME_CHANGED (domain event).
//   THEME_LOADED (startup)  → applies saved theme without publishing THEME_CHANGED,
//                             so Persistence does not re-save on startup.

(() => {
  function apply(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    document.querySelectorAll('.theme-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.themeVal === theme);
    });
  }

  EventBus.subscribe(Events.THEME_LOADED, ({ theme }) => apply(theme));

  EventBus.subscribe(Events.THEME_CHANGE, ({ theme }) => {
    apply(theme);
    EventBus.publish(Events.THEME_CHANGED, { theme });
  });

  EventBus.publish(Events.THEME_LOADED, { theme: localStorage.getItem('theme') || 'light' });
})();

// ─── Renderer ────────────────────────────────────────────────────────────────
// Maintains its own delta-based cache (_lists, _activeListId, _filter, _tasks).
// Each domain event carries only the change — Renderer applies the delta and
// updates only the affected part of the DOM. No full-state snapshots needed.

const Renderer = (() => {
  let _lists        = [];
  let _activeListId = null;
  let _filter       = 'all';
  let _tasks        = [];
  let _editMode     = false;
  let dragSrcId     = null;
  let dropPosition  = null;

  function escapeHtml(str) {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function visibleTasks() {
    if (_filter === 'active') return _tasks.filter(t => !t.done);
    if (_filter === 'done')   return _tasks.filter(t =>  t.done);
    return _tasks;
  }

  // Keeps _tasks in sync with the active list's tasks array after any delta.
  function syncTasks() {
    const list = _lists.find(l => l.id === _activeListId);
    _tasks = list ? list.tasks : [];
  }

  function updateStats() {
    const total = _tasks.length;
    const done  = _tasks.filter(t => t.done).length;
    document.getElementById('stats').innerHTML = total === 0
      ? ''
      : `<span>${done}</span> of <span>${total}</span> task${total !== 1 ? 's' : ''} completed`;
  }

  function updateEmptyState() {
    document.getElementById('empty-state').style.display =
      visibleTasks().length === 0 ? 'block' : 'none';
  }

  function updateFilterButtons() {
    document.querySelectorAll('.filter-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.filter === _filter);
    });
  }

  // ── List tabs ──────────────────────────────────────────────────────────────

  function updateListTabs() {
    const bar = document.getElementById('lists-bar');
    bar.innerHTML = '';

    _lists.forEach(list => {
      const tab = document.createElement('button');
      tab.className      = 'list-tab' + (list.id === _activeListId ? ' active' : '');
      tab.dataset.listId = list.id;

      const nameSpan = document.createElement('span');
      nameSpan.className   = 'list-tab-name';
      nameSpan.textContent = list.name;
      tab.appendChild(nameSpan);

      if (_editMode) {
        const delBtn = document.createElement('button');
        delBtn.className   = 'list-tab-delete';
        delBtn.textContent = '×';
        delBtn.title       = 'Delete list';
        delBtn.addEventListener('click', e => {
          e.stopPropagation();
          EventBus.publish(Events.LIST_DELETE, {
            id:        list.id,
            name:      list.name,
            taskCount: list.tasks.length
          });
        });
        tab.appendChild(delBtn);
      }

      tab.addEventListener('click', e => {
        if (e.target.classList.contains('list-tab-delete')) return;
        if (list.id !== _activeListId) EventBus.publish(Events.LIST_SELECT, { id: list.id });
      });

      tab.addEventListener('dblclick', e => {
        if (e.target.classList.contains('list-tab-delete')) return;
        startRenameTab(tab, list.id);
      });

      bar.appendChild(tab);
    });

    if (_editMode) {
      const addInput = document.createElement('input');
      addInput.className   = 'list-add-input';
      addInput.type        = 'text';
      addInput.placeholder = 'New list name…';

      const addSubmit = document.createElement('button');
      addSubmit.className   = 'list-add-submit';
      addSubmit.textContent = 'Confirm';
      addSubmit.title       = 'Create list';

      const createList = () => {
        const name = addInput.value.trim();
        if (name) EventBus.publish(Events.LIST_CREATE, { name });
      };

      addInput.addEventListener('keydown', e => {
        if (e.key === 'Enter')  { e.preventDefault(); createList(); }
        if (e.key === 'Escape') { _editMode = false; updateListTabs(); }
      });
      addSubmit.addEventListener('click', createList);

      bar.appendChild(addInput);
      bar.appendChild(addSubmit);

      const doneBtn = document.createElement('button');
      doneBtn.className   = 'list-edit-toggle active';
      doneBtn.textContent = 'Done';
      doneBtn.addEventListener('click', () => { _editMode = false; updateListTabs(); });
      bar.appendChild(doneBtn);
    } else {
      const editBtn = document.createElement('button');
      editBtn.className   = 'list-edit-toggle';
      editBtn.textContent = 'Edit Lists';
      editBtn.addEventListener('click', () => { _editMode = true; updateListTabs(); });
      bar.appendChild(editBtn);
    }
  }

  function startRenameTab(tab, listId) {
    const nameSpan = tab.querySelector('.list-tab-name');
    if (!nameSpan) return;
    const currentName = nameSpan.textContent;

    const input = document.createElement('input');
    input.className = 'list-tab-input';
    input.value     = currentName;
    tab.replaceChild(input, nameSpan);
    input.focus();
    input.select();

    let committed = false;
    let cancelled = false;

    const commit = () => {
      if (committed) return;
      committed = true;
      if (cancelled) {
        const span = document.createElement('span');
        span.className   = 'list-tab-name';
        span.textContent = currentName;
        if (input.parentNode === tab) tab.replaceChild(span, input);
        return;
      }
      const newName = input.value.trim() || currentName;
      EventBus.publish(Events.LIST_RENAME, { id: listId, name: newName });
    };

    input.addEventListener('blur', commit);
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter')  { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { cancelled = true; input.blur(); }
    });
  }

  // ── Task list ──────────────────────────────────────────────────────────────

  function buildRow(task) {
    const li = document.createElement('li');
    li.className  = 'task-item';
    li.dataset.id = task.id;

    li.innerHTML = `
      <span class="drag-handle" title="Drag to reorder">⠿</span>
      <input type="checkbox" class="task-checkbox" ${task.done ? 'checked' : ''} title="Mark complete" />
      <span class="task-text ${task.done ? 'done' : ''}">${escapeHtml(task.text)}</span>
      <div class="task-actions">
        <button class="btn-icon btn-edit" title="Edit">✏️</button>
        <button class="btn-icon btn-delete" title="Delete">🗑️</button>
      </div>
    `;

    const handle = li.querySelector('.drag-handle');
    handle.addEventListener('mousedown', () => { li.draggable = true; });
    handle.addEventListener('mouseup',   () => { li.draggable = false; });

    li.addEventListener('dragstart', e => {
      dragSrcId = task.id;
      e.dataTransfer.effectAllowed = 'move';
      setTimeout(() => li.classList.add('dragging'), 0);
    });

    li.addEventListener('dragend', () => {
      li.draggable = false;
      li.classList.remove('dragging');
      document.querySelectorAll('.task-item').forEach(el => {
        el.classList.remove('drop-before', 'drop-after');
      });
      dropPosition = null;
    });

    li.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      if (dragSrcId === task.id) return;
      const rect = li.getBoundingClientRect();
      const pos  = e.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
      document.querySelectorAll('.task-item').forEach(el => {
        el.classList.remove('drop-before', 'drop-after');
      });
      li.classList.add(pos === 'before' ? 'drop-before' : 'drop-after');
      dropPosition = pos;
    });

    li.addEventListener('dragleave', e => {
      if (!li.contains(e.relatedTarget)) {
        li.classList.remove('drop-before', 'drop-after');
      }
    });

    li.addEventListener('drop', e => {
      e.preventDefault();
      if (dragSrcId === task.id) return;
      EventBus.publish(Events.TASK_REORDER, { srcId: dragSrcId, dstId: task.id, position: dropPosition });
    });

    return li;
  }

  function rebuildList() {
    const list = document.getElementById('task-list');
    list.innerHTML = '';
    visibleTasks().forEach(task => list.appendChild(buildRow(task)));
  }

  // ── Domain event subscriptions ─────────────────────────────────────────────

  EventBus.subscribe(Events.APP_READY, ({ lists, activeListId, filter }) => {
    _lists        = lists.map(l => ({ ...l, tasks: l.tasks.map(t => ({ ...t })) }));
    _activeListId = activeListId;
    _filter       = filter;
    syncTasks();
    updateListTabs();
    rebuildList();
    updateStats();
    updateEmptyState();
  });

  EventBus.subscribe(Events.TASK_ADDED, ({ listId, task }) => {
    const list = _lists.find(l => l.id === listId);
    if (list) list.tasks.push({ ...task });
    if (listId !== _activeListId) return;
    syncTasks();
    const visible = _filter === 'all' || (_filter === 'active' && !task.done);
    if (visible) document.getElementById('task-list').appendChild(buildRow(task));
    updateStats();
    updateEmptyState();
  });

  EventBus.subscribe(Events.TASK_DELETED, ({ listId, taskId }) => {
    const list = _lists.find(l => l.id === listId);
    if (list) list.tasks = list.tasks.filter(t => t.id !== taskId);
    if (listId !== _activeListId) return;
    syncTasks();
    updateStats();
    updateEmptyState();
    const row = document.querySelector(`.task-item[data-id="${taskId}"]`);
    if (row) {
      row.style.transition = 'opacity 0.2s';
      row.style.opacity    = '0';
      setTimeout(() => row.remove(), 200);
    }
  });

  EventBus.subscribe(Events.TASK_TOGGLED, ({ listId, taskId, done }) => {
    const list = _lists.find(l => l.id === listId);
    const task = list?.tasks.find(t => t.id === taskId);
    if (task) task.done = done;
    if (listId !== _activeListId) return;
    syncTasks();
    const row    = document.querySelector(`.task-item[data-id="${taskId}"]`);
    const textEl = row?.querySelector('.task-text');
    if (_filter === 'all' && textEl) {
      row.querySelector('.task-checkbox').checked = done;
      textEl.className = `task-text ${done ? 'done' : ''}`;
    } else {
      rebuildList();
    }
    updateStats();
    updateEmptyState();
  });

  EventBus.subscribe(Events.TASK_EDITED, ({ listId, taskId, text }) => {
    const list = _lists.find(l => l.id === listId);
    const task = list?.tasks.find(t => t.id === taskId);
    if (task) task.text = text;
    if (listId !== _activeListId) return;
    syncTasks();
    rebuildList();
  });

  EventBus.subscribe(Events.TASK_REORDERED, ({ listId, orderedTaskIds }) => {
    const list = _lists.find(l => l.id === listId);
    if (list) list.tasks = orderedTaskIds.map(id => list.tasks.find(t => t.id === id)).filter(Boolean);
    if (listId !== _activeListId) return;
    syncTasks();
    rebuildList();
  });

  EventBus.subscribe(Events.FILTER_CHANGED, ({ filter }) => {
    _filter = filter;
    updateFilterButtons();
    rebuildList();
    updateEmptyState();
  });

  EventBus.subscribe(Events.LIST_CREATED, ({ list }) => {
    _lists.push({ ...list, tasks: [] });
    _activeListId = list.id;
    _filter       = 'all';
    syncTasks();
    updateListTabs();
    updateFilterButtons();
    rebuildList();
    updateStats();
    updateEmptyState();
    if (_editMode) document.querySelector('.list-add-input')?.focus();
  });

  EventBus.subscribe(Events.LIST_SELECTED, ({ listId }) => {
    _activeListId = listId;
    _filter       = 'all';
    syncTasks();
    updateListTabs();
    updateFilterButtons();
    rebuildList();
    updateStats();
    updateEmptyState();
  });

  EventBus.subscribe(Events.LIST_RENAMED, ({ listId, name }) => {
    const list = _lists.find(l => l.id === listId);
    if (list) list.name = name;
    updateListTabs();
  });

  EventBus.subscribe(Events.LIST_DELETED, ({ listId, newActiveListId, replacementList }) => {
    _lists        = _lists.filter(l => l.id !== listId);
    _activeListId = newActiveListId;
    _filter       = 'all';
    if (replacementList) _lists.push({ ...replacementList, tasks: [] });
    syncTasks();
    updateListTabs();
    updateFilterButtons();
    rebuildList();
    updateStats();
    updateEmptyState();
  });

  EventBus.subscribe(Events.DATA_IMPORTED, ({ lists, activeListId }) => {
    _lists        = lists.map(l => ({ ...l, tasks: l.tasks.map(t => ({ ...t })) }));
    _activeListId = activeListId;
    _filter       = 'all';
    syncTasks();
    updateListTabs();
    updateFilterButtons();
    rebuildList();
    updateStats();
    updateEmptyState();
  });

  EventBus.subscribe(Events.UI_DISCARD_EDIT, () => rebuildList());

  EventBus.subscribe(Events.UI_EDIT_TASK, ({ id }) => {
    const li = document.querySelector(`.task-item[data-id="${id}"]`);
    if (li) startEdit(li, id);
  });

  function startEdit(li, id) {
    li.draggable = false;
    li.classList.add('is-editing');

    const textEl    = li.querySelector('.task-text');
    const actionsEl = li.querySelector('.task-actions');
    const task      = _tasks.find(t => t.id === id);

    const input = document.createElement('input');
    input.className = 'task-edit-input';
    input.value     = task.text;
    li.replaceChild(input, textEl);
    input.focus();
    input.select();

    actionsEl.innerHTML = `
      <button class="btn-icon btn-save" title="Save">💾</button>
      <button class="btn-icon btn-delete" title="Delete">🗑️</button>
    `;
  }
})();

// ─── Confirm modal (Saga) ─────────────────────────────────────────────────────
// Intercepts LIST_DELETE. Forwards to LIST_DELETE_CONFIRMED immediately when
// the list is empty; otherwise shows a modal to get user approval first.

(() => {
  const overlay    = document.getElementById('modal-overlay');
  const msgEl      = document.getElementById('modal-message');
  const cancelBtn  = document.getElementById('modal-cancel');
  const confirmBtn = document.getElementById('modal-confirm');
  let _pendingId   = null;

  function show(message, id) {
    _pendingId        = id;
    msgEl.textContent = message;
    overlay.classList.add('open');
  }

  function hide() {
    overlay.classList.remove('open');
    _pendingId = null;
  }

  EventBus.subscribe(Events.LIST_DELETE, ({ id, name, taskCount }) => {
    if (taskCount === 0) {
      EventBus.publish(Events.LIST_DELETE_CONFIRMED, { id });
      return;
    }
    show(
      `"${name}" contains ${taskCount} task${taskCount !== 1 ? 's' : ''}. Delete the list and all its tasks?`,
      id
    );
  });

  cancelBtn.addEventListener('click', hide);

  confirmBtn.addEventListener('click', () => {
    if (_pendingId !== null) EventBus.publish(Events.LIST_DELETE_CONFIRMED, { id: _pendingId });
    hide();
  });

  overlay.addEventListener('click', e => {
    if (e.target === overlay) hide();
  });
})();

// ─── Task list interactions ───────────────────────────────────────────────────

document.getElementById('task-list').addEventListener('click', e => {
  const li = e.target.closest('.task-item');
  if (!li) return;
  const id = Number(li.dataset.id);

  if (e.target.classList.contains('task-checkbox')) {
    EventBus.publish(Events.TASK_TOGGLE, { id }); return;
  }
  if (e.target.classList.contains('btn-edit')) {
    EventBus.publish(Events.UI_EDIT_TASK, { id }); return;
  }
  if (e.target.classList.contains('btn-save')) {
    const input = li.querySelector('.task-edit-input');
    EventBus.publish(Events.TASK_EDIT, { id, text: input.value }); return;
  }
  if (e.target.classList.contains('btn-delete')) {
    EventBus.publish(Events.TASK_DELETE, { id }); return;
  }
});

document.getElementById('task-list').addEventListener('keydown', e => {
  if (e.key === 'Enter') {
    const saveBtn = e.target.closest('.task-item')?.querySelector('.btn-save');
    if (saveBtn) saveBtn.click();
  }
  if (e.key === 'Escape') EventBus.publish(Events.UI_DISCARD_EDIT);
});

// ─── Add form ────────────────────────────────────────────────────────────────

document.getElementById('add-form').addEventListener('submit', e => {
  e.preventDefault();
  const input = document.getElementById('new-task-input');
  if (input.value.trim()) {
    EventBus.publish(Events.TASK_ADD, { text: input.value });
    input.value = '';
  }
});

// ─── Filter buttons ──────────────────────────────────────────────────────────

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    EventBus.publish(Events.FILTER_CHANGE, { filter: btn.dataset.filter });
  });
});

// ─── Theme buttons ───────────────────────────────────────────────────────────

document.querySelectorAll('.theme-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    EventBus.publish(Events.THEME_CHANGE, { theme: btn.dataset.themeVal });
  });
});

// ─── Settings panel ──────────────────────────────────────────────────────────

document.getElementById('btn-cog').addEventListener('click', e => {
  e.stopPropagation();
  const panel   = document.getElementById('settings-panel');
  const cog     = e.currentTarget;
  const nowOpen = panel.classList.toggle('open');
  cog.classList.toggle('open', nowOpen);
});

document.getElementById('settings-panel').addEventListener('click', e => e.stopPropagation());

document.addEventListener('click', () => {
  document.getElementById('settings-panel').classList.remove('open');
  document.getElementById('btn-cog').classList.remove('open');
});

// ─── Log panel toggle ────────────────────────────────────────────────────────

document.getElementById('btn-toggle-log').addEventListener('click', () => {
  const isOpen = document.querySelector('.layout').classList.toggle('log-open');
  document.getElementById('btn-toggle-log').classList.toggle('active', isOpen);
  localStorage.setItem('log-open', isOpen);
});

if (localStorage.getItem('log-open') === 'true') {
  document.querySelector('.layout').classList.add('log-open');
  document.getElementById('btn-toggle-log').classList.add('active');
}

// ─── Export / Import ─────────────────────────────────────────────────────────
// ExportImport has no need to maintain a lists cache — Persistence already keeps
// localStorage current after every delta. At export time, ExportImport reads
// directly from localStorage (shared infrastructure, not another module).
// The only state it caches is notes content, received via NOTES_CHANGED.
//
// Handles three import formats:
//   1. Bare task array (oldest format)
//   2. { tasks, notes } (previous single-list format)
//   3. { lists, activeListId, notes } (current multi-list format)

(() => {
  let _notesContent = localStorage.getItem('notes') || '';

  EventBus.subscribe(Events.NOTES_CHANGED, ({ content }) => { _notesContent = content; });

  function readCurrentState() {
    try {
      return {
        lists:        JSON.parse(localStorage.getItem('lists'))        || [],
        activeListId: Number(localStorage.getItem('activeListId'))     || null
      };
    } catch {
      return { lists: [], activeListId: null };
    }
  }

  function exportCopy() {
    const { lists, activeListId } = readCurrentState();
    const data = JSON.stringify({ lists, activeListId, notes: _notesContent });
    const blob = new Blob([data], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'my-tasks.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function exportOverwrite() {
    if (!window.showSaveFilePicker) {
      alert("Your browser doesn't support file overwrite. Use '↓ Export' instead.");
      return;
    }
    const { lists, activeListId } = readCurrentState();
    const data = JSON.stringify({ lists, activeListId, notes: _notesContent });
    try {
      const handle = await window.showSaveFilePicker({
        suggestedName: 'my-tasks.json',
        types: [{ description: 'JSON', accept: { 'application/json': ['.json'] } }]
      });
      const writable = await handle.createWritable();
      await writable.write(data);
      await writable.close();
    } catch (err) {
      if (err.name !== 'AbortError') alert('Save failed: ' + err.message);
    }
  }

  function validTasks(arr) {
    return (Array.isArray(arr) ? arr : []).filter(t =>
      typeof t.id   === 'number' &&
      typeof t.text === 'string' &&
      typeof t.done === 'boolean'
    );
  }

  function importFile(file) {
    const reader = new FileReader();
    reader.onload = e => {
      try {
        const parsed = JSON.parse(e.target.result);
        let importedLists, importedActiveId, importedNotes;

        if (Array.isArray(parsed)) {
          const list = { id: Date.now(), name: 'Imported Tasks', tasks: validTasks(parsed) };
          importedLists    = [list];
          importedActiveId = list.id;
          importedNotes    = null;

        } else if (parsed && Array.isArray(parsed.tasks)) {
          const list = { id: Date.now(), name: 'Imported Tasks', tasks: validTasks(parsed.tasks) };
          importedLists    = [list];
          importedActiveId = list.id;
          importedNotes    = typeof parsed.notes === 'string' ? parsed.notes : null;

        } else if (parsed && Array.isArray(parsed.lists)) {
          importedLists = parsed.lists.map(l => ({
            id:    typeof l.id   === 'number' ? l.id   : Date.now(),
            name:  typeof l.name === 'string'  ? l.name : 'Unnamed List',
            tasks: validTasks(l.tasks)
          }));
          importedActiveId = parsed.activeListId;
          importedNotes    = typeof parsed.notes === 'string' ? parsed.notes : null;

        } else {
          throw new Error();
        }

        if (!importedLists || importedLists.length === 0) throw new Error();

        EventBus.publish(Events.DATA_IMPORT, { lists: importedLists, activeListId: importedActiveId });
        if (importedNotes !== null) EventBus.publish(Events.NOTES_RESTORE, { content: importedNotes });

      } catch {
        alert("Import failed — the file doesn't look like a valid tasks export.");
      }
    };
    reader.readAsText(file);
  }

  document.getElementById('btn-export-copy').addEventListener('click', exportCopy);
  document.getElementById('btn-export-overwrite').addEventListener('click', exportOverwrite);
  document.getElementById('btn-import').addEventListener('click', () => {
    document.getElementById('import-file').click();
  });
  document.getElementById('import-file').addEventListener('change', e => {
    const file = e.target.files[0];
    if (file) { importFile(file); e.target.value = ''; }
  });
})();

// ─── Notes ───────────────────────────────────────────────────────────────────
// Notes is its own aggregate — it owns note content and publishes NOTES_CHANGED
// (domain event) after any mutation. NOTES_RESTORE is a command from ExportImport;
// Notes is the sole handler, updating its DOM and publishing NOTES_CHANGED.

(() => {
  const notesInput     = document.getElementById('notes-input');
  const notesFooter    = document.getElementById('notes-footer');
  const notesBoldBtn   = document.getElementById('notes-btn-bold');
  const notesIndentBtn = document.getElementById('notes-btn-indent');
  let saveTimer = null;
  let fadeTimer = null;

  notesInput.innerHTML = localStorage.getItem('notes') || '';

  notesInput.addEventListener('input', () => {
    clearTimeout(saveTimer);
    clearTimeout(fadeTimer);
    notesFooter.textContent = '';
    saveTimer = setTimeout(() => {
      EventBus.publish(Events.NOTES_CHANGED, { content: notesInput.innerHTML });
      notesFooter.textContent = 'Saved ✓';
      fadeTimer = setTimeout(() => { notesFooter.textContent = ''; }, 2000);
    }, 700);
  });

  notesInput.addEventListener('keydown', e => {
    if (e.key === 'Tab') {
      e.preventDefault();
      document.execCommand('insertText', false, '\t');
    }
    if (e.key === 'b' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      document.execCommand('bold');
    }
  });

  notesBoldBtn.addEventListener('mousedown', e => {
    e.preventDefault();
    document.execCommand('bold');
  });

  notesIndentBtn.addEventListener('mousedown', e => {
    e.preventDefault();
    document.execCommand('insertText', false, '\t');
  });

  EventBus.subscribe(Events.NOTES_RESTORE, ({ content }) => {
    notesInput.innerHTML = content;
    EventBus.publish(Events.NOTES_CHANGED, { content });
  });
})();

// ─── Activity Log ────────────────────────────────────────────────────────────
// Purely additive — subscribes to domain events and appends entries.
// Reads only the specific fields it needs from each minimal payload.

(() => {
  const MAX     = 50;
  const entries = [];

  function timestamp() {
    return new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function clip(text, max = 28) {
    return text.length > max ? text.slice(0, max) + '…' : text;
  }

  function push(message) {
    entries.unshift({ time: timestamp(), message });
    if (entries.length > MAX) entries.pop();
    render();
  }

  function render() {
    const list = document.getElementById('log-list');
    if (!list) return;
    list.innerHTML = '';
    if (entries.length === 0) {
      const li = document.createElement('li');
      li.className   = 'log-empty';
      li.textContent = 'No activity yet.';
      list.appendChild(li);
      return;
    }
    entries.forEach(({ time, message }) => {
      const li = document.createElement('li');
      li.className = 'log-entry';
      const t = document.createElement('span');
      t.className   = 'log-time';
      t.textContent = time;
      const m = document.createElement('span');
      m.className   = 'log-msg';
      m.textContent = message;
      li.append(t, m);
      list.appendChild(li);
    });
  }

  EventBus.subscribe(Events.TASK_ADDED,    ({ task })              => push(`Added "${clip(task.text)}"`));
  EventBus.subscribe(Events.TASK_DELETED,  ({ deleted })           => deleted && push(`Deleted "${clip(deleted.text)}"`));
  EventBus.subscribe(Events.TASK_TOGGLED,  ({ done, taskText })    => push(done ? `Completed "${clip(taskText)}"` : `Reopened "${clip(taskText)}"`));
  EventBus.subscribe(Events.TASK_EDITED,   ({ text })              => push(`Edited to "${clip(text)}"`));
  EventBus.subscribe(Events.TASK_REORDERED, ()                     => push('Reordered tasks'));
  EventBus.subscribe(Events.DATA_IMPORTED, ({ lists })             => {
    const total = lists.reduce((sum, l) => sum + l.tasks.length, 0);
    push(`Imported ${total} task${total !== 1 ? 's' : ''} across ${lists.length} list${lists.length !== 1 ? 's' : ''}`);
  });
  EventBus.subscribe(Events.LIST_CREATED,  ({ list })              => push(`Created list "${clip(list.name)}"`));
  EventBus.subscribe(Events.LIST_SELECTED, ({ name })              => push(`Switched to "${clip(name)}"`));
  EventBus.subscribe(Events.LIST_RENAMED,  ({ name })              => push(`Renamed list to "${clip(name)}"`));
  EventBus.subscribe(Events.LIST_DELETED,  ({ deletedList, replacementList }) => {
    if (deletedList)     push(`Deleted list "${clip(deletedList.name)}"`);
    if (replacementList) push(`Created list "${clip(replacementList.name)}"`);
  });
})();

// ─── Init ────────────────────────────────────────────────────────────────────
// Store schedules APP_READY via queueMicrotask — fires after this script
// finishes, guaranteeing every module above has subscribed.
