"use client";

import { ChangeEvent, FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Activity, AlertTriangle, ArchiveRestore, ArrowDownAZ, ArrowUpAZ, Bell, CheckCircle2,
  ChevronRight, CircleDot, Clock3, Database, Download, Edit3, FileJson, Filter,
  LayoutDashboard, LogOut, Menu, MessageSquare, Plus, RefreshCcw, Search, Settings,
  ShieldCheck, TicketCheck, Tickets, Upload, Users, Wifi, WifiOff, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Role = "requester" | "technician" | "administrator";
type Priority = "low" | "medium" | "high" | "urgent";
type Status = "new" | "in_progress" | "waiting" | "resolved" | "closed";
type View = "dashboard" | "tickets" | "team" | "settings";
type Mode = "loading" | "supabase" | "demo";
type Profile = { id: string; full_name: string; department: string | null; role: Role };
type Ticket = {
  id: string; ticket_number: number; subject: string; description: string;
  department: string | null; priority: Priority; status: Status;
  requester_id: string; assigned_to: string | null; created_at: string; updated_at: string;
  closed_at?: string | null; requester: { full_name: string } | null; technician: { full_name: string } | null;
};
type Comment = { id: string; ticket_id?: string; body: string; created_at: string; author: { full_name: string } | null };
type History = { id: number; ticket_id?: string; action: string; changes: Record<string, unknown>; created_at: string; actor: { full_name: string } | null };
type SortKey = "updated_at" | "ticket_number" | "priority" | "status" | "subject";
type DemoBackup = { version: 1; exported_at: string; tickets: Ticket[]; comments: Comment[]; history: History[] };

const priorityLabels: Record<Priority, string> = { urgent: "Urgente", high: "Haute", medium: "Moyenne", low: "Faible" };
const statusLabels: Record<Status, string> = { new: "Nouveau", in_progress: "En cours", waiting: "En attente", resolved: "Résolu", closed: "Fermé" };
const roleLabels: Record<Role, string> = { requester: "Demandeur", technician: "Technicien", administrator: "Administrateur" };
const priorities = Object.keys(priorityLabels) as Priority[];
const statuses = Object.keys(statusLabels) as Status[];
const priorityRank: Record<Priority, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
const statusRank: Record<Status, number> = { new: 1, in_progress: 2, waiting: 3, resolved: 4, closed: 5 };
const storageKeys = { tickets: "novatech.demo.tickets", comments: "novatech.demo.comments", history: "novatech.demo.history" };
const emptyForm = { subject: "", description: "", department: "", priority: "medium" as Priority, status: "new" as Status, assigned_to: "" };

const christian: Profile = { id: "demo-christian", full_name: "Christian Martin", department: "DSI", role: "administrator" };
const demoTeam: Profile[] = [
  christian,
  { id: "demo-emma", full_name: "Emma Petit", department: "DSI", role: "technician" },
];
const now = Date.now();
const demoTickets: Ticket[] = [
  demoTicket(1050, "Accès VPN impossible en télétravail", "Claire Robert", "Finance", "urgent", "new", null, 8),
  demoTicket(1049, "Impossible d’imprimer en salle B12", "Marie Dupont", "Formation", "high", "in_progress", christian, 24),
  demoTicket(1048, "Compte Microsoft 365 bloqué", "Thomas Bernard", "Commerce", "urgent", "waiting", christian, 58),
  demoTicket(1047, "Wi-Fi instable au bâtiment C", "Sophie Leroy", "Logistique", "medium", "in_progress", demoTeam[1], 130),
  demoTicket(1046, "Installation du logiciel GLPI", "Hugo Moreau", "DSI", "low", "resolved", christian, 240),
  demoTicket(1045, "Écran externe non détecté", "Nadia Cohen", "RH", "medium", "closed", demoTeam[1], 1440),
];

function demoTicket(number: number, subject: string, requesterName: string, department: string, priority: Priority, status: Status, technician: Profile | null, minutesAgo: number): Ticket {
  const date = new Date(now - minutesAgo * 60_000).toISOString();
  return {
    id: `demo-${number}`, ticket_number: number, subject,
    description: `Demande de démonstration : ${subject}.`, department, priority, status,
    requester_id: `requester-${number}`, assigned_to: technician?.id ?? null,
    created_at: date, updated_at: date, closed_at: status === "closed" ? date : null,
    requester: { full_name: requesterName }, technician: technician ? { full_name: technician.full_name } : null,
  };
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}
function initials(name: string) { return name.split(" ").filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase(); }
function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}
function download(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url);
}
function csvCell(value: unknown) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }

