const state = {
  bootstrap: null, token: null, account: null, mode: "entreprise", settings: {},
  view: "dashboard", dashboard: null, resources: {}, search: "", idleTimer: null,
};

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
const fmtDate = (value) => value ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "—";
const roleLabel = { administrateur: "Administrateur", technicien: "Technicien", lecteur: "Lecteur" };

const viewMeta = {
  dashboard: { title: "Vue d’ensemble", kicker: "Pilotage local", description: "Statistiques, alertes et activité de l’ensemble des modules." },
  helpdesk: { title: "HelpDesk NovaTech", kicker: "Support unifié", description: "Créez et suivez les demandes liées aux utilisateurs et aux équipements.", resource: "tickets" },
  netwatch: { title: "NetWatch SISR", kicker: "Supervision", description: "Contrôlez l’état du parc unifié et identifiez les pannes.", resource: "equipment" },
  adlab: { title: "ADLab SISR", kicker: "Annuaire", description: "Importez Active Directory et gérez les utilisateurs de référence.", resource: "users" },
  ipplan: { title: "IPPlan SISR", kicker: "Réseau", description: "Calculez, enregistrez et documentez les VLAN et sous-réseaux.", resource: "ipPlans" },
  backup: { title: "BackupGuard", kicker: "Continuité", description: "Sauvegardes automatiques, copies manuelles et restauration sécurisée.", resource: "backups" },
  deploy: { title: "DeployDesk", kicker: "Cycle de préparation", description: "Suivez chaque poste de la préparation jusqu’à la livraison.", resource: "deployments" },
  patch: { title: "PatchPilot", kicker: "Conformité", description: "Priorisez les correctifs et les équipements concernés.", resource: "patches" },
  wifi: { title: "WiFiScope", kicker: "Couverture radio", description: "Centralisez les relevés et obtenez des recommandations d’optimisation.", resource: "wifi" },
  logs: { title: "LogSentinel", kicker: "Sécurité", description: "Qualifiez les incidents et rassemblez les événements utiles.", resource: "incidents" },
  infra: { title: "InfraDiagram", kicker: "Cartographie dynamique", description: "La topologie est générée depuis les équipements de la base commune.", resource: "equipment" },
  automation: { title: "AutoAdmin", kicker: "Automatisation sûre", description: "Préparez et simulez les tâches sans exécuter de commande réelle.", resource: "automation" },
  settings: { title: "Administration", kicker: "Sécurité et traçabilité", description: "Gérez les comptes, les rôles, les paramètres et le journal d’audit." },
};

const columns = {
  tickets: [["reference", "Ticket"], ["title", "Demande"], ["priority", "Priorité"], ["status", "Statut"], ["updated_at", "Dernière modification"]],
  equipment: [["asset_tag", "Inventaire"], ["name", "Équipement"], ["type", "Type"], ["ip_address", "Adresse IP"], ["os", "Système"], ["status", "État"]],
  users: [["external_id", "Identifiant AD"], ["display_name", "Utilisateur"], ["email", "E-mail"], ["department", "Service"], ["title", "Fonction"], ["status", "État"]],
  ipPlans: [["name", "Réseau"], ["vlan", "VLAN"], ["cidr", "CIDR"], ["network", "Réseau"], ["broadcast", "Diffusion"], ["hosts", "Hôtes"]],
  deployments: [["device_name", "Poste"], ["owner_name", "Utilisateur"], ["stage", "Étape"], ["progress", "Progression"], ["updated_at", "Modification"]],
  patches: [["reference", "Correctif"], ["title", "Description"], ["severity", "Criticité"], ["status", "Statut"], ["deadline", "Échéance"]],
  wifi: [["access_point", "Point d’accès"], ["ssid", "SSID"], ["channel", "Canal"], ["signal", "Signal"], ["clients", "Clients"], ["status", "Diagnostic"]],
  incidents: [["reference", "Incident"], ["title", "Description"], ["severity", "Sévérité"], ["status", "Statut"], ["updated_at", "Modification"]],
  logs: [["source", "Source"], ["event", "Événement"], ["severity", "Sévérité"], ["status", "Statut"], ["created_at", "Date"]],
  automation: [["name", "Tâche"], ["shell", "Shell"], ["purpose", "Objectif"], ["status", "État"], ["saved_minutes", "Minutes gagnées"], ["last_run_at", "Dernière simulation"]],
  backups: [["created_at", "Date"], ["status", "Statut"], ["automatic", "Type"], ["size_bytes", "Taille"], ["file_path", "Fichier"]],
  accounts: [["username", "Identifiant"], ["display_name", "Nom"], ["role", "Rôle"], ["active", "Actif"], ["last_login_at", "Dernière connexion"]],
  audit: [["created_at", "Date"], ["actor_name", "Auteur"], ["action", "Action"], ["entity_type", "Type"], ["entity_id", "Identifiant"]],
};

