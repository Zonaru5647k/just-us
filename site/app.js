(function(){
"use strict";
const $=s=>document.querySelector(s);
const rnd=a=>a[Math.floor(Math.random()*a.length)];
const esc=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const hhmm=d=>d.toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
const cap=s=>s?s[0].toUpperCase()+s.slice(1):"";
const store=(k,v)=>{try{v===null?localStorage.removeItem(k):localStorage.setItem(k,v)}catch(e){}};
const load=k=>{try{return localStorage.getItem(k)}catch(e){return null}};
const MAX_MB=50;
const BUCKET="media";

const CFG=window.CONFIG||{};
const configured=CFG.SUPABASE_URL&&!/YOUR-PROJECT/.test(CFG.SUPABASE_URL)&&CFG.SUPABASE_KEY&&!/YOUR-/.test(CFG.SUPABASE_KEY);
const sb=configured?window.supabase.createClient(CFG.SUPABASE_URL,CFG.SUPABASE_KEY,{auth:{persistSession:true,autoRefreshToken:true}}):null;

const I={
 lock:'<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
 panic:'<svg viewBox="0 0 24 24"><path d="M3 3l18 18"/><path d="M10.6 5.1A10 10 0 0 1 12 5c6 0 10 7 10 7a17 17 0 0 1-3.2 3.8"/><path d="M6.2 6.3C3.6 8.1 2 12 2 12s4 7 10 7a9.6 9.6 0 0 0 4.3-1"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/></svg>',
 theme:'<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 1 0 0 18c1.2 0 1.8-.8 1.8-1.7 0-.5-.2-.9-.5-1.2-.3-.3-.5-.8-.5-1.2 0-1 .8-1.8 1.8-1.8H17a4 4 0 0 0 4-4c0-4.4-4-8.1-9-8.1z"/><circle cx="7.5" cy="11" r="1"/><circle cx="10" cy="7" r="1"/><circle cx="15" cy="7.5" r="1"/></svg>',
 plus:'<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
 send:'<svg viewBox="0 0 24 24"><path d="M5 12l14-7-5 15-3-6z"/></svg>',
 clock:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M12 8v4l3 2"/></svg>',
 tease:'<svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="2.5"/></svg>'
};
$("#icTheme").innerHTML=I.theme;$("#icLock").innerHTML=I.lock;$("#icPanic").innerHTML=I.panic;
$("#icPlus").innerHTML=I.plus;$("#icSend").innerHTML=I.send;$("#teaseBtn").innerHTML=I.tease;

const S=window.S={me:null,meId:null,partnerId:null,partnerName:"",msgs:[],timer:0,tease:false,typing:false,online:false,
 sheet:null,tab:{},drawn:{},todLvl:"Hot",jarLvl:"Any",heatMe:50,heatHer:50,jar:[],positions:[],stickers:{},urls:{},started:false,msgSel:null};
let pick=[];

/* ---------- screens ---------- */
const SCREENS=["login","lock","chat","calc"];
function show(id){if(id!=="chat")closeSheet();SCREENS.forEach(s=>{$("#"+s).hidden=s!==id})}
function toast(t){const d=document.createElement("div");d.className="toast";d.textContent=t;document.body.appendChild(d);setTimeout(()=>d.remove(),1900)}

/* ---------- auth ---------- */
$("#loginForm").addEventListener("submit",async e=>{
 e.preventDefault();
 if(!sb){$("#loginErr").textContent="Setup isn't finished: fill in config.js first.";return}
 $("#loginErr").textContent="";$("#loginBtn").disabled=true;
 const {data,error}=await sb.auth.signInWithPassword({email:$("#email").value.trim(),password:$("#password").value});
 $("#loginBtn").disabled=false;
 if(error){$("#loginErr").textContent="Wrong email or password.";return}
 $("#password").value="";
 afterAuth(data.user);
});

async function afterAuth(user){
 S.meId=user.id;
 const {data:members,error}=await sb.from("members").select("*");
 const me=members&&members.find(m=>m.user_id===user.id);
 if(error||!me){
  await sb.auth.signOut();show("login");
  $("#loginErr").textContent="This account isn't one of the two members. Add it to the members table first.";return;
 }
 const p=members.find(m=>m.user_id!==user.id);
 S.me=me.name;S.heatMe=me.heat;
 S.partnerId=p?p.user_id:null;S.partnerName=p?cap(p.name):(me.name==="shima"?"Tima":"Shima");S.heatHer=p?p.heat:50;
 $("#pname").textContent=S.partnerName;$("#av").textContent=S.partnerName[0];
 if(load(pinKey()))showLock("unlock");else showLock("set");
}
async function signOut(){store(pinKey(),null);if(sb)await sb.auth.signOut();location.reload()}

/* ---------- PIN ---------- */
const pinKey=()=>"ju-pin-"+S.meId;
async function hashPin(p){const b=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(S.meId+":"+p));return [...new Uint8Array(b)].map(x=>x.toString(16).padStart(2,"0")).join("")}
let pinMode="unlock",entry="",firstPin="";
function showLock(mode){
 pinMode=mode;entry="";firstPin="";drawDots();
 $("#lockMsg").textContent=mode==="set"?"Choose a 4-digit PIN for this device":"Enter your PIN";
 $("#forgotBtn").hidden=mode==="set";
 show("lock");
}
$("#pad").innerHTML=["1","2","3","4","5","6","7","8","9","","0","⌫"].map(k=>k?`<button data-pin="${k}" aria-label="${k==="⌫"?"Delete":k}">${k}</button>`:'<button class="blank" tabindex="-1" aria-hidden="true"></button>').join("");
$("#pad").addEventListener("click",e=>{const b=e.target.closest("[data-pin]");if(b)pinKeyPress(b.dataset.pin)});
document.addEventListener("keydown",e=>{if(!$("#lock").hidden){if(/^[0-9]$/.test(e.key))pinKeyPress(e.key);if(e.key==="Backspace")pinKeyPress("⌫")}});
function pinKeyPress(k){
 if(k==="⌫")entry=entry.slice(0,-1);else if(entry.length<4)entry+=k;
 drawDots();if(entry.length===4)pinDone();
}
function drawDots(){[...$("#dots").children].forEach((d,i)=>d.classList.toggle("on",i<entry.length))}
function shake(){const d=$("#dots");d.classList.remove("shake");void d.offsetWidth;d.classList.add("shake");setTimeout(()=>{entry="";drawDots()},350)}
async function pinDone(){
 const pin=entry;
 if(pinMode==="set"){
  if(!firstPin){firstPin=pin;entry="";drawDots();$("#lockMsg").textContent="Type it again";return}
  if(pin!==firstPin){firstPin="";shake();$("#lockMsg").textContent="Didn't match. Choose a PIN";return}
  store(pinKey(),await hashPin(pin));entry="";drawDots();enterChat();return;
 }
 if(await hashPin(pin)===load(pinKey())){entry="";drawDots();enterChat()}else shake();
}

/* auto-lock after a minute in the background */
let hiddenAt=0;
document.addEventListener("visibilitychange",()=>{
 if(document.hidden){hiddenAt=Date.now();return}
 if(!$("#chat").hidden&&hiddenAt&&Date.now()-hiddenAt>60000)showLock("unlock");
 markSeen();
});

/* ---------- chat ---------- */
function enterChat(){
 show("chat");
 if(!S.started){S.started=true;start()}else{render(true);markSeen()}
}
async function start(){
 renderControls();renderStatus();render(true);
 await loadMessages();
 subscribe();loadJar();loadPositions();loadStickers();
 setInterval(tick,1000);
}
async function loadMessages(){
 const {data,error}=await sb.from("messages").select("*").order("created_at",{ascending:false}).limit(500);
 if(error){toast("Couldn't load messages");return}
 S.msgs=data.reverse();render(true);markSeen();
}
function upsertLocal(m){
 const i=S.msgs.findIndex(x=>x.id===m.id);
 if(i>=0){const o=S.msgs[i];S.msgs[i]={...m,_revealed:o._revealed,_done:o._done}}
 else{S.msgs.push(m);S.msgs.sort((a,b)=>Date.parse(a.created_at)-Date.parse(b.created_at))}
 render();
}
function removeLocal(id){const n=S.msgs.length;S.msgs=S.msgs.filter(m=>m.id!==id);if(S.msgs.length!==n)render()}

let ch,typingT;
function subscribe(){
 ch=sb.channel("room",{config:{presence:{key:S.meId},broadcast:{self:false}}});
 ch.on("postgres_changes",{event:"*",schema:"public",table:"messages"},p=>{
   if(p.eventType==="DELETE"){removeLocal(p.old.id);return}
   const m=p.new;
   if(p.eventType==="INSERT"&&m.sender!==S.meId){S.typing=false;clearTimeout(typingT);renderStatus()}
   upsertLocal(m);
   if(p.eventType==="INSERT")markSeen();
  })
  .on("postgres_changes",{event:"*",schema:"public",table:"jar"},()=>loadJar())
  .on("postgres_changes",{event:"UPDATE",schema:"public",table:"members"},p=>{
   if(p.new.user_id===S.partnerId){S.heatHer=p.new.heat;renderStatus();if(S.sheet==="heat")renderSheet()}
  })
  .on("broadcast",{event:"typing"},()=>{
   S.typing=true;clearTimeout(typingT);
   typingT=setTimeout(()=>{S.typing=false;renderStatus();render()},3500);
   renderStatus();render();
  })
  .on("presence",{event:"sync"},()=>{S.online=Object.keys(ch.presenceState()).includes(S.partnerId);renderStatus()})
  .subscribe(async st=>{if(st==="SUBSCRIBED")await ch.track({on:true})});
}

/* ---------- render ---------- */
function ttlTxt(m){
 if(m.ttl==="once")return m.opened_at?"opened":"view once";
 if(m.expires_at){const s=Math.max(0,Math.round((Date.parse(m.expires_at)-Date.now())/1000));return s>=3600?Math.ceil(s/3600)+"h":s>=60?Math.ceil(s/60)+"m":s+"s"}
 return "";
}
function bodyHTML(m,mine){
 const d=`data-id="${m.id}"`,meta=m.meta||{};
 switch(m.type){
  case "text":return `<button class="bubble" data-act="msg" ${d}>${esc(m.body)}</button>`;
  case "tease":
   if(!m._revealed)return `<button class="bubble tease" data-act="reveal" ${d}><span class="cover">🔒 Tease text. Tap to reveal</span></button>`;
   return `<button class="bubble tease ${m._done?"done":""}" data-act="msg" ${d}>${String(m.body).split(" ").map((w,i)=>`<span class="w" style="animation-delay:${i*0.16}s">${esc(w)} </span>`).join("")}</button>`;
  case "image":case "video":{
   const lbl=m.type==="image"?"Photo":"Video";
   if(m.ttl==="once"){
    if(m.opened_at||!m.media_path)return `<button class="bubble ghost" data-act="msg" ${d}>${lbl} opened</button>`;
    if(mine)return `<button class="once" data-act="msg" ${d}><div><b>${m.type==="image"?"📷":"🎬"} ${lbl}</b><small>Sent as view once</small></div></button>`;
    return `<div class="once" data-hold="${m.id}" role="button" tabindex="0" aria-label="Hold to view"><div><b>${m.type==="image"?"📷":"🎬"} ${lbl}</b><small>View once. Hold to view</small></div></div>`;
   }
   if(!m.media_path)return `<button class="bubble ghost" data-act="msg" ${d}>${lbl} removed</button>`;
   const u=S.urls[m.media_path]||"";
   return `<button class="media" data-act="msg" ${d}>${m.type==="image"?`<img data-path="${esc(m.media_path)}" ${u?`src="${esc(u)}"`:""} alt="Photo">`:`<video data-path="${esc(m.media_path)}" ${u?`src="${esc(u)}"`:""} controls playsinline preload="metadata"></video>`}</button>`;
  }
  case "sticker":
   if(meta.src)return `<button class="sticker" data-act="msg" ${d}><div class="stk img"><img src="${esc(meta.src)}" alt="Sticker"></div></button>`;
   return `<button class="sticker" data-act="msg" ${d}><div class="stk"><span class="e">${esc(meta.e)}</span><span class="t">${esc(meta.t)}</span></div></button>`;
  case "card":return `<button class="card" data-act="msg" ${d}><small>${esc(meta.kind)}</small><b class="display">${esc(meta.title)}</b>${meta.sub?`<p>${esc(meta.sub)}</p>`:""}</button>`;
 }
 return `<div class="bubble ghost">Unsupported message</div>`;
}
function rowHTML(m){
 const mine=m.sender===S.meId;
 if(m.type==="notice"){
  const v=(m.meta||{}).heat;const l=heatLbl(v??0);
  return `<div class="notice">${mine?"You":esc(S.partnerName)} set heat to ${v} ${l[2]}</div>`;
 }
 const hasT=m.ttl==="once"||m.expires_at;
 return `<div class="row ${mine?"me":""}">${bodyHTML(m,mine)}<div class="meta"><span>${hhmm(new Date(m.created_at))}</span>${hasT?`<span class="ttl" data-ttl="${m.id}"></span>`:""}${mine?`<span>${m.seen_at?"Seen":"Sent"}</span>`:""}</div></div>`;
}
function render(forceBottom){
 const el=$("#msgs");if(!el)return;
 const near=el.scrollHeight-el.scrollTop-el.clientHeight<140;
 const want=S.msgs.map(m=>[m.id,rowHTML(m)]);
 if(!S.msgs.length)want.push(["empty",`<div class="empty-chat">Say hi 👋<br>Only you two can ever see this chat.</div>`]);
 if(S.typing)want.push(["typing",'<div class="row"><div class="bubble typing-dots" aria-label="typing"><i></i><i></i><i></i></div></div>']);
 const existing=new Map([...el.children].map(n=>[n._k,n]));
 let prev=null;
 for(const [k,h] of want){
  let n=existing.get(k);
  if(n&&n._h===h)existing.delete(k);
  else{
   if(n){existing.delete(k);n.remove()}
   const t=document.createElement("template");t.innerHTML=h.trim();n=t.content.firstElementChild;n._k=k;n._h=h;
  }
  const ref=prev?prev.nextSibling:el.firstChild;
  if(n!==ref)el.insertBefore(n,ref);
  prev=n;
 }
 existing.forEach(n=>n.remove());
 updateBadges();hydrate();
 if(near||forceBottom)el.scrollTop=el.scrollHeight;
}
function updateBadges(){document.querySelectorAll("[data-ttl]").forEach(e=>{const m=S.msgs.find(x=>x.id===e.dataset.ttl);if(m)e.textContent="⏱ "+ttlTxt(m)})}
const pending={};
function hydrate(){
 document.querySelectorAll("[data-path]:not([src])").forEach(async e=>{
  const p=e.dataset.path;
  if(!pending[p])pending[p]=sb.storage.from(BUCKET).createSignedUrl(p,21600).then(r=>{if(r.data)S.urls[p]=r.data.signedUrl;return r.data&&r.data.signedUrl});
  const u=await pending[p];
  if(u){document.querySelectorAll(`[data-path="${CSS.escape(p)}"]`).forEach(x=>{if(!x.getAttribute("src"))x.src=u});render()}
 });
}
function renderStatus(){
 const st=$("#status");
 st.textContent=S.typing?"typing...":S.online?"online":"offline";
 st.className=S.typing?"typing":"";
 $("#av").classList.toggle("on",S.online);
 $("#herHeatTxt").textContent=S.heatHer;$("#herHeatBar").style.width=S.heatHer+"%";
}
function renderControls(){
 const t=TIMERS[S.timer];
 $("#timerBtn").innerHTML=`<span class="ic">${I.clock}</span><span>${t[1]}</span>`;
 $("#timerBtn").classList.toggle("on",S.timer>0);
 $("#teaseBtn").classList.toggle("on",S.tease);
 $("#input").placeholder=S.tease?"Tease text: revealed word by word...":"Say something naughty...";
 $("#tray").innerHTML=[["moods","💬 Moods"],["games","🎲 Games"],["positions","🃏 Positions"],["jar","🫙 Fantasy jar"],["heat","🔥 Heat"],["stickers","✨ Stickers"]].map(([k,l])=>`<button class="chip" data-act="open" data-k="${k}">${l}</button>`).join("");
}

/* ---------- send / delete ---------- */
async function send(o){
 const t=TIMERS[S.timer][0];
 const row={type:o.type,body:o.body??null,meta:o.meta||{}};
 if(o.type==="notice"){}
 else if(t==="once"){if(o.type==="image"||o.type==="video")row.ttl="once"}
 else if(typeof t==="number"){row.ttl=String(t);row.expires_at=new Date(Date.now()+t*1000).toISOString()}
 if(o.file){
  if(o.file.size>MAX_MB*1048576){toast(`Too big. Max ${MAX_MB} MB per file`);return}
  const ext=((o.file.name.split(".").pop()||"").toLowerCase().replace(/[^a-z0-9]/g,"").slice(0,5))||"bin";
  const path=`${S.meId}/${crypto.randomUUID()}.${ext}`;
  toast("Uploading...");
  const up=await sb.storage.from(BUCKET).upload(path,o.file,{contentType:o.file.type||undefined,upsert:false});
  if(up.error){toast("Upload failed: "+up.error.message);return}
  row.media_path=path;S.urls[path]=URL.createObjectURL(o.file);
 }
 const {data,error}=await sb.from("messages").insert(row).select().single();
 if(error){toast("Couldn't send: "+error.message);if(row.media_path)sb.storage.from(BUCKET).remove([row.media_path]);return}
 upsertLocal(data);$("#msgs").scrollTop=$("#msgs").scrollHeight;
}
async function hardDelete(m){
 removeLocal(m.id);
 if(m.media_path)await sb.storage.from(BUCKET).remove([m.media_path]);
 const {error}=await sb.from("messages").delete().eq("id",m.id);
 return !error;
}
function sendInput(){
 const v=$("#input").value.trim();if(!v)return;
 send({type:S.tease?"tease":"text",body:v});
 $("#input").value="";autoGrow();
}
function autoGrow(){const t=$("#input");t.style.height="42px";t.style.height=Math.min(120,t.scrollHeight+2)+"px"}
let lastTyping=0;
$("#input").addEventListener("input",()=>{autoGrow();const n=Date.now();if(ch&&n-lastTyping>1500){lastTyping=n;ch.send({type:"broadcast",event:"typing",payload:{}})}});
$("#input").addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();sendInput()}});
$("#file").addEventListener("change",e=>{
 [...e.target.files].forEach(f=>send({type:f.type.startsWith("video")?"video":"image",file:f}));
 e.target.value="";
});

