// /api/session.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const API_KEY = process.env.HEYGEN_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'Missing HEYGEN_API_KEY' });

  try {
    // 1) Create NEW session (v2), set idle to 30s
    const newRes = await fetch('https://api.heygen.com/v1/streaming.new', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': API_KEY,          // <-- use X-Api-Key
      },
      body: JSON.stringify({
        version: 'v2',                 // <-- v2 per current docs
        quality: 'high',
        activity_idle_timeout: 30      // your requested idle window
        // You can also pass avatar_id, voice, knowledge_base, etc. here
      }),
    });

    const newInfo = await newRes.json();
    if (!newRes.ok) {
      return res.status(newRes.status).json({ error: 'streaming.new failed', detail: newInfo });
    }

    const { session_id, url, access_token } = newInfo.data || {};
    if (!session_id || !url || !access_token) {
      return res.status(500).json({ error: 'streaming.new did not return required fields', detail: newInfo });
    }

    // 2) START the session
    const startRes = await fetch('https://api.heygen.com/v1/streaming.start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': API_KEY,
      },
      body: JSON.stringify({ session_id }),
    });
    const started = await startRes.json();
    if (!startRes.ok) {
      return res.status(startRes.status).json({ error: 'streaming.start failed', detail: started });
    }

    // 3) Return trimmed payload for the browser
    return res.status(200).json({ session_id, url, access_token });
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) });
  }
}
