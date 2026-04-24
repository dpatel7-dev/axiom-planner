// ==========================================================
// AXIOM PLANNER — Frontend
// ==========================================================

const api = {
  async req(path, opts = {}) {
    const res = await fetch(path, {
      ...opts,
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) }
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Request failed');
    return data;
  },
  me: () => api.req('/api/auth/me'),
  login: (username, password) => api.req('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  signup: (username, password) => api.req('/api/auth/signup', { method: 'POST', body: JSON.stringify({ username, password }) }),
  logout: () => api.req('/api/auth/logout', { method: 'POST' }),

  tasks: () => api.req('/api/tasks'),
  createTask: (t) => api.req('/api/tasks', { method: 'POST', body: JSON.stringify(t) }),
  updateTask: (id, t) => api.req('/api/tasks/' + id, { method: 'PATCH', body: JSON.stringify(t) }),
  deleteTask: (id) => api.req('/api/tasks/' + id, { method: 'DELETE' }),

  notes: () => api.req('/api/notes'),
  createNote: (n) => api.req('/api/notes', { method: 'POST', body: JSON.stringify(n) }),
  updateNote: (id, n) => api.req('/api/notes/' + id, { method: 'PATCH', body: JSON.stringify(n) }),
  deleteNote: (id) => api.req('/api/notes/' + id, { method: 'DELETE' }),

  reminders: () => api.req('/api/reminders'),
  dueReminders: () => api.req('/api/reminders/due'),
  createReminder: (r) => api.req('/api/reminders', { method: 'POST', body: JSON.stringify(r) }),
  deleteReminder: (id) => api.req('/api/reminders/' + id, { method: 'DELETE' }),
};

// App state
const state = {
  user: null,
  tasks: [],
  notes: [],
  reminders: [],
  currentView: 'today',
  taskFilter: 'all',
  selectedNoteId: null,
  calMonth: new Date().getMonth(),
  calYear: new Date().getFullYear(),
  selectedCalDate: null,
  editingTaskId: null,
  noteSaveTimer: null,
};

// ==========================================================
// FIREFLY PARTICLES (animated bg layer)
// ==========================================================
function spawnParticles() {
  const container = document.getElementById('bgParticles');
  const count = 30;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = Math.random() * 100 + '%';
    p.style.top = (100 + Math.random() * 20) + '%';
    const size = 2 + Math.random() * 3;
    p.style.width = size + 'px';
    p.style.height = size + 'px';
    p.style.setProperty('--dx', (Math.random() * 200 - 100) + 'px');
    const dur = 15 + Math.random() * 25;
    p.style.animationDuration = dur + 's';
    p.style.animationDelay = (Math.random() * dur) + 's';
    container.appendChild(p);
  }
}

// ==========================================================
// AUTH
// ==========================================================
let authTab = 'login';

document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    authTab = tab.dataset.tab;
    document.getElementById('authSubmit').textContent = authTab === 'login' ? 'Enter Axiom' : 'Create Account';
  });
});

document.getElementById('authForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const username = document.getElementById('authUsername').value.trim();
  const password = document.getElementById('authPassword').value;
  const errEl = document.getElementById('authError');
  errEl.textContent = '';

  try {
    if (authTab === 'login') await api.login(username, password);
    else await api.signup(username, password);
    await enterApp();
  } catch (err) {
    errEl.textContent = err.message;
  }
});

document.getElementById('logoutBtn').addEventListener('click', async () => {
  await api.logout();
  state.user = null;
  showScreen('authScreen');
});

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

async function enterApp() {
  const { user } = await api.me();
  state.user = user;
  document.getElementById('userName').textContent = user.username;
  updateStreakDisplay();
  showScreen('appScreen');
  await Promise.all([loadTasks(), loadNotes(), loadReminders()]);
  renderAll();
  checkDueReminders();
  // Poll for due reminders every 30s
  setInterval(checkDueReminders, 30000);
}