let seenBusy=false;
async function markSeen(){
 if(!sb||seenBusy||document.hidden||$("#chat").hidden)return;
 const ids=S.msgs.filter(m=>m.sender!==S.meId&&!m.seen_at&&m.type!=="notice").map(m=>m.id);
 if(!ids.length)return;
 seenBusy=true;const now=new Date().toISOString();
 ids.forEach(id=>{const m=S.msgs.find(x=>x.id===id);if(m)m.seen_at=now});
 await sb.from("messages").update({seen_at:now}).in("id",ids);
 seenBusy=false;
}
function tick(){
 const now=Date.now();
 S.msgs.forEach(m=>{if(m.expires_at&&Date.parse(m.expires_at)<=now&&!m._dying){m._dying=true;hardDelete(m)}});
 updateBadges();
}

/* view once: hold to view, gone on release */
let viewing=null;
document.addEventListener("pointerdown",async e=>{
 const h=e.target.closest("[data-hold]");if(!h)return;
 const m=S.msgs.find(x=>x.id===h.dataset.hold);if(!m||m.opened_at||!m.media_path)return;
 e.preventDefault();viewing=m;
 const v=document.createElement("div");v.className="viewer";v.id="viewer";v.innerHTML="<p>Loading...</p>";document.body.appendChild(v);
 const {data,error}=await sb.storage.from(BUCKET).createSignedUrl(m.media_path,60);
 if(viewing!==m){v.remove();return}
 if(error){v.remove();viewing=null;toast("Couldn't open it");return}
 v.innerHTML=(m.type==="image"?`<img src="${esc(data.signedUrl)}" alt="">`:`<video src="${esc(data.signedUrl)}" autoplay playsinline></video>`)+"<p>Let go to close. It's gone after this.</p>";
 v.dataset.shown="1";
});
async function endView(){
 if(!viewing)return;const m=viewing;viewing=null;
 const v=$("#viewer");const shown=v&&v.dataset.shown==="1";if(v)v.remove();
 if(!shown)return;
 const path=m.media_path;m.opened_at=new Date().toISOString();m.media_path=null;render();
 await sb.storage.from(BUCKET).remove([path]);
 await sb.from("messages").update({opened_at:m.opened_at,media_path:null}).eq("id",m.id);
}
document.addEventListener("pointerup",endView);document.addEventListener("pointercancel",endView);
document.addEventListener("contextmenu",e=>{if(e.target.closest("[data-hold]")||viewing)e.preventDefault()});

