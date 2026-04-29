// ==========================================================
// AXIOM PLANNER — Frontend
// ==========================================================

import { AxiomCube, GeometricBackground } from '/cube.js';

// Three.js cube instances (initialized after DOM loads)
const cubeInstances = {
  sidebar: null,
  auth: null,
  settings: null,
};
let geoBackground = null;

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
  autoLinkTasks: (matches) => api.req('/api/tasks/auto-link', { method: 'POST', body: JSON.stringify({ matches }) }),

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
  addFeed: (url, label, feed_type) => api.req('/api/import/feeds', { method: 'POST', body: JSON.stringify({ url, label, feed_type }) }),
  deleteFeed: (id) => api.req('/api/import/feeds/' + id, { method: 'DELETE' }),
  syncFeed: (id) => api.req('/api/import/feeds/' + id + '/sync', { method: 'POST', body: JSON.stringify({ daysAhead: 28 }) }),

  // Settings + danger zone
  settings: () => api.req('/api/settings'),
  updateSettings: (patch) => api.req('/api/settings', { method: 'PATCH', body: JSON.stringify(patch) }),
  clearTasks: (payload) => api.req('/api/settings/clear-tasks', { method: 'POST', body: JSON.stringify(payload) }),

  // Stats + favorites
  todayStats: () => api.req('/api/stats/today'),
  getFavorites: () => api.req('/api/logos/favorites'),
  toggleFavorite: (logo_idx) => api.req('/api/logos/favorites', { method: 'POST', body: JSON.stringify({ logo_idx }) }),
};

// App state
const state = {
  user: null,
  settings: null,
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
  currentLogoIdx: 0,
};

// ==========================================================
// HUMAN COPY — greetings, focus messages, empty states
// Rotates so it doesn't feel mechanical.
// ==========================================================
const COPY = {
  // Greetings by time of day + style. Picks one that fits the moment.
  greeting(hour, dow, name, style) {
    const n = name || '';
    const s = name ? ', ' + name : '';
    const isWeekend = dow === 0 || dow === 6;
    const isSunday = dow === 0;
    const isFriday = dow === 5;
    const isMonday = dow === 1;
    const lateNight = hour >= 22 || hour < 5;
    const earlyMorn = hour >= 5 && hour < 8;
    const morn = hour >= 8 && hour < 12;
    const afternoon = hour >= 12 && hour < 17;
    const evening = hour >= 17 && hour < 22;

    if (style === 'minimal') return n || 'Welcome.';
    if (style === 'formal') {
      if (lateNight) return 'Welcome.';
      if (morn || earlyMorn) return 'Good morning.';
      if (afternoon) return 'Good afternoon.';
      return 'Good evening.';
    }
    if (style === 'casual') {
      const pool = [];
      if (lateNight) pool.push(`Late one${s}.`, `Still up${s}?`, `Quiet hours${s}.`);
      else if (earlyMorn) pool.push(`Up early${s}.`, `Hey${s} 👋`, `Morning${s}.`);
      else if (morn) pool.push(`Hey${s} 👋`, `Morning${s}.`, `What's the plan${s}?`);
      else if (afternoon) pool.push(`Afternoon${s}.`, `Hey${s}.`, `Back at it${s}?`);
      else pool.push(`Evening${s}.`, `Hey${s}.`, `Hope today went well${s}.`);
      if (isFriday && (afternoon || evening)) pool.push(`Friday${s} — almost there.`, `TGIF${s}.`);
      if (isSunday) pool.push(`Sunday sloth mode${s}.`, `Slow Sunday${s}.`);
      if (isMonday && morn) pool.push(`Fresh week${s}.`, `Monday${s}. Let's go.`);
      return pool[Math.floor(Math.random() * pool.length)];
    }
    // 'warm' (default)
    const pool = [];
    if (lateNight) pool.push(`Late evening${s}.`, `Up late${s}?`, `It's quiet${s}.`);
    else if (earlyMorn) pool.push(`Early morning${s}.`, `Good morning${s}.`);
    else if (morn) pool.push(`Good morning${s}.`, `Morning${s}.`);
    else if (afternoon) pool.push(`Good afternoon${s}.`, `Afternoon${s}.`);
    else pool.push(`Good evening${s}.`, `Evening${s}.`);
    if (isWeekend && (morn || afternoon)) pool.push(`Easy ${isSunday ? 'Sunday' : 'Saturday'}${s}.`);
    if (isFriday && evening) pool.push(`Friday evening${s}. Well earned.`);
    return pool[Math.floor(Math.random() * pool.length)];
  },

  // The view-sub line right under the greeting.
  todaySub(counts) {
    const { overdue, today, week, exams } = counts;
    const total = overdue + today + week;
    if (total === 0 && exams === 0) {
      return [
        'A blank slate. Make of it what you will.',
        'Nothing on the books. Nice.',
        'You\'re caught up. Take a breath.',
        'All clear. Maybe a walk?',
        'Empty plate, full mind. Use the time.',
      ][Math.floor(Math.random() * 5)];
    }
    if (overdue > 0) {
      return `${overdue} overdue. Let's start there.`;
    }
    if (today > 0) {
      return today === 1 ? 'One thing due today.' : `${today} things due today.`;
    }
    if (week > 0) {
      return `Quiet today — ${week} on the way this week.`;
    }
    return 'Eyes ahead.';
  },

  // The big "focus" message in the hero card.
  focus(counts, nextTask, nextExam) {
    const { overdue, today } = counts;
    if (overdue > 0) {
      const t = nextTask;
      return {
        eyebrow: overdue === 1 ? 'One thing overdue' : `${overdue} things overdue`,
        headline: t ? t.title : 'Catch up first.',
      };
    }
    if (nextExam) {
      const days = daysUntil(nextExam.due_date);
      const word = nextExam.type === 'quiz' ? 'Quiz' : 'Test';
      return {
        eyebrow: days === 0 ? `${word} today` : days === 1 ? `${word} tomorrow` : `${word} in ${days} days`,
        headline: nextExam.title,
      };
    }
    if (today > 0) {
      const t = nextTask;
      return {
        eyebrow: 'Up next',
        headline: t ? t.title : `${today} due today`,
      };
    }
    if (counts.week > 0) {
      const t = nextTask;
      return {
        eyebrow: 'This week',
        headline: t ? t.title : 'Plenty of room to plan ahead.',
      };
    }
    return {
      eyebrow: 'You\'re clear',
      headline: 'Nothing pressing. Use the space well.',
    };
  },

  emptyTasks() {
    return [
      'Nothing here yet. Add something or import a feed.',
      'A blank canvas.',
      'No tasks. The simplest filter result.',
    ][Math.floor(Math.random() * 3)];
  },
  emptyDueToday() {
    return [
      'Nothing due today. Take a breath.',
      'No deadlines today.',
      'Today is yours.',
    ][Math.floor(Math.random() * 3)];
  },
  emptyWeek() {
    return [
      'Nothing on the week.',
      'A clear week ahead.',
      'No deadlines coming up.',
    ][Math.floor(Math.random() * 3)];
  },
  emptyReminders() {
    return [
      'No reminders coming up.',
      'Nothing pinging soon.',
    ][Math.floor(Math.random() * 2)];
  },
  emptyNotes() {
    return 'No notes yet. Click + to start one.';
  },
  emptyClasses() {
    return 'No classes yet. Add one above, or import a class schedule from the Import page.';
  },
};

function daysUntil(dateStr) {
  if (!dateStr) return 999;
  const d = new Date(dateStr.slice(0, 10) + 'T00:00:00');
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  return Math.round((d - now) / (1000 * 60 * 60 * 24));
}

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
// LIVE ACTIVITY — progress ring, animated counter, best day
// ==========================================================
const activityState = {
  lastCount: 0,
  lastBest: 0,
  hasCelebratedToday: false,
};

