/**
 * WasteWise AI — front-end prototype
 *
 * REAL AI HOOK
 * ------------
 * This file simulates the ML pipeline for a hackathon demo (no backend).
 * In production, replace mockClassify() with:
 *   1) A CNN / vision transformer waste classifier (e.g. TensorFlow.js,
 *      ONNX Runtime Web, or a REST call to a GPU service).
 *   2) A separate hazard / smoke / flammable-material detector whose
 *      output can override or augment the material class.
 *   3) Optional OCR / barcode lookup for packaged goods.
 */

const STORAGE_KEYS = {
  points: "wastewise_points",
  history: "wastewise_history",
  streak: "wastewise_streak",
  lastDay: "wastewise_last_day",
  lastSession: "wastewise_last_session_id",
};

const CATEGORIES = [
  {
    id: "plastic",
    label: "Plastic",
    display: "Plastic Waste",
    icon: "🧴",
    lucide: "recycle",
    actionTitle: "Recycle — Blue bin",
    action: "Rinse and place in the Recyclable Bin (Blue)",
    hazardous: false,
  },
  {
    id: "paper",
    label: "Paper",
    display: "Paper Waste",
    icon: "📄",
    lucide: "file-text",
    actionTitle: "Paper recycling",
    action: "Flatten and place in the Paper Recycling Bin",
    hazardous: false,
  },
  {
    id: "organic",
    label: "Organic/Food Waste",
    display: "Organic / Food Waste",
    icon: "🍃",
    lucide: "sprout",
    actionTitle: "Compost",
    action: "Place in Compost/Wet Waste Bin",
    hazardous: false,
  },
  {
    id: "ewaste",
    label: "E-Waste",
    display: "E-Waste",
    icon: "🔋",
    lucide: "cpu",
    actionTitle: "Special collection",
    action: "Take to nearest E-Waste collection point — do not throw in regular bins",
    hazardous: false,
  },
  {
    id: "glass",
    label: "Glass",
    display: "Glass Waste",
    icon: "🫙",
    lucide: "glass-water",
    actionTitle: "Glass recycling",
    action: "Place in Glass Recycling Bin — handle carefully",
    hazardous: false,
  },
  {
    id: "metal",
    label: "Metal",
    display: "Metal Waste",
    icon: "🛠️",
    lucide: "wrench",
    actionTitle: "Metal recycling",
    action: "Place in Metal Recycling Bin",
    hazardous: false,
  },
  {
    id: "hazardous",
    label: "Hazardous/Flammable",
    display: "Hazardous / Flammable Waste",
    icon: "☢️",
    lucide: "flame",
    actionTitle: "Hazardous waste facility",
    action: "Do NOT dispose in regular trash — contact hazardous waste facility",
    hazardous: true,
  },
];

const LEVELS = [
  { level: 1, min: 0, max: 50 },
  { level: 2, min: 51, max: 150 },
  { level: 3, min: 151, max: 300 },
  { level: 4, min: 301, max: 500 },
  { level: 5, min: 501, max: Infinity },
];

const POINTS_PER_ACTION = 10;
const MAX_HISTORY = 60;

const state = {
  fileName: "",
  dataUrl: "",
  thumbUrl: "",
  pending: null,
  confirmed: false,
  chart: null,
};

function loadState() {
  const points = Number(localStorage.getItem(STORAGE_KEYS.points) || 0);
  let history = [];
  try {
    history = JSON.parse(localStorage.getItem(STORAGE_KEYS.history) || "[]");
  } catch {
    history = [];
  }
  let streak = Number(localStorage.getItem(STORAGE_KEYS.streak) || 0);
  const lastDay = localStorage.getItem(STORAGE_KEYS.lastDay) || "";
  return { points, history, streak, lastDay };
}