export default function Home() {
  const supabase = useMemo(() => createClient(), []);
  const [mode, setMode] = useState<Mode>("loading");
  const [modeReason, setModeReason] = useState("Connexion au service de données…");
  const [profile, setProfile] = useState<Profile>(christian);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [team, setTeam] = useState<Profile[]>(demoTeam);
  const [view, setView] = useState<View>("dashboard");
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState<Priority | "all">("all");
  const [status, setStatus] = useState<Status | "all">("all");
  const [technician, setTechnician] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("updated_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [modal, setModal] = useState<"create" | "edit" | "details" | null>(null);
  const [active, setActive] = useState<Ticket | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [comments, setComments] = useState<Comment[]>([]);
  const [history, setHistory] = useState<History[]>([]);
  const [comment, setComment] = useState("");
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const importRef = useRef<HTMLInputElement>(null);

  const activateDemo = useCallback((reason: string) => {
    const storedTickets = safeParse<Ticket[]>(localStorage.getItem(storageKeys.tickets), demoTickets);
    const storedComments = safeParse<Comment[]>(localStorage.getItem(storageKeys.comments), []);
    const storedHistory = safeParse<History[]>(localStorage.getItem(storageKeys.history), []);
    setProfile(christian); setTeam(demoTeam); setTickets(storedTickets); setComments(storedComments); setHistory(storedHistory);
    setMode("demo"); setModeReason(reason); setError("");
  }, []);

  const failToDemo = useCallback((message: string) => {
    activateDemo(message);
    setToast("Supabase est indisponible : le mode démonstration local a pris le relais.");
  }, [activateDemo]);

  const loadSupabase = useCallback(async () => {
    if (!supabase) { activateDemo("Supabase non configuré · données enregistrées dans ce navigateur"); return; }
    try {
      const { data: userData, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!userData.user) { window.location.assign("/login"); return; }
      const profileResult = await supabase.from("profiles").select("id,full_name,department,role").eq("id", userData.user.id).single();
      if (profileResult.error || !profileResult.data) throw profileResult.error ?? new Error("Profil introuvable");
      const ticketResult = await supabase.from("tickets").select("*,requester:profiles!tickets_requester_id_fkey(full_name),technician:profiles!tickets_assigned_to_fkey(full_name)").order("updated_at", { ascending: false });
      if (ticketResult.error) throw ticketResult.error;
      const current = profileResult.data as Profile;
      setProfile(current); setTickets((ticketResult.data ?? []) as unknown as Ticket[]);
      if (current.role !== "requester") {
        const teamResult = await supabase.from("profiles").select("id,full_name,department,role").order("full_name");
        if (teamResult.error) throw teamResult.error;
        setTeam((teamResult.data ?? []) as Profile[]);
      } else setTeam([]);
      setMode("supabase"); setModeReason("Supabase connecté · données partagées et sécurisées"); setError("");
    } catch { failToDemo("Supabase inaccessible · continuité assurée avec localStorage"); }
  }, [activateDemo, failToDemo, supabase]);

  useEffect(() => { const id = setTimeout(() => void loadSupabase(), 0); return () => clearTimeout(id); }, [loadSupabase]);
  useEffect(() => {
    if (mode !== "demo") return;
    localStorage.setItem(storageKeys.tickets, JSON.stringify(tickets));
    localStorage.setItem(storageKeys.comments, JSON.stringify(comments));
    localStorage.setItem(storageKeys.history, JSON.stringify(history));
  }, [comments, history, mode, tickets]);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(""), 4200); return () => clearTimeout(id); }, [toast]);

  const isStaff = mode === "demo" || profile.role === "technician" || profile.role === "administrator";
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const result = tickets.filter((ticket) => {
      const matchesSearch = !normalized || [
        `INC-${ticket.ticket_number}`, ticket.subject, ticket.description, ticket.department ?? "",
        ticket.requester?.full_name ?? "", ticket.technician?.full_name ?? "",
      ].some((value) => value.toLowerCase().includes(normalized));
      return matchesSearch
        && (priority === "all" || ticket.priority === priority)
        && (status === "all" || ticket.status === status)
        && (technician === "all" || (technician === "unassigned" ? !ticket.assigned_to : ticket.assigned_to === technician));
    });
    return result.sort((a, b) => {
      let comparison = 0;
      if (sortKey === "ticket_number") comparison = a.ticket_number - b.ticket_number;
      else if (sortKey === "priority") comparison = priorityRank[a.priority] - priorityRank[b.priority];
      else if (sortKey === "status") comparison = statusRank[a.status] - statusRank[b.status];
      else if (sortKey === "subject") comparison = a.subject.localeCompare(b.subject, "fr");
      else comparison = new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime();
      return sortAsc ? comparison : -comparison;
    });
  }, [priority, query, sortAsc, sortKey, status, technician, tickets]);
  const counts = useMemo(() => ({
    total: tickets.length,
    open: tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status)).length,
    active: tickets.filter((ticket) => ticket.status === "in_progress").length,
    urgent: tickets.filter((ticket) => ticket.priority === "urgent" && !["resolved", "closed"].includes(ticket.status)).length,
    resolved: tickets.filter((ticket) => ticket.status === "resolved").length,
    closed: tickets.filter((ticket) => ticket.status === "closed").length,
  }), [tickets]);

  function localHistory(ticketId: string, action: string, changes: Record<string, unknown> = {}) {
    setHistory((items) => [{ id: Date.now(), ticket_id: ticketId, action, changes, created_at: new Date().toISOString(), actor: { full_name: christian.full_name } }, ...items]);
  }
  function openCreate() { setActive(null); setForm({ ...emptyForm, department: profile.department ?? "" }); setModal("create"); setError(""); }
  function openEdit(ticket: Ticket) {
    setActive(ticket); setForm({ subject: ticket.subject, description: ticket.description, department: ticket.department ?? "", priority: ticket.priority, status: ticket.status, assigned_to: ticket.assigned_to ?? "" }); setModal("edit"); setError("");
  }
  async function openDetails(ticket: Ticket) {
    setActive(ticket); setModal("details"); setError("");
    if (mode === "demo") return;
    try {
      const [commentResult, historyResult] = await Promise.all([
        supabase!.from("comments").select("id,body,created_at,author:profiles!comments_author_id_fkey(full_name)").eq("ticket_id", ticket.id).order("created_at"),
        supabase!.from("ticket_history").select("id,action,changes,created_at,actor:profiles!ticket_history_actor_id_fkey(full_name)").eq("ticket_id", ticket.id).order("created_at", { ascending: false }),
      ]);
      if (commentResult.error || historyResult.error) throw commentResult.error ?? historyResult.error;
      setComments((commentResult.data ?? []) as unknown as Comment[]); setHistory((historyResult.data ?? []) as unknown as History[]);
    } catch { failToDemo("Erreur de lecture Supabase · détails disponibles en mode local"); }
  }
  async function submitTicket(event: FormEvent) {
    event.preventDefault(); setError("");
    const payload = { subject: form.subject.trim(), description: form.description.trim(), department: form.department.trim() || null, priority: form.priority };
    if (!payload.subject || !payload.description) return setError("Le sujet et la description sont obligatoires.");
    if (mode === "demo") {
      const date = new Date().toISOString();
      if (modal === "edit" && active) {
        const member = demoTeam.find((item) => item.id === form.assigned_to);
        setTickets((items) => items.map((ticket) => ticket.id === active.id ? { ...ticket, ...payload, status: form.status, assigned_to: form.assigned_to || null, technician: member ? { full_name: member.full_name } : null, updated_at: date } : ticket));
        localHistory(active.id, "updated", { status: form.status, priority: form.priority }); setToast("Ticket modifié et historique local mis à jour.");
      } else {
        const number = Math.max(1040, ...tickets.map((ticket) => ticket.ticket_number)) + 1;
        const created: Ticket = { id: crypto.randomUUID(), ticket_number: number, ...payload, status: "new", requester_id: christian.id, assigned_to: null, created_at: date, updated_at: date, requester: { full_name: christian.full_name }, technician: null };
        setTickets((items) => [created, ...items]); localHistory(created.id, "created", { status: "new", priority: form.priority }); setToast(`INC-${number} créé dans la démonstration.`);
      }
      setModal(null); return;
    }
    try {
      const result = modal === "edit" && active
        ? await supabase!.from("tickets").update({ ...payload, status: form.status, assigned_to: form.assigned_to || null }).eq("id", active.id)
        : await supabase!.from("tickets").insert({ ...payload, requester_id: profile.id });
      if (result.error) throw result.error;
      setToast(modal === "edit" ? "Ticket mis à jour dans Supabase." : "Ticket créé dans Supabase."); setModal(null); await loadSupabase();
    } catch { failToDemo("Écriture Supabase impossible · modifications disponibles en mode local"); }
  }
  async function setTicketState(ticket: Ticket, next: "closed" | "new") {
    const date = new Date().toISOString();
    if (mode === "demo") {
      setTickets((items) => items.map((item) => item.id === ticket.id ? { ...item, status: next, closed_at: next === "closed" ? date : null, updated_at: date } : item));
      localHistory(ticket.id, next === "closed" ? "closed" : "reopened", { from: ticket.status, to: next }); setToast(`INC-${ticket.ticket_number} ${next === "closed" ? "fermé" : "rouvert"}.`); return;
    }
    try {
      const { error: updateError } = await supabase!.from("tickets").update({ status: next, closed_at: next === "closed" ? date : null }).eq("id", ticket.id);
      if (updateError) throw updateError;
      setToast(`INC-${ticket.ticket_number} ${next === "closed" ? "fermé" : "rouvert"}.`); await loadSupabase();
    } catch { failToDemo("Mise à jour Supabase impossible · bascule en mode local"); }
  }
  async function addComment(event: FormEvent) {
    event.preventDefault(); if (!active || !comment.trim()) return;
    if (mode === "demo") {
      const created: Comment = { id: crypto.randomUUID(), ticket_id: active.id, body: comment.trim(), created_at: new Date().toISOString(), author: { full_name: christian.full_name } };
      setComments((items) => [created, ...items]); localHistory(active.id, "commented"); setComment(""); setToast("Commentaire ajouté localement."); return;
    }
    try {
      const { error: commentError } = await supabase!.from("comments").insert({ ticket_id: active.id, author_id: profile.id, body: comment.trim() });
      if (commentError) throw commentError;
      setComment(""); setToast("Commentaire ajouté."); await openDetails(active);
    } catch { failToDemo("Commentaire Supabase impossible · bascule en mode local"); }
  }
  async function logout() { if (mode === "supabase" && supabase) await supabase.auth.signOut(); window.location.assign(mode === "supabase" ? "/login" : "/"); }
  function resetDemo() { localStorage.removeItem(storageKeys.tickets); localStorage.removeItem(storageKeys.comments); localStorage.removeItem(storageKeys.history); setTickets(demoTickets); setComments([]); setHistory([]); setToast("Données de démonstration restaurées."); }
  function exportJson() { const backup: DemoBackup = { version: 1, exported_at: new Date().toISOString(), tickets, comments, history }; download("helpdesk-novatech-backup.json", JSON.stringify(backup, null, 2), "application/json"); }
  function exportCsv() {
    const rows = [["Ticket", "Sujet", "Demandeur", "Service", "Priorité", "Statut", "Technicien", "Mise à jour"], ...filtered.map((ticket) => [`INC-${ticket.ticket_number}`, ticket.subject, ticket.requester?.full_name ?? "", ticket.department ?? "", priorityLabels[ticket.priority], statusLabels[ticket.status], ticket.technician?.full_name ?? "", ticket.updated_at])];
    download("helpdesk-novatech-tickets.csv", `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\n")}`, "text/csv;charset=utf-8");
  }
  async function importBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const backup = JSON.parse(await file.text()) as Partial<DemoBackup>;
      if (backup.version !== 1 || !Array.isArray(backup.tickets)) throw new Error("Format invalide");
      setTickets(backup.tickets); setComments(Array.isArray(backup.comments) ? backup.comments : []); setHistory(Array.isArray(backup.history) ? backup.history : []);
      setProfile(christian); setTeam(demoTeam); setMode("demo"); setModeReason("Sauvegarde importée · données conservées dans ce navigateur"); setToast("Sauvegarde importée avec succès.");
    } catch { setError("Cette sauvegarde est invalide ou illisible."); }
    event.target.value = "";
  }

  if (mode === "loading") return <main className="loading-screen" aria-live="polite"><span className="brand-mark">N</span><p>Préparation du HelpDesk hybride…</p></main>;
  const today = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());

  return <div className="app-shell">
    <a className="skip-link" href="#contenu">Aller au contenu</a>
    <button className="mobile-menu" aria-label="Ouvrir le menu" onClick={() => setMobileNav(true)}><Menu /></button>
    <aside className={`sidebar ${mobileNav ? "is-open" : ""}`} aria-label="Navigation latérale">
      <button className="close-mobile" aria-label="Fermer le menu" onClick={() => setMobileNav(false)}><X /></button>
      <div className="brand"><span className="brand-mark">N</span><div><strong>HelpDesk</strong><span>NovaTech</span></div></div>
      <div className={`mode-chip ${mode}`}><span>{mode === "supabase" ? <Database /> : <WifiOff />}</span><div><strong>{mode === "supabase" ? "Mode Supabase" : "Mode démonstration"}</strong><small>{mode === "supabase" ? "Données partagées" : "Stockage local"}</small></div></div>
      <nav aria-label="Navigation principale">
        <Nav active={view === "dashboard"} icon={<LayoutDashboard />} label="Tableau de bord" onClick={() => setView("dashboard")} />
        <Nav active={view === "tickets"} icon={<Tickets />} label="Tickets" badge={counts.open} onClick={() => setView("tickets")} />
        {isStaff && <Nav active={view === "team"} icon={<Users />} label="Équipe" onClick={() => setView("team")} />}
        <Nav active={view === "settings"} icon={<Settings />} label="Paramètres" onClick={() => setView("settings")} />
      </nav>
      <div className="profile-card"><div className="avatar">{initials(profile.full_name)}</div><div><strong>{profile.full_name}</strong><span>{roleLabels[profile.role]}</span></div><button onClick={logout} aria-label={mode === "supabase" ? "Se déconnecter" : "Actualiser la démonstration"}>{mode === "supabase" ? <LogOut /> : <RefreshCcw />}</button></div>
    </aside>
    {mobileNav && <button className="backdrop" aria-label="Fermer le menu" onClick={() => setMobileNav(false)} />}
    <main className="main-content" id="contenu">
      <header className="topbar"><div><p className="eyebrow">Centre de services IT · {roleLabels[profile.role]}</p><h1>{view === "dashboard" ? `Bonjour ${profile.full_name.split(" ")[0]}` : view === "tickets" ? "Gestion des tickets" : view === "team" ? "Équipe support" : "Paramètres et sauvegardes"}</h1><p className="date">{today[0].toUpperCase() + today.slice(1)}</p></div><div className="top-actions"><button className="icon-button" aria-label={`${counts.urgent} ticket(s) urgent(s)`}><Bell /><span>{counts.urgent}</span></button><button className="primary-button" onClick={openCreate}><Plus />Nouveau ticket</button><div className="top-avatar" aria-label={`Profil ${profile.full_name}`}>{initials(profile.full_name)}</div></div></header>
      <div className={`mode-banner ${mode}`} role="status"><span>{mode === "supabase" ? <Wifi /> : <WifiOff />}</span><p><strong>{mode === "supabase" ? "Supabase actif" : "Continuité locale active"}</strong>{modeReason}</p>{mode === "demo" && supabase && <button className="secondary-button compact" onClick={() => { setMode("loading"); void loadSupabase(); }}><RefreshCcw />Réessayer</button>}</div>
      {error && <div className="form-alert error" role="alert">{error}<button aria-label="Fermer le message" onClick={() => setError("")}><X /></button></div>}
      {view === "dashboard" && <Dashboard tickets={tickets} counts={counts} showTickets={() => setView("tickets")} onOpen={openDetails} />}
      {view === "tickets" && <TicketsView tickets={filtered} total={tickets.length} query={query} setQuery={setQuery} priority={priority} setPriority={setPriority} status={status} setStatus={setStatus} technician={technician} setTechnician={setTechnician} team={team} sortKey={sortKey} setSortKey={setSortKey} sortAsc={sortAsc} setSortAsc={setSortAsc} onOpen={openDetails} onEdit={isStaff ? openEdit : undefined} onState={isStaff ? setTicketState : undefined} onCreate={openCreate} />}
      {view === "team" && isStaff && <Team members={team} tickets={tickets} />}
      {view === "settings" && <SettingsView mode={mode} reason={modeReason} onJson={exportJson} onCsv={exportCsv} onImport={() => importRef.current?.click()} onReset={resetDemo} />}
    </main>
    <input ref={importRef} className="sr-only" type="file" accept="application/json,.json" onChange={importBackup} />
    {(modal === "create" || modal === "edit") && <TicketModal mode={modal} form={form} setForm={setForm} team={team.filter((member) => member.role !== "requester")} staff={isStaff} error={error} onSubmit={submitTicket} onClose={() => setModal(null)} />}
    {modal === "details" && active && <DetailsModal ticket={active} comments={comments.filter((item) => !item.ticket_id || item.ticket_id === active.id)} history={history.filter((item) => !item.ticket_id || item.ticket_id === active.id)} comment={comment} setComment={setComment} onComment={addComment} onClose={() => setModal(null)} />}
    {toast && <div className="toast" role="status" aria-live="polite"><CheckCircle2 />{toast}</div>}
  </div>;
}

