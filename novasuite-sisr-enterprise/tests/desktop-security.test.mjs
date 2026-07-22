import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { CryptoBox, createMasterKey, hashPassword, verifyPassword } = require("../desktop/core/security.cjs");

test("hachage sécurisé des mots de passe", () => {
  const password = "NovaSuite!2026";
  const credentials = hashPassword(password);
  assert.notEqual(credentials.hash, password);
  assert.equal(verifyPassword(password, credentials.salt, credentials.hash), true);
  assert.equal(verifyPassword("mauvais-mot-de-passe", credentials.salt, credentials.hash), false);
});

test("chiffrement AES-256-GCM des données sensibles", () => {
  const box = new CryptoBox(createMasterKey());
  const encrypted = box.encrypt("Information confidentielle");
  assert.ok(encrypted.startsWith("v1."));
  assert.equal(encrypted.includes("confidentielle"), false);
  assert.equal(box.decrypt(encrypted), "Information confidentielle");
});

test("refuse les mots de passe trop courts", () => {
  assert.throws(() => hashPassword("court"), /10 caractères/);
});
