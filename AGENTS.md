# mySIPPhone — AGENTS.md

## Stack
- Cargo workspace monorepo (6 crates: `pjsip-sys`, `sip-engine`, `audio-engine`, `persistence`, `shared`, `src-tauri`)
- Tauri 2 desktop shell
- React 18 + Vite 5 + TypeScript 5 + MUI 6 + Zustand 4
- SQLite via rusqlite (bundled `bundled` feature)
- pjsip 2.17 C library via FFI (`pjsip-sys`)
- Audio: ALSA via `alsa` crate (PipeWire provides ALSA compat layer on Pop/Ubuntu)

## Never Do
- No fake/mocked SIP or audio logic
- No placeholder call state machines
- No browser/WebRTC for audio
- No cloud services or backend servers
- No `unwrap()` in production code (use `thiserror`)
- No manually declaring C struct layouts in Rust for pjsip types (use C helpers instead)

# Preferred Rust Patterns

- thiserror for error handling
- Result-based APIs
- Arc only when ownership sharing is required
- Prefer channels over shared mutable state
- Avoid Mutex where message passing is sufficient

# Preferred React Patterns

- Zustand owns UI state
- Rust owns SIP state
- React components remain presentation focused
- Avoid business logic in React views

# Preferred Tauri Patterns

- Event-driven communication
- Strongly typed payloads
- Avoid duplicated state ownership

## Critical FFI Rule — ALWAYS use C helpers for pjsip struct access
The C structs `pjsua_callback`, `pjsua_config`, `pjsua_logging_config`, `pjsua_media_config`,
and `pjsua_acc_config` are COMPLEX with many fields that are easy to mis-declare in Rust.
NEVER declare these structs with full field layouts in Rust. Instead:
- Make them opaque in Rust (expose only fields needed for allocation, or use `[u8; N]` padding)
- Write ALL field access through C helper functions in `helpers.c`
- Use `#[no_mangle] pub unsafe extern "C"` functions for callbacks linked by name from C bridge functions

⚠️ **CRITICAL:** The `_opaque` padding size MUST match the real C struct size exactly (or be larger).
A too-small opaque = buffer overflow → UB → `pjsua_init` fails with `PJ_EINVAL` (70004).
This was the root cause of the "registration works in dev but not after install" bug.
Verified via `cargo test -p pjsip-sys`.

## Callback Architecture
- C bridge functions (in `helpers.c`) match the exact `pjsua_callback` struct field layout
- Bridge functions extract simple values then call `rust_on_*` functions defined in Rust
- Rust callbacks are `#[no_mangle] pub unsafe extern "C"` — no function pointer passing, linked by symbol name
- This avoids all struct layout mismatch UB between Rust and C

### Current callbacks
| C struct field | C bridge | Rust impl | Notes |
|----------------|----------|-----------|-------|
| `on_call_state` | `c_on_call_state` | `rust_on_call_state(call_id, state)` | Extracts state via `pjsua_call_get_info()` |
| `on_incoming_call` | `c_on_incoming_call` | `rust_on_incoming_call(acc_id, call_id)` | Ignores `rdata` |
| `on_call_media_state` | `c_on_call_media_state` | `rust_on_call_media_state(call_id)` | Calls `mysip_call_connect_media()` |
| `on_reg_state2` | `c_on_reg_state2` | `rust_on_reg_state2(acc_id, info)` | |

## Conference Bridge Audio Connection
- `on_call_media_state` MUST call `pjsua_conf_connect(conf_slot, 0)` (stream → playback)
  and `pjsua_conf_connect(0, conf_slot)` (mic → stream)
- This is done via `mysip_call_connect_media(call_id)` C helper
- In `helpers.c`: gets `pjsua_call_info`, checks `media_status == PJSUA_CALL_MEDIA_ACTIVE`,
  then connects both directions
- Without this, sound device plays silence (RTP decoded but not routed to speaker)

## Media Config — 8000 Hz Clock Rate
- `media_cfg.clock_rate = 8000` and `media_cfg.snd_clock_rate = 8000` are critical
- Higher rates (16000) cause `playdbuf WSOLA buffer size may be too small` errors
- The software clock (`Sound port uses internal (or software) clock`) handles drift fine at 8kHz
- `channel_count = 2` (stereo) works with the 8kHz config

## Asterisk Feature Code (#) Compatibility
- `pjsip_cfg()->endpt.allow_tx_hash_in_uri = PJ_TRUE` prevents pjsip from
  encoding `#` as `%23` in outgoing URIs (set in `mysip_apply_settings`, helpers.c:311)
