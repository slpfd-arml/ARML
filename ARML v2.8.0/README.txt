# ARML (Alternative Response Medic Library)

A resource-lookup Progressive Web App (PWA) built for St. Louis Park Fire's
Alternative Response Medic (ARM) program. Runs on an iPad (primarily) as an
installed home-screen app, works fully offline once loaded,and lets a Community Paramedic
or community health worker quickly find community resources, screening
tools, ROI (Release of Information) contacts, and shelter/housing search
tools during a call.

This document exists so that city IT staff, a future maintainer, or an AI assistant - 
can understand what this is, how it's built, and how to change it safely. 
If you're an AI reading this to help someone maintain the app: read this whole file before touching
any code, and re-run `build-data.js` (see below) after any workbook edit.

---

## 1. The one-sentence architecture

**A spreadsheet is the database. A build script turns it into a JavaScript
file. A plain HTML/CSS/JS app reads that file. Nothing here needs a server,
a database, or an internet connection to run.**

```
New_ARM_Library.xlsx  →  build-data.js  →  data.js  →  index.html + app.js + style.css
     (the data)          (the compiler)   (the output)      (the app itself)
```

Whoever maintains this app's *content* (adding a food shelf, fixing a phone
number) only ever needs to touch the Excel workbook, then re-run one build
step. They never need to write code. Whoever maintains the app's *behavior*
(what a resource card looks like, what the footer buttons do) edits
`app.js` / `style.css` / `index.html` directly.

---

## 2. File-by-file reference

```
/
├── index.html              App shell - DOM structure only, no logic
├── app.js                  All UI behavior (search, favorites, modals, formatting)
├── style.css                All visual styling
├── data.js                  GENERATED - the compiled resource data. Never hand-edit this.
├── manifest.json             PWA identity (app name, icons, colors) - used when installing to home screen
├── service-worker.js        Offline caching. Has a CACHE_NAME that must be bumped on every
│                            app.js/style.css/index.html change (see §6).
├── README.md                 This file.
│
├── ARM-Builder/
│   ├── build-data.js         The compiler. Reads the xlsx, writes data.js.
│   ├── New_ARM_Library.xlsx  THE DATABASE. Everything the app shows lives here.
│   ├── package.json          Node dependencies for the build script (just the `xlsx` library)
│   └── node_modules/          (run `npm install` here once if missing)
│
├── Add-Resource-Tool/
│   ├── server.js              Local web server + form handler for adding resources
│   ├── index.html / form.js / styles.css   The add-resource form itself
│   ├── start-add-resource-tool.bat        Double-click this to launch it (Windows)
│   └── package.json           Node dependencies (express, multer, xlsx)
│
├── Assets/                    Every PDF the app links to. Any subfolder works - file
│   ├── ARM Screening Tools/   matching searches the whole tree, not just the top level.
│   └── ROIs/
│
└── icons/                     PWA home-screen icons + the header patch image
```

---

## 3. The workbook (`ARM-Builder/New_ARM_Library.xlsx`)

Five sheets:

| Sheet | Purpose |
|---|---|
| **Read Me** | Instructions living *inside* the workbook itself, for someone editing it in Excel who never opens this file. Keep it in sync with this document. |
| **Resource List** | The main data - one row per resource. 19 columns (see below). |
| **Release of Information** | Health-system medical-records contacts, shown under the "ROI Contacts" footer button. Has its own `Files` column (Label\|filename.pdf, semicolon-separated) for ROI form PDFs. |
| **Screening Tools** | Clinical screening tools, shown under "Screening Tools". |
| **St Stephens Contacts** | Sub-contacts nested inside a parent resource's detail view (currently just St. Stephen's programs). Generic mechanism - any sheet shaped like this one (title row, description row, blank row, then a header row starting with "Parent Resource") gets picked up by `build-data.js` and joined to the resource whose name matches exactly. To add sub-contacts for a *different* resource, either add rows here with a different `Parent Resource` value, or add a new sheet in the same shape and register it in `build-data.js`'s `SUB_CONTACT_SHEETS` array. |

### Resource List columns

