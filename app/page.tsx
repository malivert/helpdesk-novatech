"use client";

import { ChangeEvent, FormEvent, ReactNode, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArchiveRestore, ArrowDownAZ, ArrowUpAZ, BarChart3, Bell,
  CalendarDays, CheckCircle2, ChevronRight, CircleDot, Clock3, Database, Download,
  BookOpen, Edit3, FileJson, FileText, Filter, GraduationCap, HardDrive, Info, LayoutDashboard, Link2,
  Menu, MessageSquare, Monitor, Moon, Paperclip, Plus, Printer, RefreshCcw, Search,
  Server, Settings, ShieldCheck, Sun, TicketCheck, Tickets, Trash2, Upload, Users,
  Wifi, WifiOff, X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Role = "requester" | "technician" | "administrator";
type Priority = "low" | "medium" | "high" | "urgent";
type Status = "new" | "in_progress" | "waiting" | "resolved" | "closed";
type View = "dashboard" | "tickets" | "inventory" | "reports" | "team" | "skills" | "about" | "settings";
type Mode = "loading" | "supabase" | "demo";
type Period = "day" | "week" | "month" | "all";
type Profile = { id: string; full_name: string; department: string | null; role: Role };
type Attachment = { id: string; name: string; size: number; type: string; data_url: string; created_at: string };
type Ticket = {
  id: string; ticket_number: number; subject: string; description: string;
  department: string | null; priority: Priority; status: Status;
  requester_id: string; assigned_to: string | null; created_at: string; updated_at: string;
  due_at?: string | null; closed_at?: string | null; attachments?: Attachment[];
  requester: { full_name: string } | null; technician: { full_name: string } | null;
};
type Comment = { id: string; ticket_id?: string; body: string; created_at: string; author: { full_name: string } | null };
type History = { id: number; ticket_id?: string; action: string; changes: Record<string, unknown>; created_at: string; actor: { full_name: string } | null };
type SortKey = "updated_at" | "created_at" | "due_at" | "ticket_number" | "priority" | "status" | "subject";
type TicketForm = { subject: string; description: string; department: string; priority: Priority; status: Status; assigned_to: string; due_at: string; attachments: Attachment[] };
type EquipmentType = "computer" | "server" | "printer" | "network" | "other";
type EquipmentStatus = "available" | "assigned" | "broken" | "maintenance";
type Equipment = { id: string; name: string; type: EquipmentType; ip_address: string; operating_system: string; user: string; location: string; status: EquipmentStatus; serial_number: string; purchase_date: string; warranty_end: string; ticket_ids: string[]; created_at: string; updated_at: string };
type EquipmentHistory = { id: number; equipment_id: string; action: "created" | "updated" | "deleted"; changes: Record<string, unknown>; created_at: string; actor: string };
type EquipmentForm = Omit<Equipment, "id" | "created_at" | "updated_at">;
type EquipmentSort = "name" | "type" | "status" | "user" | "warranty_end";
type Backup = { version: 3; exported_at: string; tickets: Ticket[]; comments: Comment[]; history: History[]; equipment: Equipment[]; equipment_history: EquipmentHistory[] };

const priorityLabels: Record<Priority, string> = { urgent: "Urgente", high: "Haute", medium: "Moyenne", low: "Faible" };
const statusLabels: Record<Status, string> = { new: "Nouveau", in_progress: "En cours", waiting: "En attente", resolved: "Résolu", closed: "Fermé" };
const roleLabels: Record<Role, string> = { requester: "Demandeur", technician: "Technicien", administrator: "Administrateur" };
const periodLabels: Record<Period, string> = { day: "Aujourd’hui", week: "7 jours", month: "30 jours", all: "Toutes" };
const equipmentTypeLabels: Record<EquipmentType, string> = { computer: "Ordinateur", server: "Serveur", printer: "Imprimante", network: "Réseau", other: "Autre" };
const equipmentStatusLabels: Record<EquipmentStatus, string> = { available: "Disponible", assigned: "Attribué", broken: "En panne", maintenance: "Maintenance" };
const priorities = Object.keys(priorityLabels) as Priority[];
const statuses = Object.keys(statusLabels) as Status[];
const priorityRank: Record<Priority, number> = { urgent: 4, high: 3, medium: 2, low: 1 };
const statusRank: Record<Status, number> = { new: 1, in_progress: 2, waiting: 3, resolved: 4, closed: 5 };
const storageKeys = { tickets: "novatech.v2.tickets", comments: "novatech.v2.comments", history: "novatech.v2.history", equipment: "novatech.v2.equipment", equipmentHistory: "novatech.v2.equipment-history", theme: "novatech.v2.theme" };
const emptyForm: TicketForm = { subject: "", description: "", department: "", priority: "medium", status: "new", assigned_to: "", due_at: "", attachments: [] };
const emptyEquipmentForm: EquipmentForm = { name: "", type: "computer", ip_address: "", operating_system: "", user: "", location: "", status: "available", serial_number: "", purchase_date: "", warranty_end: "", ticket_ids: [] };
const christian: Profile = { id: "demo-christian", full_name: "Christian Martin", department: "DSI", role: "administrator" };
const demoTeam: Profile[] = [christian, { id: "demo-emma", full_name: "Emma Petit", department: "DSI", role: "technician" }, { id: "demo-yassine", full_name: "Yassine Diallo", department: "Infrastructure", role: "technician" }];
const baseNow = Date.now();

function makeDemoTicket(number: number, subject: string, requester: string, department: string, priority: Priority, status: Status, technician: Profile | null, createdHoursAgo: number, resolutionHours?: number): Ticket {
  const created = new Date(baseNow - createdHoursAgo * 3_600_000).toISOString();
  const updated = new Date(baseNow - Math.max(1, createdHoursAgo / 4) * 3_600_000).toISOString();
  const closed = resolutionHours ? new Date(new Date(created).getTime() + resolutionHours * 3_600_000).toISOString() : null;
  return { id: `demo-${number}`, ticket_number: number, subject, description: `Diagnostic et suivi de démonstration : ${subject}.`, department, priority, status, requester_id: `requester-${number}`, assigned_to: technician?.id ?? null, created_at: created, updated_at: updated, due_at: new Date(new Date(created).getTime() + (priority === "urgent" ? 8 : priority === "high" ? 24 : 72) * 3_600_000).toISOString(), closed_at: closed, attachments: [], requester: { full_name: requester }, technician: technician ? { full_name: technician.full_name } : null };
}

const demoTickets: Ticket[] = [
  makeDemoTicket(1062, "Accès VPN impossible en télétravail", "Claire Robert", "Finance", "urgent", "new", null, 5),
  makeDemoTicket(1061, "Impossible d’imprimer en salle B12", "Marie Dupont", "Formation", "high", "in_progress", christian, 18),
  makeDemoTicket(1060, "Compte Microsoft 365 bloqué", "Thomas Bernard", "Commerce", "urgent", "waiting", christian, 38),
  makeDemoTicket(1059, "Wi-Fi instable au bâtiment C", "Sophie Leroy", "Logistique", "medium", "in_progress", demoTeam[1], 74),
  makeDemoTicket(1058, "Installation du logiciel GLPI", "Hugo Moreau", "DSI", "low", "resolved", demoTeam[2], 120, 30),
  makeDemoTicket(1057, "Écran externe non détecté", "Nadia Cohen", "RH", "medium", "closed", demoTeam[1], 190, 42),
  makeDemoTicket(1056, "Brassage réseau bureau 214", "Paul Martin", "Direction", "high", "closed", christian, 260, 20),
  makeDemoTicket(1055, "Mise à jour poste comptabilité", "Inès Leroy", "Finance", "low", "resolved", demoTeam[2], 340, 65),
];

const demoComments: Comment[] = [
  { id: "comment-1", ticket_id: "demo-1061", body: "Le pilote a été réinstallé, test utilisateur en attente.", created_at: new Date(baseNow - 2 * 3_600_000).toISOString(), author: { full_name: "Christian Martin" } },
  { id: "comment-2", ticket_id: "demo-1060", body: "Vérification du compte dans le centre d’administration Microsoft 365.", created_at: new Date(baseNow - 4 * 3_600_000).toISOString(), author: { full_name: "Emma Petit" } },
];
const demoHistory: History[] = demoTickets.map((ticket, index) => ({ id: index + 1, ticket_id: ticket.id, action: "created", changes: { priority: ticket.priority, status: ticket.status }, created_at: ticket.created_at, actor: { full_name: ticket.requester?.full_name ?? "Utilisateur" } }));
const demoEquipment: Equipment[] = [
  { id: "eq-pc-fin-01", name: "PC-FIN-01", type: "computer", ip_address: "192.168.10.21", operating_system: "Windows 11 Pro", user: "Claire Robert", location: "Bureau 204", status: "assigned", serial_number: "NOV-PC-2025-001", purchase_date: "2025-01-15", warranty_end: "2028-01-15", ticket_ids: ["demo-1062"], created_at: new Date(baseNow - 400 * 86_400_000).toISOString(), updated_at: new Date(baseNow - 5 * 86_400_000).toISOString() },
  { id: "eq-pc-form-12", name: "PC-FORM-12", type: "computer", ip_address: "192.168.20.44", operating_system: "Windows 11 Éducation", user: "Marie Dupont", location: "Salle B12", status: "assigned", serial_number: "NOV-PC-2024-044", purchase_date: "2024-08-20", warranty_end: "2027-08-20", ticket_ids: ["demo-1061"], created_at: new Date(baseNow - 600 * 86_400_000).toISOString(), updated_at: new Date(baseNow - 1 * 86_400_000).toISOString() },
  { id: "eq-srv-ad-01", name: "SRV-AD-01", type: "server", ip_address: "192.168.1.10", operating_system: "Windows Server 2022", user: "Service DSI", location: "Baie A · U12", status: "assigned", serial_number: "NOV-SRV-2023-010", purchase_date: "2023-03-10", warranty_end: "2028-03-10", ticket_ids: ["demo-1060"], created_at: new Date(baseNow - 900 * 86_400_000).toISOString(), updated_at: new Date(baseNow - 2 * 86_400_000).toISOString() },
  { id: "eq-prn-b12", name: "IMP-B12-01", type: "printer", ip_address: "192.168.20.80", operating_system: "HP FutureSmart", user: "Salle B12", location: "Bâtiment B", status: "broken", serial_number: "NOV-PRN-2021-018", purchase_date: "2021-06-04", warranty_end: "2024-06-04", ticket_ids: ["demo-1061"], created_at: new Date(baseNow - 1400 * 86_400_000).toISOString(), updated_at: new Date(baseNow - 1 * 86_400_000).toISOString() },
  { id: "eq-sw-core", name: "SW-CORE-01", type: "network", ip_address: "192.168.1.2", operating_system: "Cisco IOS XE", user: "Service DSI", location: "Baie A · U20", status: "maintenance", serial_number: "NOV-NET-2022-002", purchase_date: "2022-11-12", warranty_end: "2027-11-12", ticket_ids: ["demo-1059"], created_at: new Date(baseNow - 1100 * 86_400_000).toISOString(), updated_at: new Date(baseNow - 3 * 86_400_000).toISOString() },
  { id: "eq-pc-stock-03", name: "PC-STOCK-03", type: "computer", ip_address: "", operating_system: "Windows 11 Pro", user: "", location: "Stock DSI", status: "available", serial_number: "NOV-PC-2026-103", purchase_date: "2026-02-05", warranty_end: "2029-02-05", ticket_ids: [], created_at: new Date(baseNow - 160 * 86_400_000).toISOString(), updated_at: new Date(baseNow - 20 * 86_400_000).toISOString() },
  { id: "eq-nas-01", name: "NAS-BACKUP-01", type: "server", ip_address: "192.168.1.15", operating_system: "Synology DSM 7", user: "Service DSI", location: "Baie B · U04", status: "assigned", serial_number: "NOV-NAS-2020-001", purchase_date: "2020-09-14", warranty_end: "2025-09-14", ticket_ids: [], created_at: new Date(baseNow - 2000 * 86_400_000).toISOString(), updated_at: new Date(baseNow - 10 * 86_400_000).toISOString() },
];
const demoEquipmentHistory: EquipmentHistory[] = demoEquipment.map((item, index) => ({ id: index + 1, equipment_id: item.id, action: "created", changes: { status: item.status, user: item.user }, created_at: item.created_at, actor: "Christian Martin" }));

function formatDate(value?: string | null) { return value ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "Non définie"; }
function initials(name: string) { return name.split(" ").filter(Boolean).map((part) => part[0]).slice(0, 2).join("").toUpperCase(); }
function safeParse<T>(value: string | null, fallback: T): T { if (!value) return fallback; try { return JSON.parse(value) as T; } catch { return fallback; } }
function download(name: string, content: string, type: string) { const url = URL.createObjectURL(new Blob([content], { type })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = name; anchor.click(); URL.revokeObjectURL(url); }
function csvCell(value: unknown) { return `"${String(value ?? "").replaceAll('"', '""')}"`; }
function isOpen(ticket: Ticket) { return !["resolved", "closed"].includes(ticket.status); }
function periodStart(period: Period) { if (period === "all") return 0; const days = period === "day" ? 1 : period === "week" ? 7 : 30; return baseNow - days * 86_400_000; }
function fileToAttachment(file: File) { return new Promise<Attachment>((resolve, reject) => { const reader = new FileReader(); reader.onerror = () => reject(new Error("Lecture impossible")); reader.onload = () => resolve({ id: crypto.randomUUID(), name: file.name, size: file.size, type: file.type || "application/octet-stream", data_url: String(reader.result), created_at: new Date().toISOString() }); reader.readAsDataURL(file); }); }

export default function Home() {
  const supabase = useMemo(() => createClient(), []);
  const [mode, setMode] = useState<Mode>("loading");
  const [modeReason, setModeReason] = useState("localStorage est le stockage principal");
  const [profile, setProfile] = useState<Profile>(christian);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [team, setTeam] = useState<Profile[]>(demoTeam);
  const [comments, setComments] = useState<Comment[]>([]);
  const [history, setHistory] = useState<History[]>([]);
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [equipmentHistory, setEquipmentHistory] = useState<EquipmentHistory[]>([]);
  const [view, setView] = useState<View>("dashboard");
  const [period, setPeriod] = useState<Period>("month");
  const [query, setQuery] = useState("");
  const [priority, setPriority] = useState<Priority | "all">("all");
  const [status, setStatus] = useState<Status | "all">("all");
  const [technician, setTechnician] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("updated_at");
  const [sortAsc, setSortAsc] = useState(false);
  const [modal, setModal] = useState<"create" | "edit" | "details" | null>(null);
  const [active, setActive] = useState<Ticket | null>(null);
  const [pendingClose, setPendingClose] = useState<Ticket | null>(null);
  const [form, setForm] = useState<TicketForm>(emptyForm);
  const [comment, setComment] = useState("");
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");
  const [mobileNav, setMobileNav] = useState(false);
  const [online, setOnline] = useState(true);
  const [dark, setDark] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [equipmentQuery, setEquipmentQuery] = useState("");
  const [equipmentType, setEquipmentType] = useState<EquipmentType | "all">("all");
  const [equipmentStatus, setEquipmentStatus] = useState<EquipmentStatus | "all">("all");
  const [equipmentSort, setEquipmentSort] = useState<EquipmentSort>("name");
  const [equipmentModal, setEquipmentModal] = useState<"create" | "edit" | "history" | null>(null);
  const [activeEquipment, setActiveEquipment] = useState<Equipment | null>(null);
  const [equipmentForm, setEquipmentForm] = useState<EquipmentForm>(emptyEquipmentForm);
  const [pendingEquipmentDelete, setPendingEquipmentDelete] = useState<Equipment | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const activateDemo = useCallback((reason: string) => {
    setProfile(christian); setTeam(demoTeam);
    setTickets(safeParse(localStorage.getItem(storageKeys.tickets), demoTickets));
    setComments(safeParse(localStorage.getItem(storageKeys.comments), demoComments));
    setHistory(safeParse(localStorage.getItem(storageKeys.history), demoHistory));
    setEquipment(safeParse(localStorage.getItem(storageKeys.equipment), demoEquipment));
    setEquipmentHistory(safeParse(localStorage.getItem(storageKeys.equipmentHistory), demoEquipmentHistory));
    setMode("demo"); setModeReason(reason); setError("");
  }, []);
  const failToDemo = useCallback((reason: string) => { activateDemo(reason); setToast("Mode démonstration activé automatiquement : vos données restent disponibles localement."); }, [activateDemo]);
  const loadSupabase = useCallback(async () => {
    if (!supabase) { activateDemo("Supabase non configuré · stockage local actif"); return; }
    try {
      const { data, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!data.user) { activateDemo("Aucune session Supabase · mode démonstration automatique"); return; }
      const profileResult = await supabase.from("profiles").select("id,full_name,department,role").eq("id", data.user.id).single();
      const ticketResult = await supabase.from("tickets").select("*,requester:profiles!tickets_requester_id_fkey(full_name),technician:profiles!tickets_assigned_to_fkey(full_name)").order("updated_at", { ascending: false });
      if (profileResult.error || ticketResult.error || !profileResult.data) throw profileResult.error ?? ticketResult.error ?? new Error("Profil introuvable");
      const current = profileResult.data as Profile;
      setProfile(current); setTickets((ticketResult.data ?? []) as unknown as Ticket[]);
      if (current.role !== "requester") { const result = await supabase.from("profiles").select("id,full_name,department,role").order("full_name"); if (result.error) throw result.error; setTeam((result.data ?? []) as Profile[]); }
      setMode("supabase"); setModeReason("Supabase connecté · données partagées et sécurisées");
    } catch { failToDemo("Supabase inaccessible · continuité assurée avec localStorage"); }
  }, [activateDemo, failToDemo, supabase]);

  useEffect(() => { const id = setTimeout(() => activateDemo("Mode autonome · sauvegarde automatique dans ce navigateur"), 0); return () => clearTimeout(id); }, [activateDemo]);
  useEffect(() => { if (mode !== "demo") return; try { localStorage.setItem(storageKeys.tickets, JSON.stringify(tickets)); localStorage.setItem(storageKeys.comments, JSON.stringify(comments)); localStorage.setItem(storageKeys.history, JSON.stringify(history)); localStorage.setItem(storageKeys.equipment, JSON.stringify(equipment)); localStorage.setItem(storageKeys.equipmentHistory, JSON.stringify(equipmentHistory)); } catch { const id = setTimeout(() => setError("Le stockage local est plein. Exportez une sauvegarde puis retirez des pièces jointes volumineuses."), 0); return () => clearTimeout(id); } }, [comments, equipment, equipmentHistory, history, mode, tickets]);
  useEffect(() => { const update = () => setOnline(navigator.onLine); const id = setTimeout(() => { setDark(localStorage.getItem(storageKeys.theme) === "dark"); update(); }, 0); window.addEventListener("online", update); window.addEventListener("offline", update); return () => { clearTimeout(id); window.removeEventListener("online", update); window.removeEventListener("offline", update); }; }, []);
  useEffect(() => { document.documentElement.dataset.theme = dark ? "dark" : "light"; localStorage.setItem(storageKeys.theme, dark ? "dark" : "light"); }, [dark]);
  useEffect(() => { if (!toast) return; const id = setTimeout(() => setToast(""), 4200); return () => clearTimeout(id); }, [toast]);

  const isStaff = mode === "demo" || profile.role !== "requester";
  const periodTickets = useMemo(() => tickets.filter((ticket) => new Date(ticket.created_at).getTime() >= periodStart(period)), [period, tickets]);
  const metrics = useMemo(() => {
    const treated = periodTickets.filter((ticket) => ["resolved", "closed"].includes(ticket.status));
    const durations = treated.filter((ticket) => ticket.closed_at).map((ticket) => (new Date(ticket.closed_at!).getTime() - new Date(ticket.created_at).getTime()) / 3_600_000).filter((hours) => hours >= 0);
    return { total: periodTickets.length, open: periodTickets.filter(isOpen).length, active: periodTickets.filter((ticket) => ticket.status === "in_progress").length, urgent: periodTickets.filter((ticket) => ticket.priority === "urgent" && isOpen(ticket)).length, treated: treated.length, resolutionRate: periodTickets.length ? Math.round(treated.length / periodTickets.length * 100) : 0, averageHours: durations.length ? Math.round(durations.reduce((sum, value) => sum + value, 0) / durations.length) : 0 };
  }, [periodTickets]);
  const notifications = useMemo(() => {
    const overdue = tickets.filter((ticket) => isOpen(ticket) && ticket.due_at && new Date(ticket.due_at).getTime() < baseNow);
    const urgent = tickets.filter((ticket) => isOpen(ticket) && ticket.priority === "urgent");
    const unassigned = tickets.filter((ticket) => isOpen(ticket) && !ticket.assigned_to);
    return [{ label: `${urgent.length} ticket(s) urgent(s)`, tone: "urgent" }, { label: `${overdue.length} échéance(s) dépassée(s)`, tone: "warning" }, { label: `${unassigned.length} ticket(s) non attribué(s)`, tone: "info" }];
  }, [tickets]);
  const filtered = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return tickets.filter((ticket) => (!normalized || [`INC-${ticket.ticket_number}`, ticket.subject, ticket.description, ticket.department ?? "", ticket.requester?.full_name ?? "", ticket.technician?.full_name ?? ""].some((value) => value.toLowerCase().includes(normalized))) && (priority === "all" || ticket.priority === priority) && (status === "all" || ticket.status === status) && (technician === "all" || (technician === "unassigned" ? !ticket.assigned_to : ticket.assigned_to === technician))).sort((a, b) => {
      let value = 0;
      if (sortKey === "ticket_number") value = a.ticket_number - b.ticket_number;
      else if (sortKey === "priority") value = priorityRank[a.priority] - priorityRank[b.priority];
      else if (sortKey === "status") value = statusRank[a.status] - statusRank[b.status];
      else if (sortKey === "subject") value = a.subject.localeCompare(b.subject, "fr");
      else value = new Date(a[sortKey] || 0).getTime() - new Date(b[sortKey] || 0).getTime();
      return sortAsc ? value : -value;
    });
  }, [priority, query, sortAsc, sortKey, status, technician, tickets]);
  const filteredEquipment = useMemo(() => {
    const normalized = equipmentQuery.trim().toLowerCase();
    return equipment.filter((item) => (!normalized || [item.name, item.ip_address, item.operating_system, item.user, item.location, item.serial_number].some((value) => value.toLowerCase().includes(normalized))) && (equipmentType === "all" || item.type === equipmentType) && (equipmentStatus === "all" || item.status === equipmentStatus)).sort((a, b) => a[equipmentSort].localeCompare(b[equipmentSort], "fr"));
  }, [equipment, equipmentQuery, equipmentSort, equipmentStatus, equipmentType]);

  function addHistory(ticketId: string, action: string, changes: Record<string, unknown> = {}) { setHistory((items) => [{ id: Date.now(), ticket_id: ticketId, action, changes, created_at: new Date().toISOString(), actor: { full_name: profile.full_name } }, ...items]); }
  function openCreate() { setActive(null); setForm({ ...emptyForm, department: profile.department ?? "" }); setModal("create"); setError(""); }
  function openEdit(ticket: Ticket) { setActive(ticket); setForm({ subject: ticket.subject, description: ticket.description, department: ticket.department ?? "", priority: ticket.priority, status: ticket.status, assigned_to: ticket.assigned_to ?? "", due_at: ticket.due_at?.slice(0, 16) ?? "", attachments: ticket.attachments ?? [] }); setModal("edit"); setError(""); }
  async function openDetails(ticket: Ticket) {
    setActive(ticket); setModal("details"); setError("");
    if (mode === "demo") return;
    try { const [commentResult, historyResult] = await Promise.all([supabase!.from("comments").select("id,body,created_at,author:profiles!comments_author_id_fkey(full_name)").eq("ticket_id", ticket.id).order("created_at"), supabase!.from("ticket_history").select("id,action,changes,created_at,actor:profiles!ticket_history_actor_id_fkey(full_name)").eq("ticket_id", ticket.id).order("created_at", { ascending: false })]); if (commentResult.error || historyResult.error) throw commentResult.error ?? historyResult.error; setComments((commentResult.data ?? []) as unknown as Comment[]); setHistory((historyResult.data ?? []) as unknown as History[]); } catch { failToDemo("Lecture Supabase impossible · détails disponibles localement"); }
  }
  async function submitTicket(event: FormEvent) {
    event.preventDefault(); setError("");
    const payload = { subject: form.subject.trim(), description: form.description.trim(), department: form.department.trim() || null, priority: form.priority };
    if (!payload.subject || !payload.description) { setError("Le sujet et la description sont obligatoires."); return; }
    const date = new Date().toISOString(); const due = form.due_at ? new Date(form.due_at).toISOString() : null; const member = team.find((item) => item.id === form.assigned_to);
    if (mode === "demo") {
      if (modal === "edit" && active) {
        const changes = { subject: form.subject, priority: form.priority, status: form.status, assigned_to: form.assigned_to || null, due_at: due, attachments: form.attachments.map((item) => item.name) };
        setTickets((items) => items.map((ticket) => ticket.id === active.id ? { ...ticket, ...payload, status: form.status, assigned_to: form.assigned_to || null, technician: member ? { full_name: member.full_name } : null, due_at: due, attachments: form.attachments, updated_at: date } : ticket)); addHistory(active.id, "updated", changes); setToast("Ticket modifié et historique complet mis à jour.");
      } else {
        const number = Math.max(1000, ...tickets.map((ticket) => ticket.ticket_number)) + 1;
        const created: Ticket = { id: crypto.randomUUID(), ticket_number: number, ...payload, status: "new", requester_id: christian.id, assigned_to: form.assigned_to || null, created_at: date, updated_at: date, due_at: due, closed_at: null, attachments: form.attachments, requester: { full_name: christian.full_name }, technician: member ? { full_name: member.full_name } : null };
        setTickets((items) => [created, ...items]); addHistory(created.id, "created", { priority: form.priority, assigned_to: form.assigned_to || null, due_at: due }); setToast(`INC-${number} créé avec succès.`);
      }
      setModal(null); return;
    }
    try { const result = modal === "edit" && active ? await supabase!.from("tickets").update({ ...payload, status: form.status, assigned_to: form.assigned_to || null }).eq("id", active.id) : await supabase!.from("tickets").insert({ ...payload, requester_id: profile.id, assigned_to: form.assigned_to || null }); if (result.error) throw result.error; setToast(modal === "edit" ? "Ticket mis à jour dans Supabase." : "Ticket créé dans Supabase."); setModal(null); await loadSupabase(); } catch { failToDemo("Écriture Supabase impossible · modification disponible en mode local"); }
  }
  function requestState(ticket: Ticket, next: "closed" | "new") { if (next === "closed") setPendingClose(ticket); else void applyState(ticket, next); }
  async function applyState(ticket: Ticket, next: "closed" | "new") {
    setPendingClose(null); const date = new Date().toISOString();
    if (mode === "demo") { setTickets((items) => items.map((item) => item.id === ticket.id ? { ...item, status: next, closed_at: next === "closed" ? date : null, updated_at: date } : item)); addHistory(ticket.id, next === "closed" ? "closed" : "reopened", { from: ticket.status, to: next }); setToast(`INC-${ticket.ticket_number} ${next === "closed" ? "fermé" : "rouvert"}.`); return; }
    try { const { error: updateError } = await supabase!.from("tickets").update({ status: next, closed_at: next === "closed" ? date : null }).eq("id", ticket.id); if (updateError) throw updateError; setToast(`Ticket ${next === "closed" ? "fermé" : "rouvert"}.`); await loadSupabase(); } catch { failToDemo("Mise à jour Supabase impossible · bascule locale activée"); }
  }
  async function addComment(event: FormEvent) {
    event.preventDefault(); if (!active || !comment.trim()) return;
    if (mode === "demo") { const created: Comment = { id: crypto.randomUUID(), ticket_id: active.id, body: comment.trim(), created_at: new Date().toISOString(), author: { full_name: profile.full_name } }; setComments((items) => [created, ...items]); addHistory(active.id, "commented", { preview: comment.trim().slice(0, 80) }); setComment(""); setToast("Commentaire ajouté."); return; }
    try { const { error: commentError } = await supabase!.from("comments").insert({ ticket_id: active.id, author_id: profile.id, body: comment.trim() }); if (commentError) throw commentError; setComment(""); await openDetails(active); setToast("Commentaire ajouté."); } catch { failToDemo("Commentaire Supabase impossible · bascule locale activée"); }
  }
  async function addAttachments(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []); if (!files.length) return;
    if (files.some((file) => file.size > 1_000_000) || form.attachments.length + files.length > 3) { setError("Maximum 3 fichiers de 1 Mo par ticket dans la démonstration."); event.target.value = ""; return; }
    try { const added = await Promise.all(files.map(fileToAttachment)); setForm((current) => ({ ...current, attachments: [...current.attachments, ...added] })); setToast(`${added.length} pièce(s) jointe(s) ajoutée(s).`); } catch { setError("Une pièce jointe n’a pas pu être lue."); } event.target.value = "";
  }
  function addEquipmentHistory(equipmentId: string, action: EquipmentHistory["action"], changes: Record<string, unknown>) { setEquipmentHistory((items) => [{ id: Date.now(), equipment_id: equipmentId, action, changes, created_at: new Date().toISOString(), actor: christian.full_name }, ...items]); }
  function openEquipmentCreate() { setActiveEquipment(null); setEquipmentForm(emptyEquipmentForm); setEquipmentModal("create"); setError(""); }
  function openEquipmentEdit(item: Equipment) { setActiveEquipment(item); setEquipmentForm({ name: item.name, type: item.type, ip_address: item.ip_address, operating_system: item.operating_system, user: item.user, location: item.location, status: item.status, serial_number: item.serial_number, purchase_date: item.purchase_date, warranty_end: item.warranty_end, ticket_ids: item.ticket_ids }); setEquipmentModal("edit"); setError(""); }
  function submitEquipment(event: FormEvent) {
    event.preventDefault(); setError("");
    if (!equipmentForm.name.trim() || !equipmentForm.serial_number.trim()) { setError("Le nom et le numéro de série sont obligatoires."); return; }
    const date = new Date().toISOString();
    if (equipmentModal === "edit" && activeEquipment) { const changes = { name: equipmentForm.name, status: equipmentForm.status, user: equipmentForm.user, ip_address: equipmentForm.ip_address, warranty_end: equipmentForm.warranty_end, ticket_ids: equipmentForm.ticket_ids }; setEquipment((items) => items.map((item) => item.id === activeEquipment.id ? { ...item, ...equipmentForm, name: equipmentForm.name.trim(), serial_number: equipmentForm.serial_number.trim(), updated_at: date } : item)); addEquipmentHistory(activeEquipment.id, "updated", changes); setToast(`${equipmentForm.name} a été mis à jour.`); }
    else { const created: Equipment = { id: crypto.randomUUID(), ...equipmentForm, name: equipmentForm.name.trim(), serial_number: equipmentForm.serial_number.trim(), created_at: date, updated_at: date }; setEquipment((items) => [created, ...items]); addEquipmentHistory(created.id, "created", { type: created.type, status: created.status, user: created.user }); setToast(`${created.name} a été ajouté au parc.`); }
    setEquipmentModal(null);
  }
  function deleteEquipment(item: Equipment) { setEquipment((items) => items.filter((equipmentItem) => equipmentItem.id !== item.id)); addEquipmentHistory(item.id, "deleted", { name: item.name, serial_number: item.serial_number, status: item.status }); setPendingEquipmentDelete(null); setToast(`${item.name} a été supprimé du parc.`); }
  function exportEquipmentJson() { download("helpdesk-novatech-parc.json", JSON.stringify({ exported_at: new Date().toISOString(), equipment, history: equipmentHistory }, null, 2), "application/json"); }
  function exportEquipmentCsv() { const rows = [["Nom", "Type", "Adresse IP", "Système", "Utilisateur", "Emplacement", "État", "Numéro de série", "Date d’achat", "Fin de garantie", "Tickets liés"], ...filteredEquipment.map((item) => [item.name, equipmentTypeLabels[item.type], item.ip_address, item.operating_system, item.user, item.location, equipmentStatusLabels[item.status], item.serial_number, item.purchase_date, item.warranty_end, item.ticket_ids.map((id) => tickets.find((ticket) => ticket.id === id)?.ticket_number ? `INC-${tickets.find((ticket) => ticket.id === id)!.ticket_number}` : id).join(", ")])]; download("helpdesk-novatech-parc.csv", `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\n")}`, "text/csv;charset=utf-8"); }
  function exportJson() { const backup: Backup = { version: 3, exported_at: new Date().toISOString(), tickets, comments, history, equipment, equipment_history: equipmentHistory }; download("helpdesk-novatech-v2-backup.json", JSON.stringify(backup, null, 2), "application/json"); }
  function exportCsv() { const rows = [["Ticket", "Sujet", "Demandeur", "Service", "Priorité", "Statut", "Technicien", "Création", "Échéance", "Clôture"], ...filtered.map((ticket) => [`INC-${ticket.ticket_number}`, ticket.subject, ticket.requester?.full_name ?? "", ticket.department ?? "", priorityLabels[ticket.priority], statusLabels[ticket.status], ticket.technician?.full_name ?? "", ticket.created_at, ticket.due_at ?? "", ticket.closed_at ?? ""] )]; download("helpdesk-novatech-v2-tickets.csv", `\uFEFF${rows.map((row) => row.map(csvCell).join(";")).join("\n")}`, "text/csv;charset=utf-8"); }
  async function importBackup(event: ChangeEvent<HTMLInputElement>) { const file = event.target.files?.[0]; if (!file) return; try { const backup = JSON.parse(await file.text()) as Partial<Backup>; if (![1, 2, 3].includes(Number(backup.version)) || !Array.isArray(backup.tickets)) throw new Error("Format invalide"); setTickets(backup.tickets); setComments(Array.isArray(backup.comments) ? backup.comments : []); setHistory(Array.isArray(backup.history) ? backup.history : []); setEquipment(Array.isArray(backup.equipment) ? backup.equipment : demoEquipment); setEquipmentHistory(Array.isArray(backup.equipment_history) ? backup.equipment_history : demoEquipmentHistory); setMode("demo"); setModeReason("Sauvegarde importée · stockage local actif"); setToast("Sauvegarde complète importée avec succès."); } catch { setError("Sauvegarde invalide ou illisible."); } event.target.value = ""; }
  function resetDemo() { localStorage.removeItem(storageKeys.tickets); localStorage.removeItem(storageKeys.comments); localStorage.removeItem(storageKeys.history); localStorage.removeItem(storageKeys.equipment); localStorage.removeItem(storageKeys.equipmentHistory); setTickets(demoTickets); setComments(demoComments); setHistory(demoHistory); setEquipment(demoEquipment); setEquipmentHistory(demoEquipmentHistory); setToast("Démonstration 2.1 restaurée."); }

  if (mode === "loading") return <main className="loading-screen" aria-live="polite"><span className="brand-mark">N</span><p>Préparation de HelpDesk NovaTech 2.1…</p></main>;
  const titles: Record<View, string> = { dashboard: `Bonjour ${profile.full_name.split(" ")[0]}`, tickets: "Gestion des tickets", inventory: "Parc informatique", reports: "Rapports et indicateurs", team: "Équipe support", skills: "Compétences BTS SIO SISR", about: "Présentation du projet", settings: "Paramètres et sauvegardes" };
  return <div className="app-shell">
    <a className="skip-link" href="#contenu">Aller au contenu</a>
    <button className="mobile-menu" aria-label="Ouvrir le menu" onClick={() => setMobileNav(true)}><Menu /></button>
    <aside className={`sidebar ${mobileNav ? "is-open" : ""}`} aria-label="Navigation latérale">
      <button className="close-mobile" aria-label="Fermer le menu" onClick={() => setMobileNav(false)}><X /></button>
      <div className="brand"><span className="brand-mark">N</span><div><strong>HelpDesk</strong><span>NovaTech 2.1</span></div></div>
      <div className={`mode-chip ${mode}`}><span>{mode === "supabase" ? <Database /> : <WifiOff />}</span><div><strong>{mode === "supabase" ? "Mode Supabase optionnel" : "Mode démonstration autonome"}</strong><small>{mode === "supabase" ? "Données partagées" : "localStorage principal"}</small></div></div>
      <nav aria-label="Navigation principale">
        <Nav active={view === "dashboard"} icon={<LayoutDashboard />} label="Tableau de bord" onClick={() => setView("dashboard")} />
        <Nav active={view === "tickets"} icon={<Tickets />} label="Tickets" badge={metrics.open} onClick={() => setView("tickets")} />
        <Nav active={view === "inventory"} icon={<HardDrive />} label="Parc informatique" badge={equipment.filter((item) => item.status === "broken").length} onClick={() => setView("inventory")} />
        <Nav active={view === "reports"} icon={<BarChart3 />} label="Rapports" onClick={() => setView("reports")} />
        {isStaff && <Nav active={view === "team"} icon={<Users />} label="Équipe" onClick={() => setView("team")} />}
        <Nav active={view === "skills"} icon={<GraduationCap />} label="Compétences BTS" onClick={() => setView("skills")} />
        <Nav active={view === "about"} icon={<Info />} label="À propos du projet" onClick={() => setView("about")} />
        <Nav active={view === "settings"} icon={<Settings />} label="Paramètres" onClick={() => setView("settings")} />
      </nav>
      <div className="profile-card"><div className="avatar">{initials(profile.full_name)}</div><div><strong>{profile.full_name}</strong><span>{roleLabels[profile.role]}</span></div><button onClick={() => setDark(!dark)} aria-label={dark ? "Activer le mode clair" : "Activer le mode sombre"}>{dark ? <Sun /> : <Moon />}</button></div>
    </aside>
    {mobileNav && <button className="backdrop" aria-label="Fermer le menu" onClick={() => setMobileNav(false)} />}
    <main className="main-content" id="contenu">
      <header className="topbar"><div><p className="eyebrow">Centre de services IT · Version 2.1</p><h1>{titles[view]}</h1><p className="date">Indicateurs calculés à partir des données affichées</p></div><div className="top-actions"><div className="notification-wrap"><button className="icon-button" aria-label="Afficher les notifications" aria-expanded={notificationsOpen} onClick={() => setNotificationsOpen(!notificationsOpen)}><Bell /><span>{notifications.reduce((sum, item) => sum + (Number.parseInt(item.label) || 0), 0)}</span></button>{notificationsOpen && <div className="notification-panel" role="status"><strong>Notifications</strong>{notifications.map((item) => <p key={item.label} className={item.tone}>{item.label}</p>)}</div>}</div><button className="primary-button" onClick={openCreate}><Plus />Nouveau ticket</button><div className="top-avatar" aria-label={`Profil ${profile.full_name}`}>{initials(profile.full_name)}</div></div></header>
      {!online && <div className="offline-banner" role="alert"><WifiOff />Vous êtes hors ligne. Les changements sont enregistrés dans ce navigateur et pourront être exportés.</div>}
      <div className={`mode-banner ${mode}`} role="status"><span>{mode === "supabase" ? <Wifi /> : <WifiOff />}</span><p><strong>{mode === "supabase" ? "Supabase optionnel actif" : "Mode démonstration autonome"}</strong>{modeReason}</p></div>
      {error && <div className="form-alert error" role="alert">{error}<button aria-label="Fermer le message" onClick={() => setError("")}><X /></button></div>}
      {(view === "dashboard" || view === "reports") && <PeriodFilter period={period} setPeriod={setPeriod} />}
      {view === "dashboard" && <Dashboard tickets={periodTickets} metrics={metrics} team={team} showTickets={() => setView("tickets")} onOpen={openDetails} />}
      {view === "tickets" && <TicketsView tickets={filtered} total={tickets.length} query={query} setQuery={setQuery} priority={priority} setPriority={setPriority} status={status} setStatus={setStatus} technician={technician} setTechnician={setTechnician} team={team} sortKey={sortKey} setSortKey={setSortKey} sortAsc={sortAsc} setSortAsc={setSortAsc} onOpen={openDetails} onEdit={isStaff ? openEdit : undefined} onState={isStaff ? requestState : undefined} onCreate={openCreate} />}
      {view === "inventory" && <InventoryView equipment={filteredEquipment} allEquipment={equipment} tickets={tickets} query={equipmentQuery} setQuery={setEquipmentQuery} type={equipmentType} setType={setEquipmentType} status={equipmentStatus} setStatus={setEquipmentStatus} sort={equipmentSort} setSort={setEquipmentSort} onCreate={openEquipmentCreate} onEdit={openEquipmentEdit} onDelete={setPendingEquipmentDelete} onHistory={(item) => { setActiveEquipment(item); setEquipmentModal("history"); }} onTicket={openDetails} onExportCsv={exportEquipmentCsv} onExportJson={exportEquipmentJson} />}
      {view === "reports" && <Reports tickets={periodTickets} metrics={metrics} team={team} onOpen={openDetails} />}
      {view === "team" && isStaff && <Team members={team} tickets={tickets} />}
      {view === "skills" && <Skills />}
      {view === "about" && <ProjectPresentation onNavigate={setView} />}
      {view === "settings" && <SettingsView mode={mode} reason={modeReason} dark={dark} supabaseAvailable={Boolean(supabase)} onSupabase={() => { setMode("loading"); void loadSupabase(); }} onTheme={() => setDark(!dark)} onJson={exportJson} onCsv={exportCsv} onImport={() => importRef.current?.click()} onReset={resetDemo} />}
    </main>
    <input ref={importRef} className="sr-only" type="file" accept="application/json,.json" onChange={importBackup} />
    {(modal === "create" || modal === "edit") && <TicketModal mode={modal} form={form} setForm={setForm} team={team.filter((member) => member.role !== "requester")} staff={isStaff} error={error} onAttachments={addAttachments} onSubmit={submitTicket} onClose={() => setModal(null)} />}
    {(equipmentModal === "create" || equipmentModal === "edit") && <EquipmentModal mode={equipmentModal} form={equipmentForm} setForm={setEquipmentForm} tickets={tickets} error={error} onSubmit={submitEquipment} onClose={() => setEquipmentModal(null)} />}
    {equipmentModal === "history" && activeEquipment && <EquipmentHistoryModal equipment={activeEquipment} history={equipmentHistory.filter((item) => item.equipment_id === activeEquipment.id)} onClose={() => setEquipmentModal(null)} />}
    {modal === "details" && active && <DetailsModal ticket={tickets.find((ticket) => ticket.id === active.id) ?? active} comments={comments.filter((item) => item.ticket_id === active.id)} history={history.filter((item) => item.ticket_id === active.id)} comment={comment} setComment={setComment} onComment={addComment} onClose={() => setModal(null)} />}
    {pendingClose && <ConfirmDialog ticket={pendingClose} onConfirm={() => void applyState(pendingClose, "closed")} onCancel={() => setPendingClose(null)} />}
    {pendingEquipmentDelete && <EquipmentDeleteDialog equipment={pendingEquipmentDelete} onConfirm={() => deleteEquipment(pendingEquipmentDelete)} onCancel={() => setPendingEquipmentDelete(null)} />}
    {toast && <div className="toast" role="status" aria-live="polite"><CheckCircle2 />{toast}</div>}
  </div>;
}

