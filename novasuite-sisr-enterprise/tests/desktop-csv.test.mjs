import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { mapDirectoryUsers, mapEquipment, parseCsv, toCsv } = require("../desktop/core/csv.cjs");

test("importe un export Active Directory en CSV français", () => {
  const rows = parseCsv("sAMAccountName;displayName;mail;department;enabled\r\ncmartin;Christian Martin;christian@example.local;IT;true\r\n");
  const users = mapDirectoryUsers(rows);
  assert.equal(users.length, 1);
  assert.equal(users[0].external_id, "cmartin");
  assert.equal(users[0].department, "IT");
  assert.equal(users[0].source, "Active Directory");
});

test("importe un inventaire d’équipements", () => {
  const rows = parseCsv("inventaire,hostname,type,ip,systeme\nPC-001,PC-SUPPORT-01,Poste,10.20.30.4,Windows 11\n");
  const equipment = mapEquipment(rows);
  assert.equal(equipment[0].name, "PC-SUPPORT-01");
  assert.equal(equipment[0].ip_address, "10.20.30.4");
});

test("exporte les champs contenant des séparateurs", () => {
  const csv = toCsv([{ titre: "VPN; accès", statut: "Ouvert" }]);
  assert.match(csv, /"VPN; accès"/);
  assert.match(csv, /^\uFEFF/);
});
