import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("opscoder", {
 connections: {
  list: () => ipcRenderer.invoke("connections:list"),
  add: (input: unknown) => ipcRenderer.invoke("connections:add", input),
  remove: (id: string) => ipcRenderer.invoke("connections:remove", id),
  rename: (connectionId: string, name: string) => ipcRenderer.invoke("connections:rename", {connectionId,name}),
  addModel: (connectionId: string, modelId: string, name?: string) => ipcRenderer.invoke("connections:add-model", {connectionId,modelId,name}),
  models: (connectionId: string, force?: boolean) => ipcRenderer.invoke("connections:models", {connectionId,force}),
  setModel: (connectionId: string, modelId: string) => ipcRenderer.invoke("connections:set-model", {connectionId,modelId})
 },
 conversations: {
  list: () => ipcRenderer.invoke("conversations:list"),
  create: () => ipcRenderer.invoke("conversations:create"),
  rename: (conversationId: string, title: string) => ipcRenderer.invoke("conversations:rename",{conversationId,title}),
  remove: (conversationId: string) => ipcRenderer.invoke("conversations:remove",{conversationId})
 },
 messages: { list: (conversationId: string) => ipcRenderer.invoke("messages:list",conversationId) },
 chat: {
  send: (input: unknown) => ipcRenderer.invoke("chat:send",input),
  cancel: (requestId: string) => ipcRenderer.invoke("chat:cancel",{requestId}),
  onChunk: (callback: (payload:{requestId:string;delta:string})=>void) => {
   const listener = (_event: Electron.IpcRendererEvent, payload:{requestId:string;delta:string}) => callback(payload);
   ipcRenderer.on("chat:chunk",listener);
   return () => ipcRenderer.removeListener("chat:chunk",listener);
  }
 },
 cli: {
  status: (conversationId: string) => ipcRenderer.invoke("cli:status",{conversationId}),
  enable: (conversationId: string) => ipcRenderer.invoke("cli:enable",{conversationId}),
  disable: (conversationId: string) => ipcRenderer.invoke("cli:disable",{conversationId}),
  chooseWorkspace: (conversationId: string) => ipcRenderer.invoke("cli:choose-workspace",{conversationId}),
  setAutoApprove: (conversationId: string, enabled: boolean) => ipcRenderer.invoke("cli:set-auto-approve",{conversationId,enabled}),
  decide: (approvalId: string, decision: "once"|"always"|"deny") => ipcRenderer.invoke("cli:decide",{approvalId,decision}),
  onApproval: (callback: (payload: CliApproval) => void) => {
   const listener = (_event: Electron.IpcRendererEvent, payload: CliApproval) => callback(payload);
   ipcRenderer.on("cli:approval",listener);
   return () => ipcRenderer.removeListener("cli:approval",listener);
  },
  onResult: (callback: (payload: CliResultEvent) => void) => {
   const listener = (_event: Electron.IpcRendererEvent, payload: CliResultEvent) => callback(payload);
   ipcRenderer.on("cli:result",listener);
   return () => ipcRenderer.removeListener("cli:result",listener);
  }
 }
});