function Nav({ active, icon, label, badge, onClick }: { active: boolean; icon: ReactNode; label: string; badge?: number; onClick: () => void }) { return <button className={`nav-item ${active ? "active" : ""}`} aria-current={active ? "page" : undefined} onClick={onClick}>{icon}<span>{label}</span>{badge !== undefined && <em>{badge}</em>}</button>; }
function PanelTitle({ kicker, title, action }: { kicker: string; title: string; action?: () => void }) { return <div className="panel-heading"><div><p className="section-kicker">{kicker}</p><h2>{title}</h2></div>{action && <button className="text-button" onClick={action}>Voir tous <ChevronRight /></button>}</div>; }
function PeriodFilter({ period, setPeriod }: { period: Period; setPeriod: (period: Period) => void }) { return <div className="period-filter" aria-label="Filtrer les indicateurs par période"><CalendarDays />{(Object.keys(periodLabels) as Period[]).map((item) => <button key={item} className={period === item ? "active" : ""} onClick={() => setPeriod(item)}>{periodLabels[item]}</button>)}</div>; }

function Dashboard({ tickets, metrics, team, showTickets, onOpen }: { tickets: Ticket[]; metrics: { total: number; open: number; active: number; urgent: number; treated: number; resolutionRate: number; averageHours: number }; team: Profile[]; showTickets: () => void; onOpen: (ticket: Ticket) => void }) {
  const cards = [{ label: "Tickets ouverts", value: metrics.open, detail: `${metrics.total} sur la période`, icon: <Tickets />, tone: "cyan" }, { label: "Résolution moyenne", value: `${metrics.averageHours} h`, detail: "création à clôture", icon: <Clock3 />, tone: "amber" }, { label: "Taux résolu", value: `${metrics.resolutionRate}%`, detail: `${metrics.treated} traités`, icon: <CheckCircle2 />, tone: "green" }, { label: "Tickets urgents", value: metrics.urgent, detail: "à prioriser", icon: <AlertTriangle />, tone: "red" }];
  const oldest = [...tickets].filter(isOpen).sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at)).slice(0, 5);
  return <><section className="kpi-grid" aria-label="Statistiques réelles">{cards.map((card) => <button key={card.label} className="kpi-card" onClick={showTickets}><span className={`kpi-icon ${card.tone}`}>{card.icon}</span><span><small>{card.label}</small><strong>{card.value}</strong><em>{card.detail}</em></span><ChevronRight className="kpi-arrow" /></button>)}</section><section className="dashboard-grid"><article className="panel"><PanelTitle kicker="Priorisation" title="Tickets ouverts les plus anciens" action={showTickets} />{oldest.length ? <TicketTable tickets={oldest} onOpen={onOpen} compact /> : <EmptyState onCreate={showTickets} />}</article><article className="panel chart-card"><PanelTitle kicker="Charge actuelle" title="Répartition par technicien" /><TechnicianChart tickets={tickets} team={team} /></article></section></>;
}

