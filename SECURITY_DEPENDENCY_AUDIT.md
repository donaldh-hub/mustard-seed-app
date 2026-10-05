# Dependency Security Audit

## Current result

`npm audit` reports **0 vulnerabilities**. The original audit reported 16 high
and 29 total findings.

All findings were removed by upgrading direct dependencies and locking
compatible patched transitive versions in `package.json` overrides. The
lockfile records the exact resolved dependency graph.

## Resolved upstream chains

### Drizzle migration tooling

The project uses the compatible stable Drizzle toolchain:
`drizzle-kit@0.31.10`, `drizzle-orm@0.45.2`, and `drizzle-zod@0.8.3`.
These releases are pinned exactly and the Zod integration supports the
project's stable Zod 3.25.x release.

The current stable Drizzle Kit still depends on the deprecated
`@esbuild-kit/esm-loader`. A scoped override pins only its
`@esbuild-kit/core-utils` dependency to the advisory-fixed
`esbuild@0.25.12`. This preserves the independent esbuild versions required
by Vite and tsx while removing the vulnerable nested esbuild from the resolved
dependency graph.

### Google Cloud Storage request stack

`@google-cloud/storage@8.0.1` replaces the legacy request dependencies with
`retry-request@9.0.1` and `teeny-request@11.0.1`. It requires Node.js 22, so
the project runtime is configured accordingly.

The remaining `gaxios@6` compatibility dependency is constrained to the
advisory-fixed `uuid@11.1.1` through an npm override. Gaxios uses the stable
UUID v4 API, which is retained by that release. The resulting resolved graph
contains no vulnerable esbuild, legacy retry request stack, or vulnerable UUID
release.

## Verification

- `npm audit --json`: 0 vulnerabilities
- `npm ci --dry-run --ignore-scripts --no-audit --no-fund`: succeeds
- `npm run build`: succeeds
- `npm exec drizzle-kit -- check --config drizzle.config.ts` loads the
  configuration and inspects the schema successfully
- `npm exec drizzle-kit -- --version` and `npm run db:push -- --help`: succeed
- `npm run dev`: starts the application and completes its schema startup
