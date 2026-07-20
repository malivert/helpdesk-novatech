import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(path, import.meta.url), "utf8");
const [page, styles, client, proxy, readme, changelog, workflow, packageJson, migration, layout] = await Promise.all([
  read("../app/page.tsx"), read("../app/globals.css"), read("../lib/supabase/client.ts"),
  read("../lib/supabase/proxy.ts"), read("../README.md"), read("../CHANGELOG.md"), read("../.github/workflows/ci.yml"),
  read("../package.json"), read("../supabase/migrations/20260720162335_helpdesk_core.sql"), read("../app/layout.tsx"),
]);

test("la version 2.1 est déclarée et la version 2.0 reste documentée", () => {
  assert.equal(JSON.parse(packageJson).version, "2.1.0");
  assert.match(readme, /HelpDesk NovaTech 2\.0/);
  assert.match(page, /NovaTech 2\.0/);
  assert.match(layout, /NovaTech 2\.1/);
  assert.match(changelog, /## \[2\.1\.0\] - 2026-07-20/);
});

test("le mode hybride bascule automatiquement vers localStorage", () => {
  assert.match(client, /if \(!url \|\| !key\) return null/);
  assert.match(proxy, /catch \{\s*return response/);
  assert.match(page, /activateDemo/);
  assert.match(page, /localStorage/);
  assert.match(page, /Aucune session Supabase · mode démonstration automatique/);
  assert.match(page, /Mode démonstration autonome/);
  assert.match(page, /activateDemo\("Mode autonome · sauvegarde automatique dans ce navigateur"\)/);
  assert.doesNotMatch(page, /setTimeout\(\(\) => void loadSupabase\(\)/);
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

test("sauvegarde JSON et CSV version 3 sont disponibles", () => {
  assert.match(page, /exportJson/);
  assert.match(page, /exportCsv/);
  assert.match(page, /importBackup/);
  assert.match(page, /version: 3/);
});

test("le parc informatique permet le CRUD et conserve un historique", () => {
  assert.match(page, /function InventoryView/);
  assert.match(page, /submitEquipment/);
  assert.match(page, /deleteEquipment/);
  assert.match(page, /addEquipmentHistory/);
  assert.match(page, /EquipmentHistoryModal/);
  assert.match(page, /Création|Ajouter un équipement/);
});

test("les champs professionnels et les données réalistes du parc sont présents", () => {
  for (const field of ["ip_address", "operating_system", "user", "location", "serial_number", "purchase_date", "warranty_end"]) assert.match(page, new RegExp(field));
  assert.match(page, /PC-FIN-01/);
  assert.match(page, /SRV-AD-01/);
  assert.match(page, /IMP-B12-01/);
});

test("le parc propose recherche, tri, filtres, statistiques et exports", () => {
  assert.match(page, /filteredEquipment/);
  assert.match(page, /equipmentQuery/);
  assert.match(page, /equipmentType/);
  assert.match(page, /equipmentStatus/);
  assert.match(page, /equipmentSort/);
  assert.match(page, /Hors garantie/);
  assert.match(page, /exportEquipmentCsv/);
  assert.match(page, /exportEquipmentJson/);
});

test("les équipements sont reliés aux tickets et adaptés au mobile", () => {
  assert.match(page, /ticket_ids/);
  assert.match(page, /Tickets liés/);
  assert.match(page, /onTicket/);
  assert.match(styles, /\.equipment-table/);
  assert.match(styles, /\.inventory-filters/);
  assert.match(readme, /Parc informatique/);
});

test("les données de démonstration sont cohérentes et suffisamment variées", () => {
  const ticketIds = [...page.matchAll(/makeDemoTicket\((\d+),/g)].map((match) => match[1]);
  const equipmentIds = [...page.matchAll(/id: "(eq-[^"]+)"/g)].map((match) => match[1]);
  assert.equal(ticketIds.length, 8);
  assert.equal(new Set(ticketIds).size, ticketIds.length);
  assert.equal(equipmentIds.length, 7);
  assert.equal(new Set(equipmentIds).size, equipmentIds.length);
  for (const linkedId of [...page.matchAll(/ticket_ids: \["demo-(\d+)"\]/g)].map((match) => match[1])) assert.ok(ticketIds.includes(linkedId));
  assert.match(page, /type: "computer"/);
  assert.match(page, /type: "server"/);
  assert.match(page, /type: "printer"/);
  assert.match(page, /type: "network"/);
});

test("la présentation, le guide et la feuille de route sont intégrés", () => {
  assert.match(page, /function ProjectPresentation/);
  assert.match(page, /Guide utilisateur/);
  assert.match(page, /Limites actuelles/);
  assert.match(page, /Évolutions futures/);
  assert.match(readme, /Guide utilisateur rapide/);
  assert.match(readme, /Limites et évolutions futures/);
  assert.match(styles, /\.project-hero/);
  assert.match(styles, /\.user-guide/);
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
  assert.match(page, /Supabase facultatif/);
  assert.match(page, /Désactivé par défaut/);
});

test("GitHub Actions vérifie tests, lint, TypeScript et build", () => {
  assert.match(workflow, /npm test/);
  assert.match(workflow, /npm run lint/);
  assert.match(workflow, /npm run typecheck/);
  assert.match(workflow, /npm run build/);
});
