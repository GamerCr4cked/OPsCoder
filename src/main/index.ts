import { app, BrowserWindow, dialog, ipcMain, safeStorage, session } from "electron";
import { isAbsolute, join, resolve } from "node:path";
import { statSync } from "node:fs";
import { spawn, type ChildProcess } from "node:child_process";
import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { isIP } from "node:net";
import { z } from "zod";

app.enableSandbox();
let db: Database.Database;
const connectionInput=z.object({provider:z.enum(["opencode-zen","custom"]),name:z.string().trim().min(1).max(64),baseUrl:z.string().url().max(2048).optional(),protocol:z.enum(["opencode-zen","openai-chat-completions"]),modelId:z.string().trim().max(200).optional(),apiKey:z.string().trim().min(1).max(4096)}).superRefine((v,ctx)=>{
 if(v.provider==="custom"&&!v.baseUrl)ctx.addIssue({code:"custom",message:"A valid API base URL is required.",path:["baseUrl"]});
 if(v.provider==="opencode-zen"&&v.protocol!=="opencode-zen")ctx.addIssue({code:"custom",message:"Invalid OpenCode Zen protocol.",path:["protocol"]});
 if(v.provider==="custom"&&v.protocol!=="openai-chat-completions")ctx.addIssue({code:"custom",message:"Unsupported custom protocol.",path:["protocol"]});
});
const chatInput=z.object({requestId:z.string().uuid(),conversationId:z.string().uuid(),connectionId:z.string().uuid(),modelId:z.string().trim().min(1).max(200),content:z.string().trim().min(1).max(100000)});
const modelInput=z.object({connectionId:z.string().uuid(),force:z.boolean().optional()});
const cancelInput=z.object({requestId:z.string().uuid()});
const selectModelInput=z.object({connectionId:z.string().uuid(),modelId:z.string().trim().min(1).max(200)});
const conversationRef=z.object({conversationId:z.string().uuid()});
const cliToggleInput=z.object({conversationId:z.string().uuid(),enabled:z.boolean()});
const cliApprovalInput=z.object({approvalId:z.string().uuid(),decision:z.enum(["once","always","deny"])});
type ProviderRow={id:string;provider:"opencode-zen"|"custom";base_url:string|null;protocol:string;model_id:string|null;credential:Buffer};
type ChatModel={id:string;name:string;protocol:"chat-completions"|"responses"|"anthropic-messages";free:boolean;baseUrl?:string};
type StreamRecord={controller:AbortController;cancelled:boolean};
type ToolCall={id:string;name:string;arguments:string};
type TranscriptMessage={role:"user"|"assistant";content:string;toolCalls?:ToolCall[]}|{role:"tool";callId:string;name:string;content:string};
type CommandResult={output:string;exitCode:number|null;timedOut:boolean;truncated:boolean;aborted:boolean};
type CliStatus={enabled:boolean;workspace:string|null;autoApprove:boolean};
type ApprovalDecision="once"|"always"|"deny";
type ApprovalWaiter={conversationId:string;requestId:string;resolve:(decision:ApprovalDecision)=>void};
const modelCache=new Map<string,{at:number;models:ChatModel[]}>();
const modelInflight=new Map<string,Promise<ChatModel[]>>();
const activeStreams=new Map<string,StreamRecord>();
const cliSessions=new Map<string,{enabled:boolean;autoApprove:boolean}>();
const approvalWaiters=new Map<string,ApprovalWaiter>();
const nativeToolSupport=new Map<string,boolean>();
const cliChildren=new Set<ChildProcess>();
const MODEL_CACHE_TTL=5*60*1000;
const CLI_MAX_OUTPUT=120000,CLI_TIMEOUT=120000,CLI_MAX_ROUNDS=12;
const RUN_COMMAND_TOOL={name:"run_command",description:"Run a shell command in the user's CLI workspace. Commands are non-interactive and may require the user's approval. Use one command at a time and wait for the output.",parameters:{type:"object",properties:{command:{type:"string",description:"The exact command to run."},purpose:{type:"string",description:"A short reason for running the command."}},required:["command"],additionalProperties:false}};
class StreamCancelledError extends Error{constructor(readonly partial:string){super("The response was stopped.");this.name="StreamCancelledError";}}
class ProviderHttpError extends Error{constructor(readonly status:number,message:string){super(message);this.name="ProviderHttpError";}}
const zenResponses=new Set(["gpt-6-astra","gpt-5.6-sol","gpt-5.6-terra","gpt-5.6-luna","gpt-5.5","gpt-5.5-pro","gpt-5.4","gpt-5.4-pro","gpt-5.4-mini","gpt-5.4-nano","gpt-5.3-codex","gpt-5.3-codex-spark","gpt-5.2","gpt-5.2-codex","gpt-5.1","gpt-5.1-codex","gpt-5.1-codex-max","gpt-5.1-codex-mini","gpt-5","gpt-5-codex","gpt-5-nano","grok-4.6","grok-4.5","grok-build-0.1","muse-spark-1.3","muse-spark-1.2","muse-spark-1.3-contributor-free"]);
const zenAnthropic=new Set(["claude-fable-5-2","claude-fable-5-1","claude-fable-5","claude-opus-5-5","claude-opus-5","claude-opus-4-8","claude-opus-4-7","claude-opus-4-6","claude-opus-4-5","claude-sonnet-5-5","claude-sonnet-5","claude-sonnet-4-6","claude-sonnet-4-5","claude-haiku-5-5","claude-haiku-4-5","qwen3.7-max","qwen3.7-plus","qwen3.6-plus","qwen3.5-plus"]);
const zenChat=new Set(["deepseek-v4-pro","deepseek-v4-flash","deepseek-v4-flash-vision-exp","minimax-m3","minimax-m2.7","minimax-m2.5","glm-5.3-flash","glm-5.3","glm-5.2","glm-5.1","glm-5","kimi-k2.5","kimi-k2.6","kimi-k2.7-code","kimi-k3","big-pickle","mimo-v2.5-free","ling-3.0-flash-fin-free","nemotron-3-ultra-free","nemotron-3.5-lightning-free"]);
function zenProtocol(id:string):ChatModel["protocol"]|null{if(zenResponses.has(id))return"responses";if(zenAnthropic.has(id))return"anthropic-messages";if(zenChat.has(id))return"chat-completions";return null;}
function publicCustomBase(value:string){const url=new URL(value);if(url.protocol!=="https:"&&!(url.protocol==="http:"&&["localhost","127.0.0.1","[::1]"].includes(url.hostname)))throw new Error("Custom API URLs must use HTTPS (HTTP is allowed only for localhost).");if(url.username||url.password||url.search||url.hash)throw new Error("The API base URL cannot contain credentials, query parameters, or fragments.");const host=url.hostname.toLowerCase();if(host==="localhost"||host==="127.0.0.1"||host==="[::1]")return url.toString().replace(/\/$/,"");if(host.endsWith(".local")||isIP(host))throw new Error("Use a public HTTPS hostname for custom API connections.");return url.toString().replace(/\/$/,"");}
function getConnection(id:string):ProviderRow{const row=db.prepare("SELECT id,provider,base_url,protocol,model_id,credential FROM connections WHERE id=?").get(id) as ProviderRow|undefined;if(!row)throw new Error("Connection not found. Refresh Connections and select it again.");if(!safeStorage.isEncryptionAvailable())throw new Error("Secure credential storage is unavailable on this system.");return row;}
function decryptKey(row:ProviderRow){return safeStorage.decryptString(row.credential);}
function apiBase(row:ProviderRow){return row.provider==="opencode-zen"?"https://opencode.ai/zen/v1":publicCustomBase(row.base_url??"");}
function parseModels(payload:any):any[]{
 if(Array.isArray(payload))return payload;
 for(const candidate of [payload?.data,payload?.models,payload?.items,payload?.result?.data,payload?.result?.models])if(Array.isArray(candidate))return candidate;
 const keyed=payload?.data&&typeof payload.data==="object"?payload.data:payload?.models&&typeof payload.models==="object"?payload.models:payload;
 if(keyed&&typeof keyed==="object"){
  const values=Object.values(keyed);
  if(values.some((value:any)=>value&&typeof value==="object"&&(typeof value.id==="string"||typeof value.name==="string")))return values;
  const nested=values.flatMap((value:any)=>value?.models&&typeof value.models==="object"?Object.values(value.models):[]);
  if(nested.length)return nested;
 }
 return[];
}
function zeroPrice(value:any):boolean{return value===0||value==="0"||value==="$0"||typeof value==="string"&&/^free$/i.test(value.trim())||typeof value==="string"&&/^\$?0(?:\.0+)?$/.test(value.trim());}
function modelIsFree(item:any):boolean{
 if(item?.free===true||item?.is_free===true||item?.free_tier===true||String(item?.tier??"").toLowerCase()==="free"||String(item?.pricing?.tier??"").toLowerCase()==="free")return true;
 const inputPrice=item?.cost?.text?.input?.price??item?.cost?.input?.price??item?.pricing?.text?.input?.price??item?.pricing?.input?.price??item?.pricing?.input;
 if(inputPrice!==undefined&&zeroPrice(inputPrice))return true;
 const prices:any[]=[];
 const walk=(value:any,path:string)=>{if(!value||typeof value!=="object"){if(/(price|cost|input|output|prompt|completion)/i.test(path)&&(/price|cost/i.test(path)||typeof value==="number"||typeof value==="string"))prices.push(value);return;}for(const[key,child]of Object.entries(value))walk(child,path+"."+key);};
 walk(item?.cost??item?.pricing??item?.costs??item?.prices,"pricing");
 return prices.length>0&&prices.every(zeroPrice);
}
function modelFrom(item:any):ChatModel|null{
 const id=typeof item?.id==="string"?item.id:typeof item?.name==="string"?item.name:"";if(!id)return null;
 const api=item?.api&&typeof item.api==="object"?item.api:{};
 const apiEntry=Object.entries(api).find(([key,value]:[string,any])=>["chat-completions","responses","messages","anthropic-messages"].includes(key)&&value&&typeof value==="object");
 const apiProtocol=apiEntry?.[0]??"";
 const advertised=String(item?.protocol??item?.api_protocol??item?.api?.protocol??apiProtocol).toLowerCase();
 const protocol:ChatModel["protocol"]=advertised.includes("anthropic")||advertised.includes("messages")?"anthropic-messages":advertised.includes("responses")?"responses":advertised.includes("chat")?"chat-completions":zenProtocol(id)??(id.toLowerCase().startsWith("claude-")?"anthropic-messages":id.toLowerCase().startsWith("gpt-")?"responses":"chat-completions");
 const baseUrl=apiEntry&&typeof (apiEntry[1] as any).base_url==="string"?(apiEntry[1] as any).base_url:undefined;
 return{id,name:typeof item.name==="string"&&item.name!==id?item.name:id,protocol,free:modelIsFree(item)||id.toLowerCase().endsWith("-free"),baseUrl};
}
function manualModels(connectionId:string){return db.prepare("SELECT model_id AS id,name,protocol,free FROM connection_models WHERE connection_id=? ORDER BY created_at").all(connectionId) as {id:string;name:string;protocol:ChatModel["protocol"];free:number}[];}
async function discoverModels(row:ProviderRow){
 const key=decryptKey(row);
 const urls=row.provider==="opencode-zen"?["https://opencode.ai/inference/v1/models","https://opencode.ai/zen/v1/models"]:[new URL("models",apiBase(row)+"/").toString()];
 let lastError:unknown;
 for(const url of urls){
  try{
   const response=await fetch(url,{headers:{Authorization:"Bearer "+key,Accept:"application/json"},signal:AbortSignal.timeout(20000)});
   if(!response.ok)throw new Error("Model request failed ("+response.status+"): "+(await response.text()).slice(0,500));
   const items=parseModels(await response.json());
   const parsed=items.map((item:any)=>modelFrom(item)).filter((m:ChatModel|null):m is ChatModel=>Boolean(m&&m.id&&m.name));
   if(!parsed.length)throw new Error("The provider returned an empty or unsupported model catalogue.");
   return parsed;
  }catch(error){lastError=error;}
 }
 throw lastError instanceof Error?lastError:new Error("Could not load the provider model catalogue.");
}
function sharedDiscovery(row:ProviderRow){
 const inflight=modelInflight.get(row.id);if(inflight)return inflight;
 let tracked:Promise<ChatModel[]>;
 const pending=discoverModels(row).then(models=>{modelCache.set(row.id,{at:Date.now(),models});return models;});
 tracked=pending.finally(()=>{if(modelInflight.get(row.id)===tracked)modelInflight.delete(row.id);});
 modelInflight.set(row.id,tracked);
 return tracked;
}
async function fetchModels(connectionId:string,force=false){
 const row=getConnection(connectionId),manual=manualModels(connectionId),cached=modelCache.get(connectionId);
 let discovered:ChatModel[]=[];
 if(!force&&cached&&Date.now()-cached.at<MODEL_CACHE_TTL)discovered=cached.models;
 else{
  try{discovered=await sharedDiscovery(row);}
  catch(error){if(cached?.models.length)discovered=cached.models;else if(!manual.length)throw error;}
 }
 const merged=[...discovered];for(const item of manual){if(!merged.some(m=>m.id===item.id))merged.push({id:item.id,name:item.name,protocol:item.protocol,free:Boolean(item.free)});}
 if(!merged.length)throw new Error("The provider returned no models. You can still add a model ID manually.");
 return merged;
}
function touchConversation(conversationId:string,titleSource:string){
 const conversation=db.prepare("SELECT title FROM conversations WHERE id=?").get(conversationId) as{title:string}|undefined;
 const updatedAt=new Date().toISOString();
 if(conversation?.title==="New chat")db.prepare("UPDATE conversations SET title=?,updated_at=? WHERE id=?").run(titleSource.slice(0,60),updatedAt,conversationId);
 else db.prepare("UPDATE conversations SET updated_at=? WHERE id=?").run(updatedAt,conversationId);
}
function endpointFor(row:ProviderRow,model:ChatModel){const path=model.protocol==="responses"?"responses":model.protocol==="anthropic-messages"?"messages":"chat/completions";return new URL(path,(model.baseUrl??apiBase(row))+"/").toString();}
function toChatMessages(system:string,transcript:TranscriptMessage[]){
 const out:any[]=[];if(system)out.push({role:"system",content:system});
 for(const message of transcript){
  if(message.role==="tool"){out.push({role:"tool",tool_call_id:message.callId,content:message.content});continue;}
  if(message.role==="assistant"){out.push({role:"assistant",content:message.content||null,...(message.toolCalls?.length?{tool_calls:message.toolCalls.map(call=>({id:call.id,type:"function",function:{name:call.name,arguments:call.arguments}}))}:{})});continue;}
  out.push({role:"user",content:message.content});
 }
 return out;
}
function toolInput(raw:string){try{const value=JSON.parse(raw);return value&&typeof value==="object"?value:{};}catch{return{};}}
function toAnthropicMessages(transcript:TranscriptMessage[]){
 const out:{role:"user"|"assistant";content:any[]}[]=[];
 const add=(role:"user"|"assistant",blocks:any[])=>{if(!blocks.length)return;const last=out[out.length-1];if(last?.role===role)last.content.push(...blocks);else out.push({role,content:blocks});};
 for(const message of transcript){
  if(message.role==="user"){add("user",[{type:"text",text:message.content}]);continue;}
  if(message.role==="tool"){add("user",[{type:"tool_result",tool_use_id:message.callId,content:message.content}]);continue;}
  const blocks:any[]=[];if(message.content.trim())blocks.push({type:"text",text:message.content});
  for(const call of message.toolCalls??[])blocks.push({type:"tool_use",id:call.id,name:call.name,input:toolInput(call.arguments)});
  add("assistant",blocks);
 }
 if(out[0]?.role==="assistant")out.unshift({role:"user",content:[{type:"text",text:"(continuing)"}]});
 return out;
}
function toResponsesInput(transcript:TranscriptMessage[]){return transcript.map(message=>({role:message.role==="tool"?"user":message.role,content:[{type:"input_text",text:message.content}]}));}
async function streamRound(event:Electron.IpcMainInvokeEvent,row:ProviderRow,model:ChatModel,key:string,transcript:TranscriptMessage[],requestId:string,signal:AbortSignal,options:{system:string;tools:boolean}){
 const headers:Record<string,string>={"Content-Type":"application/json","Accept":"text/event-stream"};let body:any;
 if(model.protocol==="anthropic-messages"){
  headers["x-api-key"]=key;headers["anthropic-version"]="2023-06-01";
  body={model:model.id,max_tokens:8192,stream:true,messages:toAnthropicMessages(transcript)};
  if(options.system)body.system=options.system;
  if(options.tools)body.tools=[{name:RUN_COMMAND_TOOL.name,description:RUN_COMMAND_TOOL.description,input_schema:RUN_COMMAND_TOOL.parameters}];
 }else{
  headers.Authorization="Bearer "+key;
  if(model.protocol==="responses"){
   body={model:model.id,stream:true,input:toResponsesInput(transcript)};
   if(options.system)body.instructions=options.system;
  }else{
   body={model:model.id,stream:true,messages:toChatMessages(options.system,transcript)};
   if(options.tools){body.tools=[{type:"function",function:RUN_COMMAND_TOOL}];body.tool_choice="auto";}
  }
 }
 let full="";const calls:ToolCall[]=[],anthropicBlocks:ToolCall[]=[];
 const send=(text:string)=>{if(!text)return;full+=text;event.sender.send("chat:chunk",{requestId,delta:text});};
 const consume=(payload:any)=>{
  if(model.protocol==="chat-completions"){
   const delta=payload?.choices?.[0]?.delta;if(!delta)return;
   if(typeof delta.content==="string")send(delta.content);
   const parts:any[]=Array.isArray(delta.tool_calls)?delta.tool_calls:delta.function_call?[{index:0,function:delta.function_call}]:[];
   for(const part of parts){
    const index=typeof part.index==="number"?part.index:calls.length;
    while(calls.length<=index)calls.push({id:"",name:"",arguments:""});
    const call=calls[index];
    if(typeof part.id==="string"&&part.id)call.id=part.id;
    if(typeof part.function?.name==="string")call.name+=part.function.name;
    if(typeof part.function?.arguments==="string")call.arguments+=part.function.arguments;
   }
   return;
  }
  if(model.protocol==="responses"){
   if(payload?.type==="response.output_text.delta"||payload?.type==="response.refusal.delta")send(typeof payload.delta==="string"?payload.delta:"");
   return;
  }
  if(payload?.type==="content_block_start"&&payload?.content_block?.type==="tool_use"){
   anthropicBlocks[payload.index]={id:payload.content_block.id??"",name:payload.content_block.name??"",arguments:""};
   return;
  }
  if(payload?.type==="content_block_delta"){
   if(payload.delta?.type==="text_delta")send(typeof payload.delta.text==="string"?payload.delta.text:"");
   else if(payload.delta?.type==="input_json_delta"&&anthropicBlocks[payload.index])anthropicBlocks[payload.index].arguments+=payload.delta.partial_json??"";
  }
 };
 try{
  const response=await fetch(endpointFor(row,model),{method:"POST",headers,body:JSON.stringify(body),signal});
  if(!response.ok)throw new ProviderHttpError(response.status,"Provider request failed ("+response.status+"): "+(await response.text()).slice(0,1000));
  if(!response.body)throw new Error("The provider returned an empty response stream.");
  const reader=response.body.getReader(),decoder=new TextDecoder();let buffer="";
  while(true){const{done,value}=await reader.read();if(done)break;buffer+=decoder.decode(value,{stream:true});const lines=buffer.split(/\r?\n/);buffer=lines.pop()??"";for(const line of lines){if(!line.startsWith("data:"))continue;const raw=line.slice(5).trim();if(!raw||raw==="[DONE]")continue;try{consume(JSON.parse(raw));}catch{/* Ignore keepalive and non-JSON SSE lines. */}}}
  if(buffer.startsWith("data:")){const raw=buffer.slice(5).trim();if(raw&&raw!=="[DONE]")try{consume(JSON.parse(raw));}catch{}}
 }catch(error){
  if(signal.aborted)throw new StreamCancelledError(full);
  throw error;
 }
 const toolCalls=(model.protocol==="anthropic-messages"?anthropicBlocks:calls).filter(call=>Boolean(call.name)).map(call=>({...call,id:call.id||"call_"+randomUUID(),arguments:call.arguments||"{}"}));
 if(!full.trim()&&!toolCalls.length)throw new Error("The provider returned no text. Check whether the selected model supports this API.");
 return {text:full,toolCalls};
}
const CLI_BLOCK_PATTERN=/```cli[ \t]*\r?\n([\s\S]*?)```/gi;
function extractCliCommands(text:string){const commands:string[]=[];CLI_BLOCK_PATTERN.lastIndex=0;let match:RegExpExecArray|null;while((match=CLI_BLOCK_PATTERN.exec(text))&&commands.length<4){const command=match[1].trim();if(command)commands.push(command);}return commands;}
function stripCliBlocks(text:string){CLI_BLOCK_PATTERN.lastIndex=0;return text.replace(CLI_BLOCK_PATTERN,"").replace(/\n{3,}/g,"\n\n").trim();}
function parseCommandArguments(raw:string){try{const value=JSON.parse(raw);return typeof value?.command==="string"?value.command.trim():"";}catch{return"";}}
function cliSystemPrompt(workspace:string,native:boolean){
 return [
  "You are OPsCoder running in CLI mode. You can inspect and change the user's files by running shell commands.",
  "Platform: "+(process.platform==="win32"?"Windows with PowerShell":process.platform)+". Working directory: "+workspace,
  native?"Use the run_command tool to run commands. Run one command at a time and wait for its output.":"The run_command tool is not available in this chat. Reply with exactly one fenced block tagged cli containing the command. The app runs it and sends the output back.",
  "Keep commands short and non-interactive. Never start editors, REPLs, pagers, servers, ssh sessions, top, or anything that waits for input.",
  "The user must approve each command unless they enabled auto-approve for this chat. If a command is denied, do not retry it; ask the user how to proceed.",
  "Explain destructive or irreversible actions before running them. Read files before editing."
 ].join("\n");
}
function validWorkspace(path:string|null|undefined):path is string{if(!path||!isAbsolute(path))return false;try{return statSync(path).isDirectory();}catch{return false;}}
function workspaceFor(conversationId:string){const row=db.prepare("SELECT path FROM chat_workspaces WHERE conversation_id=?").get(conversationId) as{path:string}|undefined;return row?.path??null;}
function cliStatus(conversationId:string):CliStatus{const session=cliSessions.get(conversationId);return{enabled:Boolean(session?.enabled),workspace:workspaceFor(conversationId),autoApprove:Boolean(session?.autoApprove)};}
function historyTranscript(conversationId:string){
 const rows=db.prepare("SELECT role,kind,content,meta FROM messages WHERE conversation_id=? ORDER BY created_at,rowid").all(conversationId) as{role:"user"|"assistant";kind:string;content:string;meta:string|null}[];
 return rows.map((row):TranscriptMessage=>{
  if(row.kind!=="cli")return{role:row.role,content:row.content};
  let meta:any={};try{meta=row.meta?JSON.parse(row.meta):{};}catch{}
  const savedOutput=String(meta.output??"(no output)");
  const result=meta.denied?"The user denied this command.":"Exit code: "+(meta.exitCode??"unknown")+"\n"+(savedOutput.length>8000?savedOutput.slice(0,8000)+"\n[earlier output truncated]":savedOutput);
  return{role:"assistant",content:"[CLI command]\n"+row.content+"\n[CLI result]\n"+result};
 });
}
function insertMessage(conversationId:string,role:"user"|"assistant",content:string,kind:"text"|"cli",meta:Record<string,unknown>|null,connectionId:string|null,modelId:string|null){
 db.prepare("INSERT INTO messages(id,conversation_id,role,content,connection_id,model_id,created_at,kind,meta) VALUES(?,?,?,?,?,?,?,?,?)").run(randomUUID(),conversationId,role,content,connectionId,modelId,new Date().toISOString(),kind,meta?JSON.stringify(meta):null);
}
function denyApprovals(conversationId:string){for(const waiter of [...approvalWaiters.values()])if(waiter.conversationId===conversationId)waiter.resolve("deny");}
function requestApproval(event:Electron.IpcMainInvokeEvent,conversationId:string,requestId:string,command:string,workspace:string,signal:AbortSignal):Promise<ApprovalDecision>{
 const session=cliSessions.get(conversationId);
 if(!session?.enabled||signal.aborted)return Promise.resolve("deny");
 if(session.autoApprove)return Promise.resolve("always");
 const approvalId=randomUUID();
 return new Promise(resolve=>{
  let settled=false,timer:ReturnType<typeof setTimeout>|undefined;
  const finish=(decision:ApprovalDecision)=>{if(settled)return;settled=true;if(timer)clearTimeout(timer);approvalWaiters.delete(approvalId);signal.removeEventListener("abort",onAbort);resolve(decision);};
  const onAbort=()=>finish("deny");
  approvalWaiters.set(approvalId,{conversationId,requestId,resolve:finish});
  signal.addEventListener("abort",onAbort,{once:true});
  timer=setTimeout(()=>finish("deny"),5*60*1000);
  event.sender.send("cli:approval",{approvalId,conversationId,requestId,command,workspace});
 });
}
function killCommand(child:ChildProcess){try{if(process.platform==="win32"&&child.pid)spawn("taskkill",["/pid",String(child.pid),"/T","/F"],{windowsHide:true,stdio:"ignore"});else child.kill("SIGTERM");}catch{}}
function executeCommand(command:string,cwd:string,signal:AbortSignal):Promise<CommandResult>{
 return new Promise(resolve=>{
  if(signal.aborted){resolve({output:"",exitCode:null,timedOut:false,truncated:false,aborted:true});return;}
  let child:ChildProcess;
  try{
   child=process.platform==="win32"
    ?spawn("powershell.exe",["-NoLogo","-NoProfile","-NonInteractive","-ExecutionPolicy","Bypass","-Command","$OutputEncoding=[Console]::OutputEncoding=[Text.Encoding]::UTF8; "+command],{cwd,env:{...process.env,NO_COLOR:"1",TERM:"dumb"},windowsHide:true,stdio:["ignore","pipe","pipe"]})
    :spawn("/bin/bash",["-lc",command],{cwd,env:{...process.env,NO_COLOR:"1",TERM:"dumb"},windowsHide:true,stdio:["ignore","pipe","pipe"]});
  }catch(error){resolve({output:error instanceof Error?error.message:String(error),exitCode:null,timedOut:false,truncated:false,aborted:false});return;}
  let output="",timedOut=false,truncated=false,aborted=false,settled=false,timer:ReturnType<typeof setTimeout>|undefined;
  cliChildren.add(child);
  const onAbort=()=>{aborted=true;killCommand(child);};
  const finish=(exitCode:number|null)=>{if(settled)return;settled=true;if(timer)clearTimeout(timer);signal.removeEventListener("abort",onAbort);cliChildren.delete(child);resolve({output:truncated?output+"\n[output limit reached; command stopped]":output,exitCode,timedOut,truncated,aborted});};
  const append=(chunk:Buffer)=>{if(settled||truncated)return;output+=chunk.toString("utf8");if(output.length>CLI_MAX_OUTPUT){output=output.slice(0,CLI_MAX_OUTPUT);truncated=true;killCommand(child);}};
  signal.addEventListener("abort",onAbort,{once:true});
  if(signal.aborted)onAbort();
  timer=setTimeout(()=>{timedOut=true;killCommand(child);},CLI_TIMEOUT);
  child.stdout?.on("data",append);child.stderr?.on("data",append);
  child.on("error",error=>{output+=error.message;finish(null);});
  child.on("close",code=>finish(code));
 });
}
function formatCliOutput(result:CommandResult){const status=result.timedOut?"Command timed out after "+(CLI_TIMEOUT/1000)+" seconds.":result.truncated?"Command stopped after reaching the output limit (exit code "+(result.exitCode??"unknown")+").":"Exit code: "+(result.exitCode??"unknown");const body=result.output.trim()||"(no output)";return status+"\nOutput:\n"+(body.length>30000?body.slice(0,30000)+"\n[output truncated for the model]":body);}
function appendCommandOutput(transcript:TranscriptMessage[],native:boolean,callId:string,content:string){transcript.push(native?{role:"tool",callId,name:RUN_COMMAND_TOOL.name,content}:{role:"user",content:"[CLI result]\n"+content});}
async function runCliTurn(event:Electron.IpcMainInvokeEvent,row:ProviderRow,model:ChatModel,key:string,requestId:string,conversationId:string,workspace:string,signal:AbortSignal,transcript:TranscriptMessage[]){
 for(let round=0;round<CLI_MAX_ROUNDS;round++){
  if(signal.aborted)throw new StreamCancelledError("");
  if(!cliSessions.get(conversationId)?.enabled)return;
  let native=model.protocol!=="responses"&&nativeToolSupport.get(row.id)!==false;
  let result:{text:string;toolCalls:ToolCall[]};
  try{result=await streamRound(event,row,model,key,transcript,requestId,signal,{system:cliSystemPrompt(workspace,native),tools:native});}
  catch(error){
   if(native&&error instanceof ProviderHttpError&&[400,404,422].includes(error.status)){
    nativeToolSupport.set(row.id,false);native=false;
    result=await streamRound(event,row,model,key,transcript,requestId,signal,{system:cliSystemPrompt(workspace,false),tools:false});
   }else throw error;
  }
  const commands:{id:string;command:string}[]=[];
  for(const call of result.toolCalls){const command=parseCommandArguments(call.arguments);if(call.name===RUN_COMMAND_TOOL.name&&command)commands.push({id:call.id,command});}
  const fallbackCommands=result.toolCalls.length?[]:extractCliCommands(result.text);
  const usedFallback=fallbackCommands.length>0;
  if(usedFallback)fallbackCommands.forEach(command=>commands.push({id:"fallback_"+randomUUID(),command}));
  const display=usedFallback?stripCliBlocks(result.text):result.text;
  if(display.trim())insertMessage(conversationId,"assistant",display.trim(),"text",null,row.id,model.id);
  if(!commands.length)return;
  if(!cliSessions.get(conversationId)?.enabled)return;
  const nativeRound=result.toolCalls.length>0;
  transcript.push(nativeRound?{role:"assistant",content:result.text,toolCalls:result.toolCalls}:{role:"assistant",content:result.text});
  for(const command of commands){
   const decision=await requestApproval(event,conversationId,requestId,command.command,workspace,signal);
   if(signal.aborted)throw new StreamCancelledError("");
   if(!cliSessions.get(conversationId)?.enabled)return;
   if(decision==="deny"){
    insertMessage(conversationId,"assistant",command.command,"cli",{denied:true,cwd:workspace},row.id,model.id);
    event.sender.send("cli:result",{conversationId,requestId,command:command.command,workspace,denied:true});
    appendCommandOutput(transcript,nativeRound,command.id,"The user denied this command. Do not retry it unless the user asks.");
    continue;
   }
   event.sender.send("cli:result",{conversationId,requestId,command:command.command,workspace,denied:false,running:true});
   const run=await executeCommand(command.command,workspace,signal);
   insertMessage(conversationId,"assistant",command.command,"cli",{output:run.output,exitCode:run.exitCode,cwd:workspace,timedOut:run.timedOut,truncated:run.truncated,aborted:run.aborted},row.id,model.id);
   event.sender.send("cli:result",{conversationId,requestId,command:command.command,workspace,denied:false,exitCode:run.exitCode,timedOut:run.timedOut});
   if(signal.aborted||run.aborted)throw new StreamCancelledError("");
   appendCommandOutput(transcript,nativeRound,command.id,formatCliOutput(run));
  }
  const handled=new Set(commands.map(command=>command.id));
  for(const call of result.toolCalls)if(!handled.has(call.id))appendCommandOutput(transcript,true,call.id,"This tool call is not supported. Only run_command is available.");
 }
 throw new Error("CLI mode stopped after "+CLI_MAX_ROUNDS+" command rounds. Send another message to continue.");
}
function createWindow(){
 const win=new BrowserWindow({width:1440,height:920,minWidth:980,minHeight:680,backgroundColor:"#0b1017",webPreferences:{preload:join(__dirname,"../preload/index.js"),contextIsolation:true,nodeIntegration:false,sandbox:true,devTools:!app.isPackaged,webviewTag:false}});
 const devUrl=process.env.ELECTRON_RENDERER_URL,devOrigin=devUrl?new URL(devUrl).origin:"",allowNavigation=(url:string)=>{try{return Boolean(devOrigin&&new URL(url).origin===devOrigin);}catch{return false;}};
 win.webContents.setWindowOpenHandler(()=>({action:"deny"}));
 win.webContents.on("will-navigate",(event,url)=>{if(!allowNavigation(url))event.preventDefault();});
 win.webContents.on("will-redirect",(event,url)=>{if(!allowNavigation(url))event.preventDefault();});
 win.webContents.on("will-attach-webview",event=>event.preventDefault());
 if(devUrl)void win.loadURL(devUrl);else void win.loadFile(join(__dirname,"../renderer/index.html"));
}
function initDatabase(){db=new Database(join(app.getPath("userData"),"opscoder.sqlite"));db.pragma("journal_mode=WAL");db.pragma("foreign_keys=ON");db.exec(`
 CREATE TABLE IF NOT EXISTS connections(id TEXT PRIMARY KEY,provider TEXT NOT NULL,name TEXT NOT NULL,base_url TEXT,protocol TEXT NOT NULL,model_id TEXT,credential BLOB NOT NULL,created_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS conversations(id TEXT PRIMARY KEY,title TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
 CREATE TABLE IF NOT EXISTS messages(id TEXT PRIMARY KEY,conversation_id TEXT NOT NULL,role TEXT NOT NULL CHECK(role IN ('user','assistant')),content TEXT NOT NULL,connection_id TEXT,model_id TEXT,created_at TEXT NOT NULL,kind TEXT NOT NULL DEFAULT 'text',meta TEXT,FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS connection_models(connection_id TEXT NOT NULL,model_id TEXT NOT NULL,name TEXT NOT NULL,protocol TEXT NOT NULL,free INTEGER NOT NULL DEFAULT 0,created_at TEXT NOT NULL,PRIMARY KEY(connection_id,model_id),FOREIGN KEY(connection_id) REFERENCES connections(id) ON DELETE CASCADE);
 CREATE TABLE IF NOT EXISTS chat_workspaces(conversation_id TEXT PRIMARY KEY,path TEXT NOT NULL,created_at TEXT NOT NULL,FOREIGN KEY(conversation_id) REFERENCES conversations(id) ON DELETE CASCADE);
 `);const columns=db.prepare("PRAGMA table_info(connections)").all() as{name:string}[];if(!columns.some(c=>c.name==="base_url"))db.exec("ALTER TABLE connections ADD COLUMN base_url TEXT");
 const messageColumns=db.prepare("PRAGMA table_info(messages)").all() as{name:string}[];if(!messageColumns.some(c=>c.name==="kind"))db.exec("ALTER TABLE messages ADD COLUMN kind TEXT NOT NULL DEFAULT 'text'");if(!messageColumns.some(c=>c.name==="meta"))db.exec("ALTER TABLE messages ADD COLUMN meta TEXT");}
