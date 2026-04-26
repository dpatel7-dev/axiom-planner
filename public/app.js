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

  subjects: () => api.req('/api/subjects'),
  createSubject: (s) => api.req('/api/subjects', { method: 'POST', body: JSON.stringify(s) }),
  updateSubject: (id, s) => api.req('/api/subjects/' + id, { method: 'PATCH', body: JSON.stringify(s) }),
  deleteSubject: (id) => api.req('/api/subjects/' + id, { method: 'DELETE' }),

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

  // Import / AI
  importSettings: () => api.req('/api/import/settings'),
  saveGeminiKey: (gemini_api_key) => api.req('/api/import/settings', { method: 'POST', body: JSON.stringify({ gemini_api_key }) }),
  removeGeminiKey: () => api.req('/api/import/settings', { method: 'DELETE' }),
  feeds: () => api.req('/api/import/feeds'),
  addFeed: (url, label) => api.req('/api/import/feeds', { method: 'POST', body: JSON.stringify({ url, label }) }),
  deleteFeed: (id) => api.req('/api/import/feeds/' + id, { method: 'DELETE' }),
  syncFeed: (id, useAi) => api.req('/api/import/feeds/' + id + '/sync', { method: 'POST', body: JSON.stringify({ useAi, daysAhead: 21 }) }),
};

// App state
const state = {
  user: null,
  subjects: [],
  tasks: [],
  notes: [],
  reminders: [],
  currentView: 'today',
  taskFilter: 'all',
  taskSubjectFilter: '',
  selectedNoteId: null,
  calMonth: new Date().getMonth(),
  calYear: new Date().getFullYear(),
  selectedCalDate: null,
  editingTaskId: null,
  editingSubjectId: null,
  noteSaveTimer: null,
};

// Predefined color palette (curated to look good against the dawn background)
const SUBJECT_COLORS = [
  '#d4a857', // gold
  '#e08667', // coral
  '#b8c9e0', // powder blue
  '#8fb67c', // sage
  '#c9a3d4', // lilac
  '#f0c274', // peach
  '#7ab0c4', // teal
  '#d68aa3', // rose
  '#a8b87c', // olive
  '#9cabbf', // slate blue
];

// ==========================================================
// BACKGROUND PARTICLES
// ==========================================================
function spawnParticles() {
  const fireflyContainer = document.getElementById('bgParticles');
  for (let i = 0; i < 35; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    p.style.left = Math.random() * 100 + '%';
    p.style.top = (100 + Math.random() * 20) + '%';
    const size = 2 + Math.random() * 3;
    p.style.width = size + 'px';
    p.style.height = size + 'px';
    p.style.setProperty('--dx', (Math.random() * 240 - 120) + 'px');
    const dur = 18 + Math.random() * 28;
    p.style.animationDuration = dur + 's';
    p.style.animationDelay = (Math.random() * dur) + 's';
    fireflyContainer.appendChild(p);
  }

  const sparkContainer = document.getElementById('bgSparks');
  for (let i = 0; i < 15; i++) {
    const s = document.createElement('div');
    s.className = 'spark';
    s.style.left = Math.random() * 100 + '%';
    s.style.top = (100 + Math.random() * 10) + '%';
    s.style.setProperty('--dx', (Math.random() * 100 - 50) + 'px');
    const dur = 8 + Math.random() * 12;
    s.style.animationDuration = dur + 's';
    s.style.animationDelay = (Math.random() * dur) + 's';
    sparkContainer.appendChild(s);
  }

  const dustContainer = document.getElementById('bgDust');
  for (let i = 0; i < 12; i++) {
    const d = document.createElement('div');
    d.className = 'dust';
    d.style.left = Math.random() * 100 + '%';
    d.style.top = (100 + Math.random() * 30) + '%';
    const size = 6 + Math.random() * 8;
    d.style.width = size + 'px';
    d.style.height = size + 'px';
    d.style.setProperty('--dx', (Math.random() * 400 - 200) + 'px');
    const dur = 35 + Math.random() * 35;
    d.style.animationDuration = dur + 's';
    d.style.animationDelay = (Math.random() * dur) + 's';
    dustContainer.appendChild(d);
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
  showScreen('appScreen');
  await Promise.all([loadSubjects(), loadTasks(), loadNotes(), loadReminders()]);
  populateSubjectSelects();
  renderAll();
  checkDueReminders();
  setInterval(checkDueReminders, 30000);
}

// ==========================================================
// NAVIGATION
// ==========================================================
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => switchView(item.dataset.view));
});

