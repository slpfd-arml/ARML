/* ============================================================
   detect-fillable.js

   Scans /Assets and reports which PDFs contain real fillable form
   fields (AcroForm). Run as a separate process by build-data.js and
   returns its answer as JSON on stdout.

   Why a separate script rather than inline in build-data.js:
   pdf-lib's API is asynchronous, and build-data.js is written as a
   straight-through synchronous script. Rather than restructure the
   entire build around one async lookup, this runs as a synchronous
   child process - build-data.js gets its answer immediately and stays
   simple.

   Why detect this at all instead of tagging files by hand: fillable
   forms need to open in a real PDF app (Safari renders form fields as
   a flat image), while reference PDFs are better read in-app. Deciding
   that automatically means nobody has to remember to tag a new form
   when they add one through ARML Editor - it just works.

   Detection is deliberately based on actually parsing the document and
   counting form fields, NOT on scanning the raw bytes for "/AcroForm".
   Byte-scanning was tried first and got 5 of 63 files wrong in both
   directions: some PDFs declare an AcroForm dictionary with no usable
   fields, and others keep their field definitions inside compressed
   object streams where a plain text search can't see them.
   ============================================================ */

const fs = require("fs");
const path = require("path");

const ASSETS_DIR = path.join(__dirname, "..", "Assets");

async function main() {
  let PDFDocument;
  try {
    ({ PDFDocument } = require("pdf-lib"));
  } catch (err) {
    // pdf-lib not installed - report that clearly rather than silently
    // treating every form as non-fillable, which would quietly send
    // fillable PDFs to the in-app viewer where they can't be filled in.
    process.stdout.write(JSON.stringify({ available: false, fillable: [] }));
    return;
  }

  const files = [];
  (function walk(dir) {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (/\.pdf$/i.test(entry.name)) files.push(full);
    }
  })(ASSETS_DIR);

  const fillable = [];
  for (const file of files) {
    try {
      const doc = await PDFDocument.load(fs.readFileSync(file), {
        ignoreEncryption: true,
        updateMetadata: false
      });
      if (doc.getForm().getFields().length > 0) {
        fillable.push(path.basename(file));
      }
    } catch (err) {
      // An unreadable/corrupt PDF isn't fatal to the build - it just
      // doesn't get flagged as fillable.
    }
  }

  process.stdout.write(JSON.stringify({ available: true, fillable }));
}

main();
