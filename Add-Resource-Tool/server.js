const express = require("express");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const XLSX = require("xlsx");
const publisher = require("./publish.js");

const app = express();

// Everything is served from this same Express app (this file, index.html,
// form.js, styles.css) on one origin. That's deliberate: if index.html were
// opened directly as a file:// page instead, fetch() calls to this server
// would be cross-origin and get blocked by the browser's CORS policy with
// no server-side fix short of adding CORS headers. Serving everything from
// http://localhost:3000 sidesteps that entirely.
app.use(express.static(__dirname));
app.use(express.json());

// The workbook lives in ARM-Builder, one level up and over - NOT directly
// one level up. (This was the bug that made every save fail before: the
// original path pointed at a location the workbook has never actually
// been in.)
const ROOT = path.join(__dirname, "..");
const BUILDER_DIR = path.join(ROOT, "ARM-Builder");
const WORKBOOK_PATH = path.join(BUILDER_DIR, "New_ARM_Library.xlsx");
const ASSETS_DIR = path.join(ROOT, "Assets");
const BUILD_SCRIPT = path.join(BUILDER_DIR, "build-data.js");

const VALID_CATEGORIES = [
  "Food & Basic Needs", "Housing & Shelter", "Health Care & Clinics",
  "Mental Health & Substance Use", "Transportation", "Legal / Tenant Help",
  "Benefits & Insurance", "Seniors & Disability", "Youth & Family",
  "Domestic Violence & Safety", "Immigrant / Culturally Specific"
];

// Uploaded PDFs land directly in /Assets (not a subfolder) - the app's
// fuzzy file matching searches the whole Assets tree recursively regardless
// of subfolder, so where exactly a file sits doesn't affect whether it
// resolves. Simpler for the uploader = one flat destination.
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, ASSETS_DIR),
    filename: (req, file, cb) => cb(null, uniqueFilename(file.originalname))
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype !== "application/pdf" && !/\.pdf$/i.test(file.originalname)) {
      return cb(new Error("Only PDF files are accepted."));
    }
    cb(null, true);
  },
  limits: { fileSize: 25 * 1024 * 1024 } // 25MB per file, generous for a PDF
});

// If a file with this name already exists in Assets, don't silently
// overwrite it - append -2, -3, etc. until the name is free.
function uniqueFilename(originalName) {
  const ext = path.extname(originalName);
  const base = path.basename(originalName, ext);
  let candidate = originalName;
  let n = 2;
  while (fileExistsAnywhereInAssets(candidate)) {
    candidate = `${base}-${n}${ext}`;
    n++;
  }
  return candidate;
}

function fileExistsAnywhereInAssets(filename) {
  const stack = [ASSETS_DIR];
  while (stack.length) {
    const dir = stack.pop();
    if (!fs.existsSync(dir)) continue;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) stack.push(path.join(dir, entry.name));
      else if (entry.name === filename) return true;
    }
  }
  return false;
}

// GET /resource-names - used by the form for live duplicate-name warnings
// as the user types, before they even hit submit.
app.get("/resource-names", (req, res) => {
  try {
    const wb = XLSX.readFile(WORKBOOK_PATH);
    const rows = XLSX.utils.sheet_to_json(wb.Sheets["Resource List"], { defval: "" });
    res.json({ names: rows.map(r => r["Resource Name"]).filter(Boolean) });
  } catch (err) {
    res.status(500).json({ error: "Could not read the workbook: " + err.message });
  }
});