function Reports({ tickets, metrics, team, onOpen }: { tickets: Ticket[]; metrics: { total: number; open: number; urgent: number; resolutionRate: number; averageHours: number }; team: Profile[]; onOpen: (ticket: Ticket) => void }) {
  const prioritiesData = priorities.map((item) => ({ label: priorityLabels[item], value: tickets.filter((ticket) => ticket.priority === item).length, className: item }));
  const oldest = [...tickets].filter(isOpen).sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at)).slice(0, 8);
  return <section className="reports-grid"><article className="panel report-summary"><PanelTitle kicker="Indicateurs calculés" title="Performance du support" /><div className="report-numbers"><div><span>Ouverts</span><strong>{metrics.open}</strong></div><div><span>Résolution moyenne</span><strong>{metrics.averageHours} h</strong></div><div><span>Taux résolu</span><strong>{metrics.resolutionRate}%</strong></div><div><span>Urgents</span><strong>{metrics.urgent}</strong></div></div></article><article className="panel chart-card"><PanelTitle kicker="Volume" title="Répartition par priorité" /><BarChart data={prioritiesData} /></article><article className="panel chart-card"><PanelTitle kicker="Ressources" title="Répartition par technicien" /><TechnicianChart tickets={tickets} team={team} /></article><article className="panel oldest-report"><PanelTitle kicker="Ancienneté" title="Tickets les plus anciens" />{oldest.length ? <TicketTable tickets={oldest} onOpen={onOpen} compact /> : <p className="empty-inline">Aucun ticket ouvert sur cette période.</p>}</article></section>;
}

