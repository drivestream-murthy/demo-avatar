export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const API_KEY = process.env.HEYGEN_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'Missing HEYGEN_API_KEY' });

  try {
    const newRes = await fetch('https://api.heygen.com/v1/streaming.new', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({
        version: 'v3',
        quality: 'high'
      })
    });

    const info = await newRes.json();
    if (!newRes.ok) {
      return res.status(newRes.status).json({ error: 'streaming.new failed', detail: info });
    }

    const startRes = await fetch('https://api.heygen.com/v1/streaming.start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`
      },
      body: JSON.stringify({ session_id: info.session_id })
    });
    const started = await startRes.json();
    if (!startRes.ok) {
      return res.status(startRes.status).json({ error: 'streaming.start failed', detail: started });
    }

    return res.status(200).json({
      session_id: info.session_id,
      url: info.url,
      access_token: info.access_token
    });
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) });
  }
}
