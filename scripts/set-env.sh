#!/usr/bin/env bash
# Source this file to set up the build environment:
#   source ./scripts/set-env.sh

if [ -n "${BASH_SOURCE[0]}" ]; then
  SCRIPT="$(realpath "${BASH_SOURCE[0]}")"
else
  SCRIPT="$(realpath "$0")"
fi
SCRIPT_DIR="$(dirname "$SCRIPT")"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

PJSIP_LIBDIR="${PROJECT_DIR}/pjsip-dist/lib"
ALSA_LIBDIR="/tmp/alsa-dev/usr/lib/x86_64-linux-gnu"
PJSIP_PC="${PROJECT_DIR}/pjsip-dist/lib/pkgconfig"
ALSA_PC="/tmp/alsa-pc"

export PKG_CONFIG_PATH="${ALSA_PC}:${PJSIP_PC}"
export LD_LIBRARY_PATH="${ALSA_LIBDIR}:${PJSIP_LIBDIR}"

echo "PKG_CONFIG_PATH=${PKG_CONFIG_PATH}"
echo "LD_LIBRARY_PATH=${LD_LIBRARY_PATH}"
echo ""
echo "Verifying..."
pkg-config --exists libpjproject 2>/dev/null && echo "  libpjproject  => OK" || echo "  libpjproject  => NOT FOUND!"
pkg-config --exists alsa 2>/dev/null && echo "  alsa          => OK" || echo "  alsa          => NOT FOUND!"
echo ""
echo "Environment ready. Run: cargo tauri dev"
