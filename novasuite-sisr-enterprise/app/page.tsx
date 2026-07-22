"use client";

import { ChangeEvent, FormEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";

type ModuleId =
  | "dashboard"
  | "helpdesk"
  | "netwatch"
  | "adlab"
  | "ipplan"
  | "backup"
  | "deploy"
  | "patch"
  | "wifi"
  | "logs"
  | "infra"
  | "automation";

type Activity = { id: string; action: string; detail: string; at: string };
type Ticket = { id: string; title: string; requester: string; priority: "Basse" | "Moyenne" | "Haute"; status: "Ouvert" | "En cours" | "Résolu" };
type NodeRecord = { id: string; name: string; ip: string; role: string; status: "En ligne" | "Alerte"; latency: number };
type DirectoryUser = { id: string; name: string; department: string; role: string; enabled: boolean };
type IpPlan = { id: string; name: string; cidr: string; network: string; broadcast: string; hosts: number };
type BackupRecord = { id: string; target: string; type: string; status: "Réussie" | "À vérifier"; at: string };
type Deployment = { id: string; device: string; owner: string; stage: "Préparation" | "Configuration" | "Livraison" };
type PatchRecord = { id: string; name: string; severity: "Critique" | "Importante" | "Modérée"; devices: number; status: "À planifier" | "Planifiée" | "Déployée" };
type WifiRecord = { id: string; accessPoint: string; channel: number; signal: number; clients: number };
type LogRecord = { id: string; source: string; event: string; severity: "Critique" | "Avertissement" | "Information"; status: "Nouveau" | "Qualifié" };
type ScriptRecord = { id: string; name: string; shell: "PowerShell" | "Bash"; purpose: string; savedMinutes: number; lastRun: string };

type WorkspaceData = {
  schemaVersion: 1;
  tickets: Ticket[];
  nodes: NodeRecord[];
  users: DirectoryUser[];
  ipPlans: IpPlan[];
  backups: BackupRecord[];
  deployments: Deployment[];
  patches: PatchRecord[];
  wifi: WifiRecord[];
  logs: LogRecord[];
  scripts: ScriptRecord[];
  activity: Activity[];
};

const modules: { id: ModuleId; short: string; name: string; description: string; group: string }[] = [
  { id: "dashboard", short: "NX", name: "Vue d’ensemble", description: "Pilotage de l’activité", group: "Pilotage" },
  { id: "helpdesk", short: "HD", name: "HelpDesk", description: "Tickets et demandes", group: "Support" },
  { id: "netwatch", short: "NW", name: "NetWatch", description: "Supervision réseau", group: "Infrastructure" },
  { id: "adlab", short: "AD", name: "ADLab", description: "Utilisateurs et droits", group: "Administration" },
  { id: "ipplan", short: "IP", name: "IPPlan", description: "Sous-réseaux et VLAN", group: "Infrastructure" },
  { id: "backup", short: "BG", name: "BackupGuard", description: "Sauvegardes locales", group: "Continuité" },
  { id: "deploy", short: "DD", name: "DeployDesk", description: "Déploiement de postes", group: "Support" },
  { id: "patch", short: "PP", name: "PatchPilot", description: "Correctifs et conformité", group: "Sécurité" },
  { id: "wifi", short: "WS", name: "WiFiScope", description: "Audit Wi-Fi", group: "Infrastructure" },
  { id: "logs", short: "LS", name: "LogSentinel", description: "Journaux et incidents", group: "Sécurité" },
  { id: "infra", short: "ID", name: "InfraDiagram", description: "Cartographie du SI", group: "Infrastructure" },
  { id: "automation", short: "AA", name: "AutoAdmin", description: "Scripts en mode simulation", group: "Administration" },
];

const seedData: WorkspaceData = {
  schemaVersion: 1,
  tickets: [
    { id: "INC-1042", title: "Accès VPN impossible", requester: "Sophie Bernard", priority: "Haute", status: "En cours" },
    { id: "INC-1041", title: "Imprimante du service RH", requester: "Nadia Petit", priority: "Moyenne", status: "Ouvert" },
    { id: "INC-1038", title: "Réinitialisation du mot de passe", requester: "Thomas Leroy", priority: "Basse", status: "Résolu" },
  ],
  nodes: [
    { id: "N-01", name: "SRV-AD-01", ip: "10.20.1.10", role: "Active Directory", status: "En ligne", latency: 4 },
    { id: "N-02", name: "FW-PAR-01", ip: "10.20.0.1", role: "Pare-feu", status: "En ligne", latency: 2 },
    { id: "N-03", name: "SW-ETG2-01", ip: "10.20.2.2", role: "Commutateur", status: "Alerte", latency: 96 },
    { id: "N-04", name: "NAS-BACKUP", ip: "10.20.1.40", role: "Stockage", status: "En ligne", latency: 7 },
  ],
  users: [
    { id: "U-101", name: "Sophie Bernard", department: "Finance", role: "Utilisateur", enabled: true },
    { id: "U-102", name: "Thomas Leroy", department: "Technique", role: "Technicien", enabled: true },
    { id: "U-103", name: "Nadia Petit", department: "RH", role: "Utilisateur", enabled: false },
  ],
  ipPlans: [
    { id: "IP-1", name: "VLAN 10 — Administration", cidr: "10.20.10.0/24", network: "10.20.10.0", broadcast: "10.20.10.255", hosts: 254 },
    { id: "IP-2", name: "VLAN 20 — Utilisateurs", cidr: "10.20.20.0/24", network: "10.20.20.0", broadcast: "10.20.20.255", hosts: 254 },
  ],
  backups: [
    { id: "B-301", target: "Base HelpDesk locale", type: "Complète", status: "Réussie", at: "Aujourd’hui, 02:00" },
    { id: "B-300", target: "Configuration réseau", type: "Incrémentale", status: "Réussie", at: "Hier, 22:00" },
  ],
  deployments: [
    { id: "DEP-81", device: "PC-COMPTA-14", owner: "Sophie Bernard", stage: "Configuration" },
    { id: "DEP-82", device: "PC-RH-07", owner: "Nadia Petit", stage: "Préparation" },
    { id: "DEP-78", device: "PC-DIR-02", owner: "Direction", stage: "Livraison" },
  ],
  patches: [
    { id: "KB-721", name: "Correctif sécurité Windows 11", severity: "Critique", devices: 12, status: "À planifier" },
    { id: "USN-6901", name: "OpenSSH security update", severity: "Importante", devices: 4, status: "Planifiée" },
    { id: "FW-26.4", name: "Firmware points d’accès", severity: "Modérée", devices: 3, status: "Déployée" },
  ],
  wifi: [
    { id: "W-01", accessPoint: "AP-ACCUEIL", channel: 1, signal: -48, clients: 8 },
    { id: "W-02", accessPoint: "AP-ETAGE-1", channel: 6, signal: -61, clients: 17 },
    { id: "W-03", accessPoint: "AP-ETAGE-2", channel: 11, signal: -73, clients: 21 },
  ],
  logs: [
    { id: "L-901", source: "FW-PAR-01", event: "Tentatives de connexion bloquées", severity: "Critique", status: "Nouveau" },
    { id: "L-900", source: "SRV-AD-01", event: "Échecs d’authentification répétés", severity: "Avertissement", status: "Nouveau" },
    { id: "L-897", source: "NAS-BACKUP", event: "Sauvegarde terminée", severity: "Information", status: "Qualifié" },
  ],
  scripts: [
    { id: "S-01", name: "Créer un utilisateur AD", shell: "PowerShell", purpose: "Préparer le compte et ses groupes", savedMinutes: 12, lastRun: "Jamais" },
    { id: "S-02", name: "Contrôler l’espace disque", shell: "PowerShell", purpose: "Lister les volumes sous le seuil", savedMinutes: 8, lastRun: "Hier, 17:42" },
    { id: "S-03", name: "Inventaire des paquets", shell: "Bash", purpose: "Créer un rapport logiciel", savedMinutes: 15, lastRun: "Lundi, 09:10" },
  ],
  activity: [
    { id: "A-1", action: "Ticket pris en charge", detail: "INC-1042 — Accès VPN impossible", at: "Il y a 12 min" },
    { id: "A-2", action: "Alerte réseau détectée", detail: "SW-ETG2-01 — latence élevée", at: "Il y a 34 min" },
    { id: "A-3", action: "Poste préparé", detail: "PC-DIR-02 prêt pour livraison", at: "Il y a 1 h" },
  ],
};

const DB_NAME = "novasuite-sisr";
const STORE_NAME = "workspace";
const DATA_KEY = "primary";

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function readLocalData(): Promise<WorkspaceData | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).get(DATA_KEY);
    request.onsuccess = () => resolve((request.result as WorkspaceData | undefined) ?? null);
    request.onerror = () => reject(request.error);
  });
}