function BarChart({ data }: { data: { label: string; value: number; className?: string }[] }) { const max = Math.max(1, ...data.map((item) => item.value)); return <div className="bar-chart" role="img" aria-label={data.map((item) => `${item.label}: ${item.value}`).join(", ")}>{data.map((item) => <div className="bar-row" key={item.label}><span>{item.label}</span><div><i className={item.className} style={{ width: `${Math.max(4, item.value / max * 100)}%` }} /></div><strong>{item.value}</strong></div>)}</div>; }
function TechnicianChart({ tickets, team }: { tickets: Ticket[]; team: Profile[] }) { const data = [...team.map((member) => ({ label: member.full_name, value: tickets.filter((ticket) => ticket.assigned_to === member.id && isOpen(ticket)).length })), { label: "Non attribués", value: tickets.filter((ticket) => !ticket.assigned_to && isOpen(ticket)).length }]; return <BarChart data={data} />; }

function TicketsView({ tickets, total, query, setQuery, priority, setPriority, status, setStatus, technician, setTechnician, team, sortKey, setSortKey, sortAsc, setSortAsc, onOpen, onEdit, onState, onCreate }: { tickets: Ticket[]; total: number; query: string; setQuery: (value: string) => void; priority: Priority | "all"; setPriority: (value: Priority | "all") => void; status: Status | "all"; setStatus: (value: Status | "all") => void; technician: string; setTechnician: (value: string) => void; team: Profile[]; sortKey: SortKey; setSortKey: (value: SortKey) => void; sortAsc: boolean; setSortAsc: (value: boolean) => void; onOpen: (ticket: Ticket) => void; onEdit?: (ticket: Ticket) => void; onState?: (ticket: Ticket, next: "closed" | "new") => void; onCreate: () => void }) {
  return <section><div className="summary-strip"><div><span>Total</span><strong>{total}</strong></div><div><span>Affichés</span><strong>{tickets.length}</strong></div><div><span>Ouverts</span><strong>{tickets.filter(isOpen).length}</strong></div><div><span>Fermés</span><strong>{tickets.filter((ticket) => ticket.status === "closed").length}</strong></div></div><article className="panel all-tickets"><div className="panel-heading ticket-tools"><div><p className="section-kicker">Recherche et filtres avancés</p><h2>Tous les tickets</h2></div><button className="primary-button" onClick={onCreate}><Plus />Créer</button></div><div className="filters" aria-label="Filtres des tickets"><label className="search-field"><Search /><span className="sr-only">Rechercher</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="ID, sujet, demandeur, technicien…" /></label><label><Filter /><select aria-label="Filtrer par priorité" value={priority} onChange={(event) => setPriority(event.target.value as Priority | "all")}><option value="all">Toutes priorités</option>{priorities.map((item) => <option value={item} key={item}>{priorityLabels[item]}</option>)}</select></label><label><CircleDot /><select aria-label="Filtrer par statut" value={status} onChange={(event) => setStatus(event.target.value as Status | "all")}><option value="all">Tous statuts</option>{statuses.map((item) => <option value={item} key={item}>{statusLabels[item]}</option>)}</select></label><label><Users /><select aria-label="Filtrer par technicien" value={technician} onChange={(event) => setTechnician(event.target.value)}><option value="all">Tous techniciens</option><option value="unassigned">Non attribués</option>{team.map((member) => <option value={member.id} key={member.id}>{member.full_name}</option>)}</select></label><label><ArrowDownAZ /><select aria-label="Trier les tickets" value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}><option value="updated_at">Dernière modification</option><option value="created_at">Date de création</option><option value="due_at">Date limite</option><option value="ticket_number">Numéro</option><option value="priority">Priorité</option><option value="status">Statut</option><option value="subject">Sujet</option></select></label><button className="sort-button" onClick={() => setSortAsc(!sortAsc)} aria-label={sortAsc ? "Tri croissant" : "Tri décroissant"}>{sortAsc ? <ArrowUpAZ /> : <ArrowDownAZ />}</button></div>{tickets.length ? <TicketTable tickets={tickets} onOpen={onOpen} onEdit={onEdit} onState={onState} /> : <EmptyState onCreate={onCreate} />}</article></section>;
}

