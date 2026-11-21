import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Plus, RefreshCw, Settings, Sparkles, Terminal, X } from "lucide-react";
import ChatView from "./components/ChatView";
import { AddConnectionModal, ApprovalModal, ConfirmModal, RenameChatModal, RenameConnectionModal } from "./components/Modals";
import { Sidebar } from "./components/Sidebar";
import SettingsView from "./components/SettingsView";
import { loadTheme, saveTheme, type ThemeSettings } from "./theme";
import type { CliActivity, Message, Page, SettingsTab } from "./types";

type ConfirmState = { kind: "chat"; chat: Conversation } | { kind: "connection"; connection: Connection };
const IDENTITY_NAME = "ITzGamerCracked_";
const IDENTITY_HANDLE = "GC";
const uid = () => crypto.randomUUID();

export default function App() {
 const [page, setPage] = useState<Page>("chat");
 const [settingsTab, setSettingsTab] = useState<SettingsTab>("appearance");
 const [theme, setTheme] = useState<ThemeSettings>(() => loadTheme());
 const [sidebarCollapsed, setSidebarCollapsed] = useState(() => { try { return localStorage.getItem("opscoder.sidebar") === "1"; } catch { return false; } });

 const [connections, setConnections] = useState<Connection[]>([]);
 const [activeId, setActiveId] = useState("");
 const [models, setModels] = useState<ChatModel[]>([]);
 const [modelsBusy, setModelsBusy] = useState(false);
 const [manualModel, setManualModel] = useState("");
 const [showAdd, setShowAdd] = useState(false);
 const [busy, setBusy] = useState(false);
 const [provider, setProvider] = useState<"opencode-zen" | "custom">("opencode-zen");
 const [name, setName] = useState("");
 const [apiKey, setApiKey] = useState("");
 const [baseUrl, setBaseUrl] = useState("");
 const [modelId, setModelId] = useState("");
 const [renamingConnection, setRenamingConnection] = useState<Connection | null>(null);
 const [renameConnectionValue, setRenameConnectionValue] = useState("");

 const [conversations, setConversations] = useState<Conversation[]>([]);
 const [conversationId, setConversationId] = useState("");
 const [messages, setMessages] = useState<Message[]>([]);
 const [sending, setSending] = useState(false);
 const [activeRequestId, setActiveRequestId] = useState("");
 const [renamingChat, setRenamingChat] = useState<Conversation | null>(null);
 const [renameChatValue, setRenameChatValue] = useState("");
 const [confirm, setConfirm] = useState<ConfirmState | null>(null);
 const [confirmBusy, setConfirmBusy] = useState(false);

 const [cliStatus, setCliStatus] = useState<CliStatus>({ enabled: false, workspace: null, autoApprove: false });
 const [approval, setApproval] = useState<CliApproval | null>(null);
 const [cliActivity, setCliActivity] = useState<CliActivity | null>(null);
 const [modelMenuOpen, setModelMenuOpen] = useState(false);
 const [error, setError] = useState("");

 const errorTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
 const conversationRef = useRef(conversationId);
 const conversationsRef = useRef<Conversation[]>([]);
 const messagesRef = useRef<Message[]>([]);
 const sendingRef = useRef(false);
 const liveChatRef = useRef("");
 const connectionsRef = useRef<Connection[]>([]);
 const pendingChunks = useRef(new Map<string, string>());
 const rafRef = useRef<number | null>(null);
 const initialized = useRef(false);

 const active = useMemo(() => connections.find(connection => connection.id === activeId), [connections, activeId]);
 const selectedModel = useMemo(() => models.find(model => model.id === active?.model_id) ?? models[0] ?? null, [models, active]);
 const activeChat = useMemo(() => conversations.find(chat => chat.id === conversationId), [conversations, conversationId]);

 useEffect(() => { conversationRef.current = conversationId; }, [conversationId]);
 useEffect(() => { conversationsRef.current = conversations; }, [conversations]);
 useEffect(() => { messagesRef.current = messages; }, [messages]);
 useEffect(() => { sendingRef.current = sending; }, [sending]);
 useEffect(() => { connectionsRef.current = connections; }, [connections]);
 useEffect(() => { try { localStorage.setItem("opscoder.sidebar", sidebarCollapsed ? "1" : "0"); } catch { /* Ignore storage failures. */ } }, [sidebarCollapsed]);
 useEffect(() => { if (!error) return; if (errorTimer.current) clearTimeout(errorTimer.current); errorTimer.current = setTimeout(() => setError(""), 18000); return () => { if (errorTimer.current) clearTimeout(errorTimer.current); }; }, [error]);
 useEffect(() => () => { if (rafRef.current !== null) cancelAnimationFrame(rafRef.current); }, []);

 const refresh = useCallback(async () => {
  try {
   const items = await window.opscoder.connections.list();
   setConnections(items);
   setActiveId(current => items.some(connection => connection.id === current) ? current : items[0]?.id ?? "");
  } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load connections."); }
 }, []);

 const loadConversations = useCallback(async () => {
  try {
   const items = await window.opscoder.conversations.list();
   setConversations(items);
   if (items.length) {
    setConversationId(items[0].id);
    setMessages(await window.opscoder.messages.list(items[0].id));
   } else {
    const chat = await window.opscoder.conversations.create();
    setConversations([chat]);
    setConversationId(chat.id);
    setMessages([]);
   }
  } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load chats."); }
 }, []);

 useEffect(() => {
  if (initialized.current) return;
  initialized.current = true;
  void refresh();
  void loadConversations();
 }, [refresh, loadConversations]);

 const loadModels = useCallback(async (id: string, force = false) => {
  if (!id) { setModels([]); return; }
  setModelsBusy(true);
  setError("");
  try {
   const items = await window.opscoder.connections.models(id, force);
   setModels(items);
   if (items.length) {
    const connection = connectionsRef.current.find(item => item.id === id);
    if (!items.some(model => model.id === connection?.model_id)) {
     const current = items[0];
     await window.opscoder.connections.setModel(id, current.id);
     setConnections(currentConnections => currentConnections.map(item => item.id === id ? { ...item, model_id: current.id } : item));
    }
   }
  } catch (caught) {
   setModels([]);
   setError(caught instanceof Error ? caught.message : "Could not load models. Add a model ID manually in Settings.");
  } finally { setModelsBusy(false); }
 }, []);

 useEffect(() => { if (activeId) void loadModels(activeId); else setModels([]); }, [activeId, loadModels]);

 const refreshCliStatus = useCallback(async (id: string) => {
  if (!id) { setCliStatus({ enabled: false, workspace: null, autoApprove: false }); return; }
  try {
   const next = await window.opscoder.cli.status(id);
   if (conversationRef.current === id) setCliStatus(next);
  } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not load CLI status."); }
 }, []);

 useEffect(() => { void refreshCliStatus(conversationId); setCliActivity(null); }, [conversationId, refreshCliStatus]);

 const flushChunks = useCallback(() => {
  if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
  const batch = pendingChunks.current;
  if (!batch.size) return;
  pendingChunks.current = new Map();
  if (liveChatRef.current !== conversationRef.current) return;
  setMessages(current => {
   let next = current;
   for (const [requestId, delta] of batch) {
    const index = next.findIndex(message => message.id === requestId);
    if (index < 0) next = [...next, { id: requestId, role: "assistant", content: delta, kind: "text", meta: null }];
    else {
     next = [...next];
     next[index] = { ...next[index], content: next[index].content + delta };
    }
   }
   return next;
  });
 }, []);

 const queueChunk = useCallback((requestId: string, delta: string) => {
  const current = pendingChunks.current.get(requestId) ?? "";
  pendingChunks.current.set(requestId, current + delta);
  if (rafRef.current === null) rafRef.current = requestAnimationFrame(() => { rafRef.current = null; flushChunks(); });
 }, [flushChunks]);

 const clearPendingChunks = useCallback(() => {
  pendingChunks.current.clear();
  if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
 }, []);

 useEffect(() => window.opscoder.chat.onChunk(({ requestId, delta }) => {
  if (liveChatRef.current !== conversationRef.current) return;
  queueChunk(requestId, delta);
 }), [queueChunk]);

 useEffect(() => {
  const offApproval = window.opscoder.cli.onApproval(payload => { setApproval(payload); setCliActivity(null); });
  const offResult = window.opscoder.cli.onResult(payload => {
   if (payload.conversationId !== conversationRef.current) return;
   setCliActivity({ command: payload.command, status: payload.running ? "running" : payload.denied ? "denied" : "done", exitCode: payload.exitCode });
  });
  return () => { offApproval(); offResult(); };
 }, []);

 const stopActiveStream = useCallback(() => {
  if (sending && activeRequestId) void window.opscoder.chat.cancel(activeRequestId);
 }, [sending, activeRequestId]);

 const newChat = useCallback(async () => {
  setModelMenuOpen(false);
  setPage("chat");
  const current = conversationsRef.current.find(chat => chat.id === conversationRef.current);
  if (!sendingRef.current && current?.title === "New chat" && !messagesRef.current.length) return;
  stopActiveStream();
  clearPendingChunks();
  setApproval(null);
  setCliActivity(null);
  try {
   const chat = await window.opscoder.conversations.create();
   setConversations(current => [chat, ...current]);
   setConversationId(chat.id);
   setMessages([]);
  } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not create a chat."); }
 }, [stopActiveStream, clearPendingChunks]);

 const openChat = useCallback(async (id: string) => {
  if (id === conversationRef.current) { setPage("chat"); return; }
  stopActiveStream();
  clearPendingChunks();
  setApproval(null);
  setCliActivity(null);
  setModelMenuOpen(false);
  try {
   setConversationId(id);
   setMessages(await window.opscoder.messages.list(id));
   setPage("chat");
  } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not open that chat."); }
 }, [stopActiveStream, clearPendingChunks]);

 const sendMessage = useCallback((content: string) => {
  const text = content.trim();
  if (!text || sending) return false;
  if (!conversationId) return false;
  if (!active) { setSettingsTab("connections"); setPage("settings"); setError("Add or select a connection before sending a message."); return false; }
  const fallback: ChatModel = { id: active.model_id ?? "", name: active.model_id ?? "", protocol: "chat-completions", free: false };
  const model = selectedModel ?? (active.model_id ? fallback : null);
  if (!model) { setSettingsTab("models"); setPage("settings"); setError("Select a model before chatting."); return false; }
  const requestId = uid(), chatId = conversationId, startedInCli = cliStatus.enabled;
  const user: Message = { id: uid(), role: "user", content: text, kind: "text", meta: null };
  const assistant: Message = { id: requestId, role: "assistant", content: "", kind: "text", meta: null };
  setMessages(current => [...current, user, assistant]);
  setSending(true);
  setActiveRequestId(requestId);
  liveChatRef.current = chatId;
  setCliActivity(null);
  setError("");
  void (async () => {
   let failed = false, reload = startedInCli;
   try {
    const result = await window.opscoder.chat.send({ requestId, conversationId: chatId, connectionId: active.id, modelId: model.id, content: text });
    if (result.cancelled) reload = true;
   }
   catch (caught) { failed = true; setError(caught instanceof Error ? caught.message : "The message could not be sent."); }
   finally {
    flushChunks();
    setSending(false);
    setActiveRequestId("");
    setApproval(null);
    liveChatRef.current = "";
    try { setConversations(await window.opscoder.conversations.list()); } catch { /* Keep the current list. */ }
    if (conversationRef.current === chatId) {
     if (failed || reload) { try { setMessages(await window.opscoder.messages.list(chatId)); } catch { /* Keep the streamed view. */ } }
     void refreshCliStatus(chatId);
    }
   }
  })();
  return true;
 }, [active, selectedModel, sending, conversationId, cliStatus.enabled, flushChunks, refreshCliStatus]);

 const cancelResponse = useCallback(async () => {
  if (!activeRequestId) return;
  try { await window.opscoder.chat.cancel(activeRequestId); }
  catch (caught) { setError(caught instanceof Error ? caught.message : "Could not stop the response."); }
 }, [activeRequestId]);

 const chooseModel = useCallback(async (id: string) => {
  if (!active || !id) return;
  try {
   await window.opscoder.connections.setModel(active.id, id);
   setConnections(current => current.map(connection => connection.id === active.id ? { ...connection, model_id: id } : connection));
  } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save the model selection."); }
 }, [active]);

 const saveManualModel = useCallback(async () => {
  const id = manualModel.trim();
  if (!active || !id) return;
  try {
   await window.opscoder.connections.addModel(active.id, id);
   await chooseModel(id);
   setModels(current => current.some(model => model.id === id) ? current : [...current, { id, name: id, protocol: "chat-completions", free: false }]);
   setManualModel("");
  } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save this model ID."); }
 }, [active, manualModel, chooseModel]);

 const changeTheme = useCallback((next: ThemeSettings) => { setTheme(next); saveTheme(next); }, []);
 const openSettings = useCallback((tab: SettingsTab) => { setSettingsTab(tab); setPage("settings"); setModelMenuOpen(false); }, []);
 const toggleSidebar = useCallback(() => setSidebarCollapsed(value => !value), []);
 const handleNewChat = useCallback(() => { void newChat(); }, [newChat]);
 const handleOpenChat = useCallback((id: string) => { void openChat(id); }, [openChat]);
 const handleRenameChat = useCallback((chat: Conversation) => { setRenamingChat(chat); setRenameChatValue(chat.title); }, []);
 const handleDeleteChat = useCallback((chat: Conversation) => setConfirm({ kind: "chat", chat }), []);

 const toggleCli = useCallback(async () => {
  if (!conversationId || (sending && !cliStatus.enabled)) return;
  try {
   if (cliStatus.enabled) { setCliStatus(await window.opscoder.cli.disable(conversationId)); setApproval(null); setCliActivity(null); }
   else setCliStatus(await window.opscoder.cli.enable(conversationId));
  } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not change CLI mode."); }
 }, [conversationId, sending, cliStatus.enabled]);

 const changeWorkspace = useCallback(async () => {
  if (!conversationId) return;
  try { setCliStatus(await window.opscoder.cli.chooseWorkspace(conversationId)); }
  catch (caught) { setError(caught instanceof Error ? caught.message : "Could not change the CLI workspace."); }
 }, [conversationId]);

 const toggleAutoApprove = useCallback(async (enabled: boolean) => {
  if (!conversationId) return;
  try { setCliStatus(await window.opscoder.cli.setAutoApprove(conversationId, enabled)); }
  catch (caught) { setError(caught instanceof Error ? caught.message : "Could not change command approval."); }
 }, [conversationId]);

 const decideCli = useCallback(async (decision: "once" | "always" | "deny") => {
  if (!approval) return;
  const current = approval;
  setApproval(null);
  setCliActivity({ command: current.command, status: decision === "deny" ? "denied" : "running" });
  try { await window.opscoder.cli.decide(current.approvalId, decision); await refreshCliStatus(current.conversationId); }
  catch (caught) { setError(caught instanceof Error ? caught.message : "Could not send the approval decision."); }
 }, [approval, refreshCliStatus]);

 const closeAdd = () => {
  if (busy) return;
  setShowAdd(false);
  setApiKey("");
  setName("");
  setBaseUrl("");
  setModelId("");
 };

 const addConnection = async () => {
  setBusy(true);
  setError("");
  try {
   const matches = connections.filter(connection => connection.provider === provider);
   const prefix = provider === "opencode-zen" ? "OpenCode Zen" : "Custom";
   const item = await window.opscoder.connections.add({
    provider,
    name: name.trim() || (matches.length ? prefix + " " + (matches.length + 1) : prefix),
    apiKey,
    baseUrl: provider === "custom" ? baseUrl.trim() : undefined,
    protocol: provider === "opencode-zen" ? "opencode-zen" : "openai-chat-completions",
    modelId: modelId.trim() || undefined
   });
   setConnections(current => [...current, item]);
   setActiveId(item.id);
   setShowAdd(false);
   setApiKey("");
   setName("");
   setBaseUrl("");
   setModelId("");
   setSettingsTab("connections");
   setPage("settings");
  } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not save the connection."); }
  finally { setBusy(false); }
 };

 const submitRenameConnection = async () => {
  if (!renamingConnection || !renameConnectionValue.trim()) return;
  try {
   await window.opscoder.connections.rename(renamingConnection.id, renameConnectionValue.trim());
   setConnections(current => current.map(connection => connection.id === renamingConnection.id ? { ...connection, name: renameConnectionValue.trim() } : connection));
   setRenamingConnection(null);
  } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not rename the connection."); }
 };

 const submitRenameChat = async () => {
  if (!renamingChat || !renameChatValue.trim()) return;
  try {
   await window.opscoder.conversations.rename(renamingChat.id, renameChatValue.trim());
   setConversations(current => current.map(chat => chat.id === renamingChat.id ? { ...chat, title: renameChatValue.trim() } : chat));
   setRenamingChat(null);
  } catch (caught) { setError(caught instanceof Error ? caught.message : "Could not rename the chat."); }
 };

 const runConfirm = async () => {
  if (!confirm || confirmBusy) return;
  setConfirmBusy(true);
  try {
   if (confirm.kind === "chat") {
    const chat = confirm.chat;
    if (chat.id === conversationId && sending && activeRequestId) void window.opscoder.chat.cancel(activeRequestId);
    await window.opscoder.conversations.remove(chat.id);
    const remaining = conversations.filter(item => item.id !== chat.id);
    setConversations(remaining);
    if (chat.id === conversationId) {
     clearPendingChunks();
     setApproval(null);
     setCliActivity(null);
     if (remaining.length) {
      setConversationId(remaining[0].id);
      setMessages(await window.opscoder.messages.list(remaining[0].id));
     } else {
      const fresh = await window.opscoder.conversations.create();
      setConversations([fresh]);
      setConversationId(fresh.id);
      setMessages([]);
     }
    }
   } else {
    await window.opscoder.connections.remove(confirm.connection.id);
    await refresh();
   }
   setConfirm(null);
  } catch (caught) { setError(caught instanceof Error ? caught.message : "The action could not be completed."); }
  finally { setConfirmBusy(false); }
 };

 useEffect(() => {
  if (!showAdd && !renamingConnection && !renamingChat && !confirm) return;
  const onKey = (event: KeyboardEvent) => {
   if (event.key !== "Escape" || busy || confirmBusy) return;
   setShowAdd(false);
   setRenamingConnection(null);
   setRenamingChat(null);
   setConfirm(null);
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
 }, [showAdd, renamingConnection, renamingChat, confirm, busy, confirmBusy]);

 useEffect(() => {
  if (!modelMenuOpen) return;
  const onKey = (event: KeyboardEvent) => { if (event.key === "Escape") setModelMenuOpen(false); };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
 }, [modelMenuOpen]);

 return <div className="app-shell">
  <Sidebar
   collapsed={sidebarCollapsed}
   conversations={conversations}
   activeChatId={conversationId}
   identityName={IDENTITY_NAME}
   identityHandle={IDENTITY_HANDLE}
   onToggle={toggleSidebar}
   onNewChat={handleNewChat}
   onOpenChat={handleOpenChat}
   onRenameChat={handleRenameChat}
   onDeleteChat={handleDeleteChat}
   onOpenSettings={openSettings}
  />

  <main className="main">
   <div className="chat-shell" hidden={page !== "chat"}>
    <header className="main-header">
     <div className="header-left">
      <div className="header-title"><b>{activeChat?.title ?? "New chat"}</b>{cliStatus.enabled && <span className="header-cli"><Terminal size={11} />CLI</span>}</div>
     </div>
     <div className="header-actions">
      <div className="model-picker">
       <button className="model-picker-btn" onClick={() => { if (!active) openSettings("connections"); else setModelMenuOpen(open => !open); }} aria-expanded={modelMenuOpen} title="Choose model">
        <Sparkles size={14} /><span>{selectedModel?.name ?? active?.model_id ?? (active ? "Select model" : "Connect provider")}</span><ChevronDown size={13} />
       </button>
       {modelMenuOpen && <>
        <div className="popover-scrim" onClick={() => setModelMenuOpen(false)} />
        <div className="model-popover">
         <div className="popover-head">
          <div><small>Connection</small><b>{active?.name ?? "None"}</b></div>
          <div className="popover-head-actions">
           <button className="icon-btn" onClick={() => activeId && void loadModels(activeId, true)} disabled={!activeId || modelsBusy} title="Refresh models" aria-label="Refresh models"><RefreshCw size={14} className={modelsBusy ? "spin" : ""} /></button>
           <button className="icon-btn" onClick={() => openSettings("connections")} title="Manage connections" aria-label="Manage connections"><Settings size={14} /></button>
          </div>
         </div>
         <div className="popover-list">
          {modelsBusy && <p className="popover-note">Loading models…</p>}
          {!modelsBusy && !models.length && <p className="popover-note">No models loaded for this connection.</p>}
          {models.map(model => <button key={model.id} className={"model-option " + (selectedModel?.id === model.id ? "active" : "")} onClick={() => { void chooseModel(model.id); setModelMenuOpen(false); }}>
           <span>{model.name}</span>
           {model.free && <span className="free-tag mini">FREE</span>}
           {selectedModel?.id === model.id && <Check size={14} />}
          </button>)}
         </div>
         <button className="popover-footer" onClick={() => openSettings("models")}>Manage models & connections</button>
        </div>
       </>}
      </div>
      <button className="icon-btn" onClick={() => void newChat()} title="New chat" aria-label="New chat"><Plus size={18} /></button>
     </div>
    </header>

    <ChatView
     key={conversationId}
     messages={messages}
     sending={sending}
     cliStatus={cliStatus}
     cliActivity={cliActivity}
     hasConnection={Boolean(active)}
     hasModel={Boolean(selectedModel ?? active?.model_id)}
     identityName={IDENTITY_NAME}
     identityHandle={IDENTITY_HANDLE}
     onSend={sendMessage}
     onStop={() => void cancelResponse()}
     onToggleCli={() => void toggleCli()}
     onChangeWorkspace={() => void changeWorkspace()}
     onSetAutoApprove={enabled => void toggleAutoApprove(enabled)}
     onOpenSettings={openSettings}
    />
   </div>

   {page === "settings" && <SettingsView
    tab={settingsTab}
    onTab={setSettingsTab}
    onBack={() => setPage("chat")}
    theme={theme}
    onThemeChange={changeTheme}
    connections={connections}
    activeId={activeId}
    onSetActive={setActiveId}
    onAddConnection={() => setShowAdd(true)}
    onRenameConnection={connection => { setRenamingConnection(connection); setRenameConnectionValue(connection.name); }}
    onRemoveConnection={connection => setConfirm({ kind: "connection", connection })}
    onUseConnection={id => { setActiveId(id); setPage("chat"); }}
    models={models}
    modelsBusy={modelsBusy}
    onRefreshModels={() => { if (activeId) void loadModels(activeId, true); }}
    onSelectModel={id => void chooseModel(id)}
    manualModel={manualModel}
    onManualModel={setManualModel}
    onAddManualModel={() => void saveManualModel()}
   />}
  </main>

  {showAdd && <AddConnectionModal busy={busy} provider={provider} name={name} apiKey={apiKey} baseUrl={baseUrl} modelId={modelId} onProvider={setProvider} onName={setName} onApiKey={setApiKey} onBaseUrl={setBaseUrl} onModelId={setModelId} onClose={closeAdd} onSubmit={() => void addConnection()} />}
  {renamingConnection && <RenameConnectionModal title={renamingConnection.name} value={renameConnectionValue} onChange={setRenameConnectionValue} onClose={() => setRenamingConnection(null)} onSubmit={() => void submitRenameConnection()} />}
  {renamingChat && <RenameChatModal value={renameChatValue} onChange={setRenameChatValue} onClose={() => setRenamingChat(null)} onSubmit={() => void submitRenameChat()} />}
  {confirm && <ConfirmModal title={confirm.kind === "chat" ? "Delete this chat?" : "Remove this connection?"} message={confirm.kind === "chat" ? "“" + confirm.chat.title + "” and its messages will be permanently deleted." : "“" + confirm.connection.name + "” and its saved API key will be removed. Your chats stay."} confirmLabel={confirm.kind === "chat" ? "Delete chat" : "Remove connection"} busyLabel={confirm.kind === "chat" ? "Deleting…" : "Removing…"} busy={confirmBusy} onClose={() => setConfirm(null)} onConfirm={() => void runConfirm()} />}
  {approval && <ApprovalModal approval={approval} onDecide={decision => void decideCli(decision)} />}

  {error && <div className="toast" role="alert"><span>{error}</span><button onClick={() => setError("")} aria-label="Dismiss error"><X size={14} /></button></div>}
 </div>;
}
