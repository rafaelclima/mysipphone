#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
echo "=== mySIPPhone: pjsip Setup ==="

PJSIP_VERSION="2.17"
PJSIP_DIR="/tmp/pjproject-${PJSIP_VERSION}"
LOCAL_PREFIX="${PROJECT_DIR}/pjsip-dist"

# check if pjsip already installed (system or local)
if pkg-config --exists libpjproject 2>/dev/null; then
    echo "pjsip already installed (system). Skipping build."
    exit 0
fi

if [ -f "${LOCAL_PREFIX}/lib/pkgconfig/libpjproject.pc" ]; then
    echo "pjsip already installed locally at ${LOCAL_PREFIX}. Skipping build."
    export PKG_CONFIG_PATH="${LOCAL_PREFIX}/lib/pkgconfig:${PKG_CONFIG_PATH:-}"
    exit 0
fi

echo "Downloading pjsip ${PJSIP_VERSION}..."
if [ ! -d "${PJSIP_DIR}" ]; then
    mkdir -p /tmp
    curl -L "https://github.com/pjsip/pjproject/archive/refs/tags/${PJSIP_VERSION}.tar.gz" \
        -o "/tmp/pjproject-${PJSIP_VERSION}.tar.gz"
    tar xzf "/tmp/pjproject-${PJSIP_VERSION}.tar.gz" -C /tmp
fi

echo "Configuring pjsip for local install at ${LOCAL_PREFIX}..."
cd "${PJSIP_DIR}"
./configure \
    --prefix="${LOCAL_PREFIX}" \
    --enable-shared \
    --disable-video \
    --disable-opencore-amr \
    --disable-libyuv \
    --disable-libwebrtc \
    --disable-ffmpeg

echo "Building pjsip (this may take a while)..."
make dep && make -j"$(nproc)"

echo "Installing pjsip locally..."
make install

echo ""
echo "=== pjsip ${PJSIP_VERSION} installed locally ==="
echo ""
echo "To build the Rust project, set:"
echo "  export PKG_CONFIG_PATH=\"${LOCAL_PREFIX}/lib/pkgconfig:\${PKG_CONFIG_PATH:-}\""
echo "  export LD_LIBRARY_PATH=\"${LOCAL_PREFIX}/lib:\${LD_LIBRARY_PATH:-}\""
echo ""
