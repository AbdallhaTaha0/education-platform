# Architecture baseline

The original diagram is unchanged. The owner's D01-D12 clarifications govern interpretation.

## Platform

React/TypeScript frontend; CDN/WAF; Nginx routing/load balancing; replicated Node.js/Express/TypeScript backend; PostgreSQL/Prisma; Redis and BullMQ as in the supplied design.

The backend is one application with separate internal modules for identity, catalog, wallet/recharge, purchases/subscriptions, learning access, administration and the DRM API adapter. These are code boundaries, not separate network services. API replicas use the same image and shared platform data services.

Arabic is primary, English secondary. Both content translations are mandatory. Programming courses contain recorded lessons; lesson/segment listings require subscription. No live classes or live courses. D25 confirms realtime in-platform notifications; the M6 contract uses the diagram's Socket.IO/Redis adapter within the same backend application. Chat, email and WhatsApp are deferred. Packages 02–04 implement private inbox storage/APIs, the bilingual inbox, committed event producers and Socket.IO/Redis delivery. See [the delivery report](m6-04-delivery-report.md), [package 05's separate-replica/recovery evidence](m6-05-acceptance-report.md) and [the completed independent review](m6-independent-review-report.md). [Owner M6 acceptance is recorded](m6-owner-acceptance.md). The original diagram is unchanged.

## External DRM â€” confirmed boundary

Platform backend -> authenticated DRM API -> frontend-safe response -> frontend/player.

The platform owns login, wallet, course records, subscription validity and entitlement checks. DRM owns video ingestion/processing, encryption, licensing, delivery, device/session protection and watermarking. Frontend player integration follows its API contract.

Never edit education-drm-service/, its images, code, configuration files or migrations. Never query its tables or place its records under platform Prisma migration ownership. Existing Caddy/Valkey/raw SQL/media gateway choices are not platform architecture conflicts to repair.

Platform PostgreSQL stores lesson/media identifiers, readiness and necessary external session references. Video binary data and encryption keys remain outside platform business tables. There is no second platform FFmpeg/packaging pipeline.

## Storage and development

Production video storage is Cloudflare R2 configured through external DRM, confirmed by the owner. Local substitute/setup remains open; do not edit the DRM package to configure it. Local platform infrastructure must run in Docker. Connect to an independently running, unchanged DRM distribution by API URL. A labeled contract test double may exercise platform behavior but does not prove actual protected playback.

## Capacity

The target remains 10,000 simultaneous users of recorded courses. Agree viewing/browsing mix and measure platform and external DRM/CDN behavior separately. Replica counts, host sizes, database pools, caching effectiveness and recovery objectives require evidence rather than assumptions.
