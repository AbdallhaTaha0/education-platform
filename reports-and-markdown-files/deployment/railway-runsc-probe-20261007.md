# Railway runsc prerequisite test — 2026-10-07

Verdict: **NOT QUALIFIED** with the tested upstream release and existing grading
restrictions. Installation works, but the minimal runtime workload cannot start.
This is not proof that every gVisor configuration or release is incompatible with
Railway. No application deployment or isolation-policy downgrade was performed.

The owner instructed `start` after the actual-image compatibility PASS, assigning
this runtime prerequisite. The tests remained in `sweet-embrace` / `testing`,
within the earlier additional $0.25 test budget on bounded resource/time estimates.

## Harness and installation

`.railway/sandbox-grading-probe.mjs --runsc` adds an early runtime gate before
building or running the actual grading images. It uses one newly owned disposable
VM per attempt, at most 2 vCPU / 2 GB, ISOLATED networking, no public domains or
application secrets, one-minute idle shutdown and a ten-minute wall watchdog.
Only the VM's own Docker configuration may change; the local Docker daemon,
owner preview and platform/DRM deployments are untouched.

The official upstream full `gvisor.tar.bz2` archive, including required sidecar
binaries, was downloaded over HTTPS and verified against its SHA-512 file before
installation. Observed runtime: **release-20260928.0**, OCI spec **1.2.1**.
Observed VM kernel: **6.18.46-railway**; Docker server: **29.1.2**.
Docker runtime registration and daemon reload succeeded after Docker warm-up.
Debug/panic logging was enabled only for the synthetic test, with diagnostics
saved to ignored local evidence before destruction.

## Attempts

| Attempt | Result | Elapsed |
| --- | --- | --- |
| Initial install/reload | SHA-512 verified; install completed; reload could not find a daemon PID | 34 s |
| Docker warm-up then install | Install/registration PASS; restricted hello-world exits 125 with StartRoot EOF | 31 s |
| Runtime debug capture | Same startup failure; panic captured in runtime logs | 39 s |
| Smoke with existing Python resource limits | 192 MB / 1 CPU / 32 PIDs; same failure | 29 s |
| Smoke with existing JavaScript resource limits | 768 MB / 1 CPU / 256 PIDs; same failure | 30 s |

All smoke jobs kept `--runtime runsc`, no network, read-only root, all capabilities
dropped and no-new-privileges. The initial 64 MB smoke was stricter than either
grading profile; later results rule out **only that overly narrow smoke profile**
as the explanation. They do not establish the exact underlying kernel/runtime
cause or rule out every resource-related issue.

Actual observed diagnostic:

```text
OCI runtime start failed ... containerManager.StartRoot ... EOF
panic: failed to create a syscall thread
... pkg/sentry/platform/systrap ... initSyscallThread ...
```

The minimal image was `hello-world`, observed digest
`sha256:5e23090353324d887c48ad5e5c56d294eab81588df9605b07d1afe895f9cc8f8`.
Both grading suites were deliberately **NOT RUN under runsc** because this
prerequisite failed. The earlier 18 browser groups and 18 Python checks passed
under ordinary Docker restrictions; those results are not runsc results.

## Cleanup, preservation and evidence

Every attempt ended with `cleanupConfirmed=true`: the owned sandbox was destroyed
and no non-DESTROYED entry remained for its identifier. Final official CLI listing
of the testing environment returned `[]`. No checkpoints, services, public domains,
tenant records, students, course assets or persistent application volumes were
created. The runsc installation, daemon configuration and debug files disappeared
with the corresponding owned VM.

Ignored local JSONL evidence:

- `.railway/probe-evidence/grading-1791379287755.jsonl` — initial reload issue.
- `.railway/probe-evidence/grading-1791379536228.jsonl` — installation and EOF.
- `.railway/probe-evidence/grading-1791379645091.jsonl` — runtime debug capture.
- `.railway/probe-evidence/grading-1791379741456.jsonl` — panic header with Python limits.
- `.railway/probe-evidence/grading-1791379844640.jsonl` — existing JavaScript limits.

Total attempt durations: 163 seconds. Compute at requested resource ceilings is
estimated at approximately $0.013, excluding small outbound traffic. Actual bills
were not queried. No further test was started after the larger-profile failure.
No platform/DRM source, production guards or local service settings changed.
Nothing committed or pushed.

## Next decision

Keep the existing `GRADING_ISOLATION_UNQUALIFIED` guard. Do not substitute `runc`,
disable Chromium's sandbox, add privileges or remove resource restrictions to
make production pass. A separate Linux execution host with qualified runsc is
the recommended deployment path while this Railway prerequisite is unresolved;
the backend/DRM Railway and frontend Vercel plan can remain intact. Provider or
upstream investigation may establish a supported runsc configuration later, but
it must be tested with the actual grading images before adoption.

References: [upstream installation](https://gvisor.dev/docs/user_guide/install/),
[Docker configuration](https://gvisor.dev/docs/user_guide/quick_start/docker/),
[debug logging](https://gvisor.dev/docs/user_guide/debugging/) and
[application compatibility](https://gvisor.dev/docs/user_guide/compatibility/).