ipcMain.handle("connections:list",()=>db.prepare("SELECT id,provider,name,base_url,protocol,model_id,created_at FROM connections ORDER BY created_at").all());
ipcMain.handle("connections:add",(_event,raw:unknown)=>{const parsed=connectionInput.safeParse(raw);if(!parsed.success)throw new Error(parsed.error.issues[0]?.message??"Invalid connection details.");if(!safeStorage.isEncryptionAvailable())throw new Error("Secure credential storage is unavailable on this system.");const v=parsed.data,id=randomUUID(),createdAt=new Date().toISOString(),baseUrl=v.provider==="custom"?publicCustomBase(v.baseUrl!):null;const encrypted=safeStorage.encryptString(v.apiKey);db.prepare("INSERT INTO connections(id,provider,name,base_url,protocol,model_id,credential,created_at) VALUES(?,?,?,?,?,?,?,?)").run(id,v.provider,v.name,baseUrl,v.protocol,v.modelId??null,encrypted,createdAt);if(v.modelId)db.prepare("INSERT OR IGNORE INTO connection_models(connection_id,model_id,name,protocol,free,created_at) VALUES(?,?,?,?,0,?)").run(id,v.modelId,v.modelId,"chat-completions",createdAt);return{id,provider:v.provider,name:v.name,base_url:baseUrl,protocol:v.protocol,model_id:v.modelId??null,created_at:createdAt};});
ipcMain.handle("connections:remove",(_event,id:unknown)=>{if(typeof id!=="string"||id.length>64)throw new Error("Invalid connection ID.");db.prepare("DELETE FROM connections WHERE id=?").run(id);modelCache.delete(id);modelInflight.delete(id);return true;});
ipcMain.handle("connections:rename",(_event,raw:unknown)=>{const v=z.object({connectionId:z.string().uuid(),name:z.string().trim().min(1).max(64)}).parse(raw);const result=db.prepare("UPDATE connections SET name=? WHERE id=?").run(v.name,v.connectionId);if(!result.changes)throw new Error("Connection not found.");return true;});
ipcMain.handle("connections:add-model",(_event,raw:unknown)=>{const v=z.object({connectionId:z.string().uuid(),modelId:z.string().trim().min(1).max(200),name:z.string().trim().min(1).max(200).optional(),protocol:z.enum(["chat-completions","responses","anthropic-messages"]).default("chat-completions"),free:z.boolean().default(false)}).parse(raw);getConnection(v.connectionId);db.prepare("INSERT INTO connection_models(connection_id,model_id,name,protocol,free,created_at) VALUES(?,?,?,?,?,?) ON CONFLICT(connection_id,model_id) DO UPDATE SET name=excluded.name,protocol=excluded.protocol,free=excluded.free").run(v.connectionId,v.modelId,v.name??v.modelId,v.protocol,v.free?1:0,new Date().toISOString());db.prepare("UPDATE connections SET model_id=? WHERE id=?").run(v.modelId,v.connectionId);return true;});
ipcMain.handle("connections:models",async(_event,raw:unknown)=>{const parsed=modelInput.safeParse(raw);if(!parsed.success)throw new Error("Invalid connection selection.");return fetchModels(parsed.data.connectionId,parsed.data.force===true);});
ipcMain.handle("connections:set-model",(_event,raw:unknown)=>{const parsed=selectModelInput.safeParse(raw);if(!parsed.success)throw new Error("Invalid model selection.");const result=db.prepare("UPDATE connections SET model_id=? WHERE id=?").run(parsed.data.modelId,parsed.data.connectionId);if(!result.changes)throw new Error("Connection not found.");return true;});
ipcMain.handle("conversations:list",()=>db.prepare("SELECT id,title,created_at,updated_at FROM conversations ORDER BY updated_at DESC LIMIT 100").all());
ipcMain.handle("conversations:create",()=>{const id=randomUUID(),now=new Date().toISOString();db.prepare("INSERT INTO conversations(id,title,created_at,updated_at) VALUES(?,?,?,?)").run(id,"New chat",now,now);return{id,title:"New chat",created_at:now,updated_at:now};});
ipcMain.handle("messages:list",(_event,id:unknown)=>{if(typeof id!=="string"||!z.string().uuid().safeParse(id).success)throw new Error("Invalid conversation.");return db.prepare("SELECT id,role,content,connection_id,model_id,created_at,kind,meta FROM messages WHERE conversation_id=? ORDER BY created_at,rowid").all(id);});
ipcMain.handle("chat:send",async(event,raw:unknown)=>{
 const parsed=chatInput.safeParse(raw);if(!parsed.success)throw new Error(parsed.error.issues[0]?.message??"Invalid message.");
 const v=parsed.data,row=getConnection(v.connectionId),key=decryptKey(row);const existing=db.prepare("SELECT id FROM conversations WHERE id=?").get(v.conversationId);if(!existing)throw new Error("This conversation no longer exists. Start a new chat.");
 let model:ChatModel;try{const list=await fetchModels(row.id);const found=list.find(m=>m.id===v.modelId);if(!found)throw new Error("Selected model is not available.");model=found;}catch(error){if(row.provider==="custom"&&row.model_id===v.modelId)model={id:v.modelId,name:v.modelId,protocol:"chat-completions",free:false};else throw error;}
 const cliActive=Boolean(cliSessions.get(v.conversationId)?.enabled),workspace=workspaceFor(v.conversationId);
 if(cliActive&&!validWorkspace(workspace))throw new Error("The CLI workspace folder is missing. Choose another folder in the composer.");
 const transcript=historyTranscript(v.conversationId);transcript.push({role:"user",content:v.content});
 insertMessage(v.conversationId,"user",v.content,"text",null,row.id,model.id);
 const timeoutMs=cliActive?30*60*1000:180000,controller=new AbortController(),timeout=setTimeout(()=>controller.abort("timeout"),timeoutMs),record:StreamRecord={controller,cancelled:false};
 activeStreams.set(v.requestId,record);
 try{
  if(cliActive){
   await runCliTurn(event,row,model,key,v.requestId,v.conversationId,workspace!,controller.signal,transcript);
  }else{
   const answer=(await streamRound(event,row,model,key,transcript,v.requestId,controller.signal,{system:"",tools:false})).text;
   insertMessage(v.conversationId,"assistant",answer,"text",null,row.id,model.id);
  }
  touchConversation(v.conversationId,v.content);return{ok:true};
 }catch(error){
  if(error instanceof StreamCancelledError&&record.cancelled){
   const partial=stripCliBlocks(error.partial);
   if(partial)insertMessage(v.conversationId,"assistant",partial,"text",null,row.id,model.id);
   touchConversation(v.conversationId,v.content);return{ok:true,cancelled:true};
  }
  if(error instanceof StreamCancelledError)throw new Error("The provider request timed out after "+(timeoutMs/60000)+" minutes.");
  touchConversation(v.conversationId,v.content);throw error instanceof Error?error:new Error("The provider request failed.");
 }finally{
  clearTimeout(timeout);if(activeStreams.get(v.requestId)===record)activeStreams.delete(v.requestId);
 }
});
ipcMain.handle("chat:cancel",(_event,raw:unknown)=>{
 const parsed=cancelInput.safeParse(raw);if(!parsed.success)throw new Error("Invalid cancellation request.");
 const active=activeStreams.get(parsed.data.requestId);if(!active)return false;
 active.cancelled=true;active.controller.abort("cancelled");return true;
});
async function pickWorkspaceFolder(event:Electron.IpcMainInvokeEvent,defaultPath?:string|null){
 const win=BrowserWindow.fromWebContents(event.sender),options={title:"Choose a CLI workspace folder",properties:["openDirectory","createDirectory"] as ("openDirectory"|"createDirectory")[],defaultPath:validWorkspace(defaultPath)?defaultPath:app.getPath("home")};
 const result=win?await dialog.showOpenDialog(win,options):await dialog.showOpenDialog(options);
 if(result.canceled||!result.filePaths[0])return null;
 const workspace=resolve(result.filePaths[0]);if(!validWorkspace(workspace))throw new Error("That folder is no longer available. Choose another workspace.");return workspace;
}
function saveWorkspace(conversationId:string,workspace:string){db.prepare("INSERT INTO chat_workspaces(conversation_id,path,created_at) VALUES(?,?,?) ON CONFLICT(conversation_id) DO UPDATE SET path=excluded.path").run(conversationId,workspace,new Date().toISOString());}
ipcMain.handle("cli:status",(_event,raw:unknown)=>{const v=conversationRef.parse(raw);return cliStatus(v.conversationId);});
ipcMain.handle("cli:enable",async(event,raw:unknown)=>{
 const v=conversationRef.parse(raw);if(!db.prepare("SELECT id FROM conversations WHERE id=?").get(v.conversationId))throw new Error("This conversation no longer exists. Start a new chat.");
 if(!validWorkspace(workspaceFor(v.conversationId))){
  const workspace=await pickWorkspaceFolder(event,workspaceFor(v.conversationId));
  if(!workspace)return cliStatus(v.conversationId);
  saveWorkspace(v.conversationId,workspace);
 }
 cliSessions.set(v.conversationId,{enabled:true,autoApprove:false});
 return cliStatus(v.conversationId);
});
ipcMain.handle("cli:disable",(_event,raw:unknown)=>{const v=conversationRef.parse(raw);cliSessions.delete(v.conversationId);denyApprovals(v.conversationId);return cliStatus(v.conversationId);});
ipcMain.handle("cli:choose-workspace",async(event,raw:unknown)=>{
 const v=conversationRef.parse(raw),workspace=await pickWorkspaceFolder(event,workspaceFor(v.conversationId));
 if(!workspace)return cliStatus(v.conversationId);
 saveWorkspace(v.conversationId,workspace);return cliStatus(v.conversationId);
});
ipcMain.handle("cli:set-auto-approve",(_event,raw:unknown)=>{
 const v=cliToggleInput.parse(raw),session=cliSessions.get(v.conversationId);
 if(!session?.enabled)throw new Error("Turn on CLI mode first.");
 session.autoApprove=v.enabled;return cliStatus(v.conversationId);
});
ipcMain.handle("cli:decide",(_event,raw:unknown)=>{
 const v=cliApprovalInput.parse(raw),waiter=approvalWaiters.get(v.approvalId);
 if(!waiter)return false;
 if(v.decision==="always"){const session=cliSessions.get(waiter.conversationId);if(session?.enabled)session.autoApprove=true;}
 waiter.resolve(v.decision);return true;
});
app.whenReady().then(()=>{app.setAppUserModelId("run.place.gc.opscoder");app.setPath("userData",join(app.getPath("appData"),"opscoder"));session.defaultSession.setPermissionRequestHandler((_wc,_permission,callback)=>callback(false));session.defaultSession.setPermissionCheckHandler(()=>false);initDatabase();createWindow();app.on("activate",()=>{if(BrowserWindow.getAllWindows().length===0)createWindow();});}).catch(error=>{console.error("OPsCoder startup failed:",error);app.quit();});
app.on("before-quit",()=>{for(const child of cliChildren)killCommand(child);if(db?.open)db.close();});
app.on("window-all-closed",()=>{if(process.platform!=="darwin")app.quit();});
