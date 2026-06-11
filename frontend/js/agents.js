import { api } from "./api.js";
import { defaultUsername, parseUiError, shortAddress, walletState } from "./core.js?v=20260611walletmodal";
import { initWalletControls, setAlert, setWalletLabel } from "./ui.js?v=20260611walletmodal";
import { initSupportWidget } from "./support.js?v=20260611phantomdirect";

const ui = {
  alert: document.getElementById("alert"),
  search: document.getElementById("agentSearchInput"),
  grid: document.getElementById("agentsGrid"),
  count: document.getElementById("agentCount"),
  postCount: document.getElementById("agentPostCount"),
  form: document.getElementById("agentForm"),
  name: document.getElementById("agentName"),
  summary: document.getElementById("agentSummary"),
  targets: document.getElementById("agentTargets"),
  goals: document.getElementById("agentGoals"),
  skills: document.getElementById("agentSkills"),
  skillsFile: document.getElementById("agentSkillsFile"),
  postForm: document.getElementById("agentPostForm"),
  postSelect: document.getElementById("agentPostSelect"),
  postKind: document.getElementById("agentPostKind"),
  postTitle: document.getElementById("agentPostTitle"),
  postBody: document.getElementById("agentPostBody"),
  postUrl: document.getElementById("agentPostUrl"),
  signInBtn: document.getElementById("signInBtn"),
  connectBtn: document.getElementById("connectBtn"),
  disconnectBtn: document.getElementById("disconnectBtn"),
  walletSelect: document.getElementById("walletChoice"),
  walletLabel: document.getElementById("walletAddress")
};

const state = { agents: [], posts: [], query: "", walletControls: null };

function escapeHtml(value = "") {
  return String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function activeAddress() {
  return String(walletState().address || "").trim();
}

function ownerName(address = "") {
  const raw = String(address || "");
  return defaultUsername(raw) || shortAddress(raw) || "Agent owner";
}

function humanAgo(ts = 0) {
  const diff = Math.max(0, Math.floor(Date.now() / 1000) - Number(ts || 0));
  if (diff < 60) return "now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function matches(agent) {
  const q = state.query.toLowerCase();
  if (!q) return true;
  return [agent.name, agent.summary, agent.targets, agent.goals, agent.skillsMd, agent.owner].some((value) => String(value || "").toLowerCase().includes(q));
}

function renderAgent(agent) {
  const posts = state.posts.filter((post) => post.agentId === agent.id).slice(0, 3);
  const latest = posts[0] || agent.latestPost;
  return `
    <article class="agent-card">
      <div class="agent-card-head">
        <span class="agent-avatar">${escapeHtml(agent.name.slice(0, 2).toUpperCase())}</span>
        <div><h2>${escapeHtml(agent.name)}</h2><small>${escapeHtml(ownerName(agent.owner))} · ${escapeHtml(agent.status || "active")}</small></div>
      </div>
      <p>${escapeHtml(agent.summary || "Job-search agent")}</p>
      <div class="agent-chip-row">
        <span>SKILLS.md</span>
        <span>${escapeHtml(String(agent.targets || "Open targets").slice(0, 42))}</span>
        <span>${Number(agent.postCount || posts.length || 0)} posts</span>
      </div>
      <pre class="agent-skills-preview">${escapeHtml(agent.skillsMd || "")}</pre>
      ${latest ? `<div class="agent-latest"><b>${escapeHtml(latest.title || latest.kind || "Update")}</b><span>${humanAgo(latest.createdAt)}</span><p>${escapeHtml(latest.body || "")}</p></div>` : ""}
    </article>
  `;
}

function render() {
  const agents = state.agents.filter(matches);
  ui.count.textContent = String(state.agents.length);
  ui.postCount.textContent = String(state.posts.length);
  ui.grid.innerHTML = agents.length ? agents.map(renderAgent).join("") : '<article class="panel-card"><p class="muted">No agents yet.</p></article>';
  ui.postSelect.innerHTML = state.agents.length
    ? state.agents.map((agent) => `<option value="${escapeHtml(agent.id)}">${escapeHtml(agent.name)}</option>`).join("")
    : '<option value="">Save an agent first</option>';
}

async function loadAgents() {
  const payload = await api.agents();
  state.agents = Array.isArray(payload.agents) ? payload.agents : [];
  state.posts = Array.isArray(payload.posts) ? payload.posts : [];
  render();
}

function requireWallet() {
  const address = activeAddress();
  if (!address) throw new Error("Sign in with Phantom first");
  return address;
}

ui.search?.addEventListener("input", () => {
  state.query = ui.search.value || "";
  render();
});

ui.skillsFile?.addEventListener("change", async () => {
  const file = ui.skillsFile.files?.[0];
  if (!file) return;
  ui.skills.value = await file.text();
});

ui.form?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const owner = requireWallet();
    await api.saveAgent({
      owner,
      name: ui.name.value,
      summary: ui.summary.value,
      targets: ui.targets.value,
      goals: ui.goals.value,
      skillsMd: ui.skills.value
    });
    ui.form.reset();
    setAlert("Agent saved");
    await loadAgents();
  } catch (error) {
    setAlert(parseUiError(error), "error");
  }
});

ui.postForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const owner = requireWallet();
    const agentId = ui.postSelect.value;
    if (!agentId) throw new Error("Save an agent first");
    await api.agentPost(agentId, {
      owner,
      kind: ui.postKind.value,
      title: ui.postTitle.value,
      body: ui.postBody.value,
      url: ui.postUrl.value
    });
    ui.postForm.reset();
    setAlert("Agent update posted");
    await loadAgents();
  } catch (error) {
    setAlert(parseUiError(error), "error");
  }
});

state.walletControls = initWalletControls({
  signInBtn: ui.signInBtn,
  connectBtn: ui.connectBtn,
  disconnectBtn: ui.disconnectBtn,
  walletSelect: ui.walletSelect,
  walletLabel: ui.walletLabel,
  onChange: () => setWalletLabel(ui.walletLabel)
});
initSupportWidget();
loadAgents().catch((error) => setAlert(parseUiError(error), "error"));
