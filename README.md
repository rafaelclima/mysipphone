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
| Dark/light theme | ✅ MUI 3 theming |
| Navigation | ✅ Dialer, Contacts, History, Settings |
| Incoming/Outgoing call UI | ✅ Phone shell with ActiveCall screen |

### Planned (M4–M7)
- Full call capability (outgoing + incoming)
- Bidirectional RTP audio
- Call hold, mute, transfer
- Multiple simultaneous lines
- Contact management (CRUD)
- Call history persistence
- Audio device hotplug
- Packaging for distribution (.deb, .AppImage)

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
| libstdc++ | pjsua2 C++ dependency |

Your distro's **PipeWire** (common on modern Linux) provides ALSA compatibility automatically — no extra config needed.

## Quick Install

For most Linux distributions (Ubuntu 24.04+, Fedora 40+, Arch), run the automatic installer:

```bash
git clone https://github.com/yourusername/mysipphone.git
cd mysipphone
./scripts/install-deps.sh
```

This installs everything: system packages, Rust, Node.js, pjsip, npm deps, and creates a `set-env.sh` helper.

Then build and run:

```bash
source ./scripts/set-env.sh
cargo tauri dev
```

## Manual Installation

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

**Fedora 40+**

```bash
sudo dnf install -y \
  gcc gcc-c++ make pkgconfig curl \
  gtk3-devel webkit2gtk4.1-devel libappindicator-gtk3-devel \
  librsvg2-devel libsoup3-devel \
  alsa-lib-devel \
  libX11-devel libXext-devel libXft-devel \
  libXinerama-devel libXcursor-devel libXrandr-devel libXi-devel \
  libuuid-devel libtool autoconf automake nodejs npm
```

**Arch Linux**

```bash
sudo pacman -S --needed \
  base-devel pkgconf curl \
  gtk3 webkit2gtk-4.1 libappindicator-gtk3 \
  librsvg libsoup3 \
  alsa-lib \
  libx11 libxext libxft libxinerama libxcursor libxrandr libxi \
  util-linux libtool autoconf automake nodejs npm
```

### 2. Install Rust

```bash
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
source "$HOME/.cargo/env"
```

