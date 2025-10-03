/* ===== Simple portrait app with voice + typed Q&A, top video dock, bg-by-university ===== */

/* --- Config --- */
const CFG = {
  greetOnce: [
    "Hi there! How are you? I hope you're doing good.",
    "What is your name, and where are you studying?"
  ],
  universities: {
    harvard:  { key: "harvard",  img: "/assets/harvard-university-title.jpg",  pretty: "Harvard University"  },
    oxford:   { key: "oxford",   img: "/assets/oxford-university-title.jpg",   pretty: "Oxford University"   },
    stanford: { key: "stanford", img: "/assets/stanford-university-title.jpg", pretty: "Stanford University" },
    default:  { key: "default",  img: "/assets/default-image.jpg",             pretty: ""                    }
  },
  modules: {
    1: {
      name: "ERP Module 1: Finance & Accounting",
      summary: "Financial accounting records, summarizes, and reports business transactions via financial statements. We’ll cover ledgers, journal entries, trial balance, and reporting.",
      video: { provider: "youtube", src: "rWET1Jb0408" } // or synthesia: { provider: "synthesia", src: "https://share.synthesia.io/dd552b45-bf27-48c4-96a6-77a2d59e63e7" }
    },
    2: {
      name: "ERP Module 2: Human Resources (HR)",
      summary: "HR manages the entire employee lifecycle — recruiting, onboarding, payroll, benefits, performance, and compliance.",
      video: { provider: "youtube", src: "I2oQuBRNiHs" }
    }
  },
  faq: [
    { q: ["drivestream","what do you do","company"], a: "Drivestream is an Oracle Cloud consulting partner delivering strategy, implementation, and managed services across ERP and HCM." },
    { q: ["partners"], a: "We partner closely with Oracle and ecosystem providers to accelerate cloud adoption and value realization." },
    { q: ["oracle cloud erp"], a: "We implement Oracle Cloud ERP: financials, procurement, projects, and related modules, with change management and training." },
    { q: ["oracle cloud hcm","hcm"], a: "We deliver Oracle Cloud HCM for the full HR lifecycle—recruiting, onboarding, core HR, payroll, and talent." },
    { q: ["ams","managed services","support"], a: "Our AMS provides ongoing enhancement, support, and optimization after go-live." },
    { q: ["industries","financial services","retail","manufacturing","healthcare","utilities","professional services","high tech"], a: "We serve multiple industries including financial services, professional services, retail, high tech, utilities, healthcare, and manufacturing." },
    { q: ["meet the team","management","ceo","leaders"], a: "I don’t have individual names loaded yet. If you share a simple list (name + title), I’ll answer team questions precisely next time." }
  ],
  idleSeconds: 30
};

/* --- DOM --- */
const stage = document.getElementById("stage");
const dock = document.getElementById("dock");
const video = document.getElementById("avatarVideo");
const startBtn = document.getElementById("startBtn");
const stopBtn  = document.getElementById("stopBtn");
const unmuteBtn = document.getElementById("unmuteBtn");
const qbox = document.getElementById("qbox");
const sendBtn = document.getElementById("sendBtn");
const banner = document.getElementById("banner");
const logEl  = document.getElementById("log");

/* --- Logging --- */
function log(...a){ console.log("[app]", ...a); if (logEl){ logEl.textContent += a.join(" ")+"\n"; logEl.scrollTop = logEl.scrollHeight; } }
function showError(msg){ console.error(msg); banner.textContent = msg; banner.classList.add("show"); }
function clearError(){ banner.classList.remove("show"); banner.textContent = ""; }

/* --- HeyGen SDK (CDN for reliability) --- */
let StreamingAvatar, StreamingEvents, TaskType, AvatarQuality;
async function loadSDK(){
  if (StreamingAvatar) return;
  const mod = await import("https://cdn.jsdelivr.net/npm/@heygen/streaming-avatar@2/+esm");
  StreamingAvatar = mod.StreamingAvatar || mod.default;
  StreamingEvents = mod.StreamingEvents || mod.default?.StreamingEvents || {};
  TaskType = mod.TaskType || mod.default?.TaskType || { REPEAT:"REPEAT" };
  AvatarQuality = mod.AvatarQuality || mod.default?.AvatarQuality || { Medium: "medium" };
  if (!StreamingAvatar) throw new Error("StreamingAvatar class not found in SDK");
}

/* --- Token --- */
async function getToken(){
  const r = await fetch("/api/token");
  const j = await r.json().catch(()=>null);
  if (!r.ok || !j?.token) throw new Error("Token error: " + (j?.error || r.status));
  return j.token;
}