async function refreshStats(initial = false) {
  let stats;
  try {
    stats = await api.todayStats();
  } catch (e) { return; }

  const { completed_today, due_today, best_day_count } = stats;

  // Sidebar mini widget
  const sidebarRing = document.getElementById('activityRingFg');
  const sidebarCount = document.getElementById('activityCount');
  const sidebarDenom = document.getElementById('activityDenom');
  const sidebarBest = document.getElementById('activityBest');

  if (sidebarCount) sidebarCount.textContent = completed_today;
  if (sidebarDenom) sidebarDenom.textContent = '/' + Math.max(due_today, completed_today);
  if (sidebarBest) sidebarBest.textContent = `Best: ${best_day_count}`;

  if (sidebarRing) {
    const total = Math.max(due_today, completed_today, 1);
    const pct = Math.min(completed_today / total, 1);
    const circumference = 163.36; // 2π × 26
    sidebarRing.style.strokeDashoffset = circumference * (1 - pct);
  }

  // Today hero ring (only if Today view is active)
  const heroFg = document.getElementById('progressHeroFg');
  const heroCount = document.getElementById('progressHeroCount');
  const heroDenom = document.getElementById('progressHeroDenom');
  const heroBest = document.getElementById('progressHeroBest');
  const heroPercent = document.getElementById('progressHeroPercent');
  const heroLabel = document.getElementById('progressHeroLabel');
  const heroEl = document.getElementById('progressHero');

  if (heroFg) {
    const total = Math.max(due_today, completed_today, 1);
    const pct = Math.min(completed_today / total, 1);
    const circumference = 326.73; // 2π × 52
    heroFg.style.strokeDashoffset = circumference * (1 - pct);
  }
  if (heroBest) heroBest.textContent = best_day_count;
  if (heroPercent) {
    const total = Math.max(due_today, completed_today, 1);
    const pct = Math.round((completed_today / total) * 100);
    heroPercent.textContent = pct + '%';
  }
  if (heroDenom) heroDenom.textContent = Math.max(due_today, completed_today);
  if (heroLabel) {
    if (completed_today === 0 && due_today === 0) {
      heroLabel.textContent = 'Nothing due today — go for any extra credit?';
    } else if (completed_today >= due_today && due_today > 0) {
      heroLabel.textContent = 'All done — well played.';
    } else if (completed_today === 0 && due_today > 0) {
      heroLabel.textContent = 'tasks due today';
    } else {
      heroLabel.textContent = 'tasks done today';
    }
  }

  // Animated count-up if it changed
  if (heroCount) {
    const old = parseInt(heroCount.textContent) || 0;
    if (old !== completed_today) {
      animateCount(heroCount, old, completed_today);
      // Bump animation
      heroCount.classList.remove('bumped');
      void heroCount.offsetWidth; // restart animation
      heroCount.classList.add('bumped');
      setTimeout(() => heroCount.classList.remove('bumped'), 500);
    } else if (initial) {
      heroCount.textContent = completed_today;
    }
  }

  // Celebration when crossing the all-done line OR setting a new best
  if (!initial && heroEl) {
    const justCleared = activityState.lastCount < due_today && completed_today >= due_today && due_today > 0;
    const newBest = completed_today > activityState.lastBest && completed_today === best_day_count && completed_today > 1;
    if (justCleared && !activityState.hasCelebratedToday) {
      heroEl.classList.add('celebrating');
      setTimeout(() => heroEl.classList.remove('celebrating'), 2500);
      activityState.hasCelebratedToday = true;
      showToast('All done!', 'You finished everything due today. ✨');
    }
    if (newBest) {
      heroEl.classList.add('new-best');
      setTimeout(() => heroEl.classList.remove('new-best'), 2200);
      showToast('New best day!', `${completed_today} tasks completed — your record.`);
    }
  }

  activityState.lastCount = completed_today;
  activityState.lastBest = best_day_count;
}

function animateCount(el, from, to) {
  const duration = 600;
  const start = performance.now();
  function step(now) {
    const t = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - t, 3);
    const value = Math.round(from + (to - from) * eased);
    el.textContent = value;
    if (t < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// ==========================================================
// LOGO SYSTEM v2 — flip animation, favorites, in-place pin
// ==========================================================
const logoState = {
  current: 0,           // currently displayed logo idx
  flipDirection: 1,     // toggles each flip
  favorites: [],        // array of favorited indices
  pinned: null,         // pinned idx (null = random)
  rotateFavoritesOnly: false,
  isFlipping: false,
};

// Pick the next logo respecting pinned/favorites preferences
function pickNextLogo() {
  if (logoState.pinned !== null) return logoState.pinned;
  // If user wants favorites-only and has some, pick from those
  if (logoState.rotateFavoritesOnly && logoState.favorites.length > 0) {
    const others = logoState.favorites.filter(i => i !== logoState.current);
    const pool = others.length > 0 ? others : logoState.favorites;
    return pool[Math.floor(Math.random() * pool.length)];
  }
  // Otherwise random across all 42 (avoid same-as-current if possible)
  let next = Math.floor(Math.random() * 42);
  if (next === logoState.current && Math.random() > 0.05) {
    next = (next + 1 + Math.floor(Math.random() * 41)) % 42;
  }
  return next;
}

// Initialize all Three.js cube instances (called once after auth)
function initLogoCubes() {
  // Sidebar — small, rotates slowly
  const mountSidebar = document.getElementById('logoMount3D');
  if (mountSidebar && !cubeInstances.sidebar) {
    cubeInstances.sidebar = new AxiomCube(mountSidebar, {
      size: 64,
      idx: logoState.current,
      autoRotate: true,
      rotateSpeed: 0.004,
    });
  }
  // Settings preview
  const mountSettings = document.getElementById('logoCurrent3D');
  if (mountSettings && !cubeInstances.settings) {
    cubeInstances.settings = new AxiomCube(mountSettings, {
      size: 80,
      idx: logoState.current,
      autoRotate: true,
      rotateSpeed: 0.005,
    });
  }
}

function initAuthCube() {
  const mount = document.getElementById('authLogo3D');
  if (mount && !cubeInstances.auth) {
    cubeInstances.auth = new AxiomCube(mount, {
      size: 100,
      idx: Math.floor(Math.random() * 42),
      autoRotate: true,
      rotateSpeed: 0.006,
    });
  }
}

// Set logo without animation (initial state)
function setLogoInstant(idx) {
  if (idx === undefined || idx === null || idx < 0 || idx > 41) idx = pickNextLogo();
  logoState.current = idx;
  if (cubeInstances.sidebar) cubeInstances.sidebar.setIdx(idx, false);
  if (cubeInstances.settings) cubeInstances.settings.setIdx(idx, false);
  updateFaviconFromCube(idx);
  updateLogoFabs();
}

// Animate to a new logo with the Three.js flip animation
function flipToLogo(idx) {
  if (idx === undefined || idx === null) idx = pickNextLogo();
  if (idx === logoState.current) return;
  logoState.current = idx;

  if (cubeInstances.sidebar) cubeInstances.sidebar.setIdx(idx, true);
  if (cubeInstances.settings) cubeInstances.settings.setIdx(idx, true);

  // Update favicon (rendering a cube to a tiny canvas) on a slight delay so the new cube exists
  setTimeout(() => updateFaviconFromCube(idx), 100);
  updateLogoFabs();

  // Update gallery selection if open
  document.querySelectorAll('#logoGallery .logo-thumb').forEach(el => {
    el.classList.toggle('active', +el.dataset.idx === idx);
  });
}

// Generate the favicon by rendering the cube to a small offscreen canvas, then setting it
function updateFaviconFromCube(idx) {
  const fav = document.getElementById('favicon');
  if (!fav) return;
  // Use the sidebar instance's canvas (already rendered) — but we need a snapshot
  // Easier path: hidden offscreen renderer
  if (!cubeInstances._faviconRenderer) {
    const div = document.createElement('div');
    div.style.position = 'fixed';
    div.style.top = '-9999px';
    div.style.left = '-9999px';
    div.style.width = '64px';
    div.style.height = '64px';
    document.body.appendChild(div);
    cubeInstances._faviconRenderer = new AxiomCube(div, {
      size: 64,
      idx,
      autoRotate: false,
    });
  } else {
    cubeInstances._faviconRenderer.setIdx(idx, false);
  }
  // Wait one frame for it to render, then capture
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      try {
        const canvas = cubeInstances._faviconRenderer.renderer.domElement;
        const url = canvas.toDataURL('image/png');
        fav.href = url;
      } catch (e) { /* ignore */ }
    });
  });
}

