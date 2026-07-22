const { app, BrowserWindow, dialog, ipcMain, Notification, safeStorage, shell } = require("electron");
const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { backup } = require("node:sqlite");
const { NovaDatabase } = require("./core/database.cjs");
const { CryptoBox, createMasterKey } = require("./core/security.cjs");
const { mapDirectoryUsers, mapEquipment, parseCsv, toCsv } = require("./core/csv.cjs");

const SESSION_MAX_IDLE_MS = 15 * 60 * 1000;
const ROLE_PERMISSIONS = {
  administrateur: new Set(["read", "write", "delete", "accounts", "settings", "backup", "restore", "import", "report", "automation"]),
  technicien: new Set(["read", "write", "backup", "import", "report", "automation"]),
  lecteur: new Set(["read", "report"]),
};

let mainWindow;
let enterpriseDb;
let demoDb;
let backupTimer;
const sessions = new Map();

function encodeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]);
}

function loadMasterKey() {
  const keyPath = path.join(app.getPath("userData"), "novasuite-master-key.bin");
  if (fs.existsSync(keyPath)) {
    const stored = fs.readFileSync(keyPath);
    try {
      if (safeStorage.isEncryptionAvailable()) return Buffer.from(safeStorage.decryptString(stored), "base64");
    } catch {}
    if (stored.subarray(0, 4).toString() === "RAW:") return Buffer.from(stored.subarray(4).toString(), "base64");
    throw new Error("Impossible d’ouvrir la clé de chiffrement locale.");
  }
  const key = createMasterKey();
  const payload = safeStorage.isEncryptionAvailable()
    ? safeStorage.encryptString(key.toString("base64"))
    : Buffer.from(`RAW:${key.toString("base64")}`);
  fs.writeFileSync(keyPath, payload, { mode: 0o600 });
  return key;
}

function getDb(mode = "entreprise") {
  return mode === "demonstration" ? demoDb : enterpriseDb;
}

function createSession(account, mode) {
  const token = crypto.randomBytes(32).toString("hex");
  sessions.set(token, { account, mode, lastActivity: Date.now() });
  return token;
}

function requireSession(token, permission = "read") {
  const session = sessions.get(token);
  if (!session || Date.now() - session.lastActivity > SESSION_MAX_IDLE_MS) {
    sessions.delete(token);
    throw new Error("SESSION_EXPIREE");
  }
  if (!ROLE_PERMISSIONS[session.account.role]?.has(permission)) throw new Error("ACTION_NON_AUTORISEE");
  session.lastActivity = Date.now();
  return { ...session, db: getDb(session.mode) };
}

function safeHandler(channel, handler) {
  ipcMain.handle(channel, async (event, ...args) => {
    try {
      return { ok: true, data: await handler(event, ...args) };
    } catch (error) {
      const known = {
        SESSION_EXPIREE: "La session a expiré. Reconnectez-vous.",
        ACTION_NON_AUTORISEE: "Votre rôle ne permet pas cette action.",
      };
      return { ok: false, error: known[error.message] ?? error.message ?? "Une erreur locale est survenue." };
    }
  });
}

function actor(session) {
  return { id: session.account.id, display_name: session.account.display_name };
}

async function createBackup(db, { automatic = false, destination } = {}) {
  const settings = db.getSettings();
  const folder = destination || settings.backup_folder || path.join(app.getPath("documents"), "NovaSuite SISR", "Sauvegardes");
  fs.mkdirSync(folder, { recursive: true });
  const stamp = new Date().toISOString().replaceAll(":", "-").replace("T", "_").slice(0, 19);
  const filePath = path.join(folder, `novasuite-${stamp}.sqlite`);
  try {
    await backup(db.db, filePath);
    const size = fs.statSync(filePath).size;
    db.recordBackup({ filePath, sizeBytes: size, status: "Réussie", automatic });
    rotateBackups(folder, Number(settings.backup_retention) || 14);
    return { filePath, sizeBytes: size };
  } catch (error) {
    db.recordBackup({ filePath, status: "Échec", automatic, errorMessage: error.message });
    showSystemNotification("Sauvegarde NovaSuite échouée", error.message, "critical");
    throw error;
  }
}

