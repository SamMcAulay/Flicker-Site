// ─────────────────────────────────────────────────────
//  Flicker Admin Dashboard
// ─────────────────────────────────────────────────────

let allGuilds = [];
let selectedGuildId = null;

// ── Auth check ────────────────────────────────────────

const payload = requireAuth();
if (payload) {
  if (!payload.is_admin) {
    alert("You don't have admin access.");
    window.location.href = "/";
  }
}

// ── Starfield ─────────────────────────────────────────

(function () {
  const canvas = document.getElementById("starfield");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let stars = [];

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function init() {
    stars = Array.from({ length: 120 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: Math.random() * 1.2 + 0.3,
      a: Math.random(),
      da: (Math.random() - 0.5) * 0.008,
    }));
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of stars) {
      s.a = Math.max(0.1, Math.min(1, s.a + s.da));
      if (s.a <= 0.1 || s.a >= 1) s.da *= -1;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(130,174,255,${s.a * 0.45})`;
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }

  window.addEventListener("resize", () => { resize(); init(); });
  resize();
  init();
  draw();
})();

// ── API helpers ───────────────────────────────────────

async function adminRequest(path, options = {}) {
  const token = sessionStorage.getItem("flicker_token");
  const res = await fetch(FLICKER_API + path, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: "Bearer " + token } : {}),
    },
    ...options,
  });
  if (res.status === 401 || res.status === 403) {
    sessionStorage.removeItem("flicker_token");
    window.location.href = "/";
    return null;
  }
  if (!res.ok) {
    const text = await res.text().catch(() => String(res.status));
    throw new Error("API error " + res.status + ": " + text);
  }
  return res.json();
}

// ── Guild list ────────────────────────────────────────

async function loadGuilds() {
  const data = await adminRequest("/admin/guilds");
  if (!data) return;
  allGuilds = data.guilds || [];
  renderGuildList(allGuilds);
}

function renderGuildList(guilds) {
  const list = document.getElementById("guild-list");
  if (!guilds.length) {
    list.innerHTML = '<div style="padding:24px 16px;color:var(--text-2);font-size:0.82rem;">No servers found.</div>';
    return;
  }

  list.innerHTML = guilds.map(g => {
    const initials = g.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
    const iconHtml = g.icon
      ? `<img class="guild-icon" src="${g.icon}" alt="${escapeHtml(g.name)}">`
      : `<div class="guild-icon-placeholder">${initials}</div>`;
    const disabledPill = g.bot_disabled
      ? `<span class="guild-disabled-pill">DISABLED</span>`
      : "";
    return `
      <div class="guild-item${g.id === selectedGuildId ? " active" : ""}"
           data-id="${g.id}" onclick="selectGuild('${g.id}')">
        ${iconHtml}
        <div class="guild-item-info">
          <div class="guild-item-name">${escapeHtml(g.name)}</div>
          <div class="guild-item-meta">${g.member_count?.toLocaleString() ?? "?"} members · ${g.user_count} in DB ${disabledPill}</div>
        </div>
      </div>`;
  }).join("");
}

document.getElementById("guild-search").addEventListener("input", (e) => {
  const q = e.target.value.toLowerCase();
  renderGuildList(allGuilds.filter(g => g.name.toLowerCase().includes(q)));
});

// ── Guild detail ──────────────────────────────────────

async function selectGuild(guildId) {
  selectedGuildId = guildId;

  // Update sidebar active state
  document.querySelectorAll(".guild-item").forEach(el => {
    el.classList.toggle("active", el.dataset.id === guildId);
  });

  const guild = allGuilds.find(g => g.id === guildId);
  if (!guild) return;

  document.getElementById("detail-heading").textContent = guild.name;
  document.getElementById("admin-body").innerHTML = renderDetailSkeleton(guild);

  // Fetch users
  const userData = await adminRequest(`/admin/guild/${guildId}/users`);
  if (!userData) return;

  const tbody = document.getElementById("users-tbody");
  if (!tbody) return;

  if (!userData.users.length) {
    tbody.innerHTML = '<tr><td colspan="4" class="loading-row">No users with a balance in this server.</td></tr>';
    return;
  }

  tbody.innerHTML = userData.users.map(u => buildUserRow(u)).join("");
  attachUserSearch(userData.users);
}

function renderDetailSkeleton(guild) {
  const initials = guild.name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const iconHtml = guild.icon
    ? `<img class="guild-icon" src="${guild.icon}" alt="${escapeHtml(guild.name)}">`
    : `<div class="guild-icon-placeholder" style="width:52px;height:52px;font-size:1.1rem;">${initials}</div>`;

  return `
    <div class="detail-guild-header">
      ${iconHtml}
      <div>
        <h2>${escapeHtml(guild.name)}</h2>
        <div class="meta">ID: ${guild.id} · ${guild.member_count?.toLocaleString() ?? "?"} members</div>
      </div>
    </div>

    <div class="stats-bar">
      <div class="stat-chip">
        <div class="stat-chip-label">Members</div>
        <div class="stat-chip-value">${guild.member_count?.toLocaleString() ?? "?"}</div>
      </div>
      <div class="stat-chip">
        <div class="stat-chip-label">Economy Users</div>
        <div class="stat-chip-value">${guild.user_count}</div>
      </div>
      <div class="stat-chip">
        <div class="stat-chip-label">Status</div>
        <div class="stat-chip-value" style="color:${guild.bot_disabled ? "var(--danger)" : "var(--success)"}">
          ${guild.bot_disabled ? "Disabled" : "Active"}
        </div>
      </div>
    </div>

    <div class="control-row">
      <div>
        <div class="control-row-label">Disable Bot in this Server</div>
        <div class="control-row-desc">When disabled, Flicker ignores all commands and events in this server.</div>
      </div>
      <label class="toggle-danger">
        <input type="checkbox" id="toggle-disabled" ${guild.bot_disabled ? "checked" : ""}
               onchange="toggleDisabled('${guild.id}', this.checked)">
        <div class="toggle-danger-track"></div>
        <span id="disabled-label">${guild.bot_disabled ? "Disabled" : "Active"}</span>
      </label>
    </div>

    <div class="section-header">
      <span class="section-title">Economy — User Balances</span>
      <input type="text" id="user-search" class="user-search" placeholder="Search users…">
    </div>

    <div class="users-table-wrap">
      <table class="users-table">
        <thead>
          <tr>
            <th>User</th>
            <th>Stardust</th>
            <th>Chips</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody id="users-tbody">
          <tr><td colspan="4" class="loading-row">Loading users…</td></tr>
        </tbody>
      </table>
    </div>`;
}

function buildUserRow(u) {
  const avatarHtml = u.avatar
    ? `<img class="user-avatar" src="${u.avatar}" alt="${escapeHtml(u.display_name)}">`
    : `<div class="user-avatar-placeholder">${(u.display_name || "?")[0].toUpperCase()}</div>`;

  return `
    <tr data-user-id="${u.user_id}" data-search="${escapeHtml((u.display_name + " " + u.username).toLowerCase())}">
      <td>
        <div class="user-cell">
          ${avatarHtml}
          <div>
            <div class="user-name">${escapeHtml(u.display_name)}</div>
            <div class="user-id">${u.user_id}</div>
          </div>
        </div>
      </td>
      <td>
        <input class="balance-input" type="number" min="0" value="${u.balance}"
               id="bal-${u.user_id}" data-original="${u.balance}">
      </td>
      <td>
        <input class="balance-input" type="number" min="0" value="${u.chips}"
               id="chips-${u.user_id}" data-original="${u.chips}">
      </td>
      <td>
        <button class="btn-save-row" onclick="saveBalance('${selectedGuildId}', '${u.user_id}')">Save</button>
        <span class="saved-flash" id="flash-${u.user_id}" hidden>✓ Saved</span>
      </td>
    </tr>`;
}

function attachUserSearch(users) {
  const input = document.getElementById("user-search");
  if (!input) return;
  input.addEventListener("input", () => {
    const q = input.value.toLowerCase();
    document.querySelectorAll("#users-tbody tr[data-user-id]").forEach(row => {
      row.hidden = q && !row.dataset.search.includes(q);
    });
  });
}

// ── Balance save ──────────────────────────────────────

async function saveBalance(guildId, userId) {
  const balInput = document.getElementById(`bal-${userId}`);
  const chipsInput = document.getElementById(`chips-${userId}`);
  const flashEl = document.getElementById(`flash-${userId}`);
  const btn = balInput?.closest("tr")?.querySelector(".btn-save-row");

  if (!balInput || !chipsInput) return;

  const balance = parseInt(balInput.value, 10);
  const chips = parseInt(chipsInput.value, 10);

  if (isNaN(balance) || isNaN(chips) || balance < 0 || chips < 0) {
    alert("Please enter valid non-negative numbers.");
    return;
  }

  if (btn) btn.disabled = true;

  try {
    await adminRequest(`/admin/guild/${guildId}/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({ balance, chips }),
    });

    balInput.dataset.original = balance;
    chipsInput.dataset.original = chips;

    if (flashEl) {
      flashEl.hidden = false;
      setTimeout(() => { flashEl.hidden = true; }, 2000);
    }
  } catch (err) {
    alert("Failed to save: " + err.message);
  } finally {
    if (btn) btn.disabled = false;
  }
}

