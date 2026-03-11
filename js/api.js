// ─────────────────────────────────────────────────────
//  Flicker Dashboard — API wrapper
// ─────────────────────────────────────────────────────
async function apiRequest(path, options = {}) {
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
  if (!res.ok && res.status !== 207) {
    const text = await res.text().catch(() => res.status);
    throw new Error("API error " + res.status + ": " + text);
  }
  return res.json();
}

const api = {
  getGuilds: () => apiRequest("/api/guilds"),
  getSettings: (guildId) => apiRequest("/api/settings/" + guildId),
  saveSettings: (guildId, data) =>
    apiRequest("/api/settings/" + guildId, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  addResponse: (guildId, triggerWords, responseText) =>
    apiRequest("/api/custom-responses/" + guildId, {
      method: "POST",
      body: JSON.stringify({ trigger_words: triggerWords, response_text: responseText }),
    }),
  deleteResponse: (guildId, responseId) =>
    apiRequest("/api/custom-responses/" + guildId + "/" + responseId, {
      method: "DELETE",
    }),
  addGroup: (guildId, name, triggers, responses) =>
    apiRequest("/api/response-groups/" + guildId, {
      method: "POST",
      body: JSON.stringify({ name, triggers, responses }),
    }),
  toggleGroup: (guildId, groupId, enabled) =>
    apiRequest("/api/response-groups/" + guildId + "/" + groupId, {
      method: "PATCH",
      body: JSON.stringify({ enabled }),
    }),
  deleteGroup: (guildId, groupId) =>
    apiRequest("/api/response-groups/" + guildId + "/" + groupId, {
      method: "DELETE",
    }),
  updateProfile: (guildId, data) =>
    apiRequest("/api/profile/" + guildId, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  getChannels: (guildId) => apiRequest("/api/guild/" + guildId + "/channels"),
  getRoles: (guildId) => apiRequest("/api/guild/" + guildId + "/roles"),

  getLeveling: (guildId) => apiRequest("/api/leveling/" + guildId),
  saveLeveling: (guildId, levelingConfig) =>
    apiRequest("/api/leveling/" + guildId, {
      method: "POST",
      body: JSON.stringify({ leveling_config: levelingConfig }),
    }),

  getReactionRoles: (guildId) => apiRequest("/api/reaction-roles/" + guildId),
  createReactionRolePanel: (guildId, data) =>
    apiRequest("/api/reaction-roles/" + guildId, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteReactionRolePanel: (guildId, panelId) =>
    apiRequest("/api/reaction-roles/" + guildId + "/" + panelId, {
      method: "DELETE",
    }),
  addReactionRoleEntry: (guildId, panelId, data) =>
    apiRequest("/api/reaction-roles/" + guildId + "/" + panelId + "/entries", {
      method: "POST",
      body: JSON.stringify(data),
    }),
  removeReactionRoleEntry: (guildId, panelId, entryId) =>
    apiRequest(
      "/api/reaction-roles/" + guildId + "/" + panelId + "/entries/" + entryId,
      { method: "DELETE" }
    ),

  saveWelcome: (guildId, welcomeConfig) =>
    apiRequest("/api/settings/" + guildId, {
      method: "POST",
      body: JSON.stringify({ welcome_config: welcomeConfig }),
    }),
};
