import { memo, useEffect, useRef, useState } from "react";
import { ArrowDown, Bug, Check, Copy, FileCode2, FolderOpen, Lightbulb, Send, ShieldCheck, Sparkles, Square, Terminal, X } from "lucide-react";
import { displayName, type UserProfile } from "../profile";
import type { CliActivity, CliMeta, Message, SettingsTab } from "../types";
import { BrandMark, ProfileAvatar } from "./Brand";

type ChatViewProps = {
 messages: Message[];
 sending: boolean;
 cliStatus: CliStatus;
 cliActivity: CliActivity | null;
 hasConnection: boolean;
 hasModel: boolean;
 profile: UserProfile;
 onSend: (content: string) => boolean;
 onStop: () => void;
 onToggleCli: () => void;
 onChangeWorkspace: () => void;
 onSetAutoApprove: (enabled: boolean) => void;
 onOpenSettings: (tab: SettingsTab) => void;
};

const parseMeta = (value: string | null | undefined): CliMeta => { try { return value ? JSON.parse(value) : {}; } catch { return {}; } };
const folderName = (path: string) => path.split(/[\\/]/).filter(Boolean).pop() ?? path;

export default function ChatView({ messages, sending, cliStatus, cliActivity, hasConnection, hasModel, profile, onSend, onStop, onToggleCli, onChangeWorkspace, onSetAutoApprove, onOpenSettings }: ChatViewProps) {
 const [draft, setDraft] = useState("");
 const [jumpVisible, setJumpVisible] = useState(false);
 const scrollRef = useRef<HTMLDivElement>(null);
 const textareaRef = useRef<HTMLTextAreaElement>(null);
 const nearBottomRef = useRef(true);

 const scrollToLatest = (smooth = false) => {
  const node = scrollRef.current;
  if (!node) return;
  nearBottomRef.current = true;
  node.scrollTo({ top: node.scrollHeight, behavior: smooth ? "smooth" : "auto" });
 };

 useEffect(() => {
  if (nearBottomRef.current) scrollToLatest(false);
 }, [messages]);

 useEffect(() => {
  const node = textareaRef.current;
  if (!node) return;
  node.style.height = "auto";
  node.style.height = Math.min(node.scrollHeight, 190) + "px";
 }, [draft]);

 const handleScroll = () => {
  const node = scrollRef.current;
  if (!node) return;
  const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
  nearBottomRef.current = distance < 96;
  setJumpVisible(distance > 190);
 };

 const send = () => {
  const content = draft.trim();
  if (!content || sending) return;
  if (!onSend(content)) return;
  setDraft("");
  nearBottomRef.current = true;
 };

 const useSuggestion = (prompt: string) => {
  setDraft(prompt);
  requestAnimationFrame(() => textareaRef.current?.focus());
 };

 const cliSuggestions = [
  { icon: <FolderOpen size={17} />, label: "Explore this folder", prompt: "Explore the workspace folder and explain how this project is organized." },
  { icon: <Bug size={17} />, label: "Find and fix a bug", prompt: "Look through this project and find one likely bug. Explain it, then fix it." },
  { icon: <FileCode2 size={17} />, label: "Review my changes", prompt: "Review my current uncommitted changes and suggest improvements." },
  { icon: <Terminal size={17} />, label: "Write a script", prompt: "Write a PowerShell script that " }
 ];
 const chatSuggestions = [
  { icon: <Sparkles size={17} />, label: "Explain a concept", prompt: "Explain how " },
  { icon: <Terminal size={17} />, label: "Write PowerShell", prompt: "Write a PowerShell script that " },
  { icon: <Bug size={17} />, label: "Debug an error", prompt: "Help me debug this error:\n\n" },
  { icon: <Lightbulb size={17} />, label: "Plan a feature", prompt: "Help me plan a feature: " }
 ];
 const suggestions = cliStatus.enabled ? cliSuggestions : chatSuggestions;
 const canChat = hasConnection && hasModel;

 return <div className="chat-view">
  <div className="messages-wrap">
   <div className="messages-scroll" ref={scrollRef} onScroll={handleScroll}>
    <div className="messages-inner">
     {!messages.length && !sending && <section className="empty-state">
      <div className="empty-mark"><BrandMark size={64} variant="outline" /></div>
      <h1>What are we building today?</h1>
      <p>{!hasConnection ? "Connect a provider to start chatting with your own models." : !hasModel ? "Choose a model for this connection, then start a conversation." : cliStatus.enabled ? "CLI mode is on. OPsCoder can inspect files and run commands in your workspace." : "Ask anything. Turn on CLI when you want OPsCoder to work inside a folder."}</p>
      {!canChat && <button className="btn btn-primary empty-cta" onClick={() => onOpenSettings(hasConnection ? "models" : "connections")}>{hasConnection ? "Choose a model" : "Connect a provider"}</button>}
      {canChat && <div className="suggestion-grid">
       {suggestions.map(item => <button className="suggestion-card" key={item.label} onClick={() => useSuggestion(item.prompt)}>
        <span className="suggestion-icon">{item.icon}</span>
        <span>{item.label}</span>
       </button>)}
      </div>}
      <small className="empty-credit">A local-first workspace by ITzGamerCracked_</small>
     </section>}
     <MessageList messages={messages} sending={sending} profile={profile} />
    </div>
   </div>
   {jumpVisible && <button className="jump-latest" onClick={() => scrollToLatest(true)} title="Jump to latest" aria-label="Jump to latest message"><ArrowDown size={16} /></button>}
  </div>

  <div className="composer-area">
   {cliActivity && <div className={"cli-activity " + cliActivity.status}>
    <Terminal size={14} />
    <span>{cliActivity.status === "running" ? "Running" : cliActivity.status === "denied" ? "Denied" : "Finished"}</span>
    <code>{cliActivity.command}</code>
    {cliActivity.status === "done" && cliActivity.exitCode !== undefined && <b>exit {cliActivity.exitCode ?? "?"}</b>}
   </div>}
   <div className="composer">
    <textarea
     ref={textareaRef}
     value={draft}
     onChange={event => setDraft(event.target.value)}
     onKeyDown={event => { if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); send(); } }}
     placeholder={!hasConnection ? "Connect a provider to start chatting" : !hasModel ? "Choose a model to start chatting" : cliStatus.enabled ? "Message OPsCoder in CLI mode…" : "Message OPsCoder…"}
     rows={1}
     disabled={!hasConnection}
     spellCheck={false}
    />
    <div className="composer-toolbar">
     <div className="composer-left">
      <button type="button" className={"cli-toggle " + (cliStatus.enabled ? "on" : "")} onClick={onToggleCli} disabled={!hasConnection || (sending && !cliStatus.enabled)} title={cliStatus.enabled ? "Turn off CLI mode" : "Let OPsCoder run commands in a folder"}>
       <Terminal size={13} />CLI
      </button>
      {cliStatus.enabled && cliStatus.workspace && <button type="button" className="cli-chip" onClick={onChangeWorkspace} disabled={sending} title={"Workspace: " + cliStatus.workspace}>
       <FolderOpen size={12} /><span>{folderName(cliStatus.workspace)}</span>
      </button>}
      {cliStatus.enabled && (cliStatus.autoApprove
       ? <span className="cli-auto"><ShieldCheck size={12} />Auto-approve<button type="button" onClick={() => onSetAutoApprove(false)} title="Review every command again" aria-label="Stop auto-approving commands"><X size={11} /></button></span>
       : <span className="cli-review"><ShieldCheck size={12} />Ask every command</span>)}
     </div>
     {sending
      ? <button type="button" className="send-button stop" onClick={onStop} title="Stop response" aria-label="Stop response"><Square size={13} fill="currentColor" /></button>
      : <button type="button" className="send-button" onClick={send} disabled={!draft.trim() || !canChat} title="Send message" aria-label="Send message"><Send size={16} /></button>}
    </div>
   </div>
   <p className="composer-hint">{cliStatus.enabled ? "Commands run in " + (cliStatus.workspace ? folderName(cliStatus.workspace) : "your workspace") + " · each command needs approval unless auto-approved" : "Enter to send · Shift + Enter for a new line · OPsCoder can make mistakes"}</p>
  </div>
 </div>;
}

