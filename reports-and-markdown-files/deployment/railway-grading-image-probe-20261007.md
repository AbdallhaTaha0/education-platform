# Railway actual grading-image probe — 2026-10-07

Current verdict: **PASS for actual-image functional compatibility and the tested
isolation controls**, after the diagnostic-retention retry below. Full production
security qualification remains open: the existing `runsc` requirement is preserved.
Earlier provider-blocked attempts are retained as historical evidence.

Owner approved this follow-up within an additional $0.25 budget, without platform
or DRM deployment. Scope remained `sweet-embrace` / `testing`.

## Prepared test

`.railway/sandbox-grading-probe.mjs` uploads an explicit allowlist of the existing
JavaScript/Python Dockerfiles, lockfile, grading source, approved Chromium seccomp
profile and existing execution proofs. Environment files, credentials, platform
data and real students are excluded. Trusted Python/launcher orchestration modules
are transpiled from current TypeScript; only synthetic code/input goes into jobs.

The planned checks are the existing browser grading proof (18 groups), Python
execution proof (18 checks), unchanged production guards, and absence of owned
execution containers. These are **planned, not passed** in this cloud run.

Each attempt requests at most 2 vCPU / 2 GB, ISOLATED networking, no injected
application variables or domains, a one-minute idle timeout and a ten-minute
orchestrator deadline. Individual build/test deadlines and output caps apply.
Student jobs retain their existing no-network, no-host-mount, non-root,
read-only/resource restrictions and approved seccomp settings. Production `runsc`
guards are not edited or disabled. No `--no-sandbox` workaround is used.

## Attempts and observed evidence

1. A sandbox was created, and all eleven allowlisted files were uploaded. The
   first image-build request via HTTP execution ended in `RailwayGraphQLError`.
   The catch retained only the exception type; the precise provider cause is
   **unknown**, and no image build success or grading result is established.
   The orchestrator finished after 157 seconds. Its immediate destroy/list checks
   did not confirm deletion before exit. A separate official CLI list subsequently
   returned `[]`, confirming no active test sandbox remained.
2. Changed the harness to streaming execution, which the official SDK documents
   for long commands, and added explicit heartbeat calls during upload. This is a
   transport mitigation, **not a proven diagnosis** of the first failure. Railway
   then rejected sandbox creation with `Failed to create sandbox. Please try again.`
   The attempt ended after two seconds; an explicit list returned `[]`.
3. One final creation attempt returned the same provider error after 15 seconds.
   No grading commands ran. The final official CLI list returned `[]`.

No sandbox checkpoints, services, public domains or persistent cloud resources
were created. The only successfully created VM was destroyed, including its
uploaded files, build artifacts and any child containers. No owner preview,
local Docker volume, application database, DRM source or real video changed.
No credential value was logged or sent to the sandbox.

## Budget and next step

The successful VM existed within the 157-second attempt. At the published maximum
usage rates for 2 vCPU / 2 GB, its compute estimate is approximately $0.012; this
is an **estimate**, not a queried invoice. The failed creation attempts returned
no handle; the empty active lists are the resource-cleanup evidence. No further
attempt was made after the final failure.

The earlier basic JavaScript/Python/Docker compatibility PASS remains valid, but
does not replace this blocked actual-image/security gate. Retry the prepared test
when Railway creation/long-command behavior is stable. Do not migrate grading or
weaken the existing production guard based on these results. Queue delivery,
runtime isolation qualification, recovery, cost and capacity remain separate gates.

References: [Railway Sandboxes](https://docs.railway.com/sandboxes), including
long-command execution and metered resource pricing.

## Diagnostic retention correction

Owner correctly noted that the destroyed sandbox has no accessible build logs.
The first attempt's missing diagnostics cannot be recovered. The runner now writes
bounded, redacted JSONL evidence to ignored `.railway/probe-evidence/` files before
creation, around every command and on provider failure. It attempts to collect
build-log tails before destruction with a five-second remote timeout and a
twelve-second client timeout. Failure to fetch diagnostics does not prevent
destruction; the wall watchdog remains active during collection.

The local evidence excludes raw provider response bodies and redacts the exact
login token, bearer credentials, URL credentials and query strings. Files request
mode 0600; Windows uses the workspace's inherited ACLs. No additional Railway
sandbox was started for this correction. Offline Docker evidence tests verify
redaction, saved failure/cleanup records, output bounds and Linux file permissions.

## Successful owner-authorized retry

The owner subsequently instructed `go ahead`. One new testing sandbox completed
the prepared test using streaming execution. Both images were built from the
uploaded current Dockerfiles, source, lockfile and approved seccomp profile.
The attempt lasted **270 seconds** and ended with exit **0**:
`gradingProbePass=true cleanupConfirmed=true`.

| Stage | Actual result |
| --- | --- |
| Build JavaScript/Chromium image | PASS, exit 0 |
| Build Python execution image | PASS, exit 0 |
| Existing browser execution proof | 18/18 groups PASS |
| Existing Python execution proof | 18/18 checks PASS |
| Production isolation guards | PASS: JavaScript and Python still refuse production without `runsc` |
| Owned execution container check | PASS: neither execution-proof nor grading label has a remaining container |
| Sandbox destruction | PASS: SDK list confirms no non-DESTROYED entry for the owned sandbox |

Browser evidence includes actual Chromium namespace and seccomp enforcement,
DOM interactions/input/styles, console/function checks, generated private cases,
strict output comparisons, wrong-answer/syntax/tampering rejection, blocked network
and bounded infinite-loop/excess-output execution. Python evidence includes
input/print and standard-library behavior, syntax/exit-code handling, bounded loops
and output, absent application files/secrets, read-only root, blocked network and
external packages, ephemeral scratch state, all-private-case checking and rejection
of hardcoded/forged results.

Redacted command results and build-log tails were retained in the ignored local
file `.railway/probe-evidence/grading-1791378736599.jsonl` before deletion. The
file contains no real student data, application settings or sandbox credentials.
Both offline evidence-retention tests had already passed in a disposable Docker
container, which removed itself. No platform/DRM services, real videos, existing
previews or persistent databases were changed; nothing was committed or pushed.

At the published resource ceilings, the 270-second retry's compute estimate is
approximately **$0.021**, excluding small outbound traffic; actual billing was not
queried. This and earlier attempts remain well below the approved follow-up $0.25
budget on that resource/time estimate. This is not a provider-enforced monetary
cap or measured invoice.

### What this permits next

The actual images work on Railway Sandboxes under their existing Docker/browser
restrictions. This evidence does not establish equivalence to `runsc`, guarantee
escape resistance, qualify 10,000-user throughput/cost, or verify production queue
integration. Preserve the production guard. The next bounded prerequisite is to
qualify the required hardened runtime in the sandbox (or propose an explicit,
reviewed alternative isolation policy), before implementing a Railway execution
adapter. Immutable image references, authenticated dispatch, no injected platform
secrets, fair queuing, bounded lifetime and retry-safe cleanup remain required.
The earlier provider failure cause remains unknown; successful streaming retry
does not prove a particular root cause.
