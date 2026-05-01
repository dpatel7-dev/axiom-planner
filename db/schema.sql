-- Axiom Planner Database Schema
-- Order matters: tables → migrations (add/drop columns on existing tables) → indexes

-- =========================================================
-- 1. CREATE TABLES (no-ops if they already exist)
-- =========================================================

CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS subjects (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(100) NOT NULL,
  color VARCHAR(20) DEFAULT '#d4a857',
  teacher VARCHAR(100),
  room VARCHAR(50),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  subject_id INT REFERENCES subjects(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  description TEXT,
  type VARCHAR(20) DEFAULT 'assignment',
  due_date DATE,
  due_time TIME,
  completed BOOLEAN DEFAULT FALSE,
  priority VARCHAR(10) DEFAULT 'medium',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS notes (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  subject_id INT REFERENCES subjects(id) ON DELETE SET NULL,
  title VARCHAR(255),
  content TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reminders (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(255) NOT NULL,
  remind_at TIMESTAMP NOT NULL,
  notified BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Stores a user's subscribed ICS calendar feed (e.g. Veracross calendar URL)
CREATE TABLE IF NOT EXISTS ical_feeds (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  url TEXT NOT NULL,
  label VARCHAR(100) DEFAULT 'School Calendar',
  feed_type VARCHAR(20) DEFAULT 'assignments',
  last_synced TIMESTAMP,
  last_status VARCHAR(50),
  last_error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Per-user settings (Gemini API key, theme, preferences, etc.)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  gemini_api_key TEXT,
  ai_enabled BOOLEAN DEFAULT FALSE,
  accent_color VARCHAR(20) DEFAULT '#d4a857',
  display_name VARCHAR(80),
  greeting_style VARCHAR(20) DEFAULT 'warm',
  pinned_logo INT,
  rotate_favorites_only BOOLEAN DEFAULT FALSE,
  best_day_count INT DEFAULT 0,
  best_day_date DATE,
  show_overdue BOOLEAN DEFAULT TRUE,
  show_exams BOOLEAN DEFAULT TRUE,
  show_today BOOLEAN DEFAULT TRUE,
  show_week BOOLEAN DEFAULT TRUE,
  show_reminders_today BOOLEAN DEFAULT FALSE,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Tracks which ICS UIDs have already been imported as tasks, so we don't duplicate
CREATE TABLE IF NOT EXISTS ical_imported (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  feed_id INT REFERENCES ical_feeds(id) ON DELETE CASCADE,
  ical_uid TEXT NOT NULL,
  task_id INT REFERENCES tasks(id) ON DELETE SET NULL,
  imported_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, ical_uid)
);

-- Per-user favorites for the logo (up to 5 saved cube indices)
CREATE TABLE IF NOT EXISTS logo_favorites (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  logo_idx INT NOT NULL CHECK (logo_idx >= 0 AND logo_idx < 42),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, logo_idx)
);

-- Study guides — AI-generated study material per topic/class
CREATE TABLE IF NOT EXISTS study_guides (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  subject_id INT REFERENCES subjects(id) ON DELETE SET NULL,
  title VARCHAR(255) NOT NULL,
  source_summary TEXT,                  -- short label for the source content (e.g. "From PDF + 3 photos")
  content_md TEXT,                       -- the rendered study guide as markdown
  flashcards JSONB,                      -- array of {q, a} pairs
  practice_questions JSONB,              -- array of {q, a, type} 
  key_concepts JSONB,                    -- array of strings
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Recurring task rules — when a task gets checked off, a new instance is generated
CREATE TABLE IF NOT EXISTS recurring_rules (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  task_template JSONB NOT NULL,          -- frozen task fields {title, type, priority, subject_id, due_time}
  pattern VARCHAR(20) NOT NULL,          -- 'daily' | 'weekdays' | 'weekly' | 'every_n_days'
  pattern_value INT,                     -- e.g. n in 'every_n_days'
  weekdays VARCHAR(20),                  -- e.g. 'mon,wed,fri' for 'weekly' pattern
  active BOOLEAN DEFAULT TRUE,
  next_due DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Focus sessions — Pomodoro-style timed work blocks per task
CREATE TABLE IF NOT EXISTS focus_sessions (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  task_id INT REFERENCES tasks(id) ON DELETE SET NULL,
  duration_minutes INT NOT NULL,
  completed BOOLEAN DEFAULT FALSE,
  started_at TIMESTAMP NOT NULL,
  ended_at TIMESTAMP
);

-- Study guide chat messages — follow-up questions per guide
CREATE TABLE IF NOT EXISTS study_chat_messages (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE CASCADE,
  guide_id INT REFERENCES study_guides(id) ON DELETE CASCADE,
  role VARCHAR(20) NOT NULL,             -- 'user' | 'assistant'
  content TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Maintenance mode singleton — id is always 1 so we have at most one row
CREATE TABLE IF NOT EXISTS maintenance_state (
  id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled BOOLEAN DEFAULT FALSE,
  message TEXT DEFAULT 'We''re making things better. Back in a few minutes.',
  enabled_at TIMESTAMP,
  enabled_by INT REFERENCES users(id) ON DELETE SET NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit log of admin actions (maintenance toggles, etc.)
CREATE TABLE IF NOT EXISTS admin_audit_log (
  id SERIAL PRIMARY KEY,
  user_id INT REFERENCES users(id) ON DELETE SET NULL,
  username VARCHAR(80),                  -- denormalized so it survives user deletion
  action VARCHAR(40) NOT NULL,           -- e.g. 'maintenance_on', 'maintenance_off'
  details TEXT,                          -- e.g. the message body when enabling
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed the singleton row (safe on re-runs)
INSERT INTO maintenance_state (id, enabled, message)
VALUES (1, FALSE, 'We''re making things better. Back in a few minutes.')
ON CONFLICT (id) DO NOTHING;

-- =========================================================
-- 2. MIGRATIONS — must run BEFORE indexes that depend on these columns
-- These are no-ops on fresh installs, but bring older databases up to date.
-- =========================================================

-- Drop legacy streak columns from older versions
ALTER TABLE users DROP COLUMN IF EXISTS streak_count;
ALTER TABLE users DROP COLUMN IF EXISTS longest_streak;
ALTER TABLE users DROP COLUMN IF EXISTS last_active_date;

-- Add new columns to tasks if upgrading from an older version
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS subject_id INT REFERENCES subjects(id) ON DELETE SET NULL;
ALTER TABLE tasks ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'assignment';

-- Add subject_id to notes if upgrading
ALTER TABLE notes ADD COLUMN IF NOT EXISTS subject_id INT REFERENCES subjects(id) ON DELETE SET NULL;

-- Add feed_type to ical_feeds (classes vs assignments) if upgrading
ALTER TABLE ical_feeds ADD COLUMN IF NOT EXISTS feed_type VARCHAR(20) DEFAULT 'assignments';

-- Add user preference columns if upgrading from earlier version
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS accent_color VARCHAR(20) DEFAULT '#d4a857';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS display_name VARCHAR(80);
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS greeting_style VARCHAR(20) DEFAULT 'warm';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS pinned_logo INT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS show_overdue BOOLEAN DEFAULT TRUE;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS show_exams BOOLEAN DEFAULT TRUE;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS show_today BOOLEAN DEFAULT TRUE;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS show_week BOOLEAN DEFAULT TRUE;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS show_reminders_today BOOLEAN DEFAULT FALSE;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS rotate_favorites_only BOOLEAN DEFAULT FALSE;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS best_day_count INT DEFAULT 0;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS best_day_date DATE;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS anthropic_api_key TEXT;
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS preferred_ai VARCHAR(20) DEFAULT 'gemini';
ALTER TABLE user_settings ADD COLUMN IF NOT EXISTS theme VARCHAR(20) DEFAULT 'dawn';

-- =========================================================
-- 3. INDEXES — created AFTER migrations so all columns exist
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_subjects_user ON subjects(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_user ON tasks(user_id);
CREATE INDEX IF NOT EXISTS idx_tasks_subject ON tasks(subject_id);
CREATE INDEX IF NOT EXISTS idx_tasks_due ON tasks(due_date);
CREATE INDEX IF NOT EXISTS idx_notes_user ON notes(user_id);
CREATE INDEX IF NOT EXISTS idx_notes_subject ON notes(subject_id);
CREATE INDEX IF NOT EXISTS idx_reminders_user ON reminders(user_id);
CREATE INDEX IF NOT EXISTS idx_reminders_time ON reminders(remind_at);
CREATE INDEX IF NOT EXISTS idx_ical_feeds_user ON ical_feeds(user_id);
CREATE INDEX IF NOT EXISTS idx_ical_imported_user ON ical_imported(user_id);
CREATE INDEX IF NOT EXISTS idx_ical_imported_uid ON ical_imported(ical_uid);
CREATE INDEX IF NOT EXISTS idx_logo_favorites_user ON logo_favorites(user_id);
CREATE INDEX IF NOT EXISTS idx_study_guides_user ON study_guides(user_id);
CREATE INDEX IF NOT EXISTS idx_study_guides_subject ON study_guides(subject_id);
CREATE INDEX IF NOT EXISTS idx_recurring_rules_user ON recurring_rules(user_id);
CREATE INDEX IF NOT EXISTS idx_recurring_rules_active ON recurring_rules(active, next_due);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_user ON focus_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_focus_sessions_task ON focus_sessions(task_id);
CREATE INDEX IF NOT EXISTS idx_study_chat_guide ON study_chat_messages(guide_id);
CREATE INDEX IF NOT EXISTS idx_study_chat_user ON study_chat_messages(user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON admin_audit_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_user ON admin_audit_log(user_id);
