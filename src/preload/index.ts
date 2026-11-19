import { contextBridge, ipcRenderer } from "electron";
contextBridge.exposeInMainWorld("opscoder", {
  connections: {
    list: () => ipcRenderer.invoke("connections:list"),
    add: (input: unknown) => ipcRenderer.invoke("connections:add",input),
    remove: (id: string) => ipcRenderer.invoke("connections:remove",id)
  }
});
