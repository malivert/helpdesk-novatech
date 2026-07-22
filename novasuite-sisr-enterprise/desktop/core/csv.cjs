function escapeCsv(value) {
  const text = value === null || value === undefined ? "" : String(value);
  return /[;"\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function toCsv(rows, columns) {
  const selected = columns?.length ? columns : Object.keys(rows[0] ?? {});
  const header = selected.map((column) => escapeCsv(column.label ?? column.key ?? column)).join(";");
  const lines = rows.map((row) => selected.map((column) => {
    const key = column.key ?? column;
    return escapeCsv(row[key]);
  }).join(";"));
  return `\uFEFF${[header, ...lines].join("\r\n")}`;
}

function parseCsv(text) {
  const clean = String(text).replace(/^\uFEFF/, "");
  const delimiter = clean.split(/\r?\n/, 1)[0]?.includes(";") ? ";" : ",";
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < clean.length; index += 1) {
    const char = clean[index];
    const next = clean[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      row.push(cell.trim()); cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; cell = "";
    } else {
      cell += char;
    }
  }
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) return [];
  const headers = rows[0].map((header) => header.toLowerCase().trim());
  return rows.slice(1).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

function mapDirectoryUsers(rows) {
  return rows.map((row) => ({
    external_id: row.samaccountname || row.identifiant || row.id || "",
    display_name: row.displayname || row.nom || row.name || "",
    email: row.mail || row.email || "",
    department: row.department || row.service || "Non renseigné",
    title: row.title || row.fonction || "Utilisateur",
    status: /^(false|0|non|désactivé|disabled)$/i.test(row.enabled || row.actif || "true") ? "Inactif" : "Actif",
    source: "Active Directory",
  })).filter((user) => user.display_name);
}

function mapEquipment(rows) {
  return rows.map((row) => ({
    asset_tag: row.asset_tag || row.inventaire || row.id || "",
    name: row.hostname || row.nom || row.name || "",
    type: row.type || "Poste",
    serial: row.serial || row.numero_serie || "",
    ip_address: row.ip || row.ip_address || "",
    os: row.os || row.systeme || "",
    status: row.status || row.statut || "En ligne",
    source: "Import CSV",
  })).filter((equipment) => equipment.name);
}

module.exports = { escapeCsv, mapDirectoryUsers, mapEquipment, parseCsv, toCsv };
