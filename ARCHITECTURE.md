# mySIPPhone Architecture

## Overview
Production-grade SIP softphone for Linux desktop. Tauri desktop shell with Rust backend and React/MUI 3 frontend. Direct SIP + RTP to Asterisk/Issabel PBX on local network.

## System Diagram

```
┌─────────────────────────────────────────────────────┐
│                    Tauri Shell                        │
│  ┌───────────────────────────────────────────────┐   │
│  │  Frontend (React + MUI 3)                     │   │
│  │  ┌─────────┐ ┌──────────┐ ┌───────────────┐  │   │
│  │  │ Dialer  │ │ActiveCall│ │ Settings       │  │   │
│  │  └────┬────┘ └────┬─────┘ └───────┬───────┘  │   │
│  │       │            │               │           │   │
│  │  ┌────▼────────────▼───────────────▼───────┐  │   │
│  │  │          Zustand Stores                 │  │   │
│  │  │  useCallStore | useAuthStore | ...      │  │   │
│  │  └────────────────┬───────────────────────┘  │   │
│  └───────────────────┼───────────────────────────┘   │
│                      │ Tauri Events (IPC)            │
│  ┌───────────────────┼───────────────────────────┐   │
│  │  Rust Backend     │                           │   │
│  │  ┌────────────────▼───────────────────────┐  │   │
│  │  │         Tauri Commands                  │  │   │
│  │  └────────────────┬───────────────────────┘  │   │
│  │       ┌───────────┼───────────┐              │   │
│  │       ▼           ▼           ▼              │   │
│  │  ┌─────────┐ ┌─────────┐ ┌──────────┐      │   │
│  │  │SIP Engine│ │  Audio  │ │Persistence│      │   │
│  │  │ (pjsip)  │ │ Engine  │ │ (SQLite)  │      │   │
│  │  └────┬────┘ │ (ALSA)  │ └──────────┘      │   │
│  │       │      └────┬────┘                    │   │
│  │       ▼           ▼                         │   │
│  │  ┌──────────────────────────┐               │   │
│  │  │      shared types        │               │   │
│  │  └──────────────────────────┘               │   │
│  └───────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────┘
```

## Package Architecture

### sip-engine
- Wraps pjsip C library via FFI
- Runs on a dedicated OS thread (pjsip requires thread affinity)
- Communicates via `tokio::sync::mpsc` channels
- Emits `CallEvent` enum for all state changes
- Handles: register, call, hangup, hold, mute, transfer, DTMF, reconnect

Key files:
- `account.rs` — SIP account registration lifecycle
- `call.rs` — call control (invite, hangup, hold, transfer, dtmf)
- `events.rs` — `CallEvent`, `RegState`, `AudioEvent`
- `error.rs` — typed errors

### audio-engine
- ALSA backend via `alsa` crate (PipeWire provides ALSA compatibility layer)
- Device enumeration via ALSA card + pcm hint iteration
- Stream management on single dedicated thread (ALSA is not thread-safe per PCM handle)
- Separate ringtone output (440Hz sine wave burst on its own std::thread)
- Mute control via atomic flag

Key files:
- `backend.rs` — `AudioBackend` trait
- `alsa_backend.rs` — ALSA implementation of AudioBackend
- `device.rs` — device enumeration and selection via ALSA card/hint API
- `ringtone.rs` — ringtone player with sine wave generation

### persistence
- SQLite via rusqlite (bundled)
- Versioned migrations
- Repository pattern for each entity
- Models: Account, Contact, CallLog, Setting, AudioPreference

### shared
- Zero-dependency types crate
- `CallState`, `CallDirection`, `AccountState`, `AudioDevice`
- Enums and structs shared across all crates

## Threading Model

```
Main Thread (Tauri)       SIP Thread (pjsip)      Audio Task (tokio)
      │                        │                         │
      │   register_account     │                         │
      │──────────────────────► │                         │
      │                        │── pjsip registration     │
      │   CallEvent::RegOk     │                         │
      │◄────────────────────── │                         │
      │                        │                         │
      │   call(uri)            │                         │
      │──────────────────────► │                         │
      │                        │── pjsip invite          │
      │                        │── audio command         │
      │                        │────────────────────────►│
      │   CallEvent::Connected │    (audio stream mgmt)  │
      │◄────────────────────── │                         │
      │                        │                         │
      │   get_audio_devices    │                         │
      │   (via ALSA directly)  │                         │
```

Audio commands flow: `Tauri command → AudioCommandSender → AudioEngine::run (tokio::spawn)`.
Ringtone plays on its own `std::thread` spawned by `RingtonePlayer::play()`.
Device enumeration runs synchronously on the Tauri command thread via direct ALSA calls.

## Data Flow

1. User action in React → Tauri command (invoke)
2. Command handler → sip-engine channel
3. sip-engine processes via pjsip → emits CallEvent
4. Tauri event listener → emits to frontend via `app_handle.emit()`
5. React hook `useTauriEvent` → updates Zustand store → re-render

## Error Handling
- All fallible functions return `Result<T, AppError>`
- SIP errors mapped to typed `SipError`
- Audio errors logged + recovery attempted
- Frontend shows user-friendly messages, never raw error codes

## Security
- No credentials in code; stored in SQLite (encrypted at rest in future)
- SIP over local network only
- No external network access required
- No cloud dependencies

## FFI Struct Integrity

Rust declares pjsip C structs as opaque types with `_opaque: [u8; N]` padding.
The padding MUST match or exceed the real C struct size. If too small,
`pjsua_config_default()` or `mysip_apply_settings()` writes past buffer →
UB → `pjsua_init` returns `PJ_EINVAL` (70004).

**Current critical sizes (pjsip 2.17, x86_64):**

| Struct | C Size | Rust padding | File |
|--------|--------|-------------|------|
| `pjsua_config` | 2648 | `[u8; 2640]` | `packages/pjsip-sys/src/lib.rs:29` |

Verify with `cargo test -p pjsip-sys`. If struct sizes change (pjsip update),
run the C program in `scripts/check_struct_sizes.c` to measure new values.


## Packaging & Distribution

| Artefato | Observação |
|----------|-----------|
| AppImage / .deb (`build-appimage.sh`) | O AppImage **embute** WebKitGTK/GTK compilados para Ubuntu 24.04 — no Arch/Omarchy o WebKit embutido aborta (`EGL_BAD_PARAMETER`) e a janela abre em branco. O .deb não tem esse problema (usa as libs do sistema). |
| Build nativo (Arch/Omarchy) | **Forma recomendada no Arch/Omarchy**: `cargo build --release` com `opt-level = 0` (ver Known Issue no AGENTS.md). O binário nativo linka o WebKit2GTK 4.1 do sistema — sem workarounds de runtime. |

O WebView é sempre o WebKit2GTK 4.1 do sistema no build nativo; apenas o
AppImage tenta empacotar o próprio runtime. Se um dia o AppImage for refeito
para Arch (ou com WebKit do sistema), o crash de EGL desaparece.

