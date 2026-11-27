@core.md

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
Do not write, edit, or commit code directly in the live Replit workspace.
Do not make changes to files from inside the running Replit session.

_(Scope note: this restriction is about the live Replit workspace itself.
It does not apply to Claude Code / GitHub-connected sessions that write
code and push commits to this repo — that is the normal dev workflow,
see Workflow below.)_

## Workflow
All code is built externally (Claude Code sessions pushing to GitHub) and
pushed to GitHub. GitHub auto-deploys to this Replit environment.
Inside the live Replit workspace itself, your only job is to run the app.
