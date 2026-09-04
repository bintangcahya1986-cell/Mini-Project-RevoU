/* =====================================================
   app.js — Focus Dashboard
   Sections: Greeting | Timer | To-Do | Quick Links
   Storage : localStorage (tasks, links, theme, sessions)
   ===================================================== */

'use strict';

/* ─────────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────────── */
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

/** Read JSON from localStorage, return fallback on error */
function lsGet(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw !== null ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

/** Write a value to localStorage as JSON */
function lsSet(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

/** Generate a simple unique ID */
const uid = () => Math.random().toString(36).slice(2, 10);


/* ─────────────────────────────────────────────────────
   1. GREETING — Clock, Date, & Time-based Message
───────────────────────────────────────────────────── */
const clockEl   = $('#clock');
const dateEl    = $('#dateDisplay');
const greetEl   = $('#greeting');

function getGreeting(hour) {
  if (hour >= 5  && hour < 12) return '☀️ Good Morning!';
  if (hour >= 12 && hour < 17) return '🌤 Good Afternoon!';
  if (hour >= 17 && hour < 21) return '🌆 Good Evening!';
  return '🌙 Good Night!';
}

function updateClock() {
  const now  = new Date();
  const h    = String(now.getHours()).padStart(2, '0');
  const m    = String(now.getMinutes()).padStart(2, '0');
  const s    = String(now.getSeconds()).padStart(2, '0');

  clockEl.textContent = `${h}:${m}:${s}`;
  greetEl.textContent = getGreeting(now.getHours());

  dateEl.textContent = now.toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });
}

updateClock();
setInterval(updateClock, 1000);


/* ─────────────────────────────────────────────────────
   2. FOCUS TIMER — Pomodoro with adjustable presets
───────────────────────────────────────────────────── */
const timerDisplay   = $('#timerDisplay');
const startBtn       = $('#startBtn');
const stopBtn        = $('#stopBtn');
const resetBtn       = $('#resetBtn');
const progressRing   = $('#progressRing');
const sessionCountEl = $('#sessionCount');
const RING_CIRCUMFERENCE = 339.29; // 2π × r (r=54)

let timerInterval  = null;
let totalSeconds   = 25 * 60;  // active preset duration
let remainingSeconds = totalSeconds;
let isRunning      = false;
let sessionCount   = lsGet('sessionCount', 0);

sessionCountEl.textContent = sessionCount;

/** Format seconds as MM:SS */
function formatTime(secs) {
  const m = String(Math.floor(secs / 60)).padStart(2, '0');
  const s = String(secs % 60).padStart(2, '0');
  return `${m}:${s}`;
}

/** Update the SVG progress ring */
function updateRing(remaining, total) {
  const progress  = remaining / total;
  const offset    = RING_CIRCUMFERENCE * (1 - progress);
  progressRing.style.strokeDashoffset = offset;
}

function renderTimer() {
  timerDisplay.textContent = formatTime(remainingSeconds);
  updateRing(remainingSeconds, totalSeconds);
}

function startTimer() {
  if (isRunning) return;
  isRunning = true;
  timerDisplay.closest('section').classList.add('timer-running');
  startBtn.disabled = true;

  timerInterval = setInterval(() => {
    remainingSeconds--;
    renderTimer();

    if (remainingSeconds <= 0) {
      clearInterval(timerInterval);
      isRunning = false;
      startBtn.disabled = false;
      timerDisplay.closest('section').classList.remove('timer-running');
      sessionCount++;
      sessionCountEl.textContent = sessionCount;
      lsSet('sessionCount', sessionCount);
      // Browser notification
      notifySessionComplete();
      remainingSeconds = 0;
    }
  }, 1000);
}

function stopTimer() {
  clearInterval(timerInterval);
  isRunning = false;
  startBtn.disabled = false;
  timerDisplay.closest('section').classList.remove('timer-running');
}

function resetTimer() {
  stopTimer();
  remainingSeconds = totalSeconds;
  renderTimer();
}

