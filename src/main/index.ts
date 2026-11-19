import { app, BrowserWindow, ipcMain, safeStorage } from "electron";
import { join } from "node:path";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { z } from "zod";

let db: Database.Database;
const connectionInput = z.object({
  provider: z.enum(["opencode-zen", "custom"]),
  name: z.string().trim().min(1).max(64),
  baseUrl: z.string().url().max(2048).optional(),
  protocol: z.enum(["opencode-zen", "openai-chat-completions"]),
  modelId: z.string().trim().max(200).optional(),
  apiKey: z.string().trim().min(1).max(4096)
}).superRefine((v, ctx) => {
  if (v.provider === "custom" && !v.baseUrl) ctx.addIssue({code:"custom",message:"A valid API base URL is required.",path:["baseUrl"]});
  if (v.provider === "opencode-zen" && v.protocol !== "opencode-zen") ctx.addIssue({code:"custom",message:"Invalid OpenCode Zen protocol.",path:["protocol"]});
  if (v.provider === "custom" && v.protocol !== "openai-chat-completions") ctx.addIssue({code:"custom",message:"Unsupported custom protocol.",path:["protocol"]});
});

function createWindow() {
  const win = new BrowserWindow({
    width:1440,height:920,minWidth:980,minHeight:680,backgroundColor:"#0b1017",
    webPreferences:{preload:join(__dirname,"../preload/index.js"),contextIsolation:true,nodeIntegration:false,sandbox:true}
  });
  win.webContents.setWindowOpenHandler(() => ({action:"deny"}));
  win.webContents.on("will-navigate",(event,url) => {
    const devUrl = process.env.ELECTRON_RENDERER_URL;
    if (!devUrl || !url.startsWith(devUrl)) event.preventDefault();
  });
  if (process.env.ELECTRON_RENDERER_URL) void win.loadURL(process.env.ELECTRON_RENDERER_URL);
  else void win.loadFile(join(__dirname,"../renderer/index.html"));
}

function initDatabase() {
  db = new Database(join(app.getPath("userData"),"opscoder.sqlite"));
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS connections (
      id TEXT PRIMARY KEY, provider TEXT NOT NULL, name TEXT NOT NULL, base_url TEXT,
      protocol TEXT NOT NULL, model_id TEXT, credential BLOB NOT NULL, created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY, title TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('user','assistant')), content TEXT NOT NULL,
      connection_id TEXT, model_id TEXT, created_at TEXT NOT NULL,
      FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );
  `);
}

ipcMain.handle("connections:list", () =>
  db.prepare("SELECT id,provider,name,base_url,protocol,model_id,created_at FROM connections ORDER BY created_at").all()
);
ipcMain.handle("connections:add", (_event, raw: unknown) => {
  const parsed = connectionInput.safeParse(raw);
  if (!parsed.success) throw new Error(parsed.error.issues[0]?.message ?? "Invalid connection details.");
  if (!safeStorage.isEncryptionAvailable()) throw new Error("Secure credential storage is unavailable on this system.");
  const v = parsed.data, id = randomUUID(), createdAt = new Date().toISOString();
  const encrypted = safeStorage.encryptString(v.apiKey);
  db.prepare("INSERT INTO connections (id,provider,name,base_url,protocol,model_id,credential,created_at) VALUES (?,?,?,?,?,?,?,?)")
    .run(id,v.provider,v.name,v.baseUrl ?? null,v.protocol,v.modelId ?? null,encrypted,createdAt);
  return {id,provider:v.provider,name:v.name,base_url:v.baseUrl ?? null,protocol:v.protocol,model_id:v.modelId ?? null,created_at:createdAt};
});
ipcMain.handle("connections:remove", (_event,id: unknown) => {
  if (typeof id !== "string" || id.length > 64) throw new Error("Invalid connection ID.");
  db.prepare("DELETE FROM connections WHERE id = ?").run(id);
  return true;
});

app.whenReady().then(() => {
  initDatabase(); createWindow();
  app.on("activate",() => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
}).catch(error => { console.error("OPsCoder startup failed:",error); app.quit(); });
app.on("before-quit",() => { if (db?.open) db.close(); });
app.on("window-all-closed",() => { if (process.platform !== "darwin") app.quit(); });
