"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Activity, AlertTriangle, Bell, CheckCircle2, ChevronRight, Clock3, Edit3,
  Filter, LayoutDashboard, LogOut, Menu, MessageSquare, Plus, Search,
  Settings, ShieldCheck, TicketCheck, Tickets, Users, Wifi, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Role = "requester" | "technician" | "administrator";
type Priority = "low" | "medium" | "high" | "urgent";
type Status = "new" | "in_progress" | "waiting" | "resolved" | "closed";
type View = "dashboard" | "tickets" | "team" | "settings";
type Profile = { id: string; full_name: string; department: string | null; role: Role };
type Ticket = {
  id: string; ticket_number: number; subject: string; description: string;
  department: string | null; priority: Priority; status: Status;
  requester_id: string; assigned_to: string | null; created_at: string; updated_at: string;
  requester: { full_name: string } | null; technician: { full_name: string } | null;
};
type Comment = { id: string; body: string; created_at: string; author: { full_name: string } | null };
type History = { id: number; action: string; changes: Record<string, unknown>; created_at: string; actor: { full_name: string } | null };

const priorityLabels: Record<Priority, string> = { urgent: "Urgente", high: "Haute", medium: "Moyenne", low: "Faible" };
const statusLabels: Record<Status, string> = { new: "Nouveau", in_progress: "En cours", waiting: "En attente", resolved: "Résolu", closed: "Fermé" };
const roleLabels: Record<Role, string> = { requester: "Demandeur", technician: "Technicien", administrator: "Administrateur" };
const priorities = Object.keys(priorityLabels) as Priority[];
const statuses = Object.keys(statusLabels) as Status[];
const emptyForm = { subject: "", description: "", department: "", priority: "medium" as Priority, status: "new" as Status, assigned_to: "" };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

