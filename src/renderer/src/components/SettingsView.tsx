import { useRef, useState, type ChangeEvent, type CSSProperties, type ReactNode } from "react";
import { ArrowLeft, Boxes, Check, Info, Moon, Palette, Pencil, Plug, Plus, RefreshCw, RotateCcw, ShieldCheck, Sparkles, Sun, Trash2, Upload, UserRound, Zap } from "lucide-react";
import { DEFAULT_PROFILE, PROFILE_NAME_MAX, displayName, imageToAvatar, type UserProfile } from "../profile";
import { ACCENT_PRESETS, type ThemeSettings } from "../theme";
import type { SettingsTab } from "../types";
import { BrandMark, ProfileAvatar } from "./Brand";

type SettingsViewProps = {
 tab: SettingsTab;
 onTab: (tab: SettingsTab) => void;
 onBack: () => void;
 theme: ThemeSettings;
 onThemeChange: (theme: ThemeSettings) => void;
 profile: UserProfile;
 onProfileChange: (profile: UserProfile) => void;
 connections: Connection[];
 activeId: string;
 onSetActive: (id: string) => void;
 onAddConnection: () => void;
 onRenameConnection: (connection: Connection) => void;
 onRemoveConnection: (connection: Connection) => void;
 onUseConnection: (id: string) => void;
 models: ChatModel[];
 modelsBusy: boolean;
 onRefreshModels: () => void;
 onSelectModel: (id: string) => void;
 manualModel: string;
 onManualModel: (value: string) => void;
 onAddManualModel: () => void;
};

const TABS: { id: SettingsTab; label: string; icon: ReactNode }[] = [
 { id: "profile", label: "Profile", icon: <UserRound size={15} /> },
 { id: "appearance", label: "Appearance", icon: <Palette size={15} /> },
 { id: "connections", label: "Connections", icon: <Plug size={15} /> },
 { id: "models", label: "Models", icon: <Boxes size={15} /> },
 { id: "about", label: "About", icon: <Info size={15} /> }
];

