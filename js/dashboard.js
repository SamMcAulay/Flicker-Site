// ─────────────────────────────────────────────────────
//  Flicker Dashboard — Application Logic
// ─────────────────────────────────────────────────────
let currentGuildId = null;
let currentSettings = null;
let isDirty = false;

async function init() {
  // Handle OAuth callback: token lands in fragment here
  const hash = window.location.hash;
  if (hash.startsWith("#token=")) {
    setToken(hash.slice(7));
    history.replaceState(null, "", window.location.pathname);
  }

  if (!requireAuth()) return;

  setupTabs();
  setupSaveButton();
  setupLogout();
  initStarfield();
  await loadGuilds();
}

// ── UI Setup ──────────────────────────────────────────

function setupTabs() {
  document.querySelectorAll(".nav-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      const target = tab.dataset.tab;
      document.querySelectorAll(".nav-tab").forEach((t) => t.classList.remove("active"));
      document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
      tab.classList.add("active");
      document.getElementById("tab-" + target).classList.add("active");
      document.getElementById("tab-heading").textContent = tab.querySelector(".nav-label").textContent;
    });
  });
}

function setupSaveButton() {
  document.getElementById("save-btn").addEventListener("click", saveSettings);
}

function setupLogout() {
  document.getElementById("logout-btn").addEventListener("click", () => {
    clearToken();
    window.location.href = "index.html";
  });
}

// ── Guilds ────────────────────────────────────────────

async function loadGuilds() {
  setStatus("loading", "Connecting…");
  try {
    const guilds = await api.getGuilds();
    if (!guilds || guilds.length === 0) {
      setStatus("warning", "No servers found");
      document.getElementById("guild-selector").innerHTML =
        '<option value="">No servers available</option>';
      return;
    }

    const sel = document.getElementById("guild-selector");
    sel.innerHTML = guilds
      .map((g) => `<option value="${g.id}">${escapeHtml(g.name)}</option>`)
      .join("");

    sel.addEventListener("change", () => {
      if (isDirty && !confirm("You have unsaved changes. Switch server anyway?")) {
        sel.value = currentGuildId;
        return;
      }
      loadSettings(sel.value);
    });

    setStatus("connected", "● Connected");
    await loadSettings(guilds[0].id);
  } catch (err) {
    setStatus("error", "✕ Connection failed");
    console.error(err);
  }
}

// ── Settings ──────────────────────────────────────────

async function loadSettings(guildId) {
  currentGuildId = guildId;
  isDirty = false;
  const btn = document.getElementById("save-btn");
  btn.disabled = true;
  btn.textContent = "Save Changes";

  showLoading(true);
  try {
    currentSettings = await api.getSettings(guildId);
    renderTogglesTab(currentSettings);
    renderEconomyTab(currentSettings);
    renderResponderTab(currentSettings);
  } catch (err) {
    console.error("Failed to load settings:", err);
    showToast("Failed to load settings.", "error");
  } finally {
    showLoading(false);
  }
}

function markDirty() {
  isDirty = true;
  const btn = document.getElementById("save-btn");
  btn.disabled = false;
  btn.classList.add("dirty");
}

async function saveSettings() {
  const btn = document.getElementById("save-btn");
  btn.disabled = true;
  btn.textContent = "Saving…";

  try {
    const game_toggles = {};
    const event_toggles = {};
    const command_toggles = {};

    document.querySelectorAll(".toggle-input").forEach((input) => {
      const section = input.dataset.section;
      const key = input.dataset.key;
      if (section === "games") game_toggles[key] = input.checked;
      else if (section === "events") event_toggles[key] = input.checked;
      else if (section === "commands") command_toggles[key] = input.checked;
    });

    const payout_overrides = {};
    document.querySelectorAll(".number-input[data-key]").forEach((input) => {
      payout_overrides[input.dataset.key] = parseFloat(input.value);
    });

    await api.saveSettings(currentGuildId, {
      game_toggles,
      event_toggles,
      command_toggles,
      payout_overrides,
    });

    isDirty = false;
    btn.textContent = "✓ Saved";
    btn.classList.remove("dirty");
    setTimeout(() => {
      btn.textContent = "Save Changes";
    }, 2500);
    showToast("Settings saved!", "success");
  } catch (err) {
    btn.textContent = "Save Changes";
    btn.disabled = false;
    showToast("Failed to save. Please try again.", "error");
  }
}