function TicketTable({ tickets, onOpen, onEdit, onState, compact = false }: { tickets: Ticket[]; onOpen: (ticket: Ticket) => void; onEdit?: (ticket: Ticket) => void; onState?: (ticket: Ticket, next: "closed" | "new") => void; compact?: boolean }) { return <div className="table-wrap"><table><thead><tr><th>Ticket</th><th>Sujet</th><th>Priorité</th><th>Statut</th><th>Technicien</th><th>Création</th>{!compact && <th>Date limite</th>}<th>Actions</th></tr></thead><tbody>{tickets.map((ticket) => { const overdue = isOpen(ticket) && ticket.due_at && new Date(ticket.due_at).getTime() < baseNow; return <tr key={ticket.id}><td><button className="ticket-id" onClick={() => onOpen(ticket)}>INC-{ticket.ticket_number}</button></td><td><button className="subject-cell" onClick={() => onOpen(ticket)}><strong>{ticket.subject}</strong><span>{ticket.requester?.full_name ?? "Demandeur"} · {ticket.department || "Sans service"}{ticket.attachments?.length ? ` · ${ticket.attachments.length} fichier(s)` : ""}</span></button></td><td><Badge kind="priority" value={priorityLabels[ticket.priority]} /></td><td><Badge kind="status" value={statusLabels[ticket.status]} /></td><td>{ticket.technician?.full_name ?? "Non attribué"}</td><td>{formatDate(ticket.created_at)}</td>{!compact && <td className={overdue ? "overdue" : ""}>{formatDate(ticket.due_at)}</td>}<td><div className="row-actions"><button onClick={() => onOpen(ticket)} aria-label={`Commentaires et historique de INC-${ticket.ticket_number}`}><MessageSquare /></button>{onEdit && <button onClick={() => onEdit(ticket)} aria-label={`Modifier INC-${ticket.ticket_number}`}><Edit3 /></button>}{onState && <button onClick={() => onState(ticket, ticket.status === "closed" ? "new" : "closed")} aria-label={`${ticket.status === "closed" ? "Rouvrir" : "Fermer"} INC-${ticket.ticket_number}`}>{ticket.status === "closed" ? <ArchiveRestore /> : <TicketCheck />}</button>}</div></td></tr>; })}</tbody></table></div>; }
function Badge({ kind, value }: { kind: "priority" | "status"; value: string }) { return <span className={`badge ${kind}-${value.toLowerCase().replaceAll(" ", "-").normalize("NFD").replace(/[\u0300-\u036f]/g, "")}`}>{value}</span>; }
function EmptyState({ onCreate }: { onCreate: () => void }) { return <div className="empty-state"><Search /><h3>Aucun ticket trouvé</h3><p>Modifiez les filtres ou créez une nouvelle demande.</p><button className="primary-button" onClick={onCreate}><Plus />Nouveau ticket</button></div>; }

