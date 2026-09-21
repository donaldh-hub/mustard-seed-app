---
name: Stable Drizzle toolchain
description: The compatibility and security constraints for the project's stable Drizzle migration packages.
---

Keep the stable Drizzle Kit, ORM, and Zod integration on their validated exact
versions, and scope the patched esbuild override only to the legacy loader's
core utility package.

**Why:** The current stable Drizzle Kit still declares the deprecated loader
with an old esbuild range. A global esbuild override also constrains Vite and
tsx, which require a newer esbuild line, making their dependency tree invalid.

**How to apply:** Upgrade the three Drizzle packages together. Retain the
`@esbuild-kit/core-utils`-scoped override while the stable Kit requires that
loader. Keep the empty migration journal committed when no migrations exist,
then validate the audit, Drizzle configuration check, production build, and app
startup.