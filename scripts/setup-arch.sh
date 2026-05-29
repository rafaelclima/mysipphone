#!/usr/bin/env bash
set -euo pipefail

# ─── Config ─────────────────────────────────────────────────
APP_NAME="mySIPPhone"
APP_ID="mysipphone"
APPIMAGE_NAME="mySIPPhone_0.1.1_amd64.AppImage"
RELEASE_URL="https://github.com/rafaelclima/mysipphone/releases/download/sip/${APPIMAGE_NAME}"

APPIMAGE_DIR="$HOME/.local/share/AppImage"
APPIMAGE_PATH="$APPIMAGE_DIR/$APPIMAGE_NAME"
DESKTOP_DIR="$HOME/.local/share/applications"
ICON_BASE="$HOME/.local/share/icons/hicolor"

# ─── Helpers ────────────────────────────────────────────────
die() { echo "❌ $*" >&2; exit 1; }
info() { echo "  $*"; }

# Ensure cleanup of temp dirs
TMP_DIR=""
cleanup() { [ -n "$TMP_DIR" ] && rm -rf "$TMP_DIR"; }
trap cleanup EXIT

# ─── 1. Detect ─────────────────────────────────────────────
echo "=== $APP_NAME — Setup para Arch Linux ==="
echo ""

if ! command -v pacman &>/dev/null; then
  die "pacman não encontrado. Este script é apenas para Arch Linux e derivados."
fi

# ─── 2. Dependencies ───────────────────────────────────────
echo "[1/5] Verificando dependências..."

DEPS=("webkit2gtk-4.1")
MISSING=()

for pkg in "${DEPS[@]}"; do
  if ! pacman -Qi "$pkg" &>/dev/null; then
    MISSING+=("$pkg")
  fi
done

if [ ${#MISSING[@]} -gt 0 ]; then
  info "Pacotes necessários: ${MISSING[*]}"
  if command -v sudo &>/dev/null; then
    sudo pacman -S --needed "${MISSING[@]}"
  else
    echo "  sudo não disponível. Instale manualmente:"
    echo "  su -c 'pacman -S ${MISSING[*]}'"
    exit 1
  fi
else
  info "Tudo ok."
fi

# ─── 3. Resolve AppImage ───────────────────────────────────
echo "[2/5] Obtendo AppImage..."
mkdir -p "$APPIMAGE_DIR"

RESOLVED_URL="$RELEASE_URL"

if [ $# -ge 1 ]; then
  if [ -f "$1" ]; then
    info "Usando arquivo local: $1"
    cp "$1" "$APPIMAGE_PATH"
    chmod +x "$APPIMAGE_PATH"
  elif [[ "$1" =~ ^https?:// ]]; then
    info "Usando URL fornecida: $1"
    RESOLVED_URL="$1"
  else
    die "Arquivo não encontrado: $1"
  fi
fi

# Download if needed
if [ ! -f "$APPIMAGE_PATH" ]; then
  info "Baixando de $RESOLVED_URL ..."
  curl -L --progress-bar -o "$APPIMAGE_PATH" "$RESOLVED_URL" || \
    die "Falha no download. Verifique a conexão."
  chmod +x "$APPIMAGE_PATH"
  info "Download concluído."
else
  info "AppImage já existe em $APPIMAGE_PATH"
fi

# Validate
if [ ! -s "$APPIMAGE_PATH" ]; then
  die "AppImage vazio ou inválido: $APPIMAGE_PATH"
fi

# ─── 4. Icons ──────────────────────────────────────────────
echo "[3/5] Instalando ícones..."

TMP_DIR=$(mktemp -d)
(
  cd "$TMP_DIR"
  if "$APPIMAGE_PATH" --appimage-extract >/dev/null 2>&1; then
    for icon in $(find squashfs-root -path "*/hicolor/*" -name "*.png" 2>/dev/null); do
      size=$(basename "$(dirname "$(dirname "$icon")")")
      if [ -n "$size" ]; then
        mkdir -p "$ICON_BASE/$size/apps"
        cp "$icon" "$ICON_BASE/$size/apps/$APP_ID.png"
      fi
    done
  fi
)

if [ ! -f "$ICON_BASE/index.theme" ]; then
  cat > "$ICON_BASE/index.theme" << 'THEME_EOF'
[Icon Theme]
Name=Hicolor
Comment=Fallback icon theme
Hidden=true
THEME_EOF
fi
gtk-update-icon-cache "$ICON_BASE" 2>/dev/null || true

info "Ícones instalados em $ICON_BASE"

# ─── 5. Desktop entry ──────────────────────────────────────
echo "[4/5] Criando atalho no menu..."
mkdir -p "$DESKTOP_DIR"

# Detect Wayland — add env workaround to desktop file
EXEC_PREFIX=""
if [ -n "${WAYLAND_DISPLAY:-}" ] || [ "${XDG_SESSION_TYPE:-}" = "wayland" ]; then
  EXEC_PREFIX="env WEBKIT_DISABLE_DMABUF_RENDERER=1"
fi

cat > "$DESKTOP_DIR/$APP_ID.desktop" << DESKTOP_EOF
[Desktop Entry]
Type=Application
Name=$APP_NAME
Comment=SIP softphone
Exec=$EXEC_PREFIX $APPIMAGE_PATH
Icon=$ICON_BASE/128x128/apps/$APP_ID.png
Terminal=false
Categories=Network;Telephony;
StartupWMClass=com.mysipphone.desktop
DESKTOP_EOF

chmod 644 "$DESKTOP_DIR/$APP_ID.desktop"
info "Atalho criado em $DESKTOP_DIR/$APP_ID.desktop"

# ─── 6. Update database ────────────────────────────────────
echo "[5/5] Atualizando banco de dados de aplicativos..."
update-desktop-database "$DESKTOP_DIR" 2>/dev/null || true

# ─── Done ───────────────────────────────────────────────────
echo ""
echo "=== $APP_NAME instalado com sucesso! ==="
echo ""
echo "  AppImage: $APPIMAGE_PATH"
echo "  Ícone:    $ICON_BASE/*/apps/$APP_ID.png"
echo "  Atalho:   $DESKTOP_DIR/$APP_ID.desktop"
echo ""
echo "Para iniciar, procure \"$APP_NAME\" no menu de aplicativos"
echo "ou execute: $APPIMAGE_PATH"
echo ""
if [ -n "$EXEC_PREFIX" ]; then
  echo "⚠️  Detectado Wayland. O atalho já inclui WEBKIT_DISABLE_DMABUF_RENDERER=1"
  echo "   para compatibilidade. Se iniciar manualmente:"
  echo "   env WEBKIT_DISABLE_DMABUF_RENDERER=1 $APPIMAGE_PATH"
  echo ""
fi
echo "Para remover: rm -f $APPIMAGE_PATH $DESKTOP_DIR/$APP_ID.desktop"