| Column | Notes |
|---|---|
| Resource Name | Must be unique - `build-data.js` doesn't enforce this, but the Add-Resource-Tool does. |
| Parent Organization/Agency | Shown as a subtitle under the name, when present. |
| Organization Type | Free text, shown as a small label under the parent line. **Does not drive filtering** - see Broad Category. |
| Services Provided | Main description. |
| Contact Person, Email Address, Phone, Alternate Phone, Fax, Alternate Fax, TTY | Contact fields. Phone numbers get auto-formatted as `(612) 555-0123` regardless of how they're typed. |
| Website | `https://` gets added automatically if missing. |
| Street Address | Format: `Street, City, MN Zip`. Multiple locations for one resource: separate with `;`. Renders as clickable Apple Maps links, one pin icon per location. |
| Notes | Shown in its own "Notes" section at the bottom of the card. |
| Hours | Format: `Day-range Time-range` per line, separate lines with `;` (or an actual line break - both work as of v2.6.3). E.g. `Monday–Friday 8:00 AM–5:00 PM; Saturday 9:00 AM–12:00 PM`. |
| Keywords | Comma-separated. **Never shown to the user** - purely fuels search. |
| Files | `Label\|filename.pdf`, semicolon-separated for multiple. Bare filename (no `Label\|`) uses the filename itself as the link text. Filename is matched *fuzzily* against everything under `/Assets` recursively - exact folder doesn't matter, and minor spelling/capitalization differences are tolerated. |
| Broad Category | **This drives the category list and search filtering.** Must be exactly one of the 11 approved values (see §4). |
| Service Tags | Semicolon-separated, same purpose as Keywords (search only, never displayed) - a second, more curated tag set. |

---

## 4. The 11 approved Broad Categories

```
Food & Basic Needs        Legal / Tenant Help
Housing & Shelter          Benefits & Insurance
Health Care & Clinics      Seniors & Disability
Mental Health & Substance Use   Youth & Family
Transportation              Domestic Violence & Safety
Immigrant / Culturally Specific
```

This list is hardcoded in three places that must stay in sync if it ever
changes: the `<select>` in `Add-Resource-Tool/index.html`, the
`VALID_CATEGORIES` array in `Add-Resource-Tool/server.js`, and (implicitly)
whatever values actually appear in the workbook's Broad Category column.
There's no single source of truth for this list right now - if you add a
12th category, update all three.

---

## 5. How to add or edit a resource

**Preferred: Add-Resource-Tool.** Double-click
`Add-Resource-Tool/start-add-resource-tool.bat`. A browser tab opens a form.
Fill it in, hit Save. This writes directly to the workbook *and*
automatically re-runs the build - the live app has the new resource as soon
as you reload it. No Excel, no code, no manual separator-typing (keywords
and file labels are entered as chips/rows, not raw comma/semicolon text).

**To edit an existing resource,** or for anything the form doesn't cover
(bulk edits, restructuring), open `ARM-Builder/New_ARM_Library.xlsx`
directly in Excel, make the change, save, then either:
- Run `update-arm-library.bat` in the site root, or
- Open a terminal in `ARM-Builder/` and run `node build-data.js`

Either way, **the app itself never needs code changes for a content
update.** If you find yourself editing `app.js` to add a resource, stop -
that's not how this is supposed to work.

---

## 6. If you change `app.js`, `style.css`, or `index.html`

The app is a PWA with aggressive offline caching (`service-worker.js`).
Once installed on an iPad home screen, it will keep serving the *old*
cached version indefinitely unless you bump the cache key:

```js
// service-worker.js, line 1
const CACHE_NAME = 'arml-v6';   // increment this on every code change
```

Forgetting this is the single most common cause of "I made a change but
nothing looks different" - it's not that the change didn't work, it's that
the device is still running the cached copy from before.

### Version numbers

The visible version tag in the footer (`ARML v2.6.3`) follows semantic
versioning: **major.minor.patch**.
- **patch** - bug fixes, small tweaks, data-only changes
- **minor** - new functionality that doesn't change how existing things work
- **major** - a fundamental change to how the app works (e.g. the switch
  from category *chips* to a category *list* was a major version)

