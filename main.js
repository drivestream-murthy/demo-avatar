/* global LivekitClient */
/* Drivestream — Portrait Avatar (auto-start, no buttons)
   - Uses LiveKit UMD global (LivekitClient)
   - Auto-greets, detects university to change background, simple intents for ERP modules
   - Keeps the session alive; auto-restarts once if it closes
*/

const statusEl   = document.getElementById('status');
const bgEl       = document.getElementById('bg');
const dock       = document.getElementById('videoDock');
const frame      = document.getElementById('contentFrame');
const liveVideo  = document.getElementById('liveVideo');
const unmuteHint = document.getElementById('unmuteHint');

// Guard: ensure LivekitClient is present
if (!window.LivekitClient) {
  console.error('LivekitClient global not found. Check the <script> tag URL and that it loads before main.js.');
  if (statusEl) statusEl.textContent = 'Failed to load LiveKit. Hard refresh (Ctrl+Shift+R) and check network.';
}

const UNI_BG = {
  harvard:  './assets/harvard-university-title.jpg',
  oxford:   './assets/oxford-university-title.jpg',
  stanford: './assets/stanford-university-title.jpg',
  default:  './assets/default-image.jpg'
};

const MODULES = {
  one: {
    name: 'ERP Module 1: Finance & Accounting',
    brief: 'Financial accounting records, summarizes, and reports business transactions using financial statements.',
    synthesia: 'https://share.synthesia.io/dd552b45-bf27-48c4-96a6-77a2d59e63e7',
    youtube:   'https://www.youtube.com/embed/rWET1Jb0408?rel=0&modestbranding=1&autoplay=1'
  },
  two: {
    name: 'ERP Module 2: Human Resources (HR)',
    brief: 'HR manages the employee lifecycle—hiring, onboarding, payroll, performance, and compliance.',
    youtube:   'https://www.youtube.com/embed/I2oQuBRNiHs?rel=0&modestbranding=1&autoplay=1'
  }
};

// ---------- app state ----------
let room, sessionId, mediaStream;
let keepTimer = null;
let restarting = false;
let pendingVideo = null;

// ---------- utils ----------
const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const setStatus = (t) => { if (statusEl) statusEl.textContent = t; };

// tiny fetch helper
async function api(path, body) {
  const res = await fetch(path, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify(body || {})
  });
  let data = null;
  try { data = await res.json(); } catch {}
  if (!res.ok) throw new Error(`${path} ${res.status}: ${JSON.stringify(data)}`);
  return data;
}

// keepalive timer
function startKeepAlive() {
  stopKeepAlive();
  keepTimer = setInterval(() => {
    if (!sessionId) return;
    fetch('/api/keepalive', {
      method: 'POST',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({ session_id: sessionId })
    }).catch(()=>{});
  }, 25000); // every ~25s keeps the 180s idle window fresh
}
function stopKeepAlive() {
  if (keepTimer) clearInterval(keepTimer);
  keepTimer = null;
}

// send a “talk” task to HeyGen (with auto-recover once if session died)
async function talk(text) {
  if (!sessionId) return;
  try {
    await api('/api/task', { session_id: sessionId, text });
  } catch (err) {
    const msg = String(err);
    // server might respond with a 400 and message like "Session state wrong: closed"
    if (!restarting && (msg.includes('"10005"') || msg.includes('"10006"') || msg.toLowerCase().includes('state wrong: closed'))) {
      restarting = true;
      setStatus('Session expired — reconnecting…');
      try {
        await startAvatar(true); // soft restart
        await talk('I am back. Would you like ERP Module 1 or ERP Module 2, or something about Drivestream?');
      } finally {
        restarting = false;
      }
    } else {
      throw err;
    }
  }
}

// ---------- background & dock ----------
function changeBackgroundByUniversity(text) {
  const t = (text || '').toLowerCase();
  let picked = 'default';
  if (t.includes('harvard')) picked = 'harvard';
  else if (t.includes('oxford')) picked = 'oxford';
  else if (t.includes('stanford')) picked = 'stanford';
  if (bgEl) bgEl.style.backgroundImage = `url("${UNI_BG[picked]}")`;
  return picked;
}

function showDock(src) {
  return new Promise((resolve) => {
    if (dock) dock.style.display = 'block';
    if (frame) {
      frame.src = src;
      let swapped = false;
      const failover = () => {
        if (swapped) return;
        swapped = true;
        if (src.includes('synthesia') && MODULES.one.youtube) frame.src = MODULES.one.youtube;
      };
      frame.onload = () => resolve(true);
      frame.onerror = () => { failover(); resolve(false); };
    } else {
      resolve(false);
    }
  });
}
function hideDock() {
  if (frame) frame.src = 'about:blank';
  if (dock) dock.style.display = 'none';
}