export default function Home() {
  const supabase = useMemo(() => createClient(), []);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [team, setTeam] = useState<Profile[]>([]);
  const [view, setView] = useState<View>("dashboard");
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState<Priority | "all">("all");
  const [status, setStatus] = useState<Status | "all">("all");
  const [modal, setModal] = useState<"create" | "edit" | "details" | null>(null);
  const [active, setActive] = useState<Ticket | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [comments, setComments] = useState<Comment[]>([]);
  const [history, setHistory] = useState<History[]>([]);
  const [comment, setComment] = useState("");
  const [toast, setToast] = useState("");
  const [loading, setLoading] = useState(true);
  const [mobileNav, setMobileNav] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;
    const { data: current } = await supabase.from("profiles").select("id,full_name,department,role").eq("id", userData.user.id).single();
    setProfile(current as Profile);
    const { data } = await supabase
      .from("tickets")
      .select("*,requester:profiles!tickets_requester_id_fkey(full_name),technician:profiles!tickets_assigned_to_fkey(full_name)")
      .order("updated_at", { ascending: false });
    setTickets((data ?? []) as unknown as Ticket[]);
    if (current?.role !== "requester") {
      const { data: members } = await supabase.from("profiles").select("id,full_name,department,role").order("full_name");
      setTeam((members ?? []) as Profile[]);
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => { const id = setTimeout(() => void loadData(), 0); return () => clearTimeout(id); }, [loadData]);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(""), 3000); return () => clearTimeout(id); }, [toast]);

  const isStaff = profile?.role === "technician" || profile?.role === "administrator";
  const filtered = tickets.filter((ticket) => {
    const query = search.trim().toLowerCase();
    const matches = !query || [`INC-${ticket.ticket_number}`, ticket.subject, ticket.requester?.full_name ?? "", ticket.technician?.full_name ?? ""].some((value) => value.toLowerCase().includes(query));
    return matches && (priority === "all" || ticket.priority === priority) && (status === "all" || ticket.status === status);
  });
  const counts = {
    open: tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status)).length,
    active: tickets.filter((ticket) => ticket.status === "in_progress").length,
    urgent: tickets.filter((ticket) => ticket.priority === "urgent" && !["resolved", "closed"].includes(ticket.status)).length,
    resolved: tickets.filter((ticket) => ["resolved", "closed"].includes(ticket.status)).length,
  };

  function openCreate() { setActive(null); setForm({ ...emptyForm, department: profile?.department ?? "" }); setModal("create"); }
  function openEdit(ticket: Ticket) {
    setActive(ticket);
    setForm({ subject: ticket.subject, description: ticket.description, department: ticket.department ?? "", priority: ticket.priority, status: ticket.status, assigned_to: ticket.assigned_to ?? "" });
    setModal("edit");
  }
  async function openDetails(ticket: Ticket) {
    setActive(ticket); setModal("details");
    const [commentResult, historyResult] = await Promise.all([
      supabase.from("comments").select("id,body,created_at,author:profiles!comments_author_id_fkey(full_name)").eq("ticket_id", ticket.id).order("created_at"),
      supabase.from("ticket_history").select("id,action,changes,created_at,actor:profiles!ticket_history_actor_id_fkey(full_name)").eq("ticket_id", ticket.id).order("created_at", { ascending: false }),
    ]);
    setComments((commentResult.data ?? []) as unknown as Comment[]);
    setHistory((historyResult.data ?? []) as unknown as History[]);
  }
  async function submitTicket(event: FormEvent) {
    event.preventDefault();
    if (!profile) return;
    const payload = { subject: form.subject.trim(), description: form.description.trim(), department: form.department.trim() || null, priority: form.priority };
    const result = modal === "edit" && active
      ? await supabase.from("tickets").update({ ...payload, status: form.status, assigned_to: form.assigned_to || null }).eq("id", active.id)
      : await supabase.from("tickets").insert({ ...payload, requester_id: profile.id });
    if (result.error) return setToast(`Erreur : ${result.error.message}`);
    setToast(modal === "edit" ? "Le ticket a été mis à jour." : "Le ticket a été créé.");
    setModal(null); await loadData();
  }
  async function closeTicket(ticket: Ticket) {
    const { error } = await supabase.from("tickets").update({ status: "closed", closed_at: new Date().toISOString() }).eq("id", ticket.id);
    setToast(error ? `Erreur : ${error.message}` : `INC-${ticket.ticket_number} a été fermé.`);
    if (!error) await loadData();
  }
  async function addComment(event: FormEvent) {
    event.preventDefault();
    if (!profile || !active || !comment.trim()) return;
    const { error } = await supabase.from("comments").insert({ ticket_id: active.id, author_id: profile.id, body: comment.trim() });
    if (error) return setToast(`Erreur : ${error.message}`);
    setComment(""); setToast("Commentaire ajouté."); await openDetails(active);
  }
  async function changeRole(member: Profile, role: Role) {
    const { error } = await supabase.from("profiles").update({ role }).eq("id", member.id);
    setToast(error ? `Erreur : ${error.message}` : `Rôle de ${member.full_name} mis à jour.`);
    if (!error) await loadData();
  }
  async function logout() { await supabase.auth.signOut(); window.location.assign("/login"); }

  if (loading || !profile) return <main className="loading-screen"><span className="brand-mark">N</span><p>Chargement sécurisé du HelpDesk…</p></main>;
  const initials = profile.full_name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase();
  const today = new Intl.DateTimeFormat("fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date());

  return <div className="app-shell">
    <button className="mobile-menu" aria-label="Ouvrir le menu" onClick={() => setMobileNav(true)}><Menu /></button>
    <aside className={`sidebar ${mobileNav ? "is-open" : ""}`}>
      <button className="close-mobile" aria-label="Fermer le menu" onClick={() => setMobileNav(false)}><X /></button>
      <div className="brand"><span className="brand-mark">N</span><div><strong>HelpDesk</strong><span>NovaTech</span></div></div>
      <nav aria-label="Navigation principale">
        <Nav active={view === "dashboard"} icon={<LayoutDashboard />} label="Tableau de bord" onClick={() => setView("dashboard")} />
        <Nav active={view === "tickets"} icon={<Tickets />} label="Tickets" badge={counts.open} onClick={() => setView("tickets")} />
        {isStaff && <Nav active={view === "team"} icon={<Users />} label="Équipe" onClick={() => setView("team")} />}
        <Nav active={view === "settings"} icon={<Settings />} label="Paramètres" onClick={() => setView("settings")} />
      </nav>
      <div className="profile-card"><div className="avatar">{initials}</div><div><strong>{profile.full_name}</strong><span>{roleLabels[profile.role]}</span></div><button onClick={logout}><LogOut /><span>Déconnexion</span></button></div>
    </aside>
    {mobileNav && <button className="backdrop" aria-label="Fermer le menu" onClick={() => setMobileNav(false)} />}
    <main className="main-content">
      <header className="topbar"><div><p className="eyebrow">Centre de services IT · {roleLabels[profile.role]}</p><h1>{view === "dashboard" ? `Bonjour ${profile.full_name.split(" ")[0]}` : view === "tickets" ? "Gestion des tickets" : view === "team" ? "Équipe support" : "Paramètres"}</h1><p className="date">{today[0].toUpperCase() + today.slice(1)}</p></div><div className="top-actions"><button className="icon-button" aria-label="Notifications"><Bell /><span>{counts.urgent}</span></button><button className="primary-button" onClick={openCreate}><Plus />Nouveau ticket</button><div className="top-avatar">{initials}</div></div></header>
      {view === "dashboard" && <Dashboard tickets={tickets} counts={counts} showTickets={() => setView("tickets")} onOpen={openDetails} />}
      {view === "tickets" && <TicketsView tickets={filtered} total={tickets.length} search={search} setSearch={setSearch} priority={priority} setPriority={setPriority} status={status} setStatus={setStatus} onOpen={openDetails} onEdit={isStaff ? openEdit : undefined} onClose={isStaff ? closeTicket : undefined} onCreate={openCreate} />}
      {view === "team" && isStaff && <Team members={team} tickets={tickets} isAdmin={profile.role === "administrator"} onRole={changeRole} />}
      {view === "settings" && <SettingsView profile={profile} />}
    </main>
    {(modal === "create" || modal === "edit") && <TicketModal mode={modal} form={form} setForm={setForm} team={team.filter((member) => member.role !== "requester")} staff={isStaff} onSubmit={submitTicket} onClose={() => setModal(null)} />}
    {modal === "details" && active && <DetailsModal ticket={active} comments={comments} history={history} comment={comment} setComment={setComment} onComment={addComment} onClose={() => setModal(null)} />}
    {toast && <div className="toast" role="status"><CheckCircle2 />{toast}</div>}
  </div>;
}

