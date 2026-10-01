# M7 package 06 — manager review

Date: 2026-10-01. Verdict: **assessment accepted; candidate is suitable for bounded follow-on implementation**, with the tighter override selector below. Application manifests and lockfiles remain unchanged. No commit, push, deployment or M7 milestone acceptance.

## Decision

Use a version-qualified override for the reviewed upstream parent, rather than carrying an override across unknown future Prisma config releases:

```json
"overrides": {
  "@prisma/config@6.19.3": {
    "deepmerge-ts": "8.0.2"
  }
}
```

Do not copy the disposable `//m7-06-experiment` manifest field into the application. Keep the tested-but-not-upstream-supported status in documentation. [Package 07](m7-07-open-code-worker-prompt.md) assigns the real-tree edit and verification; this review does not apply it.

## Independent evidence

The candidate lockfile differs at exactly `node_modules/deepmerge-ts`, 7.1.5 → 8.0.2. No nodes were added/removed. The candidate's scripts and dependency declarations match the current project after excluding only its override and disposable label. All 167 other source/config/test/migration inputs in the worker's temporary candidate copy were hash-identical to the current server inputs, including its Dockerfile. Current application manifest/lock hashes remain `F39139BCB85C53587E930A248031ACCD5AA69529935F0B0834D388542C997F51` and `BD3A5891CF6307991AE7381501B97E81954298D90D7D7828771D3605251B9AFE`.

Independently reproduced in a disposable non-root Docker container:

- Stock npm 10.9.9 frozen install, normal lifecycle scripts; actual Prisma validate, generate and version commands succeeded at 6.19.3.
- Full, omit-dev and omit-dev/optional candidate audit scopes each returned zero findings with exit 0 and valid JSON.
- Six strict differential cases matched the 7.1.5 results, including nested records, arrays, undefined/null and Date values. The old both-sides-cyclic input threw RangeError; the candidate returned without stack exhaustion.
- A genuine temporary `prisma.config.ts` using defineConfig loaded through the CLI, resolved the real schema/migration paths and validated successfully. This extends the worker's no-config current-project smoke; it is still finite compatibility evidence, not a guarantee for every possible config.
- Replacing the candidate's unqualified override with the exact `@prisma/config@6.19.3` selector, removing its experiment label, and reusing the frozen candidate lockfile passed another stock-npm install and actual config-file validation. The installed merge dependency remained 8.0.2.

The worker candidate images were digest-verified and exercised in **fresh manager-owned projects**; manager verification reused these images rather than claiming another independent image build:

| Target | Verified image index |
| --- | --- |
| Test | `sha256:41010652e5989e79a7721aa2e9c915809cfcbeb4f6351d1469509510de2e13ee` |
| Migration | `sha256:f5095fb740bc3b11ac184c2150a26a9757384a204fe544670fff480c2a276671` |
| Serving | `sha256:46f5c8636520f7f042996993a4b4cda326f51e448911de2495ae28b9abafdf64` |

Typecheck passed. Full suites passed 159/159 unit tests across 20 files and 251/251 integration tests across 30 files; JSON records show zero failures/pending tests and success=true, combined exit 0. Both fresh test/runtime databases contained nine completed migrations. A separate current-Compose unreachable-database drill produced migrate exit 1, Compose exit 1 and an unstarted server in created state.

Through the actual candidate serving image, the established isolated M7 financial helper passed native registration/login, student approval 403, exact 100000 credit/ledger match, private recharge approval notice, duplicate 409, exact 60000 purchase debit/40000 balance, exact 90-day span and 402 refusals. Its simulated media records serve financial testing only; no publication, real playback or DRM security evidence is inferred. Final runtime inventory confirmed CLI/config/deepmerge-ts absence, PrismaClient 6.19.3 construction, preserved native engine, successful native Argon2 hash/verify, pg/socket.io/express loading, no tests tree and non-root UID 999.

## Reachability and upstream status

Installed source confirms the dynamic deepmerge import is passed as c12's merger for local Prisma config loading, with remote extension disabled. No project `prisma.config.*` exists. The recorded current-config path is therefore dormant; a local config file is already executable code. This is scoped CLI availability exposure, not an evidenced remote platform HTTP exploit. A config-file author with arbitrary execution cannot be assumed harmless merely because the normal CLI later fails closed.

The [primary advisory](https://github.com/advisories/GHSA-ggr8-5vv4-36mx) identifies versions below 8.0.0 as affected and 8.0.0 as patched; unlike the worker's wording, GitHub currently assigns CVSS v4 **8.2**. A missing score in npm audit metadata is not an unassigned primary-source score. [The upstream v8 release notes](https://github.com/RebeccaStevens/deepmerge-ts/releases/tag/v8.0.0) document Map merging, circular support and API/type changes; plain-record probes cannot certify every custom Map or function configuration.

Fresh primary npm metadata confirms config 6.19.3 and highest stable config 7.10.0 each declare deepmerge-ts 7.1.5. Prisma's highest stable version is 7.10.0 while its current latest tag is 8.0.0-rc.19. Thus neither the reviewed 6.x parent nor the reviewed latest stable 7.x parent provides this upstream fix. A Prisma major migration is unnecessary for this scoped remedy and would not solve the reviewed 7.x pin. The override remains a project-maintained compatibility choice, not upstream endorsement. Reassess it when the parent version changes or upstream adopts a patched dependency.

## Cleanup, failure and remaining scope

The initial manager install failed because the non-root image's default npm cache path was not writable. It was rerun successfully using only a temporary writable cache; no sudo, permission bypass, force or peer workaround. The failed log is retained with successful probe/audit/JSON-suite/failure-gate evidence under ignored `docker/browser/evidence/m7-06-manager/`.

Three run-owned financial users/fixtures and their private receipt were removed. Every volume attachment was checked for exact project ownership before removing manager test/runtime/fail containers, networks and named/anonymous volumes. Base Redis images may allocate anonymous volumes even when Compose lists only named PostgreSQL volumes; those mounts were included in the checks. Existing port-8082 platform and M8 previews on 8083/8084 were preserved; DRM remains clean at `bad0c1df9f5d5844fe365c402fcccfee33ab6906`.

The application still has the three Prisma-chain build/migration findings until package 07 applies the reviewed fix. Serving scope remains separately clean. M7-05 independent review, M5 formal acceptance, M7 owner acceptance, commercial DRM, production operations and capacity qualification remain open; M8 work is preserved and separately reviewed.
