# Isolated S3 compatibility fixture built from the pinned upstream source.
FROM golang:1.24-bookworm AS build
RUN CGO_ENABLED=0 go install github.com/minio/minio@RELEASE.2025-04-22T22-12-26Z
FROM node:22-bookworm-slim
COPY --from=build /go/bin/minio /usr/local/bin/minio
CMD ["minio", "server", "/data"]
