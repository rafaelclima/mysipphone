# mySIPPhone

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

**Desktop SIP softphone for Linux** — connects directly to Asterisk/Issabel PBX over local network. Built with real pjsip stack and native ALSA audio. No cloud, no WebRTC, no browser audio.

## Screenshots

| Dialer & Active Call | Account Setup & Settings | Incoming Call |
|---|---|---|
| ![Dialer](resources/prints/01.png) | ![Account Setup](resources/prints/02.png) | ![Incoming Call](resources/prints/03.png) |
| ![Active Call](resources/prints/04.png) | ![Settings](resources/prints/05.png) | |

## Features

| Feature | Status |
|---------|--------|
| SIP registration (auto-reconnect) | ✅ |
| Outgoing calls (INVITE + RTP audio) | ✅ |
| Outgoing ringback tone | ✅ |
| Incoming calls (ring + answer) | ✅ |
| Call pickup `*8#` (+ targeted `*8#extension`) | ✅ |
| Hold / Resume | ✅ |
| Mute | ✅ |
| Blind Transfer | ✅ |
| Call waiting / swap | ✅ |
| DTMF (RFC 2833) | ✅ |
| Call history (SQLite) | ✅ |
| Contacts CRUD + CSV import | ✅ |
| Multiple lines | ✅ |
| Audio hotplug detection | ✅ |
| Dark / Light theme | ✅ |
| Device themes (iPhone / Galaxy / Pixel) | ✅ |
| Incoming call popup window | ✅ |
| PT-BR / EN internationalization | ✅ |
| Per-user install (no sudo) | ✅ |

## Quick Install

### AppImage (recommended — no dev tools required)

Download the latest AppImage from the [releases page](https://github.com/rafaelclima/mysipphone/releases):

```bash
chmod +x mySIPPhone_*.AppImage
./mySIPPhone_*.AppImage
```

### Arch Linux / Omarchy / Manjaro

```bash
# Prerequisite: webkit2gtk-4.1 (Tauri runtime, not bundled)
sudo pacman -S --needed webkit2gtk-4.1

# Automated setup (installs deps + downloads AppImage + creates launcher)
git clone https://github.com/rafaelclima/mysipphone.git
cd mysipphone
./scripts/setup-arch.sh
```

The script auto-detects Hyprland (Wayland) and applies `WEBKIT_DISABLE_DMABUF_RENDERER=1`.

### Build from source

```bash
git clone https://github.com/rafaelclima/mysipphone.git
cd mysipphone
./scripts/install.sh
```

No sudo required. Installs to `~/.local/`:
- `~/.local/bin/mysipphone` — binary
- `~/.local/lib/mysipphone/` — bundled pjsip libraries
- `~/.local/share/applications/mysipphone.desktop` — app menu entry
- `~/.local/share/icons/hicolor/*/apps/mysipphone.png` — app icons

After install, launch **mySIPPhone** from your app menu or run `mysipphone`.

### Runtime Dependencies

| Library | Purpose |
|---------|---------|
| GTK3 + WebKit2GTK 4.1 | Tauri webview (included in most distros) |
| ALSA (`libasound2`) | Audio capture/playback (PipeWire provides compatibility) |

## Usage

1. **Launch the app** — Account Setup appears on first run.
2. **Enter SIP credentials**: extension, domain, user, password — same as any SIP phone.
3. **Dial**: type an extension and press the green call button.
4. **Receive calls**: app rings on incoming call — answer or reject.
5. **Call pickup (`*8#`)**: dial `*8#` to pick up a ringing call in your pickup group, or `*8#extension` for targeted pickup.
6. **Hold / Resume**: press Hold during a call; press again to resume.
7. **Blind Transfer**: press Transfer → enter target extension → confirm. Cancel with ✕ or Escape.
8. **Call waiting**: second incoming call shows a banner — answer puts the first on hold. Swap freely.
9. **Contacts**: add, edit, delete contacts. CSV import supported.
10. **Settings**: manage your SIP account, pick audio devices, toggle dark mode, test speakers, change device theme.

### Account Configuration

| Field | Example |
|-------|---------|
| Extension | 595 |
| PBX Domain | 192.168.54.2 |
| Username | 595 |
| Password | your_sip_password |

The app auto-registers on the PBX. A green indicator in the status bar confirms registration.

## Development

### System Dependencies

```bash
# Ubuntu 24.04 / Pop!_OS 24.04 / Debian 12+
sudo apt install -y \
  build-essential pkg-config curl make \
  libgtk-3-dev libwebkit2gtk-4.1-dev libappindicator3-dev \
  librsvg2-dev libsoup-3.0-dev libjavascriptcoregtk-4.1-dev \
  libasound2-dev \
  libx11-dev libxext-dev libxft-dev libxinerama-dev \
  libxcursor-dev libxrandr-dev libxi-dev \
  uuid-dev libtool autoconf automake g++ nodejs npm
```

### Setup

```bash
# Rust
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"

# Node.js (via nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
nvm install --lts

# pjsip (one-time build from source)
./scripts/setup-pjsip.sh

# Frontend dependencies
cd frontend && npm install && cd ..
```

### Environment (every shell)

```bash
source ./scripts/set-env.sh
```

### Commands

| Command | Description |
|---------|-------------|
| `cargo tauri dev` | Full app with hot-reload |
| `cargo check` | Check compilation |
| `cargo clippy --all-targets -- -D warnings` | Rust lint |
| `cargo test -p pjsip-sys` | Verify FFI struct sizes |
| `npm run dev` (in `frontend/`) | Frontend dev server |
| `npx tsc --noEmit` (in `frontend/`) | TypeScript typecheck |
| `npm run lint` (in `frontend/`) | Frontend lint |
| `./scripts/install.sh` | Install system-wide to `~/.local/` |
| `./scripts/build-appimage.sh` | Build AppImage + .deb |

### Pre-Commit Checklist

1. `cargo test -p pjsip-sys` — verify FFI struct sizes
2. `cargo check`
3. `cargo clippy --all-targets -- -D warnings`
4. `npm run lint` (in `frontend/`)
5. `npx tsc --noEmit` (in `frontend/`)

## Troubleshooting

### `pjsua_init failed: 70004 (PJ_EINVAL)`

FFI struct size mismatch. Run `cargo test -p pjsip-sys`. See `packages/pjsip-sys/src/lib.rs` — the `_opaque` padding must match the actual C struct size.

### `pkg-config: libpjproject not found`

Run `./scripts/setup-pjsip.sh`, then `source ./scripts/set-env.sh`.

### No audio devices

```bash
aplay -l          # list playback devices
arecord -l        # list capture devices
sudo apt install pipewire-alsa  # if using PipeWire
```

### Icon shows generic gear in app menu

```bash
gtk-update-icon-cache ~/.local/share/icons/hicolor
```

## Project Structure

```
packages/
  pjsip-sys/       Raw FFI bindings to pjsua C API
  sip-engine/      pjsip lifecycle, call control, event emission
  audio-engine/    ALSA backend, ringtone playback, mute
  persistence/     SQLite repositories (accounts, contacts, call logs)
  shared/          Zero-dependency types (enums, structs)
src-tauri/         Tauri shell (commands, state, main)
frontend/          React app (views, stores, components, i18n)
scripts/           Build and install scripts
```

## Architecture

```
pjsip (C) → pjsip-sys (FFI) → sip-engine (Rust)
                                   │
                              mpsc channel
                                   │
                           Tauri event (sip:*)
                                   │
                            Zustand store
                                   │
                               React UI
```

Audio path: `ALSA ← audio-engine ← Tauri commands ← React`

## License

MIT
