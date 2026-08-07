// =======================================
//  ARM Library Builder — Final Clean Version
//  Reads the single "Files" column (Resource List + Screening Tools)
//  Format: "Label|filename.pdf" and/or "file1.pdf; Label2|file2.pdf"
//  Resolves filenames anywhere under /Assets (recursive, fuzzy match)
// =======================================

const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");
const XLSX = require("xlsx");

const siteRoot = path.join(__dirname, "..");
const workbookPath = path.join(__dirname, "New_ARM_Library.xlsx"); // lives in ARM-Builder alongside this script
const outPath = path.join(siteRoot, "data.js");
const assetsRoot = path.join(siteRoot, "Assets");
const iconsRoot = path.join(siteRoot, "icons");
const versionFilePath = path.join(siteRoot, "VERSION");
const versionOutPath = path.join(siteRoot, "version.json");
const manifestOutPath = path.join(siteRoot, "assets-manifest.json");
const swPath = path.join(siteRoot, "service-worker.js");

// VERSION is the single source of truth for the human-facing version number.
// It used to live hardcoded in index.html's <span class="version-tag">, which
// meant remembering to edit it by hand on every change. Now the build stamps
// it into version.json and the app reads it from there at runtime.
function readVersion() {
  if (fs.existsSync(versionFilePath)) {
    const v = fs.readFileSync(versionFilePath, "utf8").trim();
    if (v) return v;
  }
  fs.writeFileSync(versionFilePath, "2.7.1\n");
  console.log("(No VERSION file found - created one at 2.7.1.)");
  return "2.7.1";
}
const VERSION = readVersion();

// Every asset path the app actually references, collected as resolveFile()
// resolves them. This is what lets the Update button precache the whole
// library rather than only the PDFs someone happened to have opened.
// Collected from real resolutions rather than by listing /Assets, so
// orphaned files nobody links to don't get pushed to every iPad.
const referencedAssets = new Set();

function cleanText(str) {
  if (str === null || str === undefined) return "";
  return String(str).replace(/\r?\n|\r/g, " ").replace(/\s+/g, " ").trim();
}

// Keywords and Service Tags used to be two separate columns with the same
// actual purpose (invisible search fuel - neither is ever shown to the
// user). Consolidated into one field. Rather than rewriting the workbook
// itself - risky against 161 rows of real production data for zero real
// benefit - this merges both columns at BUILD time. Existing resources
// that still have data split across both columns keep working exactly as
// before; nothing is lost. The Add-Resource-Tool now only writes to the
// "Keywords" column going forward, so a resource's data fully
// consolidates onto one column the next time someone edits it through the
// tool - no bulk migration, no risk to rows nobody's touching.
// KEEP IN SYNC: Add-Resource-Tool/server.js has an identical function for
// the same reason (its /resources endpoint needs to show the merged set
// too) - small and stable enough that duplicating it beats sharing a
// module across two separate local tools.
function mergeLegacyTags(keywordsRaw, serviceTagsRaw) {
  const kw = String(keywordsRaw || "").split(",").map(s => s.trim()).filter(Boolean);
  const st = String(serviceTagsRaw || "").split(";").map(s => s.trim()).filter(Boolean);
  const seen = new Set();
  const merged = [];
  for (const term of [...kw, ...st]) {
    const key = term.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      merged.push(term);
    }
  }
  return merged;
}

// Same as cleanText, but for Hours fields specifically: a line break in the
// spreadsheet cell is a meaningful day-group separator (someone typed
// alt-enter between "Mon-Fri 8-4" and "Sat 8-2"), not just stray whitespace.
// Converting it to "; " here means the browser's formatHours() - which
// splits on ";" - sees it, instead of cleanText() silently collapsing it to
// a plain space and losing the separation entirely.
function cleanHours(str) {
  if (str === null || str === undefined) return "";
  return String(str)
    .replace(/\r\n|\r|\n/g, "; ")
    .replace(/[ \t]+/g, " ")
    .trim();
}

// Normalizes a filename for fuzzy matching: lowercase, drop the
// extension, split on any run of non-alphanumeric characters (spaces,
// underscores, &, apostrophes, etc.), drop stray "and" tokens (so
// "Fact_Sheet.pdf" / "Fact & Sheet.pdf" / "Fact and Sheet.pdf" all
// compare equal), then rejoin. This is what lets the Files column
// tolerate spacing/punctuation/capitalization differences per the
// Read Me tab, without needing a sanitize-assets.ps1 step to match it.
function normalizeForMatch(str) {
  return String(str)
    .toLowerCase()
    .replace(/\.pdf$/i, "")
    .split(/[^a-z0-9]+/i)
    .filter(word => word && word !== "and")
    .join("");
}