// ── Disable toggle ────────────────────────────────────

async function toggleDisabled(guildId, disabled) {
  const label = document.getElementById("disabled-label");
  try {
    await adminRequest(`/admin/guild/${guildId}/toggle`, {
      method: "PATCH",
      body: JSON.stringify({ disabled }),
    });
    if (label) label.textContent = disabled ? "Disabled" : "Active";

    // Update cached guild data
    const g = allGuilds.find(x => x.id === guildId);
    if (g) g.bot_disabled = disabled;
    renderGuildList(allGuilds.filter(x => {
      const q = document.getElementById("guild-search")?.value?.toLowerCase() || "";
      return !q || x.name.toLowerCase().includes(q);
    }));
    // Re-mark active
    document.querySelectorAll(".guild-item").forEach(el => {
      el.classList.toggle("active", el.dataset.id === guildId);
    });

    // Update stat chip colour
    const statusChip = document.querySelector(".stat-chip-value[style*='color']");
    if (statusChip) {
      statusChip.style.color = disabled ? "var(--danger)" : "var(--success)";
      statusChip.textContent = disabled ? "Disabled" : "Active";
    }
  } catch (err) {
    alert("Failed to update status: " + err.message);
    // Revert toggle visually
    const cb = document.getElementById("toggle-disabled");
    if (cb) cb.checked = !disabled;
    if (label) label.textContent = !disabled ? "Disabled" : "Active";
  }
}

// ── Logout ────────────────────────────────────────────

document.getElementById("logout-btn").addEventListener("click", () => {
  clearToken();
  window.location.href = "/";
});

// ── Helpers ───────────────────────────────────────────

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ── Init ──────────────────────────────────────────────

loadGuilds();