/* --- Audio unlock --- */
async function unlockAudio(){
  try{
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC){ const ctx = new AC(); if (ctx.state === "suspended") await ctx.resume(); }
  }catch{}
  try{
    video.muted = false;
    video.volume = 1.0;
    await video.play().catch(()=>{});
  }catch{}
}

/* --- App state --- */
let avatar=null, sid=null, active=false, greeted=false;
let user = { name:"", universityKey:"default" };

/* --- University background change --- */
function setUniversityBg(key){
  const map = CFG.universities;
  const which = map[key] || map.default;
  stage.style.backgroundImage = `url('${which.img}')`;
}

/* --- Video Dock --- */
let ytPlayer = null;
function ensureDock(on){
  if (on){ stage.classList.add("has-dock"); }
  else { stage.classList.remove("has-dock"); dock.innerHTML = ""; ytPlayer = null; }
}
function playModuleVideo(mod){
  const { provider, src } = CFG.modules[mod].video;
  ensureDock(true);
  if (provider === "youtube"){
    dock.innerHTML = `<div id="ytHolder" style="width:100%;height:100%"></div>`;
    const startYT = ()=>{
      ytPlayer = new YT.Player('ytHolder', {
        videoId: src,
        playerVars: { autoplay: 1, rel: 0, modestbranding: 1, playsinline: 1 },
        events: {
          'onReady': e => e.target.playVideo(),
          'onStateChange': e => {
            if (e.data === YT.PlayerState.ENDED) {
              ensureDock(false);
              avatarSpeak("Hope that helped! Would you like the other ERP module, or do you have another question about Drivestream?");
            }
          }
        }
      });
    };
    if (window.YT && window.YT.Player) startYT(); else window.onYouTubeIframeAPIReady = startYT;
  } else if (provider === "synthesia"){
    dock.innerHTML = `<iframe allow="autoplay; fullscreen" src="${src}" referrerpolicy="no-referrer-when-downgrade"></iframe>`;
    setTimeout(()=>{ avatarSpeak("When you're ready, close the video and I can continue to the next topic."); }, 2000);
  }
}

/* --- Simple intent engine --- */
function norm(s){ return (s||"").toLowerCase(); }
function includesAny(text, list){ text = norm(text); return list.some(k => text.includes(k)); }

function intentFrom(text){
  const t = norm(text);
  if (!user.name || user.universityKey==="default"){
    let uni = "default";
    if (t.includes("oxford")) uni="oxford";
    else if (t.includes("harvard")) uni="harvard";
    else if (t.includes("stanford")) uni="stanford";
    if (uni!=="default") return { type:"intro", university: uni, name: extractName(t) };
  }
  if (includesAny(t, ["module 1","finance","accounting","financial"])) return { type:"module", which:1 };
  if (includesAny(t, ["module 2","hr","human resources"]))          return { type:"module", which:2 };
  if (includesAny(t, ["show video","play video","start video","see video","watch"]))
    return { type:"showVideo", which: lastModuleChosen || null };
  for (const f of CFG.faq){
    if (includesAny(t, f.q)) return { type:"faq", answer: f.a };
  }
  return { type:"general", text: t };
}