function Nav({ active, icon, label, badge, onClick }: { active: boolean; icon: React.ReactNode; label: string; badge?: number; onClick: () => void }) { return <button className={`nav-item ${active ? "active" : ""}`} onClick={onClick}>{icon}<span>{label}</span>{badge !== undefined && <em>{badge}</em>}</button>; }
function PanelTitle({ kicker, title, action }: { kicker: string; title: string; action?: () => void }) { return <div className="panel-heading"><div><p className="section-kicker">{kicker}</p><h2>{title}</h2></div>{action && <button className="text-button" onClick={action}>Voir tous <ChevronRight /></button>}</div>; }

function Dashboard({ tickets, counts, showTickets, onOpen }: { tickets: Ticket[]; counts: { open: number; active: number; urgent: number; resolved: number }; showTickets: () => void; onOpen: (ticket: Ticket) => void }) {
  const cards = [{ label: "Tickets ouverts", value: counts.open, icon: <Tickets />, tone: "cyan" }, { label: "En cours", value: counts.active, icon: <Activity />, tone: "amber" }, { label: "Urgents", value: counts.urgent, icon: <AlertTriangle />, tone: "red" }, { label: "Résolus", value: counts.resolved, icon: <CheckCircle2 />, tone: "green" }];
  return <><section className="kpi-grid">{cards.map((card) => <button key={card.label} className="kpi-card" onClick={showTickets}><span className={`kpi-icon ${card.tone}`}>{card.icon}</span><span><small>{card.label}</small><strong>{card.value}</strong><em>Données Supabase en temps réel</em></span><ChevronRight className="kpi-arrow" /></button>)}</section><section className="panel"><PanelTitle kicker="File active" title="Tickets récents" action={showTickets} />{tickets.length ? <TicketTable tickets={tickets.slice(0, 6)} onOpen={onOpen} /> : <EmptyState onCreate={showTickets} />}</section></>;
}

