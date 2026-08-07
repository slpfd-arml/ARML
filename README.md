# ARML — Alternative Response Medic Library

A resource library for St. Louis Park Fire's Alternative Response Medic (ARM) program. Installs like a native app on iPad, iPhone, and desktop, works fully offline once installed, and updates itself in place.

**Live URL:** https://slpfd-arml.github.io/arml/

## What this is

ARML is a browsable, searchable library of community resources, screening tools, and release-of-information contacts for ARM medics to reference in the field — categorized, offline-capable, and installable to a home screen like a regular app.

## Installing

**iPad / iPhone:** Open the live URL in Safari, tap the Share icon, tap "Add to Home Screen." The app icon appears on the home screen and opens full-screen, no browser chrome.

**Desktop (Windows/Mac):** Open the live URL in Chrome or Edge, click the install icon in the address bar (or the `⋮` menu → "Install ARML"). Creates a standalone app window, pinnable to the taskbar/dock.

Either way, the app works fully offline after the first load — all reference PDFs are cached locally on the device, not fetched live each time.

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

## How updates reach the app

Resources are added, edited, or deleted through **ARML Editor** — a separate local tool (not included in this repo yet; documentation for it is coming in a follow-up handoff). ARML Editor:

1. Writes the change directly into `New_ARM_Library.xlsx`
2. Runs `build-data.js`, which regenerates `data.js`, `version.json`, `assets-manifest.json`, and re-stamps `service-worker.js`
3. Pushes the regenerated files to this GitHub repo automatically (when configured to do so)

Once that push lands, every installed copy of ARML — every iPad, every desktop install — sees an **"Update available"** prompt the next time it's opened, and updates itself with one tap. No manual redeployment, no app store, no reinstalling.

## Manually rebuilding (only needed if you're not using ARML Editor)

```
cd ARM-Builder
node build-data.js
```

Requires Node.js and the dependencies in `ARM-Builder/package.json` (`npm install` once, if `node_modules` isn't already present). Rebuilding regenerates the same four files ARML Editor would — commit and push them to deploy.

## Version

Current: see `VERSION`. Version numbers follow semver: patch = fixes, minor = new features, major = a fundamental change to how the app works.
