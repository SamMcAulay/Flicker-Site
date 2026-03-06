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

  document.getElementById("invite-btn").href = FLICKER_INVITE;
  document.getElementById("invite-hero-btn").href = FLICKER_INVITE;

  setupTabs();
  setupSaveButton();
  setupLogout();
  setupMobileMenu();
  initStarfield();
  await loadGuilds();
}

// ── UI Setup ──────────────────────────────────────────

function activateTab(target) {
  const tab = document.querySelector(`.nav-tab[data-tab="${target}"]`);
  if (!tab) return;
  document.querySelectorAll(".nav-tab").forEach((t) => t.classList.remove("active"));
  document.querySelectorAll(".tab-panel").forEach((p) => p.classList.remove("active"));
  tab.classList.add("active");
  document.getElementById("tab-" + target).classList.add("active");
  document.getElementById("tab-heading").textContent = tab.querySelector(".nav-label").textContent;
}

function setupTabs() {
  document.querySelectorAll(".nav-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      activateTab(tab.dataset.tab);
      history.replaceState(null, "", "#" + tab.dataset.tab);
      closeSidebar();
    });
  });

  // Restore tab from URL hash on load
  const hash = window.location.hash.slice(1);
  if (hash && document.querySelector(`.nav-tab[data-tab="${hash}"]`)) {
    activateTab(hash);
  }
}

function openSidebar() {
  document.querySelector(".sidebar").classList.add("open");
  document.getElementById("sidebar-backdrop").classList.add("open");
}

function closeSidebar() {
  document.querySelector(".sidebar").classList.remove("open");
  document.getElementById("sidebar-backdrop").classList.remove("open");
}

function setupMobileMenu() {
  document.getElementById("menu-toggle").addEventListener("click", openSidebar);
  document.getElementById("sidebar-backdrop").addEventListener("click", closeSidebar);
}

function setupSaveButton() {
  document.getElementById("save-btn").addEventListener("click", saveSettings);
}

