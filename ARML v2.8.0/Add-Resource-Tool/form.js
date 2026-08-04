const form = document.getElementById("resourceForm");
const submitBtn = document.getElementById("submitBtn");
const statusBox = document.getElementById("statusBox");

/* ---------- TAG-CHIP INPUTS (Keywords, Service Tags) ----------
   Replaces "type a comma-separated list" with press-Enter-to-add chips.
   Each .tag-input tracks its own array of strings; on submit we append
   one hidden input per tag so FormData collects them as a repeated field
   (keywords / serviceTags), which the server turns into the comma- or
   semicolon-joined string the workbook expects - the user never types
   either separator. */
document.querySelectorAll(".tag-input").forEach(wrapper => {
  const field = wrapper.dataset.field;
  const tagsEl = wrapper.querySelector(".tags");
  const entry = wrapper.querySelector(".tag-entry");
  const values = [];

  function render() {
    tagsEl.innerHTML = "";
    values.forEach((val, i) => {
      const chip = document.createElement("span");
      chip.className = "tag-chip";
      chip.textContent = val;
      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "tag-remove";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `Remove ${val}`);
      remove.addEventListener("click", () => {
        values.splice(i, 1);
        render();
      });
      chip.appendChild(remove);
      tagsEl.appendChild(chip);
    });
  }

  function addFromInput() {
    const val = entry.value.trim();
    if (val && !values.includes(val)) {
      values.push(val);
      render();
    }
    entry.value = "";
  }

  entry.addEventListener("keydown", e => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addFromInput();
    } else if (e.key === "Backspace" && !entry.value && values.length) {
      values.pop();
      render();
    }
  });
  entry.addEventListener("blur", addFromInput);

  wrapper._getValues = () => values;
  wrapper._field = field;
});

/* ---------- FILE PICKER (Files) ----------
   Replaces "type Label|filename.pdf; Label2|filename2.pdf" with an actual
   file picker. Each picked PDF gets a row showing its real filename plus
   an editable label (auto-filled from the filename, prettified) - the
   user never types a filename or a pipe/semicolon by hand. The files
   themselves are uploaded as real file data and copied into /Assets by
   the server; the label is what gets sent alongside as fileLabels[]. */
const fileInput = document.getElementById("fileInput");
const fileRows = document.getElementById("fileRows");
let pickedFiles = [];