### 3. Install Node.js

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
nvm install --lts
```

Or install via your distro's package manager.

### 4. Build pjsip from Source

pjsip is **not available** as a distro package. The project includes a build script:

```bash
./scripts/setup-pjsip.sh
```

This downloads pjsip 2.17, configures with shared libs (video/webrtc/ffmpeg disabled), compiles, and installs to `./pjsip-dist/`.

**Build dependencies** (all installed in step 1): `gcc`, `g++`, `make`, `libasound2-dev`, `uuid-dev`, `libtool`.

Takes 2–5 minutes on modern hardware.

### 5. Install npm Dependencies

```bash
cd frontend
npm install
cd ..
```

### 6. Set Environment Variables

```bash
export PKG_CONFIG_PATH="$PWD/pjsip-dist/lib/pkgconfig:${PKG_CONFIG_PATH:-}"
export LD_LIBRARY_PATH="$PWD/pjsip-dist/lib:${LD_LIBRARY_PATH:-}"
```

Or source the helper:

```bash
source ./scripts/set-env.sh
```

This must be done **every shell session** before running `cargo build` or `cargo tauri dev`.

### 7. Build & Run

Full Tauri app (frontend + backend):

```bash
cargo tauri dev
```

Frontend dev server only (port 1420):

```bash
cd frontend && npm run dev
```

## Development

### Project Structure

```
mysipphone/
├── packages/
│   ├── pjsip-sys/         Raw FFI bindings to pjsip C API
│   ├── sip-engine/        pjsip lifecycle, call control, events
│   ├── audio-engine/      ALSA backend, device mgmt, ringtone
│   ├── persistence/       SQLite repositories
│   └── shared/            Zero-dep types (enums, structs)
├── src-tauri/             Tauri shell (commands, state, main)
│   ├── commands.rs        Tauri IPC command handlers
│   ├── state.rs           AppState with channel senders
│   └── main.rs            Entrypoint, event forwarding
├── frontend/              React + MUI 3 + Zustand
│   ├── src/
│   │   ├── views/         Page components (Dialer, Settings, etc.)
│   │   ├── store/         Zustand stores
│   │   └── components/    Shared UI components
│   └── eslint.config.js   Flat ESLint config
├── scripts/
│   ├── install-deps.sh    Automatic dependency installer
│   ├── setup-pjsip.sh     pjsip build script
│   └── set-env.sh         Source this to set env vars
└── pjsip-dist/            Local pjsip install (not in git)
```

### Commands

| Command | What it does |
|---------|-------------|
| `cargo tauri dev` | Run full app (Tauri window) |
| `cargo check` | Check Rust compilation |
| `cargo clippy --all-targets -- -D warnings` | Rust lint (no warnings allowed) |
| `npm run dev` (in `frontend/`) | Frontend dev server only |
| `npm run lint` (in `frontend/`) | Frontend lint (ESLint flat config) |
| `npx tsc --noEmit` (in `frontend/`) | TypeScript type check |
| `npm run build` (in `frontend/`) | TypeScript + Vite production build |

### Pre-commit Checklist

```bash
cargo check
cargo clippy --all-targets -- -D warnings
cd frontend && npm run lint
```

Verify no mocked SIP/audio logic was introduced.

## Architecture

```
┌──────────────────────────────────────────────────────┐
│                    Tauri Shell                         │
│  ┌────────────────────────────────────────────────┐   │
│  │  Frontend (React + MUI 3 + Zustand)             │   │
│  │       ↕ Tauri IPC (invoke + events)              │   │
│  │  Rust Backend                                    │   │
│  │  ┌──────────┐ ┌──────────┐ ┌────────────┐      │   │
│  │  │SIP Engine│ │  Audio   │ │Persistence  │      │   │
│  │  │ (pjsip)  │ │ (ALSA)   │ │ (SQLite)    │      │   │
│  │  └────┬─────┘ └────┬─────┘ └────────────┘      │   │
│  │       └──────┬──────┘                           │   │
│  │          shared types                           │   │
│  └────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────┘
```

### Threading

| Thread | Role | Communication |
|--------|------|---------------|
| Main (Tauri) | Tauri event loop, command handlers | — |
| pjsip-engine (`std::thread`) | pjsip event loop | `tokio::sync::mpsc` |
| Audio task (`tokio::spawn`) | Audio command processor | `tokio::sync::mpsc` |
| Ringtone (`std::thread`) | Sine wave playback | Atomic flag |

### Event Flow

```
User action → Tauri command (invoke)
  → sip-engine mpsc channel
  → pjsip processes (dedicated thread)
  → CallEvent via mpsc
  → Tauri app_handle.emit("sip:*")
  → Frontend useTauriEvent hook
  → Zustand store update
  → React re-render
```

## Troubleshooting

### `pkg-config: libpjproject not found`

pjsip is missing or not found. Run `./scripts/setup-pjsip.sh` first, then set environment:

```bash
source ./scripts/set-env.sh
```

### `libasound2-dev` build errors

The `alsa` Rust crate needs ALSA development headers at compile time:

```bash
sudo apt install libasound2-dev    # Ubuntu/Debian
sudo dnf install alsa-lib-devel    # Fedora
sudo pacman -S alsa-lib            # Arch
```

### `cannot find -lgtk-3` or similar

Tauri requires GTK3 development packages:

```bash
sudo apt install libgtk-3-dev libwebkit2gtk-4.1-dev
```

### ALSA "No such device" at runtime

Your system may not have audio hardware accessible. On PipeWire systems, install the ALSA compatibility layer:

```bash
sudo apt install pipewire-alsa
```

Test with:

```bash
speaker-test -t sine -f 440
```

### No audio devices detected in Settings

The app uses ALSA's device hint API to enumerate PCM devices. If none appear, PipeWire's ALSA compat may not be set up:

```bash
# Check if ALSA sees any devices
aplay -l
arecord -l
```

If these return "no soundcards found", install ALSA utilities and ensure PipeWire ALSA module is loaded:

```bash
sudo apt install alsa-utils pipewire-alsa
```

### Tauri: `WebKitGTK` not found

Tauri 2 requires WebKit2GTK 4.1 (not 4.0):

```bash
sudo apt install libwebkit2gtk-4.1-dev
```

Verify with `pkg-config --modversion webkit2gtk-4.1`.

## License

MIT