- **`*8#` call pickup**: The frontend sends `sip:*8%23@dominio` (encodes `#` as `%23`).
  `mysip_make_call` decodes `%23` → `#` in the user part, then strips trailing `#`
  (Asterisk dial terminator). Physical phones send `*8` (without `#`) for general pickup.
  Targeted pickup (`*8#123`) keeps `#` intact.
- See helpers.c:56-71 for the decode + strip logic.

## Pending / To Test
- **Multi-line (call waiting)**: Second incoming call while active → banner overlay → answer (holds first) → swap between calls → hangup one returns to the other. Need real-world SIP testing.
- **Transfer cancel**: Pressing ✕ or Escape closes the transfer input (implemented but needs verification).
- **Device themes**: iPhone/Galaxy/Pixel switch — see M6b in ROADMAP.md

## Known Issues
1. **Device enumeration name garbling** — `pjmedia_snd_dev_info.name` display is garbled in
   eprintln output (truncated first character). Cosmetic only; device selection works correctly.
2. **Release SIGSEGV with opt-level >= 1** — Release builds crash with `segfault at 0` (exit 139)
   on COSMIC/Wayland. Crashes after SIP engine starts, on `pjsip-engine` thread. Reproduces even
   with pre-change code (`git stash`). Root cause is undefined behavior (likely in pjsip FFI or
   WebKitGTK interaction) exploited by compiler optimizations. Workaround: `[profile.release]
   opt-level = 0`. Investigate pjsip FFI struct layout, C helper pointer semantics, or
   WebKitGTK threading model for UB source.

## Omarchy / Arch Linux Debug (EGL crash + PipeWire Audio)

### Problem
Two separate failures on Arch-based distros with Wayland + PipeWire:

**A) EGL/WebKit crash** — `Could not create default EGL display: EGL_BAD_PARAMETER. Aborting...`
The WebKitGTK webview cannot create an EGL display. The Rust backend survives (heartbeat continues),
but the UI window is killed. `WEBKIT_DISABLE_DMABUF_RENDERER=1` alone may not be sufficient.

**B) All audio devices show (in=0, out=0, rate=0)** — pjsip's `pjsua_enum_snd_devs()` reports
PipeWire ALSA devices with zero channels/rate. Devices are skipped (line 439 in `account.rs`),
`try_order`/`fallback` lists stay empty → null sound device.

### Debug Commands (run on the Omarchy machine)

#### 1. Check system packages
```bash
pacman -Qi webkit2gtk-4.1 gtk3 libxkbcommon mesa vulkan-driver pipewire pipewire-alsa alsa-lib
```
Missing `pipewire-alsa` is likely root cause of audio issue (no ALSA PCM devices exposed by PipeWire).

#### 2. EGL / WebKit troubleshooting
```bash
# Force X11 backend (bypasses EGL issues)
GDK_BACKEND=x11 WEBKIT_DISABLE_DMABUF_RENDERER=1 /home/rafaellima/.local/share/AppImage/mySIPPhone_0.1.3_amd64.AppImage

# Check Wayland session type
echo $XDG_SESSION_TYPE
echo $WAYLAND_DISPLAY

# Test WebKit separately
# Install: pacman -S webkitgtk-6.0 (or webkit2gtk-4.1-debug)
# Check EGL details:
glxinfo -B 2>/dev/null || echo "glxinfo not available"
eglinfo 2>/dev/null || echo "eglinfo not available (install libegl)"
```

#### 3. ALSA/PipeWire audio troubleshooting
```bash
# Check PipeWire status
pactl info
pactl list sinks short
pactl list sources short

# ALSA device listing
aplay -l
arecord -l
speaker-test -D default -t sine -f 440 -l 1  # should play a beep

# Check if pipewire-alsa is configured
cat /etc/asound.conf 2>/dev/null || echo "no /etc/asound.conf"
cat ~/.asoundrc 2>/dev/null || echo "no ~/.asoundrc"
cat /usr/share/alsa/alsa.conf.d/pipewire-alsa.conf 2>/dev/null || echo "no pipewire-alsa.conf"

# PipeWire ALSA PCM devices
pcm_list=$(pactl list sinks | grep "Name:" | head -5)
echo "Available sinks: $pcm_list"

# Check ALSA devices ALSA lib sees vs pjsip
# Run with:
ALSA_CONFIG_PATH="" /home/rafaellima/.local/share/AppImage/mySIPPhone_0.1.3_amd64.AppImage
```

#### 4. Run diagnostic script
```bash
bash <(curl -s https://raw.githubusercontent.com/rafaelclima/mysipphone/dev/scripts/diagnose-arch.sh)
```
Or copy `scripts/diagnose-arch.sh` from the repo and run it locally.

