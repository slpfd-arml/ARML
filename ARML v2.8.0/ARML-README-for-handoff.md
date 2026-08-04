# ARML v3.0 — Resource Library for St. Louis Park Fire ARM

**What is this?** A Progressive Web App (PWA) that runs on iPads and Windows, works fully offline, and makes resource information instantly available to Community Paramedics during calls.

**Who maintains it?** The City of St. Louis Park. This document is for whoever that is.

---

## For daily maintenance: adding/editing resources

**No coding knowledge required.** The entire maintenance workflow is:

1. **Open the workbook:** `ARM-Builder/New_ARM_Library.xlsx` in Excel
2. **Edit a row** or add a new resource
3. **Save the file**
4. **Double-click** `update-arm-library.bat` in the project root
5. **Wait 10 seconds** for the build to complete
6. The app updates automatically on all connected devices within seconds

That's it. No terminals, no git, no coding.

**To add PDFs:** Use the `Add-Resource-Tool` instead (double-click `Add-Resource-Tool/start-add-resource-tool.bat`). A form opens in your browser. Fill in the fields, upload PDFs, hit Save. The build runs automatically.

---

## For deployment: pushing updates to medics

Once you've edited the workbook and run the build:

**Via git (if you have it):**
```
git add .
git commit -m "Updated resources: [what changed]"
git push
```

**Via GitHub web UI (no git required):**
1. Go to [github.com/slpfd-arml/arml](https://github.com/slpfd-arml/arml)
2. Click **Add file** → **Upload files**
3. Select the files you changed (workbook, data.js, version.json, assets-manifest.json)
4. Commit
5. Done — GitHub Pages auto-deploys within 1–2 minutes

Either way, the changes are live. Any medic who opens the app sees `Update available` within a few seconds, taps it, and gets the new data + all PDFs for offline use.

---

## What you DON'T need to do

- **Write code.** You edit a spreadsheet, not code.
- **Buy Copilot or coding tools.** They're not part of the maintenance loop. If someone needs to *extend* the app later (add features, change the UI), they can learn tools then.
- **Manage Netlify credits or hosting bills.** GitHub Pages is free and unlimited.
- **Manually update PDFs on iPads.** The app downloads them automatically when medics tap Update.
- **Sync files via OneDrive or email.** The web deployment handles distribution.

---

## What you DO need

**On your maintenance machine:**
- Node.js (for running the build) — [download from nodejs.org](https://nodejs.org/)
  - The portable zip version is fine; no admin rights needed
  - Current: v22 or later (anything from the last year works)
- Excel or compatible spreadsheet app (to edit the workbook)
- A web browser (to test locally before pushing)

**On medics' devices:**
- iPad 2 or later, or iPhone 6 or later — the app installs via "Add to Home Screen" in Safari
- No app store, no admin rights, no installation
- Works on any iOS version that supports PWAs (generally iOS 11+)
- Works fully offline once installed

**Organizational:**
- The GitHub account `slpfd-arml` with admin access
- Access to the ARML repository on GitHub
- Ability to reach github.com — if your network blocks it, you'll need an exception from IT

---

## Testing before going live

Before you push updates to medics, test locally:

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
- Did you run `update-arm-library.bat` after editing the workbook? If not, the change is saved but not published.
- Did you push to GitHub? If it's still just on your machine, no one else sees it.
- If it's been 2+ minutes since you pushed and it's still not there, refresh the iPad's Safari and try again.

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

1. **Export the workbook** from Excel as a backup (File → Save As → `.xlsx`)
2. **Document current resources** in a simple list (optional, but helpful for continuity)
3. **Give them:**
   - This README
   - The GitHub account credentials in a private message
   - The URL to the live app
   - The link to the GitHub repo
4. **They manage the account** however they see fit
5. **Make sure they know:** edits to the workbook are the only thing that matters. The app code is stable and rarely needs changes.

---

## If you need to extend the app

If City IT or a future maintainer wants to add features, change the UI, or integrate with other systems:

1. The app code is in `index.html` (structure), `app.js` (behavior), and `style.css` (layout)
2. The data flow is: `New_ARM_Library.xlsx` → `build-data.js` → `data.js` → `app.js` renders it
3. To avoid silent bugs: always test locally before pushing to GitHub
4. **You won't need Copilot for basic maintenance.** If you're extending features, tools like GitHub Copilot or ChatGPT can help, but they're optional — not required for the core maintenance cycle.

---

## Contact

This app was built by Kyle (kyle @ this organization). For technical questions about the codebase, reach out to them first. For questions about resource data, editorial decisions, or field testing, reach out to the ARM program leadership.

---

**Last updated:** August 2026  
**Version:** ARML v3.0  
**Hosting:** GitHub Pages (free, unlimited)  
**Status:** Ready for production
