require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const { initDb } = require('./db');

const authRoutes = require('./routes/auth');
const subjectsRoutes = require('./routes/subjects');
const tasksRoutes = require('./routes/tasks');
const notesRoutes = require('./routes/notes');
const remindersRoutes = require('./routes/reminders');
const importRoutes = require('./routes/import');
const settingsRoutes = require('./routes/settings');
const statsRoutes = require('./routes/stats');
const logosRoutes = require('./routes/logos');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '2mb' }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth', authRoutes);
app.use('/api/subjects', subjectsRoutes);
app.use('/api/tasks', tasksRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/reminders', remindersRoutes);
app.use('/api/import', importRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/logos', logosRoutes);

app.get('/health', (req, res) => res.json({ ok: true }));

// Serve index.html for all other routes (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start
initDb()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`✓ Axiom Planner running on port ${PORT}`);
    });
  })
  .catch(err => {
    console.error('Failed to start:', err);
    process.exit(1);
  });