// ── Toggles Tab ───────────────────────────────────────

const GAMES = [
  { key: "slots",     icon: "🎰", label: "Slots" },
  { key: "coinflip",  icon: "🪙", label: "Coinflip" },
  { key: "blackjack", icon: "🃏", label: "Blackjack" },
  { key: "hilo",      icon: "📈", label: "Higher/Lower" },
  { key: "roulette",  icon: "🎡", label: "Roulette" },
  { key: "warp",      icon: "🚀", label: "Hyperwarp" },
];
const EVENTS = [
  { key: "chat_drops",    icon: "✨", label: "Chat Drops" },
  { key: "trivia",        icon: "🧠", label: "Trivia" },
  { key: "math",          icon: "🧩", label: "Math Puzzle" },
  { key: "fast_type",     icon: "💫", label: "Fast Type" },
  { key: "word_scramble", icon: "🔤", label: "Word Scramble" },
];
const COMMANDS = [
  { key: "balance",  icon: "👛", label: "!balance" },
  { key: "pay",      icon: "💸", label: "!pay" },
  { key: "buychips", icon: "🎰", label: "!buychips" },
  { key: "top",      icon: "🏆", label: "!top" },
];

function renderTogglesTab(settings) {
  buildToggleSection("section-games",    "Games",    GAMES,    settings.game_toggles);
  buildToggleSection("section-events",   "Events",   EVENTS,   settings.event_toggles);
  buildToggleSection("section-commands", "Commands", COMMANDS, settings.command_toggles);
}

function buildToggleSection(containerId, title, items, toggleMap) {
  const container = document.getElementById(containerId);
  container.innerHTML = `<h3 class="section-title"><span class="section-pip"></span>${title}</h3>
    <div class="toggle-grid" id="${containerId}-grid"></div>`;
  const grid = document.getElementById(`${containerId}-grid`);

  items.forEach((item) => {
    const isOn = toggleMap[item.key] !== false;
    const label = document.createElement("label");
    label.className = "toggle-card" + (isOn ? " is-on" : "");
    label.innerHTML = `
      <span class="tc-icon">${item.icon}</span>
      <span class="tc-label">${item.label}</span>
      <span class="tc-switch">
        <span class="tc-knob"></span>
      </span>
      <input type="checkbox" ${isOn ? "checked" : ""} class="toggle-input"
        data-section="${containerId === "section-games" ? "games" : containerId === "section-events" ? "events" : "commands"}"
        data-key="${item.key}" hidden>
    `;
    label.querySelector("input").addEventListener("change", (e) => {
      label.classList.toggle("is-on", e.target.checked);
      markDirty();
    });
    grid.appendChild(label);
  });
}

// ── Economy Tab ───────────────────────────────────────

const ECONOMY_FIELDS = [
  {
    key: "slots_jackpot",
    label: "Slots Jackpot Multiplier",
    default: 10,
    min: 1, max: 100, step: 1,
    desc: "Payout multiplier for the 💎💎💎 jackpot. Default: 10×",
  },
  {
    key: "hilo_step",
    label: "HiLo Step Increment",
    default: 0.2,
    min: 0.1, max: 2.0, step: 0.1,
    desc: "Multiplier added per correct guess in HiLo. Default: +0.2× per step",
  },
  {
    key: "coinflip_multiplier",
    label: "Coinflip Win Multiplier",
    default: 2.0,
    min: 1.1, max: 10.0, step: 0.1,
    desc: "Payout multiplier for a winning coin flip. Default: 2.0×",
  },
];

function renderEconomyTab(settings) {
  const po = settings.payout_overrides;
  const container = document.getElementById("tab-economy");
  container.innerHTML = "";

  ECONOMY_FIELDS.forEach((field) => {
    const value = po[field.key] ?? field.default;
    const div = document.createElement("div");
    div.className = "economy-field";
    div.innerHTML = `
      <div class="ef-header">
        <label class="ef-label">${field.label}</label>
        <button class="btn-reset" data-default="${field.default}" title="Reset to default">Reset to ${field.default}</button>
      </div>
      <p class="ef-desc">${field.desc}</p>
      <div class="ef-input-row">
        <input type="number" class="number-input" data-key="${field.key}"
          value="${value}" min="${field.min}" max="${field.max}" step="${field.step}">
        <span class="ef-unit">×</span>
      </div>
    `;
    div.querySelector("input").addEventListener("input", markDirty);
    div.querySelector(".btn-reset").addEventListener("click", () => {
      div.querySelector("input").value = field.default;
      markDirty();
    });
    container.appendChild(div);
  });
}