// POST /add - accepts multipart/form-data: regular text fields, repeated
// keywords[] / serviceTags[] fields (from tag-chip inputs), repeated
// fileLabels[] fields (one per uploaded file, same order), and the PDF
// files themselves under the "files" field name.
app.post("/add", upload.array("files"), (req, res) => {
  try {
    const body = req.body;
    const name = (body.name || "").trim();
    const broadCategory = (body.broadCategory || "").trim();

    if (!name) {
      return res.status(400).json({ error: "Resource Name is required." });
    }
    if (!VALID_CATEGORIES.includes(broadCategory)) {
      return res.status(400).json({ error: "Please choose a valid Broad Category from the list." });
    }

    const wb = XLSX.readFile(WORKBOOK_PATH);
    const sheet = wb.Sheets["Resource List"];
    const rows = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    const duplicate = rows.find(r => String(r["Resource Name"]).trim().toLowerCase() === name.toLowerCase());
    if (duplicate) {
      return res.status(409).json({
        error: `"${name}" already exists in the Resource List. Edit the existing entry in Excel instead of adding a duplicate, or use a distinguishing name.`
      });
    }

    // Keywords / Service Tags arrive as arrays from the tag-chip inputs -
    // joined into the same comma/semicolon format the workbook already
    // uses, but the person filling out the form never types a comma or
    // semicolon themselves.
    const keywords = toArray(body.keywords).join(", ");
    const serviceTags = toArray(body.serviceTags).join("; ");

    // Files: one uploaded PDF + one matching label per array position.
    const fileLabels = toArray(body.fileLabels);
    const filesValue = (req.files || [])
      .map((f, i) => {
        const label = (fileLabels[i] || "").trim();
        // uniqueFilename() may have renamed it on disk if there was a
        // collision - f.filename is the actual final name that was saved.
        return label ? `${label}|${f.filename}` : f.filename;
      })
      .join("; ");

    rows.push({
      "Resource Name": name,
      "Parent Organization/Agency": body.parent || "",
      "Organization Type": body.type || "",
      "Services Provided": body.services || "",
      "Contact Person": body.contact || "",
      "Email Address": body.email || "",
      "Phone": body.phone || "",
      "Alternate Phone": body.altPhone || "",
      "Fax": body.fax || "",
      "Alternate Fax": body.altFax || "",
      "TTY": body.tty || "",
      "Website": body.website || "",
      "Street Address": body.address || "",
      "Notes": body.notes || "",
      "Hours": body.hours || "",
      "Keywords": keywords,
      "Files": filesValue,
      "Broad Category": broadCategory,
      "Service Tags": serviceTags
    });

    const newSheet = XLSX.utils.json_to_sheet(rows, { header: Object.keys(rows[0]) });
    wb.Sheets["Resource List"] = newSheet;
    XLSX.writeFile(wb, WORKBOOK_PATH);

    // Push the change through to the live app immediately - this is the
    // "submit updates ARML too" step, not a separate manual action.
    execFile("node", ["build-data.js"], { cwd: BUILDER_DIR }, async (err, stdout, stderr) => {
      if (err) {
        console.error("Build step failed:", stderr || err.message);
        return res.json({
          message: `"${name}" was saved to the workbook, but rebuilding the app's data failed. Run build-data.js manually in ARM-Builder to finish.`,
          buildError: stderr || err.message
        });
      }

      // Standard files every build regenerates, plus any PDFs uploaded in
      // THIS request. Everything else in Assets/ (older PDFs) is already
      // sitting in the repo from a previous publish and doesn't need
      // re-pushing every time - only what actually changed.
      const filesToPublish = [
        "data.js",
        "version.json",
        "assets-manifest.json",
        "service-worker.js",
        ...(req.files || []).map(f => `Assets/${f.filename}`)
      ];

      let publishResult;
      try {
        publishResult = await publisher.publish(ROOT, filesToPublish, `Add resource: ${name}`);
      } catch (publishErr) {
        // publish() is designed to never throw (failures land in .failed
        // instead) - this catch is a last-resort safety net so a bug in
        // the publish path can't take down a save that already succeeded.
        publishResult = { attempted: true, pushed: [], failed: [{ path: "(all)", error: String(publishErr) }] };
      }

      let message = `"${name}" saved and pushed to ARML. Reload the app to see it.`;
      if (publishResult.attempted && publishResult.failed.length === 0) {
        message += ` Published to GitHub (${publishResult.pushed.length} file${publishResult.pushed.length === 1 ? "" : "s"}).`;
      } else if (publishResult.attempted && publishResult.failed.length > 0) {
        message += ` GitHub publish had ${publishResult.failed.length} problem(s) - see details below. The local build is fine either way.`;
      }
      // If publishing is simply disabled, say nothing extra - that's the
      // normal, expected state for anyone still on local-only deployment.

      res.json({ message, publish: publishResult });
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save resource: " + err.message });
  }
});

function toArray(v) {
  if (v === undefined || v === null || v === "") return [];
  return Array.isArray(v) ? v : [v];
}

// GET /publish-status - lets the form show whether GitHub publishing is
// even configured, without ever exposing the token itself to the browser.
app.get("/publish-status", (req, res) => {
  try {
    const config = publisher.loadConfig().github;
    res.json({
      enabled: config.enabled,
      configured: Boolean(config.owner && config.repo && config.token),
      owner: config.owner,
      repo: config.repo,
      branch: config.branch
      // token deliberately omitted
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /publish - manual retry. Re-pushes the CURRENT on-disk build output
// without touching the workbook or re-running build-data.js. Exists for
// exactly the case where /add's automatic publish failed (network blip,
// City firewall, expired token) but the local save and build already
// succeeded - you shouldn't have to re-add the resource to try again.
app.post("/publish", async (req, res) => {
  try {
    const filesToPublish = ["data.js", "version.json", "assets-manifest.json", "service-worker.js"];
    const result = await publisher.publish(ROOT, filesToPublish, "Manual republish");
    res.json({ publish: result });
  } catch (err) {
    res.status(500).json({ error: "Publish failed: " + err.message });
  }
});

// POST /export-bundle - the sneakernet fallback (design doc Path C) for
// when GitHub is unreachable entirely - a blocked network, a dead token
// nobody's noticed, whatever. Zips the current app folder so it can be
// hand-carried, emailed, or dropped in a shared folder and unzipped over
// the old copy on any device.
app.post("/export-bundle", (req, res) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const zipName = `ARML-bundle-${timestamp}.zip`;
  const zipPath = path.join(ROOT, zipName);

  // PowerShell's Compress-Archive ships with every Windows 10/11 machine -
  // no new dependency, nothing extra for the .bat to install. If it's
  // ever missing (extremely old Windows, or PowerShell itself locked down
  // by policy) the error message says so instead of failing silently.
  const psCommand =
    `Compress-Archive -Path '${ROOT}\\*' -DestinationPath '${zipPath}' -Force ` +
    `-CompressionLevel Optimal`;

  execFile(
    "powershell.exe",
    ["-NoProfile", "-NonInteractive", "-Command", psCommand],
    { cwd: ROOT, timeout: 120000 },
    (err, stdout, stderr) => {
      if (err) {
        return res.status(500).json({
          error:
            "Could not create the zip bundle: " +
            (stderr || err.message) +
            ". If PowerShell is blocked on this machine, zip the ARML v2.7.0 folder manually instead."
        });
      }
      res.json({ message: `Bundle created: ${zipName}`, filename: zipName });
    }
  );
});

// Multer errors (bad file type, too large) land here instead of crashing.
app.use((err, req, res, next) => {
  if (err) return res.status(400).json({ error: err.message });
  next();
});

app.listen(3000, () => {
  console.log("ARML Add-Resource Tool running at http://localhost:3000");
});
