import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const page = await readFile(new URL("../app/page.tsx", import.meta.url), "utf8");
const readme = await readFile(new URL("../README.md", import.meta.url), "utf8");
const migration = await readFile(new URL("../supabase/migrations/20260720162335_helpdesk_core.sql", import.meta.url), "utf8");

test("le projet contient l'identité HelpDesk NovaTech", () => {
  assert.match(page, /HelpDesk/);
  assert.match(page, /NovaTech/);
  assert.match(page, /Bonjour/);
});

test("les actions principales de gestion de tickets sont présentes", () => {
  assert.match(page, /Nouveau ticket/);
  assert.match(page, /Modifier le ticket/);
  assert.match(page, /a été fermé/);
  assert.match(page, /Rechercher/);
});

test("Supabase fournit les rôles, commentaires, historique et politiques RLS", () => {
  assert.match(migration, /app_role/);
  assert.match(migration, /create table public\.comments/);
  assert.match(migration, /create table public\.ticket_history/);
  assert.match(migration, /enable row level security/g);
  assert.match(page, /Commentaire ajouté/);
});

test("le README documente l'installation et le déploiement", () => {
  assert.match(readme, /npm ci/);
  assert.match(readme, /Déploiement sur Vercel/);
  assert.match(readme, /Présentation pour un recruteur/);
});