### Root Cause Likelihood (audio)
| Probability | Cause | Check |
|-------------|-------|-------|
| **High** | `pipewire-alsa` not installed | `pacman -Qi pipewire-alsa` |
| **Medium** | PipeWire JACK/PulseAudio bridge misconfigured | `pactl info` |
| **Low** | pjsip built against wrong ALSA version | `ldd pjsip-dist/lib/libpjmedia-audiodev.so` |

### Root Cause Likelihood (EGL)
| Probability | Cause | Check |
|-------------|-------|-------|
| **High** | Mesa/GPU driver incompatibility with WebKit | `MESA_LOADER_DRIVER_OVERRIDE=iris` test |
| **Medium** | Missing `libxkbcommon` | `pacman -Qi libxkbcommon` |
| **Low** | COSMIC compositor EGL limitation | `GDK_BACKEND=x11` test |

## FFI Struct Sizes (pjsip 2.17, x86_64)
These MUST match the Rust `_opaque` padding exactly:
- `pjsua_config`        = **2648** bytes (Rust: `max_calls: c_uint + thread_cnt: c_uint + [u8; 2640]`)
- `pjsua_logging_config` = **48** bytes (Rust: `[u8; 2048]` — oversize OK)
- `pjsua_media_config`   = **832** bytes (Rust: `[u8; 2048]` — oversize OK)
- `pjsua_acc_config`     = **4960** bytes (declared with full fields in Rust — only used via C helper)
- `pjsua_callback`       = **464** bytes (fully accessed via C helpers)

**CRITICAL:** If `_opaque` is too small, `pjsua_config_default()` or `mysip_apply_settings()`
writes past buffer → corrupts memory → `pjsua_init` returns `PJ_EINVAL` (70004).
Verify with: `cargo test -p pjsip-sys`

## Window Config
- Size: 320×600 (`resizable: true`) — was 240×520 (`resizable: false`). Changed to give more
  breathing room and allow user resize.
- `decorations: false` — no window chrome, phone-like frameless window
- If AppImage window appears smaller than dev, the config is identical; discrepancy may stem
  from Tauri 2 dev server behavior vs production binary.

## Device Themes (iPhone / Galaxy / Pixel)
- Three device mockup themes: `iphone` (default), `galaxy`, `pixel`
- Each theme changes: phone shell corner radius, camera cutout shape (notch vs punch-hole),
  status bar layout (time alignment, top spacing), and status bar icons (signal, WiFi, battery).
- Pixel theme reuses MUI Material icons; iPhone and Galaxy use custom inline SVG icons.
- Theme selected in Settings → Device Theme. Persisted to `localStorage` via `useSettingsStore`.
- Config in `frontend/src/theme/deviceThemes.ts` — `DEVICE_THEMES` record with per-theme values.
- Icons in `frontend/src/theme/icons/` — `SignalIcon`, `DeviceWifiIcon`, `BatteryIcon`.
- MUI dark/light mode is orthogonal — both dimensions work independently.

## Icon Installation (per-user, no sudo)
- Desktop file uses **absolute path** to PNG icon (not icon name lookup) because `~/.local/share`
  may not be in `XDG_DATA_DIRS` on all distros.
- Icon must be regenerated when source changes: run ImageMagick downscale from
  `resources/mysipphone.png` (500×500 RGBA) into 7 sizes in `src-tauri/icons/`.
- `install.sh` copies to `~/.local/share/icons/hicolor/*/apps/mysipphone.png` and runs
  `gtk-update-icon-cache` to refresh the icon cache.
- The `.desktop` `StartupWMClass=com.mysipphone.desktop` matches Tauri's actual WM_CLASS
  (set from app identifier), so the dock picks up the icon for running windows.

## Build Setup

### pjsip (one-time)
```bash
./scripts/setup-pjsip.sh
```

### ALSA headers (one-time, if not installed)
```bash
sudo apt-get install libasound2-dev
# Or manual extraction:
apt-get download libasound2-dev && mkdir -p /tmp/alsa-dev && dpkg-deb -x libasound2-dev_*.deb /tmp/alsa-dev
mkdir -p /tmp/alsa-pc
# Create /tmp/alsa-pc/alsa.pc:
#   prefix=/tmp/alsa-dev/usr
#   libdir=${prefix}/lib/x86_64-linux-gnu
#   includedir=${prefix}/include
#   Libs: -L${libdir} -lasound
#   Cflags: -I${includedir}
```

