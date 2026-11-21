/// <reference types="vite/client" />
declare const __APP_VERSION__: string;
interface Window {
 opscoder: {
  clipboard: { writeText: (text: string) => Promise<boolean> };
  connections: {
   list: () => Promise<Connection[]>;
   add: (input: AddConnectionInput) => Promise<Connection>;
   remove: (id: string) => Promise<boolean>;
   rename: (connectionId:string,name:string) => Promise<boolean>;
   addModel: (connectionId:string,modelId:string,name?:string) => Promise<boolean>;
   models: (connectionId: string, force?: boolean) => Promise<ChatModel[]>;
   setModel: (connectionId: string, modelId: string) => Promise<boolean>;
  };
  conversations: {
   list: () => Promise<Conversation[]>;
   create: () => Promise<Conversation>;
   rename: (conversationId: string, title: string) => Promise<boolean>;
   remove: (conversationId: string) => Promise<boolean>;
  };
  messages: { list: (conversationId: string) => Promise<ChatMessage[]> };
  chat: {
   send: (input: ChatSendInput) => Promise<{ok:boolean;cancelled?:boolean}>;
   cancel: (requestId: string) => Promise<boolean>;
   onChunk: (callback:(payload:{requestId:string;delta:string})=>void) => () => void;
  };
  cli: {
   status: (conversationId:string) => Promise<CliStatus>;
   enable: (conversationId:string) => Promise<CliStatus>;
   disable: (conversationId:string) => Promise<CliStatus>;
   chooseWorkspace: (conversationId:string) => Promise<CliStatus>;
   setAutoApprove: (conversationId:string,enabled:boolean) => Promise<CliStatus>;
   decide: (approvalId:string,decision:"once"|"always"|"deny") => Promise<boolean>;
   onApproval: (callback:(payload:CliApproval)=>void) => () => void;
   onResult: (callback:(payload:CliResultEvent)=>void) => () => void;
  };
 };
}
type CliStatus={enabled:boolean;workspace:string|null;autoApprove:boolean};
type CliApproval={approvalId:string;conversationId:string;requestId:string;command:string;workspace:string};
type CliResultEvent={conversationId:string;requestId:string;command:string;workspace:string;denied:boolean;running?:boolean;exitCode?:number|null;timedOut?:boolean};
type Connection={id:string;provider:"opencode-zen"|"custom";name:string;base_url:string|null;protocol:string;model_id:string|null;created_at:string};
type AddConnectionInput={provider:"opencode-zen"|"custom";name:string;baseUrl?:string;protocol:"opencode-zen"|"openai-chat-completions";modelId?:string;apiKey:string};
type ChatModel={id:string;name:string;protocol:"chat-completions"|"responses"|"anthropic-messages";free:boolean};
type Conversation={id:string;title:string;created_at:string;updated_at:string};
type ChatMessage={id:string;role:"user"|"assistant";content:string;connection_id:string|null;model_id:string|null;created_at:string;kind:string;meta:string|null};
type ChatSendInput={requestId:string;conversationId:string;connectionId:string;modelId:string;content:string};
