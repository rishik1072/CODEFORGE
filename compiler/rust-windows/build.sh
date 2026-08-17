#!/bin/sh
# Entrypoint for the codeforge-rust-windows image.
#
# Expects:
#   /work/$SOURCE_FILE  - the validated Rust entrypoint (default main.rs or src/main.rs)
#   $RUST_TOOLCHAIN     - stable (default)
#
# Produces:
#   /work/output.exe
set -eu

SOURCE_FILE="${SOURCE_FILE:-main.rs}"
RUST_TOOLCHAIN="${RUST_TOOLCHAIN:-stable}"

case "$RUST_TOOLCHAIN" in
  stable|Stable) ;;
  *)
    echo "error: unsupported Rust toolchain: $RUST_TOOLCHAIN" >&2
    exit 2
    ;;
esac

exec rustc \
  --target x86_64-pc-windows-gnu \
  -C opt-level=2 \
  -o /work/output.exe \
  "/work/$SOURCE_FILE"