// Recursively indexes every file under /Assets, keyed by normalized name.
function buildAssetIndex(dir) {
  const index = new Map();
  function walk(current) {
    if (!fs.existsSync(current)) return;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = path.join(current, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else {
        const key = normalizeForMatch(entry.name);
        if (!index.has(key)) index.set(key, full);
      }
    }
  }
  walk(dir);
  return index;
}

const assetIndex = buildAssetIndex(assetsRoot);

// Resolves a bare filename from the Files column to a real, working
// site-relative path (e.g. "Assets/ARM Screening Tools/PHQ2-9.pdf").
function resolveFile(filename, context) {
  const key = normalizeForMatch(filename);
  const hit = assetIndex.get(key);
  if (hit) {
    const rel = path.relative(siteRoot, hit).split(path.sep).join("/");
    referencedAssets.add(rel);
    return rel;
  }
  console.warn(`\u26a0 Missing file: "${filename}" (context: ${context})`);
  return null;
}

// ---------- FILLABLE PDF DETECTION ----------
// Which PDFs actually contain form fields, detected by parsing them (see
// detect-fillable.js). Fillable forms get handed to the device's real PDF
// app, because Safari's built-in viewer renders form fields as a flat,
// uneditable image. Everything else opens in the in-app viewer.
//
// This is automatic on purpose: tagging forms by hand in the workbook
// meant a new form added through ARML Editor would silently open in the
// wrong place until somebody remembered to tag it.
const FILLABLE_FILENAMES = (() => {
  try {
    const out = execFileSync("node", [path.join(__dirname, "detect-fillable.js")], {
      encoding: "utf8",
      maxBuffer: 10 * 1024 * 1024
    });
    const parsed = JSON.parse(out);
    if (!parsed.available) {
      console.warn(
        "\n  Note: pdf-lib isn't installed, so fillable-form detection is off.\n" +
        "  Run 'npm install' in ARM-Builder to enable it. Until then, forms\n" +
        "  can still be flagged by hand with |fillable in the Files column.\n"
      );
      return new Set();
    }
    return new Set(parsed.fillable.map(f => f.toLowerCase()));
  } catch (err) {
    console.warn("\n  Note: fillable-form detection failed (" + err.message + ").\n");
    return new Set();
  }
})();

// Parses the Files column (same format on Resource List + Screening Tools):
//   ""                                  -> []
//   "AUDIT.pdf"                         -> [{label:"AUDIT.pdf", path:"...", fillable:auto}]
//   "Depression Screener|PHQ-9.pdf"     -> [{label:"...", path:"...", fillable:auto}]
//   "A.pdf; Label|B.pdf"                -> two entries, split on ";"
//
// "fillable" is normally decided automatically by scanning the PDF for
// form fields. Two optional trailing markers override that when needed:
//   "...|fillable"  - force it to open in the device's PDF app
//   "...|inapp"     - force it to open in the in-app viewer, even though
//                     it has form fields (useful for a reference sheet
//                     that happens to contain a stray field)
function parseFiles(raw, context) {
  if (!raw) return [];
  return String(raw)
    .split(";")
    .map(s => cleanText(s))
    .filter(Boolean)
    .map(entry => {
      let parts = entry.split("|").map(s => cleanText(s)).filter(s => s !== "");

      let override = null;
      const last = parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
      if (last === "fillable") { override = true; parts = parts.slice(0, -1); }
      else if (last === "inapp") { override = false; parts = parts.slice(0, -1); }

      const label = parts[0];
      const filename = parts.length === 1 ? parts[0] : parts[parts.length - 1];
      const resolved = resolveFile(filename, context);
      if (!resolved) return null;

      const autoFillable = FILLABLE_FILENAMES.has(path.basename(resolved).toLowerCase());
      return { label, path: resolved, fillable: override === null ? autoFillable : override };
    })
    .filter(Boolean);
}

function normalizeUrl(str) {
  const cleaned = cleanText(str);
  if (!cleaned) return "";
  if (/^[a-z][a-z0-9+.-]*:/i.test(cleaned)) return cleaned;
  return "https://" + cleaned;
}

