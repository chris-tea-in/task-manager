# Feature Checklist

Use this file to verify that all app functionality still works after making changes.
Check off each item manually before considering a change complete.

---

## Tasks

- [ ] Type a task and press Enter — task appears in the list
- [ ] Submit an empty or whitespace-only input — task is NOT added
- [ ] Click the checkbox on a task — task is marked done (strikethrough style)
- [ ] Click the checkbox again — task is marked undone
- [ ] Click a task's text — enters inline edit mode
- [ ] While editing: press Enter — saves the new text
- [ ] While editing: press Escape — cancels, restores original text
- [ ] Click the × button on a task — task is removed
- [ ] Drag a task by its handle — task reorders correctly

---

## Lists

- [ ] Click "+ New list" — input appears
- [ ] Type a name and press Enter (or click Add) — new list is created and becomes active
- [ ] Press Escape while naming a new list — input dismissed, no list created
- [ ] Click a tab — switches to that list (tasks and notes update)
- [ ] Double-click a tab name — enters rename mode
- [ ] While renaming: press Enter — saves new name
- [ ] While renaming: press Escape — cancels rename
- [ ] While renaming: click away (blur) — saves new name
- [ ] Click × on an empty list — list is deleted immediately (no modal)
- [ ] Click × on a list that has tasks — confirmation modal appears
- [ ] In modal: click Confirm — list is deleted
- [ ] In modal: click Cancel (or overlay) — modal closes, list is NOT deleted
- [ ] Delete the only list — a new "My Tasks" list is created automatically
- [ ] Switching lists resets the filter to "All"
- [ ] Adding a new list sets it as the active list immediately

---

## Filters

- [ ] Click "All" — shows all tasks
- [ ] Click "Active" — shows only incomplete tasks
- [ ] Click "Done" — shows only completed tasks
- [ ] Stats counter reads "X of Y completed" and updates as tasks are toggled

---

## Quick Notes

- [ ] Type in the notes panel — text appears
- [ ] Wait ~1 second after typing — "Saved" badge briefly appears
- [ ] Switch to a different list — notes area shows that list's notes (different content)
- [ ] Switch back — original notes are still there
- [ ] Bold button (or Ctrl+B) — toggles bold on selected text; button highlights when active
- [ ] Italic button (or Ctrl+I) — toggles italic on selected text; button highlights when active
- [ ] Bullet list button — toggles an unordered list; button highlights when active
- [ ] Ordered list button — toggles a numbered list; button highlights when active
- [ ] Undo button — undoes last edit
- [ ] Redo button — redoes last undone edit
- [ ] Drag the left edge of the notes panel — panel resizes
- [ ] Panel width cannot go below 200px or above 600px
- [ ] Refresh the page — notes panel width is the same as before

---

## Theme

- [ ] Click "Light" in settings — app switches to light theme
- [ ] Click "Dark" in settings — app switches to dark theme
- [ ] Refresh the page — theme is the same as before

---

## Export

- [ ] Open settings, click "Copy" — JSON is copied to clipboard; settings panel closes
- [ ] Open settings, click "Save file" — file picker opens; saving produces a valid `tasks.json`
- [ ] Exported JSON contains: `lists` (each with `id`, `name`, `tasks`, `notes`), `activeListId`, `filter`
- [ ] Notes content is present in the exported file (type notes, wait for "Saved", then export)

---

## Import

- [ ] Open settings, click "Open file" — file picker opens
- [ ] Select a valid `tasks.json` — lists, tasks, and notes load; settings panel closes
- [ ] Notes appear in the editor immediately after import (no page refresh needed)
- [ ] Active list and filter are restored to the values from the file
- [ ] Select an invalid or corrupt JSON file — an alert appears; app state is unchanged

---

## Activity Log

- [ ] Click the log toggle button in the header — log panel opens
- [ ] Click × in the log panel — log panel closes
- [ ] Refresh the page — log open/closed state is the same as before
- [ ] Log shows entries newest-first with a timestamp (HH:MM) and message
- [ ] "No activity yet." shown when the log is empty
- [ ] Log never grows past 50 entries
- [ ] Each of the following actions creates a log entry:
  - [ ] Task added → `Task added: "…"`
  - [ ] Task deleted → `Task deleted: "…"`
  - [ ] Task marked done → `Task done: "…"`
  - [ ] Task marked undone → `Task undone: "…"`
  - [ ] Task text edited → `Task edited: "…"`
  - [ ] List created → `List created: "…"`
  - [ ] List renamed → `List renamed to "…"`
  - [ ] List deleted → `List deleted: "…"`
  - [ ] Data imported → `Data imported`

---

## Persistence (page refresh)

- [ ] Tasks survive a page refresh
- [ ] Completed state on tasks survives a page refresh
- [ ] All lists survive a page refresh
- [ ] Active list is the same after refresh
- [ ] Filter is the same after refresh
- [ ] Theme is the same after refresh
- [ ] Notes panel width is the same after refresh
- [ ] Activity log entries are the same after refresh (up to 50)
- [ ] Notes content per list survives a page refresh