function savePartial(partial) {
  const current = loadState();
  const next = { ...current, ...partial };
  localStorage.setItem(STORAGE_KEYS.points, String(next.points));
  localStorage.setItem(STORAGE_KEYS.history, JSON.stringify(next.history));
  localStorage.setItem(STORAGE_KEYS.streak, String(next.streak));
  localStorage.setItem(STORAGE_KEYS.lastDay, next.lastDay);
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayKey() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Session streak: increment once per browser session if this is a new
 * calendar day of activity. Consecutive days grow the streak; a gap resets it.
 */
function bumpSessionStreak() {
  const sessionId = sessionStorage.getItem("wastewise_session") || crypto.randomUUID();
  sessionStorage.setItem("wastewise_session", sessionId);

  const already = localStorage.getItem(STORAGE_KEYS.lastSession);
  if (already === sessionId) return loadState().streak;

  const { streak, lastDay } = loadState();
  const today = todayKey();
  let next = streak;
  if (!lastDay) next = Math.max(1, streak || 1);
  else if (lastDay === today) next = Math.max(1, streak);
  else if (lastDay === yesterdayKey()) next = streak + 1;
  else next = 1;

  localStorage.setItem(STORAGE_KEYS.lastSession, sessionId);
  savePartial({ streak: next, lastDay: lastDay || today });
  return next;
}

function hashString(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

/**
 * REAL AI HOOK — mockClassify()
 * Swap this function with model.predict(imageTensor).
 * Keep the return shape { categoryId, confidence, hazardScore } so the UI stays the same.
 *
 * REAL AI HOOK — hazard model
 * Run a second network (smoke / flame / chemical-label detector). If hazardScore
 * exceeds a threshold, force categoryId = "hazardous" even if the material CNN
 * predicted Plastic/Metal/etc.
 */
function mockClassify(fileName) {
  const idx = hashString(fileName || "untitled") % CATEGORIES.length;
  const category = CATEGORIES[idx];
  const confidence = 86 + (hashString(fileName + ":conf") % 13);
  const hazardScore = category.hazardous ? 0.91 : 0.04 + (hashString(fileName + ":hz") % 12) / 100;
  return {
    categoryId: category.id,
    confidence,
    hazardScore,
  };
}

/**
 * Call backend classifier if available. Falls back to in-browser mockClassify.
 * Expects FormData with `image` file field; returns { categoryId, confidence, hazardScore }
 */
async function backendClassify(file) {
  if (!file) return mockClassify(file && file.name);
  try {
    const fd = new FormData();
    fd.append("image", file, file.name);
    const resp = await fetch("/api/classify", { method: "POST", body: fd });
    if (!resp.ok) throw new Error("Server error");
    const json = await resp.json();
    return json;
  } catch (err) {
    return mockClassify(file && file.name);
  }
}

function getLevel(points) {
  return LEVELS.find((l) => points >= l.min && points <= l.max) || LEVELS[LEVELS.length - 1];
}

function levelProgress(points) {
  const lvl = getLevel(points);
  if (!Number.isFinite(lvl.max)) {
    return { pct: 100, label: `${points} points · max level`, lvl };
  }
  const span = lvl.max - lvl.min + 1;
  const into = points - lvl.min;
  const pct = Math.min(100, Math.round((into / span) * 100));
  return { pct, label: `${points} / ${lvl.max} points to Level ${lvl.level + 1}`, lvl };
}

function $(id) {
  return document.getElementById(id);
}

function showPage(name) {
  document.querySelectorAll(".page").forEach((p) => p.classList.remove("active"));
  const page = document.getElementById(`page-${name}`);
  if (page) page.classList.add("active");
  document.querySelectorAll(".nav-links a").forEach((a) => {
    a.classList.toggle("active", a.dataset.nav === name);
  });
  $("navLinks").classList.remove("open");
  if (name === "history" || name === "dashboard") refreshAnalytics();
  if (name === "rewards") {
    // If React widget is loaded, it will mount itself; avoid double-rendering
    if (!window.__REACT_REWARDS_MOUNTED) loadRewards();
  }
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function refreshHeader() {
  const { points, streak } = loadState();
  $("navPoints").textContent = points;
  $("navStreak").textContent = streak;
}

function refreshAnalytics() {
  const { points, history, streak } = loadState();
  const confirmed = history.filter((h) => h.points > 0);
  $("statItems").textContent = String(history.length);
  $("statPoints").textContent = String(points);
  $("statStreak").textContent = `${streak} day${streak === 1 ? "" : "s"}`;
  $("statKg").textContent = `${(confirmed.length * 0.2).toFixed(1)} kg`;

  const counts = {};
  history.forEach((h) => {
    counts[h.categoryId] = (counts[h.categoryId] || 0) + 1;
  });
  const top = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  $("statCommon").textContent = top
    ? CATEGORIES.find((c) => c.id === top[0])?.label || top[0]
    : "—";

  const prog = levelProgress(points);
  $("levelBadge").textContent = `Level ${prog.lvl.level}`;
  $("levelFill").style.width = `${prog.pct}%`;
  $("levelProgressLabel").textContent = prog.label;
  $("levelCopy").textContent =
    prog.lvl.level >= 5
      ? "You are a WasteWise champion. Keep diverting waste from landfill."
      : "Keep logging correct disposal actions to level up.";

  renderHistoryTable(history);
  renderChart(counts, history);
}

// Rewards: fetch catalog and render
async function loadRewards() {
  const grid = document.getElementById("rewardsGrid");
  let rewards = null;
  try {
    const resp = await fetch("/api/rewards");
    if (resp.ok) rewards = await resp.json();
  } catch (e) {
    rewards = null;
  }
  if (!rewards) {
    // fallback catalog if server is not running
    rewards = [
      { id: "sticker_pack", title: "Sticker Pack", cost: 30, description: "A set of WasteWise neon stickers." },
      { id: "reusable_bottle", title: "Reusable Bottle", cost: 120, description: "Branded 500ml reusable bottle." },
      { id: "donation_5", title: "Donate $5", cost: 200, description: "Donate $5 to local cleanup initiatives." },
    ];
  }
  const { points } = loadState();
  grid.innerHTML = "";
  rewards.forEach((r) => {
    const div = document.createElement("div");
    div.className = "reward-card";
    div.innerHTML = `
      <h4>${r.title}</h4>
      <p class="reward-meta">${r.description}</p>
      <div class="reward-actions">
        <strong style="margin-left:auto">${r.cost} pts</strong>
        <button class="btn btn-primary btn-sm" data-id="${r.id}" ${points < r.cost ? 'disabled' : ''}>Redeem</button>
      </div>
    `;
    grid.appendChild(div);
  });
  grid.querySelectorAll("button[data-id]").forEach((b) => {
    b.addEventListener("click", async () => {
      const id = b.dataset.id;
      b.disabled = true;
      const res = await fetch("/api/redeem", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rewardId: id }),
      });
      const out = document.getElementById("redeemResult");
      if (!res.ok) {
        out.style.display = "block";
        out.textContent = "Redeem failed.";
        b.disabled = false;
        return;
      }
      const json = await res.json();
      // Deduct points locally — in production this must be server-verified
      const stateNow = loadState();
      const remaining = Math.max(0, stateNow.points - json.reward.cost);
      savePartial({ points: remaining });
      refreshHeader();
      out.style.display = "block";
      out.textContent = `Redeemed: ${json.reward.title} (cost ${json.reward.cost} pts)`;
      // update buttons disabled state
      loadRewards();
    });
  });
}