const forms = {
  tickets: { title: "Créer un ticket", fields: [["title", "Objet", "text", true], ["description", "Description", "textarea"], ["priority", "Priorité", "select", false, ["Basse", "Moyenne", "Haute", "Critique"]], ["status", "Statut", "select", false, ["Ouvert", "En cours", "Résolu"]]] },
  equipment: { title: "Ajouter un équipement", fields: [["asset_tag", "N° inventaire"], ["name", "Nom", "text", true], ["type", "Type", "select", true, ["Poste", "Serveur", "Commutateur", "Routeur", "Pare-feu", "Stockage", "Imprimante"]], ["ip_address", "Adresse IP"], ["serial", "N° de série"], ["os", "Système"], ["status", "État", "select", false, ["En ligne", "Alerte", "En panne", "Maintenance"]]] },
  users: { title: "Ajouter un utilisateur", fields: [["external_id", "Identifiant AD"], ["display_name", "Nom complet", "text", true], ["email", "E-mail", "email"], ["department", "Service"], ["title", "Fonction"], ["status", "État", "select", false, ["Actif", "Inactif"]]] },
  deployments: { title: "Préparer un poste", fields: [["device_name", "Nom du poste", "text", true], ["owner_name", "Utilisateur"], ["stage", "Étape", "select", false, ["Préparation", "Configuration", "Validation", "Livraison"]], ["progress", "Progression (%)", "number"], ["notes", "Notes", "textarea"]] },
  patches: { title: "Ajouter un correctif", fields: [["reference", "Référence"], ["title", "Description", "text", true], ["severity", "Criticité", "select", false, ["Modérée", "Importante", "Critique"]], ["status", "Statut", "select", false, ["À planifier", "Planifiée", "Déployée"]], ["deadline", "Échéance", "date"]] },
  wifi: { title: "Ajouter un relevé Wi-Fi", fields: [["access_point", "Point d’accès", "text", true], ["ssid", "SSID"], ["channel", "Canal", "number"], ["signal", "Signal (dBm)", "number"], ["clients", "Clients", "number"], ["status", "Diagnostic", "select", false, ["Bon", "À optimiser", "Critique"]]] },
  incidents: { title: "Déclarer un incident", fields: [["title", "Titre", "text", true], ["description", "Description", "textarea"], ["severity", "Sévérité", "select", false, ["Faible", "Moyenne", "Haute", "Critique"]], ["status", "Statut", "select", false, ["Nouveau", "En cours", "Résolu"]]] },
  automation: { title: "Ajouter une simulation", fields: [["name", "Nom", "text", true], ["shell", "Shell", "select", false, ["PowerShell", "Bash"]], ["purpose", "Objectif"], ["parameters", "Paramètres", "textarea"], ["saved_minutes", "Minutes gagnées", "number"]] },
};

function unwrap(result) {
  if (!result?.ok) {
    if (/session/i.test(result?.error ?? "")) showLogin("La session est verrouillée. Reconnectez-vous.");
    throw new Error(result?.error ?? "Action impossible.");
  }
  return result.data;
}

async function api(promise, successMessage) {
  try {
    const data = unwrap(await promise);
    if (successMessage) toast(successMessage);
    return data;
  } catch (error) {
    toast(error.message, true);
    throw error;
  }
}

function toast(message, error = false) {
  const item = document.createElement("div");
  item.className = `toast ${error ? "error" : ""}`;
  item.innerHTML = `<strong>${error ? "Action impossible" : "NovaSuite"}</strong><small>${escapeHtml(message)}</small>`;
  $("#toast-stack").append(item);
  setTimeout(() => item.remove(), 4200);
}

function statusBadge(value) {
  const text = String(value ?? "—");
  const tone = /résolu|réuss|en ligne|actif|déploy|bon|qualifié|livraison|oui/i.test(text) ? "good" : /critique|panne|échec|inactif|hors ligne/i.test(text) ? "bad" : /alerte|haute|important|planifier|nouveau|optimiser/i.test(text) ? "warn" : "blue";
  return `<span class="badge ${tone}">${escapeHtml(text)}</span>`;
}

function roleCan(permission) {
  const permissions = { administrateur: ["write", "delete", "accounts", "settings", "restore", "import"], technicien: ["write", "import"], lecteur: [] };
  return permissions[state.account?.role]?.includes(permission) ?? false;
}

function pageHead(meta, actions = "") {
  return `<header class="page-head"><div><p class="eyebrow">${escapeHtml(meta.kicker)}</p><h1>${escapeHtml(meta.title)}</h1><p>${escapeHtml(meta.description)}</p></div><div class="page-actions">${actions}</div></header>`;
}

function renderTable(resource, rows, { actions = true } = {}) {
  const config = columns[resource] ?? [];
  const query = state.search.trim().toLowerCase();
  const filtered = query ? rows.filter((row) => JSON.stringify(row).toLowerCase().includes(query)) : rows;
  if (!filtered.length) return `<div class="empty">Aucune donnée à afficher.</div>`;
  return `<div class="table-wrap"><table class="data-table"><thead><tr>${config.map(([, label]) => `<th>${escapeHtml(label)}</th>`).join("")}${actions ? "<th></th>" : ""}</tr></thead><tbody>${filtered.map((row) => `<tr>${config.map(([key]) => `<td>${formatCell(key, row[key])}</td>`).join("")}${actions ? `<td><div class="row-actions">${resource === "automation" ? `<button class="secondary compact" data-dry-run="${row.id}">Dry-Run</button>` : ""}${roleCan("delete") && !["backups", "accounts", "audit"].includes(resource) ? `<button class="danger compact" data-delete-resource="${resource}" data-delete-id="${row.id}">Supprimer</button>` : ""}</div></td>` : ""}</tr>`).join("")}</tbody></table></div>`;
}