function TicketsView({ tickets, total, search, setSearch, priority, setPriority, status, setStatus, onOpen, onEdit, onClose, onCreate }: { tickets: Ticket[]; total: number; search: string; setSearch: (value: string) => void; priority: Priority | "all"; setPriority: (value: Priority | "all") => void; status: Status | "all"; setStatus: (value: Status | "all") => void; onOpen: (ticket: Ticket) => void; onEdit?: (ticket: Ticket) => void; onClose?: (ticket: Ticket) => void; onCreate: () => void }) {
  return <section><div className="summary-strip"><div><span>Total</span><strong>{total}</strong></div><div><span>Affichés</span><strong>{tickets.length}</strong></div><div><span>Ouverts</span><strong>{tickets.filter((ticket) => !["resolved", "closed"].includes(ticket.status)).length}</strong></div><div><span>Résolus</span><strong>{tickets.filter((ticket) => ["resolved", "closed"].includes(ticket.status)).length}</strong></div></div><article className="panel all-tickets"><div className="panel-heading ticket-tools"><div><p className="section-kicker">Centre de support</p><h2>Tous les tickets</h2></div><div className="filters"><label className="search-field"><Search /><span className="sr-only">Rechercher</span><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ID, sujet, demandeur…" /></label><label><Filter /><select aria-label="Priorité" value={priority} onChange={(event) => setPriority(event.target.value as Priority | "all")}><option value="all">Toutes</option>{priorities.map((item) => <option value={item} key={item}>{priorityLabels[item]}</option>)}</select></label><label><Activity /><select aria-label="Statut" value={status} onChange={(event) => setStatus(event.target.value as Status | "all")}><option value="all">Tous</option>{statuses.map((item) => <option value={item} key={item}>{statusLabels[item]}</option>)}</select></label></div></div>{tickets.length ? <TicketTable tickets={tickets} onOpen={onOpen} onEdit={onEdit} onClose={onClose} /> : <EmptyState onCreate={onCreate} />}</article></section>;
}

function TicketTable({ tickets, onOpen, onEdit, onClose }: { tickets: Ticket[]; onOpen: (ticket: Ticket) => void; onEdit?: (ticket: Ticket) => void; onClose?: (ticket: Ticket) => void }) { return <div className="table-wrap"><table><thead><tr><th>Ticket</th><th>Sujet</th><th>Priorité</th><th>Statut</th><th>Technicien</th><th>Mis à jour</th><th>Actions</th></tr></thead><tbody>{tickets.map((ticket) => <tr key={ticket.id}><td><button className="ticket-id" onClick={() => onOpen(ticket)}>INC-{ticket.ticket_number}</button></td><td><button className="subject-cell" onClick={() => onOpen(ticket)}><strong>{ticket.subject}</strong><span>{ticket.requester?.full_name ?? "Demandeur"} · {ticket.department || "Sans service"}</span></button></td><td><Badge kind="priority" value={priorityLabels[ticket.priority]} /></td><td><Badge kind="status" value={statusLabels[ticket.status]} /></td><td>{ticket.technician?.full_name ?? "Non assigné"}</td><td>{formatDate(ticket.updated_at)}</td><td><div className="row-actions"><button onClick={() => onOpen(ticket)} aria-label="Commentaires et historique"><MessageSquare /></button>{onEdit && <button onClick={() => onEdit(ticket)} aria-label="Modifier"><Edit3 /></button>}{onClose && ticket.status !== "closed" && <button onClick={() => onClose(ticket)} aria-label="Fermer"><TicketCheck /></button>}</div></td></tr>)}</tbody></table></div>; }
function Badge({ kind, value }: { kind: "priority" | "status"; value: string }) { return <span className={`badge ${kind}-${value.toLowerCase().replaceAll(" ", "-").normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`}>{value}</span>; }
function EmptyState({ onCreate }: { onCreate: () => void }) { return <div className="empty-state"><Search /><h3>Aucun ticket</h3><p>Créez la première demande enregistrée dans Supabase.</p><button className="primary-button" onClick={onCreate}><Plus />Nouveau ticket</button></div>; }