function switchView(view) {
  state.currentView = view;
  document.querySelectorAll('.nav-item').forEach(i => i.classList.toggle('active', i.dataset.view === view));
  document.querySelectorAll('.view').forEach(v => v.classList.toggle('active', v.dataset.view === view));
  if (view === 'calendar') renderCalendar();
  if (view === 'today') renderToday();
  if (view === 'subjects') renderSubjects();
  if (view === 'import') loadImportView();
}

// ==========================================================
// SUBJECTS
// ==========================================================
async function loadSubjects() {
  const { subjects } = await api.subjects();
  state.subjects = subjects;
}

function renderSubjects() {
  const grid = document.getElementById('subjectsGrid');
  if (state.subjects.length === 0) {
    grid.innerHTML = `
      <div class="subject-card-empty">
        No classes yet. Click "+ Add Class" to add your first one — it works for any class, period, or course you take.
      </div>`;
    return;
  }
  grid.innerHTML = state.subjects.map(s => `
    <div class="subject-card" data-id="${s.id}" style="border-left-color:${s.color}">
      <div class="subject-card-name">${escapeHtml(s.name)}</div>
      <div class="subject-card-meta">
        ${[s.teacher, s.room].filter(Boolean).map(escapeHtml).join(' · ') || '&nbsp;'}
      </div>
      <div class="subject-card-stats">
        <div class="subject-card-count">
          <strong>${s.open_tasks || 0}</strong>open
          <span style="margin-left:10px"><strong>${s.total_tasks || 0}</strong>total</span>
        </div>
      </div>
    </div>
  `).join('');

  grid.querySelectorAll('.subject-card').forEach(card => {
    card.addEventListener('click', () => {
      const id = +card.dataset.id;
      openSubjectModal(state.subjects.find(s => s.id === id));
    });
  });
}

function openSubjectModal(subject = null) {
  state.editingSubjectId = subject ? subject.id : null;
  document.getElementById('subjectModalTitle').textContent = subject ? 'Edit Class' : 'Add Class';
  document.getElementById('subjectNameInput').value = subject ? subject.name : '';
  document.getElementById('subjectTeacherInput').value = subject && subject.teacher ? subject.teacher : '';
  document.getElementById('subjectRoomInput').value = subject && subject.room ? subject.room : '';
  const color = subject ? subject.color : SUBJECT_COLORS[0];
  document.getElementById('subjectColorInput').value = color;
  renderColorPicker(color);
  document.getElementById('subjectDeleteBtn').style.display = subject ? 'inline-block' : 'none';
  openModal('subjectModal');
}

function renderColorPicker(selectedColor) {
  const picker = document.getElementById('subjectColorPicker');
  picker.innerHTML = SUBJECT_COLORS.map(c => `
    <div class="color-swatch ${c === selectedColor ? 'selected' : ''}"
         style="background:${c}" data-color="${c}"></div>
  `).join('');
  picker.querySelectorAll('.color-swatch').forEach(sw => {
    sw.addEventListener('click', () => {
      picker.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
      document.getElementById('subjectColorInput').value = sw.dataset.color;
    });
  });
}

document.getElementById('subjectForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const payload = {
    name: document.getElementById('subjectNameInput').value.trim(),
    teacher: document.getElementById('subjectTeacherInput').value.trim() || null,
    room: document.getElementById('subjectRoomInput').value.trim() || null,
    color: document.getElementById('subjectColorInput').value,
  };
  try {
    if (state.editingSubjectId) {
      const { subject } = await api.updateSubject(state.editingSubjectId, payload);
      const idx = state.subjects.findIndex(s => s.id === state.editingSubjectId);
      state.subjects[idx] = { ...state.subjects[idx], ...subject };
    } else {
      const { subject } = await api.createSubject(payload);
      state.subjects.push({ ...subject, open_tasks: 0, total_tasks: 0 });
      state.subjects.sort((a, b) => a.name.localeCompare(b.name));
    }
    closeModal();
    populateSubjectSelects();
    // Refresh tasks/notes since subject names/colors may have changed
    await Promise.all([loadTasks(), loadNotes()]);
    renderAll();
  } catch (err) {
    alert(err.message);
  }
});

