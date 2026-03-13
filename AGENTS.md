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

## Push policy

**Mission Control repos do not require PRs.** Push directly to `main` when your work is ready.

### Before pushing:

1. **Test your changes** locally
2. **Complete UI quality checklist** (see below) if UI work
3. **Verify no regressions** (avatars, mentions, theming, etc.)
4. **Build passes** (`npm run build` for web)
5. **Add task comment** summarizing what you pushed

### When to get review first:

- **Security changes** (auth, permissions, API keys)
- **Architecture changes** (new services, major refactors)
- **Deploy behavior changes** (build config, environment setup)
- **When Derrick explicitly asks** for review before pushing

For everything else: test it, push it, mark task done.

**Speed matters.** PRs create ceremony and delay. Push with confidence.

## UI quality standards

Before marking UI work done or opening a PR:

1. Complete the checklist in `/data/.openclaw/shared/how-we-work/ui-quality-checklist.md`
2. Test in **both light and dark modes**
3. Verify **no regressions** to existing features (avatars, mentions, interactive elements)
4. Include screenshots in PR (light mode, dark mode, mobile if applicable)

These are **mandatory** for any UI changes. We've had multiple regressions from skipping these checks.

## Notes for agents

- No push = no deploy. Vercel only sees what is pushed to GitHub.
- Keep `MISSION_API_KEY` server-side only; do not expose it to the browser.
- Use the repo README for human-facing setup details; use this file for repo-specific agent rules.