function setPreset(minutes) {
  stopTimer();
  totalSeconds     = minutes * 60;
  remainingSeconds = totalSeconds;
  renderTimer();
}

function notifySessionComplete() {
  if ('Notification' in window && Notification.permission === 'granted') {
    new Notification('Focus session complete! 🎉', {
      body: 'Take a short break before starting again.',
      icon: 'https://twemoji.maxcdn.com/v/latest/72x72/1f3af.png',
    });
  } else {
    alert('⏰ Focus session complete! Great work — take a break.');
  }
}

// Request notification permission on first interaction
document.addEventListener('click', () => {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
}, { once: true });

startBtn.addEventListener('click', startTimer);
stopBtn.addEventListener('click', stopTimer);
resetBtn.addEventListener('click', resetTimer);

// Preset duration buttons
$$('.preset-btn').forEach((btn) => {
  btn.addEventListener('click', () => {
    $$('.preset-btn').forEach((b) => b.classList.remove('active-preset'));
    btn.classList.add('active-preset');
    setPreset(Number(btn.dataset.minutes));
  });
});

// Initial render
renderTimer();


/* ─────────────────────────────────────────────────────
   3. TO-DO LIST — Add, Edit, Complete, Delete, Sort
───────────────────────────────────────────────────── */
const taskInput    = $('#taskInput');
const addTaskBtn   = $('#addTaskBtn');
const taskList     = $('#taskList');
const emptyTasks   = $('#emptyTasks');
const sortSelect   = $('#sortSelect');
const editModal    = $('#editModal');
const editTaskInput = $('#editTaskInput');
const saveEditBtn  = $('#saveEditBtn');
const cancelEditBtn = $('#cancelEditBtn');

let tasks   = lsGet('tasks', []);
let editingId = null;

function saveTasks() { lsSet('tasks', tasks); }

function getSortedTasks() {
  const sortValue = sortSelect.value;
  const copy = [...tasks];

  if (sortValue === 'az') {
    copy.sort((a, b) => a.text.localeCompare(b.text));
  } else if (sortValue === 'za') {
    copy.sort((a, b) => b.text.localeCompare(a.text));
  } else if (sortValue === 'completed') {
    copy.sort((a, b) => Number(a.completed) - Number(b.completed));
  }
  // 'default' → insertion order

  return copy;
}

function renderTasks() {
  taskList.innerHTML = '';
  const sorted = getSortedTasks();

  emptyTasks.classList.toggle('hidden', sorted.length > 0);

  sorted.forEach((task) => {
    const li = document.createElement('li');
    li.className = `task-item${task.completed ? ' completed' : ''}`;
    li.dataset.id = task.id;

    li.innerHTML = `
      <input
        type="checkbox"
        class="task-check accent-[var(--color-accent)] w-4 h-4 cursor-pointer flex-shrink-0"
        aria-label="Mark task complete"
        ${task.completed ? 'checked' : ''}
      />
      <span class="task-label">${escapeHtml(task.text)}</span>
      <button class="task-btn edit-btn"   title="Edit task"   aria-label="Edit task">✏️</button>
      <button class="task-btn delete-btn" title="Delete task" aria-label="Delete task">🗑️</button>
    `;

    // Checkbox toggle
    li.querySelector('.task-check').addEventListener('change', () => {
      toggleTask(task.id);
    });

    // Edit button
    li.querySelector('.edit-btn').addEventListener('click', () => {
      openEditModal(task.id);
    });

    // Delete button
    li.querySelector('.delete-btn').addEventListener('click', () => {
      deleteTask(task.id);
    });

    taskList.appendChild(li);
  });
}

function addTask() {
  const text = taskInput.value.trim();
  if (!text) return;

  tasks.push({ id: uid(), text, completed: false });
  saveTasks();
  renderTasks();
  taskInput.value = '';
  taskInput.focus();
}

function toggleTask(id) {
  const task = tasks.find((t) => t.id === id);
  if (task) {
    task.completed = !task.completed;
    saveTasks();
    renderTasks();
  }
}

