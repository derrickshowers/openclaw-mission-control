# AGENTS.md — Mission Control Web

Repo-specific instructions for agents working in the Mission Control frontend repo.

## Repo identity

- **Project:** Mission Control
- **Repo slice:** Web
- **Editable source:** `/data/developer/repos/mission-control/web`
- **Production hostname:** `mission.showerstech.com`
- **Production API base:** `https://api.mission.showerstech.com`
- **Deploy target:** Vercel

## Deployment model

- Human/agent edits happen in `/data/developer/repos/mission-control/web`
- Production web comes from the Vercel deployment, not the local checkout
- In production, the web app calls `https://api.mission.showerstech.com`
- That API hostname is backed by the deployed API runtime under `/data/srv/mission-control/api/current`

## Local port convention

- `3000` = frontend dev server
- `3001` = live local API runtime (`mc-api`)
- `3002` = temporary API dev server for side-by-side testing

## Notes for agents

- No push = no deploy. Vercel only sees what is pushed to GitHub.
- Keep `MISSION_API_KEY` server-side only; do not expose it to the browser.
- Use the repo README for human-facing setup details; use this file for repo-specific agent rules.