function Nav({ active, icon, label, badge, onClick }: { active: boolean; icon: ReactNode; label: string; badge?: number; onClick: () => void }) { return <button className={`nav-item ${active ? "active" : ""}`} aria-current={active ? "page" : undefined} onClick={onClick}>{icon}<span>{label}</span>{badge !== undefined && <em>{badge}</em>}</button>; }
function PanelTitle({ kicker, title, action }: { kicker: string; title: string; action?: () => void }) { return <div className="panel-heading"><div><p className="section-kicker">{kicker}</p><h2>{title}</h2></div>{action && <button className="text-button" onClick={action}>Voir tous <ChevronRight /></button>}</div>; }

function Dashboard({ tickets, counts, showTickets, onOpen }: { tickets: Ticket[]; counts: { total: number; open: number; active: number; urgent: number; resolved: number; closed: number }; showTickets: () => void; onOpen: (ticket: Ticket) => void }) {
  const cards = [
    { label: "Tickets ouverts", value: counts.open, detail: `${counts.total} au total`, icon: <Tickets />, tone: "cyan" },
    { label: "En cours", value: counts.active, detail: `${counts.open ? Math.round(counts.active / counts.open * 100) : 0}% des ouverts`, icon: <Activity />, tone: "amber" },
    { label: "Urgents", value: counts.urgent, detail: "à prioriser", icon: <AlertTriangle />, tone: "red" },
    { label: "Traités", value: counts.resolved + counts.closed, detail: `${counts.closed} clôturés`, icon: <CheckCircle2 />, tone: "green" },
  ];
  return <><section className="kpi-grid" aria-label="Statistiques des tickets">{cards.map((card) => <button key={card.label} className="kpi-card" onClick={showTickets}><span className={`kpi-icon ${card.tone}`}>{card.icon}</span><span><small>{card.label}</small><strong>{card.value}</strong><em>{card.detail}</em></span><ChevronRight className="kpi-arrow" /></button>)}</section><section className="panel"><PanelTitle kicker="Activité calculée" title="Tickets récents" action={showTickets} />{tickets.length ? <TicketTable tickets={[...tickets].sort((a, b) => +new Date(b.updated_at) - +new Date(a.updated_at)).slice(0, 6)} onOpen={onOpen} /> : <EmptyState onCreate={showTickets} />}</section></>;
}