function rotateBackups(folder, retention) {
  const files = fs.readdirSync(folder).filter((name) => /^novasuite-.*\.sqlite$/i.test(name))
    .map((name) => ({ name, path: path.join(folder, name), at: fs.statSync(path.join(folder, name)).mtimeMs }))
    .sort((a, b) => b.at - a.at);
  for (const file of files.slice(Math.max(1, retention))) fs.rmSync(file.path, { force: true });
}

function showSystemNotification(title, body, urgency = "normal") {
  if (Notification.isSupported()) new Notification({ title, body, urgency }).show();
  mainWindow?.webContents.send("novasuite:notification", { title, body, urgency });
}

async function checkAutomaticBackup() {
  if (!enterpriseDb || enterpriseDb.isFirstRun()) return;
  const settings = enterpriseDb.getSettings();
  const intervalMs = Math.max(1, Number(settings.backup_interval_hours) || 24) * 60 * 60 * 1000;
  const last = enterpriseDb.list("backups", { limit: 1 })[0];
  if (!last || Date.now() - new Date(last.created_at).getTime() >= intervalMs) {
    const result = await createBackup(enterpriseDb, { automatic: true });
    showSystemNotification("Sauvegarde automatique réussie", path.basename(result.filePath));
  }
}

function createReportHtml(title, rows) {
  const columns = Object.keys(rows[0] ?? {}).filter((key) => !/password|salt/i.test(key)).slice(0, 8);
  const table = rows.length ? `<table><thead><tr>${columns.map((key) => `<th>${encodeHtml(key)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map((key) => `<td>${encodeHtml(row[key])}</td>`).join("")}</tr>`).join("")}</tbody></table>` : "<p>Aucune donnée dans ce rapport.</p>";
  return `<!doctype html><html lang="fr"><meta charset="utf-8"><style>
    @page{size:A4;margin:16mm}body{font:12px Arial;color:#172033}header{border-bottom:3px solid #246cf0;padding-bottom:14px;margin-bottom:24px}h1{margin:0;font-size:24px}header p{color:#667085}table{width:100%;border-collapse:collapse}th{background:#edf4ff;color:#214b8f;text-align:left}th,td{border:1px solid #d9e2ef;padding:7px;vertical-align:top}footer{position:fixed;bottom:0;color:#7b8798;font-size:9px}</style>
    <body><header><h1>NovaSuite SISR — ${encodeHtml(title)}</h1><p>Rapport professionnel généré localement le ${encodeHtml(new Intl.DateTimeFormat("fr-FR", { dateStyle: "full", timeStyle: "short" }).format(new Date()))}</p></header>${table}<footer>Données locales confidentielles · NovaSuite SISR</footer></body></html>`;
}

