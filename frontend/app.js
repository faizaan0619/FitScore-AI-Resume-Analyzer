// ============================================================
// FITSCORE — Frontend Application Logic
// Handles SaaS tabs, themes, history caching, batch uploads,
// and reusable results rendering.
// ============================================================

const API_BASE = window.location.origin;

// Global state variables
let selectedFile = null;
let selectedBatchFiles = [];
let scanHistory = [];

// ============================================================
// 1. DOME ELEMENTS & EVENT LISTENERS SETUP
// ============================================================

// Theme Toggle Elements
const themeToggleBtn = document.getElementById("theme-toggle-btn");
const themeIcon = document.getElementById("theme-icon");

// Tab Navigation Elements
const tabBtns = document.querySelectorAll(".tab-btn");
const tabContents = document.querySelectorAll(".tab-content");
const historyBadge = document.getElementById("history-badge");

// Single Scan Elements
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

// Batch Ranker Elements
const batchDropzone = document.getElementById("batch-dropzone");
const batchFileInput = document.getElementById("batch-file-input");
const batchBrowseBtn = document.getElementById("batch-browse-btn");
const batchFilesList = document.getElementById("batch-files-list");
const batchJdInput = document.getElementById("batch-jd-input");
const batchJdCount = document.getElementById("batch-jd-count");
const batchRunBtn = document.getElementById("batch-run-btn");
const batchRunLabel = document.getElementById("batch-run-label");
const batchErrorMsg = document.getElementById("batch-error-msg");
const batchResultsPanel = document.getElementById("batch-results-panel");
const leaderboardBody = document.getElementById("leaderboard-body");
const batchScanBeam = document.getElementById("batch-scan-beam");

// History View Elements
const historyListContainer = document.getElementById("history-list-container");
const clearHistoryBtn = document.getElementById("clear-history-btn");

// Modal Elements
const detailModal = document.getElementById("detail-modal");
const modalFilename = document.getElementById("modal-filename");
const modalCloseBtn = document.getElementById("modal-close-btn");
const modalOverlay = document.getElementById("modal-overlay");

// ============================================================
// 2. THEME CONTROLLER & TABS CONTROLLER
// ============================================================

// Initialize Theme
function initTheme() {
  const savedTheme = localStorage.getItem("fitscore_theme") || "dark";
  document.documentElement.setAttribute("data-theme", savedTheme);
  themeIcon.textContent = savedTheme === "light" ? "☾" : "☼";
}

themeToggleBtn.addEventListener("click", () => {
  const currentTheme = document.documentElement.getAttribute("data-theme");
  const targetTheme = currentTheme === "light" ? "dark" : "light";
  document.documentElement.setAttribute("data-theme", targetTheme);
  localStorage.setItem("fitscore_theme", targetTheme);
  themeIcon.textContent = targetTheme === "light" ? "☾" : "☼";
});

// Initialize Tab Navigation
function initTabs() {
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      const targetTab = btn.getAttribute("data-tab");
      
      // Update active tab buttons
      tabBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      
      // Switch active tab contents
      tabContents.forEach(content => {
        if (content.id === `view-${targetTab}`) {
          content.hidden = false;
        } else {
          content.hidden = true;
        }
      });

      // Special rendering hooks on tab open
      if (targetTab === "history") {
        renderHistory();
      }
    });
  });
}

// Brand Logo clicks return to Dashboard
document.getElementById("brand-logo").addEventListener("click", () => {
  const dashboardBtn = document.querySelector('.tab-btn[data-tab="single-scan"]');
  if (dashboardBtn) dashboardBtn.click();
});

// ============================================================
// 3. SINGLE SCAN LOGIC (DASHBOARD)
// ============================================================

// Browse actions
browseBtn.addEventListener("click", (e) => { e.stopPropagation(); fileInput.click(); });
dropzone.addEventListener("click", () => fileInput.click());
dropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); fileInput.click(); }
});

fileInput.addEventListener("change", () => {
  if (fileInput.files.length) setFile(fileInput.files[0]);
});