if (!fs.existsSync(workbookPath)) {
  console.error("ERROR: Workbook not found:", workbookPath);
  process.exit(1);
}

const wb = XLSX.readFile(workbookPath);
const resourceSheet = wb.Sheets["Resource List"];
const screeningSheet = wb.Sheets["Screening Tools"];

if (!resourceSheet || !screeningSheet) {
  console.error("ERROR: Required sheets missing.");
  process.exit(1);
}

const resourcesRaw = XLSX.utils.sheet_to_json(resourceSheet, { defval: "" });
const screeningRaw = XLSX.utils.sheet_to_json(screeningSheet, { defval: "" });

// ---------- RESOURCES ----------
const resources = resourcesRaw
  .map(row => {
    const name = cleanText(row["Resource Name"]);
    const type = cleanText(row["Organization Type"]);
    const broadCategory = cleanText(row["Broad Category"]) || type; // fall back to Type if not yet categorized
    return {
      name,
      parent: cleanText(row["Parent Organization/Agency"]),
      type, // Organization Type - kept for display, no longer drives the chips
      services: cleanText(row["Services Provided"]),
      contact: cleanText(row["Contact Person"]),
      email: cleanText(row["Email Address"]),
      phone: cleanText(row["Phone"]),
      altPhone: cleanText(row["Alternate Phone"]),
      fax: cleanText(row["Fax"]),
      altFax: cleanText(row["Alternate Fax"]),
      hours: cleanHours(row["Hours"]),
      tty: cleanText(row["TTY"]),
      website: normalizeUrl(row["Website"]),
      address: cleanText(row["Street Address"]),
      notes: cleanText(row["Notes"]),
      keywords: mergeLegacyTags(row["Keywords"], row["Service Tags"]).join(", "),
      categories: [broadCategory].filter(Boolean),
      files: parseFiles(row["Files"], name),
      subContacts: [] // filled in below, after St Stephens Contacts (or similar) sheets are parsed
    };
  })
  .filter(r => r.name);

// ---------- SCREENING TOOLS ----------
// The "Tools" column does double duty: "Label|filename.pdf" gives both
// the tool's display name (the label) and its file in one field.
const screening_tools = screeningRaw
  .map(row => {
    const raw = cleanText(row["Tools"]);
    const firstEntry = raw.split(";")[0] || "";
    const pipeIdx = firstEntry.indexOf("|");
    const tool = pipeIdx === -1 ? cleanText(firstEntry) : cleanText(firstEntry.slice(0, pipeIdx));
    return {
      domain: cleanText(row["Domain"]),
      tool,
      purpose: cleanText(row["Purpose"]),
      files: parseFiles(row["Tools"], tool)
    };
  })
  .filter(t => t.tool);

// ---------- RELEASE OF INFORMATION (optional sheet) ----------
const roiSheet = wb.Sheets["Release of Information"];
const release_of_information = roiSheet
  ? XLSX.utils.sheet_to_json(roiSheet, { defval: "" })
      .map(row => ({
        organization: cleanText(row["Organization"]),
        email: cleanText(row["Email"]),
        phone: cleanText(row["Phone"]),
        altPhone: cleanText(row["Alternate Phone"]),
        fax: cleanText(row["Fax"]),
        altFax: cleanText(row["Alternate Fax"]),
        address: cleanText(row["Mailing Address"]),
        notes: cleanText(row["Notes"]),
        files: parseFiles(row["Files"], cleanText(row["Organization"]))
      }))
      .filter(r => r.organization)
  : [];
if (!roiSheet) console.log('(No "Release of Information" sheet found - skipping ROI contacts.)');

// ---------- SUB-CONTACTS (optional sheet(s)) ----------
// Generic "Parent Resource" join: any sheet shaped this way gets nested
// under the matching resource's detail view, keyed by exact Resource Name.
// Currently just "St Stephens Contacts", but this isn't hardcoded to it -
// add more sheets in the same shape and they'll join the same way.
const SUB_CONTACT_SHEETS = ["St Stephens Contacts", "CAP-HC Contacts"];
let subContactCount = 0;

