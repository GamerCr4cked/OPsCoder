import type { ReactNode } from "react";
import { Ban, Check, FolderOpen, Plug, ShieldCheck, Terminal, X, Zap } from "lucide-react";

type AddConnectionProps = {
 busy: boolean;
 provider: "opencode-zen" | "custom";
 name: string;
 apiKey: string;
 baseUrl: string;
 modelId: string;
 onProvider: (value: "opencode-zen" | "custom") => void;
 onName: (value: string) => void;
 onApiKey: (value: string) => void;
 onBaseUrl: (value: string) => void;
 onModelId: (value: string) => void;
 onClose: () => void;
 onSubmit: () => void;
};

export function AddConnectionModal({ busy, provider, name, apiKey, baseUrl, modelId, onProvider, onName, onApiKey, onBaseUrl, onModelId, onClose, onSubmit }: AddConnectionProps) {
 return <Overlay onClose={busy ? undefined : onClose}>
  <form className="modal" onSubmit={event => { event.preventDefault(); onSubmit(); }}>
   <div className="modal-title">
    <div><h2>Add connection</h2><p>Credentials stay inside the desktop main process.</p></div>
    <button type="button" className="icon-btn" onClick={onClose} disabled={busy} aria-label="Close"><X size={17} /></button>
   </div>
   <div className="provider-tabs">
    <button type="button" className={provider === "opencode-zen" ? "active" : ""} onClick={() => onProvider("opencode-zen")}><Zap size={15} />OpenCode Zen</button>
    <button type="button" className={provider === "custom" ? "active" : ""} onClick={() => onProvider("custom")}><Plug size={15} />Custom API</button>
   </div>
   <label className="field"><span>Connection name <small>Optional</small></span><input autoFocus value={name} onChange={event => onName(event.target.value)} maxLength={64} placeholder={provider === "opencode-zen" ? "OpenCode Zen" : "My API"} /></label>
   {provider === "custom" && <label className="field"><span>API base URL</span><input type="url" value={baseUrl} onChange={event => onBaseUrl(event.target.value)} placeholder="https://api.example.com/v1" required /></label>}
   <label className="field"><span>API key</span><input type="password" value={apiKey} onChange={event => onApiKey(event.target.value)} autoComplete="off" required maxLength={4096} /></label>
   {provider === "custom" && <label className="field"><span>Model ID <small>Optional</small></span><input value={modelId} onChange={event => onModelId(event.target.value)} maxLength={200} placeholder="provider/model-name" /></label>}
   <div className="modal-actions">
    <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
    <button className="btn btn-primary" disabled={busy || !apiKey.trim()}>{busy ? "Saving…" : "Save connection"}</button>
   </div>
   <p className="footnote">Provider usage and billing are managed by your provider.</p>
  </form>
 </Overlay>;
}

type RenameProps = { title: string; value: string; onChange: (value: string) => void; onClose: () => void; onSubmit: () => void };

export function RenameConnectionModal({ title, value, onChange, onClose, onSubmit }: RenameProps) {
 return <Overlay onClose={onClose}>
  <form className="modal small" onSubmit={event => { event.preventDefault(); onSubmit(); }}>
   <div className="modal-title"><div><h2>Rename connection</h2><p>{title}</p></div><button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={17} /></button></div>
   <label className="field"><span>Connection name</span><input autoFocus value={value} onChange={event => onChange(event.target.value)} maxLength={64} required /></label>
   <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!value.trim()}>Save name</button></div>
  </form>
 </Overlay>;
}

export function RenameChatModal({ value, onChange, onClose, onSubmit }: { value: string; onChange: (value: string) => void; onClose: () => void; onSubmit: () => void }) {
 return <Overlay onClose={onClose}>
  <form className="modal small" onSubmit={event => { event.preventDefault(); onSubmit(); }}>
   <div className="modal-title"><div><h2>Rename chat</h2><p>Give this conversation a clearer title.</p></div><button type="button" className="icon-btn" onClick={onClose} aria-label="Close"><X size={17} /></button></div>
   <label className="field"><span>Chat title</span><input autoFocus value={value} onChange={event => onChange(event.target.value)} maxLength={80} required /></label>
   <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose}>Cancel</button><button className="btn btn-primary" disabled={!value.trim()}>Save title</button></div>
  </form>
 </Overlay>;
}

export function ConfirmModal({ title, message, confirmLabel, busyLabel = "Deleting…", busy, onClose, onConfirm }: { title: string; message: string; confirmLabel: string; busyLabel?: string; busy?: boolean; onClose: () => void; onConfirm: () => void }) {
 return <Overlay onClose={busy ? undefined : onClose}>
  <div className="modal small" role="alertdialog" aria-modal="true">
   <div className="modal-title"><div><h2>{title}</h2><p>{message}</p></div></div>
   <div className="modal-actions"><button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button><button type="button" className="btn btn-danger" onClick={onConfirm} disabled={busy}>{busy ? busyLabel : confirmLabel}</button></div>
  </div>
 </Overlay>;
}

export function ApprovalModal({ approval, onDecide }: { approval: CliApproval; onDecide: (decision: "once" | "always" | "deny") => void }) {
 return <div className="overlay approval-overlay">
  <div className="modal approval-modal" role="dialog" aria-modal="true" aria-labelledby="approval-title">
   <div className="modal-title">
    <div><h2 id="approval-title">Terminal access request</h2><p>OPsCoder wants to run a command in this chat.</p></div>
    <span className="approval-icon"><Terminal size={19} /></span>
   </div>
   <label className="approval-label">Command</label>
   <pre className="approval-command">{approval.command}</pre>
   <p className="approval-cwd"><FolderOpen size={13} /><span>{approval.workspace}</span></p>
   <p className="approval-warning"><ShieldCheck size={13} />Commands run with your user account. They can read or change files outside this folder.</p>
   <div className="modal-actions approval-actions">
    <button type="button" className="btn btn-danger-ghost" onClick={() => onDecide("deny")}><Ban size={14} />Deny</button>
    <button type="button" className="btn btn-secondary" onClick={() => onDecide("always")}><ShieldCheck size={14} />Always allow in this chat</button>
    <button type="button" className="btn btn-primary" onClick={() => onDecide("once")}><Check size={14} />Allow once</button>
   </div>
  </div>
 </div>;
}

function Overlay({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
 return <div className="overlay" onMouseDown={event => { if (event.target === event.currentTarget) onClose?.(); }}>{children}</div>;
}
