/* =====================================================
   app.js — Focus Dashboard
   Sections : Greeting · Timer · To-Do · Quick Links
   Extras   : Toast · Theme · LocalStorage · Keyboard nav
   ===================================================== */

'use strict';

/* ─────────────────────────────────────────────────────
   UTILITIES
───────────────────────────────────────────────────── */

/** Shorthand querySelector */
const $ = (sel) => document.querySelector(sel);

/** Read a JSON value from localStorage, or return fallback */
function lsGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

/** Write a value to localStorage as JSON */
const lsSet = (key, val) => localStorage.setItem(key, JSON.stringify(val));

/** Generate a lightweight unique ID */
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/** Escape HTML to prevent XSS */
function escHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}


/* ─────────────────────────────────────────────────────
   TOAST NOTIFICATIONS
───────────────────────────────────────────────────── */
const toastContainer = $('#toastContainer');

/**
 * Show a temporary toast message.
 * @param {string} message   - Text to display
 * @param {string} [icon]    - Emoji icon (default ✅)
 * @param {number} [duration] - Visible ms (default 3000)
 */
function showToast(message, icon = '✅', duration = 3000) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<span>${icon}</span><span>${escHtml(message)}</span>`;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('toast-out');
    toast.addEventListener('animationend', () => toast.remove(), { once: true });
  }, duration);
}


/* ─────────────────────────────────────────────────────
   1. GREETING — Live clock, date & time-based welcome
───────────────────────────────────────────────────── */
const clockEl  = $('#clock');
const dateEl   = $('#dateDisplay');
const greetEl  = $('#greeting');

/** Return greeting + emoji keyed to hour of day */
function getGreeting(hour) {
  if (hour >= 5  && hour < 12) return '☀️ Good Morning!';
  if (hour >= 12 && hour < 17) return '🌤 Good Afternoon!';
  if (hour >= 17 && hour < 21) return '🌆 Good Evening!';
  return '🌙 Good Night!';
}

function updateClock() {
  const now = new Date();
  const hh  = String(now.getHours()).padStart(2, '0');
  const mm  = String(now.getMinutes()).padStart(2, '0');
  const ss  = String(now.getSeconds()).padStart(2, '0');

  clockEl.textContent = `${hh}:${mm}:${ss}`;
  greetEl.textContent = getGreeting(now.getHours());
  dateEl.textContent  = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

updateClock();
setInterval(updateClock, 1000);


/* ─────────────────────────────────────────────────────
   2. FOCUS TIMER — Pomodoro with adjustable presets
───────────────────────────────────────────────────── */
const timerSection  = $('#timerSection');
const timerDisplay  = $('#timerDisplay');
const timerStatus   = $('#timerStatus');
const timerLabel    = $('#timerLabel');
const startBtn      = $('#startBtn');
const stopBtn       = $('#stopBtn');
const resetBtn      = $('#resetBtn');
const progressRing  = $('#progressRing');
const sessionCountEl = $('#sessionCount');

/* r=52 → circumference = 2π×52 ≈ 326.73 */
const CIRCUMFERENCE = 326.73;

let timerInterval    = null;
let totalSeconds     = 25 * 60;
let remainingSeconds = totalSeconds;
let isRunning        = false;
let isBreak          = false;
let sessionCount     = lsGet('sessionCount', 0);

sessionCountEl.textContent = sessionCount;

/** Format seconds → "MM:SS" */
const fmtTime = (secs) =>
  `${String(Math.floor(secs / 60)).padStart(2, '0')}:${String(secs % 60).padStart(2, '0')}`;

/** Sync ring stroke-dashoffset to remaining time */
function updateRing(remaining, total) {
  const pct    = total > 0 ? remaining / total : 0;
  const offset = CIRCUMFERENCE * (1 - pct);
  progressRing.style.strokeDashoffset = offset;
}

/** Re-render the timer display, ring and tab title */
function renderTimer() {
  const label          = fmtTime(remainingSeconds);
  timerDisplay.textContent = label;
  document.title       = isRunning ? `${label} — Focus Dashboard` : 'Focus Dashboard';
  updateRing(remainingSeconds, totalSeconds);
}

function startTimer() {
  if (isRunning) return;
  isRunning = true;
  timerSection.classList.add('timer-running');
  startBtn.disabled    = true;
  timerStatus.textContent = isBreak ? '🌿 Break running…' : '🔥 Focus running…';

  timerInterval = setInterval(() => {
    remainingSeconds--;
    renderTimer();

    if (remainingSeconds <= 0) {
      clearInterval(timerInterval);
      isRunning = false;
      startBtn.disabled = false;
      timerSection.classList.remove('timer-running');
      document.title = 'Focus Dashboard';

      if (!isBreak) {
        // Work session finished → increment counter
        sessionCount++;
        sessionCountEl.textContent = sessionCount;
        lsSet('sessionCount', sessionCount);
        showToast('Focus session complete! Take a break 🎉', '🎯', 4000);
        sendBrowserNotification('🎯 Focus session complete!', 'Time for a short break.');
        switchToBreak();
      } else {
        // Break finished → back to work
        showToast('Break over — back to work! 💪', '⏰', 4000);
        sendBrowserNotification('⏰ Break over!', 'Ready for the next focus session?');
        switchToWork();
      }
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  isRunning = false;
  startBtn.disabled = false;
  timerSection.classList.remove('timer-running');
  timerStatus.textContent = 'Paused';
  document.title = 'Focus Dashboard';
}

function resetTimer() {
  stopTimer();
  remainingSeconds    = totalSeconds;
  timerStatus.textContent = 'Ready';
  renderTimer();
}

function switchToBreak() {
  isBreak = true;
  totalSeconds     = 5 * 60;
  remainingSeconds = totalSeconds;
  timerLabel.textContent = 'Break';
  timerLabel.classList.add('break');
  timerStatus.textContent = 'Break time!';
  renderTimer();
}

function switchToWork() {
  isBreak = false;
  timerLabel.textContent = 'Work';
  timerLabel.classList.remove('break');
  timerStatus.textContent = 'Ready';
  // Restore the currently selected preset
  const activePreset = document.querySelector('.preset-btn.active-preset');
  const mins = activePreset ? Number(activePreset.dataset.minutes) : 25;
  totalSeconds     = mins * 60;
  remainingSeconds = totalSeconds;
  renderTimer();
}

function setPreset(minutes) {
  stopTimer();
  isBreak          = false;
  timerLabel.textContent = 'Work';
  timerLabel.classList.remove('break');
  totalSeconds     = minutes * 60;
  remainingSeconds = totalSeconds;
  timerStatus.textContent = 'Ready';
  renderTimer();
}

function sendBrowserNotification(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(title, { body });
  }
}

// Request notification permission on first user interaction
document.addEventListener('click', () => {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}, { once: true });

startBtn.addEventListener('click', startTimer);
stopBtn.addEventListener('click',  stopTimer);
resetBtn.addEventListener('click', resetTimer);

document.querySelectorAll('.preset-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.preset-btn').forEach((b) => b.classList.remove('active-preset'));
    btn.classList.add('active-preset');
    setPreset(Number(btn.dataset.minutes));
  });
});

renderTimer();


/* ─────────────────────────────────────────────────────
   3. TO-DO LIST — Add, Edit, Complete, Delete, Sort
───────────────────────────────────────────────────── */
const taskInput    = $('#taskInput');
const taskCharCount = $('#taskCharCount');
const addTaskBtn   = $('#addTaskBtn');
const taskListEl   = $('#taskList');
const emptyTasks   = $('#emptyTasks');
const sortSelect   = $('#sortSelect');
const taskStatsEl  = $('#taskStats');
const taskProgress = $('#taskProgress');
const clearDoneBtn = $('#clearDoneBtn');

const editModal    = $('#editModal');
const editTaskInput = $('#editTaskInput');
const saveEditBtn  = $('#saveEditBtn');
const cancelEditBtn = $('#cancelEditBtn');

let tasks     = lsGet('tasks', []);
let editingId = null;

const saveTasks = () => lsSet('tasks', tasks);

/* -- Character counter for task input -- */
taskInput.addEventListener('input', () => {
  const len = taskInput.value.length;
  taskCharCount.textContent = `${len}/120`;
  taskCharCount.style.opacity = len > 0 ? '1' : '0';
  taskCharCount.style.color = len > 100 ? '#f87171' : '';
});

/* -- Sorting -- */
function getSortedTasks() {
  const mode = sortSelect.value;
  const copy = [...tasks];
  if (mode === 'az')        copy.sort((a, b) => a.text.localeCompare(b.text));
  else if (mode === 'za')   copy.sort((a, b) => b.text.localeCompare(a.text));
  else if (mode === 'active')    copy.sort((a, b) => Number(a.completed) - Number(b.completed));
  else if (mode === 'completed') copy.sort((a, b) => Number(b.completed) - Number(a.completed));
  return copy; // 'default' = insertion order
}

/* -- Stats bar (e.g. "3 / 5 done") -- */
function updateTaskStats() {
  const total = tasks.length;
  const done  = tasks.filter((t) => t.completed).length;
  taskStatsEl.textContent = total > 0 ? `${done} / ${total} done` : '';
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  taskProgress.style.width = `${pct}%`;
}

/* -- Render list -- */
function renderTasks() {
  taskListEl.innerHTML = '';
  const sorted = getSortedTasks();
  const isEmpty = sorted.length === 0;

  emptyTasks.classList.toggle('hidden', !isEmpty);
  updateTaskStats();

  sorted.forEach((task, idx) => {
    const li = document.createElement('li');
    li.className = `task-item${task.completed ? ' completed' : ''}`;
    li.dataset.id = task.id;
    li.style.animationDelay = `${idx * 30}ms`;

    li.innerHTML = `
      <input
        type="checkbox"
        class="task-check"
        aria-label="Mark &quot;${escHtml(task.text)}&quot; complete"
        ${task.completed ? 'checked' : ''}
      />
      <span class="task-label">${escHtml(task.text)}</span>
      <button class="task-btn edit-btn"   title="Edit"   aria-label="Edit task">✏️</button>
      <button class="task-btn delete-btn" title="Delete" aria-label="Delete task">🗑️</button>
    `;

    li.querySelector('.task-check').addEventListener('change', () => toggleTask(task.id));
    li.querySelector('.edit-btn').addEventListener('click',   () => openEditModal(task.id));
    li.querySelector('.delete-btn').addEventListener('click', () => deleteTask(task.id));

    taskListEl.appendChild(li);
  });
}

function addTask() {
  const text = taskInput.value.trim();
  if (!text) {
    taskInput.focus();
    return;
  }
  tasks.push({ id: uid(), text, completed: false });
  saveTasks();
  renderTasks();
  taskInput.value = '';
  taskCharCount.style.opacity = '0';
  taskInput.focus();
  showToast(`Task added: "${text}"`, '📝');
}

function toggleTask(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  task.completed = !task.completed;
  saveTasks();
  renderTasks();
  if (task.completed) showToast('Task completed! 🎉', '✅', 2000);
}

function deleteTask(id) {
  const task = tasks.find((t) => t.id === id);
  tasks = tasks.filter((t) => t.id !== id);
  saveTasks();
  renderTasks();
  if (task) showToast(`Deleted: "${task.text}"`, '🗑️', 2000);
}

function openEditModal(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  editingId = id;
  editTaskInput.value = task.text;
  editModal.classList.remove('hidden');
  editTaskInput.focus();
  editTaskInput.select();
}

function closeEditModal() {
  editModal.classList.add('hidden');
  editingId = null;
}

function saveEdit() {
  const newText = editTaskInput.value.trim();
  if (!newText || !editingId) return;
  const task = tasks.find((t) => t.id === editingId);
  if (task) {
    task.text = newText;
    saveTasks();
    renderTasks();
    showToast('Task updated', '✏️', 2000);
  }
  closeEditModal();
}

// Clear all completed tasks
clearDoneBtn.addEventListener('click', () => {
  const count = tasks.filter((t) => t.completed).length;
  if (count === 0) { showToast('No completed tasks to clear', 'ℹ️', 2000); return; }
  tasks = tasks.filter((t) => !t.completed);
  saveTasks();
  renderTasks();
  showToast(`Cleared ${count} completed task${count > 1 ? 's' : ''}`, '🧹', 2500);
});

addTaskBtn.addEventListener('click', addTask);
taskInput.addEventListener('keydown',    (e) => { if (e.key === 'Enter') addTask(); });
sortSelect.addEventListener('change',    renderTasks);
saveEditBtn.addEventListener('click',    saveEdit);
cancelEditBtn.addEventListener('click',  closeEditModal);
editTaskInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') saveEdit();
  if (e.key === 'Escape') closeEditModal();
});
editModal.addEventListener('click', (e) => { if (e.target === editModal) closeEditModal(); });

// Global Escape key closes modal
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !editModal.classList.contains('hidden')) closeEditModal();
});

renderTasks();


/* ─────────────────────────────────────────────────────
   4. QUICK LINKS — Add, Remove, Favicon, Persist
───────────────────────────────────────────────────── */
const linkNameInput = $('#linkNameInput');
const linkUrlInput  = $('#linkUrlInput');
const addLinkBtn    = $('#addLinkBtn');
const linkListEl    = $('#linkList');
const emptyLinks    = $('#emptyLinks');
const linkCountEl   = $('#linkCount');

const DEFAULT_LINKS = [
  { id: uid(), name: 'Google',   url: 'https://www.google.com' },
  { id: uid(), name: 'Gmail',    url: 'https://mail.google.com' },
  { id: uid(), name: 'Calendar', url: 'https://calendar.google.com' },
  { id: uid(), name: 'YouTube',  url: 'https://www.youtube.com' },
];

let links = lsGet('links', null);
if (links === null) {
  links = DEFAULT_LINKS;
  lsSet('links', links);
}

const saveLinks = () => lsSet('links', links);

/** Return a favicon img element for a given URL, falls back gracefully */
function faviconImg(url) {
  const img = document.createElement('img');
  img.className = 'link-favicon';
  img.alt = '';
  img.loading = 'lazy';
  try {
    const origin = new URL(url).origin;
    img.src = `https://www.google.com/s2/favicons?domain=${encodeURIComponent(origin)}&sz=32`;
  } catch {
    img.style.display = 'none';
  }
  img.onerror = () => { img.style.display = 'none'; };
  return img;
}

