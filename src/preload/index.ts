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
  create: () => ipcRenderer.invoke("conversations:create")
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
 }
});
