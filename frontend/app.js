// ============================================================
// SCANLINE — frontend logic
// Talks to the Flask API at API_BASE. Change this if you deploy
// the backend somewhere other than localhost:5000.
// ============================================================
const API_BASE = window.location.origin;

const dropzone = document.getElementById("dropzone");
const fileInput = document.getElementById("file-input");
const browseBtn = document.getElementById("browse-btn");
const clearBtn = document.getElementById("clear-btn");
const dzIdle = document.getElementById("dropzone-idle");
const dzFilled = document.getElementById("dropzone-filled");
const dzFilename = document.getElementById("dz-filename");
const scanBeam = document.getElementById("scan-beam");

const jdInput = document.getElementById("jd-input");
const jdCount = document.getElementById("jd-count");

const runBtn = document.getElementById("run-btn");
const runLabel = document.getElementById("run-label");
const errorMsg = document.getElementById("error-msg");
const resultsSection = document.getElementById("results");

let selectedFile = null;

// ---------------- file selection ----------------
browseBtn.addEventListener("click", (e) => { e.stopPropagation(); fileInput.click(); });
dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
});

fileInput.addEventListener("change", () => {
  if (fileInput.files.length) setFile(fileInput.files[0]);
});

["dragover", "dragenter"].forEach(evt => {
  dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.add("drag-over"); });
});
["dragleave", "drop"].forEach(evt => {
  dropzone.addEventListener(evt, (e) => { e.preventDefault(); dropzone.classList.remove("drag-over"); });
});
dropzone.addEventListener("drop", (e) => {
  if (e.dataTransfer.files.length) setFile(e.dataTransfer.files[0]);
});

clearBtn.addEventListener("click", (e) => {
  e.stopPropagation();
  selectedFile = null;
  fileInput.value = "";
  dzIdle.hidden = false;
  dzFilled.hidden = true;
});

function setFile(file) {
  const validExt = /\.(pdf|docx|txt)$/i;
  if (!validExt.test(file.name)) {
    showError("Unsupported file type. Please upload a PDF, DOCX, or TXT file.");
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showError("File too large. Max size is 5MB.");
    return;
  }
  selectedFile = file;
  dzFilename.textContent = file.name;
  dzIdle.hidden = true;
  dzFilled.hidden = false;
  hideError();
}

// ---------------- JD char counter ----------------
jdInput.addEventListener("input", () => {
  jdCount.textContent = `${jdInput.value.length} characters`;
});

// ---------------- run analysis ----------------
runBtn.addEventListener("click", runAnalysis);

async function runAnalysis() {
  hideError();

  if (!selectedFile) { showError("Please upload a resume file first."); return; }
  const jd = jdInput.value.trim();
  if (jd.length < 30) { showError("Please paste a fuller job description (at least a couple sentences)."); return; }

  setLoading(true);

  const formData = new FormData();
  formData.append("resume", selectedFile);
  formData.append("job_description", jd);

  try {
    const res = await fetch(`${API_BASE}/api/analyze`, { method: "POST", body: formData });
    const data = await res.json();

    if (!res.ok) {
      showError(data.error || "Something went wrong while analyzing this resume.");
      setLoading(false);
      return;
    }

    renderResults(data);
  } catch (err) {
    console.error("Analysis error:", err);
    showError(`Could not reach the analysis server (${API_BASE}). If this is a deployed app, make sure you are accessing it via its public URL.`);
  } finally {
    setLoading(false);
  }
}

function setLoading(isLoading) {
  runBtn.disabled = isLoading;
  runLabel.textContent = isLoading ? "Scanning…" : "Run analysis";
  scanBeam.classList.toggle("active", isLoading);
}

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.hidden = false;
}
function hideError() { errorMsg.hidden = true; }

