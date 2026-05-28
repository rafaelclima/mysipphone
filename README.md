# mySIPPhone

A production-grade SIP softphone for Linux desktop. Direct SIP + RTP to Asterisk/Issabel PBX on local network. No cloud dependencies, no browser/WebRTC audio — real pjsip stack with native ALSA audio.

Built with **Tauri 2** (Rust) + **React 18 / MUI 6 / Zustand** + **pjsip 2.17** C library via FFI.

## Features

### Current
| Feature | Status |
|---------|--------|
| SIP account registration | ✅ Real pjsip registration |
| Audio device enumeration | ✅ ALSA device detection |
| Ringtone playback | ✅ 440Hz sine wave |
| Dark/light theme | ✅ MUI 6 theming |
| Navigation | ✅ Dialer, Contacts, History, Settings |
| Incoming/Outgoing call UI | ✅ Phone shell with ActiveCall screen |
| Outgoing calls | ✅ Full invite + RTP audio |
| Incoming calls | ✅ Ring + answer + RTP audio |
| Hold / Resume | ✅ Via pjsip call hold |
| Mute | ✅ Via audio-engine atomic flag |
| Blind Transfer | ✅ With cancel ✕ / Escape |
| Multiple lines | ✅ Call waiting with swap |
| DTMF | ✅ RFC 2833 in-band |
| Call history | ✅ SQLite persistence |
| Contacts CRUD | ✅ Add, edit, delete, call |
| CSV import | ✅ Client-side parse + bulk import |
| Audio hotplug | ✅ 2s polling, auto-refresh |
| SIP reconnect | ✅ Exponential backoff 1-60s |
| Per-user install | ✅ `install.sh` → `~/.local/` |

### Planned (M6b)
- Device themes (iPhone/Galaxy/Pixel)
- Call from history
- Call Pickup `*8#`

## Requirements

### Hardware
- Linux desktop (x86_64)
- Microphone and speaker (or headset)
- SIP PBX on local network (e.g., Asterisk, Issabel, FreePBX)

### Runtime Libraries
| Library | Purpose |
|---------|---------|
| GTK3 + WebKit2GTK 4.1 | Tauri webview |
| ALSA (`libasound2`) | Audio playback/capture |
| pjsip 2.17 (built from source) | SIP stack |

Your distro's **PipeWire** provides ALSA compatibility automatically — no extra config needed.

## Quick Install (end user)

```bash
git clone https://github.com/yourusername/mysipphone.git
cd mysipphone
./scripts/install.sh
```

This compiles pjsip, builds the Rust binary, and installs everything to `~/.local/`:
- Binary: `~/.local/bin/mysipphone`
- pjsip libs: `~/.local/lib/mysipphone/`
- Desktop entry: `~/.local/share/applications/mysipphone.desktop`
- Icons: `~/.local/share/icons/hicolor/*/apps/mysipphone.png`

Then find "mySIPPhone" in your app menu or run `mysipphone`.

## Development Setup

### 1. System Packages

**Ubuntu 24.04 / Pop!_OS 24.04 / Debian 12+**

```bash
sudo apt update
sudo apt install -y \
  build-essential pkg-config curl make \
  libgtk-3-dev libwebkit2gtk-4.1-dev libappindicator3-dev \
  librsvg2-dev libsoup-3.0-dev libjavascriptcoregtk-4.1-dev \
  libasound2-dev \
  libx11-dev libxext-dev libxft-dev libxinerama-dev \
  libxcursor-dev libxrandr-dev libxi-dev \
  uuid-dev libtool autoconf automake g++ nodejs npm
```

### 2. Install Rust + Node.js

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
nvm install --lts
```

### 3. Build pjsip

```bash
./scripts/setup-pjsip.sh
```

### 4. Install npm Dependencies

```bash
cd frontend && npm install && cd ..
```

### 5. Set Environment (every shell)

```bash
source ./scripts/set-env.sh
```

### 6. Build & Run

```bash
cargo tauri dev          # Full app
cargo build --release    # Release binary only
```

## Commands

| Command | What it does |
|---------|-------------|
| `cargo tauri dev` | Run full app (Tauri window) |
| `./scripts/install.sh` | Full per-user install |
| `./scripts/build-appimage.sh` | Build AppImage |
| `cargo check` | Check Rust compilation |
| `cargo clippy --all-targets -- -D warnings` | Rust lint |
| `cargo test -p pjsip-sys` | Verify FFI struct sizes |
| `npm run dev` (in `frontend/`) | Frontend dev server |
| `npm run lint` (in `frontend/`) | Frontend lint |
| `npx tsc --noEmit` (in `frontend/`) | TypeScript check |

## Troubleshooting

### `pjsua_init failed: 70004` (PJ_EINVAL)
Struct size mismatch in `pjsip-sys`. Run `cargo test -p pjsip-sys` to verify.
Fix: `packages/pjsip-sys/src/lib.rs:29` — `pjsua_config._opaque` must be `[u8; 2640]`.

### `pkg-config: libpjproject not found`
Run `./scripts/setup-pjsip.sh` first, then `source ./scripts/set-env.sh`.

### Icon shows generic gear in app menu
Desktop icon cache stale. Run:
```bash
gtk-update-icon-cache ~/.local/share/icons/hicolor
```

### Window icon shows generic while app is running
WM_CLASS mismatch. Desktop entry uses `StartupWMClass=com.mysipphone.desktop`.
Re-login or restart shell if dock doesn't update.

### No audio devices detected
```bash
aplay -l
arecord -l
sudo apt install pipewire-alsa   # if using PipeWire
```

## License

MIT
