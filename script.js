// ─── State ───────────────────────────────────────────────────────────────────
// These three variables are the single source of truth for the whole app.
// Every change updates these first, then calls render() to reflect them in the DOM.

let tasks = loadTasks();   // master list of task objects: { id, text, done }
let filter = "all";        // controls which tasks are visible: "all" | "active" | "done"
let dragSrcId = null;      // id of the task currently being dragged
let dropPosition = null;   // where to insert relative to the target: "before" | "after"

// ─── Persistence ─────────────────────────────────────────────────────────────
// localStorage stores data as plain strings, so we convert to/from JSON.

function loadTasks() {
  try {
    // getItem returns null if the key doesn't exist, so || [] gives us a safe default.
    return JSON.parse(localStorage.getItem("tasks")) || [];
  } catch {
    // JSON.parse throws if the stored value is corrupted — return empty instead of crashing.
    return [];
  }
}

function saveTasks() {
  localStorage.setItem("tasks", JSON.stringify(tasks));
}

// ─── CRUD operations ─────────────────────────────────────────────────────────
// Each function mutates the tasks array, saves to localStorage, then re-renders.

function addTask(text) {
  // Date.now() gives a unique millisecond timestamp — simple substitute for a real ID.
  tasks.push({ id: Date.now(), text: text.trim(), done: false });
  saveTasks();
  render();
}

function deleteTask(id) {
  // filter() returns a new array with the matching task removed; we reassign tasks to it.
  tasks = tasks.filter(t => t.id !== id);
  saveTasks();
  render();
}

function toggleDone(id) {
  const task = tasks.find(t => t.id === id);
  if (task) task.done = !task.done; // ! flips true to false and false to true
  saveTasks();
  render();
}

function saveEdit(id, newText) {
  const task = tasks.find(t => t.id === id);
  // Only save if there's actual text — prevents saving an empty task.
  if (task && newText.trim()) task.text = newText.trim();
  saveTasks();
  render();
}

// ─── Render ───────────────────────────────────────────────────────────────────
// render() is the only place the DOM is built. Every change in state calls render()
// so the UI is always in sync with the data.

function filteredTasks() {
  // Returns a subset of tasks based on the current filter value.
  if (filter === "active") return tasks.filter(t => !t.done);
  if (filter === "done")   return tasks.filter(t =>  t.done);
  return tasks; // "all" — no filtering needed
}