// autoplay with sound politely
async function ensureAudio() {
  try {
    liveVideo.muted = false;
    await liveVideo.play();
    if (unmuteHint) unmuteHint.style.display = 'none';
  } catch {
    if (unmuteHint) unmuteHint.style.display = 'grid';
    const unlock = async () => {
      if (unmuteHint) unmuteHint.style.display = 'none';
      liveVideo.muted = false;
      try { await liveVideo.play(); } catch {}
      window.removeEventListener('pointerdown', unlock, {capture:true});
    };
    window.addEventListener('pointerdown', unlock, {capture:true, once:true});
  }
}

// ---------- connect & start ----------
async function startAvatar(softRestart = false) {
  if (!softRestart) setStatus('Starting in 2s…');
  await sleep(softRestart ? 0 : 2000);

  // if reconnecting, clean up existing
  if (room) {
    try { await room.disconnect(); } catch {}
    room = null;
  }
  stopKeepAlive();
  sessionId = null;

  setStatus('Creating session…');
  const info = await api('/api/session'); // { session_id, url, access_token }
  sessionId = info.session_id;

  setStatus('Connecting media…');
  room = new LivekitClient.Room();
  await room.connect(info.url, info.access_token);

  mediaStream = new MediaStream();
  liveVideo.srcObject = mediaStream;
  liveVideo.autoplay = true;
  liveVideo.playsInline = true;

  room.on(LivekitClient.RoomEvent.TrackSubscribed, (track) => {
    if (track.kind === 'video' || track.kind === 'audio') {
      mediaStream.addTrack(track.mediaStreamTrack);
    }
  });

  startKeepAlive();
  await sleep(300);
  await ensureAudio();

  // greet once per session
  if (!softRestart) {
    setStatus('Greeting…');
    await talk("Hi there! How are you? I hope you're doing good.");
    await sleep(800);
    await talk("What is your name, and where are you studying? You can just say 'I'm Alex from Oxford University'.");
    setStatus('Awaiting reply…');
  } else {
    setStatus('Reconnected.');
  }

  autoListen();
}

// ---------- STT (Chrome Web Speech API) ----------
let recognizer, listening = false;
function autoListen() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return; // non-Chrome browsers may not have this

  // already listening? don't duplicate
  if (listening) return;

  recognizer = new SR();
  recognizer.lang = 'en-US';
  recognizer.interimResults = false;
  recognizer.continuous = true;

  recognizer.onresult = async (e) => {
    const txt = e.results[e.results.length - 1][0].transcript.trim();
    await handleUserUtterance(txt);
  };
  recognizer.onend = () => { if (listening) recognizer.start(); };

  navigator.mediaDevices.getUserMedia({ audio: true })
    .then(() => { listening = true; recognizer.start(); })
    .catch(() => { /* mic denied → stay in voice-off mode */ });
}

// ---------- intent router ----------
async function handleUserUtterance(text) {
  if (!text) return;

  const uni = changeBackgroundByUniversity(text);
  if (uni !== 'default') {
    const pretty = uni[0].toUpperCase() + uni.slice(1);
    await talk(`Great to meet you! ${pretty} University is an excellent place. Welcome!`);
  }

  const t = text.toLowerCase();

  // Drivestream scope
  const about = ['drivestream','company','services','oracle','hcm','erp','partners','team','customers','subscription','ams','strategy','advisory'];
  if (about.some(k => t.includes(k))) {
    await talk("I can share about Drivestream's services, partners, team and customers. Ask me anything specific, or say 'ERP Module 1' or 'ERP Module 2'.");
    return;
  }

  // modules (robust to short forms)
  if (t.includes('module 1') || t.includes('finance') || t.includes('accounting')) {
    await explainAndOffer(MODULES.one, true);
    return;
  }
  if (t.includes('module 2') || t.includes('hr') || t.includes('human resources')) {
    await explainAndOffer(MODULES.two, false);
    return;
  }

  // yes/no after offer
  if (t === 'yes' || t.includes('play') || t.includes('show the video')) {
    if (pendingVideo) { await playVideo(pendingVideo); pendingVideo = null; return; }
  }
  if (t === 'no' || t.includes('skip')) {
    pendingVideo = null; hideDock();
    await talk('Okay. What would you like next—ERP Module 1 or Module 2?');
    return;
  }

  // fallback
  await talk("I might not have enough info on that. You can ask about Drivestream, or say 'ERP Module 1' or 'ERP Module 2'.");
}

async function explainAndOffer(mod, trySynthesia=false) {
  await talk(`${mod.name}. ${mod.brief}`);
  await sleep(600);
  await talk("Would you like to see a short video now? Say Yes or No.");
  pendingVideo = { kind: trySynthesia ? 'synthesia' : 'youtube', mod };
}

async function playVideo(choice) {
  const { mod, kind } = choice;
  const src = kind === 'synthesia' && mod.synthesia ? mod.synthesia : mod.youtube;
  await talk(`Loading the video for ${mod.name}.`);
  await sleep(300);
  await showDock(src);
}

// tidy up keepalive on unload
window.addEventListener('beforeunload', () => { stopKeepAlive(); });

// kick off
startAvatar().catch(err => {
  console.error(err);
  setStatus('Failed to start. See console.');
});