function formatCell(key, value) {
  if (["status", "priority", "severity", "active", "automatic", "stage"].includes(key)) {
    if (key === "active") return statusBadge(value ? "Oui" : "Non");
    if (key === "automatic") return statusBadge(value ? "Automatique" : "Manuelle");
    return statusBadge(value);
  }
  if (/_at$/.test(key)) return escapeHtml(fmtDate(value));
  if (key === "size_bytes") return escapeHtml(value ? `${(Number(value) / 1024 / 1024).toFixed(2)} Mo` : "0 Mo");
  if (key === "progress") return `<div class="progress"><span style="width:${Math.min(100, Number(value) || 0)}%"></span></div><small>${escapeHtml(value)} %</small>`;
  if (key === "signal") return `<strong>${escapeHtml(value)} dBm</strong>`;
  return escapeHtml(value || "—");
}

async function bootstrap() {
  state.bootstrap = await api(window.nova.bootstrap());
  if (state.bootstrap.firstRun) {
    $("#setup-form").classList.remove("hidden");
  } else {
    $("#login-form").classList.remove("hidden");
  }
  bindAuth();
}

function bindAuth() {
  $$(".mode-switch button").forEach((button) => button.addEventListener("click", () => selectMode(button.dataset.mode)));
  $("#setup-demo").addEventListener("click", () => { $("#setup-form").classList.add("hidden"); $("#login-form").classList.remove("hidden"); selectMode("demonstration"); });
  $("#setup-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.currentTarget));
    if (payload.password !== payload.confirmation) return toast("Les mots de passe ne correspondent pas.", true);
    delete payload.confirmation;
    try { enterApp(await api(window.nova.auth.setup(payload), "Administrateur créé.")); } catch {}
  });
  $("#login-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(event.currentTarget));
    try { enterApp(await api(window.nova.auth.login({ ...payload, mode: state.mode }))); } catch (error) { $("#auth-message").textContent = error.message; }
  });
}

function selectMode(mode) {
  state.mode = mode;
  $$(".mode-switch button").forEach((button) => button.classList.toggle("active", button.dataset.mode === mode));
  const form = $("#login-form");
  if (mode === "demonstration") {
    form.elements.username.value = state.bootstrap.demoCredentials.username;
    form.elements.password.value = state.bootstrap.demoCredentials.password;
    $("#login-description").textContent = "Données fictives séparées. Toutes les actions restent locales et peuvent être réinitialisées.";
  } else {
    form.elements.username.value = ""; form.elements.password.value = "";
    $("#login-description").textContent = "Ouvrez la base professionnelle enregistrée sur cet ordinateur.";
  }
}

function enterApp(session) {
  state.token = session.token; state.account = session.account; state.mode = session.mode; state.settings = session.settings;
  $("#auth-screen").classList.add("hidden"); $("#app-shell").classList.remove("hidden");
  $("#profile-name").textContent = state.account.display_name; $("#profile-role").textContent = roleLabel[state.account.role];
  $("#profile-initials").textContent = state.account.display_name.split(/\s+/).map((part) => part[0]).slice(0,2).join("").toUpperCase();
  const badge = $("#mode-badge"); badge.textContent = state.mode === "demonstration" ? "Mode Démonstration" : "Mode Entreprise"; badge.classList.toggle("demo", state.mode === "demonstration");
  $(".brand small").textContent = state.mode === "demonstration" ? "SISR · Démonstration" : "SISR · Entreprise";
  bindApp(); resetIdleTimer(); navigate("dashboard");
  if (state.mode === "demonstration") showNotice("Mode Démonstration : données fictives strictement séparées de la base Entreprise.");
}

function bindApp() {
  $$("[data-view]").forEach((button) => button.onclick = () => navigate(button.dataset.view));
  $("#lock-button").onclick = () => lockApp("Application verrouillée manuellement.");
  $("#notifications-button").onclick = () => $("#notification-drawer").classList.add("open");
  $("[data-close-drawer]").onclick = () => $("#notification-drawer").classList.remove("open");
  $("#profile-button").onclick = () => navigate("settings");
  $("#modal-close").onclick = closeModal;
  $("#modal").addEventListener("click", (event) => { if (event.target === $("#modal")) closeModal(); });
  ["mousemove", "mousedown", "keydown", "touchstart"].forEach((event) => document.addEventListener(event, resetIdleTimer, { passive: true }));
  window.nova.onNotification((notification) => toast(`${notification.title} — ${notification.body}`, notification.urgency === "critical"));
  setInterval(() => state.token && window.nova.auth.touch(state.token).then((result) => { if (!result.ok) lockApp("La session a expiré."); }), 4 * 60 * 1000);
}

function resetIdleTimer() {
  clearTimeout(state.idleTimer);
  const minutes = Math.max(1, Number(state.settings.auto_lock_minutes) || 10);
  state.idleTimer = setTimeout(() => lockApp("NovaSuite a été verrouillée après une période d’inactivité."), minutes * 60 * 1000);
}

async function lockApp(message) {
  if (state.token) await window.nova.auth.logout(state.token);
  state.token = null; state.account = null; state.resources = {}; state.dashboard = null;
  showLogin(message);
}

