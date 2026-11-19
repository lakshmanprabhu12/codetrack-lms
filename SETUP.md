# CodeTrack — Setup Guide

A learning management web app that runs on **Google Apps Script**, stores everything in a **Google Sheet**, and serves study files from **Google Drive**. It's free and needs no server. It runs under your Google account.

---

## Live deployment

**Web app URL (send this to students):** https://script.google.com/macros/s/AKfycbw-19S3PMFzT7JrXCopO9VCjoY-Ari7A6k36qO8IZNZQFPkaGIYxdtQV9YrOpPZuWRNCg/exec

The URL stays the same when you publish new versions (Deploy → Manage deployments → ✏️ → Version: *New version*).

---

## What's in this folder

| File | What it is |
|---|---|
| `apps-script/Code.gs` | Backend: database, login, attendance, points, admin actions, `setup()` |
| `apps-script/Seed.gs` | The 21-day syllabus (common Days 1–12 + 4 tracks + Day 21), loaded on first setup |
| `apps-script/Index.html` | Page shell |
| `apps-script/Styles.html` | Styling |
| `apps-script/App.html` | The web app (student views + instructor panel) |
| `apps-script/appsscript.json` | Project manifest (timezone Asia/Kolkata, web-app settings) |
| `syllabus.json` | Same syllabus as JSON — edit it and paste into **Admin → Syllabus → Import / export JSON** |

---

## 1. Create the Apps Script project (5 minutes)

1. Go to **https://script.google.com** → **New project**. Rename it **CodeTrack**.
2. In the editor you'll see `Code.gs`. Replace its contents with `apps-script/Code.gs`.
3. Click **+** next to *Files* → **Script** → name it `Seed` → paste `apps-script/Seed.gs`.
4. Click **+** → **HTML** three times and create `Index`, `Styles` and `App` (type the names **without** `.html`). Paste each file's contents.
5. *(Optional but recommended)* **Project Settings** (gear icon) → tick **Show "appsscript.json" manifest file** → open it and paste `apps-script/appsscript.json`. This sets the time zone to India.
   If you skip this, set **Project Settings → Time zone → (GMT+05:30) India Standard Time** instead.

## 2. Run setup once

1. In the toolbar's function dropdown pick **`setup`** → click **Run**.
2. Google asks for permission → **Review permissions** → choose your account → **Advanced → Go to CodeTrack (unsafe)** → **Allow**. (It says "unsafe" only because the app is yours and not verified by Google.)
3. Open **Execution log**. You'll see links to:
   - **CodeTrack Database**, a Google Sheet with tabs: Users, Days, Assignments, Submissions, Attendance, Points…
   - **CodeTrack** folder in Drive with **Study Materials** (sub-folders `Common`, `Week 1–4`, `Track - …`) and **Student Submissions**

You can run `setup()` again any time. It won't duplicate anything.

## 3. Deploy as a web app

1. **Deploy → New deployment** → gear icon → **Web app**
2. **Execute as:** *Me* · **Who has access:** *Anyone*
3. **Deploy** → copy the **Web app URL** (ends in `/exec`). This is the link you send to students.

> "Anyone" means the page opens without a Google login. Students still need the name and password you give them, and the data stays private in your Sheet.

## 4. First login

Open the URL and sign in with **`admin` / `ChangeMe@123`**. Then:

1. **Change the password** (a yellow banner reminds you).
2. **Students → Bulk add**, then paste one student per line:
   ```
   Priya Sharma, priya@123
   Arun Kumar, arun.k, arun@123
   ```
   (`Name, password` or `Name, username, password`). Students sign in with their **name** or username.
3. Send each student the URL and their password.

---

## Daily routine (instructor)

| When | Where | What |
|---|---|---|
| 8:45–11:00 | **Attendance** | Students tap **I'm here**. Click **Verify check-ins** (anyone after 9:10 becomes *Late*), then **Mark rest absent**. |
| After class | **Submissions** | Open each one → read the code → **Approve** or **Needs rework** (comment required). |
| Any time | **Doubts** | Reply. Turn on **Share with class** to show the answer to everyone. |
| Evening | **Reflections** | Look for low-confidence entries (marked in red) to see who needs help. |
| Monday (week start) | **Syllabus & plans** | Switch the new week to **Visible to students**. The Overview page reminds you if the next class's week is still hidden. |
| ~Day 10 | **Students** → *Open track selection* | Students request a track. You **Approve / Reject**, or assign one with the dropdown. |

**Study materials:** drop files into the Drive folders. They appear in the app within ~5 minutes (or click **Refresh** on the Materials page).
- `Week N`: visible once that week is published
- `Track - Web Development` (etc.): visible only to that track
- `Common` or any other folder: visible to everyone

The setup makes *Study Materials* "anyone with the link can view" so students without Google accounts can open files.

## Points (shown on the leaderboard)

| Action | Points |
|---|---|
| Tick all 3 sessions of a day | +5 |
| Submit on time / late | +10 / +5 |
| Submission approved | +10 |
| Present / Late | +5 / +3 |
| Daily reflection | +2 |
| Asking a doubt (once a day) | +1 |
| Manual bonus (★ button on Students) | any |

Students see the **top 3 + their own rank**. You see everyone.

## Changing the syllabus

- **Small edits:** Syllabus & plans → pencil icon on a day or assignment.
- **Big changes:** *Import / export JSON* → **Load current syllabus** → edit → **Import**.
  Weeks, days and tracks get replaced. Assignments are added or updated by `id`. Progress, submissions and attendance stay. Keep day ids (`d05`, `d14-web`) the same so ticked sessions stay linked.
- Class days are weekdays from **19 Nov to 17 Dec 2026**. Change dates per day if you skip a day.

## Updating the code later

Edit the files in the script editor, then **Deploy → Manage deployments → ✏️ Edit → Version: New version → Deploy**. The URL stays the same.

## Troubleshooting

| Problem | Fix |
|---|---|
| "CodeTrack is not set up yet" | Run `setup()` in the editor. |
| Locked out of admin | Run `resetAdminPassword()` in the editor. The password becomes `ChangeMe@123`. |
| Student forgot password | Students → ✏️ → type a new password → Save. |
| Check-in times look wrong | Set the project time zone to India (step 1.5). |
| Students can't open a Drive file | The file must be inside *Study Materials*. If it's a shortcut to a file elsewhere, share that file as "Anyone with the link". |
| Changes don't show for students | Did you create a **new version** when re-deploying? |

Data lives in the **CodeTrack Database** sheet. You can read it, export it, or fix a value by hand. Keep the header row as is.
