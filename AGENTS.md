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

## PR review / merge policy

- For **Mission Control** repos, **Tom (Lead Architect)** is allowed to approve and merge PRs after review.
- Other agents should still hand work off for review; do **not** self-approve or self-merge your own PRs.
- Check `/data/.openclaw/shared/how-we-work/pr-standards.md` for review-readiness and evidence requirements.
- If Derrick explicitly asks for final review on a given PR, or if the change materially affects auth, security boundaries, or deploy behavior, escalate instead of merging on your own.

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
