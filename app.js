const searchInput = document.getElementById("searchInput");
const resourceItems = document.getElementById("resourceItems");
const detailContent = document.getElementById("detailContent");
const detailPane = document.querySelector(".resource-detail");
const detailCloseBtn = document.getElementById("detailCloseBtn");
const resourceListPane = document.getElementById("resourceListPane");
const listBackBar = document.getElementById("listBackBar");
const backBtn = document.getElementById("backBtn");
const listBackLabel = document.getElementById("listBackLabel");
const allResourcesRow = document.getElementById("allResourcesRow");
const toolsBtn = document.getElementById("toolsBtn");
const insuranceBtn = document.getElementById("insuranceBtn");
const roiBtn = document.getElementById("roiBtn");

/* HELPERS */
function formatPhone(raw) {
  if (!raw) return "";
  const digits = String(raw).replace(/\D/g, "");
  if (digits.length === 10) {
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length === 11 && digits[0] === "1") {
    return `(${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return String(raw); // not a clean 10-digit number — show as typed rather than mangle it
}

function telHref(raw) {
  const digits = String(raw || "").replace(/\D/g, "");
  return digits ? `tel:${digits}` : "";
}

// Small self-contained outline icons (no external font/CDN - has to work offline).
// currentColor + inline-flex wrapper so CSS `color` controls the icon color.
const ICON_SVG = {
  phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"/>',
  mail: '<path d="M2 6h20v12H2z"/><path d="M22 6l-10 7L2 6"/>',
  globe: '<circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20 15 15 0 0 1 0-20"/>',
  pin: '<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0z"/><circle cx="12" cy="10" r="3"/>',
  "house-search": '<path d="M4 11.5L12 4l8 7.5"/><path d="M6 10v9a1 1 0 0 0 1 1h3v-5h4v3.3"/><circle cx="17" cy="17" r="3.2"/><path d="M19.3 19.3L22 22"/>',
  clipboard: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1H9z"/><path d="M9 12l2 2 4-4"/>',
  "doc-sign": '<path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/><path d="M9 15l6-6 2 2-6 6H9v-2z"/>',
  "id-card": '<rect x="2" y="5" width="20" height="14" rx="2"/><circle cx="8" cy="12" r="2"/><path d="M14 10h6M14 14h4"/>',
  heart: '<path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0 1 12 6a5.5 5.5 0 0 1 9.5 6c-2.5 4.5-9.5 9-9.5 9z"/>'
};

function icon(name, size) {
  size = size || 13;
  return `<svg class="icon-${name}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON_SVG[name]}</svg>`;
}

// Same heart path for both states - only the fill toggles. This is deliberate:
// using two different characters/glyphs for outline vs filled (like Unicode
// ♥/♡) renders as two genuinely different shapes depending on font, which is
// exactly the mismatch this replaced.
function heartIcon(filled) {
  return `<svg width="28" height="28" viewBox="0 0 24 24" fill="${filled ? "currentColor" : "none"}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICON_SVG.heart}</svg>`;
}

// Resolves a site-relative path (e.g. "Assets/foo.pdf") against the page's
// actual current location. More reliable than a bare relative href when the
// app is opened as a local file, synced through OneDrive, or opened on iPad.
function toFileUrl(relPath) {
  const base = window.location.href.replace(/index\.html$/, "");
  // Encode each path segment individually (not the whole string, which
  // would wrongly escape the "/" separators) - several real filenames in
  // Assets have literal spaces (e.g. "VHA Form 10-5345a Fill-revision.pdf",
  // "Mayo _ROI_Form.pdf"). Browsers often tolerate a raw space in a URL by
  // silently encoding it themselves, but that tolerance isn't guaranteed
  // across every code path that touches this string (an <a href>, a plain
  // fetch(), and a URL handed into a Worker via postMessage don't all
  // necessarily parse it the same way) - encoding it properly up front
  // removes the ambiguity instead of relying on lenient-parser luck.
  const cleanPath = relPath.replace(/^\/*/, "");
  const encodedPath = cleanPath.split("/").map(encodeURIComponent).join("/");
  return base + encodedPath;
}

// navigator.standalone is iOS-only and true only when the app was launched
// from a home-screen icon (not a normal Safari tab). This matters because
// target="_blank" is silently ignored in that mode - there's no browser
// chrome to open a "new tab" into, so a PDF link just navigates the app's
// own view away from itself, with no back button and no address bar to
// recover with. Regular Safari tabs and desktop/Android browsers are
// unaffected and keep the normal new-tab behavior.
// iPadOS 13+ reports itself as "MacIntel" in userAgent, so a plain
// /iPad/ test misses modern iPads entirely - the maxTouchPoints check is
// what actually catches them.
const IS_IOS = typeof navigator !== "undefined" && (
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1)
);

/* ============================================================
   OPENING PDFs
   ------------------------------------------------------------
   Every PDF - fillable or not - now opens in the same in-app,
   scrollable viewer. Two things used to force fillables out to a
   separate app entirely: (1) Safari's own PDF rendering can't
   scroll past page 1 inside an iframe on iOS, and (2) it can't
   fill in AcroForm fields at all. Rendering pages to canvas with
   pdf.js fixes (1) for every PDF, and pdf.js's own AnnotationLayer
   (reading the same AcroForm data) fixes (2) - so there's no
   longer a reason to hand anyone off to a different app just to
   fill out a form. This was verified against all 13 of ARML's
   actual fillable PDFs (plain AcroForms and the one XFA-hybrid VA
   form alike) before being wired in here: field detection, fill,
   save, and visual layout all confirmed correct with this exact
   vendored pdfjs-dist build.

   Non-fillable PDFs (screening tools, flyers) still get a "Share"
   button - not to fill anything, just to hand a copy of the
   as-is reference file to Files/Mail/print if someone wants one
   outside the app.
   ============================================================ */

// pdf.js is loaded once, lazily, the first time any PDF is opened -
// there's no reason to pay its parse/init cost on every launch when a
// lot of sessions never open a PDF at all.
let pdfjsLibPromise = null;
function loadPdfjs() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import(toFileUrl("vendor/pdfjs/pdf.mjs")).then(lib => {
      lib.GlobalWorkerOptions.workerSrc = toFileUrl("vendor/pdfjs/pdf.worker.mjs");
      return lib;
    });
  }
  return pdfjsLibPromise;
}

function slugifyLabel(label) {
  return (label || "document").replace(/[^\w\-. ]+/g, "").trim() || "document";
}

function todayStamp() {
  const d = new Date();
  const pad = n => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// Hands a file to the OS share sheet. Accepts either a URL to fetch
// (reference PDFs, shared as-is) or an already-in-memory Blob (a just-
// filled form - there's no reason to write it to a temp URL and fetch it
// straight back). Returns false if sharing isn't possible, so the caller
// can fall back to a plain download.
async function shareFileToSystem({ url, blob, filename, label }) {
  if (!(navigator.canShare && navigator.share)) return false;

  try {
    let fileBlob = blob;
    if (!fileBlob) {
      const res = await fetch(url);
      if (!res.ok) return false;
      fileBlob = await res.blob();
    }
    const file = new File([fileBlob], filename || `${slugifyLabel(label)}.pdf`, { type: "application/pdf" });

    if (!navigator.canShare({ files: [file] })) return false;
    await navigator.share({ files: [file], title: label || "Document" });
    return true;
  } catch (err) {
    // AbortError just means the person dismissed the share sheet - that's
    // a completed interaction, not a failure to fall back from.
    if (err && err.name === "AbortError") return true;
    return false;
  }
}

// Last-resort path when neither a native save-location picker nor
// sharing is available: a normal download attempt. Works everywhere, but
// always drops straight into the browser's default downloads folder with
// no chance to choose - only reached when nothing better is available.
// On iOS this is also the path with the known preview-trap problem (see
// the Web Share comment above).
function triggerDownload({ url, blob, filename, label }) {
  const objectUrl = blob ? URL.createObjectURL(blob) : null;
  const a = document.createElement("a");
  a.href = objectUrl || url;
  a.download = filename || `${slugifyLabel(label)}.pdf`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  if (objectUrl) setTimeout(() => URL.revokeObjectURL(objectUrl), 30000);
}

// Desktop Chrome/Edge (and any other browser implementing the File
// System Access API) can prompt an actual native "Save As" dialog - the
// one thing plain <a download> can never do, since that always drops
// straight into the browser's fixed downloads folder with zero choice.
// Returns false (never throws) if the API isn't available or the person
// cancels, so the caller can fall back cleanly either way. Deliberately
// called as the very FIRST thing on the click path that reaches it,
// before any slower work like fetching a reference PDF's bytes - Chrome
// requires this call to happen inside a live user gesture, and an await
// for a network fetch beforehand risks that gesture having expired by
// the time this runs.
async function trySaveFilePicker({ url, blob, filename, label }) {
  if (typeof window.showSaveFilePicker !== "function") return false;

  let handle;
  try {
    handle = await window.showSaveFilePicker({
      suggestedName: filename || `${slugifyLabel(label)}.pdf`,
      types: [{ description: "PDF document", accept: { "application/pdf": [".pdf"] } }]
    });
  } catch (err) {
    // AbortError = person cancelled the picker - that's a completed
    // interaction, not a failure to fall back from (same convention as
    // shareFileToSystem's AbortError handling below).
    return err && err.name === "AbortError" ? true : false;
  }

  try {
    const fileBlob = blob || await (await fetch(url)).blob();
    const writable = await handle.createWritable();
    await writable.write(fileBlob);
    await writable.close();
    return true;
  } catch (err) {
    return false;
  }
}

/* ONE-TIME SAVE-LOCATION NUDGE
   iOS gives a PWA no way to create or write into a specific Files-app
   folder on its own - Safari only exposes a private, sandboxed storage
   area the Files app can't see (confirmed: showDirectoryPicker /
   showSaveFilePicker are Chrome/Edge-only, not in Safari at all). The
   most ARML can do is put a recommendation in front of someone right
   before the share sheet opens, when picking a destination is the very
   next thing they'll do - and only ever once, not on every save, so it
   doesn't turn into a nag. */
const SAVE_NUDGE_KEY = "armlSaveNudgeShown";
const saveNudgeModal = document.getElementById("saveNudgeModal");
const saveNudgeContinue = document.getElementById("saveNudgeContinue");

function maybeShowSaveNudge() {
  let alreadyShown = false;
  try {
    alreadyShown = localStorage.getItem(SAVE_NUDGE_KEY) === "1";
  } catch (e) { /* storage unavailable - fall through and show it this session */ }

  if (alreadyShown) return Promise.resolve();

  return new Promise(resolve => {
    saveNudgeModal.classList.add("open");
    const onContinue = () => {
      saveNudgeModal.classList.remove("open");
      saveNudgeContinue.removeEventListener("click", onContinue);
      try { localStorage.setItem(SAVE_NUDGE_KEY, "1"); } catch (e) { /* not fatal - it'll just show again next save */ }
      resolve();
    };
    saveNudgeContinue.addEventListener("click", onContinue);
  });
}

async function handOffFile(fileSource) {
  if (IS_IOS) {
    const shared = await shareFileToSystem(fileSource);
    if (shared) return;
  } else {
    // Desktop: prefer a real "Save As" dialog over a silent drop into
    // Downloads with no say in where it lands - see trySaveFilePicker's
    // own comment for why this has to be tried before anything else here.
    const saved = await trySaveFilePicker(fileSource);
    if (saved) return;
  }
  triggerDownload(fileSource);
}

function escapeAttr(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// Emits the attributes for a PDF link. The actual behavior is attached by
// the single delegated listener below rather than per-link, so every
// render site (resource files, screening tools, ROI forms, sub-contacts)
// is guaranteed to behave identically - there's only one code path to get
// right, and no way for one call site to drift from the others.
//
// href is kept real (not "#") on purpose: long-press "Copy Link", middle-
// click, and open-in-new-tab all still do something sensible, and if
// JavaScript ever fails to load the link degrades to a plain PDF link
// instead of doing nothing at all.
function fileLinkAttrs(url, label, isFillable) {
  return `href="${escapeAttr(url)}" data-arml-file="1" data-arml-fillable="${isFillable ? "1" : "0"}" data-arml-label="${escapeAttr(label)}"`;
}

document.addEventListener("click", e => {
  const link = e.target.closest ? e.target.closest("[data-arml-file]") : null;
  if (!link) return;

  // Let modified clicks (new tab, download, etc.) behave natively.
  if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;

  e.preventDefault();
  const url = link.getAttribute("href");
  const label = link.getAttribute("data-arml-label") || "Document";
  const isFillable = link.getAttribute("data-arml-fillable") === "1";

  openPdfViewer(url, label, isFillable);
});

// Formats "123 Main St, Anytown, MN 55555" as two lines (street / city-state-zip),
// wrapped in a clickable Apple Maps link. Handles multiple semicolon-separated
// locations, trailing parenthetical notes, and addresses missing the comma
// before the city. Falls back to showing the address as-is, still linked, if
// it doesn't match a recognizable "...CITY, ST ZIP" pattern at all.
//
// The pin icon and the two text lines are separate flex items now (icon in
// its own column, both lines sharing one text column next to it) rather than
// the icon just being inline-prefixed onto the street line. That inline
// version was the actual cause of the street/city misalignment bug: the icon
// only pushed the FIRST line over, so the street line started further right
// than the city/state/zip line beneath it, leaving them visibly unaligned
// instead of stacked like a normal two-line address block.
function formatAddress(raw, plain) {
  if (!raw) return "";

  function wrap(linesHtml, mapsUrl) {
    const body = `${icon("pin")}<span class="address-lines">${linesHtml}</span>`;
    // plain: a mailing address, not a physical location someone would ever
    // navigate to - no tap-to-open-Maps link. Still gets the pin icon
    // (visual consistency with every other address in the app), just not
    // wrapped in an <a>. Used for ROI Contacts, where every address is
    // "where to fax/mail a records request," not "where to walk in."
    return plain
      ? `<span class="address-block">${body}</span>`
      : `<a class="address-block" href="${mapsUrl}" target="_blank">${body}</a>`;
  }

  function parseOne(segment) {
    const addr = segment.replace(/\s+/g, " ").trim();
    const m = addr.match(/^(.*?),?\s*([A-Z]{2})\s+(\d{5}(?:-\d{4})?)\s*(\([^)]*\))?$/);
    const mapsUrl = `https://maps.apple.com/?q=${encodeURIComponent(addr)}`;
    if (!m) {
      return wrap(addr, mapsUrl);
    }
    let rest = m[1].replace(/,\s*$/, "");
    const lastComma = rest.lastIndexOf(",");
    let street, city;
    if (lastComma !== -1) {
      street = rest.slice(0, lastComma).trim();
      city = rest.slice(lastComma + 1).trim();
    } else {
      const words = rest.split(/\s+/);
      city = words.pop();
      street = words.join(" ");
    }
    const note = m[4] ? ` ${m[4]}` : "";
    return wrap(`${street}<br>${city}, ${m[2]} ${m[3]}${note}`, mapsUrl);
  }

  return String(raw).split(";").map(s => s.trim()).filter(Boolean).map(parseOne).join("<br><br>");
}

// "Tuesday 1:00 PM–4:00 PM; Wednesday–Thursday 9:00 AM–12:00 PM and 1:00 PM–4:00 PM"
// -> one line per semicolon-separated day-group, with "and" between two time
// ranges (only when it sits between an AM/PM marker and a digit, so it doesn't
// touch "Saturday, Sunday, and holidays"-style day lists) turned into a comma.
// Text wrapped in [[expire:YYYY-MM-DD]]...[[/expire]] is automatically
// removed once the current date reaches that date - no rebuild needed,
// no manual cleanup required later. Meant for genuinely time-sensitive
// notes (a seasonal program's current-cycle dates, a temporary closure)
// that would otherwise linger as stale, misleading clutter long after
// they stop being true. Whoever edits the workbook wraps the sentence
// that should self-delete; everything else is untouched either way.
// `now` is an optional override purely for testing - production calls
// never pass it, so it always defaults to the real current date.
function stripExpiredText(raw, now) {
  if (!raw) return raw;
  now = now || new Date();
  return raw
    .replace(/\[\[expire:(\d{4}-\d{2}-\d{2})\]\]([\s\S]*?)\[\[\/expire\]\]/g, (match, dateStr, inner) => {
      const expiry = new Date(dateStr + "T00:00:00");
      return now >= expiry ? "" : inner;
    })
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function formatHours(raw) {
  if (!raw) return "";
  return String(raw)
    .split(/[;\r\n]+/)
    .map(s => s.trim())
    .filter(Boolean)
    .map(s => s.replace(/(AM|PM)\s+and\s+(\d)/gi, "$1, $2"))
    .join("<br>");
}

/* FAVORITES — persisted in localStorage, keyed by resource name */
const FAVORITES_KEY = "armLibraryFavorites";

function getFavorites() {
  try {
    const raw = localStorage.getItem(FAVORITES_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch (e) {
    return [];
  }
}

function isFavorite(name) {
  return getFavorites().includes(name);
}

function toggleFavorite(name) {
  const favs = getFavorites();
  const idx = favs.indexOf(name);
  if (idx === -1) {
    favs.push(name);
  } else {
    favs.splice(idx, 1);
  }
  try {
    localStorage.setItem(FAVORITES_KEY, JSON.stringify(favs));
  } catch (e) {
    // storage unavailable (private browsing, quota, etc.) - favoriting just won't persist
  }
  return favs.includes(name);
}

/* CATEGORY LIST / RESOURCE LIST TOGGLE — the left pane shares one space
   between browsing categories (red) and viewing a resource list (grey),
   instead of a separate chip bar competing for space with the list. */
function showCategoryList() {
  resourceListPane.classList.add("category-mode");
  listBackBar.classList.remove("visible");
  allResourcesRow.hidden = false;
  searchInput.value = "";

  const categories = ARM_DATA.categories || [];
  resourceItems.innerHTML = "";

  categories.forEach(cat => {
    const count = ARM_DATA.resources.filter(r => (r.categories || []).includes(cat)).length;
    const row = document.createElement("li");
    row.className = "category-row";
    row.innerHTML = `<span>${cat}</span><span><span class="cat-count">${count}</span><span class="chev">›</span></span>`;
    row.addEventListener("click", () => {
      const filtered = ARM_DATA.resources.filter(r => (r.categories || []).includes(cat));
      showResourceList(filtered, cat);
    });
    resourceItems.appendChild(row);
  });
}

function showResourceList(list, label) {
  resourceListPane.classList.remove("category-mode");
  listBackBar.classList.add("visible");
  allResourcesRow.hidden = true;
  listBackLabel.textContent = label;
  renderResources(list);
}

backBtn.addEventListener("click", () => {
  showCategoryList();
});

allResourcesRow.addEventListener("click", () => {
  showResourceList(ARM_DATA.resources, "All resources");
});

// Slides the detail pane back out on iPhone (see the max-width:500px
// slide-over rules in style.css). No effect above that breakpoint - the
// list is already visible there, there's nothing to "go back" to.
detailCloseBtn.addEventListener("click", () => {
  detailPane.classList.remove("detail-active");
});

/* UNIFIED RESOURCE RENDERER — always alphabetical */
function renderResources(list) {
  resourceItems.innerHTML = "";

  const sorted = [...list].sort((a, b) => a.name.localeCompare(b.name));

  sorted.forEach(r => {
    const li = document.createElement("li");
    li.className = "resource-row";
    li.innerHTML = `<span>${r.name}</span><span class="chev">›</span>`;

    li.addEventListener("click", () => {
      document.querySelectorAll("#resourceItems li").forEach(item => {
        item.classList.remove("selected");
      });
      li.classList.add("selected");
      showDetail(r);
      // No-op above the iPhone slide-over breakpoint (max-width:500px) -
      // .detail-active only has any visual effect inside that media
      // query, so toggling it unconditionally here is safe at every
      // screen size rather than needing a matchMedia check that could
      // get out of sync on resize/rotation.
      detailPane.classList.add("detail-active");
    });

    resourceItems.appendChild(li);
  });
}

/* DETAIL PANEL */
function showDetail(resource) {
  const favActive = isFavorite(resource.name);
  detailContent.innerHTML = `
    <div class="detail-heading-row">
      <h2>${resource.name}</h2>
      <button class="fav-heart${favActive ? " active" : ""}" id="favHeartBtn" aria-label="Toggle favorite" aria-pressed="${favActive}">${heartIcon(favActive)}</button>
    </div>
    ${resource.parent ? `<div class="detail-parent">${resource.parent}</div>` : ""}
    ${resource.type ? `<div class="detail-type">${resource.type}</div>` : ""}
    ${(resource.phone || resource.website) ? `
      <div class="detail-actions">
        ${resource.phone ? `<a class="detail-action-btn primary" href="${telHref(resource.phone)}">${icon("phone")} Call</a>` : ""}
        ${resource.website ? `<a class="detail-action-btn" href="${resource.website}" target="_blank">${icon("globe")} Website</a>` : ""}
      </div>
    ` : ""}
    ${section("Overview", resource.services)}
    ${section("Contact", contactBlock(resource))}
    ${section("Related Contacts", subContactsBlock(resource))}
    ${section("Files & External Links", fileBlock(resource))}
    ${section("Notes", resource.notes)}
  `;

  document.getElementById("favHeartBtn").addEventListener("click", () => {
    const nowActive = toggleFavorite(resource.name);
    const heart = document.getElementById("favHeartBtn");
    heart.innerHTML = heartIcon(nowActive);
    heart.classList.toggle("active", nowActive);
    heart.setAttribute("aria-pressed", nowActive);
  });
}

function section(title, content) {
  const cleaned = (content || "")
    .replace(/<[^>]*>/g, "")
    .replace(/\s+/g, "")
    .trim();

  if (!cleaned) return "";

  return `
    <div class="detail-section">
      <h3>${title}</h3>
      <div class="detail-section-content">${content}</div>
    </div>
  `;
}

function contactBlock(r, opts) {
  opts = opts || {};
  return `
    ${r.phone ? `<p>${icon("phone")} <a href="${telHref(r.phone)}">${formatPhone(r.phone)}</a></p>` : ""}
    ${r.altPhone ? `<p>${icon("phone")} <strong>Alt:</strong> <a href="${telHref(r.altPhone)}">${formatPhone(r.altPhone)}</a></p>` : ""}
    ${r.fax ? `<p><strong>Fax:</strong> ${formatPhone(r.fax)}</p>` : ""}
    ${r.altFax ? `<p><strong>Alt Fax:</strong> ${formatPhone(r.altFax)}</p>` : ""}
    ${r.tty ? `<p><strong>TTY:</strong> <a href="${telHref(r.tty)}">${formatPhone(r.tty)}</a></p>` : ""}
    ${r.email ? `<p>${icon("mail")} <a href="mailto:${r.email}">${r.email}</a></p>` : ""}
    ${r.address ? `<p>${formatAddress(r.address, opts.plainAddress)}</p>` : ""}
    ${r.hours ? `<p><strong>Hours:</strong><br>${formatHours(r.hours)}</p>` : ""}
  `;
}

/* SUB-CONTACTS — e.g. St. Stephen's individual shelter/program contacts */
function subContactsBlock(r) {
  if (!r.subContacts || !r.subContacts.length) return "";

  return r.subContacts
    .map(c => {
      // Category only in the meta line now - audience/eligibility text
      // moved into Notes, where a full sentence reads better than being
      // crammed into a short subtitle next to the category.
      const meta = c.category || "";

      // A real street address (ends in state+zip) gets the same clickable
      // Apple Maps pin treatment as the main resource card. Free-text
      // location descriptions (e.g. "any of our 3 offices") are shown as
      // plain text instead - wrapping a whole descriptive sentence in a
      // single map link would be misleading, not helpful.
      const looksLikeAddress = c.location && /\d{5}(-\d{4})?\s*(\([^)]*\))?\s*$/.test(c.location);
      const locationHtml = c.location
        ? (looksLikeAddress ? formatAddress(c.location) : `${icon("pin")} ${c.location}`)
        : "";

      const purpose = stripExpiredText(c.purpose);
      const access = stripExpiredText(c.access);
      const notes = stripExpiredText(c.notes);

      return `
        <div class="sub-contact">
          <h4>${c.name}</h4>
          ${meta ? `<p class="sub-contact-meta">${meta}</p>` : ""}
          ${purpose ? `<p>${purpose}</p>` : ""}
          ${c.phone ? `<p>${icon("phone")} <a href="${telHref(c.phone)}">${formatPhone(c.phone)}</a></p>` : ""}
          ${c.fax ? `<p><strong>Fax:</strong> ${formatPhone(c.fax)}</p>` : ""}
          ${c.email ? `<p>${icon("mail")} <a href="mailto:${c.email}">${c.email}</a></p>` : ""}
          ${c.website ? `<p>${icon("globe")} <a href="${c.website}" target="_blank" rel="noopener">Visit Website</a></p>` : ""}
          ${locationHtml ? `<p>${locationHtml}</p>` : ""}
          ${c.hours ? `<p><strong>Hours:</strong><br>${formatHours(c.hours)}</p>` : ""}
          ${access ? `<p><strong>Access:</strong> ${access}</p>` : ""}
          ${notes ? `<p><strong>Notes:</strong> ${notes}</p>` : ""}
        </div>
      `;
    })
    .join("");
}

/* FIXED FILE BLOCK — FRIENDLY NAMES + MULTIPLE FILES + EXTERNAL LINKS */
function fileBlock(r) {
  if (!r.files || !r.files.length) return "";

  return r.files
    .map(file => {
      if (file.url) {
        return `<p>${icon("globe")} <a href="${escapeAttr(file.url)}" target="_blank" rel="noopener">${file.label}</a></p>`;
      }
      return `<p><a ${fileLinkAttrs(toFileUrl(file.path), file.label, file.fillable)}>${file.label}</a></p>`;
    })
    .join("");
}

/* SEARCH — always searches everything, regardless of category/resource state */
searchInput.addEventListener("input", e => {
  const term = e.target.value.toLowerCase().trim();

  if (!term) {
    showCategoryList();
    return;
  }

  const filtered = ARM_DATA.resources.filter(r => {
    const haystack = [r.name, r.keywords, r.services, r.parent]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(term);
  });

  resourceListPane.classList.remove("category-mode");
  listBackBar.classList.add("visible");
  allResourcesRow.hidden = true;
  listBackLabel.textContent = `Search results for "${e.target.value.trim()}"`;
  renderResources(filtered);
});

/* AUTO COLLAPSE KEYBOARD ON SCROLL
   passive:true lets Safari scroll without waiting to see if this handler
   calls preventDefault() - a genuine smoothness win. Only blur when the
   input actually has focus, rather than firing on every scroll tick. */
resourceItems.addEventListener("scroll", () => {
  if (document.activeElement === searchInput) {
    searchInput.blur();
  }
}, { passive: true });

/* SCREENING TOOLS MODAL */
const toolsModal = document.getElementById("toolsModal");
const toolsTableBody = document.getElementById("toolsTableBody");
const closeToolsModal = document.getElementById("closeToolsModal");

toolsBtn.addEventListener("click", () => {
  renderScreeningTools();
  toolsModal.classList.add("open");
});

closeToolsModal.addEventListener("click", () => {
  toolsModal.classList.remove("open");
});

const pdfViewerModal = document.getElementById("pdfViewerModal");
const pdfPagesContainer = document.getElementById("pdfPagesContainer");
const pdfViewerTitle = document.getElementById("pdfViewerTitle");
const closePdfViewerModal = document.getElementById("closePdfViewerModal");
const pdfViewerActionBtn = document.getElementById("pdfViewerActionBtn");

// Tracks whatever's currently open, so the close handler can tear it down
// cleanly and the action button knows which operation to run. loadingTask
// (not just the resolved document) is what actually needs destroying -
// see closePdfViewerModal below.
let currentViewer = { loadingTask: null, pdfDoc: null, label: "", isFillable: false, sourceUrl: "" };

function setPdfViewerStatus(text, isError) {
  pdfPagesContainer.innerHTML = `<p class="pdf-viewer-status${isError ? " error" : ""}">${escapeAttr(text)}</p>`;
}

async function openPdfViewer(url, label, isFillable) {
  pdfViewerTitle.textContent = label || "Document";
  // Always "Save" regardless of whether this file is fillable - a
  // person switching between forms shouldn't have to notice the label
  // changing to know what the button does. The underlying behavior still
  // differs (a fillable form's Save bakes in whatever was typed; a
  // reference PDF's Save just hands off a copy of the file as-is) - only
  // the wording needed to be consistent, not the mechanism.
  pdfViewerActionBtn.textContent = "Save";
  pdfViewerActionBtn.disabled = false;
  currentViewer = { loadingTask: null, pdfDoc: null, label: label || "Document", isFillable: !!isFillable, sourceUrl: url };
  setPdfViewerStatus("Loading…");
  pdfViewerModal.classList.add("open");

  try {
    const pdfjsLib = await loadPdfjs();
    const loadingTask = pdfjsLib.getDocument({
      url,
      // Points at the vendored fallback fonts (see build-data.js's
      // shellFiles comment) - without this, any PDF that doesn't embed
      // its own fonts has no local fallback to fetch, which pdf.js
      // would otherwise try to resolve some other way that assumes
      // network access this app can't rely on.
      standardFontDataUrl: toFileUrl("vendor/pdfjs/standard_fonts/"),
      // Decodes JBIG2/CCITT/JPEG2000-family images via a WASM module -
      // without this, pdf.js has no local fallback to fetch it from and
      // any page using one of those codecs fails to decode instead of
      // silently falling back to something readable.
      wasmUrl: toFileUrl("vendor/pdfjs/wasm/")
    });
    currentViewer.loadingTask = loadingTask;
    const pdfDoc = await loadingTask.promise;

    // A stale close (person tapped the ✕ while this was still loading)
    // must not go on to render into a modal that's no longer open.
    if (currentViewer.loadingTask !== loadingTask) return;
    currentViewer.pdfDoc = pdfDoc;

    pdfPagesContainer.innerHTML = "";

    // Available width computed once (doesn't change while the modal's
    // open), but the actual fit-scale is computed fresh INSIDE
    // renderPdfPage for every individual page - not once here from page
    // 1 alone. Catalogs and multi-page forms routinely mix orientations
    // (a portrait cover page followed by landscape spreads is common,
    // and it's exactly what Liberty Oxygen Catalog does - page 1 is
    // 618pt wide, pages 2+ are ~793pt, nearly 30% wider). A single scale
    // computed from page 1 fit page 1 correctly and then overflowed
    // every landscape page after it - each page needs its own answer to
    // "what scale actually fits MY width," not a value inherited from
    // whatever page happened to load first.
    const availableWidth = Math.max(pdfPagesContainer.clientWidth - 32, 280);

    const fieldObjects = isFillable ? await pdfDoc.getFieldObjects() : null;

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
      if (currentViewer.pdfDoc !== pdfDoc) return; // closed mid-render
      await renderPdfPage(pdfjsLib, pdfDoc, pageNum, availableWidth, isFillable, fieldObjects);
    }
  } catch (err) {
    // Swallowing the real error here would make this nearly impossible to
    // debug from a bug report alone - always log the actual thing that
    // went wrong, then give the best explanation available in the UI
    // itself. The single most common cause during local testing: Chrome
    // (and Chromium browsers generally) refuse to construct a Worker at
    // all from a file:// page - "cannot be accessed from origin 'null'" -
    // and pdf.js can't do anything without its worker. That's a browser
    // security rule, not something fixable in ARML's own code; the real
    // fix is testing over http(s) (a local server) instead of opening
    // index.html directly. IS_FILE_PROTOCOL already exists for exactly
    // this class of problem elsewhere in the app.
    console.error("PDF viewer failed to load:", err);
    if (IS_FILE_PROTOCOL) {
      setPdfViewerStatus(
        "PDFs can't open like this. Chrome (and most browsers) block the background worker pdf.js needs when a page is opened directly as a file:// URL. Serve this folder over a local server instead - e.g. run `python3 -m http.server` in this folder, then open http://localhost:8000 - and it'll work the same way it will once this is actually hosted on GitHub Pages.",
        true
      );
    } else {
      setPdfViewerStatus(`Couldn't load this document (${err && err.message ? err.message : "unknown error"}). Close and try again.`, true);
    }
  }
}

// Renders one page: canvas for the page art, plus (fillable PDFs only) a
// pdf.js AnnotationLayer on top turning form fields into real inputs.
// Minimal linkService shim for pdf.js's AnnotationLayer.
// pdf.js's own LinkAnnotationElement calls methods on this object with NO
// null-check at all (confirmed by reading the vendored source directly)
// - any PDF whose fields include a button or an internal link (a "Reset
// Form" button, "next page" action, a real https:// hyperlink...) calls
// straight into it. Omitting this entirely - which the first version of
// this integration did - crashes with "Cannot read properties of null
// (reading 'getAnchorUrl')" the moment such a field exists, which is why
// it only ever showed up on some ROI forms and not others: it's entirely
// dependent on whether that specific PDF happens to contain one of these
// field types, not something a few spot-checked test files would surface.
// This is deliberately NOT pdf.js's own SimpleLinkService/PDFLinkService
// (exported from the much larger web/pdf_viewer.mjs, which this build
// doesn't vendor) - just the handful of methods LinkAnnotationElement
// actually calls, with safe behavior for each:
//   - real external URLs (addLinkAttributes) open in a new tab, same as
//     any other link leaving the app
//   - everything else (internal destinations, named actions like
//     next/prev page, OCG visibility, JS actions) safely no-ops rather
//     than crashing - ARML's viewer doesn't support in-document
//     navigation between pages via link-click yet, so "does nothing" is
//     the correct, honest behavior until that's built, not a bug
const pdfLinkServiceShim = {
  getDestinationHash() { return "#"; },
  getAnchorUrl() { return "#"; },
  goToDestination() { /* no in-document navigation yet - see comment above */ },
  executeNamedAction() { /* next/prev/first/last page etc. - no-op for now */ },
  executeSetOCGState() { /* optional content visibility - no-op */ },
  addLinkAttributes(link, url, newWindow) {
    link.href = url;
    link.target = newWindow === false ? "_self" : "_blank";
    link.rel = "noopener noreferrer";
  },
  async getAttachmentContent() { return null; }
};

async function renderPdfPage(pdfjsLib, pdfDoc, pageNum, availableWidth, isFillable, fieldObjects) {
  const page = await pdfDoc.getPage(pageNum);

  // Computed fresh per page, from THIS page's own natural width - not
  // inherited from whatever page happened to load first (see the caller's
  // comment for why that was the actual bug). No lower bound on the
  // shrink side: a page that's genuinely oversized should be allowed to
  // shrink as far as it needs to fit, which is the entire point of "shrink
  // to fit" - only the upper bound stays, so a small page doesn't get
  // blown up to something unreasonably large.
  const unscaledWidth = page.getViewport({ scale: 1 }).width;
  const scale = Math.min(availableWidth / unscaledWidth, 2.5);
  const viewport = page.getViewport({ scale });

  const wrap = document.createElement("div");
  wrap.className = "pdf-page-wrap";
  wrap.style.width = `${viewport.width}px`;
  wrap.style.height = `${viewport.height}px`;

  // Matches pdf.js's own `.pdfViewer .page` convention (see
  // vendor/pdfjs/annotation-layer.css's header comment) - the annotation
  // CSS's field font-sizing/comb-width math depends on these existing
  // somewhere in this element's ancestry.
  wrap.style.setProperty("--scale-factor", String(viewport.scale));
  wrap.style.setProperty("--user-unit", "1");
  wrap.style.setProperty("--total-scale-factor", "calc(var(--scale-factor) * var(--user-unit))");
  wrap.style.setProperty("--scale-round-x", "1px");
  wrap.style.setProperty("--scale-round-y", "1px");

  const canvas = document.createElement("canvas");
  const outputScale = window.devicePixelRatio || 1;
  canvas.width = Math.floor(viewport.width * outputScale);
  canvas.height = Math.floor(viewport.height * outputScale);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  wrap.appendChild(canvas);

  const ctx = canvas.getContext("2d");
  const transform = outputScale !== 1 ? [outputScale, 0, 0, outputScale, 0, 0] : null;
  await page.render({ canvasContext: ctx, viewport, transform }).promise;

  if (isFillable) {
    const annotations = await page.getAnnotations({ intent: "display" });
    const annotationLayerDiv = document.createElement("div");
    annotationLayerDiv.className = "annotationLayer";
    wrap.appendChild(annotationLayerDiv);

    const annotationLayer = new pdfjsLib.AnnotationLayer({
      div: annotationLayerDiv,
      page,
      viewport: viewport.clone({ dontFlip: true }),
      annotationStorage: currentViewer.pdfDoc.annotationStorage,
      linkService: pdfLinkServiceShim
    });
    await annotationLayer.render({ annotations, renderForms: true, fieldObjects });

    // pdf.js sizes this div itself using the CSS round() function, which
    // is too recent to trust on every iPad ARML runs on (confirmed real
    // Safari bugs even where nominally supported). Overriding with plain
    // pixel values sidesteps that entirely - everything else pdf.js sets
    // on individual fields uses ordinary calc(), which has been safe for
    // over a decade.
    annotationLayerDiv.style.width = `${viewport.width}px`;
    annotationLayerDiv.style.height = `${viewport.height}px`;
  }

  pdfPagesContainer.appendChild(wrap);
}

function closePdfViewer() {
  pdfViewerModal.classList.remove("open");
  // Actually tear the document down rather than just hiding it behind
  // whatever's underneath - stops it holding file handles/decoded pages
  // in memory in the background, and stops a slow in-flight load from
  // rendering into a modal that's no longer open (see the loadingTask
  // check in openPdfViewer above).
  if (currentViewer.loadingTask) {
    currentViewer.loadingTask.destroy();
  }
  currentViewer = { loadingTask: null, pdfDoc: null, label: "", isFillable: false, sourceUrl: "" };
  pdfPagesContainer.innerHTML = "";
}

closePdfViewerModal.addEventListener("click", closePdfViewer);

pdfViewerActionBtn.addEventListener("click", async () => {
  pdfViewerActionBtn.disabled = true;
  try {
    if (currentViewer.isFillable) {
      await handleSaveFilledForm();
    } else {
      await handleShareReference();
    }
  } finally {
    pdfViewerActionBtn.disabled = false;
  }
});

// Fillable PDFs: bake whatever was typed/checked into a real filled PDF
// (pdf.js writes the AnnotationStorage values into new PDF bytes - this
// is the same saveDocument() call verified earlier against all of
// ARML's actual fillable forms), then hand that OFF - never overwrite
// anything in Assets, which stays the pristine, reliably-cacheable
// source of blank templates. Every save gets its own fresh filename
// instead.
async function handleSaveFilledForm() {
  if (!currentViewer.pdfDoc) return;
  try {
    const bytes = await currentViewer.pdfDoc.saveDocument();
    const blob = new Blob([bytes], { type: "application/pdf" });
    const filename = `${slugifyLabel(currentViewer.label)}-filled-${todayStamp()}.pdf`;

    await maybeShowSaveNudge();
    await handOffFile({ blob, filename, label: currentViewer.label });
  } catch (err) {
    setPdfViewerStatus("Couldn't save this form. Close and try again.", true);
  }
}

// Non-fillable PDFs: nothing to fill, this is just "get me a copy" of
// the reference file exactly as it lives in Assets.
async function handleShareReference() {
  if (!currentViewer.sourceUrl) return;
  await maybeShowSaveNudge();
  await handOffFile({ url: currentViewer.sourceUrl, label: currentViewer.label });
}

function renderScreeningTools() {
  toolsTableBody.innerHTML = "";

  ARM_DATA.screening_tools.forEach(tool => {
    const row = document.createElement("tr");

    const toolLink = (tool.files && tool.files.length)
      ? tool.files
          .map(f => `<a ${fileLinkAttrs(toFileUrl(f.path), f.label, f.fillable)}>${f.label}</a>`)
          .join(", ")
      : tool.tool;

    row.innerHTML = `
      <td>${tool.domain}</td>
      <td>${toolLink}</td>
      <td>${tool.purpose}</td>
    `;

    toolsTableBody.appendChild(row);
  });
}

/* INSURANCE GUIDE MODAL
   Replaces the old "launch the PDF" behavior - jarring on iOS standalone
   (see the fileLinkAttrs comment above for why), and inconsistent with
   every other reference screen in the app, which are all in-app modals.
   The guide's text lives in insurance-guide-text.js as a single constant,
   kept out of app.js so updating the wording is a one-file edit rather
   than digging through application logic. */
const insuranceModal = document.getElementById("insuranceModal");
const closeInsuranceModal = document.getElementById("closeInsuranceModal");
const insuranceGuideBody = document.getElementById("insuranceGuideBody");

function escapeHtml(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// Finds emails, URLs, and phone numbers in a single line and wraps each in
// the right kind of link (mailto:, the URL itself, or tel:), HTML-escaping
// everything else.
//
// The phone pattern intentionally has no word-boundary lookaround (e.g.
// distinguishing "6125550123" from "abc6125550123def"). Modern iOS Safari
// supports lookbehind, but this app may end up on older devices than
// expected, and this content is a small, human-written guide rather than
// arbitrary data - the realistic risk of an accidental over-match here is
// low enough that the simpler, more broadly-compatible pattern wins.
function linkifyLine(line) {
  const PATTERN = new RegExp(
    [
      "[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}",
      "(?:https?:\\/\\/[^\\s<>\")]+|www\\.[^\\s<>\")]+)",
      "(?:\\+?1[\\s.-]?)?\\(?\\d{3}\\)?[\\s.-]?\\d{3}[\\s.-]?\\d{4}"
    ].join("|"),
    "g"
  );

  let result = "";
  let lastIndex = 0;
  let match;
  while ((match = PATTERN.exec(line)) !== null) {
    result += escapeHtml(line.slice(lastIndex, match.index));
    const token = match[0];

    if (token.includes("@")) {
      result += `<a href="mailto:${token}">${escapeHtml(token)}</a>`;
    } else if (/^(https?:\/\/|www\.)/i.test(token)) {
      const href = /^https?:\/\//i.test(token) ? token : `https://${token}`;
      result += `<a href="${href}" target="_blank" rel="noopener">${escapeHtml(token)}</a>`;
    } else {
      const digits = token.replace(/\D/g, "");
      result += `<a href="tel:${digits}">${escapeHtml(token)}</a>`;
    }
    lastIndex = match.index + token.length;
  }
  result += escapeHtml(line.slice(lastIndex));
  return result;
}

// Converts the guide's plain-text source into structured HTML, preserving
// the original document's visual hierarchy rather than flattening
// everything into uniform paragraphs:
//   "## "   at the start of a line -> a major section header
//   "### "  at the start of a line -> a minor section header
//   "- "    at the start of a line -> a bullet list item (consecutive
//           bullet lines group into one <ul>)
//   blank line                     -> ends the current paragraph/list
//   anything else                  -> plain body text; consecutive lines
//                                     with no blank line between them join
//                                     into one paragraph with <br> between,
//                                     so wrapped lines in the source don't
//                                     each become their own paragraph
// Every line still runs through linkifyLine, so phone numbers, emails, and
// URLs get linked whether they appear in a header, a bullet, or a plain
// paragraph line.
function linkifyGuideText(raw) {
  const lines = raw.replace(/\r\n/g, "\n").split("\n");
  let html = "";
  let paragraphLines = [];
  let inList = false;

  function flushParagraph() {
    if (paragraphLines.length) {
      html += `<p>${paragraphLines.map(linkifyLine).join("<br>")}</p>`;
      paragraphLines = [];
    }
  }
  function closeList() {
    if (inList) {
      html += "</ul>";
      inList = false;
    }
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();

    if (line === "") {
      flushParagraph();
      closeList();
      continue;
    }
    if (line.startsWith("## ")) {
      flushParagraph();
      closeList();
      html += `<h3 class="guide-section">${linkifyLine(line.slice(3))}</h3>`;
    } else if (line.startsWith("### ")) {
      flushParagraph();
      closeList();
      html += `<h4 class="guide-subsection">${linkifyLine(line.slice(4))}</h4>`;
    } else if (line.startsWith("- ")) {
      flushParagraph();
      if (!inList) {
        html += '<ul class="guide-list">';
        inList = true;
      }
      html += `<li>${linkifyLine(line.slice(2))}</li>`;
    } else {
      closeList();
      paragraphLines.push(line);
    }
  }
  flushParagraph();
  closeList();

  return html;
}

insuranceBtn.addEventListener("click", () => {
  if (typeof INSURANCE_GUIDE_TEXT === "undefined" || !INSURANCE_GUIDE_TEXT.trim()) {
    alert("The Insurance Guide content hasn't been added yet.");
    return;
  }
  insuranceGuideBody.innerHTML = linkifyGuideText(INSURANCE_GUIDE_TEXT);
  insuranceModal.classList.add("open");
});

closeInsuranceModal.addEventListener("click", () => {
  insuranceModal.classList.remove("open");
});

/* PULLED-OUT TOOLS — too heavily used to bury in the resource list */
document.getElementById("waypointBtn").addEventListener("click", () => {
  window.open("https://gis.hennepin.us/waypoint/", "_blank");
});

document.getElementById("ysnBtn").addEventListener("click", () => {
  window.open("https://ysnmn.org/", "_blank");
});

/* RELEASE OF INFORMATION MODAL
   List/detail split-pane - the same interaction pattern the main
   resource browser already uses (pick from a list on the left, see the
   full card on the right), not a bespoke accordion or tab shape. Tapping
   an organization selects it (red left border on the active row,
   flowing directly into the detail panel's own left border so they read
   as one continuous shape) and renders its card via the same
   contactBlock()/fileBlock()/section() helpers everything else in this
   app already uses. On iPhone, where there's no room for both columns
   side by side, the detail pane becomes a full-screen slide-over with a
   back button - literally the same mechanism #detailCloseBtn/
   .detail-active already use for the main resource list, just applied
   to this modal's own detail pane instead. */
const roiModal = document.getElementById("roiModal");
const roiOrgList = document.getElementById("roiOrgList");
const roiDetailPane = document.getElementById("roiDetailPane");
const roiDetailContent = document.getElementById("roiDetailContent");
const roiDetailBack = document.getElementById("roiDetailBack");
const closeRoiModal = document.getElementById("closeRoiModal");

roiBtn.addEventListener("click", () => {
  renderRoiContacts();
  roiModal.classList.add("open");
});

closeRoiModal.addEventListener("click", () => {
  roiModal.classList.remove("open");
});

function renderRoiContacts() {
  roiOrgList.innerHTML = "";
  roiDetailPane.classList.remove("active");
  roiDetailContent.innerHTML = `<p class="placeholder">Select an organization from the list to view details.</p>`;

  // Alphabetical by organization name, so the order doesn't depend on
  // whatever row order the workbook happened to be built from (that's what
  // put Fairview first). Same localeCompare sort Favorites uses; slice()
  // first so we sort a copy rather than mutating ARM_DATA in place.
  const orgs = (ARM_DATA.release_of_information || [])
    .slice()
    .sort((a, b) => a.organization.localeCompare(b.organization));

  orgs.forEach(org => {
    const li = document.createElement("li");
    li.className = "roi-org-row";
    li.innerHTML = `<span>${org.organization}</span><span class="chev">›</span>`;
    li.addEventListener("click", () => showRoiOrgDetail(org, li));
    roiOrgList.appendChild(li);
  });
}

function showRoiOrgDetail(org, li) {
  roiOrgList.querySelectorAll(".roi-org-row").forEach(row => row.classList.remove("selected"));
  li.classList.add("selected");

  // contactBlock()/fileBlock() already handle every field an ROI org can
  // have (phone, altPhone, fax, altFax, email, address, files) - nothing
  // ROI-specific needs duplicating here.
  roiDetailContent.innerHTML = `
    <h2>${org.organization}</h2>
    ${section("Contact", contactBlock(org, { plainAddress: true }))}
    ${section("Notes", org.notes)}
    ${section("Forms", fileBlock(org))}
  `;
  roiDetailPane.scrollTop = 0;

  // No-op above the iPhone slide-over breakpoint, same as the main
  // resource list's .detail-active - only matters where the CSS for it
  // actually applies.
  roiDetailPane.classList.add("active");
}

roiDetailBack.addEventListener("click", () => {
  roiDetailPane.classList.remove("active");
});

/* FAVORITES MODAL */
const favBtn = document.getElementById("favBtn");
const favModal = document.getElementById("favModal");
const favList = document.getElementById("favList");
const favEmpty = document.getElementById("favEmpty");
const closeFavModal = document.getElementById("closeFavModal");

favBtn.addEventListener("click", () => {
  renderFavorites();
  favModal.classList.add("open");
});

closeFavModal.addEventListener("click", () => {
  favModal.classList.remove("open");
});

function renderFavorites() {
  const favNames = getFavorites();
  const favResources = ARM_DATA.resources
    .filter(r => favNames.includes(r.name))
    .sort((a, b) => a.name.localeCompare(b.name));

  favList.innerHTML = "";
  favEmpty.style.display = favResources.length ? "none" : "block";

  favResources.forEach(r => {
    const li = document.createElement("li");
    li.textContent = r.name;
    li.addEventListener("click", () => {
      favModal.classList.remove("open");
      showResourceList(favResources, "Favorites");
      showDetail(r);
      detailPane.classList.add("detail-active");
    });
    favList.appendChild(li);
  });
}

/* INIT */
showCategoryList();

/* ============================================================
   UPDATE / OFFLINE SYNC
   ------------------------------------------------------------
   The app knows which build it IS from ARM_DATA.meta.buildId
   (stamped by build-data.js). It compares that against the
   published version.json. No localStorage involved on purpose -
   iOS can clear it, and an app that forgets its own version
   would nag to "update" to the build it's already running.

   On file:// (ARML.exe / OneDrive-synced desktop copy) this
   whole section stays out of the way: there's no origin to
   fetch from, and OneDrive sync is already the update
   mechanism there.
   ============================================================ */

const versionTag = document.getElementById("versionTag");
const updateBtn = document.getElementById("updateBtn");
const updateLabel = document.getElementById("updateLabel");

const META = (typeof ARM_DATA !== "undefined" && ARM_DATA.meta) ? ARM_DATA.meta : {};
const INSTALLED_BUILD = META.buildId || null;
const INSTALLED_VERSION = META.version || null;
const IS_FILE_PROTOCOL = location.protocol === "file:";

versionTag.textContent = INSTALLED_VERSION ? `ARML v${INSTALLED_VERSION}` : "ARML";

let updateState = "idle";
let statusTimer = null;

function setUpdateUI(state, info) {
  updateState = state;
  info = info || {};
  clearTimeout(statusTimer);

  updateBtn.classList.remove("available", "busy", "problem");

  switch (state) {
    case "checking":
      updateBtn.hidden = false;
      updateBtn.disabled = true;
      updateBtn.classList.add("busy");
      updateLabel.textContent = "Checking…";
      break;

    case "available":
      updateBtn.hidden = false;
      updateBtn.disabled = false;
      updateBtn.classList.add("available");
      updateLabel.textContent = "Update available";
      break;

    case "downloading": {
      updateBtn.hidden = false;
      updateBtn.disabled = true;
      updateBtn.classList.add("busy");
      const { done, total } = info;
      updateLabel.textContent = total
        ? `Downloading ${done} of ${total} files…`
        : "Preparing…";
      break;
    }

    case "current":
      updateBtn.hidden = false;
      updateBtn.disabled = true;
      updateLabel.textContent = "Up to date";
      statusTimer = setTimeout(() => setUpdateUI("idle"), 3000);
      break;

    case "offline":
      updateBtn.hidden = false;
      updateBtn.disabled = true;
      updateBtn.classList.add("problem");
      updateLabel.textContent = "Offline";
      statusTimer = setTimeout(() => setUpdateUI("idle"), 4000);
      break;

    case "problem":
      updateBtn.hidden = false;
      updateBtn.disabled = false;
      updateBtn.classList.add("problem");
      updateLabel.textContent = info.short || "Update failed — retry";
      if (info.detail) updateBtn.title = info.detail;
      break;

    case "idle":
    default:
      updateBtn.hidden = true;
      updateBtn.disabled = false;
      updateLabel.textContent = "Update";
      updateBtn.removeAttribute("title");
      break;
  }
}

async function checkForUpdate(manual) {
  if (IS_FILE_PROTOCOL) return;
  if (updateState === "downloading") return;
  // A background check must not silently wipe a problem the user hasn't
  // acted on yet - otherwise a partial download reports itself for two
  // seconds and then quietly disappears. Manual checks may override it.
  if (updateState === "problem" && !manual) return;

  if (manual) setUpdateUI("checking");

  try {
    // Cache-busting query on top of no-store: some proxies ignore the header.
    const res = await fetch(`version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!res.ok) throw new Error(`version.json returned ${res.status}`);
    const remote = await res.json();

    if (!INSTALLED_BUILD) {
      // Running a data.js built before build IDs existed. Offer the update -
      // taking it is how the app gets a build ID in the first place.
      setUpdateUI("available");
      return;
    }

    if (remote.buildId && remote.buildId !== INSTALLED_BUILD) {
      setUpdateUI("available");
    } else {
      setUpdateUI(manual ? "current" : "idle");
    }
  } catch (err) {
    setUpdateUI(manual ? "offline" : "idle");
  }
}

// After a new service worker installs it calls skipWaiting(), so it activates
// and claims this page. Waiting for that before precaching means the files
// land in the NEW shell cache rather than the one about to be discarded.
function waitForNewController(reg) {
  return new Promise(resolve => {
    if (!reg.installing && !reg.waiting) return resolve();

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      navigator.serviceWorker.removeEventListener("controllerchange", finish);
      resolve();
    };

    navigator.serviceWorker.addEventListener("controllerchange", finish);
    // Don't hang forever if the swap never fires - precaching against the
    // current worker is still better than a button that does nothing.
    setTimeout(finish, 15000);
  });
}

async function runUpdate() {
  if (IS_FILE_PROTOCOL) return;

  setUpdateUI("downloading", { done: 0, total: 0 });

  if (!("serviceWorker" in navigator) || !navigator.serviceWorker.controller) {
    // No service worker (first load, or unsupported). A plain reload still
    // picks up the new files - it just won't precache PDFs for offline.
    location.reload();
    return;
  }

  try {
    const reg = await navigator.serviceWorker.ready;
    await reg.update();
    await waitForNewController(reg);

    const target = navigator.serviceWorker.controller;
    if (!target) {
      location.reload();
      return;
    }
    target.postMessage({ type: "PRECACHE_ALL" });
  } catch (err) {
    setUpdateUI("problem", {
      short: "Update failed — retry",
      detail: String(err && err.message ? err.message : err)
    });
  }
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", event => {
    const msg = event.data || {};

    if (msg.type === "PRECACHE_PROGRESS") {
      setUpdateUI("downloading", { done: msg.done, total: msg.total });
      return;
    }

    if (msg.type === "PRECACHE_DONE") {
      // Reload so the page picks up the freshly cached shell and data -
      // but only if the files that actually determine "are we caught up"
      // (data.js, version.json) are confirmed present. Reloading
      // regardless of that used to be exactly how a single unlucky fetch
      // turned into a persistent update loop: the page would come back
      // reading a still-stale cached data.js, immediately re-detect the
      // same "update available" state, and there was no way to tell that
      // apart from a person just needing to try again. The retry logic
      // in the service worker now handles the transient case; this is
      // the backstop for when a file genuinely never came through.
      const criticalFailed = (msg.failed || []).some(f => f === "data.js" || f === "version.json");
      try {
        if (msg.failed && msg.failed.length) {
          sessionStorage.setItem("armlPartialUpdate", String(msg.failed.length));
        }
      } catch (e) { /* sessionStorage unavailable - not worth failing over */ }

      if (criticalFailed) {
        setUpdateUI("problem", {
          short: "Update incomplete — retry",
          detail: "The app's own version info didn't finish downloading, so re-checking now would just show the same update again. Tap to try once more."
        });
        return;
      }

      location.reload();
      return;
    }

    if (msg.type === "PRECACHE_ERROR") {
      setUpdateUI("problem", { short: "Update failed — retry", detail: msg.message });
    }
  });
}

updateBtn.addEventListener("click", () => {
  if (updateState === "available" || updateState === "problem") runUpdate();
});

versionTag.addEventListener("click", () => checkForUpdate(true));

/* THEME TOGGLE
   The actual class-add-before-first-paint happens in index.html's inline
   <head> script, which runs far too early to have a DOM reference to
   click on yet. This just handles the interactive part: flipping the
   class on tap and remembering the choice for next launch. Dark stays
   the untouched default - "light" is the only state ever written to
   storage, so a person who never touches the toggle never even creates
   the localStorage key. */
const THEME_KEY = "armlTheme";
const themeToggle = document.getElementById("themeToggle");

function setTheme(isLight) {
  document.documentElement.classList.toggle("theme-light", isLight);
  themeToggle.setAttribute("aria-pressed", isLight ? "true" : "false");
  // The label describes the ACTION (what tapping does next), not the
  // current state - "Switch to light theme" while dark, flipping to
  // "Switch to dark theme" once light is on.
  const nextLabel = isLight ? "Switch to dark theme" : "Switch to light theme";
  themeToggle.setAttribute("aria-label", nextLabel);
  themeToggle.setAttribute("title", nextLabel);
  try {
    if (isLight) {
      localStorage.setItem(THEME_KEY, "light");
    } else {
      localStorage.removeItem(THEME_KEY);
    }
  } catch (e) { /* storage unavailable - the toggle still works for this session */ }
}

// Sync the button's aria-pressed/label state with whatever the inline
// <head> script already applied, without re-touching the class it
// already set (setTheme's class toggle is idempotent either way, but
// there's no reason to write to localStorage again on every page load).
const startedLight = document.documentElement.classList.contains("theme-light");
themeToggle.setAttribute("aria-pressed", startedLight ? "true" : "false");
themeToggle.setAttribute("aria-label", startedLight ? "Switch to dark theme" : "Switch to light theme");
themeToggle.setAttribute("title", startedLight ? "Switch to dark theme" : "Switch to light theme");

themeToggle.addEventListener("click", () => {
  setTheme(!document.documentElement.classList.contains("theme-light"));
});

/* Report a partial download from the previous session, once. */
(function reportPartialUpdate() {
  try {
    const n = sessionStorage.getItem("armlPartialUpdate");
    if (n) {
      sessionStorage.removeItem("armlPartialUpdate");
      setUpdateUI("problem", {
        short: `${n} file${n === "1" ? "" : "s"} didn't download`,
        detail: "Tap to retry. The app still works; some PDFs may be unavailable offline."
      });
    }
  } catch (e) { /* no sessionStorage - nothing to report */ }
})();

if (!IS_FILE_PROTOCOL) {
  // Quiet background check shortly after launch, and again whenever the app
  // is brought back to the foreground (e.g. carried into Wi-Fi range).
  setTimeout(() => checkForUpdate(false), 2500);

  document.addEventListener("visibilitychange", () => {
    if (!document.hidden && updateState !== "downloading") checkForUpdate(false);
  });

  window.addEventListener("online", () => checkForUpdate(false));
}