// Drag & Drop
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

// Character counter
jdInput.addEventListener("input", () => {
  jdCount.textContent = `${jdInput.value.length} characters`;
});

// Execute Run
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

    // Render in Single Scan section
    renderDetailedReport(data, "");
    resultsSection.hidden = false;
    resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });

    // Save to History
    saveToHistory(selectedFile.name, jd, data);
  } catch (err) {
    console.error("Analysis error:", err);
    showError(`Could not reach the analysis server (${API_BASE}). Details: ${err.message || err}.`);
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

// ============================================================
// 4. RECRUITER BATCH RANKER LOGIC
// ============================================================

batchBrowseBtn.addEventListener("click", (e) => { e.stopPropagation(); batchFileInput.click(); });
batchDropzone.addEventListener("click", () => batchFileInput.click());
batchDropzone.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") { e.preventDefault(); batchFileInput.click(); }
});

batchFileInput.addEventListener("change", () => {
  if (batchFileInput.files.length) {
    for (let i = 0; i < batchFileInput.files.length; i++) {
      addBatchFile(batchFileInput.files[i]);
    }
    batchFileInput.value = ""; // clear selector
  }
});

// Drag & Drop for batch
["dragover", "dragenter"].forEach(evt => {
  batchDropzone.addEventListener(evt, (e) => { e.preventDefault(); batchDropzone.classList.add("drag-over"); });
});
["dragleave", "drop"].forEach(evt => {
  batchDropzone.addEventListener(evt, (e) => { e.preventDefault(); batchDropzone.classList.remove("drag-over"); });
});
batchDropzone.addEventListener("drop", (e) => {
  if (e.dataTransfer.files.length) {
    for (let i = 0; i < e.dataTransfer.files.length; i++) {
      addBatchFile(e.dataTransfer.files[i]);
    }
  }
});

function addBatchFile(file) {
  const validExt = /\.(pdf|docx|txt)$/i;
  if (!validExt.test(file.name)) {
    showBatchError(`Unsupported file: ${file.name}. Only PDF, DOCX, or TXT allowed.`);
    return;
  }
  if (file.size > 5 * 1024 * 1024) {
    showBatchError(`File too large: ${file.name}. Max size is 5MB.`);
    return;
  }
  // Avoid duplicate names in current run
  if (selectedBatchFiles.some(f => f.name === file.name)) {
    return;
  }
  selectedBatchFiles.push(file);
  renderBatchFileList();
  hideBatchError();
}

function removeBatchFile(index) {
  selectedBatchFiles.splice(index, 1);
  renderBatchFileList();
}

function renderBatchFileList() {
  batchFilesList.innerHTML = "";
  if (selectedBatchFiles.length === 0) {
    batchFilesList.innerHTML = '<div class="empty-txt">No resumes selected yet.</div>';
    return;
  }
  selectedBatchFiles.forEach((file, index) => {
    const badge = document.createElement("div");
    badge.className = "resume-item-badge";
    badge.innerHTML = `
      <span>${file.name}</span>
      <span class="remove-item" onclick="removeBatchFile(${index})">&times;</span>
    `;
    batchFilesList.appendChild(badge);
  });
}

// Make helper global for template clicking
window.removeBatchFile = removeBatchFile;

batchJdInput.addEventListener("input", () => {
  batchJdCount.textContent = `${batchJdInput.value.length} characters`;
});

batchRunBtn.addEventListener("click", runBatchAnalysis);

async function runBatchAnalysis() {
  hideBatchError();

  if (selectedBatchFiles.length === 0) { showBatchError("Please select at least one candidate resume."); return; }
  const jd = batchJdInput.value.trim();
  if (jd.length < 30) { showBatchError("Please paste a target job description (at least a couple sentences)."); return; }

  setBatchLoading(true);

  const formData = new FormData();
  selectedBatchFiles.forEach(file => {
    formData.append("resumes", file);
  });
  formData.append("job_description", jd);

  try {
    const res = await fetch(`${API_BASE}/api/analyze-batch`, { method: "POST", body: formData });
    const data = await res.json();

    if (!res.ok) {
      showBatchError(data.error || "Batch matchmaking failed.");
      setBatchLoading(false);
      return;
    }

    renderBatchLeaderboard(data.results, jd);
  } catch (err) {
    console.error("Batch match error:", err);
    showBatchError(`Could not reach the matchmaking server. Details: ${err.message || err}`);
  } finally {
    setBatchLoading(false);
  }
}