function render() {
  const list       = document.getElementById("task-list");
  const emptyState = document.getElementById("empty-state");
  const statsEl    = document.getElementById("stats");
  const visible    = filteredTasks(); // only the tasks the current filter allows

  // Update the "X of Y tasks completed" line.
  const total = tasks.length;
  const done  = tasks.filter(t => t.done).length;
  statsEl.innerHTML = total === 0
    ? ""
    : `<span>${done}</span> of <span>${total}</span> task${total !== 1 ? "s" : ""} completed`;

  // Show the empty state message only when no tasks match the active filter.
  emptyState.style.display = visible.length === 0 ? "block" : "none";

  // Wipe the list and rebuild it from scratch on every render.
  // Simple to reason about — the list always reflects the current state exactly.
  list.innerHTML = "";
  visible.forEach(task => {
    const li = document.createElement("li");
    li.className = "task-item";
    // Store the task id on the element so click handlers can identify which task was acted on.
    li.dataset.id = task.id;

    li.innerHTML = `
      <span class="drag-handle" title="Drag to reorder">⠿</span>
      <input type="checkbox" class="task-checkbox" ${task.done ? "checked" : ""} title="Mark complete" />
      <span class="task-text ${task.done ? "done" : ""}">${escapeHtml(task.text)}</span>
      <div class="task-actions">
        <button class="btn-icon btn-edit" title="Edit">✏️</button>
        <button class="btn-icon btn-delete" title="Delete">🗑️</button>
      </div>
    `;

    // Only enable dragging while the handle is held down, so clicking anywhere
    // else on the row (checkbox, text, buttons) never accidentally starts a drag.
    const handle = li.querySelector(".drag-handle");
    handle.addEventListener("mousedown", () => { li.draggable = true; });
    handle.addEventListener("mouseup",   () => { li.draggable = false; });

    // Record which task the drag started from.
    li.addEventListener("dragstart", e => {
      dragSrcId = task.id;
      e.dataTransfer.effectAllowed = "move";
      // setTimeout defers the style change so the browser captures the ghost image
      // before the element turns transparent — without this the ghost looks faded too.
      setTimeout(() => li.classList.add("dragging"), 0);
    });

    // Clean up all drag-related classes when the drag ends (drop or cancel).
    li.addEventListener("dragend", () => {
      li.draggable = false; // reset in case mouseup fired outside the handle
      li.classList.remove("dragging");
      document.querySelectorAll(".task-item").forEach(el => {
        el.classList.remove("drop-before", "drop-after");
      });
      dropPosition = null;
    });

    // Fires continuously as the dragged item moves over this element.
    li.addEventListener("dragover", e => {
      // preventDefault is required — without it the browser won't allow a drop here.
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      if (dragSrcId === task.id) return; // don't show an indicator when hovering over itself

      // getBoundingClientRect gives the element's position on screen.
      // Comparing the mouse Y to the midpoint decides whether to insert above or below.
      const rect = li.getBoundingClientRect();
      const pos  = e.clientY < rect.top + rect.height / 2 ? "before" : "after";

      // Clear all indicators first so only one shows at a time.
      document.querySelectorAll(".task-item").forEach(el => {
        el.classList.remove("drop-before", "drop-after");
      });
      li.classList.add(pos === "before" ? "drop-before" : "drop-after");
      dropPosition = pos;
    });

    // Fires when the dragged item leaves this element's area.
    li.addEventListener("dragleave", e => {
      // relatedTarget is where the cursor moved to. If it's still inside this li
      // (e.g. moving over a child button), ignore the event to prevent indicator flicker.
      if (!li.contains(e.relatedTarget)) {
        li.classList.remove("drop-before", "drop-after");
      }
    });

    // Fires when the dragged item is released over this element.
    li.addEventListener("drop", e => {
      e.preventDefault();
      if (dragSrcId === task.id) return; // dropped on itself — nothing to do

      // Remove the dragged task from its current position.
      const srcIdx = tasks.findIndex(t => t.id === dragSrcId);
      const [moved] = tasks.splice(srcIdx, 1);

      // Re-find the destination index after the removal, because splicing out the
      // source may have shifted the indices of everything after it.
      let dstIdx = tasks.findIndex(t => t.id === task.id);
      if (dropPosition === "after") dstIdx += 1; // insert after the target instead of before

      tasks.splice(dstIdx, 0, moved); // insert the moved task at the new position
      saveTasks();
      render();
    });

    list.appendChild(li);
  });
}

// ─── Event delegation ────────────────────────────────────────────────────────
// One listener on the parent <ul> handles clicks for every task row.
// This is more efficient than attaching individual listeners to each button,
// and it works even after render() rebuilds the list.

document.getElementById("task-list").addEventListener("click", e => {
  // closest() walks up the DOM tree to find the nearest ancestor matching the selector.
  // This lets us click a child element (like an emoji inside a button) and still
  // find the parent task row.
  const li = e.target.closest(".task-item");
  if (!li) return; // click was outside any task row

  const id = Number(li.dataset.id); // retrieve the task id we stored during render

  if (e.target.classList.contains("task-checkbox")) {
    toggleDone(id);
    return;
  }

  if (e.target.classList.contains("btn-edit")) {
    startEdit(li, id);
    return;
  }

  if (e.target.classList.contains("btn-save")) {
    const input = li.querySelector(".task-edit-input");
    saveEdit(id, input.value);
    return;
  }

  if (e.target.classList.contains("btn-delete")) {
    // Fade the row out visually before removing it from the data.
    li.style.transition = "opacity 0.2s";
    li.style.opacity = "0";
    setTimeout(() => deleteTask(id), 200); // wait for the fade to finish before deleting
    return;
  }
});

