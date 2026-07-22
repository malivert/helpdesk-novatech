const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { DatabaseSync } = require("node:sqlite");
const { hashPassword, verifyPassword } = require("./security.cjs");

const RESOURCE_CONFIG = {
  users: { table: "directory_users", fields: ["external_id", "display_name", "email", "department", "title", "status", "source"], required: ["display_name"] },
  equipment: { table: "equipment", fields: ["asset_tag", "name", "type", "serial", "ip_address", "os", "owner_user_id", "status", "last_seen_at", "source"], required: ["name", "type"] },
  tickets: { table: "tickets", fields: ["reference", "title", "description", "requester_user_id", "assigned_account_id", "priority", "status"], encrypted: ["description"], required: ["title"] },
  incidents: { table: "incidents", fields: ["reference", "title", "description", "severity", "status", "equipment_id", "assigned_account_id"], encrypted: ["description"], required: ["title"] },
  ipPlans: { table: "ip_plans", fields: ["name", "cidr", "network", "broadcast", "hosts", "vlan"], required: ["name", "cidr"] },
  deployments: { table: "deployments", fields: ["equipment_id", "device_name", "owner_name", "stage", "progress", "notes"], encrypted: ["notes"], required: ["device_name"] },
  patches: { table: "patches", fields: ["reference", "title", "severity", "status", "equipment_id", "deadline"], required: ["title"] },
  wifi: { table: "wifi_observations", fields: ["access_point", "ssid", "channel", "signal", "clients", "status", "observed_at"], required: ["access_point"] },
  logs: { table: "log_events", fields: ["source", "event", "severity", "status", "equipment_id"], required: ["event"] },
  automation: { table: "automation_jobs", fields: ["name", "shell", "purpose", "parameters", "status", "last_run_at", "saved_minutes"], encrypted: ["parameters"], required: ["name"] },
  notifications: { table: "notifications", fields: ["kind", "title", "message", "severity", "read_at"], required: ["title"] },
};

function now() { return new Date().toISOString(); }
function makeReference(prefix) { return `${prefix}-${Date.now().toString().slice(-6)}`; }
function safeJson(value) { return value === undefined ? null : JSON.stringify(value); }

class NovaDatabase {
  constructor(filePath, cryptoBox, { demo = false } = {}) {
    this.filePath = filePath;
    this.cryptoBox = cryptoBox;
    this.demo = demo;
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    this.open();
  }

  open() {
    this.db = new DatabaseSync(this.filePath);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
    this.migrate();
    if (this.demo) this.seedDemo();
  }

  close() { this.db?.close(); }