function updateStreakDisplay() {
  const u = state.user;
  document.getElementById('streakNum').textContent = u.streak_count || 0;
  document.getElementById('streakHeroNum').textContent = u.streak_count || 0;
  document.getElementById('longestStreak').textContent = u.longest_streak || 0;

  const quotes = {
    0: 'Sign in every day to begin your streak.',
    1: 'A single candle lit. Keep it burning.',
    3: 'Three days. The habit begins to form.',
    7: 'A full week. You are becoming who you wish to be.',
    14: 'Two weeks of showing up. Remarkable.',
    30: 'A month of consistency. This is discipline.',
    60: 'Sixty days. You are unstoppable.',
    100: 'One hundred days. A masterwork of persistence.',
  };
  const s = u.streak_count || 0;
  let quote = quotes[0];
  for (const k of Object.keys(quotes).map(Number).sort((a, b) => a - b)) {
    if (s >= k) quote = quotes[k];
  }
  document.getElementById('streakQuote').textContent = quote;
}

// ==========================================================
// NAVIGATION
// ==========================================================
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    const view = item.dataset.view;
    switchView(view);
  });
});

function switchView(view) {
  state.currentView = view;
  document.querySelectorAll('.nav-item').forEach(i => {
    i.classList.toggle('active', i.dataset.view === view);
  });
  document.querySelectorAll('.view').forEach(v => {
    v.classList.toggle('active', v.dataset.view === view);
  });
  if (view === 'calendar') renderCalendar();
  if (view === 'today') renderToday();
}

// ==========================================================
// TASKS
// ==========================================================
async function loadTasks() {
  const { tasks } = await api.tasks();
  state.tasks = tasks;
}

function renderTasks() {
  const list = document.getElementById('tasksList');
  let tasks = state.tasks;
  if (state.taskFilter === 'open') tasks = tasks.filter(t => !t.completed);
  if (state.taskFilter === 'done') tasks = tasks.filter(t => t.completed);

  if (tasks.length === 0) {
    list.innerHTML = '<p class="list-empty">Nothing here. Create your first task.</p>';
    return;
  }
  list.innerHTML = tasks.map(taskHTML).join('');
  attachTaskHandlers(list);
}

function taskHTML(t) {
  const due = t.due_date ? formatDate(t.due_date) : '';
  const time = t.due_time ? formatTime(t.due_time) : '';
  const dueStr = [due, time].filter(Boolean).join(' · ');
  return `
    <div class="task-item ${t.completed ? 'done' : ''}" data-id="${t.id}">
      <button class="task-check ${t.completed ? 'checked' : ''}" data-act="toggle"></button>
      <div class="task-body">
        <div class="task-title">${escapeHtml(t.title)}</div>
        ${t.description ? `<div class="task-desc">${escapeHtml(t.description)}</div>` : ''}
        <div class="task-meta">
          ${t.priority ? `<span class="priority ${t.priority}">${t.priority}</span>` : ''}
          ${dueStr ? `<span>⌛ ${dueStr}</span>` : ''}
        </div>
      </div>
      <button class="task-del" data-act="delete" title="Delete">×</button>
    </div>
  `;
}

function attachTaskHandlers(container) {
  container.querySelectorAll('.task-item').forEach(el => {
    const id = +el.dataset.id;
    el.querySelector('[data-act="toggle"]').addEventListener('click', async () => {
      const task = state.tasks.find(t => t.id === id);
      const updated = await api.updateTask(id, { completed: !task.completed });
      Object.assign(task, updated.task);
      renderAll();
    });
    const delBtn = el.querySelector('[data-act="delete"]');
    if (delBtn) {
      delBtn.addEventListener('click', async (e) => {
        e.stopPropagation();
        if (!confirm('Delete this task?')) return;
        await api.deleteTask(id);
        state.tasks = state.tasks.filter(t => t.id !== id);
        renderAll();
      });
    }
  });
}

