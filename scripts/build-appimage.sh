#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== mySIPPhone AppImage Builder ==="
echo ""

# ── 1. Check pjsip ──
echo "[1/4] Checking pjsip..."
if [ ! -f "${PROJECT_DIR}/pjsip-dist/lib/libpjsua.so.2" ]; then
  echo "pjsip not found. Run ./scripts/setup-pjsip.sh first."
  exit 1
fi

# ── 2. Set env ──
PJSIP_LIBDIR="${PROJECT_DIR}/pjsip-dist/lib"
export PKG_CONFIG_PATH="${PROJECT_DIR}/pjsip-dist/lib/pkgconfig"
export LD_LIBRARY_PATH="${PJSIP_LIBDIR}"

# ── 3. Add RPATH to pjsip .so files so transitive deps resolve ──
echo "[2/4] Adding RPATH to pjsip libraries..."
TMP_SO_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_SO_DIR"' EXIT

mkdir -p "$TMP_SO_DIR"
for f in "${PJSIP_LIBDIR}"/*.so.2; do
  name=$(basename "$f")
  if [ "$name" != "libpjsua2.so.2" ]; then
    cp "$f" "$TMP_SO_DIR/$name"
    patchelf --set-rpath '$ORIGIN' "$TMP_SO_DIR/$name"
  fi
done

# Copy modified .so files back (they'll be bundled by Tauri's appimage.files)
# Store originals in a backup
mkdir -p "${PJSIP_LIBDIR}/.orig"
for f in "${TMP_SO_DIR}"/*.so.2; do
  name=$(basename "$f")
  if [ ! -f "${PJSIP_LIBDIR}/.orig/$name" ]; then
    cp "${PJSIP_LIBDIR}/$name" "${PJSIP_LIBDIR}/.orig/$name"
  fi
  cp "$f" "${PJSIP_LIBDIR}/$name"
done

# ── 4. Build Tauri bundle (generates AppImage + deb) ──
echo "[3/4] Building Tauri app..."
source "$HOME/.cargo/env"
cargo tauri build

# ── 5. Restore original .so files ──
echo "[4/4] Restoring original libraries..."
if [ -d "${PJSIP_LIBDIR}/.orig" ]; then
  for f in "${PJSIP_LIBDIR}/.orig"/*.so.2; do
    name=$(basename "$f")
    cp "$f" "${PJSIP_LIBDIR}/$name"
  done
  rm -rf "${PJSIP_LIBDIR}/.orig"
fi

echo ""
echo "=== AppImage gerado! ==="
echo ""
ls -lh "${PROJECT_DIR}/src-tauri/target/release/bundle/appimage/"*.AppImage 2>/dev/null || \
  ls -lh "${PROJECT_DIR}/target/release/bundle/appimage/"*.AppImage 2>/dev/null || \
  echo "AppImage gerado em src-tauri/target/release/bundle/appimage/ oder target/release/bundle/appimage/"
echo ""
echo "Para distribuir sem reconstruir, envie apenas o arquivo .AppImage."