// Show pin/favorite state on the toolbar buttons
function updateLogoFabs() {
  const favBtn = document.getElementById('logoFavBtn');
  const pinBtn = document.getElementById('logoPinBtn');
  if (!favBtn || !pinBtn) return;
  const isFav = logoState.favorites.includes(logoState.current);
  const isPinned = logoState.pinned === logoState.current;
  favBtn.classList.toggle('active', isFav);
  favBtn.title = isFav ? 'Unfavorite' : 'Favorite';
  pinBtn.classList.toggle('active', isPinned);
  pinBtn.title = isPinned ? 'Unpin (back to rotation)' : 'Pin this one';
}

// Tap stage → flip to new random
document.addEventListener('DOMContentLoaded', () => {
  const stage = document.getElementById('logoStage');
  if (stage) {
    // Click on stage (but not on fabs) re-rolls
    stage.addEventListener('click', (e) => {
      if (e.target.closest('.logo-fab')) return;
      flipToLogo(pickNextLogo());
    });
  }

  // Favorite button
  const favBtn = document.getElementById('logoFavBtn');
  if (favBtn) {
    favBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        const r = await api.toggleFavorite(logoState.current);
        if (r.favorited) {
          if (!logoState.favorites.includes(logoState.current)) logoState.favorites.push(logoState.current);
          favBtn.classList.add('active');
          favBtn.querySelector('svg').style.animation = 'none';
          setTimeout(() => favBtn.querySelector('svg').style.animation = '', 10);
        } else {
          logoState.favorites = logoState.favorites.filter(i => i !== logoState.current);
          favBtn.classList.remove('active');
        }
        updateLogoFabs();
        renderLogoFavoriteSlots();
      } catch (err) {
        showToast('Couldn\'t save', err.message);
      }
    });
  }

  // Pin button
  const pinBtn = document.getElementById('logoPinBtn');
  if (pinBtn) {
    pinBtn.addEventListener('click', async (e) => {
      e.stopPropagation();
      try {
        if (logoState.pinned === logoState.current) {
          await api.updateSettings({ pinned_logo: null });
          logoState.pinned = null;
          if (state.settings) state.settings.pinned_logo = null;
        } else {
          await api.updateSettings({ pinned_logo: logoState.current });
          logoState.pinned = logoState.current;
          if (state.settings) state.settings.pinned_logo = logoState.current;
        }
        pinBtn.classList.add('pulse');
        setTimeout(() => pinBtn.classList.remove('pulse'), 500);
        updateLogoFabs();
        renderLogoSettings();
      } catch (err) {
        showToast('Couldn\'t save', err.message);
      }
    });
  }
});

// Backwards-compat shim — keep old calls working
function setLogo(idx) {
  setLogoInstant(idx);
}

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
  // Load settings before rendering anything
  try {
    state.settings = await api.settings();
  } catch {
    state.settings = null;
  }
  applyAccentColor();
  applyTodayPanelVisibility();

  // Load logo state (favorites + pinned + rotation pref)
  try {
    const fav = await api.getFavorites();
    logoState.favorites = fav.favorites || [];
  } catch { logoState.favorites = []; }
  logoState.pinned = state.settings?.pinned_logo ?? null;
  logoState.rotateFavoritesOnly = !!state.settings?.rotate_favorites_only;

  // Apply initial logo (pinned, or random from favorites/all)
  const startIdx = logoState.pinned !== null ? logoState.pinned : pickNextLogo();
  logoState.current = startIdx;

  document.getElementById('userName').textContent = state.settings?.display_name || user.username;
  showScreen('appScreen');

  // NOW initialize the sidebar/settings cubes (after the appScreen is visible
  // so the canvases get correct dimensions)
  initLogoCubes();
  // Update favicon to match current logo
  setTimeout(() => updateFaviconFromCube(startIdx), 200);

  await Promise.all([loadSubjects(), loadTasks(), loadNotes(), loadReminders()]);
  populateSubjectSelects();
  await refreshStats(true);
  renderAll();
  checkDueReminders();
  setInterval(checkDueReminders, 30000);
  // Refresh stats every minute
  setInterval(() => refreshStats(false), 60000);
}

// Apply accent color globally (overrides --gold dynamically)
function applyAccentColor() {
  const accent = state.settings?.accent_color || '#d4a857';
  document.documentElement.style.setProperty('--gold', accent);
  document.documentElement.style.setProperty('--accent', accent);
  // Also derive a "hot" version (slightly lighter) and "deep" version
  const hot = lightenColor(accent, 0.15);
  document.documentElement.style.setProperty('--gold-hot', hot);

  // Apply to Three.js scenes
  const accentInt = parseInt(accent.replace('#', ''), 16);
  if (geoBackground) geoBackground.setAccentColor(accentInt);
  if (cubeInstances.sidebar) cubeInstances.sidebar.setAccentColor(accentInt);
  if (cubeInstances.settings) cubeInstances.settings.setAccentColor(accentInt);
  if (cubeInstances.auth) cubeInstances.auth.setAccentColor(accentInt);
  if (cubeInstances._faviconRenderer) cubeInstances._faviconRenderer.setAccentColor(accentInt);
}

function applyTodayPanelVisibility() {
  const s = state.settings || {};
  const panels = {
    'overduePanel': s.show_overdue !== false,
    'examsPanel': s.show_exams !== false,
    'todayPanel': s.show_today !== false,
    'weekPanel': s.show_week !== false,
    'todayRemindersPanel': !!s.show_reminders_today,
  };
  for (const [id, visible] of Object.entries(panels)) {
    const el = document.getElementById(id);
    if (el) el.dataset.userHidden = visible ? '0' : '1';
  }
}

function lightenColor(hex, amount) {
  // Naive lighten — push each channel toward 255 by `amount` (0..1)
  const m = hex.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (!m) return hex;
  const r = parseInt(m[1], 16), g = parseInt(m[2], 16), b = parseInt(m[3], 16);
  const lr = Math.min(255, Math.round(r + (255 - r) * amount));
  const lg = Math.min(255, Math.round(g + (255 - g) * amount));
  const lb = Math.min(255, Math.round(b + (255 - b) * amount));
  return '#' + [lr, lg, lb].map(x => x.toString(16).padStart(2, '0')).join('');
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
  if (view === 'settings') renderSettingsView();
}

// ==========================================================
// SUBJECTS
// ==========================================================
async function loadSubjects() {
  const { subjects } = await api.subjects();
  state.subjects = subjects;
}