document.getElementById('subjectDeleteBtn').addEventListener('click', async () => {
  if (!state.editingSubjectId) return;
  if (!confirm('Delete this class? Tasks and notes will keep their data but lose their class link.')) return;
  await api.deleteSubject(state.editingSubjectId);
  state.subjects = state.subjects.filter(s => s.id !== state.editingSubjectId);
  closeModal();
  populateSubjectSelects();
  await Promise.all([loadTasks(), loadNotes()]);
  renderAll();
});

document.getElementById('newSubjectBtn').addEventListener('click', () => openSubjectModal());
document.getElementById('quickClassBtn').addEventListener('click', () => openSubjectModal());

function populateSubjectSelects() {
  const opts = '<option value="">No class</option>' +
    state.subjects.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  document.getElementById('taskSubjectInput').innerHTML = opts;
  document.getElementById('noteSubjectSelect').innerHTML = opts;

  const filterOpts = '<option value="">All Classes</option>' +
    state.subjects.map(s => `<option value="${s.id}">${escapeHtml(s.name)}</option>`).join('');
  document.getElementById('subjectFilterSelect').innerHTML = filterOpts;
}

// ==========================================================
// TASKS
// ==========================================================
async function loadTasks() {
  const { tasks } = await api.tasks();
  state.tasks = tasks;
}

function filterTasks(tasks) {
  let filtered = [...tasks];
  const todayStr = new Date().toISOString().slice(0, 10);
  const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  if (state.taskFilter === 'open') filtered = filtered.filter(t => !t.completed);
  if (state.taskFilter === 'done') filtered = filtered.filter(t => t.completed);
  if (state.taskFilter === 'overdue') {
    filtered = filtered.filter(t => !t.completed && t.due_date && t.due_date.slice(0, 10) < todayStr);
  }
  if (state.taskFilter === 'today') {
    filtered = filtered.filter(t => t.due_date && t.due_date.slice(0, 10) === todayStr);
  }
  if (state.taskFilter === 'week') {
    filtered = filtered.filter(t => !t.completed && t.due_date &&
      t.due_date.slice(0, 10) >= todayStr && t.due_date.slice(0, 10) <= weekFromNow);
  }
  if (state.taskSubjectFilter) {
    filtered = filtered.filter(t => String(t.subject_id) === state.taskSubjectFilter);
  }
  return filtered;
}

function renderTasks() {
  const list = document.getElementById('tasksList');
  const tasks = filterTasks(state.tasks);
  if (tasks.length === 0) {
    list.innerHTML = '<p class="list-empty">Nothing here. Try a different filter or add a new task.</p>';
    return;
  }
  list.innerHTML = tasks.map(taskHTML).join('');
  attachTaskHandlers(list);
}