function renderLinks() {
  linkListEl.innerHTML = '';
  const isEmpty = links.length === 0;
  emptyLinks.classList.toggle('hidden', !isEmpty);
  linkCountEl.textContent = links.length > 0 ? `${links.length} link${links.length > 1 ? 's' : ''}` : '';

  links.forEach((link, idx) => {
    const chip = document.createElement('div');
    chip.className = 'link-chip';
    chip.style.animationDelay = `${idx * 40}ms`;

    // Favicon
    chip.appendChild(faviconImg(link.url));

    // Anchor
    const anchor       = document.createElement('a');
    anchor.href        = link.url;
    anchor.target      = '_blank';
    anchor.rel         = 'noopener noreferrer';
    anchor.textContent = link.name;
    anchor.style.color = '#fff';
    anchor.style.textDecoration = 'none';
    chip.appendChild(anchor);

    // Remove button
    const removeBtn = document.createElement('button');
    removeBtn.className = 'link-chip-remove';
    removeBtn.title = `Remove ${link.name}`;
    removeBtn.setAttribute('aria-label', `Remove ${link.name}`);
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', () => {
      links = links.filter((l) => l.id !== link.id);
      saveLinks();
      renderLinks();
      showToast(`Removed: ${link.name}`, '🔗', 2000);
    });
    chip.appendChild(removeBtn);

    linkListEl.appendChild(chip);
  });
}