function renderSubjects() {
  // Update auto-link card (above grid)
  updateAutoLinkCard();

  const grid = document.getElementById('subjectsGrid');
  if (state.subjects.length === 0) {
    grid.innerHTML = `<div class="subject-card-empty">${COPY.emptyClasses()}</div>`;
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
  const twoWeeksOut = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

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
  if (state.taskFilter === 'exams') {
    filtered = filtered.filter(t => !t.completed && (t.type === 'exam' || t.type === 'quiz') &&
      t.due_date && t.due_date.slice(0, 10) >= todayStr && t.due_date.slice(0, 10) <= twoWeeksOut);
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
    list.innerHTML = `<p class="list-empty">${COPY.emptyTasks()}</p>`;
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
      refreshStats(false); // animate ring/counter immediately
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
  state.taskUserPickedSubject = !!task?.subject_id; // user already chose, don't overwrite
  state.taskUserPickedType = !!task?.type && task.type !== 'assignment';
  document.getElementById('taskModalTitle').textContent = task ? 'Edit Task' : 'New Task';
  document.getElementById('taskTitleInput').value = task ? task.title : '';
  document.getElementById('taskDescInput').value = task ? (task.description || '') : '';
  document.getElementById('taskDateInput').value = task && task.due_date ? task.due_date.slice(0, 10) : '';
  document.getElementById('taskTimeInput').value = task && task.due_time ? task.due_time.slice(0, 5) : '';
  document.getElementById('taskPriorityInput').value = task ? task.priority : 'medium';
  document.getElementById('taskSubjectInput').value = task && task.subject_id ? task.subject_id : '';
  document.getElementById('taskTypeInput').value = task && task.type ? task.type : 'assignment';
  // Reset autosuggest hint
  const hint = document.getElementById('autoSuggestHint');
  if (hint) hint.style.display = 'none';
  openModal('taskModal');
}

// Auto-suggest class as user types task title (and auto-detect type from keywords)
document.getElementById('taskTitleInput').addEventListener('input', (e) => {
  const title = e.target.value.trim();
  const hintEl = document.getElementById('autoSuggestHint');
  if (!title || title.length < 2) {
    if (hintEl) hintEl.style.display = 'none';
    return;
  }

  // Subject auto-pick (only if user hasn't manually chosen one yet)
  if (!state.taskUserPickedSubject) {
    const match = suggestSubject(title, state.subjects);
    const select = document.getElementById('taskSubjectInput');
    if (match) {
      select.value = match.subject.id;
      if (hintEl) {
        hintEl.style.display = '';
        hintEl.innerHTML = `<span style="color:var(--gold)">✦</span> Linked to <strong>${escapeHtml(match.subject.name)}</strong> · <span class="link-gold" id="autoSuggestUndo" style="cursor:pointer">change</span>`;
        document.getElementById('autoSuggestUndo').addEventListener('click', () => {
          select.value = '';
          state.taskUserPickedSubject = true;
          hintEl.style.display = 'none';
        }, { once: true });
      }
    } else if (select.value) {
      // Clear if no match and user hadn't manually set it
      select.value = '';
      if (hintEl) hintEl.style.display = 'none';
    }
  }

  // Type auto-pick — detect test/quiz/essay/etc keywords
  if (!state.taskUserPickedType) {
    const t = title.toLowerCase();
    const typeSelect = document.getElementById('taskTypeInput');
    let detected = null;
    if (/\b(test|exam|midterm|final)\b/.test(t)) detected = 'exam';
    else if (/\bquiz\b/.test(t)) detected = 'quiz';
    else if (/\b(essay|paper|report)\b/.test(t)) detected = 'essay';
    else if (/\bproject\b/.test(t)) detected = 'project';
    else if (/\blab\b/.test(t)) detected = 'lab';
    else if (/\b(read|reading|chapter|ch\.)\b/.test(t)) detected = 'reading';
    else if (/\b(study|review)\b/.test(t)) detected = 'study';
    if (detected) typeSelect.value = detected;
  }
});

// Track when user manually changes the subject/type — stop auto-overriding it
document.getElementById('taskSubjectInput').addEventListener('change', () => {
  state.taskUserPickedSubject = true;
  const hint = document.getElementById('autoSuggestHint');
  if (hint) hint.style.display = 'none';
});
document.getElementById('taskTypeInput').addEventListener('change', () => {
  state.taskUserPickedType = true;
});

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
// TODAY VIEW — Smart dashboard with focus card + human copy
// ==========================================================
function renderToday() {
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
  document.getElementById('todayDate').textContent = dateStr;

  // Greeting (rotates by time + style)
  const name = state.settings?.display_name || state.user?.username || '';
  const style = state.settings?.greeting_style || 'warm';
  document.getElementById('todayGreeting').textContent = COPY.greeting(now.getHours(), now.getDay(), name, style);

  const todayStr = now.toISOString().slice(0, 10);
  const weekFromNow = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  const twoWeeksOut = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const overdue = state.tasks.filter(t => !t.completed && t.due_date && t.due_date.slice(0, 10) < todayStr);
  const todayTasks = state.tasks.filter(t => !t.completed && t.due_date && t.due_date.slice(0, 10) === todayStr);
  const weekTasks = state.tasks.filter(t => !t.completed && t.due_date &&
    t.due_date.slice(0, 10) > todayStr && t.due_date.slice(0, 10) <= weekFromNow);
  const exams = state.tasks.filter(t => !t.completed && (t.type === 'exam' || t.type === 'quiz')
    && t.due_date && t.due_date.slice(0, 10) >= todayStr && t.due_date.slice(0, 10) <= twoWeeksOut)
    .sort((a, b) => (a.due_date || '').localeCompare(b.due_date || ''));

  const counts = { overdue: overdue.length, today: todayTasks.length, week: weekTasks.length, exams: exams.length };

  // View-sub line
  document.getElementById('todaySub').textContent = COPY.todaySub(counts);

  // Focus card — picks the most pressing thing
  const sortByPriority = (a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return (order[a.priority] || 1) - (order[b.priority] || 1);
  };
  const overdueSorted = [...overdue].sort(sortByPriority);
  const todaySorted = [...todayTasks].sort(sortByPriority);
  const nextTask = overdueSorted[0] || todaySorted[0] || weekTasks[0];
  const nextExam = exams[0];
  const focus = COPY.focus(counts, nextTask, nextExam);

  document.getElementById('focusEyebrow').textContent = focus.eyebrow;
  document.getElementById('focusHeadline').textContent = focus.headline;

  // Inline-show up to 3 priority items in the focus card if there are overdue/today
  const focusList = document.getElementById('focusTasks');
  const inFocus = [...overdueSorted, ...todaySorted].slice(0, 3);
  if (inFocus.length === 0 || (overdue.length === 0 && todayTasks.length === 0)) {
    focusList.innerHTML = '';
  } else {
    focusList.innerHTML = inFocus.map(taskHTML).join('');
    attachTaskHandlers(focusList);
  }

  // Secondary panels — respect user pref + auto-hide when empty
  function setPanel(id, items, renderEmpty, renderItems) {
    const panel = document.getElementById(id);
    if (!panel) return;
    const userHidden = panel.dataset.userHidden === '1';
    if (userHidden) { panel.style.display = 'none'; return; }
    if (items.length === 0 && id === 'overduePanel') {
      panel.style.display = 'none';
      return;
    }
    if (items.length === 0 && id === 'examsPanel') {
      panel.style.display = 'none';
      return;
    }
    panel.style.display = '';
    const list = panel.querySelector('.list');
    if (items.length === 0) {
      list.innerHTML = `<p class="list-empty">${renderEmpty()}</p>`;
    } else {
      list.innerHTML = renderItems();
      attachTaskHandlers(list);
    }
  }

  setPanel('overduePanel', overdue,
    () => '',
    () => overdue.slice(0, 5).map(taskHTML).join(''));
  setPanel('examsPanel', exams,
    () => '',
    () => exams.slice(0, 5).map(taskHTML).join(''));
  setPanel('todayPanel', todayTasks,
    () => COPY.emptyDueToday(),
    () => todayTasks.map(taskHTML).join(''));
  setPanel('weekPanel', weekTasks,
    () => COPY.emptyWeek(),
    () => weekTasks.slice(0, 5).map(taskHTML).join(''));

  // Reminders panel — only when user enabled it
  const reList = document.getElementById('todayRemindersList');
  const remindersPanel = document.getElementById('todayRemindersPanel');
  if (remindersPanel.dataset.userHidden === '1') {
    remindersPanel.style.display = 'none';
  } else {
    remindersPanel.style.display = '';
    const soon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const upcoming = state.reminders.filter(r => {
      const t = new Date(r.remind_at);
      return t >= now && t <= soon;
    }).slice(0, 5);
    if (upcoming.length === 0) {
      reList.innerHTML = `<p class="list-empty">${COPY.emptyReminders()}</p>`;
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

  // Exam banner
  updateExamBanner(exams);
}

// Show banner when a test/quiz is within 3 days, unless dismissed for that exam
function updateExamBanner(exams) {
  const banner = document.getElementById('examBanner');
  if (!banner) return;
  const now = new Date();
  const threeDays = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
  const todayStr = now.toISOString().slice(0, 10);

  // Find earliest exam within 3 days that isn't dismissed
  const dismissedKey = 'axiom_dismissed_exams';
  const dismissed = new Set(JSON.parse(localStorage.getItem(dismissedKey) || '[]'));
  const candidate = exams.find(e => {
    if (dismissed.has(`${e.id}`)) return false;
    if (!e.due_date) return false;
    const d = new Date(e.due_date.slice(0, 10) + 'T00:00:00');
    return d >= now && d <= threeDays;
  });

  if (!candidate) {
    banner.style.display = 'none';
    return;
  }

  // Build human-friendly text
  const dueDate = new Date(candidate.due_date.slice(0, 10) + 'T12:00:00');
  const ymd = candidate.due_date.slice(0, 10);
  let when;
  if (ymd === todayStr) when = 'today';
  else {
    const tom = new Date(now); tom.setDate(tom.getDate() + 1);
    if (ymd === tom.toISOString().slice(0, 10)) when = 'tomorrow';
    else when = 'on ' + dueDate.toLocaleDateString('en-US', { weekday: 'long' });
  }
  const subjectStr = candidate.subject_name ? candidate.subject_name + ' · ' : '';
  const typeWord = candidate.type === 'exam' ? 'Test' : 'Quiz';
  document.getElementById('examBannerTitle').textContent = `${typeWord} ${when}: ${candidate.title}`;
  document.getElementById('examBannerSub').textContent = subjectStr + dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  banner.style.display = '';
  banner.dataset.examId = candidate.id;
}

// Wire up the banner close button
document.getElementById('examBannerClose').addEventListener('click', () => {
  const banner = document.getElementById('examBanner');
  const id = banner.dataset.examId;
  if (id) {
    const dismissedKey = 'axiom_dismissed_exams';
    const dismissed = new Set(JSON.parse(localStorage.getItem(dismissedKey) || '[]'));
    dismissed.add(id);
    localStorage.setItem(dismissedKey, JSON.stringify([...dismissed]));
  }
  banner.style.display = 'none';
});

// ==========================================================
// IMPORT VIEW — Two feeds (classes + assignments) + Gemini AI
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
    addSyncEntry('AI assistant connected.', 'ok');
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
    const classesContainer = document.getElementById('classesFeedList');
    const assignmentsContainer = document.getElementById('assignmentsFeedList');

    const classes = feeds.filter(f => f.feed_type === 'classes');
    const assignments = feeds.filter(f => f.feed_type !== 'classes');

    classesContainer.innerHTML = renderFeedListHtml(classes);
    assignmentsContainer.innerHTML = renderFeedListHtml(assignments);

    [classesContainer, assignmentsContainer].forEach(container => {
      container.querySelectorAll('.feed-item').forEach(el => {
        const id = +el.dataset.id;
        el.querySelector('[data-act="sync"]').addEventListener('click', () => syncFeedAndRefresh(id, el));
        el.querySelector('[data-act="delete"]').addEventListener('click', async () => {
          if (!confirm('Remove this feed? Imported tasks/classes stay.')) return;
          await api.deleteFeed(id);
          await loadFeeds();
        });
      });
    });
  } catch (e) { console.error(e); }
}

function renderFeedListHtml(feeds) {
  if (feeds.length === 0) return '';
  return feeds.map(f => {
    const lastSync = f.last_synced ? formatRelative(f.last_synced) : 'Never synced';
    const errClass = f.last_status === 'error' ? 'error' : '';
    const errMsg = f.last_status === 'error' ? ` · ${escapeHtml(f.last_error || 'Error')}` : '';
    return `
      <div class="feed-item" data-id="${f.id}">
        <div class="feed-icon">${f.feed_type === 'classes' ? '🗓' : '📝'}</div>
        <div class="feed-body">
          <div class="feed-label">${escapeHtml(f.label)}</div>
          <div class="feed-meta ${errClass}">${escapeHtml(lastSync)}${errMsg}</div>
        </div>
        <div class="feed-actions">
          <button class="btn-sync" data-act="sync">Sync</button>
          <button class="icon-btn" data-act="delete" title="Remove">×</button>
        </div>
      </div>
    `;
  }).join('');
}

function formatRelative(iso) {
  const then = new Date(iso);
  const diff = Date.now() - then.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'Just synced';
  if (mins < 60) return `Synced ${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `Synced ${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `Synced ${days}d ago`;
  return `Synced ${then.toLocaleDateString()}`;
}

document.getElementById('addClassesFeedBtn').addEventListener('click', () => addFeed('classes'));
document.getElementById('addAssignmentsFeedBtn').addEventListener('click', () => addFeed('assignments'));

async function addFeed(feedType) {
  const urlInput = document.getElementById(feedType === 'classes' ? 'classesFeedUrl' : 'assignmentsFeedUrl');
  const labelInput = document.getElementById(feedType === 'classes' ? 'classesFeedLabel' : 'assignmentsFeedLabel');
  const url = urlInput.value.trim();
  const label = labelInput.value.trim() || (feedType === 'classes' ? 'Class Schedule' : 'Assignments');
  if (!url) return alert('Paste a calendar URL first.');
  try {
    await api.addFeed(url, label, feedType);
    urlInput.value = '';
    labelInput.value = '';
    addSyncEntry(`Added ${feedType === 'classes' ? 'class schedule' : 'assignments'} feed "${label}". Click Sync to import.`, 'ok');
    await loadFeeds();
  } catch (err) {
    alert(err.message);
  }
}

async function syncFeedAndRefresh(id, el) {
  const btn = el.querySelector('.btn-sync');
  btn.disabled = true;
  btn.textContent = 'Syncing...';
  addSyncEntry('Fetching calendar...', '');
  try {
    const result = await api.syncFeed(id);
    const aiNote = result.ai_used ? ' <strong>(AI-organized)</strong>' : '';
    addSyncEntry(`<strong>${result.message}</strong>${aiNote}`, 'ok');
    await Promise.all([loadTasks(), loadSubjects(), loadFeeds()]);
    populateSubjectSelects();
    renderAll();
  } catch (err) {
    addSyncEntry('Sync failed: ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Sync';
  }
}

function addSyncEntry(html, kind = '') {
  const log = document.getElementById('syncLog');
  const entry = document.createElement('div');
  entry.className = 'sync-entry ' + kind;
  const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  entry.innerHTML = `<span style="opacity:0.6">[${time}]</span> ${html}`;
  log.insertBefore(entry, log.firstChild);
  while (log.children.length > 8) log.removeChild(log.lastChild);
}

// ==========================================================
// SETTINGS PAGE — appearance, profile, today layout, danger zone
// ==========================================================
const ACCENT_PALETTE = [
  '#d4a857', // gold (default)
  '#e08667', // coral
  '#f0c274', // warm peach
  '#c05a3e', // rust
  '#b8c9e0', // powder blue
  '#7ab0c4', // teal
  '#8fb67c', // sage
  '#c9a3d4', // lilac
  '#d68aa3', // rose
  '#a8b87c', // olive
];

async function renderSettingsView() {
  // Pull fresh settings each time, in case other tabs changed them
  try { state.settings = await api.settings(); } catch (e) {}

  const s = state.settings || {};

  // Profile
  document.getElementById('displayNameInput').value = s.display_name || '';
  document.getElementById('greetingStyleSelect').value = s.greeting_style || 'warm';

  // Accent color picker
  const accentPicker = document.getElementById('accentColorPicker');
  accentPicker.innerHTML = ACCENT_PALETTE.map(c => `
    <div class="color-swatch ${c === (s.accent_color || '#d4a857') ? 'selected' : ''}"
         style="background:${c}" data-color="${c}"></div>
  `).join('');
  accentPicker.querySelectorAll('.color-swatch').forEach(sw => {
    sw.addEventListener('click', async () => {
      accentPicker.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
      sw.classList.add('selected');
      const color = sw.dataset.color;
      try {
        await api.updateSettings({ accent_color: color });
        state.settings.accent_color = color;
        applyAccentColor();
      } catch (err) { alert(err.message); }
    });
  });

  // Logo settings
  renderLogoSettings();

  // Today panel toggles
  const toggleMap = {
    'toggle_show_overdue': 'show_overdue',
    'toggle_show_exams': 'show_exams',
    'toggle_show_today': 'show_today',
    'toggle_show_week': 'show_week',
    'toggle_show_reminders_today': 'show_reminders_today',
  };
  for (const [domId, key] of Object.entries(toggleMap)) {
    const el = document.getElementById(domId);
    if (!el) continue;
    el.checked = s[key] !== false && (key === 'show_reminders_today' ? !!s[key] : s[key] !== false);
    if (key === 'show_reminders_today') el.checked = !!s[key];
    el.onchange = async () => {
      try {
        const patch = { [key]: el.checked };
        await api.updateSettings(patch);
        state.settings[key] = el.checked;
        applyTodayPanelVisibility();
      } catch (err) { alert(err.message); el.checked = !el.checked; }
    };
  }
}

function renderLogoSettings() {
  const isPinned = logoState.pinned !== null;
  const cur = logoState.current;

  // Settings preview cube updates automatically via setIdx() in flipToLogo

  const modeEl = document.getElementById('logoMode');
  if (modeEl) {
    if (isPinned) {
      modeEl.textContent = `Pinned — cube #${cur + 1} every time you open Axiom.`;
    } else if (logoState.rotateFavoritesOnly && logoState.favorites.length > 0) {
      modeEl.textContent = `Rotating through your ${logoState.favorites.length} favorite${logoState.favorites.length === 1 ? '' : 's'}.`;
    } else {
      modeEl.textContent = 'Random — a different cube each open.';
    }
  }

  const pinBtn = document.getElementById('pinLogoBtn');
  const unpinBtn = document.getElementById('unpinLogoBtn');
  if (pinBtn) pinBtn.style.display = isPinned ? 'none' : '';
  if (unpinBtn) unpinBtn.style.display = isPinned ? '' : 'none';

  // Render favorite slots (5 slots, shows favorites + plus boxes for empty)
  renderLogoFavoriteSlots();

  // Build gallery once
  const gallery = document.getElementById('logoGallery');
  if (gallery && !gallery.dataset.built) {
    gallery.innerHTML = '';
    for (let i = 0; i < 42; i++) {
      const cell = document.createElement('div');
      cell.className = 'logo-thumb';
      cell.dataset.idx = i;
      gallery.appendChild(cell);
      // Spawn mini Three.js cube — but lazily, only when scrolled near
      // For simplicity, render all eagerly (42 small canvases — fine)
      new AxiomCube(cell, {
        size: 64,
        idx: i,
        autoRotate: true,
        rotateSpeed: 0.003 + (i % 5) * 0.0008, // varied speeds
      });
    }
    gallery.dataset.built = '1';
    gallery.querySelectorAll('.logo-thumb').forEach(cell => {
      cell.addEventListener('click', async () => {
        const idx = +cell.dataset.idx;
        flipToLogo(idx);
        try {
          await api.updateSettings({ pinned_logo: idx });
          logoState.pinned = idx;
          if (state.settings) state.settings.pinned_logo = idx;
          renderLogoSettings();
        } catch (err) { alert(err.message); }
      });
    });
  }
  if (gallery) {
    gallery.querySelectorAll('.logo-thumb').forEach(el => {
      el.classList.toggle('active', +el.dataset.idx === logoState.current);
    });
  }

  // Rotation mode toggle
  const rotToggle = document.getElementById('rotateFavoritesToggle');
  if (rotToggle) rotToggle.checked = !!logoState.rotateFavoritesOnly;
}

function renderLogoFavoriteSlots() {
  const wrap = document.getElementById('logoFavoritesRow');
  if (!wrap) return;
  // Clean up any existing cube instances on this row
  wrap.querySelectorAll('.logo-favorite-slot').forEach(el => {
    if (el._cube) { el._cube.destroy(); el._cube = null; }
  });
  wrap.innerHTML = '';
  for (let i = 0; i < 5; i++) {
    const slot = document.createElement('div');
    if (i < logoState.favorites.length) {
      const idx = logoState.favorites[i];
      slot.className = 'logo-favorite-slot';
      slot.dataset.fav = idx;
      slot.title = 'Click to use this favorite';
      wrap.appendChild(slot);
      slot._cube = new AxiomCube(slot, {
        size: 40,
        idx,
        autoRotate: true,
        rotateSpeed: 0.004,
      });
      slot.addEventListener('click', () => flipToLogo(idx));
    } else {
      slot.className = 'logo-favorite-slot empty';
      wrap.appendChild(slot);
    }
  }
}

document.getElementById('rerollLogoBtn').addEventListener('click', () => {
  flipToLogo(pickNextLogo());
});

document.getElementById('pinLogoBtn').addEventListener('click', async () => {
  try {
    await api.updateSettings({ pinned_logo: logoState.current });
    logoState.pinned = logoState.current;
    if (state.settings) state.settings.pinned_logo = logoState.current;
    updateLogoFabs();
    renderLogoSettings();
  } catch (err) { alert(err.message); }
});

document.getElementById('unpinLogoBtn').addEventListener('click', async () => {
  try {
    await api.updateSettings({ pinned_logo: null });
    logoState.pinned = null;
    if (state.settings) state.settings.pinned_logo = null;
    flipToLogo(pickNextLogo());
    renderLogoSettings();
  } catch (err) { alert(err.message); }
});

document.getElementById('browseLogoBtn').addEventListener('click', () => {
  const gallery = document.getElementById('logoGallery');
  gallery.style.display = gallery.style.display === 'none' ? '' : 'none';
});

// Rotate-favorites-only toggle
document.getElementById('rotateFavoritesToggle').addEventListener('change', async (e) => {
  const checked = e.target.checked;
  try {
    await api.updateSettings({ rotate_favorites_only: checked });
    logoState.rotateFavoritesOnly = checked;
    if (state.settings) state.settings.rotate_favorites_only = checked;
    renderLogoSettings();
  } catch (err) {
    alert(err.message);
    e.target.checked = !checked;
  }
});

// ==========================================================
// MATCH BACKGROUND — extract dominant color from background.jpg
// ==========================================================
document.getElementById('matchBackgroundBtn').addEventListener('click', async () => {
  const btn = document.getElementById('matchBackgroundBtn');
  btn.disabled = true;
  btn.textContent = 'Looking at the colors…';
  try {
    const colors = await extractBackgroundColors('/background.jpg');
    if (colors.length === 0) throw new Error('Could not read colors from image');
    // Pick the most vibrant warm color as the accent. If none warm, use brightest.
    const best = pickAccentFromPalette(colors);
    await api.updateSettings({ accent_color: best });
    state.settings.accent_color = best;
    applyAccentColor();
    // Re-render the swatches
    renderSettingsView();
    showToast('Accent updated', `Pulled from your background — ${best}`);
  } catch (err) {
    showToast('Could not match', err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = '✨ Match my background';
  }
});

// Pull dominant colors from an image using k-means on downsampled pixels
async function extractBackgroundColors(imageUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      // Downsample to a small canvas for speed
      const W = 64, H = 64;
      const canvas = document.createElement('canvas');
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, W, H);
      const { data } = ctx.getImageData(0, 0, W, H);

      // Collect pixels (skip fully transparent + super dark/bright extremes)
      const pixels = [];
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
        if (a < 128) continue;
        const sum = r + g + b;
        if (sum < 60 || sum > 720) continue; // too dark / too bright
        pixels.push([r, g, b]);
      }
      if (pixels.length < 50) return reject(new Error('Image too plain to read colors'));

      // K-means with k=5
      const k = 5;
      const centroids = [];
      for (let i = 0; i < k; i++) {
        centroids.push(pixels[Math.floor(Math.random() * pixels.length)].slice());
      }
      for (let iter = 0; iter < 12; iter++) {
        const buckets = Array.from({ length: k }, () => []);
        for (const px of pixels) {
          let best = 0, bestDist = Infinity;
          for (let j = 0; j < k; j++) {
            const c = centroids[j];
            const d = (px[0] - c[0]) ** 2 + (px[1] - c[1]) ** 2 + (px[2] - c[2]) ** 2;
            if (d < bestDist) { bestDist = d; best = j; }
          }
          buckets[best].push(px);
        }
        for (let j = 0; j < k; j++) {
          if (buckets[j].length === 0) continue;
          const sumR = buckets[j].reduce((s, p) => s + p[0], 0);
          const sumG = buckets[j].reduce((s, p) => s + p[1], 0);
          const sumB = buckets[j].reduce((s, p) => s + p[2], 0);
          centroids[j] = [Math.round(sumR / buckets[j].length), Math.round(sumG / buckets[j].length), Math.round(sumB / buckets[j].length)];
        }
      }
      // Sort by saturation × bucket count
      const result = centroids.map((c, i) => ({
        rgb: c,
        hex: rgbToHex(c[0], c[1], c[2]),
        saturation: rgbSaturation(c[0], c[1], c[2]),
        warmth: rgbWarmth(c[0], c[1], c[2]),
      }));
      result.sort((a, b) => b.saturation - a.saturation);
      resolve(result);
    };
    img.onerror = () => reject(new Error('Could not load background image'));
    img.src = imageUrl;
  });
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map(x => Math.max(0, Math.min(255, x)).toString(16).padStart(2, '0')).join('');
}