function taskHTML(t) {
  const due = t.due_date ? formatDate(t.due_date) : '';
  const time = t.due_time ? formatTime(t.due_time) : '';
  const dueStr = [due, time].filter(Boolean).join(' · ');
  const subjectPill = t.subject_name ?
    `<span class="subject-pill" style="--pill-color:${t.subject_color || '#d4a857'}">${escapeHtml(t.subject_name)}</span>` : '';
  const typePill = t.type && t.type !== 'assignment' ?
    `<span class="type-pill">${escapeHtml(t.type)}</span>` : '';
  return `
    <div class="task-item ${t.completed ? 'done' : ''}" data-id="${t.id}">
      <button class="task-check ${t.completed ? 'checked' : ''}" data-act="toggle"></button>
      <div class="task-body">
        <div class="task-title">${escapeHtml(t.title)}</div>
        ${t.description ? `<div class="task-desc">${escapeHtml(t.description)}</div>` : ''}
        <div class="task-meta">
          ${subjectPill}
          ${typePill}
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
        // Update subject counts locally
        await loadSubjects();
        renderAll();
      });
    }
    // Click body to edit
    const body = el.querySelector('.task-body');
    if (body) {
      body.style.cursor = 'pointer';
      body.addEventListener('click', () => {
        const task = state.tasks.find(t => t.id === id);
        if (task) openTaskModal(task);
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

document.getElementById('subjectFilterSelect').addEventListener('change', (e) => {
  state.taskSubjectFilter = e.target.value;
  renderTasks();
});

document.getElementById('newTaskBtn').addEventListener('click', () => openTaskModal());
document.getElementById('quickTaskBtn').addEventListener('click', () => openTaskModal());

function openTaskModal(task = null) {
  state.editingTaskId = task ? task.id : null;
  document.getElementById('taskModalTitle').textContent = task ? 'Edit Task' : 'New Task';
  document.getElementById('taskTitleInput').value = task ? task.title : '';
  document.getElementById('taskDescInput').value = task ? (task.description || '') : '';
  document.getElementById('taskDateInput').value = task && task.due_date ? task.due_date.slice(0, 10) : '';
  document.getElementById('taskTimeInput').value = task && task.due_time ? task.due_time.slice(0, 5) : '';
  document.getElementById('taskPriorityInput').value = task ? task.priority : 'medium';
  document.getElementById('taskSubjectInput').value = task && task.subject_id ? task.subject_id : '';
  document.getElementById('taskTypeInput').value = task && task.type ? task.type : 'assignment';
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
    subject_id: document.getElementById('taskSubjectInput').value || null,
    type: document.getElementById('taskTypeInput').value,
  };
  if (payload.subject_id) payload.subject_id = +payload.subject_id;
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
    await loadSubjects(); // refresh counts
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
  list.innerHTML = state.notes.map(n => {
    const subjectDot = n.subject_color ? `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${n.subject_color};margin-right:6px;vertical-align:middle"></span>` : '';
    return `
      <div class="note-list-item ${n.id === state.selectedNoteId ? 'active' : ''}" data-id="${n.id}">
        <div class="note-list-title">${subjectDot}${escapeHtml(n.title || 'Untitled')}</div>
        <div class="note-list-preview">${escapeHtml((n.content || '').slice(0, 60))}</div>
      </div>
    `;
  }).join('');

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
  document.getElementById('noteSubjectSelect').value = note.subject_id || '';
  document.getElementById('noteSaveStatus').textContent = 'Saved';
}

function showEmptyNoteEditor() {
  const editor = document.getElementById('noteEditor');
  editor.classList.add('empty');
  document.getElementById('noteTitle').value = '';
  document.getElementById('noteContent').value = '';
  document.getElementById('noteSubjectSelect').value = '';
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

['noteTitle', 'noteContent', 'noteSubjectSelect'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    if (!state.selectedNoteId) return;
    document.getElementById('noteSaveStatus').textContent = 'Saving…';
    clearTimeout(state.noteSaveTimer);
    state.noteSaveTimer = setTimeout(saveCurrentNote, 600);
  });
  document.getElementById(id).addEventListener('change', () => {
    if (!state.selectedNoteId) return;
    clearTimeout(state.noteSaveTimer);
    saveCurrentNote();
  });
});

async function saveCurrentNote() {
  const title = document.getElementById('noteTitle').value;
  const content = document.getElementById('noteContent').value;
  const subjectVal = document.getElementById('noteSubjectSelect').value;
  const subject_id = subjectVal ? +subjectVal : null;
  try {
    const { note } = await api.updateNote(state.selectedNoteId, { title, content, subject_id });
    const idx = state.notes.findIndex(n => n.id === state.selectedNoteId);
    state.notes[idx] = note;
    const li = document.querySelector(`.note-list-item[data-id="${note.id}"]`);
    if (li) {
      const dot = note.subject_color ? `<span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${note.subject_color};margin-right:6px;vertical-align:middle"></span>` : '';
      li.querySelector('.note-list-title').innerHTML = dot + escapeHtml(note.title || 'Untitled');
      li.querySelector('.note-list-preview').textContent = (note.content || '').slice(0, 60);
    }
    document.getElementById('noteSaveStatus').textContent = 'Saved';
  } catch (err) {
    document.getElementById('noteSaveStatus').textContent = 'Error saving';
  }
}

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

document.getElementById('newReminderBtn').addEventListener('click', () => openReminderModal());
document.getElementById('quickReminderBtn').addEventListener('click', () => openReminderModal());

