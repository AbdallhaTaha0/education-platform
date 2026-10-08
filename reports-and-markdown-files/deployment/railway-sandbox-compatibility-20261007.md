# Railway grading sandbox compatibility — 2026-10-07

Owner authorized one short disposable test in `sweet-embrace` / `testing`, with
a maximum budget of $0.25. No platform or DRM deployment was authorized by this
test. Existing previews and real video were preserved.

## Execution and evidence

The official CLI login was confirmed through read-only project enumeration.
The SDK separately verified the exact project/environment identity before creation.
One sandbox was created with requested resources 0.5 vCPU / 1 GB, a one-minute
idle timeout, no injected application credentials, no public domains and
`ISOLATED` networking. This mode permits outbound internet; it does not mean
network-disabled execution. Student-code probes used Docker `--network none`.

| Probe | Actual result |
| --- | --- |
| VM JavaScript, synthetic square calculation | PASS, exit 0 |
| VM Python, synthetic square calculation | PASS, exit 0 |
| Docker daemon | PASS, exit 0; `runsc` absent |
| JavaScript in `node:22-alpine` Docker child | PASS, exit 0 |
| Python in `python:3.12-alpine` Docker child | PASS, exit 0 |

Both Docker child containers used read-only filesystems, no network, no mounts,
all capabilities dropped, no-new-privileges, 256 MB memory, 0.5 CPU and 64 PIDs.
They ran synthetic code only, with 60-second server deadlines, and removed
themselves after exit. These defaults were compatibility probes, not the final
production execution policy. Probe images used public tags, not qualified digests.

The SDK destroyed the single owned sandbox and confirmed no non-DESTROYED entry
for its identifier. Final output: `compatibilityPass=true cleanupConfirmed=true`,
process exit 0. No local containers, preview volumes, cloud services or application
data were changed. No secret values were logged or supplied to sandbox commands.
The account credential was read from the official CLI login file into orchestrator
memory only. Actual metered billing was not queried; this report does not claim a
measured charge.

## Conclusion and remaining gate

Railway Sandboxes can run JavaScript, Python and disposable Docker jobs. This
supersedes the earlier blanket assumption that Railway cannot host Docker-based
execution. It does **not** establish that an ordinary Railway service has a Docker
daemon, nor qualify the current grading implementation in production.

The existing production launcher requires `runsc`; the sandbox exposes no such
runtime. Preserve that guard. Before any adapter/migration, qualify the actual
execution images, Chromium sandbox and approved seccomp profile, isolation and
resource/timeout/cleanup behavior, private-test protection, authenticated queue
delivery and failure recovery. Any proposed VM-based replacement for the existing
runtime guard must be explicitly reviewed and owner-approved. Capacity and cost
qualification remain separate, including fair queuing for the 10,000-user target.

Reproducible probe: `.railway/sandbox-compatibility-probe.mjs`, pinned installed
Railway SDK 3.13.0. Running it again creates another billed sandbox and is not
part of this completed one-test authorization. It refuses a live sandbox in the
test environment and never deletes resources without its own returned handle.
If creation is accepted but the response is lost, the configured idle shutdown is
the fallback; such a failure is not reported as confirmed cleanup.

Official references: [Sandbox documentation](https://docs.railway.com/sandboxes)
and [Docker in Sandboxes](https://railway.com/changelog/2026-06-12-docker-in-sandboxes).