function EquipmentIcon({ type }: { type: EquipmentType }) { return type === "server" ? <Server /> : type === "printer" ? <Printer /> : type === "network" ? <HardDrive /> : <Monitor />; }
function InventoryView({ equipment, allEquipment, tickets, query, setQuery, type, setType, status, setStatus, sort, setSort, onCreate, onEdit, onDelete, onHistory, onTicket, onExportCsv, onExportJson }: { equipment: Equipment[]; allEquipment: Equipment[]; tickets: Ticket[]; query: string; setQuery: (value: string) => void; type: EquipmentType | "all"; setType: (value: EquipmentType | "all") => void; status: EquipmentStatus | "all"; setStatus: (value: EquipmentStatus | "all") => void; sort: EquipmentSort; setSort: (value: EquipmentSort) => void; onCreate: () => void; onEdit: (item: Equipment) => void; onDelete: (item: Equipment) => void; onHistory: (item: Equipment) => void; onTicket: (ticket: Ticket) => void; onExportCsv: () => void; onExportJson: () => void }) {
  const stats = [
    { label: "Disponibles", value: allEquipment.filter((item) => item.status === "available").length, tone: "green", icon: <CheckCircle2 /> },
    { label: "Attribués", value: allEquipment.filter((item) => item.status === "assigned").length, tone: "cyan", icon: <Users /> },
    { label: "En panne", value: allEquipment.filter((item) => item.status === "broken").length, tone: "red", icon: <AlertTriangle /> },
    { label: "Hors garantie", value: allEquipment.filter((item) => item.warranty_end && new Date(item.warranty_end).getTime() < baseNow).length, tone: "amber", icon: <CalendarDays /> },
  ];
  return <section className="inventory-page"><div className="kpi-grid inventory-stats" aria-label="Statistiques du parc">{stats.map((card) => <article className="kpi-card static" key={card.label}><span className={`kpi-icon ${card.tone}`}>{card.icon}</span><span><small>{card.label}</small><strong>{card.value}</strong><em>sur {allEquipment.length} équipements</em></span></article>)}</div><article className="panel inventory-panel"><div className="panel-heading inventory-heading"><div><p className="section-kicker">Patrimoine informatique</p><h2>Inventaire des équipements</h2><p>{equipment.length} résultat(s) · données sauvegardées automatiquement</p></div><div className="inventory-actions"><button className="secondary-button" onClick={onExportCsv}><Download />CSV</button><button className="secondary-button" onClick={onExportJson}><FileJson />JSON</button><button className="primary-button" onClick={onCreate}><Plus />Ajouter</button></div></div><div className="filters inventory-filters" aria-label="Filtres du parc"><label className="search-field"><Search /><span className="sr-only">Rechercher un équipement</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nom, IP, système, utilisateur, série…" /></label><label><Monitor /><select aria-label="Filtrer par type" value={type} onChange={(event) => setType(event.target.value as EquipmentType | "all")}><option value="all">Tous les types</option>{(Object.keys(equipmentTypeLabels) as EquipmentType[]).map((item) => <option value={item} key={item}>{equipmentTypeLabels[item]}</option>)}</select></label><label><CircleDot /><select aria-label="Filtrer par état" value={status} onChange={(event) => setStatus(event.target.value as EquipmentStatus | "all")}><option value="all">Tous les états</option>{(Object.keys(equipmentStatusLabels) as EquipmentStatus[]).map((item) => <option value={item} key={item}>{equipmentStatusLabels[item]}</option>)}</select></label><label><ArrowDownAZ /><select aria-label="Trier les équipements" value={sort} onChange={(event) => setSort(event.target.value as EquipmentSort)}><option value="name">Nom</option><option value="type">Type</option><option value="status">État</option><option value="user">Utilisateur</option><option value="warranty_end">Fin de garantie</option></select></label></div>{equipment.length ? <EquipmentTable equipment={equipment} tickets={tickets} onEdit={onEdit} onDelete={onDelete} onHistory={onHistory} onTicket={onTicket} /> : <div className="empty-state"><HardDrive /><h3>Aucun équipement trouvé</h3><p>Modifiez les filtres ou ajoutez un équipement au parc.</p><button className="primary-button" onClick={onCreate}><Plus />Ajouter un équipement</button></div>}</article></section>;
}
function EquipmentTable({ equipment, tickets, onEdit, onDelete, onHistory, onTicket }: { equipment: Equipment[]; tickets: Ticket[]; onEdit: (item: Equipment) => void; onDelete: (item: Equipment) => void; onHistory: (item: Equipment) => void; onTicket: (ticket: Ticket) => void }) { return <div className="table-wrap equipment-table"><table><thead><tr><th>Équipement</th><th>Réseau / système</th><th>Attribution</th><th>État</th><th>Série / garantie</th><th>Tickets liés</th><th>Actions</th></tr></thead><tbody>{equipment.map((item) => { const warrantyExpired = Boolean(item.warranty_end && new Date(item.warranty_end).getTime() < baseNow); return <tr key={item.id}><td><div className="equipment-name"><span><EquipmentIcon type={item.type} /></span><div><strong>{item.name}</strong><small>{equipmentTypeLabels[item.type]} · {item.location || "Emplacement non défini"}</small></div></div></td><td><strong>{item.ip_address || "Sans adresse IP"}</strong><small className="table-subline">{item.operating_system || "Système non renseigné"}</small></td><td>{item.user || "Non attribué"}</td><td><span className={`equipment-status ${item.status}`}><i />{equipmentStatusLabels[item.status]}</span></td><td><strong>{item.serial_number}</strong><small className={`table-subline ${warrantyExpired ? "warranty-expired" : ""}`}>{warrantyExpired ? "Garantie expirée" : "Garantie"} · {item.warranty_end || "Non définie"}</small></td><td><div className="ticket-links">{item.ticket_ids.length ? item.ticket_ids.map((id) => { const ticket = tickets.find((candidate) => candidate.id === id); return ticket ? <button key={id} onClick={() => onTicket(ticket)}><Link2 />INC-{ticket.ticket_number}</button> : null; }) : <span>Aucun</span>}</div></td><td><div className="row-actions"><button onClick={() => onHistory(item)} aria-label={`Historique de ${item.name}`}><Clock3 /></button><button onClick={() => onEdit(item)} aria-label={`Modifier ${item.name}`}><Edit3 /></button><button className="danger-icon" onClick={() => onDelete(item)} aria-label={`Supprimer ${item.name}`}><Trash2 /></button></div></td></tr>; })}</tbody></table></div>; }