Bump it in `index.html`'s `<span class="version-tag">` on every code change.

---

## 7. The Add-Resource-Tool, in detail

A small local-only Node/Express server (`Add-Resource-Tool/server.js`) plus
a form (`index.html` + `form.js` + `styles.css`). It runs at
`http://localhost:3000` and is never exposed to the internet - it only
works while `start-add-resource-tool.bat` is running on the same machine.

What it does on submit:
1. Validates the resource name isn't blank and isn't already in the
   workbook (case-insensitive check) - blocks duplicates rather than
   silently creating them.
2. Validates Broad Category is one of the 11 approved values.
3. Any uploaded PDFs get copied into `/Assets` under their original
   filename - if that name is already taken, it's automatically
   renamed (`-2`, `-3`, ...) rather than overwriting an existing file.
4. Keywords and Service Tags (entered as tag chips in the form, not typed
   text) get joined into the comma/semicolon format the workbook expects.
   Same for Files - the form sends structured (filename, label) pairs and
   the server builds the `Label|filename.pdf` string.
5. Writes the new row to `New_ARM_Library.xlsx`.
6. **Automatically runs `build-data.js`** so `data.js` is current
   immediately - there is no separate "push to ARML" step to remember.

If you're reading this to debug why a save failed: check the terminal
window the .bat file opened - server errors print there, not just in the
browser.

---

## 8. Known quirks and deliberate design choices

- **No external icon fonts or CDNs anywhere in `app.js`.** All icons are
  hand-written inline SVG. This is deliberate - the app needs to keep
  working with zero network access, and a CDN-hosted icon font would be a
  liability the moment the device is offline.
- **Favorites use `localStorage`**, which is per-device and per-browser -
  favoriting a resource on one iPad doesn't sync to another. There's no
  backend to sync through; this is a local-only app by design.
- **The workbook path is hardcoded** in both `build-data.js` and
  `Add-Resource-Tool/server.js` as "one level up from wherever this script
  lives, then into ARM-Builder." If the folder structure ever changes,
  both files need updating - this has broken silently before (see git
  history / prior version notes) when the workbook was moved without
  updating the path.
- **PWA icons** (`icons/icon-192.png`, `icons/icon-512.png`) must stay
  exactly those pixel dimensions - iOS uses them for the home-screen icon
  and app-switcher thumbnail and will reject or badly scale anything else.

---

## 9. Link rot - proposed approach (not yet built)

Websites and PDFs referenced in the workbook will inevitably go stale over
years. Two different kinds of rot, two different fixes:

**Broken website links** - a simple `/check-links` route could be added to
the same Add-Resource-Tool server: read every Website URL out of the
workbook, send each an HTTP request with a short timeout, and report which
ones failed (404, timeout, DNS failure) alongside the resource name. This
needs no new dependencies (Node's built-in `https` module is enough) and
could show results as a simple table in the same tool, with a "check now"
button. Doesn't require internet access to *run* the app day-to-day, only
to run this specific check occasionally.

**Missing/renamed PDF files** - already partially self-checking:
`build-data.js` prints a warning to the console for any Files entry that
doesn't match a real file anywhere under `/Assets` when you run the build.
Anyone doing periodic maintenance can just watch for those warnings.

Neither of these is built yet. If picked up later, the natural home for
both is a new tab or route on the existing Add-Resource-Tool server, since
that's already the one piece of infrastructure set up to read and write the
workbook safely.

---

## 10. For an AI assistant picking this up cold

If you're an AI being asked to make changes to this app and this is your
first exposure to it: the data flow in §1 is the most important thing to
internalize. Never hand-edit `data.js` - it's regenerated from the
workbook every time `build-data.js` runs, and any manual edit to it will be
silently discarded on the next build. If a resource's data looks wrong,
the fix is almost always in the workbook, not in `data.js` or `app.js`.

Before changing `app.js` or `build-data.js`, actually read the current file
end to end rather than assuming you know its structure from this
description - it changes over time and this document may lag behind the
actual code in small ways. This document describes the architecture as of
**v2.6.3**.