function openReminderModal() {
  const t = new Date(Date.now() + 60 * 60 * 1000);
  const local = new Date(t.getTime() - t.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
  document.getElementById('reminderTitleInput').value = '';
  document.getElementById('reminderTimeInput').value = local;
  openModal('reminderModal');
}

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
      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification('Axiom Reminder', { body: r.title });
      }
    });
    if (reminders.length > 0) {
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
    const taskDots = tasksHere.slice(0, 4).map(t =>
      `<span class="cal-dot" style="background:${t.subject_color || '#d4a857'}"></span>`
    ).join('');
    const reminderDots = remindersHere.slice(0, Math.max(0, 4 - tasksHere.length))
      .map(() => '<span class="cal-dot" style="background:#c9d4e8"></span>').join('');
    const isToday = c.dateStr === todayStr;
    const isSelected = c.dateStr === state.selectedCalDate;
    return `
      <div class="cal-day ${c.otherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''} ${isSelected ? 'selected' : ''}" data-date="${c.dateStr}">
        <div class="cal-day-num">${c.day}</div>
        <div class="cal-day-dots">${taskDots}${reminderDots}</div>
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
  if (tasks.length) html += tasks.map(taskHTML).join('');
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
// TODAY VIEW — Smart dashboard
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
  const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // Overdue
  const overdue = state.tasks.filter(t => !t.completed && t.due_date && t.due_date.slice(0, 10) < todayStr);
  const overduePanel = document.getElementById('overduePanel');
  const overdueList = document.getElementById('overdueList');
  if (overdue.length === 0) {
    overduePanel.style.display = 'none';
  } else {
    overduePanel.style.display = '';
    overdueList.innerHTML = overdue.slice(0, 5).map(taskHTML).join('');
    attachTaskHandlers(overdueList);
  }

  // Due Today
  const todayTasks = state.tasks.filter(t => !t.completed && t.due_date && t.due_date.slice(0, 10) === todayStr);
  const todayTasksList = document.getElementById('todayTasksList');
  if (todayTasks.length === 0) {
    todayTasksList.innerHTML = '<p class="list-empty">Nothing due today. Take a breath.</p>';
  } else {
    todayTasksList.innerHTML = todayTasks.map(taskHTML).join('');
    attachTaskHandlers(todayTasksList);
  }

  // Due This Week (excluding today and overdue)
  const weekTasks = state.tasks.filter(t => !t.completed && t.due_date &&
    t.due_date.slice(0, 10) > todayStr && t.due_date.slice(0, 10) <= weekFromNow);
  const weekTasksList = document.getElementById('weekTasksList');
  if (weekTasks.length === 0) {
    weekTasksList.innerHTML = '<p class="list-empty">All clear for the week.</p>';
  } else {
    weekTasksList.innerHTML = weekTasks.slice(0, 5).map(taskHTML).join('');
    attachTaskHandlers(weekTasksList);
  }

  // Upcoming reminders
  const soon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
  const upcoming = state.reminders.filter(r => {
    const t = new Date(r.remind_at);
    return t >= now && t <= soon;
  }).slice(0, 5);

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
// IMPORT VIEW — Veracross/iCal feeds + Gemini AI
// ==========================================================
async function loadImportView() {
  await Promise.all([loadAiStatus(), loadFeeds()]);
}

async function loadAiStatus() {
  try {
    const { ai_enabled, has_key } = await api.importSettings();
    const status = document.getElementById('aiStatus');
    const form = document.getElementById('aiKeyForm');
    const connected = document.getElementById('aiKeyConnected');
    if (has_key && ai_enabled) {
      status.textContent = 'Connected';
      status.classList.add('connected');
      form.style.display = 'none';
      connected.style.display = '';
    } else {
      status.textContent = 'Not connected';
      status.classList.remove('connected');
      form.style.display = '';
      connected.style.display = 'none';
    }
  } catch (e) { /* ignore */ }
}

document.getElementById('saveKeyBtn').addEventListener('click', async () => {
  const key = document.getElementById('geminiKeyInput').value.trim();
  if (!key) return alert('Paste your Gemini API key first.');
  const btn = document.getElementById('saveKeyBtn');
  btn.disabled = true;
  btn.textContent = 'Testing...';
  try {
    await api.saveGeminiKey(key);
    document.getElementById('geminiKeyInput').value = '';
    addSyncEntry('AI assistant connected successfully.', 'ok');
    await loadAiStatus();
  } catch (err) {
    alert('Could not validate key: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Save & Test';
  }
});

document.getElementById('removeKeyBtn').addEventListener('click', async () => {
  if (!confirm('Disconnect AI? You can re-add a key anytime.')) return;
  await api.removeGeminiKey();
  addSyncEntry('AI assistant disconnected.', '');
  await loadAiStatus();
});

async function loadFeeds() {
  try {
    const { feeds } = await api.feeds();
    const list = document.getElementById('feedsList');
    if (feeds.length === 0) {
      list.innerHTML = '<p class="list-empty" style="margin-top:16px">No calendar feeds yet. Paste a URL above to add one.</p>';
      return;
    }
    list.innerHTML = feeds.map(f => {
      const lastSync = f.last_synced ? new Date(f.last_synced).toLocaleString() : 'Never synced';
      const errClass = f.last_status === 'error' ? 'error' : '';
      const errMsg = f.last_status === 'error' ? ` · ${escapeHtml(f.last_error || 'Unknown error')}` : '';
      return `
        <div class="feed-item" data-id="${f.id}">
          <div class="feed-icon">📅</div>
          <div class="feed-body">
            <div class="feed-label">${escapeHtml(f.label)}</div>
            <div class="feed-url">${escapeHtml(f.url)}</div>
            <div class="feed-meta ${errClass}">Last sync: ${escapeHtml(lastSync)}${errMsg}</div>
          </div>
          <div class="feed-actions">
            <button class="btn-sync" data-act="sync">Sync Now</button>
            <button class="icon-btn" data-act="delete" title="Remove feed">×</button>
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.feed-item').forEach(el => {
      const id = +el.dataset.id;
      el.querySelector('[data-act="sync"]').addEventListener('click', () => syncFeed(id, el));
      el.querySelector('[data-act="delete"]').addEventListener('click', async () => {
        if (!confirm('Remove this calendar feed? Existing imported tasks will stay.')) return;
        await api.deleteFeed(id);
        await loadFeeds();
      });
    });
  } catch (e) {
    console.error(e);
  }
}

