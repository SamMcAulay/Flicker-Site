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
    window.location.href = "index.html";
    return null;
  }
  if (!res.ok) {
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
};