/* ---------- jar, positions, stickers ---------- */
async function loadJar(){
 const {data}=await sb.from("jar").select("*").order("created_at");
 S.jar=data||[];if(S.sheet==="jar")renderSheet();
}
async function loadPositions(){
 const {data}=await sb.from("positions").select("*").order("sort");
 S.positions=data||[];if(S.sheet==="positions")renderSheet();
}
async function loadStickers(){
 try{const r=await fetch("stickers/manifest.json",{cache:"no-store"});if(r.ok)S.stickers=await r.json()}catch(e){}
}

/* ---------- sheets ---------- */
const TITLES={moods:"Moods",games:"Games",positions:"Position of the night",jar:"Fantasy jar",heat:"Heat meter",stickers:"Stickers",themes:"Themes and settings",msg:"Message"};
function tabs(k,list){const cur=list.includes(S.tab[k])?S.tab[k]:list[0];S.tab[k]=cur;return `<div class="tabs">${list.map(t=>`<button class="chip ${t===cur?"on":""}" data-act="tab" data-k="${k}" data-v="${esc(t)}">${esc(t)}</button>`).join("")}</div>`}
const P=o=>{pick.push(o);return pick.length-1};
function bigCard(label,text,emptyTxt){return text?`<div class="big"><small>${esc(label)}</small><b>${esc(text)}</b></div>`:`<div class="big empty">${esc(emptyTxt)}</div>`}
function mixLine(){return `${rnd(MIX.a)}, ${rnd(MIX.b)} ${rnd(MIX.c)}`}
const card=(kind,title,sub)=>({type:"card",meta:{kind,title,sub}});
const sendTo=()=>"Send to "+(S.me==="shima"?"her":"him");