document.getElementById('addFeedBtn').addEventListener('click', async () => {
  const url = document.getElementById('feedUrlInput').value.trim();
  const label = document.getElementById('feedLabelInput').value.trim() || 'School Calendar';
  if (!url) return alert('Paste a calendar URL first.');
  try {
    await api.addFeed(url, label);
    document.getElementById('feedUrlInput').value = '';
    document.getElementById('feedLabelInput').value = '';
    addSyncEntry(`Added feed "${label}". Click Sync Now to import assignments.`, 'ok');
    await loadFeeds();
  } catch (err) {
    alert(err.message);
  }
});

async function syncFeed(id, el) {
  const btn = el.querySelector('.btn-sync');
  btn.disabled = true;
  btn.textContent = 'Syncing...';
  addSyncEntry('Fetching calendar...', '');
  try {
    const result = await api.syncFeed(id, true);
    const aiNote = result.ai_used ? ' <strong>(AI-transformed)</strong>' : ' (simple import — connect AI for better results)';
    addSyncEntry(`<strong>${result.created}</strong> new task${result.created === 1 ? '' : 's'} imported${aiNote}. ${result.skipped} already existed.`, 'ok');
    // Reload tasks so the new ones appear
    await Promise.all([loadTasks(), loadSubjects(), loadFeeds()]);
    renderAll();
  } catch (err) {
    addSyncEntry('Sync failed: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sync Now';
  }
}

function addSyncEntry(html, kind = '') {
  const log = document.getElementById('syncLog');
  const entry = document.createElement('div');
  entry.className = 'sync-entry ' + kind;
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  entry.innerHTML = `<span style="opacity:0.6">[${time}]</span> ${html}`;
  log.insertBefore(entry, log.firstChild);
  // Keep only last 8 entries
  while (log.children.length > 8) log.removeChild(log.lastChild);
}

// ==========================================================
// MODALS
// ==========================================================
function openModal(id) {
  document.getElementById('modalBackdrop').classList.add('active');
  document.querySelectorAll('.modal').forEach(m => m.classList.remove('active'));
  document.getElementById(id).classList.add('active');
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
  if (state.currentView === 'subjects') renderSubjects();
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
  try {
    await enterApp();
  } catch {
    showScreen('authScreen');
  }
}

document.addEventListener('click', function askPerm() {
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }
  document.removeEventListener('click', askPerm);
}, { once: true });

init();
