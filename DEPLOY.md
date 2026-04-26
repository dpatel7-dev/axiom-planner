# Axiom Planner — Step-by-Step Deployment Guide

This guide walks you through deploying your planner to **Render.com**. Total time: ~15 minutes. Free tier.

---

## What's in this project

```
planner/
├── server.js              ← main Express server
├── package.json           ← dependencies
├── render.yaml            ← Render deploy config (auto-sets up DB!)
├── .gitignore
├── .env.example           ← template for local env vars
├── db/
│   ├── index.js           ← Postgres connection
│   └── schema.sql         ← database tables
├── routes/
│   ├── auth.js            ← signup / login / logout
│   ├── auth-middleware.js ← protects API routes
│   ├── subjects.js        ← classes CRUD
│   ├── tasks.js           ← tasks CRUD
│   ├── notes.js           ← notes CRUD
│   └── reminders.js       ← reminders CRUD
└── public/
    ├── index.html         ← the whole UI
    ├── style.css          ← styling
    ├── app.js             ← frontend logic
    └── background.jpg     ← Mt. Fuji background image
```

---

## Step 1 — Put the code on GitHub (via Codespaces)

### 1a. Create a new GitHub repo

1. Go to **https://github.com/new**
2. Name it `axiom-planner` (lowercase, no spaces)
3. Public or Private — both work
4. Do **NOT** check any "Initialize this repository" boxes
5. Click **Create repository**

### 1b. Open a Codespace

On the new empty repo page:
1. Click the green **Code** button
2. Click the **Codespaces** tab
3. Click **Create codespace on main**

### 1c. Upload the zip and unpack

1. Drag and drop `axiom-planner.zip` into the Codespaces file explorer
2. Open a terminal (`` Ctrl+` ``) and run:

```bash
unzip axiom-planner.zip
mv planner/* planner/.* . 2>/dev/null
rmdir planner
rm axiom-planner.zip
```

Confirm with `ls` — you should see `server.js`, `package.json`, etc. at the top level.

### 1d. Push to GitHub

```bash
git config --global user.name "Your Name"
git config --global user.email "your@email.com"
git add .
git commit -m "Initial commit: Axiom planner"
git push
```

---

## Step 2 — Create a Render account

1. Go to **https://render.com**
2. Sign up with your **GitHub account**
3. Authorize Render

---

## Step 3 — Deploy via Blueprint

1. In the Render dashboard, click **+ New** (top right)
2. Select **Blueprint**
3. Find `axiom-planner` and click **Connect**
4. Render reads `render.yaml` and creates:
   - Web service `axiom-planner`
   - PostgreSQL database `axiom-db`
5. Name the Blueprint (e.g. `Axiom`)
6. Click **Apply**

When you see in the logs:

```
✓ Database schema ready
✓ Axiom Planner running on port XXXX
```

it's **live**.

---

## Step 4 — Open your app

Click the URL on the web service's page (e.g. `https://axiom-planner-xxxx.onrender.com`).

Create an account, then:

1. Add your classes first — go to **Classes**, click **+ Add Class**, enter a name like "Math" or "ECON 301", pick a color
2. Add tasks — go to **Tasks** → **+ New Task**, link them to a class
3. Watch your **Today** dashboard auto-organize Overdue, Due Today, and This Week
4. Set reminders for important things you don't want to miss

---

## Upgrading from an older version (if you previously deployed)

The schema has migrations built in — when the new server starts, it'll automatically:
- Drop the old `streak_count`, `longest_streak`, `last_active_date` columns from `users`
- Add `subject_id` and `type` columns to `tasks`
- Add `subject_id` to `notes`

Your existing tasks and notes will keep their data. They'll just have no class linked until you assign one.

---

## Troubleshooting

### "Application failed to respond" when I open the URL
Render free tier spins down after 15 min of no traffic. First request takes 30–60s to wake up.

### "ENOTFOUND dpg-..." error in logs
The database hostname can't be resolved. Go to your `axiom-db` page → copy the **External Database URL** → paste it into your web service's `DATABASE_URL` environment variable.

### Build failed: "Cannot find package.json"
You didn't move files out of the nested `planner/` folder. Run `ls` and confirm `package.json` is at the top level.

---

## Customizing the background

The app uses `public/background.jpg`. To swap it out:

1. Save your new image as `background.jpg` (1920x1080+, jpg format)
2. Replace the file in `public/`
3. `git add public/background.jpg && git commit -m "New background" && git push`
4. Render redeploys automatically

---

## Importing your school calendar (Veracross or any iCal)

Axiom can pull your assignments straight from a calendar feed and turn them into tasks — automatically and intelligently.

### Step A: Get your Gemini API key (free, ~30 seconds)

1. Go to **https://aistudio.google.com/apikey**
2. Sign in with any Google account
3. Click **Create API key** → copy the key (starts with `AIza...`)

The free tier is generous — you'll never hit limits with normal use.

### Step B: Get your Veracross calendar URL

If you already have your school calendar in Mac Calendar:
1. Open **Calendar** app on your Mac
2. In the sidebar, find your Veracross/school calendar
3. **Two-finger-click** (or right-click) on the calendar name
4. Choose **Get Info**
5. Copy the URL (it'll start with `https://portals.veracross.com/...` or `webcal://`)

If you don't have it set up yet, log into your Veracross portal in a browser and look for a **Subscribe to Calendar** option in your assignments view.

### Step C: Connect both in Axiom

1. Open Axiom and click **Import** in the sidebar
2. **AI Assistant section**: paste your Gemini API key, click **Save & Test**
3. **Calendar Feeds section**: paste your Veracross URL, click **Add Feed**
4. Click **Sync Now** on the new feed

Axiom will:
- Fetch your calendar
- Filter to assignments due in the next 21 days
- Run them through Gemini to clean up titles ("ENG10: Read Ch 4-5" → "Read Ch 4-5" with class auto-linked)
- Auto-detect type (homework, exam, essay, etc.)
- Auto-set priority (exams = high, daily reading = medium, etc.)
- Skip class meetings and recurring schedule items
- Create properly tagged tasks linked to your existing classes

Re-clicking **Sync Now** later will only pull NEW assignments — already-imported ones are remembered.

---

## You're done!

Check the **Logs** tab on Render if anything fails — every error gets logged.