function sheetBody(k){
 pick=[];
 if(k==="moods"){
  const MOODS=moodsFor();const names=[...Object.keys(MOODS),"Mix it up"];let h=tabs("moods",names);const cur=S.tab.moods;
  if(cur==="Mix it up"){
   const d=S.drawn.mix||(S.drawn.mix=mixLine());
   h+=bigCard("Generated",d)+`<div class="row2"><button class="btn flex" data-act="remix">Another one</button><button class="btn pri flex" data-act="pick" data-i="${P({type:"text",body:d})}">Send</button><button class="btn" data-act="pick" data-i="${P({type:"tease",body:d})}">Send as tease</button></div>`;
  }else{
   h+=`<div class="list">${MOODS[cur].map(t=>`<button class="item" data-act="pick" data-i="${P({type:S.tease?"tease":"text",body:t})}"><span>${esc(t)}</span></button>`).join("")}</div><p class="note">${S.tease?"Tease mode is on, these send as tease texts.":"Turn on tease mode (eye button) to send these word by word."}</p>`;
  }
  return h;
 }
 if(k==="games"){
  let h=tabs("games",["Truth or Dare","Would You Rather","Never Have I Ever","Spicy Dice","Quiz"]);const cur=S.tab.games;
  if(cur==="Truth or Dare"){
   h+=`<div class="tabs">${["Warm","Hot","Fire"].map(l=>`<button class="chip ${S.todLvl===l?"on":""}" data-act="lvl" data-v="${l}">${l==="Warm"?"🙂":l==="Hot"?"🔥":"🥵"} ${l}</button>`).join("")}</div>`;
   const d=S.drawn.tod;
   h+=d?bigCard(`${d.lvl} · ${d.k}`,d.t):bigCard("","","Pick Truth or Dare");
   h+=`<div class="row2"><button class="btn flex" data-act="tod" data-v="truth">Truth</button><button class="btn flex" data-act="tod" data-v="dare">Dare</button>${d?`<button class="btn pri flex" data-act="pick" data-i="${P(card("Truth or Dare · "+d.lvl,d.k==="truth"?"Truth":"Dare",d.t))}">${sendTo()}</button>`:""}</div>`;
  }else if(cur==="Would You Rather"||cur==="Never Have I Ever"){
   const key=cur==="Would You Rather"?"wyr":"nhie";const src=key==="wyr"?WYR:NHIE;
   const d=S.drawn[key]||(S.drawn[key]=rnd(src));
   h+=bigCard(cur,key==="nhie"?"Never have I ever "+d:d);
   h+=`<div class="row2"><button class="btn flex" data-act="next" data-v="${key}">Next</button><button class="btn pri flex" data-act="pick" data-i="${P(card(cur,key==="wyr"?"Would you rather":"Never have I ever",d))}">${sendTo()}</button></div>`;
  }else if(cur==="Spicy Dice"){
   const d=S.drawn.dice||(S.drawn.dice={act:"?",where:"?",time:"?"});
   h+=`<div class="dice"><div class="die"><small>Do</small><b>${esc(d.act)}</b></div><div class="die"><small>Where</small><b>${esc(d.where)}</b></div><div class="die"><small>For</small><b>${esc(d.time)}</b></div></div>`;
   h+=`<div class="row2"><button class="btn flex" data-act="roll">Roll 🎲</button>${d.act!=="?"?`<button class="btn pri flex" data-act="pick" data-i="${P(card("Spicy Dice",d.act+" · "+d.where,"For "+d.time+". Owed next time we meet 😏"))}">${sendTo()}</button>`:""}</div>`;
  }else{
   h+=`<p class="note">Send a question. Every wrong answer means a dare.</p><div class="list">${QUIZ.map(q=>`<button class="item" data-act="pick" data-i="${P(card("Quiz · How well do you know me",q,"Wrong answer = dare 😈"))}"><span>${esc(q)}</span></button>`).join("")}</div>`;
  }
  return h;
 }
 if(k==="positions"){
  let h="";
  if(S.positions.length)h+=`<b>Yours · ${S.positions.length}</b><div class="grid">${S.positions.map((p,i)=>`<button class="pos" data-act="pick" data-i="${P(card("Position of the night",p.title,p.body))}"><span class="n">NO. ${String(i+1).padStart(2,"0")}</span><b class="display">${esc(p.title)}</b><p>${esc(p.body)}</p><span class="heat">🔥🔥🔥</span></button>`).join("")}</div>`;
  else h+=`<div class="big empty"><b style="font-size:16px">📁 positions/</b><span>Upload files to the positions folder in your repo and they show up here.</span></div>`;
  h+=`<b>Built-in</b><div class="grid">${POS.map((p,i)=>`<button class="pos" data-act="pick" data-i="${P(card("Position of the night",p[0],p[1]))}"><span class="n">NO. ${String(i+1).padStart(2,"0")}</span><b class="display">${esc(p[0])}</b><p>${esc(p[1])}</p><span class="heat">${"🔥".repeat(p[2])}</span></button>`).join("")}</div>`;
  return h;
 }
 if(k==="jar"){
  const c=l=>S.jar.filter(j=>j.level===l).length;
  let h=`<div class="field"><input type="text" id="jarText" placeholder="Drop a fantasy in. Nobody sees it until it's drawn" maxlength="300"><select id="jarLvl" aria-label="Level"><option>Soft</option><option selected>Hot</option><option>Extreme</option></select><button class="btn pri" data-act="jarAdd">Add</button></div>`;
  h+=`<div class="counts"><span>${S.jar.length} in the jar</span><span>Soft ${c("Soft")}</span><span>Hot ${c("Hot")}</span><span>Extreme ${c("Extreme")}</span></div>`;
  h+=`<div class="tabs">${["Any","Soft","Hot","Extreme"].map(l=>`<button class="chip ${S.jarLvl===l?"on":""}" data-act="jarLvl" data-v="${l}">${l}</button>`).join("")}</div>`;
  const d=S.drawn.jar&&S.jar.find(j=>j.id===S.drawn.jar.id);
  h+=d?bigCard(d.level+(d.author===S.meId?" · yours":" · "+S.partnerName+"'s"),d.body):bigCard("","",S.jar.length?"Draw to pull one out":"The jar is empty. Add the first one");
  h+=`<div class="row2"><button class="btn flex" data-act="jarDraw">Draw one</button>${d?`<button class="btn pri flex" data-act="pick" data-i="${P(card("Fantasy jar · "+d.level,"Drawn from the jar",d.body))}">${sendTo()}</button><button class="btn" data-act="jarDone">Done, remove it</button>`:""}</div>`;
  return h;
 }
 if(k==="heat"){
  const me=heatLbl(S.heatMe),her=heatLbl(S.heatHer);
  return `<div class="heatbig"><div class="lbl"><b class="display" id="hmLbl">${me[2]} ${me[1]}</b><span id="hmVal">You · ${S.heatMe}</span></div><input type="range" id="heat" min="0" max="100" value="${S.heatMe}" aria-label="Your heat"></div>
  <div class="heatbig"><div class="lbl"><b class="display">${her[2]} ${her[1]}</b><span>${esc(S.partnerName)} · ${S.heatHer}</span></div><div class="meter"><span style="width:${S.heatHer}%"></span></div></div>
  <button class="btn pri" data-act="heatShare">Share my heat</button>`;
 }
 if(k==="stickers"){
  const custom=S.stickers||{};
  const names=[...new Set([...Object.keys(STK),...Object.keys(custom)])];
  let h=tabs("stickers",names);const cur=S.tab.stickers;
  const emo=(STK[cur]||[]).map(s=>`<button class="stbtn" data-act="pick" data-i="${P({type:"sticker",meta:{e:s[0],t:s[1]}})}" aria-label="${esc(s[1])}"><div class="stk"><span class="e">${s[0]}</span><span class="t">${esc(s[1])}</span></div></button>`).join("");
  const img=(custom[cur]||[]).map(src=>`<button class="stbtn" data-act="pick" data-i="${P({type:"sticker",meta:{src}})}" aria-label="Sticker"><div class="stk img"><img src="${esc(src)}" alt="" loading="lazy"></div></button>`).join("");
  return h+`<div class="grid st">${img}${emo}</div>`;
 }
 if(k==="themes"){
  const cur=document.documentElement.dataset.skin||"velvet";
  return `<div class="skins">${SKINS.map(([id,n,dsc])=>{const c=SKINPV[id];return `<button class="skin ${cur===id?"on":""}" data-act="skin" data-v="${id}"><div class="pv" style="background:${c[0]}"><i style="background:${c[1]}"></i><i class="m" style="background:${c[2]}"></i></div><div class="lb"><b>${n}</b><small>${dsc}</small></div></button>`}).join("")}</div>
  <div class="settings"><div class="row2"><button class="btn flex" data-act="changePin">Change PIN</button><button class="btn flex" data-act="signout" id="soBtn">Sign out on this device</button></div><p class="note">Signed in as ${esc(cap(S.me))}.</p></div>`;
 }
 if(k==="msg"){
  const m=S.msgs.find(x=>x.id===S.msgSel);if(!m)return "";
  return `<p class="note">Deleting removes it for both of you, including the photo or video file.</p><div class="row2"><button class="btn flex" data-act="close">Cancel</button><button class="btn pri flex" data-act="del">Delete for both</button></div>`;
 }
 return "";
}
function openSheet(k){
 S.sheet=k;let sh=$("#sheet");
 if(!sh){
  sh=document.createElement("div");sh.id="sheet";sh.className="sheet";
  sh.innerHTML='<div class="panel" role="dialog" aria-modal="true"><div class="ph gut"><h2 class="display" id="shT"></h2><button class="iconbtn" data-act="close" aria-label="Close">✕</button></div><div class="pb gut" id="shB"></div></div>';
  document.body.appendChild(sh);sh.addEventListener("click",e=>{if(e.target===sh)closeSheet()});
 }
 $("#shT").textContent=TITLES[k];renderSheet();
}
function renderSheet(){
 const b=$("#shB");if(!b)return;const st=b.scrollTop;b.innerHTML=sheetBody(S.sheet);b.scrollTop=st;
 const r=$("#heat");if(r)r.addEventListener("input",()=>{S.heatMe=+r.value;const l=heatLbl(S.heatMe);$("#hmLbl").textContent=l[2]+" "+l[1];$("#hmVal").textContent="You · "+S.heatMe});
 const jt=$("#jarText");if(jt)jt.addEventListener("keydown",e=>{if(e.key==="Enter")act("jarAdd")});
}
function closeSheet(){const sh=$("#sheet");if(sh)sh.remove();S.sheet=null}