function showLogin(message = "") {
  clearTimeout(state.idleTimer);
  $("#app-shell").classList.add("hidden"); $("#auth-screen").classList.remove("hidden"); $("#setup-form").classList.add("hidden"); $("#login-form").classList.remove("hidden");
  $("#auth-message").textContent = message; selectMode(state.mode);
}

function showNotice(message) {
  const bar = $("#notice-bar"); bar.textContent = message; bar.classList.remove("hidden"); setTimeout(() => bar.classList.add("hidden"), 7000);
}

async function navigate(view) {
  state.view = view; state.search = "";
  $$(".nav-item").forEach((button) => button.classList.toggle("active", button.dataset.view === view));
  const meta = viewMeta[view]; $("#breadcrumb").textContent = `NovaSuite / ${meta.title}`;
  $("#view").innerHTML = `<div class="empty">Chargement de la base locale…</div>`;
  try {
    if (view === "dashboard") await renderDashboard();
    else if (view === "backup") await renderBackup();
    else if (view === "ipplan") await renderIpPlan();
    else if (view === "infra") await renderInfra();
    else if (view === "logs") await renderLogs();
    else if (view === "settings") await renderSettings();
    else await renderResourceView(view, meta.resource);
  } catch {}
}

async function refreshDashboardData() {
  state.dashboard = await api(window.nova.data.dashboard(state.token));
  $("#notification-count").textContent = state.dashboard.metrics.unreadNotifications;
  $("#notification-count").classList.toggle("hidden", !state.dashboard.metrics.unreadNotifications);
  $("#notification-list").innerHTML = renderNotifications(state.dashboard.notifications);
}

async function renderDashboard() {
  await refreshDashboardData();
  const d = state.dashboard, m = d.metrics;
  const widgets = new Set(d.widgets);
  $("#view").innerHTML = `${pageHead(viewMeta.dashboard, `<button class="secondary" id="customize-dashboard">Personnaliser</button><button class="secondary" data-report="dashboard" data-format="pdf">Rapport PDF</button>`)}
    <div class="hero"><section class="panel hero-main"><p class="eyebrow">Centre d’administration opérationnel</p><h1>Tout le SI. <em>Une seule base locale.</em></h1><p>Les utilisateurs, équipements, tickets, incidents et preuves d’intervention sont reliés entre les onze modules.</p><div class="hero-actions"><button class="primary" data-go="helpdesk">Traiter les tickets</button><button class="secondary" id="quick-backup">Sauvegarder maintenant</button></div></section>
      <section class="panel"><div class="panel-head"><div><p class="eyebrow">État local</p><h2>Contrôles essentiels</h2></div>${statusBadge("Protégé")}</div><div class="health-list"><div class="health-row"><strong>Base SQLite</strong>${statusBadge("Accessible")}<p>Les relations et l’historique sont actifs.</p></div><div class="health-row"><strong>Chiffrement sensible</strong>${statusBadge("AES-256")}<p>Descriptions et paramètres protégés avec une clé locale.</p></div><div class="health-row"><strong>Session</strong>${statusBadge(roleLabel[state.account.role])}<p>Verrouillage automatique : ${escapeHtml(state.settings.auto_lock_minutes)} min.</p></div></div></section></div>
    <div class="kpi-grid">${widgets.has("tickets") ? kpi("HD", "Tickets actifs", m.openTickets, "blue") : ""}${widgets.has("equipment") ? kpi("NW", "Équipements en ligne", `${m.equipmentOnline}/${m.equipmentTotal}`, "good") : ""}${widgets.has("incidents") ? kpi("LS", "Incidents actifs", m.activeIncidents, m.activeIncidents ? "warn" : "good") : ""}${widgets.has("patches") ? kpi("PP", "Correctifs critiques", m.criticalPatches, m.criticalPatches ? "bad" : "good") : ""}${widgets.has("notifications") ? kpi("AL", "Alertes non lues", m.unreadNotifications, m.unreadNotifications ? "warn" : "good") : ""}</div>
    <div class="dashboard-grid">${widgets.has("activity") ? `<section class="panel"><div class="panel-head"><div><p class="eyebrow">Statistiques</p><h2>Répartition des tickets</h2></div></div>${renderChart(d.charts.ticketStatuses)}</section>` : ""}<section class="panel"><div class="panel-head"><div><p class="eyebrow">Historique complet</p><h2>Dernières actions</h2></div><button class="link-button" data-go="settings">Voir l’audit</button></div>${renderAudit(d.recentAudit)}</section></div>`;
  bindCommon();
  $("#customize-dashboard").onclick = showDashboardCustomizer;
  $("#quick-backup").onclick = async () => { try { const result = await api(window.nova.backup.create(state.token), "Sauvegarde créée."); showNotice(`Copie enregistrée : ${result.filePath}`); } catch {} };
}