function deleteTask(id) {
  tasks = tasks.filter((t) => t.id !== id);
  saveTasks();
  renderTasks();
}

function openEditModal(id) {
  const task = tasks.find((t) => t.id === id);
  if (!task) return;
  editingId = id;
  editTaskInput.value = task.text;
  editModal.classList.remove('hidden');
  editTaskInput.focus();
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
  }
  closeEditModal();
}

/** Escape HTML to prevent XSS in task labels */
function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

addTaskBtn.addEventListener('click', addTask);
taskInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addTask(); });
sortSelect.addEventListener('change', renderTasks);
saveEditBtn.addEventListener('click', saveEdit);
cancelEditBtn.addEventListener('click', closeEditModal);
editTaskInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') saveEdit(); });

// Close modal on backdrop click
editModal.addEventListener('click', (e) => {
  if (e.target === editModal) closeEditModal();
});

renderTasks();


/* ─────────────────────────────────────────────────────
   4. QUICK LINKS — Add, Remove, Persist
───────────────────────────────────────────────────── */
const linkNameInput = $('#linkNameInput');
const linkUrlInput  = $('#linkUrlInput');
const addLinkBtn    = $('#addLinkBtn');
const linkList      = $('#linkList');
const emptyLinks    = $('#emptyLinks');

// Default links shown on first load
const DEFAULT_LINKS = [
  { id: uid(), name: 'Google',   url: 'https://www.google.com' },
  { id: uid(), name: 'Gmail',    url: 'https://mail.google.com' },
  { id: uid(), name: 'Calendar', url: 'https://calendar.google.com' },
];

let links = lsGet('links', null);
// If localStorage is empty (first visit), load defaults
if (links === null) {
  links = DEFAULT_LINKS;
  lsSet('links', links);
}

function saveLinks() { lsSet('links', links); }

function renderLinks() {
  linkList.innerHTML = '';
  emptyLinks.classList.toggle('hidden', links.length > 0);

  links.forEach((link) => {
    const chip = document.createElement('div');
    chip.className = 'link-chip';

    const anchor = document.createElement('a');
    anchor.href   = link.url;
    anchor.target = '_blank';
    anchor.rel    = 'noopener noreferrer';
    anchor.textContent = link.name;
    anchor.className   = 'text-white no-underline';

    const removeBtn = document.createElement('button');
    removeBtn.className   = 'link-chip-remove';
    removeBtn.title       = 'Remove link';
    removeBtn.setAttribute('aria-label', `Remove ${link.name}`);
    removeBtn.textContent = '✕';
    removeBtn.addEventListener('click', () => {
      links = links.filter((l) => l.id !== link.id);
      saveLinks();
      renderLinks();
    });

    chip.appendChild(anchor);
    chip.appendChild(removeBtn);
    linkList.appendChild(chip);
  });
}

function addLink() {
  const name = linkNameInput.value.trim();
  let   url  = linkUrlInput.value.trim();

  if (!name || !url) return;

  // Auto-prepend https:// if missing
  if (!/^https?:\/\//i.test(url)) {
    url = 'https://' + url;
  }

  // Basic URL validation
  try {
    new URL(url);
  } catch {
    linkUrlInput.setCustomValidity('Please enter a valid URL.');
    linkUrlInput.reportValidity();
    return;
  }
  linkUrlInput.setCustomValidity('');

  links.push({ id: uid(), name, url });
  saveLinks();
  renderLinks();
  linkNameInput.value = '';
  linkUrlInput.value  = '';
  linkNameInput.focus();
}

addLinkBtn.addEventListener('click', addLink);
linkUrlInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') addLink(); });
linkNameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') linkUrlInput.focus(); });

renderLinks();


/* ─────────────────────────────────────────────────────
   5. THEME TOGGLE — Light / Dark Mode
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
  applyTheme(currentTheme === 'dark' ? 'light' : 'dark');
});

// Apply saved theme on load
applyTheme(currentTheme);