function EquipmentModal({ mode, form, setForm, tickets, error, onSubmit, onClose }: { mode: "create" | "edit"; form: EquipmentForm; setForm: React.Dispatch<React.SetStateAction<EquipmentForm>>; tickets: Ticket[]; error: string; onSubmit: (event: FormEvent) => void; onClose: () => void }) { return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal equipment-modal" role="dialog" aria-modal="true" aria-labelledby="equipment-modal-title"><div className="modal-header"><div><p className="section-kicker">Gestion du parc</p><h2 id="equipment-modal-title">{mode === "create" ? "Ajouter un équipement" : `Modifier ${form.name}`}</h2></div><button onClick={onClose} aria-label="Fermer"><X /></button></div>{error && <div className="form-alert error">{error}</div>}<form onSubmit={onSubmit} className="ticket-form equipment-form"><label>Nom<input autoFocus required maxLength={80} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder="PC-FIN-01" /></label><label>Type<select value={form.type} onChange={(event) => setForm({ ...form, type: event.target.value as EquipmentType })}>{(Object.keys(equipmentTypeLabels) as EquipmentType[]).map((item) => <option value={item} key={item}>{equipmentTypeLabels[item]}</option>)}</select></label><label>Adresse IP<input value={form.ip_address} onChange={(event) => setForm({ ...form, ip_address: event.target.value })} placeholder="192.168.1.10" /></label><label>Système<input value={form.operating_system} onChange={(event) => setForm({ ...form, operating_system: event.target.value })} placeholder="Windows 11 Pro" /></label><label>Utilisateur<input value={form.user} onChange={(event) => setForm({ ...form, user: event.target.value })} placeholder="Nom ou service" /></label><label>Emplacement<input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Bureau 204" /></label><label>État<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as EquipmentStatus })}>{(Object.keys(equipmentStatusLabels) as EquipmentStatus[]).map((item) => <option value={item} key={item}>{equipmentStatusLabels[item]}</option>)}</select></label><label>Numéro de série<input required maxLength={100} value={form.serial_number} onChange={(event) => setForm({ ...form, serial_number: event.target.value })} /></label><label>Date d’achat<input type="date" value={form.purchase_date} onChange={(event) => setForm({ ...form, purchase_date: event.target.value })} /></label><label>Fin de garantie<input type="date" value={form.warranty_end} onChange={(event) => setForm({ ...form, warranty_end: event.target.value })} /></label><fieldset className="span-2 ticket-selector"><legend>Tickets liés</legend><div>{tickets.map((ticket) => <label key={ticket.id}><input type="checkbox" checked={form.ticket_ids.includes(ticket.id)} onChange={(event) => setForm({ ...form, ticket_ids: event.target.checked ? [...form.ticket_ids, ticket.id] : form.ticket_ids.filter((id) => id !== ticket.id) })} /><span>INC-{ticket.ticket_number} · {ticket.subject}</span></label>)}</div></fieldset><div className="form-actions span-2"><button type="button" className="secondary-button" onClick={onClose}>Annuler</button><button className="primary-button" type="submit"><CheckCircle2 />{mode === "create" ? "Ajouter au parc" : "Enregistrer"}</button></div></form></section></div>; }
function EquipmentHistoryModal({ equipment, history, onClose }: { equipment: Equipment; history: EquipmentHistory[]; onClose: () => void }) { return <div className="modal-backdrop"><section className="modal history-modal" role="dialog" aria-modal="true" aria-labelledby="equipment-history-title"><div className="modal-header"><div><p className="section-kicker">Traçabilité du parc</p><h2 id="equipment-history-title">Historique de {equipment.name}</h2></div><button onClick={onClose} aria-label="Fermer"><X /></button></div><div className="timeline equipment-history">{history.length ? [...history].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at)).map((item) => <article key={item.id}><strong>{item.action === "created" ? "Équipement créé" : item.action === "updated" ? "Équipement modifié" : "Équipement supprimé"}</strong><time>{formatDate(item.created_at)}</time><p>{item.actor} · {Object.entries(item.changes).map(([key, value]) => `${key}: ${Array.isArray(value) ? value.join(", ") : String(value || "—")}`).join(" · ")}</p></article>) : <p className="muted">Aucune modification enregistrée.</p>}</div></section></div>; }
function EquipmentDeleteDialog({ equipment, onConfirm, onCancel }: { equipment: Equipment; onConfirm: () => void; onCancel: () => void }) { return <div className="modal-backdrop"><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="equipment-delete-title"><span><AlertTriangle /></span><h2 id="equipment-delete-title">Supprimer l’équipement ?</h2><p>{equipment.name} sera retiré du parc. Cette action sera conservée dans l’historique local.</p><div><button className="secondary-button" onClick={onCancel}>Annuler</button><button className="danger-button" onClick={onConfirm}><Trash2 />Supprimer</button></div></section></div>; }

function TicketModal({ mode, form, setForm, team, staff, error, onAttachments, onSubmit, onClose }: { mode: "create" | "edit"; form: TicketForm; setForm: React.Dispatch<React.SetStateAction<TicketForm>>; team: Profile[]; staff: boolean; error: string; onAttachments: (event: ChangeEvent<HTMLInputElement>) => void; onSubmit: (event: FormEvent) => void; onClose: () => void }) { return <div className="modal-backdrop" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="modal" role="dialog" aria-modal="true" aria-labelledby="ticket-modal-title"><div className="modal-header"><div><p className="section-kicker">HelpDesk NovaTech 2.1</p><h2 id="ticket-modal-title">{mode === "create" ? "Créer un ticket" : "Modifier le ticket"}</h2></div><button onClick={onClose} aria-label="Fermer"><X /></button></div>{error && <div className="form-alert error">{error}</div>}<form onSubmit={onSubmit} className="ticket-form"><label className="span-2">Sujet<input autoFocus required minLength={3} maxLength={150} value={form.subject} onChange={(event) => setForm({ ...form, subject: event.target.value })} /></label><label>Service<input value={form.department} onChange={(event) => setForm({ ...form, department: event.target.value })} /></label><label>Priorité<select value={form.priority} onChange={(event) => setForm({ ...form, priority: event.target.value as Priority })}>{priorities.map((item) => <option value={item} key={item}>{priorityLabels[item]}</option>)}</select></label><label>Date limite<input type="datetime-local" value={form.due_at} onChange={(event) => setForm({ ...form, due_at: event.target.value })} /></label><label>Technicien<select value={form.assigned_to} onChange={(event) => setForm({ ...form, assigned_to: event.target.value })}><option value="">Non attribué</option>{team.map((member) => <option value={member.id} key={member.id}>{member.full_name}</option>)}</select></label>{staff && mode === "edit" && <label>Statut<select value={form.status} onChange={(event) => setForm({ ...form, status: event.target.value as Status })}>{statuses.map((item) => <option value={item} key={item}>{statusLabels[item]}</option>)}</select></label>}<label className="span-2">Description<textarea required minLength={3} maxLength={5000} rows={5} value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} /></label><label className="attachment-input span-2"><Paperclip />Pièces jointes <small>3 fichiers maximum, 1 Mo par fichier</small><input type="file" multiple onChange={onAttachments} /></label>{form.attachments.length > 0 && <div className="attachment-list span-2">{form.attachments.map((item) => <span key={item.id}><FileText />{item.name}<button type="button" aria-label={`Retirer ${item.name}`} onClick={() => setForm({ ...form, attachments: form.attachments.filter((file) => file.id !== item.id) })}><X /></button></span>)}</div>}<div className="form-actions span-2"><button type="button" className="secondary-button" onClick={onClose}>Annuler</button><button className="primary-button" type="submit"><CheckCircle2 />{mode === "create" ? "Créer le ticket" : "Enregistrer"}</button></div></form></section></div>; }

