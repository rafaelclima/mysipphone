#!/usr/bin/env bash
set -euo pipefail

# ================================================================
# mySIPPhone — Dependency Installer
# ================================================================
# Installs all system packages, build tools, and dependencies
# needed to build and run mySIPPhone on Linux.
#
# Usage: ./scripts/install-deps.sh [--no-pjsip] [--no-npm]
#
# Options:
#   --no-pjsip   Skip building pjsip (if already built)
#   --no-npm     Skip npm install (if already done)
# ================================================================

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

NO_PJSIP=false
NO_NPM=false
for arg in "$@"; do
  case "$arg" in
    --no-pjsip) NO_PJSIP=true ;;
    --no-npm)   NO_NPM=true   ;;
  esac
done

# ---- Color output ----
red()   { printf "\033[31m%s\033[0m\n" "$*"; }
green() { printf "\033[32m%s\033[0m\n" "$*"; }
blue()  { printf "\033[34m%s\033[0m\n" "$*"; }

info()  { blue "  [INFO] $*"; }
ok()    { green "  [OK]   $*"; }
err()   { red "  [ERR]  $*"; }

# ---- Detect OS ----
detect_os() {
  if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS_ID="${ID:-linux}"
    OS_VERSION_ID="${VERSION_ID:-}"
    OS_LIKE="${ID_LIKE:-}"
  else
    OS_ID="linux"
    OS_LIKE=""
  fi
  echo "Detected OS: $OS_ID $OS_VERSION_ID (like: $OS_LIKE)"
}

# ---- Install system packages ----
install_system_packages() {
  info "Installing system packages..."

  local common_build="build-essential pkg-config curl make"
  local common_tauri="libgtk-3-dev libwebkit2gtk-4.1-dev libappindicator3-dev librsvg2-dev"
  local common_tauri_extras="libsoup-3.0-dev libjavascriptcoregtk-4.1-dev"
  local common_audio="libasound2-dev"
  local common_x11="libx11-dev libxext-dev libxft-dev libxinerama-dev libxcursor-dev libxrandr-dev libxi-dev"
  local common_runtime="libasound2 libstdc++6"

  if [ -f /etc/debian_version ]; then
    info "Detected Debian/Ubuntu/Pop!_OS"

    sudo apt-get update -qq

    sudo apt-get install -y -qq \
      $common_build \
      $common_tauri \
      $common_tauri_extras \
      $common_audio \
      $common_x11 \
      $common_runtime \
      libpulse-dev \
      uuid-dev \
      libtool \
      autoconf \
      automake \
      libc6-dev \
      g++

  elif [ -f /etc/fedora-release ] || [ -f /etc/redhat-release ]; then
    info "Detected Fedora/RHEL"

    sudo dnf install -y \
      gcc gcc-c++ make pkgconfig curl \
      gtk3-devel webkit2gtk4.1-devel libappindicator-gtk3-devel \
      librsvg2-devel libsoup3-devel \
      alsa-lib-devel \
      libX11-devel libXext-devel libXft-devel \
      libXinerama-devel libXcursor-devel libXrandr-devel libXi-devel \
      pulseaudio-libs-devel \
      libuuid-devel \
      libtool \
      autoconf \
      automake \
      glibc-devel \
      libstdc++-devel \
      nodejs \
      npm

  elif [ -f /etc/arch-release ]; then
    info "Detected Arch Linux"

    sudo pacman -S --needed --noconfirm \
      base-devel pkgconf curl \
      gtk3 webkit2gtk-4.1 libappindicator-gtk3 \
      librsvg libsoup3 \
      alsa-lib \
      libx11 libxext libxft libxinerama libxcursor libxrandr libxi \
      libpulse \
      util-linux \
      libtool \
      autoconf \
      automake \
      nodejs \
      npm

  else
    info "Unknown distribution ($OS_ID). Attempting Debian-compatible install..."
    info "If this fails, install the following manually:"
    echo "  - build-essential, pkg-config, curl, make"
    echo "  - libgtk-3-dev, libwebkit2gtk-4.1-dev"
    echo "  - libasound2-dev, libsoup-3.0-dev"
    echo "  - libx11-dev, libxext-dev"
    echo "  - nodejs, npm"
    echo "  - rustup (for Rust)"
    echo ""

    if command -v apt-get &>/dev/null; then
      sudo apt-get update -qq && sudo apt-get install -y -qq \
        $common_build \
        $common_tauri \
        $common_tauri_extras \
        $common_audio \
        $common_x11 \
        $common_runtime \
        uuid-dev \
        libtool \
        autoconf \
        automake \
        g++
    else
      err "Unsupported package manager. Install deps manually (see README.md)."
      exit 1
    fi
  fi

  ok "System packages installed"
}