SUB_CONTACT_SHEETS.forEach(sheetName => {
  const sheet = wb.Sheets[sheetName];
  if (!sheet) {
    console.log(`(No "${sheetName}" sheet found - skipping.)`);
    return;
  }

  // These sheets have a title + description row before the real header,
  // so find the header row by content instead of assuming a fixed offset.
  const aoa = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });
  const headerRowIdx = aoa.findIndex(r => cleanText(r[0]) === "Parent Resource");
  if (headerRowIdx === -1) {
    console.warn(`\u26a0 "${sheetName}": couldn't find a "Parent Resource" header row - skipping.`);
    return;
  }
  const headers = aoa[headerRowIdx].map(cleanText);
  const dataRows = aoa.slice(headerRowIdx + 1).filter(r => r.some(cell => cleanText(cell)));

  dataRows.forEach(rowArr => {
    const row = {};
    headers.forEach((h, i) => { if (h) row[h] = rowArr[i]; });

    const parentName = cleanText(row["Parent Resource"]);
    const parent = resources.find(r => r.name === parentName);
    if (!parent) {
      console.warn(`\u26a0 "${sheetName}": Parent Resource "${parentName}" doesn't match any Resource Name - sub-contact dropped.`);
      return;
    }

    parent.subContacts.push({
      name: cleanText(row["Sub-Contact Name"]),
      category: cleanText(row["Category"]),
      audience: cleanText(row["Audience"]),
      purpose: cleanText(row["Services / Purpose"]),
      phone: cleanText(row["Phone"]),
      email: cleanText(row["Email"]),
      website: normalizeUrl(row["Website"]),
      location: cleanText(row["Location"]),
      hours: cleanHours(row["Hours / Availability"]),
      access: cleanText(row["Access Instructions"]),
      notes: cleanText(row["Notes"]),
      source: cleanText(row["Source"])
    });
    subContactCount++;
  });
});

// ---------- FINAL OUTPUT ----------
const ARM_DATA = {
  meta: {
    generated: new Date().toISOString(),
    resource_count: resources.length,
    screening_count: screening_tools.length,
    roi_count: release_of_information.length,
    sub_contact_count: subContactCount
  },
  categories: [...new Set(resources.map(r => r.categories[0]).filter(Boolean))].sort(),
  resources,
  screening_tools,
  release_of_information
};

// ---------- VERSION / BUILD ID ----------
// dataHash is computed over the CONTENT ONLY - meta is excluded entirely.
// That matters: meta carries a build timestamp, so including it would make
// every single build look like new content and tell every device to
// re-download the whole library even when nothing actually changed.
//
// CRITICAL: this hash must also react to CODE changes (app.js, index.html,
// style.css, manifest.json), not just resource-data changes. Without this,
// editing app.js and rebuilding produces the exact same BUILD_ID as before
// whenever the workbook itself didn't change - which means the shell cache
// key never changes, which means the service worker has no signal to ever
// replace its cached (and now-outdated) copy of app.js. A code fix would
// silently never reach any device already running the app. This is not a
// hypothetical: it happened during development, on a PDF-link fix that
// touched only app.js.
//
// service-worker.js is deliberately EXCLUDED from this list - it's the file
// build-data.js writes BUILD_ID *into*, so including its own content in the
// hash that determines BUILD_ID would be self-referential and never settle
// on a stable value.
const HASHED_SHELL_FILES = ["index.html", "app.js", "style.css", "manifest.json", "insurance-guide-text.js"];

function readShellFileForHash(relName) {
  const p = path.join(siteRoot, relName);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : `MISSING:${relName}`;
}

const shellContent = HASHED_SHELL_FILES.map(readShellFileForHash).join("\u0000");

const dataHash = crypto
  .createHash("sha256")
  .update(
    JSON.stringify({
      categories: ARM_DATA.categories,
      resources: ARM_DATA.resources,
      screening_tools: ARM_DATA.screening_tools,
      release_of_information: ARM_DATA.release_of_information
    })
  )
  .update(shellContent)
  .digest("hex")
  .slice(0, 12);

// BUILD_ID changes whenever the version, the resource data, OR the app code
// changes. This is what devices compare to decide whether an update is
// available, and what busts the shell cache. Neither content edits nor code
// fixes require a manual version bump to actually take effect on a device.
const BUILD_ID = `${VERSION}+${dataHash}`;

// Stamped into the data itself so the running app knows which build it IS,
// without relying on localStorage - which iOS can clear, and which would
// otherwise make the app forget its own version and prompt to "update" to
// the build it's already running.
ARM_DATA.meta.version = VERSION;
ARM_DATA.meta.buildId = BUILD_ID;
ARM_DATA.meta.dataHash = dataHash;

