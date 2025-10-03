# Avatar Gen — Portrait ERP (Simple)

Minimal, from-scratch build:
- Portrait stage with top video dock
- One-time greeting → capture name + university → background auto-swap (Oxford/Harvard/Stanford/default)
- Voice input (Chrome Web Speech) + typed input fallback
- ERP Module 1/2 intros, ask to play video, dock appears above avatar
- HeyGen SDK via CDN (no bundler)
- Node.js 20.x functions (token endpoint)

## Deploy (Vercel)

1) Create a new Vercel project from this folder.
2) In **Settings → Environment Variables**, add:
   - `HEYGEN_API_KEY` = *your HeyGen API token*
3) Deploy.
4) Open `/api/token` — you should see `{ "token": "..." }`.
5) Open the site → **Start** → **Unmute** if needed.

## Change videos
- Edit `main.js`, `CFG.modules[x].video`.
  - YouTube: `{ provider: "youtube", src: "VIDEO_ID" }`
  - Synthesia share pages may block iframes by CSP; prefer YouTube while testing.