function rgbSaturation(r, g, b) {
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  if (max === 0) return 0;
  return (max - min) / max;
}

function rgbWarmth(r, g, b) {
  // Higher = warmer (red+yellow). Lower = cooler (blue).
  return (r * 1.2 + (g * 0.6) - b) / 255;
}

function pickAccentFromPalette(colors) {
  // Prefer a color that is BOTH saturated AND warm-toned (good readable accent)
  const scored = colors.map(c => ({
    ...c,
    score: c.saturation * 0.7 + Math.max(0, c.warmth) * 0.3,
  }));
  scored.sort((a, b) => b.score - a.score);
  return scored[0].hex;
}

// Profile field saves (debounced)
let profileSaveTimer = null;
['displayNameInput', 'greetingStyleSelect'].forEach(id => {
  const el = document.getElementById(id);
  if (!el) return;
  el.addEventListener('input', () => {
    clearTimeout(profileSaveTimer);
    profileSaveTimer = setTimeout(saveProfile, 500);
  });
  el.addEventListener('change', () => {
    clearTimeout(profileSaveTimer);
    saveProfile();
  });
});

async function saveProfile() {
  const display_name = document.getElementById('displayNameInput').value.trim() || null;
  const greeting_style = document.getElementById('greetingStyleSelect').value;
  try {
    await api.updateSettings({ display_name, greeting_style });
    state.settings.display_name = display_name;
    state.settings.greeting_style = greeting_style;
    document.getElementById('userName').textContent = display_name || state.user.username;
    if (state.currentView === 'today') renderToday();
  } catch (err) { /* silent */ }
}

