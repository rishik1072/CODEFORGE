# CodeForge - C++ -> Windows PE cross-compiler image
#
# This image is intentionally minimal: a Debian slim base plus only the
# MinGW-w64 cross-compiler toolchain needed to turn a single .cpp file
# into a Windows .exe. It is used by src/lib/codeforge/sandbox/docker-backend.ts
# whenever a Docker daemon is available (see docs/security.md for how the
# backend is selected).
#
# Build:
#   docker build -t codeforge-cpp-windows:latest -f compiler/cpp-windows/Dockerfile compiler/cpp-windows
#
# The container is run with (enforced by docker-backend.ts, not by this
# file alone): --network none, --read-only root fs, --cap-drop ALL,
# --pids-limit, --memory, --cpus, a non-root user, and a tmpfs /tmp.

FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        g++-mingw-w64-x86-64 \
        binutils-mingw-w64-x86-64 \
        coreutils \
    && rm -rf /var/lib/apt/lists/*

# Non-root user - the container is also started with --user at runtime,
# but baking in a real, unprivileged user keeps the image safe to run
# standalone too.
RUN useradd -u 1000 -m -s /usr/sbin/nologin builder

COPY build.sh /usr/local/bin/codeforge-build.sh
RUN chmod +x /usr/local/bin/codeforge-build.sh

USER builder
WORKDIR /work

ENTRYPOINT ["/usr/local/bin/codeforge-build.sh"]