export default function SettingsView({ tab, onTab, onBack, theme, onThemeChange, profile, onProfileChange, connections, activeId, onSetActive, onAddConnection, onRenameConnection, onRemoveConnection, onUseConnection, models, modelsBusy, onRefreshModels, onSelectModel, manualModel, onManualModel, onAddManualModel }: SettingsViewProps) {
 const active = connections.find(connection => connection.id === activeId);
 const avatarInput = useRef<HTMLInputElement>(null);
 const [avatarError, setAvatarError] = useState("");

 const updateName = (value: string) => onProfileChange({ ...profile, name: value.slice(0, PROFILE_NAME_MAX) });
 const commitName = () => onProfileChange({ ...profile, name: displayName(profile) });
 const uploadAvatar = async (event: ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0];
  event.target.value = "";
  if (!file) return;
  setAvatarError("");
  try { onProfileChange({ ...profile, avatar: await imageToAvatar(file) }); }
  catch (caught) { setAvatarError(caught instanceof Error ? caught.message : "That image could not be used."); }
 };
 return <div className="settings-view">
  <div className="settings-inner">
   <header className="settings-header">
    <button className="icon-btn" onClick={onBack} title="Back to chat" aria-label="Back to chat"><ArrowLeft size={18} /></button>
    <div><h1>Settings</h1><p>Make OPsCoder yours.</p></div>
   </header>

   <div className="settings-tabs">
    {TABS.map(item => <button key={item.id} className={"settings-tab " + (tab === item.id ? "active" : "")} onClick={() => onTab(item.id)}>{item.icon}{item.label}</button>)}
   </div>

   {tab === "profile" && <section className="settings-panel">
    <div className="panel-heading"><h2>Profile</h2><p>How you appear in your local chats. Nothing leaves this device.</p></div>
    <div className="settings-card profile-settings">
     <div className="profile-settings-head">
      <ProfileAvatar profile={profile} size={72} />
      <div className="profile-settings-name"><b>{displayName(profile)}</b><small>Local profile</small></div>
      <span className="tag">On this device</span>
     </div>
     <label className="field">
      <span>Display name</span>
      <input value={profile.name} maxLength={PROFILE_NAME_MAX} placeholder={DEFAULT_PROFILE.name} spellCheck={false} onChange={event => updateName(event.target.value)} onBlur={commitName} onKeyDown={event => { if (event.key === "Enter") event.currentTarget.blur(); }} />
     </label>
     <div className="field profile-avatar-field">
      <span>Avatar</span>
      <div className="avatar-actions">
       <input ref={avatarInput} className="avatar-file" type="file" accept="image/png,image/jpeg,image/webp" onChange={event => void uploadAvatar(event)} />
       <button className="btn btn-secondary" onClick={() => avatarInput.current?.click()}><Upload size={14} />Upload photo</button>
       {profile.avatar && <button className="btn btn-secondary" onClick={() => { setAvatarError(""); onProfileChange({ ...profile, avatar: null }); }}><RotateCcw size={14} />Use default</button>}
      </div>
      <small>PNG, JPEG or WebP. Your photo is cropped square and saved locally.</small>
      {avatarError && <p className="profile-error" role="alert">{avatarError}</p>}
     </div>
    </div>
    <p className="settings-note">Your name and avatar appear in the sidebar and on your messages.</p>
   </section>}

   {tab === "appearance" && <section className="settings-panel">
    <div className="panel-heading"><h2>Appearance</h2><p>Pick a theme, or build a custom one with your own accent color.</p></div>
    <div className="theme-grid">
     <ThemeCard mode="dark" current={theme.mode} onSelect={() => onThemeChange({ ...theme, mode: "dark" })} icon={<Moon size={15} />} label="Dark" />
     <ThemeCard mode="light" current={theme.mode} onSelect={() => onThemeChange({ ...theme, mode: "light" })} icon={<Sun size={15} />} label="Light" />
     <ThemeCard mode="custom" current={theme.mode} onSelect={() => onThemeChange({ ...theme, mode: "custom" })} icon={<Sparkles size={15} />} label="Custom" accent={theme.accent} />
    </div>
    {theme.mode === "custom" && <div className="settings-card custom-theme">
     <div className="field-row">
      <div><b>Canvas</b><small>Choose the base surface for your custom theme.</small></div>
      <div className="segmented">
       <button className={theme.base === "dark" ? "active" : ""} onClick={() => onThemeChange({ ...theme, base: "dark" })}><Moon size={13} />Dark</button>
       <button className={theme.base === "light" ? "active" : ""} onClick={() => onThemeChange({ ...theme, base: "light" })}><Sun size={13} />Light</button>
      </div>
     </div>
     <div className="field-row">
      <div><b>Accent</b><small>Used for highlights, buttons and the send action.</small></div>
      <div className="accent-row">
       {ACCENT_PRESETS.map(color => <button key={color} className={"accent-swatch " + (theme.accent.toLowerCase() === color ? "active" : "")} style={{ "--swatch": color } as CSSProperties} onClick={() => onThemeChange({ ...theme, accent: color })} title={color} aria-label={"Use accent " + color}>{theme.accent.toLowerCase() === color && <Check size={11} />}</button>)}
       <label className="accent-picker" title="Pick a custom accent"><input type="color" value={theme.accent} onChange={event => onThemeChange({ ...theme, accent: event.target.value })} /><span style={{ background: theme.accent }} /></label>
      </div>
     </div>
    </div>}
    <p className="settings-note">Your appearance is saved on this device.</p>
   </section>}

   {tab === "connections" && <section className="settings-panel">
    <div className="panel-heading with-action"><div><h2>Connections</h2><p>Your API keys stay encrypted in the desktop process.</p></div><button className="btn btn-primary" onClick={onAddConnection}><Plus size={15} />Add connection</button></div>
    {!connections.length && <div className="empty-panel"><Plug size={22} /><b>No connections yet</b><p>Add an OpenCode Zen key or any OpenAI-compatible endpoint.</p><button className="btn btn-primary" onClick={onAddConnection}><Plus size={15} />Connect a provider</button></div>}
    <div className="connection-stack">
     {connections.map(connection => <article className={"connection-card " + (connection.id === activeId ? "active" : "")} key={connection.id}>
      <span className="provider-icon">{connection.provider === "opencode-zen" ? <Zap size={19} /> : <Plug size={19} />}</span>
      <div className="connection-details">
       <div className="connection-title"><b>{connection.name}</b>{connection.id === activeId && <span className="tag">Active</span>}</div>
       <small>{connection.provider === "opencode-zen" ? "OpenCode Zen" : connection.base_url || "OpenAI-compatible endpoint"}</small>
       <small className="model-line">{connection.model_id || "No model selected"}</small>
      </div>
      <div className="connection-actions">
       {connection.id !== activeId && <button className="btn btn-secondary" onClick={() => onUseConnection(connection.id)}>Use</button>}
       <button className="icon-btn" onClick={() => onRenameConnection(connection)} title="Rename connection" aria-label={"Rename " + connection.name}><Pencil size={15} /></button>
       <button className="icon-btn danger" onClick={() => onRemoveConnection(connection)} title="Remove connection" aria-label={"Remove " + connection.name}><Trash2 size={15} /></button>
      </div>
     </article>)}
    </div>
   </section>}

   {tab === "models" && <section className="settings-panel">
    <div className="panel-heading with-action"><div><h2>Models</h2><p>Pick the model this connection should use in chat.</p></div><button className="btn btn-secondary" onClick={onRefreshModels} disabled={!active || modelsBusy}><RefreshCw size={14} className={modelsBusy ? "spin" : ""} />Refresh</button></div>
    {!connections.length ? <div className="empty-panel"><Boxes size={22} /><b>Add a connection first</b><p>Models are discovered from the provider attached to each connection.</p><button className="btn btn-secondary" onClick={() => onTab("connections")}>Go to connections</button></div> : <>
     <div className="model-source">
      <label>Connection<select value={activeId} onChange={event => onSetActive(event.target.value)}>{connections.map(connection => <option key={connection.id} value={connection.id}>{connection.name}</option>)}</select></label>
      <span>{active ? active.provider === "opencode-zen" ? "OpenCode Zen catalogue" : "Custom endpoint catalogue" : ""}</span>
     </div>
     {modelsBusy && <div className="model-grid">{Array.from({ length: 4 }, (_, index) => <div className="model-card skeleton" key={index} />)}</div>}
     {!modelsBusy && <div className="model-grid">
      {models.map(model => <button key={model.id} className={"model-card " + (active?.model_id === model.id ? "selected" : "")} onClick={() => onSelectModel(model.id)}>
       <span className="model-icon"><Boxes size={16} /></span>
       <span className="model-meta"><b>{model.name}</b><small>{model.id} · {model.protocol}</small></span>
       {model.free && <span className="free-tag">FREE</span>}
       {active?.model_id === model.id && <span className="model-check"><Check size={13} /></span>}
      </button>)}
     </div>}
     {!modelsBusy && !models.length && <div className="empty-panel compact"><b>No models loaded</b><p>Refresh the catalogue, or add a model ID manually below.</p></div>}
     <div className="settings-card manual-model">
      <div><b>Use a model ID manually</b><small>Useful when a custom API does not expose a catalogue.</small></div>
      <div className="inline-field"><input value={manualModel} onChange={event => onManualModel(event.target.value)} placeholder="e.g. provider/model-name" maxLength={200} onKeyDown={event => { if (event.key === "Enter") onAddManualModel(); }} /><button className="btn btn-secondary" onClick={onAddManualModel} disabled={!manualModel.trim()}>Save model</button></div>
     </div>
    </>}
   </section>}

   {tab === "about" && <section className="settings-panel">
    <div className="about-hero">
     <span className="about-mark"><BrandMark size={42} variant="outline" /></span>
     <div><h2>OPsCoder</h2><p>Part of the OPs project family by <b>ITzGamerCracked_</b>.</p></div>
     <span className="tag">v{__APP_VERSION__}</span>
    </div>
    <div className="about-grid">
     <article className="settings-card about-card"><ShieldCheck size={18} /><div><b>Local-first by design</b><p>Chats, workspace paths and encrypted API keys stay on this device. The renderer never receives credentials.</p></div></article>
     <article className="settings-card about-card"><Palette size={18} /><div><b>Your workspace, your rules</b><p>Dark, light or a custom accent. Every chat can opt into approval-gated CLI mode with its own folder.</p></div></article>
    </div>
    <p className="settings-note">GitHub @GamerCr4cked · Built for Windows · Electron + React + TypeScript</p>
   </section>}
  </div>
 </div>;
}

function ThemeCard({ mode, current, onSelect, icon, label, accent }: { mode: "dark" | "light" | "custom"; current: string; onSelect: () => void; icon: ReactNode; label: string; accent?: string }) {
 return <button className={"theme-card " + (current === mode ? "selected" : "")} onClick={onSelect} style={accent ? { "--preview-accent": accent } as CSSProperties : undefined}>
  <span className={"theme-preview " + mode}>
   <i className="tp-side" /><i className="tp-dot" /><i className="tp-line one" /><i className="tp-line two" />
  </span>
  <span className="theme-label">{icon}{label}{current === mode && <Check size={14} className="theme-check" />}</span>
 </button>;
}
