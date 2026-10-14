# Mustard Seed — Agent Instructions

## Role
These rules apply to Replit's Agent only. Claude Code sessions may edit,
commit, and push on `claude/*` branches (never directly to `main`).

**Claude Code merge rule (Donald, Oct 14, 2026):** always merge your own PRs
into `main` once they are validated (typecheck, build, and tests pass; no
merge conflict) — no need to ask first. Exception: a PR Donald has put on
hold (e.g. "don't merge yet", "waiting on legal") stays unmerged until he
says otherwise. Merging does not deploy: the live site only changes after
Donald pulls and republishes in Replit.

This Replit environment is for HOSTING ONLY.
Do not write, edit, or commit code here.
Do not run git add, git commit, or git push.
Do not make changes to any files.

## Workflow
All code is built externally and pushed to GitHub.
GitHub auto-deploys to this Replit environment.
Your only job here is to run the app.
