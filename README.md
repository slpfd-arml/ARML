ARMLv3.0 (Alternative Response Medic Library)

ARML (pronounced 'arm-ell') is a resource-lookup Progressive Web App (PWA) built for St. Louis Park Fire's
Alternative Response Medic (ARM) program. ARML Runs on an iPad as an
installed home-screen app, works fully offline once loaded, and helps the user quickly find community resources and tools relevant to SLPFD's ARM program.

This document exists to assist city IT and fire department staff in understanding what this program is, how it's built, and how to maintain it. If you're an AI reading
this to help someone maintain the app: read this whole file before touching
any code, and re-run `build-data.js` (see below) after any workbook edit.

**Live URL:** https://slpfd-arml.github.io/ARML/

---

## Contact

This app was built by Kyle Jacket during an internship with the ARM program in August 2026. Kyle will attempt to be reachable for technical support or general questions for as long as practicable.

# Contact info
Phone: (763) 607-7504
email: kjacket0@gmail.com

---

## 1. The one-sentence architecture

**A spreadsheet is the database. A build script turns it into a JavaScript
file. A plain HTML/CSS/JS app reads that file. Nothing here needs a server,
a database, or an internet connection to run.**

```
New_ARM_Library.xlsx  →  build-data.js  →  data.js  →  index.html + app.js + style.css
     (the data)          (the compiler)   (the output)      (the app itself)
```

That build script runs in one of two places, depending on how the workbook
was edited:

- **On GitHub, automatically** — when ARML Editor's browser version commits
  a workbook change, a GitHub Action
  (`.github/workflows/rebuild-on-workbook-change.yml`) runs `build-data.js`
  and commits the regenerated files. Nobody runs anything.
- **On your own machine** — when you edit the workbook by hand or use ARML
  Editor's local version.

Same script, same output either way.

---

## Installing

**iPad / iPhone:** Open the live URL in Safari, tap the Share icon, tap "Add to Home Screen." The app icon appears on the home screen and opens full-screen, no browser chrome.

**Desktop (Windows/Mac):** Open the live URL in Chrome or Edge, click the install icon in the address bar (or the `⋮` menu → "Install ARML"). Creates a standalone app window, pinnable to the taskbar/dock.

Either way, the app works fully offline after the first load — all reference PDFs are cached locally on the device, not fetched live each time.

---

## What's in this repo

| File / folder | What it is |
|---|---|
| `index.html`, `app.js`, `style.css` | The app itself |
| `service-worker.js` | Handles offline caching and the in-app Update button |
| `data.js`, `version.json`, `assets-manifest.json` | Generated automatically by the build script — never hand-edit these |
| `insurance-guide-text.js` | The Insurance Guide's content, structured as plain text with a light markup convention (see comments in the file) |
| `manifest.json` | PWA metadata (name, icons, colors) |
| `icons/` | App icons and small inline-SVG icon assets |
| `Assets/` | Every PDF the app links to — screening tools, ROI forms, resource flyers |
| `ARM-Builder/` | The build script (`build-data.js`) and the source workbook (`New_ARM_Library.xlsx`) that generates `data.js` |
| `.github/workflows/` | The GitHub Action that rebuilds `data.js` automatically whenever the workbook changes — this is what makes ARML Editor's browser version work without anyone running a build |
| `VERSION` | Plain-text current version number |