function renderHistoryTable(history) {
  const body = $("historyBody");
  const empty = $("historyEmpty");
  body.innerHTML = "";
  if (!history.length) {
    empty.classList.remove("hidden");
    return;
  }
  empty.classList.add("hidden");
  history
    .slice()
    .reverse()
    .forEach((item) => {
      const cat = CATEGORIES.find((c) => c.id === item.categoryId);
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${item.thumb ? `<img class="thumb" src="${item.thumb}" alt="" />` : "—"}</td>
        <td>${cat ? cat.display : item.categoryId}</td>
        <td>${item.action}</td>
        <td>${new Date(item.at).toLocaleString()}</td>
        <td>+${item.points}</td>
      `;
      body.appendChild(tr);
    });
}

function renderChart(counts, history) {
  const canvas = $("historyChart");
  if (!canvas || typeof Chart === "undefined") return;
  const labels = CATEGORIES.map((c) => c.label);
  const data = CATEGORIES.map((c) => counts[c.id] || 0);
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const plasticWeek = history.filter(
    (h) => h.categoryId === "plastic" && new Date(h.at).getTime() >= weekAgo
  ).length;
  $("chartCaption").textContent = history.length
    ? `You've scanned ${plasticWeek} plastic item${plasticWeek === 1 ? "" : "s"} this week · ${history.length} total scans.`
    : "Scan items to see your recycling mix.";

  if (state.chart) state.chart.destroy();
  state.chart = new Chart(canvas, {
    type: "bar",
    data: {
      labels,
      datasets: [
        {
          label: "Items scanned",
          data,
          backgroundColor: [
            "#028090",
            "#97BC62",
            "#02C39A",
            "#2C5F2D",
            "#56cfe1",
            "#7b8cde",
            "#c1121f",
          ],
          borderRadius: 8,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true, ticks: { precision: 0 } } },
    },
  });
}

function setPreview(dataUrl) {
  $("previewImage").src = dataUrl;
  $("previewWrap").classList.remove("hidden");
  $("dropzoneEmpty").classList.add("hidden");
  $("detectBtn").disabled = false;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function makeThumb(dataUrl, size = 96) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = size;
      canvas.height = size;
      const ctx = canvas.getContext("2d");
      const scale = Math.max(size / img.width, size / img.height);
      const w = img.width * scale;
      const h = img.height * scale;
      ctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.6));
    };
    img.onerror = () => resolve("");
    img.src = dataUrl;
  });
}

