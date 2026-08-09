/* ============================================================
   detect-ccitt-images.js

   Scans /Assets and reports every PDF containing a CCITTFaxDecode
   (Group 3/4 fax) encoded image. Run as a separate process by
   build-data.js and returns its answer as JSON on stdout - same
   pattern as detect-fillable.js, for the same reason (pdf-lib's
   relevant APIs are synchronous enough here that async isn't the
   constraint; consistency with the existing script is).

   WHY THIS EXISTS:
   pdf.js - the library ARML's in-app PDF viewer is built on - has a
   long-documented, still-unfixed rendering bug with this specific
   image codec: affected pages render as a barely-visible, washed-out
   ghost of the real content. It's not a bug in the PDF files
   themselves (independently verified: the same image data decodes
   and renders perfectly via other tools) - it's specific to how
   pdf.js composites this one codec.

   31 of ARML's original resources shipped with this codec (most
   scanned paper documents export this way by default) and were
   individually converted to a codec pdf.js has no known issues with -
   same pixels, different compression, see build-data.js's own
   shellFiles comment for the parallel vendor/pdfjs note. That was a
   one-time manual fix. This script is what stops it from being a
   recurring one: it runs on every build, forever, so a scanned
   document added six months from now that happens to export as CCITT
   gets caught before it ships silently broken, the same way this
   exact bug already reached production invisibly - twice - before
   anyone noticed the pattern.

   Deliberately a DETECTOR, not an auto-fixer: reliably decoding CCITT
   G4 in Node specifically requires either a real decoder library
   (none exist as a maintained npm package - checked) or a second
   language runtime (Python's Pillow/pikepdf, which is what actually
   performed the original 31-file conversion) - either a fragile
   dependency or a second toolchain this project's README explicitly
   promises maintainers they won't need. Detecting the problem needs
   only pdf-lib's structural parsing (already a dependency, already
   proven reliable for this in the original fix), which reads a
   stream's /Filter name without ever needing to decode the image
   data. A loud, unmissable build warning that says "this one file
   needs a one-time fix" is a better trade than a silent dependency
   nobody maintains.
   ============================================================ */

const fs = require("fs");
const path = require("path");

const ASSETS_DIR = path.join(__dirname, "..", "Assets");

async function main() {
  let PDFDocument, PDFName;
  try {
    ({ PDFDocument, PDFName } = require("pdf-lib"));
  } catch (err) {
    // pdf-lib not installed - report that clearly rather than silently
    // saying "nothing found", which would be worse than not checking at
    // all (a false "all clear" is more dangerous than an honest "I
    // couldn't check").
    process.stdout.write(JSON.stringify({ available: false, offenders: [] }));
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

  const offenders = [];
  for (const file of files) {
    try {
      const doc = await PDFDocument.load(fs.readFileSync(file), {
        ignoreEncryption: true,
        updateMetadata: false
      });
      const pages = doc.getPages();
      const hitPages = [];

      for (let i = 0; i < pages.length; i++) {
        const resources = pages[i].node.Resources();
        const xobjectsDict = resources?.lookup(PDFName.of("XObject"));
        if (!xobjectsDict) continue;

        for (const key of xobjectsDict.keys()) {
          const xobj = xobjectsDict.lookup(key);
          const filter = xobj?.dict?.get(PDFName.of("Filter"));
          if (!filter) continue;
          // Filter can be a single Name or an array of Names (chained
          // filters) - stringify covers both without needing to know
          // which shape pdf-lib handed back.
          if (filter.toString().includes("CCITTFaxDecode")) {
            hitPages.push(i + 1);
            break; // one hit is enough to flag the page
          }
        }
      }

      if (hitPages.length > 0) {
        offenders.push({ file: path.basename(file), pages: hitPages });
      }
    } catch (err) {
      // An unreadable/corrupt PDF isn't this script's problem to solve -
      // it just can't be checked, which is different from "checked and
      // clean". Silently skipped, same as detect-fillable.js's convention.
    }
  }

  process.stdout.write(JSON.stringify({ available: true, offenders }));
}

main();
