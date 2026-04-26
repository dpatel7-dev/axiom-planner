# Axiom Planner — Step-by-Step Deployment Guide

This guide walks you through deploying your planner to **Render.com**. I'll assume you're starting from zero — we'll push the code to GitHub, create a Render account, connect the database, and launch the app.

**Total time:** ~15 minutes. Everything uses free tiers.

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
3. Leave it **Public** or **Private** — both work
4. Do **NOT** check any of the "Initialize this repository" boxes
5. Click **Create repository**

### 1b. Open a Codespace

On the new empty repo page:
1. Click the green **Code** button (top right)
2. Click the **Codespaces** tab
3. Click **Create codespace on main**

Wait ~30 seconds for VS Code to load in your browser.

### 1c. Upload the zip

1. Drag and drop `axiom-planner.zip` from your computer directly into the Codespaces file explorer (left sidebar)
2. Wait for it to upload

### 1d. Unzip and move files to the root

Open a terminal (`` Ctrl+` ``) and run:

```bash
unzip axiom-planner.zip
mv planner/* planner/.* . 2>/dev/null
rmdir planner
rm axiom-planner.zip
```

Check it worked:

```bash
ls -la
```

You should see `server.js`, `package.json`, `public/`, `routes/`, `db/`, `render.yaml`, etc. at the top level.

### 1e. Push to GitHub

```bash
git add .
git commit -m "Initial commit: Axiom planner"
git push
```

If prompted on first commit, set your identity:

```bash
git config --global user.name "Your Name"
git config --global user.email "your@email.com"
```

Then retry the commit and push.

Refresh your GitHub repo page — all files should be there.

---

## Step 2 — Create a Render account

1. Go to **https://render.com**
2. Click **Get Started** and sign up with your **GitHub account**
3. Authorize Render to see your repositories

---

## Step 3 — Deploy the Blueprint (the easy way)

Because I included a `render.yaml`, Render can set up **both** your web service **and** the PostgreSQL database in one click.

1. In the Render dashboard, click **+ New** in the top-right corner
2. Select **Blueprint**
3. Find `axiom-planner` in the repo list and click **Connect**
4. Render will detect the `render.yaml` file and show you what it's about to create:
   - A web service called `axiom-planner`
   - A PostgreSQL database called `axiom-db`
5. Give the Blueprint a name (e.g. `Axiom`)
6. Click **Apply**

Render will now:
- Create the database (takes ~1 minute)
- Build your app (`npm install`)
- Start it (`npm start`)
- Wire them together automatically (`DATABASE_URL` and a generated `JWT_SECRET` are injected)

When you see in the logs:

```
✓ Database schema ready
✓ Axiom Planner running on port XXXX
```

your app is **live**!

---

## Step 4 — Open your app

On the web service's page, you'll see a URL at the top, something like:

```
https://axiom-planner-xxxx.onrender.com
```

Click it. You should see the dark login screen with drifting particles. 🎉

---

## Step 5 — First use

1. Click **Create Account**
2. Pick a username (3+ characters) and password (4+ characters)
3. Click **Create Account**

You're in. Try:
- Creating a task with a due date
- Opening the **Calendar** — you'll see a dot on that day
- Creating a reminder a minute from now — you'll get a gold toast notification
- Writing a note (it auto-saves as you type)
- Coming back tomorrow to see your streak tick up to 2 🔥

---

## Troubleshooting

### "Application failed to respond" when I open the URL

Render's **free tier spins down after 15 minutes** of no traffic. The first request after it spins down takes ~30–60 seconds to wake up. Just wait and refresh.

### Build failed — "ENOENT: package.json"

You forgot to move files out of the nested `planner/` folder. Run `ls` in Codespaces and make sure `package.json` is at the top level of your repo.

### Database connection errors in the logs

Check that the `DATABASE_URL` environment variable is set on your web service in the Render dashboard:

1. Go to your web service in Render
2. Click **Environment** in the left sidebar
3. Make sure `DATABASE_URL` is there and starts with `postgres://`

### I want to reset the database

1. Go to your database in Render
2. Click the **Shell** tab
3. Run: `DROP TABLE users, tasks, notes, reminders CASCADE;`
4. Restart your web service — the schema will be recreated on startup

---

## Making changes later

Edit any file in Codespaces, then:

```bash
git add .
git commit -m "describe your change"
git push
```

Render will auto-deploy within a minute. Watch it happen in the **Events** tab.

---

## Running locally (optional)

If you want to run it on your Chromebook/Codespaces before deploying:

1. Install PostgreSQL locally, or create a free database at https://neon.tech and copy the connection string
2. Create a `.env` file based on `.env.example` and fill in `DATABASE_URL` and `JWT_SECRET`
3. Run:
   ```bash
   npm install
   npm start
   ```
4. Open http://localhost:3000

---

## What makes this "Duolingo-style"?

- **Streaks**: Every calendar day you log in, your streak goes up by 1. Miss a day, it resets to 1.
- **Longest streak** is tracked separately so your best record is preserved.
- **Motivational quotes** change at milestones (3, 7, 14, 30, 60, 100 days).
- The 🔥 flame flickers constantly, drawing your eye to the number.

This creates the same "don't break the chain" loop that Duolingo uses.

---

## Customizing the background

The app uses `public/background.jpg` as the main backdrop, with a slow Ken Burns zoom and a layered animation system on top (drifting fog, warm dawn glows, particles, light rays, breathing vignette, film grain).

To swap in a different image, just replace the file:

1. Save your new image as `background.jpg` (1920x1080 or larger, jpg format)
2. Drop it in `public/` replacing the existing one
3. `git add public/background.jpg && git commit -m "New background" && git push`
4. Render redeploys

For best results, pick an image that's:
- Wide aspect ratio (16:9 or wider)
- Not too busy (the UI sits on top of it)
- Has natural breathing room — peaceful landscapes work great

---

## You're done!

Your planner is live at your Render URL. If something breaks, check the **Logs** tab on Render — the server logs every error.