function setBatchLoading(isLoading) {
  batchRunBtn.disabled = isLoading;
  batchRunLabel.textContent = isLoading ? "Ranking..." : "Rank candidates";
  batchScanBeam.classList.toggle("active", isLoading);
}

function showBatchError(msg) {
  batchErrorMsg.textContent = msg;
  batchErrorMsg.hidden = false;
}
function hideBatchError() { batchErrorMsg.hidden = true; }

// Render Leaderboard Table
function renderBatchLeaderboard(results, jd) {
  leaderboardBody.innerHTML = "";
  batchResultsPanel.hidden = false;

  // Filter out errored parses from rank list but display warning feedback if needed
  const validCandidates = results.filter(c => c.success);
  const failedCandidates = results.filter(c => !c.success);

  // Sort by match_score desc
  validCandidates.sort((a, b) => b.match_score - a.match_score);

  if (validCandidates.length === 0) {
    leaderboardBody.innerHTML = `
      <tr>
        <td colspan="6" style="text-align:center; padding: 24px; color: var(--text-muted);">
          All uploads failed to process. Check individual file structures.
        </td>
      </tr>
    `;
  }

  // Render valid candidates
  validCandidates.forEach((candidate, idx) => {
    const rank = idx + 1;
    const matchScore = candidate.match_score;
    const atsScore = candidate.ats_score;

    // Suitability threshold
    let statusClass = "weak";
    let statusText = "Weak Match";
    if (matchScore >= 75) {
      statusClass = "strong";
      statusText = "Strong Match";
    } else if (matchScore >= 50) {
      statusClass = "moderate";
      statusText = "Moderate Match";
    }

    // Color progress classes
    const scoreColorClass = matchScore >= 75 ? "green" : (matchScore >= 50 ? "amber" : "red");

    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td class="table-rank">#${rank}</td>
      <td class="table-name">${candidate.filename}</td>
      <td>
        <div class="table-score-wrapper">
          <span class="score-pill score-${scoreColorClass}">${matchScore}%</span>
          <div class="bar-outer">
            <div class="bar-inner bg-${scoreColorClass}" style="width: ${matchScore}%"></div>
          </div>
        </div>
      </td>
      <td>
        <div class="table-score-wrapper">
          <span class="score-pill score-${atsScore >= 80 ? 'green' : (atsScore >= 55 ? 'amber' : 'red')}">${atsScore}%</span>
        </div>
      </td>
      <td><span class="badge-status ${statusClass}">${statusText}</span></td>
      <td><button class="btn-details">View Details</button></td>
    `;

    // Click anywhere on row or button opens Candidate details report
    tr.addEventListener("click", () => {
      openReportModal(candidate.filename, candidate);
    });

    leaderboardBody.appendChild(tr);

    // Save batch candidate successfully parsed report to history as well!
    saveToHistory(candidate.filename, jd, candidate);
  });

  // Render failures
  failedCandidates.forEach((candidate) => {
    const tr = document.createElement("tr");
    tr.style.opacity = "0.75";
    tr.innerHTML = `
      <td class="table-rank">—</td>
      <td class="table-name" style="color: var(--red);">${candidate.filename}</td>
      <td colspan="3" style="font-family: var(--font-mono); font-size:12px; color: var(--text-muted)">
        Error: ${candidate.error || "Unknown parse failure"}
      </td>
      <td><button class="btn-details" disabled>Unavailable</button></td>
    `;
    leaderboardBody.appendChild(tr);
  });

  batchResultsPanel.scrollIntoView({ behavior: "smooth", block: "start" });
}

// ============================================================
// 5. DETAIL REPORT MODAL & CORE REPORT RENDERER
// ============================================================

modalOverlay.addEventListener("click", closeReportModal);
modalCloseBtn.addEventListener("click", closeReportModal);

// Escape key closes modal
window.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeReportModal();
});

function openReportModal(filename, reportData) {
  modalFilename.textContent = filename;
  renderDetailedReport(reportData, "modal-");
  detailModal.hidden = false;
  document.body.style.overflow = "hidden"; // disable background scrolling
}

function closeReportModal() {
  detailModal.hidden = true;
  document.body.style.overflow = ""; // restore scrolling
}

/**
 * Reusable Core Renderer that binds dynamic metrics to either the Dashboard or Details Modal
 * @param {Object} data Match report details
 * @param {String} prefix Prefix for HTML elements ("" for dashboard, "modal-" for modal view)
 */
function renderDetailedReport(data, prefix) {
  // Set Dials
  setDial(prefix + "match", data.match_score, matchCaption(data.match_score), prefix);
  setDial(prefix + "ats", data.ats_score, atsCaption(data.ats_score), prefix);

  // Chips
  renderChips(prefix + "matched-skills", data.matched_skills, false);
  renderChips(prefix + "missing-skills", data.missing_skills, true);
  renderChips(prefix + "matched-keywords", data.matched_keywords, false);
  renderChips(prefix + "missing-keywords", data.missing_keywords, true);

  // Checklist and Suggestions lists
  renderChecklist(prefix + "checklist", data.checklist);
  renderSuggestions(prefix + "suggestions", data.suggestions);
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

function setDial(idName, value, captionText, prefix) {
  const clamped = Math.max(0, Math.min(100, value));
  
  // Elements
  const fillEl = document.getElementById(prefix ? `${prefix}dial-fill-${idName.replace(prefix, '')}` : `dial-fill-${idName}`);
  const numberEl = document.getElementById(prefix ? `${prefix}${idName.replace(prefix, '')}-number` : `${idName}-number`);
  const captionEl = document.getElementById(prefix ? `${prefix}${idName.replace(prefix, '')}-caption` : `${idName}-caption`);

  if (fillEl) {
    requestAnimationFrame(() => {
      fillEl.setAttribute("stroke-dasharray", `${clamped} 100`);
    });
  }

  if (numberEl) animateNumber(numberEl, clamped);
  if (captionEl) captionEl.textContent = captionText;
}

function animateNumber(el, target) {
  const start = 0;
  const duration = 800;
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
  if (!container) return;
  
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

function renderChecklist(listId, checklist) {
  const list = document.getElementById(listId);
  if (!list) return;
  
  list.innerHTML = "";
  const iconFor = { pass: "✓", warn: "!", fail: "✕" };
  checklist.forEach(item => {
    const li = document.createElement("li");
    li.className = `status-${item.status}`;
    li.innerHTML = `<span class="status-icon">${iconFor[item.status]}</span><span>${item.label}</span>`;
    list.appendChild(li);
  });
}

function renderSuggestions(listId, suggestions) {
  const list = document.getElementById(listId);
  if (!list) return;
  
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

// Helper: draw dial ticks on load
function drawTicks(groupId) {
  const g = document.getElementById(groupId);
  if (!g) return;
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
    tick.setAttribute("stroke", "var(--border)");
    tick.setAttribute("stroke-width", "1.5");
    g.appendChild(tick);
  }
}

// Draw gauges gauges markings
drawTicks("dial-ticks-match");
drawTicks("dial-ticks-ats");
drawTicks("modal-dial-ticks-match");
drawTicks("modal-dial-ticks-ats");

// ============================================================
// 6. LOCAL STORAGE HISTORY LOGS CONTROLLER
// ============================================================

function loadHistory() {
  try {
    const dataStr = localStorage.getItem("fitscore_history");
    scanHistory = dataStr ? JSON.parse(dataStr) : [];
  } catch (e) {
    scanHistory = [];
  }
  updateHistoryBadge();
}

function updateHistoryBadge() {
  if (scanHistory.length > 0) {
    historyBadge.textContent = scanHistory.length;
    historyBadge.hidden = false;
  } else {
    historyBadge.hidden = true;
  }
}

function saveToHistory(filename, jdText, resultsData) {
  // Avoid saving redundant reports of the same file in history if same score
  const isDuplicate = scanHistory.some(item => 
    item.filename === filename && 
    item.results.match_score === resultsData.match_score &&
    item.results.ats_score === resultsData.ats_score
  );
  if (isDuplicate) return;

  const historyItem = {
    id: Date.now().toString() + Math.random().toString(36).substr(2, 5),
    filename: filename,
    timestamp: Date.now(),
    jdExcerpt: jdText.substring(0, 80) + (jdText.length > 80 ? "..." : ""),
    results: resultsData
  };

  scanHistory.unshift(historyItem); // Add to beginning
  // Limit cache to 30 items
  if (scanHistory.length > 30) {
    scanHistory.pop();
  }
  
  localStorage.setItem("fitscore_history", JSON.stringify(scanHistory));
  updateHistoryBadge();
}

function deleteHistoryItem(id, event) {
  if (event) event.stopPropagation(); // prevent modal trigger
  scanHistory = scanHistory.filter(item => item.id !== id);
  localStorage.setItem("fitscore_history", JSON.stringify(scanHistory));
  updateHistoryBadge();
  renderHistory();
}

// Bind delete history helper globally
window.deleteHistoryItem = deleteHistoryItem;

clearHistoryBtn.addEventListener("click", () => {
  if (confirm("Are you sure you want to clear your entire analysis history?")) {
    scanHistory = [];
    localStorage.removeItem("fitscore_history");
    updateHistoryBadge();
    renderHistory();
  }
});

function renderHistory() {
  historyListContainer.innerHTML = "";
  if (scanHistory.length === 0) {
    historyListContainer.innerHTML = '<div class="history-empty">Your analysis history is empty. Runs you execute will appear here.</div>';
    return;
  }

  scanHistory.forEach(item => {
    const formattedDate = new Date(item.timestamp).toLocaleString(undefined, {
      month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });

    const itemDiv = document.createElement("div");
    itemDiv.className = "history-item";
    
    // Suitability rating colors
    const scoreColorClass = item.results.match_score >= 75 ? "green" : (item.results.match_score >= 50 ? "val-amber" : "");
    const colorClassVal = item.results.match_score >= 75 ? "score-green" : (item.results.match_score >= 50 ? "score-amber" : "score-red");

    itemDiv.innerHTML = `
      <div class="history-meta">
        <span class="history-filename">${item.filename}</span>
        <span class="history-jd-snippet">${item.jdExcerpt}</span>
        <span class="history-date">${formattedDate}</span>
      </div>
      <div class="history-scores">
        <div class="history-score-badge">
          <span class="history-score-val ${scoreColorClass}">${item.results.match_score}%</span>
          <span class="history-score-lbl">Match</span>
        </div>
        <div class="history-score-badge">
          <span class="history-score-val ${item.results.ats_score >= 80 ? 'green' : (item.results.ats_score >= 55 ? 'val-amber' : '')}">${item.results.ats_score}%</span>
          <span class="history-score-lbl">ATS</span>
        </div>
        <div class="history-item-actions">
          <button class="btn-icon" title="Delete record" onclick="deleteHistoryItem('${item.id}', event)">✕</button>
        </div>
      </div>
    `;

    // Click card displays the modal cached report details instantly
    itemDiv.addEventListener("click", () => {
      openReportModal(item.filename, item.results);
    });

    historyListContainer.appendChild(itemDiv);
  });
}

// ============================================================
// 7. INITIALIZE APPLICATION
// ============================================================
document.addEventListener("DOMContentLoaded", () => {
  initTheme();
  initTabs();
  loadHistory();
});
// Trigger load directly if DOM is ready
if (document.readyState === "interactive" || document.readyState === "complete") {
  initTheme();
  initTabs();
  loadHistory();
}