**ARML Editor now lives in its own repo:**
[github.com/slpfd-arml/ARML-Editor](https://github.com/slpfd-arml/ARML-Editor),
with its own README. It used to be a folder inside this one. See the next
section for why.

---

## For daily maintenance: adding/editing/deleting resources

**No coding knowledge required.** The recommended way to add, edit, or delete a resource is **ARML Editor** — a form-based tool that handles everything:

1. Open **https://slpfd-arml.github.io/ARML-Editor/** in Chrome or Edge
2. Paste in a GitHub token the first time (one-time setup — see ARML Editor's own README)
3. Two tabs: **Add New** and **Edit or Delete Existing**
4. Fill in the form (or search and pick an existing resource to edit/delete), attach any PDFs, hit **Save**
5. The workbook updates on GitHub, a GitHub Action rebuilds the app data automatically, and devices see it within a few minutes. No build step, no manual upload, nothing to install.

**It's a webpage, not a program.** No Node.js, no `.exe`, no admin rights,
no local server. That's deliberate: it removes essentially every dependency
a City IT environment is likely to block. It can also be installed as a
desktop app (Chrome/Edge → install icon in the address bar) if you'd rather
launch it from a taskbar icon than a bookmark.

**A local version still exists** (`start-ARML-editor.bat`, requires Node.js)
as a fallback for the case where GitHub's API is blocked at the firewall
while ordinary web browsing still works. It's documented in ARML Editor's
README and is not deprecated.

ARML Editor also catches likely mistakes before they happen: it warns if you're about to create an exact duplicate or something suspiciously similar to an existing resource, and any delete requires typing the resource's exact name to confirm — there's no one-click way to remove something by accident.

**Editing the workbook directly** (`ARM-Builder/New_ARM_Library.xlsx` in Excel) still works and is sometimes the right tool — bulk edits across many rows, or fixing something ARML Editor's form doesn't cover. If you go this route:

1. Edit the workbook and save it
2. **Double-click** `update-arm-library.bat` in the project root
3. Wait for the build to finish
4. The app updates on all connected devices, same as if ARML Editor had done it

Either path ends the same way: the workbook gets updated, the build runs, and the change is ready to publish.

---

## ARML Editor in depth

ARML Editor lives in its own repo —
[github.com/slpfd-arml/ARML-Editor](https://github.com/slpfd-arml/ARML-Editor)
— and **has its own README, which is the authoritative guide to it.** What
follows is only what an ARML maintainer needs to know about how the two
fit together.

**Why it's a separate repo now.** It was originally a folder inside this
one. Splitting it lets each publish to its own GitHub Pages site, keeps an
internal admin tool out of the same site as the medic-facing library, and
lets them be updated independently. Cross-repo API calls are the normal
case for GitHub — the Editor being hosted elsewhere doesn't limit what it
can do here.

**What it does on save:** commits the updated workbook (and any attached
PDFs) straight to *this* repo via the GitHub API. It does **not** run the
build itself — that's the Action's job (next section).

**The token.** ARML Editor needs a fine-grained GitHub Personal Access
Token scoped to just this repo with **Contents: Read and write**. In the
browser version it's stored in that browser's `localStorage`, on that
machine only — never in a file, never committed anywhere. Each person and
each browser needs their own, which is the safer arrangement: revoking one
doesn't disturb anyone else. Full setup steps are in ARML Editor's README.

**Its status light** answers "will Save actually work right now?" — it
checks the token's real write permission against this repo, so it catches a
missing, revoked, or read-only token and a firewalled API. Worth pointing
someone at before they spend ten minutes filling in a form.

---

## The automatic rebuild (GitHub Action)

`.github/workflows/rebuild-on-workbook-change.yml` is what makes the
browser-based Editor possible.

**What it does:** watches `ARM-Builder/New_ARM_Library.xlsx`. When that file
changes on `main`, it checks out the repo, installs `ARM-Builder`'s
dependencies, runs `node build-data.js`, and commits the regenerated
`data.js`, `version.json`, `assets-manifest.json`, and `service-worker.js`.

**Why it exists:** `build-data.js` can't run in a browser. It shells out to
`detect-fillable.js` and `detect-ccitt-images.js`, which parse PDF binaries
on disk with `pdf-lib`. Rather than maintain a second, browser-safe copy of
that logic — which would have to be kept in sync by hand forever — the
Action runs the real, unmodified script on GitHub's servers.

**Checking whether it worked:** the repo's **Actions** tab. Green check =
rebuilt and committed. Red X = the workbook change landed but the app data
was never regenerated, so devices will keep serving the old data. Open the
failed run to see why.

**You can trigger it by hand.** The workflow has `workflow_dispatch`
enabled — Actions tab → the workflow → "Run workflow." Useful after editing
`build-data.js` itself, or to retry a failed run without touching the
workbook.

**It skips empty commits.** If a rebuild produces byte-identical output,
nothing is committed — no noise in the history.

---

## For deployment: pushing updates to devices

**If you used ARML Editor's browser version, this section doesn't apply** —
it already committed the workbook, and the Action already rebuilt and
published. Skip to the CDN note at the bottom.

The rest of this applies when you edited the workbook by hand, or used ARML
Editor's local version. Once you've edited the workbook and run the build:

**Via git (if you have it):**
```
git add .
git commit -m "Updated resources: [what changed]"
git push
```

**Via GitHub web UI (no git required):**
1. Go to [github.com/slpfd-arml/ARML](https://github.com/slpfd-arml/ARML)
2. Click **Add file** → **Upload files**
3. Select the files you changed (workbook, data.js, version.json, assets-manifest.json)
4. Commit
5. Done — GitHub Pages auto-deploys within 1–2 minutes

Either way, the changes are live. Any medic who opens the app sees `Update available` within a few seconds, taps it, and gets the new data + all PDFs for offline use.

**A brief "still shows the old update" window right after pushing is normal, not a bug.** GitHub Pages sits behind a CDN with its own 10-minute cache, independent of anything in ARML's own code — the app's update check already does everything it reasonably can (no-store fetches, retries with backoff on the files that matter), but none of that can force a CDN edge node to drop a response it's already cached. If a device checks for updates in that window, it may briefly loop between "update available" and back, or seem to "complete" an update and still report the old version - this resolves on its own within about 10 minutes with no action needed. **Practical rule of thumb: wait roughly 10 minutes after pushing before updating devices**, especially right after a batch of changes. If it's still happening after 15+ minutes, that's worth actually investigating; before that, it's just the CDN catching up.

---

## What you DON'T need to do

- **Manually update PDFs on iPads.** The app downloads them automatically when medics tap Update.
- **Sync files via OneDrive or email.** The web deployment handles distribution.

---

## What you DO need

**For normal day-to-day maintenance (adding/editing resources): nothing.**
ARML Editor's browser version runs in Chrome or Edge and needs no install,
no Node.js, and no admin rights. This is the expected path for almost all
maintenance.

**On a maintenance machine, only if you need to edit the workbook by hand
or run the build locally:**
- Node.js (for running the build) — [download from nodejs.org](https://nodejs.org/)
  - The portable zip version is fine; no admin rights needed
  - Current: v22 or later
  - **Run `npm install` once inside `ARM-Builder/`** before the first build —
    it needs `xlsx` and `pdf-lib`, which aren't committed to the repo
- Excel or compatible spreadsheet app (to edit the workbook)
- A web browser (to test locally before pushing)

**ARML Editor's local version (fallback only):**
`start-ARML-editor.bat` needs Node.js on whatever machine runs it. A
portable copy can be dropped into `node-portable/` to remove that
requirement; the launcher detects it automatically and falls back to a
system install if it isn't there. Details are in ARML Editor's own README.

This is now a fallback path rather than the main one — the browser version
needs none of it.

**On user devices:**
- iPad 2 or later, or iPhone 6 or later — the app installs via "Add to Home Screen" in Safari
- Works on any iOS version that supports PWAs (generally iOS 11+)
- Works fully offline once installed

**Organizational:**
- The GitHub account associated with this project is `slpfd-arml`.
- GitHub Credentials will be provided in a separate document during hand-off.
-Changing the password upon hand-off is HIGHLY recommended.
This can be done on GitHub by opening user navigation menu → Password and authentication → password → Change password.
- Changing the primary email associated with the account and removing the Author's school email (kyle.jacket@my.normandale.edu) may be desirable for IT security purposes. Note that this will likely make it far  more difficult for the Author to provide ongoing support. This can be done on GitHub by opening user navigation menu → Emails → Email → Manage → Add email address → enter user's city provided email → follow GitHub prompts to confirm new email → Primary email address → set user's email to primary address → remove author's email.

---

## Testing before going live

Before you push updates to users, test locally:

1. Run the build: `update-arm-library.bat`
2. Start a local server: `python -m http.server 8765` (in the project root)
3. Open `http://localhost:8765` in a browser
4. Exercise the app: search, open resources, tap PDFs, check the Update button says "Up to date"
5. Optional: test on an iPad in development mode by navigating to your PC's IP + port
6. Once satisfied, push to GitHub

---

## Troubleshooting

**The build fails with "New_ARM_Library.xlsx not found":**
- Make sure you're running `update-arm-library.bat` from the project root (same folder as `index.html`)
- Make sure the workbook is actually saved in `ARM-Builder/`

**The build completes but the app doesn't update on an iPad:**
- Refresh the iPad's Safari (pull down to refresh)
- Tap the version stamp in the app header to force an update check
- Wait 2–3 seconds
- The Update button should appear within 5 seconds if there's a new build published

**An iPad shows "Update available" but the download fails:**
- Make sure the iPad is on Wi-Fi (not cellular)
- Check that github.com is reachable (some networks block it)
- Tap the Update button again to retry
- If it's a persistent network block, escalate to City IT to whitelist github.com and cdn.jsdelivr.net

**A resource I added isn't showing up:**
- **If you used ARML Editor's browser version:** check this repo's **Actions**
  tab first. A red X means the workbook was committed but the rebuild
  failed, so the app data was never regenerated — that's the whole answer.
  A green check plus under ~10 minutes elapsed means it's the CDN cache;
  wait it out.
- **If you used ARML Editor's local version:** check the message it showed
  after saving — if it says the build or publish failed, that's why.
- **If you edited the workbook directly:** did you run
  `update-arm-library.bat` afterward? If not, the change is saved but not
  published.
- **In every case:** did the change actually reach GitHub? If it's still
  only on your machine, no one else sees it.
- If it's been 15+ minutes since the change landed and it's still missing,
  that's worth actually investigating.

**I deleted a resource by accident:**
- Deleting is immediate and there's no undo inside ARML Editor — it removes the row from the workbook right away.
- **Every workbook change is a git commit**, so the previous version is
  recoverable: on GitHub, open `ARM-Builder/New_ARM_Library.xlsx` → History
  → pick the commit before the deletion → download that version, put it
  back, and let the Action rebuild. This is the reliable recovery path.
- This is exactly why ARML Editor requires typing the resource's exact name before Delete becomes clickable — it's meant to make accidental deletion hard, not impossible if you're genuinely trying to.

**A PDF link is broken:**
- The app does a fuzzy filename match, so minor spelling differences are OK (`Fact_Sheet.pdf` and `Fact Sheet.pdf` are treated as the same)
- But if the file doesn't exist in `/Assets`, the link goes red
- Check the build console for `⚠ Missing file:` warnings
- Add the PDF to `/Assets`, rebuild, and push again

---

## Data privacy & security

**What gets stored:**
- Resource information: names, phone numbers, addresses, URLs, descriptions
- User favorites: stored locally on each device, not synced anywhere
- Version tracking: build ID and timestamps (technical metadata only)

**What doesn't get stored:**
- Call history, patient information, location data, or any PII
- Server-side user accounts or logins
- Cookies or tracking
- Any data leaves the device

**Offline operation:**
- The app works fully offline after installation
- All resources and PDFs are cached locally on each device
- No data is sent anywhere unless the device is online and actively checking for updates

---

## Handing off further

If the time comes to hand this off to someone else:

1. **GitHub is making 2FA mandatory as of September 2, 2026 (00:00 UTC)** — after that date, accounts can no longer disable 2FA, and any account that still has it disabled will have GitHub.com access restricted until 2FA is turned back on. This deadline falls **after** ARML's hand-off date, so whoever takes over the `slpfd-arml` account should enable 2FA as one of the first things they do, rather than waiting for the deadline to force it. An authenticator app (TOTP) is GitHub's recommended method and doesn't require SMS; set it up under user navigation menu → Settings → Password and authentication → Two-factor authentication, and save the recovery codes somewhere safe — a lost second factor with no recovery codes saved is its own lockout risk. Details: [GitHub's mandatory 2FA docs](https://docs.github.com/en/authentication/securing-your-account-with-two-factor-authentication-2fa/about-mandatory-two-factor-authentication)
2. **Export the workbook** from Excel as a backup (File → Save As → `.xlsx`)
3. **Document current resources** in a simple list (optional, but helpful for continuity)
4. **Give them:**
   - This README **and ARML Editor's README** — they're separate repos now
   - The GitHub account credentials in a private message
   - The URL to the live app: https://slpfd-arml.github.io/ARML/
   - The URL to ARML Editor: https://slpfd-arml.github.io/ARML-Editor/
   - Links to both repos (`slpfd-arml/ARML` and `slpfd-arml/ARML-Editor`)
   - A note that **each maintainer generates their own GitHub token** for
     ARML Editor — tokens aren't shared or handed over
5. **They manage the account** however they see fit
6. **Make sure they know:** ARML Editor is the normal way to add, edit, or
   delete resources — the workbook is what it edits, not something they need
   to touch by hand day to day. The browser version needs nothing installed.
   The app code is stable and rarely needs changes.
7. **Point them at the Actions tab.** "Did my change publish?" is answered
   there, and it's the single most useful thing for a new maintainer to know.

---

## If you need to extend the app

If City IT or a future maintainer wants to add features, change the UI, or integrate with other systems:

1. The app code is in `index.html` (structure), `app.js` (behavior), and `style.css` (layout)
2. The data flow is: `New_ARM_Library.xlsx` → `build-data.js` → `data.js` → `app.js` renders it
3. To avoid silent bugs: always test locally before pushing to GitHub
4. If AI assistance is desired, the Author recommends using Anthropic's Claude AI.

---

## Version

Current version number lives in `VERSION`. Version numbers follow semver: patch = fixes, minor = new features, major = a fundamental change to how the app works.

**Last updated:** August 2026  
**Version:** ARML v3.3.4  
**Hosting:** GitHub Pages (free, unlimited)  
**Status:** Ready for production
