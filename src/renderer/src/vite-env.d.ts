/// <reference types="vite/client" />
interface Window { opscoder: { connections: { list: () => Promise<Connection[]>; add: (input: AddConnectionInput) => Promise<Connection>; remove: (id: string) => Promise<boolean> } } }
type Connection = { id:string; provider:"opencode-zen"|"custom"; name:string; base_url:string|null; protocol:string; model_id:string|null; created_at:string };
type AddConnectionInput = { provider:"opencode-zen"|"custom"; name:string; baseUrl?:string; protocol:"opencode-zen"|"openai-chat-completions"; modelId?:string; apiKey:string };