/* ---------- actions ---------- */
let soArmed=false;
async function act(a,el){
 const v=el&&el.dataset.v,k=el&&el.dataset.k,i=el?+el.dataset.i:NaN;
 switch(a){
  case "open":openSheet(k);break;
  case "close":closeSheet();break;
  case "tab":S.tab[k]=v;renderSheet();break;
  case "pick":{const o=pick[i];if(!o)return;closeSheet();await send(o);break}
  case "remix":S.drawn.mix=mixLine();renderSheet();break;
  case "lvl":S.todLvl=v;S.drawn.tod=null;renderSheet();break;
  case "tod":S.drawn.tod={lvl:S.todLvl,k:v,t:rnd(TOD[S.todLvl][v])};renderSheet();break;
  case "next":{const src=v==="wyr"?WYR:NHIE;let n;do{n=rnd(src)}while(n===S.drawn[v]&&src.length>1);S.drawn[v]=n;renderSheet();break}
  case "roll":{let n=0;const iv=setInterval(()=>{S.drawn.dice={act:rnd(DICE.act),where:rnd(DICE.where),time:rnd(DICE.time)};renderSheet();if(++n>=8)clearInterval(iv)},70);break}
  case "jarAdd":{
   const t=$("#jarText").value.trim();if(!t)return;
   const {error}=await sb.from("jar").insert({body:t,level:$("#jarLvl").value});
   if(error){toast("Couldn't add: "+error.message);return}
   toast("Dropped in the jar");loadJar();break;
  }
  case "jarLvl":S.jarLvl=v;renderSheet();break;
  case "jarDraw":{const pool=S.jar.filter(j=>S.jarLvl==="Any"||j.level===S.jarLvl);if(!pool.length){toast("Nothing at that level yet");return}S.drawn.jar=rnd(pool);renderSheet();break}
  case "jarDone":{const d=S.drawn.jar;if(!d)return;S.drawn.jar=null;await sb.from("jar").delete().eq("id",d.id);toast("Removed from the jar");loadJar();break}
  case "heatShare":{
   closeSheet();
   const {error}=await sb.from("members").update({heat:S.heatMe}).eq("user_id",S.meId);
   if(error){toast("Couldn't save heat");return}
   await send({type:"notice",meta:{heat:S.heatMe}});break;
  }
  case "skin":document.documentElement.dataset.skin=v;store("ju-skin",v);renderSheet();break;
  case "changePin":closeSheet();showLock("set");break;
  case "signout":
   if(!soArmed){soArmed=true;el.textContent="Tap again to sign out";setTimeout(()=>{soArmed=false;const b=$("#soBtn");if(b)b.textContent="Sign out on this device"},3000);return}
   signOut();break;
  case "forgot":
   if(!soArmed){soArmed=true;el.textContent="Tap again to sign out";setTimeout(()=>{soArmed=false;el.textContent="Forgot PIN? Sign out"},3000);return}
   signOut();break;
  case "msg":S.msgSel=el.dataset.id;openSheet("msg");break;
  case "del":{const m=S.msgs.find(x=>x.id===S.msgSel);closeSheet();if(m){const ok=await hardDelete(m);toast(ok?"Deleted for both":"Couldn't delete")}break}
  case "reveal":{const m=S.msgs.find(x=>x.id===el.dataset.id);if(m){m._revealed=true;render();setTimeout(()=>{m._done=true},String(m.body).split(" ").length*160+400)}break}
  case "send":sendInput();break;
  case "timer":S.timer=(S.timer+1)%TIMERS.length;renderControls();toast(S.timer?"Disappearing: "+TIMERS[S.timer][1]+(TIMERS[S.timer][0]==="once"?" (photos and videos)":""):"Disappearing off");break;
  case "tease":S.tease=!S.tease;renderControls();toast(S.tease?"Tease mode on":"Tease mode off");break;
  case "attach":$("#file").click();break;
  case "lock":showLock("unlock");break;
  case "panic":showCalc();break;
 }
}
document.addEventListener("click",e=>{const el=e.target.closest("[data-act]");if(el)act(el.dataset.act,el)});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&S.sheet)closeSheet()});