const MessageList = memo(function MessageList({ messages, sending, profile }: { messages: Message[]; sending: boolean; profile: UserProfile }) {
 return <>{messages.map((message, index) => <MessageItem key={message.id} message={message} streaming={sending && index === messages.length - 1 && message.role === "assistant"} profile={profile} />)}</>;
});

const MessageItem = memo(function MessageItem({ message, streaming, profile }: { message: Message; streaming: boolean; profile: UserProfile }) {
 if (message.kind === "cli") return <CliCard message={message} />;
 const user = message.role === "user";
 return <article className={"message-row " + message.role}>
  {!user && <span className="message-avatar assistant"><BrandMark size={19} /></span>}
  <div className="message-content">
   <div className="message-name">{user ? displayName(profile) : "OPsCoder"}</div>
   {user
    ? <div className="message-bubble">{message.content}</div>
    : <div className="message-text">{message.content}{streaming && message.content && <span className="streaming-caret" />}{streaming && !message.content && <TypingDots />}</div>}
   {message.content && <CopyButton text={message.content} />}
  </div>
  {user && <ProfileAvatar profile={profile} size={30} className="message-user-avatar" />}
 </article>;
});

function TypingDots() {
 return <span className="typing-dots" aria-label="OPsCoder is thinking"><i /><i /><i /></span>;
}