function addLink() {
  const name = linkNameInput.value.trim();
  let   url  = linkUrlInput.value.trim();
  if (!name || !url) {
    showToast('Please fill in both name and URL', '⚠️', 2500);
    return;
  }

  // Auto-prepend protocol if missing
  if (!/^https?:\/\//i.test(url)) url = 'https://' + url;

  try { new URL(url); } catch {
    showToast('Please enter a valid URL', '⚠️', 2500);
    linkUrlInput.focus();
    return;
  }

  links.push({ id: uid(), name, url });
  saveLinks();
  renderLinks();
  linkNameInput.value = '';
  linkUrlInput.value  = '';
  linkNameInput.focus();
  showToast(`Added: ${name}`, '🔗', 2000);
}

addLinkBtn.addEventListener('click', addLink);
linkUrlInput.addEventListener('keydown',  (e) => { if (e.key === 'Enter') addLink(); });
linkNameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') linkUrlInput.focus(); });

renderLinks();


/* ─────────────────────────────────────────────────────
   5. THEME TOGGLE — Dark ↔ Light with persistence
───────────────────────────────────────────────────── */
const themeToggle = $('#themeToggle');
const themeIcon   = $('#themeIcon');
const htmlEl      = document.documentElement;

let currentTheme = lsGet('theme', 'dark');

function applyTheme(theme) {
  htmlEl.setAttribute('data-theme', theme);
  themeIcon.textContent = theme === 'dark' ? '🌙' : '☀️';
  lsSet('theme', theme);
  currentTheme = theme;
}

themeToggle.addEventListener('click', () => {
  const next = currentTheme === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  showToast(`Switched to ${next} mode`, next === 'dark' ? '🌙' : '☀️', 1800);
});

// Apply persisted theme immediately on load
applyTheme(currentTheme);