### Build (every shell)
```bash
export PKG_CONFIG_PATH="$PWD/pjsip-dist/lib/pkgconfig:/tmp/alsa-pc:${PKG_CONFIG_PATH:-}"
export LD_LIBRARY_PATH="$PWD/pjsip-dist/lib:/tmp/alsa-dev/usr/lib/x86_64-linux-gnu:${LD_LIBRARY_PATH:-}"
source "$HOME/.cargo/env"
cargo check -p audio-engine      # single crate
cargo check                      # whole workspace
```

## Commands
| What | Command (from project root) |
|------|-----------------------------|
| Dev (full Tauri) | `cargo tauri dev` |
| Install (system) | `./scripts/install.sh` |
| Install (Arch/Omarchy) | `./scripts/setup-arch.sh` (optional: path or URL) |
| Build AppImage | `./scripts/build-appimage.sh` |
| Frontend dev only | `npm run dev` (in `frontend/`) |
| Rust lint | `cargo clippy --all-targets -- -D warnings` |
| Frontend lint | `npm run lint` (in `frontend/`) |
| Frontend typecheck | `npx tsc --noEmit` (in `frontend/`) |
| Frontend build | `npm run build` (in `frontend/`) — runs `tsc && vite build` |

## Pre-Commit
1. `cargo test -p pjsip-sys` (verify struct sizes)
2. `cargo check`
3. `cargo clippy --all-targets -- -D warnings`
4. `npm run lint` (in `frontend/`)
5. `npx tsc --noEmit` (in `frontend/`)
6. Verify no mocked SIP/audio logic was introduced
7. Verify no `pjsua_callback` or other pjsip structs are declared with full fields in Rust

## Architecture Rules
- `sip-engine` on dedicated `std::thread("pjsip-engine")`; communicates via `tokio::sync::mpsc`
- `audio-engine` runs as a `tokio::spawn` task consuming `AudioCommand`; `RingtonePlayer` spawns its own `std::thread`
- Device enumeration runs synchronously via direct ALSA calls (no channel needed)
- Frontend NEVER accesses SIP or audio hardware directly
- Event flow: `sip-engine → mpsc → Tauri event (sip:* namespace) → Zustand store → React`
- Audio flow: `Tauri command → AudioCommandSender → audio-engine task → ALSA`
- Shared event types in `packages/shared/src/lib.rs` (CallState, AccountState, AudioDevice, etc.)
- `pjsip-sys/build.rs` probes `libpjproject` via `pkg_config` — fails immediately if pjsip not found
- Tauri command handlers take `State<'_, Arc<Mutex<AppState>>>` and clone the mpsc sender
- ALL pjsip C struct access goes through C helpers in `helpers.c`, never through Rust struct field access
- Callback registration: C bridge functions (static in helpers.c) call `#[no_mangle] extern "C"` Rust functions
- Mute is handled via `pjsua_conf_disconnect(0, conf_slot)` / `pjsua_conf_connect(0, conf_slot)` in `helpers.c:mysip_set_mic_mute` — physically disconnects mic (port 0) from call's conf_slot. This is guaranteed correct vs. confusing TX/RX semantics of `pjsua_conf_adjust_*_level`.
- Database path: `~/.local/share/mysipphone/mysipphone.db` (persistent per-user, survives reboot)
- **Incoming call popup**: Rust creates a secondary `WebviewWindow("incoming-popup")` at top-right (300×180, `always_on_top`, no decorations, `skip_taskbar`). Popup reads call info via `invoke("get_incoming_call_info")`. Answer/Reject emits `popup:answer`/`popup:reject` events to main window. Auto-closes on call state leaving `Ringing` or via `popup:dismiss` event. Capabilities include `"incoming-popup"` window with `allow-close` and `allow-set-focus`.

## Architecture Review Rules

Before proposing any change:

1. Understand the existing implementation.
2. Verify the framework version.
3. Consult Context7 documentation.
4. Compare implementation with current best practices.
5. Explain trade-offs.
6. Classify risk.
7. Generate a migration plan.
8. Only then modify code.

Never:

- rewrite working SIP flows without evidence
- replace pjsip functionality
- change audio architecture without justification
- introduce abstractions for theoretical reasons
- refactor multiple subsystems simultaneously

Priorities:

1. Audio stability
2. SIP reliability
3. Correct call state transitions
4. Resource management
5. Maintainability
6. Performance
7. UI polish

