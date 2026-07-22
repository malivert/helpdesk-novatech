const crypto = require("node:crypto");

const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function hashPassword(password, salt = crypto.randomBytes(16).toString("hex")) {
  if (typeof password !== "string" || password.length < 10) {
    throw new Error("Le mot de passe doit contenir au moins 10 caractères.");
  }
  const hash = crypto.scryptSync(password, salt, 64, SCRYPT_OPTIONS).toString("hex");
  return { salt, hash };
}

function verifyPassword(password, salt, expectedHash) {
  try {
    const actual = crypto.scryptSync(password, salt, 64, SCRYPT_OPTIONS);
    const expected = Buffer.from(expectedHash, "hex");
    return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}

class CryptoBox {
  constructor(masterKey) {
    if (!Buffer.isBuffer(masterKey) || masterKey.length !== 32) {
      throw new Error("La clé de chiffrement doit contenir 32 octets.");
    }
    this.masterKey = masterKey;
  }

  encrypt(value) {
    if (value === null || value === undefined || value === "") return null;
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv("aes-256-gcm", this.masterKey, iv);
    const ciphertext = Buffer.concat([cipher.update(String(value), "utf8"), cipher.final()]);
    const tag = cipher.getAuthTag();
    return `v1.${iv.toString("base64")}.${tag.toString("base64")}.${ciphertext.toString("base64")}`;
  }

  decrypt(payload) {
    if (!payload) return "";
    const [version, ivB64, tagB64, valueB64] = String(payload).split(".");
    if (version !== "v1" || !ivB64 || !tagB64 || !valueB64) return "";
    const decipher = crypto.createDecipheriv("aes-256-gcm", this.masterKey, Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    return Buffer.concat([decipher.update(Buffer.from(valueB64, "base64")), decipher.final()]).toString("utf8");
  }
}

function createMasterKey() {
  return crypto.randomBytes(32);
}

module.exports = { CryptoBox, createMasterKey, hashPassword, verifyPassword };
