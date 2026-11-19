import {useEffect,useMemo,useState} from "react";
import {Activity,Bot,Boxes,MessageSquare,Plug,Plus,Settings,ShieldCheck,Trash2,Waves,X,Zap} from "lucide-react";
type Page="chat"|"connections"|"models"|"settings";
export default function App(){
 const [page,setPage]=useState<Page>("chat"),[connections,setConnections]=useState<Connection[]>([]),[activeId,setActiveId]=useState(""),[showAdd,setShowAdd]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState("");
 const [provider,setProvider]=useState<"opencode-zen"|"custom">("opencode-zen"),[name,setName]=useState(""),[apiKey,setApiKey]=useState(""),[baseUrl,setBaseUrl]=useState(""),[modelId,setModelId]=useState("");
 const active=useMemo(()=>connections.find(c=>c.id===activeId),[connections,activeId]);
 async function refresh(){try{const items=await window.opscoder.connections.list();setConnections(items);setActiveId(cur=>items.some(c=>c.id===cur)?cur:(items[0]?.id??""));}catch(e){setError(e instanceof Error?e.message:"Could not load connections.");}}
 useEffect(()=>{void refresh();},[]);
 async function addConnection(){setBusy(true);setError("");try{const matches=connections.filter(c=>c.provider===provider),prefix=provider==="opencode-zen"?"OpenCode Zen":"Custom";
 const item=await window.opscoder.connections.add({provider,name:name.trim()||(matches.length?`${prefix} ${matches.length+1}`:prefix),apiKey,baseUrl:provider==="custom"?baseUrl.trim():undefined,protocol:provider==="opencode-zen"?"opencode-zen":"openai-chat-completions",modelId:modelId.trim()||undefined});
 setConnections(cur=>[...cur,item]);setActiveId(item.id);setShowAdd(false);setApiKey("");setName("");setBaseUrl("");setModelId("");
 }catch(e){setError(e instanceof Error?e.message:"Could not save connection.");}finally{setBusy(false);}}
 async function removeConnection(id:string){if(!window.confirm("Remove this connection and its saved API key?"))return;try{await window.opscoder.connections.remove(id);await refresh();}catch(e){setError(e instanceof Error?e.message:"Could not remove connection.");}}
 return <div className="shell"><aside className="sidebar"><div className="brand"><span className="brand-icon"><Waves size={20}/></span>OPsCoder</div>
 <button className="new-chat" onClick={()=>setPage("chat")}><Plus size={16}/>New chat</button><nav>
 <button className={page==="chat"?"active":""} onClick={()=>setPage("chat")}><MessageSquare size={17}/>Chats</button>
 <button className={page==="connections"?"active":""} onClick={()=>setPage("connections")}><Plug size={17}/>Connections</button>
 <button className={page==="models"?"active":""} onClick={()=>setPage("models")}><Boxes size={17}/>Models</button>
 <button className={page==="settings"?"active":""} onClick={()=>setPage("settings")}><Settings size={17}/>Settings</button></nav>
 <div className="side-caption">CONNECTIONS<button onClick={()=>setShowAdd(true)} aria-label="Add connection"><Plus size={14}/></button></div>
 <div className="connection-list">{connections.map(c=><button key={c.id} className={activeId===c.id?"connection active-connection":"connection"} onClick={()=>{setActiveId(c.id);setPage("chat");}}><i/>{c.name}</button>)}{!connections.length&&<p className="muted">No connections yet</p>}</div>
 <div className="sidebar-bottom"><ShieldCheck size={15}/>Local encrypted storage</div></aside>
 <main><header><span>{page==="chat"?"New chat":page[0].toUpperCase()+page.slice(1)}</span><span className="top-note"><Activity size={14}/>V1 desktop preview</span></header>
 {page==="chat"&&<section className="welcome"><div className="hero-icon"><Bot size={27}/></div><h1>Your AI workspace.</h1><p>Connect an API account to prepare your OPsCoder workspace.</p><div className="notice"><ShieldCheck size={17}/><span>Provider requests and AI streaming are not enabled in this preview yet.</span></div><button className="primary" onClick={()=>setShowAdd(true)}><Plus size={16}/>Add a connection</button>{active&&<div className="active-summary">Selected: <b>{active.name}</b> · {active.model_id||"No model selected"}</div>}</section>}
 {page==="connections"&&<section className="content"><div className="heading"><div><h1>Connections</h1><p>Manage API credentials saved on this device.</p></div><button className="primary" onClick={()=>setShowAdd(true)}><Plus size={16}/>Add connection</button></div>
 {connections.map(c=><article className="connection-card" key={c.id}><div className="provider-icon">{c.provider==="opencode-zen"?<Zap size={20}/>:<Plug size={20}/>}</div><div className="provider-details"><b>{c.name}</b><small>{c.provider==="opencode-zen"?"OpenCode Zen":"Custom OpenAI-compatible API"} · {c.model_id||"Model not selected"}</small></div>{activeId===c.id&&<span className="tag">Active</span>}<button className="remove" onClick={()=>void removeConnection(c.id)} aria-label={`Remove ${c.name}`}><Trash2 size={16}/></button><button className="secondary" onClick={()=>{setActiveId(c.id);setPage("chat");}}>Use</button></article>)}
 {!connections.length&&<div className="empty">No connections have been added yet.</div>}</section>}
 {page==="models"&&<section className="content"><div className="heading"><div><h1>Models</h1><p>Model discovery will arrive with provider integration.</p></div></div><div className="connection-card"><Boxes size={20}/><span>{active?`Active connection: ${active.name}`:"Select or add a connection first."}</span></div></section>}
 {page==="settings"&&<section className="content"><div className="heading"><div><h1>Settings</h1><p>OPsCoder desktop preferences.</p></div></div><div className="connection-card"><ShieldCheck size={19}/><span>API keys are encrypted with Electron safeStorage. Renderer processes never receive credentials.</span></div><div className="connection-card"><Bot size={19}/><span>Version 0.1.0 · Dark appearance</span></div></section>}</main>
 {error&&<div className="toast" role="alert">{error}<button onClick={()=>setError("")}><X size={14}/></button></div>}
 {showAdd&&<div className="overlay" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)setShowAdd(false);}}><form className="modal" onSubmit={e=>{e.preventDefault();void addConnection();}}>
 <div className="modal-title"><div><h2>Add connection</h2><p>Credentials stay inside the desktop main process.</p></div><button type="button" className="close" onClick={()=>setShowAdd(false)}><X size={18}/></button></div>
 <label>Provider</label><div className="tabs"><button type="button" className={provider==="opencode-zen"?"chosen":""} onClick={()=>setProvider("opencode-zen")}><Zap size={14}/>OpenCode Zen</button><button type="button" className={provider==="custom"?"chosen":""} onClick={()=>setProvider("custom")}><Plug size={14}/>Custom</button></div>
 <label>Connection name <small>Optional</small></label><input value={name} onChange={e=>setName(e.target.value)} maxLength={64} placeholder={provider==="opencode-zen"?"OpenCode Zen":"Custom"}/>
 {provider==="custom"&&<><label>API base URL</label><input type="url" value={baseUrl} onChange={e=>setBaseUrl(e.target.value)} placeholder="https://api.example.com/v1" required/></>}
 <label>API key</label><input type="password" value={apiKey} onChange={e=>setApiKey(e.target.value)} autoComplete="off" required maxLength={4096}/>
 {provider==="custom"&&<><label>Model ID <small>Optional</small></label><input value={modelId} onChange={e=>setModelId(e.target.value)} maxLength={200} placeholder="provider/model-name"/></>}
 <div className="modal-actions"><button type="button" className="secondary" disabled={busy} onClick={()=>setShowAdd(false)}>Cancel</button><button className="primary" disabled={busy||!apiKey.trim()}>{busy?"Saving…":"Save connection"}</button></div>
 <p className="footnote">This saves the connection locally. It does not test the API key or send requests yet.</p></form></div>}</div>;
}