function TicketModal({ mode, form, setForm, team, staff, onSubmit, onClose }: { mode: "create" | "edit"; form: typeof emptyForm; setForm: React.Dispatch<React.SetStateAction<typeof emptyForm>>; team: Profile[]; staff: boolean; onSubmit: (event: FormEvent) => void; onClose: () => void }) { return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal" role="dialog" aria-modal="true"><div className="modal-header"><div><p className="section-kicker">HelpDesk NovaTech</p><h2>{mode === "create" ? "Créer un ticket" : "Modifier le ticket"}</h2></div><button onClick={onClose}><X /></button></div><form onSubmit={onSubmit} className="ticket-form"><label className="span-2">Sujet<input required minLength={3} maxLength={150} value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} /></label><label>Service<input value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} /></label><label>Priorité<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as Priority })}>{priorities.map((item) => <option value={item} key={item}>{priorityLabels[item]}</option>)}</select></label>{staff && mode === "edit" && <><label>Statut<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Status })}>{statuses.map((item) => <option value={item} key={item}>{statusLabels[item]}</option>)}</select></label><label>Technicien<select value={form.assigned_to} onChange={(event) => setForm({ ...form, assigned_to: event.target.value })}><option value="">Non assigné</option>{team.map((member) => <option value={member.id} key={member.id}>{member.full_name}</option>)}</select></label></>}<label className="span-2">Description<textarea required minLength={3} maxLength={5000} rows={6} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><div className="form-actions span-2"><button type="button" className="secondary-button" onClick={onClose}>Annuler</button><button className="primary-button" type="submit"><CheckCircle2 />{mode === "create" ? "Créer le ticket" : "Enregistrer"}</button></div></form></section></div>; }

function DetailsModal({ ticket, comments, history, comment, setComment, onComment, onClose }: { ticket: Ticket; comments: Comment[]; history: History[]; comment: string; setComment: (value: string) => void; onComment: (event: FormEvent) => void; onClose: () => void }) { return <div className="modal-backdrop"><section className="modal detail-modal" role="dialog" aria-modal="true"><div className="modal-header"><div><p className="section-kicker">INC-{ticket.ticket_number} · {statusLabels[ticket.status]}</p><h2>{ticket.subject}</h2></div><button onClick={onClose}><X /></button></div><div className="detail-body"><p className="ticket-description">{ticket.description}</p><div className="detail-grid"><section><h3><MessageSquare />Commentaires</h3><div className="timeline">{comments.length ? comments.map((item) => <article key={item.id}><strong>{item.author?.full_name ?? "Utilisateur"}</strong><time>{formatDate(item.created_at)}</time><p>{item.body}</p></article>) : <p className="muted">Aucun commentaire.</p>}</div><form className="comment-form" onSubmit={onComment}><textarea required maxLength={3000} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Ajouter une information utile…" /><button className="primary-button"><MessageSquare />Commenter</button></form></section><section><h3><Clock3 />Historique</h3><div className="timeline">{history.map((item) => <article key={item.id}><strong>{historyLabel(item.action)}</strong><time>{formatDate(item.created_at)}</time><p>{item.actor?.full_name ?? "Système"}</p></article>)}</div></section></div></div></section></div>; }
function historyLabel(action: string) { return ({ created: "Ticket créé", updated: "Ticket mis à jour", content_updated: "Contenu modifié", commented: "Commentaire ajouté" } as Record<string, string>)[action] ?? action; }

function Team({ members, tickets, isAdmin, onRole }: { members: Profile[]; tickets: Ticket[]; isAdmin: boolean; onRole: (member: Profile, role: Role) => void }) { return <section className="team-grid">{members.map((member) => <article className="panel team-card" key={member.id}><div className="avatar large">{member.full_name.split(" ").map((part) => part[0]).slice(0, 2).join("")}</div><h2>{member.full_name}</h2><p>{roleLabels[member.role]} · {member.department || "Sans service"}</p><div><span>Tickets actifs</span><strong>{tickets.filter((ticket) => ticket.assigned_to === member.id && !["resolved", "closed"].includes(ticket.status)).length}</strong></div>{isAdmin ? <select aria-label={`Rôle de ${member.full_name}`} value={member.role} onChange={(event) => onRole(member, event.target.value as Role)}><option value="requester">Demandeur</option><option value="technician">Technicien</option><option value="administrator">Administrateur</option></select> : <span className="availability"><i />Compte actif</span>}</article>)}</section>; }
function SettingsView({ profile }: { profile: Profile }) { return <section className="settings-grid"><article className="panel settings-card"><span className="settings-icon"><ShieldCheck /></span><div><h2>Sécurité active</h2><p>Session Supabase Auth et politiques RLS. Votre rôle : <strong>{roleLabels[profile.role]}</strong>.</p></div></article><article className="panel settings-card"><span className="settings-icon"><Wifi /></span><div><h2>Base de données</h2><p>Tickets, commentaires et historique sont persistés dans PostgreSQL.</p><span className="service-ok"><i />Supabase connecté</span></div></article></section>; }