function DetailsModal({ ticket, comments, history, comment, setComment, onComment, onClose }: { ticket: Ticket; comments: Comment[]; history: History[]; comment: string; setComment: (value: string) => void; onComment: (event: FormEvent) => void; onClose: () => void }) { return <div className="modal-backdrop"><section className="modal detail-modal" role="dialog" aria-modal="true" aria-labelledby="details-title"><div className="modal-header"><div><p className="section-kicker">INC-{ticket.ticket_number} · {statusLabels[ticket.status]}</p><h2 id="details-title">{ticket.subject}</h2></div><button onClick={onClose} aria-label="Fermer"><X /></button></div><div className="detail-body"><div className="ticket-meta"><span><CalendarDays />Créé : {formatDate(ticket.created_at)}</span><span><Clock3 />Échéance : {formatDate(ticket.due_at)}</span><span><Users />{ticket.technician?.full_name ?? "Non attribué"}</span></div><p className="ticket-description">{ticket.description}</p>{ticket.attachments?.length ? <div className="attachments"><h3><Paperclip />Pièces jointes</h3>{ticket.attachments.map((item) => <a key={item.id} href={item.data_url} download={item.name}><FileText />{item.name}<small>{Math.ceil(item.size / 1024)} Ko</small></a>)}</div> : null}<div className="detail-grid"><section><h3><MessageSquare />Commentaires</h3><div className="timeline">{comments.length ? comments.map((item) => <article key={item.id}><strong>{item.author?.full_name ?? "Utilisateur"}</strong><time>{formatDate(item.created_at)}</time><p>{item.body}</p></article>) : <p className="muted">Aucun commentaire.</p>}</div><form className="comment-form" onSubmit={onComment}><label className="sr-only" htmlFor="comment">Nouveau commentaire</label><textarea id="comment" required maxLength={3000} value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Ajouter une information utile…" /><button className="primary-button"><MessageSquare />Commenter</button></form></section><section><h3><Clock3 />Historique complet</h3><div className="timeline">{history.length ? history.map((item) => <article key={item.id}><strong>{historyLabel(item.action)}</strong><time>{formatDate(item.created_at)}</time><p>{item.actor?.full_name ?? "Système"}{Object.keys(item.changes).length ? ` · ${Object.entries(item.changes).map(([key, value]) => `${key}: ${String(value)}`).join(" · ")}` : ""}</p></article>) : <p className="muted">Aucune modification enregistrée.</p>}</div></section></div></div></section></div>; }
function historyLabel(action: string) { return ({ created: "Ticket créé", updated: "Ticket modifié", commented: "Commentaire ajouté", closed: "Ticket fermé", reopened: "Ticket rouvert" } as Record<string, string>)[action] ?? action; }
function ConfirmDialog({ ticket, onConfirm, onCancel }: { ticket: Ticket; onConfirm: () => void; onCancel: () => void }) { return <div className="modal-backdrop"><section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="confirm-title"><span><AlertTriangle /></span><h2 id="confirm-title">Confirmer la fermeture</h2><p>Voulez-vous vraiment fermer le ticket INC-{ticket.ticket_number} ? Il pourra être rouvert ultérieurement.</p><div><button className="secondary-button" onClick={onCancel}>Annuler</button><button className="danger-button" onClick={onConfirm}><TicketCheck />Fermer le ticket</button></div></section></div>; }

function Team({ members, tickets }: { members: Profile[]; tickets: Ticket[] }) { return <section className="team-grid">{members.map((member) => <article className="panel team-card" key={member.id}><div className="avatar large">{initials(member.full_name)}</div><h2>{member.full_name}</h2><p>{roleLabels[member.role]} · {member.department || "Sans service"}</p><div><span>Tickets actifs</span><strong>{tickets.filter((ticket) => ticket.assigned_to === member.id && isOpen(ticket)).length}</strong></div><span className="availability"><i />Compte actif</span></article>)}</section>; }
function Skills() { const skills = [{ title: "Gérer le patrimoine informatique", text: "Inventaire des postes, serveurs et imprimantes, affectations, adresses IP, garanties, états, tickets liés et traçabilité des changements." }, { title: "Répondre aux incidents", text: "Qualification, priorité, attribution, commentaires, échéance, résolution et réouverture." }, { title: "Mettre à disposition un service", text: "Application hybride, continuité locale, sauvegarde, tests, CI et déploiement Vercel." }, { title: "Travailler en mode projet", text: "GitHub, documentation, automatisation, contrôle qualité et livraison continue." }, { title: "Développer la présence en ligne", text: "Interface responsive, accessible, mobile et dotée d’un mode sombre." }, { title: "Organiser son développement professionnel", text: "Rapports mesurables, présentation recruteur et amélioration continue." }]; return <section className="skills-page"><article className="panel skills-hero"><GraduationCap /><div><p className="section-kicker">BTS SIO option SISR</p><h2>Compétences mobilisées dans NovaTech 2.1</h2><p>Cette page relie les fonctions réalisées aux attendus professionnels de la formation.</p></div></article><div className="skills-grid">{skills.map((skill, index) => <article className="panel skill-card" key={skill.title}><span>0{index + 1}</span><h3>{skill.title}</h3><p>{skill.text}</p></article>)}</div></section>; }
function ProjectPresentation({ onNavigate }: { onNavigate: (view: View) => void }) {
  const steps: { title: string; text: string; action: string; view: View }[] = [
    { title: "Mesurer l’activité", text: "Lisez les indicateurs, les urgences et les tickets anciens.", action: "Ouvrir le tableau de bord", view: "dashboard" },
    { title: "Traiter un incident", text: "Ouvrez INC-1062, attribuez-le et suivez son historique.", action: "Voir les tickets", view: "tickets" },
    { title: "Contrôler le parc", text: "Recherchez SRV-AD-01 et consultez ses tickets liés.", action: "Explorer le parc", view: "inventory" },
    { title: "Prouver le résultat", text: "Filtrez les rapports puis consultez les compétences mobilisées.", action: "Voir les rapports", view: "reports" },
  ];
  const competencies = [
    { title: "Support utilisateurs", text: "Qualification, priorité, affectation, commentaire et clôture contrôlée." },
    { title: "Gestion du patrimoine", text: "Inventaire, adresses IP, garanties, états et traçabilité des changements." },
    { title: "Continuité de service", text: "Mode autonome, sauvegarde locale et exports portables JSON ou CSV." },
    { title: "Livraison professionnelle", text: "TypeScript, tests, CI GitHub et déploiement continu sur Vercel." },
  ];
  return <section className="about-page">
    <article className="panel project-hero recruiter-hero">
      <div>
        <p className="section-kicker">Christian Martin · Candidat en alternance BTS SIO SISR</p>
        <h2>J’ai conçu un centre de services IT complet et immédiatement démontrable</h2>
        <p>HelpDesk NovaTech montre ma capacité à organiser le support, maintenir un parc informatique fiable et livrer un service documenté, testé et accessible sans compte.</p>
        <div className="hero-actions">
          <button className="primary-button" onClick={() => onNavigate("dashboard")}><LayoutDashboard />Lancer la démo</button>
          <button className="secondary-button" onClick={() => onNavigate("skills")}><GraduationCap />Voir mes compétences</button>
        </div>
        <div className="project-tags"><span>Next.js 16</span><span>TypeScript</span><span>localStorage</span><span>Supabase optionnel</span><span>Vercel</span></div>
      </div>
      <BookOpen />
    </article>

    <article className="panel recruiter-brief">
      <div>
        <p className="section-kicker">Lecture recruteur · 45 secondes</p>
        <h2>Une preuve concrète de compétences SISR</h2>
        <p>Le projet relie un besoin d’entreprise à une solution exploitable : centraliser les demandes, prioriser les incidents, tracer les actions et garder une vision fiable des équipements.</p>
      </div>
      <div className="proof-numbers" aria-label="Résultats du projet">
        <div><strong>8</strong><span>tickets réalistes</span></div>
        <div><strong>7</strong><span>équipements suivis</span></div>
        <div><strong>4</strong><span>contrôles qualité</span></div>
      </div>
    </article>

    <div className="mission-grid">
      <article className="panel about-card"><p className="section-kicker">Contexte</p><h2>Une DSI à structurer</h2><p>Les demandes arrivent de plusieurs services et concernent les postes, le réseau, les comptes et les imprimantes. Elles doivent être centralisées et suivies.</p></article>
      <article className="panel about-card"><p className="section-kicker">Ma mission</p><h2>Concevoir le service</h2><p>J’ai modélisé le cycle des tickets, créé l’inventaire, relié les incidents aux équipements et ajouté rapports, historique, sauvegarde et droits.</p></article>
      <article className="panel about-card"><p className="section-kicker">Résultat</p><h2>Une démo sans blocage</h2><p>L’application fonctionne immédiatement en local, reste utilisable hors ligne et peut évoluer vers un mode partagé sécurisé avec Supabase.</p></article>
    </div>

    <article className="panel user-guide recruiter-demo">
      <div className="panel-heading"><div><p className="section-kicker">Guide utilisateur · Démonstration guidée</p><h2>Le parcours conseillé en deux minutes</h2></div><span className="demo-duration"><Clock3 />2 min</span></div>
      <ol>{steps.map((step, index) => <li key={step.title}><button className="demo-step" onClick={() => onNavigate(step.view)}><span>{index + 1}</span><div><strong>{step.title}</strong><p>{step.text}</p><em>{step.action}<ChevronRight /></em></div></button></li>)}</ol>
    </article>

    <article className="panel competency-proof">
      <div className="panel-heading"><div><p className="section-kicker">Compétences démontrées</p><h2>Ce que le projet prouve techniquement</h2></div><button className="text-button" onClick={() => onNavigate("skills")}>Voir le détail <ChevronRight /></button></div>
      <div className="competency-grid">{competencies.map((item) => <div key={item.title}><CheckCircle2 /><div><strong>{item.title}</strong><p>{item.text}</p></div></div>)}</div>
    </article>

    <article className="panel roadmap-card"><div><p className="section-kicker">Limites actuelles</p><h2>Cadre de la démonstration</h2><ul><li>Les données locales ne sont pas synchronisées entre navigateurs ou appareils.</li><li>Les pièces jointes sont limitées pour préserver l’espace du navigateur.</li><li>Les notifications restent internes à l’application.</li><li>Le mode local ne remplace pas une sauvegarde serveur en production.</li></ul></div><div><p className="section-kicker">Évolutions futures</p><h2>Pistes réalistes</h2><ul><li>Synchronisation multi-utilisateur et gestion avancée des droits.</li><li>Supervision, SLA et notifications par e-mail.</li><li>Base de connaissances et rapports PDF d’intervention.</li><li>Stockage distant sécurisé des pièces jointes.</li></ul></div></article>
  </section>;
}
function SettingsView({ mode, reason, dark, supabaseAvailable, onSupabase, onTheme, onJson, onCsv, onImport, onReset }: { mode: Mode; reason: string; dark: boolean; supabaseAvailable: boolean; onSupabase: () => void; onTheme: () => void; onJson: () => void; onCsv: () => void; onImport: () => void; onReset: () => void }) { return <section className="settings-grid"><article className="panel settings-card"><span className="settings-icon"><ShieldCheck /></span><div><h2>Application autonome</h2><p>{reason}. localStorage est prioritaire et la sauvegarde est automatique.</p><span className={`service-ok ${mode}`}><i />{mode === "supabase" ? "Supabase optionnel connecté" : "Mode démonstration autonome"}</span></div></article><article className="panel backup-card"><div><p className="section-kicker">Portabilité</p><h2>Sauvegarde et export</h2><p>Exportez les tickets, commentaires, pièces jointes et historique, ou restaurez une sauvegarde JSON.</p></div><div className="backup-actions"><button className="secondary-button" onClick={onJson}><FileJson />Export JSON</button><button className="secondary-button" onClick={onCsv}><Download />Export CSV</button><button className="secondary-button" onClick={onImport}><Upload />Importer</button><button className="danger-button" onClick={onReset}><RefreshCcw />Réinitialiser</button></div></article><article className="panel settings-card"><span className="settings-icon"><Database /></span><div><h2>Supabase facultatif</h2><p>Désactivé par défaut. L’application n’en a pas besoin pour fonctionner.</p>{mode === "supabase" ? <span className="service-ok"><i />Connecté pour cette session</span> : <button className="secondary-button compact" disabled={!supabaseAvailable} onClick={onSupabase}><Database />{supabaseAvailable ? "Activer Supabase" : "Supabase non configuré"}</button>}</div></article><article className="panel settings-card"><span className="settings-icon">{dark ? <Moon /> : <Sun />}</span><div><h2>Apparence</h2><p>Choisissez un thème confortable. Le réglage est conservé dans le navigateur.</p><button className="secondary-button compact" onClick={onTheme}>{dark ? <Sun /> : <Moon />}{dark ? "Mode clair" : "Mode sombre"}</button></div></article></section>; }
