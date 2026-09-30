# Prompt 06 — real token expiry and platform entitlement expiry

Apply `00-worker-contract.md`; prerequisites: 04 and 05. Scope: deterministic live expiry verification and restoration safeguards.

Inspect `configure-local-expiry.mjs` and current negative tests. Implement a development-only guard, snapshot of changed settings in ignored storage, and restoration in a finally path. Restore/restart the service and verify normal TTL afterward. Never reduce the production minimum of 60 seconds.

Token drill: use a 10-second development token, assert a successful authorized request immediately before expiry, wait real wall time and prove 401 after its actual expiration. Keep asset READY, same device/user/session and a longer session lifetime. Exclude deletion/revocation as causes; a fresh renewed credential's successful control can help prove the service/session remains available. Measure actual elapsed time rather than attempts multiplied by polling interval. Check the renewal window can actually work with this short TTL instead of assuming a production 20-second scheduler suits a 10-second token.

Entitlement drill: separate from token expiry, use a bounded disposable subscription fixture without weakening integer-day purchase policy. Record fixture setup explicitly. Through real platform HTTP, prove playback works before subscription expiry; at/after expiry new playback and renewal are denied; active external playback is terminated via reconciliation and protected requests fail. Measure denial and termination latency. Do not change global system time.

Acceptance: distinct real-time token and entitlement evidence, initial positive controls, expected endpoint codes, measured latency, no reliance on mocks, guaranteed settings/session cleanup. Run affected expiry/renewal tests. Do not invent an acceptable production latency threshold; report the measurement and unresolved threshold separately.