function kpi(code, label, value, tone) { return `<article class="kpi ${tone}"><span class="kpi-icon">${code}</span><div><small>${label}</small><strong>${escapeHtml(value)}</strong></div></article>`; }
function renderChart(rows) { const max = Math.max(...rows.map((row) => Number(row.value)), 1); return `<div class="chart-list">${rows.map((row) => `<div class="chart-row"><span>${escapeHtml(row.label)}</span><div class="chart-track"><b style="width:${Math.round(Number(row.value) / max * 100)}%"></b></div><strong>${row.value}</strong></div>`).join("")}</div>`; }
function renderAudit(rows) { return `<div class="audit-list">${rows.map((row) => `<div class="audit-item"><span class="audit-dot"></span><div><strong>${escapeHtml(row.action)} · ${escapeHtml(row.actor_name)}</strong><p>${escapeHtml(row.entity_type)} ${escapeHtml(row.entity_id || "")}</p><small>${fmtDate(row.created_at)}</small></div></div>`).join("") || `<div class="empty">Aucune action enregistrée.</div>`}</div>`; }
function renderNotifications(rows) { return rows.map((row) => `<div class="notification-item"><span class="audit-dot"></span><div><strong>${escapeHtml(row.title)}</strong><p>${escapeHtml(row.message)}</p><small>${statusBadge(row.severity)} · ${fmtDate(row.created_at)}</small></div></div>`).join("") || `<div class="empty">Aucune notification.</div>`; }

async function renderResourceView(view, resource) {
  const rows = await api(window.nova.data.list(state.token, resource)); state.resources[resource] = rows;
  const meta = viewMeta[view];
  const importButton = ["users", "equipment"].includes(resource) && roleCan("import") ? `<button class="secondary" data-import="${resource}">Importer CSV</button>` : "";
  const addButton = forms[resource] && roleCan("write") ? `<button class="primary" data-add="${resource}">+ Ajouter</button>` : "";
  const reportButtons = `<button class="secondary" data-report="${resource}" data-format="csv">CSV</button><button class="secondary" data-report="${resource}" data-format="pdf">PDF</button>`;
  const content = resource === "wifi" ? renderWifiCards(rows) : resource === "deployments" ? renderDeploymentCards(rows) : resource === "automation" ? renderAutomationCards(rows) : renderTable(resource, rows);
  $("#view").innerHTML = `${pageHead(meta, `${importButton}${reportButtons}${addButton}`)}<div class="toolbar"><label class="toolbar-search"><span>⌕</span><input id="resource-search" placeholder="Rechercher dans ${escapeHtml(meta.title)}" /></label><small>${rows.length} élément${rows.length > 1 ? "s" : ""}</small></div><section class="panel table-panel">${content}</section>`;
  bindCommon(); bindSearch(resource);
}

function renderWifiCards(rows) {
  return `<div class="cards" style="padding:16px">${rows.map((row) => { const quality = Number(row.signal) >= -60 ? "Bon" : Number(row.signal) >= -70 ? "À optimiser" : "Critique"; return `<article class="resource-card"><div class="panel-head">${statusBadge(quality)}<code>Canal ${escapeHtml(row.channel)}</code></div><h3>${escapeHtml(row.access_point)}</h3><p>${escapeHtml(row.ssid || "SSID non renseigné")}</p><div class="signal"><span style="width:${Math.max(5, Math.min(100, 100 + Number(row.signal)))}%"></span></div><div class="resource-meta"><span><small>Signal</small><strong>${escapeHtml(row.signal)} dBm</strong></span><span><small>Clients</small><strong>${escapeHtml(row.clients)}</strong></span></div>${quality !== "Bon" ? `<div class="recommendation">Réduire la charge, contrôler le canal et repositionner le point d’accès.</div>` : ""}</article>`; }).join("") || `<div class="empty">Aucun relevé Wi-Fi.</div>`}</div>`;
}

function renderDeploymentCards(rows) {
  return `<div class="cards" style="padding:16px">${rows.map((row) => `<article class="resource-card"><div class="panel-head">${statusBadge(row.stage)}<strong>${escapeHtml(row.progress)} %</strong></div><h3>${escapeHtml(row.device_name)}</h3><p>${escapeHtml(row.owner_name || "Utilisateur à attribuer")}</p><div class="progress"><span style="width:${Math.min(100, Number(row.progress) || 0)}%"></span></div><div class="resource-meta"><span><small>Étape</small><strong>${escapeHtml(row.stage)}</strong></span><span><small>Modification</small><strong>${fmtDate(row.updated_at)}</strong></span></div></article>`).join("") || `<div class="empty">Aucun poste en préparation.</div>`}</div>`;
}

function renderAutomationCards(rows) {
  return `<div class="cards" style="padding:16px">${rows.map((row) => `<article class="resource-card"><div class="panel-head">${statusBadge(row.status)}<span class="badge blue">${escapeHtml(row.shell)}</span></div><h3>${escapeHtml(row.name)}</h3><p>${escapeHtml(row.purpose)}</p><div class="resource-meta"><span><small>Gain estimé</small><strong>${escapeHtml(row.saved_minutes)} min</strong></span><span><small>Dernier Dry-Run</small><strong>${fmtDate(row.last_run_at)}</strong></span></div><button class="primary wide" data-dry-run="${row.id}">Préparer et simuler</button><div id="dry-${row.id}"></div></article>`).join("") || `<div class="empty">Aucune simulation enregistrée.</div>`}</div>`;
}

