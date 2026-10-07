# M10 real platform integration harness

Disposable, private Docker network only. All users, contact numbers, subscriptions
and assessment records are synthetic. Production source is copied into the test
image at startup; report endpoints, cookie authorization and database reads are real.

Build current `client/src` in retained `fayq-seo-client-test:20261006`, copy its
`dist` into `out/dist`, then run `build-player.cjs` in the same image. Mount this
directory as `/integration` and current client source as `/review-src:ro`; copy
the latter into `/srv/client/src` before the build. See the completion report for
the exact executed command. The build output is disposable, not committed source.

```powershell
docker compose -p m10-coordinator-integrated -f docker/m10-coordinator-integration/compose.yml up -d --wait web
docker compose -p m10-coordinator-integrated -f docker/m10-coordinator-integration/compose.yml run --rm --no-deps browser
```

`host.test.ts` seeds actual platform rows and serves the compiled app plus actual
Express routes. It waits for the driver's private `/__m10/finish` signal, then
closes its test-only HTTP host and dependencies. Each restart uses fresh course
identities; all data remains inside the disposable test database.

`player-*` fixtures replace presentation/auth context and external DASH transport,
using a native canvas video stream; platform playback grants, actual Player,
tracking hook/clock and HTTP APIs remain real. This does not test encrypted media
processing or the independently deployed DRM service.

`browser.mjs` uses Chromium with the actual app and APIs. The WhatsApp target
transport is deterministic and captures the requested URL without contacting an
external account. Privacy tests still use actual generated text and a fresh real
contact read. Agent 3 separately records native desktop/mobile browser evidence.
Failed earlier exploratory runs are not qualifications. Bounded Chromium shutdown
prevents hanging test-child processes. Evidence contains synthetic data only.

Before cleanup, inspect this project's container labels, **every mount**, network
membership, named volume and Redis anonymous-volume ownership/exclusivity. Only
then remove this exact project and its volumes. Preserve all retained previews,
peer work, reusable images and evidence; never globally prune Docker.