function extractName(t){
  const m = t.match(/(?:i am|i'm|my name is)\s+([a-zA-Z]+(?:\s+[a-zA-Z]+)?)/);
  return m ? m[1] : "";
}

/* --- Voice (Web Speech API) --- */
let recog = null;
function startVoice(){
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR){ log("SpeechRecognition not available; use the text box."); return; }
  recog = new SR();
  recog.lang = "en-US";
  recog.continuous = true;
  recog.interimResults = false;
  recog.onresult = (ev)=>{
    const text = ev.results[ev.results.length-1][0].transcript.trim();
    log("User (voice):", text);
    route(text);
  };
  recog.onerror = (e)=> log("STT error:", e.error||e.message||e);
  recog.onend = ()=> { if (active) try{ recog.start(); }catch{} };
  try{ recog.start(); }catch{}
}

/* --- Avatar controls --- */
async function avatarSpeak(text){
  if (!sid || !avatar) return;
  try{
    await avatar.speak({ sessionId: sid, text, task_type: TaskType.REPEAT });
  }catch(e){
    showError("speak() failed: " + (e?.message||e));
  }
}

let lastModuleChosen = null;

async function route(input){
  clearError();
  const intent = intentFrom(input);

  if (intent.type==="intro"){
    if (intent.name) user.name = intent.name;
    if (intent.university){ user.universityKey = intent.university; setUniversityBg(intent.university); }
    await avatarSpeak(`Nice to meet you${user.name?`, ${user.name}`:""}! ${user.universityKey!=="default" ? `Great to hear from ${CFG.universities[user.universityKey].pretty}. ` : ""}Would you like to learn about ${CFG.modules[1].name}, or ${CFG.modules[2].name}? You can also ask anything about Drivestream.`);
    return;
  }

  if (intent.type==="module"){
    lastModuleChosen = intent.which;
    const mod = CFG.modules[intent.which];
    await avatarSpeak(`${mod.name}. ${mod.summary} Would you like me to play a short video now? Say yes or no.`);
    return;
  }

  if (intent.type==="showVideo" || /^(y|yes|yeah|sure|ok|okay)\b/i.test(input)){
    const which = intent.which || lastModuleChosen || 1;
    playModuleVideo(which);
    return;
  }
  if (/^(n|no|not now|later)\b/i.test(input)){
    await avatarSpeak("Okay, we can skip the video. Would you like to explore the other module or ask about Drivestream?");
    return;
  }

  if (intent.type==="faq"){
    await avatarSpeak(intent.answer);
    return;
  }

  if (intent.type==="general"){
    await avatarSpeak("I may not have enough information for that. You can ask about Drivestream’s services, partners, Oracle Cloud ERP or HCM, or say Module 1 or Module 2.");
    return;
  }
}

/* --- Start/Stop session --- */
async function startSession(){
  clearError();
  try{
    await loadSDK();
    await unlockAudio();
    const r = await fetch("/api/token");
    const j = await r.json().catch(()=>null);
    if (!r.ok || !j?.token) throw new Error("Token error: " + (j?.error || r.status));
    const token = j.token;

    const avatarCtor = StreamingAvatar;
    avatar = new avatarCtor({ token });

    avatar.on(StreamingEvents.ERROR,  e => showError("SDK ERROR: " + JSON.stringify(e)));
    avatar.on(StreamingEvents.STREAM_DISCONNECTED, ()=>{
      active=false; sid=null; startBtn.textContent="▶ Start"; log("STREAM_DISCONNECTED");
    });

    avatar.on(StreamingEvents.STREAM_READY, async (ev)=>{
      const stream = ev?.detail?.stream || ev?.detail || ev?.stream;
      if (!stream){ showError("STREAM_READY but no MediaStream"); return; }
      video.srcObject = stream;
      video.muted = false; video.volume = 1.0;
      try{ await video.play().catch(()=>{}); }catch{}
      let sink = document.getElementById("audioSink");
      if (!sink){ sink = document.createElement("audio"); sink.id="audioSink"; sink.style.display="none"; document.body.appendChild(sink); }
      sink.srcObject = stream; sink.muted=false; sink.volume=1.0;
      try{ await sink.play().catch(()=>{}); }catch{}
    });

    const session = await avatar.createStartAvatar({
      avatarName: "default",
      language: "en",
      quality: AvatarQuality.Medium,
      activityIdleTimeout: CFG.idleSeconds,
      knowledgeBase: "Greet only once at the start; then ask for the user's name and university. After that, be concise and friendly."
    });
    sid = session?.session_id;
    if (!sid) throw new Error("No session_id");

    active = true; startBtn.textContent="■ Stop";
    if (!greeted){
      greeted = true;
      for (const line of CFG.greetOnce){ await avatarSpeak(line); }
      startVoice();
    }else{
      await avatarSpeak("Welcome back. Say Module 1 or Module 2, or ask about Drivestream.");
      startVoice();
    }
  }catch(e){
    showError("Failed to start: " + (e?.message || e));
  }
}

async function stopSession(){
  try{ if (sid){ await fetch("/api/stop", { method:"POST" }); } }catch{}
  try{ avatar?.disconnect?.(); }catch{}
  active=false; sid=null; startBtn.textContent="▶ Start";
  try{ video.pause(); video.srcObject=null; }catch{}
}

/* --- Wire UI --- */
startBtn.addEventListener("click", ()=> active ? stopSession() : startSession());
stopBtn.addEventListener("click", stopSession);
unmuteBtn.addEventListener("click", unlockAudio);
sendBtn.addEventListener("click", ()=>{ const v=qbox.value.trim(); if(!v) return; qbox.value=""; log("User (typed):", v); route(v); });
qbox.addEventListener("keydown", e=>{ if(e.key==="Enter"){ sendBtn.click(); }});

/* --- Boot --- */
log("Ready. Click Start once. Then speak or type. Background will update when you say your university.");
