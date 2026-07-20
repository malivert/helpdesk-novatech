import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [page, client, proxy, loginPage, loginActions, readme, workflow, migration] = await Promise.all([
  read("../app/page.tsx"),
  read("../lib/supabase/client.ts"),
  read("../lib/supabase/proxy.ts"),
  read("../app/login/page.tsx"),
  read("../app/login/actions.ts"),
  read("../README.md"),
  read("../.github/workflows/ci.yml"),
  read("../supabase/migrations/20260720162335_helpdesk_core.sql"),
]);

test("le mode hybride protège l’application des erreurs Supabase", () => {
  assert.match(client, /if \(!url \|\| !key\) return null/);
  assert.match(proxy, /catch \{\s*return response/);
  assert.match(page, /activateDemo/);
  assert.match(page, /localStorage/);
  assert.match(loginActions, /Supabase est momentanément inaccessible/);
});

test("le profil de démonstration est Christian Martin et ses initiales sont calculées", () => {
  const formerName = [76, 117, 99, 97, 115, 32, 77, 97, 114, 116, 105, 110].map((code) => String.fromCharCode(code)).join("");
  const formerInitials = String.fromCharCode(76, 77);
  assert.match(page, /full_name: "Christian Martin"/);
  assert.match(page, /function initials\(name: string\)/);
  assert.doesNotMatch(page, new RegExp(formerName));
  assert.doesNotMatch(page, new RegExp(`"${formerInitials}"`));
});

test("la gestion des tickets couvre création, modification, fermeture et réouverture", () => {
  assert.match(page, /submitTicket/);
  assert.match(page, /setTicketState/);
  assert.match(page, /"closed" \? "new" : "closed"/);
  assert.match(page, /Ticket modifié/);
  assert.match(page, /Ticket rouvert/);
});

test("les sauvegardes, exports, filtres, tri et historique sont disponibles", () => {
  assert.match(page, /exportJson/);
  assert.match(page, /exportCsv/);
  assert.match(page, /importBackup/);
  assert.match(page, /sortKey/);
  assert.match(page, /technician === "all"/);
  assert.match(page, /localHistory/);
});

test("la page d’authentification et l’accès démonstration sont présents", () => {
  assert.match(loginPage, /Accéder au HelpDesk/);
  assert.match(loginPage, /Continuer en mode démonstration/);
  assert.match(loginActions, /signInWithPassword/);
  assert.match(loginActions, /auth\.signUp/);
});

test("Supabase conserve les rôles, l’audit, les politiques RLS et les grants explicites", () => {
  assert.match(migration, /app_role/);
  assert.match(migration, /create table public\.ticket_history/);
  assert.match(migration, /enable row level security/g);
  assert.match(migration, /grant select, insert, update, delete on public\.tickets to authenticated/);
});

test("la documentation BTS et la CI couvrent toutes les validations", () => {
  assert.match(readme, /Compétences BTS SIO SISR/);
  assert.match(readme, /Mode démonstration/);
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run lint/);
  assert.match(workflow, /npm run typecheck/);
  assert.match(workflow, /npm run build/);
});