  migrate() {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS accounts (
        id TEXT PRIMARY KEY, username TEXT UNIQUE NOT NULL, display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL, password_salt TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('administrateur','technicien','lecteur')),
        active INTEGER NOT NULL DEFAULT 1, created_at TEXT NOT NULL, updated_at TEXT NOT NULL, last_login_at TEXT
      );
      CREATE TABLE IF NOT EXISTS directory_users (
        id TEXT PRIMARY KEY, external_id TEXT, display_name TEXT NOT NULL, email TEXT, department TEXT,
        title TEXT, status TEXT NOT NULL DEFAULT 'Actif', source TEXT NOT NULL DEFAULT 'Manuel',
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS equipment (
        id TEXT PRIMARY KEY, asset_tag TEXT, name TEXT NOT NULL, type TEXT NOT NULL, serial TEXT,
        ip_address TEXT, os TEXT, owner_user_id TEXT, status TEXT NOT NULL DEFAULT 'En ligne',
        last_seen_at TEXT, source TEXT NOT NULL DEFAULT 'Manuel', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        FOREIGN KEY(owner_user_id) REFERENCES directory_users(id) ON DELETE SET NULL
      );
      CREATE TABLE IF NOT EXISTS tickets (
        id TEXT PRIMARY KEY, reference TEXT UNIQUE NOT NULL, title TEXT NOT NULL, description TEXT,
        requester_user_id TEXT, assigned_account_id TEXT, priority TEXT NOT NULL DEFAULT 'Moyenne',
        status TEXT NOT NULL DEFAULT 'Ouvert', created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        FOREIGN KEY(requester_user_id) REFERENCES directory_users(id) ON DELETE SET NULL,
        FOREIGN KEY(assigned_account_id) REFERENCES accounts(id) ON DELETE SET NULL
      );
      CREATE TABLE IF NOT EXISTS incidents (
        id TEXT PRIMARY KEY, reference TEXT UNIQUE NOT NULL, title TEXT NOT NULL, description TEXT,
        severity TEXT NOT NULL DEFAULT 'Moyenne', status TEXT NOT NULL DEFAULT 'Nouveau',
        equipment_id TEXT, assigned_account_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        FOREIGN KEY(equipment_id) REFERENCES equipment(id) ON DELETE SET NULL,
        FOREIGN KEY(assigned_account_id) REFERENCES accounts(id) ON DELETE SET NULL
      );
      CREATE TABLE IF NOT EXISTS ip_plans (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, cidr TEXT NOT NULL, network TEXT, broadcast TEXT,
        hosts INTEGER DEFAULT 0, vlan INTEGER, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS deployments (
        id TEXT PRIMARY KEY, equipment_id TEXT, device_name TEXT NOT NULL, owner_name TEXT, stage TEXT NOT NULL DEFAULT 'Préparation',
        progress INTEGER NOT NULL DEFAULT 0, notes TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        FOREIGN KEY(equipment_id) REFERENCES equipment(id) ON DELETE SET NULL
      );
      CREATE TABLE IF NOT EXISTS patches (
        id TEXT PRIMARY KEY, reference TEXT, title TEXT NOT NULL, severity TEXT NOT NULL DEFAULT 'Importante',
        status TEXT NOT NULL DEFAULT 'À planifier', equipment_id TEXT, deadline TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        FOREIGN KEY(equipment_id) REFERENCES equipment(id) ON DELETE SET NULL
      );
      CREATE TABLE IF NOT EXISTS wifi_observations (
        id TEXT PRIMARY KEY, access_point TEXT NOT NULL, ssid TEXT, channel INTEGER, signal INTEGER,
        clients INTEGER DEFAULT 0, status TEXT NOT NULL DEFAULT 'Bon', observed_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS log_events (
        id TEXT PRIMARY KEY, source TEXT, event TEXT NOT NULL, severity TEXT NOT NULL DEFAULT 'Information',
        status TEXT NOT NULL DEFAULT 'Nouveau', equipment_id TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
        FOREIGN KEY(equipment_id) REFERENCES equipment(id) ON DELETE SET NULL
      );
      CREATE TABLE IF NOT EXISTS automation_jobs (
        id TEXT PRIMARY KEY, name TEXT NOT NULL, shell TEXT NOT NULL DEFAULT 'PowerShell', purpose TEXT,
        parameters TEXT, status TEXT NOT NULL DEFAULT 'Prêt', last_run_at TEXT, saved_minutes INTEGER DEFAULT 0,
        created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS notifications (
        id TEXT PRIMARY KEY, kind TEXT NOT NULL, title TEXT NOT NULL, message TEXT, severity TEXT NOT NULL,
        read_at TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS audit_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT, actor_id TEXT, actor_name TEXT NOT NULL, action TEXT NOT NULL,
        entity_type TEXT NOT NULL, entity_id TEXT, before_json TEXT, after_json TEXT, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS backups (
        id TEXT PRIMARY KEY, file_path TEXT NOT NULL, size_bytes INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL, automatic INTEGER NOT NULL DEFAULT 0, error_message TEXT, created_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS dashboard_preferences (
        account_id TEXT PRIMARY KEY, widgets_json TEXT NOT NULL, updated_at TEXT NOT NULL,
        FOREIGN KEY(account_id) REFERENCES accounts(id) ON DELETE CASCADE
      );
      CREATE INDEX IF NOT EXISTS idx_tickets_status ON tickets(status);
      CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
      CREATE INDEX IF NOT EXISTS idx_equipment_status ON equipment(status);
      CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read_at, created_at DESC);
    `);
    this.setSettingIfMissing("schema_version", "2");
    this.setSettingIfMissing("backup_interval_hours", "24");
    this.setSettingIfMissing("backup_retention", "14");
    this.setSettingIfMissing("auto_lock_minutes", "10");
  }

  setSettingIfMissing(key, value) {
    this.db.prepare("INSERT OR IGNORE INTO settings(key,value,updated_at) VALUES(?,?,?)").run(key, value, now());
  }

  isFirstRun() {
    return this.db.prepare("SELECT COUNT(*) AS count FROM accounts").get().count === 0;
  }

  createAccount({ username, display_name, password, role = "lecteur" }, actor = { id: null, display_name: "Assistant d’installation" }) {
    if (!/^[a-z0-9._-]{3,40}$/i.test(username ?? "")) throw new Error("Identifiant invalide.");
    if (!display_name?.trim()) throw new Error("Le nom complet est obligatoire.");
    if (!['administrateur', 'technicien', 'lecteur'].includes(role)) throw new Error("Rôle invalide.");
    const { salt, hash } = hashPassword(password);
    const account = { id: crypto.randomUUID(), username: username.trim().toLowerCase(), display_name: display_name.trim(), role, active: 1, created_at: now(), updated_at: now() };
    this.db.prepare("INSERT INTO accounts(id,username,display_name,password_hash,password_salt,role,active,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)")
      .run(account.id, account.username, account.display_name, hash, salt, role, 1, account.created_at, account.updated_at);
    this.audit(actor, "Création du compte", "accounts", account.id, null, { username: account.username, display_name: account.display_name, role });
    return account;
  }

  authenticate(username, password) {
    const account = this.db.prepare("SELECT * FROM accounts WHERE username=? AND active=1").get(String(username).trim().toLowerCase());
    if (!account || !verifyPassword(password, account.password_salt, account.password_hash)) return null;
    this.db.prepare("UPDATE accounts SET last_login_at=?, updated_at=? WHERE id=?").run(now(), now(), account.id);
    const safe = this.cleanAccount(account);
    this.audit(safe, "Connexion", "session", safe.id, null, { mode: this.demo ? "Démonstration" : "Entreprise" });
    return safe;
  }

  cleanAccount(account) {
    if (!account) return null;
    return { id: account.id, username: account.username, display_name: account.display_name, role: account.role, active: Boolean(account.active), last_login_at: account.last_login_at };
  }

  listAccounts() {
    return this.db.prepare("SELECT id,username,display_name,role,active,created_at,last_login_at FROM accounts ORDER BY display_name").all().map((row) => ({ ...row, active: Boolean(row.active) }));
  }

  updateAccount(id, changes, actor) {
    const before = this.db.prepare("SELECT id,username,display_name,role,active FROM accounts WHERE id=?").get(id);
    if (!before) throw new Error("Compte introuvable.");
    const role = changes.role ?? before.role;
    const active = changes.active === undefined ? before.active : Number(Boolean(changes.active));
    if (!['administrateur', 'technicien', 'lecteur'].includes(role)) throw new Error("Rôle invalide.");
    this.db.prepare("UPDATE accounts SET role=?, active=?, updated_at=? WHERE id=?").run(role, active, now(), id);
    const after = { ...before, role, active };
    this.audit(actor, "Modification du compte", "accounts", id, before, after);
    return after;
  }

  list(resource, { limit = 250 } = {}) {
    if (resource === "audit") return this.db.prepare("SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT ?").all(Math.min(Number(limit) || 250, 1000));
    if (resource === "accounts") return this.listAccounts();
    if (resource === "backups") return this.db.prepare("SELECT * FROM backups ORDER BY created_at DESC LIMIT ?").all(Math.min(Number(limit) || 250, 1000));
    const config = RESOURCE_CONFIG[resource];
    if (!config) throw new Error("Ressource inconnue.");
    const rows = this.db.prepare(`SELECT * FROM ${config.table} ORDER BY updated_at DESC LIMIT ?`).all(Math.min(Number(limit) || 250, 1000));
    return rows.map((row) => this.decryptRow(row, config));
  }

  get(resource, id) {
    const config = RESOURCE_CONFIG[resource];
    if (!config) throw new Error("Ressource inconnue.");
    return this.decryptRow(this.db.prepare(`SELECT * FROM ${config.table} WHERE id=?`).get(id), config);
  }

  create(resource, payload, actor) {
    const config = RESOURCE_CONFIG[resource];
    if (!config) throw new Error("Ressource inconnue.");
    for (const field of config.required ?? []) if (!String(payload[field] ?? "").trim()) throw new Error(`Le champ ${field} est obligatoire.`);
    const id = crypto.randomUUID();
    const timestamp = now();
    const values = { ...payload };
    if (resource === "tickets" && !values.reference) values.reference = makeReference("INC");
    if (resource === "incidents" && !values.reference) values.reference = makeReference("SEC");
    const fields = config.fields.filter((field) => values[field] !== undefined);
    const stored = fields.map((field) => config.encrypted?.includes(field) ? this.cryptoBox.encrypt(values[field]) : values[field]);
    this.db.prepare(`INSERT INTO ${config.table}(id,${fields.join(",")},created_at,updated_at) VALUES(?,${fields.map(() => "?").join(",")},?,?)`)
      .run(id, ...stored, timestamp, timestamp);
    const created = this.get(resource, id);
    this.audit(actor, "Création", resource, id, null, created);
    this.raiseOperationalNotification(resource, created);
    return created;
  }

  update(resource, id, changes, actor) {
    const config = RESOURCE_CONFIG[resource];
    if (!config) throw new Error("Ressource inconnue.");
    const before = this.get(resource, id);
    if (!before) throw new Error("Élément introuvable.");
    const fields = config.fields.filter((field) => changes[field] !== undefined);
    if (!fields.length) return before;
    const values = fields.map((field) => config.encrypted?.includes(field) ? this.cryptoBox.encrypt(changes[field]) : changes[field]);
    this.db.prepare(`UPDATE ${config.table} SET ${fields.map((field) => `${field}=?`).join(",")},updated_at=? WHERE id=?`)
      .run(...values, now(), id);
    const after = this.get(resource, id);
    this.audit(actor, "Modification", resource, id, before, after);
    this.raiseOperationalNotification(resource, after);
    return after;
  }

  remove(resource, id, actor) {
    const config = RESOURCE_CONFIG[resource];
    if (!config) throw new Error("Ressource inconnue.");
    const before = this.get(resource, id);
    if (!before) return false;
    this.db.prepare(`DELETE FROM ${config.table} WHERE id=?`).run(id);
    this.audit(actor, "Suppression", resource, id, before, null);
    return true;
  }

  importRows(resource, rows, actor) {
    let inserted = 0;
    this.db.exec("BEGIN IMMEDIATE");
    try {
      for (const row of rows) { this.create(resource, row, actor); inserted += 1; }
      this.db.exec("COMMIT");
    } catch (error) {
      this.db.exec("ROLLBACK");
      throw error;
    }
    this.audit(actor, "Import CSV", resource, null, null, { inserted });
    return inserted;
  }

  decryptRow(row, config) {
    if (!row) return null;
    const output = { ...row };
    for (const field of config.encrypted ?? []) output[field] = this.cryptoBox.decrypt(output[field]);
    return output;
  }

  audit(actor, action, entityType, entityId, before, after) {
    this.db.prepare("INSERT INTO audit_logs(actor_id,actor_name,action,entity_type,entity_id,before_json,after_json,created_at) VALUES(?,?,?,?,?,?,?,?)")
      .run(actor?.id ?? null, actor?.display_name ?? "Système", action, entityType, entityId ?? null, safeJson(before), safeJson(after), now());
  }

  createNotification({ kind, title, message, severity = "Information" }) {
    const id = crypto.randomUUID();
    const timestamp = now();
    this.db.prepare("INSERT INTO notifications(id,kind,title,message,severity,read_at,created_at,updated_at) VALUES(?,?,?,?,?,NULL,?,?)")
      .run(id, kind, title, message ?? "", severity, timestamp, timestamp);
    return { id, kind, title, message, severity, read_at: null, created_at: timestamp };
  }

  raiseOperationalNotification(resource, row) {
    if (resource === "equipment" && /panne|hors ligne|alerte/i.test(row.status ?? "")) {
      this.createNotification({ kind: "panne", title: `${row.name} nécessite une intervention`, message: `État détecté : ${row.status}`, severity: "Critique" });
    }
    if (resource === "patches" && /critique/i.test(row.severity ?? "") && !/déploy/i.test(row.status ?? "")) {
      this.createNotification({ kind: "correctif", title: "Correctif critique à déployer", message: row.title, severity: "Critique" });
    }
  }

  markNotificationRead(id, actor) {
    this.db.prepare("UPDATE notifications SET read_at=?,updated_at=? WHERE id=?").run(now(), now(), id);
    this.audit(actor, "Notification lue", "notifications", id, null, { read: true });
  }

  dashboard(accountId) {
    const count = (table, where = "1=1") => this.db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE ${where}`).get().count;
    const ticketStatuses = this.db.prepare("SELECT status AS label, COUNT(*) AS value FROM tickets GROUP BY status ORDER BY value DESC").all();
    const equipmentStatuses = this.db.prepare("SELECT status AS label, COUNT(*) AS value FROM equipment GROUP BY status ORDER BY value DESC").all();
    const patchSeverity = this.db.prepare("SELECT severity AS label, COUNT(*) AS value FROM patches GROUP BY severity ORDER BY value DESC").all();
    const preference = this.db.prepare("SELECT widgets_json FROM dashboard_preferences WHERE account_id=?").get(accountId);
    return {
      metrics: {
        openTickets: count("tickets", "status <> 'Résolu'"),
        equipmentOnline: count("equipment", "status = 'En ligne'"),
        equipmentTotal: count("equipment"),
        activeIncidents: count("incidents", "status <> 'Résolu'"),
        criticalPatches: count("patches", "severity = 'Critique' AND status <> 'Déployée'"),
        unreadNotifications: count("notifications", "read_at IS NULL"),
      },
      charts: { ticketStatuses, equipmentStatuses, patchSeverity },
      recentAudit: this.list("audit", { limit: 8 }),
      notifications: this.list("notifications", { limit: 8 }),
      widgets: preference ? JSON.parse(preference.widgets_json) : ["tickets", "equipment", "incidents", "patches", "activity", "notifications"],
    };
  }

  saveDashboard(accountId, widgets, actor) {
    const value = JSON.stringify([...new Set(widgets)]);
    this.db.prepare("INSERT INTO dashboard_preferences(account_id,widgets_json,updated_at) VALUES(?,?,?) ON CONFLICT(account_id) DO UPDATE SET widgets_json=excluded.widgets_json,updated_at=excluded.updated_at")
      .run(accountId, value, now());
    this.audit(actor, "Personnalisation du tableau de bord", "dashboard", accountId, null, { widgets });
  }

  getSettings() {
    return Object.fromEntries(this.db.prepare("SELECT key,value FROM settings").all().map((row) => [row.key, row.value]));
  }

  setSettings(settings, actor) {
    const allowed = ["backup_interval_hours", "backup_retention", "auto_lock_minutes", "backup_folder"];
    for (const [key, value] of Object.entries(settings)) {
      if (!allowed.includes(key)) continue;
      this.db.prepare("INSERT INTO settings(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at")
        .run(key, String(value), now());
    }
    this.audit(actor, "Modification des paramètres", "settings", null, null, settings);
    return this.getSettings();
  }

  recordBackup({ filePath, sizeBytes = 0, status, automatic = false, errorMessage = null }) {
    const record = { id: crypto.randomUUID(), file_path: filePath, size_bytes: sizeBytes, status, automatic: Number(automatic), error_message: errorMessage, created_at: now() };
    this.db.prepare("INSERT INTO backups(id,file_path,size_bytes,status,automatic,error_message,created_at) VALUES(?,?,?,?,?,?,?)")
      .run(record.id, record.file_path, record.size_bytes, record.status, record.automatic, record.error_message, record.created_at);
    if (status === "Échec") this.createNotification({ kind: "sauvegarde", title: "Échec de la sauvegarde automatique", message: errorMessage || filePath, severity: "Critique" });
    return record;
  }

  seedDemo() {
    if (this.db.prepare("SELECT COUNT(*) AS count FROM equipment").get().count > 0) return;
    const system = { id: null, display_name: "Mode Démonstration" };
    if (this.isFirstRun()) this.createAccount({ username: "demo.admin", display_name: "Administrateur Démo", password: "NovaSuite!2026", role: "administrateur" }, system);
    const users = [
      { external_id: "sbernard", display_name: "Sophie Bernard", email: "sophie.bernard@example.local", department: "Finance", title: "Comptable", status: "Actif", source: "Démonstration" },
      { external_id: "tleroy", display_name: "Thomas Leroy", email: "thomas.leroy@example.local", department: "Technique", title: "Technicien", status: "Actif", source: "Démonstration" },
      { external_id: "npetit", display_name: "Nadia Petit", email: "nadia.petit@example.local", department: "RH", title: "RH", status: "Inactif", source: "Démonstration" },
    ].map((row) => this.create("users", row, system));
    const equipment = [
      { asset_tag: "SRV-001", name: "SRV-AD-01", type: "Serveur", ip_address: "10.20.1.10", os: "Windows Server 2025", owner_user_id: users[1].id, status: "En ligne", source: "Démonstration" },
      { asset_tag: "FW-001", name: "FW-PAR-01", type: "Pare-feu", ip_address: "10.20.0.1", os: "FirewallOS", status: "En ligne", source: "Démonstration" },
      { asset_tag: "SW-012", name: "SW-ETG2-01", type: "Commutateur", ip_address: "10.20.2.2", status: "Alerte", source: "Démonstration" },
      { asset_tag: "NAS-001", name: "NAS-BACKUP", type: "Stockage", ip_address: "10.20.1.40", status: "En ligne", source: "Démonstration" },
    ].map((row) => this.create("equipment", row, system));
    this.create("tickets", { reference: "INC-1042", title: "Accès VPN impossible", description: "L’utilisateur ne peut plus ouvrir le tunnel VPN.", requester_user_id: users[0].id, priority: "Haute", status: "En cours" }, system);
    this.create("tickets", { reference: "INC-1041", title: "Imprimante du service RH", description: "File d’impression bloquée.", requester_user_id: users[2].id, priority: "Moyenne", status: "Ouvert" }, system);
    this.create("incidents", { reference: "SEC-901", title: "Échecs d’authentification répétés", description: "Plusieurs connexions refusées sur le contrôleur de domaine.", severity: "Haute", status: "Nouveau", equipment_id: equipment[0].id }, system);
    this.create("ipPlans", { name: "VLAN 10 — Administration", cidr: "10.20.10.0/24", network: "10.20.10.0", broadcast: "10.20.10.255", hosts: 254, vlan: 10 }, system);
    this.create("deployments", { equipment_id: null, device_name: "PC-COMPTA-14", owner_name: "Sophie Bernard", stage: "Configuration", progress: 65, notes: "Chiffrement BitLocker et logiciels métiers." }, system);
    this.create("patches", { reference: "KB-721", title: "Correctif sécurité Windows 11", severity: "Critique", status: "À planifier", deadline: "2026-07-25" }, system);
    this.create("wifi", { access_point: "AP-ETAGE-2", ssid: "NovaTech-Pro", channel: 11, signal: -73, clients: 21, status: "À optimiser", observed_at: now() }, system);
    this.create("logs", { source: "FW-PAR-01", event: "Tentatives de connexion bloquées", severity: "Critique", status: "Nouveau", equipment_id: equipment[1].id }, system);
    this.create("automation", { name: "Contrôler l’espace disque", shell: "PowerShell", purpose: "Lister les volumes sous le seuil", parameters: "seuil=15%; mode=Dry-Run", status: "Prêt", saved_minutes: 8 }, system);
  }
}

module.exports = { NovaDatabase, RESOURCE_CONFIG };
