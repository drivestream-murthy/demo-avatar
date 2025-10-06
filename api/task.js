// /api/task.js
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const API_KEY = process.env.HEYGEN_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'Missing HEYGEN_API_KEY' });

  const { session_id, text } = req.body || {};
  if (!session_id || !text) return res.status(400).json({ error: 'session_id and text required' });

  try {
    const r = await fetch('https://api.heygen.com/v1/streaming.task', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': API_KEY,
      },
      body: JSON.stringify({
        session_id,
        text,
        task_type: 'chat',   // 'chat' = LLM; 'repeat' would just echo
        task_mode: 'sync'
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);
    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) });
  }
}
