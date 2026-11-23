import type { ReactNode } from "react";
import { Ban, Check, FolderOpen, Plug, ShieldCheck, Terminal, X } from "lucide-react";
import { CUSTOM_PROVIDER, PROVIDER_PRESETS, providerById } from "../providers";

type AddConnectionProps = {
 busy: boolean;
 providerId: string;
 name: string;
 apiKey: string;
 baseUrl: string;
 modelId: string;
 onProvider: (value: string) => void;
 onName: (value: string) => void;
 onApiKey: (value: string) => void;
 onBaseUrl: (value: string) => void;
 onModelId: (value: string) => void;
 onClose: () => void;
 onSubmit: () => void;
};

export function AddConnectionModal({ busy, providerId, name, apiKey, baseUrl, modelId, onProvider, onName, onApiKey, onBaseUrl, onModelId, onClose, onSubmit }: AddConnectionProps) {
 const selected = providerById(providerId);
 const isZen = selected.provider === "opencode-zen";
 const isCustom = selected.id === CUSTOM_PROVIDER.id;
 return <Overlay onClose={busy ? undefined : onClose}>
  <form className="modal add-connection-modal" onSubmit={event => { event.preventDefault(); onSubmit(); }}>
   <div className="modal-title">
    <div><h2>Add connection</h2><p>Pick a provider, or connect any OpenAI-compatible API.</p></div>
    <div className="modal-title-actions">
     <button type="button" className={"custom-provider-btn " + (isCustom ? "active" : "")} onClick={() => onProvider(CUSTOM_PROVIDER.id)} aria-pressed={isCustom}><Plug size={13} />Custom</button>
     <button type="button" className="icon-btn" onClick={onClose} disabled={busy} aria-label="Close"><X size={17} /></button>
    </div>
   </div>
   <div className="provider-tabs" role="tablist" aria-label="AI provider">
    {PROVIDER_PRESETS.map(preset => <button key={preset.id} type="button" role="tab" aria-selected={selected.id === preset.id} title={preset.description} className={selected.id === preset.id ? "active" : ""} onClick={() => onProvider(preset.id)}>
     <span className="provider-mark">{preset.mark}</span><span className="provider-tab-name">{preset.name}</span>
    </button>)}
   </div>
   <div className="provider-summary">
    <span className="provider-mark large">{selected.mark}</span>
    <div><b>{selected.name}</b><small>{selected.description}</small></div>
   </div>
   <label className="field"><span>Connection name <small>Optional</small></span><input autoFocus value={name} onChange={event => onName(event.target.value)} maxLength={64} placeholder={selected.name} /></label>
   {!isZen && <label className="field"><span>API base URL <small>{isCustom ? "Required" : "Pre-filled from provider docs"}</small></span><input type="url" value={baseUrl} onChange={event => onBaseUrl(event.target.value)} placeholder="https://api.example.com/v1" required /></label>}
   <label className="field"><span>API key</span><input type="password" value={apiKey} onChange={event => onApiKey(event.target.value)} autoComplete="off" required maxLength={4096} /></label>
   {!isZen && <label className="field"><span>Model ID <small>{selected.defaultModelId ? "Default: " + selected.defaultModelId : "Optional"}</small></span><input value={modelId} onChange={event => onModelId(event.target.value)} maxLength={200} placeholder={selected.defaultModelId || "provider/model-name"} /></label>}
   <div className="modal-actions">
    <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>Cancel</button>
    <button className="btn btn-primary" disabled={busy || !apiKey.trim() || (!isZen && !baseUrl.trim())}>{busy ? "Saving…" : "Save connection"}</button>
   </div>
   <p className="footnote">Provider usage and billing are managed by your provider. Named providers are saved as OpenAI-compatible connections, so you can edit the endpoint later.</p>
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