function prettyLabel(filename) {
  return filename
    .replace(/\.pdf$/i, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

fileInput.addEventListener("change", () => {
  // Accumulate across multiple picks rather than replacing, since
  // <input type=file> only gives you the files from the most recent pick.
  pickedFiles = pickedFiles.concat(Array.from(fileInput.files));
  fileInput.value = ""; // allow picking the same file again if removed
  renderFileRows();
});

function renderFileRows() {
  fileRows.innerHTML = "";
  pickedFiles.forEach((file, i) => {
    const row = document.createElement("div");
    row.className = "file-row";

    const name = document.createElement("span");
    name.className = "file-name";
    name.textContent = file.name;

    const label = document.createElement("input");
    label.type = "text";
    label.className = "file-label";
    label.value = prettyLabel(file.name);
    label.placeholder = "Link text shown in the app";

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "file-remove";
    remove.textContent = "Remove";
    remove.addEventListener("click", () => {
      pickedFiles.splice(i, 1);
      renderFileRows();
    });

    row.appendChild(name);
    row.appendChild(label);
    row.appendChild(remove);
    fileRows.appendChild(row);
  });
}

/* ---------- LIVE DUPLICATE-NAME WARNING ---------- */
const nameField = document.getElementById("nameField");
const nameWarning = document.getElementById("nameWarning");
let existingNames = [];

fetch("/resource-names")
  .then(r => r.json())
  .then(data => { existingNames = (data.names || []).map(n => n.toLowerCase()); })
  .catch(() => { /* if this fails, the server-side duplicate check on submit still catches it */ });

nameField.addEventListener("input", () => {
  const val = nameField.value.trim().toLowerCase();
  if (val && existingNames.includes(val)) {
    nameWarning.textContent = `A resource named "${nameField.value.trim()}" already exists. Saving will be blocked - use the existing entry or a different name.`;
    nameWarning.hidden = false;
  } else {
    nameWarning.hidden = true;
  }
});

/* ---------- SUBMIT ---------- */
form.addEventListener("submit", async e => {
  e.preventDefault();
  hideStatus();
  submitBtn.disabled = true;
  submitBtn.textContent = "Saving…";

  try {
    const formData = new FormData();

    // Plain fields (everything except the tag inputs and files, which are
    // handled separately below).
    new FormData(form).forEach((value, key) => {
      formData.append(key, value);
    });

    // Tag-chip values as repeated fields.
    document.querySelectorAll(".tag-input").forEach(wrapper => {
      wrapper._getValues().forEach(v => formData.append(wrapper._field, v));
    });

    // Files + one label per file, same order.
    pickedFiles.forEach(file => formData.append("files", file));
    document.querySelectorAll(".file-label").forEach(input => {
      formData.append("fileLabels", input.value.trim());
    });

    const res = await fetch("/add", { method: "POST", body: formData });
    const out = await res.json();

    if (!res.ok) {
      showStatus(out.error || "Something went wrong.", "error");
      return;
    }

    showStatus(out.message, out.buildError ? "warning" : "success");
    renderPublishDetail(out.publish);
    if (!out.buildError) {
      form.reset();
      pickedFiles = [];
      renderFileRows();
      document.querySelectorAll(".tag-input").forEach(wrapper => {
        wrapper._getValues().length = 0;
        wrapper.querySelector(".tags").innerHTML = "";
      });
      existingNames.push(nameField.value.trim().toLowerCase());
    }
  } catch (err) {
    showStatus("Couldn't reach the server. Is start-add-resource-tool.bat still running?", "error");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = "Save Resource";
  }
});

function showStatus(text, kind) {
  statusBox.textContent = text;
  statusBox.className = "status-box " + kind;
  statusBox.hidden = false;
}

function hideStatus() {
  statusBox.hidden = true;
}

/* ---------- PUBLISH STATUS ---------- */
const publishDetail = document.getElementById("publishDetail");

function renderPublishDetail(publish) {
  if (!publishDetail) return;

  if (!publish || !publish.attempted) {
    // Not attempted at all - either publishing is off, or config.json is
    // incomplete. Not an error: this is the normal state for anyone still
    // testing locally before GitHub is set up.
    publishDetail.hidden = true;
    publishDetail.innerHTML = "";
    return;
  }

  const rows = [];
  publish.pushed.forEach(p => rows.push(`<li class="publish-ok">✓ ${p.path}</li>`));
  publish.failed.forEach(f => rows.push(`<li class="publish-fail">✕ ${f.path} — ${f.error}</li>`));

  publishDetail.innerHTML = `<strong>GitHub publish:</strong><ul>${rows.join("")}</ul>` +
    (publish.failed.length
      ? `<button type="button" id="retryPublishBtn" class="btn-secondary">Retry publish</button>
         <button type="button" id="exportBundleBtn" class="btn-secondary">Export update bundle instead</button>`
      : "");
  publishDetail.hidden = false;

  const retryBtn = document.getElementById("retryPublishBtn");
  if (retryBtn) retryBtn.addEventListener("click", retryPublish);
  const exportBtn = document.getElementById("exportBundleBtn");
  if (exportBtn) exportBtn.addEventListener("click", exportBundle);
}

async function retryPublish() {
  const btn = document.getElementById("retryPublishBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Retrying…"; }
  try {
    const res = await fetch("/publish", { method: "POST" });
    const out = await res.json();
    if (!res.ok) {
      showStatus(out.error || "Retry failed.", "error");
      return;
    }
    renderPublishDetail(out.publish);
    if (out.publish.failed.length === 0) {
      showStatus("Published to GitHub successfully.", "success");
    }
  } catch (err) {
    showStatus("Couldn't reach the server to retry.", "error");
  }
}

async function exportBundle() {
  const btn = document.getElementById("exportBundleBtn");
  if (btn) { btn.disabled = true; btn.textContent = "Creating bundle…"; }
  try {
    const res = await fetch("/export-bundle", { method: "POST" });
    const out = await res.json();
    if (!res.ok) {
      showStatus(out.error || "Could not create the bundle.", "error");
      return;
    }
    showStatus(`${out.message} — find it in the ARML v2.7.0 folder.`, "success");
  } catch (err) {
    showStatus("Couldn't reach the server to create the bundle.", "error");
  } finally {
    if (btn) { btn.disabled = false; btn.textContent = "Export update bundle instead"; }
  }
}

/* Show current publish configuration on page load, so someone opening the
   tool can tell at a glance whether GitHub publishing is even turned on -
   rather than only finding out after their first save. */
fetch("/publish-status")
  .then(r => r.json())
  .then(status => {
    const el = document.getElementById("publishConfigNote");
    if (!el) return;
    if (!status.enabled) {
      el.textContent = "GitHub publishing is off - resources save locally only. See config.json to turn it on.";
    } else if (!status.configured) {
      el.textContent = "GitHub publishing is on but config.json is missing owner/repo/token - publishing will be skipped.";
    } else {
      el.textContent = `GitHub publishing is on: ${status.owner}/${status.repo} (${status.branch} branch).`;
    }
  })
  .catch(() => { /* status is a nicety, not essential - fail silently */ });
