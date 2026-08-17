# CodeForge - Rust -> Windows PE cross-compiler image
#
# Minimal Debian slim base with Rust (rustup) and MinGW-w64 toolchain
# configured for x86_64-pc-windows-gnu cross-compilation.
#
# Build:
#   docker build -t codeforge-rust-windows:latest -f compiler/rust-windows/Dockerfile compiler/rust-windows

FROM debian:bookworm-slim

# Install system dependencies, curl, and MinGW-w64 linker
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        curl \
        ca-certificates \
        gcc-mingw-w64-x86-64 \
        binutils-mingw-w64-x86-64 \
        coreutils \
    && rm -rf /var/lib/apt/lists/*

# Install Rust toolchain with x86_64-pc-windows-gnu target
ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    PATH=/usr/local/cargo/bin:$PATH

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable --profile minimal \
    && rustup target add x86_64-pc-windows-gnu \
    && chmod -R a+rwx /usr/local/rustup /usr/local/cargo

# Non-root user
RUN useradd -u 1000 -m -s /usr/sbin/nologin builder

COPY build.sh /usr/local/bin/codeforge-build.sh
RUN chmod +x /usr/local/bin/codeforge-build.sh

USER builder
WORKDIR /work

ENTRYPOINT ["/usr/local/bin/codeforge-build.sh"]
