import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { DatabaseSync } = require("node:sqlite");
const { NovaDatabase } = require("../desktop/core/database.cjs");
const { CryptoBox, createMasterKey } = require("../desktop/core/security.cjs");

function fixture(options = {}) {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), "novasuite-test-"));
  const file = path.join(directory, "database.sqlite");
  const db = new NovaDatabase(file, new CryptoBox(createMasterKey()), options);
  return { db, file, cleanup: () => { db.close(); fs.rmSync(directory, { recursive: true, force: true }); } };
}

test("initialise SQLite et authentifie l’administrateur", () => {
  const context = fixture();
  try {
    assert.equal(context.db.isFirstRun(), true);
    context.db.createAccount({ username: "admin.local", display_name: "Admin Local", password: "NovaSuite!2026", role: "administrateur" });
    assert.equal(context.db.isFirstRun(), false);
    assert.equal(context.db.authenticate("admin.local", "NovaSuite!2026").role, "administrateur");
    assert.equal(context.db.authenticate("admin.local", "incorrect"), null);
  } finally { context.cleanup(); }
});

test("unifie les équipements, utilisateurs, tickets et incidents", () => {
  const context = fixture();
  const actor = { id: "admin", display_name: "Admin" };
  try {
    const user = context.db.create("users", { display_name: "Sophie Bernard", department: "Finance", status: "Actif" }, actor);
    const equipment = context.db.create("equipment", { name: "PC-FIN-01", type: "Poste", owner_user_id: user.id, status: "En ligne" }, actor);
    const ticket = context.db.create("tickets", { title: "Accès VPN", description: "Secret métier", requester_user_id: user.id, status: "Ouvert" }, actor);
    const incident = context.db.create("incidents", { title: "Compte verrouillé", equipment_id: equipment.id, severity: "Haute", status: "Nouveau" }, actor);
    assert.equal(context.db.list("users").length, 1);
    assert.equal(context.db.list("equipment")[0].owner_user_id, user.id);
    assert.equal(context.db.list("tickets")[0].requester_user_id, user.id);
    assert.equal(context.db.list("incidents")[0].equipment_id, equipment.id);
    assert.equal(ticket.description, "Secret métier");
    assert.ok(incident.reference.startsWith("SEC-"));
    assert.ok(context.db.list("audit").length >= 4);

    const raw = new DatabaseSync(context.file, { readOnly: true });
    assert.equal(raw.prepare("SELECT description FROM tickets WHERE id=?").get(ticket.id).description.includes("Secret métier"), false);
    raw.close();
  } finally { context.cleanup(); }
});

test("produit les statistiques et notifications critiques", () => {
  const context = fixture();
  const actor = { id: "tech", display_name: "Technicien" };
  try {
    context.db.create("equipment", { name: "SW-01", type: "Commutateur", status: "En panne" }, actor);
    context.db.create("patches", { title: "Correctif urgent", severity: "Critique", status: "À planifier" }, actor);
    context.db.create("tickets", { title: "Ticket test", status: "Ouvert" }, actor);
    const dashboard = context.db.dashboard("tech");
    assert.equal(dashboard.metrics.openTickets, 1);
    assert.equal(dashboard.metrics.criticalPatches, 1);
    assert.ok(dashboard.metrics.unreadNotifications >= 2);
  } finally { context.cleanup(); }
});

test("sépare complètement le mode Démonstration", () => {
  const enterprise = fixture();
  const demo = fixture({ demo: true });
  try {
    assert.equal(enterprise.db.list("equipment").length, 0);
    assert.ok(demo.db.list("equipment").length >= 4);
    assert.equal(demo.db.authenticate("demo.admin", "NovaSuite!2026").role, "administrateur");
  } finally { enterprise.cleanup(); demo.cleanup(); }
});