async function exportPdf(title, rows, destination) {
  const reportWindow = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  await reportWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(createReportHtml(title, rows))}`);
  const buffer = await reportWindow.webContents.printToPDF({ printBackground: true, pageSize: "A4" });
  fs.writeFileSync(destination, buffer);
  reportWindow.destroy();
}

function registerIpc() {
  safeHandler("app:bootstrap", async () => ({
    firstRun: enterpriseDb.isFirstRun(),
    product: "NovaSuite SISR Entreprise",
    version: app.getVersion(),
    demoCredentials: { username: "demo.admin", password: "NovaSuite!2026" },
  }));

  safeHandler("auth:setup", async (_event, payload) => {
    if (!enterpriseDb.isFirstRun()) throw new Error("L’administrateur initial existe déjà.");
    const account = enterpriseDb.createAccount({ ...payload, role: "administrateur" });
    return { account, token: createSession(account, "entreprise"), mode: "entreprise", settings: enterpriseDb.getSettings() };
  });

  safeHandler("auth:login", async (_event, { username, password, mode }) => {
    const selectedMode = mode === "demonstration" ? "demonstration" : "entreprise";
    const db = getDb(selectedMode);
    if (selectedMode === "entreprise" && db.isFirstRun()) throw new Error("Terminez d’abord l’assistant d’installation.");
    const account = db.authenticate(username, password);
    if (!account) throw new Error("Identifiant ou mot de passe incorrect.");
    return { account, token: createSession(account, selectedMode), mode: selectedMode, settings: db.getSettings() };
  });

  safeHandler("auth:touch", async (_event, token) => {
    const session = requireSession(token);
    return { expiresInMs: SESSION_MAX_IDLE_MS, account: session.account };
  });

  safeHandler("auth:logout", async (_event, token) => {
    const session = sessions.get(token);
    if (session) getDb(session.mode).audit(actor(session), "Déconnexion", "session", session.account.id, null, null);
    sessions.delete(token);
    return true;
  });

  safeHandler("data:dashboard", async (_event, token) => {
    const session = requireSession(token);
    return session.db.dashboard(session.account.id);
  });

  safeHandler("data:list", async (_event, token, resource, options) => {
    const session = requireSession(token);
    if (resource === "accounts" && !ROLE_PERMISSIONS[session.account.role].has("accounts")) throw new Error("ACTION_NON_AUTORISEE");
    return session.db.list(resource, options);
  });

  safeHandler("data:create", async (_event, token, resource, payload) => {
    const session = requireSession(token, "write");
    const created = session.db.create(resource, payload, actor(session));
    const latest = session.db.list("notifications", { limit: 1 })[0];
    if (latest && latest.severity === "Critique" && Date.now() - new Date(latest.created_at).getTime() < 3000) showSystemNotification(latest.title, latest.message, "critical");
    return created;
  });

  safeHandler("data:update", async (_event, token, resource, id, changes) => {
    const session = requireSession(token, "write");
    return session.db.update(resource, id, changes, actor(session));
  });

  safeHandler("data:delete", async (_event, token, resource, id) => {
    const session = requireSession(token, "delete");
    return session.db.remove(resource, id, actor(session));
  });

  safeHandler("accounts:create", async (_event, token, payload) => {
    const session = requireSession(token, "accounts");
    return session.db.createAccount(payload, actor(session));
  });

  safeHandler("accounts:update", async (_event, token, id, changes) => {
    const session = requireSession(token, "accounts");
    return session.db.updateAccount(id, changes, actor(session));
  });

  safeHandler("dashboard:save", async (_event, token, widgets) => {
    const session = requireSession(token, "write");
    session.db.saveDashboard(session.account.id, widgets, actor(session));
    return session.db.dashboard(session.account.id);
  });

  safeHandler("settings:get", async (_event, token) => requireSession(token).db.getSettings());
  safeHandler("settings:update", async (_event, token, settings) => {
    const session = requireSession(token, "settings");
    return session.db.setSettings(settings, actor(session));
  });

  safeHandler("backup:create", async (_event, token) => {
    const session = requireSession(token, "backup");
    const result = await createBackup(session.db, { automatic: false });
    session.db.audit(actor(session), "Sauvegarde manuelle", "backups", null, null, result);
    return result;
  });

  safeHandler("backup:choose-folder", async (_event, token) => {
    const session = requireSession(token, "settings");
    const result = await dialog.showOpenDialog(mainWindow, { properties: ["openDirectory", "createDirectory"], title: "Choisir le dossier des sauvegardes" });
    if (result.canceled) return null;
    return session.db.setSettings({ backup_folder: result.filePaths[0] }, actor(session));
  });

  safeHandler("backup:restore", async (_event, token) => {
    const session = requireSession(token, "restore");
    if (session.mode !== "entreprise") throw new Error("La restauration est réservée au mode Entreprise.");
    const selected = await dialog.showOpenDialog(mainWindow, { title: "Restaurer une sauvegarde NovaSuite", properties: ["openFile"], filters: [{ name: "Base SQLite NovaSuite", extensions: ["sqlite", "db"] }] });
    if (selected.canceled) return null;
    const source = selected.filePaths[0];
    const safetyCopy = `${enterpriseDb.filePath}.avant-restauration-${Date.now()}.sqlite`;
    await backup(enterpriseDb.db, safetyCopy);
    enterpriseDb.close();
    try {
      fs.copyFileSync(source, enterpriseDb.filePath);
      enterpriseDb.open();
      enterpriseDb.audit(actor(session), "Restauration", "backups", null, { safetyCopy }, { source });
      sessions.clear();
      return { restored: true, safetyCopy };
    } catch (error) {
      fs.copyFileSync(safetyCopy, enterpriseDb.filePath);
      enterpriseDb.open();
      throw error;
    }
  });

  safeHandler("import:csv", async (_event, token, resource) => {
    const session = requireSession(token, "import");
    if (!['users', 'equipment'].includes(resource)) throw new Error("Import non pris en charge.");
    const selected = await dialog.showOpenDialog(mainWindow, { title: resource === "users" ? "Importer des utilisateurs Active Directory" : "Importer des équipements", properties: ["openFile"], filters: [{ name: "Fichier CSV", extensions: ["csv"] }] });
    if (selected.canceled) return null;
    const parsed = parseCsv(fs.readFileSync(selected.filePaths[0], "utf8"));
    const rows = resource === "users" ? mapDirectoryUsers(parsed) : mapEquipment(parsed);
    if (!rows.length) throw new Error("Aucune ligne exploitable dans le fichier CSV.");
    return { inserted: session.db.importRows(resource, rows, actor(session)), file: path.basename(selected.filePaths[0]) };
  });

  safeHandler("report:export", async (_event, token, { resource, format }) => {
    const session = requireSession(token, "report");
    const rows = resource === "dashboard" ? [session.db.dashboard(session.account.id).metrics] : session.db.list(resource, { limit: 1000 });
    const extension = format === "pdf" ? "pdf" : "csv";
    const selected = await dialog.showSaveDialog(mainWindow, { title: `Exporter le rapport ${resource}`, defaultPath: path.join(app.getPath("documents"), `NovaSuite-${resource}-${new Date().toISOString().slice(0, 10)}.${extension}`), filters: [{ name: extension.toUpperCase(), extensions: [extension] }] });
    if (selected.canceled || !selected.filePath) return null;
    if (format === "pdf") await exportPdf(resource, rows, selected.filePath);
    else fs.writeFileSync(selected.filePath, toCsv(rows), "utf8");
    session.db.audit(actor(session), `Export ${extension.toUpperCase()}`, "reports", resource, null, { file: selected.filePath, rows: rows.length });
    return { filePath: selected.filePath, rows: rows.length };
  });

  safeHandler("automation:dry-run", async (_event, token, id) => {
    const session = requireSession(token, "automation");
    const job = session.db.get("automation", id);
    if (!job) throw new Error("Script introuvable.");
    const output = [`Mode simulation activé`, `Script : ${job.name}`, `Paramètres : ${job.parameters || "aucun"}`, `Résultat : 0 modification réelle, contrôle terminé`];
    session.db.update("automation", id, { status: "Simulation réussie", last_run_at: new Date().toISOString() }, actor(session));
    session.db.create("logs", { source: "AutoAdmin", event: `Dry-Run réussi : ${job.name}`, severity: "Information", status: "Qualifié" }, actor(session));
    return { output };
  });

  safeHandler("shell:open-path", async (_event, token, target) => {
    requireSession(token);
    if (!path.isAbsolute(target)) throw new Error("Chemin invalide.");
    return shell.openPath(target);
  });
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440, height: 920, minWidth: 1080, minHeight: 700,
    backgroundColor: "#07111f", title: "NovaSuite SISR",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      devTools: !app.isPackaged,
    },
  });
  mainWindow.setMenuBarVisibility(false);
  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
}

app.whenReady().then(() => {
  const masterKey = loadMasterKey();
  const cryptoBox = new CryptoBox(masterKey);
  const dataDir = path.join(app.getPath("userData"), "data");
  enterpriseDb = new NovaDatabase(path.join(dataDir, "novasuite-entreprise.sqlite"), cryptoBox);
  demoDb = new NovaDatabase(path.join(dataDir, "novasuite-demonstration.sqlite"), cryptoBox, { demo: true });
  registerIpc();
  createWindow();
  backupTimer = setInterval(() => checkAutomaticBackup().catch(() => undefined), 30 * 60 * 1000);
  setTimeout(() => checkAutomaticBackup().catch(() => undefined), 10_000);
  app.on("activate", () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on("window-all-closed", () => { if (process.platform !== "darwin") app.quit(); });
app.on("before-quit", () => {
  clearInterval(backupTimer);
  enterpriseDb?.close();
  demoDb?.close();
});