const jsOut = "const ARM_DATA = " + JSON.stringify(ARM_DATA, null, 2) + ";";
fs.writeFileSync(outPath, jsOut);

// ---------- ASSETS MANIFEST ----------
// Shell = everything needed to run the app at all. Enumerated from disk
// rather than hardcoded, so a new icon can't be silently left out of the
// offline cache - which is exactly what happened to icons/waypoint-icon.png
// under the old hand-maintained list.
function listIcons() {
  if (!fs.existsSync(iconsRoot)) return [];
  return fs
    .readdirSync(iconsRoot, { withFileTypes: true })
    .filter(e => e.isFile() && /\.(png|svg|ico|jpg|jpeg|webp)$/i.test(e.name))
    .map(e => "icons/" + e.name)
    .sort();
}

const shellFiles = [
  "index.html",
  "style.css",
  "app.js",
  "data.js",
  "manifest.json",
  "version.json",
  "insurance-guide-text.js",
  ...listIcons()
];

const assetFiles = [...referencedAssets].sort();

fs.writeFileSync(
  manifestOutPath,
  JSON.stringify({ buildId: BUILD_ID, shell: shellFiles, assets: assetFiles }, null, 2)
);

fs.writeFileSync(
  versionOutPath,
  JSON.stringify(
    {
      version: VERSION,
      buildId: BUILD_ID,
      built: ARM_DATA.meta.generated,
      dataHash,
      resourceCount: resources.length,
      assetCount: assetFiles.length
    },
    null,
    2
  )
);

// ---------- STAMP THE SERVICE WORKER ----------
// Rewrites BUILD_ID and SHELL_FILES in service-worker.js. Because this
// changes the file byte-wise on every build, the browser reliably notices
// there's a new service worker - which is what removes the old "remember to
// bump CACHE_NAME by hand" footgun entirely.
let swWarning = null;
if (!fs.existsSync(swPath)) {
  swWarning = "service-worker.js not found - skipped stamping.";
} else {
  let sw = fs.readFileSync(swPath, "utf8");

  const buildIdPattern = /const BUILD_ID = ['"][^'"]*['"];/;
  // Match SHELL_FILES up through its closing "];" regardless of line-ending
  // style. The previous version anchored on a literal "\n" right after the
  // semicolon, which broke on CRLF-saved files (common after editing on
  // Windows) - the regex would fail to find that exact byte sequence and
  // silently not match, which is exactly the kind of failure this stamping
  // step exists to catch. Anchoring on "];" instead of a trailing newline
  // is robust to either line ending.
  const shellFilesPattern = /const SHELL_FILES = \[[\s\S]*?\];/;

  const hasBuildId = buildIdPattern.test(sw);
  const hasShellFiles = shellFilesPattern.test(sw);

  if (hasBuildId) {
    sw = sw.replace(buildIdPattern, `const BUILD_ID = '${BUILD_ID}';`);
  }
  if (hasShellFiles) {
    sw = sw.replace(shellFilesPattern, `const SHELL_FILES = ${JSON.stringify(shellFiles, null, 2)};`);
  }

  if (!hasBuildId || !hasShellFiles) {
    // Genuine failure: report exactly which line is missing, rather than a
    // single vague "neither could be stamped" that leaves you guessing.
    const missing = [];
    if (!hasBuildId) missing.push("BUILD_ID");
    if (!hasShellFiles) missing.push("SHELL_FILES");
    swWarning = `service-worker.js is missing the ${missing.join(" and ")} line(s) - could not stamp. Re-copy service-worker.js from the release package.`;
  } else {
    // Both patterns matched (whether or not the values actually changed -
    // an unchanged Build ID across two identical builds is expected and
    // NOT a failure) - write it out.
    fs.writeFileSync(swPath, sw);
  }
}

console.log("============================================");
console.log(" ARM Library Build Complete");
console.log(" Output:", outPath);
console.log(" Version:", VERSION);
console.log(" Build ID:", BUILD_ID);
console.log(" Resources:", resources.length);
console.log(" Screening Tools:", screening_tools.length);
console.log(" ROI Contacts:", release_of_information.length);
console.log(" Sub-Contacts:", subContactCount);
console.log(" Categories:", ARM_DATA.categories.length);
console.log(" Shell files:", shellFiles.length);
console.log(" Offline assets:", assetFiles.length);
if (swWarning) console.warn(" \u26a0 " + swWarning);
console.log("============================================");