document.querySelectorAll('.task-filters .chip').forEach(chip => {
  chip.addEventListener('click', () => {
    document.querySelectorAll('.task-filters .chip').forEach(c => c.classList.remove('active'));
    chip.classList.add('active');
    state.taskFilter = chip.dataset.filter;
    renderTasks();
  });
});

document.getElementById('newTaskBtn').addEventListener('click', () => openTaskModal());

function openTaskModal(task = null) {
  state.editingTaskId = task ? task.id : null;
  document.getElementById('taskModalTitle').textContent = task ? 'Edit Task' : 'New Task';
  document.getElementById('taskTitleInput').value = task ? task.title : '';
  document.getElementById('taskDescInput').value = task ? (task.description || '') : '';
  document.getElementById('taskDateInput').value = task && task.due_date ? task.due_date.slice(0, 10) : '';
  document.getElementById('taskTimeInput').value = task && task.due_time ? task.due_time.slice(0, 5) : '';
  document.getElementById('taskPriorityInput').value = task ? task.priority : 'medium';
  openModal('taskModal');
}

document.getElementById('taskForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    title: document.getElementById('taskTitleInput').value.trim(),
    description: document.getElementById('taskDescInput').value.trim() || null,
    due_date: document.getElementById('taskDateInput').value || null,
    due_time: document.getElementById('taskTimeInput').value || null,
    priority: document.getElementById('taskPriorityInput').value,
  };
  try {
    if (state.editingTaskId) {
      const { task } = await api.updateTask(state.editingTaskId, payload);
      const idx = state.tasks.findIndex(t => t.id === state.editingTaskId);
      state.tasks[idx] = task;
    } else {
      const { task } = await api.createTask(payload);
      state.tasks.unshift(task);
    }
    closeModal();
    renderAll();
  } catch (err) {
    alert(err.message);
  }
});

// ==========================================================
// NOTES
// ==========================================================
async function loadNotes() {
  const { notes } = await api.notes();
  state.notes = notes;
}

function renderNotes() {
  const list = document.getElementById('notesList');
  if (state.notes.length === 0) {
    list.innerHTML = '<p class="list-empty" style="padding:12px">No notes yet.</p>';
    showEmptyNoteEditor();
    return;
  }
  list.innerHTML = state.notes.map(n => `
    <div class="note-list-item ${n.id === state.selectedNoteId ? 'active' : ''}" data-id="${n.id}">
      <div class="note-list-title">${escapeHtml(n.title || 'Untitled')}</div>
      <div class="note-list-preview">${escapeHtml((n.content || '').slice(0, 60))}</div>
    </div>
  `).join('');

  list.querySelectorAll('.note-list-item').forEach(el => {
    el.addEventListener('click', () => selectNote(+el.dataset.id));
  });

  if (state.selectedNoteId) selectNote(state.selectedNoteId);
  else if (state.notes.length > 0) selectNote(state.notes[0].id);
}

function selectNote(id) {
  state.selectedNoteId = id;
  const note = state.notes.find(n => n.id === id);
  if (!note) return showEmptyNoteEditor();

  document.querySelectorAll('.note-list-item').forEach(el => {
    el.classList.toggle('active', +el.dataset.id === id);
  });

  const editor = document.getElementById('noteEditor');
  editor.classList.remove('empty');
  document.getElementById('noteTitle').value = note.title || '';
  document.getElementById('noteContent').value = note.content || '';
  document.getElementById('noteSaveStatus').textContent = 'Saved';
}

function showEmptyNoteEditor() {
  const editor = document.getElementById('noteEditor');
  editor.classList.add('empty');
  document.getElementById('noteTitle').value = '';
  document.getElementById('noteContent').value = '';
  document.getElementById('noteSaveStatus').textContent = '';
}

document.getElementById('newNoteBtn').addEventListener('click', async () => {
  const { note } = await api.createNote({ title: 'Untitled', content: '' });
  state.notes.unshift(note);
  state.selectedNoteId = note.id;
  renderNotes();
  document.getElementById('noteTitle').focus();
});