// ==========================================================
// CLEAR TASKS — danger zone
// ==========================================================
document.getElementById('clearCompletedBtn').addEventListener('click', () => {
  const count = state.tasks.filter(t => t.completed).length;
  if (count === 0) return showToast('Nothing to clear', 'No completed tasks yet.');
  customConfirm({
    title: 'Clear completed tasks?',
    body: `This deletes ${count} completed task${count === 1 ? '' : 's'}. The unchecked ones stay.`,
    okText: 'Clear them',
    onOk: async () => {
      try {
        const r = await api.clearTasks({ mode: 'completed' });
        state.tasks = state.tasks.filter(t => !t.completed);
        showToast('Cleared', `Deleted ${r.deleted} completed task${r.deleted === 1 ? '' : 's'}.`);
        await loadSubjects();
        renderAll();
      } catch (err) { alert(err.message); }
    }
  });
});

document.getElementById('clearAllBtn').addEventListener('click', () => {
  if (state.tasks.length === 0) return showToast('Nothing to clear', 'No tasks yet.');
  customConfirm({
    title: 'Clear EVERY task?',
    body: `This deletes all ${state.tasks.length} of your tasks — completed, open, all of them. Classes and notes are kept. Are you sure?`,
    okText: 'Yes, clear everything',
    danger: true,
    onOk: async () => {
      try {
        const r = await api.clearTasks({ mode: 'all' });
        state.tasks = [];
        showToast('Cleared', `Deleted ${r.deleted} task${r.deleted === 1 ? '' : 's'}.`);
        await loadSubjects();
        renderAll();
      } catch (err) { alert(err.message); }
    }
  });
});

