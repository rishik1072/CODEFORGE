#!/bin/sh
# Entrypoint for the codeforge-c-windows image.
#
# Expects:
#   /work/$SOURCE_FILE  - the validated C source file (default main.c)
#   $C_STANDARD         - one of c11, c17, c23
#
# Produces:
#   /work/output.exe
set -eu

SOURCE_FILE="${SOURCE_FILE:-main.c}"
C_STANDARD="${C_STANDARD:-c17}"

GCC_FLAG="$C_STANDARD"
case "$C_STANDARD" in
  c11|c17) ;;
  c23)
    # GCC 12 implements C23 draft as -std=c2x
    GCC_FLAG="c2x"
    ;;
  *)
    echo "error: unsupported C standard: $C_STANDARD" >&2
    exit 2
    ;;
esac

exec x86_64-w64-mingw32-gcc \
  -std="$GCC_FLAG" \
  -O2 -Wall -Wextra \
  -static -static-libgcc \
  -o /work/output.exe \
  "/work/$SOURCE_FILE"