/* ---------- panic calculator: type your PIN then = to get back ---------- */
let cx="";
$("#keys").innerHTML=[["C","fn"],["±","fn"],["%","fn"],["÷","op"],["7"],["8"],["9"],["×","op"],["4"],["5"],["6"],["−","op"],["1"],["2"],["3"],["+","op"],["0","zero"],["."],["=","op"]].map(([k,c])=>`<button class="${c||""}" data-c="${k}">${k}</button>`).join("");
$("#keys").addEventListener("click",async e=>{
 const b=e.target.closest("[data-c]");if(!b)return;const k=b.dataset.c;
 if(k==="C")cx="";
 else if(k==="="){
  if(/^\d{4}$/.test(cx)&&S.meId&&await hashPin(cx)===load(pinKey())){cx="";$("#scr").textContent="0";enterChat();return}
  const ex=cx.replace(/×/g,"*").replace(/÷/g,"/").replace(/−/g,"-");
  if(/^[0-9+\-*/.% ]+$/.test(ex)){try{const r=Function('"use strict";return ('+ex.replace(/%/g,"/100")+")")();cx=Number.isFinite(r)?String(+r.toFixed(8)):"Error"}catch(_){cx="Error"}}
 }
 else if(k==="±"){if(cx&&!isNaN(+cx))cx=String(-cx)}
 else{if(cx==="Error")cx="";cx+=k}
 $("#scr").textContent=cx||"0";
});
function showCalc(){const v=$("#viewer");if(v)v.remove();viewing=null;cx="";$("#scr").textContent="0";show("calc")}

/* ---------- boot ---------- */
(async function boot(){
 const s=load("ju-skin");if(s&&SKINPV[s])document.documentElement.dataset.skin=s;
 if(!sb){show("login");$("#loginErr").textContent="Setup isn't finished: fill in config.js first.";return}
 const {data:{session}}=await sb.auth.getSession();
 if(!session){show("login");return}
 afterAuth(session.user);
})();
})();