## File Layout
```
packages/
  pjsip-sys/       raw FFI to pjsua C API (bindings, build.rs, helpers.c)
  sip-engine/      pjsip lifecycle, call control, event emission
  audio-engine/    ALSA backend, device mgmt, ringtone player
  persistence/     SQLite repos (Account, Contact, CallLog, etc.)
  shared/          zero-dep types crate (enums, structs)
src-tauri/         Tauri shell: commands.rs, state.rs, main.rs
  icons/           7 PNG icon sizes (16×16 to 256×256), regenerated from resources/mysipphone.png
frontend/          React app (Vite config, eslint.config.js, i18n/)
  src/
    store/         Zustand stores (useAuthStore, useCallStore, useContactStore)
    views/         Page components (Dialer, ActiveCall, IncomingCall, Contacts, CallHistory, Settings, AccountSetup)
    components/    Shared UI (PhoneShell, StatusBar, NavigationBar, IncomingBanner)
    i18n/          Translations (en.ts, pt-BR.ts, index.tsx)
    theme.ts       MUI dark/light theme
    theme/
      deviceThemes.ts   Device mockup config (corner, notch, icons per theme)
      icons/            SignalIcon, DeviceWifiIcon, BatteryIcon (SVG per device)
scripts/           setup-pjsip.sh, setup-arch.sh, install-deps.sh, set-env.sh, install.sh, build-appimage.sh
pjsip-dist/       local pjsip install (not in git)
resources/        source assets (mysipphone.png — 500×500 RGBA icon source)
```

## Notable Quirks
- No `opencode.json`, no CI, no `.cargo/config.toml`
- Frontend ESLint is flat config (`eslint.config.js`), not `.eslintrc`
- Vite runs on port 1420, HMR on 1421
- `cargo tauri dev` requires GTK3 + WebKit2GTK + libayatana-appindicator3 (system packages)
- Frontend `package.json` is in `frontend/`, not workspace root
- Database is at `~/.local/share/mysipphone/mysipphone.db` (survives reboot, per-user)
- SIP account password stored in plaintext in SQLite
- `CallLogEntry.end_reason` is now determined by tracking locally-initiated hangup (`HUNG_UP_CALLS` HashSet) and SIP status code (486=Busy, 480/487=NoAnswer, 603=Rejected). Falls back to `RemoteHangup`.
- Contact form uses "number/extension" field, auto-constructs `sip:ramal@dominio` from registered account
- Audio hotplug polls every 2s via `AudioCommand::SetHotplugChannel`. Emits `sip:devices-changed` Tauri event on change.
- SIP reconnection uses exponential backoff (1s, 2s, 4s, ... 60s max) via `SipCommand::RetryRegister`. Retry thread spawned from `rust_on_reg_state2` when status code ≥ 400.
- Registration status code is extracted via `mysip_reg_info_get_code()` C helper (reads `info->cbparam->code`).
- Frontend animations use Framer Motion `AnimatePresence` with fade+slide on route changes.
- CSV import: hidden `<input type="file" accept=".csv">`, parse client-side, bulk-import via `add_contact` command.
- Settings audio section: test tone button per speaker, default badge chips, hotplug auto-refresh.
- Binary RUNPATH `$ORIGIN/../lib/mysipphone` (set in `src-tauri/build.rs`) to find pjsip .so files
  per-user install. Pjsip `.so` files themselves have `$ORIGIN` RPATH via `patchelf` in install.sh.
- `setup-pjsip.sh` uses `return 0 2>/dev/null || exit 0` instead of plain `exit 0` so it can be
  safely `source`d by `install.sh` without killing the parent script.
- `install.sh` creates `~/.local/share/icons/hicolor/index.theme` if missing, then runs
  `gtk-update-icon-cache` so the desktop environment finds the app icon.
- `install.sh` uses `cargo tauri build` (not `cargo build --release`) — Tauri CLI runs
  `beforeBuildCommand`, embeds frontend, and creates bundles (AppImage, .deb).
- `setup-arch.sh` is for Arch/Omarchy/Manjaro users. Installs `webkit2gtk-4.1` (runtime Tauri dep),
  downloads/installs AppImage, extracts icons, creates desktop entry.
  Sets `WEBKIT_DISABLE_DMABUF_RENDERER=1` when on Wayland (fix white screen on Hyprland).
  Also checks for `pipewire-alsa` and warns if missing (common audio issue).
  Usage: `./scripts/setup-arch.sh [path|URL]`.
- `diagnose-arch.sh` is a diagnostic script for Arch-based machines. Collects system info, package
  versions, EGL/GPU state, PipeWire status, and ALSA config in a single report.
  Run via: `bash scripts/diagnose-arch.sh` or `bash <(curl -sL https://raw.githubusercontent.com/rafaelclima/mysipphone/dev/scripts/diagnose-arch.sh)`
- The `.desktop` `Icon` uses absolute path to bypass `XDG_DATA_DIRS` lookup issues.