async function handleFile(file) {
  if (!file || !file.type.startsWith("image/")) return;
  state.fileName = file.name || "capture.jpg";
  state.dataUrl = await fileToDataUrl(file);
  state.thumbUrl = await makeThumb(state.dataUrl);
  state.pending = null;
  state.confirmed = false;
  setPreview(state.dataUrl);
  $("resultIdle").classList.remove("hidden");
  $("analyzing").classList.add("hidden");
  $("resultBody").classList.add("hidden");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function detectWaste() {
  if (!state.dataUrl) return;

  $("resultIdle").classList.add("hidden");
  $("resultBody").classList.add("hidden");
  $("analyzing").classList.remove("hidden");
  $("analyzeFill").style.animation = "none";
  void $("analyzeFill").offsetWidth;
  $("analyzeFill").style.animation = "loadBar 1.8s ease forwards";

  const steps = [
    "Preparing image tensor…",
    "Running CNN waste classifier…",
    "Running hazard / smoke detection model…",
    "Generating action recommendation…",
  ];
  for (let i = 0; i < steps.length; i += 1) {
    $("analyzeStep").textContent = steps[i];
    await sleep(450);
  }

  // REAL AI HOOK: const prediction = await wasteModel.classify(imageElement)
  // REAL AI HOOK: const hazard = await hazardModel.detect(imageElement)
  // Try backend first, otherwise fallback to local mock
  const fileInput = document.querySelector('#wasteFile');
  const file = fileInput && fileInput.files && fileInput.files[0];
  const prediction = await backendClassify(file || { name: state.fileName });
  const category = CATEGORIES.find((c) => c.id === prediction.categoryId);
  const historyId = crypto.randomUUID();
  state.pending = { ...prediction, category, historyId };
  state.confirmed = false;

  const { history } = loadState();
  const scanEntry = {
    id: historyId,
    categoryId: category.id,
    action: "Detected — action not confirmed yet",
    confidence: prediction.confidence,
    at: new Date().toISOString(),
    points: 0,
    thumb: state.thumbUrl,
    fileName: state.fileName,
  };
  savePartial({ history: [...history, scanEntry].slice(-MAX_HISTORY) });

  $("analyzing").classList.add("hidden");
  $("resultBody").classList.remove("hidden");
  $("confidenceText").textContent = `${prediction.confidence}% confident`;
  $("categoryTitle").textContent = category.display;
  $("resultIcon").textContent = category.icon;

  const banner = $("hazardBanner");
  if (category.hazardous) {
    banner.innerHTML =
      '<div class="banner danger">⚠️ Hazard Detected — Do not mix with regular waste. Handle with care.</div>';
  } else {
    banner.innerHTML = '<div class="banner safe">Safe to handle</div>';
  }

  $("actionCard").innerHTML = `
    <span class="cat-icon">${category.icon}</span>
    <div>
      <h4>${category.actionTitle}</h4>
      <p>${category.action}</p>
    </div>
  `;

  $("confirmActionBtn").disabled = false;
  $("confirmHint").textContent = "Log this action to update history, streak, and your eco score.";
}

function confirmAction() {
  if (!state.pending || state.confirmed) return;
  const { category, historyId } = state.pending;
  const { points, history, streak, lastDay } = loadState();
  const today = todayKey();
  let nextStreak = streak;
  if (!lastDay || lastDay === today) nextStreak = Math.max(streak, 1);
  else if (lastDay === yesterdayKey()) nextStreak = streak + 1;
  else nextStreak = 1;

  const nextHistory = history.map((item) =>
    item.id === historyId
      ? {
          ...item,
          action: category.action,
          points: POINTS_PER_ACTION,
          at: new Date().toISOString(),
        }
      : item
  );

  savePartial({
    points: points + POINTS_PER_ACTION,
    history: nextHistory,
    streak: nextStreak,
    lastDay: today,
  });
  state.confirmed = true;
  $("confirmActionBtn").disabled = true;
  $("confirmHint").textContent = `Logged +${POINTS_PER_ACTION} eco points. Great work.`;
  refreshHeader();
}

function bindNav() {
  document.querySelectorAll("[data-nav]").forEach((el) => {
    el.addEventListener("click", (e) => {
      const name = el.getAttribute("data-nav");
      if (!name) return;
      e.preventDefault();
      location.hash = name;
      showPage(name);
    });
  });
  $("menuToggle").addEventListener("click", () => {
    $("navLinks").classList.toggle("open");
  });
  window.addEventListener("hashchange", () => {
    const name = (location.hash || "#home").replace("#", "") || "home";
    showPage(name);
  });
}

function bindUpload() {
  const input = $("wasteFile");
  const zone = $("dropzone");
  $("pickImageBtn").addEventListener("click", () => input.click());
  zone.addEventListener("click", () => input.click());
  zone.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      input.click();
    }
  });
  input.addEventListener("change", () => {
    if (input.files[0]) handleFile(input.files[0]);
  });
  ["dragenter", "dragover"].forEach((ev) => {
    zone.addEventListener(ev, (e) => {
      e.preventDefault();
      zone.classList.add("dragover");
    });
  });
  ["dragleave", "drop"].forEach((ev) => {
    zone.addEventListener(ev, (e) => {
      e.preventDefault();
      zone.classList.remove("dragover");
    });
  });
  zone.addEventListener("drop", (e) => {
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  });
  $("detectBtn").addEventListener("click", detectWaste);
  $("confirmActionBtn").addEventListener("click", confirmAction);
}

function initIcons() {
  if (window.lucide) window.lucide.createIcons();
}

function boot() {
  bumpSessionStreak();
  refreshHeader();
  bindNav();
  bindUpload();
  initIcons();
  const name = (location.hash || "#home").replace("#", "") || "home";
  showPage(name);
}

// When rewards page is shown, load rewards
window.addEventListener("hashchange", () => {
  const name = (location.hash || "#home").replace("#", "") || "home";
  if (name === "rewards") loadRewards();
});

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}