// Keyboard shortcuts while a task row is focused.
document.getElementById("task-list").addEventListener("keydown", e => {
  if (e.key === "Enter") {
    // If a save button exists in this row, trigger it — same as clicking Save.
    const saveBtn = e.target.closest(".task-item")?.querySelector(".btn-save");
    if (saveBtn) saveBtn.click();
  }
  if (e.key === "Escape") render(); // re-render discards the edit input and restores the text span
});

// ─── Inline edit UI ──────────────────────────────────────────────────────────

function startEdit(li, id) {
  // Disable dragging while editing so text selection doesn't accidentally start a drag.
  li.draggable = false;
  li.classList.add("is-editing"); // keeps the Save button visible without needing to hover

  const textEl     = li.querySelector(".task-text");
  const actionsEl  = li.querySelector(".task-actions");
  const currentText = tasks.find(t => t.id === id).text;

  // Swap the text span for a text input in place, keeping the same layout.
  const input = document.createElement("input");
  input.className = "task-edit-input";
  input.value = currentText;
  li.replaceChild(input, textEl);
  input.focus();
  input.select(); // pre-select the text so the user can start typing immediately

  // Swap the Edit button for a Save button.
  actionsEl.innerHTML = `
    <button class="btn-icon btn-save" title="Save">💾</button>
    <button class="btn-icon btn-delete" title="Delete">🗑️</button>
  `;
}

// ─── Add form ────────────────────────────────────────────────────────────────

document.getElementById("add-form").addEventListener("submit", e => {
  e.preventDefault(); // stop the browser from reloading the page on form submit
  const input = document.getElementById("new-task-input");
  if (input.value.trim()) { // ignore submissions that are blank or only whitespace
    addTask(input.value);
    input.value = ""; // clear the field after adding
  }
});

// ─── Filter buttons ──────────────────────────────────────────────────────────

document.querySelectorAll(".filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    filter = btn.dataset.filter; // update the global filter ("all", "active", or "done")
    document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active"); // highlight the selected button
    render();
  });
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function escapeHtml(str) {
  // Converts special HTML characters in user input to safe display equivalents.
  // Without this, a task like "<script>alert('hi')</script>" would execute as code.
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ─── Theme ───────────────────────────────────────────────────────────────────

function applyTheme(t) {
  // Setting data-theme on <html> lets CSS target [data-theme="dark"] to swap all variables.
  document.documentElement.setAttribute("data-theme", t);
  localStorage.setItem("theme", t); // remember the choice across page reloads
  // Sync the active highlight on the Light/Dark buttons in the settings panel.
  document.querySelectorAll(".theme-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.themeVal === t);
  });
}

document.getElementById("btn-cog").addEventListener("click", e => {
  // stopPropagation prevents this click from immediately bubbling up to the document
  // listener below, which would close the panel the moment we open it.
  e.stopPropagation();
  const panel   = document.getElementById("settings-panel");
  const cog     = e.currentTarget;
  const nowOpen = panel.classList.toggle("open");
  cog.classList.toggle("open", nowOpen); // keep the cog highlighted while panel is open
});

// Clicks inside the panel shouldn't close it — stop them from reaching the document listener.
document.getElementById("settings-panel").addEventListener("click", e => e.stopPropagation());

// Clicking anywhere outside the panel closes it.
document.addEventListener("click", () => {
  document.getElementById("settings-panel").classList.remove("open");
  document.getElementById("btn-cog").classList.remove("open");
});

document.querySelectorAll(".theme-btn").forEach(btn => {
  btn.addEventListener("click", () => applyTheme(btn.dataset.themeVal));
});

// Apply the saved theme on load, defaulting to light if nothing is stored.
applyTheme(localStorage.getItem("theme") || "light");

// ─── Export / Import ─────────────────────────────────────────────────────────

function exportCopy() {
  const data = JSON.stringify({ tasks, notes: notesInput.innerHTML });
  const blob = new Blob([data], { type: "application/json" });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement("a");
  a.href     = url;
  a.download = "my-tasks.json";
  a.click();
  URL.revokeObjectURL(url);
}

