// /api/session.js  (replace file)
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const API_KEY = process.env.HEYGEN_API_KEY;
  if (!API_KEY) return res.status(500).json({ error: 'Missing HEYGEN_API_KEY' });

  // Short Drivestream “brain” for chat replies
  const KNOWLEDGE_PROMPT = `
You are "Drivestream Assistant", speaking concisely in 1–3 sentences.
Scope:
- Company: Drivestream (drivestream.com). If asked outside scope, say: "I might not have enough info on that."
- Practices & services: Oracle Cloud ERP, Oracle Cloud HCM & Payroll, Strategy & Advisory, AMS (Application Managed Services).
- Industries served: Financial Services, Professional Services, Retail, High-Tech, Utilities, Healthcare, Manufacturing.
- Partners & Customers: Talk generally unless specifics were already provided by the user.
- ERP learning path: two modules:
  • ERP Module 1 — Finance & Accounting: recording, summarizing, and reporting transactions via financial statements.
  • ERP Module 2 — Human Resources (HR): employee lifecycle—hiring, onboarding, payroll, performance, compliance.

Behavior:
- If user mentions "Module 1", "finance", or "accounting", answer about ERP Module 1.
- If user mentions "Module 2", "HR", or "human resources", answer about ERP Module 2.
- If asked something unrelated or unknown, say a gentle fallback as above.
- Keep a friendly tone; no long monologues; no code blocks; you are speaking aloud.
`;

  try {
    // 1) create session (v2) with inline knowledge base + longer idle window
    const newRes = await fetch('https://api.heygen.com/v1/streaming.new', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': API_KEY,
      },
      body: JSON.stringify({
        version: 'v2',
        quality: 'high',
        // Give users time to respond without closing the session.
        activity_idle_timeout: 180,  // seconds (min 30, max 3600)
        knowledge_base: KNOWLEDGE_PROMPT, // <— makes answers about Drivestream & your two modules
        // (optional) choose voice/avatar_id here if you want a fixed face/voice
        // avatar_id: 'default',
        // voice: { voice_id: 'v2_en_female_1', rate: 1.0 }
      }),
    });

    const newInfo = await newRes.json();
    if (!newRes.ok) {
      return res.status(newRes.status).json({ error: 'streaming.new failed', detail: newInfo });
    }

    const { session_id, url, access_token } = newInfo.data || {};
    if (!session_id || !url || !access_token) {
      return res.status(500).json({ error: 'streaming.new invalid response', detail: newInfo });
    }

    // 2) start
    const startRes = await fetch('https://api.heygen.com/v1/streaming.start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': API_KEY },
      body: JSON.stringify({ session_id }),
    });
    const started = await startRes.json();
    if (!startRes.ok) {
      return res.status(startRes.status).json({ error: 'streaming.start failed', detail: started });
    }

    return res.status(200).json({ session_id, url, access_token });
  } catch (e) {
    return res.status(500).json({ error: e.message || String(e) });
  }
}