function TicketsView({ tickets, total, query, setQuery, priority, setPriority, status, setStatus, technician, setTechnician, team, sortKey, setSortKey, sortAsc, setSortAsc, onOpen, onEdit, onState, onCreate }: { tickets: Ticket[]; total: number; query: string; setQuery: (value: string) => void; priority: Priority | "all"; setPriority: (value: Priority | "all") => void; status: Status | "all"; setStatus: (value: Status | "all") => void; technician: string; setTechnician: (value: string) => void; team: Profile[]; sortKey: SortKey; setSortKey: (value: SortKey) => void; sortAsc: boolean; setSortAsc: (value: boolean) => void; onOpen: (ticket: Ticket) => void; onEdit?: (ticket: Ticket) => void; onState?: (ticket: Ticket, next: "closed" | "new") => void; onCreate: () => void }) {
  return <section><div className="summary-strip"><div><span>Total</span><strong>{total}</strong></div><div><span>Affichés</span><strong>{tickets.length}</strong></div><div><span>Ouverts</span><strong>{tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status)).length}</strong></div><div><span>Fermés</span><strong>{tickets.filter((ticket) => ticket.status === "closed").length}</strong></div></div><article className="panel all-tickets"><div className="panel-heading ticket-tools"><div><p className="section-kicker">Recherche avancée</p><h2>Tous les tickets</h2></div><button className="primary-button" onClick={onCreate}><Plus />Créer</button></div><div className="filters" aria-label="Filtres des tickets"><label className="search-field"><Search /><span className="sr-only">Rechercher</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ID, sujet, demandeur, technicien…" /></label><label><Filter /><span className="sr-only">Priorité</span><select aria-label="Filtrer par priorité" value={priority} onChange={(event) => setPriority(event.target.value as Priority | "all")}><option value="all">Toutes priorités</option>{priorities.map((item) => <option value={item} key={item}>{priorityLabels[item]}</option>)}</select></label><label><CircleDot /><span className="sr-only">Statut</span><select aria-label="Filtrer par statut" value={status} onChange={(event) => setStatus(event.target.value as Status | "all")}><option value="all">Tous les statuts</option>{statuses.map((item) => <option value={item} key={item}>{statusLabels[item]}</option>)}</select></label><label><Users /><span className="sr-only">Technicien</span><select aria-label="Filtrer par technicien" value={technician} onChange={(event) => setTechnician(event.target.value)}><option value="all">Tous techniciens</option><option value="unassigned">Non assignés</option>{team.map((member) => <option value={member.id} key={member.id}>{member.full_name}</option>)}</select></label><label><ArrowDownAZ /><span className="sr-only">Trier</span><select aria-label="Trier les tickets" value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}><option value="updated_at">Dernière mise à jour</option><option value="ticket_number">Numéro</option><option value="priority">Priorité</option><option value="status">Statut</option><option value="subject">Sujet</option></select></label><button className="sort-button" onClick={() => setSortAsc(!sortAsc)} aria-label={sortAsc ? "Tri croissant" : "Tri décroissant"}>{sortAsc ? <ArrowUpAZ /> : <ArrowDownAZ />}</button></div>{tickets.length ? <TicketTable tickets={tickets} onOpen={onOpen} onEdit={onEdit} onState={onState} /> : <EmptyState onCreate={onCreate} />}</article></section>;
}