// ---------------- render results ----------------
function renderResults(data) {
  resultsSection.hidden = false;

  setDial("match", data.match_score, matchCaption(data.match_score));
  setDial("ats", data.ats_score, atsCaption(data.ats_score));

  renderChips("matched-skills", data.matched_skills, false);
  renderChips("missing-skills", data.missing_skills, true);
  renderChips("matched-keywords", data.matched_keywords, false);
  renderChips("missing-keywords", data.missing_keywords, true);

  renderChecklist(data.checklist);
  renderSuggestions(data.suggestions);

  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function matchCaption(score) {
  if (score >= 75) return "Strong alignment with this role";
  if (score >= 50) return "Partial match — some real gaps";
  return "Low overlap with this job description";
}
function atsCaption(score) {
  if (score >= 80) return "Parses cleanly through most ATS filters";
  if (score >= 55) return "Parseable, but a few flags will hurt ranking";
  return "High risk of being mis-read or dropped by ATS";
}

function setDial(prefix, value, captionText) {
  const clamped = Math.max(0, Math.min(100, value));
  const fillEl = document.getElementById(`dial-fill-${prefix}`);
  const numberEl = document.getElementById(`${prefix}-number`);
  const captionEl = document.getElementById(`${prefix}-caption`);

  requestAnimationFrame(() => {
    fillEl.setAttribute("stroke-dasharray", `${clamped} 100`);
  });

  animateNumber(numberEl, clamped);
  captionEl.textContent = captionText;
}

function animateNumber(el, target) {
  const start = 0;
  const duration = 900;
  const startTime = performance.now();
  function step(now) {
    const progress = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.round(start + (target - start) * eased);
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

function renderChips(containerId, items, isMissing) {
  const container = document.getElementById(containerId);
  container.innerHTML = "";
  if (!items || items.length === 0) {
    const note = document.createElement("span");
    note.className = "empty-note";
    note.textContent = isMissing ? "No major gaps detected." : "No overlapping skills detected.";
    container.appendChild(note);
    return;
  }
  items.forEach(skill => {
    const chip = document.createElement("span");
    chip.className = isMissing ? "chip chip-missing" : "chip";
    chip.textContent = skill;
    container.appendChild(chip);
  });
}

function renderChecklist(checklist) {
  const list = document.getElementById("checklist");
  list.innerHTML = "";
  const iconFor = { pass: "✓", warn: "!", fail: "✕" };
  checklist.forEach(item => {
    const li = document.createElement("li");
    li.className = `status-${item.status}`;
    li.innerHTML = `<span class="status-icon">${iconFor[item.status]}</span><span>${item.label}</span>`;
    list.appendChild(li);
  });
}

function renderSuggestions(suggestions) {
  const list = document.getElementById("suggestions");
  list.innerHTML = "";
  if (!suggestions || suggestions.length === 0) {
    const li = document.createElement("li");
    li.textContent = "No major issues found — this resume is in solid shape for this role.";
    list.appendChild(li);
    return;
  }
  suggestions.forEach(s => {
    const li = document.createElement("li");
    li.textContent = s;
    list.appendChild(li);
  });
}

// draw tick marks on the dial gauges once at load
function drawTicks(groupId) {
  const g = document.getElementById(groupId);
  const cx = 100, cy = 100, rOuter = 80, rInner = 70;
  for (let i = 0; i <= 10; i++) {
    const angle = Math.PI - (i / 10) * Math.PI; // 180deg to 0deg
    const x1 = cx + rInner * Math.cos(angle);
    const y1 = cy - rInner * Math.sin(angle);
    const x2 = cx + rOuter * Math.cos(angle);
    const y2 = cy - rOuter * Math.sin(angle);
    const tick = document.createElementNS("http://www.w3.org/2000/svg", "line");
    tick.setAttribute("x1", x1); tick.setAttribute("y1", y1);
    tick.setAttribute("x2", x2); tick.setAttribute("y2", y2);
    tick.setAttribute("stroke", "#D8D4C6");
    tick.setAttribute("stroke-width", "1.5");
    g.appendChild(tick);
  }
}
drawTicks("dial-ticks-match");
drawTicks("dial-ticks-ats");
