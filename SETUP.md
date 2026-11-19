# CodeTrack — Setup Guide

CodeTrack has two halves:

| Part | Where it runs | What it does |
|---|---|---|
| **Frontend** (`docs/`) | **GitHub Pages**: https://lakshmanprabhu12.github.io/codetrack-lms/ | The website students and you open |
| **Backend** (`apps-script/`) | **Google Apps Script** under your Google account | JSON API that reads and writes the **Google Sheet** and **Drive** folders |

## Live deployment

- **App (send this to students):** https://lakshmanprabhu12.github.io/codetrack-lms/
- **API:** https://script.google.com/macros/s/AKfycbw-19S3PMFzT7JrXCopO9VCjoY-Ari7A6k36qO8IZNZQFPkaGIYxdtQV9YrOpPZuWRNCg/exec. If you open it in a browser, you should see `{"ok":true,"app":"CodeTrack",...}`.

---

## 1. Backend: Apps Script (one time)

1. Go to **https://script.google.com** → **New project** → rename it **CodeTrack**.
2. Replace the contents of `Code.gs` with `apps-script/Code.gs`.
3. **+** → **Script** → name it `Seed` → paste `apps-script/Seed.gs`.
4. *(Recommended)* Go to **Project Settings** → tick **Show "appsscript.json"** → paste `apps-script/appsscript.json`. This sets the time zone to India. If you skip this step, set **Time zone → (GMT+05:30) India Standard Time** in Project Settings instead.
5. Choose **`setup`** in the function dropdown → click **Run** → allow the permissions (**Advanced → Go to CodeTrack → Allow**).
   This creates the **CodeTrack Database** Sheet and the **CodeTrack** Drive folder (Study Materials + Student Submissions). It's safe to run again.
6. Go to **Deploy → New deployment → Web app**, set **Execute as: Me** and **Who has access: Anyone**, then click **Deploy** and copy the `/exec` URL.

> **Who has access** must be *Anyone*, or the website can't reach the API. Data is still protected by each person's name and password.

## 2. Frontend: GitHub Pages (one time)

1. Put the `/exec` URL in **`docs/config.js`** as `apiUrl`, then commit.
2. In the repo, go to **Settings → Pages → Build and deployment**: set **Source** to *Deploy from a branch*, **Branch** to `main`, and the folder to **`/docs`**, then click **Save**.
3. After about a minute the site is live at `https://<your-user>.github.io/codetrack-lms/`.

## 3. First login

Open the site and sign in with **`admin` / `ChangeMe@123`**, then:

1. **Change the password** (a yellow banner reminds you).
2. Go to **Students → Bulk add** and enter one student per line as `Name, password` (or `Name, username, password`).
3. Send students the site link. They sign in with their **name** and password.

## Updating later

- **Frontend change** (anything in `docs/`): commit and push. GitHub Pages redeploys in about a minute.
- **Backend change** (`Code.gs` / `Seed.gs`): paste the new code, then go to **Deploy → Manage deployments → ✏️ → Version: New version → Deploy**. The `/exec` URL stays the same, so `config.js` doesn't change.
- If you ever create a **new** deployment instead, its URL is different. Update `docs/config.js` with the new URL.

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

## Troubleshooting

| Problem | Fix |
|---|---|
| "CodeTrack is not set up yet" | Run `setup()` in the editor. |
| "Network error" on the website | Open the `/exec` URL in a browser. It should show `"ok":true`. If not, check that the deployment has access set to **Anyone**. |
| "API URL missing" | Set `apiUrl` in `docs/config.js`. |
| Locked out of admin | Run `resetAdminPassword()` in the editor. The password becomes `ChangeMe@123`. |
| Student forgot password | Students → ✏️ → type a new password → Save. |
| Check-in times look wrong | Set the project time zone to India (step 1.5). |
| Students can't open a Drive file | The file must be inside *Study Materials*. If it's a shortcut to a file elsewhere, share that file as "Anyone with the link". |
| Backend changes don't take effect | Did you deploy a **new version**? |
| Frontend changes don't show | Wait about a minute for Pages, then hard-refresh (Ctrl+Shift+R). |

Data lives in the **CodeTrack Database** sheet. You can read it, export it, or fix a value by hand. Keep the header row as is.