async function exportOverwrite() {
  if (!window.showSaveFilePicker) {
    alert("Your browser doesn't support file overwrite. Use '↓ Export' instead.");
    return;
  }
  const data = JSON.stringify({ tasks, notes: notesInput.innerHTML });
  try {
    const handle = await window.showSaveFilePicker({
      suggestedName: "my-tasks.json",
      types: [{ description: "JSON", accept: { "application/json": [".json"] } }]
    });
    const writable = await handle.createWritable();
    await writable.write(data);
    await writable.close();
  } catch (err) {
    if (err.name !== "AbortError") alert("Save failed: " + err.message);
    // AbortError = user cancelled the dialog — no feedback needed
  }
}


function importTasks(file) {
  const reader = new FileReader();
  reader.onload = e => {
    try {
      const parsed = JSON.parse(e.target.result);
      let importedTasks, importedNotes;

      if (Array.isArray(parsed)) {
        // Legacy format: bare tasks array — notes are left untouched.
        importedTasks = parsed;
        importedNotes = null;
      } else if (parsed && Array.isArray(parsed.tasks)) {
        importedTasks = parsed.tasks;
        importedNotes = typeof parsed.notes === "string" ? parsed.notes : null;
      } else {
        throw new Error();
      }

      tasks = importedTasks.filter(t =>
        typeof t.id   === "number" &&
        typeof t.text === "string" &&
        typeof t.done === "boolean"
      );
      saveTasks();
      render();

      if (importedNotes !== null) {
        notesInput.innerHTML = importedNotes;
        localStorage.setItem("notes", importedNotes);
      }
    } catch {
      alert("Import failed — the file doesn't look like a valid tasks export.");
    }
  };
  reader.readAsText(file);
}

document.getElementById("btn-export-copy").addEventListener("click", exportCopy);
document.getElementById("btn-export-overwrite").addEventListener("click", exportOverwrite);

document.getElementById("btn-import").addEventListener("click", () => {
  document.getElementById("import-file").click();
});

document.getElementById("import-file").addEventListener("change", e => {
  const file = e.target.files[0];
  if (file) {
    importTasks(file);
    e.target.value = ""; // reset so the same file can be re-imported if needed
  }
});

// ─── Notes ───────────────────────────────────────────────────────────────────

const notesInput     = document.getElementById("notes-input");
const notesFooter    = document.getElementById("notes-footer");
const notesBoldBtn   = document.getElementById("notes-btn-bold");
const notesIndentBtn = document.getElementById("notes-btn-indent");
let notesSaveTimer = null;
let notesFadeTimer = null;

notesInput.innerHTML = localStorage.getItem("notes") || "";

notesInput.addEventListener("input", () => {
  clearTimeout(notesSaveTimer);
  clearTimeout(notesFadeTimer);
  notesFooter.textContent = "";
  notesSaveTimer = setTimeout(() => {
    localStorage.setItem("notes", notesInput.innerHTML);
    notesFooter.textContent = "Saved ✓";
    notesFadeTimer = setTimeout(() => { notesFooter.textContent = ""; }, 2000);
  }, 700);
});

// Tab → indent at cursor; Ctrl/Cmd+B → toggle bold on selection
notesInput.addEventListener("keydown", e => {
  if (e.key === "Tab") {
    e.preventDefault();
    document.execCommand("insertText", false, "\t");
  }
  if (e.key === "b" && (e.ctrlKey || e.metaKey)) {
    e.preventDefault();
    document.execCommand("bold");
  }
});

// mousedown + preventDefault keeps the notes selection alive while clicking toolbar buttons
notesBoldBtn.addEventListener("mousedown", e => {
  e.preventDefault();
  document.execCommand("bold");
});

notesIndentBtn.addEventListener("mousedown", e => {
  e.preventDefault();
  document.execCommand("insertText", false, "\t");
});

// ─── Init ────────────────────────────────────────────────────────────────────

render(); // build the initial UI from whatever tasks were loaded from localStorage
