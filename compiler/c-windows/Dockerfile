# CodeForge - C -> Windows PE cross-compiler image
#
# Minimal Debian slim base with MinGW-w64 GCC cross-compiler toolchain
# to compile C source (.c) or C projects into Windows PE executables (.exe).
#
# Build:
#   docker build -t codeforge-c-windows:latest -f compiler/c-windows/Dockerfile compiler/c-windows

FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        gcc-mingw-w64-x86-64 \
        binutils-mingw-w64-x86-64 \
        coreutils \
    && rm -rf /var/lib/apt/lists/*

# Non-root user
RUN useradd -u 1000 -m -s /usr/sbin/nologin builder

COPY build.sh /usr/local/bin/codeforge-build.sh
RUN chmod +x /usr/local/bin/codeforge-build.sh

USER builder
WORKDIR /work

ENTRYPOINT ["/usr/local/bin/codeforge-build.sh"]
