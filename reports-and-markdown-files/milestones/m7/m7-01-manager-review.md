# M7 package 01 manager review

Date: 2026-10-01. Reviewed the actual uncommitted report and single README index row against the assigned package. No application, manifest, lockfile, DRM or gitlink changes were submitted. Platform remains `31ca60d3a2d832b704423060f3d55da7eae65ee3`; DRM remains clean at `bad0c1df9f5d5844fe365c402fcccfee33ab6906`.

**Disposition: readiness package accepted with documented corrections.** This completes the manager review of M7-01, not owner acceptance of M7 or production qualification. [M7-02](m7-02-open-code-worker-prompt.md) is a separate, bounded PostCSS remediation assignment for manual dispatch to OpenCode.

## Findings and corrections

1. **Incorrect serving-image exposure classification.** The worker classified all server findings as dev-only and said the Prisma chain was absent from runtime. Fresh `npm audit --omit=dev --json` returns three high rollup entries: `prisma`, `@prisma/config`, `deepmerge-ts`. Read-only filesystem inspection in the actual healthy preview confirms installed versions 6.19.3, 6.19.3 and 7.1.5. The lockfile marks the latter chain `devOptional`; the Prisma client has optional peers. Omitting dev dependencies did not exclude these packages. They roll up the [recursive-merge advisory](https://github.com/advisories/GHSA-ggr8-5vv4-36mx); package presence and audit severity do not establish a reachable remote attack path. Separate remediation is required; no supported safe fix target is yet verified. The worker report's exposure/risk wording is corrected.
2. **Stale external gates.** The worker repeated older open R2/CORS, tenant, RS256 and expiry checks as unresolved local verification. The later M5 continuation records successful attributed evidence, including final 65-check real playback, renewal, visible watermark/fullscreen and subscription expiry. Those historical results are preserved without rerunning them. Commercial DRM/Widevine, forensic guarantees, formal M5 acceptance and production/capacity gates remain separate. Corrected the report instead of creating duplicate external work.
3. **Working-tree wording.** The report claimed a clean tree after the package despite submitting two documentation changes. Corrected the wording to distinguish the clean audit checkpoint from the final submission. No unreported application change was found.

These are manager corrections to the readiness report, not application repairs. Original audit counts remain accurate. The broader Prisma exposure finding remains an open release issue and is not repaired by the client PostCSS package.

## Independent Docker reproduction

Inspected Docker containers/volumes before verification: five healthy preview services and its successful exited migration job; exactly the guarded PostgreSQL and Redis volumes. No preview stop, restart, migration or data mutation occurred.

Used cached `node:22-bookworm-slim`, image `sha256:43ac6c60b8f89723f746e8a92ce91abd5017e627ce1ddfe4238355d3a30b772c`, with `--rm --pull=never`, read-only client/server mounts and no volume declarations. Each audit was invoked inside Docker through Node `spawnSync`, with a 60-second timeout; only npm exit 0/1 plus valid non-error JSON counted as a completed audit.

| Check | Reproduced result |
| --- | --- |
| Server full `npm audit --audit-level=low --json` | Exit 1 for findings: 8 package entries, 1 critical / 4 high / 3 moderate |
| Client full equivalent | Exit 1 for findings: 3 entries, 1 high / 2 moderate |
| Server `npm audit --omit=dev --json` | Exit 1: 3 high Prisma-chain entries |
| Client production-only equivalent | Exit 0: 0 entries |
| `npm view postcss@8.5.28 version engines dependencies dist.integrity --json` | Version exists; Node engines include Node 22; dependencies nanoid ^3.3.18, picocolors ^1.1.1, source-map-js ^1.2.1 |
| Actual serving-container package inspection | Prisma CLI/config and deepmerge-ts installed; versions above |
| Client/server lockfile hashes | Match worker values; no lockfile changes |

Reproduction command shape, with each package as `<client-or-server>`:

```powershell
docker run --rm --pull=never --name m7-manager-audit-<client-or-server> `
  --mount "type=bind,source=<absolute-package-directory>,target=/audit,readonly" `
  -w /audit node:22-bookworm-slim node -e '<audit JSON validation and summary program>'
```

The full audit validation program calls `spawnSync('npm', ['audit', '--audit-level=low', '--json'], {encoding:'utf8', timeout:60000})`, rejects errors/status outside 0/1 and registry error JSON, and prints metadata, affected names/ranges/paths/fix information. The production audit uses `['audit','--omit=dev','--json']`. Metadata verification calls the `npm view` command above. Runtime inspection uses `docker exec education-platform-rs256-server-1 node -e` to read package JSON versions and lockfile dependency flags only, without importing application code, printing environment values or changing files.

The current registry offers PostCSS 8.5.28 as the same-major fix for the affected client lockfile. The source-map [maintainer advisory](https://github.com/advisories/GHSA-6g55-p6wh-862q) describes a CSS-input-dependent file-read risk; the full current audit also includes later source-map fixes and the CSS stringify advisory. This is a build-input exposure in this project, not evidence of student-request execution. Package 02 must independently confirm the patched resolved graph and fresh audit result after installation.

## Failure and cleanup record

One manager inspection attempt launched a network-disabled temporary container using the preview's original image-index ID. Docker no longer resolved that old index, so launch failed before starting; no package inspection was claimed from it. A subsequent read-only inspection of installed package files in the existing preview succeeded. This is an image-index availability limitation, not an application failure.

Audit outputs are summarized in this report; no environment values or private receipts were captured. Final read-only cleanup checks verify no `m7-manager-*` containers remain, the two existing volumes are unchanged, preview services remain healthy and lockfile hashes still match. No image pull, volume deletion, application upgrade, DRM mutation, commit or push belongs to this review.