// ── Auto-Responder Tab ────────────────────────────────

function renderResponderTab(settings) {
  const container = document.getElementById("tab-responder");
  container.innerHTML = `
    <p class="tab-desc">Add custom replies triggered when someone mentions Flicker and a matching word. Triggers are comma-separated.</p>
    <div class="responder-form">
      <div class="rf-row">
        <div class="rf-group">
          <label class="ef-label">Trigger Words</label>
          <input type="text" id="trigger-input" class="text-input" placeholder="pizza, food, hungry">
        </div>
        <div class="rf-group rf-grow">
          <label class="ef-label">Response Text</label>
          <input type="text" id="response-input" class="text-input" placeholder="What should Flicker say?">
        </div>
        <button id="add-response-btn" class="btn-add">+ Add</button>
      </div>
    </div>
    <div id="responses-list"></div>
  `;
  renderResponsesList(settings.custom_responses || []);
  document.getElementById("add-response-btn").addEventListener("click", addResponse);
}

function renderResponsesList(responses) {
  const list = document.getElementById("responses-list");
  if (!responses.length) {
    list.innerHTML = '<p class="empty-state">No custom responses yet. Add one above.</p>';
    return;
  }
  list.innerHTML = responses
    .map(
      (r) => `
    <div class="response-row" data-id="${r.id}">
      <span class="rr-triggers">${escapeHtml(r.trigger_words)}</span>
      <span class="rr-arrow">→</span>
      <span class="rr-text">${escapeHtml(r.response_text)}</span>
      <button class="btn-delete" data-id="${r.id}" title="Delete">✕</button>
    </div>`
    )
    .join("");

  list.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.addEventListener("click", () => deleteResponse(parseInt(btn.dataset.id)));
  });
}

async function addResponse() {
  const triggerInput = document.getElementById("trigger-input");
  const responseInput = document.getElementById("response-input");
  const triggers = triggerInput.value.trim();
  const response = responseInput.value.trim();

  if (!triggers || !response) {
    showToast("Fill in both trigger words and response text.", "error");
    return;
  }

  const btn = document.getElementById("add-response-btn");
  btn.disabled = true;
  btn.textContent = "Adding…";

  try {
    await api.addResponse(currentGuildId, triggers, response);
    triggerInput.value = "";
    responseInput.value = "";
    const settings = await api.getSettings(currentGuildId);
    currentSettings = settings;
    renderResponsesList(settings.custom_responses || []);
    showToast("Response added!", "success");
  } catch (err) {
    showToast("Failed to add response.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "+ Add";
  }
}

async function deleteResponse(responseId) {
  if (!confirm("Delete this response?")) return;
  try {
    await api.deleteResponse(currentGuildId, responseId);
    const settings = await api.getSettings(currentGuildId);
    currentSettings = settings;
    renderResponsesList(settings.custom_responses || []);
    showToast("Response deleted.", "success");
  } catch {
    showToast("Failed to delete response.", "error");
  }
}

// ── Helpers ───────────────────────────────────────────

function setStatus(cls, text) {
  const el = document.getElementById("status");
  el.className = "status " + cls;
  el.textContent = text;
}

function showLoading(show) {
  document.getElementById("loading-overlay").style.display = show ? "flex" : "none";
}

function showToast(message, type = "info") {
  const t = document.createElement("div");
  t.className = "toast toast-" + type;
  t.textContent = message;
  document.body.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 300);
  }, 3000);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function initStarfield() {
  const canvas = document.getElementById("starfield");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let stars = [];

  const resize = () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    stars = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.2 + 0.2,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.8 + 0.3,
    }));
  };

  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const t = Date.now() / 1000;
    for (const s of stars) {
      const alpha = 0.15 + 0.25 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180, 160, 255, ${alpha})`;
      ctx.fill();
    }
    requestAnimationFrame(draw);
  };

  resize();
  draw();
  window.addEventListener("resize", resize);
}

document.addEventListener("DOMContentLoaded", init);