# ---- Install Rust ----
install_rust() {
  if command -v cargo &>/dev/null && command -v rustc &>/dev/null; then
    local rust_ver
    rust_ver=$(rustc --version | cut -d' ' -f2)
    ok "Rust $rust_ver already installed"
    return
  fi

  info "Installing Rust via rustup..."
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
  source "$HOME/.cargo/env"
  ok "Rust installed: $(rustc --version)"
}

# ---- Install Node.js ----
install_node() {
  if command -v node &>/dev/null && command -v npm &>/dev/null; then
    local node_ver
    node_ver=$(node --version)
    ok "Node.js $node_ver already installed"
    return
  fi

  info "Installing Node.js via nvm..."
  if [ ! -d "$HOME/.nvm" ]; then
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
  fi

  export NVM_DIR="$HOME/.nvm"
  [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

  nvm install --lts
  nvm use --lts
  ok "Node.js installed: $(node --version)"
}

# ---- Build pjsip from source ----
build_pjsip() {
  if [ -f "${PROJECT_DIR}/pjsip-dist/lib/pkgconfig/libpjproject.pc" ]; then
    ok "pjsip already built at pjsip-dist/"
    export PKG_CONFIG_PATH="${PROJECT_DIR}/pjsip-dist/lib/pkgconfig:${PKG_CONFIG_PATH:-}"
    return
  fi

  info "Building pjsip from source (this takes a while)..."
  bash "${SCRIPT_DIR}/setup-pjsip.sh"
  ok "pjsip built successfully"
}

# ---- Install npm dependencies ----
install_npm_deps() {
  if [ -d "${PROJECT_DIR}/frontend/node_modules" ] && [ -f "${PROJECT_DIR}/frontend/node_modules/.package-lock.json" ]; then
    ok "npm dependencies already installed"
    return
  fi

  info "Installing frontend npm dependencies..."
  cd "${PROJECT_DIR}/frontend"
  npm install
  cd "${PROJECT_DIR}"
  ok "npm dependencies installed"
}

# ---- Create env setup script ----
create_env_script() {
  cat > "${PROJECT_DIR}/scripts/set-env.sh" << 'ENVEOF'
# Source this file to set up build environment:
#   source ./scripts/set-env.sh
#
# Or run directly:
#   eval "$(cat ./scripts/set-env.sh)"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

export PKG_CONFIG_PATH="${PROJECT_DIR}/pjsip-dist/lib/pkgconfig:${PKG_CONFIG_PATH:-}"
export LD_LIBRARY_PATH="${PROJECT_DIR}/pjsip-dist/lib:${LD_LIBRARY_PATH:-}"

echo "PKG_CONFIG_PATH=${PKG_CONFIG_PATH}"
echo "LD_LIBRARY_PATH=${LD_LIBRARY_PATH}"
echo ""
echo "Run 'cargo build' or 'cargo tauri dev' now."
ENVEOF

  chmod +x "${PROJECT_DIR}/scripts/set-env.sh"
  ok "Created scripts/set-env.sh — source it before building:"
  echo "    source ./scripts/set-env.sh"
}

# ---- Print summary ----
print_summary() {
  echo ""
  echo "================================================================"
  green "  mySIPPhone — Installation Complete!"
  echo "================================================================"
  echo ""
  echo "  Build using:"
  echo "    source ./scripts/set-env.sh"
  echo "    cargo tauri dev"
  echo ""
  echo "  Or frontend-only dev:"
  echo "    cd frontend && npm run dev"
  echo ""
  echo "  Verify correctness:"
  echo "    cargo clippy --all-targets -- -D warnings"
  echo "    cd frontend && npm run lint"
  echo ""
}

# ================================================================
# Main
# ================================================================

echo ""
blue "================================================================"
blue "  mySIPPhone - Dependency Installer"
blue "================================================================"
echo ""

detect_os
echo ""

install_rust
echo ""

install_node
echo ""

install_system_packages
echo ""

if [ "$NO_PJSIP" = false ]; then
  build_pjsip
  echo ""
fi

if [ "$NO_NPM" = false ]; then
  install_npm_deps
  echo ""
fi

create_env_script
echo ""

print_summary
