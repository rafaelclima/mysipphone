#!/usr/bin/env bash
set -euo pipefail

# mySIPPhone — Arch/Omarchy Diagnostic Script
# Run on the Arch-based machine to collect system info for debugging.
# Usage: curl -sL https://raw.githubusercontent.com/rafaelclima/mysipphone/dev/scripts/diagnose-arch.sh | bash

echo "═══ mySIPPhone — Arch/Omarchy Diagnostic Report ═══"
echo "Date: $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo ""

# ─── System ─────────────────────────────────────────────────
echo "─── System ───────────────────────────────────"
echo "Kernel: $(uname -r)"
echo "Arch:   $(uname -m)"
echo "Session: ${XDG_SESSION_TYPE:-unknown}"
echo "Wayland: ${WAYLAND_DISPLAY:-not set}"
echo "Desktop: ${XDG_CURRENT_DESKTOP:-unknown}"
echo ""

# ─── Packages ───────────────────────────────────────────────
echo "─── Packages ─────────────────────────────────"
for pkg in webkit2gtk-4.1 gtk3 libxkbcommon mesa vulkan-driver pipewire pipewire-alsa alsa-lib; do
  if pacman -Qi "$pkg" &>/dev/null; then
    ver=$(pacman -Qi "$pkg" | grep "^Version" | awk '{print $3}')
    echo "  ✓ $pkg ($ver)"
  else
    echo "  ✗ $pkg (NOT INSTALLED)"
  fi
done
echo ""

# ─── EGL / GPU ──────────────────────────────────────────────
echo "─── EGL / GPU ─────────────────────────────────"
if command -v glxinfo &>/dev/null; then
  glxinfo -B 2>&1 | head -15
else
  echo "  glxinfo not available (install mesa-utils)"
fi
echo ""
if command -v eglinfo &>/dev/null; then
  eglinfo 2>&1 | head -15
else
  echo "  eglinfo not available (install libegl)"
fi
echo ""

# ─── PipeWire / PulseAudio ──────────────────────────────────
echo "─── PipeWire / PulseAudio ─────────────────────"
if command -v pactl &>/dev/null; then
  pactl info 2>&1 | head -10
  echo ""
  echo "Sinks:"
  pactl list sinks short 2>&1
  echo ""
  echo "Sources:"
  pactl list sources short 2>&1
else
  echo "  pactl not available (install pipewire-pulse or pulseaudio-utils)"
fi
echo ""

# ─── ALSA ───────────────────────────────────────────────────
echo "─── ALSA Devices ──────────────────────────────"
if command -v aplay &>/dev/null; then
  echo "=== aplay -l ==="
  aplay -l 2>&1
  echo ""
  echo "=== arecord -l ==="
  arecord -l 2>&1
else
  echo "  aplay/arecord not available (install alsa-utils)"
fi
echo ""

echo "─── ALSA Configuration ─────────────────────────"
echo "=== /etc/asound.conf ==="
cat /etc/asound.conf 2>/dev/null || echo "  (file not found)"
echo ""
echo "=== ~/.asoundrc ==="
cat ~/.asoundrc 2>/dev/null || echo "  (file not found)"
echo ""
echo "=== pipewire-alsa.conf ==="
cat /usr/share/alsa/alsa.conf.d/pipewire-alsa.conf 2>/dev/null || echo "  (file not found)"
echo ""

# ─── AppImage ───────────────────────────────────────────────
echo "─── AppImage ──────────────────────────────────"
APPIMAGE="$HOME/.local/share/AppImage/mySIPPhone_0.1.3_amd64.AppImage"
if [ -f "$APPIMAGE" ]; then
  echo "  Found: $APPIMAGE"
  file "$APPIMAGE" 2>&1
  ls -lh "$APPIMAGE"
else
  echo "  AppImage not found at $APPIMAGE"
fi
echo ""

# ─── Environment ────────────────────────────────────────────
echo "─── Environment ───────────────────────────────"
echo "GDK_BACKEND=${GDK_BACKEND:-not set}"
echo "WEBKIT_DISABLE_DMABUF_RENDERER=${WEBKIT_DISABLE_DMABUF_RENDERER:-not set}"
echo "LD_LIBRARY_PATH=${LD_LIBRARY_PATH:-not set}"
echo ""

echo "═══ End of report ═══"
echo ""
echo "Share this output with the development team for analysis."