function TicketTable({ tickets, onOpen, onEdit, onState }: { tickets: Ticket[]; onOpen: (ticket: Ticket) => void; onEdit?: (ticket: Ticket) => void; onState?: (ticket: Ticket, next: "closed" | "new") => void }) { return <div className="table-wrap"><table><thead><tr><th>Ticket</th><th>Sujet</th><th>Priorité</th><th>Statut</th><th>Technicien</th><th>Mis à jour</th><th>Actions</th></tr></thead><tbody>{tickets.map((ticket) => <tr key={ticket.id}><td><button className="ticket-id" onClick={() => onOpen(ticket)}>INC-{ticket.ticket_number}</button></td><td><button className="subject-cell" onClick={() => onOpen(ticket)}><strong>{ticket.subject}</strong><span>{ticket.requester?.full_name ?? "Demandeur"} · {ticket.department || "Sans service"}</span></button></td><td><Badge kind="priority" value={priorityLabels[ticket.priority]} /></td><td><Badge kind="status" value={statusLabels[ticket.status]} /></td><td>{ticket.technician?.full_name ?? "Non assigné"}</td><td>{formatDate(ticket.updated_at)}</td><td><div className="row-actions"><button onClick={() => onOpen(ticket)} aria-label={`Afficher INC-${ticket.ticket_number}`}><MessageSquare /></button>{onEdit && <button onClick={() => onEdit(ticket)} aria-label={`Modifier INC-${ticket.ticket_number}`}><Edit3 /></button>}{onState && <button onClick={() => onState(ticket, ticket.status === "closed" ? "new" : "closed")} aria-label={`${ticket.status === "closed" ? "Rouvrir" : "Fermer"} INC-${ticket.ticket_number}`}>{ticket.status === "closed" ? <ArchiveRestore /> : <TicketCheck />}</button>}</div></td></tr>)}</tbody></table></div>; }
function Badge({ kind, value }: { kind: "priority" | "status"; value: string }) { return <span className={`badge ${kind}-${value.toLowerCase().replaceAll(" ", "-").normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`}>{value}</span>; }
function EmptyState({ onCreate }: { onCreate: () => void }) { return <div className="empty-state"><Search /><h3>Aucun ticket trouvé</h3><p>Modifiez les filtres ou créez une nouvelle demande.</p><button className="primary-button" onClick={onCreate}><Plus />Nouveau ticket</button></div>; }

