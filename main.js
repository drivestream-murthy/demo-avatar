// top-level state
let room, sessionId, mediaStream, keepTimer, restarting = false;

// helper to ping server every 25s
function startKeepAlive() {
  stopKeepAlive();
  keepTimer = setInterval(() => {
    if (sessionId) fetch('/api/keepalive', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({ session_id: sessionId })
    }).catch(()=>{});
  }, 25000);
}
function stopKeepAlive() { if (keepTimer) clearInterval(keepTimer); keepTimer = null; }

// api() wrapper unchanged, but update talk() to auto-recover:
async function talk(text) {
  if (!sessionId) return;
  try {
    await api('/api/task', { session_id: sessionId, text });
  } catch (err) {
    // If session was closed (10005) or not found (10006), restart once
    const msg = String(err);
    if (!restarting && (msg.includes('"10005"') || msg.includes('"10006"') || msg.includes('Session state wrong: closed'))) {
      restarting = true;
      setStatus('Session expired — reconnecting…');
      await startAvatar(true); // soft restart
      restarting = false;
      // optional: resend a short confirmation
      await talk('I am back. What would you like to know next? ERP Module 1 or ERP Module 2, or something about Drivestream?');
    } else {
      throw err;
    }
  }
}
