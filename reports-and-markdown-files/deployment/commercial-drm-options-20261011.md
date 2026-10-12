# Commercial DRM provider research — 2026-10-11

Owner decision: keep student launch gated and complete commercial DRM. Cloudflare
R2 credentials may be reused privately for storage; R2 is not a license issuer.
No provider account exists. Research does not authorize a paid subscription,
contract acceptance or sending credentials to an unselected provider.

## Shortlist

| Provider / option | Published cost checked today | Evaluation / fit |
| --- | --- | --- |
| Axinom DRM | USD 259 entry consumption tier: up to 100,000 licenses or 2,000 monthly active users | 60-day evaluation; explicitly prohibited for production. Widevine, PlayReady and FairPlay. Recommended first evaluation because its documented key service supports Shaka Packager. |
| EZDRM Widevine Modular | USD 99.99/month plus USD 99.99 setup; 10,000 licenses | Limited proof-of-concept trial. DASH CENC; this plan does not include FairPlay. |
| EZDRM Universal Complete | USD 299.99/month plus USD 199.99 setup; 20,000 licenses or 2,000 users | Widevine, PlayReady, FairPlay and WisePlay; broader device target. Limited proof-of-concept trial. |

Costs exclude hosting, any taxes, optional support and usage above the stated
allowance. Confirm the final provider quote and terms before activation. Provider
support is not proof that this application's player and packaging support every
device. Apple/FairPlay production onboarding and real Safari/iOS qualification
must be completed if those devices are in the launch scope.

Primary sources:

- [Axinom pricing and evaluation restrictions](https://www.axinom.com/products/drm).
- [Axinom DRM-only evaluation setup](https://docs.axinom.com/services/drm/quickstart).
- [Axinom key service and Shaka support](https://docs.axinom.com/services/drm/key-service).
- [Axinom player integration and production preparation](https://docs.axinom.com/services/drm/quickstart/drm-only/integrate-player).
- [EZDRM published plans and proof-of-concept terms](https://www.ezdrm.com/service-pricing).

## Integration work still required

The current external API rejects non-CLEAR_KEY issuance with
`DRM_PROVIDER_NOT_CONFIGURED`. Its Widevine provider's license response is an
unimplemented stub. Adding environment variables cannot complete that code.

After owner provider selection and private evaluation credentials:

1. Confirm the provider's key, license, entitlement and supported packaging
   contract; qualify the existing Shaka 3.7.2 worker against it.
2. Implement provider-owned key acquisition and matching packaging metadata in
   the independent DRM worker. Preserve key-safe logs, retries and tenant scope.
   Use new synthetic assets; do not rewrite retained local video objects.
3. Implement the external DRM license adapter with bounded HTTPS transport,
   authenticated entitlement, provider errors and short-lived licenses. Retain
   platform subscription expiry, session/device and RS256 assertion checks.
   Platform code continues to access only the external API, never its database.
4. Adapt player key systems/manifest delivery for the selected device matrix;
   verify actual protected playback, seek, renewal, expiry, unauthorized access,
   device limits and both languages in a browser. Include FairPlay packaging and
   certificate flow when applicable; DASH/Widevine alone is not that evidence.
5. Move from evaluation to owner-approved production credentials and prove real
   issuance/playback on the generated deployment URLs before opening students.

Keep `CLEAR_KEY_ENABLED=false`, `PREMIUM_DRM_REQUIRED=true`, HTTPS and signed
assertion requirements in production. No fallback to ClearKey is approved.
The first evaluation recommendation is an inference from documented integration
support, not a tested compatibility claim. Provider selection remains pending.