function CopyButton({ text }: { text: string }) {
 const [status, setStatus] = useState<"idle" | "copied" | "error">("idle");
 const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
 useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
 const copy = async () => {
  try {
   await copyText(text);
   setStatus("copied");
   if (timer.current) clearTimeout(timer.current);
   timer.current = setTimeout(() => setStatus("idle"), 1400);
  } catch {
   setStatus("error");
   if (timer.current) clearTimeout(timer.current);
   timer.current = setTimeout(() => setStatus("idle"), 2000);
  }
 };
 return <button className="message-copy" onClick={() => void copy()} title={status === "copied" ? "Copied" : status === "error" ? "Could not copy" : "Copy message"} aria-label="Copy message">
  {status === "copied" ? <Check size={12} /> : status === "error" ? <X size={12} /> : <Copy size={12} />}
  <span>{status === "copied" ? "Copied" : status === "error" ? "Failed" : "Copy"}</span>
 </button>;
}

async function copyText(text: string) {
 try {
  const bridge = window.opscoder.clipboard;
  if (bridge && await bridge.writeText(text)) return;
 } catch { /* Try the browser API next. */ }
 try {
  if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return; }
 } catch { /* Fall back to a temporary textarea. */ }
 const area = document.createElement("textarea");
 area.value = text;
 area.setAttribute("readonly", "");
 area.style.position = "fixed";
 area.style.opacity = "0";
 document.body.appendChild(area);
 area.select();
 const copied = document.execCommand("copy");
 area.remove();
 if (!copied) throw new Error("Clipboard unavailable.");
}

const CliCard = memo(function CliCard({ message }: { message: Message }) {
 const meta = parseMeta(message.meta);
 const denied = Boolean(meta.denied);
 return <article className={"cli-card " + (denied ? "denied" : "")}>
  <div className="cli-card-head">
   <span className="cli-card-icon"><Terminal size={14} /></span>
   <b>{denied ? "Command denied" : "Command"}</b>
   {!denied && <span className={"exit-badge " + (meta.exitCode === 0 ? "ok" : "bad")}>exit {meta.exitCode ?? "?"}</span>}
   {meta.timedOut && <span className="exit-badge bad">timed out</span>}
   {meta.truncated && <span className="exit-badge">truncated</span>}
   {meta.cwd && <span className="cli-cwd" title={meta.cwd}>{folderName(meta.cwd)}</span>}
  </div>
  <pre className="cli-command"><span>$</span> {message.content}</pre>
  {denied ? <p className="cli-denied">You denied this command.</p> : <pre className="cli-output">{meta.output?.trim() || "(no output)"}</pre>}
 </article>;
});
