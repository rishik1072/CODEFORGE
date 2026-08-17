#!/bin/sh
# Entrypoint for the codeforge-cpp-windows image.
#
# Expects:
#   /work/$SOURCE_FILE  - the validated C++ source file (default main.cpp)
#   $CPP_STANDARD       - one of c++11, c++14, c++17, c++20, c++23
#
# Produces:
#   /work/output.exe
#
# No arguments beyond the whitelisted standard are accepted - this script
# never forwards arbitrary user input into the compiler invocation.
set -eu

SOURCE_FILE="${SOURCE_FILE:-main.cpp}"
CPP_STANDARD="${CPP_STANDARD:-c++17}"

case "$CPP_STANDARD" in
  c++11|c++14|c++17|c++20|c++23) ;;
  *)
    echo "error: unsupported C++ standard: $CPP_STANDARD" >&2
    exit 2
    ;;
esac

exec x86_64-w64-mingw32-g++ \
  -std="$CPP_STANDARD" \
  -O2 -Wall -Wextra \
  -static -static-libgcc -static-libstdc++ \
  -o /work/output.exe \
  "/work/$SOURCE_FILE"