async function renderIpPlan() {
  const rows = await api(window.nova.data.list(state.token, "ipPlans")); state.resources.ipPlans = rows;
  $("#view").innerHTML = `${pageHead(viewMeta.ipplan, `<button class="secondary" data-report="ipPlans" data-format="csv">Exporter CSV</button>`)}
    <section class="panel"><div class="panel-head"><div><p class="eyebrow">Calculateur</p><h2>Nouveau sous-réseau</h2></div></div><form id="cidr-form" class="form-grid calculator"><label>Nom<input name="name" value="Nouveau VLAN" required /></label><label>Adresse IPv4<input name="address" value="192.168.50.0" required /></label><label>Préfixe<input name="prefix" type="number" min="1" max="30" value="24" required /></label><label>VLAN<input name="vlan" type="number" min="1" max="4094" value="50" /></label><button class="primary" type="submit" ${roleCan("write") ? "" : "disabled"}>Calculer et enregistrer</button></form><div id="calc-result"></div></section>
    <section class="panel table-panel" style="margin-top:16px">${renderTable("ipPlans", rows)}</section>`;
  bindCommon();
  $("#cidr-form").onsubmit = calculateCidr;
}

function ipToNumber(ip) { const parts = ip.split(".").map(Number); if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) throw new Error(); return (((parts[0] * 256 + parts[1]) * 256 + parts[2]) * 256 + parts[3]) >>> 0; }
function numberToIp(value) { return [value >>> 24, value >>> 16 & 255, value >>> 8 & 255, value & 255].join("."); }
async function calculateCidr(event) {
  event.preventDefault(); const values = Object.fromEntries(new FormData(event.currentTarget));
  try { const prefix = Number(values.prefix); if (prefix < 1 || prefix > 30) throw new Error(); const ip = ipToNumber(values.address); const mask = (0xffffffff << (32 - prefix)) >>> 0; const network = (ip & mask) >>> 0; const broadcast = (network | (~mask >>> 0)) >>> 0; const payload = { name: values.name, cidr: `${numberToIp(network)}/${prefix}`, network: numberToIp(network), broadcast: numberToIp(broadcast), hosts: Math.max(0, 2 ** (32 - prefix) - 2), vlan: Number(values.vlan) || null }; $("#calc-result").innerHTML = `<div class="calc-result">Réseau ${payload.network} · Diffusion ${payload.broadcast} · ${payload.hosts} hôtes utilisables</div>`; await api(window.nova.data.create(state.token, "ipPlans", payload), "Plan IP enregistré."); setTimeout(renderIpPlan, 650); } catch { toast("Adresse IPv4 ou préfixe invalide.", true); }
}

async function renderBackup() {
  const rows = await api(window.nova.data.list(state.token, "backups")); state.resources.backups = rows;
  const canRestore = state.account.role === "administrateur" && state.mode === "entreprise";
  $("#view").innerHTML = `${pageHead(viewMeta.backup, `<button class="secondary" id="backup-folder" ${state.account.role === "administrateur" ? "" : "disabled"}>Dossier</button><button class="danger" id="restore-backup" ${canRestore ? "" : "disabled"}>Restaurer</button><button class="primary" id="create-backup" ${state.account.role === "lecteur" ? "disabled" : ""}>Sauvegarder maintenant</button>`)}
    <div class="kpi-grid">${kpi("24H", "Fréquence", `${escapeHtml(state.settings.backup_interval_hours)} h`, "blue")}${kpi("RT", "Rétention", `${escapeHtml(state.settings.backup_retention)} copies`, "good")}${kpi("OK", "Dernier résultat", rows[0]?.status || "Aucune", rows[0]?.status === "Échec" ? "bad" : "good")}</div>
    <section class="panel table-panel">${renderTable("backups", rows, { actions: false })}</section>`;
  $("#create-backup").onclick = async () => { try { const result = await api(window.nova.backup.create(state.token), "Sauvegarde terminée."); showNotice(result.filePath); renderBackup(); } catch {} };
  $("#backup-folder").onclick = async () => { try { const settings = await api(window.nova.backup.chooseFolder(state.token)); if (settings) { state.settings = settings; toast("Dossier de sauvegarde mis à jour."); } } catch {} };
  $("#restore-backup").onclick = () => confirmRestore();
}

function confirmRestore() {
  openModal("Restauration de la base", `<p>Une copie de sécurité sera créée avant restauration. L’application vous déconnectera ensuite.</p><div class="form-actions"><button class="secondary" data-modal-cancel>Annuler</button><button class="danger" id="confirm-restore">Choisir la sauvegarde</button></div>`, "Action sensible");
  $("[data-modal-cancel]").onclick = closeModal;
  $("#confirm-restore").onclick = async () => { try { const result = await api(window.nova.backup.restore(state.token)); if (result?.restored) { closeModal(); showLogin("Restauration réussie. Reconnectez-vous."); } } catch {} };
}

async function renderLogs() {
  const [incidents, logs] = await Promise.all([api(window.nova.data.list(state.token, "incidents")), api(window.nova.data.list(state.token, "logs"))]);
  state.resources.incidents = incidents; state.resources.logs = logs;
  $("#view").innerHTML = `${pageHead(viewMeta.logs, `<button class="secondary" data-report="incidents" data-format="pdf">Rapport PDF</button>${roleCan("write") ? `<button class="primary" data-add="incidents">+ Déclarer un incident</button>` : ""}`)}
    <div class="dashboard-grid"><section class="panel table-panel"><div class="panel-head" style="padding:18px 18px 0"><div><p class="eyebrow">Qualification</p><h2>Incidents</h2></div></div>${renderTable("incidents", incidents)}</section><section class="panel"><div class="panel-head"><div><p class="eyebrow">Corrélation</p><h2>Événements récents</h2></div></div>${renderTable("logs", logs, { actions: false })}</section></div>`;
  bindCommon();
}

