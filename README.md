# Mission Control v2 — Frontend

Next.js 15 dashboard for Raincheck team management.

## Stack

- **Next.js 15** (App Router)
- **HeroUI v3** (component library on Tailwind v3)
- **NextAuth.js** (Google OAuth)
- **TypeScript**

## Setup

```bash
npm install
cp .env.example .env.local
# Edit .env.local with real values
npm run dev
```

## Environment Variables

Required in `.env.local`:

```bash
# NextAuth
AUTH_SECRET=generate-with-openssl-rand-base64-32
GOOGLE_CLIENT_ID=your-google-oauth-client-id
GOOGLE_CLIENT_SECRET=your-google-oauth-client-secret

# API Proxy
MISSION_API_KEY=same-as-proxy-server
PROXY_API_URL=http://localhost:3001  # for dev
NEXT_PUBLIC_API_URL=https://api.mission.showerstech.com  # for production
```

## Deployment

This app deploys to **Vercel**.

### Production topology

- Frontend source repo: `/data/developer/repos/mission-control/web`
- Production web: `mission.showerstech.com`
- Production API: `https://api.showerstech.com`
- The production API is backed by the deployed runtime at `/data/srv/mission-control/api/current` inside the OpenClaw container.
- Note: `api.mission.showerstech.com` is used in some legacy docs but the current tunnel endpoint is `api.showerstech.com`.

### Vercel flow

1. Push this repo to GitHub
2. Connect to Vercel
3. Add environment variables in Vercel dashboard
4. Auto-deploys on push to `main`

## Structure

```
src/
├── app/
│   ├── api/proxy/           # Route handlers that forward to VPS proxy
│   ├── activity/            # Live activity feed
│   ├── memory/              # Agent memory browser
│   ├── tasks/               # Kanban board
│   ├── team/                # Agent hierarchy
│   └── login/               # Google OAuth login
├── components/
│   ├── shell/               # Sidebar, top bar, mobile nav
│   ├── tasks/               # Kanban, task cards, drawer
│   ├── team/                # Agent cards
│   ├── memory/              # File tree, markdown renderer
│   └── activity/            # Event feed with SSE
└── lib/
    ├── api.ts               # Typed API client
    ├── proxy.ts             # Proxy request helper
    └── auth.ts              # NextAuth config
```

## Pages

| Route | Description |
|-------|-------------|
| `/` | Dashboard overview |
| `/tasks` | Kanban task board |
| `/team` | Agent hierarchy & controls |
| `/memory` | Browse agent memory files |
| `/activity` | Live event feed (SSE) |
| `/login` | Google OAuth sign-in |

## Design

- **Dark theme** (#080808 background, #121212 surfaces)
- **Fonts:** Inter (UI), JetBrains Mono (code)
- **Borders:** 1px solid #222222
- **High density:** Minimal padding, Linear-inspired aesthetic
- **Responsive:** Desktop sidebar, mobile bottom nav

## Development

```bash
npm run dev     # Start dev server (http://localhost:3000)
npm run build   # Production build
npm run start   # Serve production build
npm run lint    # ESLint
```

## Notes

- All API calls go through Next.js Route Handlers in `/api/proxy/*` which forward to the VPS proxy with auth
- The `MISSION_API_KEY` is never exposed to the browser — it's server-side only
- SSE activity feed connects directly to `api.mission.showerstech.com/api/activity/stream` from the browser
- Tailwind v3 is used (not v4) for HeroUI compatibility

## Built By

Michael (Full Stack Engineer, Raincheck team)