function TicketModal({ mode, form, setForm, team, staff, error, onSubmit, onClose }: { mode: "create" | "edit"; form: typeof emptyForm; setForm: React.Dispatch<React.SetStateAction<typeof emptyForm>>; team: Profile[]; staff: boolean; error: string; onSubmit: (event: FormEvent) => void; onClose: () => void }) { return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="ticket-modal-title"><div className="modal-header"><div><p className="section-kicker">HelpDesk NovaTech</p><h2 id="ticket-modal-title">{mode === "create" ? "Créer un ticket" : "Modifier le ticket"}</h2></div><button onClick={onClose} aria-label="Fermer"><X /></button></div>{error && <div className="form-alert error">{error}</div>}<form onSubmit={onSubmit} className="ticket-form"><label className="span-2">Sujet<input autoFocus required minLength={3} maxLength={150} value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} /></label><label>Service<input value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} /></label><label>Priorité<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as Priority })}>{priorities.map((item) => <option value={item} key={item}>{priorityLabels[item]}</option>)}</select></label>{staff && mode === "edit" && <><label>Statut<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Status })}>{statuses.map((item) => <option value={item} key={item}>{statusLabels[item]}</option>)}</select></label><label>Technicien<select value={form.assigned_to} onChange={(event) => setForm({ ...form, assigned_to: event.target.value })}><option value="">Non assigné</option>{team.map((member) => <option value={member.id} key={member.id}>{member.full_name}</option>)}</select></label></>}<label className="span-2">Description<textarea required minLength={3} maxLength={5000} rows={6} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><div className="form-actions span-2"><button type="button" className="secondary-button" onClick={onClose}>Annuler</button><button className="primary-button" type="submit"><CheckCircle2 />{mode === "create" ? "Créer le ticket" : "Enregistrer"}</button></div></form></section></div>; }