async function renderInfra() {
  const rows = await api(window.nova.data.list(state.token, "equipment")); state.resources.equipment = rows;
  $("#view").innerHTML = `${pageHead(viewMeta.infra, `<button class="secondary" data-report="equipment" data-format="pdf">Exporter le schéma PDF</button>`)}<section class="topology">${rows.slice(0,10).map((row, index) => `<div class="topology-node" style="--i:${index - 5}"><span>${escapeHtml(row.type.slice(0,2).toUpperCase())}</span><strong>${escapeHtml(row.name)}</strong><small>${escapeHtml(row.ip_address || row.type)} · ${escapeHtml(row.status)}</small></div>`).join("")}</section><div class="recommendation">La vue logique est générée à partir de l’inventaire commun. Une modification dans NetWatch est donc immédiatement réutilisée ici.</div>`;
  bindCommon();
}

async function renderSettings() {
  const [audit, settings] = await Promise.all([api(window.nova.data.list(state.token, "audit", { limit: 100 })), api(window.nova.settings.get(state.token))]);
  state.settings = settings;
  let accounts = [];
  if (state.account.role === "administrateur") accounts = await api(window.nova.data.list(state.token, "accounts"));
  $("#view").innerHTML = `${pageHead(viewMeta.settings, state.account.role === "administrateur" ? `<button class="primary" id="add-account">+ Créer un compte</button>` : "")}
    ${state.account.role === "administrateur" ? `<div class="dashboard-grid"><section class="panel table-panel"><div class="panel-head" style="padding:18px 18px 0"><div><p class="eyebrow">Contrôle d’accès</p><h2>Comptes et rôles</h2></div></div>${renderTable("accounts", accounts, { actions: false })}</section><section class="panel"><div class="panel-head"><div><p class="eyebrow">Configuration</p><h2>Sauvegarde et verrouillage</h2></div></div><form id="settings-form" class="form-grid"><label>Intervalle de sauvegarde (h)<input name="backup_interval_hours" type="number" min="1" max="168" value="${escapeHtml(settings.backup_interval_hours)}" /></label><label>Copies conservées<input name="backup_retention" type="number" min="1" max="90" value="${escapeHtml(settings.backup_retention)}" /></label><label class="full">Verrouillage automatique (min)<input name="auto_lock_minutes" type="number" min="1" max="120" value="${escapeHtml(settings.auto_lock_minutes)}" /></label><div class="form-actions"><button class="primary">Enregistrer</button></div></form></section></div>` : `<section class="panel"><p>Votre rôle permet la consultation du journal, mais pas la gestion des comptes ni des paramètres.</p></section>`}
    <section class="panel table-panel" style="margin-top:18px"><div class="panel-head" style="padding:18px 18px 0"><div><p class="eyebrow">Traçabilité</p><h2>Historique complet des actions</h2></div><button class="secondary compact" data-report="audit" data-format="csv">Exporter CSV</button></div>${renderTable("audit", audit, { actions: false })}</section>`;
  bindCommon();
  if ($("#settings-form")) $("#settings-form").onsubmit = async (event) => { event.preventDefault(); try { state.settings = await api(window.nova.settings.update(state.token, Object.fromEntries(new FormData(event.currentTarget))), "Paramètres enregistrés."); resetIdleTimer(); } catch {} };
  if ($("#add-account")) $("#add-account").onclick = showAccountForm;
}

function bindSearch(resource) {
  const input = $("#resource-search"); if (!input) return;
  input.value = state.search;
  input.oninput = () => { state.search = input.value; const panel = $(".table-panel"); if (panel) panel.innerHTML = resource === "wifi" ? renderWifiCards(state.resources[resource]) : resource === "deployments" ? renderDeploymentCards(state.resources[resource]) : resource === "automation" ? renderAutomationCards(state.resources[resource]) : renderTable(resource, state.resources[resource]); bindCommon(); };
}

function bindCommon() {
  $$('[data-go]').forEach((button) => button.onclick = () => navigate(button.dataset.go));
  $$('[data-add]').forEach((button) => button.onclick = () => showCreateForm(button.dataset.add));
  $$('[data-import]').forEach((button) => button.onclick = () => importCsv(button.dataset.import));
  $$('[data-report]').forEach((button) => button.onclick = () => exportReport(button.dataset.report, button.dataset.format));
  $$('[data-delete-resource]').forEach((button) => button.onclick = () => deleteRow(button.dataset.deleteResource, button.dataset.deleteId));
  $$('[data-dry-run]').forEach((button) => button.onclick = () => runDry(button.dataset.dryRun));
}

