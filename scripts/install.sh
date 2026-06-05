#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo "=== mySIPPhone Installer ==="
echo ""

# ── 1. Build pjsip if needed ──
echo "[1/5] Checking pjsip..."
source "${SCRIPT_DIR}/setup-pjsip.sh"

# ── 2. Set env for build ──
PJSIP_LIBDIR="${PROJECT_DIR}/pjsip-dist/lib"
export PKG_CONFIG_PATH="${PROJECT_DIR}/pjsip-dist/lib/pkgconfig"
export LD_LIBRARY_PATH="${PJSIP_LIBDIR}"

# ── 3. Create data directory and migrate old database ──
DATA_DIR="$HOME/.local/share/mysipphone"
mkdir -p "$DATA_DIR"
if [ -f /tmp/mysipphone.db ] && [ ! -f "$DATA_DIR/mysipphone.db" ]; then
  cp /tmp/mysipphone.db "$DATA_DIR/mysipphone.db"
  echo "  Database migrated from /tmp/mysipphone.db"
fi

# ── 5. Build Rust project ──
echo "[2/5] Building mySIPPhone (release)..."

# Build frontend first so Tauri embeds the fresh bundle
if [ -f "${PROJECT_DIR}/frontend/package.json" ]; then
  echo "  Building frontend..."
  (cd "${PROJECT_DIR}/frontend" && npm run build) || echo "  Warning: frontend build failed, using cached bundle"
fi

source "$HOME/.cargo/env"
(cd "${PROJECT_DIR}" && cargo tauri build)

# ── 6. Install binary ──
echo "[3/5] Installing binary..."
mkdir -p "$HOME/.local/bin"
cp "${PROJECT_DIR}/target/release/mysipphone" "$HOME/.local/bin/mysipphone"
chmod +x "$HOME/.local/bin/mysipphone"

# ── 5. Install pjsip shared libraries ──
echo "[4/5] Installing pjsip libraries..."
INSTALL_LIBDIR="$HOME/.local/lib/mysipphone"
mkdir -p "$INSTALL_LIBDIR"

# Copy .so.2 files (exclude the C++ wrapper pjsua2 — 7MB unused)
for f in "${PJSIP_LIBDIR}"/*.so.2; do
  name=$(basename "$f")
  if [ "$name" != "libpjsua2.so.2" ]; then
    cp "$f" "$INSTALL_LIBDIR/$name"
    chmod 644 "$INSTALL_LIBDIR/$name"
  fi
done

# Add RPATH to each .so so transitive deps find each other in the same dir
if command -v patchelf &>/dev/null; then
  for f in "$INSTALL_LIBDIR"/*.so.2; do
    patchelf --set-rpath '$ORIGIN' "$f"
  done
fi

# Strip debug info to save space
if command -v strip &>/dev/null; then
  strip --strip-unneeded "$INSTALL_LIBDIR"/*.so.2 2>/dev/null || true
fi

# ── 6. Desktop entry and icon ──
echo "[5/5] Creating desktop entry..."

DESKTOP_DIR="$HOME/.local/share/applications"
mkdir -p "$DESKTOP_DIR"

# Install all icon sizes per FreeDesktop spec
for size in 16x16 24x24 32x32 48x48 64x64 128x128 256x256; do
  icon_dir="$HOME/.local/share/icons/hicolor/$size/apps"
  mkdir -p "$icon_dir"
  cp "${PROJECT_DIR}/src-tauri/icons/$size.png" "$icon_dir/mysipphone.png"
done

# Ensure hicolor has index.theme so gtk-update-icon-cache works
if [ ! -f "$HOME/.local/share/icons/hicolor/index.theme" ]; then
  cat > "$HOME/.local/share/icons/hicolor/index.theme" << 'EOF'
[Icon Theme]
Name=Hicolor
Comment=Fallback icon theme
Hidden=true
EOF
fi

# Update icon cache
if command -v gtk-update-icon-cache &>/dev/null; then
  gtk-update-icon-cache "$HOME/.local/share/icons/hicolor" 2>/dev/null || true
fi

cat > "$DESKTOP_DIR/mysipphone.desktop" << DESKTOP_EOF
[Desktop Entry]
Type=Application
Name=mySIPPhone
Comment=SIP softphone
Exec=$HOME/.local/bin/mysipphone
Icon=$HOME/.local/share/icons/hicolor/128x128/apps/mysipphone.png
Terminal=false
Categories=Network;Telephony;
StartupWMClass=com.mysipphone.desktop
DESKTOP_EOF

chmod 644 "$DESKTOP_DIR/mysipphone.desktop"

# Update desktop database if available
if command -v update-desktop-database &>/dev/null; then
  update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true
fi

echo ""
echo "=== mySIPPhone instalado com sucesso! ==="
echo ""
echo "  Binário:  $HOME/.local/bin/mysipphone"
echo "  Libs:     $INSTALL_LIBDIR"
echo "  Ícone:    ~/.local/share/icons/hicolor/*/apps/mysipphone.png"
echo "  Atalho:   $DESKTOP_DIR/mysipphone.desktop"
echo ""
echo "Se $HOME/.local/bin não estiver no seu PATH, adicione:"
echo "  export PATH=\"\$HOME/.local/bin:\$PATH\""
echo ""
echo "Para iniciar: mysipphone"
echo "Ou procure \"mySIPPhone\" no menu de aplicativos."
