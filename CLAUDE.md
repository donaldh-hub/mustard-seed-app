# Project conventions

## Git commits

After completing each significant feature or fix, automatically run:

```
git add -A
git commit -m "<descriptive message>"
```

The commit message should describe what changed and why, following the
repo's existing commit message style (see `git log`).

Do NOT push automatically — pushing to `origin main` triggers Replit's
auto-deploy, so pushes remain a manual, explicit step decided by the user.