function setupLogout() {
  document.getElementById("logout-btn").addEventListener("click", () => {
    clearToken();
    window.location.href = "/";
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
      document.getElementById("invite-panel").hidden = false;
      document.getElementById("save-btn").hidden = true;
      document.querySelectorAll(".tab-panel").forEach((p) => (p.hidden = true));
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
    renderProfileTab(currentSettings);
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

    const chat_toggles = {};
    document.querySelectorAll(".builtin-card[data-key]").forEach((card) => {
      chat_toggles[card.dataset.key] = card.classList.contains("is-on");
    });

    await api.saveSettings(currentGuildId, {
      game_toggles,
      event_toggles,
      command_toggles,
      payout_overrides,
      chat_toggles,
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

const ECONOMY_SECTIONS = [
  {
    title: "Slots",
    fields: [
      { key: "slots_jackpot",          label: "Jackpot (💎💎💎)", default: 10,  min: 1, max: 100, step: 1,   unit: "×", desc: "Diamond jackpot multiplier. Default: 10×" },
      { key: "slots_star_multiplier",  label: "Star (⭐⭐⭐)",    default: 5,   min: 1, max: 50,  step: 1,   unit: "×", desc: "Star triple multiplier. Default: 5×" },
      { key: "slots_fruit_multiplier", label: "Fruit (🍋🍋🍋)",   default: 3,   min: 1, max: 20,  step: 1,   unit: "×", desc: "Fruit triple multiplier. Default: 3×" },
      { key: "slots_cherry_multiplier",label: "Cherry (🍒🍒🍒)",  default: 2,   min: 1, max: 10,  step: 1,   unit: "×", desc: "Cherry triple multiplier. Default: 2×" },
    ],
  },
  {
    title: "Other Games",
    fields: [
      { key: "coinflip_multiplier",          label: "Coinflip — Win",             default: 2.0,  min: 1.1, max: 10.0, step: 0.1, unit: "×", desc: "Payout for a winning flip. Default: 2.0×" },
      { key: "blackjack_win_multiplier",     label: "Blackjack — Win",            default: 2.0,  min: 1.1, max: 5.0,  step: 0.1, unit: "×", desc: "Payout for beating the dealer. Default: 2.0×" },
      { key: "blackjack_natural_multiplier", label: "Blackjack — Natural 21",     default: 2.5,  min: 1.5, max: 10.0, step: 0.1, unit: "×", desc: "Payout for an instant blackjack. Default: 2.5×" },
      { key: "hilo_step",                    label: "HiLo — Step",                default: 0.2,  min: 0.1, max: 2.0,  step: 0.1, unit: "×", desc: "Multiplier added per correct guess. Default: +0.2×" },
      { key: "roulette_color_multiplier",    label: "Roulette — Color / Even-Odd",default: 1.9,  min: 1.1, max: 5.0,  step: 0.1, unit: "×", desc: "Red/black/odd/even payout. Default: 1.9×" },
      { key: "roulette_number_multiplier",   label: "Roulette — Straight Number", default: 35,   min: 10,  max: 100,  step: 1,   unit: "×", desc: "Specific number bet payout. Default: 35×" },
      { key: "warp_multiplier_step",         label: "Warp — Multiplier Per Jump", default: 1.5,  min: 1.1, max: 5.0,  step: 0.1, unit: "×", desc: "Multiplier growth per warp jump. Default: 1.5×" },
    ],
  },
  {
    title: "Drop Event",
    fields: [
      { type: "range", label: "1st Place", minKey: "drop_1_min", maxKey: "drop_1_max", minDefault: 10, maxDefault: 12, min: 1, max: 500, step: 1, unit: "✨", desc: "Stardust range for the first catcher. Default: 10–12" },
      { type: "range", label: "2nd Place", minKey: "drop_2_min", maxKey: "drop_2_max", minDefault: 8,  maxDefault: 10, min: 1, max: 500, step: 1, unit: "✨", desc: "Default: 8–10" },
      { type: "range", label: "3rd Place", minKey: "drop_3_min", maxKey: "drop_3_max", minDefault: 6,  maxDefault: 8,  min: 1, max: 500, step: 1, unit: "✨", desc: "Default: 6–8" },
      { type: "range", label: "4th Place", minKey: "drop_4_min", maxKey: "drop_4_max", minDefault: 4,  maxDefault: 6,  min: 1, max: 500, step: 1, unit: "✨", desc: "Default: 4–6" },
      { type: "range", label: "5th Place", minKey: "drop_5_min", maxKey: "drop_5_max", minDefault: 1,  maxDefault: 4,  min: 1, max: 500, step: 1, unit: "✨", desc: "Default: 1–4" },
    ],
  },
  {
    title: "Random Events",
    fields: [
      { type: "range", label: "Fast Type",     minKey: "fast_type_min",    maxKey: "fast_type_max",    minDefault: 10, maxDefault: 20,  min: 1, max: 500, step: 1, unit: "✨", desc: "Stardust reward for Fast Type. Default: 10–20" },
      { type: "range", label: "Math Puzzle",   minKey: "math_min",         maxKey: "math_max",         minDefault: 20, maxDefault: 40,  min: 1, max: 500, step: 1, unit: "✨", desc: "Default: 20–40" },
      { type: "range", label: "Trivia",        minKey: "trivia_min",       maxKey: "trivia_max",       minDefault: 50, maxDefault: 100, min: 1, max: 500, step: 1, unit: "✨", desc: "Default: 50–100" },
      { type: "range", label: "Word Scramble", minKey: "word_scramble_min",maxKey: "word_scramble_max",minDefault: 15, maxDefault: 30,  min: 1, max: 500, step: 1, unit: "✨", desc: "Default: 15–30" },
    ],
  },
];

function renderEconomyTab(settings) {
  const po = settings.payout_overrides;
  const container = document.getElementById("tab-economy");
  container.innerHTML = '<div class="economy-fields"></div>';
  const fields = container.querySelector(".economy-fields");

  ECONOMY_SECTIONS.forEach((section) => {
    const heading = document.createElement("h3");
    heading.className = "section-title";
    heading.innerHTML = `<span class="section-pip"></span>${section.title}`;
    fields.appendChild(heading);

    section.fields.forEach((field) => {
      const div = document.createElement("div");
      div.className = "economy-field";

      if (field.type === "range") {
        const minVal = po[field.minKey] ?? field.minDefault;
        const maxVal = po[field.maxKey] ?? field.maxDefault;
        div.innerHTML = `
          <div class="ef-header">
            <label class="ef-label">${field.label}</label>
            <button class="btn-reset" title="Reset to default">Reset to ${field.minDefault}–${field.maxDefault}</button>
          </div>
          <p class="ef-desc">${field.desc}</p>
          <div class="ef-input-row">
            <input type="number" class="number-input" data-key="${field.minKey}"
              value="${minVal}" min="${field.min}" max="${field.max}" step="${field.step}">
            <span class="ef-unit">–</span>
            <input type="number" class="number-input" data-key="${field.maxKey}"
              value="${maxVal}" min="${field.min}" max="${field.max}" step="${field.step}">
            <span class="ef-unit">${field.unit}</span>
          </div>
        `;
        div.querySelectorAll("input").forEach((i) => i.addEventListener("input", markDirty));
        div.querySelector(".btn-reset").addEventListener("click", () => {
          const [minInput, maxInput] = div.querySelectorAll("input");
          minInput.value = field.minDefault;
          maxInput.value = field.maxDefault;
          markDirty();
        });
      } else {
        const value = po[field.key] ?? field.default;
        div.innerHTML = `
          <div class="ef-header">
            <label class="ef-label">${field.label}</label>
            <button class="btn-reset" title="Reset to default">Reset to ${field.default}</button>
          </div>
          <p class="ef-desc">${field.desc}</p>
          <div class="ef-input-row">
            <input type="number" class="number-input" data-key="${field.key}"
              value="${value}" min="${field.min}" max="${field.max}" step="${field.step}">
            <span class="ef-unit">${field.unit}</span>
          </div>
        `;
        div.querySelector("input").addEventListener("input", markDirty);
        div.querySelector(".btn-reset").addEventListener("click", () => {
          div.querySelector("input").value = field.default;
          markDirty();
        });
      }

      fields.appendChild(div);
    });
  });
}

// ── Auto-Responder Tab ────────────────────────────────

function renderResponderTab(settings) {
  const container = document.getElementById("tab-responder");
  const chatToggles = settings.chat_toggles || {};
  const builtins = settings.builtin_groups || [];
  const groups = settings.response_groups || [];

  container.innerHTML = `
    <div class="rg-section">
      <h3 class="section-title"><span class="section-pip"></span>Built-in Groups</h3>
      <p class="tab-desc">These are Flicker's default response groups. Toggle them on or off per server. Changes are saved with the Save button.</p>
      <div class="rg-grid" id="builtin-groups"></div>
    </div>
    <div class="rg-section">
      <div class="rg-toolbar">
        <h3 class="section-title" style="margin-bottom:0"><span class="section-pip"></span>Custom Groups</h3>
        <button class="btn-new-group" id="show-new-group-btn">+ New Group</button>
      </div>
      <p class="tab-desc">Create your own response groups with multiple triggers and random replies.</p>
      <div class="group-form hidden" id="new-group-form">
        <div class="gf-row">
          <div class="rf-group rf-grow">
            <label class="ef-label">Group Name</label>
            <input type="text" id="gf-name" class="text-input" placeholder="e.g. Food">
          </div>
        </div>
        <div class="gf-row">
          <div class="rf-group rf-grow">
            <label class="ef-label">Trigger Words <span class="hint">(comma-separated)</span></label>
            <input type="text" id="gf-triggers" class="text-input" placeholder="pizza, food, hungry, eat">
          </div>
        </div>
        <div class="gf-row">
          <div class="rf-group rf-grow">
            <label class="ef-label">Responses <span class="hint">(one per line — Flicker picks randomly)</span></label>
            <textarea id="gf-responses" class="text-input gf-textarea" placeholder="Mmm, want some space fuel?&#10;Flicker doesn't eat but appreciates the sentiment!&#10;*stomach rumbles in binary*"></textarea>
          </div>
        </div>
        <div class="gf-actions">
          <button class="btn-add" id="gf-submit">Create Group</button>
          <button class="btn-cancel" id="gf-cancel">Cancel</button>
        </div>
      </div>
      <div id="custom-groups-list"></div>
    </div>
  `;

  // Render built-in group cards
  const builtinGrid = document.getElementById("builtin-groups");
  builtins.forEach((g) => {
    const isOn = chatToggles[g.key] !== false;
    const card = document.createElement("div");
    card.className = "rg-card builtin-card";
    card.dataset.key = g.key;
    card.innerHTML = `
      <div class="rg-card-header">
        <span class="rg-icon">${g.icon}</span>
        <span class="rg-name">${escapeHtml(g.name)}</span>
        <span class="tc-switch"><span class="tc-knob"></span></span>
      </div>
      <div class="rg-pills">${g.triggers.map(t => `<span class="rr-triggers">${escapeHtml(t)}</span>`).join("")}</div>
      <div class="rg-samples">${g.responses.slice(0, 2).map(r => `<span class="rg-sample">"${escapeHtml(r)}"</span>`).join("")}</div>
    `;
    applyGroupToggle(card, isOn);
    card.addEventListener("click", () => {
      applyGroupToggle(card, !card.classList.contains("is-on"));
      markDirty();
    });
    builtinGrid.appendChild(card);
  });

  // Render custom groups
  renderCustomGroups(groups);

  // New group form toggle
  document.getElementById("show-new-group-btn").addEventListener("click", () => {
    document.getElementById("new-group-form").classList.remove("hidden");
    document.getElementById("show-new-group-btn").classList.add("hidden");
  });
  document.getElementById("gf-cancel").addEventListener("click", () => {
    document.getElementById("new-group-form").classList.add("hidden");
    document.getElementById("show-new-group-btn").classList.remove("hidden");
    document.getElementById("gf-name").value = "";
    document.getElementById("gf-triggers").value = "";
    document.getElementById("gf-responses").value = "";
  });
  document.getElementById("gf-submit").addEventListener("click", submitNewGroup);
}

function applyGroupToggle(card, on) {
  card.classList.toggle("is-on", on);
  const knob = card.querySelector(".tc-knob");
  const sw = card.querySelector(".tc-switch");
  if (knob) knob.style.transform = on ? "translateX(20px)" : "";
  if (sw) sw.style.background = on ? "var(--accent)" : "";
}

function renderCustomGroups(groups) {
  const list = document.getElementById("custom-groups-list");
  if (!list) return;
  if (!groups.length) {
    list.innerHTML = '<p class="empty-state">No custom groups yet. Create one above.</p>';
    return;
  }
  list.innerHTML = "";
  groups.forEach((g) => {
    const triggers = JSON.parse(g.triggers);
    const responses = JSON.parse(g.responses);
    const card = document.createElement("div");
    card.className = "rg-card custom-card";
    card.dataset.id = g.id;
    card.innerHTML = `
      <div class="rg-card-header">
        <span class="rg-name">${escapeHtml(g.name)}</span>
        <span class="tc-switch rg-toggle"><span class="tc-knob"></span></span>
        <button class="btn-delete rg-delete" title="Delete group">✕</button>
      </div>
      <div class="rg-pills">${triggers.map(t => `<span class="rr-triggers">${escapeHtml(t)}</span>`).join("")}</div>
      <div class="rg-samples">${responses.map(r => `<span class="rg-sample">"${escapeHtml(r)}"</span>`).join("")}</div>
    `;
    applyGroupToggle(card, !!g.enabled);
    card.querySelector(".rg-toggle").addEventListener("click", (e) => {
      e.stopPropagation();
      toggleCustomGroup(card, g.id, !card.classList.contains("is-on"));
    });
    card.querySelector(".rg-delete").addEventListener("click", (e) => {
      e.stopPropagation();
      deleteCustomGroup(g.id);
    });
    list.appendChild(card);
  });
}

async function submitNewGroup() {
  const name = document.getElementById("gf-name").value.trim();
  const triggersRaw = document.getElementById("gf-triggers").value.trim();
  const responsesRaw = document.getElementById("gf-responses").value.trim();

  if (!name || !triggersRaw || !responsesRaw) {
    showToast("Fill in all fields.", "error");
    return;
  }

  const triggers = triggersRaw.split(",").map(t => t.trim().toLowerCase()).filter(Boolean);
  const responses = responsesRaw.split("\n").map(r => r.trim()).filter(Boolean);

  if (!triggers.length || !responses.length) {
    showToast("Need at least one trigger and one response.", "error");
    return;
  }

  const btn = document.getElementById("gf-submit");
  btn.disabled = true;
  btn.textContent = "Creating…";

  try {
    await api.addGroup(currentGuildId, name, triggers, responses);
    const settings = await api.getSettings(currentGuildId);
    currentSettings = settings;
    document.getElementById("gf-cancel").click();
    renderCustomGroups(settings.response_groups || []);
    showToast("Group created!", "success");
  } catch (err) {
    showToast("Failed to create group.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Create Group";
  }
}

async function toggleCustomGroup(card, groupId, enable) {
  try {
    await api.toggleGroup(currentGuildId, groupId, enable);
    applyGroupToggle(card, enable);
  } catch {
    showToast("Failed to update group.", "error");
  }
}

async function deleteCustomGroup(groupId) {
  if (!confirm("Delete this response group?")) return;
  try {
    await api.deleteGroup(currentGuildId, groupId);
    const settings = await api.getSettings(currentGuildId);
    currentSettings = settings;
    renderCustomGroups(settings.response_groups || []);
    showToast("Group deleted.", "success");
  } catch {
    showToast("Failed to delete group.", "error");
  }
}

// ── Profile Tab ──────────────────────────────────────

let pendingAvatarData = null;

function renderProfileTab(settings) {
  const container = document.getElementById("tab-profile");
  const profile = settings.bot_profile || {};
  const avatarUrl = profile.avatar_url || "";
  const nickname  = profile.nickname  || "";
  const prefix    = settings.prefix   || "!";

  container.innerHTML = `
    <div class="profile-section">
      <h3 class="section-title"><span class="section-pip"></span>Bot Profile</h3>
      <p class="tab-desc">Customise how Flicker appears in this server. Avatar and nickname are per-server.</p>

      <div class="profile-card">
        <div class="profile-avatar-area">
          ${avatarUrl ? `<img id="profile-avatar-preview" class="profile-avatar" src="${escapeHtml(avatarUrl)}" alt="Bot avatar">` : `<div id="profile-avatar-preview" class="profile-avatar profile-avatar-placeholder">🤖</div>`}
          <div class="profile-avatar-actions">
            <label class="btn-upload" for="profile-avatar-input">Upload Avatar</label>
            <input type="file" id="profile-avatar-input" accept="image/png,image/jpeg,image/gif,image/webp" hidden>
            <button id="profile-avatar-reset" class="btn-reset">Reset to Global</button>
          </div>
        </div>

        <div class="profile-fields">
          <div class="profile-field">
            <label class="ef-label">Nickname</label>
            <p class="ef-desc">Leave empty to use the bot's global username.</p>
            <input type="text" id="profile-nickname" class="text-input" value="${escapeHtml(nickname)}" placeholder="Flicker">
          </div>

          <div class="profile-field">
            <label class="ef-label">Command Prefix</label>
            <p class="ef-desc">The character(s) before commands, e.g. <strong>${escapeHtml(prefix)}pet</strong></p>
            <input type="text" id="profile-prefix" class="text-input profile-prefix-input" value="${escapeHtml(prefix)}" placeholder="!" maxlength="5">
          </div>
        </div>
      </div>

      <button id="profile-save-btn" class="btn-save profile-save">Update Profile</button>
    </div>
  `;

  pendingAvatarData = null;

  // Avatar file input
  document.getElementById("profile-avatar-input").addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      showToast("Image must be under 8 MB.", "error");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const preview = document.getElementById("profile-avatar-preview");
      // Replace a placeholder div with a real img if needed
      if (preview.tagName !== "IMG") {
        const img = document.createElement("img");
        img.id = "profile-avatar-preview";
        img.className = "profile-avatar";
        img.alt = "Bot avatar";
        preview.replaceWith(img);
      }
      document.getElementById("profile-avatar-preview").src = reader.result;
      pendingAvatarData = reader.result; // data URI
    };
    reader.readAsDataURL(file);
  });

  // Reset avatar
  document.getElementById("profile-avatar-reset").addEventListener("click", () => {
    pendingAvatarData = ""; // empty string signals "remove guild avatar"
    const preview = document.getElementById("profile-avatar-preview");
    if (preview.tagName === "IMG") preview.src = avatarUrl;
    showToast("Avatar will reset to global on save.", "info");
  });

  // Save profile
  document.getElementById("profile-save-btn").addEventListener("click", saveProfile);
}

async function saveProfile() {
  const btn = document.getElementById("profile-save-btn");
  btn.disabled = true;
  btn.textContent = "Saving…";

  const payload = {
    nickname: document.getElementById("profile-nickname").value.trim(),
    prefix: document.getElementById("profile-prefix").value.trim() || "!",
  };

  if (pendingAvatarData !== null) {
    payload.avatar = pendingAvatarData;
  }

  try {
    const res = await api.updateProfile(currentGuildId, payload);
    if (res.errors && res.errors.length) {
      showToast("Partial save: " + res.errors.join("; "), "error");
    } else {
      showToast("Profile updated!", "success");
    }
    pendingAvatarData = null;
    // Refresh settings to pick up new avatar URL
    currentSettings = await api.getSettings(currentGuildId);
    renderProfileTab(currentSettings);
  } catch (err) {
    showToast("Failed to update profile.", "error");
  } finally {
    btn.disabled = false;
    btn.textContent = "Update Profile";
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
    stars = Array.from({ length: 80 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.0 + 0.1,
      phase: Math.random() * Math.PI * 2,
      speed: Math.random() * 0.5 + 0.15,
      drift: (Math.random() - 0.5) * 0.04,
    }));
  };

  const draw = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const t = Date.now() / 1000;
    for (const s of stars) {
      const alpha = 0.03 + 0.10 * (0.5 + 0.5 * Math.sin(t * s.speed + s.phase));
      s.y -= 0.04;
      s.x += s.drift;
      if (s.y < -2) { s.y = canvas.height + 2; s.x = Math.random() * canvas.width; }
      ctx.beginPath();
      ctx.rect(s.x, s.y, s.r * 1.4, s.r * 1.4);
      ctx.fillStyle = `rgba(140, 180, 255, ${alpha})`;
      ctx.fill();
    }
    requestAnimationFrame(draw);
  };

  resize();
  draw();
  window.addEventListener("resize", resize);
}

document.addEventListener("DOMContentLoaded", init);
