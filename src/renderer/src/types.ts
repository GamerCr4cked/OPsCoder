export type Page = "chat" | "settings";
export type SettingsTab = "profile" | "appearance" | "connections" | "models" | "about";
export type Message = { id: string; role: "user" | "assistant"; content: string; kind?: string; meta?: string | null };
export type CliMeta = { output?: string; exitCode?: number | null; cwd?: string; denied?: boolean; timedOut?: boolean; truncated?: boolean };
export type CliActivity = { command: string; status: "running" | "done" | "denied"; exitCode?: number | null };
