# Axiom — A Student Planner

A flexible all-in-one planner built for students at any level — middle school, high school, or college. Track classes, assignments, notes, and reminders in one beautiful place.

## Features

- 📚 **Classes** — Add any class with a custom color (works for "Period 4 Math" or "ECON 301" alike)
- 📋 **Tasks** by class — homework, essays, exams, quizzes, projects, labs, study sessions
- 📅 **Calendar** with color-coded dots showing tasks per class
- 📝 **Notes** that can be linked to a class
- 🔔 **Reminders** with toast + browser notifications
- 🎯 **Smart Today dashboard** — auto-shows Overdue, Due Today, Due This Week
- 🔍 **Smart filters** — see Overdue, This Week, or filter by Class
- 🔐 **Secure accounts** with bcrypt + JWT cookies

## Stack

- **Backend:** Node.js + Express + PostgreSQL
- **Frontend:** Vanilla HTML/CSS/JS (no build step)
- **Deploy:** Render.com (free tier)

## Aesthetic

Cinematic light theme:
- Mt. Fuji at dawn as the background, with slow Ken Burns motion
- Soft peach + powder blue palette with candle-gold accents
- Layered animations: drifting clouds, dawn rays, floating wisps, breathing vignette

## Quick start

See **DEPLOY.md** for step-by-step deployment instructions.

## Local dev

```bash
cp .env.example .env
# Edit .env, set DATABASE_URL and JWT_SECRET
npm install
npm start
```

Open http://localhost:3000

## Project structure

```
server.js              Express entry point
db/schema.sql          Database tables
db/index.js            PG connection pool
routes/
  ├── auth.js          Login / signup / logout
  ├── subjects.js      Classes CRUD (with task counts)
  ├── tasks.js         Tasks CRUD (with subject join)
  ├── notes.js         Notes CRUD (with subject link)
  └── reminders.js     Reminders CRUD
public/
  ├── index.html       Single-page UI
  ├── style.css        Styling
  ├── app.js           Frontend logic
  └── background.jpg   Mt. Fuji background
render.yaml            One-click Render deploy config
```
