# Dependency Security Audit
## Current result
npm audit reports 0 high and 9 moderate findings. The original audit
reported 16 high and 29 total findings.
All high-severity findings were removed by upgrading direct dependencies and
locking compatible patched transitive versions in package.json overrides.
The lockfile records the exact resolved dependency graph.
## Remaining findings
The nine remaining records represent two upstream dependency chains. They are
documented here instead of applying incompatible or regressive automatic fixes.
### drizzle-kit development tooling (4 moderate records)
drizzle-kit@0.31.x depends on @esbuild-kit/esm-loader, which in turn pins
an unsupported esbuild@0.18.x. The audit's only proposed resolution is a
downgrade to drizzle-kit@0.18.1, a breaking regression that would not be a
safe security upgrade. This chain is a development-only migration tool and is
not included in the production server bundle.
Revisit when Drizzle publishes a release without @esbuild-kit/esm-loader, or
when the project changes its migration tooling.
### Google Cloud Storage legacy request chain (5 moderate records)
The current @google-cloud/storage@7.22.0 release still requires
retry-request@7, teeny-request@9, and gaxios@6, which bring in
uuid@9. The UUID advisory is fixed in version 11.1.1, but that major release
is outside the ranges required by these packages. The audit's suggested
resolution is to downgrade Cloud Storage to 5.18.3; that is a major
regression and does not constitute a safe remediation.
The directly patchable dependencies in this chain, including XML parsing,
multipart form handling, and proxy helpers, are explicitly locked to their
fixed compatible releases. Revisit when Cloud Storage removes or upgrades this
legacy request stack.