document.getElementById('clearBySubjectBtn').addEventListener('click', () => {
  if (state.subjects.length === 0) return showToast('No classes', 'Add a class first.');
  const select = document.getElementById('clearSubjectSelect');
  select.innerHTML = state.subjects.map(s => {
    const taskCount = state.tasks.filter(t => t.subject_id === s.id).length;
    return `<option value="${s.id}">${escapeHtml(s.name)} — ${taskCount} task${taskCount === 1 ? '' : 's'}</option>`;
  }).join('');
  openModal('clearSubjectModal');
});

document.getElementById('clearSubjectForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const subjectId = +document.getElementById('clearSubjectSelect').value;
  const subject = state.subjects.find(s => s.id === subjectId);
  closeModal();
  customConfirm({
    title: `Clear ${subject?.name || 'class'}?`,
    body: `This deletes every task linked to "${subject?.name}". The class itself stays.`,
    okText: 'Clear them',
    onOk: async () => {
      try {
        const r = await api.clearTasks({ mode: 'subject', subject_id: subjectId });
        state.tasks = state.tasks.filter(t => t.subject_id !== subjectId);
        showToast('Cleared', `Deleted ${r.deleted} task${r.deleted === 1 ? '' : 's'} from ${subject?.name}.`);
        await loadSubjects();
        renderAll();
      } catch (err) { alert(err.message); }
    }
  });
});

document.getElementById('clearByDateBtn').addEventListener('click', () => {
  document.getElementById('clearBeforeInput').value = '';
  document.getElementById('clearAfterInput').value = '';
  openModal('clearDateModal');
});