document.getElementById('deleteNoteBtn').addEventListener('click', async () => {
  if (!state.selectedNoteId) return;
  if (!confirm('Delete this note?')) return;
  await api.deleteNote(state.selectedNoteId);
  state.notes = state.notes.filter(n => n.id !== state.selectedNoteId);
  state.selectedNoteId = state.notes[0] ? state.notes[0].id : null;
  renderNotes();
});

['noteTitle', 'noteContent'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    if (!state.selectedNoteId) return;
    document.getElementById('noteSaveStatus').textContent = 'Saving…';
    clearTimeout(state.noteSaveTimer);
    state.noteSaveTimer = setTimeout(async () => {
      const title = document.getElementById('noteTitle').value;
      const content = document.getElementById('noteContent').value;
      try {
        const { note } = await api.updateNote(state.selectedNoteId, { title, content });
        const idx = state.notes.findIndex(n => n.id === state.selectedNoteId);
        state.notes[idx] = note;
        // Update list item preview
        const li = document.querySelector(`.note-list-item[data-id="${note.id}"]`);
        if (li) {
          li.querySelector('.note-list-title').textContent = note.title || 'Untitled';
          li.querySelector('.note-list-preview').textContent = (note.content || '').slice(0, 60);
        }
        document.getElementById('noteSaveStatus').textContent = 'Saved';
      } catch (err) {
        document.getElementById('noteSaveStatus').textContent = 'Error saving';
      }
    }, 600);
  });
});

// ==========================================================
// REMINDERS
// ==========================================================
async function loadReminders() {
  const { reminders } = await api.reminders();
  state.reminders = reminders;
}

function renderReminders() {
  const list = document.getElementById('remindersList');
  if (state.reminders.length === 0) {
    list.innerHTML = '<p class="list-empty">No reminders set.</p>';
    return;
  }
  list.innerHTML = state.reminders.map(r => {
    const when = new Date(r.remind_at);
    const past = when < new Date();
    return `
      <div class="reminder-item ${past ? 'past' : ''}" data-id="${r.id}">
        <div class="reminder-bell">🔔</div>
        <div class="task-body">
          <div class="task-title">${escapeHtml(r.title)}</div>
          <div class="reminder-time">${formatDateTime(when)}</div>
        </div>
        <button class="reminder-del" data-act="delete">×</button>
      </div>
    `;
  }).join('');

  list.querySelectorAll('.reminder-item').forEach(el => {
    const id = +el.dataset.id;
    el.querySelector('[data-act="delete"]').addEventListener('click', async () => {
      if (!confirm('Delete this reminder?')) return;
      await api.deleteReminder(id);
      state.reminders = state.reminders.filter(r => r.id !== id);
      renderReminders();
      renderToday();
    });
  });
}

document.getElementById('newReminderBtn').addEventListener('click', () => {
  // Default to 1 hour from now
  const t = new Date(Date.now() + 60 * 60 * 1000);
  const local = new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  document.getElementById('reminderTitleInput').value = '';
  document.getElementById('reminderTimeInput').value = local;
  openModal('reminderModal');
});

document.getElementById('reminderForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    title: document.getElementById('reminderTitleInput').value.trim(),
    remind_at: new Date(document.getElementById('reminderTimeInput').value).toISOString(),
  };
  try {
    const { reminder } = await api.createReminder(payload);
    state.reminders.push(reminder);
    state.reminders.sort((a, b) => new Date(a.remind_at) - new Date(b.remind_at));
    closeModal();
    renderAll();
  } catch (err) {
    alert(err.message);
  }
});

async function checkDueReminders() {
  try {
    const { reminders } = await api.dueReminders();
    reminders.forEach(r => {
      showToast(r.title, 'Reminder · ' + formatDateTime(new Date(r.remind_at)));
      // Browser notification if permitted
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Axiom Reminder', { body: r.title });
      }
    });
    if (reminders.length > 0) {
      // Refresh list to show notified status
      await loadReminders();
      renderReminders();
    }
  } catch (e) { /* ignore */ }
}