function showCreateForm(resource) {
  const config = forms[resource]; if (!config) return;
  const fields = config.fields.map(([name, label, type = "text", required = false, options]) => {
    const full = type === "textarea" ? "full" : "";
    if (type === "select") return `<label class="${full}">${escapeHtml(label)}<select name="${name}" ${required ? "required" : ""}>${options.map((option) => `<option>${escapeHtml(option)}</option>`).join("")}</select></label>`;
    if (type === "textarea") return `<label class="full">${escapeHtml(label)}<textarea name="${name}" ${required ? "required" : ""}></textarea></label>`;
    return `<label class="${full}">${escapeHtml(label)}<input name="${name}" type="${type}" ${required ? "required" : ""} /></label>`;
  }).join("");
  openModal(config.title, `<form id="create-form" class="form-grid">${fields}<div class="form-actions"><button class="secondary" type="button" data-modal-cancel>Annuler</button><button class="primary">Enregistrer</button></div></form>`, "Base locale unifiée");
  $("[data-modal-cancel]").onclick = closeModal;
  $("#create-form").onsubmit = async (event) => { event.preventDefault(); const payload = Object.fromEntries(new FormData(event.currentTarget)); for (const [key, value] of Object.entries(payload)) if (["progress", "channel", "signal", "clients", "saved_minutes"].includes(key)) payload[key] = Number(value) || 0; try { await api(window.nova.data.create(state.token, resource, payload), "Élément enregistré et historisé."); closeModal(); navigate(state.view); } catch {} };
}

function showAccountForm() {
  openModal("Créer un compte", `<form id="account-form" class="form-grid"><label>Nom complet<input name="display_name" required /></label><label>Identifiant<input name="username" required minlength="3" /></label><label>Mot de passe<input name="password" type="password" minlength="10" required /></label><label>Rôle<select name="role"><option value="technicien">Technicien</option><option value="lecteur">Lecteur</option><option value="administrateur">Administrateur</option></select></label><div class="form-actions"><button type="button" class="secondary" data-modal-cancel>Annuler</button><button class="primary">Créer</button></div></form>`, "Contrôle d’accès");
  $("[data-modal-cancel]").onclick = closeModal;
  $("#account-form").onsubmit = async (event) => { event.preventDefault(); try { await api(window.nova.accounts.create(state.token, Object.fromEntries(new FormData(event.currentTarget))), "Compte créé."); closeModal(); renderSettings(); } catch {} };
}

function showDashboardCustomizer() {
  const options = [["tickets", "Tickets"], ["equipment", "Équipements"], ["incidents", "Incidents"], ["patches", "Correctifs"], ["activity", "Graphique"], ["notifications", "Notifications"]];
  openModal("Personnaliser le tableau de bord", `<form id="widgets-form"><div class="choice-grid">${options.map(([value, label]) => `<label><input type="checkbox" name="widgets" value="${value}" ${state.dashboard.widgets.includes(value) ? "checked" : ""} />${label}</label>`).join("")}</div><div class="form-actions"><button type="button" class="secondary" data-modal-cancel>Annuler</button><button class="primary">Appliquer</button></div></form>`, "Vos statistiques");
  $("[data-modal-cancel]").onclick = closeModal;
  $("#widgets-form").onsubmit = async (event) => { event.preventDefault(); const widgets = [...new FormData(event.currentTarget).getAll("widgets")]; try { await api(window.nova.dashboard.save(state.token, widgets), "Tableau de bord personnalisé."); closeModal(); renderDashboard(); } catch {} };
}

async function importCsv(resource) { try { const result = await api(window.nova.imports.csv(state.token, resource)); if (result) { toast(`${result.inserted} ligne(s) importée(s) depuis ${result.file}.`); navigate(state.view); } } catch {} }
async function exportReport(resource, format) { try { const result = await api(window.nova.reports.export(state.token, { resource, format })); if (result) showNotice(`Rapport créé : ${result.filePath}`); } catch {} }
function deleteRow(resource, id) { openModal("Confirmer la suppression", `<p>Cette suppression sera enregistrée dans l’historique d’audit.</p><div class="form-actions"><button class="secondary" data-modal-cancel>Annuler</button><button class="danger" id="confirm-delete">Supprimer</button></div>`, "Action administrateur"); $("[data-modal-cancel]").onclick = closeModal; $("#confirm-delete").onclick = async () => { try { await api(window.nova.data.delete(state.token, resource, id), "Élément supprimé."); closeModal(); navigate(state.view); } catch {} }; }
async function runDry(id) { try { const result = await api(window.nova.automation.dryRun(state.token, id), "Simulation terminée sans modification réelle."); const output = $(`#dry-${id}`); if (output) output.innerHTML = `<pre class="dry-output">${escapeHtml(result.output.join("\n"))}</pre>`; else openModal("Résultat du Dry-Run", `<pre class="dry-output">${escapeHtml(result.output.join("\n"))}</pre>`, "AutoAdmin sécurisé"); } catch {} }

function openModal(title, content, eyebrow = "NovaSuite") { $("#modal-title").textContent = title; $("#modal-eyebrow").textContent = eyebrow; $("#modal-content").innerHTML = content; $("#modal").classList.remove("hidden"); }
function closeModal() { $("#modal").classList.add("hidden"); $("#modal-content").innerHTML = ""; }

bootstrap().catch((error) => { document.body.innerHTML = `<main style="padding:40px"><h1>NovaSuite ne peut pas démarrer</h1><p>${escapeHtml(error.message)}</p></main>`; });
