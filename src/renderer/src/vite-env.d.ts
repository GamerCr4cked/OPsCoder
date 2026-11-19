/// <reference types="vite/client" />
interface Window {
 opscoder: {
  connections: {
   list: () => Promise<Connection[]>;
   add: (input: AddConnectionInput) => Promise<Connection>;
   remove: (id: string) => Promise<boolean>;
   rename: (connectionId:string,name:string) => Promise<boolean>;
   addModel: (connectionId:string,modelId:string,name?:string) => Promise<boolean>;
   models: (connectionId: string) => Promise<ChatModel[]>;
   setModel: (connectionId: string, modelId: string) => Promise<boolean>;
  };
  conversations: {
   list: () => Promise<Conversation[]>;
   create: () => Promise<Conversation>;
  };
  messages: { list: (conversationId: string) => Promise<ChatMessage[]> };
  chat: {
   send: (input: ChatSendInput) => Promise<{ok:boolean}>;
   onChunk: (callback:(payload:{requestId:string;delta:string})=>void) => () => void;
  };
 };
}
type Connection={id:string;provider:"opencode-zen"|"custom";name:string;base_url:string|null;protocol:string;model_id:string|null;created_at:string};
type AddConnectionInput={provider:"opencode-zen"|"custom";name:string;baseUrl?:string;protocol:"opencode-zen"|"openai-chat-completions";modelId?:string;apiKey:string};
type ChatModel={id:string;name:string;protocol:"chat-completions"|"responses"|"anthropic-messages";free:boolean};
type Conversation={id:string;title:string;created_at:string;updated_at:string};
type ChatMessage={id:string;role:"user"|"assistant";content:string;connection_id:string|null;model_id:string|null;created_at:string};
type ChatSendInput={requestId:string;conversationId:string;connectionId:string;modelId:string;content:string};
