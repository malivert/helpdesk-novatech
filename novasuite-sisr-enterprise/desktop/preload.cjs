const { contextBridge, ipcRenderer } = require("electron");

const invoke = (channel, ...args) => ipcRenderer.invoke(channel, ...args);

contextBridge.exposeInMainWorld("nova", {
  bootstrap: () => invoke("app:bootstrap"),
  auth: {
    setup: (payload) => invoke("auth:setup", payload),
    login: (payload) => invoke("auth:login", payload),
    touch: (token) => invoke("auth:touch", token),
    logout: (token) => invoke("auth:logout", token),
  },
  data: {
    dashboard: (token) => invoke("data:dashboard", token),
    list: (token, resource, options) => invoke("data:list", token, resource, options),
    create: (token, resource, payload) => invoke("data:create", token, resource, payload),
    update: (token, resource, id, changes) => invoke("data:update", token, resource, id, changes),
    delete: (token, resource, id) => invoke("data:delete", token, resource, id),
  },
  accounts: {
    create: (token, payload) => invoke("accounts:create", token, payload),
    update: (token, id, changes) => invoke("accounts:update", token, id, changes),
  },
  dashboard: { save: (token, widgets) => invoke("dashboard:save", token, widgets) },
  settings: {
    get: (token) => invoke("settings:get", token),
    update: (token, settings) => invoke("settings:update", token, settings),
  },
  backup: {
    create: (token) => invoke("backup:create", token),
    restore: (token) => invoke("backup:restore", token),
    chooseFolder: (token) => invoke("backup:choose-folder", token),
  },
  imports: { csv: (token, resource) => invoke("import:csv", token, resource) },
  reports: { export: (token, options) => invoke("report:export", token, options) },
  automation: { dryRun: (token, id) => invoke("automation:dry-run", token, id) },
  shell: { openPath: (token, target) => invoke("shell:open-path", token, target) },
  onNotification: (callback) => {
    const listener = (_event, payload) => callback(payload);
    ipcRenderer.on("novasuite:notification", listener);
    return () => ipcRenderer.removeListener("novasuite:notification", listener);
  },
});
