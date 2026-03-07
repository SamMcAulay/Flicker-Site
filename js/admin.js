// ─────────────────────────────────────────────────────
//  Flicker Admin Dashboard
// ─────────────────────────────────────────────────────

// ── Auth ──────────────────────────────────────────────
const _payload = requireAuth();
if (_payload && !_payload.is_admin) {
  alert("You don't have admin access.");
  window.location.href = "/";
}

// ── State ─────────────────────────────────────────────
let allGuilds = [];
let selectedGuildId = null;
let currentView = "guilds";
let currentDetailTab = "overview";

// ── Starfield ─────────────────────────────────────────
(function () {
  const canvas = document.getElementById("starfield");
  if (!canvas) return;
  const ctx = canvas.getContext("2d");
  let stars = [];
  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  function init() {
    stars = Array.from({ length: 100 }, () => ({
      x: Math.random() * canvas.width, y: Math.random() * canvas.height,
      r: Math.random() * 1.1 + 0.3, a: Math.random(),
      da: (Math.random() - 0.5) * 0.007,
    }));
  }
  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of stars) {
      s.a = Math.max(0.08, Math.min(1, s.a + s.da));
      if (s.a <= 0.08 || s.a >= 1) s.da *= -1;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(130,174,255,${s.a * 0.4})`;
      ctx.fill();
    }
    requestAnimationFrame(draw);
  }
  window.addEventListener("resize", () => { resize(); init(); });
  resize(); init(); draw();
})();

// ── API ───────────────────────────────────────────────
async function adminReq(path, options = {}) {
  const token = sessionStorage.getItem("flicker_token");
  const res = await fetch(FLICKER_API + path, {
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: "Bearer " + token } : {}) },
    ...options,
  });
  if (res.status === 401 || res.status === 403) {
    sessionStorage.removeItem("flicker_token");
    window.location.href = "/";
    return null;
  }
  if (!res.ok) {
    const text = await res.text().catch(() => String(res.status));
    throw new Error(text || "Error " + res.status);
  }
  return res.json();
}

// ── Nav ───────────────────────────────────────────────
document.querySelectorAll(".admin-nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".admin-nav-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentView = btn.dataset.view;
    document.getElementById("guild-section").style.display = currentView === "guilds" ? "flex" : "none";
    selectedGuildId = null;
    renderView();
  });
});

function renderView() {
  switch (currentView) {
    case "guilds":   renderGuildsEmpty(); break;
    case "health":   renderHealthPanel(); break;
    case "lookup":   renderLookupPanel(); break;
    case "blocks":   renderBlocksPanel(); break;
    case "audit":    renderAuditPanel(); break;
  }
}

// ── Guild list ────────────────────────────────────────
async function loadGuilds() {
  const data = await adminReq("/admin/guilds");
  if (!data) return;
  allGuilds = data.guilds || [];
  renderGuildList(allGuilds);
}

function renderGuildList(guilds) {
  const list = document.getElementById("guild-list");
  if (!guilds.length) {
    list.innerHTML = '<div style="padding:18px 14px;color:var(--text-2);font-size:0.8rem;">No servers found.</div>';
    return;
  }
  list.innerHTML = guilds.map(g => {
    const init = g.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "??";
    const icon = g.icon
      ? `<img class="g-icon" src="${g.icon}" alt="">`
      : `<div class="g-icon-placeholder">${init}</div>`;
    const pill = g.bot_disabled ? ` <span class="g-disabled-pill">OFF</span>` : "";
    return `<div class="guild-item${g.id === selectedGuildId ? " active" : ""}" data-id="${g.id}" onclick="selectGuild('${g.id}')">
      ${icon}
      <div class="g-info">
        <div class="g-name">${esc(g.name)}</div>
        <div class="g-meta">${(g.member_count || 0).toLocaleString()} members${pill}</div>
      </div>
    </div>`;
  }).join("");
}

document.getElementById("guild-search").addEventListener("input", e => {
  const q = e.target.value.toLowerCase();
  renderGuildList(allGuilds.filter(g => g.name.toLowerCase().includes(q)));
});

function renderGuildsEmpty() {
  setMain("Admin Dashboard", `<div class="empty-state"><span class="icon">🖥️</span><p>Select a server from the sidebar.</p></div>`);
}

// ── Guild detail ──────────────────────────────────────
async function selectGuild(guildId) {
  if (currentView !== "guilds") {
    document.querySelector('[data-view="guilds"]').click();
    await new Promise(r => setTimeout(r, 0));
  }
  selectedGuildId = guildId;
  document.querySelectorAll(".guild-item").forEach(el => el.classList.toggle("active", el.dataset.id === guildId));
  const guild = allGuilds.find(g => g.id === guildId);
  if (!guild) return;
  currentDetailTab = "overview";
  setMain(guild.name, buildGuildDetail(guild));
  loadDetailTab("overview", guild);
}

function buildGuildDetail(guild) {
  const init = guild.name.replace(/[^A-Za-z0-9]/g, "").slice(0, 2).toUpperCase() || "??";
  const icon = guild.icon ? `<img class="g-icon" src="${guild.icon}" alt="">` : `<div class="g-icon-placeholder">${init}</div>`;
  return `
    <div class="detail-guild-header">
      ${icon}
      <div>
        <h2>${esc(guild.name)}</h2>
        <div class="meta">ID: ${guild.id} · ${(guild.member_count || 0).toLocaleString()} members</div>
      </div>
    </div>
    <div class="detail-tabs">
      <button class="detail-tab-btn active" data-dtab="overview">Overview</button>
      <button class="detail-tab-btn" data-dtab="economy">Economy</button>
      <button class="detail-tab-btn" data-dtab="channels">Channels</button>
      <button class="detail-tab-btn" data-dtab="actions">Actions</button>
    </div>
    <div id="detail-panel-overview" class="detail-panel active"></div>
    <div id="detail-panel-economy" class="detail-panel"></div>
    <div id="detail-panel-channels" class="detail-panel"></div>
    <div id="detail-panel-actions" class="detail-panel"></div>`;
}

document.getElementById("admin-body").addEventListener("click", e => {
  const btn = e.target.closest(".detail-tab-btn");
  if (!btn) return;
  document.querySelectorAll(".detail-tab-btn").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  document.querySelectorAll(".detail-panel").forEach(p => p.classList.remove("active"));
  const tab = btn.dataset.dtab;
  document.getElementById("detail-panel-" + tab)?.classList.add("active");
  currentDetailTab = tab;
  const guild = allGuilds.find(g => g.id === selectedGuildId);
  if (guild) loadDetailTab(tab, guild);
});

async function loadDetailTab(tab, guild) {
  const panel = document.getElementById("detail-panel-" + tab);
  if (!panel) return;
  if (panel.dataset.loaded === guild.id) return; // already loaded for this guild

  panel.innerHTML = `<div style="color:var(--text-2);font-size:0.83rem;">Loading…</div>`;
  panel.dataset.loaded = guild.id;

  if (tab === "overview") renderOverviewPanel(panel, guild);
  else if (tab === "economy") await renderEconomyPanel(panel, guild);
  else if (tab === "channels") await renderChannelsPanel(panel, guild);
  else if (tab === "actions") renderActionsPanel(panel, guild);
}

// ── Overview tab ──────────────────────────────────────
function renderOverviewPanel(panel, guild) {
  panel.innerHTML = `
    <div class="panel-grid">
      <div class="stat-card">
        <div class="stat-card-label">Members</div>
        <div class="stat-card-value">${(guild.member_count || 0).toLocaleString()}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Economy Users</div>
        <div class="stat-card-value accent">${guild.user_count}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">Status</div>
        <div class="stat-card-value ${guild.bot_disabled ? "warn" : "good"}" id="ov-status">
          ${guild.bot_disabled ? "Disabled" : "Active"}
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-body">
        <div class="ctrl-row">
          <div class="ctrl-row-text">
            <div class="ctrl-row-label">Disable bot in this server</div>
            <div class="ctrl-row-desc">Flicker will ignore all commands and events while disabled.</div>
          </div>
          <label class="toggle-danger">
            <input type="checkbox" id="toggle-disabled" ${guild.bot_disabled ? "checked" : ""}
                   onchange="doToggleDisabled('${guild.id}', this.checked)">
            <div class="td-track"></div>
            <span class="td-label" id="td-label">${guild.bot_disabled ? "Disabled" : "Active"}</span>
          </label>
        </div>
      </div>
    </div>`;
}

async function doToggleDisabled(guildId, disabled) {
  try {
    await adminReq(`/admin/guild/${guildId}/toggle`, {
      method: "PATCH", body: JSON.stringify({ disabled }),
    });
    const g = allGuilds.find(x => x.id === guildId);
    if (g) g.bot_disabled = disabled;
    const label = document.getElementById("td-label");
    if (label) label.textContent = disabled ? "Disabled" : "Active";
    const status = document.getElementById("ov-status");
    if (status) { status.textContent = disabled ? "Disabled" : "Active"; status.className = "stat-card-value " + (disabled ? "warn" : "good"); }
    // Refresh guild list pills
    const q = document.getElementById("guild-search")?.value?.toLowerCase() || "";
    renderGuildList(allGuilds.filter(g => !q || g.name.toLowerCase().includes(q)));
    document.querySelectorAll(".guild-item").forEach(el => el.classList.toggle("active", el.dataset.id === guildId));
  } catch (err) {
    alert("Failed: " + err.message);
    const cb = document.getElementById("toggle-disabled");
    if (cb) cb.checked = !disabled;
  }
}

// ── Economy tab ───────────────────────────────────────
async function renderEconomyPanel(panel, guild) {
  panel.innerHTML = `<div style="color:var(--text-2);font-size:0.83rem;">Loading users…</div>`;
  const data = await adminReq(`/admin/guild/${guild.id}/users`);
  if (!data) return;

  panel.innerHTML = `
    <div class="card" style="margin-bottom:16px;">
      <div class="card-header"><span class="card-title">Bulk Reward</span></div>
      <div class="card-body">
        <div class="form-row">
          <div class="form-group">
            <label>Stardust</label>
            <input type="number" id="bulk-balance" class="form-input" placeholder="0" style="width:120px;">
          </div>
          <div class="form-group">
            <label>Chips</label>
            <input type="number" id="bulk-chips" class="form-input" placeholder="0" style="width:120px;">
          </div>
          <button class="btn-primary" style="margin-top:20px;" onclick="doBulkReward('${guild.id}')">Award to All</button>
        </div>
        <div style="font-size:0.76rem;color:var(--text-2);">Adds the specified amount to every user's balance in this server.</div>
      </div>
    </div>

    <div class="card" style="margin-bottom:16px;">
      <div class="card-header">
        <span class="card-title">User Balances</span>
        <div style="display:flex;gap:8px;align-items:center;">
          <input type="text" id="user-search" class="user-search" placeholder="Search users…">
          <button class="btn-danger btn-xs" onclick="doResetEconomy('${guild.id}')">Reset All</button>
        </div>
      </div>
      <div class="data-table-wrap" style="border-top:none;border-radius:0 0 var(--radius) var(--radius);">
        <table class="data-table">
          <thead><tr><th>User</th><th>Stardust</th><th>Chips</th><th></th></tr></thead>
          <tbody id="users-tbody">
            ${data.users.length ? data.users.map(buildUserRow).join("") : '<tr class="empty-row"><td colspan="4">No users with a balance.</td></tr>'}
          </tbody>
        </table>
      </div>
    </div>`;

  document.getElementById("user-search")?.addEventListener("input", e => {
    const q = e.target.value.toLowerCase();
    document.querySelectorAll("#users-tbody tr[data-uid]").forEach(row => {
      row.hidden = q && !row.dataset.search.includes(q);
    });
  });
}

function buildUserRow(u) {
  const av = u.avatar ? `<img class="u-avatar" src="${u.avatar}" alt="">` : `<div class="u-avatar-ph">${(u.display_name || "?")[0].toUpperCase()}</div>`;
  return `<tr data-uid="${u.user_id}" data-search="${esc((u.display_name + " " + u.username).toLowerCase())}">
    <td><div class="user-cell">${av}<div><div class="u-name">${esc(u.display_name)}</div><div class="u-id">${u.user_id}</div></div></div></td>
    <td><input class="bal-input" type="number" min="0" id="bal-${u.user_id}" value="${u.balance}"></td>
    <td><input class="bal-input" type="number" min="0" id="chips-${u.user_id}" value="${u.chips}"></td>
    <td>
      <button class="btn-primary btn-xs" onclick="doSaveBalance('${selectedGuildId}','${u.user_id}')">Save</button>
      <span class="saved-flash" id="flash-${u.user_id}" hidden>✓</span>
    </td>
  </tr>`;
}

async function doSaveBalance(guildId, userId) {
  const bal = parseInt(document.getElementById(`bal-${userId}`)?.value, 10);
  const chips = parseInt(document.getElementById(`chips-${userId}`)?.value, 10);
  if (isNaN(bal) || isNaN(chips) || bal < 0 || chips < 0) { alert("Enter valid non-negative numbers."); return; }
  try {
    await adminReq(`/admin/guild/${guildId}/users/${userId}`, {
      method: "PATCH", body: JSON.stringify({ balance: bal, chips }),
    });
    const fl = document.getElementById(`flash-${userId}`);
    if (fl) { fl.hidden = false; setTimeout(() => fl.hidden = true, 2000); }
  } catch (err) { alert("Save failed: " + err.message); }
}

async function doBulkReward(guildId) {
  const balance = parseInt(document.getElementById("bulk-balance")?.value || "0", 10) || 0;
  const chips = parseInt(document.getElementById("bulk-chips")?.value || "0", 10) || 0;
  if (!balance && !chips) { alert("Enter at least one non-zero amount."); return; }
  if (!confirm(`Award ${balance} Stardust + ${chips} Chips to all users in this server?`)) return;
  try {
    const res = await adminReq(`/admin/guild/${guildId}/economy/bulk-reward`, {
      method: "POST", body: JSON.stringify({ balance, chips }),
    });
    alert(`Done — rewarded ${res.affected} users.`);
  } catch (err) { alert("Failed: " + err.message); }
}

async function doResetEconomy(guildId) {
  const guild = allGuilds.find(g => g.id === guildId);
  if (!confirm(`PERMANENTLY delete all economy balances for ${guild?.name || guildId}? This cannot be undone.`)) return;
  try {
    const res = await adminReq(`/admin/guild/${guildId}/economy/reset`, { method: "POST" });
    alert(`Done — removed ${res.removed} rows.`);
    // Reload the tab
    const panel = document.getElementById("detail-panel-economy");
    if (panel) { delete panel.dataset.loaded; loadDetailTab("economy", guild); }
  } catch (err) { alert("Failed: " + err.message); }
}

// ── Channels tab ──────────────────────────────────────
async function renderChannelsPanel(panel, guild) {
  const data = await adminReq(`/admin/guild/${guild.id}/channels`);
  if (!data) return;

  panel.innerHTML = `
    <div class="card">
      <div class="card-header"><span class="card-title">Allowed Event Channels</span></div>
      <div class="card-body">
        <div style="font-size:0.8rem;color:var(--text-2);margin-bottom:12px;">Events will fire in these channels. Changes take effect immediately.</div>
        <div id="channel-pills">
          ${data.channels.length ? data.channels.map(c => buildChannelPill(c, guild.id)).join("") : '<span style="color:var(--text-2);font-size:0.82rem;">No channels configured.</span>'}
        </div>
        <div class="form-row" style="margin-top:14px;">
          <div class="form-group">
            <label>Add channel by ID</label>
            <input type="text" id="new-channel-id" class="form-input" placeholder="Channel ID…" style="width:180px;">
          </div>
          <button class="btn-primary" style="margin-top:20px;" onclick="doAddChannel('${guild.id}')">Add</button>
        </div>
      </div>
    </div>`;
}

function buildChannelPill(ch, guildId) {
  return `<span class="channel-pill">#${esc(ch.name)} <button class="channel-pill-remove" title="Remove" onclick="doRemoveChannel('${guildId}','${ch.id}',this)">×</button></span>`;
}

async function doAddChannel(guildId) {
  const input = document.getElementById("new-channel-id");
  const channelId = input?.value.trim();
  if (!channelId || isNaN(Number(channelId))) { alert("Enter a valid channel ID."); return; }
  try {
    await adminReq(`/admin/guild/${guildId}/channels`, {
      method: "POST", body: JSON.stringify({ channel_id: Number(channelId) }),
    });
    const ch = { id: channelId, name: channelId };
    document.getElementById("channel-pills").insertAdjacentHTML("beforeend", buildChannelPill(ch, guildId));
    if (input) input.value = "";
  } catch (err) { alert("Failed: " + err.message); }
}

async function doRemoveChannel(guildId, channelId, btn) {
  try {
    await adminReq(`/admin/guild/${guildId}/channels/${channelId}`, { method: "DELETE" });
    btn.closest(".channel-pill").remove();
  } catch (err) { alert("Failed: " + err.message); }
}

// ── Actions tab ───────────────────────────────────────
function renderActionsPanel(panel, guild) {
  panel.innerHTML = `
    <div class="action-grid">
      <div class="card">
        <div class="card-header"><span class="card-title">Seed Builtins</span></div>
        <div class="card-body">
          <p style="font-size:0.8rem;color:var(--text-2);margin-bottom:12px;">Insert the default auto-responder groups into this server (skips any that already exist).</p>
          <button class="btn-primary" onclick="doSeedBuiltins('${guild.id}')">Run !seedbuiltins</button>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Seed Event Texts</span></div>
        <div class="card-body">
          <p style="font-size:0.8rem;color:var(--text-2);margin-bottom:12px;">Apply Wish Galaxy–flavoured text overrides for all events and gambling games.</p>
          <button class="btn-primary" onclick="doSeedEventTexts('${guild.id}')">Run !seedeventtexts</button>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Broadcast Message</span></div>
        <div class="card-body">
          <p style="font-size:0.8rem;color:var(--text-2);margin-bottom:12px;">Send a message to all allowed event channels in this server.</p>
          <textarea id="broadcast-msg" class="form-input full" placeholder="Message text…" style="margin-bottom:10px;"></textarea>
          <button class="btn-primary" onclick="doBroadcast('${guild.id}')">Send</button>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title" style="color:var(--danger);">Leave Server</span></div>
        <div class="card-body">
          <p style="font-size:0.8rem;color:var(--text-2);margin-bottom:12px;">Remove Flicker from this server. The bot will need to be re-invited to return.</p>
          <button class="btn-danger" onclick="doLeaveGuild('${guild.id}','${esc(guild.name)}')">Leave ${esc(guild.name)}</button>
        </div>
      </div>
    </div>`;
}

async function doSeedBuiltins(guildId) {
  try {
    const res = await adminReq(`/admin/guild/${guildId}/seed-builtins`, { method: "POST" });
    const seeded = res.seeded?.length ? res.seeded.join(", ") : "none (all existed)";
    alert(`Done. Seeded: ${seeded}`);
  } catch (err) { alert("Failed: " + err.message); }
}

async function doSeedEventTexts(guildId) {
  try {
    await adminReq(`/admin/guild/${guildId}/seed-event-texts`, { method: "POST" });
    alert("Done. Event text overrides applied.");
  } catch (err) { alert("Failed: " + err.message); }
}

async function doBroadcast(guildId) {
  const msg = document.getElementById("broadcast-msg")?.value.trim();
  if (!msg) { alert("Enter a message."); return; }
  if (!confirm("Send this message to all allowed channels in this server?")) return;
  try {
    const res = await adminReq(`/admin/guild/${guildId}/broadcast`, {
      method: "POST", body: JSON.stringify({ message: msg }),
    });
    alert(`Sent to ${res.sent_to} channel(s).`);
    const ta = document.getElementById("broadcast-msg");
    if (ta) ta.value = "";
  } catch (err) { alert("Failed: " + err.message); }
}

async function doLeaveGuild(guildId, guildName) {
  if (!confirm(`Leave "${guildName}"? This cannot be undone easily.`)) return;
  try {
    await adminReq(`/admin/guild/${guildId}/leave`, { method: "POST" });
    allGuilds = allGuilds.filter(g => g.id !== guildId);
    renderGuildList(allGuilds);
    selectedGuildId = null;
    renderGuildsEmpty();
  } catch (err) { alert("Failed: " + err.message); }
}

// ── Health & Stats panel ──────────────────────────────
async function renderHealthPanel() {
  setMain("Health & Stats", `<div style="color:var(--text-2);font-size:0.83rem;">Loading…</div>`);
  const data = await adminReq("/admin/stats");
  if (!data) return;

  const uptime = fmtUptime(data.uptime_seconds);
  const winRate = data.games_correct + data.games_wrong > 0
    ? ((data.games_correct / (data.games_correct + data.games_wrong)) * 100).toFixed(1) + "%"
    : "—";

  const html = `
    <div class="section-title">Bot Status</div>
    <div class="panel-grid" style="margin-bottom:24px;">
      <div class="stat-card"><div class="stat-card-label">Uptime</div><div class="stat-card-value good">${uptime}</div></div>
      <div class="stat-card"><div class="stat-card-label">Latency</div><div class="stat-card-value accent">${data.latency_ms}ms</div></div>
      <div class="stat-card"><div class="stat-card-label">Servers</div><div class="stat-card-value">${data.guild_count}</div></div>
      <div class="stat-card"><div class="stat-card-label">Last Commit</div><div class="stat-card-value" style="font-size:0.85rem;font-family:var(--font-mono);">${esc(data.last_commit?.hash || "—")}</div></div>
    </div>

    <div class="section-title">Economy & Events</div>
    <div class="panel-grid" style="margin-bottom:24px;">
      <div class="stat-card"><div class="stat-card-label">Total Stardust Earned</div><div class="stat-card-value accent">${fmtNum(data.stardust_earned)}</div></div>
      <div class="stat-card"><div class="stat-card-label">Pets Given</div><div class="stat-card-value">${fmtNum(data.pet_count)}</div></div>
      <div class="stat-card"><div class="stat-card-label">Events Won</div><div class="stat-card-value good">${fmtNum(data.games_correct)}</div></div>
      <div class="stat-card"><div class="stat-card-label">Events Lost</div><div class="stat-card-value warn">${fmtNum(data.games_wrong)}</div></div>
      <div class="stat-card"><div class="stat-card-label">Win Rate</div><div class="stat-card-value">${winRate}</div></div>
    </div>

    <div class="section-title">Gambling</div>
    <div class="panel-grid">
      <div class="stat-card"><div class="stat-card-label">Chips Wagered</div><div class="stat-card-value">${fmtNum(data.chips_wagered)}</div></div>
      <div class="stat-card"><div class="stat-card-label">Chips Won by Players</div><div class="stat-card-value good">${fmtNum(data.chips_earnt)}</div></div>
      <div class="stat-card"><div class="stat-card-label">Chips Lost by Players</div><div class="stat-card-value warn">${fmtNum(data.chips_lost)}</div></div>
      <div class="stat-card"><div class="stat-card-label">House Edge</div><div class="stat-card-value">${fmtNum(data.chips_lost - data.chips_earnt)}</div></div>
    </div>

    ${data.last_commit?.message ? `<div style="margin-top:20px;font-size:0.78rem;color:var(--text-2);">Last deploy: <span style="font-family:var(--font-mono);color:var(--text);">${esc(data.last_commit.message)}</span></div>` : ""}`;

  setMain("Health & Stats", html);
}

// ── User Lookup panel ─────────────────────────────────
function renderLookupPanel() {
  setMain("User Lookup", `
    <div class="card" style="max-width:480px;">
      <div class="card-body">
        <div class="form-row">
          <div class="form-group" style="flex:1;">
            <label>Discord User ID</label>
            <input type="text" id="lookup-input" class="form-input" placeholder="e.g. 123456789012345678" style="width:100%;" onkeydown="if(event.key==='Enter')doLookup()">
          </div>
          <button class="btn-primary" style="margin-top:20px;" onclick="doLookup()">Look Up</button>
        </div>
      </div>
    </div>
    <div id="lookup-result"></div>`);
}

async function doLookup() {
  const val = document.getElementById("lookup-input")?.value.trim();
  if (!val || isNaN(Number(val))) { alert("Enter a valid user ID."); return; }
  const result = document.getElementById("lookup-result");
  result.innerHTML = `<div style="color:var(--text-2);font-size:0.83rem;margin-top:12px;">Loading…</div>`;
  try {
    const data = await adminReq(`/admin/user/${val}`);
    if (!data) return;
    const u = data.user;
    const av = u.avatar ? `<img class="lookup-avatar" src="${u.avatar}" alt="">` : `<div class="u-avatar-ph" style="width:52px;height:52px;font-size:1rem;">${(u.name || "?")[0].toUpperCase()}</div>`;
    const rows = data.guilds.length
      ? data.guilds.map(g => {
          const gi = g.guild_icon ? `<img class="g-icon" src="${g.guild_icon}" alt="" style="width:22px;height:22px;">` : "";
          return `<tr><td>${gi} ${esc(g.guild_name)}</td><td class="mono">${fmtNum(g.balance)}</td><td class="mono">${fmtNum(g.chips)}</td></tr>`;
        }).join("")
      : '<tr class="empty-row"><td colspan="3">No balances found.</td></tr>';

    result.innerHTML = `
      <div class="lookup-user-header">
        ${av}
        <div>
          <div class="lookup-name">${esc(u.display_name || u.name)}</div>
          <div class="lookup-id">${u.id}</div>
        </div>
        <div style="margin-left:auto;display:flex;gap:8px;">
          <button class="btn-danger btn-xs" onclick="doBlockFromLookup('${u.id}','${esc(u.name)}')">Block User</button>
        </div>
      </div>
      <div class="data-table-wrap">
        <table class="data-table">
          <thead><tr><th>Server</th><th>Stardust</th><th>Chips</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  } catch (err) {
    result.innerHTML = `<div style="color:var(--danger);font-size:0.83rem;margin-top:12px;">Error: ${esc(err.message)}</div>`;
  }
}

async function doBlockFromLookup(userId, userName) {
  const reason = prompt(`Reason for blocking ${userName}:`);
  if (reason === null) return;
  try {
    await adminReq(`/admin/blocks/${userId}`, { method: "POST", body: JSON.stringify({ reason }) });
    alert(`${userName} has been blocked.`);
  } catch (err) { alert("Failed: " + err.message); }
}

// ── Block List panel ──────────────────────────────────
async function renderBlocksPanel() {
  setMain("Block List", `<div style="color:var(--text-2);font-size:0.83rem;">Loading…</div>`);
  const data = await adminReq("/admin/blocks");
  if (!data) return;

  const rows = data.blocks.length
    ? data.blocks.map(b => {
        const av = b.avatar ? `<img class="u-avatar" src="${b.avatar}" alt="">` : `<div class="u-avatar-ph">${(b.username || "?")[0].toUpperCase()}</div>`;
        return `<tr>
          <td><div class="user-cell">${av}<div><div class="u-name">${esc(b.username)}</div><div class="u-id">${b.user_id}</div></div></div></td>
          <td style="font-size:0.8rem;">${esc(b.reason || "—")}</td>
          <td style="font-size:0.78rem;color:var(--text-2);">${fmtDate(b.blocked_at)}</td>
          <td style="font-size:0.78rem;color:var(--text-2);">${esc(b.blocked_by_name)}</td>
          <td><button class="btn-danger btn-xs" onclick="doUnblock('${b.user_id}','${esc(b.username)}',this)">Unblock</button></td>
        </tr>`;
      }).join("")
    : '<tr class="empty-row"><td colspan="5">No blocked users.</td></tr>';

  const html = `
    <div class="card" style="margin-bottom:16px;max-width:500px;">
      <div class="card-header"><span class="card-title">Block a User</span></div>
      <div class="card-body">
        <div class="form-row">
          <div class="form-group">
            <label>User ID</label>
            <input type="text" id="block-uid" class="form-input" placeholder="Discord user ID">
          </div>
          <div class="form-group" style="flex:1;">
            <label>Reason (optional)</label>
            <input type="text" id="block-reason" class="form-input wide" placeholder="Reason…">
          </div>
          <button class="btn-danger" style="margin-top:20px;" onclick="doBlock()">Block</button>
        </div>
      </div>
    </div>
    <div class="data-table-wrap">
      <table class="data-table" id="blocks-table">
        <thead><tr><th>User</th><th>Reason</th><th>Date</th><th>By</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`;
  setMain("Block List", html);
}

async function doBlock() {
  const uid = document.getElementById("block-uid")?.value.trim();
  const reason = document.getElementById("block-reason")?.value.trim();
  if (!uid || isNaN(Number(uid))) { alert("Enter a valid user ID."); return; }
  try {
    await adminReq(`/admin/blocks/${uid}`, { method: "POST", body: JSON.stringify({ reason: reason || "" }) });
    alert("User blocked.");
    renderBlocksPanel();
  } catch (err) { alert("Failed: " + err.message); }
}

async function doUnblock(userId, userName, btn) {
  if (!confirm(`Unblock ${userName}?`)) return;
  try {
    await adminReq(`/admin/blocks/${userId}`, { method: "DELETE" });
    btn.closest("tr").remove();
  } catch (err) { alert("Failed: " + err.message); }
}

// ── Audit Log panel ───────────────────────────────────
async function renderAuditPanel() {
  setMain("Audit Log", `<div style="color:var(--text-2);font-size:0.83rem;">Loading…</div>`);
  const data = await adminReq("/admin/audit-log?limit=200");
  if (!data) return;

  const rows = data.entries.length
    ? data.entries.map(e => {
        const guildName = e.guild_id ? (allGuilds.find(g => g.id === e.guild_id)?.name || e.guild_id) : "—";
        return `<tr>
          <td style="color:var(--text-2);font-size:0.74rem;font-family:var(--font-mono);">${fmtDate(e.timestamp)}</td>
          <td style="font-size:0.8rem;font-weight:600;">${esc(e.admin_name)}</td>
          <td><span class="audit-action">${esc(e.action)}</span></td>
          <td style="font-size:0.78rem;color:var(--text-2);">${esc(guildName)}</td>
          <td style="font-size:0.78rem;color:var(--text-2);">${esc(e.details || "—")}</td>
        </tr>`;
      }).join("")
    : '<tr class="empty-row"><td colspan="5">No audit entries yet.</td></tr>';

  setMain("Audit Log", `
    <div class="data-table-wrap">
      <table class="data-table">
        <thead><tr><th>Time</th><th>Admin</th><th>Action</th><th>Server</th><th>Details</th></tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>`);
}

// ── Helpers ───────────────────────────────────────────
function setMain(heading, html) {
  document.getElementById("main-heading").textContent = heading;
  document.getElementById("admin-body").innerHTML = html;
}

function esc(str) {
  return String(str ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function fmtNum(n) { return (n ?? 0).toLocaleString(); }

function fmtUptime(s) {
  if (!s) return "—";
  const d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60);
  if (d) return `${d}d ${h}h`;
  if (h) return `${h}h ${m}m`;
  return `${m}m`;
}

function fmtDate(ts) {
  if (!ts) return "—";
  return new Date(ts * 1000).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

// ── Logout ────────────────────────────────────────────
document.getElementById("logout-btn").addEventListener("click", () => {
  clearToken();
  window.location.href = "/";
});

// ── Init ──────────────────────────────────────────────
loadGuilds();
renderGuildsEmpty();
