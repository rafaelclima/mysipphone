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

## Critical FFI Rule — ALWAYS use C helpers for pjsip struct access
The C structs `pjsua_callback`, `pjsua_config`, `pjsua_logging_config`, `pjsua_media_config`,
and `pjsua_acc_config` are COMPLEX with many fields that are easy to mis-declare in Rust.
NEVER declare these structs with full field layouts in Rust. Instead:
- Make them opaque in Rust (expose only fields needed for allocation, or use `[u8; N]` padding)
- Write ALL field access through C helper functions in `helpers.c`
- Use `#[no_mangle] pub unsafe extern "C"` functions for callbacks linked by name from C bridge functions

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

## Pending / To Test
- **Multi-line (call waiting)**: Second incoming call while active → banner overlay → answer (holds first) → swap between calls → hangup one returns to the other. Need real-world SIP testing.
- **Transfer cancel**: Pressing ✕ or Escape closes the transfer input (implemented but needs verification).
- **Call history**: Call log saving on end, display with direction/end_reason, grouped by date. Verify data persists across restarts.
- **Device themes**: iPhone/Galaxy/Pixel switch — see M6b in ROADMAP.md
- **Call from history**: Phone icon on history rows — see M6b in ROADMAP.md
- **Call Pickup `*8#`** : Button in Dialer, needs URI wrapping `sip:*8%23@dominio` — see M6b in ROADMAP.md

## Known Issues
1. **Device enumeration name garbling** — `pjmedia_snd_dev_info.name` display is garbled in
   eprintln output (truncated first character). Cosmetic only; device selection works correctly.
2. **EBUSY on registration** — `mysip_account_add()` calls `pjsua_acc_set_registration()` which
   returns 171001 (PJSIP_EBUSY) because `pjsua_acc_add()` already starts registration. The
   registration actually completes successfully (200 OK). The Rust frontend shows a spurious
   `registration_failed` event followed by `registered`. To fix: remove the explicit
   `pjsua_acc_set_registration()` call in `mysip_account_add()`.
3. **Hangup after BYE** — If the remote hangs up first, the Rust hangup command fails with
   171140 (call already disconnected). Harmless but logged as ERROR.
4. **Call end_reason always RemoteHangup** — `rust_on_call_state` on `Ended` state always sets
   `end_reason: RemoteHangup` regardless of who hung up. Needs pjsua call info inspection.

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
| Frontend dev only | `npm run dev` (in `frontend/`) |
| Rust lint | `cargo clippy --all-targets -- -D warnings` |
| Frontend lint | `npm run lint` (in `frontend/`) |
| Frontend typecheck | `npx tsc --noEmit` (in `frontend/`) |
| Frontend build | `npm run build` (in `frontend/`) — runs `tsc && vite build` |

## Pre-Commit
1. `cargo check`
2. `cargo clippy --all-targets -- -D warnings`
3. `npm run lint` (in `frontend/`)
4. `npx tsc --noEmit` (in `frontend/`)
5. Verify no mocked SIP/audio logic was introduced
6. Verify no `pjsua_callback` or other pjsip structs are declared with full fields in Rust

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
- Mute is handled via audio-engine (`AudioCommand::SetMute`), NOT via pjsip
- Database path: `/tmp/mysipphone.db` (file-based, persistent across restarts)

## File Layout
```
packages/
  pjsip-sys/       raw FFI to pjsua C API (bindings, build.rs, helpers.c)
  sip-engine/      pjsip lifecycle, call control, event emission
  audio-engine/    ALSA backend, device mgmt, ringtone player
  persistence/     SQLite repos (Account, Contact, CallLog, etc.)
  shared/          zero-dep types crate (enums, structs)
src-tauri/         Tauri shell: commands.rs, state.rs, main.rs
frontend/          React app (Vite config, eslint.config.js, i18n/)
  src/
    store/         Zustand stores (useAuthStore, useCallStore, useContactStore)
    views/         Page components (Dialer, ActiveCall, IncomingCall, Contacts, CallHistory, Settings, AccountSetup)
    components/    Shared UI (PhoneShell, StatusBar, NavigationBar, IncomingBanner)
    i18n/          Translations (en.ts, pt-BR.ts, index.tsx)
    theme.ts       MUI dark/light theme
scripts/           setup-pjsip.sh, install-deps.sh, set-env.sh
pjsip-dist/       local pjsip install (not in git)
```

## Notable Quirks
- No `README.md`, no `opencode.json`, no CI, no `.cargo/config.toml`
- Frontend ESLint is flat config (`eslint.config.js`), not `.eslintrc`
- Vite runs on port 1420, HMR on 1421
- `cargo tauri dev` requires GTK3 + WebKit2GTK + libayatana-appindicator3 (system packages)
- Frontend `package.json` is in `frontend/`, not workspace root
- Database is at `/tmp/mysipphone.db` — will be wiped on system reboot
- SIP account password stored in plaintext in SQLite
- `CallLogEntry.end_reason` is always `RemoteHangup` regardless of who hung up (needs pjsua_call_info inspection to fix)
- Contact form uses "number/extension" field, auto-constructs `sip:ramal@dominio` from registered account
