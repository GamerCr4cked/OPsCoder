import { memo, useDeferredValue, useMemo, useState } from "react";
import { MessageSquare, PanelLeftClose, PanelLeftOpen, Pencil, Plus, Search, Settings, Trash2 } from "lucide-react";
import { displayName, type UserProfile } from "../profile";
import type { SettingsTab } from "../types";
import { BrandMark, ProfileAvatar } from "./Brand";

type SidebarProps = {
 collapsed: boolean;
 conversations: Conversation[];
 activeChatId: string;
 profile: UserProfile;
 onToggle: () => void;
 onNewChat: () => void;
 onOpenChat: (id: string) => void;
 onRenameChat: (chat: Conversation) => void;
 onDeleteChat: (chat: Conversation) => void;
 onOpenSettings: (tab: SettingsTab) => void;
};

export const Sidebar = memo(function Sidebar({ collapsed, conversations, activeChatId, profile, onToggle, onNewChat, onOpenChat, onRenameChat, onDeleteChat, onOpenSettings }: SidebarProps) {
 const [query, setQuery] = useState("");
 const deferredQuery = useDeferredValue(query);
 const groups = useMemo(() => groupChats(conversations, deferredQuery), [conversations, deferredQuery]);

 return <aside className={"sidebar " + (collapsed ? "collapsed" : "")}>
  <div className="sidebar-top">
   {!collapsed && <button className="brand" onClick={() => onOpenSettings("about")} title="About OPsCoder">
    <span className="brand-mark"><BrandMark size={26} /></span>
    <span className="brand-name">OPsCoder</span>
   </button>}
   <button className="icon-btn" onClick={onToggle} title={collapsed ? "Expand sidebar" : "Collapse sidebar"} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}>{collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</button>
  </div>

  <button className="new-chat-btn" onClick={onNewChat} title="New chat">
   <Plus size={17} /><span>New chat</span>
  </button>

  {!collapsed && <label className="chat-search">
   <Search size={14} />
   <input value={query} onChange={event => setQuery(event.target.value)} placeholder="Search chats" aria-label="Search chats" spellCheck={false} />
  </label>}

  {!collapsed && <div className="chat-list">
   {!conversations.length && <p className="sidebar-empty">Your conversations will appear here.</p>}
   {conversations.length > 0 && !groups.length && <p className="sidebar-empty">No chats match “{deferredQuery}”.</p>}
   {groups.map(group => <div className="chat-group" key={group.label}>
    <div className="chat-group-label">{group.label}</div>
    {group.chats.map(chat => <div className={"chat-row " + (chat.id === activeChatId ? "active" : "")} key={chat.id}>
     <button className="chat-open" onClick={() => onOpenChat(chat.id)} title={chat.title}>
      <MessageSquare size={13} /><span>{chat.title}</span>
     </button>
     <div className="chat-actions">
      <button className="chat-action" onClick={() => onRenameChat(chat)} title="Rename chat" aria-label={"Rename " + chat.title}><Pencil size={12} /></button>
      <button className="chat-action danger" onClick={() => onDeleteChat(chat)} title="Delete chat" aria-label={"Delete " + chat.title}><Trash2 size={12} /></button>
     </div>
    </div>)}
   </div>)}
  </div>}

  <div className="sidebar-footer">
   <button className="profile" onClick={() => onOpenSettings("profile")} title={displayName(profile)}>
    <ProfileAvatar profile={profile} size={30} />
    {!collapsed && <span className="profile-meta"><b>{displayName(profile)}</b><small>Local profile</small></span>}
   </button>
   <button className="icon-btn" onClick={() => onOpenSettings("appearance")} title="Settings" aria-label="Settings"><Settings size={17} /></button>
  </div>
 </aside>;
});

function groupChats(conversations: Conversation[], query: string) {
 const needle = query.trim().toLowerCase();
 const groups = new Map<string, Conversation[]>();
 for (const chat of conversations) {
  if (needle && !chat.title.toLowerCase().includes(needle)) continue;
  const label = groupLabel(chat.updated_at);
  const bucket = groups.get(label);
  if (bucket) bucket.push(chat);
  else groups.set(label, [chat]);
 }
 return [...groups].map(([label, chats]) => ({ label, chats }));
}

function groupLabel(value: string) {
 const date = new Date(value);
 if (Number.isNaN(date.getTime())) return "Older";
 const now = new Date();
 const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
 const startOfDay = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
 const days = Math.round((startOfToday - startOfDay) / 86_400_000);
 if (days <= 0) return "Today";
 if (days === 1) return "Yesterday";
 if (days < 7) return "Previous 7 days";
 if (date.getFullYear() === now.getFullYear()) return date.toLocaleDateString(undefined, { month: "long" });
 return String(date.getFullYear());
}