async function writeLocalData(data: WorkspaceData) {
  const db = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(data, DATA_KEY);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
  });
}

function makeId(prefix: string) {
  return `${prefix}-${Date.now().toString(36).slice(-5).toUpperCase()}`;
}

function nowLabel() {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date());
}

function cloneSeed() {
  return JSON.parse(JSON.stringify(seedData)) as WorkspaceData;
}

function isWorkspaceData(value: unknown): value is WorkspaceData {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<WorkspaceData>;
  return candidate.schemaVersion === 1 && Array.isArray(candidate.tickets) && Array.isArray(candidate.nodes) && Array.isArray(candidate.activity);
}

function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "good" | "warn" | "bad" | "blue" }) {
  return <span className={`badge badge-${tone}`}>{children}</span>;
}

function Panel({ title, eyebrow, action, children, className = "" }: { title: string; eyebrow?: string; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`panel ${className}`}>
      <div className="panel-head">
        <div>
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h2>{title}</h2>
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return <div className="empty-state">{children}</div>;
}

export default function Home() {
  const [active, setActive] = useState<ModuleId>("dashboard");
  const [data, setData] = useState<WorkspaceData>(seedData);
  const [hydrated, setHydrated] = useState(false);
  const [saved, setSaved] = useState(true);
  const [notice, setNotice] = useState("Mode Démonstration web : données fictives enregistrées dans ce navigateur");
  const [search, setSearch] = useState("");
  const importRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    readLocalData()
      .then((stored) => setData(stored && isWorkspaceData(stored) ? stored : cloneSeed()))
      .catch(() => setNotice("Stockage local indisponible : exportez régulièrement une sauvegarde"))
      .finally(() => setHydrated(true));
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      writeLocalData(data)
        .then(() => setSaved(true))
        .catch(() => setNotice("Impossible d’enregistrer localement : exportez une sauvegarde"));
    }, 180);
    return () => window.clearTimeout(timer);
  }, [data, hydrated]);

  const activeModule = modules.find((module) => module.id === active) ?? modules[0];
  const filteredModules = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return modules.slice(1);
    return modules.slice(1).filter((module) => `${module.name} ${module.description} ${module.group}`.toLowerCase().includes(query));
  }, [search]);

  function updateData(updater: (current: WorkspaceData) => WorkspaceData, action?: string, detail?: string) {
    setSaved(false);
    setData((current) => {
      const next = updater(current);
      if (!action || !detail) return next;
      return {
        ...next,
        activity: [{ id: makeId("A"), action, detail, at: "À l’instant" }, ...next.activity].slice(0, 30),
      };
    });
  }

  function navigate(module: ModuleId) {
    setActive(module);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function exportBackup() {
    const payload = JSON.stringify({ ...data, exportedAt: new Date().toISOString() }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `novasuite-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
    setNotice("Sauvegarde téléchargée sur l’ordinateur");
  }

  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as unknown;
      if (!isWorkspaceData(parsed)) throw new Error("format");
      setSaved(false);
      setData(parsed);
      setNotice("Sauvegarde restaurée avec succès");
    } catch {
      setNotice("Ce fichier n’est pas une sauvegarde NovaSuite valide");
    } finally {
      event.target.value = "";
    }
  }

  function resetWorkspace() {
    if (!window.confirm("Remplacer les données locales par les données d’exemple ? Exportez d’abord une sauvegarde si nécessaire.")) return;
    setSaved(false);
    setData(cloneSeed());
    setNotice("Espace local réinitialisé");
  }

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => navigate("dashboard")} aria-label="Retour à la vue d’ensemble">
          <span className="brand-mark">N</span>
          <span><strong>NovaSuite</strong><small>SISR · Démonstration</small></span>
        </button>
        <nav aria-label="Modules NovaSuite">
          <p className="nav-label">Espace de travail</p>
          {modules.map((module) => (
            <button key={module.id} className={`nav-item ${active === module.id ? "active" : ""}`} onClick={() => navigate(module.id)}>
              <span className="nav-icon">{module.short}</span>
              <span><strong>{module.name}</strong><small>{module.description}</small></span>
            </button>
          ))}
        </nav>
        <div className="local-card">
          <div className="local-status"><span className="pulse" /> Démonstration séparée</div>
          <p>Cette version web utilise uniquement des données fictives. L’édition Windows Entreprise repose sur SQLite.</p>
          <button className="text-button" onClick={exportBackup}>Créer une sauvegarde</button>
        </div>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>NovaSuite</span><b>/</b><strong>{activeModule.name}</strong></div>
          <div className="top-actions">
            <span className={`save-state ${saved ? "saved" : "saving"}`}><span />{saved ? "Enregistré" : "Enregistrement…"}</span>
            <button className="secondary-button compact" onClick={exportBackup}>Exporter</button>
            <button className="avatar" title="Profil local Christian">CM</button>
          </div>
        </header>

        <div className="content">
          <div className="notice" role="status"><span>i</span>{notice}</div>
          {!hydrated ? <div className="loading">Ouverture de l’espace local…</div> : (
            <>
              {active === "dashboard" && <Dashboard data={data} search={search} setSearch={setSearch} modules={filteredModules} navigate={navigate} exportBackup={exportBackup} importRef={importRef} />}
              {active === "helpdesk" && <HelpDesk data={data} updateData={updateData} />}
              {active === "netwatch" && <NetWatch data={data} updateData={updateData} />}
              {active === "adlab" && <ADLab data={data} updateData={updateData} />}
              {active === "ipplan" && <IPPlan data={data} updateData={updateData} />}
              {active === "backup" && <BackupGuard data={data} updateData={updateData} exportBackup={exportBackup} importRef={importRef} resetWorkspace={resetWorkspace} />}
              {active === "deploy" && <DeployDesk data={data} updateData={updateData} />}
              {active === "patch" && <PatchPilot data={data} updateData={updateData} />}
              {active === "wifi" && <WiFiScope data={data} updateData={updateData} />}
              {active === "logs" && <LogSentinel data={data} updateData={updateData} />}
              {active === "infra" && <InfraDiagram data={data} />}
              {active === "automation" && <AutoAdmin data={data} updateData={updateData} />}
            </>
          )}
        </div>
      </main>
      <input ref={importRef} className="visually-hidden" type="file" accept="application/json" onChange={importBackup} />
    </div>
  );
}

type DataUpdater = (updater: (current: WorkspaceData) => WorkspaceData, action?: string, detail?: string) => void;

function PageIntro({ kicker, title, description, actions }: { kicker: string; title: string; description: string; actions?: ReactNode }) {
  return (
    <div className="page-intro">
      <div><p className="eyebrow">{kicker}</p><h1>{title}</h1><p>{description}</p></div>
      {actions && <div className="intro-actions">{actions}</div>}
    </div>
  );
}

function Dashboard({ data, search, setSearch, modules: filtered, navigate, exportBackup, importRef }: { data: WorkspaceData; search: string; setSearch: (value: string) => void; modules: typeof modules; navigate: (id: ModuleId) => void; exportBackup: () => void; importRef: React.RefObject<HTMLInputElement | null> }) {
  const openTickets = data.tickets.filter((ticket) => ticket.status !== "Résolu").length;
  const online = data.nodes.filter((node) => node.status === "En ligne").length;
  const compliant = Math.round((data.patches.filter((patch) => patch.status !== "À planifier").length / Math.max(data.patches.length, 1)) * 100);
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="hero-label"><span className="pulse" /> Centre d’administration opérationnel</div>
          <h1>Tout votre système d’information.<br /><em>Une seule application.</em></h1>
          <p>Support, réseau, sécurité et automatisation réunis dans un espace local. Les données restent sur cet ordinateur et peuvent être sauvegardées à tout moment.</p>
          <div className="hero-actions">
            <button className="primary-button" onClick={() => navigate("helpdesk")}>Traiter les demandes <span>→</span></button>
            <button className="secondary-button" onClick={exportBackup}>Sauvegarder maintenant</button>
          </div>
        </div>
        <div className="hero-command" aria-label="État de la plateforme">
          <div className="command-head"><span /><span /><span /><small>novasuite / status</small></div>
          <code><i>$</i> controle-systeme --local</code>
          <p><b>✓</b> Base locale accessible</p>
          <p><b>✓</b> {online}/{data.nodes.length} équipements disponibles</p>
          <p><b>✓</b> {data.backups.length} sauvegardes référencées</p>
          <p className="command-warn"><b>!</b> {openTickets} demandes à traiter</p>
          <small>Dernier contrôle · à l’instant</small>
        </div>
      </section>

      <section className="enterprise-strip" aria-label="Édition Windows Entreprise">
        <div className="enterprise-copy">
          <span className="enterprise-mark">WIN</span>
          <div><p className="eyebrow">NovaSuite SISR 3.0</p><h2>Une vraie édition Windows pour travailler hors connexion</h2><p>Base SQLite unifiée, rôles administrateur / technicien / lecteur, chiffrement AES-256, audit, sauvegardes, restauration, imports AD et rapports PDF/CSV.</p></div>
        </div>
        <div className="enterprise-points"><span>✓ Assistant d’installation</span><span>✓ Mode Entreprise séparé</span><span>✓ Verrouillage automatique</span></div>
      </section>

      <div className="kpi-grid">
        <button className="kpi-card" onClick={() => navigate("helpdesk")}><span className="kpi-icon">HD</span><div><small>Tickets actifs</small><strong>{openTickets}</strong><p><b>+1</b> aujourd’hui</p></div></button>
        <button className="kpi-card" onClick={() => navigate("netwatch")}><span className="kpi-icon cyan">NW</span><div><small>Équipements en ligne</small><strong>{online}<i>/{data.nodes.length}</i></strong><p><b>{Math.round((online / data.nodes.length) * 100)} %</b> disponibles</p></div></button>
        <button className="kpi-card" onClick={() => navigate("patch")}><span className="kpi-icon violet">PP</span><div><small>Conformité correctifs</small><strong>{compliant}<i>%</i></strong><p><b>{data.patches.filter((p) => p.status === "À planifier").length}</b> action à planifier</p></div></button>
        <button className="kpi-card" onClick={() => navigate("backup")}><span className="kpi-icon green">BG</span><div><small>Sauvegardes suivies</small><strong>{data.backups.length}</strong><p><b>Local</b> et exportable</p></div></button>
      </div>

      <div className="dashboard-grid">
        <Panel title="Les 11 outils, réunis ici" eyebrow="Projet n°12" className="modules-panel" action={<label className="search"><span>⌕</span><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Rechercher un module" /></label>}>
          <div className="module-grid">
            {filtered.map((module) => (
              <button key={module.id} className="module-card" onClick={() => navigate(module.id)}>
                <span className="module-code">{module.short}</span>
                <span><strong>{module.name}</strong><small>{module.description}</small><em>{module.group}</em></span>
                <b>↗</b>
              </button>
            ))}
            {!filtered.length && <EmptyState>Aucun module ne correspond à cette recherche.</EmptyState>}
          </div>
        </Panel>
        <Panel title="Journal récent" eyebrow="Traçabilité" className="activity-panel">
          <div className="activity-list">
            {data.activity.slice(0, 5).map((activity, index) => (
              <div className="activity-item" key={activity.id}><span className={`activity-dot dot-${index % 4}`} /><div><strong>{activity.action}</strong><p>{activity.detail}</p><small>{activity.at}</small></div></div>
            ))}
          </div>
          <div className="backup-row"><button className="secondary-button" onClick={() => importRef.current?.click()}>Restaurer un fichier</button><button className="text-button" onClick={() => navigate("logs")}>Voir les événements →</button></div>
        </Panel>
      </div>
    </>
  );
}

function HelpDesk({ data, updateData }: { data: WorkspaceData; updateData: DataUpdater }) {
  const [title, setTitle] = useState("");
  const [requester, setRequester] = useState("");
  function submit(event: FormEvent) {
    event.preventDefault();
    if (!title.trim() || !requester.trim()) return;
    const ticket: Ticket = { id: makeId("INC"), title: title.trim(), requester: requester.trim(), priority: "Moyenne", status: "Ouvert" };
    updateData((current) => ({ ...current, tickets: [ticket, ...current.tickets] }), "Ticket créé", `${ticket.id} — ${ticket.title}`);
    setTitle(""); setRequester("");
  }
  function advance(ticket: Ticket) {
    const next: Ticket["status"] = ticket.status === "Ouvert" ? "En cours" : ticket.status === "En cours" ? "Résolu" : "Ouvert";
    updateData((current) => ({ ...current, tickets: current.tickets.map((item) => item.id === ticket.id ? { ...item, status: next } : item) }), "Statut du ticket modifié", `${ticket.id} passe à « ${next} »`);
  }
  return (
    <>
      <PageIntro kicker="Support utilisateur" title="HelpDesk NovaTech" description="Enregistrez, priorisez et suivez les demandes jusqu’à leur résolution." />
      <div className="split-grid">
        <Panel title="Nouveau ticket" eyebrow="Saisie locale">
          <form className="form-grid" onSubmit={submit}>
            <label>Objet de la demande<input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex. Accès au dossier partagé" /></label>
            <label>Demandeur<input value={requester} onChange={(e) => setRequester(e.target.value)} placeholder="Prénom et nom" /></label>
            <button className="primary-button" type="submit">Créer le ticket</button>
          </form>
        </Panel>
        <Panel title="Suivi des demandes" eyebrow={`${data.tickets.length} tickets`}>
          <div className="table-wrap"><table><thead><tr><th>Ticket</th><th>Demande</th><th>Priorité</th><th>Statut</th></tr></thead><tbody>
            {data.tickets.map((ticket) => <tr key={ticket.id} onClick={() => advance(ticket)} tabIndex={0} onKeyDown={(e) => e.key === "Enter" && advance(ticket)}><td><strong>{ticket.id}</strong><small>{ticket.requester}</small></td><td>{ticket.title}</td><td><Badge tone={ticket.priority === "Haute" ? "bad" : ticket.priority === "Moyenne" ? "warn" : "neutral"}>{ticket.priority}</Badge></td><td><Badge tone={ticket.status === "Résolu" ? "good" : ticket.status === "En cours" ? "blue" : "neutral"}>{ticket.status}</Badge></td></tr>)}
          </tbody></table></div><p className="table-hint">Cliquez sur une ligne pour faire avancer son statut.</p>
        </Panel>
      </div>
    </>
  );
}

function NetWatch({ data, updateData }: { data: WorkspaceData; updateData: DataUpdater }) {
  function scan(node: NodeRecord) {
    const healthy = node.status === "Alerte";
    const latency = healthy ? 8 : Math.max(2, node.latency > 12 ? node.latency - 3 : node.latency + 1);
    updateData((current) => ({ ...current, nodes: current.nodes.map((item) => item.id === node.id ? { ...item, status: healthy ? "En ligne" : item.status, latency } : item) }), "Diagnostic réseau exécuté", `${node.name} répond en ${latency} ms`);
  }
  const online = data.nodes.filter((node) => node.status === "En ligne").length;
  return (
    <><PageIntro kicker="Infrastructure" title="NetWatch SISR" description="Contrôlez la disponibilité et la latence des équipements essentiels." actions={<Badge tone={online === data.nodes.length ? "good" : "warn"}>{online}/{data.nodes.length} en ligne</Badge>} />
      <div className="card-grid">{data.nodes.map((node) => <article className="device-card" key={node.id}><div className="device-head"><span className={`status-orb ${node.status === "En ligne" ? "online" : "alert"}`} /><Badge tone={node.status === "En ligne" ? "good" : "bad"}>{node.status}</Badge></div><h3>{node.name}</h3><p>{node.role}</p><code>{node.ip}</code><div className="meter"><span style={{ width: `${Math.min(100, node.latency)}%` }} /></div><div className="device-foot"><span><small>Latence</small><strong>{node.latency} ms</strong></span><button className="secondary-button compact" onClick={() => scan(node)}>Diagnostiquer</button></div></article>)}</div>
    </>
  );
}

function ADLab({ data, updateData }: { data: WorkspaceData; updateData: DataUpdater }) {
  const [name, setName] = useState("");
  const [department, setDepartment] = useState("Support");
  function submit(event: FormEvent) {
    event.preventDefault(); if (!name.trim()) return;
    const user: DirectoryUser = { id: makeId("U"), name: name.trim(), department, role: "Utilisateur", enabled: true };
    updateData((current) => ({ ...current, users: [user, ...current.users] }), "Compte local préparé", `${user.name} — ${user.department}`); setName("");
  }
  function toggle(user: DirectoryUser) {
    updateData((current) => ({ ...current, users: current.users.map((item) => item.id === user.id ? { ...item, enabled: !item.enabled } : item) }), "État du compte modifié", `${user.name} — ${user.enabled ? "désactivé" : "activé"}`);
  }
  return (
    <><PageIntro kicker="Administration" title="ADLab SISR" description="Préparez les comptes, les services et les niveaux d’accès avant application dans l’annuaire." />
      <div className="split-grid"><Panel title="Préparer un utilisateur" eyebrow="Provisionnement"><form className="form-grid" onSubmit={submit}><label>Nom complet<input value={name} onChange={(e) => setName(e.target.value)} placeholder="Prénom et nom" /></label><label>Service<select value={department} onChange={(e) => setDepartment(e.target.value)}><option>Support</option><option>Finance</option><option>RH</option><option>Technique</option><option>Direction</option></select></label><button className="primary-button">Ajouter le compte</button></form></Panel>
      <Panel title="Annuaire de travail" eyebrow={`${data.users.filter((u) => u.enabled).length} comptes actifs`}><div className="list-stack">{data.users.map((user) => <div className="list-row" key={user.id}><span className="person-avatar">{user.name.split(" ").map((part) => part[0]).slice(0,2).join("")}</span><div><strong>{user.name}</strong><small>{user.department} · {user.role}</small></div><button className="toggle-button" onClick={() => toggle(user)} aria-pressed={user.enabled}><span className={user.enabled ? "on" : ""} />{user.enabled ? "Actif" : "Inactif"}</button></div>)}</div></Panel></div>
    </>
  );
}

function ipToNumber(ip: string) { const parts = ip.split(".").map(Number); if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) throw new Error("ip"); return (((parts[0] * 256 + parts[1]) * 256 + parts[2]) * 256 + parts[3]) >>> 0; }
function numberToIp(value: number) { return [value >>> 24, (value >>> 16) & 255, (value >>> 8) & 255, value & 255].join("."); }

function IPPlan({ data, updateData }: { data: WorkspaceData; updateData: DataUpdater }) {
  const [name, setName] = useState("Nouveau VLAN"); const [address, setAddress] = useState("192.168.50.0"); const [prefix, setPrefix] = useState(24); const [error, setError] = useState("");
  function calculate(event: FormEvent) {
    event.preventDefault();
    try {
      const ip = ipToNumber(address); if (prefix < 1 || prefix > 30) throw new Error("prefix");
      const mask = (0xffffffff << (32 - prefix)) >>> 0; const network = (ip & mask) >>> 0; const broadcast = (network | (~mask >>> 0)) >>> 0;
      const plan: IpPlan = { id: makeId("IP"), name: name.trim() || "Nouveau réseau", cidr: `${numberToIp(network)}/${prefix}`, network: numberToIp(network), broadcast: numberToIp(broadcast), hosts: Math.max(0, 2 ** (32 - prefix) - 2) };
      updateData((current) => ({ ...current, ipPlans: [plan, ...current.ipPlans] }), "Plan d’adressage calculé", `${plan.name} — ${plan.cidr}`); setError("");
    } catch { setError("Saisissez une adresse IPv4 et un préfixe compris entre /1 et /30."); }
  }
  return (
    <><PageIntro kicker="Réseau" title="IPPlan SISR" description="Calculez les sous-réseaux, les diffusions et les capacités d’adressage." />
      <div className="split-grid"><Panel title="Calculateur IPv4" eyebrow="CIDR"><form className="form-grid" onSubmit={calculate}><label>Nom du réseau<input value={name} onChange={(e) => setName(e.target.value)} /></label><div className="field-pair"><label>Adresse IPv4<input value={address} onChange={(e) => setAddress(e.target.value)} inputMode="decimal" /></label><label>Préfixe<input value={prefix} onChange={(e) => setPrefix(Number(e.target.value))} type="number" min="1" max="30" /></label></div>{error && <p className="form-error">{error}</p>}<button className="primary-button">Calculer et enregistrer</button></form></Panel>
      <Panel title="Plans enregistrés" eyebrow={`${data.ipPlans.length} réseaux`}><div className="list-stack">{data.ipPlans.map((plan) => <div className="plan-row" key={plan.id}><div><strong>{plan.name}</strong><code>{plan.cidr}</code></div><div><small>Réseau</small><b>{plan.network}</b></div><div><small>Broadcast</small><b>{plan.broadcast}</b></div><div><small>Hôtes</small><b>{plan.hosts}</b></div></div>)}</div></Panel></div>
    </>
  );
}

function BackupGuard({ data, updateData, exportBackup, importRef, resetWorkspace }: { data: WorkspaceData; updateData: DataUpdater; exportBackup: () => void; importRef: React.RefObject<HTMLInputElement | null>; resetWorkspace: () => void }) {
  function recordBackup() {
    const backup: BackupRecord = { id: makeId("B"), target: "Espace NovaSuite complet", type: "Export JSON", status: "Réussie", at: nowLabel() };
    updateData((current) => ({ ...current, backups: [backup, ...current.backups] }), "Sauvegarde complète créée", backup.at); exportBackup();
  }
  return (
    <><PageIntro kicker="Continuité d’activité" title="BackupGuard" description="Exportez toutes les données locales et restaurez-les sur un autre ordinateur." actions={<button className="primary-button" onClick={recordBackup}>Créer la sauvegarde</button>} />
      <div className="backup-feature"><div><span className="big-shield">3·2·1</span><h2>Votre copie reste sous votre contrôle.</h2><p>Gardez trois copies, sur deux supports différents, dont une copie hors de l’ordinateur principal.</p></div><div className="backup-actions"><button className="secondary-button" onClick={() => importRef.current?.click()}>Restaurer un fichier JSON</button><button className="danger-button" onClick={resetWorkspace}>Réinitialiser les données d’exemple</button></div></div>
      <Panel title="Historique des sauvegardes" eyebrow="Traçabilité locale"><div className="table-wrap"><table><thead><tr><th>Référence</th><th>Cible</th><th>Type</th><th>Date</th><th>Résultat</th></tr></thead><tbody>{data.backups.map((backup) => <tr key={backup.id}><td><strong>{backup.id}</strong></td><td>{backup.target}</td><td>{backup.type}</td><td>{backup.at}</td><td><Badge tone={backup.status === "Réussie" ? "good" : "warn"}>{backup.status}</Badge></td></tr>)}</tbody></table></div></Panel>
    </>
  );
}

function DeployDesk({ data, updateData }: { data: WorkspaceData; updateData: DataUpdater }) {
  const [device, setDevice] = useState(""); const [owner, setOwner] = useState("");
  function submit(event: FormEvent) { event.preventDefault(); if (!device.trim() || !owner.trim()) return; const deployment: Deployment = { id: makeId("DEP"), device: device.trim().toUpperCase(), owner: owner.trim(), stage: "Préparation" }; updateData((current) => ({ ...current, deployments: [deployment, ...current.deployments] }), "Déploiement créé", `${deployment.device} pour ${deployment.owner}`); setDevice(""); setOwner(""); }
  function advance(item: Deployment) { const order: Deployment["stage"][] = ["Préparation", "Configuration", "Livraison"]; const stage = order[(order.indexOf(item.stage) + 1) % order.length]; updateData((current) => ({ ...current, deployments: current.deployments.map((dep) => dep.id === item.id ? { ...dep, stage } : dep) }), "Déploiement mis à jour", `${item.device} — ${stage}`); }
  return (
    <><PageIntro kicker="Postes de travail" title="DeployDesk" description="Suivez chaque préparation de poste, de l’inventaire à la livraison." />
      <Panel title="Ajouter un poste" eyebrow="Nouveau déploiement"><form className="inline-form" onSubmit={submit}><label>Nom du poste<input value={device} onChange={(e) => setDevice(e.target.value)} placeholder="PC-SERVICE-01" /></label><label>Utilisateur<input value={owner} onChange={(e) => setOwner(e.target.value)} placeholder="Prénom et nom" /></label><button className="primary-button">Ajouter</button></form></Panel>
      <div className="kanban">{(["Préparation", "Configuration", "Livraison"] as Deployment["stage"][]).map((stage) => <section className="kanban-column" key={stage}><div className="kanban-head"><h2>{stage}</h2><Badge>{data.deployments.filter((item) => item.stage === stage).length}</Badge></div>{data.deployments.filter((item) => item.stage === stage).map((item) => <button className="kanban-card" key={item.id} onClick={() => advance(item)}><small>{item.id}</small><strong>{item.device}</strong><span>{item.owner}</span><em>Avancer →</em></button>)}</section>)}</div>
    </>
  );
}

function PatchPilot({ data, updateData }: { data: WorkspaceData; updateData: DataUpdater }) {
  function advance(patch: PatchRecord) { const order: PatchRecord["status"][] = ["À planifier", "Planifiée", "Déployée"]; const status = order[(order.indexOf(patch.status) + 1) % order.length]; updateData((current) => ({ ...current, patches: current.patches.map((item) => item.id === patch.id ? { ...item, status } : item) }), "Correctif mis à jour", `${patch.id} — ${status}`); }
  const completed = data.patches.filter((item) => item.status === "Déployée").length;
  return (
    <><PageIntro kicker="Sécurité" title="PatchPilot" description="Priorisez les vulnérabilités et planifiez les vagues de correctifs." actions={<Badge tone="blue">{completed}/{data.patches.length} déployés</Badge>} />
      <Panel title="Plan de correction" eyebrow="Cliquez pour faire avancer"><div className="table-wrap"><table><thead><tr><th>Référence</th><th>Correctif</th><th>Criticité</th><th>Postes</th><th>Statut</th></tr></thead><tbody>{data.patches.map((patch) => <tr key={patch.id} onClick={() => advance(patch)}><td><strong>{patch.id}</strong></td><td>{patch.name}</td><td><Badge tone={patch.severity === "Critique" ? "bad" : patch.severity === "Importante" ? "warn" : "neutral"}>{patch.severity}</Badge></td><td>{patch.devices}</td><td><Badge tone={patch.status === "Déployée" ? "good" : patch.status === "Planifiée" ? "blue" : "neutral"}>{patch.status}</Badge></td></tr>)}</tbody></table></div></Panel>
    </>
  );
}

function WiFiScope({ data, updateData }: { data: WorkspaceData; updateData: DataUpdater }) {
  const [ap, setAp] = useState(""); const [channel, setChannel] = useState(1); const [signal, setSignal] = useState(-55);
  function submit(event: FormEvent) { event.preventDefault(); if (!ap.trim()) return; const measurement: WifiRecord = { id: makeId("W"), accessPoint: ap.trim().toUpperCase(), channel, signal, clients: 0 }; updateData((current) => ({ ...current, wifi: [measurement, ...current.wifi] }), "Relevé Wi-Fi ajouté", `${measurement.accessPoint} — ${measurement.signal} dBm`); setAp(""); }
  return (
    <><PageIntro kicker="Sans-fil" title="WiFiScope" description="Consignez les relevés radio et repérez les canaux ou zones à optimiser." />
      <div className="split-grid"><Panel title="Nouveau relevé" eyebrow="Mesure terrain"><form className="form-grid" onSubmit={submit}><label>Point d’accès<input value={ap} onChange={(e) => setAp(e.target.value)} placeholder="AP-SALLE-01" /></label><div className="field-pair"><label>Canal<select value={channel} onChange={(e) => setChannel(Number(e.target.value))}>{[1,6,11,36,44,52].map((value) => <option key={value}>{value}</option>)}</select></label><label>Signal (dBm)<input type="number" min="-100" max="-10" value={signal} onChange={(e) => setSignal(Number(e.target.value))} /></label></div><button className="primary-button">Ajouter le relevé</button></form></Panel>
      <Panel title="Qualité radio" eyebrow={`${data.wifi.length} points`}><div className="wifi-list">{data.wifi.map((item) => { const quality = Math.max(0, Math.min(100, 2 * (item.signal + 100))); return <div className="wifi-row" key={item.id}><div><strong>{item.accessPoint}</strong><small>Canal {item.channel} · {item.clients} clients</small></div><div className="signal-bar"><span style={{ width: `${quality}%` }} /></div><Badge tone={item.signal > -60 ? "good" : item.signal > -72 ? "warn" : "bad"}>{item.signal} dBm</Badge></div>; })}</div></Panel></div>
    </>
  );
}

function LogSentinel({ data, updateData }: { data: WorkspaceData; updateData: DataUpdater }) {
  function qualify(log: LogRecord) { if (log.status === "Qualifié") return; updateData((current) => ({ ...current, logs: current.logs.map((item) => item.id === log.id ? { ...item, status: "Qualifié" } : item) }), "Événement qualifié", `${log.id} — ${log.event}`); }
  return (
    <><PageIntro kicker="Détection" title="LogSentinel" description="Centralisez les événements importants et tracez leur qualification." />
      <div className="log-grid">{data.logs.map((log) => <article className={`log-card severity-${log.severity.toLowerCase()}`} key={log.id}><div className="log-top"><Badge tone={log.severity === "Critique" ? "bad" : log.severity === "Avertissement" ? "warn" : "blue"}>{log.severity}</Badge><code>{log.id}</code></div><h2>{log.event}</h2><p>Source : <b>{log.source}</b></p><button className="secondary-button" disabled={log.status === "Qualifié"} onClick={() => qualify(log)}>{log.status === "Qualifié" ? "Événement qualifié" : "Qualifier l’événement"}</button></article>)}</div>
    </>
  );
}

function InfraDiagram({ data }: { data: WorkspaceData }) {
  return (
    <><PageIntro kicker="Cartographie" title="InfraDiagram" description="Une vue logique de l’infrastructure enregistrée dans NovaSuite." />
      <Panel title="Site principal · Paris" eyebrow="Topologie logique" action={<Badge tone="good">Réseau interne</Badge>}>
        <div className="topology" role="img" aria-label="Schéma logique : internet vers pare-feu, cœur de réseau, serveurs et postes">
          <div className="topo-node internet"><span>WAN</span><strong>Internet</strong><small>Lien fibre</small></div><div className="topo-line line-a" />
          <div className="topo-node firewall"><span>FW</span><strong>FW-PAR-01</strong><small>10.20.0.1</small></div><div className="topo-line line-b" />
          <div className="topo-node core"><span>SW</span><strong>SW-CORE-01</strong><small>VLAN 10 · 20 · 30</small></div>
          <div className="topo-line line-c" /><div className="topo-line line-d" />
          <div className="topo-node server"><span>SRV</span><strong>SRV-AD-01</strong><small>{data.nodes.find((n) => n.name === "SRV-AD-01")?.ip}</small></div>
          <div className="topo-node clients"><span>LAN</span><strong>Postes utilisateurs</strong><small>VLAN 20 · DHCP</small></div>
        </div>
        <div className="legend"><span><i className="legend-green" /> Équipement opérationnel</span><span><i className="legend-blue" /> Lien logique</span><span><i className="legend-violet" /> Segmentation VLAN</span></div>
      </Panel>
    </>
  );
}

function AutoAdmin({ data, updateData }: { data: WorkspaceData; updateData: DataUpdater }) {
  const [running, setRunning] = useState<string | null>(null);
  function run(script: ScriptRecord) {
    setRunning(script.id);
    window.setTimeout(() => {
      updateData((current) => ({ ...current, scripts: current.scripts.map((item) => item.id === script.id ? { ...item, lastRun: nowLabel() } : item) }), "Simulation terminée", `${script.name} — aucune commande réelle exécutée`);
      setRunning(null);
    }, 850);
  }
  return (
    <><PageIntro kicker="Automatisation sécurisée" title="AutoAdmin" description="Préparez les routines PowerShell et Bash en mode Dry-Run obligatoire." actions={<Badge tone="good">Simulation uniquement</Badge>} />
      <div className="script-grid">{data.scripts.map((script) => <article className="script-card" key={script.id}><div className="script-head"><span className={script.shell === "PowerShell" ? "ps" : "bash"}>{script.shell === "PowerShell" ? "PS" : "$_"}</span><Badge tone="neutral">{script.shell}</Badge></div><h2>{script.name}</h2><p>{script.purpose}</p><div className="script-stats"><span><small>Temps économisé</small><strong>{script.savedMinutes} min</strong></span><span><small>Dernière simulation</small><strong>{script.lastRun}</strong></span></div><div className="dry-run"><span className="pulse" /> Dry-Run · aucune modification système</div><button className="primary-button" onClick={() => run(script)} disabled={running === script.id}>{running === script.id ? "Simulation en cours…" : "Lancer la simulation"}</button></article>)}</div>
    </>
  );
}
