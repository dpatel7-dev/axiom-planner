# Axiom — An All-in-One Planner

A full-stack planner with a cinematic dark aesthetic. Tasks, calendar, notes, reminders, and Duolingo-style streaks to keep you showing up every day.

## Features

- 📋 **Tasks** with due dates, times, and priorities (high/medium/low)
- 📅 **Calendar view** showing tasks and reminders as dots on each day
- 📝 **Notes/journal** with auto-save as you type
- 🔔 **Reminders** with in-app toasts + browser notifications
- 🔥 **Streak tracking** — Duolingo-style daily login streaks with milestone quotes
- 🔐 **User accounts** with secure password hashing (bcrypt) + JWT cookies

## Stack

- **Backend:** Node.js + Express + PostgreSQL
- **Frontend:** Vanilla HTML/CSS/JS (no build step, no framework)
- **Auth:** bcryptjs + JWT in httpOnly cookies
- **Deploy:** Render.com (free tier)

## Aesthetic

Cinematic dark theme:
- Deep warm black-brown palette with candle-gold accents
- DM Serif Display for headings, Cormorant Garamond for accents, Inter for UI
- Animated background: cinematic atmospheric photo + breathing warm glows + drifting fog + firefly particles + film grain + vignette

## Quick start

See **DEPLOY.md** for step-by-step deployment instructions. TL;DR:

1. Push this folder to a new GitHub repo
2. On Render.com, click **New → Blueprint**, pick the repo
3. Done — Render reads `render.yaml` and sets up everything

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
routes/*.js            REST API routes
public/                Static frontend (index.html, style.css, app.js)
render.yaml            One-click Render deploy config
```
