# TEST-ONLY DRM contract fixture image (browser profile only).
# NEVER used by production runtime images. Labeled fixture, not real DRM/R2.
#
# A real, playable DASH presentation is generated at build time so the browser
# suite can prove that progress writes do not interrupt actual playback. The
# media is encrypted with CENC using a throwaway AES key that also exists in
# /srv/fixture/license.json, which is exactly how a ClearKey license exchange
# works. The content is synthetic test video with no rights attached: this is
# NOT DRM packaging, and it proves nothing about content protection, watermarking
# or a commercial key system.
#
# The key below is generated test material baked into a TEST-ONLY image. It is
# not a secret and protects nothing.
ARG NODE_IMAGE=node:22-bookworm-slim
ARG FAYQ_FIXTURE_KEY=00112233445566778899aabbccddeeff
ARG FAYQ_FIXTURE_KID=11223344556677889900112233445566

FROM ${NODE_IMAGE} AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends ffmpeg \
  && rm -rf /var/lib/apt/lists/*
RUN groupadd --system app && useradd --system --gid app --home-dir /srv/fixture app
WORKDIR /srv/fixture
COPY docker/drm-fixture/package.json docker/drm-fixture/server.js ./
COPY docker/drm-fixture/patch-mpd.js ./patch-mpd.js
RUN mkdir -p /srv/fixture/dash \
  && ffmpeg -hide_banner -loglevel error \
    -f lavfi -i "testsrc=size=320x180:rate=15:duration=20" \
    -c:v libx264 -profile:v main -pix_fmt yuv420p -g 15 -keyint_min 15 -sc_threshold 0 \
    -an \
    -encryption_scheme cenc-aes-ctr \
    -encryption_key "${FAYQ_FIXTURE_KEY}" \
    -encryption_kid "${FAYQ_FIXTURE_KID}" \
    -f dash -seg_duration 2 -use_template 0 -use_timeline 0 \
    /srv/fixture/dash/presentation.mpd \
  && test -s /srv/fixture/dash/presentation.mpd \
  && node patch-mpd.js /srv/fixture/dash/presentation.mpd 11223344-5566-7788-9900-112233445566
# The ClearKey license the fixture hands back for this presentation. The key id
# and key are the same throwaway test values used to encrypt the media above.
RUN export FIXTURE_KID=11223344556677889900112233445566 \
    FIXTURE_KEY=00112233445566778899aabbccddeeff \
 && node -e "const b64u=(h)=>Buffer.from(h,'hex').toString('base64url');require('node:fs').writeFileSync('/srv/fixture/license.json',JSON.stringify({keys:[{kty:'oct',kid:b64u(process.env.FIXTURE_KID),k:b64u(process.env.FIXTURE_KEY)}],type:'temporary'}))" \
 && test -s /srv/fixture/license.json
USER app
EXPOSE 8090
ENV PORT=8090
ENV FIXTURE_DASH_DIR=/srv/fixture/dash
ENV FIXTURE_LICENSE_FILE=/srv/fixture/license.json
CMD ["node", "server.js"]
