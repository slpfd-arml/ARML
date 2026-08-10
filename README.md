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
| `VERSION` | Plain-text current version number |

---

## For daily maintenance: adding/editing/deleting resources

**No coding knowledge required.** The recommended way to add, edit, or delete a resource is **ARML Editor** — a form-based tool that runs locally and handles everything:

1. **Double-click** `ARML Editor/start-ARML-editor.bat`
2. A page opens in your browser with two tabs: **Add New** and **Edit or Delete Existing**
3. Fill in the form (or search and pick an existing resource to edit/delete), upload any PDFs, hit **Save**
4. The workbook updates, the build runs automatically, and — if GitHub publishing is turned on (see `ARML Editor/config.json`) — it pushes straight to GitHub. No separate build step, no manual upload.

ARML Editor also catches likely mistakes before they happen: it warns if you're about to create an exact duplicate or something suspiciously similar to an existing resource, and any delete requires typing the resource's exact name to confirm — there's no one-click way to remove something by accident.

**Editing the workbook directly** (`ARM-Builder/New_ARM_Library.xlsx` in Excel) still works and is sometimes the right tool — bulk edits across many rows, or fixing something ARML Editor's form doesn't cover. If you go this route:

1. Edit the workbook and save it
2. **Double-click** `update-arm-library.bat` in the project root
3. Wait for the build to finish
4. The app updates on all connected devices, same as if ARML Editor had done it

Either path ends the same way: the workbook gets updated, the build runs, and the change is ready to publish.

---

## ARML Editor in depth

ARML Editor lives in the `ARML Editor/` folder and is a small local tool, not a website — running `start-ARML-editor.bat` starts a tiny local web server on this machine and opens it in a browser tab. Nothing about it is hosted anywhere; it only ever talks to `localhost` and (optionally) GitHub.

**What it does on every save:** writes your change into `ARM-Builder/New_ARM_Library.xlsx` → runs the same build script the manual workflow above uses → if GitHub publishing is turned on, pushes the rebuilt files straight to GitHub. All three steps happen automatically; there's nothing to run separately.

**Getting it running the first time:**
1. `ARML Editor/start-ARML-editor.bat` needs a copy of Node.js to run at all. It looks in `ARML Editor/node-portable/` first, and only falls back to checking for a system-wide Node.js install if that folder is empty.
2. **About that portable copy of Node.js — a note on trust:** `node-portable/node.exe`, if present, is the official Node.js Windows binary downloaded directly from nodejs.org, code-signed by the OpenJS Foundation (the same organization that maintains Node.js itself) — it isn't some unofficial or repackaged executable. That said, code-signing doesn't guarantee a City IT environment will let it run: some organizations block *any* `.exe` launched from a USB drive outright via Group Policy, regardless of who signed it, and some antivirus/endpoint tools flag unfamiliar executables on first run even when legitimate (Windows SmartScreen's "Windows protected your PC" prompt is the most common form of this — it's a warning, not a block, and "More info → Run anyway" gets past it *if* the person running it has permission to do so). If this is a concern for your department's machines, it's worth testing on a representative machine (or asking IT) before relying on the portable copy for the actual hand-off. If it does get blocked, nothing is lost: **the launcher automatically falls back to a normal, system-installed Node.js** (see the "What you DO need" section below for the download link) with no code changes required — it's a fallback path, not a hard requirement.
3. If neither a portable nor a system Node.js is found, the launcher says so plainly and points at nodejs.org rather than failing silently.

**Turning on auto-publish to GitHub (optional, one-time):** by default, saves in ARML Editor stay local — the workbook and rebuilt files update, but nothing gets pushed anywhere until you push it yourself using one of the "For deployment" methods above. To have it publish automatically on every save instead:
1. On GitHub: **Settings → Developer settings → Personal access tokens → Fine-grained tokens** → generate one scoped to just the ARML repo, with **Contents: Read and write** permission only (nothing broader).
2. Open `ARML Editor/config.json` in a text editor and fill in `enabled: true`, plus `owner`, `repo`, `branch`, and `token`.
3. Restart ARML Editor. A status line near the top of the page confirms whether it's live, and to what repo.

**This token is a real credential — treat it like a password.** It lives only in `ARML Editor/config.json`, which the project's `.gitignore` already excludes from version control specifically so it's never accidentally committed anywhere, including to the very repo it publishes to. Don't email it, don't paste it into a chat tool, and if it's ever exposed, revoke it on GitHub immediately and generate a new one.

**If GitHub publishing fails or isn't turned on:** ARML Editor has a built-in **"Export update bundle"** button that zips up everything needed for a manual upload via the GitHub web UI method above — useful on a restrictive City network where outbound HTTPS to GitHub's API might be blocked even though normal web browsing works.

---

## For deployment: pushing updates to devices

Once you've edited the workbook and run the build:

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

**On your maintenance machine:**
- Node.js (for running the build) — [download from nodejs.org](https://nodejs.org/)
  - The portable zip version is fine; no admin rights needed
  - Current: v22 or later
- Excel or compatible spreadsheet app (to edit the workbook)
- A web browser (to test locally before pushing)

**Making ARML Editor fully turnkey (optional but recommended):**
By default, `ARML Editor/start-ARML-editor.bat` needs Node.js installed on
whatever machine runs it. To remove that requirement entirely - so the
tool works the moment the folder is copied over, with nothing to install
and no admin rights needed - drop a portable copy of Node.js into
`ARML Editor/node-portable/`. Full instructions are in
`ARML Editor/node-portable/PLACE-NODE-HERE.txt`; the launcher detects and
uses it automatically if it's there, and falls back to a system install
if it isn't, so this step can be done at any time, not just up front.

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
- If you used ARML Editor: check the message it showed after saving — if it says the build or publish failed, that's why. If it says success, give it a minute and refresh the iPad's Safari.
- If you edited the workbook directly: did you run `update-arm-library.bat` afterward? If not, the change is saved but not published.
- Either way: did the change actually reach GitHub? If it's still just on your machine, no one else sees it.
- If it's been 2+ minutes since you pushed and it's still not there, refresh the iPad's Safari and try again.

**I deleted a resource by accident:**
- Deleting is immediate and there's no undo inside ARML Editor — it removes the row from the workbook right away.
- If you have a recent copy of `New_ARM_Library.xlsx` (a backup, or an earlier version still in `node_modules`-adjacent history if you're using git), you can manually re-add the row and rebuild.
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
   - This README
   - The GitHub account credentials in a private message
   - The URL to the live app
   - The link to the GitHub repo
5. **They manage the account** however they see fit
6. **Make sure they know:** ARML Editor is the normal way to add, edit, or delete resources — the workbook is what it edits, not something they need to touch by hand day to day. The app code is stable and rarely needs changes.

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
**Version:** ARML v3.1.12  
**Hosting:** GitHub Pages (free, unlimited)  
**Status:** Ready for production