document.getElementById('clearDateForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const before = document.getElementById('clearBeforeInput').value;
  const after = document.getElementById('clearAfterInput').value;
  if (!before && !after) return alert('Pick at least one date.');
  closeModal();

  let descPart = '';
  if (before && after) descPart = `before ${before} OR after ${after}`;
  else if (before) descPart = `before ${before}`;
  else descPart = `after ${after}`;

  customConfirm({
    title: 'Clear by date?',
    body: `This deletes tasks with a due date ${descPart}. Tasks without a due date won't be touched.`,
    okText: 'Clear them',
    onOk: async () => {
      try {
        const payload = { mode: 'date_range' };
        if (before) payload.before_date = before;
        if (after) payload.after_date = after;
        const r = await api.clearTasks(payload);
        // Refresh tasks instead of trying to predict locally
        await loadTasks();
        showToast('Cleared', `Deleted ${r.deleted} task${r.deleted === 1 ? '' : 's'}.`);
        await loadSubjects();
        renderAll();
      } catch (err) { alert(err.message); }
    }
  });
});

// ==========================================================
// CUSTOM CONFIRM — replaces window.confirm with friendlier copy
// ==========================================================
function customConfirm({ title, body, okText = 'Confirm', danger = false, onOk }) {
  document.getElementById('confirmTitle').textContent = title;
  document.getElementById('confirmBody').textContent = body;
  const okBtn = document.getElementById('confirmOk');
  okBtn.textContent = okText;
  okBtn.classList.toggle('btn-danger', danger);

  const cleanup = () => {
    okBtn.replaceWith(okBtn.cloneNode(true));
    document.getElementById('confirmCancel').replaceWith(document.getElementById('confirmCancel').cloneNode(true));
  };
  const newOk = okBtn.cloneNode(true);
  okBtn.replaceWith(newOk);
  newOk.addEventListener('click', () => { closeModal(); onOk?.(); });
  const cancelBtn = document.getElementById('confirmCancel');
  const newCancel = cancelBtn.cloneNode(true);
  cancelBtn.replaceWith(newCancel);
  newCancel.addEventListener('click', () => closeModal());

  openModal('confirmModal');
}
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
// AUTO-CLASS MATCHER — guesses which class a task belongs to
// based on its title. Runs locally, no AI required.
//
// Tries strategies in order, returns highest-confidence match:
//   1. Exact class name appears in title
//   2. Subject name (math/english/etc) maps to a known class
//   3. Course code prefix (ENG10:, MATH-) maps to a class
//   4. Teacher name in title matches a class teacher
// ==========================================================

// Common subject words that suggest a class type. Each maps to keywords
// to scan in your class list.
const SUBJECT_HINTS = {
  math:    ['math', 'algebra', 'calculus', 'geometry', 'trig', 'statistics', 'precalc', 'calc'],
  english: ['english', 'lit', 'literature', 'writing', 'composition', 'reading', 'poetry'],
  science: ['science', 'biology', 'bio', 'chemistry', 'chem', 'physics', 'anatomy', 'environmental'],
  history: ['history', 'social studies', 'civics', 'government', 'econ', 'economics', 'geography', 'world'],
  language:['spanish', 'french', 'latin', 'german', 'mandarin', 'chinese', 'japanese', 'arabic'],
  art:     ['art', 'drawing', 'painting', 'studio', 'design'],
  music:   ['music', 'band', 'orchestra', 'choir', 'chorus', 'piano'],
  pe:      ['gym', 'pe', 'physical education', 'fitness', 'health'],
  cs:      ['computer', 'cs', 'coding', 'programming', 'software'],
};

function suggestSubject(title, subjects) {
  if (!title || !subjects || subjects.length === 0) return null;
  const t = title.toLowerCase();

  // Strategy 1: exact class name appears in title
  // Sort by length desc so "English 10" matches before "English"
  const sortedSubjects = [...subjects].sort((a, b) => (b.name?.length || 0) - (a.name?.length || 0));
  for (const s of sortedSubjects) {
    if (!s.name) continue;
    const name = s.name.toLowerCase();
    // Use word boundary for short names to avoid false positives
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\b`, 'i');
    if (re.test(t)) return { subject: s, confidence: 'high', strategy: 'name' };
  }

  // Strategy 2: course code prefix
  // e.g. "ENG10: Read Ch 4" or "MATH-H quiz"
  const prefixMatch = t.match(/^([a-z]{2,5})[\s\-:]?(\d{0,3})/i);
  if (prefixMatch) {
    const prefix = prefixMatch[0].toLowerCase().replace(/[\s\-:]/g, '');
    for (const s of subjects) {
      const sName = s.name.toLowerCase().replace(/[\s\-:]/g, '');
      if (sName.includes(prefix) || prefix.includes(sName.slice(0, 4))) {
        return { subject: s, confidence: 'medium', strategy: 'prefix' };
      }
    }
  }

  // Strategy 3: subject keyword match (math → Algebra, science → Bio, etc.)
  for (const [category, words] of Object.entries(SUBJECT_HINTS)) {
    for (const word of words) {
      if (new RegExp(`\\b${word}\\b`, 'i').test(t)) {
        // Try to find a class whose name also matches this category
        for (const s of subjects) {
          const sLower = s.name.toLowerCase();
          for (const w of words) {
            if (sLower.includes(w)) return { subject: s, confidence: 'medium', strategy: 'keyword' };
          }
        }
      }
    }
  }

  // Strategy 4: teacher name in title matches a class teacher
  for (const s of subjects) {
    if (s.teacher) {
      const teacherLast = s.teacher.split(/\s+/).pop().toLowerCase();
      if (teacherLast.length >= 3 && t.includes(teacherLast)) {
        return { subject: s, confidence: 'low', strategy: 'teacher' };
      }
    }
  }

  return null;
}

// ==========================================================
// AUTO-LINK CARD — bulk-link unmatched tasks to classes
// ==========================================================
function updateAutoLinkCard() {
  const card = document.getElementById('autoLinkCard');
  if (!card) return;
  if (state.subjects.length === 0) { card.style.display = 'none'; return; }

  // Find tasks without subject_id that we CAN match
  const unmatched = state.tasks.filter(t => !t.subject_id && !t.completed);
  if (unmatched.length === 0) { card.style.display = 'none'; return; }

  // How many of those would actually match to something via the local matcher?
  const matchable = unmatched.filter(t => suggestSubject(t.title, state.subjects)).length;
  if (matchable === 0) { card.style.display = 'none'; return; }

  card.style.display = '';
  document.getElementById('autoLinkCount').textContent =
    `${matchable} task${matchable === 1 ? '' : 's'} could be auto-linked to a class`;
  document.getElementById('autoLinkSub').textContent =
    matchable === unmatched.length
      ? 'Tap to link them.'
      : `Tap to link them. ${unmatched.length - matchable} won't be touched (no clear class match).`;
}

document.getElementById('autoLinkBtn').addEventListener('click', async () => {
  const btn = document.getElementById('autoLinkBtn');
  btn.disabled = true;
  btn.textContent = 'Linking…';
  try {
    const matches = [];
    for (const t of state.tasks) {
      if (t.subject_id || t.completed) continue;
      const m = suggestSubject(t.title, state.subjects);
      if (m) matches.push({ id: t.id, subject_id: m.subject.id });
    }
    if (matches.length === 0) {
      showToast('Nothing to link', 'No confident matches found.');
      return;
    }
    const r = await api.autoLinkTasks(matches);
    showToast('Linked!', `${r.linked} task${r.linked === 1 ? '' : 's'} now linked to a class.`);
    await Promise.all([loadTasks(), loadSubjects()]);
    renderAll();
  } catch (err) {
    showToast('Link failed', err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Auto-link';
  }
});

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
  // Boot up Three.js geometric background layer
  const geoMount = document.getElementById('geoBg');
  if (geoMount) {
    geoBackground = new GeometricBackground(geoMount, {
      accentColor: 0xd4a857, // initial — will be updated by accent setting
    });
  }
  // Auth screen cube
  initAuthCube();

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