function showToast(title, sub) {
  const stack = document.getElementById('toastStack');
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<div class="toast-title">🔔 ${escapeHtml(title)}</div><div class="toast-sub">${escapeHtml(sub || '')}</div>`;
  stack.appendChild(toast);
  setTimeout(() => {
    toast.style.transition = 'all 0.4s';
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 400);
  }, 6000);
}

// ==========================================================
// CALENDAR
// ==========================================================
function renderCalendar() {
  const grid = document.getElementById('calGrid');
  const year = state.calYear;
  const month = state.calMonth;
  const monthName = new Date(year, month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  document.getElementById('calLabel').textContent = monthName;

  const first = new Date(year, month, 1);
  const firstDay = first.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const daysInPrevMonth = new Date(year, month, 0).getDate();

  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);

  const cells = [];
  for (let i = firstDay - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i;
    cells.push({ day: d, otherMonth: true, dateStr: toDateStr(year, month - 1, d) });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, otherMonth: false, dateStr: toDateStr(year, month, d) });
  }
  while (cells.length % 7 !== 0 || cells.length < 42) {
    const d = cells.length - firstDay - daysInMonth + 1;
    cells.push({ day: d, otherMonth: true, dateStr: toDateStr(year, month + 1, d) });
    if (cells.length >= 42) break;
  }

  grid.innerHTML = cells.map(c => {
    const tasksHere = state.tasks.filter(t => t.due_date && t.due_date.slice(0, 10) === c.dateStr);
    const remindersHere = state.reminders.filter(r => r.remind_at.slice(0, 10) === c.dateStr);
    const dots = [...tasksHere, ...remindersHere].slice(0, 4).map(() => '<span class="cal-dot"></span>').join('');
    const isToday = c.dateStr === todayStr;
    const isSelected = c.dateStr === state.selectedCalDate;
    return `
      <div class="cal-day ${c.otherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-date="${c.dateStr}">
        <div class="cal-day-num">${c.day}</div>
        <div class="cal-day-dots">${dots}</div>
      </div>
    `;
  }).join('');

  grid.querySelectorAll('.cal-day').forEach(cell => {
    cell.addEventListener('click', () => {
      state.selectedCalDate = cell.dataset.date;
      renderCalendar();
      renderCalDayPanel();
    });
  });

  if (!state.selectedCalDate) state.selectedCalDate = todayStr;
  renderCalDayPanel();
}

function renderCalDayPanel() {
  const date = state.selectedCalDate;
  if (!date) return;
  const readable = new Date(date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  document.getElementById('calDayTitle').textContent = readable;

  const tasks = state.tasks.filter(t => t.due_date && t.due_date.slice(0, 10) === date);
  const reminders = state.reminders.filter(r => r.remind_at.slice(0, 10) === date);

  const list = document.getElementById('calDayList');
  if (tasks.length === 0 && reminders.length === 0) {
    list.innerHTML = '<p class="list-empty">Nothing scheduled.</p>';
    return;
  }
  let html = '';
  if (tasks.length) {
    html += tasks.map(taskHTML).join('');
  }
  if (reminders.length) {
    html += reminders.map(r => `
      <div class="reminder-item">
        <div class="reminder-bell">🔔</div>
        <div class="task-body">
          <div class="task-title">${escapeHtml(r.title)}</div>
          <div class="reminder-time">${formatTime(new Date(r.remind_at).toTimeString().slice(0, 5))}</div>
        </div>
      </div>
    `).join('');
  }
  list.innerHTML = html;
  attachTaskHandlers(list);
}

document.getElementById('calPrev').addEventListener('click', () => {
  state.calMonth--;
  if (state.calMonth < 0) { state.calMonth = 11; state.calYear--; }
  renderCalendar();
});
document.getElementById('calNext').addEventListener('click', () => {
  state.calMonth++;
  if (state.calMonth > 11) { state.calMonth = 0; state.calYear++; }
  renderCalendar();
});
document.getElementById('calToday').addEventListener('click', () => {
  const now = new Date();
  state.calMonth = now.getMonth();
  state.calYear = now.getFullYear();
  state.selectedCalDate = now.toISOString().slice(0, 10);
  renderCalendar();
});

// ==========================================================
// TODAY VIEW
// ==========================================================
function renderToday() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  document.getElementById('todayDate').textContent = dateStr;

  const hour = now.getHours();
  let greeting = 'Good evening';
  if (hour < 12) greeting = 'Good morning';
  else if (hour < 18) greeting = 'Good afternoon';
  document.getElementById('todayGreeting').textContent = greeting + ', ' + (state.user.username || '') + '.';

  const todayStr = now.toISOString().slice(0, 10);
  const todayTasks = state.tasks.filter(t => t.due_date && t.due_date.slice(0, 10) === todayStr);
  const todayTasksList = document.getElementById('todayTasksList');
  if (todayTasks.length === 0) {
    todayTasksList.innerHTML = '<p class="list-empty">Nothing due today.</p>';
  } else {
    todayTasksList.innerHTML = todayTasks.map(taskHTML).join('');
    attachTaskHandlers(todayTasksList);
  }

  // Upcoming reminders (next 7 days, not past)
  const soon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const upcoming = state.reminders
    .filter(r => {
      const t = new Date(r.remind_at);
      return t >= now && t <= soon;
    })
    .slice(0, 5);

  const reList = document.getElementById('todayRemindersList');
  if (upcoming.length === 0) {
    reList.innerHTML = '<p class="list-empty">No reminders coming up.</p>';
  } else {
    reList.innerHTML = upcoming.map(r => `
      <div class="reminder-item">
        <div class="reminder-bell">🔔</div>
        <div class="task-body">
          <div class="task-title">${escapeHtml(r.title)}</div>
          <div class="reminder-time">${formatDateTime(new Date(r.remind_at))}</div>
        </div>
      </div>
    `).join('');
  }
}

// ==========================================================
// MODALS
// ==========================================================
function openModal(id) {
  document.getElementById('modalBackdrop').classList.add('active');
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  // Focus first input
  setTimeout(() => {
    const first = document.getElementById(id).querySelector('input');
    if (first) first.focus();
  }, 50);
}
function closeModal() {
  document.getElementById('modalBackdrop').classList.remove('active');
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
}
document.querySelectorAll('.modal-cancel').forEach(b => b.addEventListener('click', closeModal));
document.getElementById('modalBackdrop').addEventListener('click', (e) => {
  if (e.target.id === 'modalBackdrop') closeModal();
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeModal();
});

// ==========================================================
// RENDER ALL
// ==========================================================
function renderAll() {
  renderTasks();
  renderNotes();
  renderReminders();
  renderToday();
  if (state.currentView === 'calendar') renderCalendar();
}

// ==========================================================
// HELPERS
// ==========================================================
function escapeHtml(str) {
  if (!str) return '';
  return String(str).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function formatDate(d) {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
function formatTime(t) {
  if (!t) return '';
  const [h, m] = t.split(':');
  const d = new Date();
  d.setHours(+h, +m);
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
function formatDateTime(d) {
  if (!(d instanceof Date)) d = new Date(d);
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}
function toDateStr(y, m, d) {
  const date = new Date(y, m, d);
  return date.toISOString().slice(0, 10);
}

// ==========================================================
// STARTUP
// ==========================================================
async function init() {
  spawnParticles();
  // Ask for notification permission (non-blocking)
  if ('Notification' in window && Notification.permission === 'default') {
    // Wait for user interaction before asking
  }
  try {
    await enterApp();
  } catch {
    showScreen('authScreen');
  }
}

// Ask for notification permission on first interaction
document.addEventListener('click', function askPerm() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
  document.removeEventListener('click', askPerm);
}, { once: true });

init();
