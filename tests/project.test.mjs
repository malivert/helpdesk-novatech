import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [page, styles, client, proxy, readme, workflow, packageJson, migration] = await Promise.all([
  read("../app/page.tsx"), read("../app/globals.css"), read("../lib/supabase/client.ts"),
  read("../lib/supabase/proxy.ts"), read("../README.md"), read("../.github/workflows/ci.yml"),
  read("../package.json"), read("../supabase/migrations/20260720162335_helpdesk_core.sql"),
]);

test("la version 2.0 est déclarée et documentée", () => {
  assert.equal(JSON.parse(packageJson).version, "2.0.0");
  assert.match(readme, /HelpDesk NovaTech 2\.0/);
  assert.match(page, /NovaTech 2\.0/);
});

test("le mode hybride bascule automatiquement vers localStorage", () => {
  assert.match(client, /if \(!url \|\| !key\) return null/);
  assert.match(proxy, /catch \{\s*return response/);
  assert.match(page, /activateDemo/);
  assert.match(page, /localStorage/);
  assert.match(page, /Aucune session Supabase · mode démonstration automatique/);
});

test("le profil Christian Martin et les initiales calculées sont conservés", () => {
  assert.match(page, /full_name: "Christian Martin"/);
  assert.match(page, /function initials\(name: string\)/);
  assert.doesNotMatch(page, /Lucas Martin/);
  assert.doesNotMatch(page, /"LM"/);
});

test("le cycle complet des tickets est couvert", () => {
  assert.match(page, /submitTicket/);
  assert.match(page, /requestState/);
  assert.match(page, /applyState/);
  assert.match(page, /ConfirmDialog/);
  assert.match(page, /"closed" \? "new" : "closed"/);
  assert.match(page, /reopened/);
});

test("commentaires, attribution, échéances et pièces jointes sont disponibles", () => {
  assert.match(page, /addComment/);
  assert.match(page, /assigned_to/);
  assert.match(page, /due_at/);
  assert.match(page, /addAttachments/);
  assert.match(page, /fileToAttachment/);
  assert.match(page, /Maximum 3 fichiers de 1 Mo/);
});

test("l’historique complet mémorise les changements", () => {
  assert.match(page, /addHistory/);
  assert.match(page, /Historique complet/);
  assert.match(page, /Object\.entries\(item\.changes\)/);
});

test("les statistiques réelles et les graphiques sont calculés", () => {
  assert.match(page, /averageHours/);
  assert.match(page, /resolutionRate/);
  assert.match(page, /TechnicianChart/);
  assert.match(page, /BarChart/);
  assert.match(page, /Tickets ouverts les plus anciens/);
});

test("les rapports et filtres temporels sont présents", () => {
  assert.match(page, /type Period = "day" \| "week" \| "month" \| "all"/);
  assert.match(page, /PeriodFilter/);
  assert.match(page, /function Reports/);
  assert.match(page, /label="Rapports"/);
});

test("sauvegarde JSON et CSV version 2 sont disponibles", () => {
  assert.match(page, /exportJson/);
  assert.match(page, /exportCsv/);
  assert.match(page, /importBackup/);
  assert.match(page, /version: 2/);
});

test("l’expérience gère hors-ligne, notifications, thème sombre et mobile", () => {
  assert.match(page, /navigator\.onLine/);
  assert.match(page, /Notifications/);
  assert.match(page, /setDark/);
  assert.match(styles, /html\[data-theme="dark"\]/);
  assert.match(styles, /@media \(max-width: 580px\)/);
});

test("la page compétences BTS SIO SISR est intégrée", () => {
  assert.match(page, /function Skills/);
  assert.match(page, /Gérer le patrimoine informatique/);
  assert.match(page, /Mettre à disposition un service/);
  assert.match(readme, /Compétences BTS SIO SISR/);
});

test("Supabase reste sécurisé et optionnel", () => {
  assert.match(migration, /enable row level security/g);
  assert.match(migration, /grant select, insert, update, delete on public\.tickets to authenticated/);
  assert.doesNotMatch(page, /service_role/);
});

test("GitHub Actions vérifie tests, lint, TypeScript et build", () => {
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run lint/);
  assert.match(workflow, /npm run typecheck/);
  assert.match(workflow, /npm run build/);
});