function DetailsModal({ ticket, comments, history, comment, setComment, onComment, onClose }: { ticket: Ticket; comments: Comment[]; history: History[]; comment: string; setComment: (value: string) => void; onComment: (event: FormEvent) => void; onClose: () => void }) { return <div className="modal-backdrop"><section className="modal detail-modal" role="dialog" aria-modal="true" aria-labelledby="details-title"><div className="modal-header"><div><p className="section-kicker">INC-{ticket.ticket_number} · {statusLabels[ticket.status]}</p><h2 id="details-title">{ticket.subject}</h2></div><button onClick={onClose} aria-label="Fermer"><X /></button></div><div className="detail-body"><p className="ticket-description">{ticket.description}</p><div className="detail-grid"><section><h3><MessageSquare />Commentaires</h3><div className="timeline">{comments.length ? comments.map((item) => <article key={item.id}><strong>{item.author?.full_name ?? "Utilisateur"}</strong><time>{formatDate(item.created_at)}</time><p>{item.body}</p></article>) : <p className="muted">Aucun commentaire.</p>}</div><form className="comment-form" onSubmit={onComment}><label className="sr-only" htmlFor="comment">Nouveau commentaire</label><textarea id="comment" required maxLength={3000} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Ajouter une information utile…" /><button className="primary-button"><MessageSquare />Commenter</button></form></section><section><h3><Clock3 />Historique</h3><div className="timeline">{history.length ? history.map((item) => <article key={item.id}><strong>{historyLabel(item.action)}</strong><time>{formatDate(item.created_at)}</time><p>{item.actor?.full_name ?? "Système"}</p></article>) : <p className="muted">Aucune modification enregistrée.</p>}</div></section></div></div></section></div>; }
function historyLabel(action: string) { return ({ created: "Ticket créé", updated: "Ticket modifié", content_updated: "Contenu modifié", commented: "Commentaire ajouté", closed: "Ticket fermé", reopened: "Ticket rouvert" } as Record<string, string>)[action] ?? action; }

function Team({ members, tickets }: { members: Profile[]; tickets: Ticket[] }) { return <section className="team-grid">{members.map((member) => <article className="panel team-card" key={member.id}><div className="avatar large">{initials(member.full_name)}</div><h2>{member.full_name}</h2><p>{roleLabels[member.role]} · {member.department || "Sans service"}</p><div><span>Tickets actifs</span><strong>{tickets.filter((ticket) => ticket.assigned_to === member.id && !["resolved", "closed"].includes(ticket.status)).length}</strong></div><span className="availability"><i />Compte actif</span></article>)}</section>; }
function SettingsView({ mode, reason, onJson, onCsv, onImport, onReset }: { mode: Mode; reason: string; onJson: () => void; onCsv: () => void; onImport: () => void; onReset: () => void }) { return <section className="settings-grid"><article className="panel settings-card"><span className="settings-icon"><ShieldCheck /></span><div><h2>Mode hybride sécurisé</h2><p>{reason}. Supabase reste prioritaire ; localStorage assure la continuité.</p><span className={`service-ok ${mode}`}><i />{mode === "supabase" ? "Supabase connecté" : "Démonstration locale active"}</span></div></article><article className="panel backup-card"><div><p className="section-kicker">Portabilité</p><h2>Sauvegarde et export</h2><p>Exportez les tickets ou restaurez une sauvegarde JSON dans le mode démonstration.</p></div><div className="backup-actions"><button className="secondary-button" onClick={onJson}><FileJson />Export JSON</button><button className="secondary-button" onClick={onCsv}><Download />Export CSV</button><button className="secondary-button" onClick={onImport}><Upload />Importer</button><button className="danger-button" onClick={onReset}><RefreshCcw />Réinitialiser la démo</button></div></article></section>; }
