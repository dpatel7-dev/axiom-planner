require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const { initDb } = require('./db');
const { startBackgroundJobs } = require('./jobs');

const { softAuth } = require('./routes/auth-middleware');
const { maintenanceMiddleware } = require('./routes/maintenance-middleware');

const authRoutes = require('./routes/auth');
const subjectsRoutes = require('./routes/subjects');
const tasksRoutes = require('./routes/tasks');
const notesRoutes = require('./routes/notes');
const remindersRoutes = require('./routes/reminders');
const importRoutes = require('./routes/import');
const settingsRoutes = require('./routes/settings');
const statsRoutes = require('./routes/stats');
const logosRoutes = require('./routes/logos');
const studyRoutes = require('./routes/study');
const recurringRoutes = require('./routes/recurring');
const focusRoutes = require('./routes/focus');
const searchRoutes = require('./routes/search');
const maintenanceRoutes = require('./routes/maintenance');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust proxies (Render terminates SSL upstream); needed for accurate req.ip in audit log
app.set('trust proxy', 1);

// Tell every well-behaved crawler not to index, archive, or train on this site.
// (Backed up by /public/robots.txt and meta tags in index.html.)
app.use((req, res, next) => {
  res.set('X-Robots-Tag', 'noindex, nofollow, noarchive, nosnippet, noai, noimageai');
  next();
});

// Increase body limit to handle file uploads (PDFs / images base64-encoded)
app.use(express.json({ limit: '15mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

// API routes — soft-auth populates req.userId if logged in,
// then maintenance middleware decides whether to block 503
app.use('/api', softAuth);
app.use('/api', maintenanceMiddleware);

app.use('/api/auth', authRoutes);
app.use('/api/subjects', subjectsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/reminders', remindersRoutes);
app.use('/api/import', importRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/logos', logosRoutes);
app.use('/api/study', studyRoutes);
app.use('/api/recurring', recurringRoutes);
app.use('/api/focus', focusRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/maintenance', maintenanceRoutes);

app.get('/health', (req, res) => res.json({ ok: true }));

// SPA fallback
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✓ Axiom Planner running on port ${PORT}`);
      startBackgroundJobs();
    });
  })
  .catch(err => {
    console.error('Failed to start:', err);
    process.exit(1);
  });
