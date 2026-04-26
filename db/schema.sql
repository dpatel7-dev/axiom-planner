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
  last_synced TIMESTAMP,
  last_status VARCHAR(50),
  last_error TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Per-user settings (Gemini API key, etc.)
CREATE TABLE IF NOT EXISTS user_settings (
  user_id INT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  gemini_api_key TEXT,
  ai_enabled BOOLEAN DEFAULT FALSE,
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
